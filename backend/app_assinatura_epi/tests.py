from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from app_assinatura_epi.models import (
    AssinaturaEpiCompetencia,
    AssinaturaEpiLancamento,
    AssinaturaEpiRelatorio,
)
from app_item.models import Item, TipoItem
from app_usuario.models import Usuario


class AssinaturaEpiFlowTests(APITestCase):
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

        self.tipo_epi = TipoItem.objects.create(nome='EPI')
        self.tipo_consumo = TipoItem.objects.create(nome='CONSUMO')

        self.item_epi = self._criar_item(
            codigo='EPI-001',
            nome='Luva de Protecao',
            tipo=self.tipo_epi,
            quantidade=Decimal('30.00'),
        )
        self.item_nao_epi = self._criar_item(
            codigo='MAT-001',
            nome='Caneta Azul',
            tipo=self.tipo_consumo,
            quantidade=Decimal('50.00'),
        )

    def test_cria_lancamento_apenas_para_item_do_tipo_epi(self):
        payload = self._payload_saida(
            bloco='101',
            itens=[
                self._item_saida_payload(self.item_epi.id, '2.00', 'Joao Silva'),
                self._item_saida_payload(self.item_nao_epi.id, '1.00', 'Joao Silva'),
            ],
        )

        response = self.client.post('/api/controle/registro-saida/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AssinaturaEpiCompetencia.objects.count(), 1)
        self.assertEqual(AssinaturaEpiLancamento.objects.count(), 1)

        lancamento = AssinaturaEpiLancamento.objects.get()
        self.assertEqual(lancamento.nome_item_snapshot, 'LUVA DE PROTECAO')
        self.assertEqual(lancamento.solicitante_nome_snapshot, 'JOAO SILVA')
        self.assertFalse(lancamento.foi_impresso)
        self.assertTrue(lancamento.ativo)

    def test_gerar_relatorio_imprime_apenas_pendentes_e_novos_itens_vao_para_proximo(self):
        response_1 = self.client.post(
            '/api/controle/registro-saida/',
            self._payload_saida(
                bloco='201',
                itens=[self._item_saida_payload(self.item_epi.id, '1.00', 'Joao Silva')],
            ),
            format='json',
        )
        self.assertEqual(response_1.status_code, status.HTTP_201_CREATED)

        competencia = AssinaturaEpiCompetencia.objects.get()
        relatorio_1 = self.client.post(
            f'/api/assinaturas-epi/competencias/{competencia.id}/gerar-relatorio/',
            {},
            format='json',
        )

        self.assertEqual(relatorio_1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(relatorio_1.data['quantidade_itens'], 1)

        lancamento_antigo = AssinaturaEpiLancamento.objects.get()
        lancamento_antigo.refresh_from_db()
        self.assertTrue(lancamento_antigo.foi_impresso)

        response_2 = self.client.post(
            '/api/controle/registro-saida/',
            self._payload_saida(
                bloco='202',
                itens=[self._item_saida_payload(self.item_epi.id, '3.00', 'Joao Silva')],
            ),
            format='json',
        )
        self.assertEqual(response_2.status_code, status.HTTP_201_CREATED)

        relatorio_2 = self.client.post(
            f'/api/assinaturas-epi/competencias/{competencia.id}/gerar-relatorio/',
            {},
            format='json',
        )

        self.assertEqual(relatorio_2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(relatorio_2.data['quantidade_itens'], 1)
        self.assertEqual(relatorio_2.data['sequencia_relatorio'], 2)

        relatorio_primeiro = AssinaturaEpiRelatorio.objects.get(sequencia_relatorio=1)
        relatorio_segundo = AssinaturaEpiRelatorio.objects.get(sequencia_relatorio=2)

        self.assertEqual(relatorio_primeiro.itens_relatorio.count(), 1)
        self.assertEqual(relatorio_segundo.itens_relatorio.count(), 1)
        self.assertNotEqual(
            relatorio_primeiro.itens_relatorio.first().lancamento_id,
            relatorio_segundo.itens_relatorio.first().lancamento_id,
        )

    def test_edicao_antes_da_impressao_atualiza_lancamento_existente(self):
        response = self.client.post(
            '/api/controle/registro-saida/',
            self._payload_saida(
                bloco='301',
                itens=[self._item_saida_payload(self.item_epi.id, '2.00', 'Joao Silva')],
            ),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        saida_id = response.data['id']
        AssinaturaEpiLancamento.objects.get()

        response_update = self.client.put(
            f'/api/controle/registro-saida/{saida_id}/',
            self._payload_saida(
                bloco='301',
                itens=[self._item_saida_payload(self.item_epi.id, '4.00', 'Maria Souza')],
            ),
            format='json',
        )

        self.assertEqual(response_update.status_code, status.HTTP_200_OK)
        self.assertEqual(AssinaturaEpiLancamento.objects.count(), 1)

        lancamento_atualizado = AssinaturaEpiLancamento.objects.get()
        self.assertEqual(lancamento_atualizado.quantidade, Decimal('4.00'))
        self.assertEqual(lancamento_atualizado.solicitante_nome_snapshot, 'MARIA SOUZA')
        self.assertEqual(lancamento_atualizado.numero_bloco_requisicao, '301')
        self.assertFalse(lancamento_atualizado.foi_impresso)

    def test_saida_impressa_editada_vira_historico_cancelado_e_nova_retirada_gera_novo_lancamento(self):
        response = self.client.post(
            '/api/controle/registro-saida/',
            self._payload_saida(
                bloco='401',
                itens=[self._item_saida_payload(self.item_epi.id, '1.00', 'Joao Silva')],
            ),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        saida_id = response.data['id']
        competencia = AssinaturaEpiCompetencia.objects.get()

        self.client.post(
            f'/api/assinaturas-epi/competencias/{competencia.id}/gerar-relatorio/',
            {},
            format='json',
        )

        response_update = self.client.put(
            f'/api/controle/registro-saida/{saida_id}/',
            self._payload_saida(
                bloco='401',
                itens=[self._item_saida_payload(self.item_epi.id, '2.00', 'Joao Silva')],
            ),
            format='json',
        )

        self.assertEqual(response_update.status_code, status.HTTP_200_OK)
        self.assertEqual(AssinaturaEpiLancamento.objects.count(), 2)

        cancelado = AssinaturaEpiLancamento.objects.filter(ativo=False).get()
        novo = AssinaturaEpiLancamento.objects.filter(ativo=True).get()

        self.assertTrue(cancelado.foi_impresso)
        self.assertIn('apos a impressao', cancelado.cancelado_motivo)
        self.assertFalse(novo.foi_impresso)
        self.assertEqual(novo.quantidade, Decimal('2.00'))

    def test_exclusao_de_saida_impressa_preserva_historico_cancelado(self):
        response = self.client.post(
            '/api/controle/registro-saida/',
            self._payload_saida(
                bloco='501',
                itens=[self._item_saida_payload(self.item_epi.id, '1.00', 'Joao Silva')],
            ),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        saida_id = response.data['id']
        competencia = AssinaturaEpiCompetencia.objects.get()

        relatorio_response = self.client.post(
            f'/api/assinaturas-epi/competencias/{competencia.id}/gerar-relatorio/',
            {},
            format='json',
        )
        self.assertEqual(relatorio_response.status_code, status.HTTP_201_CREATED)

        delete_response = self.client.delete(f'/api/controle/registro-saida/{saida_id}/')

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(AssinaturaEpiLancamento.objects.count(), 1)

        lancamento = AssinaturaEpiLancamento.objects.get()
        self.assertFalse(lancamento.ativo)
        self.assertTrue(lancamento.foi_impresso)
        self.assertIn('excluida', lancamento.cancelado_motivo)

    def _criar_item(self, codigo, nome, tipo, quantidade):
        return Item.objects.create(
            codigo=codigo,
            nome=nome,
            descricao='Item de teste',
            tipo_item=tipo,
            prateleira_estoque='A1',
            quantidade_atual=quantidade,
            quantidade_minima=Decimal('2.00'),
            unidade_medida='un',
        )

    def _payload_saida(self, bloco, itens):
        return {
            'bloco_requisicao': bloco,
            'setor': 'Manutencao',
            'responsavel': 'Carlos',
            'observacao': 'Teste automatizado',
            'itens': itens,
        }

    def _item_saida_payload(self, item_id, quantidade, solicitante):
        return {
            'item': item_id,
            'quantidade': quantidade,
            'solicitante': solicitante,
            'patrimonio': '',
        }
