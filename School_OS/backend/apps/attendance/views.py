from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from .models import AttendanceSession, AttendanceRecord
from .serializers import AttendanceSessionSerializer, AttendanceRecordSerializer
from apps.authentication.permissions import IsSchoolMember

class AttendanceSessionViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSessionSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return AttendanceSession.objects.filter(tenant_id=tenant_id)

    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def stats(self, request):
        tenant_id = request.tenant_id
        sessions = self.get_queryset()
        
        total_sessions = sessions.count()
        records = AttendanceRecord.objects.filter(session__tenant_id=tenant_id)
        total_records = records.count()
        
        # Late counts as Present per user request
        present_count = records.filter(status__in=['present', 'late']).count()
        absent_count = records.filter(status='absent').count()
        
        attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0
        
        # At-Risk: students absent >20% of sessions in last 30 days
        from datetime import timedelta, datetime as _dt
        thirty_days_ago = _dt.now().date() - timedelta(days=30)
        recent_sessions = AttendanceSession.objects.filter(
            tenant_id=tenant_id, date__gte=thirty_days_ago
        )
        total_recent = recent_sessions.count()
        at_risk_count = 0
        if total_recent > 0:
            threshold = int(total_recent * 0.2)
            from apps.students.models import Student
            students_in_tenant = Student.objects.filter(tenant_id=tenant_id, status='active')
            for student in students_in_tenant:
                absences = AttendanceRecord.objects.filter(
                    session__in=recent_sessions,
                    student=student,
                    status='absent'
                ).count()
                if absences > threshold:
                    at_risk_count += 1

        return Response({
            'total_sessions': total_sessions,
            'attendance_rate': round(attendance_rate, 1),
            'present_count': present_count,
            'absent_count': absent_count,
            'at_risk_count': at_risk_count,
        })

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """Export attendance sessions as CSV."""
        from django.http import HttpResponse
        import csv
        from datetime import datetime

        tenant_id = request.tenant_id
        sessions = self.get_queryset()

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="attendance_report_{datetime.now().strftime("%Y%m%d")}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Date', 'Class', 'Subject', 'Teacher', 'Start Time', 'End Time'])

        for s in sessions:
            writer.writerow([
                s.date,
                s.academic_class.name if s.academic_class else 'N/A',
                s.subject.name if s.subject else 'N/A',
                s.teacher.user.full_name if s.teacher and s.teacher.user else 'N/A',
                s.start_time,
                s.end_time
            ])

        return response

class AttendanceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return AttendanceRecord.objects.filter(session__tenant_id=tenant_id)
