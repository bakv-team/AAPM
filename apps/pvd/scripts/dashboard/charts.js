/* Dashboard: gráficos e agregações. */

window.CHARTS = (function () {
  const instances = {};
  const defaultChartAnimation = window.Chart ? Chart.defaults.animation : undefined;

  const TEXT_COLOR = () => getComputedStyle(document.body).getPropertyValue("--text-2").trim() || "#324269";
  const GRID = () => "rgba(10,23,56,0.08)";

  function setAnimationsEnabled(enabled) {
    if (!window.Chart) return;
    Chart.defaults.animation = enabled ? defaultChartAnimation : false;
  }

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  function tooltipStyle() {
    return {
      backgroundColor: "rgba(10,23,56,0.92)",
      titleColor: "#fff",
      bodyColor: "#DCE3FB",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      displayColors: true,
      boxPadding: 6
    };
  }

  function shortLabel(value, max = 26) {
    const text = String(value || "");
    return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}â€¦` : text;
  }

  function shortMoneyTick(value) {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    if (abs >= 1000000) return `R$ ${(n / 1000000).toFixed(abs >= 10000000 ? 0 : 1)}M`;
    if (abs >= 1000) return `R$ ${(n / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    return `R$ ${n}`;
  }

  function salesLine(range = 7) {
    destroy("salesLine");
    const ctx = document.getElementById("chartSalesLine");
    if (!ctx) return;

    const data = window.DB.daily.slice(-range).map(d => ({
      ...d,
      date: d.date instanceof Date ? d.date : new Date(`${d.date}T00:00:00`)
    }));

    const labels = data.map(d => UI.dayShort(d.date));
    const grad = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, "rgba(255,107,53,0.35)");
    grad.addColorStop(1, "rgba(255,107,53,0)");

    instances.salesLine = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Receita",
            data: data.map(d => d.revenue),
            borderColor: "#FF6B35",
            backgroundColor: grad,
            tension: 0.4, fill: true, borderWidth: 3,
            pointRadius: 0, pointHoverRadius: 6,
            pointHoverBackgroundColor: "#FF6B35",
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 3,
            yAxisID: "y"
          },
          {
            label: "Pedidos",
            data: data.map(d => d.orders),
            borderColor: "#2D7BFF",
            backgroundColor: "rgba(45,123,255,0.1)",
            tension: 0.4, borderWidth: 2.5, borderDash: [6, 4],
            pointRadius: 0, pointHoverRadius: 5,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: true, position: "bottom", labels: { color: TEXT_COLOR(), usePointStyle: true, padding: 16, font: { family: "Outfit", weight: "600" } } },
          tooltip: { ...tooltipStyle(), callbacks: { label: c => c.dataset.label === "Receita" ? `${c.dataset.label}: ${UI.money(c.parsed.y)}` : `${c.dataset.label}: ${c.parsed.y}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: TEXT_COLOR() } },
          y: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR(), callback: v => shortMoneyTick(v) } },
          y1: { position: "right", grid: { display: false }, ticks: { color: TEXT_COLOR() } }
        }
      }
    });
  }

  function dashboardTicket(canvasId = "chartDashboardTicket") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const data = window.DB.daily.slice(-7).map(d => ({
      ...d,
      date: d.date instanceof Date ? d.date : new Date(`${d.date}T00:00:00`),
      ticket: d.orders ? d.revenue / d.orders : 0
    }));
    const grad = ctx.getContext("2d").createLinearGradient(0, 0, 0, 260);
    grad.addColorStop(0, "rgba(22,199,132,0.32)");
    grad.addColorStop(1, "rgba(22,199,132,0)");

    instances[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map(d => UI.dayShort(d.date)),
        datasets: [{
          label: "Ticket mÃ©dio",
          data: data.map(d => d.ticket),
          borderColor: "#16C784",
          backgroundColor: grad,
          fill: true,
          tension: 0.38,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#16C784",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle(), callbacks: { label: c => UI.money(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: TEXT_COLOR() } },
          y: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR(), callback: v => shortMoneyTick(v) } }
        }
      }
    });
  }

  function dashboardAssociates(canvasId = "chartDashboardAssociates", legendId = "legendDashboardAssociates") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const associateNames = new Set(
      window.DB.customers
        .filter(c => c.isAssociado || c.is_associado)
        .map(c => String(c.name || c.nome || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const totals = window.DB.orders.reduce((acc, order) => {
      if (order.status === "cancelado") return acc;
      const name = String(order.customerName || "").trim().toLowerCase();
      if (associateNames.has(name)) acc.associados += 1;
      else acc.outros += 1;
      return acc;
    }, { associados: 0, outros: 0 });
    const data = [
      { name: "Associados", value: totals.associados, color: "#2D7BFF" },
      { name: "NÃ£o associados", value: totals.outros, color: "#F5A623" }
    ];

    instances[canvasId] = new Chart(ctx, {
      type: "polarArea",
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => `${d.color}cc`),
          borderColor: data.map(d => d.color),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle(), callbacks: { label: c => `${c.label}: ${UI.num(c.raw ?? c.parsed?.r ?? c.parsed)} pedido(s)` } }
        },
        scales: {
          r: {
            ticks: { display: false, backdropColor: "transparent" },
            grid: { color: GRID() },
            angleLines: { color: GRID() }
          }
        }
      }
    });
    renderLegend(legendId, data);
  }

  function aggregateByCategory() {
    const totals = {};
    window.DB.orders.forEach(o => {
      if (o.status === "cancelado") return;
      o.items.forEach(it => {
        const p = window.DB.getProduct(it.productId);
        if (!p) return;
        totals[p.categoryId] = (totals[p.categoryId] || 0) + it.qty * it.price;
      });
    });
    return window.DB.categories.map((c, i) => ({
      id: c.id, name: c.name, color: UI.palette[i % UI.palette.length],
      value: Math.round(totals[c.id] || 0)
    }));
  }

  function categoryPie(canvasId = "chartCategoryPie", legendId = "legendCategory") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const data = aggregateByCategory();
    instances[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: data.map(d => shortLabel(d.name, 30)),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color),
          borderWidth: 0,
          hoverOffset: 8,
          spacing: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle(), callbacks: { label: c => `${data[c.dataIndex]?.name || c.label}: ${UI.money(c.parsed)}` } }
        }
      }
    });
    renderLegend(legendId, data);
  }

  function renderLegend(legendId, data) {
    const el = document.getElementById(legendId);
    if (!el) return;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    el.innerHTML = data.map(d => `
      <li title="${d.name}">
        <span class="swatch" style="background:${d.color}"></span>
        <span>${shortLabel(d.name, 44)}</span>
        <strong>${((d.value / total) * 100).toFixed(1)}%</strong>
      </li>
    `).join("");
  }

  function categoryBar(canvasId = "chartCategoryBar") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const data = aggregateByCategory();
    instances[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => shortLabel(d.name, 18)),
        datasets: [{
          label: "Receita",
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color),
          borderRadius: 10,
          maxBarThickness: 38
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle(), callbacks: { title: items => data[items[0]?.dataIndex]?.name || items[0]?.label || "", label: c => UI.money(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: TEXT_COLOR() } },
          y: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR(), callback: v => shortMoneyTick(v) } }
        }
      }
    });
  }

  function categoryRadar(canvasId = "chartCategoryRadar", legendId = "legendCategory2") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const data = aggregateByCategory();

    instances[canvasId] = new Chart(ctx, {
      type: "radar",
      data: {
        labels: data.map(d => shortLabel(d.name, 20)),
        datasets: [{
          label: "Receita",
          data: data.map(d => d.value),
          borderColor: "#7C5CFF",
          backgroundColor: "rgba(124,92,255,0.18)",
          pointBackgroundColor: data.map(d => d.color),
          pointBorderColor: "#fff",
          pointHoverRadius: 5,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle(), callbacks: { title: items => data[items[0]?.dataIndex]?.name || items[0]?.label || "", label: c => UI.money(c.parsed.r) } }
        },
        scales: {
          r: {
            beginAtZero: true,
            angleLines: { color: GRID() },
            grid: { color: GRID() },
            pointLabels: { color: TEXT_COLOR(), font: { size: 11, family: "Outfit" } },
            ticks: { display: false, backdropColor: "transparent" }
          }
        }
      }
    });
    renderLegend(legendId, data);
  }

  function topProductsRevenue(canvasId = "chartTopProductsRevenue") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const totals = {};
    window.DB.orders.forEach(order => {
      if (order.status === "cancelado") return;
      order.items.forEach(item => {
        const product = window.DB.getProduct(item.productId);
        const name = product?.name || item.name || "Produto";
        totals[name] = (totals[name] || 0) + (Number(item.qty) || 0) * (Number(item.price) || 0);
      });
    });
    const data = Object.entries(totals)
      .map(([name, value], index) => ({ name, value: Math.round(value), color: UI.palette[index % UI.palette.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    instances[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => shortLabel(d.name, 20)),
        datasets: [{
          label: "Receita",
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color),
          borderRadius: 10,
          maxBarThickness: 34
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle(), callbacks: { title: items => data[items[0]?.dataIndex]?.name || items[0]?.label || "", label: c => UI.money(c.parsed.x) } }
        },
        scales: {
          x: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR(), callback: v => shortMoneyTick(v) } },
          y: { grid: { display: false }, ticks: { color: TEXT_COLOR() } }
        }
      }
    });
  }

  function stockHealth(canvasId = "chartStockHealth", legendId = "legendStockHealth") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const data = [
      { name: "Em falta", value: window.DB.products.filter(p => p.stock <= 0).length, color: "#FF4D6D" },
      { name: "Estoque baixo", value: window.DB.products.filter(p => p.stock > 0 && p.stock <= 5).length, color: "#F5A623" },
      { name: "Estoque seguro", value: window.DB.products.filter(p => p.stock > 5).length, color: "#16C784" }
    ];

    instances[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color),
          borderWidth: 0,
          hoverOffset: 8,
          spacing: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle(), callbacks: { label: c => `${c.label}: ${UI.num(c.parsed)} produto(s)` } }
        }
      }
    });
    renderLegend(legendId, data);
  }

  function hourly(canvasId = "chartHourly") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const grad = ctx.getContext("2d").createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, "rgba(45,123,255,0.35)");
    grad.addColorStop(1, "rgba(45,123,255,0)");
    instances[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: window.DB.hourly.map(h => h.hour + "h"),
        datasets: [
          {
            label: "Receita (R$)",
            data: window.DB.hourly.map(h => h.revenue),
            borderColor: "#FF6B35",
            backgroundColor: "rgba(255, 107, 53, 0.14)",
            fill: true,
            tension: 0.38,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            yAxisID: "y"
          },
          {
            label: "Pedidos",
            data: window.DB.hourly.map(h => h.orders),
            borderColor: "#2D7BFF",
            backgroundColor: grad,
            fill: true,
            tension: 0.38,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: true, position: "bottom", labels: { color: TEXT_COLOR(), usePointStyle: true, padding: 14 } },
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              label: c => c.dataset.label === "Receita (R$)" ? `${c.dataset.label}: ${UI.money(c.parsed.y)}` : `${c.dataset.label}: ${UI.num(c.parsed.y)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: TEXT_COLOR() } },
          y: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR(), callback: v => shortMoneyTick(v) } },
          y1: { position: "right", beginAtZero: true, grid: { display: false }, ticks: { color: TEXT_COLOR(), precision: 0 } }
        }
      }
    });
  }

  function refreshAll() {
    salesLine(currentRange);
    dashboardTicket();
    dashboardAssociates();
    categoryPie("chartCategoryPie", "legendCategory");
    categoryRadar("chartCategoryRadar", "legendCategory2");
    categoryBar();
    topProductsRevenue();
    stockHealth();
    hourly();
  }

  function resizeAll() {
    Object.values(instances).forEach(chart => {
      const canvas = chart?.canvas;
      if (!canvas || !canvas.offsetParent) return;
      chart.resize();
    });
  }

  let currentRange = 7;
  function setRange(r) { currentRange = r; salesLine(r); }

  return { salesLine, dashboardTicket, dashboardAssociates, categoryPie, categoryBar, categoryRadar, topProductsRevenue, stockHealth, hourly, refreshAll, resizeAll, setRange, setAnimationsEnabled, aggregateByCategory };
})();



