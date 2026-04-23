from django.db import migrations, models


def migrar_status_pedidos(apps, schema_editor):
    Pedido = apps.get_model('app_pedido', 'Pedido')

    for pedido in Pedido.objects.all():
        if pedido.status == 'enviado':
            pedido.status = 'pendente'
        elif pedido.status == 'aceito':
            pedido.status = 'enviado'
        elif pedido.status == 'recusado':
            pedido.status = 'finalizado'

        pedido.save(update_fields=['status'])


class Migration(migrations.Migration):

    dependencies = [
        ('app_pedido', '0006_pedido_gerado_automaticamente_pedido_tipo_item'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedidoitem',
            name='adicionado_automaticamente',
            field=models.BooleanField(default=False, verbose_name='Adicionado Automaticamente'),
        ),
        migrations.AlterField(
            model_name='pedido',
            name='status',
            field=models.CharField(choices=[('pendente', 'Pendente'), ('enviado', 'Enviado'), ('finalizado', 'Finalizado')], default='pendente', max_length=20, verbose_name='Status'),
        ),
        migrations.RunPython(migrar_status_pedidos, migrations.RunPython.noop),
    ]
