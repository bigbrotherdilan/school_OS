from rest_framework import serializers
from .models import Timetable, TimeSlot, Lesson, TeacherUnavailability, StudentGroup, Room, TeacherAllocation
from ..academic.serializers import ClassSerializer, SubjectSerializer
from ..staff.serializers import TeacherSerializer
from .conflicts import slot_conflicts, timetable_cell_states


class StudentGroupSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='academic_class.name', read_only=True)

    class Meta:
        model = StudentGroup
        fields = ['id', 'tenant', 'academic_class', 'class_name', 'name', 'is_full_cohort', 'order']
        read_only_fields = ['id', 'tenant']


class RoomSerializer(serializers.ModelSerializer):
    room_type_display = serializers.CharField(source='get_room_type_display', read_only=True)

    class Meta:
        model = Room
        fields = ['id', 'tenant', 'name', 'capacity', 'room_type', 'room_type_display', 'note']
        read_only_fields = ['id', 'tenant']


class TeacherAllocationSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    teacher_status = serializers.SerializerMethodField()

    def get_teacher_name(self, obj):
        if obj.teacher and hasattr(obj.teacher, 'user') and obj.teacher.user:
            return obj.teacher.user.full_name
        return 'TBD'

    def get_teacher_status(self, obj):
        return 'UNASSIGNED' if obj.teacher_id is None else 'ASSIGNED'

    class Meta:
        model = TeacherAllocation
        fields = ['id', 'lesson', 'teacher', 'teacher_name', 'teacher_status',
                  'periods', 'is_double', 'note', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TimeSlotSerializer(serializers.ModelSerializer):
    subject_details = SubjectSerializer(source='subject', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    class_details = ClassSerializer(source='timetable.class_obj', read_only=True)
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='timetable.class_obj.name', read_only=True)
    group_name = serializers.CharField(source='student_group.name', read_only=True, default=None)
    group_details = StudentGroupSerializer(source='student_group', read_only=True)
    room_name = serializers.CharField(source='room.name', read_only=True, default=None)
    room_details = RoomSerializer(source='room', read_only=True)
    conflict_state = serializers.SerializerMethodField()

    def get_teacher_name(self, obj):
        if obj.teacher and hasattr(obj.teacher, 'user') and obj.teacher.user:
            return obj.teacher.user.full_name
        return 'TBD'

    def get_conflict_state(self, obj):
        # Single-slot responses (create/update). Grid lists use the
        # TimetableSerializer.cell_states batch computation instead.
        return slot_conflicts(obj, obj.timetable)

    class Meta:
        model = TimeSlot
        fields = '__all__'


class LessonSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    subject_details = SubjectSerializer(source='subject', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    group_name = serializers.CharField(source='student_group.name', read_only=True, default=None)
    group_details = StudentGroupSerializer(source='student_group', read_only=True)
    allocations = TeacherAllocationSerializer(many=True, read_only=True)
    teacher_status = serializers.SerializerMethodField()

    def get_teacher_name(self, obj):
        if obj.teacher and hasattr(obj.teacher, 'user') and obj.teacher.user:
            return obj.teacher.user.full_name
        return 'TBD'

    def get_teacher_status(self, obj):
        """
        ASSIGNED  — a real teacher owns the lesson (whole-lesson teacher or
                    every allocation has a teacher)
        SUGGESTED — no teacher assigned yet, but a TeachingAssignment
                    recommends one (the subject is covered by the roster)
        UNASSIGNED— teacher_id = NULL, TBD: reserves no real teacher resource
        """
        allocs = list(obj.allocations.all())
        if obj.teacher_id is not None:
            return 'ASSIGNED'
        if allocs:
            return 'ASSIGNED' if all(a.teacher_id for a in allocs) else 'UNASSIGNED'
        from apps.staff.models import TeachingAssignment
        exists = TeachingAssignment.objects.filter(
            subject=obj.subject
        ).filter(
            teacher__isnull=False
        ).exists()
        return 'SUGGESTED' if exists else 'UNASSIGNED'

    placed_periods = serializers.SerializerMethodField()

    def get_placed_periods(self, obj):
        return obj.slots.count()

    class Meta:
        model = Lesson
        fields = '__all__'


class TeacherUnavailabilitySerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = TeacherUnavailability
        fields = '__all__'
        read_only_fields = ['tenant']


class TimetableSerializer(serializers.ModelSerializer):
    slots = TimeSlotSerializer(many=True, read_only=True)
    lessons = LessonSerializer(many=True, read_only=True)
    class_details = ClassSerializer(source='class_obj', read_only=True)
    class_name = serializers.CharField(source='class_obj.name', read_only=True)
    section_name = serializers.SerializerMethodField()
    term_name = serializers.CharField(source='term.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    student_groups = StudentGroupSerializer(source='class_obj.student_groups', many=True, read_only=True)
    rooms = RoomSerializer(source='tenant.rooms', many=True, read_only=True)
    committed = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    cell_states = serializers.SerializerMethodField()

    def get_section_name(self, obj):
        stream = obj.class_obj.stream if obj.class_obj else None
        return stream.name if stream else 'General'

    def get_committed(self, obj):
        return obj.is_committed()

    def get_approved_by_name(self, obj):
        if obj.approved_by and hasattr(obj.approved_by, 'get_full_name'):
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def get_cell_states(self, obj):
        # Batch-computed RED/YELLOW/GRAY/GREEN state per slot for the grid UI.
        return timetable_cell_states(obj)

    class Meta:
        model = Timetable
        fields = '__all__'
        read_only_fields = ['tenant', 'academic_year', 'generation_status', 'generation_message',
                            'generation_score', 'last_generated_at', 'approved_at', 'approved_by']