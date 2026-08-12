"""
Receipt & Statement PDF Generation — School OS

Print-friendly, brand-adaptive PDFs for fee payments:
  - generate_payment_receipt_pdf(payment)  → one official receipt per payment / installment
  - generate_invoice_statement_pdf(invoice) → full payment history (fee statement)

Receipts are deterministic renderings of immutable PaymentTransaction rows, so
they can be regenerated identically at any time (school office or parent portal).
"""
import hashlib
import hmac
import io
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Table, TableStyle,
    Paragraph, Spacer,
)

DEFAULT_PRIMARY = '#1a2b5f'
BLACK = colors.black
GRAY_10 = colors.HexColor('#eeeeee')
GRAY_5 = colors.HexColor('#f7f7f7')


# ────────────────────────────────────────────────────────────────
# Verification
# ────────────────────────────────────────────────────────────────
def receipt_verification_code(receipt_number):
    """Deterministic short HMAC code printed on receipts for public verification."""
    digest = hmac.new(
        str(settings.SECRET_KEY).encode(), str(receipt_number).encode(), hashlib.sha256
    ).hexdigest()
    return f"{int(digest, 16) % 100_000_000:08d}"


# ────────────────────────────────────────────────────────────────
# Shared helpers
# ────────────────────────────────────────────────────────────────
def _primary_color(tenant):
    try:
        theme = (tenant.theme_config or {}).get('primaryColor') or DEFAULT_PRIMARY
        return colors.HexColor(str(theme))
    except Exception:
        return colors.HexColor(DEFAULT_PRIMARY)


def _currency(tenant):
    from apps.tenants.models import TenantConfig
    return TenantConfig.get_for_tenant(tenant).currency_symbol or 'XAF'


def _money(tenant, value):
    try:
        return f"{float(value):,.0f} {_currency(tenant)}"
    except (TypeError, ValueError):
        return f"{value} {_currency(tenant)}"


def _styles(primary):
    base = getSampleStyleSheet()
    s = {}
    s['h1'] = ParagraphStyle('h1', parent=base['Normal'], fontName='Times-Bold',
                             fontSize=15, alignment=TA_CENTER, textColor=colors.white)
    s['title'] = ParagraphStyle('title', parent=base['Normal'], fontName='Times-Bold',
                                fontSize=13, alignment=TA_CENTER, textColor=BLACK)
    s['subtitle'] = ParagraphStyle('subtitle', parent=base['Normal'], fontName='Times-Roman',
                                   fontSize=9, alignment=TA_CENTER, textColor=BLACK)
    s['label'] = ParagraphStyle('label', parent=base['Normal'], fontName='Times-Bold',
                                fontSize=8, textColor=colors.gray)
    s['value'] = ParagraphStyle('value', parent=base['Normal'], fontName='Times-Bold',
                                fontSize=9, textColor=BLACK)
    s['cell'] = ParagraphStyle('cell', parent=base['Normal'], fontName='Times-Roman',
                               fontSize=8, textColor=BLACK)
    s['cell_b'] = ParagraphStyle('cell_b', parent=base['Normal'], fontName='Times-Bold',
                                 fontSize=8, textColor=BLACK)
    s['right'] = ParagraphStyle('right', parent=base['Normal'], fontName='Times-Bold',
                                fontSize=8, alignment=TA_RIGHT, textColor=BLACK)
    s['big'] = ParagraphStyle('big', parent=base['Normal'], fontName='Times-Bold',
                              fontSize=16, alignment=TA_CENTER, textColor=primary)
    s['muted'] = ParagraphStyle('muted', parent=base['Normal'], fontName='Times-Roman',
                                fontSize=7, alignment=TA_CENTER, textColor=colors.gray)
    s['foot'] = ParagraphStyle('foot', parent=base['Normal'], fontName='Times-Roman',
                               fontSize=7, alignment=TA_CENTER, textColor=colors.gray)
    return s


def _header(elements, tenant, styles):
    """Branded header band: school name, motto, contact line, colored rule."""
    primary = _primary_color(tenant)

    band_data = [
        [Paragraph(f'{tenant.school_name.upper()}', styles['h1'])],
    ]
    if tenant.motto:
        band_data.append([Paragraph(f'{tenant.motto}', styles['subtitle'])])
    band = Table(band_data, colWidths=[170 * mm])
    band.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), primary),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(band)

    contact = ' | '.join(filter(None, [
        tenant.address, tenant.phone, tenant.email,
        tenant.postal_code,
    ]))
    if contact:
        elements.append(Paragraph(contact, styles['subtitle']))
    elements.append(Spacer(1, 3 * mm))


def _info_table(rows, styles, widths=None):
    """Rows of (label, value) pairs rendered as a label/value grid."""
    data = []
    for pair in rows:
        data.append([
            Paragraph(f'<b>{pair[0]}</b>', styles['label']),
            Paragraph(str(pair[1]), styles['value']),
        ])
    tbl = Table(data, colWidths=widths or [35 * mm, 50 * mm])
    tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
    ]))
    return tbl


def _paid_after(payment):
    """Cumulative paid on the invoice after this transaction (snapshot or computed)."""
    if payment.amount_paid_after is not None:
        return payment.amount_paid_after
    total = Decimal('0.00')
    for tx in payment.invoice.transactions.order_by('payment_date', 'id'):
        total += tx.amount
        if tx.id == payment.id:
            break
    return total


# ────────────────────────────────────────────────────────────────
# Type A — Payment Receipt (per transaction / installment)
# ────────────────────────────────────────────────────────────────
def generate_payment_receipt_pdf(payment):
    buffer = io.BytesIO()
    tenant = payment.invoice.tenant
    invoice = payment.invoice
    student = invoice.student

    doc = BaseDocTemplate(
        buffer, pagesize=A4,
        topMargin=15 * mm, bottomMargin=15 * mm,
        leftMargin=15 * mm, rightMargin=15 * mm,
    )
    frame = Frame(15 * mm, 15 * mm, A4[0] - 30 * mm, A4[1] - 30 * mm, id='main')
    doc.addPageTemplates([PageTemplate(id='main', frames=frame)])

    st = _styles(_primary_color(tenant))
    elements = []

    _header(elements, tenant, st)
    elements.append(Spacer(1, 3 * mm))

    elements.append(Paragraph('<b>OFFICIAL RECEIPT</b>', st['title']))
    elements.append(Paragraph(
        f'Receipt No: {payment.receipt_number}',
        st['subtitle'],
    ))
    elements.append(Paragraph(
        f'Verification Code: {receipt_verification_code(payment.receipt_number)}',
        st['subtitle'],
    ))
    elements.append(Spacer(1, 3 * mm))

    elements.append(_info_table([
        ('Payment Date', timezone.localtime(payment.payment_date).strftime('%d/%m/%Y at %H:%M')),
        ('Student', student.full_name if student else '-'),
        ('Class', student.current_class.name if student and student.current_class else '-'),
        ('Admission No', student.admission_number if student and student.admission_number else '-'),
        ('Academic Year', invoice.academic_year.name if invoice.academic_year else '-'),
        ('Fee Category', payment.fee_category.name if payment.fee_category else '-'),
        ('Invoice', invoice.invoice_number),
        ('Payment Method', payment.get_method_display()),
        ('Reference', payment.reference or '-'),
    ], st))
    elements.append(Spacer(1, 4 * mm))

    # Amount block
    amount_data = [
        [Paragraph('<b>AMOUNT PAID</b>', st['label']),
         Paragraph(_money(tenant, payment.amount), st['big'])],
        [Paragraph('Cumulative paid on this invoice', st['label']),
         Paragraph(_money(tenant, _paid_after(payment)), st['right'])],
        [Paragraph('Outstanding balance after this payment', st['label']),
         Paragraph(_money(tenant, invoice.total_amount - _paid_after(payment)), st['right'])],
    ]
    amt = Table(amount_data, colWidths=[120 * mm, 50 * mm])
    amt.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, BLACK),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, BLACK),
        ('BACKGROUND', (0, 0), (-1, 0), GRAY_10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(amt)
    elements.append(Spacer(1, 4 * mm))

    if payment.notes:
        elements.append(Paragraph(f'Notes: {payment.notes}', st['cell']))
        elements.append(Spacer(1, 3 * mm))

    if payment.recorded_by:
        recorded = getattr(payment.recorded_by, 'full_name', None) or str(payment.recorded_by)
        elements.append(Paragraph(
            f'Received by: {recorded}', st['subtitle'],
        ))
    elements.append(Spacer(1, 8 * mm))

    # Signature block
    sig_data = [[
        Paragraph('&nbsp;', st['cell']),
        Paragraph('&nbsp;', st['cell']),
    ]]
    sig = Table(sig_data, colWidths=[85 * mm, 85 * mm])
    sig.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (0, 0), 0.5, BLACK),
        ('LINEABOVE', (1, 0), (1, 0), 0.5, BLACK),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(sig)
    elements.append(Spacer(1, 1 * mm))
    sign_row = Table(
        [[Paragraph('Authorised Signature', st['muted']),
          Paragraph('Bursar / School Official', st['muted'])]],
        colWidths=[85 * mm, 85 * mm],
    )
    elements.append(sign_row)
    elements.append(Spacer(1, 5 * mm))

    elements.append(Paragraph('Thank you for your payment.', st['subtitle']))
    elements.append(Paragraph(
        f'Generated by School OS on {timezone.now().strftime("%d/%m/%Y at %H:%M")}',
        st['foot'],
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


# ────────────────────────────────────────────────────────────────
# Type B — Fee Statement (invoice payment history)
# ────────────────────────────────────────────────────────────────
def generate_invoice_statement_pdf(invoice):
    buffer = io.BytesIO()
    tenant = invoice.tenant
    student = invoice.student

    doc = BaseDocTemplate(
        buffer, pagesize=A4,
        topMargin=15 * mm, bottomMargin=15 * mm,
        leftMargin=15 * mm, rightMargin=15 * mm,
    )
    frame = Frame(15 * mm, 15 * mm, A4[0] - 30 * mm, A4[1] - 30 * mm, id='main')
    doc.addPageTemplates([PageTemplate(id='main', frames=frame)])

    st = _styles(_primary_color(tenant))
    elements = []

    _header(elements, tenant, st)
    elements.append(Spacer(1, 3 * mm))

    elements.append(Paragraph('<b>STATEMENT OF ACCOUNT</b>', st['title']))
    elements.append(Paragraph(
        f'Invoice: {invoice.invoice_number}',
        st['subtitle'],
    ))
    elements.append(Spacer(1, 3 * mm))

    elements.append(_info_table([
        ('Student', student.full_name if student else '-'),
        ('Class', student.current_class.name if student and student.current_class else '-'),
        ('Admission No', student.admission_number if student and student.admission_number else '-'),
        ('Academic Year', invoice.academic_year.name if invoice.academic_year else '-'),
        ('Due Date', invoice.due_date.strftime('%d/%m/%Y') if invoice.due_date else '-'),
        ('Status', invoice.get_status_display()),
    ], st))
    elements.append(Spacer(1, 4 * mm))

    # Line items
    items = invoice.line_items.all()
    if items:
        elements.append(Paragraph('<b>Fees covered</b>', st['label']))
        line_data = [[
            Paragraph('<b>Description</b>', st['cell_b']),
            Paragraph('<b>Amount</b>', st['right']),
        ]]
        for item in items:
            line_data.append([
                Paragraph(item.label, st['cell']),
                Paragraph(_money(tenant, item.amount), st['right']),
            ])
        line_tbl = Table(line_data, colWidths=[120 * mm, 50 * mm])
        line_tbl.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, BLACK),
            ('INNERGRID', (0, 0), (-1, -2), 0.3, BLACK),
            ('BACKGROUND', (0, 0), (-1, 0), GRAY_10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(line_tbl)
        elements.append(Spacer(1, 4 * mm))

    # Payment history
    elements.append(Paragraph('<b>Payment history</b>', st['label']))
    txs = list(invoice.transactions.order_by('payment_date', 'id'))
    if txs:
        hist = [[
            Paragraph('<b>Date</b>', st['cell_b']),
            Paragraph('<b>Receipt No</b>', st['cell_b']),
            Paragraph('<b>Method</b>', st['cell_b']),
            Paragraph('<b>Reference</b>', st['cell_b']),
            Paragraph('<b>Amount</b>', st['right']),
            Paragraph('<b>Balance After</b>', st['right']),
        ]]
        running = Decimal('0.00')
        for tx in txs:
            running += tx.amount
            balance_after = invoice.total_amount - running
            hist.append([
                Paragraph(timezone.localtime(tx.payment_date).strftime('%d/%m/%Y %H:%M'), st['cell']),
                Paragraph(tx.receipt_number, st['cell']),
                Paragraph(tx.get_method_display(), st['cell']),
                Paragraph(tx.reference or '-', st['cell']),
                Paragraph(_money(tenant, tx.amount), st['right']),
                Paragraph(_money(tenant, balance_after), st['right']),
            ])
        hist_tbl = Table(hist, colWidths=[32 * mm, 34 * mm, 22 * mm, 30 * mm, 26 * mm, 26 * mm])
        hist_tbl.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, BLACK),
            ('INNERGRID', (0, 0), (-1, -1), 0.3, BLACK),
            ('BACKGROUND', (0, 0), (-1, 0), GRAY_10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(hist_tbl)
        elements.append(Spacer(1, 4 * mm))
    else:
        elements.append(Paragraph('No payments recorded for this invoice.', st['cell']))
        elements.append(Spacer(1, 3 * mm))

    # Totals
    tot_data = [
        [Paragraph('<b>Total Billed</b>', st['cell_b']),
         Paragraph(_money(tenant, invoice.total_amount), st['right'])],
        [Paragraph('<b>Total Paid</b>', st['cell_b']),
         Paragraph(_money(tenant, invoice.amount_paid), st['right'])],
        [Paragraph('<b>Outstanding Balance</b>', st['cell_b']),
         Paragraph(_money(tenant, invoice.balance), st['right'])],
    ]
    tot = Table(tot_data, colWidths=[120 * mm, 50 * mm])
    tot.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, BLACK),
        ('INNERGRID', (0, 0), (-1, -2), 0.3, BLACK),
        ('LINEABOVE', (0, -1), (-1, -1), 0.5, BLACK),
        ('BACKGROUND', (0, -1), (-1, -1), GRAY_5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(tot)

    if invoice.status == invoice.Status.CANCELLED:
        elements.append(Spacer(1, 3 * mm))
        elements.append(Paragraph('<b>THIS INVOICE HAS BEEN VOIDED / CANCELLED.</b>', st['big']))

    elements.append(Spacer(1, 5 * mm))
    elements.append(Paragraph('Thank you for your payment.', st['subtitle']))
    elements.append(Paragraph(
        f'Generated by School OS on {timezone.now().strftime("%d/%m/%Y at %H:%M")}',
        st['foot'],
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


def generate_receipt_pdf(invoice):
    """Backwards-compatible alias — the old invoice-level 'receipt' is now the statement."""
    return generate_invoice_statement_pdf(invoice)
