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

## 📋 Phase 4: Admin Portal & Case Queue (Completed)

- **Case Queue & Filtering:** Centralized administrative case queue (`/api/v1/adminpanel/posts/`) with filtering by status, category, post type, SLA overdue detection (>24h pending), and text search.
- **Interactive Review & Moderation:** Endpoint (`/api/v1/adminpanel/posts/<id>/review/`) supporting actions: `APPROVE` (publish to feed), `REJECT` (with mandatory reason), `INFO_REQUESTED` (request clarifications from student), `CHANGE_CATEGORY`, and `HIDE`.
- **Abuse & Flagged Content Review:** Listing and resolving user-submitted abuse reports (`/api/v1/adminpanel/abuse-reports/`).
- **Platform Analytics:** Real-time metrics endpoint (`/api/v1/adminpanel/statistics/`) calculating pending review counts, SLA breaches, category breakdown, community health, and recent audit activity.
- **Admin Frontend Suite:**
  - `/admin/cases`: Comprehensive Case Queue with status tabs, filter toolbar, photo zoom, student identity cards, confidential proof inspection, and moderation decision controls.
  - `/admin/abuse-reports`: Student flagged item moderation panel with resolution workflow.
  - `/admin`: Upgraded overview dashboard displaying real-time counters, SLA overdue alerts, category distribution, and recent audit activity.
- **Automated Tests:** 9 test cases added covering case queue querying, confidential proof visibility, approval and rejection transitions, audit log persistence, student permission barriers, statistics calculation, and abuse resolution (32/32 tests passing across repository).

---

## 📋 Phase 5: Public Feed & Found Reports — User 2 Flow (Completed)

- **Found Item Reporting:** Authenticated submission endpoint (`/api/v1/posts/found/`) with custody assignment (`finder`, `admin_office`, `security_office`), private admin disclosure option, and multi-photo attachments.
- **Public Campus Feed:** Secure public feed (`/api/v1/posts/feed/` & `/api/v1/posts/`) filtering strictly approved, unexpired posts while automatically concealing sensitive items (wallets, cash) and private admin records.
- **Abuse & Flagging Flow:** Public reporting endpoint (`/api/v1/posts/<id>/report-abuse/`) preventing duplicate flagging by the same user.
- **Post Lifecycle Renewal:** Endpoint (`/api/v1/posts/<id>/renew/`) enabling owners to extend their post visibility by 30 days.
- **Frontend Directory Suite:**
  - `/feed`: Campus Belongings Directory with type toggle (All, Lost, Found), category horizontal scroller, text search, sorting (Newest, Oldest, Highest Reward), and item detail modal with abuse reporting.
  - `/report/found`: "I Found Something" multi-section form with custody options, private admin disclosure, and photo upload.
  - Homepage navigation bar and quick action banner updated with links to Feed and Found reporting.
- **Automated Tests:** 7 comprehensive integration test cases validating found post creation, private admin disclosure, sensitive category suppression, feed filtering, abuse reporting, and post renewal. (39/39 tests passing across repository).

---

## 📋 Matching Engine: Automated Similarity Scoring & Queue (Completed)

- **Algorithmic Similarity Scoring (`services.py`):**
  - **Category Match (weight 0.35):** Strict identical category matching with lenient fallback for generic items.
  - **Date Proximity Window (weight 0.20):** Scoring decay based on absolute day delta between lost and found dates.
  - **Location Keyword Overlap (weight 0.20):** Tokenization, stopword suppression, and Jaccard / Overlap coefficient scoring on campus locations.
  - **Title & Description Text Similarity (weight 0.25):** Token intersection combined with sequence matching across item titles and details.
- **Automated Pipeline & Celery Task (`tasks.py`):**
  - Celery shared task `run_matching_engine` comparing active `LOST` and `FOUND` posts.
  - Pairs scoring $\ge 0.75$ (`SiteSettings.match_threshold`) automatically generate `Suggested` matches.
  - Idempotent execution preventing duplicate pairs on re-runs.
  - Management CLI command `python manage.py run_matching`.
- **Admin Match Queue & Review Actions:**
  - `GET /api/v1/matching/`: Centralized match queue with status, search, and min-score filters.
  - `POST /api/v1/matching/<id>/action/`: Admin actions to `CONFIRM` or `DISMISS` suggestions with audit logging.
  - `POST /api/v1/matching/run/`: On-demand manual trigger for administrators.
  - `GET /api/v1/matching/my-matches/`: Student endpoint to view confirmed matches for their posts.
- **Frontend Admin Suite (`/admin/matches`):**
  - Side-by-side comparison cards displaying Lost Item and Found Item side-by-side.
  - Match confidence percentage badge with color-coded likelihood indicators.
  - Immediate "Run Matching Engine Now" button with real-time feedback.
  - Modal workflows to confirm or dismiss match suggestions.
- **Automated Tests:** 9 test cases covering algorithmic scoring, celery task execution, idempotency, same-author exclusion, admin review actions, student authorization barriers, and CLI commands (48/48 tests passing across repository).

---

## 🗺️ Roadmap & Phase Timeline

| Phase | Milestone | Status |
|---|---|:---:|
| **Phase 0** | Setup, Docker, Schema, Seeds, CI, and Foundation Tests | **Completed** |
| **Phase 1** | Authentication & Registration (OTP, JWT, Profile creation) | **Completed** |
| **Phase 2** | Roles & Permissions (Admin vs Student boundaries, Admin Portal) | **Completed** |
| **Phase 3** | Lost Item Reporting (User 1 flow with hidden proof & rewards) | **Completed** |
| **Phase 4** | Admin Portal (Case queue, audit logs, approval/rejection) | **Completed** |
| **Phase 5** | Public Feed & Found Reports (User 2 flow, custody assignment) | **Completed** |
| **Matching**| Celery Automated Matching Engine (Similarity scoring) | **Completed** |
| **Phase 6** | Verification & Handover (Proof Q&A, One-time QR handover token) | *Next* |
| **Phase 7** | QR Sticker System for Valuables (Zero-knowledge public scans) | Planned |
| **Phase 8** | WebSocket Chat & Push Notifications | Planned |
| **Phase 9** | Android MVP (Kotlin + Jetpack Compose) | Planned |
| **Phase 10**| Hardening, Rate Limiting & Load Testing | Planned |
| **Phase 11**| Staging & Production Campus Deployment | Planned |


