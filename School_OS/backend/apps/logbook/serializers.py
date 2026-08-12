from rest_framework import serializers
from .models import SchemeOfWork, LogbookEntry, CurriculumModule, CurriculumLesson

class CurriculumLessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = CurriculumLesson
        fields = '__all__'

class CurriculumModuleSerializer(serializers.ModelSerializer):
    lessons = CurriculumLessonSerializer(many=True, read_only=True)
    class_name = serializers.CharField(source='academic_class.name', read_only=True, default=None)
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = CurriculumModule
        fields = '__all__'

class SchemeOfWorkSerializer(serializers.ModelSerializer):
    """
    Shared read fields for a scheme week (admin + teacher views).
    """
    class_name = serializers.CharField(source='class_obj.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    term_name = serializers.CharField(source='term.name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    term_id = serializers.PrimaryKeyRelatedField(source='term', read_only=True)
    academic_year_id = serializers.PrimaryKeyRelatedField(source='academic_year', read_only=True)

    class Meta:
        model = SchemeOfWork
        fields = [
            'id', 'tenant', 'academic_year', 'academic_year_id', 'term', 'term_id', 'term_name',
            'subject', 'class_obj', 'week_number', 'topic', 'objectives',
            'expected_outcome', 'essential_knowledge', 'homework',
            'status', 'taught_at', 'taught_by', 'teacher_name', 'notes',
            'class_name', 'subject_name',
        ]
        read_only_fields = [
            'id', 'tenant', 'academic_year', 'academic_year_id', 'term', 'term_id', 'term_name',
            'status', 'taught_at', 'taught_by', 'teacher_name',
            'class_name', 'subject_name',
        ]

    def get_teacher_name(self, obj):
        if obj.taught_by and getattr(obj.taught_by, 'user', None):
            return obj.taught_by.user.full_name
        return None


class SchemeOfWorkAdminSerializer(SchemeOfWorkSerializer):
    """
    Admin (Studies Office) may author the plan: select subject/class/term/year
    and edit the week content. Taught bookkeeping stays server-owned.
    """
    class Meta(SchemeOfWorkSerializer.Meta):
        read_only_fields = [
            'id', 'tenant', 'status', 'taught_at', 'taught_by', 'teacher_name',
            'class_name', 'subject_name', 'term_name',
        ]


class SchemeOfWorkTeacherSerializer(SchemeOfWorkSerializer):
    """
    Teachers see the full plan read-only and may only edit their `notes`.
    Status changes go through mark_taught / mark_planned actions.
    """
    class Meta(SchemeOfWorkSerializer.Meta):
        fields = SchemeOfWorkSerializer.Meta.fields + ['is_writable']
        read_only_fields = [
            'id', 'tenant', 'academic_year', 'academic_year_id', 'term', 'term_id', 'term_name',
            'subject', 'class_obj', 'week_number', 'topic', 'objectives',
            'expected_outcome', 'essential_knowledge', 'homework',
            'status', 'taught_at', 'taught_by', 'teacher_name',
            'class_name', 'subject_name', 'is_writable',
        ]

    is_writable = serializers.SerializerMethodField()

    def get_is_writable(self, obj):
        request = self.context.get('request')
        if request is None or not getattr(request, 'user', None) or request.user.is_anonymous:
            return False
        user = request.user
        if user.role_mappings.filter(tenant_id=request.tenant_id, role__in=['admin', 'super_admin']).exists():
            return True
        from ..staff.models import Teacher, TeachingAssignment
        teacher = Teacher.objects.filter(user=user, tenant_id=request.tenant_id).first()
        if teacher is None:
            return False
        return TeachingAssignment.objects.filter(
            teacher=teacher,
            subject=obj.subject,
            academic_class=obj.class_obj,
            academic_year=obj.academic_year,
        ).exists()

class LogbookEntrySerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    scheme_topic = serializers.CharField(source='scheme_of_work.topic', read_only=True)
    lessons_details = CurriculumLessonSerializer(source='lessons_covered', many=True, read_only=True)
    
    class Meta:
        model = LogbookEntry
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'teacher', 'is_validated', 'validated_by', 'is_locked', 'signature_hash', 'signed_at']
