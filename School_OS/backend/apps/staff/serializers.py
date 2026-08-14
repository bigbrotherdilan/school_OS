"""
Staff Serializers — School OS
"""
from rest_framework import serializers
from apps.staff.models import Teacher, TeachingAssignment, LeaveRequest, PerformanceReview
from apps.academic.models import Series
from apps.authentication.serializers import UserSerializer


class TeachingAssignmentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    class_name = serializers.CharField(source='academic_class.name', read_only=True)
    series_code = serializers.CharField(source='series.code', read_only=True, default=None)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    group_name = serializers.CharField(source='student_group.name', read_only=True, default=None)
    series = serializers.PrimaryKeyRelatedField(
        queryset=Series.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = TeachingAssignment
        fields = [
            'id', 'teacher', 'teacher_name', 'subject', 'subject_name',
            'academic_class', 'class_name', 'series', 'series_code',
            'student_group', 'group_name',
            'academic_year', 'academic_year_name',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'teacher': {'required': True, 'allow_null': False},
            'subject': {'required': True, 'allow_null': False},
            'academic_class': {'required': True, 'allow_null': False},
            'academic_year': {'required': True, 'allow_null': False},
        }


class TeacherSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    assignments = TeachingAssignmentSerializer(many=True, read_only=True)
    first_name = serializers.CharField(source='user.first_name', max_length=150, required=False, write_only=True)
    middle_name = serializers.CharField(source='user.middle_name', max_length=150, required=False, write_only=True)
    last_name = serializers.CharField(source='user.last_name', max_length=150, required=False, write_only=True)
    email = serializers.EmailField(source='user.email', required=False, write_only=True)

    class Meta:
        model = Teacher
        fields = [
            'id', 'user', 'user_details', 'tenant', 'employee_id',
            'qualification', 'bio', 'is_active', 'assignments',
            'department', 'phone', 'date_of_joining', 'years_of_experience',
            'specializations', 'certifications', 'teaching_philosophy',
            'achievements', 'availability', 'public_profile', 'hourly_rate',
            'subjects_taught', 'languages_spoken', 'average_rating', 'total_reviews',
            'first_name', 'middle_name', 'last_name', 'email',
        ]
        read_only_fields = ['id', 'tenant', 'average_rating', 'total_reviews']

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        if user_data:
            user = instance.user
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save()
        return super().update(instance, validated_data)


class TeacherOnboardSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    default_language = serializers.ChoiceField(choices=[('en', 'English'), ('fr', 'French')], default='en')

    qualification = serializers.CharField(max_length=255, required=False, allow_blank=True)
    employee_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True)

    subject_id = serializers.IntegerField(required=True)
    class_id = serializers.IntegerField(required=True)
    academic_year_id = serializers.IntegerField(required=True)

    def validate_email(self, value):
        from apps.authentication.models import User
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists in the system.")
        return value


class LeaveRequestSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = '__all__'


class PerformanceReviewSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.user.full_name', read_only=True)
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = PerformanceReview
        fields = '__all__'

    def get_reviewer_name(self, obj):
        if obj.reviewer:
            return obj.reviewer.full_name
        return None
