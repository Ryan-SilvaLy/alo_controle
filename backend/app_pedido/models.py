from django.db import models
from app_item.models import Item, TipoItem
from app_usuario.models import Usuario
import logging
logging.basicConfig(level=logging.DEBUG)


class Pedido(models.Model):

    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('enviado', 'Enviado'),
        ('finalizado', 'Finalizado'),
    ]

    codigo_pedido = models.CharField(verbose_name='Código do Pedido', max_length=10, unique=True)
    solicitante = models.CharField(verbose_name='Solicitante do Pedido', max_length=50)
    setor_destino = models.CharField(verbose_name='Setor Destino', max_length=30)
    responsavel_setor = models.CharField(verbose_name='Responsável pelo Setor', max_length=50)
    status = models.CharField(verbose_name='Status', max_length=20, choices=STATUS_CHOICES, default='pendente')
    motivo_recusado = models.TextField(verbose_name='Motivo do Cancelamento', blank=True, null=True)
    tipo_item = models.ForeignKey(TipoItem, on_delete=models.PROTECT, related_name='pedidos', null=True, blank=True, verbose_name='Grupo do Pedido')
    gerado_automaticamente = models.BooleanField(default=False, verbose_name='Gerado Automaticamente')
    criado_por = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name='pedidos_criados')

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    status_atualizado_em = models.DateTimeField(null=True, blank=True, verbose_name='Data da Mudanca de Status')

    def __str__(self):
        return self.codigo_pedido

    def save(self, *args, **kwargs):

        if not self.codigo_pedido:
            ultimo_pedido = Pedido.objects.order_by('-id').first()
            proximo_numero = 1

            if ultimo_pedido and ultimo_pedido.codigo_pedido:
                try:
                    proximo_numero = int(ultimo_pedido.codigo_pedido[1:]) + 1
                except ValueError:
                    pass

            self.codigo_pedido = f'P{proximo_numero:05d}'

        self.solicitante = self.solicitante.upper()
        self.setor_destino = self.setor_destino.upper()
        self.responsavel_setor = self.responsavel_setor.upper()
        logging.debug(f'Salvando / Criando Pedido - codigo_pedido: {self.codigo_pedido} | solicitante: {self.solicitante} | setor_destino: {self.setor_destino} | responsavel_setor: {self.responsavel_setor}')
        super().save(*args, **kwargs)


class PedidoItem(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='itens')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)

    quantidade_pedida = models.DecimalField(
        verbose_name='Quantidade Pedida',
        max_digits=10,
        decimal_places=2
    )
    quantidade_atual_estoque = models.PositiveIntegerField(verbose_name='Quantidade Atual no Estoque')
    ultima_entrada_estoque = models.DateField(verbose_name='Última Entrada no Estoque', null=True, blank=True)
    adicionado_automaticamente = models.BooleanField(default=False, verbose_name='Adicionado Automaticamente')

    def __str__(self):
        return f"{self.item.nome} ({self.quantidade_pedida})"
