import os
import sys
import django

# Setup Django
sys.path.append('c:\\Users\\BIG BROTHER\\Projects\\School_OS\\School_OS\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.staff.models import TeachingAssignment

assignments = TeachingAssignment.objects.filter(tenant__isnull=True)
count = 0
for a in assignments:
    a.tenant = a.teacher.tenant
    a.save()
    count += 1

print(f'Emergency backfill completed: {count} assignments updated.')
