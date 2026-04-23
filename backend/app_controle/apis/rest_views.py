# views.py
from rest_framework import status, viewsets
from rest_framework.response import Response
from app_assinatura_epi.services import AssinaturaEpiService
from app_controle.models import NotaFiscal, RegistroEntrada, RegistroEntradaItem, RegistroSaida, RegistroSaidaItem
from app_controle.apis.serializers import (NotaFiscalSerializer, RegistroEntradaSerializer, RegistroEntradaItemSerializer, RegistroSaidaSerializer, RegistroSaidaItemSerializer)
from app_usuario.services import registrar_log
from rest_framework.decorators import action

class NotaFiscalViewSet(viewsets.ModelViewSet):
    queryset = NotaFiscal.objects.all()
    serializer_class = NotaFiscalSerializer


class RegistroEntradaViewSet(viewsets.ModelViewSet):
    queryset = RegistroEntrada.objects.all()
    serializer_class = RegistroEntradaSerializer

    def perform_create(self, serializer):
        registro = serializer.save(registrado_por=self.request.user)
        
        registrar_log(self.request.user, f'Registro de Entrada "{registro.id} - {registro.nota_fiscal.numero_nota if registro.nota_fiscal else "Sem Nota Fiscal"}" registrada com sucesso.') 


    def perform_update(self, serializer):
        registro = serializer.save(alterado_por=self.request.user)

        registrar_log(self.request.user, f'Registro de Entrada "{registro.id} - {registro.nota_fiscal.numero_nota if registro.nota_fiscal else "Sem Nota Fiscal"}" atualizada com sucesso.') 


    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except:
            return Response({'detail': 'Registro não encontrado.'}, status=status.HTTP_404_NOT_FOUND)    
        
        registrar_log(request.user, f'Registro de Entrada "{instance.id} - {instance.nota_fiscal.numero_nota if instance.nota_fiscal else "Sem Nota Fiscal"}" excluída com sucesso.') 

        self.perform_destroy(instance) 
        return Response({'detail': 'Registro de entrada excluído com sucesso.'}, status=status.HTTP_200_NO_CONTENT)
    

    @action(detail=False, methods=['get'], url_path='ultima-entrada/(?P<item_id>[^/.]+)')
    def ultima_entrada(self, request, item_id=None):
        '''
            Retorna a data da última entrada do item específico.
        '''
        
        try:
            ultimo_registro = RegistroEntradaItem.objects.filter(item__id=item_id)\
                .select_related('registro_entrada')\
                .order_by('-registro_entrada__criado_em')\
                .first()

            if not ultimo_registro:
                return Response({'data': 'Não há registros de entrada para este item.'}, status=status.HTTP_200_OK)

            return Response({
                'data': ultimo_registro.registro_entrada.criado_em,
                'quantidade': ultimo_registro.quantidade
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='itens')
    def listar_itens(self, request, pk=None):
        '''
            Lista os itens de uma entrada específica.
        '''
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
        # Atribuí o usuario logado no campo `registrado_por`.
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
        except:
            return Response({'detail': 'Registro não encontrado.'}, status=status.HTTP_404_NOT_FOUND)    
        
        AssinaturaEpiService.remover_saida(instance)
        registrar_log(request.user, f'Registro de Saída "{instance.id} - {instance.bloco_requisicao}" excluída com sucesso.') 

        self.perform_destroy(instance)  
        return Response({'detail': 'Registro de saída excluído com sucesso.'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], url_path='itens')
    def listar_itens(self, request, pk=None):
        '''
            Lista os itens de uma saída específica.
        '''
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
    '''
    ViewSet responsável por listar as últimas movimentações de estoque,
    incluindo as 10 entradas e 10 saídas mais recentes.

    Métodos:
        - list(request): Retorna um dicionário com listas serializadas de
          entradas e saídas de estoque, ordenadas por data decrescente.
    '''
    
    def list(self, request):
        entradas = RegistroEntrada.objects.all().order_by('-data_entrada')[:10] # Limite o retorne em até 10 objetos.
        saidas = RegistroSaida.objects.all().order_by('-data_saida')[:10]

        entrada_data = RegistroEntradaSerializer(entradas, many=True).data
        saida_data = RegistroSaidaSerializer(saidas, many=True).data

        return Response({
            'entradas': entrada_data,
            'saidas': saida_data
        })
