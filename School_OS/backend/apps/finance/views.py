from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Q
from django.db import transaction
from django.utils import timezone
from apps.academic.views import BaseTenantViewSet
from apps.authentication.permissions import IsSchoolAdminOrBursar
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
    announce_payment_received,
    notify_invoice_created, notify_payment_received, notify_fee_reminder,
)
from django.http import HttpResponse
from django.utils.crypto import get_random_string


class FeeCategoryViewSet(BaseTenantViewSet):
    queryset = FeeCategory.objects.select_related('tenant')
    serializer_class = FeeCategorySerializer
    permission_classes = [IsSchoolAdminOrBursar]
    allow_delete = False


class FeeStructureViewSet(BaseTenantViewSet):
    queryset = FeeStructure.objects.select_related('tenant', 'academic_year', 'category', 'target_class')
    serializer_class = FeeStructureSerializer
    permission_classes = [IsSchoolAdminOrBursar]
    allow_delete = False


class StudentInvoiceViewSet(BaseTenantViewSet):
    queryset = StudentInvoice.objects.select_related('tenant', 'student', 'student__current_class', 'academic_year')
    serializer_class = StudentInvoiceSerializer
    permission_classes = [IsSchoolAdminOrBursar]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        class_id = self.request.query_params.get('student__current_class')
        if class_id:
            qs = qs.filter(student__current_class_id=class_id)
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

        return Response({'created': len(created), 'invoice_ids': created})

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

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, pk=None):
        """Generate a receipt PDF for a paid invoice."""
        invoice = self.get_object()
        if invoice.amount_paid <= 0:
            return Response({'detail': 'No payments recorded for this invoice.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from .utils import generate_receipt_pdf
            pdf_bytes = generate_receipt_pdf(invoice)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="receipt_{invoice.invoice_number}.pdf"'
            return response
        except Exception as e:
            return Response({'detail': f'Failed to generate receipt: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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


class PaymentTransactionViewSet(BaseTenantViewSet):
    queryset = PaymentTransaction.objects.select_related('tenant', 'invoice', 'recorded_by')
    serializer_class = PaymentTransactionSerializer
    permission_classes = [IsSchoolAdminOrBursar]
    allow_delete = False

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        payment = self.get_queryset().filter(id=response.data.get('id')).select_related('invoice', 'invoice__student').first()
        if payment and response.status_code in (200, 201):
            try:
                notify_payment_received(payment, created_by=request.user)
            except Exception:
                pass  # Don't fail payment recording if notification fails
        return response


class ExpenseCategoryViewSet(BaseTenantViewSet):
    queryset = ExpenseCategory.objects.select_related('tenant')
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsSchoolAdminOrBursar]
    allow_delete = False


class ExpenseViewSet(BaseTenantViewSet):
    queryset = Expense.objects.select_related('tenant', 'category', 'recorded_by')
    serializer_class = ExpenseSerializer
    permission_classes = [IsSchoolAdminOrBursar]
    allow_delete = False


@api_view(['GET'])
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


METHOD_MAP = {
    'mtn_momo': PaymentTransaction.PaymentMethod.MOBILE_MONEY,
    'orange_money': PaymentTransaction.PaymentMethod.MOBILE_MONEY,
    'bank_transfer': PaymentTransaction.PaymentMethod.BANK_TRANSFER,
    'cash': PaymentTransaction.PaymentMethod.CASH,
}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_payment(request):
    """
    Parent-initiated payment via Mobile Money or Bank Transfer.
    Creates a PaymentTransaction and updates the invoice balance.
    In production, this would integrate with MTN MoMo / Orange Money APIs.
    For now, payments are auto-confirmed (mock).
    """
    tenant = getattr(request, 'tenant', None)
    if not tenant:
        return Response({'detail': 'Tenant context required.'}, status=status.HTTP_400_BAD_REQUEST)

    invoice_id = request.data.get('invoice_id')
    amount = request.data.get('amount')
    payment_method = request.data.get('payment_method', 'mtn_momo')
    phone_number = request.data.get('phone_number', '')

    if not invoice_id or not amount:
        return Response({'detail': 'invoice_id and amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'detail': 'Amount must be a positive number.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        invoice = StudentInvoice.objects.get(id=invoice_id, tenant=tenant)
    except StudentInvoice.DoesNotExist:
        return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

    if invoice.status == StudentInvoice.Status.PAID:
        return Response({'detail': 'This invoice is already fully paid.'}, status=status.HTTP_400_BAD_REQUEST)

    if amount > float(invoice.balance):
        return Response(
            {'detail': f'Amount exceeds outstanding balance of {invoice.balance} XAF.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    method = METHOD_MAP.get(payment_method, PaymentTransaction.PaymentMethod.MOBILE_MONEY)
    reference_id = get_random_string(12).upper()

    with transaction.atomic():
        payment = PaymentTransaction.objects.create(
            tenant=tenant,
            invoice=invoice,
            amount=amount,
            method=method,
            reference=f"{payment_method.upper()}-{reference_id}",
            recorded_by=request.user,
            notes=f"Parent payment via {payment_method}. Phone: {phone_number}" if phone_number else f"Parent payment via {payment_method}",
        )

        invoice.amount_paid = invoice.amount_paid + amount
        if invoice.amount_paid >= invoice.total_amount:
            invoice.status = StudentInvoice.Status.PAID
        elif invoice.amount_paid > 0:
            invoice.status = StudentInvoice.Status.PARTIAL
        invoice.save()

    # Notify parents about the payment
    try:
        announce_payment_received(payment, created_by=request.user)
    except Exception:
        pass

    return Response({
        'reference_number': payment.receipt_number,
        'status': 'completed',
        'amount': amount,
        'payment_method': payment_method,
        'invoice_balance': float(invoice.balance),
    }, status=status.HTTP_201_CREATED)
