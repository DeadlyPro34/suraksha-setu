"""Resource model."""

import enum

from sqlalchemy import Column, Integer, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry

from .base import Base, pk_uuid


class ResourceType(str, enum.Enum):
    medical = "medical"
    food = "food"
    water = "water"
    boat = "boat"
    personnel = "personnel"


class ResourceStatus(str, enum.Enum):
    available = "available"
    allocated = "allocated"
    depleted = "depleted"


class Resource(Base):
    __tablename__ = "resources"

    id = pk_uuid()
    incident_id = Column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=True
    )
    type = Column(Enum(ResourceType, name="resource_type"), nullable=False)
    quantity = Column(Integer, nullable=False)
    location = Column(Geometry("POINT", srid=4326), nullable=True)
    status = Column(
        Enum(ResourceStatus, name="resource_status"),
        nullable=False,
        default=ResourceStatus.available,
    )

    # --- relationships ---
    incident = relationship("Incident", back_populates="resources")
