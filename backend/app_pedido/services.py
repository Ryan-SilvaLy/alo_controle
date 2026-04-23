from decimal import Decimal

from django.db import transaction

from app_item.models import Item
from app_pedido.models import Pedido, PedidoItem
from app_usuario.models import Usuario
from app_usuario.services import registrar_log


SOLICITANTE_AUTOMATICO = 'ESTOQUE AUTOMATICO'
SETOR_DESTINO_AUTOMATICO = 'COMPRAS'
RESPONSAVEL_AUTOMATICO = 'REPOSICAO AUTOMATICA'


def _buscar_usuario_responsavel(usuario=None):
    if usuario and getattr(usuario, 'is_authenticated', False):
        return usuario

    return (
        Usuario.objects
        .filter(is_active=True)
        .order_by('-is_superuser', '-is_staff', 'id')
        .first()
    )


def _quantidade_sugerida(item: Item) -> Decimal:
    diferenca = item.quantidade_minima - item.quantidade_atual
    return diferenca if diferenca > 0 else Decimal('0')


def _buscar_pedido_automatico_aberto(tipo_item):
    return (
        Pedido.objects
        .filter(
            gerado_automaticamente=True,
            tipo_item=tipo_item,
            status='pendente'
        )
        .first()
    )


@transaction.atomic
def sincronizar_pedido_automatico_para_item(item: Item, usuario=None):
    if not item.tipo_item_id:
        return

    pedido = _buscar_pedido_automatico_aberto(item.tipo_item)
    pedido_item_automatico = (
        pedido.itens.filter(item=item, adicionado_automaticamente=True).first()
        if pedido else None
    )
    pedido_item_manual = (
        pedido.itens.filter(item=item, adicionado_automaticamente=False).first()
        if pedido else None
    )

    if item.situacao != 'baixo':
        if pedido_item_automatico:
            pedido_item_automatico.delete()

            if not pedido.itens.exists():
                pedido.delete()
        return

    quantidade_pedida = _quantidade_sugerida(item)
    if quantidade_pedida <= 0:
        return

    usuario_responsavel = _buscar_usuario_responsavel(usuario)
    if not usuario_responsavel:
        return

    if not pedido:
        pedido = Pedido.objects.create(
            solicitante=SOLICITANTE_AUTOMATICO,
            setor_destino=SETOR_DESTINO_AUTOMATICO,
            responsavel_setor=f'{RESPONSAVEL_AUTOMATICO} - {item.tipo_item.nome}',
            tipo_item=item.tipo_item,
            gerado_automaticamente=True,
            criado_por=usuario_responsavel,
        )
        registrar_log(
            usuario_responsavel,
            f'Pedido automático "{pedido.id} - {pedido.codigo_pedido}" criado para o grupo "{item.tipo_item.nome}".'
        )

    defaults = {
        'quantidade_pedida': quantidade_pedida,
        'quantidade_atual_estoque': int(item.quantidade_atual),
        'ultima_entrada_estoque': None,
        'adicionado_automaticamente': True,
    }

    if pedido_item_automatico:
        for campo, valor in defaults.items():
            setattr(pedido_item_automatico, campo, valor)
        pedido_item_automatico.save()
        return

    if pedido_item_manual:
        return

    PedidoItem.objects.create(
        pedido=pedido,
        item=item,
        **defaults,
    )
