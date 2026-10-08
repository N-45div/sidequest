"""How busy is a study space usually at a given hour? A TabPFN study on Google popular times.

Input: artifacts/busyness/venues.json from scripts/busyness_collect.py. Each row is one venue, weekday and
hour with the venue's usual busyness (0-100). Features come only from the search result, so a forecast
needs no paid place lookup: category, place type, rating, review count, location, opening hours, weekday
and hour.

  python scripts/tabpfn_busyness.py evaluate     venue-grouped cross-validation: TabPFN vs two baselines
  python scripts/tabpfn_busyness.py publish      fit on every venue with history, forecast the rest, write to Atlas

Runs TabPFN v2's open weights locally (pip install tabpfn); TABPFN_TOKEN switches to Prior Labs' hosted client.
MONGODB_URI is needed for publish. Results: evaluations/tabpfn-busyness.json
"""
import argparse
import json
import math
import os
import re
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / '.env').read_text().splitlines():
    name = line.split('=', 1)[0]
    if name in ('TABPFN_TOKEN', 'MONGODB_URI', 'MONGODB_DATABASE'):
        os.environ.setdefault(name, line.split('=', 1)[1].strip())
VENUES = ROOT / 'artifacts' / 'busyness' / 'venues.json'
REPORT = ROOT / 'evaluations' / 'tabpfn-busyness.json'
DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
HOURS = range(8, 23)
CATEGORIES = ['library', 'campus', 'coworking', 'coffee', 'outdoors']
FEATURES = ['category', 'place_type', 'rating', 'log_reviews', 'latitude', 'longitude', 'weekday', 'weekend',
            'hour', 'opens', 'closes', 'since_open', 'until_close']
MIN_VENUES_PER_CATEGORY = 3


def clock(text, meridiem=None):
    match = re.fullmatch(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?', text.strip(), re.I)
    if not match:
        return None, None
    hour, minute, mer = int(match[1]), int(match[2] or 0), (match[3] or meridiem or '').upper()
    if mer == 'PM' and hour != 12:
        hour += 12
    if mer == 'AM' and hour == 12:
        hour = 0
    return hour + minute / 60, mer or None


def opening(text):
    """(opens, closes) in hours for one day's Google hours string; closes may pass 24. None if unknown."""
    if not text:
        return None
    text = text.replace(' ', ' ').replace('–', '-').replace('—', '-').strip()
    if 'Open 24 hours' in text:
        return 0.0, 24.0
    if text.lower().startswith('closed'):
        return 'closed'
    spans = []
    for part in text.split(','):
        if '-' not in part:
            return None
        start_text, end_text = part.split('-', 1)
        end, mer = clock(end_text)
        start, _ = clock(start_text, None if re.search(r'AM|PM', start_text, re.I) else mer)
        if start is None or end is None:
            return None
        if end <= start:
            end += 24
        spans.append((start, end))
    return min(s for s, _ in spans), max(e for _, e in spans)


def hour_of(label):
    value, _ = clock(label)
    return None if value is None else int(value)


def load():
    venues = json.loads(VENUES.read_text(encoding='utf-8'))
    types = pd.Series([v['search'].get('type') or 'unknown' for v in venues.values()]).value_counts()
    common = set(types[types >= 3].index)
    rows = []
    for place_id, venue in venues.items():
        search = venue['search']
        history = ((venue.get('place') or {}).get('popular_times') or {}).get('graph_results') or {}
        coords = search.get('gps_coordinates') or {}
        for weekday, day in enumerate(DAYS):
            hours = opening((search.get('operating_hours') or {}).get(day))
            known = {hour_of(r['time']): r['busyness_score'] for r in history.get(day, []) if hour_of(r['time']) is not None}
            for hour in HOURS:
                is_open = None if hours is None else hours != 'closed' and hours[0] <= hour < hours[1]
                opens, closes = (np.nan, np.nan) if hours in (None, 'closed') else hours
                rows.append({'place_id': place_id, 'name': search.get('title'), 'category': CATEGORIES.index(venue['category']),
                             'category_name': venue['category'], 'shown_in_app': venue.get('app_rank') is not None,
                             'place_type': search.get('type') if search.get('type') in common else 'other',
                             'rating': search.get('rating', np.nan), 'log_reviews': math.log1p(search.get('reviews') or 0),
                             'latitude': coords.get('latitude', np.nan), 'longitude': coords.get('longitude', np.nan),
                             'weekday': weekday, 'weekend': int(weekday in (0, 6)), 'hour': hour, 'opens': opens, 'closes': closes,
                             'since_open': hour - opens, 'until_close': closes - hour, 'open': is_open,
                             'has_history': bool(history), 'busyness': known.get(hour)})
    frame = pd.DataFrame(rows)
    frame['place_type'] = frame['place_type'].astype('category').cat.codes
    return frame


def training_rows(frame):
    # A positive score means Google saw the place open at that hour; zeros mark closed hours.
    return frame[frame.has_history & (frame.busyness > 0)].reset_index(drop=True)


def band(score):
    return np.digitize(score, [40, 70])


def tabpfn():
    """TabPFN's open weights on this machine's CPU; Prior Labs' hosted client only when TABPFN_TOKEN is set."""
    if os.environ.get('TABPFN_TOKEN'):
        from tabpfn_client import TabPFNRegressor, set_access_token
        set_access_token(os.environ['TABPFN_TOKEN'])
        return TabPFNRegressor()
    # v2 weights download without an account; later versions are gated behind a Prior Labs login
    from tabpfn import TabPFNRegressor
    from tabpfn.constants import ModelVersion
    return TabPFNRegressor.create_default_for_version(ModelVersion.V2, device='cpu', ignore_pretraining_limits=True, random_state=0)


BACKEND = 'Prior Labs hosted client' if os.environ.get('TABPFN_TOKEN') else 'TabPFN v2 open weights, local CPU'


def lookup_baseline(train, test):
    by_type = train.groupby(['category', 'weekday', 'hour']).busyness.mean()
    by_hour = train.groupby(['weekday', 'hour']).busyness.mean()
    return np.array([by_type.get((r.category, r.weekday, r.hour), by_hour.get((r.weekday, r.hour), train.busyness.mean()))
                     for r in test.itertuples()])


def evaluate():
    data = training_rows(load())
    folds = GroupKFold(n_splits=5)
    predictions = {name: np.zeros(len(data)) for name in ['category-hour average', 'gradient boosting', 'TabPFN']}
    seconds = 0.0
    for fold, (train_index, test_index) in enumerate(folds.split(data, groups=data.place_id)):
        train, test = data.iloc[train_index], data.iloc[test_index]
        predictions['category-hour average'][test_index] = lookup_baseline(train, test)
        boost = HistGradientBoostingRegressor(random_state=0).fit(train[FEATURES], train.busyness)
        predictions['gradient boosting'][test_index] = boost.predict(test[FEATURES])
        began = time.monotonic()
        model = tabpfn().fit(train[FEATURES], train.busyness)
        predictions['TabPFN'][test_index] = model.predict(test[FEATURES])
        seconds += time.monotonic() - began
        print(f'fold {fold + 1}: {test.place_id.nunique()} held-out venues', flush=True)
    truth = data.busyness.to_numpy()
    results = {name: {'mae': round(float(np.mean(np.abs(p - truth))), 2),
                      'band_accuracy': round(float(np.mean(band(p) == band(truth))), 4),
                      'quiet_hours_found': round(float(np.mean(band(p)[band(truth) == 0] == 0)), 4),
                      # Of the hours a model calls quiet, how many really were: guards against calling everything quiet
                      'quiet_calls_right': round(float(np.mean(band(truth)[band(p) == 0] == 0)), 4) if (band(p) == 0).any() else None}
               for name, p in predictions.items()}
    report = {'task': 'usual busyness of a study space at an hour (Google popular times, 0-100)',
              'city': 'Bengaluru', 'venues_with_history': int(data.place_id.nunique()), 'rows': int(len(data)),
              'by_category': data.groupby('category_name').place_id.nunique().to_dict(),
              'validation': '5-fold cross-validation grouped by venue: every score is for a venue the model never saw',
              'features': FEATURES, 'bands': 'quiet < 40 <= a little busy < 70 <= busy',
              'results': results, 'tabpfn_backend': BACKEND, 'tabpfn_seconds': round(seconds, 1),
              'notes': 'Popular times measure how crowded a place usually is, not how loud it is. Venue counts are small; '
                       'treat the comparison as indicative.'}
    REPORT.write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(results, indent=1))


def publish(out=None):
    frame = load()
    train = training_rows(frame)
    enough = {c for c, n in train.groupby('category_name').place_id.nunique().items() if n >= MIN_VENUES_PER_CATEGORY}
    target = frame[~frame.has_history & frame.category_name.isin(enough) & (frame.open != False)]  # noqa: E712
    model = tabpfn().fit(train[FEATURES], train.busyness)
    target = target.assign(busyness=np.clip(model.predict(target[FEATURES]), 0, 100))
    documents, stamp = [], time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    for source, rows in [('google', frame[frame.has_history]), ('tabpfn', target)]:
        for place_id, venue in rows.groupby('place_id'):
            week = [[None] * len(HOURS) for _ in DAYS]
            for r in venue.itertuples():
                if source == 'tabpfn' or r.busyness > 0:
                    week[r.weekday][r.hour - HOURS.start] = round(float(r.busyness), 1)
            documents.append({'_id': place_id, 'name': venue['name'].iloc[0], 'city': 'Bengaluru', 'source': source,
                              'week': week, 'updatedAt': stamp})
    if out:
        # The same documents as a file, for running SideQuest locally without a database
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(json.dumps(documents, ensure_ascii=False), encoding='utf-8')
        print(f'wrote {len(documents)} forecasts to {out}')
        return
    from pymongo import MongoClient, ReplaceOne
    collection = MongoClient(os.environ['MONGODB_URI'])[os.environ.get('MONGODB_DATABASE') or 'sidequest']['busyness']
    collection.bulk_write([ReplaceOne({'_id': d['_id']}, d, upsert=True) for d in documents])
    report = json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else {}
    report['published'] = {'at': stamp, 'google_venues': sum(d['source'] == 'google' for d in documents),
                           'tabpfn_venues': sum(d['source'] == 'tabpfn' for d in documents),
                           'forecast_categories': sorted(enough),
                           'skipped': 'categories with fewer than three venues with history get no forecast'}
    REPORT.write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(report['published']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['evaluate', 'publish'])
    parser.add_argument('--out', help='publish: write the forecasts to this JSON file instead of MongoDB')
    args = parser.parse_args()
    evaluate() if args.mode == 'evaluate' else publish(args.out)
