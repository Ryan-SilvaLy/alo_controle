from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app_pedido', '0010_remover_status_compras'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedidoitem',
            name='metrica_reposicao',
            field=models.JSONField(blank=True, default=dict, verbose_name='Metrica de Reposicao'),
        ),
    ]
