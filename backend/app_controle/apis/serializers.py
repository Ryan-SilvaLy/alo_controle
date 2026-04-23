from django.db import transaction
from rest_framework import serializers
from app_assinatura_epi.services import AssinaturaEpiService
from app_controle.models import NotaFiscal, RegistroEntrada, RegistroEntradaItem, RegistroSaida, RegistroSaidaItem
from app_pedido.services import sincronizar_pedido_automatico_para_item
import re


class NotaFiscalSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotaFiscal
        fields = [
            'id',
            'numero_nota',
            'nome_fornecedor',
            'cnpj_cpf',
            'criado_em',
            'atualizado_em',
        ]


class RegistroEntradaItemSerializer(serializers.ModelSerializer):
    item_nome = serializers.CharField(source='item.nome', read_only=True)
    item_codigo = serializers.CharField(source='item.codigo', read_only=True)

    class Meta:
        model = RegistroEntradaItem
        fields = ['item', 'item_codigo', 'item_nome', 'quantidade']


class RegistroEntradaSerializer(serializers.ModelSerializer):
    itens = RegistroEntradaItemSerializer(many=True)
    registrado_por = serializers.SlugRelatedField(read_only=True, slug_field='username')
    alterado_por = serializers.SlugRelatedField(read_only=True, slug_field='username')
    nota_fiscal_detalhe = NotaFiscalSerializer(source='nota_fiscal', read_only=True)

    class Meta:
        model = RegistroEntrada
        fields = [
            'id',
            'nota_fiscal',
            'nota_fiscal_detalhe',
            'recebido_por',
            'data_entrada',
            'observacao',
            'registrado_por',
            'alterado_por',
            'criado_em',
            'atualizado_em',
            'itens',
        ]

    def create(self, validated_data):
        with transaction.atomic():
            itens_data = validated_data.pop('itens', [])
            registro = RegistroEntrada.objects.create(**validated_data)

            for item_data in itens_data:
                item = item_data['item']
                quantidade = item_data['quantidade']
                item.quantidade_atual += quantidade
                item.save()
                sincronizar_pedido_automatico_para_item(item, self.context['request'].user)
                RegistroEntradaItem.objects.create(registro_entrada=registro, **item_data)

            return registro

    def update(self, instance, validated_data):
        with transaction.atomic():
            itens_data = validated_data.pop('itens', None)

            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if itens_data is not None:
                for item_registro in instance.itens.select_related('item').all():
                    item = item_registro.item
                    item.quantidade_atual -= item_registro.quantidade
                    item.save()
                    sincronizar_pedido_automatico_para_item(item, self.context['request'].user)

                instance.itens.all().delete()

                for item_data in itens_data:
                    item = item_data['item']
                    quantidade = item_data['quantidade']
                    item.quantidade_atual += quantidade
                    item.save()
                    sincronizar_pedido_automatico_para_item(item, self.context['request'].user)
                    RegistroEntradaItem.objects.create(registro_entrada=instance, **item_data)

            return instance


class RegistroSaidaItemSerializer(serializers.ModelSerializer):
    item_codigo = serializers.CharField(source='item.codigo', read_only=True)
    item_nome = serializers.CharField(source='item.nome', read_only=True)
    patrimonio = serializers.CharField(max_length=30, required=False, allow_blank=True)
    solicitante = serializers.CharField(max_length=30)

    class Meta:
        model = RegistroSaidaItem
        fields = ['item', 'item_codigo', 'item_nome', 'quantidade', 'solicitante', 'patrimonio']


class RegistroSaidaSerializer(serializers.ModelSerializer):
    itens = RegistroSaidaItemSerializer(many=True)
    registrado_por = serializers.SlugRelatedField(read_only=True, slug_field='username')
    alterado_por = serializers.SlugRelatedField(read_only=True, slug_field='username')

    class Meta:
        model = RegistroSaida
        fields = [
            'id',
            'bloco_requisicao',
            'setor',
            'responsavel',
            'data_saida',
            'observacao',
            'registrado_por',
            'alterado_por',
            'criado_em',
            'atualizado_em',
            'itens'
        ]
        read_only_fields = ['data_saida', 'criado_em', 'atualizado_em', 'registrado_por', 'alterado_por']

    def validate_bloco_requisicao(self, value):
        if not re.fullmatch(r'\d+', str(value)):
            raise serializers.ValidationError('O campo deve conter apenas números.')
        return value

    def create(self, validated_data):
        with transaction.atomic():
            itens_data = validated_data.pop('itens')

            for item_data in itens_data:
                item = item_data['item']
                quantidade = item_data['quantidade']

                if item.quantidade_atual < quantidade:
                    raise serializers.ValidationError(
                        f'Estoque insuficiente para o item "{item.nome}" (Código: {item.codigo}). '
                        f'Quantidade disponível: {item.quantidade_atual}. '
                        'Por favor, ajuste a quantidade solicitada.'
                    )

            registro_saida = RegistroSaida.objects.create(**validated_data)

            for item_data in itens_data:
                item = item_data['item']
                quantidade = item_data['quantidade']
                solicitante = item_data['solicitante']
                patrimonio = item_data['patrimonio']

                item.quantidade_atual -= quantidade
                item.save()
                sincronizar_pedido_automatico_para_item(item, self.context['request'].user)

                RegistroSaidaItem.objects.create(
                    registro_saida=registro_saida,
                    item=item,
                    quantidade=quantidade,
                    solicitante=solicitante,
                    patrimonio=patrimonio
                )

            AssinaturaEpiService.processar_saida(registro_saida)
            return registro_saida

    def update(self, instance, validated_data):
        with transaction.atomic():
            itens_data = validated_data.pop('itens', None)

            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if itens_data is not None:
                itens_existentes = list(instance.itens.select_related('item').all())

                for item_registro in itens_existentes:
                    item = item_registro.item
                    item.quantidade_atual += item_registro.quantidade
                    item.save()
                    sincronizar_pedido_automatico_para_item(item, self.context['request'].user)

                for item_data in itens_data:
                    item = item_data['item']
                    quantidade = item_data['quantidade']

                    if item.quantidade_atual < quantidade:
                        raise serializers.ValidationError(
                            f'Estoque insuficiente para o item "{item.nome}" (Código: {item.codigo}). '
                            f'Quantidade disponível: {item.quantidade_atual}. '
                            'Por favor, ajuste a quantidade solicitada.'
                        )

                instance.itens.all().delete()

                for item_data in itens_data:
                    item = item_data['item']
                    quantidade = item_data['quantidade']
                    solicitante = item_data['solicitante']
                    patrimonio = item_data.get('patrimonio', '')

                    item.quantidade_atual -= quantidade
                    item.save()
                    sincronizar_pedido_automatico_para_item(item, self.context['request'].user)

                    RegistroSaidaItem.objects.create(
                        registro_saida=instance,
                        item=item,
                        quantidade=quantidade,
                        solicitante=solicitante,
                        patrimonio=patrimonio
                    )

            AssinaturaEpiService.processar_saida(instance)
            return instance
