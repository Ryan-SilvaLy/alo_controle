from rest_framework import serializers
from app_produto.models import Produto
import re


class ProdutoSerializer(serializers.ModelSerializer):


    class Meta:
        model = Produto
        fields = [
            'id',
            'patrimonio',
            'nome',
            'nome_cliente',
            'tempo_contrato',
            'criado_em',
            'atualizado_em',
        ]


    def validate_patrimonio(self, value):
        '''
        Garante que o campo patrimônio contenha apenas números.
        '''
        
        if not re.fullmatch(r'\d+', str(value)):
            raise serializers.ValidationError('O campo patrimônio deve conter apenas números.')
        return value