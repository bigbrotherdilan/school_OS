import uuid
from django.conf import settings
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
        GENERATING = 'generating', 'Generating'
        GENERATED = 'generated', 'Generated'
        RELAXED = 'relaxed', 'Relaxed (has clashes)'
        INFEASIBLE = 'infeasible', 'Infeasible'
        UNDER_REVIEW = 'under_review', 'Under Review'
        APPROVED = 'approved', 'Approved'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    #: Statuses whose slots are committed school-wide resources: any other
    #: section's generator must treat them as already-occupied (spec §6-7).
    COMMITTED_STATUSES = (GenerationStatus.APPROVED, GenerationStatus.PUBLISHED)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='timetables')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, related_name='timetables')
    term = models.ForeignKey('academic.Term', on_delete=models.CASCADE, related_name='timetables', null=True, blank=True)
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
    day_periods = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-day period overrides (half-day support): {day_number: [periods]}. '
                  'A day missing from this map uses the base `periods` template.',
    )
    blocked_slots = models.JSONField(
        default=list,
        blank=True,
        help_text='First-class non-teaching blocks: [{day, start, end, label}] — breaks, '
                  'lunch, assembly, chapel, staff meetings. No lesson may occupy them.',
    )
    generation_status = models.CharField(
        max_length=20, choices=GenerationStatus.choices, default=GenerationStatus.DRAFT,
    )
    generation_message = models.TextField(blank=True)
    generation_score = models.IntegerField(null=True, blank=True)
    last_generated_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_timetables',
        help_text='The user who approved/committed this timetable to the school schedule.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'timetables'
        unique_together = ['tenant', 'academic_year', 'class_obj']
        ordering = ['-created_at', 'id']

    def __str__(self):
        class_name = self.class_obj.name if self.class_obj else 'Class'
        term_name = self.term.name if self.term else 'Term'
        return f"Timetable for {class_name} ({term_name})"

    def period_times(self):
        if self.periods:
            return self.periods
        return DEFAULT_PERIODS

    def days(self):
        if self.working_days:
            return sorted(self.working_days)
        return DEFAULT_WORKING_DAYS

    def periods_for_day(self, day):
        """Period grid for a specific day, honouring half-day overrides."""
        if self.day_periods:
            override = self.day_periods.get(str(day), self.day_periods.get(day))
            if override:
                return override
        return self.period_times()

    def blocked_for_day(self, day):
        """Blocked (break/lunch/assembly) windows for a specific day."""
        return [b for b in (self.blocked_slots or []) if b.get('day') == day]

    def is_committed(self):
        """Approved/published timetables own their resources school-wide."""
        return self.generation_status in self.COMMITTED_STATUSES


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
    teacher = models.ForeignKey(
        'staff.Teacher', on_delete=models.SET_NULL, null=True, blank=True, related_name='time_slots'
    )
    student_group = models.ForeignKey(
        'StudentGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='slots',
        help_text='The student group attending this slot. Null = the full class cohort.',
    )
    classroom = models.CharField(max_length=100, blank=True)
    room = models.ForeignKey(
        'Room', on_delete=models.SET_NULL, null=True, blank=True, related_name='slots',
        help_text='Specific room/resource (lab, workshop...) when assigned',
    )
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
    A lesson that must be scheduled: subject, teacher, student group and weekly volume.
    Lessons are the "cards" the generator places on the grid.

    student_group is null for full-cohort subjects (everyone attends). When a
    class has parallel groups, several lessons may share a subject/class at the
    same time — one per group — without being a clash.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name='lessons')
    subject = models.ForeignKey('academic.Subject', on_delete=models.CASCADE, related_name='lessons')
    teacher = models.ForeignKey(
        'staff.Teacher', on_delete=models.SET_NULL, null=True, blank=True, related_name='lessons'
    )
    student_group = models.ForeignKey(
        'StudentGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='lessons',
        help_text='Student group this lesson is for. Null = the full class cohort.',
    )
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
        t_name = self.teacher.user.full_name if (self.teacher and hasattr(self.teacher, 'user')) else 'TBD'
        return f"{self.subject.name} x{self.periods_per_week} ({t_name})"


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


class StudentGroup(models.Model):
    """
    A configurable group of students inside a class (spec section 10).

    Examples: Full Cohort, Arts, Science, Commercial. A class that defines no
    groups behaves as one implicit full-cohort group (backward compatible).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='student_groups')
    academic_class = models.ForeignKey(
        'academic.Class', on_delete=models.CASCADE, related_name='student_groups'
    )
    name = models.CharField(max_length=100)
    is_full_cohort = models.BooleanField(
        default=False,
        help_text='This group contains every student of the class (like "Form 4").',
    )
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'timetable_student_groups'
        unique_together = ['tenant', 'academic_class', 'name']
        ordering = ['academic_class', 'order', 'name']

    def __str__(self):
        return f"{self.academic_class.name} — {self.name}"


class Room(models.Model):
    """
    A physical room or resource (classroom, lab, workshop, hall) that can be
    double-booked in the solver (spec section 14).
    """
    class RoomType(models.TextChoices):
        CLASSROOM = 'classroom', 'Classroom'
        LAB = 'lab', 'Laboratory'
        WORKSHOP = 'workshop', 'Workshop'
        HALL = 'hall', 'Hall'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=100)
    capacity = models.PositiveSmallIntegerField(default=0, help_text='0 = unlimited')
    room_type = models.CharField(
        max_length=20, choices=RoomType.choices, default=RoomType.CLASSROOM
    )
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'timetable_rooms'
        unique_together = ['tenant', 'name']
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_room_type_display()})"


class TeacherAllocation(models.Model):
    """
    A period-level split of one subject's weekly volume across several teachers
    (spec §11-13). A lesson WITHOUT allocations is taught entirely by its
    `Lesson.teacher`. A lesson WITH allocations is taught by each allocation's
    teacher for `periods` periods/week — the sum of the allocations must equal
    the lesson's `periods_per_week`.

    A NULL `teacher` is an explicit UNASSIGNED placeholder (spec §8-10): the
    solver schedules it without reserving any real teacher resource, and the
    UI shows it as "TBD / Teacher X".
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(
        Lesson, on_delete=models.CASCADE, related_name='allocations'
    )
    teacher = models.ForeignKey(
        'staff.Teacher', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='allocations',
        help_text='NULL = unassigned placeholder (Teacher X / TBD), no real resource reserved.',
    )
    periods = models.PositiveSmallIntegerField(default=0)
    is_double = models.BooleanField(
        default=False,
        help_text='Run this teacher\'s share as 2 consecutive periods.',
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'timetable_teacher_allocations'
        ordering = ['lesson', 'created_at']

    def __str__(self):
        name = self.teacher.user.full_name if (self.teacher and hasattr(self.teacher, 'user')) else 'TBD'
        return f"{self.lesson.subject.name} → {name} x{self.periods}"
