from django.db import models
from django.contrib.auth.models import AbstractUser
import logging
logging.basicConfig(level=logging.DEBUG)

# vinicius
# v25045932

class Usuario(AbstractUser):
    '''
    - `AbstractUser` -> Modelo de usuario do Django. Por padrão possuí campos como `username` e`password`.
    '''

    NIVEL_PERMISSAO_CHOICES = [
        ('administrador', 'Administrador'), # faz tudo
        ('moderador', 'Moderador'),        # Gestor / Supervisor, Faz tudo
        ('almoxarifado', 'Almoxarifado'),  # Tudo exceto alterar status do pedido
        ('compra', 'Compra'),               # Visualiza estoque, altera status do pedido
        ('comercial', 'Comercial'),         # Apenas visualização
    ]

    nome = models.CharField(verbose_name='Nome', max_length=50)
    cargo = models.CharField(verbose_name='Cargo', max_length=50)
    nivel_permissao = models.CharField(verbose_name='Nível de Permissão', max_length=30, choices=NIVEL_PERMISSAO_CHOICES, default='administrador')
    setor = models.CharField(verbose_name='Setor', max_length=50)

    
    def __str__(self):
        return f"{self.nome} - {self.get_nivel_permissao_display()}"
    

    def save(self, *args, **kwargs):
        self.username = self.username.lower()
        self.nome = self.nome.upper()
        self.cargo = self.cargo.upper()
        self.setor = self.setor.upper()
        
        nivel_permissao_legivel = self.get_nivel_permissao_display()
        logging.debug(f'Salvando / Criando Novo Usuario\n Nome de Usuario: {self.nome}, Nivel de Permissão: {nivel_permissao_legivel}')

        super().save(*args, **kwargs)


class Log(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='logs')
    acao = models.CharField(max_length=150)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.usuario.username} - {self.acao} - {self.criado_em}'