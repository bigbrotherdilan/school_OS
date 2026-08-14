"""
Receipt & Statement PDF Generation â€” School OS

Modern, brand-adaptive PDFs for fee payments:
  - generate_payment_receipt_pdf(payment)  â†’ one official receipt per payment / installment
  - generate_invoice_statement_pdf(invoice) â†’ full payment history (fee statement)

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

# Modern palette
INK = colors.HexColor('#0f172a')
MUTED = colors.HexColor('#64748b')
LINE = colors.HexColor('#e2e8f0')
PAPER = colors.HexColor('#f8fafc')
SUCCESS = colors.HexColor('#16a34a')
SUCCESS_SOFT = colors.HexColor('#e9f7ef')
WHITE = colors.white
BLACK = colors.black
GRAY_10 = colors.HexColor('#f1f5f9')
GRAY_5 = colors.HexColor('#f8fafc')


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Verification
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def receipt_verification_code(receipt_number):
    """Deterministic short HMAC code printed on receipts for public verification."""
    digest = hmac.new(
        str(settings.SECRET_KEY).encode(), str(receipt_number).encode(), hashlib.sha256
    ).hexdigest()
    return f"{int(digest, 16) % 100_000_000:08d}"


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Shared helpers
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _primary_color(tenant):
    try:
        theme = (tenant.theme_config or {}).get('primaryColor') or DEFAULT_PRIMARY
        return colors.HexColor(str(theme))
    except Exception:
        return colors.HexColor(DEFAULT_PRIMARY)


def _soft(color, fraction=0.93):
    """Very light tint of a color, for card backgrounds (blend towards white)."""
    return colors.Color(
        color.red + (1 - color.red) * fraction,
        color.green + (1 - color.green) * fraction,
        color.blue + (1 - color.blue) * fraction,
    )


def _monogram(name):
    parts = [p for p in str(name or '').split() if p]
    letters = ''.join(p[0] for p in parts[:3]).upper()
    return letters or 'OS'


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

    # Identity / header
    s['monogram'] = ParagraphStyle('monogram', parent=base['Normal'], fontName='Helvetica-Bold',
                                   fontSize=12, alignment=TA_CENTER, textColor=WHITE)
    s['school'] = ParagraphStyle('school', parent=base['Normal'], fontName='Helvetica-Bold',
                                 fontSize=13.5, leading=16, textColor=INK)
    s['motto'] = ParagraphStyle('motto', parent=base['Normal'], fontName='Helvetica-Oblique',
                                fontSize=8.5, leading=11, textColor=MUTED)
    s['contact'] = ParagraphStyle('contact', parent=base['Normal'], fontName='Helvetica',
                                  fontSize=7, leading=9.5, textColor=MUTED)
    s['badge'] = ParagraphStyle('badge', parent=base['Normal'], fontName='Helvetica-Bold',
                                fontSize=9, alignment=TA_CENTER, textColor=primary)
    s['badge_sub'] = ParagraphStyle('badge_sub', parent=base['Normal'], fontName='Helvetica-Bold',
                                    fontSize=7, alignment=TA_CENTER, textColor=MUTED)

    # Receipt number strip
    s['receipt_no'] = ParagraphStyle('receipt_no', parent=base['Normal'], fontName='Courier-Bold',
                                     fontSize=10, alignment=TA_RIGHT, textColor=INK)

    # Cards
    s['card_label_w'] = ParagraphStyle('card_label_w', parent=base['Normal'], fontName='Helvetica-Bold',
                                       fontSize=6.5, alignment=TA_CENTER, textColor=WHITE)
    s['card_amount_w'] = ParagraphStyle('card_amount_w', parent=base['Normal'], fontName='Helvetica-Bold',
                                        fontSize=15, leading=18, alignment=TA_CENTER, textColor=WHITE)
    s['card_sub_w'] = ParagraphStyle('card_sub_w', parent=base['Normal'], fontName='Helvetica',
                                     fontSize=6.5, alignment=TA_CENTER, textColor=WHITE)
    s['card_label'] = ParagraphStyle('card_label', parent=base['Normal'], fontName='Helvetica-Bold',
                                     fontSize=6.5, alignment=TA_CENTER, textColor=MUTED)
    s['card_value'] = ParagraphStyle('card_value', parent=base['Normal'], fontName='Helvetica-Bold',
                                     fontSize=13, leading=16, alignment=TA_CENTER, textColor=INK)
    s['card_sub'] = ParagraphStyle('card_sub', parent=base['Normal'], fontName='Helvetica',
                                   fontSize=6.5, alignment=TA_CENTER, textColor=MUTED)

    # Verification box
    s['code_label'] = ParagraphStyle('code_label', parent=base['Normal'], fontName='Helvetica-Bold',
                                     fontSize=6.5, textColor=MUTED)
    s['code'] = ParagraphStyle('code', parent=base['Normal'], fontName='Courier-Bold',
                               fontSize=10, textColor=primary)

    # Generic text
    s['title'] = ParagraphStyle('title', parent=base['Normal'], fontName='Helvetica-Bold',
                                fontSize=11, alignment=TA_LEFT, textColor=INK)
    s['subtitle'] = ParagraphStyle('subtitle', parent=base['Normal'], fontName='Helvetica',
                                   fontSize=8.5, alignment=TA_LEFT, textColor=MUTED)
    s['label'] = ParagraphStyle('label', parent=base['Normal'], fontName='Helvetica-Bold',
                                fontSize=6.5, textColor=MUTED)
    s['value'] = ParagraphStyle('value', parent=base['Normal'], fontName='Helvetica-Bold',
                                fontSize=8.5, leading=11, textColor=INK)
    s['cell'] = ParagraphStyle('cell', parent=base['Normal'], fontName='Helvetica',
                               fontSize=8, leading=10, textColor=INK)
    s['cell_b'] = ParagraphStyle('cell_b', parent=base['Normal'], fontName='Helvetica-Bold',
                                 fontSize=8, leading=10, textColor=INK)
    s['right'] = ParagraphStyle('right', parent=base['Normal'], fontName='Helvetica-Bold',
                                fontSize=8, alignment=TA_RIGHT, textColor=INK)
    s['big'] = ParagraphStyle('big', parent=base['Normal'], fontName='Helvetica-Bold',
                              fontSize=15, alignment=TA_CENTER, textColor=primary)
    s['muted'] = ParagraphStyle('muted', parent=base['Normal'], fontName='Helvetica',
                                fontSize=7, alignment=TA_CENTER, textColor=MUTED)
    s['foot'] = ParagraphStyle('foot', parent=base['Normal'], fontName='Helvetica',
                               fontSize=6.5, alignment=TA_CENTER, textColor=MUTED)
    return s


def _card(data, col_widths, radius, background=None, border_color=None, dash=None,
          inner=None, row_heights=None):
    """A rounded card (table). background/border_color may be None for 'inherit'."""
    tbl = Table(data, colWidths=col_widths, rowHeights=row_heights)
    style = [('ROUNDEDCORNERS', [radius, radius, radius, radius])]
    if background is not None:
        style.append(('BACKGROUND', (0, 0), (-1, -1), background))
    if border_color is not None:
        if dash:
            style.append(('BOX', (0, 0), (-1, -1), 0.7, border_color, None, dash))
        else:
            style.append(('BOX', (0, 0), (-1, -1), 0.7, border_color))
    style.append(('VALIGN', (0, 0), (-1, -1), 'MIDDLE'))
    style.append(('LEFTPADDING', (0, 0), (-1, -1), 8))
    style.append(('RIGHTPADDING', (0, 0), (-1, -1), 8))
    style.append(('TOPPADDING', (0, 0), (-1, -1), 4))
    style.append(('BOTTOMPADDING', (0, 0), (-1, -1), 4))
    if inner:
        style.extend(inner)
    tbl.setStyle(TableStyle(style))
    return tbl


def _header(elements, tenant, styles, primary, badge_text='OFFICIAL RECEIPT'):
    """Modern header: identity block + document badge, thin rule below."""
    monogram_tbl = _card(
        [[Paragraph(_monogram(tenant.school_name), styles['monogram'])]],
        [13 * mm], 8, background=primary, row_heights=[13 * mm],
    )

    name_lines = []
    if tenant.motto:
        name_lines.append(Paragraph(tenant.motto, styles['motto']))
    contact = '  |  '.join(filter(None, [
        tenant.address, tenant.phone, tenant.email, tenant.postal_code,
    ]))
    if contact:
        name_lines.append(Paragraph(contact, styles['contact']))

    identity = Table(
        [[
            monogram_tbl,
            Table(
                [[Paragraph(tenant.school_name.upper(), styles['school'])]] + [[line] for line in name_lines],
                colWidths=[108 * mm],
            ),
        ]],
        colWidths=[15 * mm, 113 * mm],
    )
    identity.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    badge_block = Table(
        [[
            _card(
                [[Paragraph(badge_text, styles['badge'])]],
                [52 * mm], 12, background=_soft(primary), border_color=primary,
                row_heights=[9 * mm],
            ),
        ]],
        colWidths=[52 * mm],
    )
    badge_block.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    header = Table(
        [[identity, badge_block]],
        colWidths=[128 * mm, 54 * mm],
    )
    header.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header)
    elements.append(Spacer(1, 2.5 * mm))

    rule = Table([['']], colWidths=[182 * mm])
    rule.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 1.2, primary),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(rule)
    elements.append(Spacer(1, 5 * mm))


def _details_grid(rows, styles):
    """Rows of (label, value) rendered two-per-row in a modern grid."""
    grid = []
    it = iter(rows)
    for left in it:
        right = next(it, None)
        row = [
            Paragraph(str(left[0]).upper(), styles['label']),
            Paragraph(str(left[1]), styles['value']),
        ]
        if right:
            row += [Paragraph(str(right[0]).upper(), styles['label']),
                    Paragraph(str(right[1]), styles['value'])]
        else:
            row += [Paragraph('&nbsp;', styles['label']), Paragraph('&nbsp;', styles['value'])]
        grid.append(row)
    tbl = Table(grid, colWidths=[30 * mm, 61 * mm, 30 * mm, 61 * mm])
    tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('LINEBELOW', (0, 0), (-1, -2), 0.4, LINE),
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


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Type A â€” Payment Receipt (per transaction / installment)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def generate_payment_receipt_pdf(payment):
    buffer = io.BytesIO()
    tenant = payment.invoice.tenant
    invoice = payment.invoice
    student = invoice.student

    doc = BaseDocTemplate(
        buffer, pagesize=A4,
        topMargin=14 * mm, bottomMargin=14 * mm,
        leftMargin=14 * mm, rightMargin=14 * mm,
    )
    frame = Frame(14 * mm, 14 * mm, A4[0] - 28 * mm, A4[1] - 28 * mm, id='main')
    doc.addPageTemplates([PageTemplate(id='main', frames=frame)])

    primary = _primary_color(tenant)
    soft = _soft(primary)
    st = _styles(primary)


    elements = []

    _header(elements, tenant, st, primary)

    # â”€â”€ Receipt number strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    number_row = Table(
        [[
            Paragraph(f'<b>RECEIPT</b> &nbsp; {payment.receipt_number}', st['receipt_no']),
        ]],
        colWidths=[182 * mm],
    )
    number_row.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(number_row)
    elements.append(Spacer(1, 4 * mm))

    # â”€â”€ Summary cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    paid_on = timezone.localtime(payment.payment_date).strftime('%d %b %Y')
    amt_card = _card(
        [
            [Paragraph('AMOUNT PAID', st['card_label_w'])],
            [Paragraph(_money(tenant, payment.amount), st['card_amount_w'])],
            [Paragraph(f'on {paid_on}', st['card_sub_w'])],
        ],
        [62 * mm], 12, background=primary, row_heights=[7 * mm, 10 * mm, 6 * mm],
    )
    cum_card = _card(
        [
            [Paragraph('CUMULATIVE PAID', st['card_label'])],
            [Paragraph(_money(tenant, _paid_after(payment)), st['card_value'])],
            [Paragraph('across this invoice', st['card_sub'])],
        ],
        [59 * mm], 12, background=WHITE, border_color=LINE, row_heights=[7 * mm, 10 * mm, 6 * mm],
    )
    out_card = _card(
        [
            [Paragraph('OUTSTANDING', st['card_label'])],
            [Paragraph(_money(tenant, invoice.total_amount - _paid_after(payment)), st['card_value'])],
            [Paragraph('balance after this payment', st['card_sub'])],
        ],
        [59 * mm], 12, background=WHITE, border_color=LINE, row_heights=[7 * mm, 10 * mm, 6 * mm],
    )
    cards = Table([[amt_card, cum_card, out_card]], colWidths=[64 * mm, 59 * mm, 59 * mm])
    cards.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (2, 0), (2, 0), 0),
        ('LEFTPADDING', (1, 0), (1, 0), 4),
        ('RIGHTPADDING', (1, 0), (1, 0), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(cards)
    elements.append(Spacer(1, 5 * mm))

    # â”€â”€ Details grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    details = [
        ('Student', student.full_name if student else '-'),
        ('Admission No', student.admission_number if student and student.admission_number else '-'),
        ('Class', student.current_class.name if student and student.current_class else '-'),
        ('Academic Year', invoice.academic_year.name if invoice.academic_year else '-'),
        ('Invoice', invoice.invoice_number),
        ('Fee Category', payment.fee_category.name if payment.fee_category else '-'),
        ('Payment Method', payment.get_method_display()),
        ('Reference', payment.reference or '-'),
        ('Payment Date', timezone.localtime(payment.payment_date).strftime('%d/%m/%Y at %H:%M')),
        ('Recorded By', (getattr(payment.recorded_by, 'full_name', None) or str(payment.recorded_by))
                        if payment.recorded_by else '-'),
    ]
    elements.append(_details_grid(details, st))
    elements.append(Spacer(1, 5 * mm))

    # â”€â”€ Verification box â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    verify = _card(
        [
            [
                Paragraph('VERIFICATION CODE', st['code_label']),
                Paragraph(receipt_verification_code(payment.receipt_number), st['code']),
                Paragraph('Verify at /verify-receipt', st['code_label']),
            ],
        ],
        [182 * mm], 10, background=PAPER, border_color=LINE, dash=[2, 2],
    )
    elements.append(verify)
    elements.append(Spacer(1, 6 * mm))

    if payment.notes:
        notes = Table(
            [[Paragraph('<b>NOTES</b>', st['label']), Paragraph(payment.notes, st['cell'])]],
            colWidths=[30 * mm, 152 * mm],
        )
        notes.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(notes)
        elements.append(Spacer(1, 6 * mm))

    # â”€â”€ Signature block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    sig = Table(
        [[
            Paragraph('&nbsp;', st['cell']),
            Paragraph('&nbsp;', st['cell']),
        ]],
        colWidths=[91 * mm, 91 * mm],
    )
    sig.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (0, 0), 0.5, INK),
        ('LINEABOVE', (1, 0), (1, 0), 0.5, INK),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(sig)
    elements.append(Spacer(1, 1 * mm))
    sign_row = Table(
        [[Paragraph('Authorised Signature', st['muted']),
          Paragraph('Bursar / School Official', st['muted'])]],
        colWidths=[91 * mm, 91 * mm],
    )
    sign_row.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(sign_row)
    elements.append(Spacer(1, 6 * mm))

    # â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    foot = Table([['']], colWidths=[182 * mm])
    foot.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, -1), 0.6, LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(foot)
    elements.append(Spacer(1, 1.5 * mm))
    elements.append(Paragraph('Thank you for your payment.', st['subtitle']))
    elements.append(Paragraph(
        f'Generated by School OS on {timezone.now().strftime("%d/%m/%Y at %H:%M")}',
        st['foot'],
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Type B â€” Fee Statement (invoice payment history)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def generate_invoice_statement_pdf(invoice):
    buffer = io.BytesIO()
    tenant = invoice.tenant
    student = invoice.student

    doc = BaseDocTemplate(
        buffer, pagesize=A4,
        topMargin=14 * mm, bottomMargin=14 * mm,
        leftMargin=14 * mm, rightMargin=14 * mm,
    )
    frame = Frame(14 * mm, 14 * mm, A4[0] - 28 * mm, A4[1] - 28 * mm, id='main')
    doc.addPageTemplates([PageTemplate(id='main', frames=frame)])

    primary = _primary_color(tenant)
    st = _styles(primary)
    elements = []

    _header(elements, tenant, st, primary, badge_text='STATEMENT OF ACCOUNT')

    elements.append(Paragraph('<b>STATEMENT OF ACCOUNT</b>', st['title']))
    elements.append(Spacer(1, 4 * mm))

    elements.append(_details_grid([
        ('Student', student.full_name if student else '-'),
        ('Class', student.current_class.name if student and student.current_class else '-'),
        ('Admission No', student.admission_number if student and student.admission_number else '-'),
        ('Academic Year', invoice.academic_year.name if invoice.academic_year else '-'),
        ('Invoice', invoice.invoice_number),
        ('Status', invoice.get_status_display()),
        ('Due Date', invoice.due_date.strftime('%d/%m/%Y') if invoice.due_date else '-'),
        ('&nbsp;', '&nbsp;'),
    ], st))
    elements.append(Spacer(1, 5 * mm))

    # Line items
    items = invoice.line_items.all()
    if items:
        elements.append(Paragraph('FEES COVERED', st['label']))
        elements.append(Spacer(1, 2 * mm))
        line_data = [[
            Paragraph('<b>Description</b>', st['cell_b']),
            Paragraph('<b>Amount</b>', st['right']),
        ]]
        for item in items:
            line_data.append([
                Paragraph(item.label, st['cell']),
                Paragraph(_money(tenant, item.amount), st['right']),
            ])
        line_tbl = _card(
            line_data, [120 * mm, 50 * mm], 8,
            background=None, border_color=LINE,
            inner=[
                ('INNERGRID', (0, 0), (-1, -2), 0.4, LINE),
                ('BACKGROUND', (0, 0), (-1, 0), GRAY_10),
            ],
        )
        elements.append(line_tbl)
        elements.append(Spacer(1, 5 * mm))

    # Payment history
    elements.append(Paragraph('PAYMENT HISTORY', st['label']))
    elements.append(Spacer(1, 2 * mm))
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
        hist_tbl = _card(
            hist, [32 * mm, 34 * mm, 22 * mm, 30 * mm, 26 * mm, 26 * mm], 8,
            background=None, border_color=LINE,
            inner=[
                ('INNERGRID', (0, 0), (-1, -1), 0.4, LINE),
                ('BACKGROUND', (0, 0), (-1, 0), GRAY_10),
            ],
        )
        elements.append(hist_tbl)
        elements.append(Spacer(1, 5 * mm))
    else:
        elements.append(Paragraph('No payments recorded for this invoice.', st['cell']))
        elements.append(Spacer(1, 4 * mm))

    # Totals
    tot_data = [
        [Paragraph('<b>Total Billed</b>', st['cell_b']),
         Paragraph(_money(tenant, invoice.total_amount), st['right'])],
        [Paragraph('<b>Total Paid</b>', st['cell_b']),
         Paragraph(_money(tenant, invoice.amount_paid), st['right'])],
        [Paragraph('<b>Outstanding Balance</b>', st['cell_b']),
         Paragraph(_money(tenant, invoice.balance), st['right'])],
    ]
    tot = _card(
        tot_data, [120 * mm, 50 * mm], 8,
        background=GRAY_5, border_color=LINE,
        inner=[
            ('LINEABOVE', (0, -1), (-1, -1), 0.7, primary),
            ('INNERGRID', (0, 0), (-1, -2), 0.4, LINE),
        ],
    )
    elements.append(tot)

    if invoice.status == invoice.Status.CANCELLED:
        elements.append(Spacer(1, 3 * mm))
        elements.append(Paragraph('<b>THIS INVOICE HAS BEEN VOIDED / CANCELLED.</b>', st['big']))

    elements.append(Spacer(1, 6 * mm))
    elements.append(Paragraph('Thank you for your payment.', st['subtitle']))
    elements.append(Paragraph(
        f'Generated by School OS on {timezone.now().strftime("%d/%m/%Y at %H:%M")}',
        st['foot'],
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


def generate_receipt_pdf(invoice):
    """Backwards-compatible alias â€” the old invoice-level 'receipt' is now the statement."""
    return generate_invoice_statement_pdf(invoice)
