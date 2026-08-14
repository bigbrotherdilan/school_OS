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
            'middle_name', 'last_name', 'full_name', 'gender', 'date_of_birth',
            'photo_url', 'blood_group', 'emergency_contact',
            'current_class', 'class_display', 'stream',
            'section_display', 'series', 'series_code',
            'status', 'enrolled_date', 'created_at',
        ]
        read_only_fields = ['id', 'tenant', 'admission_number', 'created_at']

    def get_full_name(self, obj):
        return obj.full_name

    def get_class_display(self, obj):
        return obj.current_class.name if obj.current_class else None

    def get_section_display(self, obj):
        return obj.stream.name if obj.stream else None


class StudentCreateSerializer(StudentSerializer):
    # Optional registration-time parent account. All-or-nothing: if any parent
    # field is sent, all three (name/phone/email) must be present or the
    # registration fails instead of silently dropping the guardian.
    parent_name = serializers.CharField(max_length=300, required=False, allow_blank=True, write_only=True)
    parent_phone = serializers.CharField(max_length=30, required=False, allow_blank=True, write_only=True)
    parent_email = serializers.EmailField(required=False, allow_blank=True, write_only=True)
    relationship_type = serializers.ChoiceField(
        choices=['father', 'mother', 'guardian'], required=False, write_only=True)

    class Meta(StudentSerializer.Meta):
        read_only_fields = ['id', 'tenant', 'admission_number', 'created_at']
        fields = StudentSerializer.Meta.fields + [
            'parent_name', 'parent_phone', 'parent_email', 'relationship_type',
        ]
        extra_kwargs = {
            'current_class': {'required': False, 'allow_null': True},
            'stream': {'required': False, 'allow_null': True},
            'series': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        parent_name = (attrs.get('parent_name') or '').strip()
        parent_email = (attrs.get('parent_email') or '').strip()
        parent_phone = (attrs.get('parent_phone') or '').strip()
        any_parent_field = bool(parent_name or parent_email or parent_phone)
        if any_parent_field and not (parent_name and parent_email):
            raise serializers.ValidationError(
                'To create the parent account, name and email are required '
                '(phone is optional). Leave all parent fields blank to register '
                'without a parent account.'
            )

        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None)
        if tenant is not None:
            for field in ('current_class', 'stream', 'series'):
                obj = attrs.get(field)
                if obj is not None and obj.tenant_id != tenant.id:
                    raise serializers.ValidationError({field: 'Must belong to this school.'})

            stream = attrs.get('stream')
            current_class = attrs.get('current_class')
            if current_class is not None and current_class.stream_id and stream and current_class.stream_id != stream.id:
                raise serializers.ValidationError(
                    {'stream': 'The section must match the class section.'}
                )

            series = attrs.get('series')
            if series is not None and stream is not None:
                if series.stream_id and series.stream_id != stream.id:
                    raise serializers.ValidationError(
                        {'series': 'The series must belong to the selected section.'}
                    )
        return attrs

    def create(self, validated_data):
        for field in ('parent_name', 'parent_phone', 'parent_email', 'relationship_type'):
            validated_data.pop(field, None)
        return super().create(validated_data)


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
