"""
seed_curriculum — School OS
Populates curriculum modules and lessons for Dr. Song's assigned subjects.
Mathematics and French Language for Form 1.
"""
from django.core.management.base import BaseCommand
from apps.logbook.models import CurriculumModule, CurriculumLesson
from apps.academic.models import Subject
from apps.tenants.models import Tenant


MATH_CURRICULUM = {
    'Number Systems': [
        'Natural Numbers & Whole Numbers',
        'Integers & Operations',
        'Rational Numbers & Fractions',
        'Real Numbers & the Number Line',
    ],
    'Algebra': [
        'Linear Equations in One Variable',
        'Quadratic Expressions',
        'Factorization Techniques',
        'Simultaneous Equations',
        'Algebraic Fractions',
    ],
    'Geometry': [
        'Points, Lines & Planes',
        'Angles & Angle Relationships',
        'Properties of Triangles',
        'Circle Theorems',
        'Polygons & Their Properties',
    ],
    'Statistics & Probability': [
        'Data Collection Methods',
        'Mean, Median & Mode',
        'Frequency Distribution Tables',
        'Bar Charts & Histograms',
        'Introduction to Probability',
    ],
}

FRENCH_CURRICULUM = {
    'Grammaire': [
        'Les Articles Définis et Indéfinis',
        'Les Pronoms Personnels',
        'Les Verbes Réguliers (-er, -ir, -re)',
        "L'Accord du Participe Passé",
    ],
    'Conjugaison': [
        'Le Présent de l\'Indicatif',
        "L'Imparfait",
        'Le Passé Composé',
        'Le Futur Simple',
        'Le Conditionnel Présent',
    ],
    'Expression Écrite': [
        'La Lettre Formelle',
        'Le Résumé de Texte',
        'La Dissertation Argumentative',
        'Le Compte Rendu',
    ],
    'Compréhension de Texte': [
        'Lecture Guidée et Analyse',
        'Questions de Compréhension',
        'Vocabulaire Contextuel',
        'Synthèse et Interprétation',
    ],
}


class Command(BaseCommand):
    help = 'Seeds curriculum modules and lessons for Mathematics and French Language.'

    def handle(self, *args, **options):
        # Find the tenant that owns subjects (Saint Joseph Bilingual Academy)
        math_subject = Subject.objects.filter(name__icontains='math').first()
        if math_subject:
            tenant = math_subject.tenant
        else:
            tenant = Tenant.objects.first()

        if not tenant:
            self.stderr.write(self.style.ERROR('No tenant found. Please create a tenant first.'))
            return

        self.stdout.write('Seeding curriculum for tenant: %s' % tenant.school_name)

        # Find subjects by name (case-insensitive partial match)
        if not math_subject:
            math_subject = Subject.objects.filter(
                tenant=tenant, name__icontains='math'
            ).first()

        french_subject = Subject.objects.filter(
            tenant=tenant, name__icontains='fran'
        ).first()
        if not french_subject:
            french_subject = Subject.objects.filter(
                tenant=tenant, name__icontains='french'
            ).first()

        created_count = 0

        if math_subject:
            created_count += self._seed_subject(tenant, math_subject, MATH_CURRICULUM)
            self.stdout.write(self.style.SUCCESS('  [OK] Mathematics (%s) seeded' % math_subject.name))
        else:
            self.stdout.write(self.style.WARNING('  [!] No Mathematics subject found, skipping'))

        if french_subject:
            created_count += self._seed_subject(tenant, french_subject, FRENCH_CURRICULUM)
            self.stdout.write(self.style.SUCCESS('  [OK] French (%s) seeded' % french_subject.name))
        else:
            self.stdout.write(self.style.WARNING('  [!] No French subject found, skipping'))

        self.stdout.write(self.style.SUCCESS(
            '\nDone! Created %d items total.' % created_count
        ))

    def _seed_subject(self, tenant, subject, curriculum_data):
        count = 0
        for order, (module_name, lessons) in enumerate(curriculum_data.items(), start=1):
            module, mod_created = CurriculumModule.objects.get_or_create(
                tenant=tenant,
                subject=subject,
                name=module_name,
                defaults={'order': order}
            )
            if mod_created:
                count += 1
                self.stdout.write(f'    Module: {module_name}')

            for lesson_order, lesson_title in enumerate(lessons, start=1):
                _, les_created = CurriculumLesson.objects.get_or_create(
                    module=module,
                    title=lesson_title,
                    defaults={
                        'order': lesson_order,
                        'is_completed': False,
                    }
                )
                if les_created:
                    count += 1

        return count
