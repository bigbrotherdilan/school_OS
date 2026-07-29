from django.contrib import admin
from apps.assessments.models import (
    GradeScale, GradeBoundary, MarkEntryWindow, Exam, ExamResult
)


@admin.register(GradeScale)
class GradeScaleAdmin(admin.ModelAdmin):
    list_display = ("name", "sub_system", "exam_level", "tenant", "is_active")  # type: ignore
    list_filter = ("sub_system", "exam_level", "tenant")
    search_fields = ("name",)
    readonly_fields = ("id",)


@admin.register(GradeBoundary)
class GradeBoundaryAdmin(admin.ModelAdmin):
    list_display = (  # type: ignore
        "letter_grade",
        "min_score",
        "max_score",
        "points",
        "description",
        "grade_scale",
    )
    list_filter = ("grade_scale",)
    readonly_fields = ("id",)


@admin.register(MarkEntryWindow)
class MarkEntryWindowAdmin(admin.ModelAdmin):
    list_display = (  # type: ignore
        "sequence",
        "academic_year",
        "tenant",
        "start_date",
        "end_date",
        "is_open",
    )
    list_filter = ("is_open", "tenant", "academic_year")
    search_fields = ("sequence__name", "academic_year__name")
    readonly_fields = ("id",)
    raw_id_fields = ("tenant", "academic_year", "sequence")


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = (  # type: ignore
        "name",
        "exam_type",
        "term",
        "academic_year",
        "weight",
        "is_published",
    )
    list_filter = ("exam_type", "is_published", "tenant")
    search_fields = ("name",)
    readonly_fields = ("id",)


@admin.register(ExamResult)
class ExamResultAdmin(admin.ModelAdmin):
    list_display = (  # type: ignore
        "student",
        "subject",
        "exam",
        "score",
        "letter_grade",
        "points",
    )
    list_filter = ("exam", "subject")
    search_fields = ("student__first_name", "student__last_name")
    readonly_fields = ("id",)
