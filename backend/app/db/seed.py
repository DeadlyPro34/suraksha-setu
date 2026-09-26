"""Insert the demo Ahmedabad shelters into the configured database.

Run from the repository root with:
    backend\\venv\\Scripts\\python.exe -m app.db.seed

The seed is idempotent by shelter name; existing rows are left unchanged.
"""

from geoalchemy2 import WKTElement

from app.db.session import SessionLocal
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


if __name__ == "__main__":
    inserted, skipped = seed_shelters()
    print(f"Shelter seed complete: {inserted} inserted, {skipped} already present.")
