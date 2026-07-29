from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Announcement, DirectMessage
from .serializers import AnnouncementSerializer, DirectMessageSerializer
from apps.authentication.permissions import IsSchoolMember


class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        user = self.request.user
        qs = Announcement.objects.filter(tenant_id=tenant_id)

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

        # Optional audience filter for admin
        audience_filter = self.request.query_params.get('audience')
        if audience_filter:
            qs = qs.filter(audience=audience_filter)

        return qs.order_by('-created_at')


class DirectMessageViewSet(viewsets.ModelViewSet):
    serializer_class = DirectMessageSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return DirectMessage.objects.filter(
            tenant_id=tenant_id
        ).filter(
            Q(sender=self.request.user) | Q(recipient=self.request.user)
        )

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
