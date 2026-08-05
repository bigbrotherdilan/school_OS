"""
Seed real Cameroon secondary schools into the public directory.
Idempotent: run repeatedly without creating duplicates.
Usage: python manage.py seed_real_schools
"""
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.tenants.models import Tenant, TenantConfig


class Command(BaseCommand):
    help = 'Seeds real Cameroon schools into the public directory'

    SCHOOLS = [
        {
            'school_name': "St Joseph's College Sasse",
            'education_type': 'anglophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Southwest',
            'division': 'Fako',
            'address': 'Sasse, Buea',
            'motto': 'Age Quod Agis',
            'subscription_plan': 'starter',
            'max_students': 2000,
        },
        {
            'school_name': 'Saker Baptist College',
            'education_type': 'anglophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Southwest',
            'division': 'Fako',
            'address': 'Limbe',
            'motto': 'God and My Right',
            'subscription_plan': 'starter',
            'max_students': 1500,
        },
        {
            'school_name': 'Bilingual Grammar School Molyko',
            'education_type': 'bilingual',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Southwest',
            'division': 'Fako',
            'address': 'Molyko, Buea',
            'motto': 'Discipline and Hard Work',
            'subscription_plan': 'starter',
            'max_students': 1800,
        },
        {
            'school_name': 'Cameroon Protestant College Bali',
            'education_type': 'anglophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Northwest',
            'division': 'Momo',
            'address': 'Bali Nyonga',
            'motto': 'Finis Coronat Opus',
            'subscription_plan': 'starter',
            'max_students': 1600,
        },
        {
            'school_name': 'Sacred Heart College Bamenda',
            'education_type': 'anglophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Northwest',
            'division': 'Mezam',
            'address': 'Bamenda',
            'motto': 'Ad Majorem Dei Gloriam',
            'subscription_plan': 'starter',
            'max_students': 1800,
        },
        {
            'school_name': 'Our Lady of Lourdes College Mankon',
            'education_type': 'anglophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Northwest',
            'division': 'Mezam',
            'address': 'Mankon, Bamenda',
            'motto': 'In God We Trust',
            'subscription_plan': 'starter',
            'max_students': 1400,
        },
        {
            'school_name': 'Cameroon College of Arts, Science and Technology',
            'education_type': 'anglophone',
            'school_type': 'technical',
            'session_type': 'morning',
            'region': 'Northwest',
            'division': 'Mezam',
            'address': 'Bambili, Bamenda',
            'motto': 'Sapientia et Labor',
            'subscription_plan': 'starter',
            'max_students': 2000,
        },
        {
            'school_name': 'Presbyterian Secondary School Mankon',
            'education_type': 'anglophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Northwest',
            'division': 'Mezam',
            'address': 'Mankon, Bamenda',
            'motto': 'Light and Truth',
            'subscription_plan': 'starter',
            'max_students': 1500,
        },
        {
            'school_name': "Lycée Général Leclerc",
            'education_type': 'francophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Centre',
            'division': 'Mfoundi',
            'address': 'Avenue du 20 Mai, Yaoundé',
            'motto': 'Travail, Discipline, Réussite',
            'subscription_plan': 'starter',
            'max_students': 2500,
        },
        {
            'school_name': 'Collège Libermann',
            'education_type': 'francophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Littoral',
            'division': 'Wouri',
            'address': 'Akwa, Douala',
            'motto': 'Veritas et Scientia',
            'subscription_plan': 'starter',
            'max_students': 2200,
        },
        {
            'school_name': 'Collège Jean Tabi',
            'education_type': 'francophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'Centre',
            'division': 'Mfoundi',
            'address': 'Nlongkak, Yaoundé',
            'motto': 'Scientia, Pax, Progressus',
            'subscription_plan': 'starter',
            'max_students': 1800,
        },
        {
            'school_name': 'Lycée Classique de Bafoussam',
            'education_type': 'francophone',
            'school_type': 'general',
            'session_type': 'morning',
            'region': 'West',
            'division': 'Mifi',
            'address': 'Bafoussam',
            'motto': 'Savoir et Vertu',
            'subscription_plan': 'starter',
            'max_students': 2000,
        },
    ]

    def handle(self, *args, **options):
        created_count = 0
        existing_count = 0
        for data in self.SCHOOLS:
            slug = slugify(data['school_name'])
            tenant, created = Tenant.objects.get_or_create(
                slug=slug,
                defaults={**data, 'status': Tenant.Status.ACTIVE, 'country': 'Cameroon'},
            )
            TenantConfig.objects.get_or_create(
                tenant=tenant,
                defaults={
                    'currency_code': 'XAF',
                    'currency_symbol': 'XAF',
                    'default_language': 'en' if data['education_type'] == 'anglophone' else 'fr',
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  Created: {tenant.school_name} ({slug})'))
            else:
                existing_count += 1
        self.stdout.write(self.style.SUCCESS(
            f'Done: {created_count} created, {existing_count} already existed.'
        ))
