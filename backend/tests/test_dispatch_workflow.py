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
from app.models.dispatch import Dispatch, DispatchStatus, DispatchTargetRole
from app.models.incident import Incident, IncidentSeverity, IncidentStatus
from app.models.response_plan import PlanStatus, ResponsePlan
from app.models.user import User, UserRole


class Query:
    def __init__(self, rows):
        self.rows = list(rows)

    def filter(self, *expressions):
        for expression in expressions:
            key = expression.left.key
            value = expression.right.value
            operator = expression.operator.__name__
            if operator == "eq":
                self.rows = [row for row in self.rows if getattr(row, key) == value]
        return self

    def options(self, *_options):
        return self

    def order_by(self, *_expressions):
        return self

    def with_for_update(self):
        return self

    def limit(self, _limit):
        return self

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class FakeDB:
    def __init__(self, dispatch, officers):
        self.dispatch = dispatch
        self.officers = officers

    def query(self, model):
        if model is Dispatch:
            rows = [self.dispatch]
        elif model is User:
            rows = self.officers
        else:
            rows = []
        return Query(rows)

    def commit(self):
        pass

    def refresh(self, instance):
        if isinstance(instance, Dispatch) and instance.assigned_to:
            instance.assignee = next(
                (officer for officer in self.officers if officer.id == instance.assigned_to),
                None,
            )


@pytest.fixture
def dispatch_client():
    now = datetime.now(timezone.utc)
    report_id = uuid4()
    incident = Incident(
        id=uuid4(),
        report_id=report_id,
        location=from_shape(Point(72.8777, 19.0760), srid=4326),
        severity=IncidentSeverity.medium,
        status=IncidentStatus.open,
        start_time=now,
    )
    plan = ResponsePlan(
        id=uuid4(),
        incident_id=incident.id,
        incident=incident,
        priority_score=7.0,
        summary="Coordinate a field response.",
        status=PlanStatus.approved,
        generated_at=now,
    )
    dispatch = Dispatch(
        id=uuid4(),
        response_plan_id=plan.id,
        response_plan=plan,
        target_role=DispatchTargetRole.field_officer,
        message="Respond to the reported area.",
        status=DispatchStatus.sent,
        dispatched_at=now,
    )
    officer = User(
        id=uuid4(), name="Test Officer", phone="officer", role=UserRole.field_officer,
        password_hash="unused",
    )
    other_officer = User(
        id=uuid4(), name="Other Officer", phone="other", role=UserRole.field_officer,
        password_hash="unused",
    )
    official = User(
        id=uuid4(), name="Test Official", phone="official", role=UserRole.official,
        password_hash="unused",
    )
    db = FakeDB(dispatch, [officer, other_officer])
    app.dependency_overrides[get_db] = lambda: db

    def current_user(request: Request):
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        payload = decode_access_token(token) if scheme.lower() == "bearer" else None
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid or missing token")
        return User(
            id=UUID(payload["sub"]), name="Test user", phone="test",
            role=UserRole(payload["role"]), password_hash="unused",
        )

    app.dependency_overrides[get_current_user] = current_user
    client = TestClient(app)

    def headers(user):
        return {"Authorization": f"Bearer {create_access_token(str(user.id), user.role.value)}"}

    yield client, dispatch, officer, other_officer, official, headers
    app.dependency_overrides.clear()


def test_official_can_assign_dispatch_and_officer_can_acknowledge(dispatch_client):
    client, dispatch, officer, _, official, headers = dispatch_client

    assigned = client.patch(
        f"/api/dispatches/{dispatch.id}/assign",
        headers=headers(official),
        json={"user_id": str(officer.id)},
    )
    assert assigned.status_code == 200
    assert assigned.json()["assignee_id"] == str(officer.id)
    assert assigned.json()["assignee_name"] == officer.name

    mine = client.get("/api/dispatches/mine", headers=headers(officer))
    assert mine.status_code == 200
    assert [row["id"] for row in mine.json()] == [str(dispatch.id)]

    acknowledged = client.patch(
        f"/api/dispatches/mine/{dispatch.id}/status",
        headers=headers(officer),
        json={"status": "acknowledged"},
    )
    assert acknowledged.status_code == 200
    assert acknowledged.json()["status"] == "acknowledged"


def test_officer_cannot_read_or_acknowledge_another_officers_dispatch(dispatch_client):
    client, dispatch, officer, other_officer, official, headers = dispatch_client
    client.patch(
        f"/api/dispatches/{dispatch.id}/assign",
        headers=headers(official),
        json={"user_id": str(officer.id)},
    )

    mine = client.get("/api/dispatches/mine", headers=headers(other_officer))
    assert mine.status_code == 200
    assert mine.json() == []

    response = client.patch(
        f"/api/dispatches/mine/{dispatch.id}/status",
        headers=headers(other_officer),
        json={"status": "acknowledged"},
    )
    assert response.status_code == 404


def test_citizen_cannot_assign_dispatch(dispatch_client):
    client, dispatch, officer, _, _, headers = dispatch_client
    citizen = User(
        id=uuid4(), name="Test Citizen", phone="citizen", role=UserRole.citizen,
        password_hash="unused",
    )

    response = client.patch(
        f"/api/dispatches/{dispatch.id}/assign",
        headers=headers(citizen),
        json={"user_id": str(officer.id)},
    )
    assert response.status_code == 403
