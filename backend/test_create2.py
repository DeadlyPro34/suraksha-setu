import urllib.request
import json
from app.core.security import create_access_token
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
user_id = db.execute(text("SELECT id FROM users WHERE role='citizen' LIMIT 1;")).fetchone()[0]
token = create_access_token(str(user_id), 'citizen')

req = urllib.request.Request('http://localhost:5000/api/reports/', method='POST')
req.add_header('Authorization', f'Bearer {token}')
req.add_header('Content-Type', 'application/json')
data = json.dumps({
    'type': 'flood',
    'description': 'test 500',
    'location': {'lat': 23.0, 'lon': 72.0},
    'image_url': 'http://example.com/image.jpg'
}).encode('utf-8')

try:
    with urllib.request.urlopen(req, data=data) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f'HTTPError: {e.code} - {e.read().decode()}')
