# urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from app_controle.apis.rest_views import NotaFiscalViewSet, RegistroEntradaViewSet, RegistroEntradaItemViewSet, RegistroSaidaViewSet, RegistroSaidaItemViewSet, RegistroMovimentacaoEstoqueView


router = DefaultRouter()
router.register(r'nota-fiscal', NotaFiscalViewSet, basename='nota-fiscal')
router.register(r'registro-entrada', RegistroEntradaViewSet, basename='registro-entrada')
router.register(r'entrada-item', RegistroEntradaItemViewSet, basename='registro-entrada-item') 
router.register(r'registro-saida', RegistroSaidaViewSet, basename='registro-saida')
router.register(r'saida-item', RegistroSaidaItemViewSet, basename='registro-saida-item') 
router.register(r'movimentacoes/estoque', RegistroMovimentacaoEstoqueView, basename='movimentacoes')


urlpatterns = [
    path('', include(router.urls)),
]

'''
Este módulo registra as rotas automáticas da API utilizando Django REST Framework e o DefaultRouter.

Para cada ViewSet registrado, são geradas automaticamente as seguintes rotas padrão:

GET     /<endpoint>/           → Lista todos os registros
POST    /<endpoint>/           → Cria um novo registro
GET     /<endpoint>/{id}/      → Recupera um registro específico pelo ID
PUT     /<endpoint>/{id}/      → Atualiza completamente um registro específico
PATCH   /<endpoint>/{id}/      → Atualiza parcialmente um registro específico
DELETE  /<endpoint>/{id}/      → Deleta um registro específico

Endpoints registrados neste módulo:

- /nota-fiscal/            → Operações relacionadas às notas fiscais
- /registro-entrada/       → Operações relacionadas aos registros de entrada de estoque
- /entrada-item/           → Operações relacionadas aos itens incluídos nos registros de entrada

Essas rotas são expostas automaticamente conforme os ViewSets definidos em `rest_views.py`.

Exemplo de uso com o endpoint `nota-fiscal`:
- GET /nota-fiscal/        → lista todas as notas fiscais
- POST /nota-fiscal/       → cria uma nova nota fiscal
- GET /nota-fiscal/1/      → busca a nota fiscal de ID 1
- PUT /nota-fiscal/1/      → atualiza a nota fiscal de ID 1
- DELETE /nota-fiscal/1/   → deleta a nota fiscal de ID 1


Nota Fiscal:

Criar nota fiscal - POST:
    Body: 
        {
            "numero_nota": "123456",
            "nome_fornecedor": "Fornecedor XPTO",
            "cnpj_cpf": "12345678000190"
        }

            
'''