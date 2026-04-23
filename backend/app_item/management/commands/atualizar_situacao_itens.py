from django.core.management.base import BaseCommand
from app_item.models import Item

class Command(BaseCommand):
    help = 'Atualiza a situação de todos os itens com base na quantidade atual e mínima'

    def handle(self, *args, **kwargs):
        itens = Item.objects.all()
        total = itens.count()
        for item in itens:
            if item.quantidade_atual < item.quantidade_minima:
                item.situacao = 'baixo'
            else:
                item.situacao = 'ok'
            item.save()
            self.stdout.write(f'Item {item.codigo} atualizado: situacao={item.situacao}')
        self.stdout.write(self.style.SUCCESS(f'Todos os {total} itens foram atualizados com sucesso!'))
