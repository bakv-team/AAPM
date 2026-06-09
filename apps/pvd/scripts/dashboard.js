
/* =====================================================================
 *  BACKGROUND DO DASHBOARD — mesmo canvas da tela de login, atrás do app shell
 * ===================================================================== */
(function () {
  const canvas = document.getElementById("particles");
  const shell = document.getElementById("appShell");
  const ctx = canvas?.getContext("2d");

  if (!canvas || !shell || !ctx) return;

  let particles = [];
  let animationFrame = null;

  function resizeCanvas() {
    const rect = shell.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.clientWidth;
      this.y = Math.random() * canvas.clientHeight;
      this.size = Math.random() * 3 + 1;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.color = Math.random() > 0.5 ? "rgba(58,92,233,.35)" : "rgba(245,138,31,.35)";
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.x > canvas.clientWidth || this.x < 0) this.speedX *= -1;
      if (this.y > canvas.clientHeight || this.y < 0) this.speedY *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  function initParticles() {
    particles = Array.from({ length: 75 }, () => new Particle());
  }

  function connectParticles() {
    for (let a = 0; a < particles.length; a++) {
      for (let b = a; b < particles.length; b++) {
        const dx = particles[a].x - particles[b].x;
        const dy = particles[a].y - particles[b].y;
        const distance = dx * dx + dy * dy;

        if (distance < 10000) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(120,120,160,.07)";
          ctx.lineWidth = 1;
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    particles.forEach(particle => {
      particle.update();
      particle.draw();
    });
    connectParticles();
    animationFrame = requestAnimationFrame(animateParticles);
  }

  function restartParticles() {
    resizeCanvas();
    initParticles();
  }

  restartParticles();
  animateParticles();

  window.addEventListener("resize", restartParticles);

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(restartParticles);
    observer.observe(shell);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    } else if (!document.hidden && !animationFrame) {
      animateParticles();
    }
  });
})();

/* =====================================================================
 *  CAMADA DE API — ponte com FastAPI + SQLite + Alembic
 *  ---------------------------------------------------------------------
 *  As funções abaixo conversam com FastAPI e mantêm window.DB apenas como
 *  cache de tela para os componentes já existentes.
 * ===================================================================== */
window.API = (function () {
  const BASE_URL = window.location.origin;

  async function apiErrorMessage(res, fallback) {
    try {
      const data = await res.clone().json();
      if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
      if (Array.isArray(data.detail) && data.detail.length) {
        return data.detail.map(item => item.msg || item.message || JSON.stringify(item)).join(" ");
      }
      if (typeof data.message === "string" && data.message.trim()) return data.message;
    } catch (error) {
      try {
        const text = await res.clone().text();
        if (text.trim()) return text.trim();
      } catch (textError) {}
    }
    return fallback || `Erro ${res.status}`;
  }

  async function assertOk(res, fallback) {
    if (res.ok) return;
    throw new Error(await apiErrorMessage(res, fallback));
  }

  async function apiGet(path) {
    const res = await fetch(`${BASE_URL}${path}`, { credentials: "same-origin" });
    await assertOk(res, `GET ${path} -> ${res.status}`);
    return res.json();
  }
  async function apiPost(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    await assertOk(res, `POST ${path} -> ${res.status}`);
    return res.json();
  }
  async function apiPut(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    await assertOk(res, `PUT ${path} -> ${res.status}`);
    return res.json();
  }
  async function apiDelete(path) {
    const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE", credentials: "same-origin" });
    await assertOk(res, `DELETE ${path} -> ${res.status}`);
    return res.ok;
  }

  async function apiForm(path, method, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: "same-origin",
      body
    });
    await assertOk(res, `${method} ${path} -> ${res.status}`);
    return res.json();
  }

  function productFormData(payload) {
    const data = new FormData();
    data.set("nome", payload.name);
    data.set("descricao", payload.description || "");
    data.set("preco", payload.price);
    data.set("estoque_atual", payload.stock);
    data.set("categoria_id", payload.categoryId || 0);
    if (payload.image) data.set("imagem", payload.image);
    if (!payload.image && payload.existingImage) data.set("imagem_existente", payload.existingImage);
    return data;
  }

  // ----- Categorias -----
  async function getCategories() {
    return apiGet("/api/v1/pdv/categories");
  }
  async function createCategory(payload) {
    return apiPost("/api/v1/pdv/categories", payload);
  }
  async function updateCategory(id, payload) {
    return apiPut(`/api/v1/pdv/categories/${id}`, payload);
  }
  async function deleteCategory(id) {
    return apiDelete(`/api/v1/pdv/categories/${id}`);
  }

  // ----- Produtos -----
  async function getProducts(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.q) qs.set("q", filters.q);
    if (filters.category) qs.set("category_id", filters.category);
    if (filters.stock) qs.set("stock", filters.stock);
    if (filters.status) qs.set("status", filters.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiGet(`/api/v1/pdv/products${suffix}`);
  }
  async function getProductImages() {
    return apiGet("/api/v1/pdv/product-images");
  }
  async function createProduct(payload) {
    return apiForm("/api/v1/pdv/products", "POST", productFormData(payload));
  }
  async function updateProduct(id, payload) {
    return apiForm(`/api/v1/pdv/products/${id}`, "PUT", productFormData(payload));
  }
  async function addProductStock(id, quantidade) {
    return apiPost(`/api/v1/pdv/products/${id}/stock`, { quantidade });
  }
  async function getStockMovements(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.productId) qs.set("produto_id", filters.productId);
    if (filters.type) qs.set("tipo", filters.type);
    if (filters.limit) qs.set("limit", filters.limit);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiGet(`/api/v1/pdv/stock/movements${suffix}`);
  }
  async function deleteProduct(id) {
    return apiDelete(`/api/v1/pdv/products/${id}`);
  }
  async function setProductActive(id, ativo) {
    return apiPut(`/api/v1/pdv/products/${id}/status`, { ativo });
  }

  // ----- Associados -----
  async function getCustomers(q = "") {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return apiGet(`/api/v1/pdv/customers${qs}`);
  }
  async function createCustomer(payload) {
    return apiPost("/api/v1/pdv/customers", payload);
  }
  async function deleteCustomer(id) {
    return apiDelete(`/api/v1/pdv/customers/${id}`);
  }

  // ----- Pedidos -----
  async function getOrders(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.q) qs.set("q", filters.q);
    if (filters.status) qs.set("status", filters.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiGet(`/api/v1/pdv/orders${suffix}`);
  }
  async function createOrder(payload) {
    return apiPost("/api/v1/pdv/sales", payload);
  }

  // ----- Dashboard / Métricas -----
  async function getDashboardMetrics() {
    return apiGet("/api/v1/pdv/dashboard/metrics");
  }
  async function getDailySales(range = 7) {
    return apiGet(`/api/v1/pdv/dashboard/daily?range=${range}`);
  }
  async function getHourlySales() {
    return apiGet("/api/v1/pdv/dashboard/hourly");
  }
  async function getTopProducts() {
    return apiGet("/api/v1/pdv/dashboard/top-products");
  }
  async function getSmartInsights(options = {}) {
    const qs = new URLSearchParams();
    if (options.dailyGoal) qs.set("meta_diaria", options.dailyGoal);
    if (options.profitPerItem) qs.set("lucro_unidade", options.profitPerItem);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiGet(`/api/v1/pdv/smart/insights${suffix}`);
  }
  async function askSmartAssistant(payload) {
    return apiPost("/api/v1/pdv/smart/assistant", payload);
  }

  // ----- Notificações -----
  async function getNotifications() {
    return apiGet("/api/v1/pdv/notifications");
  }
  async function getSystemHealth() {
    return apiGet("/api/v1/pdv/system/health");
  }
  async function getProfile() {
    return apiGet("/api/v1/pdv/profile");
  }
  async function changePassword(payload) {
    return apiPost("/api/v1/pdv/profile/password", payload);
  }
  async function sendSupport(payload) {
    return apiPost("/api/v1/pdv/support", payload);
  }
  function downloadReport(kind, period = "") {
    const qs = new URLSearchParams();
    if (period) qs.set("period", period);
    const suffix = qs.toString() ? `?${qs}` : "";
    window.location.href = `${BASE_URL}/api/v1/pdv/reports/${encodeURIComponent(kind)}${suffix}`;
  }

  return {
    BASE_URL,
    apiGet, apiPost, apiPut, apiDelete,
    getCategories, createCategory, updateCategory, deleteCategory,
    getProducts, getProductImages, createProduct, updateProduct, addProductStock, getStockMovements, deleteProduct, setProductActive,
    getCustomers, createCustomer, deleteCustomer,
    getOrders, createOrder,
    getDashboardMetrics, getDailySales, getHourlySales, getTopProducts, getSmartInsights, askSmartAssistant,
    getNotifications, getSystemHealth, getProfile, changePassword, sendSupport, downloadReport
  };
})();


/* =====================================================================
 *  CACHE DE TELA — preenchido exclusivamente pela API real.
 * ===================================================================== */
(function () {
  window.DB = {
    categories: [],
    products: [],
    customers: [],
    orders: [],
    daily: [],
    hourly: [],
    notifications: [],
    metrics: null,
    smart: null,
    topProducts: [],
    stockMovements: [],

    getCategory(id) { return this.categories.find(c => c.id === id); },
    getProduct(id) { return this.products.find(p => p.id === id); }
  };
})();



window.UI = (function () {
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const NUM = new Intl.NumberFormat("pt-BR");

  function money(v) { return BRL.format(v || 0); }
  function num(v) { return NUM.format(v || 0); }
  function pct(v, decimals = 1) {
    const n = Number(v) || 0;
    return n.toFixed(decimals) + "%";
  }
  function todayBR() {
    return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  }
  function dayShort(date) {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  function dateBR(date) {
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("pt-BR") + " " + parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function stockStatus(product) {
    if (product.stock <= 0) return { pill: "red", label: "Sem estoque" };
    if (product.stock <= 5) return { pill: "yellow", label: "Estoque baixo" };
    return { pill: "green", label: "Em estoque" };
  }
  function initialsFromName(name) {
    return (name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0])
      .join("")
      .toUpperCase();
  }
  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  // Toast notification
  function toast(message, type = "info") {
    const wrap = document.getElementById("toastWrap");
    if (!wrap) return;
    const t = document.createElement("div");
    t.className = "toast " + type;
    const iconMap = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info", warn: "fa-triangle-exclamation" };
    const icon = document.createElement("i");
    icon.className = `fa-solid ${iconMap[type] || iconMap.info}`;
    const text = document.createElement("span");
    text.textContent = message;
    t.append(icon, text);
    wrap.appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      setTimeout(() => t.remove(), 280);
    }, 2800);
  }

  // Simple modal helpers
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("is-closing");
    el.classList.remove("hidden");
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains("hidden") || el.classList.contains("is-closing")) return;
    el.classList.add("is-closing");
    window.setTimeout(() => {
      el.classList.add("hidden");
      el.classList.remove("is-closing");
    }, 220);
  }

  // Confirm dialog (returns Promise<boolean>)
  function confirmDialog({ title = "Confirmar ação", text = "Tem certeza?", okLabel = "Confirmar" } = {}) {
    return new Promise(resolve => {
      const m = document.getElementById("confirmModal");
      document.getElementById("confirmTitle").textContent = title;
      document.getElementById("confirmText").textContent = text;
      const okBtn = document.getElementById("confirmOk");
      const cancelBtn = document.getElementById("confirmCancel");
      okBtn.textContent = okLabel;
      m.classList.remove("hidden");
      const clean = () => {
        m.classList.add("hidden");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
      };
      const onOk = () => { clean(); resolve(true); };
      const onCancel = () => { clean(); resolve(false); };
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
    });
  }

  // CSV exporter
  function downloadCSV(filename, rows) {
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? "");
      return /[",n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("n");
    const blob = new Blob(["ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }


  const palette = ["#FF6B35", "#2D7BFF", "#7C5CFF", "#16C784", "#F5A623", "#FF4D6D", "#22D3EE", "#A855F7"];

  return { money, num, pct, todayBR, dayShort, dateBR, stockStatus, initialsFromName, escapeHTML, toast, openModal, closeModal, confirmDialog, downloadCSV, palette };

})();



window.CHARTS = (function () {
  const instances = {};

  const TEXT_COLOR = () => getComputedStyle(document.body).getPropertyValue("--text-2").trim() || "#324269";
  const GRID = () => "rgba(10,23,56,0.08)";

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
    return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
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
          label: "Ticket médio",
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
      { name: "Não associados", value: totals.outros, color: "#F5A623" }
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
      type: "bar",
      data: {
        labels: window.DB.hourly.map(h => h.hour + "h"),
        datasets: [
          { label: "Receita (R$)", data: window.DB.hourly.map(h => h.revenue), backgroundColor: "#FF6B35", borderRadius: 8, maxBarThickness: 22, order: 2 },
          { label: "Pedidos", data: window.DB.hourly.map(h => h.orders * 30), type: "line", borderColor: "#2D7BFF", backgroundColor: grad, fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, order: 1, yAxisID: "y" }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "bottom", labels: { color: TEXT_COLOR(), usePointStyle: true, padding: 14 } }, tooltip: tooltipStyle() },
        scales: {
          x: { grid: { display: false }, ticks: { color: TEXT_COLOR() } },
          y: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR(), callback: v => shortMoneyTick(v) } }
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

  return { salesLine, dashboardTicket, dashboardAssociates, categoryPie, categoryBar, categoryRadar, topProductsRevenue, stockHealth, hourly, refreshAll, resizeAll, setRange, aggregateByCategory };
})();



window.ProductsPage = (function () {
  let page = 1;
  const perPage = 8;
  let filters = { q: "", category: "", stock: "", status: "active" };
  let imageLibraryItems = [];
  let productsPageItems = [];

  function getFiltered() {
    return productsPageItems.filter(p => {
      const cat = window.DB.getCategory(p.categoryId);
      if (filters.q && !(`${p.name} ${p.sku || ""} ${cat?.name || ""}`.toLowerCase().includes(filters.q.toLowerCase()))) return false;
      if (filters.category && p.categoryId !== filters.category) return false;
      if (filters.stock) {
        if (filters.stock === "in"  && p.stock <= 0) return false;
        if (filters.stock === "low" && !(p.stock > 0 && p.stock <= 5)) return false;
        if (filters.stock === "out" && p.stock > 0) return false;
      }
      return true;
    });
  }

  async function loadProductsByStatus() {
    try {
      productsPageItems = await window.API.getProducts({ status: filters.status });
      if (filters.status === "active") {
        window.DB.products = productsPageItems.slice();
      }
    } catch (err) {
      console.error("Falha ao carregar produtos por status:", err);
      UI.toast("Nao foi possivel carregar os produtos.", "error");
      productsPageItems = window.DB.products.slice();
    }
  }

  function render() {
    const body = document.getElementById("productsBody");
    if (!body) return;
    const filtered = getFiltered();
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (page > pages) page = pages;
    const items = filtered.slice((page - 1) * perPage, page * perPage);

    if (!items.length) {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--text-mute)">Nenhum produto encontrado.</td></tr>`;
    } else {
      body.innerHTML = items.map(p => {
        const cat = window.DB.getCategory(p.categoryId);
        const catIndex = window.DB.categories.findIndex(c => c.id === p.categoryId);
        const color = UI.palette[(catIndex >= 0 ? catIndex : 0) % UI.palette.length];
        const s = UI.stockStatus(p);
        const active = p.ativo !== false;
        const thumb = p.imageUrl
          ? `<div class="prod-thumb image"><img src="${p.imageUrl}" alt=""></div>`
          : `<div class="prod-thumb" style="background:linear-gradient(135deg, ${color}, ${color}aa)"><i class="fa-solid ${cat?.icon || "fa-box"}"></i></div>`;
        const actions = active
          ? `
                <button class="act-btn edit" data-action="edit" data-id="${p.id}" data-testid="edit-product-${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="act-btn delete" data-action="delete" data-id="${p.id}" data-testid="delete-product-${p.id}" title="Inativar"><i class="fa-solid fa-ban"></i></button>
            `
          : `<button class="act-btn view" data-action="activate" data-id="${p.id}" title="Ativar"><i class="fa-solid fa-check"></i></button>`;
        return `
          <tr data-id="${p.id}">
            <td>
              <div class="prod-cell">
                ${thumb}
                <div class="prod-name"><strong>${p.name}</strong><span>${p.sku || "—"}</span></div>
              </div>
            </td>
            <td><span class="pill gray">${cat?.name || "—"}</span></td>
            <td><strong>${UI.money(p.price)}</strong></td>
            <td>${p.stock}</td>
            <td><span class="pill ${s.pill}">${s.label}</span></td>
            <td><span class="pill ${active ? "green" : "red"}">${active ? "Ativo" : "Inativo"}</span></td>
            <td class="right">
              <div class="actions-cell">
                ${actions}
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    document.getElementById("productsCount").textContent = `${total} produto${total === 1 ? "" : "s"}`;
    renderPager(pages);
    bindRowActions();
  }

  function renderPager(pages) {
    const pager = document.getElementById("productsPager");
    if (!pager) return;
    const btns = [];
    btns.push(`<button data-pg="prev"${page === 1 ? " disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>`);
    for (let i = 1; i <= pages; i++) {
      btns.push(`<button data-pg="${i}" class="${i === page ? "active" : ""}">${i}</button>`);
    }
    btns.push(`<button data-pg="next"${page === pages ? " disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`);
    pager.innerHTML = btns.join("");
    pager.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        const v = b.getAttribute("data-pg");
        if (v === "prev") page = Math.max(1, page - 1);
        else if (v === "next") page = Math.min(pages, page + 1);
        else page = Number(v);
        render();
      });
    });
  }

  function bindRowActions() {
    document.querySelectorAll("#productsBody [data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === "edit") openProductForm(id);
        else if (btn.dataset.action === "delete") deleteProduct(id);
        else if (btn.dataset.action === "activate") activateProduct(id);
      });
    });
  }

  async function deleteProduct(id) {
    const p = productsPageItems.find(item => String(item.id) === String(id)) || window.DB.getProduct(id);
    if (!p) return;
    const ok = await UI.confirmDialog({
      title: "Inativar produto",
      text: `Tem certeza que deseja inativar "${p.name}"? Ele saira do PDV ate ser ativado novamente.`,
      okLabel: "Inativar"
    });
    if (!ok) return;

    try {
      await window.API.deleteProduct(id);
      window.DB.products = window.DB.products.filter(x => x.id !== id);
      if (filters.status === "all") p.ativo = false;
      else productsPageItems = productsPageItems.filter(x => String(x.id) !== String(id));
      UI.toast(`Produto "${p.name}" inativado.`, "success");
      render();
      if (window.Dashboard) window.Dashboard.refresh();
      if (window.StockPage) window.StockPage.render();
    } catch (err) {
      console.error("Falha ao excluir produto:", err);
      UI.toast("Não foi possível excluir o produto.", "error");
    }
  }

  async function activateProduct(id) {
    const p = productsPageItems.find(item => String(item.id) === String(id));
    if (!p) return;

    try {
      const updated = await window.API.setProductActive(id, true);
      const existing = window.DB.products.find(item => String(item.id) === String(id));
      if (existing) Object.assign(existing, updated);
      else window.DB.products.push(updated);
      if (filters.status === "inactive") {
        productsPageItems = productsPageItems.filter(item => String(item.id) !== String(id));
      } else {
        Object.assign(p, updated);
      }
      UI.toast(`Produto "${updated.name}" ativado.`, "success");
      render();
      if (window.Dashboard) window.Dashboard.refresh();
      if (window.StockPage) window.StockPage.render();
    } catch (err) {
      console.error("Falha ao ativar produto:", err);
      UI.toast("Nao foi possivel ativar o produto.", "error");
    }
  }

  function resetProductImageChoice(text = "Escolher imagem", hint = "PNG, JPG ou WEBP. Voce tambem pode escolher uma imagem ja salva.") {
    const fileInput = document.getElementById("productImage");
    const existingInput = document.getElementById("productExistingImage");
    const fileName = document.getElementById("productImageFileName");
    const imageHint = document.getElementById("productImageHint");
    if (fileInput) fileInput.value = "";
    if (existingInput) existingInput.value = "";
    if (fileName) fileName.textContent = text;
    if (imageHint) imageHint.textContent = hint;
  }

  function handleProductImageFileChange(event) {
    const file = event.target.files?.[0];
    const existingInput = document.getElementById("productExistingImage");
    const fileName = document.getElementById("productImageFileName");
    const imageHint = document.getElementById("productImageHint");
    if (existingInput) existingInput.value = "";
    if (fileName) fileName.textContent = file ? file.name : "Escolher imagem";
    if (imageHint) {
      imageHint.textContent = file
        ? "Imagem nova selecionada. Ela sera salva no projeto ao cadastrar o produto."
        : "PNG, JPG ou WEBP. Voce tambem pode escolher uma imagem ja salva.";
    }
  }

  function chooseExistingImage(image) {
    const fileInput = document.getElementById("productImage");
    const existingInput = document.getElementById("productExistingImage");
    const fileName = document.getElementById("productImageFileName");
    const imageHint = document.getElementById("productImageHint");
    if (fileInput) fileInput.value = "";
    if (existingInput) existingInput.value = image.path || "";
    if (fileName) fileName.textContent = image.name || "Imagem da galeria";
    if (imageHint) imageHint.textContent = "Imagem selecionada da galeria do projeto.";
    UI.closeModal("imageLibraryModal");
  }

  function renderImageLibrary(images, term = "") {
    const grid = document.getElementById("imageLibraryGrid");
    if (!grid) return;
    const query = term.trim().toLowerCase();
    const visibleImages = query
      ? images.filter(image => `${image.name || ""} ${image.path || ""}`.toLowerCase().includes(query))
      : images;
    grid.innerHTML = "";
    if (!visibleImages.length) {
      const empty = document.createElement("div");
      empty.className = "image-library-empty";
      empty.textContent = images.length
        ? "Nenhuma imagem encontrada com esse nome."
        : "Nenhuma imagem encontrada em database/static/uploads.";
      grid.appendChild(empty);
      return;
    }
    visibleImages.forEach(image => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "image-library-item";
      const preview = document.createElement("img");
      preview.src = image.url;
      preview.alt = image.name || "Imagem do produto";
      preview.loading = "lazy";
      const name = document.createElement("span");
      name.textContent = image.name || image.path;
      button.append(preview, name);
      button.addEventListener("click", () => chooseExistingImage(image));
      grid.appendChild(button);
    });
  }

  async function openImageLibrary() {
    const grid = document.getElementById("imageLibraryGrid");
    const search = document.getElementById("imageLibrarySearch");
    if (search) search.value = "";
    if (grid) grid.innerHTML = `<div class="image-library-empty">Carregando imagens...</div>`;
    UI.openModal("imageLibraryModal");
    try {
      imageLibraryItems = await window.API.getProductImages();
      renderImageLibrary(imageLibraryItems);
    } catch (err) {
      console.error("Falha ao carregar galeria de produtos:", err);
      if (grid) grid.innerHTML = `<div class="image-library-empty">Nao foi possivel carregar as imagens.</div>`;
      UI.toast("Nao foi possivel abrir a galeria de imagens.", "error");
    }
  }

  function openProductForm(id) {
    const titleEl = document.getElementById("productModalTitle");
    const catSel = document.getElementById("productCategory");
    catSel.innerHTML = window.DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    if (id) {
      const p = productsPageItems.find(item => String(item.id) === String(id)) || window.DB.getProduct(id);
      if (!p || p.ativo === false) return;
      titleEl.textContent = "Editar produto";
      document.getElementById("productId").value = p.id;
      document.getElementById("productName").value = p.name;
      document.getElementById("productCategory").value = p.categoryId;
      document.getElementById("productPrice").value = p.price;
      document.getElementById("productStock").value = p.stock;
      resetProductImageChoice(
        p.imageUrl ? "Manter imagem atual" : "Escolher imagem",
        p.imageUrl ? "Imagem atual mantida. Escolha outra se quiser trocar." : "PNG, JPG ou WEBP. Voce tambem pode escolher uma imagem ja salva."
      );
      document.getElementById("productDesc").value = p.description || "";
    } else {
      titleEl.textContent = "Novo produto";
      document.getElementById("productForm").reset();
      document.getElementById("productId").value = "";
      resetProductImageChoice();
    }
    UI.openModal("productModal");
  }

  async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById("productId").value;
    const data = {
      name: document.getElementById("productName").value.trim(),
      categoryId: document.getElementById("productCategory").value,
      price: parseFloat(document.getElementById("productPrice").value) || 0,
      stock: parseInt(document.getElementById("productStock").value, 10) || 0,
      description: document.getElementById("productDesc").value.trim(),
      image: document.getElementById("productImage").files[0] || null,
      existingImage: document.getElementById("productExistingImage").value || ""
    };
    if (!data.name) { UI.toast("Informe o nome do produto.", "error"); return; }
    if (data.stock < 0) { UI.toast("O estoque nao pode ser negativo.", "error"); return; }

    try {
      if (id) {
        const updated = await window.API.updateProduct(id, data);
        Object.assign(window.DB.getProduct(id), updated);
        const localProduct = productsPageItems.find(p => String(p.id) === String(id));
        if (localProduct) Object.assign(localProduct, updated);
        UI.toast(`Produto "${data.name}" atualizado.`, "success");
      } else {
        const created = await window.API.createProduct(data);
        window.DB.products.push(created);
        if (filters.status !== "inactive") productsPageItems.push(created);
        UI.toast(`Produto "${data.name}" criado.`, "success");
      }
    } catch (err) {
      console.error("Falha ao salvar produto:", err);
      UI.toast(err.message || "Não foi possível salvar o produto.", "error");
      return;
    }
    UI.closeModal("productModal");
    render();
    if (window.Dashboard) window.Dashboard.refresh();
    if (window.StockPage) window.StockPage.render();
  }

  function init() {
    const sel = document.getElementById("productCategoryFilter");
    productsPageItems = window.DB.products.slice();

    sel.innerHTML = `<option value="">Todas categorias</option>` +
      window.DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    document.getElementById("productSearch").addEventListener("input", e => {
      filters.q = e.target.value; page = 1; render();
    });
    sel.addEventListener("change", e => { filters.category = e.target.value; page = 1; render(); });
    document.getElementById("productStockFilter").addEventListener("change", e => {
      filters.stock = e.target.value; page = 1; render();
    });
    document.getElementById("productStatusFilter").addEventListener("change", async e => {
      filters.status = e.target.value;
      page = 1;
      await loadProductsByStatus();
      render();
    });

    document.getElementById("newProductBtn").addEventListener("click", () => openProductForm());
    document.getElementById("productForm").addEventListener("submit", saveProduct);
    document.getElementById("productImage").addEventListener("change", handleProductImageFileChange);
    document.getElementById("openImageLibrary").addEventListener("click", openImageLibrary);
    document.getElementById("imageLibrarySearch").addEventListener("input", e => {
      renderImageLibrary(imageLibraryItems, e.target.value);
    });

    document.getElementById("exportProducts").addEventListener("click", () => {
      const rows = [["Nome", "SKU", "Categoria", "Preço", "Estoque", "Situacao"]];
      getFiltered().forEach(p => {
        rows.push([p.name, p.sku || "", window.DB.getCategory(p.categoryId)?.name || "", p.price.toFixed(2).replace(".", ","), p.stock, p.ativo !== false ? "Ativo" : "Inativo"]);
      });
      UI.downloadCSV("produtos.csv", rows);
      UI.toast("Exportação CSV gerada.", "success");
    });

    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => UI.closeModal(btn.getAttribute("data-close-modal")));
    });
    document.getElementById("productModal").addEventListener("click", e => {
      if (e.target.id === "productModal") UI.closeModal("productModal");
    });
    document.getElementById("imageLibraryModal").addEventListener("click", e => {
      if (e.target.id === "imageLibraryModal") UI.closeModal("imageLibraryModal");
    });

    render();
  }

  return { init, render, openProductForm };
})();


window.OrdersPage = (function () {
  let filters = { q: "", status: "" };

  function statusPill(s) {
    if (s === "concluido") return `<span class="pill green">Concluído</span>`;
    if (s === "pendente")  return `<span class="pill yellow">Pendente</span>`;
    if (s === "cancelado") return `<span class="pill red">Cancelado</span>`;
    return `<span class="pill gray">${UI.escapeHTML(s)}</span>`;
  }

  function sortedOrderItems(order) {
    return [...(order.items || [])].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })
    );
  }

  function orderItemsCount(order) {
    return (order.items || []).reduce((total, item) => total + (Number(item.qty) || 0), 0);
  }

  function renderItemsButton(order) {
    const count = orderItemsCount(order);
    const label = `${count} ${count === 1 ? "item" : "itens"}`;
    return `
      <button class="order-items-btn" type="button" data-order-items="${UI.escapeHTML(order.number)}" aria-label="Ver produtos do pedido ${UI.escapeHTML(order.number)}">
        <span>${label}</span>
        <i class="fa-solid fa-list-check"></i>
      </button>
    `;
  }

  function renderOrderItemsList(order) {
    const items = sortedOrderItems(order);
    const list = document.getElementById("orderItemsList");
    const total = document.getElementById("orderItemsTotal");
    const empty = document.getElementById("orderItemsEmpty");
    if (!list || !total || !empty) return;

    total.textContent = UI.money(order.total);
    list.innerHTML = "";
    empty.hidden = Boolean(items.length);

    items.forEach(item => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const subtotal = Number(item.subtotal) || qty * price;
      const row = document.createElement("li");
      row.className = "order-item-row";
      row.innerHTML = `
        <div class="order-item-index">${String(qty).padStart(2, "0")}</div>
        <div class="order-item-info">
          <strong>${UI.escapeHTML(item.name || "Produto sem nome")}</strong>
          <span>${qty} ${qty === 1 ? "unidade" : "unidades"} x ${UI.money(price)}</span>
        </div>
        <strong class="order-item-subtotal">${UI.money(subtotal)}</strong>
      `;
      list.appendChild(row);
    });
  }

  function openOrderItemsModal(orderNumber) {
    const order = window.DB.orders.find(item => item.number === orderNumber);
    if (!order) return;
    document.getElementById("orderItemsModalTitle").textContent = `Produtos do pedido ${order.number}`;
    document.getElementById("orderItemsCustomer").textContent = order.customerName || "Cliente";
    document.getElementById("orderItemsDate").textContent = UI.dateBR(order.createdAt);
    renderOrderItemsList(order);
    UI.openModal("orderItemsModal");
  }

  async function refreshFromApi() {
    try {
      window.DB.orders = await window.API.getOrders(filters);
    } catch (err) {
      console.error("Falha ao carregar pedidos:", err);
      UI.toast("Nao foi possivel carregar os pedidos.", "warn");
    }
  }

  async function render() {
    const body = document.getElementById("ordersBody");
    if (!body) return;

    await refreshFromApi();
    const rows = window.DB.orders.filter(o => {
      if (filters.q && !(`${o.number} ${o.customerName}`.toLowerCase().includes(filters.q.toLowerCase()))) return false;
      if (filters.status && o.status !== filters.status) return false;
      return true;
    });

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--text-mute)">Nenhum pedido encontrado.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(o => `
      <tr>
        <td><strong>${UI.escapeHTML(o.number)}</strong></td>
        <td>${UI.escapeHTML(o.customerName)}</td>
        <td>${renderItemsButton(o)}</td>
        <td><strong>${UI.money(o.total)}</strong></td>
        <td><span class="pill blue">${UI.escapeHTML(o.payment)}</span></td>
        <td class="muted">${UI.dateBR(o.createdAt)}</td>
        <td>${statusPill(o.status)}</td>
      </tr>
    `).join("");

    body.querySelectorAll("[data-order-items]").forEach(button => {
      button.addEventListener("click", () => openOrderItemsModal(button.dataset.orderItems));
    });
  }

  function init() {
    document.getElementById("orderSearch").addEventListener("input", e => { filters.q = e.target.value; render(); });
    document.getElementById("orderStatusFilter").addEventListener("change", e => { filters.status = e.target.value; render(); });
    document.querySelectorAll("[data-close-modal='orderItemsModal']").forEach(button => {
      button.addEventListener("click", () => UI.closeModal("orderItemsModal"));
    });
    document.getElementById("orderItemsModal")?.addEventListener("click", e => {
      if (e.target.id === "orderItemsModal") UI.closeModal("orderItemsModal");
    });
    render();
  }

  return { init, render };
})();


window.CustomersPage = (function () {
  let q = "";

  async function deleteCustomer(id) {
    const customer = window.DB.customers.find(c => String(c.id) === String(id));
    if (!customer) return;

    const ok = await UI.confirmDialog({
      title: "Excluir associado",
      text: `Tem certeza que deseja excluir "${customer.name}"? O histórico de vendas será preservado.`,
      okLabel: "Excluir"
    });
    if (!ok) return;

    try {
      await window.API.deleteCustomer(id);
      window.DB.customers = window.DB.customers.filter(c => String(c.id) !== String(id));
      UI.toast(`Associado "${customer.name}" excluído.`, "success");
      render();
      if (window.Dashboard) window.Dashboard.refresh();
    } catch (err) {
      console.error("Falha ao excluir associado:", err);
      UI.toast("Não foi possível excluir o associado.", "error");
    }
  }

  function render() {
    const grid = document.getElementById("customersGrid");
    if (!grid) return;

    const rows = window.DB.customers.filter(c =>
      !q || `${c.name} ${c.email || ""} ${c.matricula || ""} ${c.phone || ""}`.toLowerCase().includes(q.toLowerCase())
    );

    if (!rows.length) {
      grid.innerHTML = `<p class="muted" style="grid-column:1/-1;text-align:center;padding:32px">Nenhum associado encontrado.</p>`;
      return;
    }

    const rowsHtml = rows.map(c => `
      <tr data-customer-id="${c.id}">
        <td>
          <div class="customer-table-name">
            <span class="avatar">${UI.initialsFromName(c.name)}</span>
            <strong title="${c.name}">${c.name}</strong>
          </div>
        </td>
        <p><i class="fa-solid fa-id-card"></i> ${c.matricula || "Sem matrícula"}</p>
        <p><i class="fa-solid fa-phone"></i> ${c.phone || "Sem telefone"}</p>
        <p><i class="fa-solid ${c.isAssociado ? "fa-circle-check" : "fa-circle-minus"}"></i> ${c.isAssociado ? "Desconto ativo" : "Sem desconto"}</p>
        <div class="customer-meta">
          <div><strong>${UI.money(c.totalSpent)}</strong><span>Total gasto</span></div>
          <div><strong>${c.orders}</strong><span>Pedidos</span></div>
          <div><strong>${c.lastOrder}</strong><span>Último</span></div>
        </div>
      </article>
    `).join("");
    const tableRowsHtml = rows.map(c => `
      <tr data-customer-id="${c.id}">
        <td>
          <div class="customer-table-name">
            <span class="avatar">${UI.initialsFromName(c.name)}</span>
            <strong title="${c.name}">${c.name}</strong>
          </div>
        </td>
        <td title="${c.matricula || "Sem matricula"}">${c.matricula || "Sem matricula"}</td>
        <td title="${c.phone || "Sem telefone"}">${c.phone || "Sem telefone"}</td>
        <td><span class="pill ${c.isAssociado ? "green" : "gray"}">${c.isAssociado ? "Ativo" : "Sem desconto"}</span></td>
        <td class="right"><strong>${UI.money(c.totalSpent)}</strong></td>
        <td class="right">${c.orders}</td>
        <td class="right">${c.lastOrder}</td>
        <td class="right">
          <div class="actions-cell">
            <button class="act-btn delete" type="button" data-delete-customer="${c.id}" aria-label="Excluir ${c.name}" title="Excluir associado">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
    grid.innerHTML = `
      <div class="card glass no-pad customer-table-card">
        <div class="table-wrap">
          <table class="data-table customer-table">
            <thead>
              <tr>
                <th>Associado</th>
                <th>Matricula</th>
                <th>Telefone</th>
                <th>Desconto</th>
                <th class="right">Total gasto</th>
                <th class="right">Pedidos</th>
                <th class="right">Ultimo</th>
                <th class="right">Acoes</th>
              </tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
    bindActions();
  }

  function bindActions() {
    document.querySelectorAll("[data-delete-customer]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        deleteCustomer(button.dataset.deleteCustomer);
      });
    });
  }

  function init() {
    document.getElementById("customerSearch").addEventListener("input", e => { q = e.target.value; render(); });
    document.getElementById("newCustomerBtn").addEventListener("click", () => {
      document.getElementById("associateForm")?.reset();
      const discount = document.getElementById("associateActiveDiscount");
      if (discount) discount.checked = true;
      UI.openModal("associateModal");
    });
    render();
  }

  return { init, render };
})();

window.CategoriesPage = (function () {
  function syncProductCategoryFilter() {
    const sel = document.getElementById("productCategoryFilter");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">Todas categorias</option>` +
      window.DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    sel.value = window.DB.categories.some(c => c.id === current) ? current : "";
  }

  function render() {
    const grid = document.getElementById("categoriesGrid");
    if (!grid) return;

    if (!window.DB.categories.length) {
      grid.innerHTML = `<p class="muted" style="grid-column:1/-1;text-align:center;padding:32px">Nenhuma categoria cadastrada.</p>`;
      syncProductCategoryFilter();
      return;
    }

    const agg = window.CHARTS.aggregateByCategory();
    const rowsHtml = window.DB.categories.map(c => {
      const a = agg.find(x => x.id === c.id) || { value: 0, color: c.color || "#2D7BFF" };
      const productCount = c.productCount ?? window.DB.products.filter(p => p.categoryId === c.id).length;
      return `
        <tr data-category-id="${c.id}">
          <td>
            <div class="category-table-name">
              <span class="cat-ic" style="background:linear-gradient(135deg, ${a.color}, ${a.color}aa)"><i class="fa-solid ${c.icon || "fa-box"}"></i></span>
              <strong title="${c.name}">${c.name}</strong>
            </div>
          </td>
          <td>${productCount} produto${productCount === 1 ? "" : "s"}</td>
          <td class="right"><strong>${UI.money(a.value)}</strong></td>
          <td class="right">
            <div class="actions-cell">
              <button class="act-btn edit" type="button" data-edit-category="${c.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="act-btn delete" type="button" data-delete-category="${c.id}" title="Remover"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
    grid.innerHTML = `
      <div class="card glass no-pad category-table-card">
        <div class="table-wrap">
          <table class="data-table category-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Produtos</th>
                <th class="right">Receita vinculada</th>
                <th class="right">Acoes</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
    bindActions();
    syncProductCategoryFilter();
  }

  function openForm(category = null) {
    const form = document.getElementById("categoryForm");
    if (!form) return;

    form.reset();
    document.getElementById("categoryId").value = category?.id || "";
    document.getElementById("categoryName").value = category?.name || "";
    document.getElementById("categoryModalTitle").textContent = category ? "Editar categoria" : "Nova categoria";
    UI.openModal("categoryModal");
  }

  async function saveCategory(event) {
    event.preventDefault();

    const id = document.getElementById("categoryId").value;
    const nome = document.getElementById("categoryName").value.trim();
    if (!nome) {
      UI.toast("Informe o nome da categoria.", "error");
      return;
    }

    try {
      if (id) {
        const updated = await window.API.updateCategory(id, { nome });
        Object.assign(window.DB.categories.find(c => c.id === id), updated);
        UI.toast(`Categoria "${updated.name}" atualizada.`, "success");
      } else {
        const created = await window.API.createCategory({ nome });
        window.DB.categories.push(created);
        UI.toast(`Categoria "${created.name}" criada.`, "success");
      }
      UI.closeModal("categoryModal");
      render();
      if (window.ProductsPage) window.ProductsPage.render();
      if (window.StockPage) window.StockPage.render();
      if (window.Dashboard) window.Dashboard.refresh();
    } catch (err) {
      console.error("Falha ao salvar categoria:", err);
      UI.toast(err.message || "Não foi possível salvar a categoria.", "error");
    }
  }

  async function deleteCategory(id) {
    const category = window.DB.categories.find(c => c.id === id);
    if (!category) return;

    const ok = await UI.confirmDialog({
      title: "Remover categoria",
      text: `Remover "${category.name}"? Categorias com produtos ativos vinculados não podem ser removidas.`,
      okLabel: "Remover"
    });
    if (!ok) return;

    try {
      await window.API.deleteCategory(id);
      window.DB.categories = window.DB.categories.filter(c => c.id !== id);
      UI.toast(`Categoria "${category.name}" removida.`, "success");
      render();
      if (window.ProductsPage) window.ProductsPage.render();
      if (window.StockPage) window.StockPage.render();
      if (window.Dashboard) window.Dashboard.refresh();
    } catch (err) {
      console.error("Falha ao remover categoria:", err);
      UI.toast(err.message || "Não foi possível remover. Verifique se há produtos vinculados.", "error");
    }
  }

  function bindActions() {
    document.querySelectorAll("[data-edit-category]").forEach(button => {
      button.addEventListener("click", () => {
        const category = window.DB.categories.find(c => c.id === button.dataset.editCategory);
        openForm(category);
      });
    });

    document.querySelectorAll("[data-delete-category]").forEach(button => {
      button.addEventListener("click", () => deleteCategory(button.dataset.deleteCategory));
    });
  }

  function init() {
    document.getElementById("newCategoryBtn").addEventListener("click", () => openForm());
    document.getElementById("categoryForm")?.addEventListener("submit", saveCategory);
    document.getElementById("categoryModal")?.addEventListener("click", event => {
      if (event.target.id === "categoryModal") UI.closeModal("categoryModal");
    });
    render();
  }

  return { init, render };
})();


window.EmployeesPage = (function () {
  function rows() {
    return Array.from(document.querySelectorAll("[data-employee-row]"));
  }

  function render() {
    const q = (document.getElementById("employeeSearch")?.value || "").trim().toLowerCase();
    const role = document.getElementById("employeeRoleFilter")?.value || "";
    const active = document.getElementById("employeeStatusFilter")?.value || "";
    let visible = 0;

    rows().forEach(row => {
      const matches =
        (!q || row.dataset.name.includes(q) || row.dataset.email.includes(q)) &&
        (!role || row.dataset.role === role) &&
        (!active || row.dataset.active === active);

      row.style.display = matches ? "" : "none";
      if (matches) visible += 1;
    });

    const count = document.getElementById("employeesCount");
    if (count) count.textContent = `${visible} funcionário${visible === 1 ? "" : "s"}`;

    const empty = document.getElementById("employeesEmptyRow");
    if (empty) empty.style.display = rows().length && visible === 0 ? "" : "none";
  }

  function openForm(employee = null) {
    const form = document.getElementById("employeeForm");
    const password = document.getElementById("employeePassword");
    if (!form || !password) return;

    form.reset();
    if (employee) {
      form.action = `/usuarios/${employee.id}/editar`;
      document.getElementById("employeeModalTitle").textContent = "Editar funcionário";
      document.getElementById("employeeName").value = employee.name || "";
      document.getElementById("employeeEmail").value = employee.email || "";
      document.getElementById("employeeRole").value = employee.role || "funcionario";
      password.required = false;
      password.placeholder = "Deixe em branco para manter";
    } else {
      form.action = "/usuarios/novo";
      document.getElementById("employeeModalTitle").textContent = "Novo funcionário";
      document.getElementById("employeeRole").value = "funcionario";
      password.required = true;
      password.placeholder = "";
    }
    UI.openModal("employeeModal");
  }

  function init() {
    if (!document.getElementById("page-funcionarios")) return;

    ["employeeSearch", "employeeRoleFilter", "employeeStatusFilter"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", render);
      document.getElementById(id)?.addEventListener("change", render);
    });

    document.getElementById("newEmployeeBtn")?.addEventListener("click", () => openForm());

    document.querySelectorAll("[data-edit-employee]").forEach(button => {
      button.addEventListener("click", () => openForm({
        id: button.dataset.id,
        name: button.dataset.name,
        email: button.dataset.email,
        role: button.dataset.role
      }));
    });

    document.querySelectorAll("[data-employee-confirm]").forEach(form => {
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const ok = await UI.confirmDialog({
          title: "Alterar acesso",
          text: form.dataset.employeeConfirm,
          okLabel: "Confirmar"
        });
        if (ok) form.submit();
      });
    });

    document.getElementById("employeeModal")?.addEventListener("click", event => {
      if (event.target.id === "employeeModal") UI.closeModal("employeeModal");
    });

    render();
  }

  return { init, render };
})();



window.StockPage = (function () {
  function openStockForm(product) {
    if (!product) return;

    document.getElementById("stockForm").reset();
    document.getElementById("stockProductId").value = product.id;
    document.getElementById("stockProductName").value = product.name;
    document.getElementById("stockCurrent").value = product.stock;
    document.getElementById("stockQuantity").value = "";
    document.getElementById("stockModalTitle").textContent = `Repor estoque`;
    UI.openModal("stockModal");
  }

  async function saveStock(event) {
    event.preventDefault();

    const id = document.getElementById("stockProductId").value;
    const product = window.DB.getProduct(id);
    const quantity = parseInt(document.getElementById("stockQuantity").value, 10);

    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
      UI.toast("Informe uma quantidade maior que zero.", "error");
      return;
    }

    try {
      const updated = await window.API.addProductStock(id, quantity);
      Object.assign(product, updated);
      UI.toast(`+${quantity} unidades adicionadas a ${product.name}.`, "success");
      UI.closeModal("stockModal");
      render();
      if (window.StockMovementsPage) window.StockMovementsPage.render();
      if (window.ProductsPage) window.ProductsPage.render();
      if (window.Dashboard) window.Dashboard.refresh();
    } catch (err) {
      console.error("Falha ao repor estoque:", err);
      UI.toast("Não foi possível atualizar o estoque.", "error");
    }
  }

  async function render() {
    const body = document.getElementById("stockBody");
    if (!body) return;

    const prods = window.DB.products.slice().sort((a, b) => a.stock - b.stock);
    body.innerHTML = prods.map(p => {
      const cat = window.DB.getCategory(p.categoryId);
      const s = UI.stockStatus(p);
      return `
        <tr>
          <td><strong>${p.name}</strong> <span class="muted" style="font-family:'DM Mono',monospace;font-size:11px">${p.sku || ""}</span></td>
          <td><span class="pill gray">${cat?.name || "—"}</span></td>
          <td><strong>${p.stock}</strong></td>
          <td><span class="pill ${s.pill}">${s.label}</span></td>
          <td class="right">
            <div class="actions-cell">
              <button class="act-btn edit" data-id="${p.id}" title="Repor estoque"><i class="fa-solid fa-plus"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // KPIs
    const skuCount = window.DB.products.length;
    const stockValue = window.DB.products.reduce((s, p) => s + (p.cost || p.price * 0.5) * p.stock, 0);
    const low = window.DB.products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const out = window.DB.products.filter(p => p.stock <= 0).length;
    document.getElementById("skuCount").textContent = UI.num(skuCount);
    document.getElementById("stockValue").textContent = UI.money(stockValue);
    document.getElementById("lowStockCount").textContent = low;
    document.getElementById("outOfStockCount").textContent = out;

    document.querySelectorAll("#stockBody .act-btn").forEach(b => {
      b.addEventListener("click", () => {
        const p = window.DB.getProduct(b.dataset.id);
        openStockForm(p);
      });
    });

  }

  function init() {
    document.getElementById("stockForm")?.addEventListener("submit", saveStock);
    document.getElementById("stockModal")?.addEventListener("click", event => {
      if (event.target.id === "stockModal") UI.closeModal("stockModal");
    });
    render();
  }

  return { render, init };
})();


window.StockMovementsPage = (function () {
  async function refreshMovements() {
    try {
      window.DB.stockMovements = await window.API.getStockMovements({ limit: 80 });
    } catch (err) {
      console.error("Falha ao carregar movimentações de estoque:", err);
      window.DB.stockMovements = [];
      UI.toast("Não foi possível carregar as movimentações.", "warn");
    }
  }

  function renderRows() {
    const body = document.getElementById("stockMovementsBody");
    if (!body) return;

    const movements = window.DB.stockMovements || [];
    body.innerHTML = movements.length ? movements.map(m => {
      const isEntrada = m.type === "entrada";
      const pill = isEntrada ? "green" : "red";
      const icon = isEntrada ? "fa-arrow-trend-up" : "fa-arrow-trend-down";
      const sign = isEntrada ? "+" : "-";
      return `
        <tr>
          <td>${m.createdAt ? UI.dateBR(m.createdAt) : "—"}</td>
          <td><strong>${m.productName || "Produto"}</strong></td>
          <td><span class="pill ${pill}"><i class="fa-solid ${icon}"></i> ${m.typeLabel || (isEntrada ? "Entrada" : "Saída")}</span></td>
          <td><strong>${sign}${UI.num(m.quantity || 0)}</strong></td>
          <td>${UI.money(m.total || 0)}</td>
          <td>${m.userName || "Usuário"}</td>
          <td class="muted">${m.note || "—"}</td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="7" class="empty-cell">Nenhuma movimentação registrada ainda.</td>
      </tr>
    `;
  }

  async function render() {
    await refreshMovements();
    renderRows();
  }

  function init() {
    render();
  }

  return { init, render };
})();



window.Dashboard = (function () {
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

    const status = s => s === "concluido" ? `<span class="pill green">Concluído</span>`
      : s === "pendente" ? `<span class="pill yellow">Pendente</span>`
      : `<span class="pill red">Cancelado</span>`;
    if (!window.DB.orders.length) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-mute)">Nenhum pedido registrado.</td></tr>`;
      return;
    }
    body.innerHTML = window.DB.orders.slice(0, 5).map(o => `
      <tr>
        <td><strong>${o.number}</strong></td>
        <td>${o.customerName}</td>
        <td>${UI.money(o.total)}</td>
        <td>${status(o.status)}</td>
      </tr>
    `).join("");
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
        title: "Ticket médio de hoje",
        text: today.orders ? `${UI.money(ticket)} por pedido concluído.` : "Ainda sem pedidos concluídos hoje."
      },
      {
        icon: "fa-ranking-star",
        tone: "success",
        title: "Produto destaque",
        text: topProduct ? `${topProduct.name} lidera com ${UI.money(topProduct.revenue || 0)} em receita.` : "Os produtos destaque aparecem após as primeiras vendas."
      },
      {
        icon: "fa-clock",
        tone: "info",
        title: "Horário de pico",
        text: peak && peak.orders ? `Maior movimento por volta de ${peak.hour}h, com ${UI.num(peak.orders)} pedido(s).` : "Ainda não há pico de vendas identificado."
      },
      {
        icon: "fa-layer-group",
        tone: "success",
        title: "Categoria líder",
        text: leadingCategory ? `${leadingCategory.name} representa ${leadingPct.toFixed(1)}% da receita por categoria.` : "Categorias serão destacadas conforme as vendas entrarem."
      },
      {
        icon: "fa-triangle-exclamation",
        tone: lowStock.length || outStock.length ? "warn" : "success",
        title: "Atenção ao estoque",
        text: outStock.length
          ? `${outStock.length} produto(s) sem estoque e ${lowStock.length} com estoque baixo.`
          : lowStock.length
            ? `${lowStock.length} produto(s) precisam de reposição preventiva.`
            : "Estoque sem alertas críticos no momento."
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
  }

  return { init, refresh };
})();



(function () {
  const ROUTE_META = {
    smart:         { title: "AAPM Smart",            sub: "Inteligencia artificial de vendas" },
    dashboard:     { title: "Dashboard",             sub: "Visão geral das vendas e operações." },
    admin:         { title: "Produtos",              sub: "Gerencie os produtos da sua loja." },
    grafico:       { title: "Painel Gráfico",        sub: "Indicadores e gráficos em tempo real." },
    pedidos:       { title: "Pedidos",               sub: "Acompanhe transações e status." },
    clientes:      { title: "Associados",            sub: "Cadastre associados e acompanhe benefícios de desconto." },
    funcionarios:  { title: "Funcionários",          sub: "Cadastre acessos e acompanhe permissões da equipe." },
    categorias:    { title: "Categorias",            sub: "Organize seus produtos por categoria." },
    estoque:       { title: "Estoque",               sub: "Controle de SKUs, mínimos e reposições." },
    movimentacoes: { title: "Movimentações",         sub: "Acompanhe entradas, saídas e ajustes do estoque." },
    relatorios:    { title: "Relatórios",            sub: "Exportações e análises detalhadas." },
    configuracoes: { title: "Configurações",         sub: "Preferências da loja e do painel." }
  };

  function setupMotionObserver(root = document) {
    const targets = root.querySelectorAll(".kpi, .glass, .card, .customer-card, .category-card, .report-card, .table-wrap");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach(el => el.classList.add("motion-in-view"));
      return;
    }

    if (!window.__aapmMotionObserver) {
      window.__aapmMotionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("motion-in-view");
          window.__aapmMotionObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    }

    targets.forEach(el => {
      if (el.dataset.motionObserved) return;
      el.dataset.motionObserved = "1";
      el.classList.add("motion-reveal");
      window.__aapmMotionObserver.observe(el);
    });
  }

  function setupChartScrollObserver(root = document) {
    const page = root.matches?.("#page-dashboard, #page-grafico")
      ? root
      : root.querySelector?.("#page-dashboard, #page-grafico");
    if (!page) return;

    const cards = [...page.querySelectorAll(".chart-wrap")]
      .map(chart => chart.closest(".card"))
      .filter(Boolean);
    if (!cards.length) return;

    cards.forEach((card, index) => {
      card.classList.add("chart-scroll-reveal");
      card.style.setProperty("--chart-scroll-delay", `${Math.min(index, 5) * 90}ms`);
      if (card.dataset.chartScrollObserved) return;
      card.dataset.chartScrollObserved = "1";
    });

    if (!("IntersectionObserver" in window)) {
      cards.forEach(card => card.classList.add("chart-scroll-in"));
      return;
    }

    if (!window.__aapmChartScrollObserver) {
      window.__aapmChartScrollObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("chart-scroll-in");
          window.__aapmChartScrollObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -14% 0px", threshold: 0.16 });
    }

    cards.forEach(card => {
      if (card.classList.contains("chart-scroll-in")) return;
      window.__aapmChartScrollObserver.observe(card);
    });
  }

  function navigate(route) {
    if (!ROUTE_META[route]) route = "dashboard";

    document.body.classList.add("route-changing");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.route === route));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const pg = document.getElementById("page-" + route);
    if (pg) {
      pg.classList.add("active");
      setupMotionObserver(pg);
      setupChartScrollObserver(pg);
    }

    document.getElementById("pageTitle").textContent = ROUTE_META[route].title;
    document.getElementById("pageSubtitle").textContent = ROUTE_META[route].sub;

    // Close sidebar on mobile
    document.getElementById("sidebar").classList.remove("open");

    // Page-specific refreshes
    try {
      if (route === "dashboard")  window.Dashboard.refresh();
      if (route === "grafico")    window.Dashboard.refresh();
      if (route === "admin")      window.ProductsPage.render();
      if (route === "pedidos")    window.OrdersPage.render();
      if (route === "clientes")   window.CustomersPage.render();
      if (route === "funcionarios" && window.EmployeesPage) window.EmployeesPage.render();
      if (route === "categorias") window.CategoriesPage.render();
      if (route === "estoque")    window.StockPage.render();
      if (route === "movimentacoes") window.StockMovementsPage.render();
    } catch (err) {
      console.error(`Falha ao renderizar rota ${route}:`, err);
      UI.toast("Nao foi possivel atualizar esta tela.", "warn");
    }

    location.hash = "#" + route;
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => window.CHARTS?.resizeAll?.());
    window.setTimeout(() => document.body.classList.remove("route-changing"), 260);
  }

  const SmartGoals = (() => {
    const YEAR_DAYS = 364;
    const MONTH_DAYS = 30;

    function numberFromInput(id, fallback = 0) {
      const value = Number.parseFloat(document.getElementById(id)?.value);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    }

    function setText(id, value) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }

    function buildStrategy(quantity, goal, missing, todayProfit) {
      if (window.DB.smart?.goals?.strategy && goal === Number(window.DB.smart.goals.dailyGoal)) {
        return window.DB.smart.goals.strategy;
      }
      if (quantity >= goal) {
        return `Meta atingida. Se esse ritmo continuar, priorize manter estoque dos produtos de maior giro e acompanhe o caixa para sustentar aproximadamente ${UI.money(todayProfit * MONTH_DAYS)} no mes.`;
      }

      if (missing <= 5) {
        return `A meta ficou perto: faltam ${missing} vendas. Para amanha, tente um combo simples com os produtos mais comprados e deixe esses itens prontos antes do intervalo.`;
      }

      if (missing <= 12) {
        return `A meta nao foi atingida: faltam ${missing} vendas. Para o proximo dia, reduza a friccao do atendimento, destaque produtos de giro rapido e crie uma oferta curta no horario de pico.`;
      }

      return `A meta ficou distante: faltam ${missing} vendas. Para amanha, revise a meta, confira estoque antes da abertura e use uma estrategia mais agressiva: combo promocional, produto destaque e reposicao antecipada.`;
    }

    function render() {
      const quantity = Math.round(numberFromInput("smartQtyToday", 0));
      const profitPerItem = numberFromInput("smartProfitPerItem", 0);
      const goal = Math.max(1, Math.round(numberFromInput("smartDailyGoal", 1)));
      const todayProfit = quantity * profitPerItem;
      const progress = Math.min(100, Math.round((quantity / goal) * 100));
      const missing = Math.max(0, goal - quantity);
      const reached = quantity >= goal;
      const status = document.getElementById("smartGoalStatus");
      const meter = document.getElementById("smartGoalMeter");
      const strategy = document.getElementById("smartGoalStrategy");

      setText("smartProfitToday", UI.money(todayProfit));
      setText("smartProfitMonth", UI.money(todayProfit * MONTH_DAYS));
      setText("smartProfitYear", UI.money(todayProfit * YEAR_DAYS));

      if (meter) meter.style.width = `${progress}%`;

      if (status) {
        status.textContent = reached ? `Meta atingida: ${progress}%` : `Faltam ${missing} vendas`;
        status.classList.toggle("reached", reached);
        status.classList.toggle("missed", !reached);
      }

      const strategyText = strategy?.querySelector("p");
      if (strategyText) {
        strategyText.textContent = buildStrategy(quantity, goal, missing, todayProfit);
      }
    }

    function renderSmartData(data) {
      if (!data) return;
      const forecast = data.forecast || {};
      const goals = data.goals || {};
      setText("smartRevenueToday", UI.money(forecast.revenueToday || 0));
      setText("smartItemsToday", UI.num(forecast.itemsToday || 0));
      setText("smartRiskCount", `${UI.num(forecast.stockRiskCount || 0)} produtos`);
      setText("smartConfidence", `${forecast.confidence || 0}%`);
      setText("smartPeakHint", forecast.peakHint || "Maior saída entre 09h e 10h");
      setText("smartDemandTitle", data.summary?.title || `Demanda ${String(forecast.demand || "em análise").toLowerCase()}`);
      setText("smartSummaryText", data.summary?.text || "A AAPM Smart está lendo histórico recente, estoque e giro dos produtos.");
      setText("smartStockAlert", `${UI.num(forecast.stockRiskCount || 0)} produto(s) perto do limite mínimo.`);
      const revenueHint = document.getElementById("smartRevenueHint");
      if (revenueHint) revenueHint.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> Previsão gerada pela AAPM Smart`;
      const confidenceMeter = document.getElementById("smartConfidenceMeter");
      if (confidenceMeter) confidenceMeter.style.width = `${Math.min(100, Math.max(0, forecast.confidence || 0))}%`;

      const qty = document.getElementById("smartQtyToday");
      const profit = document.getElementById("smartProfitPerItem");
      const goal = document.getElementById("smartDailyGoal");
      if (qty && forecast.itemsToday !== undefined) qty.value = forecast.itemsToday;
      if (profit && goals.profitPerItem !== undefined) profit.value = goals.profitPerItem;
      if (goal && goals.dailyGoal !== undefined) goal.value = goals.dailyGoal;

      const restock = document.getElementById("smartRestockList");
      if (restock && Array.isArray(data.restock)) {
        restock.innerHTML = data.restock.map(item => `
          <div><span>${item.name}</span><strong>+${UI.num(item.quantity)} un.</strong></div>
        `).join("");
      }

      const opportunities = document.getElementById("smartOpportunitiesList");
      if (opportunities && Array.isArray(data.opportunities)) {
        opportunities.innerHTML = data.opportunities.map(item => `
          <button type="button"><i class="fa-solid ${item.icon || "fa-lightbulb"}"></i><span>${item.text}</span></button>
        `).join("");
      }

      render();
    }

    function init() {
      const form = document.getElementById("smartGoalForm");
      if (!form) return;
      form.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", render);
      });
      renderSmartData(window.DB.smart);
      render();
    }

    return { init, render, renderSmartData };
  })();

  const SmartExperience = (() => {
    const scrollTargetsSelector = [
      ".smart-hero",
      ".smart-kpi",
      ".smart-neural-band",
      ".smart-panel",
      ".smart-restock-list div",
      ".smart-opportunities button",
      ".smart-goals",
      ".smart-goal-form label",
      ".smart-goal-results div",
      ".smart-goal-progress",
      ".smart-strategy",
      ".smart-assistant",
      ".smart-chat-message",
      ".smart-chat-form"
    ].join(", ");

    function bindTilt(card) {
      if (!card || card.dataset.smartTiltReady) return;
      card.dataset.smartTiltReady = "1";

      card.addEventListener("pointermove", event => {
        if (window.matchMedia("(max-width: 768px)").matches) return;
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        card.style.setProperty("--smart-tilt-x", `${(-y * 5).toFixed(2)}deg`);
        card.style.setProperty("--smart-tilt-y", `${(x * 5).toFixed(2)}deg`);
      });

      card.addEventListener("pointerleave", () => {
        card.style.removeProperty("--smart-tilt-x");
        card.style.removeProperty("--smart-tilt-y");
      });
    }

    function bindScrollAnimations() {
      const items = Array.from(document.querySelectorAll(`#page-smart ${scrollTargetsSelector}`));
      if (!items.length) return;

      items.forEach((item, index) => {
        item.classList.add("smart-scroll-item");
        item.classList.remove("smart-scroll-in");
        item.style.setProperty("--smart-scroll-delay", `${Math.min(index % 5, 4) * 22}ms`);
      });

      if (window.__aapmSmartScrollObserver) {
        window.__aapmSmartScrollObserver.disconnect();
      }

      const updateScrollState = () => {
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        items.forEach(item => {
          const rect = item.getBoundingClientRect();
          const shouldShow = rect.top < vh * 0.86 && rect.bottom > vh * 0.14;
          if (shouldShow) item.classList.add("smart-scroll-in");
        });
      };

      let ticking = false;
      const requestUpdate = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          updateScrollState();
          ticking = false;
        });
      };

      window.removeEventListener("scroll", window.__aapmSmartScrollHandler);
      window.removeEventListener("resize", window.__aapmSmartScrollHandler);
      window.__aapmSmartScrollHandler = requestUpdate;
      window.addEventListener("scroll", requestUpdate, { passive: true });
      window.addEventListener("resize", requestUpdate);

      if ("IntersectionObserver" in window) {
        window.__aapmSmartScrollObserver = new IntersectionObserver(() => requestUpdate(), {
          rootMargin: "-12% 0px -12% 0px",
          threshold: [0, 0.08, 0.18, 0.38]
        });
        items.forEach(item => window.__aapmSmartScrollObserver.observe(item));
      }

      updateScrollState();
    }

    function init() {
      document.querySelectorAll("#page-smart .smart-depth-card").forEach(bindTilt);
      bindScrollAnimations();
    }

    return { init };
  })();

  const SmartAssistant = (() => {
    const RESPONSE_DELAY_MS = 5000;

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function waitRemaining(startedAt) {
      return wait(Math.max(0, RESPONSE_DELAY_MS - (Date.now() - startedAt)));
    }

    function appendMessage(type, text) {
      const log = document.getElementById("smartChatLog");
      if (!log) return;
      const icon = type === "user" ? "fa-user" : "fa-brain";
      const message = document.createElement("div");
      message.className = `smart-chat-message ${type} is-new`;
      message.innerHTML = `<i class="fa-solid ${icon}"></i><p></p>`;
      message.querySelector("p").textContent = text;
      log.appendChild(message);
      log.scrollTop = log.scrollHeight;
      message.addEventListener("animationend", () => message.classList.remove("is-new"), { once: true });
    }

    function appendLoadingMessage() {
      const log = document.getElementById("smartChatLog");
      if (!log) return null;
      const message = document.createElement("div");
      message.className = "smart-chat-message ai smart-chat-loading is-new";
      message.innerHTML = `
        <i class="fa-solid fa-brain"></i>
        <p><span></span><span></span><span></span></p>
      `;
      log.appendChild(message);
      log.scrollTop = log.scrollHeight;
      message.addEventListener("animationend", () => message.classList.remove("is-new"), { once: true });
      return message;
    }

    function setStatus(text, mode = "") {
      const status = document.getElementById("smartAiStatus");
      if (!status) return;
      status.textContent = text;
      status.classList.toggle("external", mode === "external");
      status.classList.toggle("local", mode === "local");
    }

    async function submit(event) {
      event.preventDefault();
      const input = document.getElementById("smartChatInput");
      const form = document.getElementById("smartChatForm");
      const message = input?.value.trim();
      if (!message) return;

      appendMessage("user", message);
      input.value = "";
      setStatus("Pensando...");
      form?.querySelector("button")?.setAttribute("disabled", "true");
      form?.classList.add("is-sending");
      const loadingMessage = appendLoadingMessage();
      const startedAt = Date.now();

      try {
        const payload = {
          message,
          meta_diaria: Number(document.getElementById("smartDailyGoal")?.value) || 30,
          lucro_unidade: Number(document.getElementById("smartProfitPerItem")?.value) || 3.5
        };
        const [response] = await Promise.all([
          window.API.askSmartAssistant(payload),
          wait(RESPONSE_DELAY_MS)
        ]);
        if (response?.insights) {
          window.DB.smart = response.insights;
          SmartGoals.renderSmartData(response.insights);
        }
        loadingMessage?.remove();
        appendMessage("ai", response?.answer || "Nao consegui gerar uma resposta agora.");
        setStatus(response?.mode === "external" ? "IA externa ativa" : "IA local ativa", response?.mode || "local");
      } catch (error) {
        console.error("Falha na AAPM Smart externa:", error);
        await waitRemaining(startedAt);
        loadingMessage?.remove();
        appendMessage("ai", "Nao consegui acessar a IA agora. Verifique a conexao ou a chave configurada.");
        setStatus("IA indisponivel", "local");
      } finally {
        form?.querySelector("button")?.removeAttribute("disabled");
        form?.classList.remove("is-sending");
        input?.focus();
      }
    }

    function init() {
      document.getElementById("smartChatForm")?.addEventListener("submit", submit);
    }

    return { init };
  })();

  function renderNotifications() {
    const list = document.getElementById("notifList");
    if (!list) return;
    const visible = filterUnreadNotifications(window.DB.notifications);
    window.DB.notifications = visible;
    document.querySelector("#notifBtn .dot")?.classList.toggle("hidden", !visible.length);
    if (!visible.length) {
      list.innerHTML = `<li class="info"><i class="fa-solid fa-circle-info"></i><div>Sem notificações no momento.<time>Agora</time></div></li>`;
      return;
    }
    list.innerHTML = visible.map(n => `
      <li class="${n.type}">
        <i class="fa-solid ${n.icon}"></i>
        <div>${n.text}<time>${n.time}</time></div>
      </li>
    `).join("");
  }

  const NOTIF_READ_STORAGE_KEY = "aapm_read_notifications";

  function notificationKey(item) {
    return [item?.id || "", item?.text || "", item?.time || ""].join("|");
  }

  function getReadNotificationKeys() {
    try {
      return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_STORAGE_KEY) || "[]"));
    } catch (err) {
      return new Set();
    }
  }

  function setReadNotificationKeys(keys) {
    localStorage.setItem(NOTIF_READ_STORAGE_KEY, JSON.stringify([...keys].slice(-80)));
  }

  function filterUnreadNotifications(items) {
    const read = getReadNotificationKeys();
    return (items || []).filter(item => !read.has(notificationKey(item)));
  }

  function markCurrentNotificationsRead() {
    const read = getReadNotificationKeys();
    window.DB.notifications.forEach(item => read.add(notificationKey(item)));
    setReadNotificationKeys(read);
    window.DB.notifications = [];
  }

  async function runPreventiveChecks() {
    try {
      const health = await window.API.getSystemHealth();
      const warnings = filterUnreadNotifications(health?.warnings || []);
      if (!warnings.length) return;
      const severe = warnings.find(item => item.type === "error") || warnings[0];
      UI.toast(severe.text || "Ha alertas preventivos no sistema.", severe.type === "error" ? "error" : "warn");
      document.querySelector("#notifBtn .dot")?.classList.remove("hidden");
    } catch (err) {
      console.warn("Falha na checagem preventiva:", err);
    }
  }

  function updateSidebarBadges() {
    const lowStock = window.DB.products.filter(p => p.stock <= 5).length;
    document.getElementById("navLowStock").textContent = lowStock;
    document.getElementById("navLowStock").style.display = lowStock ? "" : "none";
    const pending = window.DB.orders.filter(o => o.status === "pendente").length;
    document.getElementById("navOrdersBadge").textContent = pending;
    document.getElementById("navOrdersBadge").style.display = pending ? "" : "none";
  }

  async function openProfileModal() {
    try {
      const profile = await window.API.getProfile();
      document.getElementById("profileName").textContent = profile.nome || "Usuario";
      document.getElementById("profileEmail").textContent = profile.email || "-";
      document.getElementById("profileRole").textContent = profile.role === "admin" ? "Administrador" : "Funcionario";
      document.getElementById("profileStatus").textContent = profile.ativo ? "Ativo" : "Inativo";
      document.getElementById("profileInitials").textContent = UI.initialsFromName(profile.nome || profile.email || "U") || "U";
      UI.openModal("profileModal");
    } catch (err) {
      console.error("Falha ao carregar perfil:", err);
      UI.toast("Nao foi possivel carregar o perfil.", "error");
    }
  }

  function openSecurityModal() {
    document.getElementById("securityForm")?.reset();
    UI.openModal("securityModal");
  }

  function openSupportModal() {
    document.getElementById("supportForm")?.reset();
    UI.openModal("supportModal");
  }

  async function submitSecurity(event) {
    event.preventDefault();
    const submitBtn = event.submitter;
    const atual = document.getElementById("currentPassword")?.value || "";
    const nova = document.getElementById("newPassword")?.value || "";
    const confirma = document.getElementById("confirmPassword")?.value || "";
    if (nova.length < 6) {
      UI.toast("A nova senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }
    if (nova !== confirma) {
      UI.toast("A confirmacao da senha nao confere.", "error");
      return;
    }
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando`;
      }
      await window.API.changePassword({ senha_atual: atual, nova_senha: nova });
      UI.closeModal("securityModal");
      document.getElementById("securityForm")?.reset();
      UI.toast("Senha atualizada com sucesso.", "success");
    } catch (err) {
      console.error("Falha ao atualizar senha:", err);
      UI.toast(err.message || "Nao foi possivel atualizar a senha.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Salvar senha";
      }
    }
  }

  async function submitSupport(event) {
    event.preventDefault();
    const submitBtn = event.submitter;
    const assunto = document.getElementById("supportSubject")?.value || "Suporte";
    const mensagem = document.getElementById("supportMessage")?.value || "";
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Enviando`;
      }
      await window.API.sendSupport({ assunto, mensagem });
      UI.closeModal("supportModal");
      document.getElementById("supportForm")?.reset();
      UI.toast("Solicitacao enviada para o suporte.", "success");
    } catch (err) {
      console.error("Falha ao registrar suporte:", err);
      UI.toast("Nao foi possivel registrar o suporte.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Enviar";
      }
    }
  }

  async function submitAssociate(event) {
    event.preventDefault();
    const submitBtn = event.submitter;
    const nome = document.getElementById("associateName")?.value.trim() || "";
    const matricula = document.getElementById("associateRegistry")?.value.trim() || "";
    const telefone = document.getElementById("associatePhone")?.value.trim() || "";
    const is_associado = Boolean(document.getElementById("associateActiveDiscount")?.checked);
    if (!nome) {
      UI.toast("Informe o nome do associado.", "error");
      return;
    }
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando`;
      }
      const associado = await window.API.createCustomer({ nome, matricula, telefone, is_associado });
      const index = window.DB.customers.findIndex(c => String(c.id) === String(associado.id));
      if (index >= 0) window.DB.customers[index] = associado;
      else window.DB.customers.push(associado);
      window.CustomersPage.render();
      UI.closeModal("associateModal");
      document.getElementById("associateForm")?.reset();
      UI.toast("Associado cadastrado.", "success");
    } catch (err) {
      console.error("Falha ao cadastrar associado:", err);
      UI.toast("Nao foi possivel cadastrar o associado.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Salvar associado";
      }
    }
  }

  function bindGlobal() {
    const appShell = document.getElementById("appShell");
    const sidebar = document.getElementById("sidebar");
    const sidebarCollapse = document.getElementById("sidebarCollapse");
    const mobileSidebarToggle = document.getElementById("toggleSidebar");
    const mobileQuery = window.matchMedia("(max-width: 880px)");

    function syncChartsAfterLayoutChange() {
      requestAnimationFrame(() => window.CHARTS?.resizeAll?.());
      window.setTimeout(() => window.CHARTS?.resizeAll?.(), 120);
      window.setTimeout(() => window.CHARTS?.resizeAll?.(), 340);
    }

    function setSidebarCollapsed(collapsed, persist = true) {
      if (!appShell || !sidebarCollapse) return;

      appShell.classList.toggle("sidebar-collapsed", collapsed);
      sidebarCollapse.setAttribute("aria-expanded", String(!collapsed));
      sidebarCollapse.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
      sidebarCollapse.querySelector("i").className = collapsed ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-left";

      if (persist) localStorage.setItem("aapm_sidebar_collapsed", collapsed ? "1" : "0");
      syncChartsAfterLayoutChange();
    }

    setSidebarCollapsed(localStorage.getItem("aapm_sidebar_collapsed") === "1", false);

    document.querySelectorAll(".nav-item[data-route]").forEach(b => {
      b.addEventListener("click", () => navigate(b.dataset.route));
    });
    document.querySelectorAll("[data-route-link]").forEach(b => {
      b.addEventListener("click", () => navigate(b.dataset.routeLink));
    });

    mobileSidebarToggle?.addEventListener("click", () => {
      sidebar?.classList.toggle("open");
    });

    sidebarCollapse?.addEventListener("click", () => {
      if (mobileQuery.matches) {
        sidebar?.classList.remove("open");
        return;
      }

      setSidebarCollapsed(!appShell.classList.contains("sidebar-collapsed"));
    });

    appShell?.addEventListener("transitionend", event => {
      if (event.target === appShell && event.propertyName === "grid-template-columns") {
        window.CHARTS?.resizeAll?.();
      }
    });

    const themeToggle = document.getElementById("themeToggle");
    const applySavedTheme = () => {
      const storedTheme = localStorage.getItem("aapm_theme");
      if (storedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        return;
      }
      document.documentElement.removeAttribute("data-theme");
    };
    const setStoredTheme = theme => {
      localStorage.setItem("aapm_theme", theme);
    };
    const syncThemeIcon = () => {
      const icon = themeToggle?.querySelector("i");
      if (!icon) return;
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
      themeToggle?.setAttribute("aria-pressed", String(isDark));
      themeToggle?.setAttribute("title", isDark ? "Alternar para tema claro" : "Alternar para tema escuro");
    };
    applySavedTheme();
    syncThemeIcon();

    themeToggle?.addEventListener("click", () => {
      const willUseDark = document.documentElement.getAttribute("data-theme") !== "dark";
      if (willUseDark) {
        document.documentElement.setAttribute("data-theme", "dark");
        setStoredTheme("dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
        setStoredTheme("light");
      }
      syncThemeIcon();
      window.CHARTS.refreshAll();
    });

    const notifBtn = document.getElementById("notifBtn");
    const notifTray = document.getElementById("notifTray");
    notifBtn.addEventListener("click", e => {
      e.stopPropagation();
      const isHidden = notifTray.classList.toggle("hidden");
      document.getElementById("adminTray").classList.add("hidden");
      notifBtn.setAttribute("aria-expanded", String(!isHidden));
      adminChip?.setAttribute("aria-expanded", "false");
    });
    notifTray?.addEventListener("click", e => {
      e.stopPropagation();
    });

    const adminChip = document.getElementById("adminChip");
    const adminTray = document.getElementById("adminTray");
    adminChip.addEventListener("click", e => {
      e.stopPropagation();
      const isHidden = adminTray.classList.toggle("hidden");
      notifTray.classList.add("hidden");
      adminChip.setAttribute("aria-expanded", String(!isHidden));
      notifBtn?.setAttribute("aria-expanded", "false");
    });
    adminTray?.addEventListener("click", e => {
      e.stopPropagation();
    });
    adminChip?.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      adminChip.click();
    });

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      window.location.href = "/auth/logout";
    });
    document.getElementById("profileBtn")?.addEventListener("click", openProfileModal);
    document.getElementById("settingsBtn")?.addEventListener("click", () => navigate("configuracoes"));
    document.getElementById("securityBtn")?.addEventListener("click", openSecurityModal);
    document.getElementById("supportBtn")?.addEventListener("click", openSupportModal);
    document.getElementById("profileSecurityShortcut")?.addEventListener("click", () => {
      UI.closeModal("profileModal");
      openSecurityModal();
    });
    document.getElementById("profileSupportShortcut")?.addEventListener("click", () => {
      UI.closeModal("profileModal");
      openSupportModal();
    });
    document.getElementById("markNotifRead")?.addEventListener("click", event => {
      event.preventDefault();
      markCurrentNotificationsRead();
      renderNotifications();
      document.querySelector("#notifBtn .dot")?.classList.add("hidden");
      UI.toast("Notificacoes marcadas como lidas.", "success");
    });
    document.querySelectorAll("[data-report-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const target = button.dataset.reportTab;
        document.querySelectorAll("[data-report-tab]").forEach(tab => {
          const active = tab === button;
          tab.classList.toggle("active", active);
          tab.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll("[data-report-panel]").forEach(panel => {
          const active = panel.dataset.reportPanel === target;
          panel.classList.toggle("active", active);
          panel.hidden = !active;
        });
      });
    });
    document.querySelectorAll("[data-report]").forEach(button => {
      button.addEventListener("click", () => window.API.downloadReport(button.dataset.report, button.dataset.period || ""));
    });
    document.getElementById("securityForm")?.addEventListener("submit", submitSecurity);
    document.getElementById("supportForm")?.addEventListener("submit", submitSupport);
    document.getElementById("associateForm")?.addEventListener("submit", submitAssociate);

    document.addEventListener("click", () => {
      notifTray.classList.add("hidden");
      adminTray.classList.add("hidden");
      notifBtn?.setAttribute("aria-expanded", "false");
      adminChip?.setAttribute("aria-expanded", "false");
    });

    // Cmd+K for search
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("globalSearch").focus();
      }
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(m => UI.closeModal(m.id));
      }
    });

    // Global search routes to products if there's a query
    document.getElementById("globalSearch").addEventListener("input", e => {
      const q = e.target.value.trim();
      if (!q) return;
      document.getElementById("productSearch").value = q;
      navigate("admin");
      window.ProductsPage.render();
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const [cats, prods, customers, orders, daily, hourly, notifications, metrics, topProducts, smart] = await Promise.all([
        window.API.getCategories(),
        window.API.getProducts(),
        window.API.getCustomers(),
        window.API.getOrders(),
        window.API.getDailySales(30),
        window.API.getHourlySales(),
        window.API.getNotifications(),
        window.API.getDashboardMetrics(),
        window.API.getTopProducts(),
        window.API.getSmartInsights()
      ]);
      window.DB.categories = cats;
      window.DB.products = prods;
      window.DB.customers = customers;
      window.DB.orders = orders;
      window.DB.daily = daily;
      window.DB.hourly = hourly;
      window.DB.notifications = notifications;
      window.DB.metrics = metrics;
      window.DB.topProducts = topProducts;
      window.DB.smart = smart;
    } catch (err) {
      console.error("Falha ao carregar dados do backend:", err);
      window.DB.customers = [];
      window.DB.orders = [];
      window.DB.daily = [];
      window.DB.hourly = [];
      window.DB.notifications = [];
      window.DB.metrics = null;
      window.DB.topProducts = [];
      window.DB.smart = null;
      UI.toast("Dados do banco indisponiveis no momento.", "warn");
    }

    bindGlobal();

    const safeInit = (label, fn) => {
      try {
        fn?.();
      } catch (err) {
        console.error(`Falha ao iniciar ${label}:`, err);
        UI.toast(`Nao foi possivel iniciar ${label}.`, "warn");
      }
    };

    // Init pages
    safeInit("dashboard", () => window.Dashboard.init());
    safeInit("produtos", () => window.ProductsPage.init());
    safeInit("pedidos", () => window.OrdersPage.init());
    safeInit("associados", () => window.CustomersPage.init());
    safeInit("funcionarios", () => window.EmployeesPage.init());
    safeInit("categorias", () => window.CategoriesPage.init());
    safeInit("estoque", () => window.StockPage.init());
    safeInit("movimentacoes", () => window.StockMovementsPage.init());
    safeInit("AAPM Smart", () => SmartGoals.init());
    safeInit("experiencia AAPM Smart", () => SmartExperience.init());
    safeInit("assistente AAPM Smart", () => SmartAssistant.init());
    renderNotifications();
    updateSidebarBadges();
    runPreventiveChecks();
    setupMotionObserver();
    setupChartScrollObserver();

    // Initial route via hash
    const route = (location.hash || "#dashboard").replace("#", "");
    navigate(route);

    // Periodic refresh of badges (simulate real-time)
    setInterval(updateSidebarBadges, 5000);
  });
})();

