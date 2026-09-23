from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.test_pipeline import router as test_pipeline_router

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


@app.get('/health')
def health():
    return {'status': 'ok'}
