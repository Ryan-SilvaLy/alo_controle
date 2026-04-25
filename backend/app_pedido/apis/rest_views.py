from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from django.db import transaction
from django.utils import timezone
from app_pedido.models import Pedido
from .serializers import PedidoComItensSerializer
from app_usuario.services import registrar_log


NIVEIS_GESTAO_PEDIDO = {'administrador', 'moderador', 'almoxarifado'}


class AtualizarPedidoAPIView(APIView):

    def patch(self, request, pk):
        try:
            pedido = Pedido.objects.get(pk=pk)
        except Pedido.DoesNotExist:
            return Response({'detail': 'Pedido nao encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PedidoComItensSerializer(pedido, data=request.data, partial=True)
        if serializer.is_valid():
            pedido_atualizado = serializer.save()

            registrar_log(request.user, f'Pedido "{pedido_atualizado.id} - {pedido_atualizado.codigo_pedido}" atualizado com sucesso.')

            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CriarPedidoAPI(generics.CreateAPIView):
    queryset = Pedido.objects.all()
    serializer_class = PedidoComItensSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        pedido = serializer.save()
        registrar_log(self.request.user, f'Pedido "{pedido.id} - {pedido.codigo_pedido}" criado com sucesso.')


class ListarPedidosAPI(ListAPIView):
    queryset = Pedido.objects.all()
    serializer_class = PedidoComItensSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self.request.user, 'nivel_permissao', None) == 'compra':
            return queryset.filter(status__in=['enviado', 'visto', 'negado'])
        return queryset

    def list(self, request, *args, **kwargs):
        if not self.get_queryset().exists():
            return Response(
                {'message': 'Nao ha nenhum Pedido registrado no sistema.'},
                status=status.HTTP_200_OK
            )

        return super().list(request, *args, **kwargs)


class AtualizarStatusPedidoAPIView(APIView):

    def patch(self, request, pk):
        if getattr(request.user, 'nivel_permissao', None) not in NIVEIS_GESTAO_PEDIDO:
            return Response({'detail': 'Seu usuario nao pode alterar o status geral do pedido.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            pedido = Pedido.objects.get(pk=pk)
        except Pedido.DoesNotExist:
            return Response({'detail': 'Pedido nao encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        novo_status = request.data.get('status')
        motivo = (request.data.get('motivo_recusado') or '').strip()

        if novo_status not in dict(Pedido.STATUS_CHOICES):
            return Response({'detail': 'Status invalido.'}, status=status.HTTP_400_BAD_REQUEST)

        if pedido.status == 'cancelado':
            return Response({'detail': 'Nao e possivel alterar um pedido cancelado.'}, status=status.HTTP_400_BAD_REQUEST)

        transicoes_validas = {
            'pendente': {'enviado', 'cancelado'},
            'enviado': {'cancelado'},
            'visto': {'cancelado'},
            'negado': {'cancelado'},
            'cancelado': set(),
        }

        if novo_status not in transicoes_validas.get(pedido.status, set()):
            return Response({'detail': 'Transicao de status invalida.'}, status=status.HTTP_400_BAD_REQUEST)

        pedido.status = novo_status

        if novo_status == 'cancelado':
            if not motivo:
                return Response(
                    {'detail': 'E necessario informar o motivo do cancelamento.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pedido.motivo_recusado = motivo
        else:
            pedido.motivo_recusado = ''

        pedido.status_atualizado_em = timezone.now()
        pedido.save()

        registrar_log(request.user, f'Status alterado para "{pedido.status}" do pedido "{pedido.id} - {pedido.codigo_pedido}" atualizado com sucesso.')

        return Response({'detail': 'Status atualizado com sucesso.'}, status=status.HTTP_200_OK)


class AtualizarStatusComprasPedidoAPIView(APIView):

    def patch(self, request, pk):
        if getattr(request.user, 'nivel_permissao', None) != 'compra':
            return Response({'detail': 'Apenas usuarios de compras podem registrar ciencia ou negativa.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            pedido = Pedido.objects.get(pk=pk)
        except Pedido.DoesNotExist:
            return Response({'detail': 'Pedido nao encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if pedido.status not in {'enviado', 'visto'}:
            return Response({'detail': 'Compras so pode atuar em pedidos enviados.'}, status=status.HTTP_400_BAD_REQUEST)

        novo_status = request.data.get('acao')
        motivo = (request.data.get('compras_motivo_negado') or '').strip()

        if novo_status not in {'visto', 'negado'}:
            return Response({'detail': 'Status de compras invalido.'}, status=status.HTTP_400_BAD_REQUEST)

        agora = timezone.now()
        if novo_status == 'visto':
            pedido.status = 'visto'
            pedido.compras_visto_por = request.user
            pedido.compras_visto_em = agora
            pedido.compras_negado_por = None
            pedido.compras_negado_em = None
            pedido.compras_motivo_negado = ''
        else:
            if not motivo:
                return Response({'detail': 'Informe o motivo da negativa de compras.'}, status=status.HTTP_400_BAD_REQUEST)

            pedido.status = 'negado'
            pedido.compras_negado_por = request.user
            pedido.compras_negado_em = agora
            pedido.compras_motivo_negado = motivo

            if not pedido.compras_visto_por:
                pedido.compras_visto_por = request.user
                pedido.compras_visto_em = agora

        pedido.status_atualizado_em = agora
        pedido.save()

        registrar_log(request.user, f'Compras marcou pedido "{pedido.id} - {pedido.codigo_pedido}" como "{novo_status}".')

        serializer = PedidoComItensSerializer(pedido)
        return Response(serializer.data, status=status.HTTP_200_OK)


class BuscarPedidoPorIdAPI(APIView):
    def get(self, request, pk):
        try:
            pedido = Pedido.objects.get(pk=pk)
        except Pedido.DoesNotExist:
            return Response({'detail': 'Pedido nao encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PedidoComItensSerializer(pedido)
        return Response(serializer.data)
