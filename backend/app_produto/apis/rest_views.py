from rest_framework import generics, status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from app_produto.models import Produto
from app_produto.apis.serializers import ProdutoSerializer
from app_usuario.services import registrar_log


class ProdutoViewSet(viewsets.ModelViewSet):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer

    def perform_create(self, serializer):
        produto = serializer.save()  

        registrar_log(self.request.user, f'Produto "{produto.id} - {produto.patrimonio} - {produto.nome}" criado com sucesso.')


    def perform_update(self, serializer):
        produto = serializer.save()  

        registrar_log(self.request.user, f'Produto "{produto.id} - {produto.patrimonio} - {produto.nome}" atualizado com sucesso.')


    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except:
            return Response({'detail': 'Produto não encontrado.'}, status=status.HTTP_404_NOT_FOUND)    
        
        registrar_log(request.user, f'Produto "{instance.id} - {instance.patrimonio} - {instance.nome}" excluído com sucesso.') 

        self.perform_destroy(instance)  
        return Response({'detail': 'Produto excluído com sucesso.'}, status=status.HTTP_200_OK)