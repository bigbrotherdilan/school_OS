FROM python:3.11-slim AS builder

# Install Node.js for frontend build
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY School_OS/backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Build frontend
COPY School_OS/frontend/ frontend/
RUN cd frontend && npm install --legacy-peer-deps && VITE_API_URL=/api/v1 npx vite build

# Copy backend
COPY School_OS/backend/ backend/

# Copy frontend build into Django template/static dirs
RUN mkdir -p backend/templates backend/static/frontend_assets && \
    cp frontend/dist/index.html backend/templates/index.html && \
    cp -r frontend/dist/assets/* backend/static/frontend_assets/ && \
    cd backend && DJANGO_SECRET_KEY=build-only-collectstatic python manage.py collectstatic --noinput

FROM python:3.11-slim

RUN apt-get update && apt-get install -y curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 --no-create-home appuser

WORKDIR /app

COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend/dist /app/frontend/dist
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

RUN mkdir -p /app/backend/media /app/backend/staticfiles && \
    chown -R appuser:appgroup /app

WORKDIR /app/backend

EXPOSE 8000

USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/v1/health/ || exit 1

# NOTE: seed_all is NOT run in production. Run it manually once during initial setup.
# Run database migrations on startup (safe to run every time, they're idempotent)
# but do NOT run seed scripts — they would re-create default accounts.
# 2 workers × 8 threads → 16 concurrent requests; threads are the right
# fit for the IO-bound mark-entry burst. --max-requests rotates workers so
# persistent DB connections (CONN_MAX_AGE) don't go stale.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 8 --timeout 120 --max-requests 1000 --max-requests-jitter 100"]
