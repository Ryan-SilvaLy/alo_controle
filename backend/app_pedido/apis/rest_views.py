from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from django.db import transaction
from django.utils import timezone
from app_pedido.models import Pedido
from .serializers import PedidoSerializer, PedidoComItensSerializer
from app_usuario.services import registrar_log


class AtualizarPedidoAPIView(APIView):

    def patch(self, request, pk):
        try:
            pedido = Pedido.objects.get(pk=pk)
        except Pedido.DoesNotExist:
            return Response({'detail': 'Pedido não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

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

    def list(self, request, *args, **kwargs):
        if not self.get_queryset().exists():
            return Response(
                {'message': 'Não há nenhum Pedido registrado no sistema.'},
                status=status.HTTP_200_OK
            )

        return super().list(request, *args, **kwargs)


class AtualizarStatusPedidoAPIView(APIView):

    def patch(self, request, pk):
        try:
            pedido = Pedido.objects.get(pk=pk)
        except Pedido.DoesNotExist:
            return Response({'detail': 'Pedido não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        novo_status = request.data.get('status')
        motivo = (request.data.get('motivo_recusado') or '').strip().lower()

        if novo_status not in dict(Pedido.STATUS_CHOICES):
            return Response({'detail': 'Status inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        if pedido.status == 'finalizado':
            return Response({'detail': 'Não é possível alterar um pedido finalizado.'}, status=status.HTTP_400_BAD_REQUEST)

        transicoes_validas = {
            'pendente': {'enviado', 'finalizado'},
            'enviado': {'finalizado'},
            'finalizado': set(),
        }

        if novo_status not in transicoes_validas.get(pedido.status, set()):
            return Response({'detail': 'Transição de status inválida.'}, status=status.HTTP_400_BAD_REQUEST)

        pedido.status = novo_status

        if novo_status == 'finalizado':
            if motivo not in {'recusado', 'cancelado'}:
                return Response(
                    {'detail': 'É necessário informar se o pedido foi recusado ou cancelado.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pedido.motivo_recusado = motivo
        else:
            pedido.motivo_recusado = ''

        pedido.status_atualizado_em = timezone.now()
        pedido.save()

        registrar_log(request.user, f'Status alterado para "{pedido.status}" do pedido "{pedido.id} - {pedido.codigo_pedido}" atualizado com sucesso.')

        return Response({'detail': 'Status atualizado com sucesso.'}, status=status.HTTP_200_OK)


class BuscarPedidoPorIdAPI(APIView):
    def get(self, request, pk):
        try:
            pedido = Pedido.objects.get(pk=pk)
        except Pedido.DoesNotExist:
            return Response({'detail': 'Pedido não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PedidoComItensSerializer(pedido)
        return Response(serializer.data)
