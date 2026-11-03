# 🚀 IIT Ropar Lost & Found Portal — Staging & Production Deployment Guide

This document describes how to deploy, configure, secure, and maintain the **IIT Ropar Lost & Found Portal** in staging and campus production environments.

---

## 🏛️ Production Architecture

```
                                [ Campus Network / Internet ]
                                              │
                                              ▼
                         [ HTTPS Port 443 / HTTP Port 80 ]
                                              │
                                              ▼
                          ┌───────────────────────────────────────┐
                          │         Nginx Reverse Proxy           │
                          │   (SSL Termination, Gzip, Caching)    │
                          └───────────────────┬───────────────────┘
                                              │
                 ┌────────────────────────────┼────────────────────────────┐
                 │                            │                            │
                 ▼                            ▼                            ▼
        [ Next.js Frontend ]        [ Django Daphne ASGI ]         [ Static & Media ]
         Port 3000 (Node.js)         Port 8000 (REST & WS)          Mounted Volumes
                 │                            │
                 │                            ├────────────────────────────┐
                 │                            │                            │
                 │                            ▼                            ▼
                 │                 [ PostgreSQL 16 DB ]           [ Redis 7 Alpine ]
                 │                  Relational Storage             Channels & Celery
                 │                                                         ▲
                 │                                                         │
                 └─────────────────────────────────────────────────────────┼──────┐
                                                                           │      │
                                                                           ▼      ▼
                                                                     [ Celery Worker & Beat ]
                                                                     Async Scans & Schedulers
```

---

## 📋 System Prerequisites

| Requirement | Minimum Specification | Recommended Specification |
|---|---|---|
| **OS** | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS |
| **CPU** | 2 vCPUs | 4 vCPUs |
| **RAM** | 4 GB | 8 GB |
| **Disk Space** | 40 GB SSD | 100 GB SSD |
| **Docker Engine** | v24.0+ | Latest Stable (`docker.io` / `docker-ce`) |
| **Docker Compose** | v2.20+ (`docker compose`) | Latest Compose plugin |
| **Domain** | `lostandfound.iitrpr.ac.in` | Configured A record pointing to server IP |

---

## 🛠️ Step-by-Step Deployment Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/meTheMrChandel/Lost-And-Found-Portal.git /opt/lost-and-found
cd /opt/lost-and-found
```

### 2. Configure Environment Variables
Copy the production environment template:
```bash
cp .env.production.example .env.production
```
Edit `.env.production` using `nano` or `vim`:
```bash
nano .env.production
```
Key values to set:
- `SECRET_KEY`: a long random string (`python -c "import secrets; print(secrets.token_urlsafe(64))"`).
- `ALLOWED_HOSTS`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`: your domain (e.g. `lostandfound.iitrpr.ac.in`).
- `POSTGRES_PASSWORD` and `DATABASE_PASSWORD`: the same strong password (the database and Django both read this file).
- `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`: institute SMTP gateway credentials. **Registration is impossible without these**, because sign-up depends on the emailed OTP. Send yourself a test with `docker compose -f docker-compose.prod.yml exec backend python manage.py sendtestemail you@iitrpr.ac.in` after step 4.

### 3. Provision Free SSL/TLS Certificates (Let's Encrypt / Certbot)
For campus domain with public DNS:
```bash
sudo apt-get update && sudo apt-get install -y certbot
sudo certbot certonly --standalone -d lostandfound.iitrpr.ac.in
```
Certificates will be generated in `/etc/letsencrypt/live/lostandfound.iitrpr.ac.in/`. Run this **before** step 4: nginx serves only HTTPS and will not start without the certificate. If your domain differs, change the two `ssl_certificate` paths in `docker/nginx/nginx.conf`.

`docker-compose.prod.yml` mounts `/etc/letsencrypt` and `/var/www/certbot` into nginx. Certificates last 90 days; renew through the running nginx with a root cron job:
```bash
sudo mkdir -p /var/www/certbot
# crontab -e
0 3 * * * certbot renew --webroot -w /var/www/certbot --deploy-hook "docker exec lostandfound_prod_nginx nginx -s reload" >> /var/log/certbot_renew.log 2>&1
```

### 4. Build and Start the Production Containers
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Verify that all 7 containers are healthy and running:
```bash
docker compose -f docker-compose.prod.yml ps
```

### 5. Seed Initial Campus Categories & Create Superuser
Execute inside the running backend container:
```bash
# Seed initial IIT Ropar item categories (Electronics, Keys, IDs, Bicycles, etc.)
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_data

# Create your initial Administrative Superuser
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Staff use the web admin portal at `https://<domain>/admin`. Django's own admin site lives at `https://<domain>/django-admin/`.

---

## 💾 Automated Database Backups & Disaster Recovery

### Automated Nightly Backup Cron
Add a root cron job to run the backup script daily at 2:00 AM:
```bash
crontab -e
```
Add line:
```cron
0 2 * * * /opt/lost-and-found/scripts/backup_db.sh >> /var/log/lostandfound_backup.log 2>&1
```

### Manual Backup Command
```bash
./scripts/backup_db.sh
```
Backups are archived in `backups/database/lostandfound_backup_YYYYMMDD_HHMMSS.sql.gz`. Older backups (> 7 days) are automatically pruned.

### Restoring from Backup
```bash
./scripts/restore_db.sh backups/database/lostandfound_backup_20261027_020000.sql.gz
```
Backups are made with `--clean --if-exists`, so a restore replaces the existing tables. The restore runs in a single transaction and stops at the first error: if anything fails, the script exits non-zero and the database is left exactly as it was.

### Rehearse a Restore into Staging
Do this before the beta and after any schema change, so you know the backups actually work:
```bash
# Restore last night's production backup into the staging database container
DB_CONTAINER=lostandfound_staging_db ./scripts/restore_db.sh backups/database/<latest>.sql.gz
# Spot-check that the data arrived
docker exec lostandfound_staging_db psql -U postgres -d lostandfound -c "select count(*) from accounts_user;"
```

---

## 🔍 Monitoring, Logs & Healthchecks

| Task | Command |
|---|---|
| View real-time aggregated logs | `docker compose -f docker-compose.prod.yml logs -f` |
| View backend ASGI logs | `docker compose -f docker-compose.prod.yml logs -f backend` |
| View Nginx access & error logs | `docker compose -f docker-compose.prod.yml logs -f nginx` |
| View Celery task execution logs | `docker compose -f docker-compose.prod.yml logs -f celery_worker` |
| Restart all services | `docker compose -f docker-compose.prod.yml restart` |
| Zero-downtime rolling update | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
