from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),  # Rota para obter o token
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),  # Rota para atualizar o token
]

'''
    Rotas para token
    - http://127.0.0.1:8000/api/auth/token/ - POST
        - body credencias usuario:
            {
                "username": "username",
                "password": "senha"
            }
                
    - http://127.0.0.1:8000/api/auth/token/refresh/ - POST
        - body refresh gerado no endpoint `api/auth/token`:
            {
                "refresh": "refresh_gerado_aqui"
            }

    - No insomnia por exemplo, adicionar o valor gerado da chave `access` no `Auth` -> `Barear Token` -> Campo `Token`.
'''