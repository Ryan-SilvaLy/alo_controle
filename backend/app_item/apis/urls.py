from django.urls import path
from rest_framework import routers
from .rest_views import ListarItensAPI, CriarItemAPI, DeletarItemAPI, BuscarItemAPI, AtualizarItemAPI, TipoItemViewSet, AtualizarStatusItemAPI, ItensPorTipoEstoqueBaixoView

router = routers.DefaultRouter()
router.register(r'tipoItem', TipoItemViewSet, basename='tipoitem')

urlpatterns = [
    path('listar/', ListarItensAPI.as_view(), name='api_listar_itens'), 
    path('criar/', CriarItemAPI.as_view(), name='api_criar_item'), 
    path('deletar/<int:id>/', DeletarItemAPI.as_view(), name='api_deletar_item'), 
    path('buscar/<int:id>/', BuscarItemAPI.as_view(), name='api_buscar_item'),
    path('atualizar/<int:id>/', AtualizarItemAPI.as_view(), name='api_atualizar_item'),
    path('atualizar-status/<int:id>/', AtualizarStatusItemAPI.as_view(), name='api_atualizar_status_item'),
    path('por-tipo-baixo/', ItensPorTipoEstoqueBaixoView.as_view(), name='por-tipo-baixo'),
]

# Adiciona as rotas do ViewSet.
urlpatterns += router.urls


'''
Endpoints APIs
- http://127.0.0.1:8000/api/item/listar/ - GET
- http://127.0.0.1:8000/api/item/criar/ - POST
    body: 
        {
            "codigo": "ITM-001",
            "nome": "Cabo HDMI 2m",
            "descricao": "Cabo HDMI de 2 metros, ideal para conexões com TV e projetores.",
            "tipo_item": "Acessório",
            "prateleira_estoque": "A1",
            "quantidade_atual": 50,
            "quantidade_minima": 10
        }

- http://127.0.0.1:8000/api/item/deletar/item_id/ - DELETE
- http://127.0.0.1:8000/api/item/buscar/item_id/ - GET

'''