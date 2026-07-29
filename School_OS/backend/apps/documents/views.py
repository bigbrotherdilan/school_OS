from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.http import HttpResponse
from .models import Document, DocumentCategory, IDCardTemplate, GeneratedIDCard
from .serializers import (
    DocumentSerializer, DocumentCategorySerializer,
    IDCardTemplateSerializer, GeneratedIDCardSerializer,
    IDCardGenerationRequestSerializer,
)
from .id_card_utils import (
    generate_student_id_card,
    generate_batch_id_cards_pdf,
    generate_batch_id_cards_zip,
)


class DocumentCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = DocumentCategory.objects.all()
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = Document.objects.select_related('category', 'uploaded_by')
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        # Filter by archived status
        show_archived = self.request.query_params.get('archived', 'false')
        if show_archived != 'true':
            qs = qs.filter(is_archived=False)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category_id=category)

        # Search
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        return qs

    def perform_create(self, serializer):
        tenant_id = self.request.tenant_id
        uploaded_file = self.request.FILES.get('file')
        file_name = uploaded_file.name if uploaded_file else ''
        file_size = uploaded_file.size if uploaded_file else 0
        file_type = uploaded_file.content_type if uploaded_file else ''

        serializer.save(
            tenant_id=tenant_id,
            uploaded_by=self.request.user,
            file_name=file_name,
            file_size=file_size,
            file_type=file_type,
        )

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        doc = self.get_object()
        doc.is_archived = True
        doc.save()
        return Response({'status': 'archived'})

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        doc = self.get_object()
        doc.is_archived = False
        doc.save()
        return Response({'status': 'restored'})

    @action(detail=True, methods=['post'])
    def download(self, request, pk=None):
        doc = self.get_object()
        doc.download_count += 1
        doc.save(update_fields=['download_count'])
        return Response({'download_url': doc.file.url})


class IDCardTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = IDCardTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = IDCardTemplate.objects.all()
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)


class GeneratedIDCardViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GeneratedIDCardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = GeneratedIDCard.objects.select_related(
            'student', 'template', 'generated_by', 'academic_year'
        )
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        # Filter by student
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)

        # Filter by academic year
        academic_year_id = self.request.query_params.get('academic_year')
        if academic_year_id:
            qs = qs.filter(academic_year_id=academic_year_id)

        # Filter by printed status
        is_printed = self.request.query_params.get('is_printed')
        if is_printed is not None:
            qs = qs.filter(is_printed=is_printed.lower() == 'true')

        return qs

    @action(detail=True, methods=['post'])
    def mark_printed(self, request, pk=None):
        card = self.get_object()
        card.mark_printed()
        return Response({'status': 'marked as printed'})

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate ID cards for students."""
        serializer = IDCardGenerationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        tenant_id = request.tenant_id
        
        if not tenant_id:
            return Response(
                {'error': 'No tenant context. Please select a school first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            return self._do_generate(data, tenant_id, request)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': f'Generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _do_generate(self, data, tenant_id, request):
        from apps.students.models import Student
        from apps.academic.models import AcademicYear
        from apps.tenants.models import Tenant
        
        if data.get('student_ids'):
            students = list(Student.objects.select_related(
                'current_class', 'series'
            ).filter(
                id__in=data['student_ids'],
                tenant_id=tenant_id,
                status='active'
            ))
        elif data.get('class_id'):
            students = list(Student.objects.select_related(
                'current_class', 'series'
            ).filter(
                current_class_id=data['class_id'],
                tenant_id=tenant_id,
                status='active'
            ))
        else:
            return Response(
                {'error': 'Either student_ids or class_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not students:
            return Response(
                {'error': 'No students found matching criteria'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            academic_year = AcademicYear.objects.get(
                id=data['academic_year_id'],
                tenant_id=tenant_id
            )
        except AcademicYear.DoesNotExist:
            return Response(
                {'error': 'Academic year not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        template = None
        if data.get('template_id'):
            try:
                template = IDCardTemplate.objects.get(
                    id=data['template_id'],
                    tenant_id=tenant_id
                )
            except IDCardTemplate.DoesNotExist:
                pass
        
        tenant = Tenant.objects.get(id=tenant_id)
        
        output_format = data.get('output_format', 'single')
        style_overrides = data.get('style_overrides')
        
        if output_format == 'zip':
            pdf_buffer = generate_batch_id_cards_zip(
                students, tenant, academic_year, template, style_overrides
            )
            content_type = 'application/zip'
            filename = f'ID_Cards_{academic_year.name}.zip'
        elif output_format == 'multi':
            pdf_buffer = generate_batch_id_cards_pdf(
                students, tenant, academic_year, template, style_overrides
            )
            content_type = 'application/pdf'
            filename = f'ID_Cards_{academic_year.name}.pdf'
        else:
            student = students[0]
            pdf_buffer = generate_student_id_card(
                student, tenant, academic_year, template, style_overrides
            )
            content_type = 'application/pdf'
            safe_last = (student.last_name or '').replace(' ', '_').replace('/', '-')
            safe_first = (student.first_name or '').replace(' ', '_').replace('/', '-')
            filename = f'{safe_last}_{safe_first}_{student.admission_number}.pdf'
        
        for student in students:
            GeneratedIDCard.objects.get_or_create(
                tenant_id=tenant_id,
                student=student,
                academic_year=academic_year,
                defaults={
                    'template': template,
                    'generated_by': request.user,
                }
            )
        
        response = HttpResponse(pdf_buffer.getvalue(), content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
