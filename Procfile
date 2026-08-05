web: cd /app/backend && python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 8 --timeout 120 --max-requests 1000 --max-requests-jitter 100
