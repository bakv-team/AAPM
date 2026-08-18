/* Dashboard: visão geral e atualização em tempo real. */

window.Dashboard = (function () {
  const REALTIME_REFRESH_MS = 5000;
  let refreshTimer = null;
  let refreshInFlight = false;

  function todayMetrics() {
    if (window.DB.metrics) return window.DB.metrics;
    if (!window.DB.daily.length) {
      return {
        revenue: 0, items: 0, orders: 0, ticket: 0, monthRevenue: 0,
        revPct: 0, itemsPct: 0, ordersPct: 0, ticketPct: 0, monthPct: 0
      };
    }
    const today = window.DB.daily[window.DB.daily.length - 1];
    const yesterday = window.DB.daily[window.DB.daily.length - 2] || { revenue: 0, items: 0, orders: 0 };
    const monthRevenue = window.DB.daily.reduce((s, d) => s + d.revenue, 0);
    const ticket = today.orders ? today.revenue / today.orders : 0;
    const ticketYday = yesterday.orders ? yesterday.revenue / yesterday.orders : 0;
    const pct = (a, b) => b ? (((a - b) / b) * 100) : 0;
    return {
      revenue: today.revenue, items: today.items, orders: today.orders, ticket,
      monthRevenue,
      revPct: pct(today.revenue, yesterday.revenue),
      itemsPct: pct(today.items, yesterday.items),
      ordersPct: pct(today.orders, yesterday.orders),
      ticketPct: pct(ticket, ticketYday),
      monthPct: 12.4
    };
  }

  function setTrend(el, val, prefix = "") {
    if (!el) return;
    const up = val >= 0;
    el.className = "kpi-trend " + (up ? "up" : "down");
    el.innerHTML = `<i class="fa-solid fa-arrow-trend-${up ? "up" : "down"}"></i> ${prefix}${up ? "+" : ""}${val.toFixed(1)}%`;
  }
  function setTrendInline(el, val) {
    if (!el) return;
    el.textContent = `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
  }

  function renderTopProducts() {
    const sorted = (window.DB.topProducts || []).slice(0, 5);

    const el = document.getElementById("topProducts");
    if (!sorted.length) {
      el.innerHTML = `<li><div class="meta"><strong>Nenhuma venda registrada</strong><span>Os produtos aparecem aqui conforme as vendas do PDV.</span></div></li>`;
      return;
    }
    el.innerHTML = sorted.map((s, i) => {
      const cat = window.DB.getCategory(s.categoryId);
      const color = UI.palette[i % UI.palette.length];
      return `
        <li>
          <div class="thumb" style="background:linear-gradient(135deg, ${color}, ${color}aa)"><i class="fa-solid ${cat?.icon || "fa-box"}"></i></div>
          <div class="meta"><strong title="${s.name}">${s.name}</strong><span title="${s.categoryName || cat?.name || "Sem categoria"}">${s.categoryName || cat?.name || "Sem categoria"}</span></div>
          <div class="val">${UI.money(s.revenue || 0)}</div>
        </li>
      `;
    }).join("");
  }

  function renderRecentOrders() {
    const body = document.getElementById("recentOrdersBody");

    const status = s => s === "concluido" ? `<span class="pill green">ConcluÃ­do</span>`
      : s === "pendente" ? `<span class="pill yellow">Pendente</span>`
      : `<span class="pill red">Cancelado</span>`;
    if (!window.DB.orders.length) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-mute)">Nenhum pedido registrado.</td></tr>`;
      UI.paginateTable(body, "recent-orders");
      return;
    }
    body.innerHTML = window.DB.orders.map(o => `
      <tr>
        <td><strong>${o.number}</strong></td>
        <td>${o.customerName}</td>
        <td>${UI.money(o.total)}</td>
        <td>${status(o.status)}</td>
      </tr>
    `).join("");
    UI.paginateTable(body, "recent-orders");
  }

  function renderDashboardInsights() {
    const el = document.getElementById("dashboardInsights");
    if (!el) return;

    const today = window.DB.daily[window.DB.daily.length - 1] || { revenue: 0, orders: 0, items: 0 };
    const ticket = today.orders ? today.revenue / today.orders : 0;
    const lowStock = window.DB.products.filter(p => p.stock > 0 && p.stock <= 5);
    const outStock = window.DB.products.filter(p => p.stock <= 0);
    const categories = window.CHARTS.aggregateByCategory().filter(c => c.value > 0).sort((a, b) => b.value - a.value);
    const peak = (window.DB.hourly || []).slice().sort((a, b) => (b.orders || 0) - (a.orders || 0))[0];
    const topProduct = (window.DB.topProducts || [])[0];
    const totalCategoryRevenue = categories.reduce((sum, item) => sum + item.value, 0) || 1;
    const leadingCategory = categories[0];
    const leadingPct = leadingCategory ? (leadingCategory.value / totalCategoryRevenue) * 100 : 0;

    const insights = [
      {
        icon: "fa-receipt",
        tone: "info",
        title: "Ticket mÃ©dio de hoje",
        text: today.orders ? `${UI.money(ticket)} por pedido concluÃ­do.` : "Ainda sem pedidos concluÃ­dos hoje."
      },
      {
        icon: "fa-ranking-star",
        tone: "success",
        title: "Produto destaque",
        text: topProduct ? `${topProduct.name} lidera com ${UI.money(topProduct.revenue || 0)} em receita.` : "Os produtos destaque aparecem apÃ³s as primeiras vendas."
      },
      {
        icon: "fa-clock",
        tone: "info",
        title: "HorÃ¡rio de pico",
        text: peak && peak.orders ? `Maior movimento por volta de ${peak.hour}h, com ${UI.num(peak.orders)} pedido(s).` : "Ainda nÃ£o hÃ¡ pico de vendas identificado."
      },
      {
        icon: "fa-layer-group",
        tone: "success",
        title: "Categoria lÃ­der",
        text: leadingCategory ? `${leadingCategory.name} representa ${leadingPct.toFixed(1)}% da receita por categoria.` : "Categorias serÃ£o destacadas conforme as vendas entrarem."
      },
      {
        icon: "fa-triangle-exclamation",
        tone: lowStock.length || outStock.length ? "warn" : "success",
        title: "AtenÃ§Ã£o ao estoque",
        text: outStock.length
          ? `${outStock.length} produto(s) sem estoque e ${lowStock.length} com estoque baixo.`
          : lowStock.length
            ? `${lowStock.length} produto(s) precisam de reposiÃ§Ã£o preventiva.`
            : "Estoque sem alertas crÃ­ticos no momento."
      }
    ];

    el.innerHTML = insights.map(item => `
      <article class="dashboard-insight ${item.tone}">
        <i class="fa-solid ${item.icon}"></i>
        <div><strong>${item.title}</strong><span>${item.text}</span></div>
      </article>
    `).join("");
  }

  function refresh() {
    const m = todayMetrics();

    // Dashboard KPIs
    document.getElementById("kpiRevenue").textContent = UI.money(m.revenue);
    document.getElementById("kpiItems").textContent = UI.num(m.items);
    document.getElementById("kpiOrders").textContent = UI.num(m.orders);
    document.getElementById("kpiTicket").textContent = UI.money(m.ticket);
    setTrend(document.getElementById("kpiRevenueTrend"), m.revPct);
    setTrend(document.getElementById("kpiItemsTrend"), m.itemsPct);
    setTrend(document.getElementById("kpiOrdersTrend"), m.ordersPct);
    setTrend(document.getElementById("kpiTicketTrend"), m.ticketPct);

    // Graphic panel KPIs
    document.getElementById("gRevenue").textContent = UI.money(m.revenue);
    document.getElementById("gItems").textContent = UI.num(m.items);
    document.getElementById("gOrders").textContent = UI.num(m.orders);
    document.getElementById("gTotal").textContent = UI.money(m.monthRevenue);
    setTrendInline(document.getElementById("gRevenuePct"), m.revPct);
    setTrendInline(document.getElementById("gItemsPct"), m.itemsPct);
    setTrendInline(document.getElementById("gOrdersPct"), m.ordersPct);
    setTrendInline(document.getElementById("gTotalPct"), m.monthPct);

    renderTopProducts();
    renderRecentOrders();
    renderDashboardInsights();
    window.CHARTS.refreshAll();
  }

  async function refreshFromApi() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const [prods, orders, daily, hourly, notifications, metrics, topProducts] = await Promise.all([
        window.API.getProducts(),
        window.API.getOrders(),
        window.API.getDailySales(30),
        window.API.getHourlySales(),
        window.API.getNotifications(),
        window.API.getDashboardMetrics(),
        window.API.getTopProducts()
      ]);
      window.DB.products = prods;
      window.DB.orders = orders;
      window.DB.daily = daily;
      window.DB.hourly = hourly;
      window.DB.notifications = notifications;
      window.DB.metrics = metrics;
      window.DB.topProducts = topProducts;

      window.CHARTS?.setAnimationsEnabled?.(false);
      refresh();
      window.CHARTS?.setAnimationsEnabled?.(true);
      renderNotifications();
      updateSidebarBadges();

      const route = (location.hash || "#dashboard").replace("#", "");
      if (route === "pedidos") window.OrdersPage?.render();
      if (route === "estoque") window.StockPage?.render();
      if (route === "movimentacoes") window.StockMovementsPage?.render();
    } catch (error) {
      console.warn("Falha ao atualizar dados em tempo real:", error);
      window.CHARTS?.setAnimationsEnabled?.(true);
    } finally {
      refreshInFlight = false;
    }
  }

  function init() {
    refresh();
    // Range selector
    document.querySelectorAll(".seg-btn[data-range]").forEach(b => {
      b.addEventListener("click", () => {
        document.querySelectorAll(".seg-btn[data-range]").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        window.CHARTS.setRange(parseInt(b.dataset.range, 10));
      });
    });

    if (!refreshTimer) {
      refreshTimer = window.setInterval(refreshFromApi, REALTIME_REFRESH_MS);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshFromApi();
      });
    }
  }

  return { init, refresh, refreshFromApi };
})();



