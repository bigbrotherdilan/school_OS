"""ReportLab PDF export for timetables (one class per page, class by class)."""
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)

from .models import DEFAULT_PERIODS, DEFAULT_WORKING_DAYS

PALETTE = [
    ('#dbeafe', '#1d4ed8'), ('#dcfce7', '#15803d'), ('#fef9c3', '#a16207'),
    ('#fce7f3', '#be185d'), ('#ede9fe', '#6d28d9'), ('#ffedd5', '#c2410c'),
    ('#cffafe', '#0e7490'), ('#fee2e2', '#b91c1c'), ('#f1f5f9', '#334155'),
]

DAY_LABELS = {
    1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday',
    5: 'Friday', 6: 'Saturday', 7: 'Sunday',
}

_MARGIN = 12 * mm


def _color_of(subject_id):
    if not subject_id:
        return PALETTE[-1]
    s = str(subject_id)
    h = 0
    for ch in s:
        h = ord(ch) + ((h << 5) - h)
    return PALETTE[abs(h) % len(PALETTE)]


def _st(name, **kw):
    defaults = dict(fontName='Helvetica', fontSize=8, leading=10, textColor=colors.black)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)


_ST_TITLE = _st('tt', fontSize=14, leading=17, fontName='Helvetica-Bold')
_ST_SUB = _st('sub', fontSize=9, leading=12, textColor=colors.HexColor('#555555'))
_ST_HDR = _st('hdr', fontSize=8, leading=10, fontName='Helvetica-Bold', alignment=TA_CENTER)
_ST_TIME = _st('time', fontSize=7, leading=9, alignment=TA_CENTER, fontName='Helvetica-Bold')
_ST_BREAK = _st('break', fontSize=6.5, leading=8, alignment=TA_CENTER, textColor=colors.HexColor('#888888'))
_ST_CELL = _st('cell', fontSize=7.5, leading=9, alignment=TA_LEFT)
_ST_FOOT = _st('foot', fontSize=7, leading=9, textColor=colors.HexColor('#777777'))


def _periods(timetable):
    return timetable.periods if timetable.periods else DEFAULT_PERIODS


def _days(timetable):
    return timetable.working_days if timetable.working_days else DEFAULT_WORKING_DAYS


def _cell_paragraph(slot, first_of_lesson):
    _, fg = _color_of(slot.subject_id)
    lines = []
    if first_of_lesson:
        lines.append(
            f'<font color="{fg}"><b>{escape(slot.subject.name)}</b></font>'
        )
    else:
        lines.append(f'<font color="#666666" size="6.5"><b>↳ cont.</b></font>')
    if slot.teacher_id:
        name = slot.teacher.user.get_full_name() or slot.teacher.user.username
        lines.append(f'<font color="#333333">{escape(name)}</font>')
    else:
        lines.append('<font color="#888888"><b>[TBD]</b> no teacher yet</font>')
    if slot.student_group_id:
        lines.append(f'<font color="#666666" size="6.5">Group: {escape(slot.student_group.name)}</font>')
    if slot.room_id:
        lines.append(f'<font color="#666666" size="6.5">Room: {escape(slot.room.name)}</font>')
    elif slot.classroom:
        lines.append(f'<font color="#666666" size="6.5">Classroom: {escape(slot.classroom)}</font>')
    if slot.is_locked:
        lines.append('<font color="#b45309" size="6.5"><b>Locked</b></font>')
    return Paragraph('<br/>'.join(lines), _ST_CELL)


def _timetable_table(timetable):
    periods = _periods(timetable)
    days = _days(timetable)
    day_names = [DAY_LABELS.get(d, f'Day {d}') for d in days]

    # Slots per cell (parallel groups can share a cell)
    cell_map = {}
    for slot in timetable.slots.all():
        key = (slot.day_of_week, slot.start_time.strftime('%H:%M'), slot.end_time.strftime('%H:%M'))
        cell_map.setdefault(key, []).append(slot)

    def slots_for(day, start, end):
        return cell_map.get((day, start, end), [])

    # Detect continuation: same lesson as the previous row's slot in the same day.
    prev_by_day = {d: None for d in days}
    rows = []
    header = [Paragraph('Period', _ST_HDR)] + [Paragraph(n, _ST_HDR) for n in day_names]
    rows.append(header)

    for p, period in enumerate(periods):
        start, end = period['start'], period['end']
        is_break = p > 0 and periods[p - 1]['end'] != start
        if is_break:
            break_cell = Paragraph(f'<b>BREAK</b><br/>{periods[p - 1]["end"]} – {start}', _ST_BREAK)
            rows.append([break_cell] + [Paragraph('', _ST_BREAK) for _ in days])
        row = [Paragraph(f'{start}–{end}', _ST_TIME)]
        for d in days:
            slots = slots_for(d, start, end)
            if slots:
                cells = []
                for slot in slots:
                    first = prev_by_day[d] != slot.lesson_id
                    cells.append(_cell_paragraph(slot, first))
                prev_by_day[d] = slots[0].lesson_id
                row.append(_stack_cells(cells))
            else:
                prev_by_day[d] = None
                row.append(Paragraph('', _ST_CELL))
        rows.append(row)
    return rows


def _stack_cells(cells):
    """Wrap multiple paragraphs for parallel groups in a single cell."""
    if len(cells) == 1:
        return cells[0]
    return Paragraph('<br/>'.join(c.text for c in cells), _ST_CELL)


def _timetable_page(timetable, tenant):
    """Build the flowables for one class timetable."""
    cls = timetable.class_obj
    stream = getattr(cls, 'stream', None) if cls else None
    section_name = stream.name if stream else 'General'
    year_name = timetable.academic_year.name if timetable.academic_year_id else ''
    term_name = timetable.term.name if timetable.term_id else ''
    status = (timetable.generation_status or 'draft').upper()

    title = Paragraph(
        f'{escape(tenant.school_name)} — Timetable', _ST_TITLE
    )
    sub = Paragraph(
        f'{escape(year_name)} · {escape(term_name)} · {escape(section_name)} — '
        f'Class {escape(cls.name) if cls else ""}  &nbsp;|&nbsp;  Status: <b>{escape(status)}</b>'
        + (' &nbsp;|&nbsp; <b>Committed</b> (resources reserved school-wide)' if timetable.is_committed() else ''),
        _ST_SUB,
    )
    flowables = [title, Spacer(1, 2), sub, Spacer(1, 6)]

    days = _days(timetable)
    periods = _periods(timetable)
    usable = landscape(A4)[0] - 2 * _MARGIN
    time_w = 20 * mm
    day_w = (usable - time_w) / len(days)
    col_widths = [time_w] + [day_w] * len(days)

    data = _timetable_table(timetable)
    grid = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]
    grid.setStyle(TableStyle(style))

    flowables.append(grid)
    flowables.append(Spacer(1, 4))
    flowables.append(Paragraph(
        '[TBD] = teacher not yet assigned · Locked = cell kept on regenerate · '
        f'Days: {", ".join(DAY_LABELS.get(d, f"Day {d}") for d in days)}',
        _ST_FOOT,
    ))
    return flowables


def generate_timetable_pdf(timetables, tenant):
    """Render one page per timetable, ordered as given."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        leftMargin=_MARGIN, rightMargin=_MARGIN, topMargin=14 * mm, bottomMargin=12 * mm,
        title=f'{tenant.school_name} — Timetables',
        author=tenant.school_name,
    )
    story = []
    for i, tt in enumerate(timetables):
        story.extend(_timetable_page(tt, tenant))
        if i < len(timetables) - 1:
            story.append(PageBreak())
    doc.build(story)
    buffer.seek(0)
    return buffer