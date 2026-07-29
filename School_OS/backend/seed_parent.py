"""
Seed a parent user for testing the Parent Portal.
Run with: python manage.py shell < seed_parent.py
"""
import os
import django
import secrets
import string

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

def generate_secure_password(length=16):
    """Generate a cryptographically secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        # Ensure it has at least one of each character type
        if (any(c.islower() for c in password) and
            any(c.isupper() for c in password) and
            any(c.isdigit() for c in password) and
            any(c in "!@#$%^&*" for c in password)):
            return password

from apps.tenants.models import Tenant
from apps.authentication.models import User, UserRoleMapping
from apps.students.models import Student, ParentStudentRelationship

tenant = Tenant.objects.first()
if not tenant:
    print("ERROR: No tenant found. Run seed_data.py first.")
    exit(1)

# Create parent user
parent_user, created = User.objects.get_or_create(
    email='parent@saintjoseph.sos',
    defaults={
        'username': 'parent_sj',
        'first_name': 'Paul',
        'last_name': 'Essomba',
    },
)
if created:
    password = generate_secure_password()
    parent_user.set_password(password)
    parent_user.save()
    print(f"Parent user: {'CREATED' if created else 'EXISTS'} — {parent_user.email}")
    print(f"  Password: {password}")
else:
    print(f"Parent user: {'CREATED' if created else 'EXISTS'} — {parent_user.email}")

# Assign parent role
role_mapping, created = UserRoleMapping.objects.get_or_create(
    user=parent_user,
    tenant=tenant,
    role='parent',
)
print(f"Role mapping: {'CREATED' if created else 'EXISTS'} — parent @ {tenant.school_name}")

# Link to existing student (John Doe)
student = Student.objects.filter(tenant=tenant, first_name='John', last_name='Doe').first()
if not student:
    student = Student.objects.filter(tenant=tenant).first()

if student:
    link, created = ParentStudentRelationship.objects.get_or_create(
        parent_user=parent_user,
        student=student,
        defaults={
            'tenant': tenant,
            'relationship_type': 'father',
        },
    )
    print(f"Parent-Student link: {'CREATED' if created else 'EXISTS'} — {parent_user.get_full_name()} → {student.full_name}")
else:
    print("WARNING: No students found. Parent has no linked student.")

print("\n--- Login Credentials ---")
if created:
    print(f"  Email:    parent@saintjoseph.sos")
    print(f"  Password: {password}")  # This will only show if created
else:
    print(f"  Email:    parent@saintjoseph.sos")
    print(f"  Password: [use existing password]")
print(f"  Portal:   /login/parent")