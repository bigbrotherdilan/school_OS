from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.finance.views import (
    FeeCategoryViewSet, FeeStructureViewSet,
    StudentInvoiceViewSet, PaymentTransactionViewSet,
    ExpenseCategoryViewSet, ExpenseViewSet,
    finance_summary, receipt_verify,
    PaymentQuoteView, PaymentRecordView
)

router = DefaultRouter()
router.register(r'categories', FeeCategoryViewSet, basename='fee-category')
router.register(r'structures', FeeStructureViewSet, basename='fee-structure')
router.register(r'invoices', StudentInvoiceViewSet, basename='student-invoice')
router.register(r'transactions', PaymentTransactionViewSet, basename='payment-transaction')
router.register(r'expense-categories', ExpenseCategoryViewSet, basename='expense-category')
router.register(r'expenses', ExpenseViewSet, basename='expense')

urlpatterns = [
    path('summary/', finance_summary, name='finance-summary'),
    path('receipts/verify/<str:receipt_number>/', receipt_verify, name='receipt-verify'),
    path('payments/quote/', PaymentQuoteView.as_view(), name='payment-quote'),
    path('payments/record/', PaymentRecordView.as_view(), name='payment-record'),
    path('', include(router.urls)),
]
