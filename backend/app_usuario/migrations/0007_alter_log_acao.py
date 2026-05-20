from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app_usuario', '0006_log'),
    ]

    operations = [
        migrations.AlterField(
            model_name='log',
            name='acao',
            field=models.TextField(),
        ),
    ]
