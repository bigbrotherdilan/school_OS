from rest_framework import serializers
from .models import GradeScale, GradeBoundary, MarkEntryWindow, Exam, ExamResult


class GradeBoundarySerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeBoundary
        fields = '__all__'


class GradeScaleSerializer(serializers.ModelSerializer):
    boundaries = GradeBoundarySerializer(many=True, read_only=True)

    class Meta:
        model = GradeScale
        fields = '__all__'


class MarkEntryWindowSerializer(serializers.ModelSerializer):
    sequence_name = serializers.SerializerMethodField()
    term_name = serializers.SerializerMethodField()

    class Meta:
        model = MarkEntryWindow
        fields = '__all__'
        read_only_fields = ['tenant']

    def get_sequence_name(self, obj):
        return f"{obj.sequence.name} ({obj.sequence.term.name})" if obj.sequence_id else None

    def get_term_name(self, obj):
        return obj.sequence.term.name if obj.sequence_id else None


class ExamSerializer(serializers.ModelSerializer):
    term_name = serializers.SerializerMethodField()
    sequences_status = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = '__all__'
        read_only_fields = ['tenant']

    def get_term_name(self, obj):
        return obj.term.name if obj.term_id else None

    def get_sequences_status(self, obj):
        from .models import MarkEntryWindow
        sequences = obj.term.sequences.all().order_by('order_number')
        windows = {
            w.sequence_id: w.is_open
            for w in MarkEntryWindow.objects.filter(sequence__term=obj.term)
        }
        return [
            {
                'id': str(s.id),
                'name': s.name,
                'order': s.order_number,
                'is_open': windows.get(s.id, False),
            }
            for s in sequences
        ]


class ExamResultSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    sequence_name = serializers.SerializerMethodField()

    class Meta:
        model = ExamResult
        fields = '__all__'

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"

    def get_sequence_name(self, obj):
        return obj.sequence.name if obj.sequence_id else None
