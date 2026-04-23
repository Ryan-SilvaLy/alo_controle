from rest_framework import serializers

from app_assinatura_epi.models import (
    AssinaturaEpiCompetencia,
    AssinaturaEpiLancamento,
    AssinaturaEpiRelatorio,
    AssinaturaEpiRelatorioItem,
)


class AssinaturaEpiLancamentoSerializer(serializers.ModelSerializer):
    status_lancamento = serializers.SerializerMethodField()
    competencia_label = serializers.SerializerMethodField()

    class Meta:
        model = AssinaturaEpiLancamento
        fields = [
            'id',
            'competencia',
            'competencia_label',
            'movimentacao_saida',
            'movimentacao_saida_item',
            'movimentacao_saida_id_original',
            'movimentacao_saida_item_id_original',
            'item',
            'item_id_original',
            'nome_item_snapshot',
            'grupo_item_snapshot',
            'quantidade',
            'data_saida',
            'numero_bloco_requisicao',
            'setor_nome_snapshot',
            'responsavel_nome_snapshot',
            'solicitante_nome_snapshot',
            'patrimonio_snapshot',
            'foi_impresso',
            'impresso_em',
            'ativo',
            'cancelado_em',
            'cancelado_motivo',
            'status_lancamento',
        ]

    def get_status_lancamento(self, obj):
        if not obj.ativo:
            return 'cancelado'
        return 'impresso' if obj.foi_impresso else 'pendente_impressao'

    def get_competencia_label(self, obj):
        return f'{obj.competencia.mes_referencia:02d}/{obj.competencia.ano_referencia}'


class AssinaturaEpiRelatorioItemSerializer(serializers.ModelSerializer):
    lancamento = AssinaturaEpiLancamentoSerializer(read_only=True)

    class Meta:
        model = AssinaturaEpiRelatorioItem
        fields = ['id', 'lancamento']


class AssinaturaEpiRelatorioSerializer(serializers.ModelSerializer):
    itens = serializers.SerializerMethodField()
    quantidade_itens = serializers.SerializerMethodField()
    gerado_por_nome = serializers.CharField(source='gerado_por.nome', read_only=True)
    assinado_por_nome = serializers.CharField(source='assinado_por.nome', read_only=True)
    competencia_label = serializers.SerializerMethodField()

    class Meta:
        model = AssinaturaEpiRelatorio
        fields = [
            'id',
            'competencia',
            'competencia_label',
            'solicitante_nome',
            'mes_referencia',
            'ano_referencia',
            'sequencia_relatorio',
            'status_assinatura',
            'gerado_em',
            'gerado_por',
            'gerado_por_nome',
            'assinado_em',
            'assinado_por',
            'assinado_por_nome',
            'quantidade_itens',
            'itens',
        ]

    def get_itens(self, obj):
        itens = obj.itens_relatorio.select_related('lancamento__competencia').all()
        return AssinaturaEpiRelatorioItemSerializer(itens, many=True).data

    def get_quantidade_itens(self, obj):
        return obj.itens_relatorio.count()

    def get_competencia_label(self, obj):
        return f'{obj.mes_referencia:02d}/{obj.ano_referencia}'


class AssinaturaEpiCompetenciaListSerializer(serializers.ModelSerializer):
    pendentes_impressao = serializers.SerializerMethodField()
    relatorios_gerados = serializers.SerializerMethodField()
    status_assinatura = serializers.SerializerMethodField()
    competencia_label = serializers.SerializerMethodField()

    class Meta:
        model = AssinaturaEpiCompetencia
        fields = [
            'id',
            'solicitante_nome',
            'mes_referencia',
            'ano_referencia',
            'competencia_label',
            'status',
            'pendentes_impressao',
            'relatorios_gerados',
            'status_assinatura',
        ]

    def get_pendentes_impressao(self, obj):
        return obj.lancamentos.filter(ativo=True, foi_impresso=False).count()

    def get_relatorios_gerados(self, obj):
        return obj.relatorios.count()

    def get_status_assinatura(self, obj):
        if obj.relatorios.filter(status_assinatura='pendente_assinatura').exists():
            return 'pendente_assinatura'
        if obj.relatorios.exists():
            return 'assinado'
        return 'sem_relatorio'

    def get_competencia_label(self, obj):
        return f'{obj.mes_referencia:02d}/{obj.ano_referencia}'


class AssinaturaEpiCompetenciaDetailSerializer(AssinaturaEpiCompetenciaListSerializer):
    lancamentos = serializers.SerializerMethodField()
    relatorios = serializers.SerializerMethodField()

    class Meta(AssinaturaEpiCompetenciaListSerializer.Meta):
        fields = AssinaturaEpiCompetenciaListSerializer.Meta.fields + [
            'lancamentos',
            'relatorios',
        ]

    def get_lancamentos(self, obj):
        lancamentos = obj.lancamentos.select_related('competencia').order_by('-data_saida', '-id')
        return AssinaturaEpiLancamentoSerializer(lancamentos, many=True).data

    def get_relatorios(self, obj):
        relatorios = obj.relatorios.all()
        return AssinaturaEpiRelatorioSerializer(relatorios, many=True).data
