"""
One-time management command: sets every account password to match credentials.md.
Run once after seeding so the hardcoded credentials work.

Usage:
    python manage.py set_passwords
"""
from django.core.management.base import BaseCommand
from apps.authentication.models import User


# ── All accounts + their canonical passwords from credentials.md ──────────────
ACCOUNTS = [
    # Platform
    ("platform@schoolos.sos",           "plat@Admin2026!"),
    # Saint Joseph Bilingual Academy
    ("admin@saintjoseph.sos",           "sj@Admin2026!"),
    ("dr.song@saintjoseph.sos",         "s3cure#Test99!"),
    ("mme.biya@saintjoseph.sos",        "mmeBiya#Teach2026!"),
    ("dr.thorne@saintjoseph.sos",       "drThorne#Teach2026!"),
    ("dilanbibiro@gmail.com",           "dilan#Teach2026!"),
    ("bursar.test@saintjoseph.sos",     "sjBursar#Test!"),
    ("bigbrotherdilan@gmail.com",       "bigBro#Bursar2026!"),
    ("ngongsongdilan@gmail.com",        "ngo@Bursar2026!"),
    ("parent@saintjoseph.sos",          "pLz#5qVm8nJx2!kT"),
    # Greenfield International Academy
    ("admin@greenfield.edu.cm",         "admin123456"),
    ("fatima.ngwa@greenfield.edu.cm",   "teacher123"),
    ("james.ashi@greenfield.edu.cm",    "teacher123"),
    ("pierre.tamba@greenfield.edu.cm",  "teacher123"),
    ("grace.foncha@greenfield.edu.cm",  "parent123456"),
]


class Command(BaseCommand):
    help = "Set all account passwords to the canonical values from credentials.md"

    def handle(self, *args, **options):
        updated = 0
        skipped = 0
        missing = 0

        for email, password in ACCOUNTS:
            try:
                user = User.objects.get(email=email)
                user.set_password(password)
                user.must_change_password = False
                user.failed_login_attempts = 0
                user.locked_until = None
                user.save(update_fields=[
                    "password",
                    "must_change_password",
                    "failed_login_attempts",
                    "locked_until",
                ])
                self.stdout.write(self.style.SUCCESS(f"  OK  {email}"))
                updated += 1
            except User.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"  MISS {email} — not found, skipped"))
                missing += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Done. {updated} updated, {missing} not found."
        ))
