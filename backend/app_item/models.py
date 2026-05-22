from django.core.files.base import ContentFile
from django.db import models
from django.utils import timezone
from io import BytesIO
import logging
logging.basicConfig(level=logging.DEBUG)


class TipoItem(models.Model):
    nome = models.CharField(verbose_name='Nome do Tipo de Item', max_length=40, unique=True)
    grupo_secundario = models.BooleanField(default=False, verbose_name='Grupo secundario para KPIs')
    dias_cobertura = models.PositiveIntegerField(default=30, verbose_name='Dias de Cobertura')

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
    codigo_barras_imagem = models.ImageField(
        verbose_name='Imagem do Código de Barras',
        upload_to='codigos_barras/',
        blank=True,
        null=True
    )

    criado_em = models.DateTimeField(verbose_name='Criado em', auto_now_add=True)
    atualizado_em = models.DateTimeField(verbose_name='Atualizado em', auto_now=True)

    def __str__(self):
        return f"{self.codigo} - {self.nome}"

    def save(self, *args, **kwargs):
        ''' Lógica executada sempre que o método for chamado.

        - Atributo codigo será salvo no banco de dados com o valor todo maiúsculo.
        '''
        criando = self.pk is None
        codigo_barras_original = None

        situacao_anterior = None
        if self.pk:
            item_original = Item.objects.filter(pk=self.pk).values('codigo_barras', 'situacao').first()
            if item_original:
                codigo_barras_original = item_original['codigo_barras']
                situacao_anterior = item_original['situacao']

        self.codigo = self.codigo.upper()
        self.nome = self.nome.upper()
        self.codigo_barras = ''.join(filter(str.isdigit, str(self.codigo_barras or ''))) or None

        if codigo_barras_original:
            self.codigo_barras = codigo_barras_original

        if self.quantidade_minima is not None and self.quantidade_atual <= self.quantidade_minima:
            self.situacao = 'baixo'
        else:
            self.situacao = 'ok'
    
        logging.debug(f'Salvando / Criando Item: codigo: {self.codigo} | nome: {self.nome}')
        super().save(*args, **kwargs)

        if self.situacao == 'baixo' and situacao_anterior != 'baixo':
            EventoEstoqueBaixo.objects.create(
                item=self,
                data_evento=getattr(self, '_data_evento_estoque_baixo', None) or timezone.localdate(),
                estoque_atual=self.quantidade_atual,
                estoque_minimo=self.quantidade_minima,
            )

        if criando and not self.codigo_barras:
            self.codigo_barras = f'{self.pk:012d}'
            self._gerar_imagem_codigo_barras()
            super().save(update_fields=['codigo_barras', 'codigo_barras_imagem'])
        elif self.codigo_barras and not self.codigo_barras_imagem:
            self._gerar_imagem_codigo_barras()
            super().save(update_fields=['codigo_barras_imagem'])

    def _gerar_imagem_codigo_barras(self):
        conteudo = gerar_codigo_barras_png(self.codigo_barras)
        nome_arquivo = f'item_{self.pk or "novo"}_{self.codigo_barras}.png'
        self.codigo_barras_imagem.save(nome_arquivo, conteudo, save=False)


class EventoEstoqueBaixo(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='eventos_estoque_baixo')
    data_evento = models.DateField(default=timezone.localdate, verbose_name='Data do Evento')
    estoque_atual = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Estoque Atual')
    estoque_minimo = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Estoque Minimo')
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Evento de Estoque Baixo'
        verbose_name_plural = 'Eventos de Estoque Baixo'
        ordering = ['-data_evento', '-id']


CODE39_PATTERNS = {
    '0': 'nnnwwnwnn',
    '1': 'wnnwnnnnw',
    '2': 'nnwwnnnnw',
    '3': 'wnwwnnnnn',
    '4': 'nnnwwnnnw',
    '5': 'wnnwwnnnn',
    '6': 'nnwwwnnnn',
    '7': 'nnnwnnwnw',
    '8': 'wnnwnnwnn',
    '9': 'nnwwnnwnn',
    '*': 'nwnnwnwnn',
}


def gerar_codigo_barras_png(codigo):
    from PIL import Image, ImageDraw, ImageFont

    codigo = str(codigo or '').strip()
    largura_fina = 3
    largura_larga = largura_fina * 3
    altura_barra = 74
    margem = 16
    altura_texto = 26
    sequencia = f'*{codigo}*'

    largura_total = margem * 2
    for caractere in sequencia:
        padrao = CODE39_PATTERNS.get(caractere)
        if not padrao:
            continue
        largura_total += sum(largura_larga if parte == 'w' else largura_fina for parte in padrao)
        largura_total += largura_fina

    imagem = Image.new('RGB', (largura_total, altura_barra + altura_texto + margem), 'white')
    draw = ImageDraw.Draw(imagem)
    x = margem

    for caractere in sequencia:
        padrao = CODE39_PATTERNS.get(caractere)
        if not padrao:
            continue

        for indice, parte in enumerate(padrao):
            largura = largura_larga if parte == 'w' else largura_fina
            if indice % 2 == 0:
                draw.rectangle([x, margem, x + largura - 1, margem + altura_barra], fill='black')
            x += largura
        x += largura_fina

    try:
        fonte = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), codigo, font=fonte)
        texto_largura = bbox[2] - bbox[0]
    except Exception:
        fonte = None
        texto_largura = len(codigo) * 6

    draw.text(((largura_total - texto_largura) / 2, margem + altura_barra + 5), codigo, fill='black', font=fonte)

    buffer = BytesIO()
    imagem.save(buffer, format='PNG')
    return ContentFile(buffer.getvalue())
