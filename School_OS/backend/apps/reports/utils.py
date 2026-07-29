"""
Report Card PDF Generation — School OS
Cameroon standard three-term report card.
Supports full visual customization via style_config.
"""
import io
from decimal import Decimal
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Table, TableStyle,
    Paragraph, Spacer, Image, PageBreak
)
from reportlab.pdfgen import canvas

from .report_card_style import DEFAULT_STYLE, _resolve_style


FONT_MAP = {
    'times': ('Times-Roman', 'Times-Bold', 'Times-Italic'),
    'helvetica': ('Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique'),
}
FONT = 'Times-Roman'
FONT_BOLD = 'Times-Bold'
FONT_ITALIC = 'Times-Italic'

BLACK = colors.black
WHITE = colors.white
GRAY_5 = colors.HexColor('#f7f7f7')
GRAY_10 = colors.HexColor('#eeeeee')
GRAY_20 = colors.HexColor('#dddddd')
GRAY_40 = colors.HexColor('#aaaaaa')
GRAY_60 = colors.HexColor('#999999')

PAGE_W = A4[0] - 16*mm
PAGE_H = A4[1] - 16*mm

# Reusable style factory
_STYLE_CACHE = {}


def _sty(name, size=8, bold=False, align=TA_LEFT, color=BLACK, leading=None, space_before=0, space_after=0):
    key = (name, size, bold, align, leading, space_before, space_after)
    if key not in _STYLE_CACHE:
        _STYLE_CACHE[key] = ParagraphStyle(
            f'{name}_{size}_{bold}_{align}',
            fontName=FONT_BOLD if bold else FONT,
            fontSize=size, alignment=align, textColor=color,
            leading=leading or size * 1.25,
            spaceBefore=space_before, spaceAfter=space_after,
        )
    return _STYLE_CACHE[key]


def _sty_s(name, size=8, bold=False, align=TA_LEFT, color_hex='#000000', font_family='times', leading=None):
    """Style factory that uses hex color and configurable font family."""
    f = FONT_MAP.get(font_family, FONT_MAP['times'])
    font_name = f[1] if bold else f[0]
    c = colors.HexColor(color_hex)
    key = (name, size, bold, align, color_hex, font_family, leading)
    if key not in _STYLE_CACHE:
        _STYLE_CACHE[key] = ParagraphStyle(
            f'{name}_{size}_{font_family}',
            fontName=font_name,
            fontSize=size, alignment=align, textColor=c,
            leading=leading or size * 1.25,
        )
    return _STYLE_CACHE[key]


def _grade_from_score(score, max_score):
    if score is None or max_score <= 0:
        return '-'
    pct = (float(score) / float(max_score)) * 100
    if pct >= 80:
        return 'A'
    elif pct >= 70:
        return 'B'
    elif pct >= 60:
        return 'C'
    elif pct >= 50:
        return 'D'
    else:
        return 'F'


def _pass_mark(max_scale):
    return Decimal('10.00') if max_scale == 20 else Decimal('50.00')


def _get_pass_mark(education_type):
    if education_type == 'francophone':
        return Decimal('10.00'), Decimal('20.00')
    return Decimal('50.00'), Decimal('100.00')


def _decision(avg, max_scale):
    pm = _pass_mark(max_scale)
    avg_f = float(avg)
    pm_f = float(pm)
    if avg_f >= pm_f:
        return 'PROMOTED / ADMIS(E)'
    elif avg_f >= pm_f * 0.8:
        return 'CONDITIONAL / CONDITIONNEL'
    else:
        return 'REPEATED / REDOUBLE'


def _hr(weight=0.5):
    """Thin horizontal rule spacer."""
    t = Table([['']], colWidths=[PAGE_W])
    t.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), weight, BLACK)]))
    return t


# ═══════════════════════════════════════════════
#  MAIN PDF GENERATOR
# ═══════════════════════════════════════════════

def generate_report_card_pdf(
    student,
    tenant,
    academic_year,
    term,
    subject_scores,
    term2_scores=None,
    term3_scores=None,
    attendance_info=None,
    class_average=None,
    rank=None,
    class_size=None,
    template=None,
    style_overrides=None,
):
    # Resolve style
    st = _resolve_style(template, style_overrides)

    # Clear style cache for custom styles
    _STYLE_CACHE.clear()

    # Set global fonts from style
    global FONT, FONT_BOLD, FONT_ITALIC
    fonts = FONT_MAP.get(st['header_font'], FONT_MAP['times'])
    FONT = fonts[0]
    FONT_BOLD = fonts[1]
    FONT_ITALIC = fonts[2]

    # Derive colors from style
    border_clr = colors.HexColor(st['border_color'])
    primary_clr = colors.HexColor(st['primary_color'])
    accent_clr = colors.HexColor(st['accent_color'])
    header_bg = colors.HexColor(st['table_header_bg'])
    alt_row_bg = colors.HexColor(st['table_alt_row_bg'])
    decision_bg = colors.HexColor(st['decision_bg_color'])
    footer_clr = colors.HexColor(st['footer_text_color'])

    margin = st['page_margin_mm'] * mm
    PAGE_W_LOCAL = A4[0] - 2 * margin
    PAGE_H_LOCAL = A4[1] - 2 * margin

    buffer = io.BytesIO()
    education_type = tenant.education_type
    max_scale = Decimal('100') if education_type == 'anglophone' else Decimal('20')
    is_franco = education_type == 'francophone'

    doc = BaseDocTemplate(
        buffer, pagesize=A4,
        topMargin=margin, bottomMargin=margin,
        leftMargin=margin, rightMargin=margin,
    )
    frame = Frame(margin, margin, PAGE_W_LOCAL, PAGE_H_LOCAL, id='main')
    doc.addPageTemplates([PageTemplate(id='main', frames=frame)])

    elements = []

    # ── Utility ──
    fs_body = st['body_font_size']
    fs_table = st['table_font_size']
    fs_info = st['info_font_size']
    fs_header = st['header_font_size']
    ff = st['header_font']

    def _c(text, size=None, bold=False, align=TA_CENTER):
        return Paragraph(str(text), _sty_s(f'c_{text}', size or fs_table, bold=bold, align=align, color_hex=st['primary_color'], font_family=ff))

    def _l(text, size=None, bold=False):
        return Paragraph(str(text), _sty_s(f'l_{text}', size or fs_body, bold=bold, align=TA_LEFT, color_hex=st['primary_color'], font_family=ff))

    def _r(text, size=None, bold=False):
        return Paragraph(str(text), _sty_s(f'r_{text}', size or fs_body, bold=bold, align=TA_RIGHT, color_hex=st['primary_color'], font_family=ff))

    # ════════════════════════════════════════════
    #  PAGE BORDER (optional)
    # ════════════════════════════════════════════
    if st['show_page_border']:
        border_data = [['']]
        border_tbl = Table(border_data, colWidths=[PAGE_W_LOCAL])
        border_tbl.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), st['page_border_width'], border_clr),
        ]))
        elements.append(border_tbl)
        elements.append(Spacer(1, 2*mm))

    # ════════════════════════════════════════════
    #  THREE-COLUMN HEADER
    # ════════════════════════════════════════════

    col_w = [55*mm, 64*mm, 55*mm]

    left_lines = []
    if st['show_republic_header']:
        left_lines.append('<b>REPUBLIC OF CAMEROON</b>')
        left_lines.append('<i>Peace – Work – Fatherland</i>')
        left_lines.append('')

    left_lines.append(f'<b>{tenant.school_name}</b>')
    if tenant.address:
        left_lines.append(tenant.address)
    if tenant.motto:
        left_lines.append(f'<i>Motto: {tenant.motto}</i>')
    left_txt = '<br/>'.join(left_lines)

    right_lines = []
    if st['show_republic_header']:
        right_lines.append('<b>RÉPUBLIQUE DU CAMEROUN</b>')
        right_lines.append('<i>Paix – Travail – Patrie</i>')
        right_lines.append('')

    if st['show_ministry_header']:
        right_lines.append('<b>MINISTRY OF SECONDARY EDUCATION</b>')
        right_lines.append('Regional Delegation')
        right_lines.append('Divisional Delegation')
    right_txt = '<br/>'.join(right_lines)

    left_para = Paragraph(left_txt, _sty_s('h_left', fs_header, align=TA_LEFT, color_hex=st['primary_color'], font_family=ff))
    right_para = Paragraph(right_txt, _sty_s('h_right', fs_header, align=TA_RIGHT, color_hex=st['primary_color'], font_family=ff))

    # Center: logo if available
    logo_path = None
    if tenant.logo and st['show_logo']:
        logo_path = tenant.logo
        import os.path
        if not os.path.isabs(logo_path):
            from django.conf import settings
            logo_path = str(settings.MEDIA_ROOT / logo_path)
    logo_elem = None
    if logo_path and logo_path.strip():
        try:
            logo_elem = Image(logo_path, width=st['logo_size_mm']*mm, height=st['logo_size_mm']*mm)
        except Exception:
            logo_elem = None

    # Title text for center
    title_txt = (
        f'<b>{term.name.upper()} REPORT CARD</b><br/>'
        f'<i>Academic Year {academic_year.name}</i>'
    )
    title_para = Paragraph(title_txt, _sty_s('h_title', st['title_font_size'], bold=True, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff))

    if logo_elem:
        center_content = [[logo_elem], [title_para]]
        cent_tbl = Table(center_content, colWidths=[64*mm])
        cent_tbl.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
        ]))
        header_data = [[left_para, cent_tbl, right_para]]
    else:
        header_data = [[left_para, title_para, right_para]]

    header_table = Table(header_data, colWidths=col_w)
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LINEBELOW', (0, 0), (-1, 0), st['header_underline_width'], border_clr),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 2*mm))

    # ════════════════════════════════════════════
    #  STUDENT INFO (optional)
    # ════════════════════════════════════════════
    if st['show_student_info']:
        dob = student.date_of_birth.strftime('%d/%m/%Y') if student.date_of_birth else '-'
        class_name = student.current_class.name if student.current_class else '-'

        info_bold = _sty_s('info_b', fs_info, bold=True, color_hex=st['primary_color'], font_family=ff)

        info_data = [
            [
                Paragraph(f'<b>Class :</b>  {class_name}', info_bold),
                Paragraph(f'<b>Class Master :</b>', info_bold),
            ],
            [
                Paragraph(f'<b>Surname & Name :</b>  {student.full_name}', info_bold),
                Paragraph(f'<b>Number on roll :</b>', info_bold),
            ],
            [
                Paragraph(f'<b>Date of birth :</b>  {dob}', info_bold),
                Paragraph(f'<b>Repeater :</b>', info_bold),
            ],
            [
                Paragraph(f'<b>Place of birth :</b>', info_bold),
                Paragraph(f'<b>Tel :</b>', info_bold),
            ],
        ]
        info_table = Table(info_data, colWidths=[85*mm, 85*mm])
        info_style_list = [
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), st['info_row_height_mm']*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), st['info_row_height_mm']*mm),
            ('LINEBELOW', (0, 0), (-1, 0), 0.4, colors.HexColor(st['secondary_color'])),
            ('LINEBELOW', (0, 1), (-1, 1), 0.4, colors.HexColor(st['secondary_color'])),
            ('LINEBELOW', (0, 2), (-1, 2), 0.4, colors.HexColor(st['secondary_color'])),
            ('LINEBELOW', (0, 3), (-1, 3), 0.4, colors.HexColor(st['secondary_color'])),
        ]
        if st['show_alternating_info_rows']:
            info_style_list.append(('BACKGROUND', (0, 0), (-1, 0), alt_row_bg))
            info_style_list.append(('BACKGROUND', (0, 2), (-1, 2), alt_row_bg))
        info_table.setStyle(TableStyle(info_style_list))
        elements.append(info_table)
        elements.append(Spacer(1, 3*mm))

    # ════════════════════════════════════════════
    #  MAIN ACADEMIC TABLE
    # ════════════════════════════════════════════

    t2_scores = term2_scores or []
    t3_scores = term3_scores or []

    t1_map = {s['subject_name']: s for s in subject_scores}
    t2_map = {s['subject_name']: s for s in t2_scores}
    t3_map = {s['subject_name']: s for s in t3_scores}

    all_subjects_ordered = []
    seen = set()
    for s in subject_scores:
        if s['subject_name'] not in seen:
            seen.add(s['subject_name'])
            all_subjects_ordered.append(s['subject_name'])
    for scores_list in [t2_scores, t3_scores]:
        for s in scores_list:
            if s['subject_name'] not in seen:
                seen.add(s['subject_name'])
                all_subjects_ordered.append(s['subject_name'])

    science_subjects = {'Mathematics', 'Chemistry', 'Biology', 'Physics', 'Computer Science', 'Additional Maths', 'Food and nutrition'}
    arts_subjects = {'English Language', 'French Language', 'History', 'Geography', 'Economics', 'Literature in English', 'Citizenship Education'}
    other_subjects = {'Religious Studies', 'Physical Education', 'Logic'}

    ttl_coeff = Decimal('0')
    ttl_wsum = Decimal('0')

    table_data = []

    # ── Header rows ──
    h = _sty_s('h', 6, bold=True, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)
    h2 = _sty_s('h2', 5.5, bold=True, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)
    hdr_row1 = [
        Paragraph('SUBJECTS', h),
        Paragraph('COEF.', h),
        Paragraph('1st TERM', h),
        Paragraph('', h),
        Paragraph('2nd TERM', h),
        Paragraph('', h),
        Paragraph('3rd TERM', h),
        Paragraph('', h),
        Paragraph('GRADE', h),
        Paragraph('TEACHER', h),
    ]
    hdr_row2 = [
        Paragraph('', _sty_s('h2a', 5, color_hex=st['primary_color'], font_family=ff)),
        Paragraph('', _sty_s('h2b', 5, color_hex=st['primary_color'], font_family=ff)),
        Paragraph('Test', h2),
        Paragraph('Ave.', h2),
        Paragraph('Total', h2),
        Paragraph('Ave.', h2),
        Paragraph('Total', h2),
        Paragraph('Pass.', h2),
        Paragraph('', _sty_s('h2i', 5, color_hex=st['primary_color'], font_family=ff)),
        Paragraph('', _sty_s('h2j', 5, color_hex=st['primary_color'], font_family=ff)),
    ]
    table_data.append(hdr_row1)
    table_data.append(hdr_row2)

    # ── Track which group summaries we've added ──
    added_science = False
    added_arts = False
    added_other = False
    science_names = []
    arts_names = []
    other_names = []

    def add_subject_row(name):
        nonlocal ttl_coeff, ttl_wsum
        s1 = t1_map.get(name, {})
        s2 = t2_map.get(name, {})
        s3 = t3_map.get(name, {})

        coeff = Decimal(str(s1.get('coefficient', 1)))
        sc1 = s1.get('score')
        sc2 = s2.get('score')
        sc3 = s3.get('score')

        if sc1 is not None:
            ttl_coeff += coeff
            ttl_wsum += Decimal(str(sc1)) * coeff

        grade = _grade_from_score(sc1, 20) if sc1 is not None else '-'

        t1_test = str(sc1) if sc1 is not None else '-'
        t1_ave = str(sc1) if sc1 is not None else '-'
        t2_total = str(sc2) if sc2 is not None else '-'
        t2_ave = str(sc2) if sc2 is not None else '-'
        t3_total = str(sc3) if sc3 is not None else '-'
        t3_pass = str(sc3) if sc3 is not None else '-'

        row = [
            Paragraph(name, _sty_s(f'rn_{name}', fs_body, align=TA_LEFT, color_hex=st['primary_color'], font_family=ff)),
            _c(coeff, fs_body),
            _c(t1_test, fs_body),
            _c(t1_ave, fs_body),
            _c(t2_total, fs_body),
            _c(t2_ave, fs_body),
            _c(t3_total, fs_body),
            _c(t3_pass, fs_body),
            _c(grade, fs_body, bold=True),
            _c('', fs_table),
        ]
        table_data.append(row)

    def add_group_summary(label, names_list):
        """Add a merged group summary header row + marks row."""
        total_marks = Decimal('0')
        count = 0
        scores_in_group = []
        for sname in names_list:
            s1 = t1_map.get(sname, {})
            sc = s1.get('score')
            if sc is not None:
                scores_in_group.append(Decimal(str(sc)))
                total_marks += Decimal(str(sc))
                count += 1
        group_ave = (total_marks / count) if count > 0 else Decimal('0')

        gs = _sty_s('gs', fs_body, bold=True, align=TA_LEFT, color_hex=st['primary_color'], font_family=ff)
        # Summary label row (merged across columns)
        label_row = [
            Paragraph(f'<b>{label}</b>', gs),
            Paragraph('', _sty_s('gs1', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gs2', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gs3', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gs4', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gs5', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gs6', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gs7', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gs8', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gs9', fs_table, color_hex=st['primary_color'], font_family=ff)),
        ]
        table_data.append(label_row)

        marks_row = [
            Paragraph(f'Group total Marks : {total_marks}', _sty_s('gtm', fs_table, align=TA_LEFT, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gtm1', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph(f'Group Ave : {group_ave:.2f}', _sty_s('ga', fs_table, align=TA_LEFT, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('ga1', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('Group position : -', _sty_s('gp', fs_table, align=TA_LEFT, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gp1', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gp2', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gp3', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gp4', fs_table, color_hex=st['primary_color'], font_family=ff)),
            Paragraph('', _sty_s('gp5', fs_table, color_hex=st['primary_color'], font_family=ff)),
        ]
        table_data.append(marks_row)

    # ── Build rows with group summaries interspersed ──
    for sname in all_subjects_ordered:
        if sname in science_subjects:
            if not added_science:
                pass
            science_names.append(sname)
        elif sname in arts_subjects:
            if not added_science and science_names:
                add_group_summary('SCIENCE GROUP RESULTS', science_names)
                added_science = True
            elif added_science and not added_arts and science_names:
                add_group_summary('SCIENCE GROUP RESULTS', science_names)
                added_arts = True
            arts_names.append(sname)
        elif sname in other_subjects:
            if not added_arts and arts_names:
                add_group_summary('ARTS GROUP RESULTS', arts_names)
                added_arts = True
            elif not added_arts and not arts_names and not added_science and science_names:
                add_group_summary('SCIENCE GROUP RESULTS', science_names)
                added_science = True
            other_names.append(sname)
        add_subject_row(sname)

    # Add remaining group summaries at the end
    if science_names and not added_science and not added_arts:
        add_group_summary('SCIENCE GROUP RESULTS', science_names)
        added_science = True
    if arts_names and not added_arts:
        add_group_summary('ARTS GROUP RESULTS', arts_names)
        added_arts = True
    if other_names and not added_other:
        add_group_summary('OTHER RESULTS', other_names)
        added_other = True
    elif other_names and not added_other:
        add_group_summary('OTHER RESULTS', other_names)
        added_other = True

    avg = (ttl_wsum / ttl_coeff) if ttl_coeff > 0 else Decimal('0')

    # ── TOTAL row ──
    table_data.append([
        Paragraph('<b>TOTAL</b>', _sty_s('tot_l', fs_info, bold=True, align=TA_LEFT, color_hex=st['primary_color'], font_family=ff)),
        _c(f'{ttl_coeff}', fs_info, bold=True),
        _c('', fs_table),
        _c('', fs_table),
        _c('', fs_table),
        _c('', fs_table),
        _c('', fs_table),
        _c('', fs_table),
        Paragraph(f'{avg:.2f}/20', _sty_s('tot_g', fs_info, bold=True, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)),
        _c('', fs_table),
    ])

    col_widths = [32*mm, 10*mm, 13*mm, 13*mm, 13*mm, 13*mm, 13*mm, 13*mm, 15*mm, 20*mm]
    main_table = Table(table_data, colWidths=col_widths, repeatRows=2)
    main_style = TableStyle([
        ('BOX', (0, 0), (-1, -1), st['table_outer_border'], border_clr),
        ('INNERGRID', (0, 0), (-1, -1), st['table_border_width'], border_clr),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), st['table_row_padding']),
        ('RIGHTPADDING', (0, 0), (-1, -1), st['table_row_padding']),
        ('TOPPADDING', (0, 0), (-1, -1), st['table_row_padding']),
        ('BOTTOMPADDING', (0, 0), (-1, -1), st['table_row_padding']),
    ])

    if st['show_table_header_bg']:
        main_style.add('BACKGROUND', (0, 0), (-1, 1), header_bg)

    if st['show_alternating_rows']:
        for i in range(4, len(table_data) - 1, 2):
            main_style.add('BACKGROUND', (0, i), (-1, i), alt_row_bg)

    main_style.add('BACKGROUND', (0, -1), (-1, -1), header_bg)
    main_style.add('LINEABOVE', (0, -1), (-1, -1), 0.75, border_clr)

    # Merge header spans
    for col_start, col_end in [(2, 3), (4, 5), (6, 7)]:
        main_style.add('SPAN', (col_start, 0), (col_end, 0))

    # Merge group summary rows
    for i in range(2, len(table_data) - 1):
        cell_text = table_data[i][0].text if hasattr(table_data[i][0], 'text') else str(table_data[i][0])
        if 'Group' in str(table_data[i][0]):
            for col in range(10):
                main_style.add('SPAN', (0, i), (-1, i))
            main_style.add('BACKGROUND', (0, i), (-1, i), header_bg)
        elif 'Group' in str(table_data[i+1][0]) if i+1 < len(table_data) - 1 else False:
            pass

    for i in range(2, len(table_data) - 1):
        txt = str(table_data[i][2]) if len(table_data[i]) > 2 and table_data[i][2] else ''
        if 'Ave' in str(txt) or 'Marks' in str(txt) or 'position' in str(txt):
            main_style.add('BACKGROUND', (0, i), (-1, i), alt_row_bg)

    main_table.setStyle(main_style)
    elements.append(main_table)
    elements.append(Spacer(1, 3*mm))

    # ════════════════════════════════════════════
    #  ANNUAL SUMMARY
    # ════════════════════════════════════════════
    avg1 = avg
    avg2 = Decimal('0')
    avg3 = Decimal('0')
    for sc_list, target in [(t2_scores, 'avg2'), (t3_scores, 'avg3')]:
        if sc_list:
            tc = Decimal('0')
            ws = Decimal('0')
            for s in sc_list:
                c = Decimal(str(s.get('coefficient', 1)))
                sc = s.get('score')
                if sc is not None:
                    tc += c
                    ws += Decimal(str(sc)) * c
            if tc > 0:
                val = ws / tc
                if target == 'avg2':
                    avg2 = val
                else:
                    avg3 = val
    annual_avg = (avg1 + avg2 + avg3) / 3 if avg2 or avg3 else avg1

    ca_display = f'{class_average:.2f}' if class_average is not None else '-'
    rank_display = str(rank) if rank is not None else '-'

    sb = _sty_s('sb', fs_body, bold=True, color_hex=st['primary_color'], font_family=ff)
    sn = _sty_s('sn', fs_body, color_hex=st['primary_color'], font_family=ff)

    sum_data = [
        [Paragraph('<b>1st Term Av.</b>', sb), Paragraph(f'{avg1:.2f}', sn),
         Paragraph('<b>2nd Term Av.</b>', sb), Paragraph(f'{avg2:.2f}', sn),
         Paragraph('<b>3rd Term Av.</b>', sb), Paragraph(f'{avg3:.2f}', sn),
         Paragraph('<b>Annual Av.</b>', sb), Paragraph(f'{annual_avg:.2f}', sn),
         Paragraph('<b>Group position :</b>', sb), Paragraph(rank_display, sn)],
        [Paragraph('Class Av.', sb), Paragraph(ca_display, sn),
         Paragraph('Class Av.', sb), Paragraph(ca_display, sn),
         Paragraph('Class Av.', sb), Paragraph(ca_display, sn),
         Paragraph('Best Av.', sb), Paragraph('-', sn),
         Paragraph('Position :', sb), Paragraph(rank_display, sn)],
        [Paragraph('N° with Av. ≥ 10.0', sb), Paragraph('-', sn),
         Paragraph('N° with Av. ≥ 10.0', sb), Paragraph('-', sn),
         Paragraph('N° with Av. ≥ 10.0', sb), Paragraph('-', sn),
         Paragraph('Punition :', sb), Paragraph('-', sn),
         Paragraph('Best Av. :', sb), Paragraph(ca_display, sn)],
        [Paragraph('N° with Av. < 10.0', sb), Paragraph('-', sn),
         Paragraph('N° with Av. < 10.0', sb), Paragraph('-', sn),
         Paragraph('N° with Av. < 10.0', sb), Paragraph('-', sn),
         Paragraph('N° with Av.', sb), Paragraph('-', sn),
         Paragraph('N° with Av. < 8.0 :', sb), Paragraph('-', sn)],
    ]
    sum_col_w = [17*mm, 11*mm, 17*mm, 11*mm, 17*mm, 11*mm, 14*mm, 11*mm, 18*mm, 18*mm]
    sum_table = Table(sum_data, colWidths=sum_col_w)
    sum_style = TableStyle([
        ('BOX', (0, 0), (-1, -1), st['table_outer_border'], border_clr),
        ('INNERGRID', (0, 0), (-1, -1), st['table_border_width'], border_clr),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('BACKGROUND', (0, 2), (-1, 2), alt_row_bg),
    ])
    sum_table.setStyle(sum_style)
    elements.append(sum_table)
    elements.append(Spacer(1, 3*mm))

    # ════════════════════════════════════════════
    #  DISCIPLINE (optional)
    # ════════════════════════════════════════════
    if st['show_discipline']:
        total_abs = str(attendance_info.get('total_absences', '-')) if attendance_info else '-'
        disc_data = [
            [Paragraph('<b>DISCIPLINE</b>', _sty_s('disc_t', 8, bold=True, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)),
             Paragraph('', _sty_s('disc_e', fs_info, color_hex=st['primary_color'], font_family=ff)),
             Paragraph('', _sty_s('disc_e2', fs_info, color_hex=st['primary_color'], font_family=ff)),
             Paragraph('', _sty_s('disc_e3', fs_info, color_hex=st['primary_color'], font_family=ff))],
            [Paragraph(f'<b>Total Abs :</b> {total_abs}', _sty_s('ta', fs_info, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)),
             Paragraph('<b>Suspension :</b> -', _sty_s('sus', fs_info, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)),
             Paragraph('<b>Punishments :</b> -', _sty_s('pun', fs_info, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)),
             Paragraph('<b>Warning :</b> -', _sty_s('warn', fs_info, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff))],
        ]
        disc_table = Table(disc_data, colWidths=[43.5*mm, 43.5*mm, 43.5*mm, 43.5*mm])
        disc_style = TableStyle([
            ('BOX', (0, 0), (-1, -1), st['table_outer_border'], border_clr),
            ('INNERGRID', (0, 0), (-1, -1), st['table_border_width'], border_clr),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('LINEBELOW', (0, 0), (-1, 0), st['header_underline_width'], border_clr),
        ])
        disc_table.setStyle(disc_style)
        elements.append(disc_table)
        elements.append(Spacer(1, 3*mm))

    # ════════════════════════════════════════════
    #  DECISION (optional)
    # ════════════════════════════════════════════
    if st['show_decision']:
        dec = _decision(annual_avg, 20)
        dec_table = Table(
            [[Paragraph(f'<b>DECISION :  {dec}</b>', _sty_s('dec', 8, bold=True, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff))]],
            colWidths=[PAGE_W_LOCAL],
        )
        dec_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), st['decision_border_width'], border_clr),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('BACKGROUND', (0, 0), (-1, -1), decision_bg),
        ]))
        elements.append(dec_table)
        elements.append(Spacer(1, 4*mm))

    # ════════════════════════════════════════════
    #  SIGNATURES (optional)
    # ════════════════════════════════════════════
    if st['show_signatures']:
        sigh = _sty_s('sig_h', fs_info, bold=True, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)
        line_char = '_' * int(st['signature_line_width'] / 2.5)
        sig_data = [
            [
                Paragraph(line_char, _sty_s('sig1', fs_info, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)),
                Paragraph(line_char, _sty_s('sig2', fs_info, align=TA_CENTER, color_hex=st['primary_color'], font_family=ff)),
            ],
            [
                Paragraph('<b>PARENTS\' SIGNATURE</b>', sigh),
                Paragraph('<b>PRINCIPAL</b>', sigh),
            ],
        ]
        sig_table = Table(sig_data, colWidths=[85*mm, 85*mm])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(sig_table)

    # ════════════════════════════════════════════
    #  FOOTER (optional)
    # ════════════════════════════════════════════
    if st['show_footer']:
        elements.append(Spacer(1, 4*mm))
        generated_at = timezone.now().strftime('%d/%m/%Y at %H:%M')
        elements.append(Paragraph(
            f'Generated by School OS — {generated_at}',
            _sty_s('footer', st['footer_font_size'], color_hex=st['footer_text_color'], align=TA_CENTER, font_family=ff)
        ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


# ═══════════════════════════════════════════════
#  BATCH GENERATOR
# ═══════════════════════════════════════════════

def generate_batch_report_cards(
    students_data,
    tenant,
    academic_year,
    term,
    attendance_map=None,
    class_stats_map=None,
    template=None,
    style_overrides=None,
):
    results = []
    for entry in students_data:
        student = entry['student']
        subject_scores = entry['subject_scores']
        attendance_info = (attendance_map or {}).get(student.id)
        stats = (class_stats_map or {}).get(student.id, {})

        pdf_bytes = generate_report_card_pdf(
            student=student,
            tenant=tenant,
            academic_year=academic_year,
            term=term,
            subject_scores=subject_scores,
            attendance_info=attendance_info,
            class_average=stats.get('class_average'),
            rank=stats.get('rank'),
            class_size=stats.get('class_size'),
            template=template,
            style_overrides=style_overrides,
        )

        safe_admission = student.admission_number.replace('/', '-')
        filename = f'report_card_{safe_admission}_{term.name.replace(" ", "_")}.pdf'
        results.append({
            'student_id': student.id,
            'student_name': student.full_name,
            'admission_number': student.admission_number,
            'pdf_bytes': pdf_bytes,
            'filename': filename,
            'subject_scores': subject_scores,
        })
    return results
