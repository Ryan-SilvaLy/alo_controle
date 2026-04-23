# Sistema de Estoque

Sistema web para controle de estoque, movimentacoes, pedidos de compra, fornecedores e administracao de usuarios.

O projeto foi pensado para uso operacional no dia a dia do almoxarifado, com foco em:
- cadastro e controle de itens
- entradas e saidas de estoque
- acompanhamento de itens em baixa
- geracao e acompanhamento de pedidos
- leitura gerencial por dashboard
- controle de usuarios e permissoes

## Finalidade do projeto

Este sistema centraliza o fluxo de estoque em um unico ambiente.

Na pratica, ele permite:
- manter o cadastro dos itens do estoque organizado por tipo
- registrar entradas com ou sem nota fiscal
- registrar saidas com bloco, setor, responsavel e solicitante
- acompanhar automaticamente itens com estoque abaixo do minimo
- agrupar necessidade de compra por grupo de item
- visualizar fornecedores a partir das notas fiscais de entrada
- consultar indicadores gerenciais no dashboard

## Stack do projeto

### Frontend
- Angular
- TypeScript
- Tailwind/CSS utilitario misturado com estilos locais
- jsPDF / jspdf-autotable para PDFs

### Backend
- Django
- Django REST Framework

## Estrutura principal

```text
backend/
frontend/
```

- `backend/`: regras de negocio, API, models, serializers, services e comandos de suporte
- `frontend/`: interface do usuario, telas, modais, dashboard e servicos de consumo da API

## Como rodar o projeto

### Backend

```powershell
cd backend
python manage.py migrate
python manage.py runserver
```

### Frontend

```powershell
cd frontend
npm install
npm start
```

### Build do frontend

```powershell
cd frontend
npm run build
```

## Modulos do sistema

### 1. Login

Tela de autenticacao do usuario.

Responsavel por:
- validar acesso
- iniciar sessao
- liberar rotas conforme permissao

Arquivo principal:
- `frontend/src/app/components/login/login.component.*`

### 2. Navbar

Barra principal de navegacao do sistema.

Responsavel por:
- mostrar os modulos disponiveis
- exibir informacoes do usuario logado
- facilitar a navegacao entre telas

Arquivo principal:
- `frontend/src/app/components/navbar/navbar.component.*`

### 3. Itens

Modulo principal de cadastro e consulta do estoque.

#### Tela: Iniciar Itens

Rota:
- `/item/iniciar`

Finalidade:
- listar todos os itens cadastrados
- filtrar por nome, codigo, codigo de barras, tipo, prateleira, situacao e status
- abrir modal de criacao
- abrir modal de atualizacao
- alterar status do item
- emitir PDF de itens em baixa

Arquivos:
- `frontend/src/app/components/item/iniciar-item/iniciar-item.component.*`

#### Tela: Criar Item

Rota:
- usada como modal dentro da tela de itens

Finalidade:
- cadastrar novo item no estoque
- vincular tipo de item
- definir quantidade atual, quantidade minima e unidade

Arquivos:
- `frontend/src/app/components/item/criar-item/criar-item.component.*`

#### Tela: Atualizar Item

Rota:
- usada como modal dentro da tela de itens

Finalidade:
- editar dados de um item ja cadastrado

Arquivos:
- `frontend/src/app/components/item/atualizar-item/atualizar-item.component.*`

#### Tela: Tipos de Item

Rota:
- `/item/iniciar-tipo-item`

Finalidade:
- cadastrar tipos/grupos de item
- editar tipo existente
- excluir tipos sem relacionamento com itens

Arquivos:
- `frontend/src/app/components/item/iniciar-tipo-item/iniciar-tipo-item.component.*`
- `frontend/src/app/components/item/modal-tipo-item/modal-tipo-item.component.*`

#### Tela: Estoque Baixo

Rota:
- `/item/estoque-baixo`

Finalidade:
- exibir os itens abaixo da quantidade minima
- gerar PDF agrupado por tipo

Arquivos:
- `frontend/src/app/components/item/estoque-baixo/estoque-baixo.component.*`

### 4. Pedidos

Modulo de pedidos de compra.

#### Tela: Listagem de Pedidos

Rota:
- `/pedido/listar`

Finalidade:
- listar pedidos por grupo
- filtrar por status, grupo e busca textual
- visualizar impressao
- editar pedido
- alterar status do pedido

Arquivos:
- `frontend/src/app/components/pedido/iniciar-pedido/iniciar-pedido.component.*`

#### Tela: Criar Pedido

Rota:
- `/pedido/criar`

Finalidade:
- montar pedido manual
- garantir que todos os itens pertencam ao mesmo grupo
- revisar os itens antes de confirmar

Arquivos:
- `frontend/src/app/components/pedido/criar-pedido/criar-pedido.component.*`
- `frontend/src/app/components/pedido/modal-confirmar-pedido/modal-confirmar-pedido.component.*`

#### Tela: Atualizar Pedido

Rota:
- `/pedido/atualizar`

Finalidade:
- editar dados e itens de um pedido existente

Arquivos:
- `frontend/src/app/components/pedido/atualizar-pedido/atualizar-pedido.component.*`

### 5. Controle de Movimentacoes

Modulo operacional de entrada e saida de estoque.

#### Tela: Painel de Controle

Rota:
- `/controle/iniciar`

Finalidade:
- consultar movimentacoes por item
- pesquisar entradas e saidas
- abrir entrada e saida em modal
- visualizar, editar, excluir e imprimir movimentacoes

Arquivos:
- `frontend/src/app/components/controle/iniciar-controle/iniciar-controle.component.*`

#### Tela: Registrar Entrada

Rota:
- `/controle/registrar-entrada`
- `/controle/editar-entrada/:id`

Finalidade:
- registrar recebimento de itens
- opcionalmente vincular nota fiscal
- capturar nome do fornecedor e CNPJ/CPF
- editar uma entrada existente

Arquivos:
- `frontend/src/app/components/controle/registrar-entrada/registrar-entrada.component.*`

#### Tela: Registrar Saida

Rota:
- `/controle/registrar-saida`
- `/controle/editar-saida/:id`

Finalidade:
- registrar saida de itens
- vincular bloco de requisicao, setor, responsavel e solicitante
- editar uma saida existente

Arquivos:
- `frontend/src/app/components/controle/registrar-saida/registrar-saida.component.*`

### 6. Produtos / Relatorios

Esse modulo deixou de ser um CRUD simples e passou a concentrar visoes de apoio a estoque e fornecedores.

#### Tela: Painel de Produtos

Rota:
- `/produto/iniciar`

Finalidade:
- exibir todos os itens cadastrados no estoque
- mostrar quanto entrou e quanto saiu por item
- consolidar movimentacoes por item
- servir como ponto de acesso para fornecedores

Arquivos:
- `frontend/src/app/components/produto/iniciar-produto/iniciar-produto.component.*`

#### Tela: Fornecedores

Rota:
- `/produto/criar`

Finalidade:
- consolidar fornecedores a partir das entradas com nota fiscal
- mostrar nome do fornecedor, CNPJ/CPF, entregas, notas e volumes recebidos

Arquivos:
- `frontend/src/app/components/produto/fornecedor-produto/fornecedor-produto.component.*`

#### Tela: Dashboard

Rota:
- `/produto/dashboard`

Finalidade:
- apresentar indicadores reais de estoque
- mostrar resumo de entradas, saidas, pedidos e grupos
- destacar itens criticos
- mostrar setores e solicitantes que mais pedem
- mostrar itens que mais saem
- exibir radares circulares de entradas e saidas

Arquivos:
- `frontend/src/app/components/produto/dashboard-produto/dashboard-produto.component.*`

### 7. Administracao

Modulo de controle de usuarios e permissoes.

#### Tela: Iniciar Admin

Rota:
- `/admin/iniciar`

Finalidade:
- listar usuarios cadastrados
- editar usuario
- excluir usuario

Arquivos:
- `frontend/src/app/components/admin/iniciar-admin/iniciar-admin.component.*`

#### Tela: Criar Usuario

Rota:
- `/admin/criar-usuario`

Finalidade:
- cadastrar novo usuario com cargo, setor e nivel de permissao

Arquivos:
- `frontend/src/app/components/admin/criar-usuario/criar-usuario.component.*`

#### Tela: Atualizar Usuario

Rota:
- `/admin/atualizar-usuario`

Finalidade:
- editar dados de um usuario existente

Arquivos:
- `frontend/src/app/components/admin/atualizar-usuario/atualizar-usuario.component.*`

### 8. Logs

Rota:
- `/logs`

Finalidade:
- concentrar consultas administrativas e historico, conforme as regras do sistema

Arquivos:
- `frontend/src/app/components/logs/logs.component.*`

## Regras de negocio importantes

Algumas regras centrais do sistema:

- itens possuem quantidade minima para definir situacao de estoque
- itens em baixa podem alimentar pedidos automaticamente por grupo
- um pedido deve manter itens do mesmo grupo
- tipos de item em uso nao devem ser excluidos
- entradas podem existir com ou sem nota fiscal
- fornecedores sao consolidados a partir das notas fiscais registradas
- permissoes controlam o acesso por modulo e por tela

## PDFs e impressao

Os PDFs do frontend sao gerados pelo servico:
- `frontend/src/app/shared/pdf/pdf.service.ts`

Estilo de impressao:
- `frontend/src/assets/print.scss`

Arquivos gerados via `doc.save(...)` normalmente sao baixados para:
- pasta de downloads do navegador/sistema operacional

## Controle de acesso

O sistema usa:
- `authGuard`
- `permissionGuard`

Arquivo:
- `frontend/src/app/app.routes.ts`

As rotas sao liberadas conforme niveis como:
- `administrador`
- `moderador`
- `almoxarifado`
- `compra`
- `comercial`

## Pontos de evolucao

Proximos passos naturais para o projeto:
- documentar a API do backend por modulo
- incluir fluxos de cadastro/atualizacao por diagrama
- adicionar screenshots das telas
- criar changelog funcional por versao
- detalhar regras automaticas de pedido por estoque baixo

## Observacao

Este README documenta a estrutura e a finalidade atual do projeto com base na implementacao existente no repositorio.

## CONTROLE DE EPI'S

backend/
  app_assinatura_epi/
    models.py
    serializers.py
    views.py
    urls.py
    services.py
    selectors.py
    permissions.py

    frontend/src/app/components/assinatura-epi/
  iniciar-assinatura-epi/
  detalhe-assinatura-epi/
  historico-relatorio-epi/



Quero implementar um novo módulo chamado Controle de Assinaturas de EPI no meu sistema.

Contexto do sistema:
- O sistema já possui cadastro de itens com campo de grupo/tipo.
- O sistema já possui movimentação de saída com os campos:
  - solicitante
  - responsável
  - setor
  - número do bloco/requisição (único)
- Stack atual:
  - Frontend: Angular
  - Backend: Django + Django REST Framework
- Já existe geração de PDF no frontend (jsPDF), que deve ser reaproveitada.

OBJETIVO GERAL:
Criar um controle automático de retirada de EPIs baseado EXCLUSIVAMENTE nas movimentações de saída, gerando relatórios mensais por solicitante, com histórico, controle de impressão e status de assinatura.

IMPORTANTE:
- NÃO deve existir cadastro manual de lançamentos de EPI.
- TUDO deve nascer da movimentação de saída.

--------------------------------------------------

# REGRA PRINCIPAL

Sempre que uma movimentação de saída for criada:

1. Verificar o item da saída
2. Verificar o grupo/tipo do item
3. Se o grupo/tipo for "EPI":
   - Registrar automaticamente essa retirada no controle de assinatura de EPI

--------------------------------------------------

# AGRUPAMENTO

Os dados devem ser agrupados por:

- solicitante
- mês da saída
- ano da saída

Isso forma uma "competência mensal".

Exemplo:
Solicitante: João Silva
Competência: 04/2026

--------------------------------------------------

# REGRAS DE NEGÓCIO (OBRIGATÓRIAS)

1. Apenas itens do grupo EPI entram no controle.
2. Cada movimentação de saída deve gerar um lançamento único.
3. Não pode existir duplicidade da mesma movimentação.
4. O mesmo item pode aparecer novamente se for outra movimentação (normal).
5. O número do bloco/requisição é OBRIGATÓRIO e deve ser usado como identificador visível no relatório.
6. O sistema nunca deve misturar dados de meses diferentes no mesmo relatório.
7. Não pode existir inclusão manual de lançamentos.
8. Todo lançamento deve estar vinculado à movimentação original.

--------------------------------------------------

# REGRA DE EDIÇÃO E EXCLUSÃO (CRÍTICA)

1. Se a saída for editada antes de ser impressa:
   - atualizar o lançamento automaticamente

2. Se a saída deixar de ser EPI:
   - remover o lançamento SE ainda não foi impresso

3. Se a saída já estiver em relatório impresso:
   - NÃO apagar histórico
   - manter rastreabilidade
   - pode marcar como cancelado/inativo, mas nunca excluir fisicamente

4. Se a saída for excluída:
   - se não foi impressa → remover lançamento
   - se já foi impressa → manter histórico com rastreabilidade

--------------------------------------------------

# LÓGICA DE IMPRESSÃO (PARTE MAIS IMPORTANTE)

NÃO existe "um único relatório mensal fixo".

Existe:

- Competência mensal (por solicitante)
- Múltiplas impressões dentro do mês
- Controle de itens já impressos

--------------------------------------------------

# COMO FUNCIONA A IMPRESSÃO

Ao gerar um relatório:

1. Buscar apenas lançamentos com:
   - foi_impresso = false

2. Criar um registro de histórico de relatório

3. Vincular os lançamentos ao relatório

4. Marcar:
   - foi_impresso = true
   - impresso_em = data atual

5. Gerar PDF

--------------------------------------------------

# REGRA CRÍTICA (NÃO PODE FALHAR)

- Um item já impresso NUNCA pode aparecer novamente em outro relatório
- Se houver novas retiradas depois:
  - elas entram em um novo relatório

--------------------------------------------------

# EXEMPLO REAL

João retirou:

02/04 → luva  
10/04 → óculos  
15/04 → bota  

Impressão em 15/04:
→ inclui os 3 itens  
→ marca todos como impressos  

Nova retirada:

22/04 → protetor  

Nova impressão:
→ inclui APENAS o item do dia 22  

--------------------------------------------------

# ASSINATURA

- NÃO haverá assinatura digital
- O fluxo será:

1. Gerar relatório
2. Imprimir
3. Funcionário assina no papel
4. Usuário marca manualmente como "assinado" no sistema

--------------------------------------------------

# STATUS

## Competência
- aberta
- fechada

## Relatório
- pendente_assinatura
- assinado

## Lançamento
- pendente_impressao
- impresso

--------------------------------------------------

# REIMPRESSÃO

- Deve ser possível reimprimir um relatório já gerado
- A reimpressão deve usar EXATAMENTE os mesmos itens
- NÃO pode recalcular dados

--------------------------------------------------

# FECHAMENTO DO MÊS

- Ao virar o mês:
  - novas retiradas vão para nova competência
- Competências antigas:
  - permanecem no histórico
  - não recebem novos lançamentos

--------------------------------------------------

# MODELAGEM BACKEND

## 1. AssinaturaEpiCompetencia
- solicitante_nome
- mes_referencia
- ano_referencia
- status (aberta/fechada)

## 2. AssinaturaEpiLancamento
- competencia_id
- movimentacao_saida_id
- item_id
- nome_item_snapshot
- grupo_item_snapshot
- quantidade
- data_saida
- numero_bloco_requisicao
- setor_nome_snapshot
- responsavel_nome_snapshot
- solicitante_nome_snapshot
- foi_impresso
- impresso_em

## 3. AssinaturaEpiRelatorio
- competencia_id
- solicitante_nome
- mes_referencia
- ano_referencia
- sequencia_relatorio
- status_assinatura
- gerado_em
- gerado_por
- assinado_em
- assinado_por

## 4. AssinaturaEpiRelatorioItem
- relatorio_id
- lancamento_id

--------------------------------------------------

# SERVIÇOS BACKEND

Criar serviço:

AssinaturaEpiService

Responsável por:
- processar saída
- criar competência
- criar lançamento
- evitar duplicidade
- gerar relatório
- marcar como assinado

--------------------------------------------------

# ENDPOINTS

GET /api/assinaturas-epi/competencias/  
GET /api/assinaturas-epi/competencias/{id}/  

POST /api/assinaturas-epi/competencias/{id}/gerar-relatorio/  

GET /api/assinaturas-epi/relatorios/  
GET /api/assinaturas-epi/relatorios/{id}/  

POST /api/assinaturas-epi/relatorios/{id}/marcar-assinado/  

GET /api/assinaturas-epi/relatorios/{id}/imprimir/  

--------------------------------------------------

# FRONTEND (ANGULAR)

Criar módulo:

assinatura-epi

--------------------------------------------------

## Tela principal

- filtro por:
  - solicitante
  - mês
  - ano
  - status

Tabela:

- solicitante
- competência
- status
- pendentes de impressão
- relatórios gerados
- status assinatura
- ações

Ações:
- ver detalhes
- gerar relatório
- ver histórico
- marcar como assinado

--------------------------------------------------

## Tela de detalhes

Mostrar:

- data saída
- item
- quantidade
- bloco/requisição
- setor
- responsável
- status impressão

--------------------------------------------------

## Histórico

- listar relatórios gerados
- data
- status
- botão imprimir
- botão marcar como assinado

--------------------------------------------------

# PDF

Deve conter:

- solicitante
- competência
- data geração
- número do relatório

Tabela:
- data saída
- bloco/requisição
- item
- quantidade

Rodapé:
- campo assinatura
- status
- data assinatura

--------------------------------------------------

# INTEGRAÇÃO COM SAÍDA

Ao salvar saída no backend:

- chamar AssinaturaEpiService automaticamente
- não exigir ação do usuário

Opcional no frontend:
- mensagem: "Retirada de EPI registrada no controle de assinaturas"

--------------------------------------------------

# REGRAS DE SEGURANÇA

NÃO pode acontecer:

- duplicar lançamento
- repetir item já impresso
- perder histórico
- apagar relatório assinado
- quebrar vínculo com saída

--------------------------------------------------

# ENTREGA ESPERADA

Quero que você gere:

- models completos
- serializers
- services
- views / viewsets
- urls
- integração com saída
- componentes Angular
- estrutura de telas
- fluxo completo funcionando

Seguindo o padrão atual do projeto.
