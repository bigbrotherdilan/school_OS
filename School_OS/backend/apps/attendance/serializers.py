from rest_framework import serializers
from .models import AttendanceSession, AttendanceRecord

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'session', 'student', 'student_name', 'status', 'remarks']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"

class AttendanceSessionSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='academic_class.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    record_count = serializers.IntegerField(source='records.count', read_only=True)

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'tenant', 'academic_class', 'class_name', 'subject', 'subject_name',
            'teacher', 'teacher_name', 'term', 'date', 'start_time', 'record_count'
        ]

    def get_teacher_name(self, obj):
        return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}"
