from rest_framework.generics import RetrieveAPIView, ListAPIView
from rest_framework import serializers, status, generics, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound, ValidationError
from django.http import HttpResponse

from app_item.models import Item, TipoItem
from .serializers import ItemSerializer, TipoItemSerializer
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from django.db.models import F, Q
from django.template.loader import render_to_string
import base64

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


class BuscarItemPorCodigoBarrasAPI(APIView):
    def get(self, request, codigo_barras):
        codigo = ''.join(filter(str.isdigit, str(codigo_barras or '')))

        if not codigo:
            return Response({'detail': 'Informe um código de barras válido.'}, status=status.HTTP_400_BAD_REQUEST)

        item = get_object_or_404(Item, codigo_barras=codigo)
        garantir_imagem_codigo_barras(item)
        serializer = ItemSerializer(item, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ListarCodigosBarrasAPI(ListAPIView):
    serializer_class = ItemSerializer

    def get_queryset(self):
        queryset = Item.objects.select_related('tipo_item').exclude(codigo_barras__isnull=True).exclude(codigo_barras='')
        grupo = self.request.query_params.get('grupo') or self.request.query_params.get('tipo')
        nome = self.request.query_params.get('nome')
        codigo = self.request.query_params.get('codigo')
        termo = self.request.query_params.get('q')

        if grupo:
            queryset = queryset.filter(tipo_item_id=grupo)
        if nome:
            queryset = queryset.filter(nome__icontains=nome)
        if codigo:
            queryset = queryset.filter(Q(codigo__icontains=codigo) | Q(codigo_barras__icontains=codigo))
        if termo:
            queryset = queryset.filter(
                Q(nome__icontains=termo) |
                Q(codigo__icontains=termo) |
                Q(codigo_barras__icontains=termo) |
                Q(tipo_item__nome__icontains=termo)
            )

        return queryset.order_by('nome', 'codigo')

    def list(self, request, *args, **kwargs):
        queryset = list(self.filter_queryset(self.get_queryset()))
        for item in queryset:
            garantir_imagem_codigo_barras(item)
        serializer = self.get_serializer(queryset, many=True)
        dados = list(serializer.data)

        for item, item_serializado in zip(queryset, dados):
            item_serializado['codigo_barras_imagem_base64'] = obter_imagem_codigo_barras_base64(item)

        return Response(dados, status=status.HTTP_200_OK)


class GerarPdfCodigosBarrasAPI(APIView):
    def post(self, request):
        ids = request.data.get('ids') or request.data.get('itens') or []

        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'Selecione ao menos um item.'}, status=status.HTTP_400_BAD_REQUEST)

        itens = Item.objects.select_related('tipo_item').filter(id__in=ids).order_by('nome', 'codigo')
        etiquetas = []

        for item in itens:
            garantir_imagem_codigo_barras(item)
            imagem_base64 = obter_imagem_codigo_barras_base64(item)

            etiquetas.append({
                'codigo': item.codigo,
                'nome': item.nome,
                'tipo': item.tipo_item.nome,
                'codigo_barras': item.codigo_barras,
                'imagem_base64': imagem_base64,
            })

        try:
            from weasyprint import HTML
            html = render_to_string('app_item/codigos_barras_pdf.html', {'etiquetas': etiquetas})
            pdf = HTML(string=html, base_url=request.build_absolute_uri('/')).write_pdf()
        except OSError as exc:
            return Response(
                {'detail': f'Nao foi possivel carregar as dependencias de PDF do WeasyPrint: {exc}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="codigos_barras.pdf"'
        return response


def garantir_imagem_codigo_barras(item):
    if item.codigo_barras and not item.codigo_barras_imagem:
        item._gerar_imagem_codigo_barras()
        item.save(update_fields=['codigo_barras_imagem'])


def obter_imagem_codigo_barras_base64(item):
    if not item.codigo_barras_imagem:
        return ''

    try:
        with item.codigo_barras_imagem.open('rb') as arquivo:
            return base64.b64encode(arquivo.read()).decode('ascii')
    except FileNotFoundError:
        return ''
