"""
Django management command — renumber_students

Renumber every existing student's admission_number to the new scheme
{SCHOOL-INITIALS}-{YEAR}-{SECTION}-{SEQ}. Sequence is assigned per
(tenant, year, section) ordered by enrolment date.

Legacy students without a stream are grouped under the GEN section code.

Run: python manage.py renumber_students [--dry-run]
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.students.models import Student
from apps.students.utils import school_initials, section_code


class Command(BaseCommand):
    help = 'Renumber all students to the {INITIALS}-{YEAR}-{SECTION}-{SEQ} scheme.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print the new numbers without saving.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        students = Student.objects.select_related('tenant', 'stream').order_by(
            'tenant_id', 'enrolled_date', 'created_at'
        )

        groups = {}
        for s in students:
            key = (s.tenant_id, s.enrolled_date.year if s.enrolled_date else None, s.stream_id)
            groups.setdefault(key, []).append(s)

        changes = []
        collisions = 0
        used = set()

        for group in groups.values():
            initials = school_initials(group[0].tenant.school_name)
            for idx, s in enumerate(group, start=1):
                year = s.enrolled_date.year if s.enrolled_date else None
                number = f"{initials}-{year}-{section_code(s.stream)}-{idx:04d}"
                if number in used:
                    collisions += 1
                used.add(number)
                if s.admission_number != number:
                    changes.append((s, number))

        if dry_run:
            for s, number in changes:
                self.stdout.write(f"  {s.admission_number} -> {number}  ({s.full_name})")
            self.stdout.write(self.style.WARNING(
                f"DRY RUN: {len(changes)} students would change. "
                f"{collisions} internal sequence collisions (would need manual review)."
            ))
            return

        with transaction.atomic():
            for s, number in changes:
                s.admission_number = number
                s.save(update_fields=['admission_number'])

        self.stdout.write(self.style.SUCCESS(
            f"Renumbered {len(changes)} students. {collisions} sequence collisions resolved."
        ))
