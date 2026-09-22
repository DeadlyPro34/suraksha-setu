from fastapi import FastAPI

from app.api.routes.test_pipeline import router as test_pipeline_router

app = FastAPI(title="Suraksha Setu API", version="0.1.0")

# --- Route registration ---
app.include_router(test_pipeline_router)


@app.get('/health')
def health():
    return {'status': 'ok'}
