"""Volunteer and field-officer stock reports with official approval."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.resource import Resource, ResourceStatus, ResourceType
from app.models.resource_report import ResourceReport
from app.models.user import User, UserRole
from app.schemas.resource_report import ResourceReportCreate, ResourceReportOut, ResourceReportReview


router = APIRouter(prefix="/api/resources/reports", tags=["resource reports"])


def _out(db: Session, report: ResourceReport) -> ResourceReportOut:
    submitter = db.query(User.name).filter(User.id == report.submitted_by).scalar() or "Unknown user"
    reviewer = db.query(User.name).filter(User.id == report.reviewed_by).scalar() if report.reviewed_by else None
    return ResourceReportOut(
        id=report.id, resource_type=report.resource_type, quantity=report.quantity,
        location_name=report.location_name, note=report.note, lat=report.lat, lon=report.lon,
        status=report.status, submitted_by=report.submitted_by, submitter_name=submitter,
        submitted_at=report.submitted_at, reviewed_by=report.reviewed_by,
        reviewer_name=reviewer, reviewed_at=report.reviewed_at, review_note=report.review_note,
    )


@router.post("", response_model=ResourceReportOut, status_code=201)
def submit_resource_report(
    data: ResourceReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer", "field_officer")),
):
    if (data.lat is None) != (data.lon is None):
        raise HTTPException(status_code=422, detail="Provide both coordinates or leave both empty.")
    report = ResourceReport(
        resource_type=data.resource_type.value,
        quantity=data.quantity,
        location_name=data.location_name.strip(),
        note=data.note.strip(),
        lat=data.lat,
        lon=data.lon,
        status="pending",
        submitted_by=current_user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _out(db, report)


@router.get("/mine", response_model=list[ResourceReportOut])
def list_my_resource_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer", "field_officer")),
):
    reports = (db.query(ResourceReport).filter(ResourceReport.submitted_by == current_user.id)
               .order_by(ResourceReport.submitted_at.desc()).limit(100).all())
    return [_out(db, report) for report in reports]


@router.get("", response_model=list[ResourceReportOut])
def list_resource_reports(
    status: str | None = None,
    db: Session = Depends(get_db),
    _official: User = Depends(require_role("official")),
):
    if status not in (None, "pending", "approved", "rejected"):
        raise HTTPException(status_code=422, detail="Invalid report status.")
    query = db.query(ResourceReport)
    if status:
        query = query.filter(ResourceReport.status == status)
    reports = query.order_by(ResourceReport.submitted_at.desc()).limit(500).all()
    return [_out(db, report) for report in reports]


@router.patch("/{report_id}/review", response_model=ResourceReportOut)
def review_resource_report(
    report_id: UUID,
    data: ResourceReportReview,
    db: Session = Depends(get_db),
    official: User = Depends(require_role("official")),
):
    report = db.query(ResourceReport).filter(ResourceReport.id == report_id).with_for_update().first()
    if report is None:
        raise HTTPException(status_code=404, detail="Resource report not found.")
    if report.status != "pending":
        raise HTTPException(status_code=409, detail="This resource report has already been reviewed.")

    if data.decision == "approved":
        resource_type = ResourceType(report.resource_type)
        stock = (db.query(Resource).filter(
            Resource.type == resource_type,
            Resource.incident_id.is_(None),
            Resource.location_name == report.location_name,
        ).order_by(Resource.id.asc()).with_for_update().first())
        if stock is None:
            stock = Resource(type=resource_type, quantity=report.quantity, incident_id=None,
                             location_name=report.location_name,
                             status=ResourceStatus.available if report.quantity > 0 else ResourceStatus.depleted)
            db.add(stock)
        else:
            stock.quantity = report.quantity
            stock.status = ResourceStatus.available if report.quantity > 0 else ResourceStatus.depleted
        if report.lat is not None and report.lon is not None:
            stock.location = WKTElement(f"POINT({report.lon} {report.lat})", srid=4326)

    report.status = data.decision
    report.review_note = data.review_note.strip() if data.review_note else None
    report.reviewed_by = official.id
    report.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    return _out(db, report)
