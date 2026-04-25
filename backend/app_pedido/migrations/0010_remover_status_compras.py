from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('app_pedido', '0009_pedido_fluxo_compras'),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE app_pedido_pedido DROP COLUMN IF EXISTS status_compras;',
            reverse_sql='ALTER TABLE app_pedido_pedido ADD COLUMN status_compras varchar(20);',
        ),
    ]
