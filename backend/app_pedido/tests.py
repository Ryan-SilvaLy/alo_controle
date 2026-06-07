from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from app_controle.models import RegistroEntrada, RegistroEntradaItem, RegistroSaida, RegistroSaidaItem
from app_item.models import Item, TipoItem
from app_pedido.models import Pedido, PedidoItem
from app_pedido.services import (
    ESTRATEGIA_SEM_SAIDAS_QUANTIDADE_MINIMA,
    PedidoAutomaticoService,
    calcular_reposicao_item,
    sincronizar_pedido_automatico_para_item,
)
from app_usuario.models import Usuario


class ReposicaoAutomaticaTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            username='compras',
            password='123456',
            nome='Usuario Compras',
            cargo='Comprador',
            setor='Compras',
            nivel_permissao='compra',
        )
        self.tipo_item = TipoItem.objects.create(nome='PARAFUSOS', dias_cobertura=60)

    def criar_item_baixo(self, codigo='MAT-001', atual='3.00', minimo='5.00'):
        return Item.objects.create(
            codigo=codigo,
            nome='Item Teste',
            descricao='Item de teste',
            tipo_item=self.tipo_item,
            prateleira_estoque='A1',
            quantidade_atual=Decimal(atual),
            quantidade_minima=Decimal(minimo),
            unidade_medida='un',
        )

    def registrar_entrada(self, item, dias_atras, quantidade='100.00'):
        registro = RegistroEntrada.objects.create(
            recebido_por='Maria',
            data_movimentacao=timezone.localdate() - timedelta(days=dias_atras),
        )
        return RegistroEntradaItem.objects.create(
            registro_entrada=registro,
            item=item,
            quantidade=Decimal(quantidade),
            quantidade_disponivel=Decimal(quantidade),
        )

    def registrar_saida(self, item, dias_atras, quantidade, bloco):
        registro = RegistroSaida.objects.create(
            bloco_requisicao=bloco,
            setor='Manutencao',
            responsavel='Carlos',
            data_movimentacao=timezone.localdate() - timedelta(days=dias_atras),
        )
        return RegistroSaidaItem.objects.create(
            registro_saida=registro,
            item=item,
            quantidade=Decimal(quantidade),
            solicitante='Joao',
        )

    def test_sem_entrada_nao_gera_pedido_por_padrao(self):
        item = self.criar_item_baixo(atual='2.00', minimo='5.00')

        sincronizar_pedido_automatico_para_item(item, self.usuario)

        self.assertFalse(PedidoItem.objects.filter(item=item).exists())

    def test_sem_saidas_apos_ultima_entrada_permite_quantidade_minima_configuravel(self):
        item = self.criar_item_baixo(atual='2.00', minimo='5.00')
        self.registrar_entrada(item, 10)

        service = PedidoAutomaticoService(
            estrategia_sem_saidas=ESTRATEGIA_SEM_SAIDAS_QUANTIDADE_MINIMA,
            quantidade_minima_sem_saidas='7.20',
        )
        calculo = service.gerarItensPedido(item)

        self.assertEqual(calculo['quantidade_sugerida'], Decimal('8'))
        self.assertIn('quantidade minima configurada', calculo['motivo'])

    def test_calculo_usa_apenas_historico_a_partir_da_ultima_entrada(self):
        item = self.criar_item_baixo(atual='3.00', minimo='5.00')
        self.registrar_entrada(item, 40)
        self.registrar_saida(item, 30, '100.00', '1001')
        ultima_entrada = self.registrar_entrada(item, 20, '50.00')
        self.registrar_saida(item, 10, '15.00', '1002')

        calculo = calcular_reposicao_item(item)

        self.assertEqual(calculo['ultima_entrada'], ultima_entrada)
        self.assertEqual(calculo['quantidade_consumida'], Decimal('15.00'))
        self.assertEqual(calculo['dias_analisados'], 20)
        self.assertEqual(calculo['consumo_medio'], Decimal('0.75'))
        self.assertEqual(calculo['quantidade_sugerida'], Decimal('51'))

    def test_quantidade_sugerida_arredonda_para_cima(self):
        self.tipo_item.dias_cobertura = 100
        self.tipo_item.save()
        item = self.criar_item_baixo(atual='1.00', minimo='5.00')
        self.registrar_entrada(item, 100)
        self.registrar_saida(item, 50, '13.01', '1003')

        calculo = calcular_reposicao_item(item)

        self.assertEqual(calculo['quantidade_sugerida'], Decimal('7'))

    def test_saldo_atual_e_minimo_nao_abatem_a_quantidade_sugerida(self):
        self.tipo_item.dias_cobertura = 30
        self.tipo_item.save()
        item = self.criar_item_baixo(atual='4.00', minimo='5.00')
        self.registrar_entrada(item, 10)
        self.registrar_saida(item, 5, '10.00', '1004')

        calculo = calcular_reposicao_item(item)

        self.assertEqual(calculo['quantidade_sugerida'], Decimal('35'))
        self.assertEqual(calculo['estoque_atual'], Decimal('4.00'))
        self.assertEqual(calculo['estoque_minimo'], Decimal('5.00'))

    def test_data_do_modal_nao_comprime_consumo_historico_em_um_dia(self):
        self.tipo_item.dias_cobertura = 60
        self.tipo_item.save()
        item = self.criar_item_baixo(atual='3.00', minimo='5.00')
        self.registrar_entrada(item, 60)
        data_evento = timezone.localdate() - timedelta(days=44)
        self.registrar_saida(item, 44, '7.00', '1008')
        self.registrar_saida(item, 30, '4.00', '1009')
        self.registrar_saida(item, 10, '3.00', '1010')

        calculo = calcular_reposicao_item(item, data_evento_estoque_baixo=data_evento)

        self.assertEqual(calculo['quantidade_consumida'], Decimal('14.00'))
        self.assertEqual(calculo['dias_analisados'], 60)
        self.assertLess(calculo['quantidade_sugerida'], Decimal('840'))

    def test_sincronizacao_cria_pedido_automatico_com_resumo_do_calculo(self):
        item = self.criar_item_baixo(atual='3.00', minimo='5.00')
        entrada = self.registrar_entrada(item, 20)
        self.registrar_saida(item, 10, '15.00', '1005')

        sincronizar_pedido_automatico_para_item(item, self.usuario)

        pedido_item = PedidoItem.objects.get(item=item, adicionado_automaticamente=True)
        self.assertEqual(pedido_item.quantidade_pedida, Decimal('51'))
        self.assertEqual(pedido_item.ultima_entrada_estoque, entrada.registro_entrada.data_movimentacao)
        self.assertEqual(pedido_item.metrica_reposicao['consumo_medio'], 0.75)
        self.assertEqual(pedido_item.metrica_reposicao['dias_cobertura'], 60)
        self.assertEqual(pedido_item.metrica_reposicao['quantidade_sugerida'], 51.0)
        self.assertEqual(
            pedido_item.metrica_reposicao['ultima_entrada_utilizada'],
            entrada.registro_entrada.data_movimentacao.isoformat(),
        )

    def test_pedido_aberto_manual_bloqueia_pedido_automatico_sem_abater_quantidade(self):
        item = self.criar_item_baixo(atual='3.00', minimo='5.00')
        self.registrar_entrada(item, 20)
        self.registrar_saida(item, 10, '15.00', '1006')

        pedido_manual = Pedido.objects.create(
            solicitante='Manual',
            setor_destino='Compras',
            responsavel_setor='Ana',
            tipo_item=self.tipo_item,
            criado_por=self.usuario,
        )
        PedidoItem.objects.create(
            pedido=pedido_manual,
            item=item,
            quantidade_pedida=Decimal('8.00'),
            quantidade_atual_estoque=3,
        )

        calculo = calcular_reposicao_item(item)
        sincronizar_pedido_automatico_para_item(item, self.usuario)

        self.assertEqual(calculo['pedidos_abertos'], Decimal('8.00'))
        self.assertEqual(calculo['quantidade_sugerida'], Decimal('43'))
        self.assertFalse(PedidoItem.objects.filter(item=item, adicionado_automaticamente=True).exists())

    def test_item_ok_remove_item_automatico_pendente(self):
        item = self.criar_item_baixo(atual='3.00', minimo='5.00')
        self.registrar_entrada(item, 20)
        self.registrar_saida(item, 10, '15.00', '1007')
        sincronizar_pedido_automatico_para_item(item, self.usuario)

        item.quantidade_atual = Decimal('10.00')
        item.save()
        sincronizar_pedido_automatico_para_item(item, self.usuario)

        self.assertFalse(PedidoItem.objects.filter(item=item, adicionado_automaticamente=True).exists())
