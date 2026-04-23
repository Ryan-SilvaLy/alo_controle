from django.urls import include, path
from rest_framework.routers import DefaultRouter

from app_assinatura_epi.apis.rest_views import (
    AssinaturaEpiCompetenciaViewSet,
    AssinaturaEpiRelatorioViewSet,
)


router = DefaultRouter()
router.register(r'competencias', AssinaturaEpiCompetenciaViewSet, basename='assinatura-epi-competencia')
router.register(r'relatorios', AssinaturaEpiRelatorioViewSet, basename='assinatura-epi-relatorio')


urlpatterns = [
    path('', include(router.urls)),
]
