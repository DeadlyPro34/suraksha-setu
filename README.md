# Suraksha Setu

Suraksha Setu is a disaster-response demo with citizen incident reporting, a five-agent analysis workflow coordinated through LangChain and Groq, official review, simulated alerts and dispatches, and field-officer assignment acknowledgement.

## Run the full demo with Docker Compose

Prerequisites: Docker Desktop with Compose enabled. From the repository root:

```powershell
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Edit `backend/.env` and set `JWT_SECRET` to a random value of at least 32 characters, set a private `PRIVILEGED_SIGNUP_CODE`, and optionally set `GROQ_API_KEY` and `OPENWEATHER_API_KEY`. Weather uses OpenWeather One Call API 4.0, which requires its separate One Call subscription; without a key, the dashboard clearly reports that weather is not configured. Without a Groq key, the analysis workflow uses its explicit manual-review fallback. Do not commit `.env` files.

Then start the application:

```powershell
docker compose up --build
```

Compose starts PostGIS, waits for the database health check, runs all Alembic migrations and the idempotent demo-data seed, then starts FastAPI and Next.js. Open [http://localhost:3000](http://localhost:3000). The backend is available at [http://localhost:8000](http://localhost:8000), with API documentation at `/docs`.

To stop the services, press Ctrl+C. `docker compose down` stops them and keeps the database volume. `docker compose down -v` also deletes the local demo database.

## Demo flow

1. Register a citizen account and submit an incident with a description and map location.
2. Register an official account at `/register` with the private invite code from `backend/.env`.
3. As an official, open Incidents and select **Analyze report**. The result is saved as a pending response plan. A report compared only with an incident derived from itself remains uncertain; that self-match is not shown as independent verification.
4. Open Approvals and approve or reject the plan. Approval records a simulated alert and dispatch.
5. Register a field-officer account with the same invite code. As the official, assign the new dispatch to that officer.
6. Sign in as the officer and acknowledge the assignment from **My assignments**.

Reports, plans, decisions, verification results, and dispatch state are stored in the local PostGIS database. Alerts and resource/dispatch actions are demo records; the app does not send SMS, call emergency services, or physically dispatch responders.

## Run services separately

For local development without Compose, start a PostGIS-compatible PostgreSQL database, set `DATABASE_URL`, `JWT_SECRET`, `PRIVILEGED_SIGNUP_CODE`, and optionally `GROQ_API_KEY` and `OPENWEATHER_API_KEY` in `backend/.env`, then:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
alembic upgrade head
python -m app.db.seed
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 5000
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

For deployment, set `DATABASE_URL`, `JWT_SECRET`, and `PRIVILEGED_SIGNUP_CODE` on the backend service. On Vercel, use the Supabase **Transaction pooler** connection string (port `6543`) for runtime traffic; serverless functions should not hold session-mode connections open. The backend detects Supabase's shared pooler URL, switches a `5432` runtime URL to transaction mode, and uses SQLAlchemy `NullPool` so Supavisor handles connection pooling. To enable photo and video attachments, create a **private** Supabase Storage bucket named `incident-media`, then set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_MEDIA_BUCKET=incident-media` on the backend service. Configure the bucket's file size and MIME type limits to allow the media types accepted by the report form. Keep the service role key backend-only; uploads use short-lived signed URLs so file bytes go directly from the browser to Supabase Storage.

Next.js proxies browser API calls to `http://127.0.0.1:5000` by default. Set `BACKEND_INTERNAL_URL` if the API is at another address.

## Stack

- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS.
- API: FastAPI, SQLAlchemy, Alembic, PostgreSQL/PostGIS.
- Analysis: domain-specific Python agents coordinated through LangChain's Groq integration, with validated structured output and a deterministic manual-review fallback.

## Notes

- Privileged roles (official, field officer, volunteer) require the invite code; citizen signup does not.
- Analysis is decision support. Officials must review plans before simulated actions are recorded.
- See `docs/architecture.md` for the current architecture.
