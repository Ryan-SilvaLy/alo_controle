from django.contrib import admin

from .models import EventoEstoqueBaixo, Item, TipoItem


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'codigo',
        'nome',
        'codigo_barras',
        'tipo_item',
        'prateleira_estoque',
        'quantidade_atual',
        'quantidade_minima',
        'situacao',
        'criado_em',
        'atualizado_em',
    )
    list_filter = (
        'situacao',
        'tipo_item',
        'prateleira_estoque',
        'criado_em',
    )
    search_fields = (
        'codigo',
        'nome',
        'codigo_barras',
        'descricao',
        'tipo_item',
        'prateleira_estoque',
    )
    readonly_fields = (
        'criado_em',
        'atualizado_em',
    )
    ordering = ['nome']


@admin.register(TipoItem)
class TipoItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'nome', 'dias_cobertura', 'criado_em', 'atualizado_em')
    search_fields = ('nome',)
    list_filter = ('criado_em', 'atualizado_em')
    ordering = ('nome',)
    readonly_fields = ('criado_em', 'atualizado_em')

    fieldsets = (
        ('Informacoes do Tipo de Item', {
            'fields': ('nome', 'dias_cobertura')
        }),
        ('Controle de Registro', {
            'fields': ('criado_em', 'atualizado_em'),
            'classes': ('collapse',),
        }),
    )


@admin.register(EventoEstoqueBaixo)
class EventoEstoqueBaixoAdmin(admin.ModelAdmin):
    list_display = ('id', 'item', 'data_evento', 'estoque_atual', 'estoque_minimo', 'criado_em')
    list_filter = ('data_evento', 'criado_em')
    search_fields = ('item__codigo', 'item__nome')
    readonly_fields = ('item', 'data_evento', 'estoque_atual', 'estoque_minimo', 'criado_em')
    ordering = ('-data_evento', '-id')
