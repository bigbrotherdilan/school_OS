from django.db import models


class AttendanceSession(models.Model):
    """
    Occurs every time a teacher starts a lesson for a specific class/subject.
    """
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='attendance_sessions')
    academic_class = models.ForeignKey('academic.Class', on_delete=models.CASCADE, related_name='attendance_sessions')
    subject = models.ForeignKey('academic.Subject', on_delete=models.CASCADE, related_name='attendance_sessions')
    teacher = models.ForeignKey('staff.Teacher', on_delete=models.CASCADE, related_name='conducted_sessions')
    term = models.ForeignKey('academic.Term', on_delete=models.CASCADE, related_name='attendance_sessions')
    date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)

    class Meta:
        db_table = 'attendance_sessions'
        ordering = ['-date', '-start_time']

    def __str__(self):
        return f"{self.subject.name if self.subject else 'Subject'} - {self.academic_class.name if self.academic_class else 'Class'} ({self.date})"


class AttendanceRecord(models.Model):
    """
    Individual student check-in for a specific session.
    """
    class Status(models.TextChoices):
        PRESENT = 'present', 'Present'
        ABSENT = 'absent', 'Absent'
        LATE = 'late', 'Late'
        EXCUSED = 'excused', 'Excused'

    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='attendance_records')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PRESENT)
    remarks = models.TextField(blank=True)

    class Meta:
        db_table = 'attendance_records'
        unique_together = ['session', 'student']

    def __str__(self):
        return f"{self.student.first_name if self.student else 'Student'} - {self.status} ({self.session.date if self.session else 'N/A'})"
