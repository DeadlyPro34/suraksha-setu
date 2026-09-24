# Suraksha Setu Monorepo

This repository contains the foundation for the Suraksha Setu project, a monorepo with separate front‑end and back‑end services.

## Setup Instructions

### Backend (FastAPI)
Navigate to the `backend` folder and start the API:
```bash
cd backend
# Create and activate virtual environment (Windows)
python -m venv venv
venv\Scripts\activate
# Install dependencies
pip install -r requirements.txt
# Run the FastAPI server
python -m uvicorn app.main:app --reload --port 8000
```
The backend API will run on `http://localhost:8000`.

### Frontend (Next.js)
Navigate to the `frontend` folder and start the web app:
```bash
cd frontend
# Install Node dependencies (using legacy peer deps due to Next/Tailwind versions)
npm install --legacy-peer-deps
# Start the development server
npm run dev
```
The frontend application will run on `http://localhost:3000` (or `3001` if `3000` is busy). Its API proxy defaults to `http://localhost:8000`; set `BACKEND_INTERNAL_URL` in `frontend/.env.local` only if the backend uses a different address.

---

- **frontend/** – Next.js 14+ (App Router) with TypeScript, Tailwind CSS, and ESLint.
- **backend/** – FastAPI (Python 3.11+) with requirements.
- **docs/** – Architecture documentation (stub).
- Docker Compose configuration to run the services together.

> **Note**: This is a scaffold only. Business logic, authentication, and agent logic will be added later.
