"""Verify report timestamp and location consistency using stored records."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from geoalchemy2.shape import to_shape

from app.agents.base import BaseAgent
from app.db.session import SessionLocal
from app.models.incident import Incident
from app.models.report import Report
from app.services.shelter_lookup import haversine_km


logger = logging.getLogger(__name__)
_MAX_REPORT_AGE_HOURS = 48
_MAX_LOCATION_DISTANCE_KM = 5.0


def _point_lat_lon(point: Any) -> Optional[Tuple[float, float]]:
    if point is None:
        return None
    shape = to_shape(point)
    return float(shape.y), float(shape.x)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def evaluate_consistency(
    report_created_at: Optional[datetime],
    incident_start_time: Optional[datetime],
    report_location: Optional[Tuple[float, float]],
    incident_location: Optional[Tuple[float, float]],
) -> Dict[str, Any]:
    """Evaluate the two checks without database access (also useful for demos)."""
    if report_created_at is None:
        timestamp_mismatch_flag = None
    else:
        baseline = incident_start_time or datetime.now(timezone.utc)
        timestamp_mismatch_flag = (
            _as_utc(report_created_at)
            < _as_utc(baseline) - timedelta(hours=_MAX_REPORT_AGE_HOURS)
        )

    if report_location is None or incident_location is None:
        geolocation_mismatch_flag = None
    else:
        distance_km = haversine_km(
            report_location[0],
            report_location[1],
            incident_location[0],
            incident_location[1],
        )
        geolocation_mismatch_flag = distance_km > _MAX_LOCATION_DISTANCE_KM

    if timestamp_mismatch_flag is None or geolocation_mismatch_flag is None:
        credibility_score = None
        verified = False
    else:
        # Simple provisional scoring model, not a validated ML system.
        credibility_score = 1.0
        if timestamp_mismatch_flag:
            credibility_score -= 0.4
        if geolocation_mismatch_flag:
            credibility_score -= 0.4
        credibility_score = round(credibility_score, 2)
        verified = credibility_score >= 0.6

    return {
        "verified": verified,
        "credibility_score": credibility_score,
        "timestamp_mismatch_flag": timestamp_mismatch_flag,
        "geolocation_mismatch_flag": geolocation_mismatch_flag,
    }


class MisinformationAgent(BaseAgent):
    name = "misinformation_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        report = None
        incident = None
        try:
            with SessionLocal() as db:
                incident = (
                    db.query(Incident).filter(Incident.id == incident_id).first()
                )
                if incident:
                    report = incident.report
                if report is None:
                    report = db.query(Report).filter(Report.id == incident_id).first()
                    if report and incident is None:
                        incident = (
                            db.query(Incident)
                            .filter(Incident.report_id == report.id)
                            .first()
                        )

                if report is None:
                    logger.info(
                        "No report to verify for incident %s",
                        incident_id,
                    )
                    incident_location = (
                        _point_lat_lon(incident.location)
                        if incident and incident.location
                        else None
                    )
                    lat, lon = (
                        incident_location if incident_location else (None, None)
                    )
                    return {
                        "report_id": None,
                        "verified": False,
                        "credibility_score": None,
                        "timestamp_mismatch_flag": None,
                        "image_reuse_flag": None,
                        "image_reuse_check": {
                            "checked": False,
                            "reason": "reverse image search not yet implemented",
                        },
                        "geolocation_mismatch_flag": None,
                        "verification_status": "no report to verify",
                        "_debug_location_used": {"lat": lat, "lon": lon},
                    }

                report_location = _point_lat_lon(report.location)
                incident_location = (
                    _point_lat_lon(incident.location)
                    if incident and incident.location
                    else None
                )
                result = evaluate_consistency(
                    report.created_at,
                    incident.start_time if incident else None,
                    report_location,
                    incident_location,
                )
                lat, lon = incident_location or report_location or (None, None)
                return {
                    "report_id": str(report.id),
                    **result,
                    "image_reuse_flag": None,
                    "image_reuse_check": {
                        "checked": False,
                        "reason": "reverse image search not yet implemented",
                    },
                    "verification_status": (
                        "checked"
                        if result["credibility_score"] is not None
                        else "incomplete"
                    ),
                    "_debug_location_used": {"lat": lat, "lon": lon},
                }
        except Exception as exc:
            logger.info(
                "Could not verify report consistency (%s)", type(exc).__name__
            )
            return {
                "report_id": str(report.id) if report else None,
                "verified": False,
                "credibility_score": None,
                "timestamp_mismatch_flag": None,
                "image_reuse_flag": None,
                "image_reuse_check": {
                    "checked": False,
                    "reason": "reverse image search not yet implemented",
                },
                "geolocation_mismatch_flag": None,
                "verification_status": "verification unavailable",
                "_debug_location_used": {"lat": None, "lon": None},
            }
