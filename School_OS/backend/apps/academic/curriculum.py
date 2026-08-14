"""
Cameroon National Curriculum Catalog — School OS

Curated reference lists of official secondary-school subjects per sub-system,
based on:

Anglophone (GCE Board):
  - O-Level subjects and official codes (English Language 530, French 545,
    Mathematics 570, Biology 510, Chemistry 515, Physics 580, ...)
  - A-Level subjects and official codes (7xx range)
  - Official weekly-coverage / coefficient tables for Forms 1-5 and Sixth Forms

Francophone (MINESEC):
  - Official disciplines of the 1st cycle (6ème-3ème) and 2nd cycle
    (Seconde-Terminale): Français, Anglais, Mathématiques, PCT, SVTEEHB,
    Histoire-Géographie, Éducation à la Citoyenneté et à la Morale,
    Informatique, EPS, Philosophie, etc.

Each entry:
  (name, code, cycle_order, coefficient, is_compulsory)

cycle_order:
  1  -> 1st Cycle only (Forms 1-5 / 6ème-3ème)
  2  -> 2nd Cycle only (Sixth Forms / Seconde-Terminale)
  None -> available in all cycles
"""

ANGLOPHONE_SUBJECTS = [
    # ── 1st Cycle (Forms 1–5) — GCE O-Level ──
    ('English Language', '530', 1, '4.0', True),
    ('French', '545', 1, '4.0', True),
    ('Mathematics', '570', 1, '4.0', True),
    ('Biology', '510', 1, '2.0', True),
    ('Chemistry', '515', 1, '2.0', True),
    ('Physics', '580', 1, '2.0', True),
    ('Geography', '550', 1, '2.0', True),
    ('History', '560', 1, '2.0', True),
    ('Citizenship Education', '562', 1, '2.0', True),
    ('Computer Science', '595', 1, '2.0', True),
    ('Literature in English', '535', 1, '2.0', False),
    ('Commerce', '520', 1, '2.0', False),
    ('Additional Mathematics', '575', 1, '2.0', False),
    ('Human Biology', '565', 1, '2.0', False),
    ('Food and Nutrition', '540', 1, '2.0', False),
    ('Religious Studies', '585', 1, '2.0', False),
    ('Logic', '590', 1, '2.0', False),
    ('Geology', '555', 1, '2.0', False),
    # ── 2nd Cycle (Lower/Upper Sixth) — GCE A-Level ──
    ('Pure Mathematics with Mechanics', '765', 2, '5.0', False),
    ('Pure Mathematics with Statistics', '770', 2, '5.0', False),
    ('Further Mathematics', '775', 2, '5.0', False),
    ('Physics', '780', 2, '5.0', True),
    ('Chemistry', '715', 2, '5.0', True),
    ('Biology', '710', 2, '5.0', True),
    ('Economics', '725', 2, '5.0', True),
    ('Geography', '750', 2, '5.0', True),
    ('History', '760', 2, '5.0', True),
    ('Literature in English', '735', 2, '5.0', True),
    ('English Language', '730', 2, '5.0', True),
    ('French', '745', 2, '5.0', True),
    ('Computer Science', '795', 2, '5.0', False),
    ('Information and Communication Technology', '796', 2, '5.0', False),
    ('Accounting', '705', 2, '5.0', False),
    ('Philosophy', '790', 2, '5.0', False),
    ('Food Science and Nutrition', '740', 2, '5.0', False),
    ('Geology', '755', 2, '5.0', False),
    ('Religious Studies', '785', 2, '5.0', False),
]

FRANCOPHONE_SUBJECTS = [
    # ── 1st Cycle (6ème–3ème) — MINESEC ──
    ('Français', 'FRA', 1, '5.0', True),
    ('Anglais', 'ANG', 1, '3.0', True),
    ('Mathématiques', 'MAT', 1, '4.0', True),
    ('Physique-Chimie-Technologie (PCT)', 'PCT', 1, '2.0', True),
    ('SVTEEHB', 'SVT', 1, '2.0', True),
    ('Histoire-Géographie', 'HGT', 1, '2.0', True),
    ('Éducation à la Citoyenneté et à la Morale', 'ECM', 1, '1.0', True),
    ('Informatique', 'INF', 1, '2.0', True),
    ('Éducation Physique et Sportive', 'EPS', 1, '1.0', True),
    ('Espagnol', 'ESP', 1, '2.0', False),
    ('Allemand', 'ALL', 1, '2.0', False),
    ('Éducation Musicale', 'MUS', 1, '1.0', False),
    ('Arts Plastiques', 'ART', 1, '1.0', False),
    # ── 2nd Cycle (Seconde–Terminale) — MINESEC ──
    ('Français', 'FRA', 2, '5.0', True),
    ('Anglais', 'ANG', 2, '3.0', True),
    ('Mathématiques', 'MAT', 2, '4.0', True),
    ('Physique-Chimie', 'PC', 2, '3.0', True),
    ('SVTEEHB', 'SVT', 2, '3.0', True),
    ('Histoire-Géographie', 'HGT', 2, '3.0', True),
    ('Éducation à la Citoyenneté et à la Morale', 'ECM', 2, '1.0', True),
    ('Informatique', 'INF', 2, '2.0', True),
    ('Philosophie', 'PHI', 2, '2.0', True),
    ('Éducation Physique et Sportive', 'EPS', 2, '1.0', True),
    ('Espagnol', 'ESP', 2, '2.0', False),
    ('Allemand', 'ALL', 2, '2.0', False),
]

SUBJECTS_BY_LANGUAGE = {
    'en': ANGLOPHONE_SUBJECTS,
    'fr': FRANCOPHONE_SUBJECTS,
}


def _cycle_order_for_level(language, level_order):
    """Map a level_order to its cycle (1 or 2) via the class ladder."""
    for _name, level, cycle_order in CLASSES_BY_LANGUAGE.get(language, ANGLOPHONE_CLASSES):
        if level == level_order:
            return cycle_order
    return 1


def _section_type_subject_entries(section_type, language):
    """
    Flatten the per-class catalog for a section type into subject entries:
    (name, code, cycle_order, coefficient, is_compulsory).
    """
    catalog = CLASS_SUBJECTS.get((section_type or 'grammar', language or 'en'))
    if not catalog:
        return []
    entries = {}
    for level_order, subjects in catalog.items():
        cycle_order = _cycle_order_for_level(language, level_order)
        for name, code, coefficient, _hours, compulsory, _is_double in subjects:
            entries[(name, code, cycle_order)] = (
                name, code, cycle_order, coefficient, compulsory,
            )
    return list(entries.values())


def recommended_subjects(language, section_type=None):
    """
    Return the curated catalog for a section language ('en' or 'fr').

    When a section_type is given ('technical' or 'commercial'), the language's
    base catalog is extended with the subjects taught in that section type
    (e.g. Technical Drawing, Engineering Science, Accounting), deduplicated
    against the base list.
    """
    language = language or 'en'
    base = SUBJECTS_BY_LANGUAGE.get(language, ANGLOPHONE_SUBJECTS)
    if not section_type or section_type == 'grammar':
        return base
    extra = _section_type_subject_entries(section_type, language)
    if not extra:
        return base
    seen = {(name, code, cycle_order) for name, code, cycle_order, *_ in base}
    merged = list(base)
    for name, code, cycle_order, coefficient, compulsory in extra:
        if (name, code, cycle_order) in seen:
            continue
        seen.add((name, code, cycle_order))
        merged.append((name, code, cycle_order, coefficient, compulsory))
    return merged


# ────────────────────────────────────────────────────────────────────────────
# Recommended class/grade structures per section language
#
# Each entry: (name, level_order, cycle_order)
#   level_order: 1..7 progression within the school
#   cycle_order: 1 = 1st Cycle, 2 = 2nd Cycle
# ────────────────────────────────────────────────────────────────────────────

ANGLOPHONE_CLASSES = [
    # 1st Cycle — Forms 1–5 (GCE O-Level)
    ('Form 1', 1, 1),
    ('Form 2', 2, 1),
    ('Form 3', 3, 1),
    ('Form 4', 4, 1),
    ('Form 5', 5, 1),
    # 2nd Cycle — Sixth Forms (GCE A-Level)
    ('Lower Sixth', 6, 2),
    ('Upper Sixth', 7, 2),
]

FRANCOPHONE_CLASSES = [
    # 1st Cycle — 6ème–3ème
    ('6ème', 1, 1),
    ('5ème', 2, 1),
    ('4ème', 3, 1),
    ('3ème', 4, 1),
    # 2nd Cycle — Seconde–Terminale
    ('Seconde', 5, 2),
    ('Première', 6, 2),
    ('Terminale', 7, 2),
]

CLASSES_BY_LANGUAGE = {
    'en': ANGLOPHONE_CLASSES,
    'fr': FRANCOPHONE_CLASSES,
}


def recommended_classes(language):
    """Return the recommended class structure for a section language."""
    return CLASSES_BY_LANGUAGE.get(language or 'en', ANGLOPHONE_CLASSES)


# ────────────────────────────────────────────────────────────────────────────
# Per-class subject catalog — auto-linked when classes are created
#
# Each entry: (name, code, coefficient, weekly_hours, is_compulsory, is_double)
#   level_order: same numbering as recommended_classes (1=Form 1/6ème, ...,
#                7=Upper Sixth/Terminale)
#
# Section types:
#   grammar    — general academic (GCE / MINESEC general)
#   technical  — technical education (TVEE / Lycée Technique, CETIC)
#   commercial — commercial education (TVEE commercial / séries G)
#
# When a class is auto-created, the subjects listed for its level are linked to
# it (ClassSubject). Admins can still add or remove subjects per class later.
# ────────────────────────────────────────────────────────────────────────────

# ── Anglophone (GCE) ────────────────────────────────────────────────────────
_ANGLOPHONE_GRAMMAR_F1_TO_F3 = [
    ('English Language', '530', '4.0', 4, True, True),
    ('French', '545', '4.0', 4, True, True),
    ('Mathematics', '570', '4.0', 4, True, True),
    ('Biology', '510', '2.0', 2, True, True),
    ('Chemistry', '515', '2.0', 2, True, True),
    ('Physics', '580', '2.0', 2, True, True),
    ('Geography', '550', '2.0', 2, True, False),
    ('History', '560', '2.0', 2, True, False),
    ('Citizenship Education', '562', '2.0', 2, True, False),
    ('Computer Science', '595', '2.0', 2, True, True),
    ('Literature in English', '535', '2.0', 2, False, True),
    ('Food and Nutrition', '540', '2.0', 2, False, True),
]

_ANGLOPHONE_GRAMMAR_F4_TO_F5 = _ANGLOPHONE_GRAMMAR_F1_TO_F3 + [
    ('Economics', '525', '2.0', 2, False, False),
    ('Additional Mathematics', '575', '2.0', 2, False, True),
    ('Commerce', '520', '2.0', 2, False, False),
]

_ANGLOPHONE_GRAMMAR_SIXTH_FORM = [
    ('English Language', '730', '5.0', 5, True, True),
    ('French', '745', '5.0', 5, True, True),
    ('Pure Mathematics with Mechanics', '765', '5.0', 5, False, True),
    ('Pure Mathematics with Statistics', '770', '5.0', 5, False, True),
    ('Physics', '780', '5.0', 5, True, True),
    ('Chemistry', '715', '5.0', 5, True, True),
    ('Biology', '710', '5.0', 5, True, True),
    ('Economics', '725', '5.0', 5, True, False),
    ('Geography', '750', '5.0', 5, True, False),
    ('History', '760', '5.0', 5, True, False),
    ('Literature in English', '735', '5.0', 5, True, True),
    ('Computer Science', '795', '5.0', 5, False, True),
]

_ANGLOPHONE_TECHNICAL_F1_TO_F3 = [
    ('English Language', '530', '4.0', 4, True, True),
    ('French', '545', '4.0', 4, True, True),
    ('Mathematics', '570', '4.0', 4, True, True),
    ('Physics', '580', '2.0', 2, True, True),
    ('Computer Science', '595', '2.0', 2, True, True),
    ('Technical Drawing', '5155', '3.0', 3, True, True),
    ('Engineering Science', '5100', '3.0', 3, True, True),
    ('Citizenship Education', '562', '2.0', 2, True, False),
    ('Geography', '550', '2.0', 2, True, False),
]

_ANGLOPHONE_TECHNICAL_F4_TO_F5 = _ANGLOPHONE_TECHNICAL_F1_TO_F3 + [
    ('Information and Communication Technology', '596', '2.0', 2, True, True),
    ('Economics', '525', '2.0', 2, False, False),
]

_ANGLOPHONE_TECHNICAL_SIXTH_FORM = [
    ('English Language', '730', '3.0', 3, True, True),
    ('French', '745', '3.0', 3, True, True),
    ('Pure Mathematics with Statistics', '770', '3.0', 3, True, True),
    ('Engineering Science', '7155', '3.0', 3, True, True),
    ('Applied Mechanics', '7218', '3.0', 3, True, True),
    ('Technical Drawing', '', '3.0', 3, True, True),
    ('Computer Science', '795', '3.0', 3, True, True),
    ('Information and Communication Technology', '796', '3.0', 3, True, True),
    ('Economics', '725', '3.0', 3, True, False),
]

_ANGLOPHONE_COMMERCIAL_F1_TO_F3 = [
    ('English Language', '530', '4.0', 4, True, True),
    ('French', '545', '4.0', 4, True, True),
    ('Mathematics', '570', '4.0', 4, True, True),
    ('Business Mathematics', '5020', '3.0', 3, True, True),
    ('Commerce', '520', '2.0', 2, True, False),
    ('Economics', '525', '2.0', 2, True, False),
    ('Accounting', '5005', '3.0', 3, True, True),
    ('Office Practice', '5090', '2.0', 2, True, True),
    ('Computer Science', '595', '2.0', 2, True, True),
    ('Citizenship Education', '562', '2.0', 2, True, False),
]

_ANGLOPHONE_COMMERCIAL_F4_TO_F5 = _ANGLOPHONE_COMMERCIAL_F1_TO_F3 + [
    ('Information and Communication Technology', '596', '2.0', 2, True, True),
    ('Entrepreneurship', '5055', '2.0', 2, False, False),
]

_ANGLOPHONE_COMMERCIAL_SIXTH_FORM = [
    ('English Language', '730', '3.0', 3, True, True),
    ('French', '745', '3.0', 3, True, True),
    ('Financial Accounting', '7005', '3.0', 3, True, True),
    ('Cost and Management Accounting', '7010', '3.0', 3, True, True),
    ('Corporate Accounting', '7015', '3.0', 3, True, True),
    ('Business Mathematics', '7020', '3.0', 3, True, True),
    ('Business Management', '7025', '3.0', 3, True, True),
    ('Commerce and Finance', '7030', '3.0', 3, True, True),
    ('Economics', '725', '3.0', 3, True, False),
    ('Computer Science', '795', '3.0', 3, True, True),
    ('Information and Communication Technology', '796', '3.0', 3, True, True),
]

# ── Francophone (MINESEC) ───────────────────────────────────────────────────
_FRANCOPHONE_CYCLE1_CORE = [
    ('Français', 'FRA', '5.0', 5, True, True),
    ('Anglais', 'ANG', '3.0', 3, True, True),
    ('Mathématiques', 'MAT', '4.0', 4, True, True),
    ('Physique-Chimie-Technologie (PCT)', 'PCT', '2.0', 2, True, True),
    ('SVTEEHB', 'SVT', '2.0', 2, True, True),
    ('Histoire-Géographie', 'HGT', '2.0', 2, True, False),
    ('Éducation à la Citoyenneté et à la Morale', 'ECM', '1.0', 1, True, False),
    ('Informatique', 'INF', '2.0', 2, True, True),
    ('Éducation Physique et Sportive', 'EPS', '1.0', 1, True, False),
]

_FRANCOPHONE_CYCLE1_LATE = _FRANCOPHONE_CYCLE1_CORE + [
    ('Espagnol', 'ESP', '2.0', 2, False, True),
]

_FRANCOPHONE_SECONDE = [
    ('Français', 'FRA', '5.0', 5, True, True),
    ('Anglais', 'ANG', '3.0', 3, True, True),
    ('Mathématiques', 'MAT', '4.0', 4, True, True),
    ('Physique-Chimie', 'PC', '3.0', 3, True, True),
    ('SVTEEHB', 'SVT', '3.0', 3, True, True),
    ('Histoire-Géographie', 'HGT', '3.0', 3, True, False),
    ('Éducation à la Citoyenneté et à la Morale', 'ECM', '1.0', 1, True, False),
    ('Informatique', 'INF', '2.0', 2, True, True),
    ('Éducation Physique et Sportive', 'EPS', '1.0', 1, True, False),
]

_FRANCOPHONE_PREMIERE_TERMINALE = _FRANCOPHONE_SECONDE + [
    ('Philosophie', 'PHI', '2.0', 2, True, False),
]

_FRANCOPHONE_TECHNICAL_CYCLE1 = _FRANCOPHONE_CYCLE1_CORE + [
    ('Dessin Technique', 'DT', '2.0', 2, True, True),
    ('Technologie', 'TEC', '2.0', 2, True, True),
]

_FRANCOPHONE_TECHNICAL_SECONDE = [
    ('Français', 'FRA', '5.0', 5, True, True),
    ('Anglais', 'ANG', '3.0', 3, True, True),
    ('Mathématiques', 'MAT', '4.0', 4, True, True),
    ('Physique-Chimie', 'PC', '3.0', 3, True, True),
    ('SVTEEHB', 'SVT', '2.0', 2, True, True),
    ('Histoire-Géographie', 'HGT', '2.0', 2, True, False),
    ('Éducation à la Citoyenneté et à la Morale', 'ECM', '1.0', 1, True, False),
    ('Informatique', 'INF', '2.0', 2, True, True),
    ('Éducation Physique et Sportive', 'EPS', '1.0', 1, True, False),
    ('Dessin Technique', 'DT', '2.0', 2, True, True),
    ('Technologie', 'TEC', '2.0', 2, True, True),
]

_FRANCOPHONE_TECHNICAL_PREMIERE_TERMINALE = _FRANCOPHONE_TECHNICAL_SECONDE + [
    ('Philosophie', 'PHI', '2.0', 2, True, False),
]

_FRANCOPHONE_COMMERCIAL_SECONDE = [
    ('Français', 'FRA', '5.0', 5, True, True),
    ('Anglais', 'ANG', '3.0', 3, True, True),
    ('Mathématiques', 'MAT', '4.0', 4, True, True),
    ('Physique-Chimie', 'PC', '2.0', 2, True, True),
    ('Comptabilité', 'COMPTA', '3.0', 3, True, True),
    ('Économie', 'ECO', '3.0', 3, True, False),
    ('Histoire-Géographie', 'HGT', '2.0', 2, True, False),
    ('Informatique', 'INF', '2.0', 2, True, True),
    ('Éducation à la Citoyenneté et à la Morale', 'ECM', '1.0', 1, True, False),
    ('Éducation Physique et Sportive', 'EPS', '1.0', 1, True, False),
]

_FRANCOPHONE_COMMERCIAL_PREMIERE_TERMINALE = _FRANCOPHONE_COMMERCIAL_SECONDE + [
    ('Philosophie', 'PHI', '2.0', 2, True, False),
    ('Droit', 'DR', '2.0', 2, True, False),
]

CLASS_SUBJECTS = {
    ('grammar', 'en'): {
        1: _ANGLOPHONE_GRAMMAR_F1_TO_F3,
        2: _ANGLOPHONE_GRAMMAR_F1_TO_F3,
        3: _ANGLOPHONE_GRAMMAR_F1_TO_F3,
        4: _ANGLOPHONE_GRAMMAR_F4_TO_F5,
        5: _ANGLOPHONE_GRAMMAR_F4_TO_F5,
        6: _ANGLOPHONE_GRAMMAR_SIXTH_FORM,
        7: _ANGLOPHONE_GRAMMAR_SIXTH_FORM,
    },
    ('technical', 'en'): {
        1: _ANGLOPHONE_TECHNICAL_F1_TO_F3,
        2: _ANGLOPHONE_TECHNICAL_F1_TO_F3,
        3: _ANGLOPHONE_TECHNICAL_F1_TO_F3,
        4: _ANGLOPHONE_TECHNICAL_F4_TO_F5,
        5: _ANGLOPHONE_TECHNICAL_F4_TO_F5,
        6: _ANGLOPHONE_TECHNICAL_SIXTH_FORM,
        7: _ANGLOPHONE_TECHNICAL_SIXTH_FORM,
    },
    ('commercial', 'en'): {
        1: _ANGLOPHONE_COMMERCIAL_F1_TO_F3,
        2: _ANGLOPHONE_COMMERCIAL_F1_TO_F3,
        3: _ANGLOPHONE_COMMERCIAL_F1_TO_F3,
        4: _ANGLOPHONE_COMMERCIAL_F4_TO_F5,
        5: _ANGLOPHONE_COMMERCIAL_F4_TO_F5,
        6: _ANGLOPHONE_COMMERCIAL_SIXTH_FORM,
        7: _ANGLOPHONE_COMMERCIAL_SIXTH_FORM,
    },
    ('grammar', 'fr'): {
        1: _FRANCOPHONE_CYCLE1_CORE,
        2: _FRANCOPHONE_CYCLE1_CORE,
        3: _FRANCOPHONE_CYCLE1_LATE,
        4: _FRANCOPHONE_CYCLE1_LATE,
        5: _FRANCOPHONE_SECONDE,
        6: _FRANCOPHONE_PREMIERE_TERMINALE,
        7: _FRANCOPHONE_PREMIERE_TERMINALE,
    },
    ('technical', 'fr'): {
        1: _FRANCOPHONE_TECHNICAL_CYCLE1,
        2: _FRANCOPHONE_TECHNICAL_CYCLE1,
        3: _FRANCOPHONE_TECHNICAL_CYCLE1,
        4: _FRANCOPHONE_TECHNICAL_CYCLE1,
        5: _FRANCOPHONE_TECHNICAL_SECONDE,
        6: _FRANCOPHONE_TECHNICAL_PREMIERE_TERMINALE,
        7: _FRANCOPHONE_TECHNICAL_PREMIERE_TERMINALE,
    },
    ('commercial', 'fr'): {
        1: _FRANCOPHONE_CYCLE1_CORE,
        2: _FRANCOPHONE_CYCLE1_CORE,
        3: _FRANCOPHONE_CYCLE1_LATE,
        4: _FRANCOPHONE_CYCLE1_LATE,
        5: _FRANCOPHONE_COMMERCIAL_SECONDE,
        6: _FRANCOPHONE_COMMERCIAL_PREMIERE_TERMINALE,
        7: _FRANCOPHONE_COMMERCIAL_PREMIERE_TERMINALE,
    },
}


def recommended_class_subjects(section_type, language, level_order):
    """
    Subjects to auto-link when a class is created.

    Falls back to the Grammar catalog when the section type has no entry
    (e.g., legacy sections, German sections).
    """
    language = language or 'en'
    catalog = CLASS_SUBJECTS.get((section_type or 'grammar', language))
    if catalog is None:
        catalog = CLASS_SUBJECTS.get(('grammar', language), {})
    return catalog.get(int(level_order), [])


# ────────────────────────────────────────────────────────────────────────────
# Section templates — one-click presets when creating a section
#
# Each entry: (name, language, section_type, classes_label)
# ────────────────────────────────────────────────────────────────────────────

SECTION_TEMPLATES = [
    # (name, language, section_type, classes_label)
    ('Grammar', 'en', 'grammar', 'Form 1 – Upper Sixth'),
    ('Francophone', 'fr', 'grammar', '6ème – Terminale'),
    ('Technical (English)', 'en', 'technical', 'Form 1 – Upper Sixth'),
    ('Technical (French)', 'fr', 'technical', '6ème – Terminale'),
    ('Commercial (English)', 'en', 'commercial', 'Form 1 – Upper Sixth'),
    ('Commercial (French)', 'fr', 'commercial', '6ème – Terminale'),
]
