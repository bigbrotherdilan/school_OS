"""
Assessment Models — School OS

Supports dual grading systems:
- Francophone: 0–20 numeric scale
- Anglophone: Letter grades (A–U for O-Level, A–F for A-Level) with points

Exam types cover all Cameroonian exit and intermediate exams:
- BEPC (end of Francophone 1st Cycle)
- GCE O-Level (end of Anglophone 1st Cycle)
- Probatoire (2nd year of Francophone 2nd Cycle)
- GCE A-Level / Baccalauréat (end of 2nd Cycle)
"""
from django.db import models
from apps.tenants.models import Tenant
import uuid


class GradeScale(models.Model):
    """
    Defines grading boundaries for a sub-system and exam level.
    Example: GCE O-Level has A(80-100, 3pts), B(70-79, 2pts), C(50-69, 1pt), etc.
    """

    class SubSystem(models.TextChoices):
        ANGLOPHONE = 'anglophone', 'Anglophone'
        FRANCOPHONE = 'francophone', 'Francophone'

    class ExamLevel(models.TextChoices):
        O_LEVEL = 'o_level', 'GCE O-Level'
        A_LEVEL = 'a_level', 'GCE A-Level'
        BAC = 'bac', 'Baccalauréat'
        BEPC = 'bepc', 'BEPC'
        TECHNICAL = 'technical', 'Technical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='grade_scales')
    name = models.CharField(max_length=100, help_text="e.g., GCE O-Level, Baccalauréat")
    sub_system = models.CharField(max_length=20, choices=SubSystem.choices)
    exam_level = models.CharField(max_length=20, choices=ExamLevel.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'grade_scales'
        unique_together = ['tenant', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_sub_system_display()})"


class GradeBoundary(models.Model):
    """
    A single grade row within a GradeScale.
    E.g., Grade A: min 80, max 100, 3 points (O-Level) or 5 points (A-Level).
    """
    grade_scale = models.ForeignKey(
        GradeScale, on_delete=models.CASCADE, related_name='boundaries'
    )
    letter_grade = models.CharField(max_length=5, help_text="e.g., A, B+, C, D, E, F, U, O")
    min_score = models.DecimalField(max_digits=5, decimal_places=2, help_text="Minimum % or /20")
    max_score = models.DecimalField(max_digits=5, decimal_places=2, help_text="Maximum % or /20")
    points = models.DecimalField(max_digits=4, decimal_places=1, default=0, help_text="Points for this grade")
    description = models.CharField(max_length=50, blank=True, help_text="e.g., Excellent, Good, Fail")

    class Meta:
        db_table = 'grade_boundaries'
        ordering = ['-min_score']

    def __str__(self):
        return f"{self.letter_grade} ({self.min_score}–{self.max_score})"


class MarkEntryWindow(models.Model):
    """
    Controls the time boundaries and global toggle for teachers entering marks.
    Each window is per-sequence (e.g., Sequence 1 of 1st Term).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='mark_windows')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, related_name='mark_windows')
    sequence = models.ForeignKey('academic.Sequence', on_delete=models.CASCADE, related_name='mark_windows')

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_open = models.BooleanField(default=False)
    share_results = models.BooleanField(
        default=False,
        help_text="When True, parents can see marks for this sequence once the window is closed.",
    )

    class Meta:
        db_table = 'assessment_mark_windows'
        unique_together = ['tenant', 'sequence']
        ordering = ['-academic_year__start_date', 'sequence__term__order_number', 'sequence__order_number']

    def __str__(self):
        return f"{self.sequence.name} ({self.sequence.term.name}) - Open: {self.is_open}"


class Exam(models.Model):
    """
    A term exam (1st Term, 2nd Term, 3rd Term).
    Each term has one exam. Within each exam, teachers enter marks per sequence.
    Sequence 1 = 50% of term, Sequence 2 = 50% of term (or 100% if single sequence).
    """

    class ExamType(models.TextChoices):
        TERMLY = 'termly', 'Term Exam'
        BEPC = 'bepc', 'BEPC'
        GCE_OL = 'gce_ol', 'GCE O-Level'
        PROBATOIRE = 'probatoire', 'Probatoire'
        GCE_AL = 'gce_al', 'GCE A-Level'
        BAC = 'bac', 'Baccalauréat'
        TVEE_IL = 'tvee_il', 'TVEE Intermediate Level'
        TVEE_AL = 'tvee_al', 'TVEE Advanced Level'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='exams')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE, related_name='exams')
    term = models.ForeignKey('academic.Term', on_delete=models.CASCADE, related_name='exams')
    name = models.CharField(max_length=100)
    exam_type = models.CharField(
        max_length=20, choices=ExamType.choices, default=ExamType.TERMLY,
    )
    weight = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Weight of this term in the overall year (e.g., 33.33)",
    )
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = 'assessment_exams'
        unique_together = ['tenant', 'term']
        ordering = ['term__order_number', 'name']

    def __str__(self):
        return f"{self.name} ({self.term.name})"


class ExamResult(models.Model):
    """
    A student's score in a given subject for a specific exam + sequence.
    Each exam has 2 sequences (or 1). The score is entered per sequence.
    Term average = weighted sum of sequence scores.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='results')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='exam_results')
    subject = models.ForeignKey('academic.Subject', on_delete=models.CASCADE, related_name='exam_results')
    sequence = models.ForeignKey('academic.Sequence', on_delete=models.CASCADE, related_name='exam_results', null=True, blank=True)
    score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Numeric score: /20 for Francophone, % for Anglophone",
    )
    letter_grade = models.CharField(
        max_length=5, blank=True,
        help_text="A, B, C, D, E, F, U, O — for Anglophone grading",
    )
    points = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True,
        help_text="Grade points: O-Level max 3, A-Level max 5",
    )
    comments = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'assessment_results'
        unique_together = ['exam', 'student', 'subject', 'sequence']

    def __str__(self):
        return f"{self.student} - {self.subject} ({self.score})"
