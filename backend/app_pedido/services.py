from decimal import Decimal, ROUND_CEILING

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from app_controle.models import RegistroEntradaItem, RegistroSaidaItem
from app_item.models import Item
from app_pedido.models import Pedido, PedidoItem
from app_usuario.models import Usuario
from app_usuario.services import registrar_log


SOLICITANTE_AUTOMATICO = 'ESTOQUE AUTOMATICO'
SETOR_DESTINO_AUTOMATICO = 'COMPRAS'
RESPONSAVEL_AUTOMATICO = 'REPOSICAO AUTOMATICA'
STATUS_PEDIDOS_ABERTOS = ['pendente', 'enviado', 'visto']
ESTRATEGIA_SEM_SAIDAS_NAO_GERAR = 'nao_gerar'
ESTRATEGIA_SEM_SAIDAS_QUANTIDADE_MINIMA = 'quantidade_minima'


def _buscar_usuario_responsavel(usuario=None):
    if usuario and getattr(usuario, 'is_authenticated', False):
        return usuario

    return (
        Usuario.objects
        .filter(is_active=True)
        .order_by('-is_superuser', '-is_staff', 'id')
        .first()
    )


def _quantizar_decimal(valor: Decimal) -> Decimal:
    return Decimal(valor).quantize(Decimal('0.01'))


def _arredondar_para_cima(valor: Decimal) -> Decimal:
    return Decimal(valor).quantize(Decimal('1'), rounding=ROUND_CEILING)


def _decimal_para_float(valor):
    if valor is None:
        return None

    try:
        return float(Decimal(valor))
    except Exception:
        return valor


def _data_para_iso(valor):
    return valor.isoformat() if valor else None


def _nomes_campos(model):
    return {campo.name for campo in model._meta.get_fields()}


class PedidoAutomaticoService:
    def __init__(
        self,
        usuario=None,
        estrategia_sem_saidas=None,
        quantidade_minima_sem_saidas=None,
    ):
        self.usuario = usuario
        self.estrategia_sem_saidas = (
            estrategia_sem_saidas
            or getattr(settings, 'PEDIDO_AUTOMATICO_SEM_SAIDAS_ESTRATEGIA', ESTRATEGIA_SEM_SAIDAS_NAO_GERAR)
        )
        self.quantidade_minima_sem_saidas = Decimal(
            str(
                quantidade_minima_sem_saidas
                if quantidade_minima_sem_saidas is not None
                else getattr(settings, 'PEDIDO_AUTOMATICO_QUANTIDADE_MINIMA_SEM_SAIDAS', '0')
            )
        )

    def localizarUltimaEntrada(self, item: Item):
        queryset = RegistroEntradaItem.objects.filter(item=item).select_related('registro_entrada')
        queryset = self._filtrar_movimentacoes_validas(queryset, 'registro_entrada')

        # Identifica a ultima entrada valida do item; tudo antes dela fica fora do novo ciclo de compra.
        return queryset.order_by(
            '-registro_entrada__data_movimentacao',
            '-registro_entrada__data_entrada',
            '-criado_em',
            '-id',
        ).first()

    def buscarSaidasAposEntrada(self, item: Item, ultima_entrada):
        if not ultima_entrada:
            return RegistroSaidaItem.objects.none()

        queryset = RegistroSaidaItem.objects.filter(
            item=item,
            registro_saida__data_movimentacao__gt=ultima_entrada.registro_entrada.data_movimentacao,
        ).select_related('registro_saida')
        queryset = self._filtrar_movimentacoes_validas(queryset, 'registro_saida')

        # Filtra somente saidas apos a ultima entrada para impedir que historicos antigos distorcam o consumo.
        return queryset.order_by(
            'registro_saida__data_movimentacao',
            'registro_saida__data_saida',
            'id',
        )

    def calcularConsumoMedio(self, saidas, data_inicio, data_final=None):
        data_final = data_final or timezone.localdate()
        dias_analisados = max((data_final - data_inicio).days, 1)
        quantidade_consumida = saidas.aggregate(total=Sum('quantidade'))['total'] or Decimal('0')

        # Calcula o consumo medio diario apenas com a quantidade consumida no ciclo da ultima reposicao.
        consumo_medio_diario = quantidade_consumida / Decimal(dias_analisados)
        return {
            'quantidade_consumida': quantidade_consumida,
            'dias_analisados': dias_analisados,
            'consumo_medio_diario': consumo_medio_diario,
        }

    def calcularCobertura(self, item: Item, consumo_medio_diario: Decimal) -> Decimal:
        dias_cobertura = getattr(item.tipo_item, 'dias_cobertura', 0) or 0

        # Aplica a cobertura configurada no grupo do item, sem abater estoque atual nem estoque minimo.
        return Decimal(consumo_medio_diario) * Decimal(dias_cobertura)

    def verificarPedidoAberto(self, item: Item, pedido_item_automatico=None) -> bool:
        # Evita pedidos duplicados quando ja existe compra aberta, pendente de aprovacao ou aguardando entrega.
        return self._pedidos_abertos_queryset(item, pedido_item_automatico).exists()

    def gerarItensPedido(self, item: Item, pedido_item_automatico=None):
        dados_base = self._dados_base(item)

        if item.situacao != 'baixo':
            dados_base['motivo'] = 'Item nao esta com estoque baixo.'
            return dados_base

        if not item.tipo_item_id:
            dados_base['motivo'] = 'Item sem grupo definido.'
            return dados_base

        dados_base['pedidos_abertos'] = self._quantidade_pedidos_abertos(item, pedido_item_automatico)
        ultima_entrada = self.localizarUltimaEntrada(item)
        if not ultima_entrada:
            return self._resultado_sem_saidas(dados_base, 'Item sem entrada registrada para iniciar o ciclo de consumo.')

        saidas = self.buscarSaidasAposEntrada(item, ultima_entrada)
        data_inicio = ultima_entrada.registro_entrada.data_movimentacao
        consumo = self.calcularConsumoMedio(saidas, data_inicio)
        dados_base.update({
            'ultima_entrada': ultima_entrada,
            'ultima_entrada_data': data_inicio,
            'ultima_entrada_quantidade': ultima_entrada.quantidade,
            'quantidade_consumida': consumo['quantidade_consumida'],
            'dias_analisados': consumo['dias_analisados'],
            'consumo_medio': _quantizar_decimal(consumo['consumo_medio_diario']),
            'consumo_ponderado': _quantizar_decimal(consumo['consumo_medio_diario']),
        })

        if consumo['quantidade_consumida'] <= 0:
            return self._resultado_sem_saidas(
                dados_base,
                'Item sem movimentacoes de saida apos a ultima entrada.'
            )

        quantidade_cobertura = self.calcularCobertura(item, consumo['consumo_medio_diario'])

        # Gera a quantidade sugerida arredondando sempre para cima a cobertura calculada.
        quantidade_sugerida = _arredondar_para_cima(quantidade_cobertura)

        dados_base.update({
            'dias_cobertura': item.tipo_item.dias_cobertura,
            'quantidade_sugerida': quantidade_sugerida,
            'motivo': 'Calculado pelo consumo real apos a ultima entrada do item.',
        })
        return dados_base

    @transaction.atomic
    def criarPedidoAutomatico(self, item: Item, data_evento_estoque_baixo=None):
        if not item.tipo_item_id:
            return None

        pedido_item_automatico = self._pedido_item_automatico_editavel(item)
        pedido = pedido_item_automatico.pedido if pedido_item_automatico else None

        calculo = self.gerarItensPedido(item, pedido_item_automatico)
        quantidade_pedida = calculo['quantidade_sugerida']

        if item.situacao != 'baixo' or quantidade_pedida <= 0:
            self._remover_item_automatico_se_necessario(pedido_item_automatico)
            return None

        if self.verificarPedidoAberto(item, pedido_item_automatico):
            self._remover_item_automatico_se_necessario(pedido_item_automatico)
            return None

        usuario_responsavel = _buscar_usuario_responsavel(self.usuario)
        if not usuario_responsavel:
            return None

        if not pedido:
            pedido = self._buscar_pedido_automatico_aberto(item)

        if not pedido:
            pedido = self._criar_pedido_para_item(item, usuario_responsavel)

        defaults = {
            'quantidade_pedida': quantidade_pedida,
            'quantidade_atual_estoque': int(item.quantidade_atual),
            'ultima_entrada_estoque': calculo.get('ultima_entrada_data'),
            'adicionado_automaticamente': True,
            'metrica_reposicao': self._metrica_reposicao_para_json(calculo),
        }

        if pedido_item_automatico:
            for campo, valor in defaults.items():
                setattr(pedido_item_automatico, campo, valor)
            pedido_item_automatico.save()
            return pedido_item_automatico

        PedidoItem.objects.create(
            pedido=pedido,
            item=item,
            **defaults,
        )
        return pedido

    def _dados_base(self, item):
        return {
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
            'quantidade_consumida': Decimal('0'),
            'dias_analisados': 0,
            'ultima_entrada': None,
            'ultima_entrada_data': None,
            'ultima_entrada_quantidade': None,
            'motivo': '',
        }

    def _resultado_sem_saidas(self, dados_base, motivo):
        if self.estrategia_sem_saidas == ESTRATEGIA_SEM_SAIDAS_QUANTIDADE_MINIMA:
            dados_base.update({
                'quantidade_sugerida': _arredondar_para_cima(self.quantidade_minima_sem_saidas),
                'motivo': f'{motivo} Usando quantidade minima configurada.',
            })
            return dados_base

        dados_base['motivo'] = f'{motivo} Pedido automatico nao gerado pela estrategia configurada.'
        return dados_base

    def _filtrar_movimentacoes_validas(self, queryset, caminho_registro):
        model = queryset.model
        campos_item = _nomes_campos(model)
        registro_model = model._meta.get_field(caminho_registro).related_model
        campos_registro = _nomes_campos(registro_model)

        for campo in ('cancelado', 'excluido', 'estornado'):
            if campo in campos_item:
                queryset = queryset.filter(**{campo: False})
            if campo in campos_registro:
                queryset = queryset.filter(**{f'{caminho_registro}__{campo}': False})

        for campo in ('status', 'situacao'):
            if campo in campos_item:
                queryset = queryset.exclude(**{f'{campo}__in': ['cancelado', 'excluido', 'estornado']})
            if campo in campos_registro:
                queryset = queryset.exclude(**{f'{caminho_registro}__{campo}__in': ['cancelado', 'excluido', 'estornado']})

        return queryset

    def _pedidos_abertos_queryset(self, item, pedido_item_automatico=None):
        queryset = PedidoItem.objects.filter(
            item=item,
            pedido__status__in=STATUS_PEDIDOS_ABERTOS,
        )

        if pedido_item_automatico and pedido_item_automatico.pedido.status == 'pendente':
            queryset = queryset.exclude(id=pedido_item_automatico.id)

        return queryset

    def _quantidade_pedidos_abertos(self, item, pedido_item_automatico=None):
        total = self._pedidos_abertos_queryset(item, pedido_item_automatico).aggregate(
            total=Sum('quantidade_pedida')
        )['total']
        return total or Decimal('0')

    def _pedido_item_automatico_editavel(self, item):
        return (
            PedidoItem.objects
            .filter(
                item=item,
                adicionado_automaticamente=True,
                pedido__gerado_automaticamente=True,
                pedido__status='pendente',
            )
            .select_related('pedido')
            .first()
        )

    def _buscar_pedido_automatico_aberto(self, item):
        chave = self._chave_agrupamento(item)
        queryset = Pedido.objects.filter(gerado_automaticamente=True, status='pendente')

        if chave['tipo'] == 'grupo':
            queryset = queryset.filter(tipo_item=item.tipo_item)
        else:
            queryset = queryset.filter(responsavel_setor__icontains=chave['valor'])

        return queryset.first()

    def _chave_agrupamento(self, item):
        fornecedor = self._fornecedor_padrao(item)
        if fornecedor:
            return {'tipo': 'fornecedor', 'valor': fornecedor}

        return {'tipo': 'grupo', 'valor': item.tipo_item.nome}

    def _fornecedor_padrao(self, item):
        for atributo in ('fornecedor_padrao', 'fornecedor'):
            fornecedor = getattr(item, atributo, None)
            if not fornecedor:
                continue

            if hasattr(fornecedor, 'nome'):
                return fornecedor.nome

            return str(fornecedor)

        return None

    def _criar_pedido_para_item(self, item, usuario_responsavel):
        chave = self._chave_agrupamento(item)
        responsavel = f'{RESPONSAVEL_AUTOMATICO} - {chave["valor"]}'

        pedido = Pedido.objects.create(
            solicitante=SOLICITANTE_AUTOMATICO,
            setor_destino=SETOR_DESTINO_AUTOMATICO,
            responsavel_setor=responsavel,
            tipo_item=item.tipo_item,
            gerado_automaticamente=True,
            criado_por=usuario_responsavel,
        )
        registrar_log(
            usuario_responsavel,
            f'Pedido automatico "{pedido.id} - {pedido.codigo_pedido}" criado para "{chave["valor"]}".'
        )
        return pedido

    def _remover_item_automatico_se_necessario(self, pedido_item_automatico):
        if not pedido_item_automatico:
            return

        pedido = pedido_item_automatico.pedido
        pedido_item_automatico.delete()

        if not pedido.itens.exists():
            pedido.delete()

    def _metrica_reposicao_para_json(self, calculo):
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
            'quantidade_consumida': _decimal_para_float(calculo.get('quantidade_consumida')),
            'dias_analisados': calculo.get('dias_analisados'),
            'quantidade_sugerida': _decimal_para_float(calculo.get('quantidade_sugerida')),
            'ultima_entrada_utilizada': _data_para_iso(calculo.get('ultima_entrada_data')),
            'ultima_entrada_quantidade': _decimal_para_float(calculo.get('ultima_entrada_quantidade')),
            'motivo': calculo.get('motivo'),
        }


def calcular_reposicao_item(item: Item, pedido_item_automatico=None, data_evento_estoque_baixo=None):
    service = PedidoAutomaticoService()
    return service.gerarItensPedido(item, pedido_item_automatico)


@transaction.atomic
def sincronizar_pedido_automatico_para_item(item: Item, usuario=None, data_evento_estoque_baixo=None):
    service = PedidoAutomaticoService(usuario=usuario)
    return service.criarPedidoAutomatico(item, data_evento_estoque_baixo)
