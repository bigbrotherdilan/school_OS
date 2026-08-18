from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from django.db.models import Sum, Q
from django.db import transaction
from django.utils import timezone
from decimal import Decimal, InvalidOperation
from apps.core.views import BaseTenantViewSet
from apps.authentication.permissions import IsSchoolAdminOrBursar, CanWriteFinance
from apps.finance.models import (
    FeeCategory, FeeStructure, StudentInvoice, PaymentTransaction,
    InvoiceLineItem, ExpenseCategory, Expense
)
from apps.finance.serializers import (
    FeeCategorySerializer, FeeStructureSerializer,
    StudentInvoiceSerializer, PaymentTransactionSerializer,
    InvoiceLineItemSerializer, ExpenseCategorySerializer,
    ExpenseSerializer, StudentInvoiceCreateSerializer,
)
from apps.students.models import Student
from apps.academic.models import AcademicYear
from apps.notifications.utils import (
    notify_invoice_created, notify_payment_received, notify_fee_reminder,
)
from django.http import HttpResponse


def build_invoice_from_structures(tenant, student, year, due_date=None, fee_structure_ids=None):
    """
    Create a StudentInvoice from the fee structures that apply to a student's
    class (class-specific structures win, global structures apply to all).

    Uses the student's current placement: every structure whose target_class
    matches the student's class (plus global structures) is billed.

    Idempotent: an existing uncancelled invoice for this student + year is
    topped up with any class fees that are missing from it, then returned.
    Returns (invoice | None, created: bool) where created=True when the invoice
    was newly created or had fees added.
    """
    structures = FeeStructure.objects.filter(
        tenant=tenant,
        academic_year=year,
    ).filter(
        Q(target_class=student.current_class) | Q(target_class__isnull=True)
    )
    if fee_structure_ids:
        structures = structures.filter(id__in=fee_structure_ids)

    if not structures.exists():
        return None, False

    applicable_ids = list(structures.values_list('id', flat=True))
    existing_invoice = StudentInvoice.objects.filter(
        tenant=tenant,
        student=student,
        academic_year=year,
    ).exclude(status=StudentInvoice.Status.CANCELLED).order_by('-created_at').first()

    if existing_invoice:
        covered_ids = set(existing_invoice.line_items.filter(
            fee_structure_id__in=applicable_ids,
        ).values_list('fee_structure_id', flat=True))
        missing = [fs for fs in structures if fs.id not in covered_ids]
        if not missing:
            return existing_invoice, False
        for fs in missing:
            existing_invoice.line_items.create(
                fee_structure=fs,
                label=fs.category.name,
                amount=fs.amount,
            )
        existing_invoice.total_amount = (
            existing_invoice.line_items.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        )
        if existing_invoice.amount_paid >= existing_invoice.total_amount and existing_invoice.total_amount > 0:
            existing_invoice.status = StudentInvoice.Status.PAID
        elif existing_invoice.amount_paid > 0:
            existing_invoice.status = StudentInvoice.Status.PARTIAL
        else:
            existing_invoice.status = StudentInvoice.Status.UNPAID
        existing_invoice.save()
        return existing_invoice, True

    invoice = StudentInvoice.objects.create(
        tenant=tenant,
        student=student,
        academic_year=year,
        total_amount=0,
        amount_paid=0,
        due_date=due_date or timezone.now().date(),
        status=StudentInvoice.Status.UNPAID,
    )
    total = 0
    for fs in structures:
        InvoiceLineItem.objects.create(
            invoice=invoice,
            fee_structure=fs,
            label=fs.category.name,
            amount=fs.amount,
        )
        total += fs.amount
    invoice.total_amount = total
    invoice.save()
    return invoice, True


def _resolve_academic_year(tenant):
    return (
        AcademicYear.objects.filter(tenant=tenant, is_active=True).first()
        or AcademicYear.objects.filter(tenant=tenant).order_by('-created_at').first()
    )


def _category_breakdown(tenant, student, year, invoice, structures):
    """
    Per-fee-category summary for the quote: what each category costs, how much
    has already been paid toward it on this invoice, and what remains.

    Returns a list of dicts: {id, name, is_mandatory, amount, paid, remaining}.
    """
    if invoice is not None:
        rows = []
        for item in invoice.line_items.select_related('fee_structure__category'):
            fs = item.fee_structure
            if fs is None or fs.category is None:
                continue
            rows.append((fs.category, fs.category.is_mandatory, item.amount))
    else:
        rows = [
            (fs.category, fs.category.is_mandatory, fs.amount)
            for fs in structures
        ]

    grouped = {}
    for category, is_mandatory, amount in rows:
        entry = grouped.setdefault(category.id, {
            'id': str(category.id),
            'name': category.name,
            'is_mandatory': is_mandatory,
            'amount': Decimal('0'),
        })
        entry['amount'] += amount

    paid_by_category = {}
    if invoice is not None:
        paid_qs = PaymentTransaction.objects.filter(
            invoice=invoice,
            fee_category_id__in=list(grouped.keys()),
        ).values('fee_category_id').annotate(total=Sum('amount'))
        paid_by_category = {
            row['fee_category_id']: row['total'] or Decimal('0')
            for row in paid_qs
        }

    categories = []
    for entry in grouped.values():
        amount = entry['amount']
        paid = min(paid_by_category.get(entry['id'], Decimal('0')), amount)
        categories.append({
            'id': entry['id'],
            'name': entry['name'],
            'is_mandatory': entry['is_mandatory'],
            'amount': str(amount),
            'paid': str(paid),
            'remaining': str(amount - paid),
        })
    return categories


class PaymentQuoteView(APIView):
    """
    GET /api/v1/finance/payments/quote/?student=<uuid>
    Fee breakdown for a student: existing invoice if present, otherwise the
    applicable fee structures. Lets the UI show the amount due without
    guessing.
    """
    permission_classes = [IsSchoolAdminOrBursar]

    def get(self, request):
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'detail': 'student query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = Student.objects.select_related('current_class', 'stream').get(id=student_id, tenant=request.tenant)
        except (Student.DoesNotExist, ValueError):
            return Response({'detail': 'Student not found in this school.'}, status=status.HTTP_404_NOT_FOUND)

        year = _resolve_academic_year(request.tenant)

        invoice = None
        fees = []
        total = Decimal('0')
        structures = FeeStructure.objects.none()
        if year is not None:
            invoice = StudentInvoice.objects.filter(
                student=student,
                academic_year=year,
            ).exclude(status=StudentInvoice.Status.CANCELLED).order_by('-created_at').first()

            structures = FeeStructure.objects.filter(
                tenant=request.tenant,
                academic_year=year,
            ).filter(
                Q(target_class=student.current_class) | Q(target_class__isnull=True)
            ).select_related('category')
            fees = [
                {
                    'category': fs.category.name,
                    'amount': str(fs.amount),
                    'is_mandatory': fs.category.is_mandatory,
                }
                for fs in structures
            ]
            if invoice is None:
                total = sum((Decimal(f['amount']) for f in fees), Decimal('0'))

        return Response({
            'student': {
                'id': str(student.id),
                'full_name': student.full_name,
                'admission_number': student.admission_number,
                'class_display': student.current_class.name if student.current_class else None,
                'section_display': student.stream.name if student.stream else None,
                'status': student.status,
            },
            'academic_year': {'id': str(year.id), 'name': year.name} if year else None,
            'invoice': StudentInvoiceSerializer(invoice, context={'request': request}).data if invoice else None,
            'fees': fees,
            'categories': _category_breakdown(request.tenant, student, year, invoice, structures),
            'total': str(invoice.total_amount) if invoice else str(total),
            'has_invoice': invoice is not None,
        })


class PaymentRecordView(APIView):
    """
    POST /api/v1/finance/payments/record/
    Record a payment against a student directly — no manual invoice step.

    If the student has no invoice for the current academic year yet, one is
    auto-created from the class fee structures at payment time (invisible to
    the admin). First payment on a 'registered' student activates them.
    Body: {student_id, amount, method, reference?, notes?, due_date?, fee_category_id?}
    """
    permission_classes = [CanWriteFinance]

    def post(self, request):
        student_id = request.data.get('student_id')
        amount_raw = request.data.get('amount')
        method = request.data.get('method', 'cash')
        reference = request.data.get('reference', '') or ''
        notes = request.data.get('notes', '') or ''
        due_date = request.data.get('due_date')
        fee_category_id = request.data.get('fee_category_id')

        if not student_id or amount_raw is None:
            return Response(
                {'detail': 'student_id and amount are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            student = Student.objects.select_related('current_class', 'stream').get(id=student_id, tenant=request.tenant)
        except (Student.DoesNotExist, ValueError):
            return Response({'detail': 'Student not found in this school.'}, status=status.HTTP_404_NOT_FOUND)

        fee_category = None
        if fee_category_id:
            try:
                fee_category = FeeCategory.objects.get(id=fee_category_id, tenant=request.tenant)
            except (FeeCategory.DoesNotExist, ValueError):
                return Response({'detail': 'Invalid fee category.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_raw))
            if amount <= 0:
                raise ValueError
        except (InvalidOperation, ValueError):
            return Response({'detail': 'Amount must be a positive number.'}, status=status.HTTP_400_BAD_REQUEST)

        if method not in dict(PaymentTransaction.PaymentMethod.choices):
            return Response({'detail': f'Invalid method: {method}.'}, status=status.HTTP_400_BAD_REQUEST)

        year = _resolve_academic_year(request.tenant)
        if year is None:
            return Response({'detail': 'No academic year configured.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            parsed_due_date = timezone.datetime.strptime(due_date, '%Y-%m-%d').date() if due_date else timezone.now().date()
        except ValueError:
            return Response({'detail': 'due_date must be YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            invoice = StudentInvoice.objects.filter(
                student=student,
                academic_year=year,
            ).exclude(status=StudentInvoice.Status.CANCELLED).order_by('-created_at').first()

            created_invoice = False
            if invoice is None:
                invoice, created_invoice = build_invoice_from_structures(
                    request.tenant, student, year, due_date=parsed_due_date
                )
                if invoice is None:
                    class_label = student.current_class.name if student.current_class else 'this student'
                    return Response(
                        {'detail': (
                            f'No fee structure configured for {class_label}. '
                            'Set one up under Finance → Fee Setup first.'
                        )},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if amount > invoice.balance:
                return Response(
                    {'detail': f'Amount exceeds outstanding balance of {invoice.balance}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if fee_category is not None:
                on_invoice = invoice.line_items.filter(
                    fee_structure__category_id=fee_category.id
                ).exists()
                if not on_invoice:
                    return Response(
                        {'detail': (
                            f"'{fee_category.name}' is not part of {student.full_name}'s "
                            f"current fee invoice ({invoice.invoice_number})."
                        )},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            tx_serializer = PaymentTransactionSerializer(
                data={
                    'invoice': str(invoice.id),
                    'amount': amount,
                    'method': method,
                    'reference': reference,
                    'notes': notes,
                    'fee_category': str(fee_category.id) if fee_category else None,
                },
                context={'request': request},
            )
            tx_serializer.is_valid(raise_exception=True)
            payment = tx_serializer.save(tenant_id=request.tenant_id)
            payment.refresh_from_db()

            activated = False
            if student.status == Student.Status.REGISTERED:
                student.status = Student.Status.ACTIVE
                student.save(update_fields=['status'])
                activated = True

        try:
            notify_payment_received(payment, created_by=request.user)
        except Exception:
            pass

        invoice.refresh_from_db()
        return Response({
            'transaction': PaymentTransactionSerializer(payment, context={'request': request}).data,
            'invoice': StudentInvoiceSerializer(invoice, context={'request': request}).data,
            'created_invoice': created_invoice,
            'activated': activated,
        }, status=status.HTTP_201_CREATED)


class FinanceWritePermissionsMixin:
    """
    Finance views: everyone with IsSchoolAdminOrBursar may READ; RECORDING
    (create/update/delete) requires CanWriteFinance — i.e. bursars always,
    admins only while TenantConfig.finance_recording is 'admin_and_bursar'.
    """
    permission_classes = [IsSchoolAdminOrBursar]

    def get_permissions(self):
        if self.request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return [CanWriteFinance()]
        return [IsSchoolAdminOrBursar()]


class FeeCategoryViewSet(FinanceWritePermissionsMixin, BaseTenantViewSet):
    queryset = FeeCategory.objects.select_related('tenant')
    serializer_class = FeeCategorySerializer
    allow_delete = False


class FeeStructureViewSet(FinanceWritePermissionsMixin, BaseTenantViewSet):
    queryset = FeeStructure.objects.select_related('tenant', 'academic_year', 'category', 'target_class')
    serializer_class = FeeStructureSerializer
    allow_delete = False


class StudentInvoiceViewSet(FinanceWritePermissionsMixin, BaseTenantViewSet):
    queryset = StudentInvoice.objects.select_related(
        'tenant', 'student', 'student__current_class', 'academic_year'
    ).prefetch_related('line_items__fee_structure__category')
    serializer_class = StudentInvoiceSerializer

    def get_permissions(self):
        # Reminders are notifications, not financial records — admins keep them.
        if self.action in ('send_reminder', 'send_reminders'):
            return [IsSchoolAdminOrBursar()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        class_id = self.request.query_params.get('student__current_class')
        if class_id:
            qs = qs.filter(student__current_class_id=class_id)
        section_id = self.request.query_params.get('student__current_class__stream')
        if section_id:
            qs = qs.filter(student__current_class__stream_id=section_id)
        academic_year_id = self.request.query_params.get('academic_year')
        if academic_year_id:
            qs = qs.filter(academic_year_id=academic_year_id)
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        invoice = self.get_queryset().filter(id=response.data.get('id')).select_related('student', 'academic_year').first()
        if invoice and response.status_code in (200, 201):
            try:
                notify_invoice_created(invoice, created_by=request.user)
            except Exception:
                pass  # Don't fail invoice creation if notification fails
        return response

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        """Generate invoice with line items from fee structures."""
        tenant = request.tenant
        serializer = StudentInvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_id = serializer.validated_data['student_id']
        due_date = serializer.validated_data['due_date']
        fs_ids = serializer.validated_data.get('fee_structure_ids')

        try:
            student = Student.objects.get(id=student_id, tenant=tenant)
        except Student.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        current_year = AcademicYear.objects.filter(tenant=tenant).order_by('-created_at').first()
        if not current_year:
            return Response({'detail': 'No academic year configured.'}, status=status.HTTP_400_BAD_REQUEST)

        # Determine applicable fee structures
        fee_structures = FeeStructure.objects.filter(
            tenant=tenant,
            academic_year=current_year,
        ).filter(
            Q(target_class=student.current_class) | Q(target_class__isnull=True)
        )
        if fs_ids:
            fee_structures = fee_structures.filter(id__in=fs_ids)

        if not fee_structures.exists():
            return Response(
                {'detail': 'No fee structures found for this student.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Duplicate guard: refuse to create a second fee for the year while any
        # (unpaid, partial, paid, or draft) invoice already covers the same fees
        applicable_ids = list(fee_structures.values_list('id', flat=True))
        existing_items = InvoiceLineItem.objects.filter(
            invoice__tenant=tenant,
            invoice__student=student,
            invoice__academic_year=current_year,
            fee_structure_id__in=applicable_ids,
        ).exclude(invoice__status=StudentInvoice.Status.CANCELLED)
        if existing_items.exists():
            numbers = sorted(set(existing_items.values_list('invoice__invoice_number', flat=True)))
            labels = sorted(set(existing_items.values_list('label', flat=True)))
            return Response(
                {'detail': (
                    f"{student.full_name} already has fee(s) on {', '.join(numbers)} "
                    f"covering: {', '.join(labels)}. Only one fee per student per academic year — "
                    "no duplicate generated. Cancel the existing fee first if it needs re-issuing."
                )},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            invoice = StudentInvoice.objects.create(
                tenant=tenant,
                student=student,
                academic_year=current_year,
                total_amount=0,
                amount_paid=0,
                due_date=due_date,
                status=StudentInvoice.Status.UNPAID,
            )
            total = 0
            for fs in fee_structures:
                InvoiceLineItem.objects.create(
                    invoice=invoice,
                    fee_structure=fs,
                    label=f"{fs.category.name}",
                    amount=fs.amount,
                )
                total += fs.amount
            invoice.total_amount = total
            invoice.save()

        # Notify parents about the new invoice
        try:
            notify_invoice_created(invoice, created_by=request.user)
        except Exception:
            pass  # Don't fail invoice creation if notification fails

        return Response(StudentInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='batch-generate')
    def batch_generate(self, request):
        """Generate invoices for all students in a class."""
        tenant = request.tenant
        class_id = request.data.get('class_id')
        due_date = request.data.get('due_date')
        fee_structure_ids = request.data.get('fee_structure_ids')

        if not class_id or not due_date:
            return Response({'detail': 'class_id and due_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(
            tenant=tenant,
            current_class_id=class_id,
            status__in=['active', 'registered'],
        )
        if not students.exists():
            return Response({'detail': 'No students found in this class.'}, status=status.HTTP_400_BAD_REQUEST)

        current_year = AcademicYear.objects.filter(tenant=tenant).order_by('-created_at').first()
        if not current_year:
            return Response({'detail': 'No academic year configured.'}, status=status.HTTP_400_BAD_REQUEST)

        fee_structures = FeeStructure.objects.filter(
            tenant=tenant,
            academic_year=current_year,
        ).filter(
            Q(target_class_id=class_id) | Q(target_class__isnull=True)
        )
        if fee_structure_ids:
            fee_structures = fee_structures.filter(id__in=fee_structure_ids)

        if not fee_structures.exists():
            return Response({'detail': 'No fee structures found for this class.'}, status=status.HTTP_400_BAD_REQUEST)

        # Skip students who already have a fee (unpaid, partial, paid, or draft)
        # covering any of these categories in the current academic year
        applicable_ids = list(fee_structures.values_list('id', flat=True))
        already_billed = set(InvoiceLineItem.objects.filter(
            invoice__tenant=tenant,
            invoice__academic_year=current_year,
            fee_structure_id__in=applicable_ids,
        ).exclude(invoice__status=StudentInvoice.Status.CANCELLED).values_list('invoice__student_id', flat=True))
        class_student_ids = set(students.values_list('id', flat=True))
        skipped_count = len(class_student_ids & already_billed)
        students = students.exclude(id__in=already_billed)

        if not students.exists():
            return Response({
                'detail': 'No new fees generated: all students in this class already have fees covering these categories.',
                'created': 0,
                'skipped': skipped_count,
            }, status=status.HTTP_400_BAD_REQUEST)

        created = []
        with transaction.atomic():
            for student in students:
                invoice = StudentInvoice.objects.create(
                    tenant=tenant,
                    student=student,
                    academic_year=current_year,
                    total_amount=0,
                    amount_paid=0,
                    due_date=due_date,
                    status=StudentInvoice.Status.UNPAID,
                )
                total = 0
                for fs in fee_structures:
                    InvoiceLineItem.objects.create(
                        invoice=invoice,
                        fee_structure=fs,
                        label=f"{fs.category.name}",
                        amount=fs.amount,
                    )
                    total += fs.amount
                invoice.total_amount = total
                invoice.save()
                created.append(str(invoice.id))

        # Notify each student's parents that an invoice was generated
        if created:
            try:
                from apps.notifications.utils import notify_invoice_created
                invoices = StudentInvoice.objects.filter(id__in=created).select_related('student', 'academic_year')
                for inv in invoices:
                    notify_invoice_created(inv, created_by=request.user)
            except Exception:
                pass

        return Response({'created': len(created), 'skipped': skipped_count, 'invoice_ids': created})

    @action(detail=False, methods=['post'], url_path='ensure-invoices')
    def ensure_invoices(self, request):
        """
        Generate fee invoices for every student in a year (optionally one class)
        who does not already have one. Idempotent — already-billed students are
        skipped. Used by the ledger so every student shows a billable status.
        """
        tenant = request.tenant
        class_id = request.data.get('class_id') or request.query_params.get('class_id')
        academic_year_id = request.data.get('academic_year') or request.query_params.get('academic_year')
        due_date = request.data.get('due_date')

        year = AcademicYear.objects.filter(id=academic_year_id, tenant=tenant).first()
        if not year:
            year = _resolve_academic_year(tenant)
        if not year:
            return Response({'detail': 'No academic year found. Create and activate a year first.'}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(
            tenant=tenant,
            status__in=[Student.Status.ACTIVE, Student.Status.REGISTERED],
        )
        if class_id:
            students = students.filter(current_class_id=class_id)

        created = 0
        updated = 0
        skipped = 0
        failed = 0
        for student in students:
            had_invoice = StudentInvoice.objects.filter(
                tenant=tenant, student=student, academic_year=year,
            ).exclude(status=StudentInvoice.Status.CANCELLED).exists()
            inv, changed = build_invoice_from_structures(tenant, student, year, due_date=due_date)
            if inv is None:
                failed += 1
            elif not changed:
                skipped += 1
            elif had_invoice:
                updated += 1
            else:
                created += 1
                try:
                    notify_invoice_created(inv, created_by=request.user)
                except Exception:
                    pass

        return Response({
            'detail': f'Fee invoices ensured for {year.name}.',
            'year': {'id': str(year.id), 'name': year.name},
            'created': created,
            'updated': updated,
            'skipped': skipped,
            'failed': failed,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """Export billing directory as CSV."""
        import csv
        from datetime import datetime

        invoices = self.get_queryset().prefetch_related('line_items')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="financial_ledger_{datetime.now().strftime("%Y%m%d")}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow(['Invoice #', 'Student', 'Total Amount', 'Amount Paid', 'Balance', 'Status', 'Due Date'])

        for inv in invoices:
            writer.writerow([
                inv.invoice_number,
                inv.student.full_name if inv.student else 'N/A',
                inv.total_amount,
                inv.amount_paid,
                inv.balance,
                inv.status,
                inv.due_date,
            ])

        return response

    def _statement_response(self, invoice):
        try:
            from .utils import generate_invoice_statement_pdf
            pdf_bytes = generate_invoice_statement_pdf(invoice)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="statement_{invoice.invoice_number}.pdf"'
            return response
        except Exception as e:
            return Response({'detail': f'Failed to generate statement: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='statement')
    def statement(self, request, *args, **kwargs):
        """Generate a Fee Statement PDF (payment history) for an invoice."""
        invoice = self.get_object()
        return self._statement_response(invoice)

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, *args, **kwargs):
        """Backwards-compatible alias for the invoice statement."""
        invoice = self.get_object()
        return self._statement_response(invoice)

    @action(detail=True, methods=['post'], url_path='send-reminder')
    def send_reminder(self, request, id=None):
        """Send a fee reminder notification to parents for this invoice."""
        invoice = self.get_object()
        if invoice.status == StudentInvoice.Status.PAID:
            return Response({'detail': 'This invoice is already fully paid.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            notifs = notify_fee_reminder(invoice, created_by=request.user)
            return Response({
                'detail': f'Fee reminder sent to parents for {invoice.invoice_number}.',
                'notified': len(notifs or []),
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'detail': f'Failed to send reminder: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='send-reminders')
    def send_reminders(self, request):
        """Bulk fee reminder to parents for a set of invoices (fully paid are skipped)."""
        invoice_ids = request.data.get('invoice_ids') or []
        if not invoice_ids:
            return Response({'detail': 'No invoices selected.'}, status=status.HTTP_400_BAD_REQUEST)

        invoices = self.get_queryset().filter(id__in=invoice_ids).exclude(status=StudentInvoice.Status.PAID)
        reminded = 0
        notified = 0
        errors = 0
        for inv in invoices:
            try:
                notifs = notify_fee_reminder(inv, created_by=request.user)
                notified += len(notifs or [])
                reminded += 1
            except Exception:
                errors += 1
                continue

        return Response({
            'detail': f'Fee reminders sent for {reminded} invoice(s).',
            'invoices': reminded,
            'notified': notified,
            'errors': errors,
        }, status=status.HTTP_201_CREATED)


class PaymentTransactionViewSet(FinanceWritePermissionsMixin, BaseTenantViewSet):
    queryset = PaymentTransaction.objects.select_related('tenant', 'invoice', 'recorded_by')
    serializer_class = PaymentTransactionSerializer
    allow_delete = False

    def get_queryset(self):
        qs = super().get_queryset()
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(invoice__student_id=student_id)
        invoice_id = self.request.query_params.get('invoice')
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)
        return qs

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        payment = self.get_queryset().filter(id=response.data.get('id')).select_related('invoice', 'invoice__student').first()
        if payment and response.status_code in (200, 201):
            try:
                notify_payment_received(payment, created_by=request.user)
            except Exception:
                pass  # Don't fail payment recording if notification fails
        return response

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, *args, **kwargs):
        """Generate the official Payment Receipt PDF for a single transaction (installment)."""
        payment = self.get_object()
        if payment.amount <= 0:
            return Response({'detail': 'Invalid payment amount.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from .utils import generate_payment_receipt_pdf
            pdf_bytes = generate_payment_receipt_pdf(payment)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="receipt_{payment.receipt_number}.pdf"'
            return response
        except Exception as e:
            return Response({'detail': f'Failed to generate receipt: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExpenseCategoryViewSet(FinanceWritePermissionsMixin, BaseTenantViewSet):
    queryset = ExpenseCategory.objects.select_related('tenant')
    serializer_class = ExpenseCategorySerializer
    allow_delete = False


class ExpenseViewSet(FinanceWritePermissionsMixin, BaseTenantViewSet):
    queryset = Expense.objects.select_related('tenant', 'category', 'recorded_by')
    serializer_class = ExpenseSerializer
    allow_delete = False


@api_view(['GET'])
@permission_classes([IsSchoolAdminOrBursar])
def finance_summary(request):
    tenant_id = getattr(request, 'tenant_id', None)
    if not tenant_id:
        return Response({'error': 'Tenant ID required'}, status=400)

    invoices = StudentInvoice.objects.filter(tenant_id=tenant_id)
    total_revenue = invoices.aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0
    total_expected = invoices.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
    total_arrears = total_expected - total_revenue
    collection_rate = (total_revenue / total_expected * 100) if total_expected > 0 else 0

    today = timezone.now().date()
    today_transactions = PaymentTransaction.objects.filter(
        tenant_id=tenant_id,
        payment_date__date=today
    )
    daily_volume = today_transactions.aggregate(Sum('amount'))['amount__sum'] or 0

    # Expenses
    total_expenses = Expense.objects.filter(tenant_id=tenant_id).aggregate(Sum('amount'))['amount__sum'] or 0

    paid_count = invoices.filter(status='paid').count()
    unpaid_count = invoices.count() - paid_count
    total_invoices = invoices.count()

    return Response({
        'total_revenue': total_revenue,
        'total_expected': total_expected,
        'total_arrears': total_arrears,
        'collection_rate': round(collection_rate, 1),
        'daily_volume': daily_volume,
        'total_expenses': total_expenses,
        'paid_count': paid_count,
        'unpaid_count': unpaid_count,
        'total_invoices': total_invoices,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def receipt_verify(request, receipt_number=None):
    """
    Public authenticity lookup for a printed receipt.
    Returns only masked data (enough to confirm the paper matches the record).
    """
    try:
        tx = PaymentTransaction.objects.select_related(
            'invoice', 'invoice__student', 'invoice__tenant'
        ).get(receipt_number__iexact=receipt_number)
    except PaymentTransaction.DoesNotExist:
        return Response({'valid': False, 'detail': 'Receipt number not found.'}, status=404)

    from .utils import receipt_verification_code

    student = tx.invoice.student
    masked_name = ''
    if student:
        parts = [p for p in [student.first_name, student.last_name] if p]
        masked_name = ' '.join([
            (p[0] + '.' * len(p[1:])) if p else ''
            for p in parts
        ])

    return Response({
        'valid': True,
        'receipt_number': tx.receipt_number,
        'verification_code': receipt_verification_code(tx.receipt_number),
        'school': tx.invoice.tenant.school_name,
        'student': masked_name,
        'amount': str(tx.amount),
        'payment_date': timezone.localtime(tx.payment_date).strftime('%d/%m/%Y %H:%M'),
        'method': tx.get_method_display(),
        'currency': 'XAF',
    })
