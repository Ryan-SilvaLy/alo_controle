from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('app_item', '0013_tipoitem_dias_cobertura_eventoestoquebaixo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='eventoestoquebaixo',
            name='data_evento',
            field=models.DateField(default=django.utils.timezone.localdate, verbose_name='Data do Evento'),
        ),
    ]
