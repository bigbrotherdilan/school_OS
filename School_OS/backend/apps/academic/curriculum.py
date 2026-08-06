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


def recommended_subjects(language):
    """Return the curated catalog for a section language ('en' or 'fr')."""
    return SUBJECTS_BY_LANGUAGE.get(language or 'en', ANGLOPHONE_SUBJECTS)


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
# Section templates — one-click presets when creating a section
#
# Each entry: (name, language, classes_label)
# ────────────────────────────────────────────────────────────────────────────

SECTION_TEMPLATES = [
    ('Anglophone', 'en', 'Form 1 – Upper Sixth'),
    ('Francophone', 'fr', '6ème – Terminale'),
    ('Grammar', 'fr', '6ème – Terminale'),
    ('Technical', 'fr', '6ème – Terminale'),
    ('Commercial', 'fr', '6ème – Terminale'),
]
