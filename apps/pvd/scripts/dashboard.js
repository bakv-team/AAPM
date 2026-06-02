function initDashboardParticles() {
  const canvas = document.getElementById("dashboardParticles");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let particles = [];
  let frameId = null;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    init();
  }

  class Particle {
    constructor() {
      this.x = Math.random() * window.innerWidth;
      this.y = Math.random() * window.innerHeight;
      this.size = Math.random() * 3 + 1;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.color = Math.random() > 0.5
        ? "rgba(58,92,233,.35)"
        : "rgba(245,138,31,.35)";
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.x > window.innerWidth || this.x < 0) this.speedX *= -1;
      if (this.y > window.innerHeight || this.y < 0) this.speedY *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  function init() {
    particles = [];
    for (let i = 0; i < 75; i++) {
      particles.push(new Particle());
    }
  }

  function connect() {
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

  function animate() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles.forEach((particle) => {
      particle.update();
      particle.draw();
    });

    connect();
    frameId = requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  cancelAnimationFrame(frameId);
  animate();
}

//  *  Como conectar ao banco depois:
//  *    1. Suba o backend (FastAPI) em http://localhost:8000
//  *    2. Procure pelos comentários "// TODO: conectar ao backend"
//  *       espalhados pelo arquivo — em cada um há um bloco fetch() pronto,
//  *       comentado. Basta descomentar (e remover o trecho mock equivalente)
//  *       para passar a usar dados reais do SQLite.
//  *    3. Ajuste API.BASE_URL se o backend rodar em outra porta.
//  *
//  *  Endpoints esperados (sugeridos para sua FastAPI):
//  *    GET    /api/categories
//  *    POST   /api/categories
//  *    GET    /api/products            ?q=&category_id=&stock=
//  *    POST   /api/products
//  *    PUT    /api/products/{id}
//  *    DELETE /api/products/{id}
//  *    GET    /api/customers           ?q=
//  *    POST   /api/customers
//  *    GET    /api/orders              ?q=&status=
//  *    POST   /api/orders
//  *    GET    /api/dashboard/metrics
//  *    GET    /api/dashboard/daily     ?range=7
//  *    GET    /api/dashboard/hourly
//  *    GET    /api/dashboard/top-products
//  *    GET    /api/notifications
/* =====================================================================
 *  CAMADA DE API — ponte com FastAPI + SQLite + Alembic
 *  ---------------------------------------------------------------------
 *  Hoje as funções abaixo apenas devolvem os dados mock de window.DB.
 *  Quando o backend estiver pronto, basta substituir o conteúdo de cada
 *  função pelo bloco fetch() correspondente (já comentado em cada uma).
 * ===================================================================== */
window.API = (function () {
  const BASE_URL = window.location.origin;

  // Helpers HTTP genéricos — já prontos para uso futuro
  async function apiGet(path) {
    const res = await fetch(`${BASE_URL}${path}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return res.json();
  }
  async function apiPost(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let message = `POST ${path} -> ${res.status}`;
      try {
        const data = await res.json();
        message = data.detail || message;
      } catch (err) {}
      throw new Error(message);
    }
    return res.json();
  }
  async function apiPut(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PUT ${path} -> ${res.status}`);
    return res.json();
  }
  async function apiDelete(path) {
    const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) throw new Error(`DELETE ${path} -> ${res.status}`);
    return res.ok;
  }

  // ----- Categorias -----
  async function getCategories() {
    // TODO: conectar ao backend
    // return apiGet("/api/categories");
    return window.DB.categories;
  }
  async function createCategory(payload) {
    // TODO: conectar ao backend
    // return apiPost("/api/categories", payload);
    return payload;
  }

  // ----- Produtos -----
  async function getProducts(filters = {}) {
    // TODO: conectar ao backend
    // const qs = new URLSearchParams();
    // if (filters.q)         qs.set("q", filters.q);
    // if (filters.category)  qs.set("category_id", filters.category);
    // if (filters.stock)     qs.set("stock", filters.stock);
    // return apiGet(`/api/products?${qs.toString()}`);
    return window.DB.products;
  }
  async function createProduct(payload) {
    // TODO: conectar ao backend
    // return apiPost("/api/products", payload);
    return { id: window.DB.nextProductId(), ...payload };
  }
  async function updateProduct(id, payload) {
    // TODO: conectar ao backend
    // return apiPut(`/api/products/${id}`, payload);
    return { id, ...payload };
  }
  async function deleteProduct(id) {
    // TODO: conectar ao backend
    // return apiDelete(`/api/products/${id}`);
    return true;
  }

  // ----- Clientes -----
  async function getCustomers(q = "") {
    // TODO: conectar ao backend
    // const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    // return apiGet(`/api/customers${qs}`);
    return window.DB.customers;
  }
  async function createCustomer(payload) {
    // TODO: conectar ao backend
    // return apiPost("/api/customers", payload);
    return payload;
  }

  // ----- Pedidos -----
  async function getOrders(filters = {}) {
    // TODO: conectar ao backend
    // const qs = new URLSearchParams();
    // if (filters.q)      qs.set("q", filters.q);
    // if (filters.status) qs.set("status", filters.status);
    // return apiGet(`/api/orders?${qs.toString()}`);
    return window.DB.orders;
  }
  async function createOrder(payload) {
    // TODO: conectar ao backend
    // return apiPost("/api/orders", payload);
    return payload;
  }

  // ----- Dashboard / Métricas -----
  async function getDashboardMetrics() {
    // TODO: conectar ao backend
    // return apiGet("/api/dashboard/metrics");
    return null; // o frontend já calcula a partir de window.DB.daily
  }
  async function getDailySales(range = 7) {
    // TODO: conectar ao backend
    // return apiGet(`/api/dashboard/daily?range=${range}`);
    return window.DB.daily;
  }
  async function getHourlySales() {
    // TODO: conectar ao backend
    // return apiGet("/api/dashboard/hourly");
    return window.DB.hourly;
  }
  async function getTopProducts() {
    // TODO: conectar ao backend
    // return apiGet("/api/dashboard/top-products");
    return null; // calculado localmente a partir de orders
  }

  // ----- Notificações -----
  async function getNotifications() {
    // TODO: conectar ao backend
    // return apiGet("/api/notifications");
    return window.DB.notifications;
  }

  // ----- Usuarios -----
  async function getUsers() {
    return apiGet("/usuarios/api");
  }
  async function createUser(payload) {
    return apiPost("/usuarios/api", payload);
  }

  return {
    BASE_URL,
    apiGet, apiPost, apiPut, apiDelete,
    getCategories, createCategory,
    getProducts, createProduct, updateProduct, deleteProduct,
    getCustomers, createCustomer,
    getOrders, createOrder,
    getDashboardMetrics, getDailySales, getHourlySales, getTopProducts,
    getNotifications,
    getUsers, createUser
  };
})();


/* =====================================================================
 *  SEED LOCAL (mock) — substituir por chamadas API.getXxx() ao conectar
 * ===================================================================== */
(function () {
  const today = new Date();

  const CATEGORIES = [
    { id: "c1", name: "Bebidas",     icon: "fa-mug-saucer",     color: "#FF6B35" },
    { id: "c2", name: "Lanches",     icon: "fa-burger",         color: "#2D7BFF" },
    { id: "c3", name: "Sobremesas",  icon: "fa-ice-cream",      color: "#7C5CFF" },
    { id: "c4", name: "Padaria",     icon: "fa-bread-slice",    color: "#F5A623" },
    { id: "c5", name: "Mercearia",   icon: "fa-basket-shopping",color: "#16C784" },
    { id: "c6", name: "Hortifruti",  icon: "fa-apple-whole",    color: "#FF4D6D" }
  ];

  const PRODUCTS = [
    { id: "p1",  name: "Café Espresso Premium",  sku: "BBE-001", categoryId: "c1", price: 8.50,  cost: 3.20, stock: 124, minStock: 20, description: "Grão 100% arábica torrado na hora." },
    { id: "p2",  name: "Cappuccino Italiano",    sku: "BBE-002", categoryId: "c1", price: 12.00, cost: 4.50, stock: 78,  minStock: 15 },
    { id: "p3",  name: "Suco Verde Detox 300ml", sku: "BBE-003", categoryId: "c1", price: 14.90, cost: 5.10, stock: 8,   minStock: 10 },
    { id: "p4",  name: "X-Tudo Artesanal",       sku: "LAN-001", categoryId: "c2", price: 28.90, cost: 11.50, stock: 42, minStock: 10 },
    { id: "p5",  name: "Hot Dog Gourmet",        sku: "LAN-002", categoryId: "c2", price: 18.50, cost: 6.20, stock: 31,  minStock: 8 },
    { id: "p6",  name: "Wrap de Frango",         sku: "LAN-003", categoryId: "c2", price: 22.00, cost: 9.10, stock: 0,   minStock: 10 },
    { id: "p7",  name: "Brownie de Chocolate",   sku: "SOB-001", categoryId: "c3", price: 11.00, cost: 3.80, stock: 56,  minStock: 12 },
    { id: "p8",  name: "Cheesecake de Frutas",   sku: "SOB-002", categoryId: "c3", price: 15.90, cost: 5.40, stock: 14,  minStock: 8 },
    { id: "p9",  name: "Pão Italiano 500g",      sku: "PAD-001", categoryId: "c4", price: 9.50,  cost: 3.10, stock: 88,  minStock: 20 },
    { id: "p10", name: "Croissant de Manteiga",  sku: "PAD-002", categoryId: "c4", price: 7.20,  cost: 2.40, stock: 64,  minStock: 15 },
    { id: "p11", name: "Arroz Branco 5kg",       sku: "MER-001", categoryId: "c5", price: 32.90, cost: 21.00, stock: 27, minStock: 6 },
    { id: "p12", name: "Azeite Extra Virgem",    sku: "MER-002", categoryId: "c5", price: 38.50, cost: 22.00, stock: 19, minStock: 5 },
    { id: "p13", name: "Maçã Fuji (kg)",         sku: "HOR-001", categoryId: "c6", price: 9.80,  cost: 5.00, stock: 102, minStock: 25 },
    { id: "p14", name: "Banana Prata (kg)",      sku: "HOR-002", categoryId: "c6", price: 6.50,  cost: 2.80, stock: 5,   minStock: 15 },
    { id: "p15", name: "Salada Mix 200g",        sku: "HOR-003", categoryId: "c6", price: 12.00, cost: 4.50, stock: 36,  minStock: 10 }
  ];

  const CUSTOMERS = [
    { id: "u1", name: "Mariana Costa",   email: "mariana@email.com", phone: "(11) 98765-4321", totalSpent: 1248.50, orders: 14, lastOrder: "Hoje" },
    { id: "u2", name: "Lucas Pereira",   email: "lucas@email.com",   phone: "(11) 99887-7766", totalSpent: 856.20,  orders: 9,  lastOrder: "Ontem" },
    { id: "u3", name: "Ana Beatriz",     email: "ana.b@email.com",   phone: "(11) 98654-1122", totalSpent: 2104.80, orders: 22, lastOrder: "Hoje" },
    { id: "u4", name: "Rafael Souza",    email: "rafa@email.com",    phone: "(21) 99332-1010", totalSpent: 412.00,  orders: 5,  lastOrder: "3 dias atrás" },
    { id: "u5", name: "Carla Mendes",    email: "carla@email.com",   phone: "(11) 91234-5678", totalSpent: 1689.40, orders: 17, lastOrder: "Ontem" },
    { id: "u6", name: "Felipe Oliveira", email: "felipe@email.com",  phone: "(11) 98444-2233", totalSpent: 308.10,  orders: 4,  lastOrder: "Semana passada" }
  ];

  // Helper para gerar pedidos plausíveis
  function pad(n) { return String(n).padStart(4, "0"); }
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  const STATUSES = ["concluido", "pendente", "concluido", "concluido", "cancelado", "concluido"];
  const PAYS = ["Pix", "Cartão Crédito", "Cartão Débito", "Dinheiro", "Pix"];

  const ORDERS = [];
  for (let i = 0; i < 28; i++) {
    const cust = CUSTOMERS[rand(0, CUSTOMERS.length - 1)];
    const nItems = rand(1, 4);
    const items = [];
    let subtotal = 0;
    for (let j = 0; j < nItems; j++) {
      const p = PRODUCTS[rand(0, PRODUCTS.length - 1)];
      const qty = rand(1, 3);
      subtotal += p.price * qty;
      items.push({ productId: p.id, name: p.name, qty, price: p.price });
    }
    const date = new Date(today.getTime() - rand(0, 6) * 86400000 - rand(0, 23) * 3600000);
    ORDERS.push({
      id: "o" + (i + 1),
      number: "#" + pad(1000 + i),
      customerId: cust.id,
      customerName: cust.name,
      items,
      subtotal,
      total: subtotal,
      payment: PAYS[rand(0, PAYS.length - 1)],
      status: STATUSES[rand(0, STATUSES.length - 1)],
      createdAt: date
    });
  }
  ORDERS.sort((a, b) => b.createdAt - a.createdAt);

  // Vendas diárias últimos 30 dias
  const DAILY = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const revenue = rand(1800, 6800) + Math.sin(i / 3) * 600;
    DAILY.push({
      date: d,
      revenue: Math.round(revenue),
      items: rand(40, 180),
      orders: rand(18, 60)
    });
  }

  // Vendas por hora (hoje)
  const HOURLY = [];
  for (let h = 8; h <= 22; h++) {
    HOURLY.push({ hour: h, revenue: rand(80, 720), orders: rand(2, 22) });
  }

  // Notificações
  const NOTIFICATIONS = [
    { id: 1, type: "warn",    icon: "fa-triangle-exclamation", text: "3 produtos com estoque abaixo do mínimo.", time: "há 5 min" },
    { id: 2, type: "success", icon: "fa-circle-check",         text: "Pedido #1027 concluído por Mariana Costa.", time: "há 12 min" },
    { id: 3, type: "info",    icon: "fa-bell",                  text: "Relatório diário disponível para download.", time: "há 1 h" },
    { id: 4, type: "info",    icon: "fa-user-plus",             text: "Novo cliente cadastrado: Felipe Oliveira.", time: "há 2 h" }
  ];

  window.DB = {
    categories: CATEGORIES,
    products: PRODUCTS,
    customers: CUSTOMERS,
    orders: ORDERS,
    daily: DAILY,
    hourly: HOURLY,
    notifications: NOTIFICATIONS,

    nextProductId() {
      let n = this.products.length + 1;
      while (this.products.find(p => p.id === "p" + n)) n++;
      return "p" + n;
    },
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
    return date.toLocaleDateString("pt-BR") + " " + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function stockStatus(product) {
    if (product.stock <= 0) return { pill: "red", label: "Sem estoque" };
    if (product.stock <= (product.minStock || 5)) return { pill: "yellow", label: "Estoque baixo" };
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

  // Toast notification
  function toast(message, type = "info") {
    const wrap = document.getElementById("toastWrap");
    if (!wrap) return;
    const t = document.createElement("div");
    t.className = "toast " + type;
    const iconMap = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info", warn: "fa-triangle-exclamation" };
    t.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.info}"></i><span>${message}</span>`;
    wrap.appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      setTimeout(() => t.remove(), 280);
    }, 2800);
  }

  // Simple modal helpers
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
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

  return { money, num, pct, todayBR, dayShort, dateBR, stockStatus, initialsFromName, toast, openModal, closeModal, confirmDialog, downloadCSV, palette };

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

  function salesLine(range = 7) {
    destroy("salesLine");
    const ctx = document.getElementById("chartSalesLine");
    if (!ctx) return;

    // TODO: conectar ao backend
    // window.API.getDailySales(range).then(data => { ... montar gráfico com data ... });
    const data = window.DB.daily.slice(-range);

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
          y: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR(), callback: v => "R$ " + v } },
          y1: { position: "right", grid: { display: false }, ticks: { color: TEXT_COLOR() } }
        }
      }
    });
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
        responsive: true, maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle(), callbacks: { label: c => `${c.label}: ${UI.money(c.parsed)}` } }
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
      <li>
        <span class="swatch" style="background:${d.color}"></span>
        <span>${d.name}</span>
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
        labels: data.map(d => d.name),
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
          tooltip: { ...tooltipStyle(), callbacks: { label: c => UI.money(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: TEXT_COLOR() } },
          y: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR(), callback: v => "R$ " + v } }
        }
      }
    });
  }

  function hourly(canvasId = "chartHourly") {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // TODO: conectar ao backend
    // window.API.getHourlySales().then(data => { ... montar gráfico com data ... });

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
          y: { grid: { color: GRID() }, ticks: { color: TEXT_COLOR() } }
        }
      }
    });
  }

  function refreshAll() {
    salesLine(currentRange);
    categoryPie("chartCategoryPie", "legendCategory");
    categoryPie("chartCategoryDonut", "legendCategory2");
    categoryBar();
    hourly();
  }

  let currentRange = 7;
  function setRange(r) { currentRange = r; salesLine(r); }

  return { salesLine, categoryPie, categoryBar, hourly, refreshAll, setRange, aggregateByCategory };
})();



window.ProductsPage = (function () {
  let page = 1;
  const perPage = 8;
  let filters = { q: "", category: "", stock: "" };

  function getFiltered() {
    // TODO: conectar ao backend
    // Quando o backend estiver pronto, troque o filtro local por:
    // return window.API.getProducts(filters);   // o backend já aplica os filtros via querystring
    return window.DB.products.filter(p => {
      const cat = window.DB.getCategory(p.categoryId);
      if (filters.q && !(`${p.name} ${p.sku || ""} ${cat?.name || ""}`.toLowerCase().includes(filters.q.toLowerCase()))) return false;
      if (filters.category && p.categoryId !== filters.category) return false;
      if (filters.stock) {
        const s = UI.stockStatus(p);
        if (filters.stock === "in"  && s.pill !== "green") return false;
        if (filters.stock === "low" && s.pill !== "yellow") return false;
        if (filters.stock === "out" && s.pill !== "red") return false;
      }
      return true;
    });
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
        const color = UI.palette[window.DB.categories.findIndex(c => c.id === p.categoryId) % UI.palette.length];
        const s = UI.stockStatus(p);
        return `
          <tr data-id="${p.id}">
            <td><input type="checkbox" class="row-check" /></td>
            <td>
              <div class="prod-cell">
                <div class="prod-thumb" style="background:linear-gradient(135deg, ${color}, ${color}aa)"><i class="fa-solid ${cat?.icon || "fa-box"}"></i></div>
                <div class="prod-name"><strong>${p.name}</strong><span>${p.sku || "—"}</span></div>
              </div>
            </td>
            <td><span class="pill gray">${cat?.name || "—"}</span></td>
            <td><strong>${UI.money(p.price)}</strong></td>
            <td>${p.stock} <span class="muted" style="font-size:11px">/ min ${p.minStock || 0}</span></td>
            <td><span class="pill ${s.pill}">${s.label}</span></td>
            <td class="right">
              <div class="actions-cell">
                <button class="act-btn edit" data-action="edit" data-id="${p.id}" data-testid="edit-product-${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="act-btn delete" data-action="delete" data-id="${p.id}" data-testid="delete-product-${p.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
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
      });
    });
  }

  async function deleteProduct(id) {
    const p = window.DB.getProduct(id);
    if (!p) return;
    const ok = await UI.confirmDialog({
      title: "Excluir produto",
      text: `Tem certeza que deseja excluir "${p.name}"? Essa ação não pode ser desfeita.`,
      okLabel: "Excluir"
    });
    if (!ok) return;

    // TODO: conectar ao backend
    // await window.API.deleteProduct(id);

    window.DB.products = window.DB.products.filter(x => x.id !== id);
    UI.toast(`Produto "${p.name}" excluído.`, "success");
    render();
    if (window.Dashboard) window.Dashboard.refresh();
    if (window.StockPage) window.StockPage.render();
  }

  function openProductForm(id) {
    const titleEl = document.getElementById("productModalTitle");
    const catSel = document.getElementById("productCategory");
    catSel.innerHTML = window.DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    if (id) {
      const p = window.DB.getProduct(id);
      titleEl.textContent = "Editar produto";
      document.getElementById("productId").value = p.id;
      document.getElementById("productName").value = p.name;
      document.getElementById("productCategory").value = p.categoryId;
      document.getElementById("productPrice").value = p.price;
      document.getElementById("productStock").value = p.stock;
      document.getElementById("productMinStock").value = p.minStock || 5;
      document.getElementById("productSku").value = p.sku || "";
      document.getElementById("productDesc").value = p.description || "";
    } else {
      titleEl.textContent = "Novo produto";
      document.getElementById("productForm").reset();
      document.getElementById("productId").value = "";
      document.getElementById("productMinStock").value = 5;
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
      minStock: parseInt(document.getElementById("productMinStock").value, 10) || 0,
      sku: document.getElementById("productSku").value.trim(),
      description: document.getElementById("productDesc").value.trim()
    };
    if (!data.name) { UI.toast("Informe o nome do produto.", "error"); return; }

    if (id) {
      // TODO: conectar ao backend
      // const updated = await window.API.updateProduct(id, data);
      // Object.assign(window.DB.getProduct(id), updated);

      const p = window.DB.getProduct(id);
      Object.assign(p, data);
      UI.toast(`Produto "${data.name}" atualizado.`, "success");
    } else {
      // TODO: conectar ao backend
      // const created = await window.API.createProduct(data);
      // window.DB.products.push(created);

      const newP = { id: window.DB.nextProductId(), ...data };
      window.DB.products.push(newP);
      UI.toast(`Produto "${data.name}" criado.`, "success");
    }
    UI.closeModal("productModal");
    render();
    if (window.Dashboard) window.Dashboard.refresh();
    if (window.StockPage) window.StockPage.render();
  }

  function init() {
    const sel = document.getElementById("productCategoryFilter");

    // TODO: conectar ao backend
    // window.API.getCategories().then(cats => {
    //   sel.innerHTML = `<option value="">Todas categorias</option>` +
    //     cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    // });
    sel.innerHTML = `<option value="">Todas categorias</option>` +
      window.DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    document.getElementById("productSearch").addEventListener("input", e => {
      filters.q = e.target.value; page = 1; render();
    });
    sel.addEventListener("change", e => { filters.category = e.target.value; page = 1; render(); });
    document.getElementById("productStockFilter").addEventListener("change", e => {
      filters.stock = e.target.value; page = 1; render();
    });

    document.getElementById("newProductBtn").addEventListener("click", () => openProductForm());
    document.getElementById("productForm").addEventListener("submit", saveProduct);

    document.getElementById("exportProducts").addEventListener("click", () => {
      const rows = [["Nome", "SKU", "Categoria", "Preço", "Estoque", "Mínimo"]];
      window.DB.products.forEach(p => {
        rows.push([p.name, p.sku || "", window.DB.getCategory(p.categoryId)?.name || "", p.price.toFixed(2).replace(".", ","), p.stock, p.minStock || 0]);
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
    return `<span class="pill gray">${s}</span>`;
  }

  function render() {
    const body = document.getElementById("ordersBody");
    if (!body) return;

    // TODO: conectar ao backend
    // window.API.getOrders(filters).then(rows => { ... atualiza body.innerHTML ... });
    const rows = window.DB.orders.filter(o => {
      if (filters.q && !(`${o.number} ${o.customerName}`.toLowerCase().includes(filters.q.toLowerCase()))) return false;
      if (filters.status && o.status !== filters.status) return false;
      return true;
    });

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:48px;color:var(--text-mute)">Nenhum pedido encontrado.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(o => `
      <tr>
        <td><strong>${o.number}</strong></td>
        <td>${o.customerName}</td>
        <td>${o.items.length}</td>
        <td><strong>${UI.money(o.total)}</strong></td>
        <td><span class="pill blue">${o.payment}</span></td>
        <td class="muted">${UI.dateBR(o.createdAt)}</td>
        <td>${statusPill(o.status)}</td>
        <td class="right">
          <div class="actions-cell">
            <button class="act-btn view" title="Detalhes"><i class="fa-solid fa-eye"></i></button>
            <button class="act-btn edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function init() {
    document.getElementById("orderSearch").addEventListener("input", e => { filters.q = e.target.value; render(); });
    document.getElementById("orderStatusFilter").addEventListener("change", e => { filters.status = e.target.value; render(); });
    document.getElementById("newOrderBtn").addEventListener("click", () => {
      // TODO: conectar ao backend
      // Abrir PDV / criar pedido via window.API.createOrder(payload)
      UI.toast("Abertura de PDV em breve — conecte ao backend para criar pedidos.", "info");
    });
    render();
  }

  return { init, render };
})();


window.CustomersPage = (function () {
  let q = "";

  function render() {
    const grid = document.getElementById("customersGrid");
    if (!grid) return;

    // TODO: conectar ao backend
    // window.API.getCustomers(q).then(rows => { ... atualiza grid.innerHTML ... });
    const rows = window.DB.customers.filter(c =>
      !q || `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase())
    );

    if (!rows.length) {
      grid.innerHTML = `<p class="muted" style="grid-column:1/-1;text-align:center;padding:32px">Nenhum cliente encontrado.</p>`;
      return;
    }

    grid.innerHTML = rows.map(c => `
      <article class="customer-card">
        <div class="avatar lg">${UI.initialsFromName(c.name)}</div>
        <h4>${c.name}</h4>
        <p><i class="fa-solid fa-envelope"></i> ${c.email}</p>
        <p><i class="fa-solid fa-phone"></i> ${c.phone}</p>
        <div class="customer-meta">
          <div><strong>${UI.money(c.totalSpent)}</strong><span>Total gasto</span></div>
          <div><strong>${c.orders}</strong><span>Pedidos</span></div>
          <div><strong>${c.lastOrder}</strong><span>Último</span></div>
        </div>
      </article>
    `).join("");
  }

  function init() {
    document.getElementById("customerSearch").addEventListener("input", e => { q = e.target.value; render(); });
    document.getElementById("newCustomerBtn").addEventListener("click", () => {
      // TODO: conectar ao backend
      // window.API.createCustomer(payload).then(() => render());
      UI.toast("Cadastro de clientes — conecte ao backend.", "info");
    });
    render();
  }

  return { init, render };
})();




window.CategoriesPage = (function () {
  function render() {
    const grid = document.getElementById("categoriesGrid");
    if (!grid) return;

    // TODO: conectar ao backend
    // window.API.getCategories().then(cats => { ... renderiza cards com cats ... });

    const agg = window.CHARTS.aggregateByCategory();
    grid.innerHTML = window.DB.categories.map(c => {
      const a = agg.find(x => x.id === c.id) || { value: 0, color: c.color };
      const productCount = window.DB.products.filter(p => p.categoryId === c.id).length;
      return `
        <article class="category-card">
          <div class="cat-ic" style="background:linear-gradient(135deg, ${a.color}, ${a.color}aa)"><i class="fa-solid ${c.icon}"></i></div>
          <div style="flex:1">
            <h4>${c.name}</h4>
            <p>${productCount} produto${productCount === 1 ? "" : "s"}</p>
          </div>
          <div class="cat-rev">
            <strong>${UI.money(a.value)}</strong>
            <span><i class="fa-solid fa-arrow-trend-up"></i> ${(Math.random() * 12 + 2).toFixed(1)}%</span>
          </div>
        </article>
      `;
    }).join("");
  }
  function init() {
    document.getElementById("newCategoryBtn").addEventListener("click", () => {
      // TODO: conectar ao backend
      // window.API.createCategory(payload).then(() => render());
      UI.toast("Nova categoria — conecte ao backend para persistir.", "info");
    });
    render();
  }
  return { init, render };
})();



window.StockPage = (function () {
  function render() {
    const body = document.getElementById("stockBody");
    if (!body) return;

    // TODO: conectar ao backend
    // window.API.getProducts().then(prods => { ... renderiza tabela e KPIs ... });

    const prods = window.DB.products.slice().sort((a, b) => a.stock - b.stock);
    body.innerHTML = prods.map(p => {
      const cat = window.DB.getCategory(p.categoryId);
      const s = UI.stockStatus(p);
      return `
        <tr>
          <td><strong>${p.name}</strong> <span class="muted" style="font-family:'DM Mono',monospace;font-size:11px">${p.sku || ""}</span></td>
          <td><span class="pill gray">${cat?.name || "—"}</span></td>
          <td><strong>${p.stock}</strong></td>
          <td>${p.minStock || 0}</td>
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
    const low = window.DB.products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5)).length;
    const out = window.DB.products.filter(p => p.stock <= 0).length;
    document.getElementById("skuCount").textContent = UI.num(skuCount);
    document.getElementById("stockValue").textContent = UI.money(stockValue);
    document.getElementById("lowStockCount").textContent = low;
    document.getElementById("outOfStockCount").textContent = out;

    document.querySelectorAll("#stockBody .act-btn").forEach(b => {
      b.addEventListener("click", async () => {
        const p = window.DB.getProduct(b.dataset.id);
        if (!p) return;
        const qty = parseInt(prompt(`Adicionar ao estoque de "${p.name}":`, "10"), 10);
        if (!qty || isNaN(qty)) return;

        // TODO: conectar ao backend
        // await window.API.updateProduct(p.id, { ...p, stock: p.stock + qty });

        p.stock += qty;
        UI.toast(`+${qty} unidades adicionadas a ${p.name}.`, "success");
        render();
        if (window.ProductsPage) window.ProductsPage.render();
        if (window.Dashboard) window.Dashboard.refresh();
      });
    });
  }
  return { render, init: render };
})();


window.EmployeeLoginsPage = (function () {
  const fallbackRows = [];

  function roleLabel(role) {
    return role === "admin" ? "Administrador" : "Funcionário";
  }

  function statusPill(active) {
    return active === false ? `<span class="pill red">Inativo</span>` : `<span class="pill green">Ativo</span>`;
  }

  function rowTemplate(user) {
    return `
      <tr>
        <td><strong>${user.nome || user.name || "Funcionário"}</strong></td>
        <td>${user.email || ""}</td>
        <td><span class="pill blue">${roleLabel(user.role)}</span></td>
        <td>${statusPill(user.ativo)}</td>
      </tr>
    `;
  }

  async function render() {
    const body = document.getElementById("employeeLoginsBody");
    if (!body) return;

    body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-mute)">Carregando logins...</td></tr>`;

    try {
      const users = await window.API.getUsers();
      const employees = users.filter(user => user.role !== "admin");
      const rows = employees.length ? employees : fallbackRows;
      body.innerHTML = rows.length
        ? rows.map(rowTemplate).join("")
        : `<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-mute)">Nenhum login de funcionário cadastrado.</td></tr>`;
    } catch (err) {
      body.innerHTML = fallbackRows.length
        ? fallbackRows.map(rowTemplate).join("")
        : `<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-mute)">Cadastre o primeiro login de funcionário.</td></tr>`;
    }
  }

  async function saveEmployee(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      nome: document.getElementById("employeeName").value.trim(),
      email: document.getElementById("employeeEmail").value.trim(),
      senha: document.getElementById("employeePassword").value,
      role: document.getElementById("employeeRole").value
    };

    if (!payload.nome || !payload.email || !payload.senha) {
      UI.toast("Preencha todos os campos do login.", "error");
      return;
    }

    try {
      const created = await window.API.createUser(payload);
      fallbackRows.unshift(created);
      UI.toast(`Login de ${payload.nome} criado.`, "success");
      form.reset();
      render();
    } catch (err) {
      UI.toast(err.message || "Não foi possível criar o login.", "error");
    }
  }

  function init() {
    document.getElementById("employeeLoginForm")?.addEventListener("submit", saveEmployee);
    render();
  }

  return { init, render };
})();



window.Dashboard = (function () {
  function todayMetrics() {
    // TODO: conectar ao backend
    // Substituir pelo retorno de: await window.API.getDashboardMetrics();
    // Esperado: { revenue, items, orders, ticket, monthRevenue, revPct, itemsPct, ordersPct, ticketPct, monthPct }

    const today = window.DB.daily[window.DB.daily.length - 1];
    const yesterday = window.DB.daily[window.DB.daily.length - 2];
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
    // TODO: conectar ao backend
    // window.API.getTopProducts().then(list => { ... renderiza el.innerHTML ... });

    const totals = {};
    window.DB.orders.forEach(o => {
      if (o.status === "cancelado") return;
      o.items.forEach(it => {
        totals[it.productId] = (totals[it.productId] || 0) + it.qty * it.price;
      });
    });
    const sorted = Object.entries(totals)
      .map(([id, val]) => ({ p: window.DB.getProduct(id), val }))
      .filter(x => x.p)
      .sort((a, b) => b.val - a.val)
      .slice(0, 5);

    const el = document.getElementById("topProducts");
    el.innerHTML = sorted.map((s, i) => {
      const cat = window.DB.getCategory(s.p.categoryId);
      const color = UI.palette[i % UI.palette.length];
      return `
        <li>
          <div class="thumb" style="background:linear-gradient(135deg, ${color}, ${color}aa)"><i class="fa-solid ${cat?.icon || "fa-box"}"></i></div>
          <div class="meta"><strong>${s.p.name}</strong><span>${cat?.name || "—"}</span></div>
          <div class="val">${UI.money(s.val)}</div>
        </li>
      `;
    }).join("");
  }

  function renderRecentOrders() {
    const body = document.getElementById("recentOrdersBody");

    // TODO: conectar ao backend
    // window.API.getOrders().then(orders => { ... pega os 5 mais recentes ... });

    const status = s => s === "concluido" ? `<span class="pill green">Concluído</span>`
      : s === "pendente" ? `<span class="pill yellow">Pendente</span>`
      : `<span class="pill red">Cancelado</span>`;
    body.innerHTML = window.DB.orders.slice(0, 5).map(o => `
      <tr>
        <td><strong>${o.number}</strong></td>
        <td>${o.customerName}</td>
        <td>${UI.money(o.total)}</td>
        <td>${status(o.status)}</td>
      </tr>
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
    dashboard:     { title: "Dashboard",             sub: "Visão geral das vendas e operações." },
    admin:         { title: "Painel Administrativo", sub: "Gerencie os produtos da sua loja." },
    funcionarios:  { title: "Login de Funcionários", sub: "Crie e acompanhe acessos de funcionários." },
    grafico:       { title: "Painel Gráfico",        sub: "Indicadores e gráficos em tempo real." },
    pedidos:       { title: "Pedidos",               sub: "Acompanhe transações e status." },
    clientes:      { title: "Clientes",              sub: "Base de clientes e histórico de compras." },
    categorias:    { title: "Categorias",            sub: "Organize seus produtos por categoria." },
    estoque:       { title: "Estoque",               sub: "Controle de SKUs, mínimos e reposições." },
    relatorios:    { title: "Relatórios",            sub: "Exportações e análises detalhadas." },
    configuracoes: { title: "Configurações",         sub: "Preferências da loja e do painel." }
  };

  function navigate(route) {
    if (!ROUTE_META[route]) route = "dashboard";

    document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.route === route));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const pg = document.getElementById("page-" + route);
    if (pg) pg.classList.add("active");

    document.getElementById("pageTitle").textContent = ROUTE_META[route].title;
    document.getElementById("pageSubtitle").textContent = ROUTE_META[route].sub;

    // Close sidebar on mobile
    document.getElementById("sidebar").classList.remove("open");

    // Page-specific refreshes
    if (route === "dashboard")  window.Dashboard.refresh();
    if (route === "grafico")    window.Dashboard.refresh();
    if (route === "admin")      window.ProductsPage.render();
    if (route === "pedidos")    window.OrdersPage.render();
    if (route === "clientes")   window.CustomersPage.render();
    if (route === "categorias") window.CategoriesPage.render();
    if (route === "estoque")    window.StockPage.render();
    if (route === "funcionarios") window.EmployeeLoginsPage.render();

    location.hash = "#" + route;
  }

  function renderNotifications() {
    const list = document.getElementById("notifList");

    // TODO: conectar ao backend
    // window.API.getNotifications().then(items => { ... renderiza list.innerHTML ... });

    list.innerHTML = window.DB.notifications.map(n => `
      <li class="${n.type}">
        <i class="fa-solid ${n.icon}"></i>
        <div>${n.text}<time>${n.time}</time></div>
      </li>
    `).join("");
  }

  function updateSidebarBadges() {
    const lowStock = window.DB.products.filter(p => p.stock <= (p.minStock || 5)).length;
    document.getElementById("navLowStock").textContent = lowStock;
    document.getElementById("navLowStock").style.display = lowStock ? "" : "none";
    const pending = window.DB.orders.filter(o => o.status === "pendente").length;
    document.getElementById("navOrdersBadge").textContent = pending;
    document.getElementById("navOrdersBadge").style.display = pending ? "" : "none";
  }

  function bindGlobal() {
    document.querySelectorAll(".nav-item[data-route]").forEach(b => {
      b.addEventListener("click", () => navigate(b.dataset.route));
    });
    document.querySelectorAll("[data-route-link]").forEach(b => {
      b.addEventListener("click", () => navigate(b.dataset.routeLink));
    });

    document.getElementById("toggleSidebar")?.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });

    document.getElementById("themeToggle").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "" : "dark";
      if (cur) document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
      document.querySelector("#themeToggle i").className = cur ? "fa-solid fa-sun" : "fa-solid fa-moon";
      window.CHARTS.refreshAll();
    });

    const notifBtn = document.getElementById("notifBtn");
    const notifTray = document.getElementById("notifTray");
    notifBtn.addEventListener("click", e => {
      e.stopPropagation();
      notifTray.classList.toggle("hidden");
      document.getElementById("adminTray").classList.add("hidden");
    });

    const adminChip = document.getElementById("adminChip");
    const adminTray = document.getElementById("adminTray");
    adminChip.addEventListener("click", e => {
      e.stopPropagation();
      adminTray.classList.toggle("hidden");
      notifTray.classList.add("hidden");
    });

    document.addEventListener("click", () => {
      notifTray.classList.add("hidden");
      adminTray.classList.add("hidden");
    });

    // Cmd+K for search
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("globalSearch").focus();
      }
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.add("hidden"));
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

  document.addEventListener("DOMContentLoaded", () => {
    // -----------------------------------------------------------------
    // TODO: conectar ao backend (boot-up)
    // Para alimentar todas as páginas com dados reais do SQLite, basta:
    //
    //   Promise.all([
    //     window.API.getCategories(),
    //     window.API.getProducts(),
    //     window.API.getCustomers(),
    //     window.API.getOrders(),
    //     window.API.getDailySales(30),
    //     window.API.getHourlySales(),
    //     window.API.getNotifications()
    //   ]).then(([cats, prods, custs, ords, daily, hourly, notifs]) => {
    //     window.DB.categories    = cats;
    //     window.DB.products      = prods;
    //     window.DB.customers     = custs;
    //     window.DB.orders        = ords;
    //     window.DB.daily         = daily;
    //     window.DB.hourly        = hourly;
    //     window.DB.notifications = notifs;
    //     bootUI();
    //   }).catch(err => {
    //     console.error("Falha ao carregar dados do backend:", err);
    //     bootUI(); // segue com mock em caso de falha
    //   });
    //
    //   function bootUI() { ... mesmo código do bloco abaixo ... }
    // -----------------------------------------------------------------

    // Init pages
    initDashboardParticles();
    window.Dashboard.init();
    window.ProductsPage.init();
    window.OrdersPage.init();
    window.CustomersPage.init();
    window.CategoriesPage.init();
    window.StockPage.init();
    window.EmployeeLoginsPage.init();
    renderNotifications();
    updateSidebarBadges();
    bindGlobal();

    // Initial route via hash
    const route = (location.hash || "#dashboard").replace("#", "");
    navigate(route);

    // Periodic refresh of badges (simulate real-time)
    setInterval(updateSidebarBadges, 5000);
  });
})();
