"""Shared incident-coordinate and nearest-open-shelter lookups."""

import logging
import math
from dataclasses import dataclass
from typing import Optional, Tuple

from geoalchemy2.shape import to_shape

from app.db.session import SessionLocal
from app.models.incident import Incident
from app.models.report import Report
from app.models.shelter import Shelter, ShelterStatus


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ShelterMatch:
    id: str
    name: str
    latitude: float
    longitude: float
    capacity: int
    current_occupancy: int
    has_electricity: bool
    has_medical: bool
    status: str


def get_incident_coordinates(incident_id: str) -> Optional[Tuple[float, float]]:
    """Load incident (lat, lon), accepting report IDs used by test pipeline."""
    with SessionLocal() as db:
        report = db.query(Report).filter(Report.id == incident_id).first()
        if report and report.location:
            shape = to_shape(report.location)
            return float(shape.y), float(shape.x)

        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            return None
        location = (
            incident.report.location
            if incident.report and incident.report.location
            else incident.location
        )
        if not location:
            return None
        shape = to_shape(location)
        return float(shape.y), float(shape.x)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(min(1.0, value)))


def find_nearest_shelter(
    latitude: float, longitude: float
) -> Optional[ShelterMatch]:
    """Return the nearest open shelter with the same haversine ranking for all agents."""
    with SessionLocal() as db:
        shelters = (
            db.query(Shelter)
            .filter(Shelter.status == ShelterStatus.open)
            .all()
        )
        nearest = None
        nearest_distance = float("inf")
        for shelter in shelters:
            if not shelter.location:
                continue
            shape = to_shape(shelter.location)
            shelter_lat, shelter_lon = float(shape.y), float(shape.x)
            distance = _haversine_km(
                latitude, longitude, shelter_lat, shelter_lon
            )
            if distance < nearest_distance:
                nearest_distance = distance
                nearest = ShelterMatch(
                    id=str(shelter.id),
                    name=shelter.name,
                    latitude=shelter_lat,
                    longitude=shelter_lon,
                    capacity=shelter.capacity,
                    current_occupancy=shelter.current_occupancy,
                    has_electricity=shelter.has_electricity,
                    has_medical=shelter.has_medical,
                    status=shelter.status.value,
                )
        return nearest
