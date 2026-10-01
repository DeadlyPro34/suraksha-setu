import urllib.request
from app.core.security import create_access_token
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
user_id = db.execute(text('SELECT id FROM users LIMIT 1;')).fetchone()[0]
token = create_access_token(str(user_id), 'official')

req = urllib.request.Request('http://localhost:5000/api/reports/e5cf0e72-9300-4083-95d3-bd41e2746ad0/analyze', method='POST')
req.add_header('Authorization', f'Bearer {token}')
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f'HTTPError: {e.code} - {e.read().decode()}')
