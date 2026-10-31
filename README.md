# DayBloom

DayBloom is a private, responsive habit and streak tracker. The React + TypeScript client has separate Daily Check-in and My Streaks routes; Django REST Framework owns saved answers, history, and streak calculations. PostgreSQL is the application database.

## Prerequisites

- Python 3.10 or newer (the project is developed with Python 3.12)
- Node.js 18 or newer and npm
- Docker Desktop with Docker Compose, or a PostgreSQL 14+ server

## Local setup (Windows PowerShell)

Run commands from the project root unless a command changes directories.

1. Create your local environment file and update its development database password:

   ```powershell
   Copy-Item .env.example .env
   ```

   Use a unique `DJANGO_SECRET_KEY` for anything beyond local development. `DJANGO_TIME_ZONE` defaults to `Asia/Kolkata`; set it to an IANA timezone for your local calendar if needed.

2. Start PostgreSQL with Docker Compose:

   ```powershell
   docker compose --env-file .env up -d db
   ```

   Compose stores database files in the named `daybloom_postgres_data` volume. To use an existing PostgreSQL server instead, set `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` in `.env`.

3. Create and install the Python environment:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   python -m pip install -r backend\requirements.txt
   ```

4. Apply migrations and create your private login account:

   ```powershell
   Set-Location backend
   python manage.py migrate
   python manage.py createsuperuser
   ```

   The initial migration inserts the exact 11 default activities once. The Django superuser is also the account used to sign in to the website.

5. Start the API (in the `backend` directory):

   ```powershell
   python manage.py runserver
   ```

6. In a second terminal, install and start the frontend:

   ```powershell
   Set-Location frontend
   npm install
   npm run dev
   ```

   Open the local URL printed by Vite (normally `http://localhost:5173`). Vite proxies `/api` requests to Django at `http://127.0.0.1:8000`. The client uses `/api` by default; set `VITE_API_BASE_URL` in `frontend/.env.local` only if you need a different API base URL.

## Database, seed data, and privacy

- The application always uses PostgreSQL, configured exclusively through `.env`.
- Run `python manage.py migrate` after pulling schema changes. The initial data migration seeds the 11 activities; there is no startup seeding that can create duplicates.
- Create accounts with `python manage.py createsuperuser`. There is no public registration route.
- All check-in and streak endpoints require an authenticated session. Login uses Django sessions and CSRF-protected same-origin requests. Data is scoped to the authenticated user.
- In production, provide a strong secret, set `DJANGO_DEBUG=0`, configure `DJANGO_ALLOWED_HOSTS`, and serve the site over HTTPS. Session and CSRF cookies are marked Secure when debug mode is off.
- Activity dates are local calendar dates (not UTC timestamps). `DJANGO_TIME_ZONE` controls the backend's configured timezone; dates in the UI come from that backend setting.
- Custom activities can be added and archived from **Settings**. Archiving preserves their answers and history.

## Running tests and checks

Backend tests use an in-memory SQLite database only as a test runner convenience; normal application settings and all development/production usage use PostgreSQL.

```powershell
Set-Location backend
python -m pytest
python manage.py check
python manage.py makemigrations --check --dry-run
```

Frontend tests and production type-check/build:

```powershell
Set-Location frontend
npm test
npm run build
```

## Features

- Daily questionnaire with Yes, No, and Skip answers, optional per-activity notes, required-answer checks, confirmation before saving, and server-backed editing.
- Contribution calendar for the rolling 365 days, historical period navigation, saved-day details, and an editable history link.
- Separate activity-level heatmaps, streaks, rates, last-completed dates, and category filters.
- Streaks use consecutive local calendar dates. A past date without a check-in breaks continuity; No and Skip answers break that activity's streak. The current streak may include a completed yesterday while today remains unresolved, but a saved No/Skip today ends it.
- Completion rates exclude skipped responses. A fully skipped day has no completion rate rather than dividing by zero.
- Keyboard-accessible answer choices, visible focus, responsive layouts, empty states, and explicit API error messages.

## API outline

All API paths are under `/api/`:

- `GET /auth/csrf/`, `POST /auth/login/`, `POST /auth/logout/`, `GET /auth/me/`
- `GET /activities/`, `POST /activities/manage/`, `PATCH /activities/{id}/`
- `GET /checkins/today/`, `GET /checkins/{YYYY-MM-DD}/`, `PUT /checkins/{YYYY-MM-DD}/`
- `GET /checkins/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- `GET /streaks/summary/`, `GET /streaks/calendar/?start_date=...&end_date=...`
- `GET /streaks/activities/{slug}/calendar/?start_date=...&end_date=...`

Every save must include exactly one valid answer for every currently active activity. Check-ins are unique per user and local date, and repeated saves update the same record.

## Troubleshooting

- **Database connection refused:** confirm Docker Desktop is running and `docker compose --env-file .env ps` shows the database healthy. Check the `POSTGRES_*` variables and port 5432.
- **Login or API says CSRF verification failed:** open the frontend through Vite's URL, not a separate static file server. Keep the browser and API on the same site/origin and reload once to refresh the CSRF cookie.
- **The initial activities are missing:** run `python manage.py migrate` in `backend`; inspect migration status with `python manage.py showmigrations tracker`.
- **A date appears one day off:** confirm the `DJANGO_TIME_ZONE` value in `.env`, restart Django after changing it, then reload the page. Stored records are date-only values and are not shifted by UTC conversion.
- **A check-in cannot be saved:** all currently active activities need an explicit Yes, No, or Skip. The API returns validation errors in the page rather than treating unanswered questions as No.
