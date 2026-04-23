from rest_framework.generics import RetrieveAPIView, ListAPIView
from rest_framework import serializers, status, generics, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404

from app_usuario.models import Usuario, Log
from .serializers import UsuarioSerializer, LogSerializer

import logging
logger = logging.getLogger(__name__)



class ListarUsuariosAPI(ListAPIView): 
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer

    def list(self, request, *args, **kwargs):
        if not self.get_queryset().exists():
            return Response(
                {'message': 'Não há nenhum usuario cadastrado no sistema.'}, 
                status=status.HTTP_200_OK
            )
        
        return super().list(request, *args, **kwargs)


class BuscarUsuarioAPI(RetrieveAPIView):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    lookup_field = 'id'

    def get_object(self):
        queryset = self.get_queryset()
        obj_id = self.kwargs.get(self.lookup_field)
        
        try:
            logger.debug(f'Usuario id {obj_id} encontrado.')
            return queryset.get(id=obj_id)
        except Usuario.DoesNotExist:
            raise NotFound(f'Usuario id {obj_id} não encontrado.')    


class CriarUsuarioAPI(generics.CreateAPIView):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer

    def create(self, request, *args, **kwargs):
        nivel_permissao = request.data.get('nivel_permissao')

        niveis_validos = [choice[0] for choice in Usuario.NIVEL_PERMISSAO_CHOICES]
        if nivel_permissao and nivel_permissao not in niveis_validos:
            # Verifica se o nivel de permissão é válido.
            
            return Response({
                'nivel_permissao': f'Nível de permissão inválido. Valores permitidos: {', '.join(niveis_validos)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        super().create(request, *args, **kwargs)
        # logging.debug('Create aqui')

        # Mensagem retornada na API após sucesso.
        return Response({'message': 'Usuario cadastrado com sucesso.'}, status=status.HTTP_201_CREATED)
    

class DeletarUsuarioAPI(APIView):
    
    def delete(self, request, *args, **kwargs):
        usuario_id = kwargs.get('id')

        try:
            usuario = Usuario.objects.get(id=usuario_id)
        except Usuario.DoesNotExist:
            return Response({'error': 'Usuario não encontrado no sistema.'}, status=status.HTTP_404_NOT_FOUND)

        usuario.delete()

        return Response({'message': 'Usuario deletado com sucesso.'}, status=status.HTTP_200_OK)
    

class AtualizarUsuarioAPI(APIView):
    def put(self, request, id):
        usuario = get_object_or_404(Usuario, id=id)
        serializer = UsuarioSerializer(usuario, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class PegarUsuarioNaSessaoAPI(APIView):
    def get(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response({'error': 'Usuário não autenticado.'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = UsuarioSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class LogsViewSetAPI(viewsets.ModelViewSet):
    queryset = Log.objects.all()
    serializer_class = LogSerializer
