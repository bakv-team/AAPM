# AAPM — Documentação de Arquitetura do Projeto

> **Versão:** 1.0  
> **Data:** Abril de 2026  
> **Descrição:** Sistema administrativo de Ponto de Venda (PDV)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Detalhamento de Cada Módulo](#3-detalhamento-de-cada-módulo)
   - [apps/](#31-apps)
   - [core/](#32-core)
   - [services/](#33-services)
   - [api/](#34-api)
   - [database/](#35-database)
   - [assets/](#36-assets)
   - [tests/](#37-tests)
   - [docs/](#38-docs)
   - [utils/](#39-utils)
4. [Fluxo de Dados](#4-fluxo-de-dados)
5. [Convenções e Boas Práticas](#5-convenções-e-boas-práticas)
6. [Arquivos Raiz](#6-arquivos-raiz)

---

## 1. Visão Geral

O projeto **AAPM** é composto por uma aplicação administrativa de PDV, com backend FastAPI, banco SQLite/SQLAlchemy e telas internas para operação e gestão.

| Aplicação | Público-alvo | Acesso |
|-----------|-------------|--------|
| **PDV (Ponto de Venda)** | Administradores e operadores | Presencial / Interno |

A arquitetura segue o princípio de **separação de responsabilidades**: cada camada tem uma função bem definida, evitando que lógica de negócio, apresentação e dados fiquem misturados.

---

## 2. Estrutura de Pastas

```
AAPM/
├── .env                      # Variáveis de ambiente (nunca versionado)
├── .gitignore                # Arquivos ignorados pelo Git
├── README.md                 # Instruções gerais do projeto
├── requirements.txt          # Dependências Python
│
├── apps/                     # Aplicações da interface
│   └── pdv/                  # Ponto de Venda (administrativo)
│
├── core/                     # Núcleo compartilhado da aplicação
│   ├── config.py
│   ├── security.py
│   └── exceptions.py
│
├── services/                 # Regras de negócio
│   ├── produto_service.py
│   ├── venda_service.py
│   └── usuario_service.py
│
├── api/                      # Endpoints e rotas da API
│   ├── v1/
│   │   └── pdv.py
│   └── middleware.py
│
├── database/                 # Banco de dados e modelos
│   ├── app.db
│   ├── models/
│   └── migrations/
│
├── assets/                   # Arquivos estáticos globais
│   ├── images/
│   └── fonts/
│
├── tests/                    # Testes automatizados
│
├── docs/                     # Documentação do projeto
│
└── utils/                    # Funções auxiliares reutilizáveis
```

---

## 3. Detalhamento de Cada Módulo

---

### 3.1 `apps/`

**Responsabilidade:** Contém a interface administrativa do sistema.

As views, scripts, assets e estilos do PDV ficam agrupados em `apps/pvd/`, mantendo a interface separada do backend.

---

#### `apps/pvd/` — Ponto de Venda

**Para quem é:** Administradores e operadores internos, com acesso presencial.

**O que contém:**

| Arquivo / Pasta | Função |
|-----------------|--------|
| `__init__.py` | Inicializa o módulo Python |
| `routes.py` | Define as rotas exclusivas do PDV |
| `views/` | Telas e páginas do painel administrativo |
| `components/` | Componentes de interface reutilizáveis dentro do PDV |
| `styles/` | Estilos visuais específicos do PDV |

**Exemplos de funcionalidades aqui presentes:**
- Tela de login administrativo
- Painel de controle de vendas
- Cadastro de produtos
- Relatórios e histórico de transações

### 3.2 `core/`

**Responsabilidade:** Núcleo central da aplicação. Contém configurações, segurança e tratamento de erros que são **compartilhados por todas as partes do sistema**.

Nada de lógica de negócio aqui — apenas a estrutura que sustenta a aplicação.

| Arquivo | Função |
|---------|--------|
| `__init__.py` | Inicializa o módulo |
| `config.py` | Carrega e centraliza todas as configurações do sistema (lê o `.env`, define variáveis globais como `DEBUG`, `SECRET_KEY`, `DATABASE_URL`) |
| `security.py` | Autenticação, autorização e controle de permissões (quem pode acessar o quê) |
| `exceptions.py` | Classes de erros customizados do sistema (ex: `ProdutoNaoEncontradoError`, `PermissaoNegadaError`) |

**Por que separar aqui?**  
Porque o PDV precisa de configuração e segurança consistentes. Colocar isso em `core/` evita duplicação quando esses módulos existirem/forem extraídos.

---

### 3.3 `services/`

**Responsabilidade:** Toda a **lógica de negócio** do sistema vive aqui. É a camada mais importante da aplicação.

Os services são chamados pela API e contêm as regras que definem como o sistema funciona: como calcular um desconto, como registrar uma venda, como validar um cadastro.

| Arquivo | Função |
|---------|--------|
| `__init__.py` | Inicializa o módulo |
| `produto_service.py` | Regras relacionadas a produtos (cadastrar, editar, buscar, estoque) |
| `venda_service.py` | Regras de vendas (registrar, cancelar, calcular totais, aplicar desconto) |
| `usuario_service.py` | Regras de usuários (criar conta, autenticar, recuperar senha) |

**Princípio fundamental:** Services nunca acessam diretamente a interface do usuário e nunca contêm código de apresentação. Eles recebem dados, processam e retornam resultados.

---

### 3.4 `api/`

**Responsabilidade:** Define os **endpoints HTTP** que expõem as funcionalidades do sistema. É a ponte entre a interface (apps/) e a lógica de negócio (services/).

A pasta usa versionamento (`v1/`) desde o início para permitir evoluções futuras sem quebrar integrações existentes.

```
api/
├── __init__.py
├── middleware.py       # Interceptações globais (autenticação, logs, CORS)
└── v1/
    └── pdv.py          # Endpoints do PDV
```

| Arquivo | Função |
|---------|--------|
| `middleware.py` | Código executado em toda requisição (ex: verificar token, registrar log, tratar CORS) |
| `v1/pdv.py` | Rotas do painel administrativo (ex: `POST /api/v1/pdv/sales`, `GET /api/v1/pdv/products`) |

**Por que versionar a API?**  
Se no futuro for necessário mudar o comportamento de um endpoint sem quebrar clientes existentes, basta criar um `/v2/` com as novas regras.

---

### 3.5 `database/`

**Responsabilidade:** Tudo relacionado ao **armazenamento e estrutura dos dados**.

```
database/
├── app.db              # Arquivo do banco de dados SQLite
├── models/             # Definição das tabelas e entidades
│   ├── __init__.py
│   ├── produto.py
│   ├── venda.py
│   └── usuario.py
└── migrations/         # Histórico de alterações no banco de dados
```

| Pasta / Arquivo | Função |
|-----------------|--------|
| `app.db` | Banco de dados SQLite (arquivo único, ideal para projetos locais/pequenos) |
| `models/` | Cada arquivo define uma entidade do sistema (tabela no banco). Ex: `Produto`, `Venda`, `Usuario` |
| `migrations/` | Registra cada alteração feita na estrutura do banco ao longo do tempo (adicionar coluna, renomear tabela, etc.) |

**Por que migrations?**  
Permitem que a equipe evolua o banco de dados de forma controlada e rastreável, sem perder dados existentes.

---

### 3.6 `assets/`

**Responsabilidade:** Arquivos estáticos **globais** compartilhados pela aplicação.

```
assets/
├── images/     # Logos, ícones e imagens do sistema
└── fonts/      # Fontes utilizadas nas interfaces
```

> **Atenção:** Imagens e estilos específicos da aplicação devem ficar dentro de `apps/pvd/`. Esta pasta é apenas para recursos verdadeiramente compartilhados.

---

### 3.7 `tests/`

**Responsabilidade:** Testes automatizados que garantem que o sistema funciona corretamente.

```
tests/
├── test_api.py         # Testa os endpoints da API
├── test_services.py    # Testa a lógica de negócio
└── test_pdv.py         # Testa funcionalidades específicas do PDV
```

**Por que testar?**  
Testes evitam que mudanças no código quebrem funcionalidades que já estavam funcionando. São especialmente importantes em sistemas de venda, onde erros têm impacto financeiro direto.

---

### 3.8 `docs/`

**Responsabilidade:** Toda a **documentação** do projeto centralizada em um único lugar.

```
docs/
├── arquitetura.md      # Este documento
├── requisitos.md       # Requisitos funcionais e não-funcionais
└── api.md              # Documentação dos endpoints da API (futura)
```

Qualquer texto explicativo, guia, decisão técnica ou especificação deve ser registrado aqui. Evite deixar arquivos temporários espalhados pelas pastas de código.

---

### 3.9 `utils/`

**Responsabilidade:** Funções auxiliares pequenas e genéricas que não se encaixam em nenhuma outra camada, mas são usadas em múltiplos lugares.

```
utils/
├── __init__.py
└── helpers.py      # Funções utilitárias gerais
```

**Exemplos do que colocar aqui:**
- Função para formatar moeda (`R$ 1.290,00`)
- Função para validar CPF ou CNPJ
- Função para formatar datas
- Função para gerar slugs de URL

**O que NÃO colocar aqui:**
- Lógica de negócio (vai em `services/`)
- Configurações (vão em `core/config.py`)
- Código específico de uma só aplicação (vai em `apps/`)

---

## 4. Fluxo de Dados

O diagrama abaixo representa como uma requisição percorre o sistema:

```
Usuário / Browser
       │
       ▼
   apps/ (PDV ou Site)
       │  Interface exibe e coleta dados
       ▼
   api/v1/ (Endpoints)
       │  Recebe requisição HTTP, valida autenticação (middleware)
       ▼
   services/ (Lógica de Negócio)
       │  Processa regras, valida dados, toma decisões
       ▼
   database/models/ (Acesso ao Banco)
       │  Lê ou grava dados
       ▼
   database/app.db (SQLite)
```

---

## 5. Convenções e Boas Práticas

### Nomenclatura de arquivos
- Sempre em **letras minúsculas** com **underscore**: `produto_service.py`, `test_api.py`
- Nunca usar espaços em nomes de pastas ou arquivos
- Módulos Python sempre com `__init__.py`

### Separação de responsabilidades
- `apps/` → apresentação apenas (o que o usuário vê)
- `services/` → lógica de negócio (as regras do sistema)
- `api/` → comunicação entre interface e serviços
- `core/` → configuração e segurança compartilhadas
- `utils/` → funções auxiliares sem regras de negócio

### Variáveis de ambiente
- Nunca colocar senhas, chaves de API ou configurações sensíveis diretamente no código
- Usar sempre o arquivo `.env` e acessar via `core/config.py`
- O arquivo `.env` **jamais** deve ser enviado ao repositório Git

### Versionamento da API
- Sempre criar endpoints dentro de `/api/v1/`
- Quando precisar mudar o comportamento de um endpoint, criar `/api/v2/` sem remover o `/v1/`

---

## 6. Arquivos Raiz

| Arquivo | Função |
|---------|--------|
| `.env` | Variáveis de ambiente sensíveis (chaves, senhas, URLs). **Nunca versionar.** |
| `.gitignore` | Lista de arquivos e pastas que o Git deve ignorar (ex: `.env`, `venv/`, `__pycache__/`) |
| `README.md` | Instruções de instalação, configuração e execução do projeto |
| `requirements.txt` | Lista de todas as bibliotecas Python necessárias para rodar o projeto |

---

*Documento gerado em Abril de 2026 — AAPM v1.0*
