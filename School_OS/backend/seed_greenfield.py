# type: ignore
"""
Seed script for Second School - Greenfield International Academy
Creates a complete second school with admin, teachers, 10 students, classes, etc.
Also links 2 students from this school to the existing parent (Paul Essomba).
"""
import os
import sys
import django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.authentication.models import User, UserRoleMapping
from apps.tenants.models import Tenant, TenantConfig
from apps.students.models import Student, ParentStudentRelationship
from apps.staff.models import Teacher, TeachingAssignment
from apps.academic.models import (
    AcademicYear, Term, Sequence, Cycle, Section, Series,
    Class, Subject, ClassSubject
)

# ============================================================
# 1. TENANT - Greenfield International Academy
# ============================================================
print("Creating tenant...")
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
    }
)
if created:
    TenantConfig.objects.create(
        tenant=tenant,
        currency_code='XAF',
        currency_symbol='XAF',
        default_language='en',
    )
    print(f"  Created: {tenant.school_name}")
else:
    print(f"  Already exists: {tenant.school_name}")

# ============================================================
# 2. USERS - Admin, Teachers
# ============================================================
print("\nCreating users...")

# Admin for Greenfield
admin_user, created = User.objects.get_or_create(
    email='admin@greenfield.edu.cm',
    defaults={
        'username': 'admin_greenfield',
        'first_name': 'Grace',
        'last_name': 'Mbih',
        'phone': '+237 677 111 222',
        'default_language': 'en',
    }
)
admin_password = 'admin123456'
if created or not admin_user.check_password(admin_password):
    admin_user.set_password(admin_password)
    admin_user.save()
    print(f"  Admin: {admin_user.email} / {admin_password}")
UserRoleMapping.objects.get_or_create(
    user=admin_user, tenant=tenant, role='admin',
    defaults={'assigned_by': admin_user}
)

# Teachers for Greenfield
teacher_data = [
    {
        'email': 'james.ashi@greenfield.edu.cm',
        'first_name': 'James',
        'last_name': 'Ashi',
        'phone': '+237 677 222 333',
        'qualification': 'MSc Mathematics',
        'subjects': ['Mathematics', 'Further Mathematics'],
    },
    {
        'email': 'fatima.ngwa@greenfield.edu.cm',
        'first_name': 'Fatima',
        'last_name': 'Ngwa',
        'phone': '+237 677 333 444',
        'qualification': 'BA English Literature',
        'subjects': ['English Language', 'Literature in English'],
    },
    {
        'email': 'pierre.tamba@greenfield.edu.cm',
        'first_name': 'Pierre',
        'last_name': 'Tamba',
        'phone': '+237 677 444 555',
        'qualification': 'MSc Physics',
        'subjects': ['Physics', 'Chemistry'],
    },
]

teachers = []
teacher_passwords = {}
for td in teacher_data:
    user, created = User.objects.get_or_create(
        email=td['email'],
        defaults={
            'username': str(td['email']).split('@')[0],
            'first_name': td['first_name'],
            'last_name': td['last_name'],
            'phone': td['phone'],
            'default_language': 'en',
        }
    )
    password = 'teacher123'
    if created or not user.check_password(password):
        user.set_password(password)
        user.save()
    teacher_passwords[td['email']] = password
    UserRoleMapping.objects.get_or_create(
        user=user, tenant=tenant, role='teacher',
        defaults={'assigned_by': admin_user}
    )
    # Create teacher profile
    teacher_profile, created = Teacher.objects.get_or_create(
        user=user, tenant=tenant,
        defaults={'qualification': td['qualification'], 'employee_id': f'GIA-{td["first_name"][0]}{td["last_name"][:4]}'.upper()}
    )
    teachers.append({'user': user, 'profile': teacher_profile, 'subjects': td['subjects']})
    print(f"  Teacher: {user.email} / {teacher_passwords[td['email']]}")

# Parent for Greenfield (new parent, not Paul Essomba)
parent_user, created = User.objects.get_or_create(
    email='grace.foncha@greenfield.edu.cm',
    defaults={
        'username': 'grace_foncha',
        'first_name': 'Grace',
        'last_name': 'Foncha',
        'phone': '+237 677 555 666',
        'default_language': 'en',
    }
)
parent_password = 'parent123456'
if created or not parent_user.check_password(parent_password):
    parent_user.set_password(parent_password)
    parent_user.save()
    print(f"  Parent: {parent_user.email} / {parent_password}")
UserRoleMapping.objects.get_or_create(
    user=parent_user, tenant=tenant, role='parent',
    defaults={'assigned_by': admin_user}
)

# ============================================================
# 3. ACADEMIC STRUCTURE
# ============================================================
print("\nCreating academic structure...")

# Academic Year
academic_year, _ = AcademicYear.objects.get_or_create(
    tenant=tenant,
    name='2025/2026',
    defaults={
        'start_date': date(2025, 9, 1),
        'end_date': date(2026, 7, 15),
        'is_active': True,
    }
)

# Terms
for i, term_name in enumerate(['1st Term', '2nd Term', '3rd Term'], 1):
    Term.objects.get_or_create(
        academic_year=academic_year,
        order_number=i,
        defaults={
            'name': term_name,
            'start_date': date(2025, 9, 1) + timedelta(days=90 * (i - 1)),
            'end_date': date(2025, 9, 1) + timedelta(days=90 * i),
        }
    )

# Sequences (2 per term)
for term in Term.objects.filter(academic_year=academic_year):
    for j in range(1, 3):
        Sequence.objects.get_or_create(
            term=term,
            order_number=j,
            defaults={'name': f'Sequence {j}'}
        )

print(f"  Academic Year: {academic_year.name}")

# Cycles
cycle_1, _ = Cycle.objects.get_or_create(
    tenant=tenant, name='1st Cycle', defaults={'order': 1}
)
cycle_2, _ = Cycle.objects.get_or_create(
    tenant=tenant, name='2nd Cycle', defaults={'order': 2}
)

# Sections (for bilingual)
section_en, _ = Section.objects.get_or_create(
    tenant=tenant, name='Grammar', defaults={'language': 'en'}
)
section_fr, _ = Section.objects.get_or_create(
    tenant=tenant, name='francophone', defaults={'language': 'fr'}
)

# Classes
classes_data = [
    ('Form 1', cycle_1, section_en, 1),
    ('Form 2', cycle_1, section_en, 2),
    ('Form 3', cycle_1, section_en, 3),
    ('6ème', cycle_1, section_fr, 1),
    ('5ème', cycle_1, section_fr, 2),
    ('4ème', cycle_1, section_fr, 3),
    ('Lower Sixth', cycle_2, section_en, 4),
    ('Upper Sixth', cycle_2, section_en, 5),
    ('Seconde', cycle_2, section_fr, 4),
    ('Première', cycle_2, section_fr, 5),
]

class_objects = {}
for name, cycle, section, order in classes_data:
    cls, _ = Class.objects.get_or_create(
        tenant=tenant, name=name,
        defaults={'cycle': cycle, 'stream': section, 'level_order': order}
    )
    class_objects[name] = cls

print(f"  Classes: {len(class_objects)}")

# Subjects
subjects_data = [
    ('Mathematics', cycle_1, 3.0, True),
    ('English Language', cycle_1, 2.0, True),
    ('French Language', cycle_1, 2.0, True),
    ('Physics', cycle_2, 2.0, True),
    ('Chemistry', cycle_2, 2.0, True),
    ('Biology', cycle_2, 2.0, True),
    ('History', cycle_2, 1.5, True),
    ('Geography', cycle_2, 1.5, True),
    ('Philosophy', cycle_2, 1.5, True),
    ('Literature in English', cycle_2, 1.5, False),
    ('Further Mathematics', cycle_2, 2.0, False),
    ('Computer Science', cycle_1, 1.0, False),
    ('Civic Education', cycle_1, 1.0, True),
]

subject_objects = {}
for name, cycle, coeff, compulsory in subjects_data:
    subj, _ = Subject.objects.get_or_create(
        tenant=tenant, name=name,
        defaults={'cycle': cycle, 'language': 'en', 'default_coefficient': coeff, 'is_compulsory': compulsory}
    )
    subject_objects[name] = subj

print(f"  Subjects: {len(subject_objects)}")

# Link subjects to classes (ClassSubject)
for cls_name, cls_obj in class_objects.items():
    for subj_name, subj_obj in subject_objects.items():
        if subj_obj.cycle == cls_obj.cycle or subj_obj.cycle is None:
            ClassSubject.objects.get_or_create(
                academic_class=cls_obj, subject=subj_obj
            )

# Series for 2nd Cycle
series_data = [
    ('A', 'Arts (Literature)', cycle_2, section_en),
    ('C', 'Sciences', cycle_2, section_en),
    ('D', 'Technical Sciences', cycle_2, section_en),
    ('A', 'Lettres', cycle_2, section_fr),
    ('C', 'Sciences', cycle_2, section_fr),
    ('D', 'Sciences Techniques', cycle_2, section_fr),
]
for code, name, cycle, section in series_data:
    Series.objects.get_or_create(
        tenant=tenant, cycle=cycle, code=code,
        defaults={'name': name, 'stream': section}
    )

# ============================================================
# 4. TEACHING ASSIGNMENTS
# ============================================================
print("\nCreating teaching assignments...")
assignment_pairs = [
    (teachers[0]['profile'], 'Mathematics', 'Form 1'),
    (teachers[0]['profile'], 'Further Mathematics', 'Lower Sixth'),
    (teachers[1]['profile'], 'English Language', 'Form 1'),
    (teachers[1]['profile'], 'Literature in English', 'Lower Sixth'),
    (teachers[2]['profile'], 'Physics', 'Form 2'),
    (teachers[2]['profile'], 'Chemistry', 'Seconde'),
]
for teacher_profile, subject_name, class_name in assignment_pairs:
    TeachingAssignment.objects.get_or_create(
        teacher=teacher_profile,
        subject=subject_objects[subject_name],
        academic_class=class_objects[class_name],
        academic_year=academic_year,
        tenant=tenant,
    )
print(f"  Assignments: {len(assignment_pairs)}")

# ============================================================
# 5. STUDENTS - 10 students
# ============================================================
print("\nCreating students...")
students_data = [
    # Anglophone students
    {'first_name': 'Samuel', 'last_name': 'Eyong', 'gender': 'M', 'class': 'Form 1', 'dob': date(2012, 3, 15)},
    {'first_name': 'Blessing', 'last_name': 'Ambe', 'gender': 'F', 'class': 'Form 1', 'dob': date(2012, 7, 22)},
    {'first_name': 'Emmanuel', 'last_name': 'Tabi', 'gender': 'M', 'class': 'Form 2', 'dob': date(2011, 1, 10)},
    {'first_name': 'Naomi', 'last_name': 'Sama', 'gender': 'F', 'class': 'Form 2', 'dob': date(2011, 5, 8)},
    {'first_name': 'Destiny', 'last_name': 'Atem', 'gender': 'F', 'class': 'Form 3', 'dob': date(2010, 9, 30)},
    {'first_name': 'Kevin', 'last_name': 'Njoh', 'gender': 'M', 'class': 'Lower Sixth', 'dob': date(2009, 12, 1)},
    # Francophone students
    {'first_name': 'Celestin', 'last_name': 'Mbida', 'gender': 'M', 'class': '6ème', 'dob': date(2012, 2, 14)},
    {'first_name': 'Sandrine', 'last_name': 'Atanga', 'gender': 'F', 'class': '5ème', 'dob': date(2011, 8, 5)},
    {'first_name': 'Armel', 'last_name': 'Nkou', 'gender': 'M', 'class': '4ème', 'dob': date(2010, 4, 18)},
    {'first_name': 'Chantal', 'last_name': 'Bikoko', 'gender': 'F', 'class': 'Seconde', 'dob': date(2009, 11, 25)},
]

created_students = []
for sd in students_data:
    student, created = Student.objects.get_or_create(
        tenant=tenant,
        first_name=sd['first_name'],
        last_name=sd['last_name'],
        defaults={
            'gender': sd['gender'],
            'date_of_birth': sd['dob'],
            'current_class': class_objects[sd['class']],
            'status': 'active',
        }
    )
    created_students.append(student)
    status = 'CREATED' if created else 'EXISTS'
    print(f"  [{status}] {student.first_name} {student.last_name} -> {sd['class']}")

# ============================================================
# 6. LINK 2 STUDENTS TO EXISTING PARENT (Paul Essomba)
#    So Paul Essomba has 3 children: 1 from St Joseph + 2 from Greenfield
# ============================================================
print("\nLinking 2 students to existing parent (Paul Essomba)...")

paul_essomba = User.objects.get(email='parent@saintjoseph.sos')
student_to_link_1 = created_students[0]  # Samuel Eyong
student_to_link_2 = created_students[1]  # Blessing Ambe

link1, created = ParentStudentRelationship.objects.get_or_create(
    parent_user=paul_essomba,
    student=student_to_link_1,
    defaults={'tenant': tenant, 'relationship_type': 'guardian'}
)
print(f"  Linked: {student_to_link_1.first_name} {student_to_link_1.last_name} -> Paul Essomba ({'NEW' if created else 'EXISTS'})")

link2, created = ParentStudentRelationship.objects.get_or_create(
    parent_user=paul_essomba,
    student=student_to_link_2,
    defaults={'tenant': tenant, 'relationship_type': 'father'}
)
print(f"  Linked: {student_to_link_2.first_name} {student_to_link_2.last_name} -> Paul Essomba ({'NEW' if created else 'EXISTS'})")

# Also link Greenfield parent to her own children
parent_child_links = [
    (parent_user, created_students[5], 'mother'),  # Kevin Njoh
    (parent_user, created_students[6], 'mother'),  # Celestin Mbida
]
for parent, student, rel_type in parent_child_links:
    link, created = ParentStudentRelationship.objects.get_or_create(
        parent_user=parent,
        student=student,
        defaults={'tenant': tenant, 'relationship_type': rel_type}
    )
    print(f"  Linked: {student.first_name} {student.last_name} -> {parent.email} ({rel_type}, {'NEW' if created else 'EXISTS'})")

# ============================================================
# SUMMARY
# ============================================================
print("\n" + "=" * 60)
print("SEED COMPLETE!")
print("=" * 60)
print(f"\nSchool 1: Saint Joseph Bilingual Academy")
print(f"  Admin:    admin@saintjoseph.sos / admin123456")
print(f"  Teachers: dr.song@saintjoseph.sos, mme.biya@saintjoseph.sos, dr.thorne@saintjoseph.sos / teacher123")
print(f"  Parent:   parent@saintjoseph.sos / parent123456")
print(f"\nSchool 2: Greenfield International Academy")
print(f"  Admin:    admin@greenfield.edu.cm / admin123456")
print(f"  Teachers: james.ashi@greenfield.edu.cm, fatima.ngwa@greenfield.edu.cm, pierre.tamba@greenfield.edu.cm / teacher123")
print(f"  Parent:   grace.foncha@greenfield.edu.cm / parent123456")
print(f"\nParent Paul Essomba's children:")
print(f"  1. John Doe (St Joseph Bilingual Academy - Form 1)")
print(f"  2. Samuel Eyong (Greenfield International Academy - Form 1) [guardian]")
print(f"  3. Blessing Ambe (Greenfield International Academy - Form 1) [father]")
