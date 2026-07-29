"""
Premium Two-Sided ID Card PDF Generation — School OS
Modern minimalistic design following CR80 standard.
Front: Branding, photo, student info. Back: Details, QR, T&C.
Style-aware: accepts a style dict for full visual customization.
"""
import io
import zipfile
import qrcode
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import requests


# ── CR80 Standard Dimensions ──
CARD_W_MM = 85.6
CARD_H_MM = 53.98
PT_PER_MM = 2.834645669

CARD_W = CARD_W_MM * PT_PER_MM   # ~242.8 pt
CARD_H = CARD_H_MM * PT_PER_MM   # ~153.1 pt

# ── Static Colors (used for non-customizable elements) ──
WHITE = colors.white
BLACK = colors.black

# ── Default Style ──
DEFAULT_STYLE = {
    'primary_color': '#0B2348',
    'dark_navy_color': '#081A36',
    'accent_color': '#F2B01E',
    'bg_color': '#FFFFFF',
    'card_border_radius': 18,
    'show_geometric_bg': True,
    'geo_top_pct': 18,
    'geo_dark_opacity': 0.6,
    'show_gold_stripe': True,
    'stripe_top_pct': 20,
    'stripe_angle': -12,
    'stripe_width_pct': 40,
    'logo_size': 44,
    'school_name_size': 10,
    'photo_shape': 'rounded',
    'photo_width': 68,
    'photo_height': 78,
    'photo_top_pct': 36,
    'photo_border_width': 3,
    'photo_border_color': '#FFFFFF',
    'student_name_size': 12,
    'show_class': True,
    'show_id_number': True,
    'show_gold_divider': True,
    'show_motto': True,
    'show_footer': True,
    'footer_height': 22,
    'show_qr_code': True,
    'qr_size': 52,
    'show_terms': True,
    'show_back_footer': True,
    'back_footer_height': 32,
}


def _hex(hex_color):
    return colors.HexColor(hex_color)


def _resolve_style(template=None, overrides=None):
    """Merge defaults with template config and inline overrides."""
    style = dict(DEFAULT_STYLE)
    if template and hasattr(template, 'style_config') and template.style_config:
        style.update(template.style_config)
        style['primary_color'] = template.primary_color or style['primary_color']
        style['accent_color'] = template.accent_color or style['accent_color']
    if overrides:
        style.update(overrides)
    return style


def _fetch_image(url):
    try:
        if url:
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                return ImageReader(io.BytesIO(r.content))
    except Exception:
        pass
    return None


def _draw_rounded_rect(c, x, y, w, h, r, fill_color=None, stroke_color=None, stroke_width=0.5):
    """Draw a rounded rectangle."""
    p = c.beginPath()
    p.moveTo(x + r, y)
    p.lineTo(x + w - r, y)
    p.arcTo(x + w - r, y, x + w, y + r, 0, 90)
    p.lineTo(x + w, y + h - r)
    p.arcTo(x + w - r, y + h - r, x + w, y + h, 0, 90)
    p.lineTo(x + r, y + h)
    p.arcTo(x, y + h - r, x + r, y + h, 0, 90)
    p.lineTo(x, y + r)
    p.arcTo(x, y, x + r, y + r, 0, 90)
    p.close()
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_width)
    c.drawPath(p, fill=1, stroke=1 if stroke_color else 0)


def _draw_photo_frame(c, photo_x, photo_y, photo_w, photo_h, shape, border_w, border_color_hex):
    """Draw photo frame with configurable shape and border."""
    border_color = _hex(border_color_hex) if border_color_hex else WHITE
    radius = {'rounded': 6, 'circle': photo_w / 2, 'square': 0}.get(shape, 6)

    if radius > 0:
        _draw_rounded_rect(c, photo_x - border_w, photo_y - border_w,
                           photo_w + border_w * 2, photo_h + border_w * 2,
                           radius + 2, fill_color=border_color)
        c.saveState()
        c.setFillColor(colors.Color(0, 0, 0, 0.12))
        _draw_rounded_rect(c, photo_x - 1, photo_y - 2,
                           photo_w + 2, photo_h + 2, radius,
                           fill_color=colors.Color(0, 0, 0, 0.12))
        c.restoreState()
        _draw_rounded_rect(c, photo_x, photo_y, photo_w, photo_h, radius,
                           fill_color=colors.HexColor('#F6F7F9'),
                           stroke_color=colors.HexColor('#D9DDE5'), stroke_width=0.5)
    else:
        c.setFillColor(border_color)
        c.rect(photo_x - border_w, photo_y - border_w,
               photo_w + border_w * 2, photo_h + border_w * 2, fill=1, stroke=0)
        c.saveState()
        c.setFillColor(colors.Color(0, 0, 0, 0.12))
        c.rect(photo_x - 1, photo_y - 2, photo_w + 2, photo_h + 2, fill=1, stroke=0)
        c.restoreState()
        c.setFillColor(colors.HexColor('#F6F7F9'))
        c.rect(photo_x, photo_y, photo_w, photo_h, fill=1, stroke=0)


def _generate_qr_image(data_string):
    """Generate QR code as ImageReader."""
    qr = qrcode.QRCode(version=1, box_size=4, border=1)
    qr.add_data(data_string)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return ImageReader(buf)


# ════════════════════════════════════════════════════════
#  FRONT SIDE
# ════════════════════════════════════════════════════════

def _draw_front(c, student, tenant, academic_year=None, style=None):
    """Draw the premium front side of the ID card."""
    s = style or DEFAULT_STYLE

    primary = _hex(s['primary_color'])
    dark_navy = _hex(s['dark_navy_color'])
    accent = _hex(s['accent_color'])
    bg = _hex(s['bg_color'])

    # ── Background ──
    c.setFillColor(bg)
    c.rect(0, 0, CARD_W, CARD_H, fill=1, stroke=0)

    # ── Geometric Navy Polygons ──
    if s.get('show_geometric_bg', True):
        geo_top = s.get('geo_top_pct', 18) / 100.0
        p = c.beginPath()
        p.moveTo(0, CARD_H * (geo_top + 0.54))
        p.lineTo(CARD_W * 1.1, CARD_H * (geo_top + 0.37))
        p.lineTo(CARD_W * 1.1, -CARD_H * 0.1)
        p.lineTo(-CARD_W * 0.1, -CARD_H * 0.1)
        p.close()
        c.setFillColor(primary)
        c.drawPath(p, fill=1, stroke=0)

        p2 = c.beginPath()
        p2.moveTo(0, CARD_H * (geo_top + 0.58))
        p2.lineTo(CARD_W * 1.05, CARD_H * (geo_top + 0.42))
        p2.lineTo(CARD_W * 1.05, -CARD_H * 0.1)
        p2.lineTo(-CARD_W * 0.05, -CARD_H * 0.1)
        p2.close()
        c.setFillColor(dark_navy)
        c.saveState()
        c.setFillAlpha(s.get('geo_dark_opacity', 0.6))
        c.drawPath(p2, fill=1, stroke=0)
        c.restoreState()

    # ── Gold Diagonal Stripe ──
    if s.get('show_gold_stripe', True):
        stripe_y = CARD_H * (s.get('stripe_top_pct', 20) / 100.0)
        stripe_w = s.get('stripe_width_pct', 40) / 100.0
        angle = s.get('stripe_angle', -12)
        import math
        rad = math.radians(angle)
        end_x = CARD_W * stripe_w
        end_y = stripe_y + end_x * math.tan(rad)
        c.saveState()
        c.setStrokeColor(accent)
        c.setLineWidth(2.2)
        c.line(CARD_W * 0.08, stripe_y, end_x, end_y)
        c.restoreState()

    # ── Header: Logo + School Name ──
    logo_x = 14
    logo_y = CARD_H - 14
    logo_size = s.get('logo_size', 38) * (38 / 44)

    logo_img = _fetch_image(tenant.logo_url) if tenant.logo_url else None
    if logo_img:
        c.drawImage(logo_img, logo_x, logo_y - logo_size, logo_size, logo_size,
                     preserveAspectRatio=True, mask='auto')
    else:
        c.setFillColor(primary)
        c.circle(logo_x + logo_size / 2, logo_y - logo_size / 2, logo_size / 2, fill=1, stroke=0)
        c.setFillColor(accent)
        c.setFont('Helvetica-Bold', 16)
        c.drawCentredString(logo_x + logo_size / 2, logo_y - logo_size / 2 - 6,
                            (tenant.school_name or 'S')[0].upper())

    # School name
    name_x = logo_x + logo_size + 8
    name_y = logo_y - 6
    c.setFillColor(primary)
    school_name_size = s.get('school_name_size', 10)
    c.setFont('Helvetica-Bold', school_name_size)
    school_name = tenant.school_name or 'SCHOOL NAME'
    if len(school_name) > 20:
        parts = school_name.split()
        mid = len(parts) // 2
        line1 = ' '.join(parts[:mid])
        line2 = ' '.join(parts[mid:])
        c.drawString(name_x, name_y, line1.upper())
        c.setFont('Helvetica-Bold', school_name_size - 2)
        c.drawString(name_x, name_y - 11, line2.upper())
    else:
        c.drawString(name_x, name_y, school_name.upper())

    # Motto
    if tenant.motto and s.get('show_motto', True):
        c.setFont('Helvetica', 6)
        c.setFillColor(colors.HexColor('#5E6472'))
        motto_y = name_y - 22 if len(school_name) > 20 else name_y - 13
        c.drawString(name_x, motto_y, tenant.motto.upper())

    # ── Student Photo ──
    photo_w = s.get('photo_width', 68)
    photo_h = s.get('photo_height', 78)
    photo_x = (CARD_W - photo_w) / 2
    photo_y = CARD_H * (s.get('photo_top_pct', 36) / 100.0)

    _draw_photo_frame(c, photo_x, photo_y, photo_w, photo_h,
                      s.get('photo_shape', 'rounded'),
                      s.get('photo_border_width', 3),
                      s.get('photo_border_color', '#FFFFFF'))

    photo_img = _fetch_image(student.photo_url) if student.photo_url else None
    if photo_img:
        shape = s.get('photo_shape', 'rounded')
        if shape == 'circle':
            c.saveState()
            path = c.beginPath()
            path.circle(photo_x + photo_w / 2, photo_y + photo_h / 2, photo_w / 2)
            path.close()
            c.clipPath(path, stroke=0)
            c.drawImage(photo_img, photo_x, photo_y, photo_w, photo_h,
                         preserveAspectRatio=True, mask='auto', anchor='c')
            c.restoreState()
        else:
            c.drawImage(photo_img, photo_x, photo_y, photo_w, photo_h,
                         preserveAspectRatio=True, mask='auto', anchor='c')
    else:
        c.setFillColor(colors.HexColor('#D9DDE5'))
        c.setFont('Helvetica-Bold', int(photo_w * 0.4))
        c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2 - 10,
                            (student.first_name or '?')[0].upper())

    # ── Student Info ──
    info_y = photo_y - 4

    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', s.get('student_name_size', 12))
    full_name = f"{student.last_name} {student.first_name}".upper()
    c.drawCentredString(CARD_W / 2, info_y, full_name)

    # Class
    if s.get('show_class', True):
        class_name = student.current_class.name if student.current_class else 'N/A'
        if student.series:
            class_name += f' — {student.series.code}'
        c.setFont('Helvetica', 8)
        c.setFillColor(colors.Color(1, 1, 1, 0.85))
        c.drawCentredString(CARD_W / 2, info_y - 13, class_name)

    # Gold divider
    if s.get('show_gold_divider', True):
        c.setStrokeColor(accent)
        c.setLineWidth(1.2)
        div_y = info_y - 20
        c.line(CARD_W / 2 - 40, div_y, CARD_W / 2 + 40, div_y)

    # ID No.
    if s.get('show_id_number', True):
        div_y = info_y - 20
        c.setFillColor(colors.Color(1, 1, 1, 0.7))
        c.setFont('Helvetica', 5.5)
        c.drawCentredString(CARD_W / 2, div_y - 8, 'ID NO.')
        c.setFont('Helvetica-Bold', 10)
        c.setFillColor(WHITE)
        c.drawCentredString(CARD_W / 2, div_y - 19, student.admission_number or 'N/A')

    # ── Footer ──
    if s.get('show_footer', True):
        footer_h = s.get('footer_height', 22)
        p_footer = c.beginPath()
        p_footer.moveTo(0, footer_h)
        p_footer.lineTo(CARD_W, footer_h * 0.55)
        p_footer.lineTo(CARD_W, 0)
        p_footer.lineTo(0, 0)
        p_footer.close()
        c.setFillColor(WHITE if s['bg_color'] == '#FFFFFF' else bg)
        c.drawPath(p_footer, fill=1, stroke=0)

        website = tenant.email or ''
        if website:
            c.setFillColor(primary)
            c.setFont('Helvetica', 6.5)
            c.drawCentredString(CARD_W / 2, 7, f'🌐  {website}')


# ════════════════════════════════════════════════════════
#  BACK SIDE
# ════════════════════════════════════════════════════════

def _draw_back(c, student, tenant, academic_year=None, style=None):
    """Draw the premium back side of the ID card."""
    s = style or DEFAULT_STYLE

    primary = _hex(s['primary_color'])
    accent = _hex(s['accent_color'])
    bg = _hex(s['bg_color'])

    # ── Background ──
    c.setFillColor(bg)
    c.rect(0, 0, CARD_W, CARD_H, fill=1, stroke=0)

    # ── Header: School Name centered ──
    header_y = CARD_H - 16
    c.setFillColor(primary)
    c.setFont('Helvetica-Bold', 8)
    c.drawCentredString(CARD_W / 2, header_y, (tenant.school_name or 'SCHOOL').upper())

    # Divider with centered dot
    div_y = header_y - 8
    c.setStrokeColor(colors.HexColor('#D9DDE5'))
    c.setLineWidth(0.6)
    c.line(18, div_y, CARD_W / 2 - 5, div_y)
    c.line(CARD_W / 2 + 5, div_y, CARD_W - 18, div_y)
    c.setFillColor(primary)
    c.circle(CARD_W / 2, div_y, 2.2, fill=1, stroke=0)

    # ── Student Details (left side) ──
    detail_x = 18
    detail_y = div_y - 18
    row_spacing = 22
    icon_size = 16

    details = [
        ('Name', f"{student.last_name} {student.first_name}".upper()),
        ('Date of Birth', student.date_of_birth.strftime('%d %B %Y').upper() if student.date_of_birth else '—'),
        ('Blood Group', (student.blood_group or '—').upper()),
        ('Emergency Contact', student.emergency_contact or '—'),
    ]

    for i, (label, value) in enumerate(details):
        row_y = detail_y - i * row_spacing

        c.setFillColor(primary)
        c.circle(detail_x + icon_size / 2, row_y + 1, icon_size / 2, fill=1, stroke=0)

        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 7)
        icons = ['N', 'D', 'B', 'E']
        c.drawCentredString(detail_x + icon_size / 2, row_y - 2, icons[i])

        text_x = detail_x + icon_size + 8
        c.setFillColor(colors.HexColor('#5E6472'))
        c.setFont('Helvetica', 5.5)
        c.drawString(text_x, row_y + 5, label.upper())

        c.setFillColor(primary)
        c.setFont('Helvetica-Bold', 8)
        c.drawString(text_x, row_y - 5, value)

    # ── QR Code ──
    if s.get('show_qr_code', True):
        qr_size = s.get('qr_size', 52)
        qr_x = CARD_W - qr_size - 18
        qr_y = div_y - qr_size - 10

        _draw_rounded_rect(c, qr_x - 3, qr_y - 3, qr_size + 6, qr_size + 6, 4,
                           fill_color=WHITE, stroke_color=colors.HexColor('#D9DDE5'), stroke_width=0.75)

        qr_data = f"Student: {student.last_name} {student.first_name}\n"
        qr_data += f"ID: {student.admission_number}\n"
        qr_data += f"School: {tenant.school_name}\n"
        if student.current_class:
            qr_data += f"Class: {student.current_class.name}"
        qr_img = _generate_qr_image(qr_data)
        c.drawImage(qr_img, qr_x, qr_y, qr_size, qr_size, preserveAspectRatio=True)

        c.setFillColor(colors.HexColor('#5E6472'))
        c.setFont('Helvetica', 5)
        c.drawCentredString(qr_x + qr_size / 2, qr_y - 9, 'Scan for School Info')

        if tenant.logo_url:
            wm_img = _fetch_image(tenant.logo_url)
            if wm_img:
                wm_size = qr_size * 1.4
                c.drawImage(wm_img,
                             qr_x + qr_size / 2 - wm_size / 2,
                             qr_y + qr_size / 2 - wm_size / 2,
                             wm_size, wm_size, preserveAspectRatio=True, mask='auto')

    # ── Terms & Conditions ──
    if s.get('show_terms', True):
        tc_y = 50
        c.setStrokeColor(colors.HexColor('#D9DDE5'))
        c.setLineWidth(0.4)
        c.line(18, tc_y, CARD_W - 18, tc_y)

        c.setFillColor(primary)
        c.setFont('Helvetica-Bold', 5.5)
        c.drawString(18, tc_y - 8, 'TERMS & CONDITIONS')

        c.setFillColor(colors.HexColor('#5E6472'))
        c.setFont('Helvetica', 4.5)
        terms = [
            'This ID card is the property of the school.',
            'Carry it at all times on school premises.',
            'Report loss immediately to administration.',
            'This card is non-transferable.',
        ]
        for j, term in enumerate(terms):
            c.drawString(18, tc_y - 16 - j * 7, f'•  {term}')

    # ── Navy Footer ──
    if s.get('show_back_footer', True):
        footer_h = s.get('back_footer_height', 32)
        p_foot = c.beginPath()
        p_foot.moveTo(0, footer_h)
        p_foot.lineTo(CARD_W, footer_h * 0.65)
        p_foot.lineTo(CARD_W, 0)
        p_foot.lineTo(0, 0)
        p_foot.close()
        c.setFillColor(primary)
        c.drawPath(p_foot, fill=1, stroke=0)

        c.setFillColor(accent)
        p_tri = c.beginPath()
        p_tri.moveTo(CARD_W - 14, footer_h * 0.65)
        p_tri.lineTo(CARD_W, footer_h * 0.65)
        p_tri.lineTo(CARD_W, footer_h * 0.65 - 12)
        p_tri.close()
        c.drawPath(p_tri, fill=1, stroke=0)

        footer_content_y = 8
        c.setFillColor(WHITE)
        c.setFont('Helvetica', 5.5)

        if tenant.address:
            addr_lines = tenant.address.split(',')[:3]
            for k, line in enumerate(addr_lines):
                c.drawString(18, footer_content_y + 5 - k * 7, f'📍  {line.strip()}')

        right_x = CARD_W / 2 + 10
        if tenant.phone:
            c.drawString(right_x, footer_content_y + 5, f'☎  {tenant.phone}')
        if tenant.email:
            c.drawString(right_x, footer_content_y - 2, f'✉  {tenant.email}')


# ════════════════════════════════════════════════════════
#  PUBLIC API
# ════════════════════════════════════════════════════════

def generate_student_id_card(student, tenant, academic_year=None, template=None, style_overrides=None):
    """Generate a single two-sided ID card PDF."""
    style = _resolve_style(template, style_overrides)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(CARD_W, CARD_H))

    _draw_front(c, student, tenant, academic_year, style)
    c.showPage()
    _draw_back(c, student, tenant, academic_year, style)
    c.showPage()

    c.save()
    buffer.seek(0)
    return buffer


def generate_batch_id_cards_pdf(students, tenant, academic_year=None, template=None, style_overrides=None):
    """Generate multi-page PDF: front+back for each student consecutively."""
    style = _resolve_style(template, style_overrides)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(CARD_W, CARD_H))

    for student in students:
        _draw_front(c, student, tenant, academic_year, style)
        c.showPage()
        _draw_back(c, student, tenant, academic_year, style)
        c.showPage()

    c.save()
    buffer.seek(0)
    return buffer


def generate_batch_id_cards_zip(students, tenant, academic_year=None, template=None, style_overrides=None):
    """Generate individual two-sided PDFs per student, packaged as ZIP."""
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for student in students:
            pdf_buffer = generate_student_id_card(student, tenant, academic_year, template, style_overrides)
            safe_last = (student.last_name or '').replace(' ', '_').replace('/', '-')
            safe_first = (student.first_name or '').replace(' ', '_').replace('/', '-')
            filename = f"{safe_last}_{safe_first}_{student.admission_number}.pdf"
            zf.writestr(filename, pdf_buffer.getvalue())

    zip_buffer.seek(0)
    return zip_buffer
