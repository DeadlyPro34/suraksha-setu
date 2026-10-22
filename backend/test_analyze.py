import json
import urllib.request

req = urllib.request.Request('http://localhost:5000/api/reports/e5cf0e72-9300-4083-95d3-bd41e2746ad0/analyze', method='POST')
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f'HTTPError: {e.code} - {e.read().decode()}')
