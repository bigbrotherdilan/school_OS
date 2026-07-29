"""
Student Serializers — School OS
"""
from rest_framework import serializers
from apps.students.models import Student, ParentStudentRelationship, DisciplineRecord, TransferRequest, PromotionHistory


class StudentSerializer(serializers.ModelSerializer):
    class_display = serializers.SerializerMethodField()
    section_display = serializers.SerializerMethodField()
    series_code = serializers.CharField(source='series.code', read_only=True, default=None)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'tenant', 'admission_number', 'first_name',
            'last_name', 'full_name', 'gender', 'date_of_birth',
            'photo_url', 'blood_group', 'emergency_contact',
            'current_class', 'class_display', 'stream',
            'section_display', 'series', 'series_code',
            'status', 'enrolled_date', 'created_at',
        ]
        read_only_fields = ['id', 'tenant', 'admission_number', 'created_at']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    def get_class_display(self, obj):
        return obj.current_class.name if obj.current_class else None

    def get_section_display(self, obj):
        return obj.stream.name if obj.stream else None


class StudentCreateSerializer(StudentSerializer):
    class Meta(StudentSerializer.Meta):
        read_only_fields = ['id', 'tenant', 'admission_number', 'created_at']


class ParentStudentLinkSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent_user.full_name', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)

    class Meta:
        model = ParentStudentRelationship
        fields = [
            'id', 'parent_user', 'parent_name', 'student',
            'student_name', 'relationship_type',
        ]


class DisciplineRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    reported_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DisciplineRecord
        fields = '__all__'

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"

    def get_reported_by_name(self, obj):
        if obj.reported_by and obj.reported_by.user:
            return obj.reported_by.user.full_name
        return None


class TransferRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TransferRequest
        fields = '__all__'

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.full_name
        return None


class PromotionHistorySerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    from_class_name = serializers.SerializerMethodField()
    to_class_name = serializers.SerializerMethodField()

    class Meta:
        model = PromotionHistory
        fields = '__all__'

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"

    def get_from_class_name(self, obj):
        return obj.from_class.name if obj.from_class else None

    def get_to_class_name(self, obj):
        return obj.to_class.name if obj.to_class else None
