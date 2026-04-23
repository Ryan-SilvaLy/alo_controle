from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers

from app_assinatura_epi.models import (
    AssinaturaEpiCompetencia,
    AssinaturaEpiLancamento,
    AssinaturaEpiRelatorio,
    AssinaturaEpiRelatorioItem,
)


class AssinaturaEpiService:
    @classmethod
    def processar_saida(cls, registro_saida):
        itens_saida = list(
            registro_saida.itens.select_related('item__tipo_item').all()
        )
        lancamentos_ativos = list(
            AssinaturaEpiLancamento.objects.filter(
                movimentacao_saida=registro_saida,
                ativo=True,
            ).select_related('competencia', 'item')
        )

        desejados = {}
        for saida_item in itens_saida:
            if not cls._item_eh_epi(saida_item.item):
                continue

            solicitante = cls._normalizar_texto(saida_item.solicitante)
            if not solicitante:
                continue

            competencia = cls._obter_ou_criar_competencia(solicitante, registro_saida.data_saida)
            payload = cls._montar_payload_lancamento(saida_item, competencia)
            desejados[payload['fingerprint']] = payload

        competencias_afetadas = {l.competencia_id for l in lancamentos_ativos}
        fingerprints_processados = set()

        for lancamento in lancamentos_ativos:
            fingerprint = cls._fingerprint_lancamento(lancamento)
            payload = desejados.get(fingerprint)

            if payload:
                fingerprints_processados.add(fingerprint)
                if not lancamento.foi_impresso:
                    cls._atualizar_lancamento_nao_impresso(lancamento, payload)
                competencias_afetadas.add(payload['competencia'].id)
                continue

            if lancamento.foi_impresso:
                cls._cancelar_lancamento(
                    lancamento,
                    'Saida alterada apos a impressao do relatorio.',
                )
            else:
                competencias_afetadas.add(lancamento.competencia_id)
                lancamento.delete()

        for fingerprint, payload in desejados.items():
            if fingerprint in fingerprints_processados:
                continue

            lancamento = AssinaturaEpiLancamento.objects.create(**payload['data'])
            competencias_afetadas.add(lancamento.competencia_id)

        cls._atualizar_competencias_por_ids(competencias_afetadas)

    @classmethod
    def remover_saida(cls, registro_saida):
        lancamentos = list(
            AssinaturaEpiLancamento.objects.filter(
                movimentacao_saida=registro_saida,
                ativo=True,
            ).select_related('competencia')
        )
        competencias_afetadas = {l.competencia_id for l in lancamentos}

        for lancamento in lancamentos:
            if lancamento.foi_impresso:
                cls._cancelar_lancamento(
                    lancamento,
                    'Saida original excluida apos a impressao do relatorio.',
                )
            else:
                lancamento.delete()

        cls._atualizar_competencias_por_ids(competencias_afetadas)

    @classmethod
    @transaction.atomic
    def gerar_relatorio(cls, competencia, usuario):
        lancamentos = list(
            competencia.lancamentos.filter(ativo=True, foi_impresso=False).order_by('data_saida', 'id')
        )
        if not lancamentos:
            raise serializers.ValidationError(
                'Nao existem lancamentos pendentes de impressao para esta competencia.'
            )

        ultima_sequencia = (
            competencia.relatorios.aggregate(ultima=Max('sequencia_relatorio')).get('ultima') or 0
        )

        relatorio = AssinaturaEpiRelatorio.objects.create(
            competencia=competencia,
            solicitante_nome=competencia.solicitante_nome,
            mes_referencia=competencia.mes_referencia,
            ano_referencia=competencia.ano_referencia,
            sequencia_relatorio=ultima_sequencia + 1,
            gerado_por=usuario,
        )

        agora = timezone.now()
        relatorio_items = []
        lancamentos_ids = []

        for lancamento in lancamentos:
            relatorio_items.append(
                AssinaturaEpiRelatorioItem(relatorio=relatorio, lancamento=lancamento)
            )
            lancamentos_ids.append(lancamento.id)

        AssinaturaEpiRelatorioItem.objects.bulk_create(relatorio_items)
        AssinaturaEpiLancamento.objects.filter(id__in=lancamentos_ids).update(
            foi_impresso=True,
            impresso_em=agora,
            atualizado_em=agora,
        )

        cls._atualizar_status_competencia(competencia)
        return relatorio

    @classmethod
    @transaction.atomic
    def marcar_relatorio_como_assinado(cls, relatorio, usuario):
        if relatorio.status_assinatura == 'assinado':
            return relatorio

        relatorio.status_assinatura = 'assinado'
        relatorio.assinado_em = timezone.now()
        relatorio.assinado_por = usuario
        relatorio.save(update_fields=['status_assinatura', 'assinado_em', 'assinado_por'])

        cls._atualizar_status_competencia(relatorio.competencia)
        return relatorio

    @classmethod
    def _item_eh_epi(cls, item):
        tipo_nome = getattr(getattr(item, 'tipo_item', None), 'nome', '')
        return cls._normalizar_texto(tipo_nome) == 'EPI'

    @classmethod
    def _obter_ou_criar_competencia(cls, solicitante_nome, data_saida):
        competencia, _ = AssinaturaEpiCompetencia.objects.get_or_create(
            solicitante_nome=solicitante_nome,
            mes_referencia=data_saida.month,
            ano_referencia=data_saida.year,
            defaults={'status': 'aberta'},
        )
        return competencia

    @classmethod
    def _montar_payload_lancamento(cls, saida_item, competencia):
        registro_saida = saida_item.registro_saida
        item = saida_item.item
        solicitante = cls._normalizar_texto(saida_item.solicitante)
        patrimonio = cls._normalizar_texto(saida_item.patrimonio)
        fingerprint = cls._fingerprint_partes(
            item_id=item.id,
            quantidade=saida_item.quantidade,
            solicitante=solicitante,
            patrimonio=patrimonio,
        )

        data = {
            'competencia': competencia,
            'movimentacao_saida': registro_saida,
            'movimentacao_saida_item': saida_item,
            'movimentacao_saida_id_original': registro_saida.id,
            'movimentacao_saida_item_id_original': saida_item.id,
            'item': item,
            'item_id_original': item.id,
            'nome_item_snapshot': item.nome,
            'grupo_item_snapshot': getattr(item.tipo_item, 'nome', ''),
            'quantidade': saida_item.quantidade,
            'data_saida': registro_saida.data_saida,
            'numero_bloco_requisicao': registro_saida.bloco_requisicao,
            'setor_nome_snapshot': registro_saida.setor,
            'responsavel_nome_snapshot': registro_saida.responsavel,
            'solicitante_nome_snapshot': solicitante,
            'patrimonio_snapshot': patrimonio or '',
            'foi_impresso': False,
            'ativo': True,
            'cancelado_em': None,
            'cancelado_motivo': '',
        }
        return {'fingerprint': fingerprint, 'data': data, 'competencia': competencia}

    @classmethod
    def _atualizar_lancamento_nao_impresso(cls, lancamento, payload):
        data = payload['data']
        for field_name, value in data.items():
            setattr(lancamento, field_name, value)
        lancamento.save()

    @classmethod
    def _cancelar_lancamento(cls, lancamento, motivo):
        if not lancamento.ativo:
            return
        lancamento.ativo = False
        lancamento.cancelado_em = timezone.now()
        lancamento.cancelado_motivo = motivo
        lancamento.movimentacao_saida = None
        lancamento.movimentacao_saida_item = None
        lancamento.save(
            update_fields=[
                'ativo',
                'cancelado_em',
                'cancelado_motivo',
                'movimentacao_saida',
                'movimentacao_saida_item',
            ]
        )

    @classmethod
    def _atualizar_competencias_por_ids(cls, competencias_ids):
        for competencia_id in filter(None, competencias_ids):
            try:
                competencia = AssinaturaEpiCompetencia.objects.get(id=competencia_id)
            except AssinaturaEpiCompetencia.DoesNotExist:
                continue
            cls._atualizar_status_competencia(competencia)

    @classmethod
    def _atualizar_status_competencia(cls, competencia):
        possui_pendentes = competencia.lancamentos.filter(ativo=True, foi_impresso=False).exists()
        possui_relatorio_pendente = competencia.relatorios.filter(
            status_assinatura='pendente_assinatura'
        ).exists()

        novo_status = 'aberta' if possui_pendentes or possui_relatorio_pendente else 'fechada'
        if competencia.status != novo_status:
            competencia.status = novo_status
            competencia.save(update_fields=['status'])

    @classmethod
    def _fingerprint_lancamento(cls, lancamento):
        item_id = lancamento.item_id_original or getattr(lancamento.item, 'id', '')
        return cls._fingerprint_partes(
            item_id=item_id,
            quantidade=lancamento.quantidade,
            solicitante=lancamento.solicitante_nome_snapshot,
            patrimonio=lancamento.patrimonio_snapshot,
        )

    @classmethod
    def _fingerprint_partes(cls, item_id, quantidade, solicitante, patrimonio):
        return f'{item_id}|{quantidade}|{cls._normalizar_texto(solicitante)}|{cls._normalizar_texto(patrimonio)}'

    @staticmethod
    def _normalizar_texto(valor):
        return (valor or '').strip().upper()
