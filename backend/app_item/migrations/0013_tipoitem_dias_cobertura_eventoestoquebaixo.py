from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('app_item', '0012_item_codigo_barras_imagem'),
    ]

    operations = [
        migrations.AddField(
            model_name='tipoitem',
            name='dias_cobertura',
            field=models.PositiveIntegerField(default=30, verbose_name='Dias de Cobertura'),
        ),
        migrations.CreateModel(
            name='EventoEstoqueBaixo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data_evento', models.DateField(auto_now_add=True, verbose_name='Data do Evento')),
                ('estoque_atual', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Estoque Atual')),
                ('estoque_minimo', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Estoque Minimo')),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='eventos_estoque_baixo', to='app_item.item')),
            ],
            options={
                'verbose_name': 'Evento de Estoque Baixo',
                'verbose_name_plural': 'Eventos de Estoque Baixo',
                'ordering': ['-data_evento', '-id'],
            },
        ),
    ]
