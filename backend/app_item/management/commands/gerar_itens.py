from django.core.management.base import BaseCommand
import random
from decimal import Decimal
from app_item.models import Item, TipoItem


class Command(BaseCommand):
    help = 'Gera 100 itens no banco'

    def handle(self, *args, **kwargs):
        tipo, _ = TipoItem.objects.get_or_create(nome='GERAL')

        for i in range(1, 101):
            codigo = f'ITEM{i:03d}'

            Item.objects.get_or_create(
                codigo=codigo,
                defaults={
                    'nome': f'Produto {i}',
                    'descricao': f'Descrição do produto {i}',
                    'tipo_item': tipo,
                    'prateleira_estoque': f'P{i % 10}',
                    'quantidade_atual': Decimal(random.randint(0, 100)),
                    'quantidade_minima': Decimal('10.00'),
                    'unidade_medida': random.choice(['un', 'kg', 'g', 'l', 'ml', 'cx', 'pct', 'm', 'cm']),
                    'status': 'ativo'
                }
            )

        self.stdout.write(self.style.SUCCESS('100 itens criados com sucesso!'))