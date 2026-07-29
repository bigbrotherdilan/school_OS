from rest_framework import serializers
from .models import Timetable, TimeSlot
from ..academic.serializers import ClassSerializer, SubjectSerializer
from ..staff.serializers import TeacherSerializer

class TimeSlotSerializer(serializers.ModelSerializer):
    subject_details = SubjectSerializer(source='subject', read_only=True)
    teacher_details = TeacherSerializer(source='teacher', read_only=True)
    class_details = ClassSerializer(source='timetable.class_obj', read_only=True)
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = TimeSlot
        fields = '__all__'

class TimetableSerializer(serializers.ModelSerializer):
    slots = TimeSlotSerializer(many=True, read_only=True)
    class_details = ClassSerializer(source='class_obj', read_only=True)

    class Meta:
        model = Timetable
        fields = '__all__'
