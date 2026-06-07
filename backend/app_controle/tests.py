from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app_controle.models import RegistroEntrada, RegistroEntradaItem, RegistroSaidaItem, RegistroSaidaItemLote
from app_item.models import EventoEstoqueBaixo, Item, TipoItem
from app_pedido.models import PedidoItem
from app_usuario.models import Usuario


class RegistroEstoqueUpdateTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.usuario = Usuario.objects.create_user(
            username='almox',
            password='123456',
            nome='Usuario Almox',
            cargo='Almoxarife',
            setor='Estoque',
            nivel_permissao='almoxarifado',
        )
        self.client.force_authenticate(user=self.usuario)

        self.tipo_item = TipoItem.objects.create(nome='CONSUMO')
        self.tipo_epi = TipoItem.objects.create(nome='EPI')
        self.item = Item.objects.create(
            codigo='MAT-001',
            nome='Caneta Azul',
            descricao='Item de teste',
            tipo_item=self.tipo_item,
            prateleira_estoque='A1',
            quantidade_atual=Decimal('10.00'),
            quantidade_minima=Decimal('2.00'),
            unidade_medida='un',
        )
        self.item_epi = Item.objects.create(
            codigo='EPI-001',
            nome='Luva de Protecao',
            descricao='Item de teste',
            tipo_item=self.tipo_epi,
            prateleira_estoque='B1',
            quantidade_atual=Decimal('0.00'),
            quantidade_minima=Decimal('1.00'),
            unidade_medida='un',
        )

    def test_editar_saida_substitui_quantidade_sem_baixar_estoque_duas_vezes(self):
        response_create = self.client.post(
            '/api/controle/registro-saida/',
            self._payload_saida('9001', '4.00'),
            format='json',
        )

        self.assertEqual(response_create.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantidade_atual, Decimal('6.00'))

        response_update = self.client.put(
            f"/api/controle/registro-saida/{response_create.data['id']}/",
            self._payload_saida('9001', '6.00'),
            format='json',
        )

        self.assertEqual(response_update.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantidade_atual, Decimal('4.00'))
        self.assertEqual(len(response_update.data['itens']), 1)
        self.assertEqual(Decimal(response_update.data['itens'][0]['quantidade']), Decimal('6.00'))

    def test_editar_entrada_substitui_quantidade_sem_acrescentar_estoque_duas_vezes(self):
        response_create = self.client.post(
            '/api/controle/registro-entrada/',
            self._payload_entrada('4.00'),
            format='json',
        )

        self.assertEqual(response_create.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantidade_atual, Decimal('14.00'))

        response_update = self.client.put(
            f"/api/controle/registro-entrada/{response_create.data['id']}/",
            self._payload_entrada('6.00'),
            format='json',
        )

        self.assertEqual(response_update.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantidade_atual, Decimal('16.00'))
        self.assertEqual(len(response_update.data['itens']), 1)
        self.assertEqual(Decimal(response_update.data['itens'][0]['quantidade']), Decimal('6.00'))

    def test_saida_com_data_passada_gera_pedido_automatico_por_cobertura(self):
        self.tipo_item.dias_cobertura = 60
        self.tipo_item.save()
        self.item.quantidade_atual = Decimal('6.00')
        self.item.quantidade_minima = Decimal('5.00')
        self.item.save()
        data_movimentacao = timezone.localdate() - timedelta(days=10)
        registro_entrada = RegistroEntrada.objects.create(
            recebido_por='Maria',
            data_movimentacao=timezone.localdate() - timedelta(days=20),
        )
        RegistroEntradaItem.objects.create(
            registro_entrada=registro_entrada,
            item=self.item,
            quantidade=Decimal('100.00'),
            quantidade_disponivel=Decimal('100.00'),
        )

        response = self.client.post(
            '/api/controle/registro-saida/',
            {
                **self._payload_saida('9101', '2.00'),
                'data_movimentacao': str(data_movimentacao),
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data_movimentacao'], str(data_movimentacao))

        evento = EventoEstoqueBaixo.objects.get(item=self.item)
        pedido_item = PedidoItem.objects.get(item=self.item, adicionado_automaticamente=True)

        self.assertEqual(evento.data_evento, data_movimentacao)
        self.assertEqual(pedido_item.quantidade_pedida, Decimal('7.00'))
        self.assertEqual(pedido_item.metrica_reposicao['dias_analisados'], 20)

    def test_entrada_de_epi_salva_ca_no_lote(self):
        response = self.client.post(
            '/api/controle/registro-entrada/',
            self._payload_entrada_epi('10.00', 'ca-12345'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        entrada_item = RegistroEntradaItem.objects.get(item=self.item_epi)
        self.assertEqual(entrada_item.ca, 'CA-12345')
        self.assertEqual(entrada_item.quantidade_disponivel, Decimal('10.00'))

    def test_saida_de_epi_busca_ca_disponivel_da_entrada(self):
        self.client.post(
            '/api/controle/registro-entrada/',
            self._payload_entrada_epi('10.00', 'ca-12345'),
            format='json',
        )

        response = self.client.post(
            '/api/controle/registro-saida/',
            self._payload_saida_epi('9201', '2.00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        saida_item = RegistroSaidaItem.objects.get(item=self.item_epi)
        lote_saida = RegistroSaidaItemLote.objects.get(registro_saida_item=saida_item)
        entrada_item = RegistroEntradaItem.objects.get(item=self.item_epi)

        self.assertEqual(saida_item.patrimonio, 'CA-12345')
        self.assertEqual(lote_saida.ca, 'CA-12345')
        self.assertEqual(lote_saida.quantidade, Decimal('2.00'))
        self.assertEqual(entrada_item.quantidade_disponivel, Decimal('8.00'))

    def _payload_saida(self, bloco, quantidade):
        return {
            'bloco_requisicao': bloco,
            'setor': 'Manutencao',
            'responsavel': 'Carlos',
            'observacao': 'Teste automatizado',
            'itens': [
                {
                    'item': self.item.id,
                    'quantidade': quantidade,
                    'solicitante': 'Joao',
                    'patrimonio': '',
                }
            ],
        }

    def _payload_entrada(self, quantidade):
        return {
            'nota_fiscal': None,
            'recebido_por': 'Maria',
            'observacao': 'Teste automatizado',
            'itens': [
                {
                    'item': self.item.id,
                    'quantidade': quantidade,
                }
            ],
        }

    def _payload_entrada_epi(self, quantidade, ca):
        return {
            'nota_fiscal': None,
            'recebido_por': 'Maria',
            'observacao': 'Teste automatizado EPI',
            'itens': [
                {
                    'item': self.item_epi.id,
                    'quantidade': quantidade,
                    'ca': ca,
                }
            ],
        }

    def _payload_saida_epi(self, bloco, quantidade):
        return {
            'bloco_requisicao': bloco,
            'setor': 'Manutencao',
            'responsavel': 'Carlos',
            'observacao': 'Teste automatizado EPI',
            'itens': [
                {
                    'item': self.item_epi.id,
                    'quantidade': quantidade,
                    'solicitante': 'Joao',
                    'patrimonio': '',
                }
            ],
        }
