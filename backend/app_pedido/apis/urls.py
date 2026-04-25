from django.urls import path
from .rest_views import (
    CriarPedidoAPI,
    ListarPedidosAPI,
    AtualizarStatusPedidoAPIView,
    AtualizarStatusComprasPedidoAPIView,
    AtualizarPedidoAPIView,
    BuscarPedidoPorIdAPI,
)


urlpatterns = [
    path('criar/', CriarPedidoAPI.as_view(), name='api_criar_pedido_com_itens'), 
    path('listar/', ListarPedidosAPI.as_view(), name='api_listar_pedidos'), 
    path('atualizar-status/<int:pk>/', AtualizarStatusPedidoAPIView.as_view(), name='atualizar-status-pedido'),
    path('atualizar-status-compras/<int:pk>/', AtualizarStatusComprasPedidoAPIView.as_view(), name='atualizar-status-compras-pedido'),
    path('atualizar/<int:pk>/', AtualizarPedidoAPIView.as_view(), name='api-atualizar-pedido'),
    path('buscar/<int:pk>/', BuscarPedidoPorIdAPI.as_view(), name='api-buscar-pedido'),
    ]

'''
Endpoints APIs
- http://127.0.0.1:8000/api/pedido/criar/ - POST
- http://127.0.0.1:8000/api/pedido/listar/ - GET
- http://127.0.0.1:8000/api/pedido/atualizar-status/<int:pk>/ - PATCH
    Body:
    {
        "status": "aceito"
    }
    ou
    {
        "status": "recusado",
        "motivo_recusado": "Item indisponível no estoque."
    }

'''
