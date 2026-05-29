from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from app_controle.models import RegistroEntrada, RegistroEntradaItem, RegistroSaida, RegistroSaidaItem
from app_item.models import EventoEstoqueBaixo, Item, TipoItem
from app_pedido.models import Pedido, PedidoItem
from app_pedido.services import calcular_reposicao_item, sincronizar_pedido_automatico_para_item
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
        self.tipo_item = TipoItem.objects.create(nome='PARAFUSOS', dias_cobertura=10)

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

    def mover_evento_para(self, item, data):
        EventoEstoqueBaixo.objects.filter(item=item).update(data_evento=data)

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

    def test_sem_historico_usa_comportamento_manual_existente(self):
        item = self.criar_item_baixo(atual='2.00', minimo='5.00')

        sincronizar_pedido_automatico_para_item(item, self.usuario)

        pedido_item = PedidoItem.objects.get(item=item)
        self.assertEqual(pedido_item.quantidade_pedida, Decimal('3.00'))

    def test_saida_no_mesmo_dia_usa_cobertura_para_sugerir_pedido(self):
        self.tipo_item.dias_cobertura = 30
        self.tipo_item.save()
        item = self.criar_item_baixo(atual='0.00', minimo='5.00')

        self.registrar_saida(item, 0, '6.00', '9900')

        sincronizar_pedido_automatico_para_item(item, self.usuario)

        pedido_item = PedidoItem.objects.get(item=item)
        self.assertEqual(pedido_item.quantidade_pedida, Decimal('180'))
        self.assertEqual(pedido_item.metrica_reposicao['consumo_ponderado'], 6.0)
        self.assertEqual(pedido_item.metrica_reposicao['dias_cobertura'], 30)

    def test_estoque_acima_do_minimo_usa_folga_ate_minimo_na_cobertura(self):
        self.tipo_item.dias_cobertura = 30
        self.tipo_item.save()
        item = self.criar_item_baixo(atual='20.00', minimo='5.00')

        self.registrar_saida(item, 0, '6.00', '9905')

        sincronizar_pedido_automatico_para_item(item, self.usuario)

        pedido_item = PedidoItem.objects.get(item=item)
        self.assertEqual(pedido_item.quantidade_pedida, Decimal('165'))
        self.assertEqual(pedido_item.metrica_reposicao['estoque_ate_minimo'], 15.0)
        self.assertEqual(pedido_item.metrica_reposicao['dias_ate_estoque_minimo'], 2.5)

    def test_saida_com_data_passada_define_inicio_do_ciclo_de_cobertura(self):
        self.tipo_item.dias_cobertura = 60
        self.tipo_item.save()
        item = self.criar_item_baixo(atual='6.00', minimo='5.00')
        data_movimentacao = timezone.localdate() - timedelta(days=10)

        registro = RegistroSaida.objects.create(
            bloco_requisicao='9901',
            setor='Manutencao',
            responsavel='Carlos',
            data_movimentacao=data_movimentacao,
        )

        item.quantidade_atual -= Decimal('2.00')
        item._data_evento_estoque_baixo = registro.data_movimentacao
        item.save()

        RegistroSaidaItem.objects.create(
            registro_saida=registro,
            item=item,
            quantidade=Decimal('2.00'),
            solicitante='Joao',
        )

        sincronizar_pedido_automatico_para_item(item, self.usuario)

        evento = EventoEstoqueBaixo.objects.get(item=item)
        pedido_item = PedidoItem.objects.get(item=item)

        self.assertEqual(evento.data_evento, data_movimentacao)
        self.assertGreater(pedido_item.quantidade_pedida, Decimal('1.00'))

    def test_sincronizacao_corrige_evento_criado_com_data_posterior(self):
        self.tipo_item.dias_cobertura = 60
        self.tipo_item.save()
        item = self.criar_item_baixo(atual='4.00', minimo='5.00')
        data_movimentacao = timezone.localdate() - timedelta(days=10)

        self.registrar_saida(item, 10, '2.00', '9902')

        sincronizar_pedido_automatico_para_item(item, self.usuario, data_movimentacao)

        evento = EventoEstoqueBaixo.objects.get(item=item)
        pedido_item = PedidoItem.objects.get(item=item)

        self.assertEqual(evento.data_evento, data_movimentacao)
        self.assertGreater(pedido_item.quantidade_pedida, Decimal('1.00'))

    def test_ciclo_inclui_saidas_que_levaram_ate_o_estoque_minimo(self):
        self.tipo_item.dias_cobertura = 60
        self.tipo_item.save()
        item = self.criar_item_baixo(atual='4.00', minimo='5.00')
        data_primeira_saida_ciclo = timezone.localdate() - timedelta(days=20)

        self.registrar_saida(item, 20, '1.00', '9903')
        self.registrar_saida(item, 10, '1.00', '9904')

        sincronizar_pedido_automatico_para_item(item, self.usuario)

        evento = EventoEstoqueBaixo.objects.get(item=item)
        pedido_item = PedidoItem.objects.get(item=item)

        self.assertEqual(evento.data_evento, data_primeira_saida_ciclo)
        self.assertGreater(pedido_item.quantidade_pedida, Decimal('1.00'))

    def test_calculo_considera_apenas_saidas_reais_do_ciclo(self):
        item = self.criar_item_baixo(atual='3.00', minimo='5.00')
        inicio_ciclo = timezone.localdate() - timedelta(days=10)
        self.mover_evento_para(item, inicio_ciclo)

        self.registrar_saida(item, 9, '10.00', '1001')
        self.registrar_saida(item, 1, '5.00', '1002')

        entrada = RegistroEntrada.objects.create(
            recebido_por='Maria',
            data_movimentacao=timezone.localdate() - timedelta(days=2),
        )
        RegistroEntradaItem.objects.create(
            registro_entrada=entrada,
            item=item,
            quantidade=Decimal('100.00'),
            quantidade_disponivel=Decimal('100.00'),
        )

        calculo = calcular_reposicao_item(item)

        self.assertEqual(calculo['consumo_medio'], Decimal('1.50'))
        self.assertEqual(calculo['consumo_ponderado'], Decimal('1.50'))
        self.assertEqual(calculo['dias_cobertura'], 10)
        self.assertGreater(calculo['estoque_seguranca'], Decimal('0'))
        self.assertGreater(calculo['quantidade_sugerida'], Decimal('12'))

    def test_pedidos_abertos_reduzem_quantidade_sugerida(self):
        item = self.criar_item_baixo(atual='3.00', minimo='5.00')
        self.mover_evento_para(item, timezone.localdate() - timedelta(days=10))
        self.registrar_saida(item, 5, '20.00', '2001')

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

        calculo_com_aberto = calcular_reposicao_item(item)

        pedido_manual.status = 'cancelado'
        pedido_manual.save()
        calculo_sem_aberto = calcular_reposicao_item(item)

        self.assertEqual(calculo_com_aberto['pedidos_abertos'], Decimal('8.00'))
        self.assertEqual(
            calculo_sem_aberto['quantidade_sugerida'] - calculo_com_aberto['quantidade_sugerida'],
            Decimal('8'),
        )

    def test_resultado_menor_ou_igual_zero_nao_mantem_item_no_pedido(self):
        item = self.criar_item_baixo(atual='4.00', minimo='5.00')
        self.mover_evento_para(item, timezone.localdate() - timedelta(days=10))
        self.registrar_saida(item, 5, '1.00', '3001')

        pedido = Pedido.objects.create(
            solicitante='Estoque Automatico',
            setor_destino='Compras',
            responsavel_setor='Reposicao Automatica',
            tipo_item=self.tipo_item,
            gerado_automaticamente=True,
            criado_por=self.usuario,
        )
        PedidoItem.objects.create(
            pedido=pedido,
            item=item,
            quantidade_pedida=Decimal('1.00'),
            quantidade_atual_estoque=4,
            adicionado_automaticamente=True,
        )

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
            quantidade_pedida=Decimal('20.00'),
            quantidade_atual_estoque=4,
        )

        sincronizar_pedido_automatico_para_item(item, self.usuario)

        self.assertFalse(PedidoItem.objects.filter(item=item, adicionado_automaticamente=True).exists())
