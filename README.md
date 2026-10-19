# Lost & Found Portal — IIT Ropar

A campus-wide Lost & Found web and mobile platform for Indian Institute of Technology Ropar (CS509 PG Software Lab).

---

## 🏗️ Technology Stack

| Component | Technology |
|---|---|
| **Web Frontend** | Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS) |
| **Backend REST API** | Django 5.2 + Django REST Framework (DRF) |
| **Database** | SQLite (Local Dev) / PostgreSQL 16 (Docker & Production) |
| **Cache & Message Broker** | Redis 7 + Celery 5.4 |
| **Authentication** | SimpleJWT (httpOnly cookies for Web, Bearer tokens for Android) |
| **Realtime Chat** | Django Channels 4 + WebSockets |
| **API Specification** | OpenAPI 3.0 via `drf-spectacular` (Swagger UI & ReDoc) |
| **Mobile App (Week 5)** | Kotlin + Jetpack Compose MVP |

---

## 📋 Phase 0: Setup, Foundations & Schema (Completed)

Phase 0 establishes the repository layout, containerized microservices, comprehensive database schema, validation constraints, and seed data.

### 1. Key Accomplishments
- **Repository Structure:** Clean separation into `backend/`, `frontend/`, and top-level infrastructure configs.
- **Docker Compose Setup:** Multi-container orchestration defined for `db` (Postgres 16), `redis`, `backend`, `celery`, `celery-beat`, and `frontend`.
- **Database Schema & Models (19 Tables):**
  - **`accounts`**: Custom `User` model (UUID primary key, mandatory `@iitrpr.ac.in` email validation, format-checked `registration_number`), `OTP` table with SHA-256 hash storage, and `DeviceToken` for push notifications.
  - **`posts`**: `Category` model, `SiteSettings` (singleton), `Post` model supporting `LOST` and `FOUND` workflows with hidden verification proof fields and composite feed indexing, `PostImage` attachments, and `AbuseReport`.
  - **`matching`**: `Match` lifecycle state engine (`suggested` → `confirmed` → `proof_pending` → `verified` → `handed_over` → `closed`), proof Q&A store, one-time handover token hashing, and immutable `MatchAuditLog`.
  - **`items`**: `RegisteredItem` supporting zero-knowledge QR sticker generation (using non-identifying UUID URLs).
  - **`chat`**: Admin-mediated `Conversation`, `Message` with delivery receipts, and `BlockedUser`.
  - **`notifications`**: In-app notifications with delivery and read tracking.
  - **`adminpanel`**: `PostAuditLog` and `AdminInvite` token workflows.
- **Database Seeding (`seed_data`):**
  - Seeded 11 campus categories: `bicycle`, `phone`, `laptop`, `earbuds`, `keys`, `id_card`, `bottle`, `umbrella`, `wallet` (sensitive), `cash` (sensitive), `other`.
  - Seeded default `SiteSettings` (`match_threshold = 0.75`, `post_expiry_days = 30`, `otp_expiry_seconds = 300`).
  - Pre-configured administrator accounts for local development.
- **Standardized API Error Envelope:** DRF exception handler standardizing all errors to `{ "success": false, "code": "...", "message": "...", "errors": {} }`.
- **CI/CD Automation:** GitHub Actions pipeline configured for testing, linting (`black`, `flake8`), and building frontend.

---

## 🧪 Phase 0 Test Gate Verification

Phase 0 verified the following criteria before moving forward:
1. **Django System Check:** Passed with 0 errors (`python manage.py check`).
2. **Database Migrations:** Clean execution on fresh databases across all 7 apps.
3. **Automated Unit Tests (`pytest apps/posts/tests.py`):**
   - ✅ `test_seed_categories_exist` (All 11 default categories exist)
   - ✅ `test_site_settings_singleton` (Singleton configuration enforced)
   - ✅ `test_valid_iitrpr_email_allowed` (Accepts `@iitrpr.ac.in` domain)
   - ✅ `test_invalid_email_domain_rejected` (Rejects non-campus domains like `@gmail.com` on regular signups)
   - ✅ `test_invalid_registration_number_rejected` (Enforces format like `2024CSM1001`)
   - ✅ `test_negative_reward_rejected` (Validates non-negative rewards on lost items)
4. **Frontend Build Verification:** Next.js application compiles cleanly with zero TypeScript errors (`npm run build`).

---

## 🚀 Running the Project

### Backend
```powershell
cd backend
# Run migrations (if starting fresh)
python manage.py migrate

# Load initial categories & settings
python manage.py seed_data

# Start backend server
python manage.py runserver
```
- API Base: `http://127.0.0.1:8000/api/v1/`
- Admin Panel: `http://127.0.0.1:8000/admin/`
- Swagger UI Documentation: `http://127.0.0.1:8000/api/v1/docs/`
- ReDoc: `http://127.0.0.1:8000/api/v1/redoc/`

### Frontend
```powershell
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:3000/`

---

## 📋 Phase 1: Authentication & Registration (Completed)

- **OTP Verification & Rate Limiting:** Live SMTP delivery for `@iitrpr.ac.in` email OTP requests with brute-force lockout.
- **JWT & Session Security:** SimpleJWT authentication flow supporting login, logout, password resets, and user profile updates.
- **Frontend Flow:** Next.js authentication screens (`/login`, `/register`, `/forgot-password`, `/profile`) with campus theme and responsive slider.

---

## 📋 Phase 2: Roles, Permissions & Admin Panel (Completed)

- **Role Boundaries & Permissions:** Custom DRF permissions (`IsCampusAdmin`, `IsStudentUser`, `IsNotBanned`, `IsOwnerOrAdmin`).
- **Staff Authority & Invites:** Tokenized admin invite creation (`/api/v1/adminpanel/invites/`) and invitation acceptance (`/api/v1/adminpanel/invites/accept/`) with staff credential elevation.
- **User Moderation:** Student query directory (`/api/v1/adminpanel/users/`) and account suspension/reinstate workflows with reason tracking.
- **Audit Logs:** Immutable audit log history tracking status changes, admin interventions, and post moderation notes.
- **Site Configuration:** Dynamic operational settings (`/api/v1/adminpanel/settings/`) for match threshold, post expiration days, and OTP lifetimes.
- **Frontend Admin Portal:** Complete `/admin` section with Overview, Invites, User Moderation, Audit Logs, and Settings tabs protected by `AdminGuard`.

---

## 📋 Phase 3: Lost Item Reporting — User 1 Flow (Completed)

- **Post Creation & File Uploads:** Authenticated endpoints for reporting missing belongings (`/api/v1/posts/lost/`) with multi-image attachments (up to 5 images, max 5MB, format-checked).
- **Confidential Ownership Proof:** Dedicated `hidden_proof` field for private verification details (lockscreen wallpaper, serial numbers, hidden scratches), strictly restricted to the author and campus admins.
- **My Reports Dashboard:** Student tickets tracking endpoint (`/api/v1/posts/lost/my-reports/`) with status progression, admin notes, and ticket withdrawal.
- **Frontend Reporting Suite:**
  - `/report/lost`: Form with category picker, campus location shortcuts, drag-and-drop photo uploader, confidential proof section, and promised reward.
  - `/my-reports`: Status-filtered dashboard (All, Pending, Approved, Info Requested, Returned, Rejected) with detail modal.
- **Automated Tests:** 8 comprehensive integration test cases validating category listings, image constraints, post lifecycle, privacy of hidden proof, and permission boundaries. (23/23 tests passing).

---

## 🗺️ Roadmap & Phase Timeline

| Phase | Milestone | Status |
|---|---|:---:|
| **Phase 0** | Setup, Docker, Schema, Seeds, CI, and Foundation Tests | **Completed** |
| **Phase 1** | Authentication & Registration (OTP, JWT, Profile creation) | **Completed** |
| **Phase 2** | Roles & Permissions (Admin vs Student boundaries, Admin Portal) | **Completed** |
| **Phase 3** | Lost Item Reporting (User 1 flow with hidden proof & rewards) | **Completed** |
| **Phase 4** | Admin Portal (Case queue, audit logs, approval/rejection) | *Next* |
| **Phase 5** | Public Feed & Found Reports (User 2 flow, custody assignment) | Planned |
| **Matching**| Celery Automated Matching Engine (Similarity scoring) | Planned |
| **Phase 6** | Verification & Handover (Proof Q&A, One-time QR handover token) | Planned |
| **Phase 7** | QR Sticker System for Valuables (Zero-knowledge public scans) | Planned |
| **Phase 8** | WebSocket Chat & Push Notifications | Planned |
| **Phase 9** | Android MVP (Kotlin + Jetpack Compose) | Planned |
| **Phase 10**| Hardening, Rate Limiting & Load Testing | Planned |
| **Phase 11**| Staging & Production Campus Deployment | Planned |


