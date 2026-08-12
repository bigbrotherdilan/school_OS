import os, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.finance.models import StudentInvoice, PaymentTransaction, InvoiceLineItem

inv = StudentInvoice.objects.get(id="4e442ac8-6453-4411-a655-53fcc9b3769c")
print("invoice:", inv.id, inv.invoice_number, "total:", inv.total_amount, "paid:", inv.amount_paid, "status:", inv.status, "created:", inv.created_at)
print("created today =", inv.created_at.date().isoformat())
print("line items:", list(InvoiceLineItem.objects.filter(invoice_id=inv.id).values_list('id', 'label', 'amount')))
print("txns on invoice:", PaymentTransaction.objects.filter(invoice_id=inv.id).count())

InvoiceLineItem.objects.filter(invoice_id=inv.id).delete()
inv.delete()
print("deleted invoice + line items")

print("residual txns:", PaymentTransaction.objects.filter(reference__startswith='TEST-DEBUG-').count())