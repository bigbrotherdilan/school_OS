import uuid
from django.db import models


class Timetable(models.Model):
    """
    A timetable for a specific class during a specific term.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='timetables')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, related_name='timetables')
    term = models.ForeignKey('academic.Term', on_delete=models.CASCADE, related_name='timetables')
    class_obj = models.ForeignKey('academic.Class', on_delete=models.CASCADE, related_name='timetables')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'timetables'
        unique_together = ['tenant', 'academic_year', 'term', 'class_obj']

    def __str__(self):
        return f"Timetable for {self.class_obj.name if hasattr(self, 'class_obj') else 'Class'} ({self.term.name if hasattr(self, 'term') else 'Term'})"


class TimeSlot(models.Model):
    """
    A specific slot in the timetable (e.g. Monday 08:00 - 09:30 for Physics).
    """
    class DayOfWeek(models.IntegerChoices):
        MONDAY = 1, 'Monday'
        TUESDAY = 2, 'Tuesday'
        WEDNESDAY = 3, 'Wednesday'
        THURSDAY = 4, 'Thursday'
        FRIDAY = 5, 'Friday'
        SATURDAY = 6, 'Saturday'
        SUNDAY = 7, 'Sunday'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name='slots')
    day_of_week = models.IntegerField(choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    subject = models.ForeignKey('academic.Subject', on_delete=models.CASCADE, related_name='time_slots')
    teacher = models.ForeignKey('staff.Teacher', on_delete=models.CASCADE, related_name='time_slots')
    classroom = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'time_slots'
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.get_day_of_week_display()} {self.start_time.strftime('%H:%M')} - {self.subject.name if hasattr(self, 'subject') else 'Subject'}"
