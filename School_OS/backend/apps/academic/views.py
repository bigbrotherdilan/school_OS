"""
Academic Views — School OS
"""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from apps.academic.models import (
    AcademicYear, Term, Sequence, Cycle, Section, Series, Class, Subject,
    ClassSubject, SectionSubject,
)
from apps.academic.serializers import (
    AcademicYearSerializer, TermSerializer, SequenceSerializer, CycleSerializer,
    SectionSerializer, SeriesSerializer, ClassSerializer,
    SubjectSerializer, ClassSubjectSerializer, SectionSubjectSerializer,
)
from apps.academic.curriculum import recommended_subjects, recommended_classes
from apps.authentication.permissions import (
    IsSchoolAdmin, IsAdminOrTeacher, IsSchoolAdminOrBursar,
)


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

    def perform_destroy(self, instance):
        from apps.students.models import Student
        student_count = (
            Student.objects.filter(stream=instance).count()
            + Student.objects.filter(current_class__stream=instance).count()
        )
        if student_count > 0:
            raise PermissionDenied(
                f'Cannot delete "{instance.name}": {student_count} enrolled student(s) '
                'still belong to this section. Move or delete them first.'
            )
        super().perform_destroy(instance)


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

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [IsSchoolAdminOrBursar()]
        return [IsSchoolAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        stream_id = self.request.query_params.get('stream')
        cycle_id = self.request.query_params.get('cycle')
        if stream_id:
            qs = qs.filter(stream_id=stream_id)
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        return qs

    @action(detail=False, methods=['get'], url_path='recommended')
    def recommended(self, request):
        """
        GET /api/v1/academic/classes/recommended/
        Standard Cameroon class structure (Form 1–Upper Sixth / 6ème–Terminale)
        for a section's language. Query params: section=<id>.
        Each item is flagged already_exists.
        """
        section_id = request.query_params.get('section')
        if not section_id:
            return Response({'detail': 'section is required.'}, status=400)

        try:
            section = Section.objects.get(id=section_id, tenant_id=request.tenant_id)
        except Section.DoesNotExist:
            return Response({'detail': 'Section not found.'}, status=404)

        existing_names = set(
            Class.objects.filter(tenant_id=request.tenant_id, stream=section)
            .values_list('name', flat=True)
        )

        items = []
        for name, level_order, cycle_order in recommended_classes(section.language or 'en'):
            items.append({
                'name': name,
                'level_order': level_order,
                'cycle_order': cycle_order,
                'already_exists': name in existing_names,
            })

        return Response({'language': section.language, 'items': items})

    @action(detail=False, methods=['post'], url_path='apply-recommendations')
    def apply_recommendations(self, request):
        """
        POST /api/v1/academic/classes/apply-recommendations/
        One-click onboarding: creates the standard Cameroon class structure for
        the section (Form 1–Upper Sixth or 6ème–Terminale), skipping any that
        already exist. Body: {"section": <id>}
        """
        section_id = request.data.get('section')
        if not section_id:
            return Response({'detail': 'section is required.'}, status=400)

        try:
            section = Section.objects.get(id=section_id, tenant_id=request.tenant_id)
        except Section.DoesNotExist:
            return Response({'detail': 'Section not found.'}, status=404)

        cycles = {c.order: c for c in Cycle.objects.filter(tenant_id=request.tenant_id)}
        existing_names = set(
            Class.objects.filter(tenant_id=request.tenant_id, stream=section)
            .values_list('name', flat=True)
        )

        created_count = 0
        created = []
        for name, level_order, cycle_order in recommended_classes(section.language or 'en'):
            if name in existing_names:
                continue
            cls_obj = Class.objects.create(
                tenant_id=request.tenant_id,
                cycle=cycles.get(cycle_order),
                stream=section,
                name=name,
                level_order=level_order,
            )
            existing_names.add(name)
            created_count += 1
            created.append(cls_obj)

        serializer = ClassSerializer(created, many=True)
        return Response({
            'detail': f'{created_count} class(es) created for {section.name}.',
            'created': created_count,
            'classes': serializer.data,
        })


def _existing_subject_map(tenant_id):
    """
    Build a lookup for a tenant's master subjects.
    Keys: subject code, or 'name:<name>' for subjects without a code.
    """
    mapping = {}
    for s in Subject.objects.filter(tenant_id=tenant_id):
        if s.code:
            mapping[s.code] = s
        mapping[f'name:{s.name}'] = s
    return mapping


def _lookup_subject(mapping, name, code):
    return mapping.get(code) or mapping.get(f'name:{name}')


class SubjectViewSet(BaseTenantViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrTeacher]

    @action(detail=False, methods=['get'], url_path='recommended')
    def recommended(self, request):
        """
        GET /api/v1/academic/subjects/recommended/
        Curated Cameroon curriculum (GCE / MINESEC) for a section.
        Query params: section=<id> or language=en|fr.
        Each item is flagged already_exists / already_assigned.
        """
        section_id = request.query_params.get('section')
        language = request.query_params.get('language')
        section = None

        if section_id:
            try:
                section = Section.objects.get(id=section_id, tenant_id=request.tenant_id)
            except Section.DoesNotExist:
                return Response({'detail': 'Section not found.'}, status=404)
            language = language or section.language or 'en'
        language = language or 'en'

        existing = _existing_subject_map(request.tenant_id)
        assigned_codes = set()
        if section:
            assigned_codes = set(
                SectionSubject.objects.filter(section=section)
                .values_list('subject__code', flat=True)
            )

        items = []
        for name, code, cycle_order, coeff, compulsory in recommended_subjects(language):
            subj = _lookup_subject(existing, name, code)
            items.append({
                'name': name,
                'code': code,
                'cycle_order': cycle_order,
                'coefficient': coeff,
                'is_compulsory': compulsory,
                'already_exists': subj is not None,
                'already_assigned': subj is not None and code in assigned_codes,
            })

        return Response({'language': language, 'items': items})

    @action(detail=False, methods=['post'], url_path='apply-recommendations')
    def apply_recommendations(self, request):
        """
        POST /api/v1/academic/subjects/apply-recommendations/
        One-click onboarding: creates the master subjects recommended for the
        section's language (if missing) and assigns the full recommended set to
        the section with their default coefficients.
        Body: {"section": <id>}
        """
        section_id = request.data.get('section')
        if not section_id:
            return Response({'detail': 'section is required.'}, status=400)

        try:
            section = Section.objects.get(id=section_id, tenant_id=request.tenant_id)
        except Section.DoesNotExist:
            return Response({'detail': 'Section not found.'}, status=404)

        language = section.language or 'en'
        cycles = {c.order: c for c in Cycle.objects.filter(tenant_id=request.tenant_id)}
        existing = _existing_subject_map(request.tenant_id)

        created_count = 0
        assigned_count = 0
        for name, code, cycle_order, coeff, compulsory in recommended_subjects(language):
            subj = _lookup_subject(existing, name, code)
            if subj is None:
                subj = Subject.objects.create(
                    tenant_id=request.tenant_id,
                    cycle=cycles.get(cycle_order) if cycle_order else None,
                    name=name,
                    code=code,
                    default_coefficient=coeff,
                    is_compulsory=compulsory,
                )
                if subj.code:
                    existing[subj.code] = subj
                existing[f'name:{subj.name}'] = subj
                created_count += 1
            _, was_created = SectionSubject.objects.get_or_create(
                section=section,
                subject=subj,
                defaults={'coefficient': subj.default_coefficient},
            )
            if was_created:
                assigned_count += 1

        return Response({
            'detail': (
                f'{created_count} subject(s) created and {assigned_count} assigned '
                f'to {section.name}.'
            ),
            'created': created_count,
            'assigned': assigned_count,
        })


class ClassSubjectViewSet(BaseTenantViewSet):
    queryset = ClassSubject.objects.select_related('subject', 'academic_class').all()
    serializer_class = ClassSubjectSerializer
    permission_classes = [IsAdminOrTeacher]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = self.queryset.filter(academic_class__tenant_id=tenant_id)
        class_id = self.request.query_params.get('academic_class')
        if class_id:
            qs = qs.filter(academic_class_id=class_id)
        return qs

    def perform_create(self, serializer):
        academic_class = serializer.validated_data.get('academic_class')
        if not academic_class or academic_class.tenant_id != self.request.tenant_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Invalid class for this school.')
        serializer.save()


class SectionSubjectViewSet(BaseTenantViewSet):
    queryset = SectionSubject.objects.select_related('section', 'subject', 'subject__cycle').all()
    serializer_class = SectionSubjectSerializer
    permission_classes = [IsAdminOrTeacher]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = self.queryset.filter(section__tenant_id=tenant_id)
        section_id = self.request.query_params.get('section')
        if section_id:
            qs = qs.filter(section_id=section_id)
        return qs

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_assign(self, request):
        """
        POST /api/v1/academic/section-subjects/bulk/
        Assign a list of subjects to a section in one call.
        Body: {"section": <id>, "subject_ids": [<id>, ...], "coefficients": {<id>: coeff}}
        Skips subjects already assigned; coefficients override the subject default.
        """
        section_id = request.data.get('section')
        subject_ids = request.data.get('subject_ids') or []
        coefficients = request.data.get('coefficients') or {}

        if not section_id or not subject_ids:
            return Response(
                {'detail': 'section and subject_ids are required.'}, status=400
            )

        try:
            section = Section.objects.get(id=section_id, tenant_id=request.tenant_id)
        except Section.DoesNotExist:
            return Response({'detail': 'Section not found.'}, status=404)

        existing = SectionSubject.objects.filter(
            section=section, subject_id__in=subject_ids
        ).values_list('subject_id', flat=True)

        created = []
        for subj_id in subject_ids:
            if str(subj_id) in existing or subj_id in existing:
                continue
            try:
                subject = Subject.objects.get(id=subj_id, tenant_id=request.tenant_id)
            except Subject.DoesNotExist:
                continue
            coefficient = coefficients.get(str(subj_id), coefficients.get(subj_id))
            if coefficient is None:
                coefficient = subject.default_coefficient
            link, _ = SectionSubject.objects.get_or_create(
                section=section, subject=subject,
                defaults={'coefficient': coefficient},
            )
            created.append(link)

        serializer = SectionSubjectSerializer(created, many=True)
        return Response({
            'detail': f'{len(created)} subject(s) assigned to {section.name}.',
            'created': serializer.data,
        })
