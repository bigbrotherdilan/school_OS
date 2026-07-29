"""
Report Card Style Configuration — School_OS
Default style dict and merge logic for report card visual customization.
"""


DEFAULT_STYLE = {
    # ── Colors ──
    'primary_color': '#000000',
    'secondary_color': '#333333',
    'accent_color': '#F2B01E',
    'header_bg_color': '#EEEEEE',
    'table_header_bg': '#EEEEEE',
    'table_alt_row_bg': '#F7F7F7',
    'border_color': '#000000',
    'decision_bg_color': '#F7F7F7',
    'footer_text_color': '#999999',

    # ── Typography ──
    'header_font': 'times',
    'header_font_size': 7,
    'body_font_size': 6.5,
    'table_font_size': 6,
    'title_font_size': 11,
    'info_font_size': 7.5,

    # ── Layout ──
    'show_page_border': True,
    'page_border_width': 1.5,
    'page_margin_mm': 8,
    'show_logo': True,
    'logo_size_mm': 30,

    # ── Header ──
    'show_republic_header': True,
    'show_ministry_header': True,
    'header_underline_width': 0.75,

    # ── Student Info ──
    'show_student_info': True,
    'show_alternating_info_rows': True,
    'info_row_height_mm': 1.5,

    # ── Academic Table ──
    'table_border_width': 0.3,
    'table_outer_border': 1.0,
    'show_alternating_rows': True,
    'show_table_header_bg': True,
    'table_row_padding': 2,
    'group_summary_style': 'merged',

    # ── Annual Summary ──
    'summary_header_bg': '#EEEEEE',
    'show_summary_borders': True,

    # ── Discipline ──
    'show_discipline': True,

    # ── Decision ──
    'show_decision': True,
    'decision_border_width': 0.75,

    # ── Signatures ──
    'show_signatures': True,
    'signature_line_width': 40,

    # ── Footer ──
    'show_footer': True,
    'footer_font_size': 6,
}


def _resolve_style(template=None, overrides=None):
    """
    Merge style defaults → template config → inline overrides.
    Returns a complete style dict with all keys populated.
    """
    style = dict(DEFAULT_STYLE)

    if template and hasattr(template, 'style_config') and template.style_config:
        style.update({k: v for k, v in template.style_config.items() if k in DEFAULT_STYLE})

    if overrides:
        style.update({k: v for k, v in overrides.items() if k in DEFAULT_STYLE})

    return style
