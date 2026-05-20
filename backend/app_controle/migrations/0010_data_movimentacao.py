from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('app_controle', '0009_ca_lote_epi'),
    ]

    operations = [
        migrations.AddField(
            model_name='registroentrada',
            name='data_movimentacao',
            field=models.DateField(default=django.utils.timezone.localdate, verbose_name='Data da Movimentacao'),
        ),
        migrations.AddField(
            model_name='registrosaida',
            name='data_movimentacao',
            field=models.DateField(default=django.utils.timezone.localdate, verbose_name='Data da Movimentacao'),
        ),
    ]
