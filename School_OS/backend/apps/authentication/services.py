"""
Authentication Services — School OS

Shared, reusable onboarding helpers so every entry point that creates a
parent account behaves identically (registration wizard, Add Parent page,
and any future bulk tool).
"""
import secrets
import string

from rest_framework import serializers


def create_parent_account(tenant, *, first_name, last_name, email, phone='',
                          default_language='en', links=None, assigned_by=None):
    """
    Create a GLOBAL parent user with a parent role mapping at `tenant` and
    optional student links. Parents are global identity — the role mapping
    here is their "home" school; other schools can link them later.

    Returns (user, temp_password, created_link_student_ids).
    Raises serializers.ValidationError on duplicate email or invalid links.
    """
    from apps.authentication.models import User, UserRoleMapping
    from apps.students.models import Student, ParentStudentRelationship

    if User.objects.filter(email=email).exists():
        raise serializers.ValidationError("A user with this email already exists.")

    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))

    user = User.objects.create_user(
        email=email,
        username=email,
        first_name=first_name,
        last_name=last_name,
        password=temp_password,
        phone=phone,
        default_language=default_language,
    )
    user.must_change_password = True
    user.save(update_fields=['must_change_password'])

    UserRoleMapping.objects.create(
        user=user,
        tenant=tenant,
        role='parent',
        assigned_by=assigned_by,
    )

    created_links = []
    for link in (links or []):
        student_id = link.get('student_id')
        relationship_type = link.get('relationship_type', 'guardian')
        if not student_id:
            continue
        try:
            student = Student.objects.get(id=student_id, tenant_id=tenant.id)
        except (Student.DoesNotExist, ValueError):
            raise serializers.ValidationError({
                'links': f'Student {student_id} does not exist in this school.'
            })
        if relationship_type not in ('father', 'mother', 'guardian'):
            raise serializers.ValidationError({
                'links': f'Invalid relationship_type: {relationship_type}.'
            })
        rel, rel_created = ParentStudentRelationship.objects.get_or_create(
            parent_user=user, student=student,
            defaults={'relationship_type': relationship_type},
        )
        if rel_created:
            created_links.append(str(student.id))

    return user, temp_password, created_links
