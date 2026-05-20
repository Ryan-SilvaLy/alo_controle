from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from app_assinatura_epi.services import AssinaturaEpiService
from app_controle.models import NotaFiscal, RegistroEntrada, RegistroEntradaItem, RegistroSaida, RegistroSaidaItem
from app_controle.apis.serializers import (
    NotaFiscalSerializer,
    RegistroEntradaSerializer,
    RegistroEntradaItemSerializer,
    RegistroSaidaSerializer,
    RegistroSaidaItemSerializer,
)
from app_usuario.services import registrar_log


def _validar_senha_exclusao(request):
    senha = request.data.get('senha') or request.data.get('password')
    if not senha or not request.user.check_password(senha):
        return Response(
            {'detail': 'Senha incorreta. Exclusão não autorizada.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    return None


def _data_movimentacao(registro, campo_fallback):
    data = getattr(registro, 'data_movimentacao', None) or getattr(registro, campo_fallback, None)
    if hasattr(data, 'strftime'):
        return data.strftime('%d/%m/%Y')
    return str(data or '-')


def _resumo_itens_movimentacao(itens):
    partes = []
    for item_registro in itens:
        item = getattr(item_registro, 'item', None)
        nome_item = getattr(item, 'nome', 'Item desconhecido')
        ca = getattr(item_registro, 'ca', None) or getattr(item_registro, 'patrimonio', None)
        trecho_ca = f', C.A. {ca}' if ca else ''
        partes.append(f'{nome_item}, quantidade {item_registro.quantidade}{trecho_ca}')
    return '; '.join(partes) or 'sem itens'


def _ip_request(request):
    return request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0]


class NotaFiscalViewSet(viewsets.ModelViewSet):
    queryset = NotaFiscal.objects.all()
    serializer_class = NotaFiscalSerializer


class RegistroEntradaViewSet(viewsets.ModelViewSet):
    queryset = RegistroEntrada.objects.all()
    serializer_class = RegistroEntradaSerializer

    def perform_create(self, serializer):
        registro = serializer.save(registrado_por=self.request.user)
        registrar_log(
            self.request.user,
            f'Registro de Entrada "{registro.id} - {registro.nota_fiscal.numero_nota if registro.nota_fiscal else "Sem Nota Fiscal"}" registrada com sucesso.'
        )

    def perform_update(self, serializer):
        registro = serializer.save(alterado_por=self.request.user)
        registrar_log(
            self.request.user,
            f'Registro de Entrada "{registro.id} - {registro.nota_fiscal.numero_nota if registro.nota_fiscal else "Sem Nota Fiscal"}" atualizada com sucesso.'
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except Exception:
            return Response({'detail': 'Registro não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        erro_senha = _validar_senha_exclusao(request)
        if erro_senha:
            return erro_senha

        try:
            with transaction.atomic():
                itens = list(instance.itens.select_related('item').all())
                RegistroEntradaSerializer.restaurar_estoque_entrada(instance, request.user)

                registrar_log(
                    request.user,
                    f'Usuario {request.user.username} excluiu uma movimentacao de entrada #{instance.id}: {_resumo_itens_movimentacao(itens)}, referente a data {_data_movimentacao(instance, "data_entrada")}. Acao: exclusao de movimentacao. IP/sessao: {_ip_request(request) or "-"}'
                )

                self.perform_destroy(instance)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'detail': 'Registro de entrada excluído com sucesso.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='ultima-entrada/(?P<item_id>[^/.]+)')
    def ultima_entrada(self, request, item_id=None):
        try:
            ultimo_registro = RegistroEntradaItem.objects.filter(item__id=item_id)\
                .select_related('registro_entrada')\
                .order_by('-registro_entrada__data_movimentacao', '-registro_entrada__criado_em')\
                .first()

            if not ultimo_registro:
                return Response({'data': 'Não há registros de entrada para este item.'}, status=status.HTTP_200_OK)

            return Response({
                'data': ultimo_registro.registro_entrada.data_movimentacao,
                'quantidade': ultimo_registro.quantidade
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='itens')
    def listar_itens(self, request, pk=None):
        try:
            registro = self.get_object()
            itens = registro.itens.all()
            serializer = RegistroEntradaItemSerializer(itens, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RegistroEntradaItemViewSet(viewsets.ModelViewSet):
    queryset = RegistroEntradaItem.objects.all()
    serializer_class = RegistroEntradaItemSerializer


class RegistroSaidaViewSet(viewsets.ModelViewSet):
    queryset = RegistroSaida.objects.all()
    serializer_class = RegistroSaidaSerializer

    def perform_create(self, serializer):
        registro = serializer.save(registrado_por=self.request.user)
        registrar_log(self.request.user, f'Registro de Saída "{registro.id} - {registro.bloco_requisicao}" registrada com sucesso.')

    def perform_update(self, serializer):
        registro = serializer.save(alterado_por=self.request.user)
        registrar_log(self.request.user, f'Registro de Saída "{registro.id} - {registro.bloco_requisicao}" atualizada com sucesso.')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except Exception:
            return Response({'detail': 'Registro não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        erro_senha = _validar_senha_exclusao(request)
        if erro_senha:
            return erro_senha

        try:
            with transaction.atomic():
                itens = list(instance.itens.select_related('item').all())

                AssinaturaEpiService.remover_saida(instance)
                RegistroSaidaSerializer.restaurar_estoque_saida(instance, request.user)

                registrar_log(
                    request.user,
                    f'Usuario {request.user.username} excluiu uma movimentacao de saida #{instance.id}: {_resumo_itens_movimentacao(itens)}, referente a data {_data_movimentacao(instance, "data_saida")}. Acao: exclusao de movimentacao. IP/sessao: {_ip_request(request) or "-"}'
                )

                self.perform_destroy(instance)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'detail': 'Registro de saída excluído com sucesso.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='ca-disponivel/(?P<item_id>[^/.]+)')
    def ca_disponivel(self, request, item_id=None):
        try:
            lote = RegistroSaidaSerializer.ca_fifo_disponivel(item_id)
            if not lote:
                return Response({
                    'ca': None,
                    'quantidade_disponivel': 0,
                    'detail': 'Nenhum C.A. disponivel para este item.'
                }, status=status.HTTP_200_OK)

            return Response({
                'ca': lote.ca,
                'quantidade_disponivel': lote.quantidade_disponivel,
                'entrada_item': lote.id,
                'entrada': lote.registro_entrada_id,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='itens')
    def listar_itens(self, request, pk=None):
        try:
            registro = self.get_object()
            itens = registro.itens.all()
            serializer = RegistroSaidaItemSerializer(itens, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RegistroSaidaItemViewSet(viewsets.ModelViewSet):
    queryset = RegistroSaidaItem.objects.all()
    serializer_class = RegistroSaidaItemSerializer


class RegistroMovimentacaoEstoqueView(viewsets.ViewSet):
    def list(self, request):
        entradas = RegistroEntrada.objects.all().order_by('-data_movimentacao', '-data_entrada')[:10]
        saidas = RegistroSaida.objects.all().order_by('-data_movimentacao', '-data_saida')[:10]

        entrada_data = RegistroEntradaSerializer(entradas, many=True).data
        saida_data = RegistroSaidaSerializer(saidas, many=True).data

        return Response({
            'entradas': entrada_data,
            'saidas': saida_data
        })
