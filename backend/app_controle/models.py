from django.db import models
from app_usuario.models import Usuario
from app_item.models import Item
from app_produto.models import Produto
import logging
logging.basicConfig(level=logging.DEBUG)


class NotaFiscal(models.Model):
    '''
        - Contém Informações do cabeçalho da nota fiscal.
    '''

    numero_nota = models.CharField(verbose_name='Número da Nota Fiscal', max_length=30, unique=True)
    nome_fornecedor = models.CharField(verbose_name='Nome do Fornecedor', max_length=100)
    cnpj_cpf = models.CharField(verbose_name='CNPJ ou CPF do Fornecedor', max_length=14)
    criado_em = models.DateTimeField(verbose_name='Criado em', auto_now_add=True)
    atualizado_em = models.DateTimeField(verbose_name='Atualizado em', auto_now=True)


    def __str__(self):
        return f"Nota {self.numero_nota} - {self.nome_fornecedor}"
    
    def save(self, *args, **kwargs):
        logging.debug(f'Salvando / Criando Nota Fiscal: numero_nota: {self.numero_nota} | nome_fornecedor: {self.nome_fornecedor}')
        super().save(*args, **kwargs)


class RegistroEntrada(models.Model):
    '''
        - Contém o número da Nota Fiscal caso exista. A opção de Null, é porque nem sempre uma entrada vai ser de uma Nota Fiscal, ou compra, pode ser outra coisa como um acerto de estoque.
        - Unique=True em nota fiscal, pois uma nota fiscal deve estar vinculada somente a um registro de entrada.
    '''
    
    nota_fiscal = models.ForeignKey(NotaFiscal, on_delete=models.SET_NULL, unique=True, null=True, blank=True, verbose_name='Nota Fiscal', help_text='Pode ser vazio se não houver nota fiscal')
    recebido_por = models.CharField(verbose_name='Recebido por', max_length=40)
    data_entrada = models.DateTimeField(verbose_name='Data da Entrada', auto_now_add=True)
    observacao = models.TextField(verbose_name='Observação', blank=True, null=True)
    registrado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='registro_entrada_registrado_por', verbose_name='Registrado por')
    alterado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='registro_entrada_alterado_por', verbose_name='Alterado por')
    criado_em = models.DateTimeField(verbose_name='Criado em', auto_now_add=True)
    atualizado_em = models.DateTimeField(verbose_name='Atualizado em', auto_now=True)

    def __str__(self):
        return f"Entrada #{self.id} - Recebido por {self.recebido_por}"

    def save(self, *args, **kwargs):
        self.recebido_por = self.recebido_por.upper()
        
        logging.debug(f'Registrando Entrada - Nota Fiscal: {self.nota_fiscal} | Recebido por: {self.recebido_por}')

        super().save(*args, **kwargs)


class RegistroEntradaItem(models.Model):
    ''' 
    Relação do Registro da Entrada com a tabela de Item. 
        - Contém o campo de quantidade, pois cada item tem uma quantidade especifica.
    '''

    registro_entrada = models.ForeignKey(RegistroEntrada, on_delete=models.CASCADE, related_name='itens', verbose_name='Registro de Entrada')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, verbose_name='Item')
    quantidade = models.DecimalField(
        verbose_name='Quantidade Recebida',
        max_digits=10,    # total de dígitos
        decimal_places=2  # número de casas decimais
    )
    criado_em = models.DateTimeField(verbose_name='Criado em', auto_now_add=True)

    def __str__(self):
        return f"{self.quantidade}x {self.item.nome} (Entrada #{self.registro_entrada.id})"



class RegistroSaida(models.Model):
    ''' 
        - Bloco de requisição é um número sem vinculo, registrado baseado em um papel fisico.
        - No bloco contém informações como setor e resposavel para onde o material vai ser levado.
    '''

    bloco_requisicao = models.CharField(verbose_name='Bloco de Requisição (Código)', max_length=15, unique=True)
    setor = models.CharField(verbose_name='Setor Destino', max_length=50)
    responsavel = models.CharField(verbose_name='Responsável pelo Setor', max_length=40)
    data_saida = models.DateTimeField(verbose_name='Data da Saída', auto_now_add=True)
    observacao = models.TextField(verbose_name='Observação', blank=True, null=True)
    registrado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='registro_saida_registrado_por', verbose_name='Registrado por')
    alterado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='registro_saida_alterado_por', verbose_name='Alterado por')
    criado_em = models.DateTimeField(verbose_name='Criado em', auto_now_add=True)
    atualizado_em = models.DateTimeField(verbose_name='Atualizado em', auto_now=True)

    def __str__(self):
        return f'Saída #{self.id} - {self.data_saida.strftime("%d/%m/%Y %H:%M")}'
        

    def save(self, *args, **kwargs):
        self.setor = self.setor.upper()
        self.responsavel = self.responsavel.upper()
        
        logging.debug(f'Registrando Saída - Bloco de Requisição: {self.bloco_requisicao} | Setor Destino: {self.setor} | Responsável: {self.responsavel}')
        super().save(*args, **kwargs)


class RegistroSaidaItem(models.Model):
    ''' Relação entre o registro de saída com os itens que estão saindo do estoque, cada um com a sua quantidade especifica.'''
    
    registro_saida = models.ForeignKey(RegistroSaida, on_delete=models.CASCADE, related_name='itens', verbose_name='Registro de Saída')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, verbose_name='Item') # Vai conter codigo, nome, descrição por exemplo
    # Cada item, possui uma quantidade especifica.
    quantidade = models.DecimalField(
        verbose_name='Quantidade Saída',
        max_digits=10,    # total de dígitos
        decimal_places=2  # número de casas decimais
    )
    solicitante = models.CharField(verbose_name='Solicitante do Item', max_length=30)
    patrimonio = models.CharField(verbose_name='Patrimônio', max_length=30, blank=True, null=True)

    def __str__(self):
        return f'{self.quantidade}x {self.item.nome} na saída {self.registro_saida.id}'
