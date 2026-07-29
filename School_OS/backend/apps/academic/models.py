"""
Academic Models — School OS

Cameroon Education Structure:
- Two sub-systems: Anglophone (Form 1–5, Lower/Upper Sixth) and Francophone (6ème–3ème, Seconde–Terminale)
- Two cycles: 1st Cycle (lower secondary) and 2nd Cycle (upper secondary / high school)
- Two sections in bilingual schools: Anglophone Section and Francophone Section
- 3 terms per academic year
- 2nd cycle has academic series (A, B, C, S1, S2, etc.)
"""
from django.db import models
from apps.tenants.models import Tenant


class AcademicYear(models.Model):
    """
    An academic cycle (e.g., 2026/2027). September to July.
    """
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name='academic_years'
    )
    name = models.CharField(max_length=20, help_text="e.g., 2026/2027")
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(
        default=False, help_text="Currently active year for the school"
    )

    class Meta:
        db_table = 'academic_years'
        unique_together = ['tenant', 'name']
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.name} ({self.tenant.school_name})"

    def save(self, *args, **kwargs):
        if self.is_active:
            AcademicYear.objects.filter(tenant=self.tenant, is_active=True).update(
                is_active=False
            )
        super().save(*args, **kwargs)


class Term(models.Model):
    """
    One of the 3 terms in an academic year.
    Cameroon uses 3 trimestres: 1st Term (Sep–Nov), 2nd Term (Dec–Mar), 3rd Term (Apr–Jul).
    """
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name='terms'
    )
    name = models.CharField(max_length=50, help_text="e.g., 1st Term")
    order_number = models.PositiveSmallIntegerField(help_text="1, 2, or 3")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'academic_periods'
        unique_together = ['academic_year', 'order_number']
        ordering = ['order_number']

    def __str__(self):
        return f"{self.name} - {self.academic_year.name}"


class Sequence(models.Model):
    """
    A sequence (CA period) within a term.
    Numbers are continuous across the entire academic year:
      - 1st Term: Sequence 1 + Sequence 2
      - 2nd Term: Sequence 3 + Sequence 4
      - 3rd Term: Sequence 5 + Sequence 6 (or Sequence 5 only)
    """
    term = models.ForeignKey(
        Term, on_delete=models.CASCADE, related_name='sequences'
    )
    name = models.CharField(max_length=50, help_text="e.g., Sequence 1, Sequence 2")
    order_number = models.PositiveSmallIntegerField(
        help_text="Continuous order across the academic year (1, 2, 3, ...)"
    )

    class Meta:
        db_table = 'academic_sequences'
        ordering = ['order_number']

    def save(self, *args, **kwargs):
        if self.pk is None:
            max_order = Sequence.objects.filter(
                term__academic_year=self.term.academic_year
            ).aggregate(models.Max('order_number'))['order_number__max'] or 0
            self.order_number = max_order + 1
            self.name = f"Sequence {self.order_number}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.term.name}"


class Cycle(models.Model):
    """
    The two cycles of Cameroonian secondary education.
    1st Cycle: Lower secondary (Forms 1–5 / 6ème–3ème)
    2nd Cycle: Upper secondary / High school (Lower/Upper Sixth / Seconde–Terminale)
    """
    class CycleOrder(models.IntegerChoices):
        FIRST = 1, '1st Cycle'
        SECOND = 2, '2nd Cycle'

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='cycles')
    name = models.CharField(max_length=50, help_text="e.g., 1st Cycle, 2nd Cycle")
    order = models.PositiveSmallIntegerField(
        choices=CycleOrder.choices,
        help_text="1 for 1st Cycle, 2 for 2nd Cycle",
    )

    class Meta:
        db_table = 'academic_cycles'
        unique_together = ['tenant', 'order']
        ordering = ['order']

    def __str__(self):
        return f"{self.name} ({self.tenant.school_name})"


class Section(models.Model):
    """
    A section within a school. Bilingual schools have Anglophone/Francophone sections.
    Technical schools might have Technical/Commercial sections. Schools define their own.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='sections')
    name = models.CharField(max_length=100, help_text="e.g., Anglophone, Francophone, Technical, Commercial")
    language = models.CharField(
        max_length=5, choices=[('en', 'English'), ('fr', 'French'), ('de', 'German')],
        blank=True, default='en',
        help_text="Primary language of instruction in this section",
    )

    class Meta:
        db_table = 'academic_sections'
        unique_together = ['tenant', 'name']
        ordering = ['name']

    def __str__(self):
        return f"{self.name} @ {self.tenant.school_name}"


class Series(models.Model):
    """
    Academic specialization in the 2nd Cycle.

    Francophone (since 2018 reform):
      A — Lettres et Philosophie
      B — Sciences Économiques et Sociales
      C — Mathématiques et Sciences Physiques
      D — Mathématiques et Sciences de la Vie et de la Terre
      E — Mathématiques et Technologie
      TI — Technologies de l'Information

    Anglophone:
      Arts: A1 (French/Lit/History), A2 (Geo/Econ/History), A3 (Lit/History/Econ),
            A4 (Geo/Econ/Maths), A5 (Lit/Phil/Maths)
      Science: S1 (Chem/Phys/Maths), S2 (Chem/Phys/Bio), S3 (Bio/Chem/Phys),
               S4 (Bio/Chem/Geology), S5 (Chem/CS/Maths)
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='series')
    cycle = models.ForeignKey(
        Cycle, on_delete=models.CASCADE, related_name='series',
        help_text="Always 2nd Cycle",
    )
    stream = models.ForeignKey(
        Section, on_delete=models.CASCADE, null=True, blank=True, related_name='series',
        help_text="Required for bilingual schools",
    )
    code = models.CharField(max_length=10, help_text="e.g., A, S1, C, TI")
    name = models.CharField(max_length=255, help_text="Full name of the series")

    class Meta:
        db_table = 'academic_series'
        unique_together = ['tenant', 'cycle', 'stream', 'code']
        ordering = ['cycle', 'code']

    def __str__(self):
        return f"{self.code} - {self.name}"


class Class(models.Model):
    """
    A specific class unit.

    Anglophone class names: Form 1–5, Lower Sixth, Upper Sixth
    Francophone class names: 6ème, 5ème, 4ème, 3ème, Seconde, Première, Terminale
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='classes')
    cycle = models.ForeignKey(Cycle, on_delete=models.SET_NULL, null=True, blank=True, related_name='classes')
    stream = models.ForeignKey(
        Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='classes',
        help_text="Required for bilingual schools",
    )
    name = models.CharField(
        max_length=50,
        help_text="e.g., Form 1, 6ème, Seconde, Lower Sixth",
    )
    level_order = models.PositiveSmallIntegerField(
        help_text="Numeric order: 1=Form 1/6ème, ..., 7=Upper Sixth/Terminale",
    )

    class Meta:
        db_table = 'academic_classes'
        unique_together = ['tenant', 'cycle', 'stream', 'name']
        ordering = ['cycle', 'stream', 'level_order', 'name']

    def __str__(self):
        stream_label = f" ({self.stream.name})" if self.stream else ""
        return f"{self.name}{stream_label}"


class Subject(models.Model):
    """
    A subject taught in a cycle.

    Subjects can be cycle-specific (e.g., only for 2nd Cycle) or available in all cycles.
    Official codes follow GCE Board codes (525=Economics, 570=Maths) for Anglophone,
    or Francophone codes where applicable.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='subjects')
    cycle = models.ForeignKey(
        Cycle, on_delete=models.SET_NULL, null=True, blank=True, related_name='subjects',
        help_text="Null means available in all cycles",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(
        max_length=20, blank=True,
        help_text="Official exam code, e.g., 570 for GCE O-Level Maths",
    )
    default_coefficient = models.DecimalField(
        max_digits=4, decimal_places=2, default=1.0,
    )
    is_compulsory = models.BooleanField(default=True)

    class Meta:
        db_table = 'academic_subjects'
        unique_together = ['tenant', 'cycle', 'name']
        ordering = ['name']

    def __str__(self):
        label = f" ({self.code})" if self.code else ""
        return f"{self.name}{label}"


class ClassSubject(models.Model):
    """
    Links a subject to a class, with an optional series for 2nd cycle.
    Controls which subjects are offered in which class and for which series.
    """
    academic_class = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name='class_subjects'
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name='class_subjects'
    )
    series = models.ForeignKey(
        Series, on_delete=models.SET_NULL, null=True, blank=True, related_name='class_subjects',
        help_text="Only for 2nd cycle series-specific subjects",
    )
    coefficient = models.DecimalField(
        max_digits=4, decimal_places=2, default=1.0,
        help_text="Subject coefficient for this class/series",
    )

    class Meta:
        db_table = 'academic_class_subjects'
        unique_together = ['academic_class', 'subject', 'series']

    def __str__(self):
        series_label = f" ({self.series.code})" if self.series else ""
        return f"{self.subject.name} → {self.academic_class.name}{series_label}"
