# =============================================================================
# Stage 1: Build frontend
# =============================================================================
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# =============================================================================
# Stage 2: Backend + static files
# =============================================================================
FROM python:3.12-slim AS backend

# Prevent Python from buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq-dev \
        gcc && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend into staticfiles
COPY --from=frontend-build /app/frontend/dist ./staticfiles/

# Collect static files
RUN python manage.py collectstatic --noinput || true

# Create non-root user
RUN addgroup --system appuser && adduser --system --ingroup appuser appuser
RUN mkdir -p /app/media /app/staticfiles && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

ENTRYPOINT ["gunicorn"]
CMD ["config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
