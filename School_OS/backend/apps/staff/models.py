"""
Staff Management — School OS
"""
import uuid
from django.db import models
from django.conf import settings


class Teacher(models.Model):
    """
    Teacher profile linked to a global user identity.
    Includes marketplace fields for the national teacher discovery system.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='teacher_profiles'
    )
    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.CASCADE, related_name='teachers'
    )
    employee_id = models.CharField(max_length=50, unique=True, blank=True)
    qualification = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    # Extended profile fields
    department = models.CharField(max_length=100, blank=True, help_text="e.g. Science, Arts, Languages")
    phone = models.CharField(max_length=20, blank=True)
    date_of_joining = models.DateField(null=True, blank=True)
    years_of_experience = models.PositiveIntegerField(null=True, blank=True)

    # Marketplace / discovery fields
    specializations = models.JSONField(default=list, blank=True, help_text="List of specialization tags, e.g. ['Physics', 'AP Calculus']")
    certifications = models.JSONField(default=list, blank=True, help_text="List of certifications, e.g. ['BSc Mathematics', 'TEFL']")
    teaching_philosophy = models.TextField(blank=True, help_text="Short statement about teaching approach")
    achievements = models.JSONField(default=list, blank=True, help_text="Notable achievements or awards")
    availability = models.CharField(
        max_length=20,
        choices=[
            ('full_time', 'Full Time'),
            ('part_time', 'Part Time'),
            ('contract', 'Contract'),
            ('available', 'Available for Hire'),
        ],
        default='full_time',
    )
    public_profile = models.BooleanField(default=False, help_text="Show profile in the national teacher marketplace")
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Hourly rate for marketplace (XAF)")
    subjects_taught = models.JSONField(default=list, blank=True, help_text="Flat list of subject names for marketplace display")
    languages_spoken = models.JSONField(default=list, blank=True, help_text="e.g. ['English', 'French']")
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0, help_text="Computed average from reviews")
    total_reviews = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'staff_teachers'

    def __str__(self):
        return f"Teacher {self.employee_id} ({self.tenant.school_name})"

    def recalculate_rating(self):
        """Recompute average_rating and total_reviews from PerformanceReview."""
        from django.db.models import Avg, Count
        stats = PerformanceReview.objects.filter(teacher=self).aggregate(
            avg_score=Avg('score'),
            total=Count('id'),
        )
        self.average_rating = round(float(stats['avg_score'] or 0), 2)
        self.total_reviews = stats['total']
        self.save(update_fields=['average_rating', 'total_reviews'])


class TeachingAssignment(models.Model):
    """
    Mapping of teachers to specific subjects and classes.
    For 2nd Cycle, series is required to specify which specialization the teacher handles.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(
        Teacher, on_delete=models.CASCADE, related_name='assignments'
    )
    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.CASCADE, related_name='teaching_assignments',
        null=True, blank=True,
    )
    subject = models.ForeignKey(
        'academic.Subject', on_delete=models.CASCADE, related_name='teacher_assignments',
        null=True, blank=True,
    )
    academic_class = models.ForeignKey(
        'academic.Class', on_delete=models.CASCADE, related_name='teacher_assignments',
        null=True, blank=True,
    )
    series = models.ForeignKey(
        'academic.Series', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='teacher_assignments',
        help_text="2nd Cycle only: which series this teacher handles",
    )
    academic_year = models.ForeignKey(
        'academic.AcademicYear', on_delete=models.CASCADE, related_name='teacher_assignments',
        null=True, blank=True,
    )

    class Meta:
        db_table = 'staff_assignments'
        unique_together = ['teacher', 'subject', 'academic_class', 'series', 'academic_year']

    def __str__(self):
        return f"{self.teacher.employee_id} - {self.subject.name if self.subject else 'Subject'}"


class LeaveRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    class Meta:
        db_table = 'staff_leave_requests'


class PerformanceReview(models.Model):
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    review_date = models.DateField(null=True, blank=True)
    score = models.IntegerField(help_text="1 to 5", null=True, blank=True)
    comments = models.TextField(blank=True)

    class Meta:
        db_table = 'staff_performance_reviews'
