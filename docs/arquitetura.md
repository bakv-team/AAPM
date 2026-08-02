# AAPM — Arquitetura do sistema

> **Versão:** 2.0<br>
> **Atualização:** agosto de 2026<br>
> **Escopo:** arquitetura atualmente implementada no repositório

## 1. Visão geral

O AAPM é um sistema administrativo de ponto de venda (PDV) construído como um **monólito modular** em Python. A mesma aplicação FastAPI:

- renderiza as telas HTML com Jinja2;
- publica a API REST usada pelo frontend;
- autentica usuários por JWT armazenado em cookie;
- executa as regras de vendas, estoque, cadastros e relatórios;
- acessa o banco por SQLAlchemy;
- serve os arquivos estáticos e os uploads de produtos.

O sistema possui duas experiências autenticadas:

| Área | Rota principal | Público |
|---|---|---|
| PDV | `/pdv` | Operadores, funcionários e administradores |
| Dashboard | `/dashboard` | Administradores ou usuários com permissões específicas |

Além delas, a aplicação oferece login e recuperação de senha em `/auth` e operações administrativas de usuários em `/usuarios`.

### Tecnologias atuais

| Responsabilidade | Tecnologia |
|---|---|
| Aplicação web e API | FastAPI + Uvicorn |
| Templates | Jinja2 |
| Persistência | SQLAlchemy 2.x, com `Numeric/Decimal` para valores monetários |
| Evolução do esquema | Alembic |
| Banco | Definido por `DATABASE_URL`; o projeto inclui driver PostgreSQL e um banco SQLite local |
| Autenticação | JWT (`python-jose`) em cookie HttpOnly |
| Senhas | Passlib + bcrypt |
| Frontend | HTML, CSS e JavaScript sem framework |
| Uploads | Arquivos servidos por `/static` |
| Recuperação de senha | SMTP |
| Recursos inteligentes | API da OpenAI |

## 2. Visão em camadas

```text
Navegador
   │
   ├── páginas HTML ───────────────► database/main.py e controllers
   │                                    │
   ├── JavaScript/CSS ◄───────────── apps/pvd/
   │                                    │
   └── JSON / formulários ──────────► api/v1/pvd.py
                                        │
                         autenticação e autorização
                              database/auth.py
                                        │
                    casos de uso de venda/estoque/relatórios
                         services/ + regras restantes
                                        │
                          adaptadores SMTP e IA
                              integrations/
                                        │
                              SQLAlchemy ORM
                         database/models/*.py
                                        │
                     banco configurado em DATABASE_URL
```

As fronteiras são modulares e a extração da camada de serviços está em andamento. Vendas, estoque e relatórios possuem casos de uso independentes do protocolo HTTP em `services/`. SMTP e provedores de IA são acessados por adaptadores em `integrations/`; catálogo, clientes e a composição dos insights Smart ainda mantêm parte de suas regras em `api/v1/pvd.py`. Os controladores em `database/controllers/` cuidam de autenticação, usuários e upload de produtos.

## 3. Estrutura real do repositório

```text
AAPM/
├── api/
│   ├── middleware.py
│   └── v1/
│       └── pvd.py
├── apps/
│   └── pvd/
│       ├── assets/
│       ├── scripts/
│       ├── styles/
│       ├── views/
│       └── routes.py
├── database/
│   ├── auth.py
│   ├── database.py
│   ├── main.py
│   ├── controllers/
│   │   ├── admin_controller.py
│   │   ├── auth_controller.py
│   │   └── produto_controller.py
│   ├── models/
│   │   ├── categoria.py
│   │   ├── cliente.py
│   │   ├── movimentacao.py
│   │   ├── produto.py
│   │   ├── usuario.py
│   │   ├── variacao.py
│   │   └── venda.py
│   ├── static/uploads/
│   └── templates/
├── migrations/
│   └── versions/
├── integrations/
│   ├── ai_client.py
│   └── smtp_client.py
├── services/
│   ├── errors.py
│   ├── report_service.py
│   ├── sale_service.py
│   └── stock_service.py
├── docs/
├── tests/
├── utils/
├── alembic.ini
├── banco.db
├── criar_usuario.py
├── README.md
└── requirements.txt
```

Não existem atualmente as pastas `core/` ou `assets/` globais. Recursos visuais do PDV ficam em `apps/pvd/assets/`, e imagens enviadas pelos usuários ficam em `database/static/uploads/`.

## 4. Componentes

### 4.1 Inicialização e composição — `database/main.py`

É o ponto de entrada da aplicação. Ele:

- cria a instância `FastAPI`;
- configura os diretórios de templates;
- monta `/apps` e `/static`;
- registra os routers de autenticação, usuários e API do PDV;
- publica as páginas `/`, `/dashboard` e `/pdv`;
- aplica cabeçalhos sem cache aos recursos em `/apps`;
- trata respostas 404;
- mantém a inicialização livre de alterações estruturais no banco.

O servidor é iniciado apontando para `database.main:app`.

### 4.2 Interface — `apps/pvd/`

| Pasta/arquivo | Papel |
|---|---|
| `views/` | Templates do dashboard, PDV e cadastro |
| `scripts/` | Interações da interface e chamadas para `/api/v1/pdv` |
| `styles/` | Estilos das telas |
| `assets/` | Logos, ícones e fundos |
| `routes.py` | Módulo de rotas da aplicação; não está registrado no `main.py` atualmente |

Os templates de login e redefinição de senha permanecem em `database/templates/`, separados das telas do painel.

### 4.3 API do PDV — `api/v1/pvd.py`

O router usa o prefixo `/api/v1/pdv` e reúne os seguintes grupos de recursos:

| Grupo | Responsabilidades principais |
|---|---|
| Categorias | Listar, criar, alterar e desativar/excluir |
| Produtos | Cadastro, edição, status, imagens e exclusão |
| Estoque | Movimentações e ajustes de quantidade |
| Vendas | Catálogo do PDV, criação de venda e baixa de estoque |
| Clientes | Associados, consulta por matrícula, cadastro e exclusão |
| Pedidos | Histórico e tratamento de exceções de pagamento |
| Dashboard | Séries diárias/horárias, métricas e produtos mais vendidos |
| Smart | Insights e assistente com integração OpenAI |
| Relatórios | Exportação/consulta por tipo |
| Sistema | Saúde, notificações, perfil, senha e suporte |

Os contratos de entrada são modelos Pydantic declarados no próprio módulo, como `VendaPayload`, `ClientePayload`, `EstoquePayload` e `ExcecaoPagamentoPayload`.

### 4.4 Serviços — `services/`

Os serviços encapsulam casos de uso críticos sem depender de FastAPI:

| Serviço | Responsabilidade |
|---|---|
| `sale_service.py` | Validar e registrar a venda, calcular desconto e coordenar a transação |
| `stock_service.py` | Reservar e repor estoque de forma atômica, registrando movimentações |
| `report_service.py` | Consultar e montar os dados dos relatórios CSV sem depender do protocolo HTTP |
| `errors.py` | Exceções de negócio convertidas em respostas HTTP pela camada da API |

### 4.5 Integrações — `integrations/`

| Adaptador | Responsabilidade |
|---|---|
| `smtp_client.py` | Centralizar configuração, TLS/SSL, autenticação e envio de mensagens SMTP |
| `ai_client.py` | Isolar chamadas OpenAI/Gemini, estado operacional e seleção do provedor |

Falhas de IA retornam ao modo local do Smart. Os adaptadores não controlam rotas nem transações de venda.

### 4.6 Controladores — `database/controllers/`

| Controlador | Prefixo/função |
|---|---|
| `auth_controller.py` | `/auth`: login, logout, solicitação e redefinição de senha |
| `admin_controller.py` | `/usuarios`: criar, editar e ativar/desativar usuários |
| `produto_controller.py` | Operações auxiliares de produto |

A recuperação de senha gera um JWT de uso específico, válido por tempo limitado, e envia o link por SMTP.

### 4.7 Segurança — `database/auth.py`

Responsabilidades:

- hash e verificação de senha com bcrypt;
- criação e validação de JWT;
- leitura do token no cookie `access_token`;
- proteção CSRF por token de dupla submissão nas operações autenticadas;
- revalidação da conta, perfil e permissões no banco a cada requisição;
- dependências para usuário obrigatório, opcional e administrador;
- normalização de permissões do dashboard;
- autorização por função (`role`) e por permissão granular.

Administradores possuem acesso integral. Os demais perfis podem receber permissões como produtos, pedidos, clientes, categorias, estoque, relatórios, configurações e AAPM Smart. O JWT comprova a identidade, mas o banco é a fonte de verdade do acesso: desativação, troca de perfil e alteração de permissões têm efeito na requisição seguinte.

O cookie de sessão é HttpOnly e o cookie CSRF é legível pelo frontend apenas para devolução no cabeçalho `X-CSRF-Token`. Em produção, `APP_ENV=production` ativa o atributo `Secure`; `COOKIE_SECURE` permite configuração explícita conforme o ambiente.

### 4.8 Persistência — `database/database.py`

O módulo lê `DATABASE_URL` do ambiente, cria o `engine`, configura `SessionLocal`, declara a classe base dos modelos e fornece `get_db()` como dependência do FastAPI. `pool_pre_ping` e `pool_recycle` ajudam a manter conexões remotas válidas. Há também uma função opcional para conexão PostgreSQL bruta via `psycopg2`.

As alterações estruturais são registradas em `migrations/` com Alembic. A aplicação não executa DDL no startup; o comando `alembic upgrade head` deve preceder a inicialização de cada versão implantada.

## 5. Modelos de dados atuais

O domínio possui **11 classes ORM**, distribuídas em sete módulos.

### 5.1 Usuário — `Usuario` (`usuarios`)

Representa quem acessa e opera o sistema.

| Campo | Descrição |
|---|---|
| `id` | Identificador primário |
| `nome`, `email` | Identificação; e-mail é único |
| `senha_hash` | Senha armazenada como hash |
| `role` | Perfil (`admin`, `operador` ou `funcionario`) |
| `permissoes` | Lista serializada de permissões do dashboard |
| `ativo` | Libera ou bloqueia o acesso |

Relaciona-se com vendas e movimentações de estoque.

### 5.2 Categoria — `Categoria` (`categorias`)

Classifica produtos. Possui `id`, `nome` único e `ativo`. Uma categoria pode conter vários produtos; ao excluir a categoria, a referência do produto é definida como nula.

### 5.3 Produto — `Produto` (`produtos`)

Cadastro-base do item comercializado. Possui nome, descrição, preço-base, estoque total, estado ativo, caminho da imagem e categoria opcional.

`preco` e `estoque_atual` continuam existindo para produtos antigos e para valores consolidados. Produtos com opções específicas utilizam `ProdutoVariacao`.

### 5.4 Atributo — `Atributo` (`atributos`)

Define uma dimensão de variação, por exemplo `Cor` ou `Tamanho`. O nome é único e o atributo contém vários valores possíveis.

### 5.5 Valor de atributo — `ValorAtributo` (`valores_atributos`)

Representa uma opção de um atributo, como `Preta` ou `M`. O par atributo/valor é único. A exclusão do atributo remove seus valores em cascata.

### 5.6 Variação de produto — `ProdutoVariacao` (`produtos_variacoes`)

Representa uma versão vendável de um produto. Cada variação possui:

- produto pai;
- `codigo_produto` único;
- preço próprio;
- estoque próprio;
- combinação de valores de atributos.

A exclusão do produto remove suas variações em cascata.

### 5.7 Combinação de variação — `VariacaoCombinacao` (`variacoes_combinacoes`)

Tabela associativa entre `ProdutoVariacao` e `ValorAtributo`. Sua chave primária composta impede repetir o mesmo valor de atributo em uma variação.

### 5.8 Cliente — `Cliente` (`clientes`)

Identifica compradores e associados. Armazena nome, matrícula única opcional, telefone, indicador de associação, situação ativa e data de criação. O indicador `is_associado` permite aplicar o desconto destinado aos associados.

Um cliente pode possuir várias vendas. A venda pode existir sem cliente, para atendimento de balcão.

### 5.9 Venda — `Venda` (`vendas`)

É o cabeçalho de uma transação. Registra cliente e operador opcionais, método de pagamento, desconto, totais bruto e líquido, observação, datas e itens.

Também preserva os campos históricos/legados `desconto`, `valor_total`, `valor_final` e `data`, além dos campos de exceção de pagamento (`excecao_pagamento`, status, prazo, observação e data de quitação).

Se o cliente ou usuário for excluído, a venda é preservada com a referência nula. Ao excluir uma venda, seus itens são removidos em cascata.

### 5.10 Item de venda — `ItemVenda` (`itens_venda`)

Registra cada linha da venda. Mantém quantidade, preço unitário e nome do produto no momento da transação para preservar o histórico mesmo que o cadastro mude.

Pode referenciar o produto e a variação vendidos. Essas referências se tornam nulas se o cadastro correspondente for removido; os dados históricos do item permanecem.

### 5.11 Movimentação — `Movimentacao` (`movimentacoes`)

Registra entradas (`adicionar`) e saídas (`retirar`) de estoque, com quantidade, preço unitário, observação, data, produto e usuário responsável. O valor total é calculado por `quantidade × preco_unitario`.

## 6. Relacionamentos do domínio

```text
Categoria 1 ───── 0..N Produto
                         │
                         ├── 1 ───── 0..N ProdutoVariacao
                         │                    │
                         │                    └── N..N ValorAtributo
                         │                              │
                         │                              N..1 Atributo
                         │
                         ├── 1 ───── 0..N Movimentacao N..1 Usuario
                         │
                         └── 1 ───── 0..N ItemVenda N..1 Venda
                                                   │
ProdutoVariacao 1 ───── 0..N ItemVenda             ├── N..1 Cliente (opcional)
                                                   └── N..1 Usuario (opcional)
```

Regras importantes de preservação:

- vendas podem ser anônimas (`cliente_id` nulo);
- itens copiam nome e preço para manter o histórico financeiro;
- produto e variação podem ser removidos sem apagar itens antigos;
- excluir uma venda remove seus itens;
- excluir um produto remove variações e movimentações relacionadas;
- excluir categoria não remove produtos.

## 7. Fluxos principais

### 7.1 Login e autorização

```text
Formulário /auth/login
  → busca Usuario pelo e-mail
  → valida bcrypt e situação ativa
  → cria JWT com perfil e permissões
  → grava cookie HttpOnly
  → redireciona para /dashboard ou /pdv
```

Cada rota protegida usa uma dependência de autenticação/autorização. A interface oculta áreas sem permissão, mas a API também deve validar o acesso no servidor.

### 7.2 Registro de venda

```text
Tela /pdv
  → consulta produtos e variações vendáveis
  → envia VendaPayload para POST /api/v1/pdv/sales
  → valida cliente, produto, variação, preço e estoque
  → calcula desconto e totais
  → cria Venda e ItemVenda
  → atualiza o estoque
  → confirma a transação no banco
```

A baixa utiliza bloqueio de linha quando suportado e um `UPDATE` condicional atômico como garantia final. Assim, vendas concorrentes não podem consumir a mesma unidade nem produzir estoque negativo.

### 7.3 Gestão de estoque

```text
Dashboard
  → envia ajuste de estoque
  → valida produto, quantidade e usuário
  → atualiza o saldo
  → cria Movimentacao para auditoria
```

### 7.4 Recuperação de senha

```text
E-mail informado
  → token JWT de recuperação (30 minutos)
  → link enviado por SMTP
  → validação do token
  → novo hash de senha salvo no usuário
```

## 8. Configuração e integrações

As configurações são lidas do `.env`. Entre as variáveis utilizadas estão:

- `DATABASE_URL` para conexão com o banco;
- `SECRET_KEY`, `ALGORITHM` e `ACCESS_TOKEN_EXPIRE_MINUTES` para JWT;
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TLS` e `SMTP_SSL` para e-mail;
- `APP_BASE_URL` ou `RESET_PASSWORD_BASE_URL` para links de recuperação;
- `APP_ENV` e `COOKIE_SECURE` para segurança dos cookies;
- `MAX_PRODUCT_IMAGE_BYTES` para o limite de upload, com padrão de 5 MB;
- `AAPM_AI_PROVIDER` e credenciais/configurações OpenAI ou Gemini usadas pelos recursos Smart.

O `.env` contém segredos e não deve ser versionado. Configurações novas devem continuar externas ao código.

## 9. Convenções para evolução

- Arquivos e módulos Python usam nomes minúsculos com underscore.
- Endpoints públicos do PDV permanecem versionados sob `/api/v1/pdv`.
- Mudanças de tabelas devem gerar uma migration Alembic reversível.
- Regras de autorização devem ser verificadas no backend, mesmo quando a interface já restringe o recurso.
- Registros financeiros devem preservar valores históricos, sem depender do preço atual do produto.
- Novos modelos devem declarar claramente nulabilidade, unicidade, chaves estrangeiras e comportamento de exclusão.
- Novas regras extensas devem seguir a camada `services/`; a extração dos módulos ainda concentrados na API deve continuar incrementalmente.
- Testes devem acompanhar fluxos críticos de autenticação, venda, desconto, estoque e permissões.

## 10. Arquivos da raiz

| Arquivo | Função |
|---|---|
| `.env` | Configuração local e segredos; não deve ser versionado |
| `.gitignore` | Exclusões do Git |
| `README.md` | Instalação, execução e visão geral |
| `requirements.txt` | Dependências Python |
| `alembic.ini` | Configuração das migrations |
| `banco.db` | Banco SQLite local presente no repositório |
| `criar_usuario.py` | Utilitário para criação inicial de usuário |

---

Consulte também a [especificação de requisitos](requisições.md) para requisitos funcionais, não funcionais, regras de negócio e critérios de homologação.

---

*Este documento descreve o código existente em agosto de 2026. Estruturas planejadas devem ser identificadas explicitamente como futuras antes de serem adicionadas aqui.*
