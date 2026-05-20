from django.db import migrations, models
import django.db.models.deletion


def preencher_quantidade_disponivel(apps, schema_editor):
    RegistroEntradaItem = apps.get_model('app_controle', 'RegistroEntradaItem')
    for entrada_item in RegistroEntradaItem.objects.all():
        entrada_item.quantidade_disponivel = entrada_item.quantidade
        entrada_item.save(update_fields=['quantidade_disponivel'])


class Migration(migrations.Migration):

    dependencies = [
        ('app_controle', '0008_alter_registrosaidaitem_patrimonio'),
    ]

    operations = [
        migrations.AddField(
            model_name='registroentradaitem',
            name='ca',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='C.A.'),
        ),
        migrations.AddField(
            model_name='registroentradaitem',
            name='quantidade_disponivel',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Quantidade Disponivel no Lote'),
        ),
        migrations.AlterField(
            model_name='registrosaidaitem',
            name='patrimonio',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='Patrimônio'),
        ),
        migrations.CreateModel(
            name='RegistroSaidaItemLote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantidade', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Quantidade Baixada do Lote')),
                ('ca', models.CharField(blank=True, max_length=50, null=True, verbose_name='C.A. utilizado')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='Criado em')),
                ('registro_entrada_item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='saidas_lote', to='app_controle.registroentradaitem', verbose_name='Item da Entrada')),
                ('registro_saida_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lotes', to='app_controle.registrosaidaitem', verbose_name='Item da Saida')),
            ],
        ),
        migrations.RunPython(preencher_quantidade_disponivel, migrations.RunPython.noop),
    ]
