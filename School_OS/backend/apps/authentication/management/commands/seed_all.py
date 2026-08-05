"""
Combined seed command: runs all seed scripts in one process.
Uses connection.close() between phases to survive Railway proxy timeouts.
Usage: python manage.py seed_all
"""
import time as _time
import os
import sys
import secrets
import string
from datetime import date, timedelta, time
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils.text import slugify
from django.db.utils import OperationalError


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


class Command(BaseCommand):
    help = 'Seeds all data: both schools, parent, linked students'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Seeding Saint Joseph Bilingual Academy...'))
        self.run_with_retry(self.seed_saint_joseph, 'Saint Joseph')

        self.stdout.write(self.style.WARNING('Seeding parent (Paul Essomba)...'))
        self.run_with_retry(self.seed_parent, 'Parent')

        self.stdout.write(self.style.WARNING('Seeding Greenfield International Academy...'))
        self.run_with_retry(self.seed_greenfield, 'Greenfield')

        self.stdout.write(self.style.SUCCESS('ALL SEEDS COMPLETE'))

    def run_with_retry(self, func, label, max_retries=3):
        for attempt in range(max_retries):
            try:
                func()
                return
            except OperationalError as e:
                if attempt < max_retries - 1:
                    self.stdout.write(self.style.WARNING(f'  Connection lost during {label} (attempt {attempt+1}), retrying...'))
                    connection.close()
                    _time.sleep(2)
                else:
                    raise

    def reconnect(self):
        connection.close()
        _time.sleep(0.3)

    def ensure_conn(self):
        try:
            connection.ensure_connection()
        except Exception:
            connection.close()

    # ────────────────────────────────────────────────────────
    # SCHOOL 1: Saint Joseph Bilingual Academy
    # ────────────────────────────────────────────────────────
    def seed_saint_joseph(self):
        from apps.tenants.models import Tenant, TenantConfig
        from apps.authentication.models import User, UserRoleMapping
        from apps.academic.models import AcademicYear, Term, Cycle, Section, Series, Class, Subject, ClassSubject, SectionSubject
        from apps.students.models import Student
        from apps.staff.models import Teacher, TeachingAssignment

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
                'address': 'Rue de la Paix, Yaounde',
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
        TenantConfig.objects.get_or_create(
            tenant=tenant,
            defaults={'currency_code': 'XAF', 'currency_symbol': 'XAF', 'default_language': 'en'},
        )
        self.stdout.write(f'  Tenant: {tenant.school_name}')
        self.reconnect()

        superadmin, created = User.objects.get_or_create(
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
        if created:
            password = generate_secure_password()
            superadmin.set_password(password)
            superadmin.save()
            self.stdout.write(self.style.SUCCESS(f'  Platform admin password: {password}'))

        admin_user, created = User.objects.get_or_create(
            email='admin@saintjoseph.sos',
            defaults={'username': 'sj_admin', 'first_name': 'Marie', 'last_name': 'Nguema'},
        )
        if created:
            password = generate_secure_password()
            admin_user.set_password(password)
            admin_user.save()
            self.stdout.write(self.style.SUCCESS(f'  Saint Joseph admin password: {password}'))
        UserRoleMapping.objects.get_or_create(user=admin_user, tenant=tenant, role='admin')

        teacher_data = [
            ('dr.thorne@saintjoseph.sos', 'Aris', 'Thorne', 'en'),
            ('mme.biya@saintjoseph.sos', 'Clarisse', 'Biya', 'fr'),
        ]
        teacher_users = []
        teacher_passwords = {}
        for email, first, last, lang in teacher_data:
            u, created = User.objects.get_or_create(
                email=email,
                defaults={'username': slugify(first), 'first_name': first, 'last_name': last, 'default_language': lang},
            )
            if created:
                password = generate_secure_password()
                u.set_password(password)
                u.save()
                teacher_passwords[email] = password
            UserRoleMapping.objects.get_or_create(user=u, tenant=tenant, role='teacher')
            teacher_users.append(u)
        
        # Display teacher passwords
        for email, password in teacher_passwords.items():
            self.stdout.write(self.style.SUCCESS(f'  Teacher ({email}) password: {password}'))

        dr_song, created = User.objects.get_or_create(
            email='dr.song@saintjoseph.sos',
            defaults={'username': 'dr_song', 'first_name': 'Hee-young', 'last_name': 'Song', 'default_language': 'en'},
        )
        if created:
            password = generate_secure_password()
            dr_song.set_password(password)
            dr_song.save()
            self.stdout.write(self.style.SUCCESS(f'  Dr. Song password: {password}'))
        UserRoleMapping.objects.get_or_create(user=dr_song, tenant=tenant, role='teacher')
        UserRoleMapping.objects.get_or_create(user=dr_song, tenant=tenant, role='admin')
        teacher_users.append(dr_song)
        self.reconnect()

        year, _ = AcademicYear.objects.get_or_create(
            tenant=tenant, name='2025/2026',
            defaults={'start_date': date(2025, 9, 1), 'end_date': date(2026, 6, 30), 'is_active': True},
        )
        for i, name in enumerate(['1st Term', '2nd Term', '3rd Term'], 1):
            term_obj, _ = Term.objects.get_or_create(
                academic_year=year, order_number=i, defaults={'name': name},
            )
            for j in range(1, 3):
                from apps.academic.models import Sequence
                Sequence.objects.get_or_create(
                    term=term_obj, order_number=j, defaults={'name': f'Sequence {j}'},
                )

        cycle1, _ = Cycle.objects.get_or_create(tenant=tenant, order=1, defaults={'name': '1st Cycle'})
        cycle2, _ = Cycle.objects.get_or_create(tenant=tenant, order=2, defaults={'name': '2nd Cycle'})

        anglo_section, _ = Section.objects.get_or_create(tenant=tenant, name='anglophone', defaults={'language': 'en'})
        franco_section, _ = Section.objects.get_or_create(tenant=tenant, name='francophone', defaults={'language': 'fr'})

        form1, _ = Class.objects.get_or_create(tenant=tenant, cycle=cycle1, stream=anglo_section, name='Form 1', defaults={'level_order': 1})
        form2, _ = Class.objects.get_or_create(tenant=tenant, cycle=cycle1, stream=anglo_section, name='Form 2', defaults={'level_order': 2})
        sixieme, _ = Class.objects.get_or_create(tenant=tenant, cycle=cycle1, stream=franco_section, name='6eme', defaults={'level_order': 1})
        cinquieme, _ = Class.objects.get_or_create(tenant=tenant, cycle=cycle1, stream=franco_section, name='5eme', defaults={'level_order': 2})
        lower6, _ = Class.objects.get_or_create(tenant=tenant, cycle=cycle2, stream=anglo_section, name='Lower Sixth', defaults={'level_order': 6})
        seconde, _ = Class.objects.get_or_create(tenant=tenant, cycle=cycle2, stream=franco_section, name='Seconde', defaults={'level_order': 5})

        series_a, _ = Series.objects.get_or_create(tenant=tenant, cycle=cycle2, stream=franco_section, code='A', defaults={'name': 'Lettres et Philosophie'})
        series_c, _ = Series.objects.get_or_create(tenant=tenant, cycle=cycle2, stream=franco_section, code='C', defaults={'name': 'Mathematiques et Sciences Physiques'})
        series_d, _ = Series.objects.get_or_create(tenant=tenant, cycle=cycle2, stream=franco_section, code='D', defaults={'name': 'Mathematiques et Sciences de la Vie et de la Terre'})
        series_a1, _ = Series.objects.get_or_create(tenant=tenant, cycle=cycle2, stream=anglo_section, code='A1', defaults={'name': 'French, Literature and History'})
        series_s1, _ = Series.objects.get_or_create(tenant=tenant, cycle=cycle2, stream=anglo_section, code='S1', defaults={'name': 'Chemistry, Physics and Maths'})
        series_s2, _ = Series.objects.get_or_create(tenant=tenant, cycle=cycle2, stream=anglo_section, code='S2', defaults={'name': 'Chemistry, Physics and Biology'})

        maths, _ = Subject.objects.get_or_create(tenant=tenant, cycle=cycle1, code='570', defaults={'name': 'Mathematics', 'default_coefficient': 4.0, 'is_compulsory': True})
        english, _ = Subject.objects.get_or_create(tenant=tenant, cycle=cycle1, code='530', defaults={'name': 'English Language', 'default_coefficient': 3.0, 'is_compulsory': True})
        french_subj, _ = Subject.objects.get_or_create(tenant=tenant, cycle=cycle1, code='535', defaults={'name': 'French Language', 'default_coefficient': 3.0, 'is_compulsory': True})
        physics, _ = Subject.objects.get_or_create(tenant=tenant, cycle=cycle2, code='780', defaults={'name': 'Physics', 'default_coefficient': 5.0, 'is_compulsory': False})
        chemistry, _ = Subject.objects.get_or_create(tenant=tenant, cycle=cycle2, code='715', defaults={'name': 'Chemistry', 'default_coefficient': 5.0, 'is_compulsory': False})
        self.reconnect()

        for cls in [form1, form2, sixieme, cinquieme]:
            for subj in [maths, english, french_subj]:
                ClassSubject.objects.get_or_create(
                    academic_class=cls, subject=subj, series=None,
                    defaults={'coefficient': subj.default_coefficient},
                )

        for subj in [maths, english, french_subj, physics, chemistry]:
            ClassSubject.objects.get_or_create(
                academic_class=lower6, subject=subj, series=series_s1,
                defaults={'coefficient': subj.default_coefficient},
            )

        for subj in [maths, french_subj, english, physics, chemistry]:
            ClassSubject.objects.get_or_create(
                academic_class=seconde, subject=subj, series=series_c,
                defaults={'coefficient': subj.default_coefficient},
            )

        for subj in [maths, english, french_subj]:
            SectionSubject.objects.get_or_create(
                section=anglo_section, subject=subj,
                defaults={'coefficient': subj.default_coefficient},
            )
            SectionSubject.objects.get_or_create(
                section=franco_section, subject=subj,
                defaults={'coefficient': subj.default_coefficient},
            )
        for subj in [physics, chemistry]:
            SectionSubject.objects.get_or_create(
                section=anglo_section, subject=subj,
                defaults={'coefficient': subj.default_coefficient},
            )

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
        self.reconnect()

        students_data = [
            {'first': 'John', 'last': 'Doe', 'gender': 'M', 'dob': date(2013, 5, 15), 'class': form1, 'section': anglo_section},
            {'first': 'Jane', 'last': 'Smith', 'gender': 'F', 'dob': date(2013, 8, 22), 'class': form1, 'section': anglo_section},
            {'first': 'Jean', 'last': 'Dupont', 'gender': 'M', 'dob': date(2013, 2, 10), 'class': sixieme, 'section': franco_section},
        ]
        for s_data in students_data:
            Student.objects.get_or_create(
                tenant=tenant, first_name=s_data['first'], last_name=s_data['last'],
                defaults={
                    'gender': s_data['gender'], 'date_of_birth': s_data['dob'],
                    'current_class': s_data['class'], 'stream': s_data['section'], 'status': 'active',
                },
            )

        from apps.finance.models import FeeCategory, FeeStructure, StudentInvoice
        from django.utils import timezone
        tuition, _ = FeeCategory.objects.get_or_create(tenant=tenant, name='Tuition Fee', defaults={'is_mandatory': True})
        registration, _ = FeeCategory.objects.get_or_create(tenant=tenant, name='Registration Fee', defaults={'is_mandatory': True})
        FeeStructure.objects.get_or_create(tenant=tenant, academic_year=year, category=tuition, target_class=form1, defaults={'amount': 1500.00})
        FeeStructure.objects.get_or_create(tenant=tenant, academic_year=year, category=registration, target_class=form1, defaults={'amount': 250.00})
        FeeStructure.objects.get_or_create(tenant=tenant, academic_year=year, category=tuition, target_class=sixieme, defaults={'amount': 1200.00})

        due_date = timezone.now().date() + timedelta(days=30)
        all_students = Student.objects.filter(tenant=tenant)
        for student in all_students:
            f_structures = FeeStructure.objects.filter(target_class=student.current_class)
            total = sum(fs.amount for fs in f_structures)
            StudentInvoice.objects.get_or_create(
                tenant=tenant, student=student, academic_year=year,
                defaults={'total_amount': total, 'amount_paid': 0, 'status': 'unpaid', 'due_date': due_date},
            )

        self.stdout.write(self.style.SUCCESS(f'  Saint Joseph: {Student.objects.filter(tenant=tenant).count()} students'))
        self.reconnect()

    # ────────────────────────────────────────────────────────
    # PARENT: Paul Essomba
    # ────────────────────────────────────────────────────────
    def seed_parent(self):
        from apps.tenants.models import Tenant
        from apps.authentication.models import User, UserRoleMapping
        from apps.students.models import Student, ParentStudentRelationship

        tenant = Tenant.objects.filter(slug='saint-joseph-bilingual').first()
        if not tenant:
            tenant = Tenant.objects.first()
        if not tenant:
            self.stdout.write(self.style.ERROR('No tenant found!'))
            return

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
            self.stdout.write(self.style.SUCCESS(f'  Parent (Paul Essomba) password: {password}'))
        UserRoleMapping.objects.get_or_create(user=parent_user, tenant=tenant, role='parent')

        student = Student.objects.filter(tenant=tenant, first_name='John', last_name='Doe').first()
        if not student:
            student = Student.objects.filter(tenant=tenant).first()

        if student:
            ParentStudentRelationship.objects.get_or_create(
                parent_user=parent_user, student=student,
                defaults={'tenant': tenant, 'relationship_type': 'father'},
            )
            self.stdout.write(f'  Paul Essomba -> {student.first_name} {student.last_name}')
        self.reconnect()

    # ────────────────────────────────────────────────────────
    # SCHOOL 2: Greenfield International Academy
    # ────────────────────────────────────────────────────────
    def seed_greenfield(self):
        from apps.tenants.models import Tenant, TenantConfig
        from apps.authentication.models import User, UserRoleMapping
        from apps.academic.models import AcademicYear, Term, Sequence, Cycle, Section, Series, Class, Subject, ClassSubject
        from apps.students.models import Student, ParentStudentRelationship
        from apps.staff.models import Teacher, TeachingAssignment

        tenant, created = Tenant.objects.get_or_create(
            slug='greenfield-international',
            defaults={
                'school_name': 'Greenfield International Academy',
                'education_type': 'bilingual',
                'school_type': 'general',
                'session_type': 'morning',
                'region': 'Southwest',
                'division': 'Fako',
                'country': 'Cameroon',
                'address': 'Mile 15, Buea Road',
                'phone': '+237 233 322 111',
                'email': 'info@greenfield.edu.cm',
                'motto': 'Excellence Through Knowledge',
                'status': 'active',
                'subscription_plan': 'premium',
                'max_students': 800,
            },
        )
        if created:
            TenantConfig.objects.get_or_create(
                tenant=tenant, defaults={'currency_code': 'XAF', 'currency_symbol': 'XAF', 'default_language': 'en'},
            )
        self.reconnect()

        admin_user, created = User.objects.get_or_create(
            email='admin@greenfield.edu.cm',
            defaults={
                'username': 'admin_greenfield',
                'first_name': 'Grace', 'last_name': 'Mbih',
                'phone': '+237 677 111 222', 'default_language': 'en',
            },
        )
        if created:
            password = generate_secure_password()
            admin_user.set_password(password)
            admin_user.save()
            self.stdout.write(self.style.SUCCESS(f'  Greenfield admin password: {password}'))
        UserRoleMapping.objects.get_or_create(user=admin_user, tenant=tenant, role='admin', defaults={'assigned_by': admin_user})
        self.reconnect()

        teachers = []
        teacher_passwords = {}
        for email, first, last, phone, qual in [
            ('james.ashi@greenfield.edu.cm', 'James', 'Ashi', '+237 677 222 333', 'MSc Mathematics'),
            ('fatima.ngwa@greenfield.edu.cm', 'Fatima', 'Ngwa', '+237 677 333 444', 'BA English Literature'),
            ('pierre.tamba@greenfield.edu.cm', 'Pierre', 'Tamba', '+237 677 444 555', 'MSc Physics'),
        ]:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={'username': email.split('@')[0], 'first_name': first, 'last_name': last, 'phone': phone, 'default_language': 'en'},
            )
            if created:
                password = generate_secure_password()
                user.set_password(password)
                user.save()
                teacher_passwords[email] = password
            UserRoleMapping.objects.get_or_create(user=user, tenant=tenant, role='teacher', defaults={'assigned_by': admin_user})
            self.reconnect()
            profile, _ = Teacher.objects.get_or_create(
                user=user, tenant=tenant,
                defaults={'qualification': qual, 'employee_id': f'GIA-{first[0]}{last[:4]}'.upper()},
            )
            teachers.append({'user': user, 'profile': profile})
            self.reconnect()

        # Display teacher passwords
        for email, password in teacher_passwords.items():
            self.stdout.write(self.style.SUCCESS(f'  Teacher ({email}) password: {password}'))

        parent_user, created = User.objects.get_or_create(
            email='grace.foncha@greenfield.edu.cm',
            defaults={'username': 'grace_foncha', 'first_name': 'Grace', 'last_name': 'Foncha', 'phone': '+237 677 555 666', 'default_language': 'en'},
        )
        if created:
            password = generate_secure_password()
            parent_user.set_password(password)
            parent_user.save()
            self.stdout.write(self.style.SUCCESS(f'  Greenfield parent password: {password}'))
        UserRoleMapping.objects.get_or_create(user=parent_user, tenant=tenant, role='parent', defaults={'assigned_by': admin_user})
        self.reconnect()

        academic_year, _ = AcademicYear.objects.get_or_create(
            tenant=tenant, name='2025/2026',
            defaults={'start_date': date(2025, 9, 1), 'end_date': date(2026, 7, 15), 'is_active': True},
        )
        self.reconnect()

        for i, term_name in enumerate(['1st Term', '2nd Term', '3rd Term'], 1):
            term_obj, _ = Term.objects.get_or_create(
                academic_year=academic_year, order_number=i,
                defaults={'name': term_name, 'start_date': date(2025, 9, 1) + timedelta(days=90 * (i - 1)), 'end_date': date(2025, 9, 1) + timedelta(days=90 * i)},
            )
            for j in range(1, 3):
                Sequence.objects.get_or_create(term=term_obj, order_number=j, defaults={'name': f'Sequence {j}'})
        self.reconnect()

        cycle_1, _ = Cycle.objects.get_or_create(tenant=tenant, name='1st Cycle', defaults={'order': 1})
        cycle_2, _ = Cycle.objects.get_or_create(tenant=tenant, name='2nd Cycle', defaults={'order': 2})
        section_en, _ = Section.objects.get_or_create(tenant=tenant, name='anglophone', defaults={'language': 'en'})
        section_fr, _ = Section.objects.get_or_create(tenant=tenant, name='francophone', defaults={'language': 'fr'})
        self.reconnect()

        class_objects = {}
        for name, cycle, section, order in [
            ('Form 1', cycle_1, section_en, 1), ('Form 2', cycle_1, section_en, 2), ('Form 3', cycle_1, section_en, 3),
            ('6eme', cycle_1, section_fr, 1), ('5eme', cycle_1, section_fr, 2), ('4eme', cycle_1, section_fr, 3),
            ('Lower Sixth', cycle_2, section_en, 4), ('Upper Sixth', cycle_2, section_en, 5),
            ('Seconde', cycle_2, section_fr, 4), ('Premiere', cycle_2, section_fr, 5),
        ]:
            cls, _ = Class.objects.get_or_create(tenant=tenant, name=name, defaults={'cycle': cycle, 'stream': section, 'level_order': order})
            class_objects[name] = cls
        self.reconnect()

        subject_objects = {}
        for name, cycle, coeff, compulsory in [
            ('Mathematics', cycle_1, 3.0, True), ('English Language', cycle_1, 2.0, True),
            ('French Language', cycle_1, 2.0, True), ('Physics', cycle_2, 2.0, True),
            ('Chemistry', cycle_2, 2.0, True), ('Biology', cycle_2, 2.0, True),
            ('History', cycle_2, 1.5, True), ('Geography', cycle_2, 1.5, True),
            ('Philosophy', cycle_2, 1.5, True), ('Literature in English', cycle_2, 1.5, False),
            ('Further Mathematics', cycle_2, 2.0, False), ('Computer Science', cycle_1, 1.0, False),
            ('Civic Education', cycle_1, 1.0, True),
        ]:
            subj, _ = Subject.objects.get_or_create(tenant=tenant, name=name, defaults={'cycle': cycle, 'default_coefficient': coeff, 'is_compulsory': compulsory})
            subject_objects[name] = subj
        self.reconnect()

        for cls_name, cls_obj in class_objects.items():
            for subj_name, subj_obj in subject_objects.items():
                if subj_obj.cycle == cls_obj.cycle or subj_obj.cycle is None:
                    ClassSubject.objects.get_or_create(academic_class=cls_obj, subject=subj_obj)
        self.reconnect()

        for code, name, cycle, section in [
            ('A', 'Arts (Literature)', cycle_2, section_en), ('C', 'Sciences', cycle_2, section_en),
            ('D', 'Technical Sciences', cycle_2, section_en), ('A', 'Lettres', cycle_2, section_fr),
            ('C', 'Sciences', cycle_2, section_fr), ('D', 'Sciences Techniques', cycle_2, section_fr),
        ]:
            Series.objects.get_or_create(tenant=tenant, cycle=cycle, code=code, defaults={'name': name, 'stream': section})
        self.reconnect()

        for teacher_profile, subject_name, class_name in [
            (teachers[0]['profile'], 'Mathematics', 'Form 1'),
            (teachers[0]['profile'], 'Further Mathematics', 'Lower Sixth'),
            (teachers[1]['profile'], 'English Language', 'Form 1'),
            (teachers[1]['profile'], 'Literature in English', 'Lower Sixth'),
            (teachers[2]['profile'], 'Physics', 'Form 2'),
            (teachers[2]['profile'], 'Chemistry', 'Seconde'),
        ]:
            TeachingAssignment.objects.get_or_create(
                teacher=teacher_profile, subject=subject_objects[subject_name],
                academic_class=class_objects[class_name], academic_year=academic_year, tenant=tenant,
            )
        self.reconnect()

        created_students = []
        for first, last, gender, cls_name, dob in [
            ('Samuel', 'Eyong', 'M', 'Form 1', date(2012, 3, 15)),
            ('Blessing', 'Ambe', 'F', 'Form 1', date(2012, 7, 22)),
            ('Emmanuel', 'Tabi', 'M', 'Form 2', date(2011, 1, 10)),
            ('Naomi', 'Sama', 'F', 'Form 2', date(2011, 5, 8)),
            ('Destiny', 'Atem', 'F', 'Form 3', date(2010, 9, 30)),
            ('Kevin', 'Njoh', 'M', 'Lower Sixth', date(2009, 12, 1)),
            ('Celestin', 'Mbida', 'M', '6eme', date(2012, 2, 14)),
            ('Sandrine', 'Atanga', 'F', '5eme', date(2011, 8, 5)),
            ('Armel', 'Nkou', 'M', '4eme', date(2010, 4, 18)),
            ('Chantal', 'Bikoko', 'F', 'Seconde', date(2009, 11, 25)),
        ]:
            student, _ = Student.objects.get_or_create(
                tenant=tenant, first_name=first, last_name=last,
                defaults={'gender': gender, 'date_of_birth': dob, 'current_class': class_objects[cls_name], 'status': 'active'},
            )
            created_students.append(student)
        self.reconnect()

        paul_essomba = User.objects.get(email='parent@saintjoseph.sos')
        ParentStudentRelationship.objects.get_or_create(
            parent_user=paul_essomba, student=created_students[0],
            defaults={'tenant': tenant, 'relationship_type': 'guardian'},
        )
        ParentStudentRelationship.objects.get_or_create(
            parent_user=paul_essomba, student=created_students[1],
            defaults={'tenant': tenant, 'relationship_type': 'father'},
        )
        self.reconnect()

        for student, rel_type in [(created_students[5], 'mother'), (created_students[6], 'mother')]:
            ParentStudentRelationship.objects.get_or_create(
                parent_user=parent_user, student=student,
                defaults={'tenant': tenant, 'relationship_type': rel_type},
            )

        self.stdout.write(self.style.SUCCESS(f'  Greenfield: {Student.objects.filter(tenant=tenant).count()} students'))
