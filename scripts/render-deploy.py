"""Create/check only SideQuest on Render. Never prints credentials or full env."""
import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
REPO = 'https://github.com/N-45div/sidequest'
STATE = ROOT / 'artifacts' / 'render-service.json'
for line in (ROOT / '.env').read_text().splitlines():
    if line.startswith('RENDER_API_KEY='):
        os.environ.setdefault('RENDER_API_KEY', line.split('=', 1)[1].strip().strip('\"\''))
KEY = os.environ.get('RENDER_API_KEY')
if not KEY:
    raise SystemExit('Set RENDER_API_KEY in ignored .env.')

def api(path, method='GET', body=None):
    request = Request('https://api.render.com/v1/' + path, method=method,
        headers={'Authorization': 'Bearer ' + KEY, 'Accept': 'application/json', 'Content-Type': 'application/json'},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urlopen(request, timeout=40) as response:
            return json.load(response)
    except HTTPError as error:
        message = error.read().decode(errors='replace').replace(KEY, '[redacted]')
        raise SystemExit(f'Render HTTP {error.code}: {message[:700]}') from None

def remember(service):
    if service.get('repo', '').removesuffix('.git') != REPO.removesuffix('.git') or service.get('name') != 'sidequest':
        raise SystemExit('Refusing to operate on a different repository/service.')
    state = {'id': service['id'], 'ownerId': service['ownerId'], 'name': service['name'],
        'url': service.get('serviceDetails', {}).get('url'), 'dashboardUrl': 'https://dashboard.render.com/web/' + service['id']}
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2) + '\n')
    return state

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--create-preview', action='store_true')
    parser.add_argument('--status', action='store_true')
    parser.add_argument('--logs', action='store_true')
    args = parser.parse_args()
    if args.create_preview:
        services = [entry['service'] for entry in api('services?limit=100')]
        matches = [service for service in services if service['name'] == 'sidequest' and service.get('repo', '').removesuffix('.git') == REPO.removesuffix('.git')]
        if len(matches) > 1:
            raise SystemExit('Multiple SideQuest services: select the intended one manually.')
        if matches:
            state = remember(matches[0])
        else:
            owners = [entry['owner'] for entry in api('owners?limit=20')]
            if len(owners) != 1:
                raise SystemExit('Select a workspace before creating a service.')
            result = api('services', 'POST', {'type': 'web_service', 'name': 'sidequest', 'ownerId': owners[0]['id'],
                'repo': REPO, 'branch': 'main', 'autoDeployTrigger': 'off',
                'envVars': [{'key': 'NODE_ENV', 'value': 'production'}, {'key': 'NODE_VERSION', 'value': '24.11.1'},
                    {'key': 'ALLOW_EPHEMERAL_DEMO', 'value': 'true'}],
                'serviceDetails': {'runtime': 'node', 'plan': 'free', 'region': 'singapore', 'numInstances': 1,
                    'healthCheckPath': '/api/health', 'envSpecificDetails': {'buildCommand': 'npm ci && npm run build', 'startCommand': 'npm start'}}})
            state = remember(result.get('service', result))
        print(json.dumps(state))
    else:
        if not STATE.exists():
            raise SystemExit('No known SideQuest service. Create it first.')
        state = remember(api('services/' + json.loads(STATE.read_text())['id']))
    if args.status or args.create_preview:
        deploys = api('services/' + state['id'] + '/deploys?limit=5')
        print(json.dumps({'deploys': [{key: entry['deploy'].get(key) for key in ['id', 'status', 'commit', 'finishedAt']} for entry in deploys]}))
    if args.logs:
        data = api('logs?' + urlencode({'ownerId': state['ownerId'], 'resource': state['id'], 'limit': 50, 'direction': 'backward'}))
        for entry in reversed(data.get('logs', [])):
            print(str(entry.get('message', '')).replace(KEY, '[redacted]')[:1500])

if __name__ == '__main__':
    main()
