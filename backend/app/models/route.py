"""Route model."""

import enum

from sqlalchemy import Column, Float, Enum, DateTime
from geoalchemy2 import Geometry

from .base import Base, pk_uuid


class RouteStatus(str, enum.Enum):
    clear = "clear"
    partial = "partial"
    blocked = "blocked"
    unknown = "unknown"


class Route(Base):
    __tablename__ = "routes"

    id = pk_uuid()
    start_location = Column(Geometry("POINT", srid=4326), nullable=False)
    end_location = Column(Geometry("POINT", srid=4326), nullable=False)
    distance_km = Column(Float, nullable=True)
    status = Column(
        Enum(RouteStatus, name="route_status"),
        nullable=False,
        default=RouteStatus.unknown,
    )
    last_checked = Column(DateTime(timezone=True), nullable=False)
