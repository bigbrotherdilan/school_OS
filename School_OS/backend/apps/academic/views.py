"""
Academic Views — School OS
"""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.academic.models import (
    AcademicYear, Term, Sequence, Cycle, Section, Series, Class, Subject, ClassSubject
)
from apps.academic.serializers import (
    AcademicYearSerializer, TermSerializer, SequenceSerializer, CycleSerializer,
    SectionSerializer, SeriesSerializer, ClassSerializer,
    SubjectSerializer, ClassSubjectSerializer,
)
from apps.authentication.permissions import IsSchoolAdmin, IsAdminOrTeacher


class BaseTenantViewSet(viewsets.ModelViewSet):
    """
    Abstract ViewSet to enforce tenant filtering and ownership.
    All data access is scoped to the current tenant.
    """
    permission_classes = [IsSchoolAdmin]
    lookup_field = 'id'
    allow_delete = True

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        if not tenant_id:
            return self.queryset.none()
        return self.queryset.filter(tenant_id=tenant_id)

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)

    def perform_update(self, serializer):
        instance = self.get_object()
        if str(instance.tenant_id) != self.request.tenant_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to modify this resource.')
        serializer.save()

    def perform_destroy(self, instance):
        if not self.allow_delete:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'Deletion is not allowed for this resource. '
                'Use cancellation or deactivation instead.'
            )
        if str(instance.tenant_id) != self.request.tenant_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to delete this resource.')
        instance.delete()


class AcademicYearViewSet(BaseTenantViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer

    @action(detail=True, methods=['post'])
    def set_active(self, request, id=None):
        year = self.get_object()
        year.is_active = True
        year.save()
        return Response({'status': 'activated'})


class TermViewSet(viewsets.ModelViewSet):
    queryset = Term.objects.all()
    serializer_class = TermSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAdminOrTeacher()]
        return [IsSchoolAdmin()]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        return self.queryset.filter(academic_year__tenant_id=tenant_id)


class SequenceViewSet(viewsets.ModelViewSet):
    queryset = Sequence.objects.all()
    serializer_class = SequenceSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAdminOrTeacher()]
        return [IsSchoolAdmin()]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = self.queryset.filter(term__academic_year__tenant_id=tenant_id)
        term_id = self.request.query_params.get('term')
        if term_id:
            qs = qs.filter(term_id=term_id)
        return qs


class CycleViewSet(BaseTenantViewSet):
    queryset = Cycle.objects.all()
    serializer_class = CycleSerializer


class SectionViewSet(BaseTenantViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer


class SeriesViewSet(BaseTenantViewSet):
    queryset = Series.objects.all()
    serializer_class = SeriesSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        stream_id = self.request.query_params.get('stream')
        cycle_id = self.request.query_params.get('cycle')
        if stream_id:
            qs = qs.filter(stream_id=stream_id)
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        return qs


class ClassViewSet(BaseTenantViewSet):
    queryset = Class.objects.all()
    serializer_class = ClassSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        stream_id = self.request.query_params.get('stream')
        cycle_id = self.request.query_params.get('cycle')
        if stream_id:
            qs = qs.filter(stream_id=stream_id)
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        return qs


class SubjectViewSet(BaseTenantViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrTeacher]


class ClassSubjectViewSet(BaseTenantViewSet):
    queryset = ClassSubject.objects.all()
    serializer_class = ClassSubjectSerializer
    permission_classes = [IsAdminOrTeacher]
