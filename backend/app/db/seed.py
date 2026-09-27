"""Insert the demo Ahmedabad shelters and regional resources.

Run from the backend directory with:
    .\\venv\\Scripts\\python.exe -m app.db.seed

The seed is idempotent by shelter name and unassigned available resource type;
existing rows are left unchanged.
"""

from geoalchemy2 import WKTElement

from app.db.session import SessionLocal
from app.models.resource import Resource, ResourceStatus, ResourceType
from app.models.shelter import Shelter, ShelterStatus


SHELTERS = (
    {
        "name": "Ahmedabad Relief Shelter - Vastrapur",
        "latitude": 23.037,
        "longitude": 72.529,
        "capacity": 200,
        "current_occupancy": 60,
        "has_electricity": True,
        "has_medical": True,
        "status": ShelterStatus.open,
    },
    {
        "name": "Community Center - Naranpura",
        "latitude": 23.055,
        "longitude": 72.560,
        "capacity": 150,
        "current_occupancy": 140,
        "has_electricity": True,
        "has_medical": False,
        "status": ShelterStatus.open,
    },
    {
        "name": "Government School Shelter - Maninagar",
        "latitude": 23.000,
        "longitude": 72.600,
        "capacity": 100,
        "current_occupancy": 30,
        "has_electricity": False,
        "has_medical": False,
        "status": ShelterStatus.open,
    },
)

# Water stock quantity is measured in liters; food stock is measured in
# person-days so the Resource agent can derive days at the current occupancy.
RESOURCES = (
    {"type": ResourceType.medical, "quantity": 15, "latitude": 23.055, "longitude": 72.560},
    {"type": ResourceType.food, "quantity": 200, "latitude": 23.037, "longitude": 72.529},
    {"type": ResourceType.water, "quantity": 500, "latitude": 23.000, "longitude": 72.600},
    {"type": ResourceType.boat, "quantity": 3, "latitude": 23.055, "longitude": 72.560},
    {"type": ResourceType.personnel, "quantity": 12, "latitude": 23.037, "longitude": 72.529},
)


def seed_shelters() -> tuple[int, int]:
    """Create missing demo shelters; return (created, already_present)."""
    created = 0
    already_present = 0
    with SessionLocal() as db:
        try:
            for data in SHELTERS:
                exists = (
                    db.query(Shelter.id)
                    .filter(Shelter.name == data["name"])
                    .first()
                )
                if exists:
                    already_present += 1
                    continue

                values = dict(data)
                latitude = values.pop("latitude")
                longitude = values.pop("longitude")
                db.add(
                    Shelter(
                        **values,
                        location=WKTElement(
                            f"POINT({longitude} {latitude})", srid=4326
                        ),
                    )
                )
                created += 1
            db.commit()
        except Exception:
            db.rollback()
            raise
    return created, already_present


def seed_resources() -> tuple[int, int]:
    """Create missing unassigned regional resource rows; return counts."""
    created = 0
    already_present = 0
    with SessionLocal() as db:
        try:
            for data in RESOURCES:
                exists = (
                    db.query(Resource.id)
                    .filter(
                        Resource.type == data["type"],
                        Resource.incident_id.is_(None),
                        Resource.status == ResourceStatus.available,
                    )
                    .first()
                )
                if exists:
                    already_present += 1
                    continue

                db.add(
                    Resource(
                        type=data["type"],
                        quantity=data["quantity"],
                        incident_id=None,
                        status=ResourceStatus.available,
                        location=WKTElement(
                            f"POINT({data['longitude']} {data['latitude']})",
                            srid=4326,
                        ),
                    )
                )
                created += 1
            db.commit()
        except Exception:
            db.rollback()
            raise
    return created, already_present


if __name__ == "__main__":
    shelter_inserted, shelter_skipped = seed_shelters()
    resource_inserted, resource_skipped = seed_resources()
    print(
        "Seed complete: "
        f"shelters {shelter_inserted} inserted, {shelter_skipped} already present; "
        f"resources {resource_inserted} inserted, {resource_skipped} already present."
    )
