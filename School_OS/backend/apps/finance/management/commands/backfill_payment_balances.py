"""
backfill_payment_balances — School OS

Backfills the `amount_paid_after` snapshot on existing PaymentTransaction rows.

Each transaction is stamped with the invoice's cumulative amount paid at the
moment that transaction was recorded (transactions ordered by payment date,
then creation order). Receipts use this snapshot so an installment printed
today shows the balance that was correct when that payment was made — even
if the invoice is later adjusted.
"""
from django.core.management.base import BaseCommand

from apps.finance.models import PaymentTransaction, StudentInvoice


class Command(BaseCommand):
    help = "Backfills PaymentTransaction.amount_paid_after for existing transactions."

    def handle(self, *args, **options):
        invoices = StudentInvoice.objects.prefetch_related('transactions').all()
        updated = 0
        for invoice in invoices:
            txs = list(invoice.transactions.order_by('payment_date', 'id'))
            running = 0
            for tx in txs:
                running += tx.amount
                if tx.amount_paid_after != running:
                    tx.amount_paid_after = running
                    tx.save(update_fields=['amount_paid_after'])
                    updated += 1
        self.stdout.write(self.style.SUCCESS(
            f'Done. Backfilled {updated} transaction(s) across {invoices.count()} invoice(s).'
        ))
