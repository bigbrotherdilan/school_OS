import uuid
from django.db import models


class SchemeOfWork(models.Model):
    """
    The planned curriculum broken down by weeks for a specific subject and class.
    Each row = one week of teaching for one class + subject in a term.
    Status planned -> taught records actual work coverage.
    """
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        TAUGHT = 'taught', 'Taught'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='schemes')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, related_name='schemes')
    term = models.ForeignKey('academic.Term', on_delete=models.CASCADE, related_name='schemes')
    subject = models.ForeignKey('academic.Subject', on_delete=models.CASCADE, related_name='schemes')
    class_obj = models.ForeignKey('academic.Class', on_delete=models.CASCADE, related_name='schemes')
    week_number = models.PositiveSmallIntegerField()
    topic = models.CharField(max_length=255)
    objectives = models.TextField(blank=True)
    expected_outcome = models.TextField(blank=True)
    essential_knowledge = models.TextField(blank=True)
    homework = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    taught_at = models.DateTimeField(null=True, blank=True)
    taught_by = models.ForeignKey(
        'staff.Teacher', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='taught_schemes')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'logbook_schemes'
        unique_together = ['tenant', 'academic_year', 'term', 'subject', 'class_obj', 'week_number']
        ordering = ['week_number']

    def __str__(self):
        return f"Week {self.week_number} - {self.subject.name if hasattr(self, 'subject') else 'Subject'} ({self.class_obj.name if hasattr(self, 'class_obj') else 'Class'})"


class CurriculumModule(models.Model):
    """
    A major unit of study (e.g. 'Algebra', 'Geometry').
    Scoped to a class + subject: Form 1 Maths and Form 2 Maths are
    different schemes, each with their own modules and lessons.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='curriculum_modules')
    academic_class = models.ForeignKey(
        'academic.Class', on_delete=models.CASCADE, related_name='curriculum_modules',
        null=True, blank=True,
        help_text='The class this scheme belongs to (e.g. Form 1).',
    )
    subject = models.ForeignKey('academic.Subject', on_delete=models.CASCADE, related_name='modules')
    name = models.CharField(max_length=255)
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = 'curriculum_modules'
        ordering = ['order']

    def __str__(self):
        class_label = f"{self.academic_class.name} - " if self.academic_class_id else ""
        return f"{class_label}{self.subject.name} - {self.name}"


class CurriculumLesson(models.Model):
    """
    A specific lesson or topic within a module.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(CurriculumModule, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    content_brief = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=1)
    is_completed = models.BooleanField(default=False)

    class Meta:
        db_table = 'curriculum_lessons'
        ordering = ['order']

    def __str__(self):
        return self.title


class LogbookEntry(models.Model):
    """
    Teacher's daily or weekly record of work covered.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='logbook_entries')
    teacher = models.ForeignKey('staff.Teacher', on_delete=models.CASCADE, related_name='logbook_entries')
    scheme_of_work = models.ForeignKey(SchemeOfWork, on_delete=models.SET_NULL, null=True, blank=True, related_name='logbook_entries')
    lessons_covered = models.ManyToManyField(CurriculumLesson, blank=True, related_name='logged_in')

    date = models.DateField()
    work_covered = models.TextField()

    # Compliance & Signature
    is_locked = models.BooleanField(default=False)
    signature_hash = models.CharField(max_length=255, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)

    is_validated = models.BooleanField(default=False)
    validated_by = models.ForeignKey('staff.Teacher', on_delete=models.SET_NULL, null=True, blank=True, related_name='validated_logbooks')

    class Meta:
        db_table = 'logbook_entries'
        ordering = ['-date']

    def __str__(self):
        return f"{self.date} - {self.teacher.user.full_name}"
