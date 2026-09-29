from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone
from geoalchemy2.shape import to_shape

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.report import Report
from app.models.incident import Incident, IncidentSeverity, IncidentStatus
from app.models.user import User
from app.schemas.report import ReportCreate, ReportOut

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _report_out(db_report: Report) -> ReportOut:
    shape = to_shape(db_report.location)
    return ReportOut(
        id=db_report.id,
        reporter_id=db_report.reporter_id,
        type=db_report.type,
        description=db_report.description,
        lat=shape.y,
        lon=shape.x,
        status=db_report.status,
        created_at=db_report.created_at,
    )


@router.get("/", response_model=list[ReportOut])
def list_reports(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return the newest reports for the incidents feed."""
    reports = (
        db.query(Report)
        .order_by(Report.created_at.desc(), Report.id.desc())
        .limit(limit)
        .all()
    )
    return [_report_out(report) for report in reports]


@router.get("/mine", response_model=list[ReportOut])
def list_my_reports(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reports = (
        db.query(Report)
        .filter(Report.reporter_id == current_user.id)
        .order_by(Report.created_at.desc(), Report.id.desc())
        .limit(limit)
        .all()
    )
    return [_report_out(report) for report in reports]


@router.post(
    "/",
    response_model=ReportOut,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("citizen", "field_officer", "volunteer")
    ),
):
    location_wkt = (
        f"SRID=4326;POINT({report_in.location.lon} {report_in.location.lat})"
    )
    
    db_report = Report(
        reporter_id=current_user.id,
        type=report_in.type,
        description=report_in.description,
        location=location_wkt,
        image_url=report_in.image_url,
    )
    db.add(db_report)
    try:
        db.commit()
        db.refresh(db_report)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create report. Please try again.") from e
        
    return _report_out(db_report)

@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: UUID, db: Session = Depends(get_db)):
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    return _report_out(db_report)

from app.agents.crew import kickoff

@router.post("/{report_id}/analyze")
def analyze_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("citizen", "field_officer", "volunteer", "official")
    ),
):
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found")
    if db_report.reporter_id != current_user.id and current_user.role.value != "official":
        raise HTTPException(status_code=403, detail="You can only analyze your own reports")

    incident = db.query(Incident).filter(Incident.report_id == db_report.id).first()
    if incident is None:
        incident = Incident(
            report_id=db_report.id,
            location=db_report.location,
            severity=IncidentSeverity.medium,
            status=IncidentStatus.open,
            start_time=db_report.created_at or datetime.now(timezone.utc),
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)

    return kickoff(str(incident.id))
