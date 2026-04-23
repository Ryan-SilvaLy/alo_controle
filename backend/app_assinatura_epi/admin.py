from django.contrib import admin

from app_assinatura_epi.models import (
    AssinaturaEpiCompetencia,
    AssinaturaEpiLancamento,
    AssinaturaEpiRelatorio,
    AssinaturaEpiRelatorioItem,
)


@admin.register(AssinaturaEpiCompetencia)
class AssinaturaEpiCompetenciaAdmin(admin.ModelAdmin):
    list_display = ('solicitante_nome', 'mes_referencia', 'ano_referencia', 'status')
    search_fields = ('solicitante_nome',)
    list_filter = ('status', 'ano_referencia', 'mes_referencia')


@admin.register(AssinaturaEpiLancamento)
class AssinaturaEpiLancamentoAdmin(admin.ModelAdmin):
    list_display = (
        'nome_item_snapshot',
        'solicitante_nome_snapshot',
        'numero_bloco_requisicao',
        'foi_impresso',
        'ativo',
    )
    search_fields = (
        'nome_item_snapshot',
        'solicitante_nome_snapshot',
        'numero_bloco_requisicao',
    )
    list_filter = ('foi_impresso', 'ativo', 'grupo_item_snapshot')


@admin.register(AssinaturaEpiRelatorio)
class AssinaturaEpiRelatorioAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'solicitante_nome',
        'mes_referencia',
        'ano_referencia',
        'sequencia_relatorio',
        'status_assinatura',
    )
    search_fields = ('solicitante_nome',)
    list_filter = ('status_assinatura', 'ano_referencia', 'mes_referencia')


@admin.register(AssinaturaEpiRelatorioItem)
class AssinaturaEpiRelatorioItemAdmin(admin.ModelAdmin):
    list_display = ('relatorio', 'lancamento')
