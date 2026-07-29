from django.contrib import admin
from apps.finance.models import FeeCategory, FeeStructure, StudentInvoice, PaymentTransaction


@admin.register(FeeCategory)
class FeeCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'is_mandatory']
    list_filter = ['is_mandatory', 'tenant']
    search_fields = ['name']
    readonly_fields = ['id']


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ['category', 'target_class', 'academic_year', 'amount', 'tenant']
    list_filter = ['academic_year', 'tenant']
    search_fields = ['category__name']
    readonly_fields = ['id']
    raw_id_fields = ['tenant', 'academic_year', 'category', 'target_class']


class PaymentInline(admin.TabularInline):
    model = PaymentTransaction
    extra = 0
    readonly_fields = ['id', 'receipt_number', 'payment_date']
    fields = ['receipt_number', 'amount', 'method', 'reference', 'payment_date', 'recorded_by']


@admin.register(StudentInvoice)
class StudentInvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'student', 'total_amount', 'amount_paid', 'status', 'due_date']
    list_filter = ['status', 'tenant', 'academic_year']
    search_fields = ['invoice_number', 'student__first_name', 'student__last_name']
    readonly_fields = ['id', 'invoice_number', 'created_at', 'updated_at']
    raw_id_fields = ['tenant', 'student', 'academic_year']
    inlines = [PaymentInline]


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ['receipt_number', 'invoice', 'amount', 'method', 'payment_date', 'recorded_by']
    list_filter = ['method', 'tenant']
    search_fields = ['receipt_number', 'reference', 'invoice__invoice_number']
    readonly_fields = ['id', 'receipt_number', 'payment_date']
    raw_id_fields = ['tenant', 'invoice', 'recorded_by']
