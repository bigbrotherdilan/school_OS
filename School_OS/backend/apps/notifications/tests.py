from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.authentication.models import UserRoleMapping
from apps.notifications.models import Announcement, DirectMessage
from apps.tenants.models import Tenant


class AnnouncementViewSetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(
            school_name='Test School',
            slug='test-school',
            status='active',
        )
        self.user = get_user_model().objects.create_user(
            username='admin-user',
            email='admin@example.com',
            password='strong-pass-123',
            first_name='Admin',
            last_name='User',
        )
        UserRoleMapping.objects.create(
            user=self.user,
            tenant=self.tenant,
            role=UserRoleMapping.Role.ADMIN,
            is_active=True,
        )
        self.client.force_authenticate(self.user)

    def test_admin_can_create_announcement(self):
        response = self.client.post(
            '/api/v1/notifications/announcements/',
            data={
                'title': 'School update',
                'body': 'The school will be closed tomorrow.',
                'audience': 'all',
                'is_urgent': False,
                'published': True,
            },
            format='json',
            HTTP_X_Tenant_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Announcement.objects.count(), 1)
        announcement = Announcement.objects.get()
        self.assertEqual(announcement.tenant, self.tenant)
        self.assertEqual(announcement.created_by, self.user)
        self.assertEqual(announcement.title, 'School update')

    def test_teacher_sees_general_and_teacher_announcements(self):
        teacher = get_user_model().objects.create_user(
            username='teacher-user',
            email='teacher@example.com',
            password='strong-pass-123',
            first_name='Teacher',
            last_name='User',
        )
        UserRoleMapping.objects.create(
            user=teacher,
            tenant=self.tenant,
            role=UserRoleMapping.Role.TEACHER,
            is_active=True,
        )

        Announcement.objects.create(
            tenant=self.tenant,
            title='All school update',
            body='Everyone should see this.',
            audience=Announcement.AudienceType.ALL,
            published=True,
            created_by=self.user,
        )
        Announcement.objects.create(
            tenant=self.tenant,
            title='Teachers only',
            body='Only teachers should see this.',
            audience=Announcement.AudienceType.TEACHERS,
            published=True,
            created_by=self.user,
        )

        teacher_client = APIClient()
        teacher_client.force_authenticate(teacher)
        response = teacher_client.get(
            '/api/v1/notifications/announcements/?audience=teachers',
            HTTP_X_Tenant_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.data.get('results', response.data)
        self.assertEqual(len(payload), 2)

    def test_admin_can_send_direct_message(self):
        recipient = get_user_model().objects.create_user(
            username='recipient-user',
            email='recipient@example.com',
            password='strong-pass-123',
            first_name='Recipient',
            last_name='User',
        )

        response = self.client.post(
            '/api/v1/notifications/messages/',
            data={
                'recipient': str(recipient.id),
                'subject': 'Quick update',
                'body': 'Hello there',
            },
            format='json',
            HTTP_X_Tenant_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(DirectMessage.objects.count(), 1)
        message = DirectMessage.objects.get()
        self.assertEqual(message.tenant, self.tenant)
        self.assertEqual(message.sender, self.user)
        self.assertEqual(message.recipient, recipient)
