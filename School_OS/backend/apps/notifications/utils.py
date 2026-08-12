"""
Notification Utilities — create targeted per-user notifications and
broadcast announcements for system events.

Per-user notifications (Notification model) are used for anything that
concerns a specific person or family (invoices, payments, reminders).
Broadcast announcements (Announcement model) are used for school-wide
communication.
"""
from apps.authentication.models import User
from apps.notifications.models import Announcement, Notification


# ────────────────────────────────────────────────────────────────
# Per-user notifications
# ────────────────────────────────────────────────────────────────
def notify_user(tenant, recipient, category, title, body, link='', created_by=None):
    """Create a notification for a single user."""
    if recipient is None:
        return None
    return Notification.objects.create(
        tenant=tenant,
        recipient=recipient,
        category=category,
        title=title,
        body=body,
        link=link or '',
    )


def notify_users(tenant, recipients, category, title, body, link='', created_by=None):
    """Create one notification per recipient. Duplicate recipients are ignored."""
    created = []
    seen = set()
    for recipient in recipients or []:
        if recipient is None or recipient.id in seen:
            continue
        seen.add(recipient.id)
        created.append(notify_user(tenant, recipient, category, title, body, link, created_by))
    return created


def notify_student_parents(tenant, student, category, title, body, link='', created_by=None):
    """Notify every parent user linked to a specific student (not all parents in the school)."""
    if student is None:
        return []
    from apps.students.models import ParentStudentRelationship
    parents = ParentStudentRelationship.objects.filter(
        student=student, tenant_id=getattr(tenant, 'id', None)
    ).select_related('parent_user').values_list('parent_user', flat=True)
    recipients = User.objects.filter(id__in=list(parents))
    return notify_users(tenant, recipients, category, title, body, link, created_by)


def notify_tenant_admins(tenant, category, title, body, link='', created_by=None):
    """Notify all admin/super_admin/bursar users of a tenant."""
    recipients = User.objects.filter(
        role_mappings__tenant_id=getattr(tenant, 'id', None),
        role_mappings__role__in=['admin', 'super_admin', 'bursar'],
        role_mappings__is_active=True,
    ).distinct()
    return notify_users(tenant, recipients, category, title, body, link, created_by)


def notify_tenant_teachers(tenant, category, title, body, link='', created_by=None):
    """Notify all teacher users of a tenant."""
    recipients = User.objects.filter(
        role_mappings__tenant_id=getattr(tenant, 'id', None),
        role_mappings__role='teacher',
        role_mappings__is_active=True,
    ).distinct()
    return notify_users(tenant, recipients, category, title, body, link, created_by)


def _format_amount(value):
    """Human-friendly amount formatting (handles Decimal/float/str)."""
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return str(value or 'N/A')


def _format_date(value):
    """Safely format a date value, tolerating strings."""
    try:
        return value.strftime('%d %b %Y')
    except AttributeError:
        return str(value) if value else 'N/A'


# ────────────────────────────────────────────────────────────────
# Finance notifications
# ────────────────────────────────────────────────────────────────
def notify_invoice_created(invoice, created_by=None):
    """Notify the student's parents that a new fee invoice was created."""
    student = invoice.student
    student_name = student.full_name if student else 'a student'
    year_name = invoice.academic_year.name if invoice.academic_year else ''
    title = f"New Invoice: {invoice.invoice_number}"
    body = (
        f"A new fee invoice ({invoice.invoice_number}) has been created for {student_name}. "
        f"Amount: {_format_amount(invoice.total_amount)} | Due: {_format_date(invoice.due_date)}. "
        f"Academic Year: {year_name}."
    )
    return notify_student_parents(
        invoice.tenant, student, Notification.Category.FEE_INVOICE,
        title, body, link='/parent/fees', created_by=created_by,
    )


def notify_payment_received(payment, created_by=None):
    """
    Notify the student's parents that a payment was recorded, and notify
    tenant admins/bursars so the office is aware of every payment.
    """
    invoice = payment.invoice
    student = invoice.student if invoice else None
    student_name = student.full_name if student else 'a student'
    amount = _format_amount(payment.amount)
    balance = _format_amount(invoice.balance) if invoice else 'N/A'
    category_name = payment.fee_category.name if payment.fee_category else 'Fees'

    parent_title = f"Payment Confirmed: {payment.receipt_number}"
    parent_body = (
        f"A payment of {amount} has been recorded for {student_name} "
        f"toward {category_name} (Invoice: {invoice.invoice_number}). "
        f"Remaining balance: {balance}. "
        f"Your official receipt is available on the parent portal."
    )
    parent_notifs = notify_student_parents(
        payment.tenant, student, Notification.Category.PAYMENT,
        parent_title, parent_body, link='/parent/receipts', created_by=created_by,
    )

    admin_title = f"Payment Received: {payment.receipt_number}"
    admin_body = (
        f"A payment of {amount} has been received from {student_name} "
        f"for {category_name} (Invoice: {invoice.invoice_number}). "
        f"Reference: {payment.reference or payment.receipt_number}."
    )
    admin_notifs = notify_tenant_admins(
        payment.tenant, Notification.Category.PAYMENT,
        admin_title, admin_body, link='/admin/finance', created_by=created_by,
    )
    return parent_notifs + admin_notifs


def notify_fee_reminder(invoice, created_by=None):
    """Notify only the parents of the student with the outstanding balance."""
    student = invoice.student
    student_name = student.full_name if student else 'your child'
    balance = _format_amount(invoice.balance)
    year_name = invoice.academic_year.name if invoice.academic_year else 'current academic year'
    title = f"Fee Reminder: {student_name}"
    body = (
        f"Dear Parent, this is a reminder that {student_name} has an outstanding "
        f"school fee balance of {balance} for {year_name}. "
        f"Due date: {_format_date(invoice.due_date)}. "
        f"Please settle the balance promptly to avoid any disruption."
    )
    return notify_student_parents(
        invoice.tenant, student, Notification.Category.FEE_REMINDER,
        title, body, link='/parent/fees', created_by=created_by,
    )


# ────────────────────────────────────────────────────────────────
# Broadcast announcements (school-wide communication)
# ────────────────────────────────────────────────────────────────
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
    """Backwards-compatible alias for notify_invoice_created."""
    return notify_invoice_created(invoice, created_by=created_by)


def announce_payment_received(payment, created_by=None):
    """Backwards-compatible alias for notify_payment_received."""
    return notify_payment_received(payment, created_by=created_by)


def send_fee_reminder(invoice, created_by=None):
    """Backwards-compatible alias for notify_fee_reminder."""
    return notify_fee_reminder(invoice, created_by=created_by)


def announce_mark_window_opened(window, created_by=None):
    """Notify teachers that a mark entry window has been opened."""
    seq = window.sequence
    title = f"Mark Entry Open: {seq.name} ({seq.term.name})"
    body = (
        f"The mark entry window for {seq.name} ({seq.term.name}) is now open. "
        f"Please enter and submit your marks"
        f"{' by ' + _format_date(window.end_date) if window.end_date else ''}."
    )
    announce = announce_to_teachers(
        tenant=window.tenant,
        title=title,
        body=body,
        is_urgent=True,
        created_by=created_by,
    )
    notify_tenant_teachers(
        window.tenant, Notification.Category.MARKS, title, body,
        link='/teacher/assessments', created_by=created_by,
    )
    return announce


def announce_mark_window_closed(window, created_by=None):
    """Notify teachers that a mark entry window has been closed."""
    seq = window.sequence
    title = f"Mark Entry Closed: {seq.name} ({seq.term.name})"
    body = (
        f"The mark entry window for {seq.name} ({seq.term.name}) has been closed. "
        f"No more marks can be submitted for this sequence."
    )
    announce = announce_to_teachers(
        tenant=window.tenant,
        title=title,
        body=body,
        is_urgent=True,
        created_by=created_by,
    )
    notify_tenant_teachers(
        window.tenant, Notification.Category.MARKS, title, body,
        link='/teacher/assessments', created_by=created_by,
    )
    return announce
