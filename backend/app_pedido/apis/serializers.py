from rest_framework import serializers
from app_pedido.models import Pedido, PedidoItem
from app_item.models import Item


class PedidoItemSerializer(serializers.ModelSerializer):
    item_nome = serializers.CharField(source='item.nome', read_only=True)
    item_codigo = serializers.CharField(source='item.codigo', read_only=True)

    class Meta:
        model = PedidoItem
        fields = [
            'id',
            'item',
            'item_codigo',
            'item_nome',
            'quantidade_pedida',
            'ultima_entrada_estoque',
        ]

        read_only_fields = ['quantidade_atual_estoque']


class PedidoSerializer(serializers.ModelSerializer):
    itens = PedidoItemSerializer(many=True)

    class Meta:
        model = Pedido
        fields = [
            'id',
            'codigo_pedido',
            'solicitante',
            'setor_destino',
            'responsavel_setor',
            'status',
            'motivo_recusado',
            'criado_em',
            'atualizado_em',
            'status_atualizado_em',
            'itens',
            'criado_por'
        ]


class PedidoComItensSerializer(serializers.ModelSerializer):
    itens = PedidoItemSerializer(many=True)
    tipo_item_nome = serializers.CharField(source='tipo_item.nome', read_only=True)
    criado_por = serializers.SlugRelatedField(read_only=True, slug_field='username')
    compras_visto_por_nome = serializers.CharField(source='compras_visto_por.username', read_only=True)
    compras_negado_por_nome = serializers.CharField(source='compras_negado_por.username', read_only=True)

    class Meta:
        model = Pedido
        fields = [
            'id',
            'codigo_pedido',
            'solicitante',
            'setor_destino',
            'responsavel_setor',
            'tipo_item',
            'tipo_item_nome',
            'gerado_automaticamente',
            'criado_por',
            'status',
            'motivo_recusado',
            'compras_visto_por_nome',
            'compras_visto_em',
            'compras_negado_por_nome',
            'compras_negado_em',
            'compras_motivo_negado',
            'criado_em',
            'atualizado_em',
            'status_atualizado_em',
            'itens',
        ]

        read_only_fields = [
            'codigo_pedido',
            'criado_por',
            'gerado_automaticamente',
            'tipo_item',
            'criado_em',
            'atualizado_em',
            'status_atualizado_em',
            'compras_visto_por_nome',
            'compras_visto_em',
            'compras_negado_por_nome',
            'compras_negado_em',
            'compras_motivo_negado',
        ]

    def validate(self, data):
        itens = data.get('itens', [])
        if not itens:
            raise serializers.ValidationError('Um pedido deve conter ao menos 1 item.')

        tipo_item_base = None

        for item_data in itens:
            item_instance = item_data['item']
            tipo_item = item_instance.tipo_item

            if tipo_item is None:
                raise serializers.ValidationError(
                    f'O item "{item_instance.nome}" precisa estar vinculado a um grupo para entrar no pedido.'
                )

            if tipo_item_base is None:
                tipo_item_base = tipo_item
                continue

            if tipo_item.id != tipo_item_base.id:
                raise serializers.ValidationError(
                    'Todos os itens do pedido precisam pertencer ao mesmo grupo.'
                )

        return data

    def create(self, validated_data):
        itens_data = validated_data.pop('itens')

        user = self.context['request'].user
        tipo_item_base = itens_data[0]['item'].tipo_item

        pedido = Pedido.objects.create(criado_por=user, tipo_item=tipo_item_base, **validated_data)

        for item_data in itens_data:
            item_instance = item_data['item']
            item_data['quantidade_atual_estoque'] = item_instance.quantidade_atual
            item_data['adicionado_automaticamente'] = False

            PedidoItem.objects.create(pedido=pedido, **item_data)

        return pedido

    def update(self, instance, validated_data):
        itens_data = validated_data.pop('itens', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if itens_data:
            instance.tipo_item = itens_data[0]['item'].tipo_item

        instance.save()

        if itens_data is not None:
            itens_automaticos_existentes = {
                pedido_item.item_id: pedido_item.adicionado_automaticamente
                for pedido_item in instance.itens.all()
            }

            instance.itens.all().delete()

            for item_data in itens_data:
                item_instance = item_data['item']
                item_data['quantidade_atual_estoque'] = item_instance.quantidade_atual
                item_data['adicionado_automaticamente'] = itens_automaticos_existentes.get(item_instance.id, False)

                PedidoItem.objects.create(pedido=instance, **item_data)

        return instance
