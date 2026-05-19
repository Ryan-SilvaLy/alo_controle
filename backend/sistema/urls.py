from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('auth.urls')),  # Rota de autenticação
    path('api/assinaturas-epi/', include('app_assinatura_epi.apis.urls')),
    path('api/item/', include('app_item.apis.urls')),
    path('api/usuario/', include('app_usuario.apis.urls')),
    path('api/pedido/', include('app_pedido.apis.urls')),
    path('api/controle/', include('app_controle.apis.urls')),
    path('api/produto/', include('app_produto.apis.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
