"""Shelter model."""

import enum

from sqlalchemy import Column, String, Integer, Boolean, Enum
from geoalchemy2 import Geometry

from .base import Base, pk_uuid


class ShelterStatus(str, enum.Enum):
    open = "open"
    full = "full"
    closed = "closed"


class Shelter(Base):
    __tablename__ = "shelters"

    id = pk_uuid()
    name = Column(String, nullable=False)
    location = Column(Geometry("POINT", srid=4326), nullable=False)
    capacity = Column(Integer, nullable=False)
    current_occupancy = Column(Integer, default=0, nullable=False)
    has_electricity = Column(Boolean, nullable=False)
    has_medical = Column(Boolean, nullable=False)
    status = Column(
        Enum(ShelterStatus, name="shelter_status"),
        nullable=False,
        default=ShelterStatus.open,
    )
