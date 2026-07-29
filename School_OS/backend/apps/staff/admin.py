from django.contrib import admin
from apps.staff.models import Teacher, TeachingAssignment, LeaveRequest, PerformanceReview


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['user', 'tenant', 'employee_id', 'qualification', 'is_active']
    list_filter = ['is_active', 'tenant']
    search_fields = ['user__first_name', 'user__last_name', 'user__email', 'employee_id']
    readonly_fields = ['id']
    raw_id_fields = ['user', 'tenant']


@admin.register(TeachingAssignment)
class TeachingAssignmentAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'subject', 'academic_class', 'academic_year']
    list_filter = ['academic_year', 'subject', 'academic_class']
    search_fields = ['teacher__user__last_name', 'subject__name', 'academic_class__name']
    readonly_fields = ['id']
    raw_id_fields = ['teacher', 'subject', 'academic_class', 'academic_year']


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'start_date', 'end_date', 'status']
    list_filter = ['status']
    search_fields = ['teacher__user__last_name', 'reason']


@admin.register(PerformanceReview)
class PerformanceReviewAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'reviewer', 'review_date', 'score']
    list_filter = ['score']
    search_fields = ['teacher__user__last_name', 'comments']
