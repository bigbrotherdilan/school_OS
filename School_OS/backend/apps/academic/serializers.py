"""
Academic Serializers — School OS
"""
from rest_framework import serializers
from apps.academic.models import (
    AcademicYear, Term, Sequence, Cycle, Section, Series, Class, Subject, ClassSubject
)


class SequenceSerializer(serializers.ModelSerializer):
    term_name = serializers.CharField(source='term.name', read_only=True)
    academic_year_id = serializers.IntegerField(source='term.academic_year_id', read_only=True)

    class Meta:
        model = Sequence
        fields = ['id', 'term', 'term_name', 'academic_year_id', 'name', 'order_number']
        read_only_fields = ['order_number', 'name']


class TermSerializer(serializers.ModelSerializer):
    sequences = SequenceSerializer(many=True, read_only=True)

    class Meta:
        model = Term
        fields = ['id', 'academic_year', 'name', 'order_number', 'start_date', 'end_date', 'sequences']


class AcademicYearSerializer(serializers.ModelSerializer):
    terms = TermSerializer(many=True, read_only=True)

    class Meta:
        model = AcademicYear
        fields = [
            'id', 'tenant', 'name', 'start_date',
            'end_date', 'is_active', 'terms'
        ]
        read_only_fields = ['id', 'tenant']


class CycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cycle
        fields = ['id', 'tenant', 'name', 'order']
        read_only_fields = ['id', 'tenant']


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ['id', 'tenant', 'name', 'language']
        read_only_fields = ['id', 'tenant']


class SeriesSerializer(serializers.ModelSerializer):
    cycle_name = serializers.CharField(source='cycle.name', read_only=True)

    class Meta:
        model = Series
        fields = ['id', 'tenant', 'cycle', 'cycle_name', 'stream', 'code', 'name']
        read_only_fields = ['id', 'tenant']


class ClassSerializer(serializers.ModelSerializer):
    cycle_name = serializers.CharField(source='cycle.name', read_only=True)
    section_display = serializers.CharField(source='stream.name', read_only=True, default=None)

    class Meta:
        model = Class
        fields = [
            'id', 'tenant', 'cycle', 'cycle_name', 'stream', 'section_display',
            'name', 'level_order',
        ]
        read_only_fields = ['id', 'tenant']


class SubjectSerializer(serializers.ModelSerializer):
    cycle_name = serializers.CharField(source='cycle.name', read_only=True, default=None)

    class Meta:
        model = Subject
        fields = [
            'id', 'tenant', 'cycle', 'cycle_name',
            'name', 'code', 'default_coefficient', 'is_compulsory',
        ]
        read_only_fields = ['id', 'tenant']


class ClassSubjectSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    series_code = serializers.CharField(source='series.code', read_only=True, default=None)

    class Meta:
        model = ClassSubject
        fields = ['id', 'academic_class', 'subject', 'subject_name', 'series', 'series_code', 'coefficient']
        read_only_fields = ['id']
