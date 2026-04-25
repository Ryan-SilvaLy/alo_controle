# ALO Controle

Sistema de controle de almoxarifado com estoque, movimentacoes, pedidos, compras, custos e relatorios.

O projeto e dividido em:

- `backend/`: API Django + Django REST Framework.
- `frontend/`: aplicacao Angular.

## Modulos Principais

### Estoque e Itens

Cadastro e manutencao dos itens do almoxarifado.

Arquivos principais:

- `backend/app_item/models.py`
- `backend/app_item/apis/`
- `frontend/src/app/components/item/`
- `frontend/src/app/services/item.service.ts`

Campos importantes:

- codigo
- nome
- grupo/tipo do item
- quantidade atual
- quantidade minima
- valor unitario
- unidade de medida

O campo `valor_unitario` alimenta os calculos financeiros dos relatorios.

### Controle de Estoque

Modulo para entradas e saidas do estoque.

Arquivos principais:

- `backend/app_controle/models.py`
- `backend/app_controle/apis/`
- `frontend/src/app/components/controle/`
- `frontend/src/app/services/controle.service.ts`

Telas principais:

- `frontend/src/app/components/controle/iniciar-controle/`
- `frontend/src/app/components/controle/registrar-entrada/`
- `frontend/src/app/components/controle/registrar-saida/`

O perfil `compra` pode acessar a tela de controle apenas para consulta. Ele nao pode registrar, editar ou excluir entrada/saida.

### Pedidos

Modulo para criacao, acompanhamento e fluxo de compras dos pedidos.

Arquivos principais:

- `backend/app_pedido/models.py`
- `backend/app_pedido/apis/rest_views.py`
- `backend/app_pedido/apis/serializers.py`
- `frontend/src/app/components/pedido/`
- `frontend/src/app/services/pedido.service.ts`

Status do pedido:

- `pendente`: criado e ainda nao enviado para compras.
- `enviado`: liberado para o usuario de compras visualizar.
- `visto`: compras registrou ciencia do pedido.
- `negado`: compras negou o pedido, com motivo.
- `cancelado`: encerrado por usuarios de gestao/almoxarifado.

Campos de prova do fluxo de compras:

- `compras_visto_por`
- `compras_visto_em`
- `compras_negado_por`
- `compras_negado_em`
- `compras_motivo_negado`

Esses campos ajudam o almoxarifado a comprovar que compras teve ciencia do pedido.

### Relatorios

Dashboard financeiro e operacional do almoxarifado.

Arquivos principais:

- `frontend/src/app/components/produto/dashboard-produto/`

O relatorio calcula:

- valor atual do estoque;
- valor estimado das entradas;
- valor estimado das saidas;
- saldo financeiro do periodo;
- ticket medio de entrada e saida;
- evolucao mensal dos custos;
- custo por grupo;
- fornecedores por valor;
- itens com maior custo de saida.

O perfil `compra` tem acesso aos relatorios.

### Usuarios e Permissoes

Este e o ponto mais importante para manutencao futura.

## Onde Mexer em Niveis de Permissao

O sistema usa o campo `nivel_permissao` do usuario.

### 1. Backend: definir quais niveis existem

Arquivo:

```text
backend/app_usuario/models.py
```

Procure por:

```python
NIVEL_PERMISSAO_CHOICES = [
    ('administrador', 'Administrador'),
    ('moderador', 'Moderador'),
    ('almoxarifado', 'Almoxarifado'),
    ('compra', 'Compra'),
    ('comercial', 'Comercial'),
]
```

Se quiser criar um novo nivel de login, adicione nesse array.

Depois rode:

```bash
python manage.py makemigrations
python manage.py migrate
```

### 2. Backend: validar permissao em regras de negocio

Algumas regras nao ficam apenas na tela; tambem sao protegidas na API.

Exemplo importante:

```text
backend/app_pedido/apis/rest_views.py
```

Procure por:

```python
NIVEIS_GESTAO_PEDIDO = {'administrador', 'moderador', 'almoxarifado'}
```

Esse conjunto controla quem pode alterar o status geral de pedidos.

Tambem nesse arquivo:

- usuario `compra` ve pedidos enviados/vistos/negados;
- usuario `compra` pode marcar pedido como visto;
- usuario `compra` pode negar pedido.

### 3. Frontend: liberar ou bloquear rotas

Arquivo:

```text
frontend/src/app/app.routes.ts
```

Procure por blocos assim:

```ts
canActivate: [permissionGuard],
data: { permissoes: ['administrador', 'moderador', 'almoxarifado'] }
```

Para liberar uma tela para compras, inclua `compra`:

```ts
data: { permissoes: ['administrador', 'moderador', 'almoxarifado', 'compra'] }
```

Exemplos atuais:

- `compra` pode acessar pedidos;
- `compra` pode acessar relatorios;
- `compra` pode acessar controle apenas para consulta;
- `compra` nao pode registrar entrada/saida;
- `compra` nao pode editar movimentacoes de estoque.

### 4. Frontend: esconder ou mostrar botoes

Arquivo da diretiva:

```text
frontend/src/app/directives/has-permission.directive.ts
```

Uso nas telas:

```html
*appHasPermission="['administrador', 'moderador', 'almoxarifado']"
```

Exemplo:

```html
<button *appHasPermission="['administrador', 'almoxarifado']">
  Criar Item
</button>
```

Isso controla apenas a exibicao visual. Para regra critica, proteja tambem no backend.

### 5. Frontend: logica por perfil dentro do componente

Algumas telas usam o usuario logado diretamente.

Exemplos:

```text
frontend/src/app/components/pedido/iniciar-pedido/iniciar-pedido.component.ts
frontend/src/app/components/controle/iniciar-controle/iniciar-controle.component.ts
```

No controle, por exemplo:

```ts
podeOperarEstoque
```

Esse getter define quem pode criar/editar movimentacoes. Hoje:

```ts
['administrador', 'moderador', 'almoxarifado']
```

O perfil `compra` fica fora, entao so consulta.

## Como Rodar o Projeto

### Backend

Entre na pasta:

```bash
cd backend
```

Ative o ambiente virtual, se estiver usando Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Instale dependencias:

```bash
pip install -r requirements.txt
```

Rode migrations:

```bash
python manage.py migrate
```

Suba o servidor:

```bash
python manage.py runserver
```

API padrao:

```text
http://127.0.0.1:8000/
```

### Frontend

Entre na pasta:

```bash
cd frontend
```

Instale dependencias:

```bash
npm install
```

Suba o Angular:

```bash
npm start
```

Build de producao:

```bash
npm run build
```

Importante: `npm run build` deve ser executado dentro da pasta `frontend/`, nao dentro de `backend/`.

## Warnings Conhecidos do Build

Durante `npm run build`, o Angular pode exibir avisos sobre:

- CommonJS/AMD em `canvg`, `html2canvas`, `jspdf`, `raf`, `rgbcolor`;
- budgets de CSS/bundle;
- seletores de CSS vindos de biblioteca;
- optional chaining em tela de admin.

Esses avisos nao impedem o sistema de rodar se aparecer:

```text
Application bundle generation complete.
```

## Migrations Importantes

Sempre que alterar models Django:

```bash
python manage.py makemigrations
python manage.py migrate
```

Se mexer em pedidos, confira:

```text
backend/app_pedido/migrations/
```

Se mexer em itens/valor unitario, confira:

```text
backend/app_item/migrations/
```

## Mapa Rapido de Arquivos

### Backend

- Usuarios: `backend/app_usuario/`
- Itens: `backend/app_item/`
- Controle de estoque: `backend/app_controle/`
- Pedidos: `backend/app_pedido/`
- Produtos/fornecedores: `backend/app_produto/`
- Configuracoes Django: `backend/sistema/settings.py`
- Rotas principais: `backend/urls.py`

### Frontend

- Rotas/permissoes: `frontend/src/app/app.routes.ts`
- Login/auth: `frontend/src/app/services/authentication.service.ts`
- Guard de permissao: `frontend/src/app/guards/auth.guard.ts`
- Diretiva de permissao visual: `frontend/src/app/directives/has-permission.directive.ts`
- Navbar: `frontend/src/app/components/navbar/`
- Estoque: `frontend/src/app/components/item/`
- Controle: `frontend/src/app/components/controle/`
- Pedidos: `frontend/src/app/components/pedido/`
- Relatorios: `frontend/src/app/components/produto/dashboard-produto/`

## Checklist Antes de Entregar Alteracoes

1. Rodar migrations se mexeu no backend:

```bash
python manage.py migrate
```

2. Rodar build do frontend:

```bash
cd frontend
npm run build
```

3. Testar pelo menos estes perfis:

- `administrador`
- `almoxarifado`
- `compra`

4. Conferir principalmente:

- se o usuario ve apenas o menu correto;
- se uma rota proibida realmente bloqueia acesso;
- se botoes perigosos nao aparecem para perfis sem permissao;
- se a API tambem bloqueia operacoes criticas.

## Observacao de Manutencao

Para regras importantes, nao confie apenas em esconder botao no Angular.

O ideal e sempre aplicar a permissao em dois lugares:

- frontend: para melhorar a experiencia e esconder o que o usuario nao deve usar;
- backend: para impedir acesso direto via API.
