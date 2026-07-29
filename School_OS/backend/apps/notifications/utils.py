"""
Notification Utilities — Auto-create announcements for system events.
"""
from apps.notifications.models import Announcement


def announce_to_parents(tenant, title, body, is_urgent=False, created_by=None):
    """Create an announcement visible only to parents of a tenant."""
    return Announcement.objects.create(
        tenant=tenant,
        title=title,
        body=body,
        audience=Announcement.AudienceType.PARENTS,
        is_urgent=is_urgent,
        published=True,
        created_by=created_by,
    )


def announce_to_teachers(tenant, title, body, is_urgent=False, created_by=None):
    """Create an announcement visible only to teachers of a tenant."""
    return Announcement.objects.create(
        tenant=tenant,
        title=title,
        body=body,
        audience=Announcement.AudienceType.TEACHERS,
        is_urgent=is_urgent,
        published=True,
        created_by=created_by,
    )


def announce_to_all(tenant, title, body, is_urgent=False, created_by=None):
    """Create an announcement visible to everyone in a tenant."""
    return Announcement.objects.create(
        tenant=tenant,
        title=title,
        body=body,
        audience=Announcement.AudienceType.ALL,
        is_urgent=is_urgent,
        published=True,
        created_by=created_by,
    )


def announce_invoice_created(invoice, created_by=None):
    """Auto-announce when a new invoice is created for a student."""
    student_name = invoice.student.full_name if invoice.student else "a student"
    year_name = invoice.academic_year.name if invoice.academic_year else ""
    title = f"New Invoice: {invoice.invoice_number}"
    body = (
        f"A new fee invoice ({invoice.invoice_number}) has been created for {student_name}. "
        f"Amount: {invoice.total_amount} | Due: {invoice.due_date.strftime('%d %b %Y') if invoice.due_date else 'N/A'}. "
        f"Academic Year: {year_name}."
    )
    return announce_to_parents(
        tenant=invoice.tenant,
        title=title,
        body=body,
        is_urgent=False,
        created_by=created_by,
    )


def announce_payment_received(payment, created_by=None):
    """Auto-announce when a payment is received."""
    invoice = payment.invoice
    student_name = invoice.student.full_name if invoice.student else "a student"
    title = f"Payment Received: {payment.receipt_number}"
    body = (
        f"A payment of {payment.amount} has been recorded for {student_name} "
        f"(Invoice: {invoice.invoice_number}). Reference: {payment.reference}."
    )
    return announce_to_parents(
        tenant=payment.tenant,
        title=title,
        body=body,
        is_urgent=False,
        created_by=created_by,
    )


def send_fee_reminder(invoice, created_by=None):
    """Create a fee reminder announcement for a specific invoice."""
    student_name = invoice.student.full_name if invoice.student else "a student"
    balance = invoice.balance
    title = f"Fee Reminder: {invoice.invoice_number}"
    body = (
        f"Reminder: {student_name} has an outstanding balance of {balance} "
        f"for invoice {invoice.invoice_number}. "
        f"Due date: {invoice.due_date.strftime('%d %b %Y') if invoice.due_date else 'N/A'}. "
        f"Please settle the balance promptly."
    )
    return announce_to_parents(
        tenant=invoice.tenant,
        title=title,
        body=body,
        is_urgent=True,
        created_by=created_by,
    )


def announce_mark_window_opened(window, created_by=None):
    """Notify teachers that a mark entry window has been opened."""
    seq = window.sequence
    title = f"Mark Entry Open: {seq.name} ({seq.term.name})"
    body = (
        f"The mark entry window for {seq.name} ({seq.term.name}) is now open. "
        f"Please enter and submit your marks"
        f"{' by ' + window.end_date.strftime('%d %b %Y') if window.end_date else ''}."
    )
    return announce_to_teachers(
        tenant=window.tenant,
        title=title,
        body=body,
        is_urgent=True,
        created_by=created_by,
    )


def announce_mark_window_closed(window, created_by=None):
    """Notify teachers that a mark entry window has been closed."""
    seq = window.sequence
    title = f"Mark Entry Closed: {seq.name} ({seq.term.name})"
    body = (
        f"The mark entry window for {seq.name} ({seq.term.name}) has been closed. "
        f"No more marks can be submitted for this sequence."
    )
    return announce_to_teachers(
        tenant=window.tenant,
        title=title,
        body=body,
        is_urgent=True,
        created_by=created_by,
    )
