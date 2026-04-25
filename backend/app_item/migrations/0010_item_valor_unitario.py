from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app_item', '0009_alter_item_quantidade_atual_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='valor_unitario',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name='Valor Unitario'),
        ),
    ]
