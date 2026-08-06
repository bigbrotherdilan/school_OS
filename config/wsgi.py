import os
import subprocess
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.join(os.path.dirname(_HERE), "School_OS", "backend")

sys.path.insert(0, _BACKEND)

if os.environ.get("SKIP_DJANGO_MIGRATE") != "1":
    try:
        subprocess.run(
            [sys.executable, "manage.py", "migrate", "--noinput"],
            cwd=_BACKEND,
            timeout=180,
        )
    except Exception:
        pass

sys.modules.pop("config", None)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
