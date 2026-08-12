"""
Student Utilities — School OS

Admission number scheme (confirmed 2026-08-11):
    {SCHOOL-INITIALS}-{YEAR}-{SECTION}-{SEQ}
e.g. SJCS-2026-ANG-0001

- SCHOOL-INITIALS: derived from the tenant's school_name so every school gets
  a distinct prefix (max 4 chars, uppercase).
- YEAR: enrolment year.
- SECTION: short code for the student's stream (ANG / FRANCO / TECH / COM / GEN).
- SEQ: per (tenant, year, section), zero-padded to 4 digits.
"""
import re

from django.utils import timezone

SECTION_CODES = {
    'anglophone': 'ANG',
    'francophone': 'FRANCO',
    'technical': 'TECH',
    'commercial': 'COM',
    'general': 'GEN',
    'vocational': 'VOC',
    'bilingual': 'BI',
}

_STOPWORDS = {
    'of', 'the', 'and', 'for', 'de', 'le', 'la', 'du', 'des', 'aux',
    'college', 'collège', 'school', 'secondary', 'high', 'bilingual',
    'grammar', 'academy', 'academie', 'institute', 'institut', 'centre',
    'center', 'international', 'lycee', 'lycée',
}


def school_initials(school_name):
    """Short uppercase code from a school name, unique per school in practice."""
    words = re.findall(r"[A-Za-zÀ-ÿ]+", school_name or '')
    significant = [w for w in words if w.lower() not in _STOPWORDS]
    if significant:
        initials = ''.join(w[0] for w in significant).upper()
    elif words:
        initials = words[0][:3].upper()
    else:
        initials = 'SOS'
    return initials[:4]


def section_code(section):
    """Short code for a student's stream (Section)."""
    if not section:
        return 'GEN'
    name = section.name.lower()
    for key, code in SECTION_CODES.items():
        if key in name:
            return code
    letters = re.findall(r"[A-Za-zÀ-ÿ]+", section.name)
    if not letters:
        return 'GEN'
    return ''.join(l[0] for l in letters)[:4].upper()


def generate_admission_number(student, year=None):
    """
    Build the next admission number for a student.

    `year` is the enrolment year; defaults to the student's enrolled_date,
    falling back to the current year for brand-new (not yet saved) records.
    Sequential within (tenant, year, section) so numbers are stable and readable.
    """
    from apps.students.models import Student

    if year is None:
        year = (student.enrolled_date.year if student.enrolled_date
                else timezone.now().year)

    initials = school_initials(student.tenant.school_name) if student.tenant_id else 'SOS'
    sec = section_code(student.stream)

    base_qs = Student.objects.filter(
        tenant_id=student.tenant_id,
        enrolled_date__year=year,
    )
    if student.stream_id:
        base_qs = base_qs.filter(stream_id=student.stream_id)
    else:
        base_qs = base_qs.filter(stream__isnull=True)

    seq = base_qs.exclude(pk=student.pk).count() + 1

    while True:
        number = f"{initials}-{year}-{sec}-{seq:04d}"
        collision = Student.objects.filter(admission_number=number).exclude(pk=student.pk).exists()
        if not collision:
            return number
        seq += 1
