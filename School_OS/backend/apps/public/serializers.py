"""
Public API Serializers — Data minimization.
Only expose what visitors need. No internal IDs, emails, or phone numbers
unless explicitly required for the feature.
"""
from rest_framework import serializers
from apps.tenants.models import Tenant
from apps.finance.models import FeeStructure, FeeCategory
from apps.academic.models import Class, AcademicYear, Cycle


class PublicSchoolListSerializer(serializers.ModelSerializer):
    """School directory listing — minimal public data."""
    education_type_display = serializers.CharField(
        source='get_education_type_display', read_only=True
    )
    student_count = serializers.SerializerMethodField()
    class_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            'school_name', 'slug', 'region', 'division', 'address',
            'education_type', 'education_type_display',
            'school_type', 'motto', 'logo_url',
            'student_count', 'class_count',
        ]

    def get_student_count(self, obj):
        return getattr(obj, '_student_count', None)

    def get_class_count(self, obj):
        return getattr(obj, '_class_count', None)


class PublicFeeStructureSerializer(serializers.ModelSerializer):
    """Fee structure for public profile — amount only, no internal IDs."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    class_name = serializers.SerializerMethodField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)

    class Meta:
        model = FeeStructure
        fields = ['category_name', 'class_name', 'amount']

    def get_class_name(self, obj):
        if obj.target_class:
            return obj.target_class.name
        return None


class PublicClassSerializer(serializers.ModelSerializer):
    """Class info for public profile."""
    cycle_name = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = ['name', 'level_order', 'cycle_name']

    def get_cycle_name(self, obj):
        return obj.cycle.name if obj.cycle_id else None


class PublicSchoolProfileSerializer(serializers.ModelSerializer):
    """School profile for public viewing — no internal IDs or contact details."""
    education_type_display = serializers.CharField(
        source='get_education_type_display', read_only=True
    )
    school_type_display = serializers.CharField(
        source='get_school_type_display', read_only=True
    )
    classes = serializers.SerializerMethodField()
    fee_structures = serializers.SerializerMethodField()
    active_academic_year = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    teacher_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            'id', 'school_name', 'slug', 'region', 'division', 'country',
            'education_type', 'education_type_display',
            'school_type', 'school_type_display',
            'session_type', 'address', 'motto', 'logo_url',
            'classes', 'fee_structures', 'active_academic_year',
            'student_count', 'teacher_count',
        ]

    def get_classes(self, obj):
        classes = Class.objects.filter(tenant=obj).select_related('cycle').order_by('cycle__order', 'level_order')
        return PublicClassSerializer(classes, many=True).data

    def get_fee_structures(self, obj):
        active_year = AcademicYear.objects.filter(tenant=obj, is_active=True).first()
        if not active_year:
            return []
        fees = FeeStructure.objects.filter(
            tenant=obj, academic_year=active_year
        ).select_related('category', 'target_class').order_by('target_class__level_order', 'category__name')
        return PublicFeeStructureSerializer(fees, many=True).data

    def get_active_academic_year(self, obj):
        year = AcademicYear.objects.filter(tenant=obj, is_active=True).first()
        if year:
            return {'name': year.name}
        return None

    def get_student_count(self, obj):
        from django.apps import apps
        Student = apps.get_model('students', 'Student')
        return Student.objects.filter(tenant=obj, status__in=['active', 'registered']).count()

    def get_teacher_count(self, obj):
        from django.apps import apps
        Teacher = apps.get_model('staff', 'Teacher')
        return Teacher.objects.filter(tenant=obj, is_active=True).count()
