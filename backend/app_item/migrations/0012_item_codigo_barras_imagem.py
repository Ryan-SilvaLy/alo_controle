from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app_item', '0011_tipoitem_grupo_secundario'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='codigo_barras_imagem',
            field=models.ImageField(blank=True, null=True, upload_to='codigos_barras/', verbose_name='Imagem do Código de Barras'),
        ),
    ]
