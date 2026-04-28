from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app_item.models import Item, TipoItem
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
