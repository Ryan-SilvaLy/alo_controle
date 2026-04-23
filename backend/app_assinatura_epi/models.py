from django.db import models

from app_controle.models import RegistroSaida, RegistroSaidaItem
from app_item.models import Item
from app_usuario.models import Usuario


class AssinaturaEpiCompetencia(models.Model):
    STATUS_CHOICES = [
        ('aberta', 'Aberta'),
        ('fechada', 'Fechada'),
    ]

    solicitante_nome = models.CharField(max_length=60)
    mes_referencia = models.PositiveSmallIntegerField()
    ano_referencia = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='aberta')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-ano_referencia', '-mes_referencia', 'solicitante_nome']
        constraints = [
            models.UniqueConstraint(
                fields=['solicitante_nome', 'mes_referencia', 'ano_referencia'],
                name='unique_assinatura_epi_competencia'
            )
        ]

    def save(self, *args, **kwargs):
        if self.solicitante_nome:
            self.solicitante_nome = self.solicitante_nome.upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.solicitante_nome} - {self.mes_referencia:02d}/{self.ano_referencia}'


class AssinaturaEpiLancamento(models.Model):
    competencia = models.ForeignKey(
        AssinaturaEpiCompetencia,
        on_delete=models.CASCADE,
        related_name='lancamentos'
    )
    movimentacao_saida = models.ForeignKey(
        RegistroSaida,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assinaturas_epi_lancamentos'
    )
    movimentacao_saida_item = models.OneToOneField(
        RegistroSaidaItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assinatura_epi_lancamento'
    )
    movimentacao_saida_id_original = models.PositiveBigIntegerField()
    movimentacao_saida_item_id_original = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True, related_name='assinaturas_epi_lancamentos')
    item_id_original = models.PositiveBigIntegerField(null=True, blank=True)
    nome_item_snapshot = models.CharField(max_length=100)
    grupo_item_snapshot = models.CharField(max_length=60)
    quantidade = models.DecimalField(max_digits=10, decimal_places=2)
    data_saida = models.DateTimeField()
    numero_bloco_requisicao = models.CharField(max_length=15)
    setor_nome_snapshot = models.CharField(max_length=50)
    responsavel_nome_snapshot = models.CharField(max_length=40)
    solicitante_nome_snapshot = models.CharField(max_length=60)
    patrimonio_snapshot = models.CharField(max_length=50, blank=True, null=True)
    foi_impresso = models.BooleanField(default=False)
    impresso_em = models.DateTimeField(null=True, blank=True)
    ativo = models.BooleanField(default=True)
    cancelado_em = models.DateTimeField(null=True, blank=True)
    cancelado_motivo = models.CharField(max_length=255, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_saida', '-id']

    def save(self, *args, **kwargs):
        for field_name in [
            'nome_item_snapshot',
            'grupo_item_snapshot',
            'setor_nome_snapshot',
            'responsavel_nome_snapshot',
            'solicitante_nome_snapshot',
        ]:
            value = getattr(self, field_name, None)
            if value:
                setattr(self, field_name, value.upper())
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.solicitante_nome_snapshot} - {self.nome_item_snapshot}'


class AssinaturaEpiRelatorio(models.Model):
    STATUS_ASSINATURA_CHOICES = [
        ('pendente_assinatura', 'Pendente Assinatura'),
        ('assinado', 'Assinado'),
    ]

    competencia = models.ForeignKey(
        AssinaturaEpiCompetencia,
        on_delete=models.CASCADE,
        related_name='relatorios'
    )
    solicitante_nome = models.CharField(max_length=60)
    mes_referencia = models.PositiveSmallIntegerField()
    ano_referencia = models.PositiveSmallIntegerField()
    sequencia_relatorio = models.PositiveIntegerField()
    status_assinatura = models.CharField(
        max_length=25,
        choices=STATUS_ASSINATURA_CHOICES,
        default='pendente_assinatura'
    )
    gerado_em = models.DateTimeField(auto_now_add=True)
    gerado_por = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assinaturas_epi_relatorios_gerados'
    )
    assinado_em = models.DateTimeField(null=True, blank=True)
    assinado_por = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assinaturas_epi_relatorios_assinados'
    )

    class Meta:
        ordering = ['-ano_referencia', '-mes_referencia', '-sequencia_relatorio', '-gerado_em']
        constraints = [
            models.UniqueConstraint(
                fields=['competencia', 'sequencia_relatorio'],
                name='unique_assinatura_epi_relatorio_por_competencia'
            )
        ]

    def save(self, *args, **kwargs):
        if self.solicitante_nome:
            self.solicitante_nome = self.solicitante_nome.upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Relatório {self.sequencia_relatorio} - {self.solicitante_nome}'


class AssinaturaEpiRelatorioItem(models.Model):
    relatorio = models.ForeignKey(
        AssinaturaEpiRelatorio,
        on_delete=models.CASCADE,
        related_name='itens_relatorio'
    )
    lancamento = models.ForeignKey(
        AssinaturaEpiLancamento,
        on_delete=models.PROTECT,
        related_name='relatorios_item'
    )

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(
                fields=['relatorio', 'lancamento'],
                name='unique_assinatura_epi_relatorio_item'
            )
        ]

    def __str__(self):
        return f'Relatório {self.relatorio_id} - Lançamento {self.lancamento_id}'
