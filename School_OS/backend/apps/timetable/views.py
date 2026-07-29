from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Timetable, TimeSlot
from .serializers import TimetableSerializer, TimeSlotSerializer
from apps.authentication.permissions import IsSchoolMember

class TimetableViewSet(viewsets.ModelViewSet):
    serializer_class = TimetableSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return Timetable.objects.filter(tenant_id=tenant_id)


class TimeSlotViewSet(viewsets.ModelViewSet):
    serializer_class = TimeSlotSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return TimeSlot.objects.filter(timetable__tenant_id=tenant_id)
