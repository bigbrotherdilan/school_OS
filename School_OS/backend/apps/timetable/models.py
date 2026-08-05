import uuid
from django.db import models

DEFAULT_PERIODS = [
    {'start': '07:30', 'end': '08:20'},
    {'start': '08:20', 'end': '09:10'},
    {'start': '09:10', 'end': '10:00'},
    {'start': '10:30', 'end': '11:20'},
    {'start': '11:20', 'end': '12:10'},
    {'start': '12:10', 'end': '13:00'},
    {'start': '13:40', 'end': '14:30'},
    {'start': '14:30', 'end': '15:20'},
    {'start': '15:20', 'end': '16:10'},
]

DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]


class Timetable(models.Model):
    """
    A timetable for a specific class during a specific term.
    """
    class GenerationStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        GENERATED = 'generated', 'Generated'
        RELAXED = 'relaxed', 'Relaxed (has clashes)'
        INFEASIBLE = 'infeasible', 'Infeasible'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='timetables')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, related_name='timetables')
    term = models.ForeignKey('academic.Term', on_delete=models.CASCADE, related_name='timetables')
    class_obj = models.ForeignKey('academic.Class', on_delete=models.CASCADE, related_name='timetables')
    is_active = models.BooleanField(default=True)
    periods = models.JSONField(
        default=list,
        help_text='School period template: list of {"start": "HH:MM", "end": "HH:MM"}',
    )
    working_days = models.JSONField(
        default=list,
        help_text='Days of the week lessons run on, as day numbers (1=Monday ... 7=Sunday)',
    )
    generation_status = models.CharField(
        max_length=20, choices=GenerationStatus.choices, default=GenerationStatus.DRAFT,
    )
    generation_message = models.TextField(blank=True)
    generation_score = models.IntegerField(null=True, blank=True)
    last_generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'timetables'
        unique_together = ['tenant', 'academic_year', 'term', 'class_obj']

    def __str__(self):
        return f"Timetable for {self.class_obj.name if hasattr(self, 'class_obj') else 'Class'} ({self.term.name if hasattr(self, 'term') else 'Term'})"

    def period_times(self):
        if self.periods:
            return self.periods
        return DEFAULT_PERIODS

    def days(self):
        if self.working_days:
            return sorted(self.working_days)
        return DEFAULT_WORKING_DAYS


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
    lesson = models.ForeignKey(
        'Lesson', on_delete=models.SET_NULL, null=True, blank=True, related_name='slots',
        help_text='The lesson card this slot belongs to (null for ad-hoc lessons)',
    )
    day_of_week = models.IntegerField(choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    subject = models.ForeignKey('academic.Subject', on_delete=models.CASCADE, related_name='time_slots')
    teacher = models.ForeignKey('staff.Teacher', on_delete=models.CASCADE, related_name='time_slots')
    classroom = models.CharField(max_length=100, blank=True)
    is_locked = models.BooleanField(
        default=False,
        help_text='Locked slots are kept untouched when the timetable is regenerated',
    )

    class Meta:
        db_table = 'time_slots'
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.get_day_of_week_display()} {self.start_time.strftime('%H:%M')} - {self.subject.name if hasattr(self, 'subject') else 'Subject'}"


class Lesson(models.Model):
    """
    A lesson that must be scheduled: subject, teacher and weekly volume.
    Lessons are the "cards" the generator places on the grid.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name='lessons')
    subject = models.ForeignKey('academic.Subject', on_delete=models.CASCADE, related_name='lessons')
    teacher = models.ForeignKey('staff.Teacher', on_delete=models.CASCADE, related_name='lessons')
    periods_per_week = models.PositiveSmallIntegerField(default=1)
    is_double = models.BooleanField(
        default=False,
        help_text='Run as 2 consecutive periods (science practical, languages, workshops)',
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'timetable_lessons'
        ordering = ['subject__name']

    def __str__(self):
        return f"{self.subject.name} x{self.periods_per_week} ({self.teacher.user.full_name if hasattr(self.teacher, 'user') else self.teacher_id})"


class TeacherUnavailability(models.Model):
    """
    A window where a teacher cannot teach (other school, studies, meetings).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='teacher_unavailabilities')
    teacher = models.ForeignKey('staff.Teacher', on_delete=models.CASCADE, related_name='unavailability_windows')
    day_of_week = models.IntegerField(choices=TimeSlot.DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'timetable_teacher_unavailability'
        ordering = ['teacher', 'day_of_week', 'start_time']

    def __str__(self):
        return f"{self.teacher.user.full_name if hasattr(self.teacher, 'user') else self.teacher_id} unavailable {self.get_day_of_week_display()} {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"
