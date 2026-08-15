"""
Staff serializer regression tests — assignment creation.

A TeachingAssignment must be creatable without `series` / `student_group`
(NULL = whole cohort / no series). Both fields are part of the model's
`unique_together`, which DRF's auto uniqueness handling would otherwise
force to `required=True` (Saint Joseph onboarding regression).
"""
from django.test import TestCase

from apps.staff.serializers import TeachingAssignmentSerializer
from apps.academic.serializers import ClassSubjectSerializer

from apps.timetable.tests.base import (
    make_tenant, make_teacher, make_year, make_class, make_section,
    make_subject, make_class_subject,
)


class TeachingAssignmentCreationTests(TestCase):
    def setUp(self):
        self.tenant = make_tenant()
        self.year = make_year(self.tenant)
        self.section = make_section(self.tenant)
        self.cls = make_class(self.tenant, self.section, 'Lower Sixth')
        self.subject = make_subject(self.tenant, 'Mathematics', '570')
        self.teacher = make_teacher(self.tenant)
        self.other = make_teacher(self.tenant)
        self.base = {
            'teacher': self.teacher.id,
            'subject': self.subject.id,
            'academic_class': self.cls.id,
            'academic_year': self.year.id,
        }

    def test_assignment_without_series_or_group_is_valid(self):
        serializer = TeachingAssignmentSerializer(data=self.base)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_exact_duplicate_assignment_is_rejected(self):
        first = TeachingAssignmentSerializer(data=self.base)
        self.assertTrue(first.is_valid(), first.errors)
        first.save()
        dup = TeachingAssignmentSerializer(data=self.base)
        self.assertFalse(dup.is_valid())
        self.assertIn('non_field_errors', dup.errors)

    def test_same_teacher_other_subject_is_valid(self):
        first = TeachingAssignmentSerializer(data=self.base)
        self.assertTrue(first.is_valid(), first.errors)
        first.save()
        other_subject = make_subject(self.tenant, 'Physics', '522')
        ok = TeachingAssignmentSerializer(data={
            **self.base, 'subject': other_subject.id,
        })
        self.assertTrue(ok.is_valid(), ok.errors)

    def test_second_teacher_same_subject_class_is_valid(self):
        """Two Maths teachers in one class = the 4+4 split scenario."""
        first = TeachingAssignmentSerializer(data=self.base)
        self.assertTrue(first.is_valid(), first.errors)
        first.save()
        second = TeachingAssignmentSerializer(data={
            **self.base, 'teacher': self.other.id,
        })
        self.assertTrue(second.is_valid(), second.errors)

    def test_explicit_group_teacher_plus_cohort_teacher_is_valid(self):
        first = TeachingAssignmentSerializer(data=self.base)
        self.assertTrue(first.is_valid(), first.errors)
        first.save()
        group = __import__('apps.timetable.models', fromlist=['StudentGroup'])
        group = group.StudentGroup.objects.create(
            tenant=self.tenant, academic_class=self.cls, name='Arts'
        )
        grouped = TeachingAssignmentSerializer(data={
            **self.base, 'teacher': self.other.id, 'student_group': group.id,
        })
        self.assertTrue(grouped.is_valid(), grouped.errors)


class ClassSubjectCreationTests(TestCase):
    def test_class_subject_without_series_or_group_is_valid(self):
        tenant = make_tenant()
        section = make_section(tenant)
        cls = make_class(tenant, section, 'Form 1')
        subject = make_subject(tenant, 'Mathematics', '570')
        serializer = ClassSubjectSerializer(data={
            'academic_class': cls.id,
            'subject': subject.id,
            'weekly_hours': 4,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_exact_duplicate_class_subject_is_rejected(self):
        tenant = make_tenant()
        section = make_section(tenant)
        cls = make_class(tenant, section, 'Form 1')
        subject = make_subject(tenant, 'Mathematics', '570')
        payload = {'academic_class': cls.id, 'subject': subject.id, 'weekly_hours': 4}
        first = ClassSubjectSerializer(data=payload)
        self.assertTrue(first.is_valid(), first.errors)
        first.save()
        dup = ClassSubjectSerializer(data=payload)
        self.assertFalse(dup.is_valid())
