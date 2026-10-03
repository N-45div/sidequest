"""Check account connectivity without starting training or printing credentials."""
import json
import logging
import os
from pathlib import Path

logging.disable(logging.CRITICAL)
root = Path(__file__).resolve().parents[1]
if (root / '.env').exists():
    for line in (root / '.env').read_text().splitlines():
        if line.startswith('TINKER_API_KEY='):
            os.environ.setdefault('TINKER_API_KEY', line.split('=', 1)[1])

def main():
    if not os.environ.get('TINKER_API_KEY'):
        print(json.dumps({'ok': False, 'reason': 'TINKER_API_KEY missing'}))
        return 1
    try:
        import tinker
        client = tinker.ServiceClient()
        capabilities = client.get_server_capabilities()
        models = [m.model_name for m in capabilities.supported_models]
        result = {'ok': True, 'models': models, 'training_started': False}
        output = root / 'artifacts' / 'tinker-connectivity.json'
        output.parent.mkdir(exist_ok=True)
        output.write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        return 0
    except Exception as exc:
        print(json.dumps({'ok': False, 'error_type': type(exc).__name__, 'training_started': False}))
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
