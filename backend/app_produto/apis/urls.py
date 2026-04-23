# urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from app_produto.apis.rest_views import ProdutoViewSet


router = DefaultRouter()
router.register(r'', ProdutoViewSet, basename='produto')

urlpatterns = [ 
    path('', include(router.urls)), 
    ]

'''
Exemplo de body para criar produto via api.

    {
    "patrimonio": "12345asas",
    "nome": "Plano Corporativo",
    "nome_cliente": "Teste empresa",
    "tempo_contrato": "31/12/2025"
    }


'''