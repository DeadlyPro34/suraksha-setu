from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.core.dependencies import get_current_user
from app.core.security import create_access_token, decode_access_token
from app.db.session import get_db
from app.main import app
from app.models.alert import Alert
from app.models.report import Report, ReportStatus, ReportType
from app.models.user import User, UserRole


class FakeQuery:
    def __init__(self, rows):
        self.rows = list(rows)

    def filter(self, *expressions):
        for expression in expressions:
            key = expression.left.key
            value = expression.right.value
            if expression.operator.__name__ == "eq":
                self.rows = [row for row in self.rows if getattr(row, key) == value]
            elif expression.operator.__name__ == "ne":
                self.rows = [row for row in self.rows if getattr(row, key) != value]
        return self

    def order_by(self, *_expressions):
        return self

    def options(self, *_options):
        return self

    def limit(self, _limit):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return self.rows


class FakeDB:
    def __init__(self, reports):
        self.reports = reports

    def query(self, model):
        rows = self.reports if model is Report else []
        return FakeQuery(rows)


@pytest.fixture
def api_client():
    citizen_id = uuid4()
    other_id = uuid4()
    report = Report(
        id=uuid4(),
        reporter_id=citizen_id,
        type=ReportType.flood,
        description="Temporary auth test report",
        location=from_shape(Point(72.8777, 19.0760), srid=4326),
        status=ReportStatus.pending_verification,
        created_at=datetime.now(timezone.utc),
    )
    app.dependency_overrides[get_db] = lambda: FakeDB([report])

    def test_current_user(request: Request):
        authorization = request.headers.get("authorization", "")
        scheme, _, token = authorization.partition(" ")
        payload = decode_access_token(token) if scheme.lower() == "bearer" else None
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid or missing token")
        return User(
            id=UUID(payload["sub"]),
            name="Temporary test user",
            phone="test",
            role=UserRole(payload["role"]),
            password_hash="unused",
        )

    app.dependency_overrides[get_current_user] = test_current_user
    client = TestClient(app)
    yield client, report.id, citizen_id, other_id
    app.dependency_overrides.clear()


def token(role: UserRole, user_id=None):
    return create_access_token(str(user_id or uuid4()), role.value)


def headers(access_token):
    return {"Authorization": f"Bearer {access_token}"}


def test_protected_feeds_reject_anonymous_requests(api_client):
    client, report_id, _, _ = api_client
    assert client.get("/api/reports/").status_code == 401
    assert client.get(f"/api/reports/{report_id}").status_code == 401
    assert client.get("/api/alerts/").status_code == 401


def test_citizen_can_read_only_own_report(api_client):
    client, report_id, citizen_id, other_id = api_client
    citizen_headers = headers(token(UserRole.citizen, citizen_id))
    assert client.get("/api/reports/", headers=citizen_headers).status_code == 403
    assert client.get("/api/alerts/", headers=citizen_headers).status_code == 403
    assert client.get(f"/api/reports/{report_id}", headers=citizen_headers).status_code == 200

    other_headers = headers(token(UserRole.citizen, other_id))
    assert client.get(f"/api/reports/{report_id}", headers=other_headers).status_code == 403


@pytest.mark.parametrize("role", [UserRole.official, UserRole.field_officer])
def test_official_and_field_officer_can_read_protected_feeds(api_client, role):
    client, report_id, _, _ = api_client
    access_headers = headers(token(role))
    assert client.get("/api/reports/", headers=access_headers).status_code == 200
    assert client.get(f"/api/reports/{report_id}", headers=access_headers).status_code == 200
    assert client.get("/api/alerts/", headers=access_headers).status_code == 200
