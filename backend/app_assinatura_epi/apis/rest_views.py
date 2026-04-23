from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from app_assinatura_epi.apis.serializers import (
    AssinaturaEpiCompetenciaDetailSerializer,
    AssinaturaEpiCompetenciaListSerializer,
    AssinaturaEpiRelatorioSerializer,
)
from app_assinatura_epi.models import AssinaturaEpiCompetencia, AssinaturaEpiRelatorio
from app_assinatura_epi.services import AssinaturaEpiService
from app_usuario.services import registrar_log


class AssinaturaEpiCompetenciaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AssinaturaEpiCompetencia.objects.all().prefetch_related('lancamentos', 'relatorios')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AssinaturaEpiCompetenciaDetailSerializer
        return AssinaturaEpiCompetenciaListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        solicitante = self.request.query_params.get('solicitante')
        mes = self.request.query_params.get('mes')
        ano = self.request.query_params.get('ano')
        status_param = self.request.query_params.get('status')

        if solicitante:
            queryset = queryset.filter(solicitante_nome__icontains=solicitante.strip())
        if mes:
            queryset = queryset.filter(mes_referencia=mes)
        if ano:
            queryset = queryset.filter(ano_referencia=ano)
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    @action(detail=True, methods=['post'], url_path='gerar-relatorio')
    def gerar_relatorio(self, request, pk=None):
        competencia = self.get_object()
        relatorio = AssinaturaEpiService.gerar_relatorio(competencia, request.user)
        registrar_log(
            request.user,
            f'Relatorio de assinatura EPI #{relatorio.id} gerado para {competencia.solicitante_nome}.'
        )
        serializer = AssinaturaEpiRelatorioSerializer(relatorio)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AssinaturaEpiRelatorioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AssinaturaEpiRelatorio.objects.all().prefetch_related(
        'itens_relatorio__lancamento__competencia'
    )
    serializer_class = AssinaturaEpiRelatorioSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        competencia_id = self.request.query_params.get('competencia')
        status_assinatura = self.request.query_params.get('status_assinatura')

        if competencia_id:
            queryset = queryset.filter(competencia_id=competencia_id)
        if status_assinatura:
            queryset = queryset.filter(status_assinatura=status_assinatura)
        return queryset

    @action(detail=True, methods=['post'], url_path='marcar-assinado')
    def marcar_assinado(self, request, pk=None):
        relatorio = self.get_object()
        relatorio = AssinaturaEpiService.marcar_relatorio_como_assinado(relatorio, request.user)
        registrar_log(
            request.user,
            f'Relatorio de assinatura EPI #{relatorio.id} marcado como assinado.'
        )
        serializer = self.get_serializer(relatorio)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='imprimir')
    def imprimir(self, request, pk=None):
        relatorio = self.get_object()
        serializer = self.get_serializer(relatorio)
        return Response(serializer.data, status=status.HTTP_200_OK)
