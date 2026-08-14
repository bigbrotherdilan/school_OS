from django.contrib import admin
from apps.students.models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['admission_number', 'first_name', 'last_name', 'gender', 'current_class', 'stream', 'status', 'tenant']
    list_filter = ['status', 'gender', 'stream', 'tenant']
    search_fields = ['first_name', 'middle_name', 'last_name', 'admission_number']
    readonly_fields = ['id', 'admission_number', 'created_at', 'updated_at']
    raw_id_fields = ['tenant', 'stream', 'current_class']
