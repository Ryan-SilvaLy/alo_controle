from datetime import timedelta
from decimal import Decimal, ROUND_CEILING
from math import sqrt

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from app_controle.models import RegistroSaidaItem
from app_item.models import EventoEstoqueBaixo, Item
from app_pedido.models import Pedido, PedidoItem
from app_usuario.models import Usuario
from app_usuario.services import registrar_log


SOLICITANTE_AUTOMATICO = 'ESTOQUE AUTOMATICO'
SETOR_DESTINO_AUTOMATICO = 'COMPRAS'
RESPONSAVEL_AUTOMATICO = 'REPOSICAO AUTOMATICA'
FATOR_ESTOQUE_SEGURANCA = Decimal('1.65')
PESO_MEDIA_RECENTE = Decimal('0.7')
PESO_MEDIA_HISTORICA = Decimal('0.3')
DIAS_MEDIA_RECENTE = 30
STATUS_PEDIDOS_ABERTOS = ['pendente', 'enviado', 'visto']


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


def _quantizar_decimal(valor: Decimal) -> Decimal:
    return Decimal(valor).quantize(Decimal('0.01'))


def _arredondar_para_cima(valor: Decimal) -> Decimal:
    return valor.quantize(Decimal('1'), rounding=ROUND_CEILING)


def _decimal_para_float(valor):
    if valor is None:
        return None

    try:
        return float(Decimal(valor))
    except Exception:
        return valor


def _metrica_reposicao_para_json(calculo):
    return {
        'estoque_atual': _decimal_para_float(calculo.get('estoque_atual')),
        'estoque_minimo': _decimal_para_float(calculo.get('estoque_minimo')),
        'estoque_ate_minimo': _decimal_para_float(calculo.get('estoque_ate_minimo')),
        'consumo_medio': _decimal_para_float(calculo.get('consumo_medio')),
        'consumo_ponderado': _decimal_para_float(calculo.get('consumo_ponderado')),
        'dias_ate_estoque_minimo': _decimal_para_float(calculo.get('dias_ate_estoque_minimo')),
        'dias_cobertura': calculo.get('dias_cobertura'),
        'estoque_seguranca': _decimal_para_float(calculo.get('estoque_seguranca')),
        'pedidos_abertos': _decimal_para_float(calculo.get('pedidos_abertos')),
        'balanco_cobertura': _decimal_para_float(calculo.get('balanco_cobertura')),
        'motivo': calculo.get('motivo'),
    }


def _ultimo_evento_estoque_baixo(item: Item, data_evento=None):
    evento = item.eventos_estoque_baixo.order_by('-data_evento', '-id').first()
    if evento:
        if data_evento and evento.data_evento > data_evento:
            evento.data_evento = data_evento
            evento.save(update_fields=['data_evento'])
        return evento

    return EventoEstoqueBaixo.objects.create(
        item=item,
        data_evento=data_evento or timezone.localdate(),
        estoque_atual=item.quantidade_atual,
        estoque_minimo=item.quantidade_minima,
    )


def _saidas_por_dia(item: Item, data_inicial, data_final):
    saidas = (
        RegistroSaidaItem.objects
        .filter(
            item=item,
            registro_saida__data_movimentacao__gte=data_inicial,
            registro_saida__data_movimentacao__lte=data_final,
        )
        .values('registro_saida__data_movimentacao')
        .annotate(total=Sum('quantidade'))
    )

    return {
        saida['registro_saida__data_movimentacao']: saida['total'] or Decimal('0')
        for saida in saidas
    }


def _total_saidas(item: Item, data_inicial, data_final) -> Decimal:
    total = (
        RegistroSaidaItem.objects
        .filter(
            item=item,
            registro_saida__data_movimentacao__gte=data_inicial,
            registro_saida__data_movimentacao__lte=data_final,
        )
        .aggregate(total=Sum('quantidade'))['total']
    )
    return total or Decimal('0')


def _data_inicio_ciclo_por_movimentacoes(item: Item, data_limite):
    saidas = (
        RegistroSaidaItem.objects
        .filter(
            item=item,
            registro_saida__data_movimentacao__lte=data_limite,
        )
        .select_related('registro_saida')
        .order_by(
            '-registro_saida__data_movimentacao',
            '-registro_saida_id',
            '-id',
        )
    )

    saldo_reconstruido = item.quantidade_atual
    data_inicio = None

    for saida in saidas:
        data_inicio = saida.registro_saida.data_movimentacao
        saldo_reconstruido += saida.quantidade

        if saldo_reconstruido > item.quantidade_minima:
            break

    return data_inicio


def _data_inicio_consumo_recente(item: Item, data_limite):
    data_minima = data_limite - timedelta(days=DIAS_MEDIA_RECENTE)

    primeira_saida_recente = (
        RegistroSaidaItem.objects
        .filter(
            item=item,
            registro_saida__data_movimentacao__gte=data_minima,
            registro_saida__data_movimentacao__lte=data_limite,
        )
        .order_by('registro_saida__data_movimentacao', 'registro_saida_id', 'id')
        .values_list('registro_saida__data_movimentacao', flat=True)
        .first()
    )
    if primeira_saida_recente:
        return primeira_saida_recente

    return (
        RegistroSaidaItem.objects
        .filter(
            item=item,
            registro_saida__data_movimentacao__lte=data_limite,
        )
        .order_by('-registro_saida__data_movimentacao', '-registro_saida_id', '-id')
        .values_list('registro_saida__data_movimentacao', flat=True)
        .first()
    )


def _desvio_padrao_consumo(saidas_diarias, data_inicial, dias_decorridos, media_diaria):
    consumos = []
    for indice in range(dias_decorridos):
        data = data_inicial + timedelta(days=indice)
        consumos.append(saidas_diarias.get(data, Decimal('0')))

    if not consumos:
        return Decimal('0')

    variancia = sum((consumo - media_diaria) ** 2 for consumo in consumos) / Decimal(len(consumos))
    return Decimal(str(sqrt(float(variancia))))


def _pedidos_abertos_para_item(item: Item, pedido_item_automatico=None) -> Decimal:
    queryset = PedidoItem.objects.filter(
        item=item,
        pedido__status__in=STATUS_PEDIDOS_ABERTOS,
    )

    if pedido_item_automatico:
        queryset = queryset.exclude(id=pedido_item_automatico.id)

    total = queryset.aggregate(total=Sum('quantidade_pedida'))['total']
    return total or Decimal('0')


def calcular_reposicao_item(item: Item, pedido_item_automatico=None, data_evento_estoque_baixo=None):
    dados_base = {
        'produto': item,
        'estoque_atual': item.quantidade_atual,
        'estoque_minimo': item.quantidade_minima,
        'estoque_ate_minimo': Decimal('0'),
        'consumo_medio': Decimal('0'),
        'consumo_ponderado': Decimal('0'),
        'dias_ate_estoque_minimo': None,
        'dias_cobertura': getattr(item.tipo_item, 'dias_cobertura', None),
        'estoque_seguranca': Decimal('0'),
        'pedidos_abertos': Decimal('0'),
        'balanco_cobertura': Decimal('0'),
        'quantidade_sugerida': Decimal('0'),
        'motivo': '',
    }

    if item.quantidade_minima is None:
        dados_base['motivo'] = 'Item sem estoque minimo definido.'
        return dados_base

    hoje = timezone.localdate()
    estoque_ate_minimo = max(item.quantidade_atual - item.quantidade_minima, Decimal('0'))
    dados_base['estoque_ate_minimo'] = estoque_ate_minimo

    data_inicio_movimentacoes = _data_inicio_ciclo_por_movimentacoes(item, hoje)
    if item.quantidade_atual <= item.quantidade_minima:
        evento = _ultimo_evento_estoque_baixo(item, data_evento_estoque_baixo)
        data_inicio_analise = evento.data_evento
        if data_inicio_movimentacoes and data_inicio_movimentacoes < data_inicio_analise:
            data_inicio_analise = data_inicio_movimentacoes
            evento.data_evento = data_inicio_analise
            evento.save(update_fields=['data_evento'])
    else:
        data_inicio_analise = _data_inicio_consumo_recente(item, hoje)

    pedidos_abertos = _pedidos_abertos_para_item(item, pedido_item_automatico)
    dados_base['pedidos_abertos'] = pedidos_abertos

    if not data_inicio_analise:
        dados_base['motivo'] = 'Item sem movimentacoes de saida para estimar consumo.'
        return dados_base

    total_saida = _total_saidas(item, data_inicio_analise, hoje)
    if total_saida <= 0:
        quantidade_manual = _quantidade_sugerida(item)
        dados_base.update({
            'quantidade_sugerida': quantidade_manual,
            'motivo': 'Item sem movimentacoes de saida no ciclo atual. Usando comportamento manual existente.',
        })
        return dados_base

    dias_decorridos = max((hoje - data_inicio_analise).days, 1)

    media_historica = total_saida / Decimal(dias_decorridos)
    data_inicio_recente = max(data_inicio_analise, hoje - timedelta(days=DIAS_MEDIA_RECENTE))
    dias_recentes = max((hoje - data_inicio_recente).days, 1)
    total_recente = _total_saidas(item, data_inicio_recente, hoje)
    media_recente = total_recente / Decimal(dias_recentes)

    consumo_ponderado = (
        (media_recente * PESO_MEDIA_RECENTE) +
        (media_historica * PESO_MEDIA_HISTORICA)
    )
    dias_ate_estoque_minimo = (
        Decimal('0')
        if estoque_ate_minimo <= 0
        else estoque_ate_minimo / consumo_ponderado
    )

    saidas_diarias = _saidas_por_dia(item, data_inicio_analise, hoje)
    desvio_padrao = _desvio_padrao_consumo(
        saidas_diarias,
        data_inicio_analise,
        dias_decorridos,
        media_historica,
    )
    estoque_seguranca = desvio_padrao * FATOR_ESTOQUE_SEGURANCA
    dias_cobertura = item.tipo_item.dias_cobertura
    necessidade_cobertura = (consumo_ponderado * Decimal(dias_cobertura)) + estoque_seguranca
    balanco_cobertura = necessidade_cobertura - estoque_ate_minimo - pedidos_abertos

    if balanco_cobertura <= 0:
        quantidade_sugerida = Decimal('0')
    else:
        quantidade_sugerida = _arredondar_para_cima(balanco_cobertura)

    dados_base.update({
        'consumo_medio': _quantizar_decimal(media_historica),
        'consumo_ponderado': _quantizar_decimal(consumo_ponderado),
        'dias_ate_estoque_minimo': _quantizar_decimal(dias_ate_estoque_minimo),
        'dias_cobertura': dias_cobertura,
        'estoque_seguranca': _quantizar_decimal(estoque_seguranca),
        'balanco_cobertura': _quantizar_decimal(balanco_cobertura),
        'quantidade_sugerida': quantidade_sugerida,
        'motivo': 'Calculado pelo consumo real das movimentacoes e pela folga ate o estoque minimo.',
    })
    return dados_base


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
def sincronizar_pedido_automatico_para_item(item: Item, usuario=None, data_evento_estoque_baixo=None):
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

    if item.quantidade_minima is None:
        if pedido_item_automatico:
            pedido_item_automatico.delete()

            if not pedido.itens.exists():
                pedido.delete()
        return

    calculo = calcular_reposicao_item(item, pedido_item_automatico, data_evento_estoque_baixo)
    quantidade_pedida = calculo['quantidade_sugerida']
    if quantidade_pedida <= 0:
        if pedido_item_automatico:
            pedido_item_automatico.delete()

            if not pedido.itens.exists():
                pedido.delete()
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
        'metrica_reposicao': _metrica_reposicao_para_json(calculo),
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
