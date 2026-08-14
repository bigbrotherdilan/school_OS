"""
Setup tester schools — School OS

For each of the 12 real schools (from seed_real_schools):
  1. Creates (if missing) an admin account: admin.<slug>@schoolos.sos
     with a unique 12-char temp password (must_change_password=True).
  2. Seeds the baseline academic structure so testers can immediately
     register students and add teachers/bursars:
     - Active AcademicYear (2026/2027) + 3 Terms + 6 Sequences
     - Cycles (1st/2nd) + Sections (Grammar/Francophone per education_type)
     - Recommended classes (Form 1–Upper Sixth / 6ème–Terminale)
     - Recommended subjects + SectionSubject/ClassSubject links + Series

Idempotent: safe to re-run; existing accounts and structure are left alone.

Usage: python manage.py setup_tester_schools
Output: prints a credentials table and writes tester_credentials.csv at repo root.
"""
import csv
import secrets
import string
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.authentication.models import User, UserRoleMapping
from apps.tenants.models import Tenant, TenantConfig
from apps.tenants.management.commands.seed_real_schools import Command as SeedSchools

REPO_ROOT = Path(__file__).resolve().parents[6]

YEAR_NAME = '2026/2027'
YEAR_START = '2026-09-07'
YEAR_END = '2027-07-31'

TERMS = [
    ('1st Term', '2026-09-07', '2026-11-27'),
    ('2nd Term', '2027-01-04', '2027-03-26'),
    ('3rd Term', '2027-04-05', '2027-07-02'),
]
SEQUENCES_PER_TERM = 2

SECTIONS_BY_TYPE = {
    'anglophone': [('Grammar', 'en')],
    'francophone': [('Francophone', 'fr')],
    'bilingual': [('Grammar', 'en'), ('Francophone', 'fr')],
}

SERIES_BY_LANGUAGE = {
    'en': [
        ('A1', 'French, Literature and History'),
        ('S1', 'Chemistry, Physics and Maths'),
        ('S2', 'Chemistry, Physics and Biology'),
    ],
    'fr': [
        ('A', 'Lettres et Philosophie'),
        ('B', 'Sciences Economiques et Sociales'),
        ('C', 'Mathematiques et Sciences Physiques'),
        ('D', 'Mathematiques et Sciences de la Vie et de la Terre'),
    ],
}


class Command(BaseCommand):
    help = 'Creates admin accounts + baseline academic setup for the 12 tester schools.'

    def handle(self, *args, **options):
        from apps.academic.models import (
            AcademicYear, Term, Sequence, Cycle, Section, Series,
            Class, Subject, SectionSubject, ClassSubject,
        )
        from apps.academic.curriculum import recommended_classes, recommended_subjects

        credentials = []

        for data in SeedSchools.SCHOOLS:
            slug = slugify(data['school_name'])
            tenant = Tenant.objects.get(slug=slug)
            self.stdout.write(self.style.MIGRATE_HEADING(f'\n=== {tenant.school_name} ==='))

            # ── 1. Admin account ──
            email = f"admin.{tenant.slug}@schoolos.sos"
            admin, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'first_name': 'School',
                    'last_name': 'Administrator',
                    'is_staff': False,
                },
            )
            mapping, mapping_created = UserRoleMapping.objects.get_or_create(
                user=admin, tenant=tenant, role='admin',
                defaults={'is_active': True},
            )
            password = None
            if created:
                alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
                password = ''.join(secrets.choice(alphabet) for _ in range(12))
                admin.set_password(password)
                admin.must_change_password = True
                admin.save(update_fields=['password', 'must_change_password'])
                self.stdout.write(self.style.SUCCESS(f'  Admin created: {email}'))
            else:
                self.stdout.write(f'  Admin exists: {email} (password unchanged)')
            if mapping_created:
                mapping.assigned_by = admin
                mapping.save(update_fields=['assigned_by'])

            # ── 2. Baseline academic setup ──
            TenantConfig.objects.get_or_create(
                tenant=tenant,
                defaults={
                    'currency_code': 'XAF',
                    'currency_symbol': 'XAF',
                    'default_language': 'en' if data['education_type'] == 'anglophone' else 'fr',
                },
            )

            year, year_created = AcademicYear.objects.get_or_create(
                tenant=tenant, name=YEAR_NAME,
                defaults={'start_date': YEAR_START, 'end_date': YEAR_END, 'is_active': True},
            )
            if year_created:
                self.stdout.write(f'  Academic year {YEAR_NAME} created')
            else:
                year.start_date = YEAR_START
                year.end_date = YEAR_END
                year.is_active = True
                year.save(update_fields=['start_date', 'end_date', 'is_active'])

            for order, (name, start, end) in enumerate(TERMS, start=1):
                term, _ = Term.objects.get_or_create(
                    academic_year=year, order_number=order,
                    defaults={'name': name, 'start_date': start, 'end_date': end},
                )
                existing_sequences = term.sequences.count()
                for _ in range(max(0, SEQUENCES_PER_TERM - existing_sequences)):
                    Sequence.objects.create(term=term)

            cycle1, _ = Cycle.objects.get_or_create(
                tenant=tenant, order=1, defaults={'name': '1st Cycle'})
            cycle2, _ = Cycle.objects.get_or_create(
                tenant=tenant, order=2, defaults={'name': '2nd Cycle'})
            cycles = {1: cycle1, 2: cycle2}

            created_classes = 0
            for section_name, language in SECTIONS_BY_TYPE[data['education_type']]:
                section, _ = Section.objects.get_or_create(
                    tenant=tenant, name=section_name, defaults={'language': language})

                class_map = {}
                for cls_name, level_order, cycle_order in recommended_classes(language):
                    cls_obj, cls_created = Class.objects.get_or_create(
                        tenant=tenant, cycle=cycles[cycle_order], stream=section,
                        name=cls_name, defaults={'level_order': level_order},
                    )
                    class_map[cycle_order] = class_map.get(cycle_order, [])
                    if cls_created:
                        created_classes += 1
                    class_map[cycle_order].append(cls_obj)

                subject_map = {}
                for subj_name, code, cycle_order, coeff, compulsory in recommended_subjects(language):
                    subj, subj_created = Subject.objects.get_or_create(
                        tenant=tenant, cycle=cycles[cycle_order], name=subj_name,
                        defaults={
                            'code': code,
                            'language': language,
                            'default_coefficient': coeff,
                            'is_compulsory': compulsory,
                        },
                    )
                    SectionSubject.objects.get_or_create(
                        section=section, subject=subj,
                        defaults={'coefficient': coeff},
                    )
                    subject_map.setdefault(cycle_order, []).append(subj)

                for cycle_order, class_list in class_map.items():
                    for cls_obj in class_list:
                        for subj in subject_map.get(cycle_order, []):
                            ClassSubject.objects.get_or_create(
                                academic_class=cls_obj, subject=subj,
                                defaults={'coefficient': subj.default_coefficient},
                            )

                for code, series_name in SERIES_BY_LANGUAGE[language]:
                    Series.objects.get_or_create(
                        tenant=tenant, cycle=cycle2, stream=section, code=code,
                        defaults={'name': series_name},
                    )

                self.stdout.write(
                    f'  Section {section_name}: {len(class_map.get(1, [])) + len(class_map.get(2, []))} classes, '
                    f'{len(subject_map.get(1, [])) + len(subject_map.get(2, []))} subjects'
                )

            credentials.append({
                'school': tenant.school_name,
                'slug': tenant.slug,
                'admin_email': email,
                'password': password if password is not None else '(existing — use reset-password)',
            })

        self._write_csv(credentials)
        self.stdout.write(self.style.SUCCESS('\n\n===== TESTER CREDENTIALS ====='))
        for row in credentials:
            self.stdout.write(
                f"{row['school']:<50} {row['admin_email']:<45} {row['password']}"
            )
        csv_path = REPO_ROOT / 'tester_credentials.csv'
        self.stdout.write(self.style.SUCCESS(f'\nCredentials saved to: {csv_path}'))

    def _write_csv(self, rows):
        csv_path = REPO_ROOT / 'tester_credentials.csv'
        with csv_path.open('w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=['school', 'slug', 'admin_email', 'password'])
            writer.writeheader()
            writer.writerows(rows)
