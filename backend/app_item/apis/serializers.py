from rest_framework import serializers
from app_item.models import Item, TipoItem
import logging 
logger = logging.getLogger(__name__)

class TipoItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoItem
        fields = '__all__'


class ItemSerializer(serializers.ModelSerializer):
    '''
       Serializer para o modelo Item.

    Campos:
    - tipo_item: Serializa o objeto completo do tipo de item para leitura (GET).
    - tipo_item_id: Campo write-only usado para enviar apenas o ID do TipoItem ao criar ou atualizar um Item.
      Mapeia para o campo 'tipo_item' do modelo e valida se o ID enviado existe no banco.
    
    Meta:
    - model: Item
    - fields: '__all__' (todos os campos do modelo)
    - read_only_fields: ['id', 'situacao', 'criado_em', 'atualizado_em']
      Campos que não podem ser alterados via API. 'situacao' é calculada pelo backend.
    '''

    # O objeto completo para leitura.
    tipo_item = TipoItemSerializer(read_only=True)

    # No post para envio ao backend, é enviado apenas o id do TipoItem.
    tipo_item_id = serializers.PrimaryKeyRelatedField(
        queryset=TipoItem.objects.all(), 
        source='tipo_item',
        write_only=True
    )

    # unidade_medida = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = '__all__'
        read_only_fields = ['id', 'situacao', 'criado_em', 'atualizado_em']

    
    # def get_unidade_medida(self, obj):
    #     return obj.get_unidade_medida_display()