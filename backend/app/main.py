from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.test_pipeline import router as test_pipeline_router
from app.api.routes.reports import router as reports_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.shelters import router as shelters_router
from app.db.session import get_db

app = FastAPI(title="Suraksha Setu API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Route registration ---
app.include_router(test_pipeline_router)
app.include_router(reports_router)
app.include_router(alerts_router)
app.include_router(shelters_router)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/health/database')
def database_health(db: Session = Depends(get_db)):
    """Check the report schema through the API's active database connection."""
    result = db.execute(
        text(
            """SELECT current_database() AS database,
                      current_schema() AS schema,
                      (SELECT is_nullable
                       FROM information_schema.columns
                       WHERE table_schema = current_schema()
                         AND table_name = 'reports'
                         AND column_name = 'reporter_id') AS reporter_id_nullable"""
        )
    ).mappings().one()
    return dict(result)
