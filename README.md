# SISTEMA DE PONTO DE VENDA - Associação de Alunos, Ex Alunos, Pais e Mestres (AAPM) - SENAI Francisco Matarazzo v1.0

> **Sistema Administrativo de Ponto de Venda (PDV) com Gestão Administrativa**

<div align="center">

![Versão](https://img.shields.io/badge/versão-1.0-blue)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![Python](https://img.shields.io/badge/Python-3.10+-green)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-teal)
![Licença](https://img.shields.io/badge/licença-MIT-orange)

**Instituição:** SENAI Francisco Matarazzo — São Paulo/SP  
**Última atualização:** Abril de 2026

</div>

---

## 📑 Índice

1. [Introdução e Propósito](#1-introdução-e-propósito)
2. [Visão Geral da Arquitetura](#2-visão-geral-da-arquitetura)
3. [Estrutura de Diretórios](#3-estrutura-de-diretórios)
4. [Stack Tecnológico](#4-stack-tecnológico)
5. [Configuração do Ambiente](#5-configuração-do-ambiente)
6. [Execução](#6-execução)
7. [Banco de Dados e Migrations](#7-banco-de-dados-e-migrations)
8. [Componentes Principais](#8-componentes-principais)
9. [API e Endpoints](#9-api-e-endpoints)
10. [Frontend e Apps](#10-frontend-e-apps)
11. [Autenticação e Autorização](#11-autenticação-e-autorização)
12. [Testes](#12-testes)
13. [Padrões de Desenvolvimento](#13-padrões-de-desenvolvimento)
14. [Observabilidade e Operação](#14-observabilidade-e-operação)
15. [Estado do Projeto](#15-estado-do-projeto)
16. [Referências de Arquivos](#16-referências-de-arquivos)

---

## 1. Introdução e Propósito

### 1.1 O que é AAPM?

O **AAPM** é um sistema administrativo de ponto de venda desenvolvido para apoiar a operação interna da Associação de Alunos, Ex Alunos, Pais e Mestres do SENAI Francisco Matarazzo.

A aplicação centraliza rotinas de venda, controle de produtos, categorias, clientes, usuários, estoque, relatórios e acompanhamento operacional em uma interface web única.

### 1.2 Funcionalidades principais

| Área | Funcionalidades |
|---|---|
| Autenticação | Login, logout, recuperação de senha e controle de sessão por token |
| Dashboard | Indicadores operacionais, gráficos, métricas e notificações |
| Produtos | Cadastro, edição, remoção lógica, imagens, categorias e filtros |
| Categorias | Cadastro, edição, listagem e vínculos com produtos |
| Vendas/PDV | Registro de vendas, itens, pagamento, desconto de associado e baixa de estoque |
| Clientes | Cadastro e consulta de clientes/associados |
| Estoque | Entradas, saídas e histórico de movimentações |
| Relatórios | Exportações e consultas administrativas |
| Usuários | Gestão administrativa de contas e permissões |

### 1.3 Perfis de uso

| Perfil | Acesso | Responsabilidade |
|---|---|---|
| Administrador | Dashboard completo | Gestão de produtos, categorias, usuários, relatórios e configurações |
| Operador | PDV | Registro de vendas e atendimento |
| Cliente/Associado | Atendimento interno | Identificação para histórico, desconto e vínculo nas vendas |

---

## 2. Visão Geral da Arquitetura

### 2.1 Organização geral

```
┌─────────────────────────────────────────────────┐
│                   APPS (UI)                     │
│         HTML • CSS • JavaScript Vanilla         │
├─────────────────────────────────────────────────┤
│                  API v1                         │
│            FastAPI • Routers JSON               │
├─────────────────────────────────────────────────┤
│              DATABASE / MODELS                  │
│        SQLAlchemy • SQLite • Alembic            │
└─────────────────────────────────────────────────┘
```

### 2.2 Diretrizes arquiteturais

| Diretriz | Aplicação no projeto |
|---|---|
| Separação de responsabilidades | Interface, API, autenticação e persistência ficam em módulos distintos |
| API versionada | Endpoints administrativos concentrados em `api/v1/pvd.py` |
| Persistência estruturada | Modelos SQLAlchemy e migrations Alembic |
| Interface independente | Frontend em HTML, CSS e JavaScript Vanilla |
| Segurança básica | Senhas com hash, tokens JWT e rotas protegidas por perfil |

---

## 3. Estrutura de Diretórios

```
aapm/
├── api/                        # Endpoints HTTP e middleware
│   ├── v1/
│   │   └── pvd.py              # API principal do PDV administrativo
│   └── middleware.py
│
├── apps/
│   └── pvd/                    # Interface administrativa
│       ├── assets/             # Imagens e ícones
│       ├── scripts/            # JavaScript da interface
│       ├── styles/             # Estilos CSS
│       └── views/              # Templates HTML/Jinja2
│
├── database/
│   ├── controllers/            # Autenticação, usuários e helpers
│   ├── models/                 # Modelos SQLAlchemy
│   ├── templates/              # Templates de login e recuperação
│   ├── auth.py                 # Funções de autenticação/autorização
│   ├── database.py             # Sessão e conexão com banco
│   └── main.py                 # Aplicação FastAPI
│
├── docs/                       # Documentação complementar
├── migrations/                 # Migrations Alembic
├── tests/                      # Testes automatizados
├── requirements.txt
└── README.md
```

### 3.1 Responsabilidades por camada

| Camada | Responsabilidade |
|---|---|
| `apps/pvd` | Interface administrativa, navegação, formulários, gráficos e interações |
| `api/v1` | Endpoints JSON consumidos pelo painel e pelo PDV |
| `database/models` | Representação das entidades persistidas |
| `database/controllers` | Rotas HTML de autenticação/admin e helpers compartilhados |
| `migrations` | Histórico versionado da estrutura do banco |
| `docs` | Documentação técnica complementar |

---

## 4. Stack Tecnológico

### 4.1 Backend

| Tecnologia | Função |
|---|---|
| Python 3.10+ | Linguagem principal |
| FastAPI | Aplicação web e endpoints REST |
| Uvicorn | Servidor ASGI |
| SQLAlchemy | ORM e persistência |
| Alembic | Versionamento do banco |
| SQLite | Banco de dados local |
| Jinja2 | Templates HTML |
| Passlib/Bcrypt | Hash de senhas |
| JWT | Autenticação baseada em token |
| python-dotenv | Configuração por variáveis de ambiente |

### 4.2 Frontend

| Tecnologia | Função |
|---|---|
| HTML5 | Estrutura das telas |
| CSS3 | Design visual e responsividade |
| JavaScript ES6+ | Interações, estado da tela e consumo da API |
| Chart.js | Gráficos e indicadores |
| Font Awesome / Lucide | Iconografia |
| Google Fonts | Tipografia |

---

## 5. Configuração do Ambiente

### 5.1 Requisitos

| Item | Versão/Observação |
|---|---|
| Python | 3.10 ou superior |
| pip | Instalador de dependências |
| SQLite | Usado como banco local |
| Alembic | Aplicação das migrations |
| Variáveis de ambiente | Definidas em `.env` |

### 5.2 Variáveis principais

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | String de conexão com o banco |
| `SECRET_KEY` | Chave de assinatura dos tokens |
| `ALGORITHM` | Algoritmo JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Tempo de expiração da sessão |
| `APP_BASE_URL` | Base para links de recuperação de senha |
| `SMTP_*` | Configurações de envio de e-mail |

---

## 6. Execução

### 6.1 Comando principal

```bash
uvicorn database.main:app --reload
```

### 6.2 Acessos principais

| Recurso | URL |
|---|---|
| Aplicação | `http://localhost:8000` |
| Login | `http://localhost:8000/auth/login` |
| PDV | `http://localhost:8000/pdv` |
| Dashboard | `http://localhost:8000/dashboard` |
| Swagger | `http://localhost:8000/docs` |
| ReDoc | `http://localhost:8000/redoc` |

---

## 7. Banco de Dados e Migrations

### 7.1 Modelos principais

| Modelo | Responsabilidade |
|---|---|
| `Usuario` | Contas, papéis e status de acesso |
| `Produto` | Cadastro, preço, estoque e imagem |
| `Categoria` | Agrupamento de produtos |
| `Cliente` | Clientes e associados |
| `Venda` | Registro da venda e totais |
| `ItemVenda` | Produtos vinculados à venda |
| `Movimentacao` | Entradas e saídas de estoque |

### 7.2 Migrations

O projeto utiliza **Alembic** para manter o schema do banco versionado. As revisões ficam em `migrations/versions` e representam a evolução controlada das tabelas.

---

## 8. Componentes Principais

### 8.1 Aplicação

| Arquivo | Função |
|---|---|
| `database/main.py` | Criação da aplicação FastAPI, rotas principais e montagem de arquivos estáticos |
| `api/v1/pvd.py` | API administrativa do PDV |
| `database/database.py` | Engine, sessão e dependência de banco |
| `database/auth.py` | JWT, hash de senha e dependências de autenticação |

### 8.2 Interface

| Arquivo | Função |
|---|---|
| `apps/pvd/views/dashboard.html` | Painel administrativo |
| `apps/pvd/views/vendas.html` | Tela de PDV/vendas |
| `apps/pvd/scripts/dashboard.js` | Estado, chamadas API, gráficos e páginas do dashboard |
| `apps/pvd/scripts/base.js` | Comportamento da tela de vendas |
| `apps/pvd/styles/dashboard.css` | Estilos do painel |
| `apps/pvd/styles/base.css` | Estilos do PDV |

---

## 9. API e Endpoints

### 9.1 PDV administrativo

| Método | Endpoint | Função |
|---|---|---|
| `GET` | `/api/v1/pdv/categories` | Lista categorias |
| `POST` | `/api/v1/pdv/categories` | Cria categoria |
| `GET` | `/api/v1/pdv/products` | Lista produtos |
| `POST` | `/api/v1/pdv/products` | Cria produto |
| `PUT` | `/api/v1/pdv/products/{id}` | Atualiza produto |
| `DELETE` | `/api/v1/pdv/products/{id}` | Remove produto |
| `POST` | `/api/v1/pdv/products/{id}/stock` | Registra entrada de estoque |
| `GET` | `/api/v1/pdv/stock/movements` | Lista movimentações |
| `POST` | `/api/v1/pdv/sales` | Registra venda |
| `GET` | `/api/v1/pdv/orders` | Lista pedidos |
| `GET` | `/api/v1/pdv/dashboard/metrics` | Métricas do painel |
| `GET` | `/api/v1/pdv/reports/{tipo}` | Exportação de relatórios |

### 9.2 Autenticação

| Método | Endpoint | Função |
|---|---|---|
| `GET` | `/auth/login` | Tela de login |
| `POST` | `/auth/login` | Autenticação |
| `POST` | `/auth/forgot-password` | Solicitação de recuperação |
| `GET` | `/auth/reset-password` | Tela de redefinição |
| `GET` | `/auth/logout` | Encerramento da sessão |

---

## 10. Frontend e Apps

### 10.1 Dashboard

O dashboard usa `apps/pvd/scripts/dashboard.js` como ponto central de integração entre interface, API, gráficos e estado local de tela.

| Objeto global | Responsabilidade |
|---|---|
| `window.API` | Comunicação com endpoints FastAPI |
| `window.DB` | Cache de tela preenchido pela API |
| `window.UI` | Formatação, modais, toasts e utilitários |
| `window.CHARTS` | Gráficos e visualizações |

### 10.2 Rotas internas do painel

| Hash | Tela |
|---|---|
| `#admin` | Dashboard principal |
| `#grafico` | Indicadores e gráficos |
| `#pedidos` | Pedidos |
| `#clientes` | Clientes/associados |
| `#categorias` | Categorias |
| `#produtos` | Produtos |
| `#estoque` | Estoque |
| `#relatorios` | Relatórios |
| `#configuracoes` | Configurações |

---

## 11. Autenticação e Autorização

### 11.1 Segurança

| Recurso | Implementação |
|---|---|
| Hash de senha | Bcrypt/Passlib |
| Sessão | JWT em cookie HTTP-only |
| Proteção de rotas | Dependências `get_admin`, `get_usuario_logado` e `get_usuario_opcional` |
| Perfis | `admin`, `operador` e cliente/associado para vínculo operacional |
| Recuperação de senha | Token temporário e envio opcional por SMTP |

### 11.2 Controle de acesso

| Perfil | Acesso |
|---|---|
| Admin | Dashboard, cadastros, estoque, relatórios e usuários |
| Operador | Tela de PDV e rotinas de venda |
| Não autenticado | Login e recuperação de senha |

---

## 12. Testes

### 12.1 Estado atual

A pasta `tests/` está reservada para a cobertura automatizada do projeto. A prioridade recomendada é cobrir autenticação, endpoints do PDV e fluxos críticos de venda/estoque.

### 12.2 Escopo recomendado

| Área | Casos principais |
|---|---|
| Autenticação | Login, senha inválida, usuário inativo e recuperação |
| Produtos | CRUD, upload de imagem e filtros |
| Vendas | Registro, baixa de estoque e desconto de associado |
| Estoque | Entrada, saída e histórico |
| Dashboard | Métricas e endpoints agregados |

---

## 13. Padrões de Desenvolvimento

### 13.1 Convenções

| Item | Padrão |
|---|---|
| Python | `snake_case` para funções e variáveis |
| JavaScript | `camelCase` para funções e estado |
| Rotas API | Prefixo `/api/v1/pdv` |
| Templates | Views em `apps/pvd/views` ou `database/templates` |
| Estilos | CSS segmentado por área da aplicação |
| Banco | Alterações estruturais por migration |

### 13.2 Diretrizes

- Manter regras de API em `api/v1/pvd.py` quando fizerem parte do fluxo administrativo.
- Usar models SQLAlchemy para persistência.
- Evitar mocks, dados locais temporários e código não referenciado.
- Preservar compatibilidade entre dashboard, PDV e endpoints existentes.
- Atualizar documentação quando houver mudança de rota, entidade ou fluxo principal.

---

## 14. Observabilidade e Operação

### 14.1 Pontos de atenção

| Área | Observação |
|---|---|
| Logs | Falhas de e-mail e suporte são registradas no console quando SMTP não está configurado |
| Cache estático | Arquivos em `/apps` recebem headers para evitar cache em desenvolvimento |
| Uploads | Imagens de produtos são salvas em `database/static/uploads` |
| Banco | SQLite é adequado para uso local/institucional pequeno |
| E-mail | Recuperação de senha depende de configuração SMTP |

### 14.2 Relatórios

Os relatórios administrativos são expostos pela API do PDV e podem ser exportados pelo painel conforme os tipos disponíveis em `/api/v1/pdv/reports/{tipo}`.

---

## 15. Estado do Projeto

### 15.1 Status funcional

| Módulo | Status |
|---|---|
| Login e recuperação de senha | Implementado |
| Dashboard administrativo | Implementado |
| Produtos e categorias | Implementado |
| PDV/vendas | Implementado |
| Clientes/associados | Implementado |
| Estoque e movimentações | Implementado |
| Relatórios | Em evolução |
| Testes automatizados | Planejado |

### 15.2 Próximas prioridades

| Prioridade | Objetivo |
|---|---|
| Testes | Cobrir fluxos críticos de autenticação, vendas e estoque |
| Relatórios | Consolidar formatos e indicadores finais |
| Permissões | Refinar limites por perfil operacional |
| Produção | Ajustar segurança, SMTP, backup e variáveis de ambiente |

---

## 16. Referências de Arquivos

### 16.1 Arquivos principais

| Arquivo | Descrição |
|---|---|
| `database/main.py` | Aplicação FastAPI e rotas de tela |
| `api/v1/pvd.py` | Endpoints administrativos |
| `database/auth.py` | Autenticação e autorização |
| `database/controllers/auth_controller.py` | Login e recuperação de senha |
| `database/controllers/admin_controller.py` | Gestão de usuários |
| `database/controllers/produto_controller.py` | Helpers de upload de produto |
| `apps/pvd/views/dashboard.html` | Tela do dashboard |
| `apps/pvd/views/vendas.html` | Tela do PDV |
| `apps/pvd/scripts/dashboard.js` | Lógica do painel |
| `apps/pvd/scripts/base.js` | Lógica da tela de vendas |

### 16.2 Documentação complementar

| Arquivo | Descrição |
|---|---|
| `docs/arquitetura.md` | Arquitetura técnica do projeto |
| `docs/requisitos.md` | Requisitos funcionais e não funcionais |
| `migrations/versions` | Histórico de alterações do banco |

---

## Conclusão

O **AAPM v1.0** consolida um PDV administrativo para gestão de produtos, vendas, clientes, estoque, usuários e indicadores operacionais em uma aplicação web integrada.

O projeto está estruturado para evolução incremental, com API versionada, banco controlado por migrations, autenticação por token e uma interface administrativa conectada aos dados reais do sistema.

---

<div align="center">

**AAPM v1.0** • Desenvolvido pela equipe de estudantes para o SENAI Francisco Matarazzo — São Paulo/SP  
Abril de 2026 • Status: Ativo em Desenvolvimento

</div>
