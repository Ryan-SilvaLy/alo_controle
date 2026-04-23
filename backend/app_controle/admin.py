from django.contrib import admin
from app_controle.models import RegistroEntrada, RegistroEntradaItem, RegistroSaida, RegistroSaidaItem, NotaFiscal


# Inline para exibir os itens relacionados no admin do RegistroEntrada
class RegistroEntradaItemInline(admin.TabularInline):
    model = RegistroEntradaItem
    extra = 1  # Número de linhas extras para adicionar novos itens
    autocomplete_fields = ['item']  # Caso tenha muitos itens, para facilitar busca
    readonly_fields = ['criado_em']

# Inline para exibir os itens relacionados no admin do RegistroSaida
class RegistroSaidaItemInline(admin.TabularInline):
    model = RegistroSaidaItem
    extra = 1
    autocomplete_fields = ['item']
    readonly_fields = []

@admin.register(NotaFiscal)
class NotaFiscalAdmin(admin.ModelAdmin):
    list_display = ['numero_nota', 'nome_fornecedor', 'cnpj_cpf', 'criado_em', 'atualizado_em']
    search_fields = ['numero_nota', 'nome_fornecedor', 'cnpj_cpf']
    ordering = ['-criado_em']
    readonly_fields = ['criado_em', 'atualizado_em']

@admin.register(RegistroEntrada)
class RegistroEntradaAdmin(admin.ModelAdmin):
    list_display = ['id', 'nota_fiscal', 'recebido_por', 'registrado_por', 'alterado_por', 'data_entrada', 'criado_em', 'atualizado_em']
    search_fields = ['nota_fiscal__numero_nota', 'recebido_por', 'registrado_por__username']
    list_filter = ['data_entrada', 'registrado_por']
    readonly_fields = ['data_entrada', 'criado_em', 'atualizado_em']
    inlines = [RegistroEntradaItemInline]

@admin.register(RegistroEntradaItem)
class RegistroEntradaItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'registro_entrada', 'item', 'quantidade', 'criado_em']
    search_fields = ['registro_entrada__id', 'item__nome']
    readonly_fields = ['criado_em']

@admin.register(RegistroSaida)
class RegistroSaidaAdmin(admin.ModelAdmin):
    list_display = ['id', 'bloco_requisicao', 'setor', 'responsavel', 'registrado_por', 'alterado_por', 'data_saida', 'criado_em', 'atualizado_em']
    search_fields = ['bloco_requisicao', 'setor', 'responsavel', 'registrado_por__username']
    list_filter = ['data_saida', 'registrado_por']
    readonly_fields = ['data_saida', 'criado_em', 'atualizado_em']
    inlines = [RegistroSaidaItemInline]

@admin.register(RegistroSaidaItem)
class RegistroSaidaItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'registro_saida', 'item', 'quantidade']
    search_fields = ['registro_saida__id', 'item__nome']
