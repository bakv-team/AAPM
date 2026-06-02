# SISTEMA DE PONTO DE VENDA - Associação de Alunos, Ex Alunos, Pais e Mestres (AAPM) - SENAI Francisco Matarazzo v1.0

> **Sistema Integrado de Ponto de Venda (PDV) + Site Público com Gestão Administrativa**

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
5. [Instalação e Configuração](#5-instalação-e-configuração)
6. [Executando o Projeto](#6-executando-o-projeto)
7. [Banco de Dados e Migrations](#7-banco-de-dados-e-migrations)
8. [Componentes Principais](#8-componentes-principais)
9. [API e Endpoints](#9-api-e-endpoints)
10. [Frontend e Apps](#10-frontend-e-apps)
11. [Autenticação e Autorização](#11-autenticação-e-autorização)
12. [Testes](#12-testes)
13. [Workflow de Desenvolvimento](#13-workflow-de-desenvolvimento)
14. [Troubleshooting](#14-troubleshooting)
15. [Contribuindo](#15-contribuindo)
16. [Referências de Arquivos e Símbolos](#16-referências-de-arquivos-e-símbolos)

---

## 1. Introdução e Propósito

### 1.1 O que é AAPM?

AAPM é uma plataforma integrada de gestão comercial desenvolvida para o **SENAI Francisco Matarazzo**, com dois propósitos complementares:

**PDV (Ponto de Venda)** — Interface administrativa interna para gerenciar:
- Produtos e categorias
- Pedidos e vendas
- Clientes e operadores
- Estoque e movimentações
- Relatórios e análises
- Autenticação e permissões

**Site Público** — Vitrine eletrônica para clientes:
- Catálogo de produtos
- Carrinho de compras
- Formulário de contato
- Informações institucionais

### 1.2 Status das Funcionalidades

| Funcionalidade | Descrição | Status |
|---|---|---|
| Autenticação por email/senha | Login seguro com hash bcrypt | ✅ Pronto |
| Dashboard administrativo | Gráficos, KPIs, métricas em tempo real | ✅ Pronto (dados mock) |
| Gestão de produtos | CRUD completo, categorias, estoque | ✅ Pronto (dados mock) |
| Sistema de pedidos | Registrar, editar, cancelar pedidos | ✅ Pronto (dados mock) |
| Banco de dados SQLite | Persistência com SQLAlchemy + Alembic | ✅ Pronto |
| Controle de permissões | Admin, operador, cliente | ⏳ Parcialmente pronto |
| Relatórios exportáveis | CSV, PDF, análises | ⏳ Em construção |
| API RESTful versionada | v1 com endpoints JSON | ⏳ Em construção |

### 1.3 Público-alvo

| Tipo | Acesso | Funcionalidades |
|---|---|---|
| Administrador | Painel administrativo completo | Todos os CRUD, relatórios, configurações |
| Operador/Vendedor | PDV — ponto de venda | Vendas, clientes, pedidos |
| Cliente | Site público | Catálogo, carrinho, contato |
| Visitante | Site público | Catálogo, sobre, contato |

---

## 2. Visão Geral da Arquitetura

### 2.1 Princípios de Design

A aplicação segue **separação rigorosa de responsabilidades (SoC — Separation of Concerns)**:

```
┌─────────────────────────────────────────────────┐
│                   APPS (UI)                     │
│         HTML • CSS • JavaScript Vanilla         │
├─────────────────────────────────────────────────┤
│              v1 — ENDPOINTS HTTP                │
│         FastAPI Routers • Middleware            │
├─────────────────────────────────────────────────┤
│            SERVICES — LÓGICA DE NEGÓCIO         │
│         Regras • Validações • Cálculos          │
├─────────────────────────────────────────────────┤
│           DATABASE — PERSISTÊNCIA               │
│      SQLAlchemy • Modelos • Migrations          │
└─────────────────────────────────────────────────┘
```

Benefícios dessa estrutura:
- ✅ Testes isolados em cada camada
- ✅ Reutilização de código entre PDV e Site
- ✅ Fácil manutenção e evolução
- ✅ API pronta para mobile/terceiros no futuro
- ✅ Substituição de tecnologia sem quebrar outras camadas

### 2.2 Fluxo de uma Requisição Completa

Exemplo: Usuário clica em **"Novo Produto"** no PDV

```
[Usuário clica no botão]
        ↓
[dashboard.js — apiPost('/api/v1/pdv/produtos', dados)]
        ↓
[FastAPI — POST /api/v1/pdv/produtos]
        ↓
[middleware.py — verifica autenticação]
        ↓
[pdv.py — valida payload, chama service]
        ↓
[produto_service.py — regras de negócio, validações]
        ↓
[produto_controller.py — persiste no banco via SQLAlchemy]
        ↓
[Resposta JSON → atualiza UI com toast de sucesso]
```

---

## 3. Estrutura de Diretórios

```
aapm/
├── apps/                       # Camada de apresentação (UI)
│   ├── pdv/                    # Painel administrativo
│   │   ├── views/              # Templates HTML/Jinja2
│   │   ├── styles/             # CSS (variáveis, grid, animações)
│   │   ├── scripts/            # JavaScript Vanilla
│   │   │   └── dashboard.js    # Hub principal do frontend
│   │   └── assets/             # Imagens, ícones, fontes
│   └── site/                   # Site público
│       ├── views/
│       ├── styles/
│       ├── scripts/
│       └── assets/
│
├── database/                   # Camada de dados
│   ├── models/                 # Modelos SQLAlchemy
│   │   ├── usuario.py
│   │   ├── produto.py
│   │   ├── categoria.py
│   │   ├── venda.py
│   │   └── movimentacao.py
│   ├── controllers/            # Acesso ao banco
│   │   ├── produto_controller.py
│   │   ├── categoria_controller.py
│   │   ├── movimentacao_controller.py
│   │   ├── auth_controller.py
│   │   └── admin_controller.py
│   ├── database.py             # Config SQLAlchemy
│   └── auth.py                 # Funções de autenticação
│
├── v1/                         # Endpoints HTTP
│   ├── api/
│   │   └── v1/
│   │       └── pdv.py          # Endpoints do painel admin
│   ├── site.py                 # Endpoints públicos
│   └── middleware.py           # JWT, CORS, logging
│
├── services/                   # Lógica de negócio
│   ├── produto_service.py
│   ├── venda_service.py
│   └── estoque_service.py
│
├── migrations/                 # Alembic migrations
│   ├── versions/
│   └── env.py
│
├── docs/                       # Documentação
│   ├── arquitetura.md
│   ├── requisitos.md
│   └── funcionalidade_docs.txt
│
├── main.py                     # Ponto de entrada FastAPI
├── requirements.txt
├── .env                        # Variáveis de ambiente (não versionar!)
├── .env.example
├── .gitignore
└── criar_usuario.py            # Script de setup inicial
```

### 3.1 Responsabilidades por Camada

**`apps/`** — Toda apresentação visual e interação do usuário. Nenhuma lógica de negócio — apenas HTML, CSS e JavaScript.

**`database/`** — Tudo relacionado à persistência de dados: modelos, sessões, queries e autenticação.

**`v1/`** — Define os pontos de entrada HTTP que conectam frontend com backend. Middleware global, rotas versionadas.

**`services/`** — Regras de negócio puras. Nunca contém código de UI ou SQL direto.

**`migrations/`** — Histórico auditável de cada alteração na estrutura do banco.

---

## 4. Stack Tecnológico

### 4.1 Backend

| Tecnologia | Versão | Função |
|---|---|---|
| Python | 3.10+ | Linguagem base |
| FastAPI | Latest | Framework web para API REST |
| Uvicorn | Latest | ASGI server |
| SQLAlchemy | Latest | ORM (mapeamento objeto-relacional) |
| Alembic | Latest | Versionamento de banco (migrations) |
| SQLite | 3.x | Banco de dados (arquivo único) |
| Jinja2 | Latest | Template engine |
| Bcrypt | 4.3.0 | Hash seguro de senhas |
| Passlib | Latest | Biblioteca de criptografia |
| PyJWT | Latest | JSON Web Tokens |
| python-dotenv | Latest | Variáveis de ambiente |
| python-multipart | Latest | Suporte a formulários multipart |

### 4.2 Frontend

| Tecnologia | Versão | Função |
|---|---|---|
| HTML5 | — | Markup semântico |
| CSS3 | — | Estilização + variáveis CSS + Grid/Flexbox |
| JavaScript ES6+ | — | Vanilla JS (sem frameworks) |
| Chart.js | 3.x | Gráficos e visualizações |
| Lucide Icons | Latest | Ícones SVG |
| Font Awesome | 6.5.1 | Ícones complementares |
| Poppins/Inter | Google Fonts | Tipografia |

### 4.3 DevOps e Qualidade

| Tecnologia | Função |
|---|---|
| Git / GitHub | Versionamento de código |
| pip | Gerenciador de pacotes Python |
| Virtual Environment | Isolamento de dependências |
| `.env` | Variáveis de ambiente sensíveis |
| `.gitignore` | Arquivos não versionados |

---

## 5. Instalação e Configuração

### 5.1 Pré-requisitos

- Python 3.10+ ([download](https://python.org))
- Git instalado
- Editor de código (VS Code recomendado)
- Terminal com acesso a `pip` e `python`

### 5.2 Passo a Passo

**Passo 1 — Clonar o repositório**

```bash
git clone https://github.com/seu-usuario/aapm.git
cd aapm
```

**Passo 2 — Criar ambiente virtual**

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/macOS
python3 -m venv venv
source venv/bin/activate
```

> Confirmação: seu prompt deve exibir `(venv)` no início.

**Passo 3 — Instalar dependências**

```bash
pip install -r requirements.txt
```

Conteúdo de `requirements.txt`:

```
fastapi
uvicorn[standard]
sqlalchemy
alembic
jinja2
bcrypt==4.3.0
passlib[bcrypt]
pyjwt
python-dotenv
python-multipart
```

**Passo 4 — Configurar variáveis de ambiente**

Copie o arquivo de exemplo e edite com seus valores:

```bash
cp .env.example .env
```

Conteúdo do `.env`:

```env
DATABASE_URL=sqlite:///./banco.db
SECRET_KEY=sua_chave_secreta_muito_segura_aqui
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

> ⚠️ **Nunca versione o arquivo `.env`** — ele já está no `.gitignore`.

**Passo 5 — Criar banco de dados**

```bash
alembic upgrade head
```

**Passo 6 — Criar usuário administrador**

```bash
python criar_usuario.py
```

---

## 6. Executando o Projeto

### 6.1 Servidor de desenvolvimento

```bash
uvicorn main:app --reload
```

Saída esperada:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 6.2 URLs disponíveis

| Aplicação | URL | Descrição |
|---|---|---|
| PDV (Admin) | http://localhost:8000 | Painel administrativo |
| Login | http://localhost:8000/auth/login | Tela de autenticação |
| API Docs | http://localhost:8000/docs | Swagger interativo |
| ReDoc | http://localhost:8000/redoc | Documentação alternativa |

### 6.3 Credenciais de teste

```
Email: admin@aapm.com
Senha: admin123
```

> ⚠️ Altere as credenciais padrão antes de qualquer deploy em produção.

### 6.4 Acessar o banco diretamente

```bash
# Instalar SQLite CLI (se necessário)
# Windows: https://sqlite.org/download.html
# Linux: sudo apt install sqlite3

sqlite3 banco.db
.tables
SELECT * FROM usuarios;
.quit
```

---

## 7. Banco de Dados e Migrations

### 7.1 Modelos de dados

| Modelo | Tabela | Campos principais |
|---|---|---|
| `Usuario` | `usuarios` | id, nome, email, senha_hash, role, ativo |
| `Produto` | `produtos` | id, nome, sku, categoria_id, preco, estoque, minimo, descricao |
| `Categoria` | `categorias` | id, nome, descricao, icon, ativo |
| `Venda` | `vendas` | id, numero, cliente_id, operador_id, total, status |
| `ItemVenda` | `itens_venda` | id, venda_id, produto_id, quantidade, preco_unitario |
| `Movimentacao` | `movimentacoes` | id, produto_id, tipo, quantidade, motivo, data |

### 7.2 Por que usar Migrations?

Migrations são registros auditáveis de cada alteração na estrutura do banco. Permitem:

- ✅ Rastreamento completo de mudanças
- ✅ Reversão segura a versões anteriores
- ✅ Colaboração sem conflitos de schema
- ✅ Deploy seguro em produção

### 7.3 Workflow típico

Cenário: adicionar campo `desconto` à tabela `vendas`

```bash
# 1. Editar o modelo em database/models/venda.py
#    Adicionar: desconto = Column(Float, default=0.0)

# 2. Gerar a migration automaticamente
alembic revision --autogenerate -m "add desconto to vendas"

# 3. Revisar o arquivo gerado em migrations/versions/
#    Confirmar que upgrade() e downgrade() estão corretos

# 4. Aplicar a migration
alembic upgrade head

# 5. Confirmar no banco
sqlite3 banco.db "PRAGMA table_info(vendas);"
```

### 7.4 Comandos Alembic úteis

```bash
alembic upgrade head          # Aplica todas as migrations pendentes
alembic downgrade -1          # Reverte a última migration
alembic current               # Exibe a revisão atual
alembic history               # Lista o histórico de migrations
alembic revision -m "msg"     # Cria migration manual (vazia)
alembic revision --autogenerate -m "msg"  # Cria migration automática
```

---

## 8. Componentes Principais

### 8.1 `main.py` — Aplicação FastAPI

Ponto de entrada da aplicação:

```python
app = FastAPI(title="AAPM", version="1.0")

# Registra templates Jinja2
templates = Jinja2Templates(directory="apps")

# Monta rotas dos controllers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(pdv_router, prefix="/api/v1")
```

### 8.2 `database/database.py` — Configuração SQLAlchemy

```python
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

def get_db():
    """Dependency injection de sessão para os controllers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 8.3 `database/auth.py` — Autenticação

| Função | Descrição |
|---|---|
| `hash_senha(senha)` | Gera hash bcrypt da senha |
| `get_admin(token, db)` | Retorna usuário admin ou lança HTTPException |
| `get_usuario_logado(token, db)` | Retorna usuário autenticado |
| `get_usuario_opcional(token, db)` | Retorna usuário ou `None` (rotas públicas) |

### 8.4 Controllers

| Controller | Funções principais | Status |
|---|---|---|
| `produto_controller.py` | `listar_produtos`, `form_nova_produto`, `criar_produto` | ✅ Pronto |
| `categoria_controller.py` | `listar_categorias`, `form_nova_categoria` | ✅ Pronto |
| `movimentacao_controller.py` | `listar_movimentacoes`, `registrar_movimentacao` | ✅ Pronto |
| `auth_controller.py` | Login, cadastro, logout | ✅ Pronto |
| `admin_controller.py` | Painel administrativo | ✅ Pronto |

---

## 9. API e Endpoints

### 9.1 Endpoints do PDV (autenticados)

```
POST   /api/v1/pdv/produtos          → Criar produto
GET    /api/v1/pdv/produtos          → Listar produtos
PUT    /api/v1/pdv/produtos/{id}     → Atualizar produto
DELETE /api/v1/pdv/produtos/{id}     → Remover produto

POST   /api/v1/pdv/pedidos           → Registrar pedido
GET    /api/v1/pdv/pedidos           → Listar pedidos
PUT    /api/v1/pdv/pedidos/{id}      → Atualizar pedido

GET    /api/v1/pdv/estoque           → Consultar estoque
POST   /api/v1/pdv/movimentacoes     → Registrar movimentação
```

### 9.2 Endpoints do Site (públicos)

```
GET    /api/v1/site/catalogo         → Lista produtos públicos
POST   /api/v1/site/contato          → Envia email de contato
```

### 9.3 Autenticação

```
POST   /auth/login                   → Autenticar usuário
POST   /auth/cadastro                → Registrar novo usuário
GET    /auth/logout                  → Encerrar sessão
```

### 9.4 Middleware (`v1/middleware.py`)

- Autenticação por token JWT
- CORS configurado
- Logging global de requisições
- Tratamento centralizado de exceções

---

## 10. Frontend e Apps

### 10.1 Estrutura do `dashboard.js`

O arquivo `apps/pdv/scripts/dashboard.js` é o **hub central** do frontend. Ele expõe objetos globais:

```javascript
window.API    // Helpers para fetch: get(), post(), put(), delete()
window.DB     // Dados mock simulados (em desenvolvimento)
window.UI     // Utilitários de interface: formatação, modais, toasts
window.CHARTS // Instâncias Chart.js do dashboard
```

Classes exportadas por página:

```javascript
ProductsPage    // Gestão de produtos
OrdersPage      // Gestão de pedidos
CustomersPage   // Gestão de clientes
CategoriesPage  // Gestão de categorias
StockPage       // Controle de estoque
ReportsPage     // Relatórios e análises
```

### 10.2 Sistema de rotas do PDV

A navegação é controlada por hash na URL:

```
/#admin          → Dashboard principal
/#grafico        → Análises e gráficos
/#pedidos        → Gestão de pedidos
/#clientes       → Gestão de clientes
/#categorias     → Gestão de categorias
/#produtos       → Gestão de produtos
/#estoque        → Controle de estoque
/#relatorios     → Relatórios exportáveis
/#configuracoes  → Configurações do sistema
```

### 10.3 Conectando ao backend

Os pontos de integração estão marcados com comentários `// TODO: conectar ao backend` no `dashboard.js`. Para conectar uma funcionalidade:

```javascript
// Antes (dados mock)
const produtos = window.DB.produtos;

// Depois (backend real)
const produtos = await window.API.get('/api/v1/pdv/produtos');
```

---

## 11. Autenticação e Autorização

### 11.1 Fluxo de autenticação

```
1. Usuário envia email + senha → POST /auth/login
2. Backend verifica hash bcrypt
3. Backend gera JWT token com role e expiração
4. Frontend armazena token (cookie seguro)
5. Requisições subsequentes enviam token no header Authorization
6. Middleware valida token em cada requisição protegida
```

### 11.2 Roles e permissões

```
admin      → Acesso total ao sistema
operador   → PDV: vendas, clientes, pedidos
cliente    → Site: catálogo, carrinho
```

### 11.3 Variáveis de ambiente relevantes

```env
SECRET_KEY=chave_jwt_segura_min_32_caracteres
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

---

## 12. Testes

> 🔧 Seção em construção — cobertura de testes planejada para v1.1

### 12.1 Estrutura planejada

```
tests/
├── test_auth.py
├── test_produto_service.py
├── test_venda_service.py
├── test_controllers/
└── conftest.py
```

### 12.2 Executar testes

```bash
# Instalar pytest
pip install pytest pytest-asyncio httpx

# Rodar todos os testes
pytest

# Rodar com cobertura
pytest --cov=. --cov-report=html
```

---

## 13. Workflow de Desenvolvimento

### 13.1 Adicionando uma nova funcionalidade

Siga a ordem das camadas:

```
1. Criar/editar modelo em database/models/
2. Gerar e aplicar migration: alembic revision --autogenerate -m "desc"
3. Implementar lógica em services/
4. Criar/editar controller em database/controllers/
5. Registrar endpoint em v1/api/v1/pdv.py ou v1/site.py
6. Atualizar frontend em apps/pdv/scripts/dashboard.js
7. Testar via Swagger em /docs
```

### 13.2 Convenções de código

**Python:**
```python
# Nomes de funções: snake_case
def listar_produtos(db: Session) -> list[Produto]:
    """Retorna todos os produtos ativos."""
    return db.query(Produto).filter(Produto.ativo == True).all()
```

**JavaScript:**
```javascript
// Nomes de funções: camelCase
async function carregarProdutos() {
    const produtos = await window.API.get('/api/v1/pdv/produtos');
    renderizarTabela(produtos);
}
```

**Commits (Conventional Commits):**
```
feat: adiciona exportação de relatório em PDF
fix: corrige cálculo de desconto em vendas
docs: atualiza instruções de instalação
refactor: reorganiza services de produto
```

---

## 14. Troubleshooting

### Erro: `ModuleNotFoundError`

```bash
# Certifique-se de que o ambiente virtual está ativo
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows

# Reinstale as dependências
pip install -r requirements.txt
```

### Erro: `alembic.util.exc.CommandError: Can't locate revision`

```bash
# Redefine o histórico de migrations
alembic stamp head
alembic upgrade head
```

### Erro: banco de dados bloqueado (`database is locked`)

```bash
# Verifique processos usando o banco
lsof banco.db  # Linux/macOS

# Reinicie o servidor
CTRL+C
uvicorn main:app --reload
```

### Dashboard sem dados

Os dados mock são carregados via `localStorage`. Limpe o cache do navegador ou verifique os comentários `// TODO: conectar ao backend` no `dashboard.js`.

### Porta 8000 em uso

```bash
# Usar outra porta
uvicorn main:app --reload --port 8001
```

---

## 15. Contribuindo

### 15.1 Guia de contribuição

```bash
# 1. Fork o projeto no GitHub
# 2. Clone seu fork
git clone https://github.com/seu-usuario/aapm.git

# 3. Crie uma branch para sua feature
git checkout -b feat/descricao-da-feature

# 4. Faça suas alterações e commit
git add .
git commit -m "feat: descrição clara da mudança"

# 5. Push para seu fork
git push origin feat/descricao-da-feature

# 6. Abra um Pull Request descrevendo as mudanças
```

### 15.2 Checklist antes de submeter PR

- [ ] Código segue as convenções de nomenclatura do projeto
- [ ] Funções têm docstrings descritivas
- [ ] Testes passam (`pytest`)
- [ ] Sem erros de linting
- [ ] Migrations criadas (se houve mudança no banco)
- [ ] README atualizado (se necessário)
- [ ] Nenhum secret ou hardcode no código
- [ ] Branch criada a partir de `main` atualizado

---

## 16. Referências de Arquivos e Símbolos

### 16.1 Mapeamento de funções principais

| Função | Arquivo | Descrição |
|---|---|---|
| `tela_home` | `main.py` | Renderiza página inicial |
| `get_db` | `database.py` | Dependency injection de sessão |
| `hash_senha` | `auth.py` | Hash bcrypt de senha |
| `get_admin` | `auth.py` | Retorna admin autenticado |
| `get_usuario_logado` | `auth.py` | Retorna usuário autenticado |
| `listar_produtos` | `produto_controller.py` | Lista produtos (HTML) |
| `criar_produto` | `produto_controller.py` | Cria produto via formulário |
| `apiGet` | `dashboard.js` | Fetch GET wrapper |
| `apiPost` | `dashboard.js` | Fetch POST wrapper |
| `UI.money` | `dashboard.js` | Formata valor em BRL |
| `toast` | `dashboard.js` | Exibe notificação temporária |
| `run_migrations_online` | `env.py` | Executa migrations |

### 16.2 Arquivos principais

| Arquivo | Função | Linhas aprox. |
|---|---|---|
| `main.py` | Aplicação FastAPI | ~300 |
| `database.py` | Config SQLAlchemy | ~50 |
| `auth.py` | Autenticação | ~100 |
| `dashboard.js` | Hub frontend | ~1200 |
| `dashboard.html` | Template principal | ~400 |
| `dashboard.css` | Estilos | ~600 |
| `env.py` | Config Alembic | ~80 |
| `arquitetura.md` | Documentação técnica | ~400 |

### 16.3 Variáveis de ambiente

| Variável | Exemplo | Descrição |
|---|---|---|
| `DATABASE_URL` | `sqlite:///banco.db` | String de conexão ao banco |
| `SECRET_KEY` | `47b2822e0c...` | Chave para assinatura JWT |
| `ALGORITHM` | `HS256` | Algoritmo JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Tempo de expiração do token |

---

## Conclusão

Este README cobre a estrutura completa, componentes e fluxos do **AAPM v1.0**.

**Próximos passos recomendados:**

- ✅ Setup inicial → [Seção 5](#5-instalação-e-configuração)
- ✅ Executar o servidor → [Seção 6](#6-executando-o-projeto)
- ✅ Explorar o painel → http://localhost:8000
- ✅ Estudar a arquitetura → `docs/arquitetura.md`
- ✅ Adicionar funcionalidade → [Seção 13](#13-workflow-de-desenvolvimento)
- ✅ Escrever testes → [Seção 12](#12-testes)

---

<div align="center">

**AAPM v1.0** • Desenvolvido pela equipe de estudantes para o SENAI Francisco Matarazzo — São Paulo/SP  
Abril de 2026 • Status: Ativo em Desenvolvimento


</div>
