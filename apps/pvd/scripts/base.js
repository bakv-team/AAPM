const canvas = document.getElementById("particles");
const ctx = canvas?.getContext("2d");

if (canvas && ctx) {
  let particles = [];
  let animationFrame = null;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
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

  window.addEventListener("resize", restartParticles);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    } else if (!document.hidden && !animationFrame) {
      animateParticles();
    }
  });

  restartParticles();
  animateParticles();
}

const API_BASE = window.location.origin;
const DISCOUNT = 0.10;
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const productsGrid = document.getElementById("productsGrid");
const categoryButtons = document.getElementById("categoryButtons");
const cartItemsContainer = document.getElementById("cartItems");
const cartTotalElement = document.getElementById("cartTotal");
const cartSubtotalElement = document.getElementById("cartSubtotal");
const cartDiscountElement = document.getElementById("cartDiscount");
const cartItemCountElement = document.getElementById("cartItemCount");
const searchInput = document.getElementById("searchInput");
const btnToggleAssociado = document.getElementById("btnToggleAssociado");
const btnFecharPedido = document.getElementById("btnFecharPedido");
const paymentOptions = document.getElementById("paymentOptions");
const customerNameInput = document.getElementById("customerNameInput");
const associateStatus = document.getElementById("associateStatus");
const categoryTitle = document.getElementById("categoryName");
const productCount = document.querySelector(".product-count");
const resultCount = document.getElementById("resultCount");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageNumbers = document.getElementById("pageNumbers");
const themeToggle = document.getElementById("themeToggle");
const pdvNotifBtn = document.getElementById("pdvNotifBtn");
const pdvNotifTray = document.getElementById("pdvNotifTray");
const pdvNotifList = document.getElementById("pdvNotifList");
const pdvMarkNotifRead = document.getElementById("pdvMarkNotifRead");
const pdvProfileChip = document.getElementById("pdvProfileChip");
const pdvProfileTray = document.getElementById("pdvProfileTray");
const pdvLogoutBtn = document.getElementById("pdvLogoutBtn");
const pdvShell = document.getElementById("pdvShell");
const sidebar = document.getElementById("sidebar");
const sidebarCollapse = document.getElementById("sidebarCollapse");
const mobileSidebarToggle = document.getElementById("toggleSidebar");
const checkoutScreen = document.getElementById("checkoutScreen");
const checkoutBackBtn = document.getElementById("checkoutBackBtn");
const checkoutCancelBtn = document.getElementById("checkoutCancelBtn");
const checkoutConfirmBtn = document.getElementById("checkoutConfirmBtn");
const checkoutPrintBtn = document.getElementById("checkoutPrintBtn");
const checkoutItems = document.getElementById("checkoutItems");
const checkoutItemsCount = document.getElementById("checkoutItemsCount");
const checkoutCustomer = document.getElementById("checkoutCustomer");
const checkoutAssociate = document.getElementById("checkoutAssociate");
const checkoutPayment = document.getElementById("checkoutPayment");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutDiscount = document.getElementById("checkoutDiscount");
const checkoutTotal = document.getElementById("checkoutTotal");
const confirmPurchaseModal = document.getElementById("confirmPurchaseModal");
const confirmPurchaseNo = document.getElementById("confirmPurchaseNo");
const confirmPurchaseYes = document.getElementById("confirmPurchaseYes");
const checkoutSuccess = document.getElementById("checkoutSuccess");
const successOrderNumber = document.getElementById("successOrderNumber");
const successOrderSummary = document.getElementById("successOrderSummary");

let produtos = [];
let categorias = [];
let carrinho = JSON.parse(localStorage.getItem("carrinho_aapm_pdv") || "[]");
let categoriaAtual = "todos";
let termoBusca = "";
let ehAssociado = false;
let associadoValidado = null;
let associateLookupTimer = null;
let pagamentoAtual = "pix";
let page = 1;
const perPage = 8;
const PDV_NOTIF_READ_STORAGE_KEY = "aapm_read_notifications";
let pdvNotifications = [];

function notificationKey(item) {
  return [item?.id || "", item?.text || "", item?.time || ""].join("|");
}

function getReadNotificationKeys() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PDV_NOTIF_READ_STORAGE_KEY) || "[]"));
  } catch (error) {
    return new Set();
  }
}

function setReadNotificationKeys(keys) {
  localStorage.setItem(PDV_NOTIF_READ_STORAGE_KEY, JSON.stringify([...keys].slice(-80)));
}

function filterUnreadNotifications(items) {
  const read = getReadNotificationKeys();
  return (items || []).filter(item => !read.has(notificationKey(item)));
}

function setupMotionObserver(root = document) {
  const targets = root.querySelectorAll(".content, .cart, .card, .payment-option, .cart-associate");
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

function money(value) {
  return BRL.format(Number(value) || 0);
}

function paymentLabel(payment) {
  const labels = {
    pix: "Pix",
    debito: "Débito",
    credito: "Crédito",
    dinheiro: "Dinheiro"
  };
  return labels[payment] || payment || "Pix";
}

function cartItemName(item) {
  return item?.name || item?.nome || "Produto";
}

function cartItemPrice(item) {
  return Number(item?.price ?? item?.preco ?? 0) || 0;
}

function cartItemQuantity(item) {
  return Math.max(1, Number(item?.quantidade ?? item?.qty ?? 1) || 1);
}

function icon(className) {
  const element = document.createElement("i");
  element.className = className;
  return element;
}

function toast(message, type = "info") {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return;

  const item = document.createElement("div");
  item.className = `toast ${type}`;
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    warn: "fa-triangle-exclamation",
    info: "fa-circle-info"
  };
  const marker = document.createElement("i");
  marker.className = `fa-solid ${icons[type] || icons.info}`;
  const text = document.createElement("span");
  text.textContent = message;
  item.append(marker, text);
  wrap.appendChild(item);
  setTimeout(() => {
    item.classList.add("leaving");
    setTimeout(() => item.remove(), 250);
  }, 2800);
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "same-origin" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || {});
    throw new Error(detail && detail !== "{}" ? detail : `GET ${path} -> ${response.status}`);
  }
  return response.json();
}

async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || {});
    throw new Error(detail && detail !== "{}" ? detail : `POST ${path} -> ${response.status}`);
  }
  return response.json();
}

function produtoDisponivel(produto) {
  return Math.max(0, Number(produto.stock) || 0);
}

function categoriaNome(id) {
  return categorias.find(categoria => categoria.id === id)?.name || "Sem categoria";
}

function produtoImagem(produto) {
  return produto.imageUrl || "/apps/pvd/assets/icones/logosemtexto.png";
}

function normalizarCarrinho() {
  carrinho = carrinho
    .map(item => {
      const produto = produtos.find(p => String(p.id) === String(item.id));
      if (!produto) return null;
      const quantidade = Math.min(item.quantidade, produtoDisponivel(produto));
      return quantidade > 0 ? { ...produto, quantidade } : null;
    })
    .filter(Boolean);
  salvarCarrinho();
}

function salvarCarrinho() {
  localStorage.setItem("carrinho_aapm_pdv", JSON.stringify(carrinho));
}

function produtosFiltrados() {
  return produtos.filter(produto => {
    const texto = `${produto.name} ${categoriaNome(produto.categoryId)}`.toLowerCase();
    const bateBusca = !termoBusca || texto.includes(termoBusca.toLowerCase());
    const bateCategoria = categoriaAtual === "todos" || produto.categoryId === categoriaAtual;
    return bateBusca && bateCategoria;
  });
}

function renderCategorias() {
  if (!categoryButtons) return;

  categoryButtons.innerHTML = categorias.map(categoria => `
    <button class="nav-item cat-btn" data-category="${categoria.id}">
      <i class="fa-solid ${categoria.icon || "fa-box"}"></i>
      <span>${categoria.name} <em class="cat-count" data-category="${categoria.id}">(0)</em></span>
    </button>
  `).join("");

  document.querySelectorAll(".cat-btn").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".cat-btn").forEach(item => item.classList.remove("active", "cat-active"));
      button.classList.add("active", "cat-active");
      categoriaAtual = button.dataset.category;
      page = 1;
      categoryTitle.textContent = categoriaAtual === "todos" ? "Todos os Produtos" : button.querySelector("span").childNodes[0].textContent.trim();
      renderProdutos();
    });
  });

  atualizarContadoresCategorias();
}

function atualizarContadoresCategorias() {
  const total = produtos.length;
  const all = document.querySelector('.cat-count[data-category="todos"]');
  if (all) all.textContent = `(${total})`;

  categorias.forEach(categoria => {
    const count = produtos.filter(produto => produto.categoryId === categoria.id).length;
    const el = document.querySelector(`.cat-count[data-category="${categoria.id}"]`);
    if (el) el.textContent = `(${count})`;
  });
}

function renderProdutos() {
  if (!productsGrid) return;
  productsGrid.classList.remove("is-rendering");

  const rows = produtosFiltrados();
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (page > pages) page = pages;

  const start = (page - 1) * perPage;
  const items = rows.slice(start, start + perPage);

  if (!items.length) {
    productsGrid.innerHTML = `<p class="empty-state">Nenhum produto encontrado.</p>`;
  } else {
    productsGrid.innerHTML = items.map(produto => {
      const disponivel = produtoDisponivel(produto);
      const disabled = disponivel <= 0 ? "disabled" : "";
      const estoqueLabel = disponivel > 0 ? `${disponivel} disponiveis` : "Indisponivel";
      return `
        <article class="card product-card">
          <div class="card-image">
            <img src="${produtoImagem(produto)}" alt="${produto.name}" loading="lazy">
          </div>
          <div class="card-content">
            <div class="product-card-main">
              <span class="card-category">${categoriaNome(produto.categoryId)}</span>
              <h3 class="card-title">${produto.name}</h3>
            </div>
            <p class="stock-chip ${disponivel <= 0 ? "danger" : ""}">${estoqueLabel}</p>
            <p class="price">${money(produto.price)}</p>
            <button class="card-button" data-add-product="${produto.id}" ${disabled}>
              <i class="fa-solid fa-cart-plus"></i> Adicionar
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  productsGrid.querySelectorAll("[data-add-product]").forEach(button => {
    button.addEventListener("click", () => adicionarAoCarrinho(button.dataset.addProduct));
  });
  requestAnimationFrame(() => {
    productsGrid.classList.add("is-rendering");
    setupMotionObserver(productsGrid);
  });

  if (productCount) productCount.textContent = `(${total})`;
  if (resultCount) {
    const first = total ? start + 1 : 0;
    const last = Math.min(start + items.length, total);
    resultCount.textContent = `${first}-${last} de ${total} resultados`;
  }

  renderPagination(pages);
}

function renderPagination(pages) {
  if (!pageNumbers || !prevPage || !nextPage) return;
  prevPage.disabled = page <= 1;
  nextPage.disabled = page >= pages;
  pageNumbers.innerHTML = Array.from({ length: pages }, (_, index) => {
    const number = index + 1;
    return `<button class="page-number ${number === page ? "active" : ""}" data-page="${number}">${number}</button>`;
  }).join("");
  pageNumbers.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      page = Number(button.dataset.page);
      renderProdutos();
    });
  });
}

function adicionarAoCarrinho(idProduto) {
  const produto = produtos.find(p => String(p.id) === String(idProduto));
  if (!produto) return;

  const item = carrinho.find(row => String(row.id) === String(idProduto));
  const novaQuantidade = (item?.quantidade || 0) + 1;
  if (novaQuantidade > produtoDisponivel(produto)) {
    toast("Estoque insuficiente para este produto.", "warn");
    return;
  }

  if (item) item.quantidade = novaQuantidade;
  else carrinho.push({ ...produto, quantidade: 1 });

  salvarCarrinho();
  renderCarrinho();
  toast(`${produto.name} adicionado ao carrinho.`, "success");
}

function alterarQuantidade(idProduto, delta) {
  const item = carrinho.find(row => String(row.id) === String(idProduto));
  const produto = produtos.find(p => String(p.id) === String(idProduto));
  if (!item || !produto) return;

  const novaQuantidade = item.quantidade + delta;
  if (novaQuantidade <= 0) {
    carrinho = carrinho.filter(row => String(row.id) !== String(idProduto));
  } else if (novaQuantidade <= produtoDisponivel(produto)) {
    item.quantidade = novaQuantidade;
  } else {
    toast("Quantidade maior que o estoque disponivel para venda.", "warn");
  }

  salvarCarrinho();
  renderCarrinho();
}

function removerDoCarrinho(idProduto) {
  carrinho = carrinho.filter(row => String(row.id) !== String(idProduto));
  salvarCarrinho();
  renderCarrinho();
}

function totaisCarrinho() {
  const totalBruto = carrinho.reduce((sum, item) => sum + cartItemPrice(item) * cartItemQuantity(item), 0);
  const desconto = ehAssociado ? totalBruto * DISCOUNT : 0;
  return { totalBruto, desconto, totalLiquido: totalBruto - desconto };
}

function buildSalePayload() {
  const customerName = getCustomerName();
  return {
    pagamento: pagamentoAtual,
    associado: ehAssociado,
    cliente_nome: customerName,
    customerName,
    observacao: customerName ? `Cliente: ${customerName}` : null,
    itens: carrinho.map(item => ({
      produto_id: Number(item.id),
      quantidade: cartItemQuantity(item)
    }))
  };
}

function renderCarrinho() {
  if (!cartItemsContainer) return;
  const items = carrinho.filter(Boolean);
  const itemCount = items.reduce((sum, item) => sum + cartItemQuantity(item), 0);
  if (cartItemCountElement) cartItemCountElement.textContent = `${itemCount} ${itemCount === 1 ? "item" : "itens"}`;

  cartItemsContainer.classList.add("cart-lines-list");
  cartItemsContainer.hidden = false;
  cartItemsContainer.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "cart-empty";
    empty.append(icon("fa-solid fa-basket-shopping"));

    const title = document.createElement("strong");
    title.textContent = "Carrinho vazio";
    empty.append(title);

    const text = document.createElement("span");
    text.textContent = "Adicione produtos para iniciar uma venda.";
    empty.append(text);

    cartItemsContainer.append(empty);
  } else {
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
      const name = cartItemName(item);
      const price = cartItemPrice(item);
      const quantity = cartItemQuantity(item);

      const article = document.createElement("article");
      article.className = "cart-line-item";

      const thumb = document.createElement("div");
      thumb.className = "cart-line-thumb";
      const image = document.createElement("img");
      image.src = produtoImagem(item);
      image.alt = "";
      thumb.append(image);

      const info = document.createElement("div");
      info.className = "cart-line-info";
      const title = document.createElement("strong");
      title.textContent = name;
      const unitPrice = document.createElement("span");
      unitPrice.textContent = `${money(price)} un.`;

      const qty = document.createElement("div");
      qty.className = "cart-line-qty";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.dataset.qty = item.id;
      minus.dataset.delta = "-1";
      minus.setAttribute("aria-label", `Diminuir quantidade de ${name}`);
      minus.append(icon("fa-solid fa-minus"));
      const amount = document.createElement("b");
      amount.textContent = String(quantity);
      const plus = document.createElement("button");
      plus.type = "button";
      plus.dataset.qty = item.id;
      plus.dataset.delta = "1";
      plus.setAttribute("aria-label", `Aumentar quantidade de ${name}`);
      plus.append(icon("fa-solid fa-plus"));
      qty.append(minus, amount, plus);

      info.append(title, unitPrice, qty);

      const side = document.createElement("div");
      side.className = "cart-line-side";
      const total = document.createElement("strong");
      total.textContent = money(price * quantity);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.remove = item.id;
      remove.setAttribute("aria-label", `Remover ${name}`);
      remove.append(icon("fa-solid fa-trash-can"));
      side.append(total, remove);

      article.append(thumb, info, side);
      fragment.append(article);
    });

    cartItemsContainer.append(fragment);
  }

  cartItemsContainer.querySelectorAll("[data-qty]").forEach(button => {
    button.addEventListener("click", () => alterarQuantidade(button.dataset.qty, Number(button.dataset.delta)));
  });
  cartItemsContainer.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => removerDoCarrinho(button.dataset.remove));
  });

  const totals = totaisCarrinho();
  if (cartSubtotalElement) cartSubtotalElement.textContent = money(totals.totalBruto);
  if (cartDiscountElement) {
    cartDiscountElement.textContent = `-${money(totals.desconto)}`;
  }
  if (cartTotalElement) cartTotalElement.textContent = money(totals.totalLiquido);

  if (btnToggleAssociado) {
    const icon = btnToggleAssociado.querySelector("i");
    const label = btnToggleAssociado.querySelector("span");
    btnToggleAssociado.classList.toggle("active", ehAssociado);
    btnToggleAssociado.disabled = !ehAssociado;
    if (icon) icon.className = ehAssociado ? "fa-solid fa-circle-check" : "fa-regular fa-circle";
    if (label) label.textContent = ehAssociado ? "Associado AAPM confirmado (10%)" : "Sem desconto de associado";
  }
}

function setAssociateStatus(message, state = "muted") {
  if (!associateStatus) return;
  associateStatus.textContent = message;
  associateStatus.dataset.state = state;
}

function getCustomerName() {
  return customerNameInput?.value.trim() || "";
}

function isPlaceholderCustomerName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase() === "cliente balcao";
}

function setCustomerFieldInvalid(invalid) {
  const field = customerNameInput?.closest(".cart-customer-field");
  field?.classList.toggle("is-invalid", invalid);
  customerNameInput?.setAttribute("aria-invalid", String(invalid));
}

function validateCustomerName({ focus = false } = {}) {
  const customerName = getCustomerName();
  const invalid = !customerName || isPlaceholderCustomerName(customerName);
  setCustomerFieldInvalid(invalid);

  if (invalid) {
    setAssociateStatus("Informe o nome do cliente para fechar o pedido.", "error");
    toast("Informe o nome do cliente antes de fechar o pedido.", "warn");
    if (focus) customerNameInput?.focus();
    return false;
  }

  return true;
}

async function validarAssociado() {
  const termo = getCustomerName();
  associadoValidado = null;
  ehAssociado = false;

  if (!termo) {
    setCustomerFieldInvalid(false);
    setAssociateStatus("Se o cliente for associado, o desconto será aplicado automaticamente.", "muted");
    renderCarrinho();
    return;
  }

  setAssociateStatus("Verificando se o cliente é associado...", "loading");
  try {
    const data = await apiGet(`/api/v1/pdv/associates/lookup?q=${encodeURIComponent(termo)}`);
    associadoValidado = data.found ? data : null;
    ehAssociado = Boolean(data.found && data.isAssociado);
    if (ehAssociado) {
      setAssociateStatus(`${data.name || data.nome} é associado AAPM. Desconto de 10% aplicado.`, "success");
    } else if (data.found) {
      setAssociateStatus("Cliente encontrado, mas não possui desconto de associado.", "warn");
    } else {
      setAssociateStatus("Cliente será registrado no pedido sem desconto de associado.", "muted");
    }
  } catch (error) {
    setAssociateStatus("Não foi possível validar associado agora. A venda seguirá sem desconto.", "warn");
    ehAssociado = false;
  }
  renderCarrinho();
}

async function carregarNotificacoes() {
  if (!pdvNotifList) return;
  try {
    pdvNotifications = filterUnreadNotifications(await apiGet("/api/v1/pdv/notifications"));
    const itens = pdvNotifications;
    pdvNotifBtn?.querySelector(".dot")?.classList.toggle("hidden", !itens.length);
    if (!itens.length) {
      pdvNotifList.innerHTML = `<li class="info"><i class="fa-solid fa-circle-info"></i><div>Sem notificações no momento.<time>Agora</time></div></li>`;
      return;
    }
    pdvNotifList.innerHTML = itens.map(item => `
      <li class="${item.type}">
        <i class="fa-solid ${item.icon}"></i>
        <div>${item.text}<time>${item.time}</time></div>
      </li>
    `).join("");
  } catch (error) {
    pdvNotifList.innerHTML = `<li class="warn"><i class="fa-solid fa-triangle-exclamation"></i><div>Não foi possível carregar as notificações.<time>Sistema</time></div></li>`;
  }
}

function renderCheckoutReview() {
  if (!checkoutScreen || !checkoutItems) return;

  const items = carrinho.filter(Boolean);
  const itemCount = items.reduce((sum, item) => sum + cartItemQuantity(item), 0);
  const totals = totaisCarrinho();
  const customerName = getCustomerName();

  if (checkoutItemsCount) checkoutItemsCount.textContent = `${itemCount} ${itemCount === 1 ? "item" : "itens"}`;
  if (checkoutCustomer) checkoutCustomer.textContent = customerName;
  if (checkoutAssociate) checkoutAssociate.textContent = ehAssociado ? "Sim, desconto aplicado" : "Não";
  if (checkoutPayment) checkoutPayment.textContent = paymentLabel(pagamentoAtual);
  if (checkoutSubtotal) checkoutSubtotal.textContent = money(totals.totalBruto);
  if (checkoutDiscount) checkoutDiscount.textContent = `-${money(totals.desconto)}`;
  if (checkoutTotal) checkoutTotal.textContent = money(totals.totalLiquido);

  checkoutItems.replaceChildren();
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const quantity = cartItemQuantity(item);
    const price = cartItemPrice(item);
    const row = document.createElement("article");
    row.className = "checkout-item";

    const imageWrap = document.createElement("div");
    imageWrap.className = "checkout-item-image";
    const image = document.createElement("img");
    image.src = produtoImagem(item);
    image.alt = "";
    imageWrap.append(image);

    const info = document.createElement("div");
    info.className = "checkout-item-info";
    const name = document.createElement("strong");
    name.textContent = cartItemName(item);
    const meta = document.createElement("span");
    meta.textContent = `${quantity} x ${money(price)}`;
    info.append(name, meta);

    const total = document.createElement("strong");
    total.className = "checkout-item-total";
    total.textContent = money(price * quantity);

    row.append(imageWrap, info, total);
    fragment.append(row);
  });
  checkoutItems.append(fragment);
}

async function abrirCheckout() {
  if (!carrinho.length) {
    toast("O carrinho esta vazio.", "warn");
    return;
  }

  if (!validateCustomerName({ focus: true })) return;
  await validarAssociado();

  renderCheckoutReview();
  checkoutScreen?.classList.remove("hidden");
  document.body.classList.add("checkout-open");
  checkoutScreen?.scrollTo({ top: 0, behavior: "smooth" });
}

function fecharCheckout() {
  if (!checkoutScreen || checkoutScreen.classList.contains("hidden")) {
    document.body.classList.remove("checkout-open");
    return;
  }

  checkoutScreen.classList.add("checkout-closing");
  window.setTimeout(() => {
    checkoutScreen.classList.add("hidden");
    checkoutScreen.classList.remove("checkout-closing");
    document.body.classList.remove("checkout-open");
  }, 240);
}

function abrirConfirmacaoCompra() {
  if (!validateCustomerName({ focus: true })) return;

  if (confirmPurchaseModal?._closeTimer) window.clearTimeout(confirmPurchaseModal._closeTimer);
  confirmPurchaseModal?.classList.remove("hidden", "modal-closing");
}

function fecharConfirmacaoCompra() {
  if (!confirmPurchaseModal || confirmPurchaseModal.classList.contains("hidden")) return;

  confirmPurchaseModal.classList.add("modal-closing");
  if (confirmPurchaseModal._closeTimer) window.clearTimeout(confirmPurchaseModal._closeTimer);
  confirmPurchaseModal._closeTimer = window.setTimeout(() => {
    confirmPurchaseModal.classList.add("hidden");
    confirmPurchaseModal.classList.remove("modal-closing");
    confirmPurchaseModal._closeTimer = null;
  }, 180);
}

function emitirNotaPreview() {
  renderCheckoutReview();
  window.print();
}

function abrirPopover(popover, trigger) {
  if (!popover) return;
  if (popover._closeTimer) window.clearTimeout(popover._closeTimer);
  popover.classList.remove("hidden", "popover-closing");
  trigger?.setAttribute("aria-expanded", "true");
}

function fecharPopover(popover, trigger) {
  if (!popover || popover.classList.contains("hidden")) {
    trigger?.setAttribute("aria-expanded", "false");
    return;
  }

  popover.classList.add("popover-closing");
  trigger?.setAttribute("aria-expanded", "false");
  if (popover._closeTimer) window.clearTimeout(popover._closeTimer);
  popover._closeTimer = window.setTimeout(() => {
    popover.classList.add("hidden");
    popover.classList.remove("popover-closing");
    popover._closeTimer = null;
  }, 180);
}

function alternarPopover(popover, trigger, otherPopover, otherTrigger) {
  const willOpen = popover?.classList.contains("hidden") || popover?.classList.contains("popover-closing");
  fecharPopover(otherPopover, otherTrigger);

  if (willOpen) abrirPopover(popover, trigger);
  else fecharPopover(popover, trigger);
}

function mostrarCompraFinalizada(venda, customerName = "Cliente balcão") {
  const comprador = venda?.customerName || customerName || "Cliente balcão";
  confirmPurchaseModal?.classList.add("hidden");
  confirmPurchaseModal?.classList.remove("modal-closing");
  checkoutSuccess?.classList.add("hidden");
  document.body.classList.add("checkout-returning");
  checkoutScreen?.classList.add("checkout-complete-closing");

  window.setTimeout(() => {
    checkoutScreen?.classList.add("hidden");
    checkoutScreen?.classList.remove("checkout-complete-closing");
    document.body.classList.remove("checkout-open", "checkout-returning");
    toast(`Nova venda registrada para ${comprador}.`, "success");
  }, 620);
}

async function confirmarPedido() {
  if (!carrinho.length) {
    fecharConfirmacaoCompra();
    fecharCheckout();
    toast("O carrinho esta vazio.", "warn");
    return;
  }

  if (!validateCustomerName({ focus: true })) {
    fecharConfirmacaoCompra();
    return;
  }

  btnFecharPedido.disabled = true;
  btnFecharPedido.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Processando</span>`;
  if (checkoutConfirmBtn) checkoutConfirmBtn.disabled = true;
  if (confirmPurchaseYes) {
    confirmPurchaseYes.disabled = true;
    confirmPurchaseYes.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Finalizando</span>`;
  }

  try {
    const salePayload = buildSalePayload();
    const customerName = salePayload.customerName;
    const venda = await apiPost("/api/v1/pdv/sales", salePayload);

    carrinho = [];
    ehAssociado = false;
    associadoValidado = null;
    if (customerNameInput) customerNameInput.value = "";
    setAssociateStatus("Se o cliente for associado, o desconto será aplicado automaticamente.", "muted");
    salvarCarrinho();
    await carregarDados();
    await carregarNotificacoes();
    renderCarrinho();
    mostrarCompraFinalizada(venda, customerName);
  } catch (error) {
    toast(error.message || "Nao foi possivel fechar a venda.", "error");
  } finally {
    btnFecharPedido.disabled = false;
    btnFecharPedido.innerHTML = `<i class="fa-solid fa-file-invoice-dollar"></i><span>Fechar Pedido</span>`;
    if (checkoutConfirmBtn) checkoutConfirmBtn.disabled = false;
    if (confirmPurchaseYes) {
      confirmPurchaseYes.disabled = false;
      confirmPurchaseYes.innerHTML = `<i class="fa-solid fa-lock"></i><span>Sim, finalizar</span>`;
    }
  }
}

async function carregarDados() {
  const [cats, prods] = await Promise.all([
    apiGet("/api/v1/pdv/categories"),
    apiGet("/api/v1/pdv/sale/products")
  ]);
  categorias = cats;
  produtos = prods;
  normalizarCarrinho();
  renderCategorias();
  renderProdutos();
  renderCarrinho();
}

function bindEventos() {
  function applySavedTheme() {
    const storedTheme = localStorage.getItem("aapm_theme");
    if (storedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      return;
    }
    document.documentElement.removeAttribute("data-theme");
  }

  function setStoredTheme(theme) {
    localStorage.setItem("aapm_theme", theme);
  }

  function syncThemeIcon() {
    const icon = themeToggle?.querySelector("i");
    if (!icon) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    themeToggle?.setAttribute("aria-pressed", String(isDark));
    themeToggle?.setAttribute("title", isDark ? "Alternar para tema claro" : "Alternar para tema escuro");
  }

  function setSidebarCollapsed(collapsed, persist = true) {
    if (!pdvShell || !sidebarCollapse) return;
    pdvShell.classList.toggle("sidebar-collapsed", collapsed);
    document.body.classList.toggle("pdv-sidebar-collapsed", collapsed);
    sidebarCollapse.setAttribute("aria-expanded", String(!collapsed));
    sidebarCollapse.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
    const icon = sidebarCollapse.querySelector("i");
    if (icon) icon.className = collapsed ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-left";
    if (persist) localStorage.setItem("aapm_pdv_sidebar_collapsed", collapsed ? "1" : "0");
  }

  setSidebarCollapsed(localStorage.getItem("aapm_pdv_sidebar_collapsed") === "1", false);
  applySavedTheme();
  syncThemeIcon();

  mobileSidebarToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });

  sidebarCollapse?.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 992px)").matches) {
      sidebar?.classList.remove("open");
      return;
    }

    setSidebarCollapsed(!pdvShell?.classList.contains("sidebar-collapsed"));
  });

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
  });

  pdvNotifBtn?.addEventListener("click", event => {
    event.stopPropagation();
    alternarPopover(pdvNotifTray, pdvNotifBtn, pdvProfileTray, pdvProfileChip);
  });

  pdvNotifTray?.addEventListener("click", event => {
    event.stopPropagation();
  });
  pdvMarkNotifRead?.addEventListener("click", event => {
    event.preventDefault();
    const read = getReadNotificationKeys();
    pdvNotifications.forEach(item => read.add(notificationKey(item)));
    setReadNotificationKeys(read);
    pdvNotifications = [];
    if (pdvNotifList) {
      pdvNotifList.innerHTML = `<li class="info"><i class="fa-solid fa-circle-info"></i><div>Sem notificações no momento.<time>Agora</time></div></li>`;
    }
    pdvNotifBtn?.querySelector(".dot")?.classList.add("hidden");
    toast("Notificacoes marcadas como lidas.", "success");
  });

  pdvProfileChip?.addEventListener("click", event => {
    event.stopPropagation();
    alternarPopover(pdvProfileTray, pdvProfileChip, pdvNotifTray, pdvNotifBtn);
  });

  pdvProfileTray?.addEventListener("click", event => {
    event.stopPropagation();
  });

  pdvLogoutBtn?.addEventListener("click", () => {
    window.location.href = "/auth/logout";
  });

  document.addEventListener("click", () => {
    fecharPopover(pdvProfileTray, pdvProfileChip);
    fecharPopover(pdvNotifTray, pdvNotifBtn);
  });

  searchInput?.addEventListener("input", event => {
    termoBusca = event.target.value.trim();
    page = 1;
    renderProdutos();
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput?.focus();
    }
  });

  prevPage?.addEventListener("click", () => {
    page = Math.max(1, page - 1);
    renderProdutos();
  });

  nextPage?.addEventListener("click", () => {
    page += 1;
    renderProdutos();
  });

  customerNameInput?.addEventListener("input", () => {
    window.clearTimeout(associateLookupTimer);
    setCustomerFieldInvalid(false);
    associateLookupTimer = window.setTimeout(validarAssociado, 450);
  });

  customerNameInput?.addEventListener("blur", validarAssociado);

  btnToggleAssociado?.addEventListener("click", () => {
    if (!ehAssociado) {
      toast("O desconto só é liberado para associado cadastrado e ativo.", "warn");
    }
  });

  paymentOptions?.querySelectorAll("[data-payment]").forEach(button => {
    button.addEventListener("click", () => {
      paymentOptions.querySelectorAll("[data-payment]").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      pagamentoAtual = button.dataset.payment;
      if (!checkoutScreen?.classList.contains("hidden")) renderCheckoutReview();
    });
  });

  btnFecharPedido?.addEventListener("click", abrirCheckout);
  checkoutBackBtn?.addEventListener("click", fecharCheckout);
  checkoutCancelBtn?.addEventListener("click", fecharCheckout);
  checkoutPrintBtn?.addEventListener("click", emitirNotaPreview);
  checkoutConfirmBtn?.addEventListener("click", abrirConfirmacaoCompra);
  confirmPurchaseNo?.addEventListener("click", fecharConfirmacaoCompra);
  confirmPurchaseYes?.addEventListener("click", confirmarPedido);
  confirmPurchaseModal?.addEventListener("click", event => {
    if (event.target === confirmPurchaseModal) fecharConfirmacaoCompra();
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!confirmPurchaseModal?.classList.contains("hidden")) {
      fecharConfirmacaoCompra();
      return;
    }
    if (!checkoutScreen?.classList.contains("hidden")) {
      fecharCheckout();
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEventos();
  renderCarrinho();
  setupMotionObserver();

  try {
    await carregarDados();
    await carregarNotificacoes();
  } catch (error) {
    toast("Nao foi possivel carregar o ponto de venda.", "error");
  }
});
