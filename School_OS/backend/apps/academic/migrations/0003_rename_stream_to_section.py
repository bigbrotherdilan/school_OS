import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academic', '0002_add_sequence_model'),
        ('students', '0002_student_blood_group_student_emergency_contact'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='Stream',
            new_name='Section',
        ),
        migrations.AlterField(
            model_name='class',
            name='stream',
            field=models.ForeignKey(
                blank=True,
                help_text='Required for bilingual schools',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='classes',
                to='academic.section',
            ),
        ),
        migrations.AlterField(
            model_name='series',
            name='stream',
            field=models.ForeignKey(
                blank=True,
                help_text='Required for bilingual schools',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='series',
                to='academic.section',
            ),
        ),
    ]
