from rest_framework import serializers
from .models import SchemeOfWork, LogbookEntry, CurriculumModule, CurriculumLesson

class CurriculumLessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = CurriculumLesson
        fields = '__all__'

class CurriculumModuleSerializer(serializers.ModelSerializer):
    lessons = CurriculumLessonSerializer(many=True, read_only=True)
    class Meta:
        model = CurriculumModule
        fields = '__all__'

class SchemeOfWorkSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='class_obj.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    
    class Meta:
        model = SchemeOfWork
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'academic_year', 'term', 'subject', 'class_obj']

class LogbookEntrySerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    scheme_topic = serializers.CharField(source='scheme_of_work.topic', read_only=True)
    lessons_details = CurriculumLessonSerializer(source='lessons_covered', many=True, read_only=True)
    
    class Meta:
        model = LogbookEntry
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'teacher', 'is_validated', 'validated_by', 'is_locked', 'signature_hash', 'signed_at']
