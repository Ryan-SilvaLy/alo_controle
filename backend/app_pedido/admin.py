from django.contrib import admin
from .models import Pedido, PedidoItem


class PedidoItemInline(admin.TabularInline):  # Ou StackedInline se preferir
    model = PedidoItem
    extra = 0
    readonly_fields = ('quantidade_atual_estoque', 'ultima_entrada_estoque')
    autocomplete_fields = ('item',)


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = (
        'codigo_pedido',
        'solicitante',
        'setor_destino',
        'responsavel_setor',
        'status',
        'criado_em',
        'atualizado_em',
    )
    list_filter = ('status', 'setor_destino', 'criado_em')
    search_fields = ('codigo_pedido', 'solicitante', 'setor_destino', 'responsavel_setor')
    readonly_fields = ('criado_em', 'atualizado_em')
    inlines = [PedidoItemInline]
    ordering = ['-criado_em']


@admin.register(PedidoItem)
class PedidoItemAdmin(admin.ModelAdmin):
    list_display = (
        'pedido',
        'item',
        'quantidade_pedida',
        'quantidade_atual_estoque',
        'ultima_entrada_estoque',
    )
    list_filter = ('item',)
    search_fields = ('pedido__codigo_pedido', 'item__nome', 'item__codigo')
    autocomplete_fields = ('pedido', 'item')
