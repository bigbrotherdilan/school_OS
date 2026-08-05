from django.contrib import admin
from apps.academic.models import (
    AcademicYear, Term, Cycle, Section, Series, Class, Subject, ClassSubject
)


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active', 'tenant')
    search_fields = ('name', 'tenant__school_name')
    readonly_fields = ('id',)


@admin.register(Term)
class TermAdmin(admin.ModelAdmin):
    list_display = ('name', 'order_number', 'academic_year', 'start_date', 'end_date')
    list_filter = ('academic_year',)
    search_fields = ('name',)
    readonly_fields = ('id',)


@admin.register(Cycle)
class CycleAdmin(admin.ModelAdmin):
    list_display = ('name', 'order', 'tenant')
    list_filter = ('order', 'tenant')
    readonly_fields = ('id',)


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'language')
    list_filter = ('name', 'language', 'tenant')
    search_fields = ('tenant__school_name',)
    readonly_fields = ('id',)


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'cycle', 'stream', 'tenant')
    list_filter = ('cycle', 'stream', 'tenant')
    search_fields = ('code', 'name')
    readonly_fields = ('id',)


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ('name', 'cycle', 'stream', 'tenant', 'level_order')
    list_filter = ('cycle', 'stream', 'tenant')
    search_fields = ('name',)
    readonly_fields = ('id',)


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'cycle', 'tenant', 'default_coefficient', 'is_compulsory')
    list_filter = ('cycle', 'tenant', 'is_compulsory')
    search_fields = ('name', 'code')
    readonly_fields = ('id',)


@admin.register(ClassSubject)
class ClassSubjectAdmin(admin.ModelAdmin):
    list_display = ('academic_class', 'subject', 'series', 'coefficient')
    list_filter = ('academic_class', 'series')
    readonly_fields = ('id',)
