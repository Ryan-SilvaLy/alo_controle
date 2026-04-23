import os
import django

# Configuração do Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema.settings')  # Substitua 'sistema.settings' pelo seu arquivo de configurações
django.setup()

import random
from app_item.models import TipoItem, Item  # Troque "app_item" pelo nome do seu app

# Criar Tipos de Item
tipos_nomes = [
    "Equipamento", "Material de Escritório", "Material de Limpeza", "Alimentos e Bebidas",
    "Ferramentas", "Segurança", "Manutenção", "Eletrônicos", "Higiene Pessoal", "Outros"
]

tipos = []
for nome in tipos_nomes:
    tipo, _ = TipoItem.objects.get_or_create(nome=nome)
    tipos.append(tipo)

print(f"{len(tipos)} tipos criados ou já existentes.")

# Lista de nomes fictícios para os itens
nomes_itens = [
    "Notebook Dell", "Monitor LG", "Teclado Mecânico", "Mouse sem fio", "Impressora HP",
    "Projetor Epson", "Cadeira Ergonômica", "Mesa de Escritório", "Caneta Azul", "Caneta Preta",
    "Lápis HB", "Borracha Branca", "Papel A4", "Post-it Colorido", "Grampeador",
    "Caixa de Clips", "Marcador de Texto", "Pasta Suspensa", "Envelope Pardo", "Tesoura",
    "Álcool 70%", "Detergente", "Sabão em Pó", "Esponja Multiuso", "Pano de Limpeza",
    "Água Sanitária", "Desinfetante", "Luvas de Borracha", "Rodo", "Vassoura",
    "Cabo HDMI", "HD Externo", "Pendrive 32GB", "Fone de Ouvido", "Caixa de Som",
    "Extensão Elétrica", "Carregador Universal", "Câmera de Segurança", "Microfone", "Webcam",
    "Copo Descartável", "Prato Descartável", "Colher Descartável", "Café Solúvel", "Açúcar",
    "Achocolatado", "Filtro de Papel", "Chá Verde", "Biscoito Cream Cracker", "Água Mineral"
]

# Criar 50 itens
for i in range(50):
    nome = nomes_itens[i % len(nomes_itens)]
    codigo = f"ITEM{i+1:03d}"
    prateleira = f"{chr(65 + (i % 5))}{(i % 10) + 1}"  # Ex: A1, B5, C3
    quantidade_atual = random.randint(1, 200)
    quantidade_minima = random.randint(1, 20)
    situacao = "ok" if quantidade_atual >= quantidade_minima else "baixo"

    Item.objects.get_or_create(
        codigo=codigo,
        defaults={
            "nome": nome,
            "descricao": f"{nome} - item de exemplo {i+1}",
            "tipo_item": random.choice(tipos),
            "prateleira_estoque": prateleira,
            "quantidade_atual": quantidade_atual,
            "quantidade_minima": quantidade_minima,
            "situacao": situacao,
            "codigo_barras": f"BARCODE{i+1:05d}",
        },
    )

print("10 tipos de item e 50 itens cadastrados com sucesso!")
