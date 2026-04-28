# Importa controle de transações do Django
# Garante que operações críticas sejam executadas completamente ou revertidas em caso de erro
from django.db import transaction

# Importa os serializers do Django REST Framework
from rest_framework import serializers

# Serviço responsável por processar assinaturas de EPI após saídas
from app_assinatura_epi.services import AssinaturaEpiService

# Importação dos models utilizados neste serializer
from app_controle.models import (
    NotaFiscal,
    RegistroEntrada,
    RegistroEntradaItem,
    RegistroSaida,
    RegistroSaidaItem
)

# Serviço que sincroniza automaticamente pedidos com base no estoque
from app_pedido.services import sincronizar_pedido_automatico_para_item

# Biblioteca para validações com expressão regular
import re


# ================================
# SERIALIZER DE NOTA FISCAL
# ================================
class NotaFiscalSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotaFiscal  # Model vinculado
        fields = [
            'id',
            'numero_nota',
            'nome_fornecedor',
            'cnpj_cpf',
            'criado_em',
            'atualizado_em',
        ]


# ================================
# SERIALIZER DE ITENS DA ENTRADA
# ================================
class RegistroEntradaItemSerializer(serializers.ModelSerializer):
    
    # Campos adicionais apenas para leitura (não são salvos diretamente)
    item_nome = serializers.CharField(source='item.nome', read_only=True)
    item_codigo = serializers.CharField(source='item.codigo', read_only=True)

    class Meta:
        model = RegistroEntradaItem
        fields = ['item', 'item_codigo', 'item_nome', 'quantidade']


# ================================
# SERIALIZER DE REGISTRO DE ENTRADA
# ================================
class RegistroEntradaSerializer(serializers.ModelSerializer):

    # Lista de itens vinculados à entrada
    itens = RegistroEntradaItemSerializer(many=True)

    # Mostra o usuário que registrou (somente leitura)
    registrado_por = serializers.SlugRelatedField(read_only=True, slug_field='username')

    # Mostra o usuário que alterou (somente leitura)
    alterado_por = serializers.SlugRelatedField(read_only=True, slug_field='username')

    # Retorna detalhes completos da nota fiscal
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

    # ================================
    # CRIAÇÃO DE ENTRADA
    # ================================
    def create(self, validated_data):
        with transaction.atomic():  # Inicia transação segura

            # Remove itens do payload principal
            itens_data = validated_data.pop('itens', [])

            # Cria o registro principal de entrada
            registro = RegistroEntrada.objects.create(**validated_data)

            # Percorre todos os itens enviados
            for item_data in itens_data:
                item = item_data['item']
                quantidade = item_data['quantidade']

                # Soma quantidade ao estoque atual
                item.quantidade_atual += quantidade
                item.save()

                # Sincroniza pedidos automáticos
                sincronizar_pedido_automatico_para_item(
                    item,
                    self.context['request'].user
                )

                # Cria o vínculo item -> entrada
                RegistroEntradaItem.objects.create(
                    registro_entrada=registro,
                    **item_data
                )

            return registro


    # ================================
    # ATUALIZAÇÃO DE ENTRADA
    # ================================
    def update(self, instance, validated_data):
        with transaction.atomic():

            itens_data = validated_data.pop('itens', None)

            # Atualiza campos principais
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            # Se vier atualização de itens
            if itens_data is not None:

                # Remove efeito antigo do estoque
                for item_registro in instance.itens.select_related('item').all():
                    item = item_registro.item

                    item.quantidade_atual -= item_registro.quantidade
                    item.save()

                    sincronizar_pedido_automatico_para_item(
                        item,
                        self.context['request'].user
                    )

                # Remove itens antigos
                instance.itens.all().delete()

                # Adiciona novos itens
                for item_data in itens_data:
                    item = item_data['item']
                    item.refresh_from_db()

                    quantidade = item_data['quantidade']

                    item.quantidade_atual += quantidade
                    item.save()

                    sincronizar_pedido_automatico_para_item(
                        item,
                        self.context['request'].user
                    )

                    RegistroEntradaItem.objects.create(
                        registro_entrada=instance,
                        **item_data
                    )

            return instance


# ================================
# SERIALIZER DE ITENS DA SAÍDA
# ================================
class RegistroSaidaItemSerializer(serializers.ModelSerializer):

    item_codigo = serializers.CharField(source='item.codigo', read_only=True)
    item_nome = serializers.CharField(source='item.nome', read_only=True)

    # Campo opcional
    patrimonio = serializers.CharField(max_length=30, required=False, allow_blank=True)

    # Campo obrigatório
    solicitante = serializers.CharField(max_length=30)

    class Meta:
        model = RegistroSaidaItem
        fields = ['item', 'item_codigo', 'item_nome', 'quantidade', 'solicitante', 'patrimonio']


# ================================
# SERIALIZER DE REGISTRO DE SAÍDA
# ================================
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

        # Campos protegidos
        read_only_fields = [
            'data_saida',
            'criado_em',
            'atualizado_em',
            'registrado_por',
            'alterado_por'
        ]


    # ================================
    # VALIDAÇÃO DO BLOCO
    # ================================
    def validate_bloco_requisicao(self, value):
        # Permite apenas números
        if not re.fullmatch(r'\d+', str(value)):
            raise serializers.ValidationError(
                'O campo deve conter apenas números.'
            )
        return value


    # ================================
    # CRIAÇÃO DE SAÍDA
    # ================================
    def create(self, validated_data):
        with transaction.atomic():

            itens_data = validated_data.pop('itens')

            # Validação de estoque antes de criar
            for item_data in itens_data:
                item = item_data['item']
                quantidade = item_data['quantidade']

                if item.quantidade_atual < quantidade:
                    raise serializers.ValidationError(
                        f'Estoque insuficiente para o item "{item.nome}" '
                        f'(Código: {item.codigo}). '
                        f'Disponível: {item.quantidade_atual}.'
                    )

            # Cria registro principal
            registro_saida = RegistroSaida.objects.create(**validated_data)

            # Processa itens
            for item_data in itens_data:
                item = item_data['item']

                quantidade = item_data['quantidade']
                solicitante = item_data['solicitante']
                patrimonio = item_data['patrimonio']

                # Desconta do estoque
                item.quantidade_atual -= quantidade
                item.save()

                sincronizar_pedido_automatico_para_item(
                    item,
                    self.context['request'].user
                )

                RegistroSaidaItem.objects.create(
                    registro_saida=registro_saida,
                    item=item,
                    quantidade=quantidade,
                    solicitante=solicitante,
                    patrimonio=patrimonio
                )

            # Processa EPI
            AssinaturaEpiService.processar_saida(registro_saida)

            return registro_saida


    # ================================
    # ATUALIZAÇÃO DE SAÍDA
    # ================================
    def update(self, instance, validated_data):
        with transaction.atomic():

            itens_data = validated_data.pop('itens', None)

            # Atualiza dados principais
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if itens_data is not None:

                # Recupera itens antigos
                itens_existentes = list(
                    instance.itens.select_related('item').all()
                )

                # Devolve estoque antigo
                for item_registro in itens_existentes:
                    item = item_registro.item

                    item.quantidade_atual += item_registro.quantidade
                    item.save()

                    sincronizar_pedido_automatico_para_item(
                        item,
                        self.context['request'].user
                    )

                # Valida novos valores
                for item_data in itens_data:
                    item = item_data['item']
                    item.refresh_from_db()

                    quantidade = item_data['quantidade']

                    if item.quantidade_atual < quantidade:
                        raise serializers.ValidationError(
                            f'Estoque insuficiente para o item "{item.nome}" '
                            f'(Código: {item.codigo}). '
                            f'Disponível: {item.quantidade_atual}.'
                        )

                # Remove itens antigos
                instance.itens.all().delete()

                # Cria novos itens
                for item_data in itens_data:
                    item = item_data['item']
                    item.refresh_from_db()

                    quantidade = item_data['quantidade']
                    solicitante = item_data['solicitante']
                    patrimonio = item_data.get('patrimonio', '')

                    # Desconta estoque novamente
                    item.quantidade_atual -= quantidade
                    item.save()

                    sincronizar_pedido_automatico_para_item(
                        item,
                        self.context['request'].user
                    )

                    RegistroSaidaItem.objects.create(
                        registro_saida=instance,
                        item=item,
                        quantidade=quantidade,
                        solicitante=solicitante,
                        patrimonio=patrimonio
                    )

            # Reprocessa assinatura de EPI
            AssinaturaEpiService.processar_saida(instance)

            return instance