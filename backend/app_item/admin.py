from django.contrib import admin
from .models import Item, TipoItem

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
    list_display = ('id', 'nome', 'criado_em', 'atualizado_em')   # colunas visíveis
    search_fields = ('nome',)                                     # barra de busca
    list_filter = ('criado_em', 'atualizado_em')                  # filtros laterais
    ordering = ('nome',)                                          # ordenação padrão
    readonly_fields = ('criado_em', 'atualizado_em')              # só leitura no formulário

    fieldsets = (
        ('Informações do Tipo de Item', {
            'fields': ('nome',)
        }),
        ('Controle de Registro', {
            'fields': ('criado_em', 'atualizado_em'),
            'classes': ('collapse',),  # colapsável
        }),
    )