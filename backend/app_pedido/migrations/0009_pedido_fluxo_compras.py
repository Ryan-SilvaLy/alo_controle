from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrar_status_finalizado_para_cancelado(apps, schema_editor):
    Pedido = apps.get_model('app_pedido', 'Pedido')
    Pedido.objects.filter(status='finalizado').update(status='cancelado')


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('app_pedido', '0008_pedido_status_atualizado_em'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pedido',
            name='status',
            field=models.CharField(
                choices=[
                    ('pendente', 'Pendente'),
                    ('enviado', 'Enviado'),
                    ('visto', 'Visto'),
                    ('negado', 'Negado'),
                    ('cancelado', 'Cancelado'),
                ],
                default='pendente',
                max_length=20,
                verbose_name='Status',
            ),
        ),
        migrations.AddField(
            model_name='pedido',
            name='compras_visto_por',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='pedidos_vistos_compras',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='pedido',
            name='compras_visto_em',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Data de Ciencia de Compras'),
        ),
        migrations.AddField(
            model_name='pedido',
            name='compras_negado_por',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='pedidos_negados_compras',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='pedido',
            name='compras_negado_em',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Data de Negacao de Compras'),
        ),
        migrations.AddField(
            model_name='pedido',
            name='compras_motivo_negado',
            field=models.TextField(blank=True, null=True, verbose_name='Motivo da Negacao de Compras'),
        ),
        migrations.RunPython(migrar_status_finalizado_para_cancelado, migrations.RunPython.noop),
    ]
