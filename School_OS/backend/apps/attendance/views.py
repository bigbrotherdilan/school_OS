from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from .models import AttendanceSession, AttendanceRecord
from .serializers import AttendanceSessionSerializer, AttendanceRecordSerializer
from apps.authentication.permissions import IsSchoolMember, IsSchoolAdmin
from apps.academic.models import Term, AcademicYear
from apps.students.models import Student
from datetime import timedelta, datetime as _dt

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

    @action(detail=False, methods=['get'], url_path='analytics')
    def analytics(self, request):
        """
        GET /attendance/sessions/analytics/
        Returns per-class attendance rates, status breakdown, and trend data.
        Query params: term_id (optional), class_id (optional)
        """
        tenant_id = request.tenant_id
        qs = self.get_queryset()

        term_id = request.query_params.get('term_id')
        class_id = request.query_params.get('class_id')

        if term_id:
            try:
                term = Term.objects.get(id=term_id)
                qs = qs.filter(term=term)
            except Term.DoesNotExist:
                pass
        else:
            active_year = AcademicYear.objects.filter(tenant_id=tenant_id, is_active=True).first()
            if active_year:
                current_term = Term.objects.filter(academic_year=active_year).order_by('-order_number').first()
                if current_term:
                    qs = qs.filter(term=current_term)

        if class_id:
            qs = qs.filter(academic_class_id=class_id)

        records = AttendanceRecord.objects.filter(session__in=qs)

        total_records = records.count()
        present_count = records.filter(status__in=['present', 'late']).count()
        absent_count = records.filter(status='absent').count()
        late_count = records.filter(status='late').count()
        attendance_rate = round((present_count / total_records) * 100, 1) if total_records > 0 else 0

        per_class = []
        for cls_id in qs.values_list('academic_class_id', flat=True).distinct():
            if not cls_id:
                continue
            cls_records = records.filter(session__academic_class_id=cls_id)
            cls_total = cls_records.count()
            cls_present = cls_records.filter(status__in=['present', 'late']).count()
            cls_absent = cls_records.filter(status='absent').count()
            cls_late = cls_records.filter(status='late').count()
            cls_sessions = qs.filter(academic_class_id=cls_id).count()
            cls_name = qs.filter(academic_class_id=cls_id).first().academic_class.name if cls_sessions > 0 else 'N/A'
            per_class.append({
                'class_id': str(cls_id),
                'class_name': cls_name,
                'total_records': cls_total,
                'present': cls_present,
                'absent': cls_absent,
                'late': cls_late,
                'sessions': cls_sessions,
                'rate': round((cls_present / cls_total) * 100, 1) if cls_total > 0 else 0,
            })

        per_class.sort(key=lambda x: x['rate'])

        return Response({
            'total_sessions': qs.count(),
            'total_records': total_records,
            'attendance_rate': attendance_rate,
            'present_count': present_count,
            'absent_count': absent_count,
            'late_count': late_count,
            'per_class': per_class,
        })

    @action(detail=False, methods=['get'], url_path='at-risk-students')
    def at_risk_students(self, request):
        """
        GET /attendance/sessions/at-risk-students/
        Returns students with >20% absence rate in the last 30 days.
        Query params: term_id (optional), class_id (optional)
        """
        tenant_id = request.tenant_id
        thirty_days_ago = _dt.now().date() - timedelta(days=30)
        recent_sessions = AttendanceSession.objects.filter(
            tenant_id=tenant_id, date__gte=thirty_days_ago
        )

        term_id = request.query_params.get('term_id')
        if term_id:
            recent_sessions = recent_sessions.filter(term_id=term_id)
        class_id = request.query_params.get('class_id')
        if class_id:
            recent_sessions = recent_sessions.filter(academic_class_id=class_id)

        total_recent = recent_sessions.count()
        if total_recent == 0:
            return Response({'results': [], 'total_sessions': 0})

        threshold = int(total_recent * 0.2)
        students_in_tenant = Student.objects.filter(tenant_id=tenant_id, status='active')

        at_risk = []
        for student in students_in_tenant:
            absences = AttendanceRecord.objects.filter(
                session__in=recent_sessions, student=student, status='absent'
            ).count()
            if absences > threshold:
                rate = round((absences / total_recent) * 100, 1)
                status_label = 'critical' if rate >= 40 else 'warning' if rate >= 25 else 'monitor'
                at_risk.append({
                    'student_id': str(student.id),
                    'student_name': student.full_name,
                    'admission_number': student.admission_number,
                    'class_name': student.current_class.name if student.current_class else 'N/A',
                    'absent_count': absences,
                    'total_sessions': total_recent,
                    'absence_rate': rate,
                    'status': status_label,
                })

        at_risk.sort(key=lambda x: x['absence_rate'], reverse=True)
        return Response({'results': at_risk, 'total_sessions': total_recent})

class AttendanceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return AttendanceRecord.objects.filter(session__tenant_id=tenant_id)
