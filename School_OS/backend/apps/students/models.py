"""
Student Management — School OS
"""
import uuid
from django.db import models


class Student(models.Model):
    """
    Core record for a student within a tenant.
    """

    class Gender(models.TextChoices):
        MALE = 'M', 'Male'
        FEMALE = 'F', 'Female'

    class Status(models.TextChoices):
        REGISTERED = 'registered', 'Registered (Pending)'
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        GRADUATED = 'graduated', 'Graduated'
        WITHDRAWN = 'withdrawn', 'Withdrawn'
        SUSPENDED = 'suspended', 'Suspended'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.CASCADE, related_name='students'
    )

    # Regional IDs
    admission_number = models.CharField(max_length=50, unique=True, blank=True)

    first_name = models.CharField(max_length=150)
    middle_name = models.CharField(
        max_length=150, blank=True,
        help_text="Middle name(s), e.g., 'Nfon' in 'Dilan Nfon Ngongsong'",
    )
    last_name = models.CharField(max_length=150)
    gender = models.CharField(max_length=1, choices=Gender.choices)
    date_of_birth = models.DateField()

    # Placement
    current_class = models.ForeignKey(
        'academic.Class', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='students',
    )
    stream = models.ForeignKey(
        'academic.Section', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='students',
        help_text="Required for bilingual schools",
    )
    series = models.ForeignKey(
        'academic.Series', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='students',
        help_text="2nd Cycle only: academic specialization (A, B, C, S1, etc.)",
    )

    # Metadata
    photo_url = models.URLField(max_length=500, blank=True)
    blood_group = models.CharField(max_length=5, blank=True, help_text="e.g., A+, B-, O+")
    emergency_contact = models.CharField(max_length=30, blank=True, help_text="Emergency phone number")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.REGISTERED
    )
    enrolled_date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'students'
        unique_together = ['tenant', 'admission_number']
        indexes = [
            models.Index(fields=['tenant', 'current_class'], name='idx_student_class'),
            models.Index(fields=['tenant', 'status'], name='idx_student_status'),
        ]
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.full_name} ({self.admission_number})"

    def save(self, *args, **kwargs):
        if not self.admission_number:
            from apps.students.utils import generate_admission_number
            self.admission_number = generate_admission_number(self)
        super().save(*args, **kwargs)

    @property
    def full_name(self):
        parts = [p for p in (self.first_name, self.middle_name, self.last_name) if p]
        return ' '.join(parts)


class ParentStudentRelationship(models.Model):
    """
    Mapping between a parent (user account) and a student.
    """
    class RelationshipType(models.TextChoices):
        FATHER = 'father', 'Father'
        MOTHER = 'mother', 'Mother'
        GUARDIAN = 'guardian', 'Guardian'

    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, null=True, blank=True)
    parent_user = models.ForeignKey(
        'authentication.User', on_delete=models.CASCADE, related_name='student_links'
    )
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='parent_links'
    )
    relationship_type = models.CharField(
        max_length=20, choices=RelationshipType.choices
    )

    class Meta:
        db_table = 'student_parent_links'
        unique_together = ['parent_user', 'student']


class DisciplineRecord(models.Model):
    class Category(models.TextChoices):
        MISCONDUCT = 'misconduct', 'Misconduct'
        ABSENTEEISM = 'absenteeism', 'Absenteeism'
        VIOLENCE = 'violence', 'Violence'
        OTHER = 'other', 'Other'

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='discipline_records')
    category = models.CharField(max_length=20, choices=Category.choices)
    description = models.TextField()
    action_taken = models.TextField()
    date = models.DateField(null=True, blank=True)
    reported_by = models.ForeignKey('staff.Teacher', on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = 'student_discipline'
        ordering = ['-date', '-id']


class TransferRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transfers')
    from_school = models.CharField(max_length=255, null=True, blank=True)
    to_school = models.CharField(max_length=255, null=True, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    date = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'student_transfers'
        ordering = ['-date', '-id']

    def __str__(self):
        return f"{self.student.first_name} - {self.reason} ({self.date})"


class PromotionHistory(models.Model):
    """
    Log of student movement between classes at the end of academic years.
    """
    class Status(models.TextChoices):
        PROMOTED = 'promoted', 'Promoted'
        REPEATED = 'repeated', 'Repeated'
        WITHDRAWN = 'withdrawn', 'Withdrawn'

    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='promotion_history', null=True, blank=True)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='promotion_history')
    from_class = models.ForeignKey('academic.Class', on_delete=models.SET_NULL, null=True, related_name='students_promoted_from')
    to_class = models.ForeignKey('academic.Class', on_delete=models.SET_NULL, null=True, related_name='students_promoted_to')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, null=True, blank=True)
    average_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices)
    promotion_date = models.DateField(auto_now_add=True)

    class Meta:
        db_table = 'student_promotion_history'
        ordering = ['-promotion_date']

    def __str__(self):
        return f"{self.student.first_name} - {self.status} to {self.to_class.name if self.to_class else 'N/A'}"
