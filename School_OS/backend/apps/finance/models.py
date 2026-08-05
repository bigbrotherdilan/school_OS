from django.db import models
from apps.tenants.models import Tenant
import uuid

class FeeCategory(models.Model):
    """
    Types of fees: Tuition, Registration, Library, Transport, etc.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='fee_categories')
    name = models.CharField(max_length=100, help_text="e.g. Tuition Fee")
    is_mandatory = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_fee_categories'
        unique_together = ['tenant', 'name']

    def __str__(self):
        return f"{self.name} - {self.tenant.school_name}"


class FeeStructure(models.Model):
    """
    How much a specific class pays for a specific category in an academic year.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='fee_structures')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE)
    category = models.ForeignKey(FeeCategory, on_delete=models.CASCADE)
    target_class = models.ForeignKey('academic.Class', on_delete=models.CASCADE, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'finance_fee_structures'
        unique_together = ['tenant', 'academic_year', 'category', 'target_class']

    def __str__(self):
        return f"{self.category.name} - {self.target_class.name if self.target_class else 'Global'} - {self.amount}"


class StudentInvoice(models.Model):
    """
    The ledger statement or bill generated for a student.
    """
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        UNPAID = 'unpaid', 'Unpaid'
        PARTIAL = 'partial', 'Partially Paid'
        PAID = 'paid', 'Fully Paid'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='invoices')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='invoices')
    academic_year = models.ForeignKey('academic.AcademicYear', on_delete=models.CASCADE)
    
    invoice_number = models.CharField(max_length=50, unique=True, editable=False)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNPAID)
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_student_invoices'
        ordering = ['-created_at', '-invoice_number']

    @property
    def balance(self):
        return self.total_amount - self.amount_paid

    def __str__(self):
        return f"INV-{self.invoice_number} - {self.student.first_name if hasattr(self.student, 'first_name') else 'Student'}"

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            from django.utils.crypto import get_random_string
            self.invoice_number = f"INV-{get_random_string(8).upper()}"
        super().save(*args, **kwargs)


class PaymentTransaction(models.Model):
    """
    Record of money received.
    """
    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'Cash'
        BANK_TRANSFER = 'bank', 'Bank Transfer'
        MOBILE_MONEY = 'momo', 'Mobile Money'
        CHEQUE = 'cheque', 'Cheque'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='transactions')
    invoice = models.ForeignKey(StudentInvoice, on_delete=models.CASCADE, related_name='transactions')
    
    receipt_number = models.CharField(max_length=50, unique=True, editable=False)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateTimeField(auto_now_add=True)
    method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    reference = models.CharField(max_length=255, blank=True, help_text="Transaction ID from Momo/Bank")
    recorded_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_payment_transactions'
        ordering = ['-payment_date']

    def __str__(self):
        return f"RCT-{self.receipt_number} - {self.amount}"

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            from django.utils.crypto import get_random_string
            self.receipt_number = f"RCT-{get_random_string(8).upper()}"
        super().save(*args, **kwargs)


class InvoiceLineItem(models.Model):
    """Individual fee line on an invoice (e.g. Tuition: 150k, PTA: 10k)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(StudentInvoice, on_delete=models.CASCADE, related_name='line_items')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.SET_NULL, null=True, blank=True)
    label = models.CharField(max_length=200, help_text="e.g. Tuition Fee - Term 1")
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'finance_invoice_line_items'

    def __str__(self):
        return f"{self.label}: {self.amount}"


class ExpenseCategory(models.Model):
    """Types of expenses: Salaries, Utilities, Maintenance, etc."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='expense_categories')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_expense_categories'
        unique_together = ['tenant', 'name']

    def __str__(self):
        return self.name


class Expense(models.Model):
    """Record of money spent by the school."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='expenses')
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.CharField(max_length=300)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField()
    payment_method = models.CharField(
        max_length=20, choices=PaymentTransaction.PaymentMethod.choices, default='cash'
    )
    reference = models.CharField(max_length=255, blank=True)
    recorded_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_expenses'
        ordering = ['-expense_date']

    def __str__(self):
        return f"{self.description[:50]} - {self.amount}"
