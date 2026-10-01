import urllib.request
from app.core.security import create_access_token
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
user_id = db.execute(text("SELECT id FROM users WHERE role='citizen' LIMIT 1;")).fetchone()[0]
token = create_access_token(str(user_id), 'citizen')

req = urllib.request.Request('http://localhost:5000/api/reports/mine', method='GET')
req.add_header('Authorization', f'Bearer {token}')

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode()[:100])
except urllib.error.HTTPError as e:
    print(f'HTTPError: {e.code} - {e.read().decode()}')
