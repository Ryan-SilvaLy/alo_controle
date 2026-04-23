from django.db import models


class Produto(models.Model): 

    patrimonio = models.CharField(max_length=30, unique=True)
    nome = models.CharField(max_length=100)
    nome_cliente = models.CharField(max_length=100)
    tempo_contrato = models.DateField()
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)


    def __str__(self):
        return f'{self.nome} ({self.patrimonio})'