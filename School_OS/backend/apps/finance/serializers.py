from rest_framework import serializers
from apps.finance.models import (
    FeeCategory, FeeStructure, StudentInvoice, PaymentTransaction,
    InvoiceLineItem, ExpenseCategory, Expense
)
from django.db import transaction


class FeeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeCategory
        fields = ['id', 'name', 'is_mandatory', 'description']


class FeeStructureSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='category.name', read_only=True)
    class_display = serializers.CharField(source='target_class.name', read_only=True)

    class Meta:
        model = FeeStructure
        fields = ['id', 'academic_year', 'category', 'category_display', 'target_class', 'class_display', 'amount']


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = ['id', 'fee_structure', 'label', 'amount']


class StudentInvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_class = serializers.SerializerMethodField()
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)

    class Meta:
        model = StudentInvoice
        fields = [
            'id', 'student', 'student_name', 'student_class', 'academic_year', 'invoice_number',
            'total_amount', 'amount_paid', 'balance', 'status', 'due_date',
            'line_items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['invoice_number', 'amount_paid', 'status', 'created_at', 'updated_at', 'total_amount']

    def get_student_class(self, obj):
        if obj.student and obj.student.current_class:
            return obj.student.current_class.name
        return None


class StudentInvoiceCreateSerializer(serializers.Serializer):
    """Used for batch creation — specifies which structures to apply."""
    student_id = serializers.UUIDField()
    fee_structure_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    due_date = serializers.DateField()


class StudentInvoiceLineItemSerializer(serializers.ModelSerializer):
    fee_structure_label = serializers.CharField(source='fee_structure.category.name', read_only=True)

    class Meta:
        model = InvoiceLineItem
        fields = ['id', 'invoice', 'fee_structure', 'fee_structure_label', 'label', 'amount']


class PaymentTransactionSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    student_name = serializers.CharField(source='invoice.student.full_name', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentTransaction
        fields = [
            'id', 'invoice', 'invoice_number', 'student_name', 'receipt_number',
            'amount', 'payment_date', 'method', 'reference', 'recorded_by', 'recorded_by_name',
            'notes'
        ]
        read_only_fields = ['receipt_number', 'payment_date', 'recorded_by']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.full_name
        return None

    @transaction.atomic
    def create(self, validated_data):
        invoice = validated_data['invoice']
        amount = validated_data['amount']

        if amount > invoice.balance:
            raise serializers.ValidationError({"amount": "Payment amount exceeds the outstanding balance."})

        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['recorded_by'] = request.user

        transaction_obj = super().create(validated_data)

        invoice.amount_paid += amount
        if invoice.amount_paid >= invoice.total_amount:
            invoice.status = StudentInvoice.Status.PAID
        elif invoice.amount_paid > 0:
            invoice.status = StudentInvoice.Status.PARTIAL
        invoice.save()

        return transaction_obj


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ['id', 'name', 'description']


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            'id', 'category', 'category_name', 'description', 'amount',
            'expense_date', 'payment_method', 'reference', 'recorded_by',
            'recorded_by_name', 'notes', 'created_at'
        ]
        read_only_fields = ['recorded_by', 'created_at']

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.full_name
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['recorded_by'] = request.user
        return super().create(validated_data)
