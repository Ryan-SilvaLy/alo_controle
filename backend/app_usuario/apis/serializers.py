from rest_framework import serializers
from app_usuario.models import Usuario, Log
import logging 
logger = logging.getLogger(__name__)


class UsuarioSerializer(serializers.ModelSerializer):

    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Usuario
        fields = '__all__'
        read_only_fields = ['id', 'criado_em', 'atualizado_em']


    def create(self, validated_data):
        '''
        - Remove a senha da resposta, para não ser exibida.
        - `validated_data` -> Passa os valores como argumentos nomeados para o constructor do modelo.
        - `set_password` -> Criptografa a senha para armazenar no banco de dados.
        '''
        
        senha = validated_data.pop('password')
        usuario = Usuario(**validated_data)
        usuario.set_password(senha)
        usuario.save()
        return usuario


class LogSerializer(serializers.ModelSerializer):
    usuario_username = serializers.SerializerMethodField()

    class Meta:
        model = Log
        fields = ['id', 'usuario_username', 'acao', 'criado_em', 'atualizado_em']
        read_only_fields = ['id', 'usuario_username', 'criado_em', 'atualizado_em']


    def get_usuario_username(self, obj):
        # Retorna o username do usuário associado ao log
        return obj.usuario.username if obj.usuario else None