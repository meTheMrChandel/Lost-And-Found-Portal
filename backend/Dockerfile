# ─────────────────────────────────────────────────────────────────────────────
# Lost & Found Portal — Backend Dockerfile
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (cached layer)
COPY requirements/base.txt requirements/base.txt
COPY requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

# Copy project
COPY . .

# Make production entrypoint executable
RUN chmod +x entrypoint.prod.sh

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.prod.sh"]
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
