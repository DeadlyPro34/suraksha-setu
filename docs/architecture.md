# Architecture

## Runtime

- `frontend/` is a Next.js App Router app. Browser API calls go through the same-origin `/_api` rewrite, which forwards to FastAPI.
- `backend/` is a FastAPI service with SQLAlchemy models and Alembic migrations.
- PostgreSQL with PostGIS stores reports, incidents, plans, verification records, approvals, dispatches, shelters, and resources.
- Docker Compose runs PostGIS, applies migrations, seeds demo shelters/resources, and starts the API and web app.

## Incident response flow

1. A citizen submits a report with coordinates. The API persists it and its associated incident.
2. An official runs analysis from the incident list. Five domain agents gather the current modeled findings in a fixed sequence.
3. The LangChain `ChatGroq` coordinator receives those findings and returns schema-validated priority and summary fields. When Groq is not configured or the request/output fails validation, a clearly labeled manual-review fallback is used.
4. The API stores a pending response plan. Verification is persisted separately. Because the current incident is created from its report, matching its timestamp/location to that incident is not independent evidence; those checks remain unknown and the result stays uncertain.
5. An official records one terminal decision. Approval records simulated notification/action rows atomically; a recorded decision cannot be overwritten.
6. The official assigns eligible dispatch rows to a field-officer account. That officer can view only their own assignments and acknowledge them.

## Authentication and authorization

JWT bearer tokens authenticate protected API calls. Citizen accounts can self-register. Official, field-officer, and volunteer accounts require the configured privileged signup invite code. Report reads, official plans/decisions, dispatch assignment, and officer assignment actions are role-gated in the API; frontend layouts are only an additional user-interface guard.

## Demo boundary

Agent findings are application decision support and do not represent confirmed emergency-service data. Alerts and dispatches are persisted simulation records: no SMS, external notification, or physical emergency response is sent. Officials remain responsible for reviewing recommendations before approval.
