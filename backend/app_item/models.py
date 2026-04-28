from django.db import models
import logging
logging.basicConfig(level=logging.DEBUG)


class TipoItem(models.Model):
    nome = models.CharField(verbose_name='Nome do Tipo de Item', max_length=40, unique=True)
    grupo_secundario = models.BooleanField(default=False, verbose_name='Grupo secundario para KPIs')

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tipo de Item'
        verbose_name_plural = 'Tipos de Item'
        ordering = ['nome']

    def __str__(self):
        return self.nome
    

class Item(models.Model):

    SITUACAO_CHOICES = [
        ('ok', 'Estoque OK'),                
        ('baixo', 'Estoque Baixo'),            
    ]

    STATUS_CHOICES = [
        ('ativo', 'Ativo'),
        ('inativo', 'Inativo')
    ]

    UNIDADE_MEDIDA_CHOICES = [
        ('un', 'Unidade'),
        ('kg', 'Quilo'),
        ('g', 'Grama'),
        ('l', 'Litro'),
        ('ml', 'Mililitro'),
        ('cx', 'Caixa'),
        ('pct', 'Pacote'),
        ('m', 'Metro'),
        ('cm', 'Centímetro'),
    ]


    codigo = models.CharField(verbose_name='Código', max_length=15, unique=True)
    nome = models.CharField(verbose_name='Nome', max_length=50)
    descricao = models.TextField(verbose_name='Descrição', blank=True)
    tipo_item = models.ForeignKey(TipoItem, verbose_name='Classe / Tipo Item', on_delete=models.PROTECT, related_name='itens')
    prateleira_estoque = models.CharField(verbose_name='Prateleira / Estoque', max_length=10)
    quantidade_atual = models.DecimalField(
        verbose_name='Quantidade Atual no Estoque',
        max_digits=10,
        decimal_places=2 
    )

    quantidade_minima = models.DecimalField(
        verbose_name='Quantidade Mínima',
        max_digits=10,
        decimal_places=2
    )
    valor_unitario = models.DecimalField(
        verbose_name='Valor Unitario',
        max_digits=12,
        decimal_places=2,
        default=0
    )
    unidade_medida = models.CharField(verbose_name='Unidade de Medida', max_length=10, choices=UNIDADE_MEDIDA_CHOICES, default='un')
    situacao = models.CharField(verbose_name='Situação', max_length=20, choices=SITUACAO_CHOICES, default='ok')
    status = models.CharField(verbose_name='Status', max_length=20, choices=STATUS_CHOICES, default='ativo')

    codigo_barras = models.CharField(verbose_name='Código de Barras', max_length=100, blank=True, null=True, unique=True)

    criado_em = models.DateTimeField(verbose_name='Criado em', auto_now_add=True)
    atualizado_em = models.DateTimeField(verbose_name='Atualizado em', auto_now=True)

    def __str__(self):
        return f"{self.codigo} - {self.nome}"

    def save(self, *args, **kwargs):
        ''' Lógica executada sempre que o método for chamado.

        - Atributo codigo será salvo no banco de dados com o valor todo maiúsculo.
        '''
        self.codigo = self.codigo.upper()
        self.nome = self.nome.upper()

        if self.quantidade_atual < self.quantidade_minima:
            self.situacao = 'baixo'
        else:
            self.situacao = 'ok'
    
        logging.debug(f'Salvando / Criando Item: codigo: {self.codigo} | nome: {self.nome}')
        super().save(*args, **kwargs)
