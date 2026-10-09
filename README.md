# Lost & Found Portal — IIT Ropar

A campus-wide Lost & Found portal for IIT Ropar students.  
Repo layout: `backend/` (Django + DRF) | `frontend/` (Next.js) | `android/` (Kotlin, later).

## Stack

| Layer | Tech |
|---|---|
| Web frontend | Next.js 14 (App Router) |
| REST API | Django 5 + Django REST Framework |
| Database | PostgreSQL 16 (MySQL schema also ready) |
| Cache / Queue | Redis 7 + Celery |
| Auth | SimpleJWT (Bearer for Android, httpOnly cookie for web) |
| Storage | S3 / Cloudinary (presigned uploads) |
| Real-time | Django Channels + WebSocket |
| Android | Kotlin + Jetpack Compose (Week 5) |

## Quick Start (Docker)

```bash
cp .env.example .env          # fill in secrets
docker compose up --build
```

API: http://localhost:8000/api/v1/  
Frontend: http://localhost:3000  
Admin: http://localhost:8000/admin/

## Development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

## Implementation Phases

| Week | Phases | Goal |
|---|---|---|
| 1 | 0–2 | Setup, Auth, Roles |
| 2 | 3–4 | Lost reports, Admin portal |
| 3 | 5 + Matching | Feed, Found reports, Match queue |
| 4 | 6–7 | Verify, Handover, QR |
| 5 | 8–9 | Chat, Notifications, Android MVP |
| 6 | 10–11 | Hardening, Deploy, Beta |

## Team

2-person project for CS509 PG Software Lab, MTech CSE — IIT Ropar.
