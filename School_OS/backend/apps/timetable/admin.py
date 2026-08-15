from django.contrib import admin

from .models import (
    Timetable, TimeSlot, Lesson, TeacherUnavailability, StudentGroup, Room, TeacherAllocation,
)


@admin.register(Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display = ('class_obj', 'academic_year', 'term', 'generation_status', 'is_active')
    list_filter = ('generation_status', 'is_active', 'academic_year')
    search_fields = ('class_obj__name',)
    list_select_related = ('class_obj', 'academic_year', 'term')


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ('timetable', 'day_of_week', 'start_time', 'subject', 'teacher', 'student_group', 'room')
    list_filter = ('day_of_week', 'is_locked')
    search_fields = ('timetable__class_obj__name', 'subject__name')


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('timetable', 'subject', 'teacher', 'student_group', 'periods_per_week', 'is_double')
    list_filter = ('is_double',)
    search_fields = ('timetable__class_obj__name', 'subject__name')


@admin.register(TeacherUnavailability)
class TeacherUnavailabilityAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'day_of_week', 'start_time', 'end_time', 'reason')
    list_filter = ('day_of_week',)
    search_fields = ('teacher__user__full_name',)


@admin.register(StudentGroup)
class StudentGroupAdmin(admin.ModelAdmin):
    list_display = ('academic_class', 'name', 'is_full_cohort', 'order')
    list_filter = ('is_full_cohort',)
    search_fields = ('academic_class__name', 'name')


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'room_type', 'capacity')
    list_filter = ('room_type',)
    search_fields = ('name',)


@admin.register(TeacherAllocation)
class TeacherAllocationAdmin(admin.ModelAdmin):
    list_display = ('lesson', 'teacher', 'periods', 'is_double', 'note')
    list_filter = ('is_double',)
    search_fields = ('lesson__subject__name', 'teacher__user__full_name')