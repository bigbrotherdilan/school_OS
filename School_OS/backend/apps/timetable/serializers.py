from rest_framework import serializers
from .models import Timetable, TimeSlot, Lesson, TeacherUnavailability
from ..academic.serializers import ClassSerializer, SubjectSerializer
from ..staff.serializers import TeacherSerializer

class TimeSlotSerializer(serializers.ModelSerializer):
    subject_details = SubjectSerializer(source='subject', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    class_details = ClassSerializer(source='timetable.class_obj', read_only=True)
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    class_name = serializers.CharField(source='timetable.class_obj.name', read_only=True)

    class Meta:
        model = TimeSlot
        fields = '__all__'

class LessonSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    subject_details = SubjectSerializer(source='subject', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
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

class TimetableSerializer(serializers.ModelSerializer):
    slots = TimeSlotSerializer(many=True, read_only=True)
    lessons = LessonSerializer(many=True, read_only=True)
    class_details = ClassSerializer(source='class_obj', read_only=True)
    class_name = serializers.CharField(source='class_obj.name', read_only=True)
    section_name = serializers.SerializerMethodField()
    term_name = serializers.CharField(source='term.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)

    def get_section_name(self, obj):
        stream = obj.class_obj.stream if obj.class_obj else None
        return stream.name if stream else 'General'

    class Meta:
        model = Timetable
        fields = '__all__'
        read_only_fields = ['tenant', 'academic_year', 'generation_status', 'generation_message',
                            'generation_score', 'last_generated_at']
