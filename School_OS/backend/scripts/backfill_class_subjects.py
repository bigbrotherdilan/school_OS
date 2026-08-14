"""
Backfill ClassSubject links: propagate each section's subjects to all of its
classes (cycle-aware). Idempotent: get_or_create keeps existing links.
"""
import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.academic.models import Section, ClassSubject, SectionSubject, Class


def link_section_subjects_to_class(section, cls_obj):
    count = 0
    for ss in SectionSubject.objects.filter(section=section).select_related('subject', 'subject__cycle'):
        subject = ss.subject
        if subject.cycle_id and cls_obj.cycle_id and subject.cycle_id != cls_obj.cycle_id:
            continue
        _, created = ClassSubject.objects.get_or_create(
            academic_class=cls_obj,
            subject=subject,
            series=None,
            defaults={'coefficient': ss.coefficient, 'weekly_hours': 0},
        )
        if created:
            count += 1
    return count


total = 0
for section in Section.objects.all():
    section_total = 0
    for cls_obj in Class.objects.filter(tenant_id=section.tenant_id, stream=section):
        section_total += link_section_subjects_to_class(section, cls_obj)
    if section_total:
        print(f"{section.tenant_id} | {section.name}: +{section_total} links")
        total += section_total

print(f"DONE. Total new ClassSubject links: {total}")
