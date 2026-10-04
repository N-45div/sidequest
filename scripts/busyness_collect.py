"""Collect study-space venues and Google popular-times history through SerpApi for the TabPFN busyness study.

  python scripts/busyness_collect.py --city Bengaluru --lookups 100

The app's own discovery queries come first, then a few neighbourhood queries for variety. Place lookups
(one SerpApi credit each) fetch popular times for up to --lookups venues. Raw responses stay in the ignored
artifacts/busyness/ folder; nothing here is committed.
"""
import argparse
import json
import os
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'busyness'
for line in (ROOT / '.env').read_text().splitlines():
    if line.startswith('SERPAPI_API_KEY='):
        os.environ.setdefault('SERPAPI_API_KEY', line.split('=', 1)[1].strip())
# Must match the query text in server/planner.mjs discoverLive.
APP_QUERIES = {'library': 'public libraries with study space', 'campus': 'university libraries study rooms',
               'coworking': 'coworking study spaces', 'coffee': 'cafes for studying', 'outdoors': 'quiet parks for studying'}
EXTRA = [('coffee', 'cafes in Koramangala'), ('library', 'libraries in Jayanagar'), ('coworking', 'coworking spaces in HSR Layout'),
         ('outdoors', 'parks in Indiranagar'), ('coffee', 'cafes in Malleshwaram')]


def serp(params):
    query = urlencode({'engine': 'google_maps', 'api_key': os.environ['SERPAPI_API_KEY'], **params})
    with urlopen('https://serpapi.com/search.json?' + query, timeout=60) as response:
        data = json.load(response)
    if data.get('error'):
        raise SystemExit('SerpApi: ' + data['error'][:200])
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--city', default='Bengaluru')
    parser.add_argument('--lookups', type=int, default=100)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    venues_file = OUT / 'venues.json'
    venues = json.loads(venues_file.read_text(encoding='utf-8')) if venues_file.exists() else {}
    searches = [(c, f'{q} in {args.city}', True) for c, q in APP_QUERIES.items()]
    searches += [(c, f'{q}, {args.city}', False) for c, q in EXTRA]
    for category, q, app_query in searches:
        if any(q in v['queries'] for v in venues.values()):
            continue
        for rank, result in enumerate(serp({'type': 'search', 'q': q}).get('local_results', [])):
            if not result.get('place_id'):
                continue
            venue = venues.setdefault(result['place_id'], {'search': result, 'category': category, 'queries': [], 'app_rank': None})
            venue['queries'].append(q)
            if app_query and rank < 5:
                # The app shows the top five per category; these are the venues people actually see.
                venue['app_rank'] = min(rank, venue['app_rank'] if venue['app_rank'] is not None else rank)
        venues_file.write_text(json.dumps(venues, ensure_ascii=False), encoding='utf-8')
        print(f'searched {q!r}: {len(venues)} venues', flush=True)
    # Shown venues first, so the forecast check covers what the app displays; the rest by review count.
    order = sorted(venues, key=lambda k: (venues[k]['app_rank'] is None, -(venues[k]['search'].get('reviews') or 0)))
    done = sum('place' in v for v in venues.values())
    for key in order:
        if done >= args.lookups:
            break
        if 'place' in venues[key]:
            continue
        place = serp({'place_id': key}).get('place_results', {})
        venues[key]['place'] = {'popular_times': place.get('popular_times'), 'price': place.get('price'),
                                'retrieved_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        done += 1
        venues_file.write_text(json.dumps(venues, ensure_ascii=False), encoding='utf-8')
        print(f'looked up {done}/{args.lookups}: {venues[key]["search"].get("title")!r} '
              f'popular_times={"yes" if place.get("popular_times") else "no"}', flush=True)
    with_history = sum(bool(v.get('place', {}).get('popular_times')) for v in venues.values())
    print(json.dumps({'venues': len(venues), 'looked_up': done, 'with_popular_times': with_history}))


if __name__ == '__main__':
    main()
