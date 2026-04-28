from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app_item', '0010_item_valor_unitario'),
    ]

    operations = [
        migrations.AddField(
            model_name='tipoitem',
            name='grupo_secundario',
            field=models.BooleanField(default=False, verbose_name='Grupo secundario para KPIs'),
        ),
    ]
