"""Evaluate real, consented outing history. Never invent historical outcomes.
Optional dependency set: requirements-ml.txt. Uses the Prior Labs hosted client.
"""
import argparse
import json
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', type=Path, required=True)
    parser.add_argument('--consented-aggregate-data', action='store_true', required=True)
    args = parser.parse_args()
    import pandas as pd
    from sklearn.metrics import balanced_accuracy_score, roc_auc_score
    from tabpfn_client import TabPFNClassifier
    frame = pd.read_csv(args.csv)
    features = ['group_size', 'overlap_minutes', 'min_budget', 'interest_matches', 'travel_minutes']
    required = ['outing_id', 'date', 'happened'] + features
    if any(column not in frame for column in required):
        raise ValueError('Missing expected aggregate columns: ' + ', '.join(required))
    if len(frame) < 50 or frame.outing_id.duplicated().any():
        raise ValueError('Supply at least 50 distinct real outings, one row per outing.')
    if frame[features + ['happened']].isna().any().any() or not set(frame.happened.unique()) <= {0, 1}:
        raise ValueError('Features must be complete, and happened must be binary.')
    frame['date'] = pd.to_datetime(frame['date'], errors='raise', utc=True)
    frame = frame.sort_values('date')
    cutoff = frame.iloc[int(len(frame) * .7)]['date']
    train, test = frame[frame.date < cutoff], frame[frame.date >= cutoff]
    if len(train) < 20 or len(test) < 10 or train.happened.value_counts().min() < 5 or train.happened.nunique() != 2 or test.happened.nunique() != 2:
        raise ValueError('Need both outcomes and enough records on each side of a chronological split.')
    model = TabPFNClassifier()
    model.fit(train[features], train.happened)
    predictions = model.predict(test[features])
    probabilities = model.predict_proba(test[features])[:, list(model.classes_).index(1)]
    baseline = [int(train.happened.mode().iloc[0])] * len(test)
    report = {'provenance': 'User-provided consented aggregate outing history; no synthetic outcomes',
              'features': features, 'train_rows': len(train), 'test_rows': len(test), 'chronological_cutoff': str(cutoff),
              'balanced_accuracy': balanced_accuracy_score(test.happened, predictions),
              'roc_auc': roc_auc_score(test.happened, probabilities),
              'baseline_balanced_accuracy': balanced_accuracy_score(test.happened, baseline),
              'runtime_use': 'Not enabled; requires broader validation. Predictions never override budgets or access constraints.'}
    target = Path(__file__).resolve().parents[1] / 'evaluations' / 'tabpfn-history.json'
    target.write_text(json.dumps(report, indent=2) + '\n')
    print('Aggregate evaluation saved; inspect metrics before making any claim.')

if __name__ == '__main__':
    main()
