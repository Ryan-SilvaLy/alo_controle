from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('app_item', '0006_alter_item_codigo_barras'),
        ('app_pedido', '0005_alter_pedidoitem_quantidade_pedida'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedido',
            name='gerado_automaticamente',
            field=models.BooleanField(default=False, verbose_name='Gerado Automaticamente'),
        ),
        migrations.AddField(
            model_name='pedido',
            name='tipo_item',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='pedidos', to='app_item.tipoitem', verbose_name='Grupo do Pedido'),
        ),
    ]
