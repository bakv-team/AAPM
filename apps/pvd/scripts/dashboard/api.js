/* Dashboard: cliente da API e cache compartilhado. */

window.API = (function () {
  const BASE_URL = window.location.origin;

  function csrfToken() {
    const item = document.cookie.split("; ").find(value => value.startsWith("csrf_token="));
    return item ? decodeURIComponent(item.split("=").slice(1).join("=")) : "";
  }

  function mutationHeaders(headers = {}) {
    return { ...headers, "X-CSRF-Token": csrfToken() };
  }

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
      headers: mutationHeaders({ "Content-Type": "application/json" }),
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    await assertOk(res, `POST ${path} -> ${res.status}`);
    return res.json();
  }
  async function apiPut(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: mutationHeaders({ "Content-Type": "application/json" }),
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    await assertOk(res, `PUT ${path} -> ${res.status}`);
    return res.json();
  }
  async function apiDelete(path) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: mutationHeaders(),
      credentials: "same-origin"
    });
    await assertOk(res, `DELETE ${path} -> ${res.status}`);
    return res.ok;
  }

  async function apiForm(path, method, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: mutationHeaders(),
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
    data.set("variacoes", JSON.stringify(payload.variations || []));
    if (payload.image) data.set("imagem", payload.image);
    if (!payload.image && payload.existingImage) data.set("imagem_existente", payload.existingImage);
    return data;
  }

  // ----- Categorias -----
  async function getCategories(filters = {}) {
    const qs = new URLSearchParams();
    if (Number.isInteger(filters.offset)) qs.set("offset", filters.offset);
    if (Number.isInteger(filters.limit)) qs.set("limit", filters.limit);
    return apiGet(`/api/v1/pdv/categories${qs.toString() ? `?${qs}` : ""}`);
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
    if (Number.isInteger(filters.offset)) qs.set("offset", filters.offset);
    if (Number.isInteger(filters.limit)) qs.set("limit", filters.limit);
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
  async function addProductStock(id, quantidade, variacaoId = null) {
    return apiPost(`/api/v1/pdv/products/${id}/stock`, { quantidade, variacao_id: variacaoId ? Number(variacaoId) : null });
  }
  async function getStockMovements(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.productId) qs.set("produto_id", filters.productId);
    if (filters.type) qs.set("tipo", filters.type);
    if (Number.isInteger(filters.offset)) qs.set("offset", filters.offset);
    if (Number.isInteger(filters.limit)) qs.set("limit", filters.limit);
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
  async function getCustomers(filters = {}) {
    const options = typeof filters === "string" ? { q: filters } : filters;
    const qs = new URLSearchParams();
    if (options.q) qs.set("q", options.q);
    if (Number.isInteger(options.offset)) qs.set("offset", options.offset);
    if (Number.isInteger(options.limit)) qs.set("limit", options.limit);
    return apiGet(`/api/v1/pdv/customers${qs.toString() ? `?${qs}` : ""}`);
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
  async function markPaymentExceptionPaid(id) {
    return apiPut(`/api/v1/pdv/orders/${id}/payment-exception`, { pago: true });
  }

  // ----- Dashboard / MÃ©tricas -----
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

  // ----- Armários -----
  async function getLockers(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.status) qs.set("status", filters.status);
    if (Number.isInteger(filters.offset)) qs.set("offset", filters.offset);
    if (Number.isInteger(filters.limit)) qs.set("limit", filters.limit);
    if (filters.location) qs.set("localizacao", filters.location);
    if (filters.includeInactive) qs.set("incluir_inativos", "true");
    if (Number.isInteger(filters.offset)) qs.set("offset", filters.offset);
    if (Number.isInteger(filters.limit)) qs.set("limit", filters.limit);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiGet(`/api/v1/armarios${suffix}`);
  }
  async function createLocker(payload) { return apiPost("/api/v1/armarios", payload); }
  async function updateLocker(id, payload) { return apiPut(`/api/v1/armarios/${id}`, payload); }
  async function rentLocker(id, payload) { return apiPost(`/api/v1/armarios/${id}/alugar`, payload); }
  async function releaseLocker(id) { return apiPost(`/api/v1/armarios/${id}/liberar`, {}); }
  async function toggleLockerActive(id) { return apiPost(`/api/v1/armarios/${id}/toggle-ativo`, {}); }

  // ----- NotificaÃ§Ãµes -----
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
    getOrders, createOrder, markPaymentExceptionPaid,
    getDashboardMetrics, getDailySales, getHourlySales, getTopProducts, getSmartInsights, askSmartAssistant,
    getLockers, createLocker, updateLocker, rentLocker, releaseLocker, toggleLockerActive,
    getNotifications, getSystemHealth, getProfile, changePassword, sendSupport, downloadReport
  };
})();


/* =====================================================================
 *  CACHE DE TELA â€” preenchido exclusivamente pela API real.
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



