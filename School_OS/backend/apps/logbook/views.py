import hashlib
import time
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import SchemeOfWork, LogbookEntry, CurriculumModule, CurriculumLesson
from .serializers import (
    SchemeOfWorkSerializer, LogbookEntrySerializer, 
    CurriculumModuleSerializer, CurriculumLessonSerializer
)
from ..authentication.permissions import IsSchoolMember
from ..staff.models import Teacher, TeachingAssignment
from ..academic.models import AcademicYear, Term, Subject, Class

class CurriculumModuleViewSet(viewsets.ModelViewSet):
    serializer_class = CurriculumModuleSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        subject_id = self.request.query_params.get('subject')
        qs = CurriculumModule.objects.filter(tenant_id=tenant_id)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
            
        # Permission Filtering
        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher:
                assigned_subjects = TeachingAssignment.objects.filter(teacher=teacher).values_list('subject_id', flat=True)
                qs = qs.filter(subject_id__in=assigned_subjects)
            else:
                qs = qs.none()
                
        return qs

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.tenant_id)

    @action(detail=False, methods=['get'])
    def coverage_summary(self, request):
        """
        Aggregated curriculum coverage stats for the Analytics tab.
        Returns per-module and overall progress.
        """
        subject_id = request.query_params.get('subject')
        qs = self.get_queryset()
        if subject_id:
            qs = qs.filter(subject_id=subject_id)

        modules_data = []
        total_lessons = 0
        total_completed = 0

        for module in qs.prefetch_related('lessons'):
            lessons = module.lessons.all()
            lesson_count = lessons.count()
            completed_count = lessons.filter(is_completed=True).count()
            total_lessons += lesson_count
            total_completed += completed_count

            modules_data.append({
                'id': str(module.id),
                'name': module.name,
                'order': module.order,
                'total_lessons': lesson_count,
                'completed_lessons': completed_count,
                'progress': round((completed_count / lesson_count) * 100) if lesson_count > 0 else 0,
            })

        overall_progress = round((total_completed / total_lessons) * 100) if total_lessons > 0 else 0

        return Response({
            'overall_progress': overall_progress,
            'total_modules': len(modules_data),
            'total_lessons': total_lessons,
            'total_completed': total_completed,
            'modules': modules_data,
        })

class CurriculumLessonViewSet(viewsets.ModelViewSet):
    serializer_class = CurriculumLessonSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = CurriculumLesson.objects.filter(module__tenant_id=tenant_id)
        
        # Permission Filtering
        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher:
                assigned_subjects = TeachingAssignment.objects.filter(teacher=teacher).values_list('subject_id', flat=True)
                qs = qs.filter(module__subject_id__in=assigned_subjects)
            else:
                qs = qs.none()
                
        return qs

    @action(detail=True, methods=['post'])
    def toggle_complete(self, request, pk=None):
        """
        Toggle a lesson's completion status.
        When marking complete, auto-creates a linked LogbookEntry.
        """
        lesson = self.get_object()
        lesson.is_completed = not lesson.is_completed
        lesson.save()

        # Auto-link to logbook when marking complete
        if lesson.is_completed:
            tenant_id = request.tenant_id
            teacher = Teacher.objects.filter(
                user=request.user, tenant_id=tenant_id
            ).first()

            if teacher:
                # Create or find today's logbook entry for this context
                today = timezone.now().date()
                entry, created = LogbookEntry.objects.get_or_create(
                    tenant_id=tenant_id,
                    teacher=teacher,
                    date=today,
                    defaults={
                        'work_covered': f'Completed: {lesson.title}',
                    }
                )
                # Link this lesson to the logbook entry
                entry.lessons_covered.add(lesson)
                if not created:
                    # Append to existing work_covered
                    if lesson.title not in entry.work_covered:
                        entry.work_covered += f'\n• {lesson.title}'
                        entry.save()
        else:
            # If un-completing, remove from any logbook entries
            for entry in lesson.logged_in.all():
                entry.lessons_covered.remove(lesson)

        serializer = self.get_serializer(lesson)
        return Response({
            'lesson': serializer.data,
            'is_completed': lesson.is_completed,
        })

class SchemeOfWorkViewSet(viewsets.ModelViewSet):
    serializer_class = SchemeOfWorkSerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = SchemeOfWork.objects.filter(tenant_id=tenant_id)
        
        # Permission Filtering
        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher:
                assigned_subjects = TeachingAssignment.objects.filter(teacher=teacher).values_list('subject_id', flat=True)
                assigned_classes = TeachingAssignment.objects.filter(teacher=teacher).values_list('academic_class_id', flat=True)
                qs = qs.filter(subject_id__in=assigned_subjects, class_obj_id__in=assigned_classes)
            else:
                qs = qs.none()
                
        return qs

    def perform_create(self, serializer):
        tenant_id = self.request.tenant_id
        year = AcademicYear.objects.filter(tenant_id=tenant_id, is_active=True).first()
        term = Term.objects.filter(academic_year=year, order_number=1).first() if year else None
        
        subject_id = self.request.data.get('subject_id')
        class_id = self.request.data.get('class_id')
        
        from django.shortcuts import get_object_or_404
        subject = get_object_or_404(Subject, id=subject_id, tenant_id=tenant_id) if subject_id else Subject.objects.filter(tenant_id=tenant_id).first()
        class_obj = get_object_or_404(Class, id=class_id, tenant_id=tenant_id) if class_id else Class.objects.filter(tenant_id=tenant_id).first()
        
        week_number = serializer.validated_data.get('week_number', 1)

        obj, created = SchemeOfWork.objects.update_or_create(
            tenant_id=tenant_id,
            academic_year=year,
            term=term,
            subject=subject,
            class_obj=class_obj,
            week_number=week_number,
            defaults={
                'topic': serializer.validated_data.get('topic', ''),
                'objectives': serializer.validated_data.get('objectives', ''),
            }
        )
        serializer.instance = obj


class LogbookEntryViewSet(viewsets.ModelViewSet):
    serializer_class = LogbookEntrySerializer
    permission_classes = [IsAuthenticated, IsSchoolMember]

    def get_queryset(self):
        tenant_id = self.request.tenant_id
        qs = LogbookEntry.objects.filter(tenant_id=tenant_id)
        
        # Permission Filtering
        if not self.request.user.role_mappings.filter(tenant_id=tenant_id, role__in=['admin', 'super_admin']).exists():
            teacher = Teacher.objects.filter(user=self.request.user, tenant_id=tenant_id).first()
            if teacher:
                qs = qs.filter(teacher=teacher)
            else:
                qs = qs.none()
                
        return qs

    def perform_create(self, serializer):
        tenant_id = self.request.tenant_id
        teacher = Teacher.objects.filter(
            user=self.request.user, tenant_id=tenant_id
        ).first()
        serializer.save(
            tenant_id=tenant_id,
            teacher=teacher,
        )

    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """
        Phase 7: Digital Signature. 
        Locks the record and generates a signature hash.
        """
        entry = self.get_object()
        if entry.is_locked:
            return Response({'error': 'Already signed and locked.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Simple representational hash for demo
        raw_sig = f"{entry.id}-{entry.teacher.id}-{time.time()}"
        entry.signature_hash = hashlib.sha256(raw_sig.encode()).hexdigest()
        entry.is_locked = True
        entry.signed_at = time.now() if hasattr(time, 'now') else None # Use django utils instead
        
        from django.utils import timezone
        entry.signed_at = timezone.now()
        entry.save()
        
        return Response({
            'status': 'signed',
            'signature': entry.signature_hash,
            'signed_at': entry.signed_at
        })
