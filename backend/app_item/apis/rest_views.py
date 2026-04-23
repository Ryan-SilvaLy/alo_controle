from rest_framework.generics import RetrieveAPIView, ListAPIView
from rest_framework import serializers, status, generics, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound, ValidationError

from app_item.models import Item, TipoItem
from .serializers import ItemSerializer, TipoItemSerializer
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from django.db.models import F

from app_usuario.services import registrar_log
from app_pedido.services import sincronizar_pedido_automatico_para_item
import logging
logger = logging.getLogger(__name__)


class ListarItensAPI(ListAPIView): 
    queryset = Item.objects.all()
    serializer_class = ItemSerializer

    def list(self, request, *args, **kwargs):
        if not self.get_queryset().exists():
            return Response(
                {'message': 'Não há nenhum Item cadastrado no sistema.'}, 
                status=status.HTTP_200_OK
            )
        
        return super().list(request, *args, **kwargs)


class BuscarItemAPI(RetrieveAPIView):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    lookup_field = 'id'

    def get_object(self):
        queryset = self.get_queryset()
        obj_id = self.kwargs.get(self.lookup_field)
        
        try:
            logger.debug(f'Item id {obj_id} encontrado.')
            return queryset.get(id=obj_id)
        except Item.DoesNotExist:
            raise NotFound(f'Item id {obj_id} não encontrado.')    


class CriarItemAPI(generics.CreateAPIView):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer

    def create(self, request, *args, **kwargs):
        try:
            response = super().create(request, *args, **kwargs)

            # Armazena os dados da resposta.
            data = response.data  # já tem todos os atributos

            item = Item.objects.get(id=data.get("id"))
            sincronizar_pedido_automatico_para_item(item, request.user)
            registrar_log(request.user, f'Item "{data.get("id")} - {data.get("codigo")} - {data.get("nome")}" criado com sucesso.')
            # Mensagem retornada na API após sucesso.
            return Response({
                'message': 'Item cadastrado com sucesso.',
                'data': response.data}, 
                status=status.HTTP_201_CREATED)
        

        except ValidationError as ve:
            return Response({
                'message': 'Erro ao criar o item.',
                'errors': ve.detail 
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e: 
            return Response({'message': 'Erro ao criar o item.',
                             'detail': str(e)
                             }, status=status.HTTP_400_BAD_REQUEST)

    
class DeletarItemAPI(APIView):
    
    def delete(self, request, *args, **kwargs):
        item_id = kwargs.get('id')

        try:
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({'error': 'Item não encontrado no sistema.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            item.delete()
        except ProtectedError:
            return Response({'message': 'Este item não pode ser excluído porque está associado a um ou mais pedidos.'}, status=status.HTTP_409_CONFLICT)            

        registrar_log(request.user, f'Item "{item.id} - {item.codigo} - {item.nome}" deletado com sucesso.')
        return Response({'message': 'Item deletado com sucesso.'}, status=status.HTTP_200_OK)
    

class AtualizarItemAPI(APIView):

    def put(self, request, id):
        item = Item.objects.get(id=id)
        serializer = ItemSerializer(item, data=request.data)
        
        if serializer.is_valid():
            item = serializer.save()
            sincronizar_pedido_automatico_para_item(item, request.user)
            logger.info(f'Item {item.codigo} atualizado com PUT.')
            return Response(serializer.data)
        
        logger.warning(f'Falha ao atualizar item {id}: {serializer.errors}')
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    def patch(self, request, id):
        # Permite atualizar apenas os campos fornecidos no corpo da requisição.

        try:
            item = Item.objects.get(id=id)
        except Item.DoesNotExist:
            return Response({'error': 'Item não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ItemSerializer(item, data=request.data, partial=True)

        if serializer.is_valid():
            item = serializer.save()
            sincronizar_pedido_automatico_para_item(item, request.user)
            logger.info(f'Item {item.codigo} atualizado com PATCH.')
            registrar_log(request.user, f'Item "{item.id} - {item.codigo} - {item.nome}" atualizado com sucesso.')
            return Response(serializer.data)
        
        logger.warning(f'Falha ao atualizar item {id}: {serializer.errors}')
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class AtualizarStatusItemAPI(APIView):

    def patch(self, request, id):
        try:
            item = Item.objects.get(id=id)
        except Item.DoesNotExist:
            return Response({'error': 'Item não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Alterna o status
        novo_status = 'ativo' if item.status == 'inativo' else 'inativo'
        item.status = novo_status
        item.save(update_fields=['status'])

        logger.info(f'Status do item {item.codigo} atualizado para {novo_status}.')
        registrar_log(request.user, f'Status alterado para "{novo_status}" do item "{item.id} - {item.codigo} - {item.nome}" atualizado com sucesso.')

        return Response({
            'message': f'Status atualizado para {novo_status}.',
            'id': item.id,
            'status': item.status
        }, status=status.HTTP_200_OK)



class TipoItemViewSet(viewsets.ModelViewSet):
    queryset = TipoItem.objects.all()
    serializer_class = TipoItemSerializer

    def perform_create(self, serializer):
        registro = serializer.save()
        registrar_log(self.request.user, f'Tipo de Item "{registro.id} - {registro.nome}" criado com sucesso.') 


    def perform_update(self, serializer):
        registro = serializer.save()
        registrar_log(self.request.user, f'Tipo de Item "{registro.id} - {registro.nome}" atualizado com sucesso.') 


    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class ItensPorTipoEstoqueBaixoView(generics.ListAPIView):
    serializer_class = ItemSerializer

    def get_queryset(self):
        tipo_id = self.request.query_params.get('tipo_id', None)
        queryset = Item.objects.filter(quantidade_atual__lt=F('quantidade_minima'))
        if tipo_id:
            queryset = queryset.filter(tipo_item_id=tipo_id)
        return queryset
