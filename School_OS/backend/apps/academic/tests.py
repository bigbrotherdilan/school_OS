"""
Academic API tests — pair-subjects endpoint (option streams).
"""
from rest_framework.test import APITestCase

from apps.timetable.models import StudentGroup
from apps.timetable.tests.base import (
    make_tenant, make_user, make_section, make_class, make_subject, make_class_subject,
)


class TestPairSubjects(APITestCase):
    def setUp(self):
        self.tenant = make_tenant()
        self.user = make_user(is_platform_admin=True)
        self.client.force_authenticate(user=self.user)
        section = make_section(self.tenant)
        self.cls = make_class(self.tenant, section, 'Form 5', level_order=5)
        self.history = make_subject(self.tenant, 'History', '235')
        self.chemistry = make_subject(self.tenant, 'Chemistry', '523')
        self.cs_a = make_class_subject(self.cls, self.history, 12)
        self.cs_b = make_class_subject(self.cls, self.chemistry, 12)

    def _pair(self, cs_a=None, cs_b=None):
        url = '/api/v1/academic/class-subjects/pair/'
        return self.client.post(
            url,
            {
                'academic_class': str(self.cls.id),
                'cs_a': str(cs_a or self.cs_a.id),
                'cs_b': str(cs_b or self.cs_b.id),
            },
            format='json',
            **{'HTTP_X_TENANT_ID': str(self.tenant.id)},
        )

    def test_pair_creates_two_streams_and_splits_subjects(self):
        resp = self._pair()
        self.assertEqual(resp.status_code, 200, resp.content)
        self.cs_a.refresh_from_db()
        self.cs_b.refresh_from_db()
        self.assertIsNotNone(self.cs_a.student_group)
        self.assertIsNotNone(self.cs_b.student_group)
        self.assertNotEqual(self.cs_a.student_group_id, self.cs_b.student_group_id)
        self.assertEqual(StudentGroup.objects.filter(academic_class=self.cls).count(), 2)
        self.assertEqual(len(resp.data['streams']), 2)
        self.assertEqual(len(resp.data['class_subjects']), 2)
        self.assertTrue(resp.data['message'])

    def test_pair_reuses_streams_created_in_setup(self):
        science = StudentGroup.objects.create(
            tenant=self.tenant, academic_class=self.cls, name='Science'
        )
        arts = StudentGroup.objects.create(
            tenant=self.tenant, academic_class=self.cls, name='Arts'
        )
        resp = self._pair()
        self.assertEqual(resp.status_code, 200, resp.content)
        # No extra streams are created when the class already has them.
        self.assertEqual(StudentGroup.objects.filter(academic_class=self.cls).count(), 2)
        self.cs_a.refresh_from_db()
        self.cs_b.refresh_from_db()
        self.assertNotEqual(self.cs_a.student_group_id, self.cs_b.student_group_id)
        self.assertIn(self.cs_a.student_group_id, {science.id, arts.id})
        self.assertIn(self.cs_b.student_group_id, {science.id, arts.id})

    def test_pairing_again_is_a_noop(self):
        self._pair()
        count_after_first = StudentGroup.objects.filter(academic_class=self.cls).count()
        resp2 = self._pair()
        self.assertEqual(resp2.status_code, 200, resp2.content)
        self.assertEqual(
            StudentGroup.objects.filter(academic_class=self.cls).count(), count_after_first
        )

    def test_pair_requires_both_subjects_in_the_class(self):
        other_section = make_section(self.tenant, 'Francophone')
        other_cls = make_class(self.tenant, other_section, 'Form 1')
        other_subject = make_subject(self.tenant, 'Other', '999')
        other_cs = make_class_subject(other_cls, other_subject, 4)
        resp = self._pair(cs_b=other_cs.id)
        self.assertEqual(resp.status_code, 400, resp.content)

    def test_pair_requires_two_different_subjects(self):
        resp = self._pair(cs_a=self.cs_a.id, cs_b=self.cs_a.id)
        self.assertEqual(resp.status_code, 400, resp.content)
