"""
School OS — Seed Data Script (v3)
Creates realistic mock data for a bilingual school in Cameroon.
Includes: Tenants, Users, Academic Structure (Cycles, Classes, Series, Subjects), Students, and Staff.
Run with: python manage.py shell < seed_data.py
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

from datetime import date, timedelta
from django.utils.text import slugify
from apps.tenants.models import Tenant
from apps.authentication.models import User, UserRoleMapping
from apps.academic.models import AcademicYear, Term, Cycle, Section, Series, Class, Subject, ClassSubject
from apps.students.models import Student
from apps.staff.models import Teacher, TeachingAssignment


def create_seed_data():
    print("=" * 60)
    print("  SCHOOL OS — Seeding Mock Data (v3)")
    print("=" * 60)

    # ─── 1. Create Tenant (Bilingual School) ────────────────────
    print("\n[1/7] Creating tenants...")
    tenant, _ = Tenant.objects.get_or_create(
        slug='saint-joseph-bilingual',
        defaults={
            'school_name': 'Saint Joseph Bilingual Academy',
            'education_type': 'bilingual',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Centre',
            'division': 'Mfoundi',
            'country': 'Cameroon',
            'address': 'Rue de la Paix, Yaoundé',
            'phone': '+237 677 123 456',
            'email': 'admin@saintjoseph.sos',
            'motto': 'Excellence Through Knowledge',
            'status': 'active',
            'subscription_plan': 'growing',
            'max_students': 2000,
            'theme_config': {
                'primaryColor': '#00236f',
                'secondaryColor': '#006b5f',
                'accentColor': '#ffb95f',
                'fontFamily': 'Inter, sans-serif',
            },
        },
    )
    print(f"   -> Tenant: {tenant.school_name}")

    # ─── 2. Create Users ────────────────────────────────────────
    print("\n[2/7] Creating users...")

superadmin, _ = User.objects.get_or_create(
            email='platform@schoolos.sos',
            defaults={
                'username': 'platform_admin',
                'first_name': 'Platform',
                'last_name': 'Administrator',
                'is_platform_admin': True,
                'is_staff': True,
                'is_superuser': True,
            },
        )
        if _:  # Created
            password = generate_secure_password()
            superadmin.set_password(password)
            superadmin.save()
            print(f"   -> Platform admin password: {password}")

        admin_user, _ = User.objects.get_or_create(
            email='admin@saintjoseph.sos',
            defaults={'username': 'sj_admin', 'first_name': 'Marie', 'last_name': 'Nguema'},
        )
        if _:  # Created
            password = generate_secure_password()
            admin_user.set_password(password)
            admin_user.save()
            print(f"   -> Saint Joseph admin password: {password}")
        UserRoleMapping.objects.get_or_create(user=admin_user, tenant=tenant, role='admin')

teacher_users = []
        teachers_data = [
            {'email': 'dr.thorne@saintjoseph.sos', 'first': 'Aris', 'last': 'Thorne', 'lang': 'en'},
            {'email': 'mme.biya@saintjoseph.sos', 'first': 'Clarisse', 'last': 'Biya', 'lang': 'fr'},
        ]
        teacher_passwords = {}
        for data in teachers_data:
            u, _ = User.objects.get_or_create(
                email=data['email'],
                defaults={'username': slugify(data['first']), 'first_name': data['first'], 'last_name': data['last'], 'default_language': data['lang']}
            )
            if _:  # Created
                password = generate_secure_password()
                u.set_password(password)
                u.save()
                teacher_passwords[data['email']] = password
            UserRoleMapping.objects.get_or_create(user=u, tenant=tenant, role='teacher')
            teacher_users.append(u)

        dr_song, _ = User.objects.get_or_create(
            email='dr.song@saintjoseph.sos',
            defaults={'username': 'dr_song', 'first_name': 'Hee-young', 'last_name': 'Song', 'default_language': 'en'}
        )
        if _:  # Created
            password = generate_secure_password()
            dr_song.set_password(password)
            dr_song.save()
            print(f"   -> Dr. Song password: {password}")
        UserRoleMapping.objects.get_or_create(user=dr_song, tenant=tenant, role='teacher')
        UserRoleMapping.objects.get_or_create(user=dr_song, tenant=tenant, role='admin')
        teacher_users.append(dr_song)

    # ─── 3. Academic Structure ──────────────────────────────────
    print("\n[3/7] Setting up academic structure...")

    # Academic Year
    year, _ = AcademicYear.objects.get_or_create(
        tenant=tenant,
        name='2025/2026',
        defaults={
            'start_date': date(2025, 9, 1),
            'end_date': date(2026, 6, 30),
            'is_active': True,
        }
    )

    # Terms (3 trimestres)
    for i, name in enumerate(['1st Term', '2nd Term', '3rd Term'], 1):
        Term.objects.get_or_create(
            academic_year=year,
            order_number=i,
            defaults={'name': name},
        )

    # Cycles
    cycle1, _ = Cycle.objects.get_or_create(
        tenant=tenant, order=1,
        defaults={'name': '1st Cycle'},
    )
    cycle2, _ = Cycle.objects.get_or_create(
        tenant=tenant, order=2,
        defaults={'name': '2nd Cycle'},
    )

    # Sections (for bilingual school)
    anglo_section, _ = Section.objects.get_or_create(
        tenant=tenant, name='Grammar',
        defaults={'language': 'en'},
    )
    franco_section, _ = Section.objects.get_or_create(
        tenant=tenant, name='Francophone',
        defaults={'language': 'fr'},
    )

    # Classes — Anglophone 1st Cycle (Form 1-5)
    form1, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=anglo_section, name='Form 1',
        defaults={'level_order': 1},
    )
    form2, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=anglo_section, name='Form 2',
        defaults={'level_order': 2},
    )
    form3, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=anglo_section, name='Form 3',
        defaults={'level_order': 3},
    )
    form4, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=anglo_section, name='Form 4',
        defaults={'level_order': 4},
    )
    form5, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=anglo_section, name='Form 5',
        defaults={'level_order': 5},
    )

    # Classes — Francophone 1st Cycle (6ème-3ème)
    sixieme, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=franco_section, name='6ème',
        defaults={'level_order': 1},
    )
    cinquieme, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=franco_section, name='5ème',
        defaults={'level_order': 2},
    )
    quatrieme, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=franco_section, name='4ème',
        defaults={'level_order': 3},
    )
    troisieme, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle1, stream=franco_section, name='3ème',
        defaults={'level_order': 4},
    )

    # Classes — Anglophone 2nd Cycle (Lower/Upper Sixth)
    lower6, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, name='Lower Sixth',
        defaults={'level_order': 6},
    )
    upper6, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, name='Upper Sixth',
        defaults={'level_order': 7},
    )

    # Classes — Francophone 2nd Cycle (Seconde-Terminale)
    seconde, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=franco_section, name='Seconde',
        defaults={'level_order': 5},
    )
    premiere, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=franco_section, name='Première',
        defaults={'level_order': 6},
    )
    terminale, _ = Class.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=franco_section, name='Terminale',
        defaults={'level_order': 7},
    )

    # Series (2nd Cycle only)
    # Francophone
    series_a, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=franco_section, code='A',
        defaults={'name': 'Lettres et Philosophie'},
    )
    series_b, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=franco_section, code='B',
        defaults={'name': 'Sciences Économiques et Sociales'},
    )
    series_c, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=franco_section, code='C',
        defaults={'name': 'Mathématiques et Sciences Physiques'},
    )
    series_d, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=franco_section, code='D',
        defaults={'name': 'Mathématiques et Sciences de la Vie et de la Terre'},
    )
    series_e, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=franco_section, code='E',
        defaults={'name': 'Mathématiques et Technologie'},
    )

    # Anglophone
    series_a1, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='A1',
        defaults={'name': 'French, Literature and History'},
    )
    series_a2, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='A2',
        defaults={'name': 'Geography, Economics and History'},
    )
    series_a3, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='A3',
        defaults={'name': 'Literature, History and Economics'},
    )
    series_a4, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='A4',
        defaults={'name': 'Geography, Economics and Maths'},
    )
    series_a5, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='A5',
        defaults={'name': 'Literature, Philosophy and Maths'},
    )
    series_s1, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='S1',
        defaults={'name': 'Chemistry, Physics and Maths'},
    )
    series_s2, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='S2',
        defaults={'name': 'Chemistry, Physics and Biology'},
    )
    series_s3, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='S3',
        defaults={'name': 'Biology, Chemistry and Physics'},
    )
    series_s4, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='S4',
        defaults={'name': 'Biology, Chemistry and Geology'},
    )
    series_s5, _ = Series.objects.get_or_create(
        tenant=tenant, cycle=cycle2, stream=anglo_section, code='S5',
        defaults={'name': 'Chemistry, Computer Science and Maths'},
    )

    # Subjects — 1st Cycle (common)
    maths, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle1, code='570',
        defaults={'name': 'Mathematics', 'language': 'en', 'default_coefficient': 4.0, 'is_compulsory': True},
    )
    english, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle1, code='530',
        defaults={'name': 'English Language', 'language': 'en', 'default_coefficient': 3.0, 'is_compulsory': True},
    )
    french_subj, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle1, code='535',
        defaults={'name': 'French Language', 'language': 'en', 'default_coefficient': 3.0, 'is_compulsory': True},
    )

    # Subjects — 2nd Cycle (common)
    physics, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle2, code='780',
        defaults={'name': 'Physics', 'language': 'en', 'default_coefficient': 5.0, 'is_compulsory': False},
    )
    chemistry, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle2, code='715',
        defaults={'name': 'Chemistry', 'language': 'en', 'default_coefficient': 5.0, 'is_compulsory': False},
    )
    biology, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle2, code='710',
        defaults={'name': 'Biology', 'language': 'en', 'default_coefficient': 4.0, 'is_compulsory': False},
    )
    history, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle2, code='760',
        defaults={'name': 'History', 'language': 'en', 'default_coefficient': 3.0, 'is_compulsory': False},
    )
    geography, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle2, code='750',
        defaults={'name': 'Geography', 'language': 'en', 'default_coefficient': 3.0, 'is_compulsory': False},
    )
    philosophy, _ = Subject.objects.get_or_create(
        tenant=tenant, cycle=cycle2, code='790',
        defaults={'name': 'Philosophy', 'language': 'en', 'default_coefficient': 4.0, 'is_compulsory': False},
    )

    # Link subjects to classes (ClassSubject)
    for cls in [form1, form2, form3, form4, form5, sixieme, cinquieme, quatrieme, troisieme]:
        for subj in [maths, english, french_subj]:
            ClassSubject.objects.get_or_create(
                academic_class=cls, subject=subj, series=None,
                defaults={'coefficient': subj.default_coefficient},
            )

    # 2nd Cycle: Anglophone Science series
    for subj in [maths, english, french_subj, physics, chemistry]:
        ClassSubject.objects.get_or_create(
            academic_class=lower6, subject=subj, series=series_s1,
            defaults={'coefficient': subj.default_coefficient},
        )

    # 2nd Cycle: Francophone Series C
    for subj in [maths, french_subj, english, physics, chemistry]:
        ClassSubject.objects.get_or_create(
            academic_class=seconde, subject=subj, series=series_c,
            defaults={'coefficient': subj.default_coefficient},
        )

    # ─── 4. Staff Profiles & Assignments ────────────────────────
    print("\n[4/7] Creating staff profiles...")

    t_thorne, _ = Teacher.objects.get_or_create(
        user=teacher_users[0], tenant=tenant,
        defaults={'employee_id': 'TCH001', 'qualification': 'PhD Mathematics'},
    )
    t_song, _ = Teacher.objects.get_or_create(
        user=dr_song, tenant=tenant,
        defaults={'employee_id': 'TCH003', 'qualification': 'MSc Physics'},
    )

    TeachingAssignment.objects.get_or_create(
        teacher=t_thorne, subject=maths, academic_class=form1, academic_year=year,
        defaults={'tenant': tenant},
    )
    TeachingAssignment.objects.get_or_create(
        teacher=t_song, subject=french_subj, academic_class=form1, academic_year=year,
        defaults={'tenant': tenant},
    )

    # ─── 4b. Timetable & Time Slots ─────────────────────────────
    print("\n[4b/7] Creating timetable and time slots...")
    from apps.timetable.models import Timetable, TimeSlot
    from datetime import time

    term1 = Term.objects.filter(academic_year=year, order_number=1).first()
    if term1:
        timetable, _ = Timetable.objects.get_or_create(
            tenant=tenant, academic_year=year, term=term1, class_obj=form1,
            defaults={'is_active': True},
        )
        slots_data = [
            (1, time(8, 0), time(9, 0), maths, t_thorne, 'Room 402'),
            (1, time(9, 0), time(10, 0), french_subj, t_song, 'Room 201'),
            (1, time(10, 30), time(11, 30), maths, t_thorne, 'Room 402'),
            (2, time(8, 0), time(9, 0), french_subj, t_song, 'Room 201'),
            (2, time(9, 0), time(10, 0), maths, t_thorne, 'Room 402'),
            (2, time(10, 30), time(11, 30), french_subj, t_song, 'Lab 03'),
            (3, time(8, 0), time(9, 0), maths, t_thorne, 'Room 402'),
            (3, time(10, 30), time(11, 30), french_subj, t_song, 'Room 201'),
            (4, time(9, 0), time(10, 0), maths, t_thorne, 'Room 402'),
            (4, time(10, 30), time(11, 30), french_subj, t_song, 'Room 201'),
            (5, time(8, 0), time(9, 0), maths, t_thorne, 'Room 402'),
            (5, time(9, 0), time(10, 0), french_subj, t_song, 'Room 201'),
        ]
        for day, start, end, subj, teacher_obj, room in slots_data:
            TimeSlot.objects.get_or_create(
                timetable=timetable, day_of_week=day, start_time=start, end_time=end,
                defaults={'subject': subj, 'teacher': teacher_obj, 'classroom': room},
            )
        print(f"   -> Created {TimeSlot.objects.filter(timetable=timetable).count()} time slots")

    # ─── 4c. Curriculum ─────────────────────────────────────────
    print("\n[4c/7] Initializing curriculum modules & lessons...")
    from apps.logbook.models import CurriculumModule, CurriculumLesson

    m_algebra, _ = CurriculumModule.objects.get_or_create(
        tenant=tenant, subject=maths, name="Algebra", order=1,
    )
    m_geometry, _ = CurriculumModule.objects.get_or_create(
        tenant=tenant, subject=maths, name="Geometry", order=2,
    )

    CurriculumLesson.objects.get_or_create(module=m_algebra, title="Linear Equations", order=1)
    CurriculumLesson.objects.get_or_create(module=m_algebra, title="Quadratic Functions", order=2, is_completed=True)
    CurriculumLesson.objects.get_or_create(module=m_algebra, title="Polynomials", order=3, is_completed=True)
    CurriculumLesson.objects.get_or_create(module=m_geometry, title="Pythagorean Theorem", order=1, is_completed=True)
    CurriculumLesson.objects.get_or_create(module=m_geometry, title="Circle Theorems", order=2)

    f_grammar, _ = CurriculumModule.objects.get_or_create(
        tenant=tenant, subject=french_subj, name="Grammar & Conjugation", order=1,
    )
    CurriculumLesson.objects.get_or_create(module=f_grammar, title="Le Passé Composé", order=1, is_completed=True)
    CurriculumLesson.objects.get_or_create(module=f_grammar, title="Le Subjonctif", order=2)

    # ─── 5. Students ────────────────────────────────────────────
    print("\n[5/7] Enrolling students...")

    students_to_create = [
        {'first': 'John', 'last': 'Doe', 'gender': 'M', 'dob': date(2013, 5, 15), 'class': form1, 'section': anglo_section, 'series': None},
        {'first': 'Jane', 'last': 'Smith', 'gender': 'F', 'dob': date(2013, 8, 22), 'class': form1, 'section': anglo_section, 'series': None},
        {'first': 'Jean', 'last': 'Dupont', 'gender': 'M', 'dob': date(2013, 2, 10), 'class': sixieme, 'section': franco_section, 'series': None},
    ]

    for s_data in students_to_create:
        student, created = Student.objects.get_or_create(
            tenant=tenant,
            first_name=s_data['first'],
            last_name=s_data['last'],
            defaults={
                'gender': s_data['gender'],
                'date_of_birth': s_data['dob'],
                'current_class': s_data['class'],
                'stream': s_data['section'],
                'series': s_data.get('series'),
                'status': 'active',
            }
        )
        if created:
            print(f"   -> Enrolled: {student.first_name} {student.last_name} | ID: {student.admission_number}")

    # ─── 6. Finance & Billing ───────────────────────────────────
    print("\n[6/7] Setting up financial structure & invoices...")
    from apps.finance.models import FeeCategory, FeeStructure, StudentInvoice

    tuition, _ = FeeCategory.objects.get_or_create(
        tenant=tenant, name='Tuition Fee', defaults={'is_mandatory': True},
    )
    registration, _ = FeeCategory.objects.get_or_create(
        tenant=tenant, name='Registration Fee', defaults={'is_mandatory': True},
    )

    FeeStructure.objects.get_or_create(
        tenant=tenant, academic_year=year, category=tuition, target_class=form1,
        defaults={'amount': 1500.00},
    )
    FeeStructure.objects.get_or_create(
        tenant=tenant, academic_year=year, category=registration, target_class=form1,
        defaults={'amount': 250.00},
    )
    FeeStructure.objects.get_or_create(
        tenant=tenant, academic_year=year, category=tuition, target_class=sixieme,
        defaults={'amount': 1200.00},
    )

    from django.utils import timezone
    due_date = timezone.now().date() + timedelta(days=30)

    all_students = Student.objects.filter(tenant=tenant)
    for student in all_students:
        f_structures = FeeStructure.objects.filter(target_class=student.current_class)
        total = sum(fs.amount for fs in f_structures)

        invoice, created = StudentInvoice.objects.get_or_create(
            tenant=tenant,
            student=student,
            academic_year=year,
            defaults={
                'total_amount': total,
                'amount_paid': 0,
                'status': 'unpaid',
                'due_date': due_date,
            }
        )
        if created:
            print(f"   -> Generated Invoice: {invoice.invoice_number} for {student.full_name} (CFA {total})")

    # ─── 7. Summary ─────────────────────────────────────────────
    print("\n[7/7] Seed data complete!")
    print("=" * 60)
    print(f"  Cycles: {Cycle.objects.filter(tenant=tenant).count()}")
    print(f"  Classes: {Class.objects.filter(tenant=tenant).count()}")
    print(f"  Series: {Series.objects.filter(tenant=tenant).count()}")
    print(f"  Subjects: {Subject.objects.filter(tenant=tenant).count()}")
    print(f"  ClassSubjects: {ClassSubject.objects.filter(academic_class__tenant=tenant).count()}")
    print(f"  Students: {Student.objects.filter(tenant=tenant).count()}")
    print(f"  Invoices: {StudentInvoice.objects.filter(tenant=tenant).count()}")
    print("=" * 60)


if __name__ == '__main__':
    create_seed_data()
