from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.core.mail import send_mail
from django.conf import settings
from .models import Announcement, AnnouncementRead, DirectMessage, EmailSetting, Notification
from .serializers import AnnouncementSerializer, DirectMessageSerializer, EmailSettingSerializer, TestEmailSerializer, NotificationSerializer
from apps.authentication.permissions import IsSchoolMember, IsSchoolAdmin


class NotificationViewSet(viewsets.ModelViewSet):
    """
    Per-user notifications with server-side read tracking.
    GET    /notifications/notifications/?unread=true   — my notifications
    GET    /notifications/notifications/unread-count/  — unread count for badge
    PATCH  /notifications/notifications/{id}/          — { "is_read": true }
    POST   /notifications/notifications/mark-all-read/ — mark everything read
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]
    http_method_names = ['get', 'patch', 'post', 'head', 'options']

    def get_queryset(self):
        qs = Notification.objects.filter(
            tenant_id=self.request.tenant_id,
            recipient=self.request.user,
        ).order_by('-created_at')
        if self.request.query_params.get('unread') in ('true', '1'):
            qs = qs.filter(is_read=False)
        limit = self.request.query_params.get('limit')
        if limit and limit.isdigit():
            qs = qs[: min(int(limit), 100)]
        return qs

    def partial_update(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'detail': 'Notification marked as read.'})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        Notification.objects.filter(
            tenant_id=request.tenant_id,
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)
        return Response({'detail': 'All notifications marked as read.'})

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = Notification.objects.filter(
            tenant_id=request.tenant_id,
            recipient=request.user,
            is_read=False,
        ).count()
        return Response({'count': count})


class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        # Only school admins may create/edit/delete announcements;
        # everyone else reads (audience-filtered) only.
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsSchoolAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(
            tenant_id=self.request.tenant_id,
            created_by=self.request.user,
        )

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        user = self.request.user
        qs = Announcement.objects.filter(tenant_id=tenant_id)

        # Only published announcements in the bell / feed
        published = self.request.query_params.get('published')
        if published in ('true', '1'):
            qs = qs.filter(published=True)

        # If not admin/super_admin, filter by audience matching user's role
        user_roles = set(user.get_roles_for_tenant(tenant_id))
        is_admin = user_roles & {'admin', 'super_admin'}

        if not is_admin:
            audience_q = Q(audience=Announcement.AudienceType.ALL)
            if 'parent' in user_roles:
                audience_q |= Q(audience=Announcement.AudienceType.PARENTS)
            if 'teacher' in user_roles:
                audience_q |= Q(audience=Announcement.AudienceType.TEACHERS)
            if 'student' in user_roles:
                audience_q |= Q(audience=Announcement.AudienceType.STUDENTS)
            qs = qs.filter(audience_q)

        audience_filter = self.request.query_params.get('audience')
        if audience_filter:
            if is_admin:
                qs = qs.filter(audience=audience_filter)
            else:
                role_audience = None
                if 'parent' in user_roles:
                    role_audience = Announcement.AudienceType.PARENTS
                elif 'teacher' in user_roles:
                    role_audience = Announcement.AudienceType.TEACHERS
                elif 'student' in user_roles:
                    role_audience = Announcement.AudienceType.STUDENTS

                if audience_filter in {Announcement.AudienceType.ALL, role_audience}:
                    qs = qs.filter(Q(audience=Announcement.AudienceType.ALL) | Q(audience=audience_filter))
                else:
                    qs = qs.none()

        # Unread-only view for the bell badge
        if self.request.query_params.get('unread') in ('true', '1'):
            qs = qs.exclude(reads__user=user)

        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """
        POST /notifications/announcements/mark-all-read/
        Marks all announcements visible to this user as read (server-side).
        """
        tenant_id = request.tenant_id
        user = request.user
        qs = self.get_queryset()
        AnnouncementRead.objects.bulk_create(
            [
                AnnouncementRead(tenant_id=tenant_id, user=user, announcement=a)
                for a in qs
            ],
            ignore_conflicts=True,
        )
        return Response({'detail': 'All announcements marked as read.'})

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = self.get_queryset().filter(
            published=True,
        ).exclude(reads__user=request.user).count()
        return Response({'count': count})


class DirectMessageViewSet(viewsets.ModelViewSet):
    serializer_class = DirectMessageSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def perform_create(self, serializer):
        serializer.save(
            tenant_id=self.request.tenant_id,
            sender=self.request.user,
        )

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = DirectMessage.objects.filter(
            tenant_id=tenant_id
        ).filter(
            Q(sender=self.request.user) | Q(recipient=self.request.user)
        )
        if self.request.query_params.get('unread') in ('true', '1'):
            qs = qs.filter(recipient=self.request.user, is_read=False)
        return qs

    def perform_create(self, serializer):
        # Never trust the client for the sender or the tenant; the recipient
        # must belong to the same school, or the message would cross tenant
        # boundaries.
        from apps.authentication.models import UserRoleMapping
        recipient = serializer.validated_data.get('recipient')
        in_tenant = UserRoleMapping.objects.filter(
            user=recipient, tenant_id=self.request.tenant_id, is_active=True,
        ).exists() if recipient else False
        if not in_tenant:
            raise serializers.ValidationError({'recipient': 'Recipient must belong to this school.'})
        serializer.save(sender=self.request.user, tenant_id=self.request.tenant_id)

    def update(self, request, *args, **kwargs):
        # Messages are immutable content-wise; only the read flag may change.
        if 'is_read' not in (request.data or {}):
            return Response(
                {'detail': 'Only is_read may be updated on a message.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message = self.get_object()
        message.is_read = True
        message.save(update_fields=['is_read'])
        return Response(DirectMessageSerializer(message, context=self.get_serializer_context()).data)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = DirectMessage.objects.filter(
            tenant_id=request.tenant_id,
            recipient=request.user,
            is_read=False,
        ).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """
        POST /notifications/messages/mark-all-read/
        Marks all incoming messages for this user/tenant as read.
        """
        tenant_id = self.request.tenant_id
        DirectMessage.objects.filter(
            tenant_id=tenant_id,
            recipient=request.user,
            is_read=False
        ).update(is_read=True)
        return Response({'detail': 'All messages marked as read.'})


class EmailSettingViewSet(viewsets.GenericViewSet):
    """
    Manages per-tenant SMTP email configuration.
    GET    /email-settings/       — retrieve current config
    PUT    /email-settings/       — create or update config
    POST   /email-settings/test/  — send test email
    """
    serializer_class = EmailSettingSerializer
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def _get_settings(self, tenant_id):
        obj, _ = EmailSetting.objects.get_or_create(tenant_id=tenant_id)
        return obj

    def list(self, request):
        obj = self._get_settings(request.tenant_id)
        serializer = self.get_serializer(obj)
        data = serializer.data
        data['password'] = '********' if obj.password else ''
        return Response(data)

    def create(self, request):
        tenant_id = request.tenant_id
        obj, created = EmailSetting.objects.get_or_create(tenant_id=tenant_id)
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='test')
    def test_email(self, request):
        """
        POST /notifications/email-settings/test/
        Body: { "to_email": "admin@school.com" }
        Sends a test email using the configured SMTP settings.
        """
        tenant_id = request.tenant_id
        test_ser = TestEmailSerializer(data=request.data)
        test_ser.is_valid(raise_exception=True)

        obj = EmailSetting.objects.filter(tenant_id=tenant_id).first()
        host = obj.host if obj and obj.host else settings.EMAIL_HOST
        port = obj.port if obj and obj.port else settings.EMAIL_PORT
        username = obj.username if obj and obj.username else settings.EMAIL_HOST_USER
        password = obj.password if obj and obj.password else settings.EMAIL_HOST_PASSWORD
        from_email = obj.from_email if obj and obj.from_email else settings.DEFAULT_FROM_EMAIL
        use_tls = obj.use_tls if obj else settings.EMAIL_USE_TLS

        try:
            from apps.notifications.email_backend import TenantEmailBackend
            backend = TenantEmailBackend(
                host=host, port=port, username=username,
                password=password, use_tls=use_tls,
            )
            sent_count = backend.send_messages([
                self._build_test_message(test_ser.validated_data, from_email)
            ])
            if sent_count:
                if obj:
                    obj.is_verified = True
                    obj.save(update_fields=['is_verified'])
                return Response({'detail': 'Test email sent successfully.'})
            return Response(
                {'detail': 'Failed to send test email. Check your SMTP settings.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {'detail': f'SMTP Error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def _build_test_message(self, data, from_email):
        from django.core.mail.message import EmailMessage
        msg = EmailMessage(
            subject=data.get('subject', 'Test Email from School OS'),
            body=data.get('message', 'This is a test email to verify your SMTP configuration.'),
            from_email=from_email,
            to=[data['to_email']],
        )
        return msg
