const canvas = document.getElementById("particles");
const ctx = canvas?.getContext("2d");

if (canvas && ctx) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let particles = [];

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 3 + 1;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.color = Math.random() > 0.5 ? "rgba(58,92,233,.25)" : "rgba(245,138,31,.25)";
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
      if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  function initParticles() {
    particles = Array.from({ length: 60 }, () => new Particle());
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(particle => {
      particle.update();
      particle.draw();
    });
    requestAnimationFrame(animateParticles);
  }

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
  });

  initParticles();
  animateParticles();
}

const API_BASE = window.location.origin;
const MIN_STOCK = 5;
const DISCOUNT = 0.10;
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const productsGrid = document.getElementById("productsGrid");
const categoryButtons = document.getElementById("categoryButtons");
const cartItemsContainer = document.getElementById("cartItems");
const cartTotalElement = document.getElementById("cartTotal");
const cartDiscountElement = document.getElementById("cartDiscount");
const searchInput = document.getElementById("searchInput");
const btnToggleAssociado = document.getElementById("btnToggleAssociado");
const btnFecharPedido = document.getElementById("btnFecharPedido");
const paymentOptions = document.getElementById("paymentOptions");
const categoryTitle = document.getElementById("categoryName");
const productCount = document.querySelector(".product-count");
const resultCount = document.getElementById("resultCount");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageNumbers = document.getElementById("pageNumbers");

let produtos = [];
let categorias = [];
let carrinho = JSON.parse(localStorage.getItem("carrinho_aapm_pdv") || "[]");
let categoriaAtual = "todos";
let termoBusca = "";
let ehAssociado = false;
let pagamentoAtual = "pix";
let page = 1;
const perPage = 8;

function money(value) {
  return BRL.format(Number(value) || 0);
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
  item.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
  wrap.appendChild(item);
  setTimeout(() => {
    item.classList.add("leaving");
    setTimeout(() => item.remove(), 250);
  }, 2800);
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}`);
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
    throw new Error(data.detail || `POST ${path} -> ${response.status}`);
  }
  return response.json();
}

function produtoDisponivel(produto) {
  return Math.max(0, (Number(produto.stock) || 0) - MIN_STOCK);
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
      const produto = produtos.find(p => p.id === item.id);
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
    <button class="cat-btn" data-category="${categoria.id}">
      <i class="fa-solid ${categoria.icon || "fa-box"}"></i>
      <span>${categoria.name} <em class="cat-count" data-category="${categoria.id}">(0)</em></span>
    </button>
  `).join("");

  document.querySelectorAll(".cat-btn").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".cat-btn").forEach(item => item.classList.remove("cat-active"));
      button.classList.add("cat-active");
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
        <article class="card">
          <div class="card-image">
            <img src="${produtoImagem(produto)}" alt="${produto.name}">
          </div>
          <div class="card-content">
            <div>
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
  const produto = produtos.find(p => p.id === idProduto);
  if (!produto) return;

  const item = carrinho.find(row => row.id === idProduto);
  const novaQuantidade = (item?.quantidade || 0) + 1;
  if (novaQuantidade > produtoDisponivel(produto)) {
    toast("Estoque insuficiente para manter a reserva minima de 5 unidades.", "warn");
    return;
  }

  if (item) item.quantidade = novaQuantidade;
  else carrinho.push({ ...produto, quantidade: 1 });

  salvarCarrinho();
  renderCarrinho();
}

function alterarQuantidade(idProduto, delta) {
  const item = carrinho.find(row => row.id === idProduto);
  const produto = produtos.find(p => p.id === idProduto);
  if (!item || !produto) return;

  const novaQuantidade = item.quantidade + delta;
  if (novaQuantidade <= 0) {
    carrinho = carrinho.filter(row => row.id !== idProduto);
  } else if (novaQuantidade <= produtoDisponivel(produto)) {
    item.quantidade = novaQuantidade;
  } else {
    toast("Quantidade maior que o estoque disponivel para venda.", "warn");
  }

  salvarCarrinho();
  renderCarrinho();
}

function removerDoCarrinho(idProduto) {
  carrinho = carrinho.filter(row => row.id !== idProduto);
  salvarCarrinho();
  renderCarrinho();
}

function totaisCarrinho() {
  const totalBruto = carrinho.reduce((sum, item) => sum + item.price * item.quantidade, 0);
  const desconto = ehAssociado ? totalBruto * DISCOUNT : 0;
  return { totalBruto, desconto, totalLiquido: totalBruto - desconto };
}

function renderCarrinho() {
  if (!cartItemsContainer) return;

  if (!carrinho.length) {
    cartItemsContainer.innerHTML = `<p class="cart-empty">Nenhum item no carrinho.</p>`;
  } else {
    cartItemsContainer.innerHTML = carrinho.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <span class="cart-item-name">${item.name}</span>
          <small>${money(item.price)} un.</small>
          <div class="qty-control">
            <button type="button" data-qty="${item.id}" data-delta="-1">-</button>
            <span>${item.quantidade}</span>
            <button type="button" data-qty="${item.id}" data-delta="1">+</button>
          </div>
        </div>
        <div class="cart-item-side">
          <button class="cart-item-remove" type="button" data-remove="${item.id}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
          <strong>${money(item.price * item.quantidade)}</strong>
        </div>
      </div>
    `).join("");
  }

  cartItemsContainer.querySelectorAll("[data-qty]").forEach(button => {
    button.addEventListener("click", () => alterarQuantidade(button.dataset.qty, Number(button.dataset.delta)));
  });
  cartItemsContainer.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => removerDoCarrinho(button.dataset.remove));
  });

  const totals = totaisCarrinho();
  if (cartDiscountElement) {
    cartDiscountElement.textContent = `-${money(totals.desconto)}`;
    cartDiscountElement.style.color = totals.desconto > 0 ? "var(--green)" : "var(--text-soft)";
  }
  if (cartTotalElement) cartTotalElement.textContent = money(totals.totalLiquido);

  if (btnToggleAssociado) {
    const icon = btnToggleAssociado.querySelector("i");
    btnToggleAssociado.classList.toggle("active", ehAssociado);
    if (icon) icon.className = ehAssociado ? "fa-solid fa-circle-check" : "fa-regular fa-circle";
  }
}

async function fecharPedido() {
  if (!carrinho.length) {
    toast("O carrinho esta vazio.", "warn");
    return;
  }

  btnFecharPedido.disabled = true;
  btnFecharPedido.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processando`;

  try {
    const venda = await apiPost("/api/v1/pdv/sales", {
      pagamento: pagamentoAtual,
      associado: ehAssociado,
      itens: carrinho.map(item => ({
        produto_id: Number(item.id),
        quantidade: item.quantidade
      }))
    });

    carrinho = [];
    ehAssociado = false;
    salvarCarrinho();
    await carregarDados();
    renderCarrinho();
    toast(`Venda ${venda.number} finalizada com sucesso.`, "success");
  } catch (error) {
    toast(error.message || "Nao foi possivel fechar a venda.", "error");
  } finally {
    btnFecharPedido.disabled = false;
    btnFecharPedido.innerHTML = `<i class="fa-solid fa-file-invoice-dollar"></i> Fechar Pedido`;
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
}

function bindEventos() {
  searchInput?.addEventListener("input", event => {
    termoBusca = event.target.value.trim();
    page = 1;
    renderProdutos();
  });

  prevPage?.addEventListener("click", () => {
    page = Math.max(1, page - 1);
    renderProdutos();
  });

  nextPage?.addEventListener("click", () => {
    page += 1;
    renderProdutos();
  });

  btnToggleAssociado?.addEventListener("click", () => {
    ehAssociado = !ehAssociado;
    renderCarrinho();
  });

  paymentOptions?.querySelectorAll("[data-payment]").forEach(button => {
    button.addEventListener("click", () => {
      paymentOptions.querySelectorAll("[data-payment]").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      pagamentoAtual = button.dataset.payment;
    });
  });

  btnFecharPedido?.addEventListener("click", fecharPedido);
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEventos();
  renderCarrinho();

  try {
    await carregarDados();
  } catch (error) {
    toast("Nao foi possivel carregar o ponto de venda.", "error");
  }
});
