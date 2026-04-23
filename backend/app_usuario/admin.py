from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, Log


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    # Campos exibidos na listagem do admin
    list_display = ('username', 'nome', 'cargo', 'setor', 'nivel_permissao', 'is_staff', 'is_active')
    list_filter = ('nivel_permissao', 'is_staff', 'is_active')
    search_fields = ('username', 'nome', 'cargo', 'setor')
    ordering = ('username',)

    # Campos do formulário de edição/criação
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Informações Pessoais', {'fields': ('nome', 'cargo', 'setor')}),
        ('Permissões', {'fields': ('nivel_permissao', 'is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions')}),
        ('Datas Importantes', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'nome', 'cargo', 'setor', 'nivel_permissao', 'password1', 'password2', 'is_staff', 'is_active')}
        ),
    )

@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    # Campos que aparecem na lista
    list_display = ('usuario', 'acao', 'criado_em', 'atualizado_em')
    # Campos que podem ser usados como filtro lateral
    list_filter = ('usuario', 'criado_em', 'atualizado_em')
    # Campo de busca
    search_fields = ('usuario__username', 'acao')
    # Ordenação padrão
    ordering = ('-criado_em',)
    # Campos somente leitura
    readonly_fields = ('criado_em', 'atualizado_em')

    # Opcional: limitar campos editáveis no admin
    def has_add_permission(self, request, obj=None):
        # Não permite adicionar logs manualmente via admin
        return False

    def has_delete_permission(self, request, obj=None):
        # Opcional: se quiser permitir deletar logs, deixe True
        return True