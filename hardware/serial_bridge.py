"""Read UNO R3 measurements; optionally upload using the organiser's credential.
Credentials come from SIDEQUEST_SESSION_TOKEN, never command-line arguments.
"""
import argparse
import json
import os
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import serial
from serial.tools import list_ports

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port')
    parser.add_argument('--list', action='store_true')
    parser.add_argument('--base', default='http://localhost:3100')
    parser.add_argument('--outing')
    parser.add_argument('--venue', default='Unspecified observation location')
    args = parser.parse_args()
    if args.list:
        print(json.dumps([{'port': p.device, 'description': p.description} for p in list_ports.comports()]))
        return
    if not args.port:
        parser.error('--port is required; use --list to identify the board')
    if args.outing and not os.environ.get('SIDEQUEST_SESSION_TOKEN'):
        parser.error('SIDEQUEST_SESSION_TOKEN is required for upload')
    if args.outing and not args.base.startswith('https://') and not args.base.startswith(('http://localhost:', 'http://127.0.0.1:')):
        parser.error('Remote uploads require HTTPS')
    last_upload = 0
    with serial.Serial(args.port, 115200, timeout=3) as board:
        time.sleep(2)
        while True:
            line = board.readline().decode('utf-8', errors='replace').strip()
            try:
                data = json.loads(line)
                if data.get('board') != 'UNO R3' or type(data.get('peak_to_peak')) is not int or not 0 <= data['peak_to_peak'] <= 1023:
                    continue
            except (ValueError, AttributeError):
                continue
            print(json.dumps({'board': 'UNO R3', 'peak_to_peak': data['peak_to_peak'], 'unit': 'raw ADC', 'calibrated': False}))
            if args.outing and time.monotonic() - last_upload >= 30:
                payload = json.dumps({'venue': args.venue, 'peakToPeak': data['peak_to_peak'], 'board': 'UNO R3'}).encode()
                request = Request(f'{args.base.rstrip("/")}/api/outings/{args.outing}/observations', data=payload, headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {os.environ["SIDEQUEST_SESSION_TOKEN"]}'})
                try:
                    with urlopen(request, timeout=10) as response:
                        print(json.dumps({'uploaded': response.status == 201}))
                except (HTTPError, URLError):
                    print(json.dumps({'uploaded': False, 'reason': 'Server rejected or could not receive observation'}))
                last_upload = time.monotonic()

if __name__ == '__main__':
    main()
