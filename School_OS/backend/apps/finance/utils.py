"""
Receipt PDF Generation — School OS
Simple, print-friendly receipt for fee payments.
"""
import io
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Table, TableStyle,
    Paragraph, Spacer
)

FONT = 'Times-Roman'
FONT_BOLD = 'Times-Bold'
BLACK = colors.black
GRAY_10 = colors.HexColor('#eeeeee')
GRAY_5 = colors.HexColor('#f7f7f7')


def generate_receipt_pdf(invoice):
    """Generate a receipt PDF for a paid invoice."""
    buffer = io.BytesIO()
    tenant = invoice.tenant

    doc = BaseDocTemplate(
        buffer, pagesize=A4,
        topMargin=15*mm, bottomMargin=15*mm,
        leftMargin=15*mm, rightMargin=15*mm,
    )
    frame = Frame(15*mm, 15*mm, A4[0] - 30*mm, A4[1] - 30*mm, id='main')
    doc.addPageTemplates([PageTemplate(id='main', frames=frame)])

    styles = getSampleStyleSheet()

    def _sty(name, size=10, bold=False, align=TA_LEFT):
        return ParagraphStyle(
            name, parent=styles['Normal'],
            fontName=FONT_BOLD if bold else FONT,
            fontSize=size, alignment=align,
            textColor=BLACK,
        )

    elements = []

    # Header
    elements.append(Paragraph(
        f'<b>{tenant.school_name.upper()}</b>',
        _sty('h1', 14, bold=True, align=TA_CENTER)
    ))
    if tenant.address:
        elements.append(Paragraph(tenant.address, _sty('addr', 8, align=TA_CENTER)))
    if tenant.phone or tenant.email:
        line = ' | '.join(filter(None, [tenant.phone, tenant.email]))
        elements.append(Paragraph(line, _sty('contact', 8, align=TA_CENTER)))
    elements.append(Spacer(1, 4*mm))

    # Receipt title
    elements.append(Paragraph(
        '<b>OFFICIAL RECEIPT</b>',
        _sty('rt', 13, bold=True, align=TA_CENTER)
    ))
    elements.append(Paragraph(
        f'Receipt No: {invoice.transactions.first().receipt_number if invoice.transactions.exists() else "N/A"}',
        _sty('rn', 10, align=TA_CENTER)
    ))
    elements.append(Spacer(1, 3*mm))

    # Horizontal rule
    hr = Table([['']], colWidths=[170*mm])
    hr.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 1, BLACK)]))
    elements.append(hr)
    elements.append(Spacer(1, 3*mm))

    # Info block
    info_data = [
        [Paragraph('<b>Student:</b>', _sty('il', 9, bold=True)),
         Paragraph(invoice.student.full_name, _sty('iv', 9)),
         Paragraph('<b>Invoice:</b>', _sty('il', 9, bold=True)),
         Paragraph(invoice.invoice_number, _sty('iv', 9))],
        [Paragraph('<b>Class:</b>', _sty('il', 9, bold=True)),
         Paragraph(invoice.student.current_class.name if invoice.student.current_class else '-', _sty('iv', 9)),
         Paragraph('<b>Date:</b>', _sty('il', 9, bold=True)),
         Paragraph(timezone.now().strftime('%d/%m/%Y'), _sty('iv', 9))],
    ]
    info_tbl = Table(info_data, colWidths=[25*mm, 55*mm, 25*mm, 55*mm])
    info_tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(info_tbl)
    elements.append(Spacer(1, 3*mm))

    # Line items table
    items = invoice.line_items.all()
    table_data = [
        [Paragraph('<b>Description</b>', _sty('th', 8, bold=True, align=TA_CENTER)),
         Paragraph('<b>Amount</b>', _sty('th', 8, bold=True, align=TA_CENTER))],
    ]
    for item in items:
        table_data.append([
            Paragraph(item.label, _sty('td', 8, align=TA_LEFT)),
            Paragraph(f'{item.amount:,.2f}', _sty('td', 8, align=TA_RIGHT)),
        ])

    table_data.append([
        Paragraph('<b>Total</b>', _sty('tt', 9, bold=True, align=TA_LEFT)),
        Paragraph(f'<b>{invoice.total_amount:,.2f}</b>', _sty('tt', 9, bold=True, align=TA_RIGHT)),
    ])
    table_data.append([
        Paragraph('<b>Amount Paid</b>', _sty('tp', 9, bold=True, align=TA_LEFT)),
        Paragraph(f'<b>{invoice.amount_paid:,.2f}</b>', _sty('tp', 9, bold=True, align=TA_RIGHT)),
    ])
    table_data.append([
        Paragraph('<b>Balance</b>', _sty('tb', 9, bold=True, align=TA_LEFT)),
        Paragraph(f'<b>{invoice.balance:,.2f}</b>', _sty('tb', 9, bold=True, align=TA_RIGHT)),
    ])

    col_w = [120*mm, 50*mm]
    item_tbl = Table(table_data, colWidths=col_w)
    item_style = TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, BLACK),
        ('INNERGRID', (0, 0), (-1, -2), 0.3, BLACK),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 0), (-1, 0), GRAY_10),
        ('LINEABOVE', (0, -3), (-1, -3), 0.5, BLACK),
        ('LINEABOVE', (0, -1), (-1, -1), 0.5, BLACK),
        ('BACKGROUND', (0, -3), (-1, -1), GRAY_5),
    ])
    item_tbl.setStyle(item_style)
    elements.append(item_tbl)
    elements.append(Spacer(1, 5*mm))

    # Payment details
    tx = invoice.transactions.first()
    if tx:
        pay_data = [
            [Paragraph('<b>Payment Method:</b>', _sty('pl', 8, bold=True)),
             Paragraph(tx.get_method_display(), _sty('pv', 8)),
             Paragraph('<b>Reference:</b>', _sty('pl', 8, bold=True)),
             Paragraph(tx.reference or '-', _sty('pv', 8))],
        ]
        pay_tbl = Table(pay_data, colWidths=[30*mm, 50*mm, 30*mm, 50*mm])
        pay_tbl.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(pay_tbl)
        elements.append(Spacer(1, 3*mm))

    # Recorded by
    if tx and tx.recorded_by:
        elements.append(Paragraph(
            f'Recorded by: {tx.recorded_by.full_name}',
            _sty('rb', 8, align=TA_CENTER)
        ))
        elements.append(Spacer(1, 5*mm))

    # Footer
    elements.append(hr)
    elements.append(Spacer(1, 2*mm))
    elements.append(Paragraph(
        'Thank you for your payment.',
        _sty('thanks', 9, align=TA_CENTER)
    ))
    elements.append(Paragraph(
        f'Generated by School OS on {timezone.now().strftime("%d/%m/%Y at %H:%M")}',
        _sty('footer', 7, align=TA_CENTER)
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
