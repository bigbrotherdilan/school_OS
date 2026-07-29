# School OS - Deployment & Seed Reference

## Two Schools

### School 1: Saint Joseph Bilingual Academy

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@saintjoseph.sos` | `admin123456` |
| Teacher | `dr.song@saintjoseph.sos` | `teacher123456` |
| Teacher | `mme.biya@saintjoseph.sos` | `teacher123456` |
| Teacher | `dr.thorne@saintjoseph.sos` | `teacher123456` |
| Parent | `parent@saintjoseph.sos` | `parent123456` |

Students: John Doe, Jean Dupont, Jane Smith

### School 2: Greenfield International Academy

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@greenfield.edu.cm` | `admin123456` |
| Teacher | `james.ashi@greenfield.edu.cm` | `teacher123` |
| Teacher | `fatima.ngwa@greenfield.edu.cm` | `teacher123` |
| Teacher | `pierre.tamba@greenfield.edu.cm` | `teacher123` |
| Parent | `grace.foncha@greenfield.edu.cm` | `parent123456` |

Students: Samuel Eyong, Blessing Ambe, Emmanuel Tabi, Naomi Sama, Destiny Atem, Kevin Njoh, Celestin Mbida, Sandrine Atanga, Armel Nkou, Chantal Bikoko

### Paul Essomba's Children (Cross-School Parent)

| # | Student | School | Class | Relationship |
|---|---------|--------|-------|-------------|
| 1 | John Doe | Saint Joseph Bilingual Academy | Form 1 | father |
| 2 | Samuel Eyong | Greenfield International Academy | Form 1 | guardian |
| 3 | Blessing Ambe | Greenfield International Academy | Form 1 | father |

Login as `parent@saintjoseph.sos` to see all 3 children across both schools.

## Database

- **Engine:** PostgreSQL (Railway managed)
- **Public URL:** `postgresql://postgres:***@sakura.proxy.rlwy.net:38747/railway`
- **Internal URL (used by app):** `postgresql://postgres:***@postgres.railway.internal:5432/railway`
- **Env var:** `DATABASE_URL` (set in Railway service variables)
- Django falls back to SQLite when `DATABASE_URL` is not set.

> **Note:** The public URL is only for local debugging. The internal URL is used by the app on Railway and is faster/more reliable.

## Deployment (Railway)

### Live App

**URL:** `https://schoolos-production-be7b.up.railway.app`

### How It Works

1. Dockerfile builds the app (Python 3.11 + Node.js 20)
2. Installs Python deps, builds React frontend with `VITE_API_URL=/api/v1`
3. Copies frontend build into Django template/static dirs
4. On deploy CMD runs:
   - `python manage.py migrate --noinput` - applies all migrations
   - `python manage.py seed_all` - seeds both schools (idempotent, safe to rerun)
   - `gunicorn config.wsgi:application` - starts the server

### Railway Services

| Service | Purpose | URL |
|---------|---------|-----|
| **school-os** (web) | Django + React app | `schoolos-production-be7b.up.railway.app` |
| **postgres** (database) | PostgreSQL database | Internal only |

### Environment Variables (set in Railway)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{postgres.DATABASE_URL}}` (auto-linked) |
| `DJANGO_SECRET_KEY` | Set in Railway |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_ALLOWED_HOSTS` | `schoolos-production-be7b.up.railway.app` |
| `CORS_ALLOWED_ORIGINS` | `https://schoolos-production-be7b.up.railway.app` |

### Git Remotes

```bash
# Production (linked to Railway)
git remote add personal https://github.com/bigbrotherdilan/school_OS.git

# Deploy
git push personal main   # Railway auto-deploys on push
```

### Redeploy

Railway auto-deploys on push to the connected branch. To manually redeploy, go to the Railway dashboard > service > Deploy.

### Re-seeding

The `seed_all` command runs on every deploy and uses `get_or_create` - safe to rerun. To force a full reseed:

```bash
# Via Railway CLI
railway run python manage.py seed_all

# Or locally (using public DB URL)
$env:DATABASE_URL="postgresql://postgres:<YOUR_PASSWORD>@sakura.proxy.rlwy.net:38747/railway"
python manage.py seed_all
```

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (dev)
cd frontend
npm install
npm run dev

# Frontend (production build - served by Django)
cd frontend
VITE_API_URL=/api/v1 npx vite build
```

## Project Structure

```
School_OS/
├── Dockerfile                  # Railway build (Python 3.11 + Node.js 20)
├── railway.json                # Railway deploy config (DOCKERFILE builder)
├── backend/                    # Django REST API
│   ├── config/settings.py      # Django settings (loads .env via python-dotenv)
│   ├── config/urls.py          # API routes + React catch-all
│   ├── apps/
│   │   ├── authentication/     # Users, JWT, roles, seed_all command
│   │   ├── tenants/            # Multi-tenant (schools)
│   │   ├── students/           # Students, parent links
│   │   ├── staff/              # Teachers, assignments
│   │   ├── academic/           # Years, terms, sequences, classes
│   │   ├── assessments/        # Exams, marks, entry windows
│   │   ├── finance/            # Fees, invoices
│   │   ├── attendance/         # Student attendance
│   │   ├── reports/            # Report cards
│   │   └── ...
│   ├── seed_data.py            # Seeds School 1 (standalone script)
│   ├── seed_greenfield.py      # Seeds School 2 (standalone script)
│   ├── seed_parent.py          # Seeds parent user (standalone script)
│   ├── .env                    # DATABASE_URL, secrets (gitignored)
│   ├── requirements.txt        # Python dependencies
│   └── Procfile                # gunicorn start command
├── frontend/                   # React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── pages/admin/        # Admin dashboard
│   │   ├── pages/teacher/      # Teacher portal
│   │   ├── pages/parent/       # Parent portal
│   │   ├── stores/             # Zustand state management
│   │   └── services/           # API client (axios)
│   ├── .env                    # VITE_API_URL (gitignored)
│   └── dist/                   # Production build (gitignored)
└── DEPLOYMENT.md               # This file
```

## Key Environment Variables

| Variable | Description | Dev | Production |
|----------|-------------|-----|------------|
| `DATABASE_URL` | PostgreSQL connection string | optional (SQLite fallback) | set in Railway |
| `DJANGO_SECRET_KEY` | Django secret key | any random string | set in Railway |
| `DJANGO_DEBUG` | Debug mode | `True` | `False` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hosts | `localhost,127.0.0.1` | `schoolos-production-be7b.up.railway.app` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins | `http://localhost:5173` | `https://schoolos-production-be7b.up.railway.app` |
| `VITE_API_URL` | Frontend API base URL | `http://localhost:8000/api/v1` | `/api/v1` (relative) |

## API Base URL

- **Development:** `http://localhost:8000/api/v1`
- **Production:** `/api/v1` (relative, Django serves both API and frontend)
