# Scripts do dashboard

Os scripts são carregados em ordem por `apps/pvd/views/dashboard.html`. Eles continuam usando os objetos globais existentes (`API`, `DB`, `UI`, `CHARTS` e as páginas) para preservar a compatibilidade da interface atual.

```text
background.js              animação visual do app shell
api.js                     cliente HTTP e cache de dados da tela
ui.js                      formatação, modal, toast e exportação
charts.js                  gráficos e agregações
pages/                     uma tela por arquivo
  products.js
  orders.js
  customers.js
  categories.js
  employees.js
  stock.js
  stock-movements.js
  overview.js              indicadores e atualização em tempo real
app.js                     permissões, navegação e inicialização
```

Ao criar uma nova tela, prefira adicioná-la em `pages/`, inclua seu script antes de `app.js` e registre a rota/permissão no `app.js`.
