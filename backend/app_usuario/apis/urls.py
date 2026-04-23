from django.urls import path, include
from .rest_views import ListarUsuariosAPI, CriarUsuarioAPI, DeletarUsuarioAPI, BuscarUsuarioAPI, AtualizarUsuarioAPI, PegarUsuarioNaSessaoAPI, LogsViewSetAPI
from rest_framework.routers import DefaultRouter


router = DefaultRouter()
router.register(r'logs', LogsViewSetAPI, basename='logs')

urlpatterns = [
    path('', include(router.urls)),
    path('listar/', ListarUsuariosAPI.as_view(), name='api_listar_usuarios'), 
    path('criar/', CriarUsuarioAPI.as_view(), name='api_criar_usuario'), 
    path('deletar/<int:id>/', DeletarUsuarioAPI.as_view(), name='api_deletar_usuario'), 
    path('buscar/<int:id>/', BuscarUsuarioAPI.as_view(), name='api_buscar_usuario'),
    path('atualizar/<int:id>/', AtualizarUsuarioAPI.as_view(), name='api_atualizar_usuario'),
    path('pegar-usuario-logado/', PegarUsuarioNaSessaoAPI.as_view(), name='api_pegar_usuario_logado'),
]


'''
Endpoints APIs
- http://127.0.0.1:8000/api/usuario/listar/ - GET
- http://127.0.0.1:8000/api/usuario/criar/ - POST
    - body:
        {
        "username": "ventura",
        "password": "senhaSegura123",
        "nome": "João Victor Ventura",
        "cargo": "Desenvolvedor",
        "nivel_permissao": "administrador",
        "setor": "TI"
        }

- http://127.0.0.1:8000/api/usuario/deletar/usuario_id/ - DELETE
- http://127.0.0.1:8000/api/usuario/buscar/usuario_id/ - GET
- http://127.0.0.1:8000/api/usuario/atualizar/usuario_id/ - PUT

    - body:
        {
        "campo_atualizar": "Coordenador de TI"
        }


'''