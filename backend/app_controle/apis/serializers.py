from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from app_assinatura_epi.services import AssinaturaEpiService
from app_controle.models import (
    NotaFiscal,
    RegistroEntrada,
    RegistroEntradaItem,
    RegistroSaida,
    RegistroSaidaItem,
    RegistroSaidaItemLote,
)
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
    ca = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = RegistroEntradaItem
        fields = ['item', 'item_codigo', 'item_nome', 'quantidade', 'ca', 'quantidade_disponivel']
        read_only_fields = ['quantidade_disponivel']


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
            'data_movimentacao',
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
                item_data['ca'] = self._normalizar_ca(item_data.get('ca'))

                item.quantidade_atual += quantidade
                item.save()

                sincronizar_pedido_automatico_para_item(
                    item,
                    self.context['request'].user
                )

                RegistroEntradaItem.objects.create(
                    registro_entrada=registro,
                    quantidade_disponivel=quantidade,
                    **item_data
                )

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

                    sincronizar_pedido_automatico_para_item(
                        item,
                        self.context['request'].user
                    )

                instance.itens.all().delete()

                for item_data in itens_data:
                    item = item_data['item']
                    item.refresh_from_db()

                    quantidade = item_data['quantidade']
                    item_data['ca'] = self._normalizar_ca(item_data.get('ca'))

                    item.quantidade_atual += quantidade
                    item.save()

                    sincronizar_pedido_automatico_para_item(
                        item,
                        self.context['request'].user
                    )

                    RegistroEntradaItem.objects.create(
                        registro_entrada=instance,
                        quantidade_disponivel=quantidade,
                        **item_data
                    )

            return instance

    @staticmethod
    def _normalizar_ca(valor):
        return (valor or '').strip().upper() or None

    @classmethod
    def validar_exclusao_entrada(cls, registro_entrada):
        for item_registro in registro_entrada.itens.select_related('item').all():
            item = item_registro.item

            if item.quantidade_atual < item_registro.quantidade:
                raise serializers.ValidationError(
                    f'Nao ha estoque suficiente para desfazer a entrada do item "{item.nome}".'
                )

            if item_registro.ca and item_registro.quantidade_disponivel < item_registro.quantidade:
                raise serializers.ValidationError(
                    f'A entrada do EPI "{item.nome}" com C.A. {item_registro.ca} ja foi consumida por saidas e nao pode ser excluida com seguranca.'
                )

    @classmethod
    def restaurar_estoque_entrada(cls, registro_entrada, usuario):
        cls.validar_exclusao_entrada(registro_entrada)

        for item_registro in registro_entrada.itens.select_related('item').all():
            item = item_registro.item
            item.quantidade_atual -= item_registro.quantidade
            item.save()

            sincronizar_pedido_automatico_para_item(
                item,
                usuario
            )


class RegistroSaidaItemSerializer(serializers.ModelSerializer):
    item_codigo = serializers.CharField(source='item.codigo', read_only=True)
    item_nome = serializers.CharField(source='item.nome', read_only=True)
    ca_utilizado = serializers.CharField(source='patrimonio', read_only=True)
    patrimonio = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    solicitante = serializers.CharField(max_length=30)

    class Meta:
        model = RegistroSaidaItem
        fields = ['item', 'item_codigo', 'item_nome', 'quantidade', 'solicitante', 'patrimonio', 'ca_utilizado']


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
            'data_movimentacao',
            'data_saida',
            'observacao',
            'registrado_por',
            'alterado_por',
            'criado_em',
            'atualizado_em',
            'itens'
        ]
        read_only_fields = [
            'data_saida',
            'criado_em',
            'atualizado_em',
            'registrado_por',
            'alterado_por'
        ]

    def validate_bloco_requisicao(self, value):
        if not re.fullmatch(r'\d+', str(value)):
            raise serializers.ValidationError('O campo deve conter apenas numeros.')
        return value

    def create(self, validated_data):
        with transaction.atomic():
            itens_data = validated_data.pop('itens')

            for item_data in itens_data:
                item = item_data['item']
                quantidade = item_data['quantidade']

                if item.quantidade_atual < quantidade:
                    raise serializers.ValidationError(
                        f'Estoque insuficiente para o item "{item.nome}" '
                        f'(Codigo: {item.codigo}). Disponivel: {item.quantidade_atual}.'
                    )

            registro_saida = RegistroSaida.objects.create(**validated_data)

            for item_data in itens_data:
                item = item_data['item']
                quantidade = item_data['quantidade']
                solicitante = item_data['solicitante']
                patrimonio = self._normalizar_texto(item_data.get('patrimonio'))

                item.quantidade_atual -= quantidade
                item.save()

                sincronizar_pedido_automatico_para_item(
                    item,
                    self.context['request'].user
                )

                self._criar_itens_saida_com_rastreio(
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
                itens_existentes = list(
                    instance.itens.select_related('item').prefetch_related('lotes__registro_entrada_item').all()
                )

                for item_registro in itens_existentes:
                    self._restaurar_item_saida(item_registro)

                    sincronizar_pedido_automatico_para_item(
                        item_registro.item,
                        self.context['request'].user
                    )

                instance.itens.all().delete()

                for item_data in itens_data:
                    item = item_data['item']
                    item.refresh_from_db()

                    quantidade = item_data['quantidade']

                    if item.quantidade_atual < quantidade:
                        raise serializers.ValidationError(
                            f'Estoque insuficiente para o item "{item.nome}" '
                            f'(Codigo: {item.codigo}). Disponivel: {item.quantidade_atual}.'
                        )

                for item_data in itens_data:
                    item = item_data['item']
                    item.refresh_from_db()

                    quantidade = item_data['quantidade']
                    solicitante = item_data['solicitante']
                    patrimonio = self._normalizar_texto(item_data.get('patrimonio'))

                    item.quantidade_atual -= quantidade
                    item.save()

                    sincronizar_pedido_automatico_para_item(
                        item,
                        self.context['request'].user
                    )

                    self._criar_itens_saida_com_rastreio(
                        registro_saida=instance,
                        item=item,
                        quantidade=quantidade,
                        solicitante=solicitante,
                        patrimonio=patrimonio
                    )

            AssinaturaEpiService.processar_saida(instance)
            return instance

    @classmethod
    def restaurar_estoque_saida(cls, registro_saida, usuario):
        itens_saida = registro_saida.itens.select_related('item').prefetch_related('lotes__registro_entrada_item').all()
        for item_registro in itens_saida:
            cls._restaurar_item_saida(item_registro)

            sincronizar_pedido_automatico_para_item(
                item_registro.item,
                usuario
            )

    @classmethod
    def ca_fifo_disponivel(cls, item_id):
        return cls._query_lotes_ca_disponiveis(item_id=item_id).first()

    @classmethod
    def _restaurar_item_saida(cls, item_registro):
        item = item_registro.item
        item.quantidade_atual += item_registro.quantidade
        item.save()

        for lote_saida in item_registro.lotes.all():
            entrada_item = lote_saida.registro_entrada_item
            if not entrada_item:
                continue

            entrada_item.quantidade_disponivel += lote_saida.quantidade
            entrada_item.save(update_fields=['quantidade_disponivel'])

    def _criar_itens_saida_com_rastreio(self, registro_saida, item, quantidade, solicitante, patrimonio):
        if not self._item_eh_epi(item):
            RegistroSaidaItem.objects.create(
                registro_saida=registro_saida,
                item=item,
                quantidade=quantidade,
                solicitante=solicitante,
                patrimonio=patrimonio
            )
            return

        alocacoes = self._baixar_lotes_epi(item, quantidade, patrimonio)

        for alocacao in alocacoes:
            saida_item = RegistroSaidaItem.objects.create(
                registro_saida=registro_saida,
                item=item,
                quantidade=alocacao['quantidade'],
                solicitante=solicitante,
                patrimonio=alocacao['ca']
            )

            if alocacao['entrada_item']:
                RegistroSaidaItemLote.objects.create(
                    registro_saida_item=saida_item,
                    registro_entrada_item=alocacao['entrada_item'],
                    quantidade=alocacao['quantidade'],
                    ca=alocacao['ca']
                )

    def _baixar_lotes_epi(self, item, quantidade, patrimonio):
        patrimonio = self._normalizar_texto(patrimonio)
        primeiro_lote = self._query_lotes_ca_disponiveis(item_id=item.id, bloquear=True).first()

        if not primeiro_lote and not patrimonio:
            raise serializers.ValidationError(
                f'C.A. obrigatorio para o EPI "{item.nome}". Informe manualmente ou registre uma entrada com C.A.'
            )

        usar_ca_manual = bool(patrimonio and primeiro_lote and patrimonio != self._normalizar_texto(primeiro_lote.ca))
        if patrimonio and not primeiro_lote:
            usar_ca_manual = True

        query = self._query_lotes_ca_disponiveis(item_id=item.id, bloquear=True)
        if usar_ca_manual:
            query = query.filter(ca__iexact=patrimonio)

        restante = quantidade
        alocacoes = []

        for entrada_item in query:
            if restante <= 0:
                break

            quantidade_lote = min(entrada_item.quantidade_disponivel, restante)
            if quantidade_lote <= 0:
                continue

            entrada_item.quantidade_disponivel -= quantidade_lote
            entrada_item.save(update_fields=['quantidade_disponivel'])

            alocacoes.append({
                'entrada_item': entrada_item,
                'quantidade': quantidade_lote,
                'ca': self._normalizar_texto(entrada_item.ca),
            })
            restante -= quantidade_lote

        if restante > 0:
            if patrimonio:
                alocacoes.append({
                    'entrada_item': None,
                    'quantidade': restante,
                    'ca': patrimonio,
                })
            else:
                raise serializers.ValidationError(
                    f'Quantidade com C.A. insuficiente para o EPI "{item.nome}". Informe um C.A. manual para o saldo restante.'
                )

        return alocacoes

    @classmethod
    def _query_lotes_ca_disponiveis(cls, item_id, bloquear=False):
        queryset = RegistroEntradaItem.objects.all()
        if bloquear:
            queryset = queryset.select_for_update()

        return queryset.filter(
            item_id=item_id,
            quantidade_disponivel__gt=0,
        ).filter(
            Q(ca__isnull=False) & ~Q(ca='')
        ).select_related(
            'registro_entrada'
        ).order_by(
            'registro_entrada__data_movimentacao',
            'registro_entrada__data_entrada',
            'criado_em',
            'id'
        )

    @classmethod
    def _item_eh_epi(cls, item):
        tipo_nome = getattr(getattr(item, 'tipo_item', None), 'nome', '')
        return cls._normalizar_texto(tipo_nome) == 'EPI'

    @staticmethod
    def _normalizar_texto(valor):
        return (valor or '').strip().upper()
