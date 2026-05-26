particlesJS("particles-js", {
  "particles": {
    "number": {
      "value": 60, 
      "density": {
        "enable": true,
        "value_area": 800
      }
    },
    "color": {
      "value": "#3858d6" 
    },
    "shape": {
      "type": "circle"
    },
    "opacity": {
      "value": 0.4, 
      "random": true
    },
    "size": {
      "value": 4,
      "random": true
    },
    "line_linked": {
      "enable": true,
      "distance": 150,
      "color": "#3858d6",
      "opacity": 0.2,
      "width": 1
    },
    "move": {
      "enable": true,
      "speed": 2,
      "direction": "none",
      "random": false,
      "straight": false,
      "out_mode": "out",
      "bounce": false
    }
  },
  "interactivity": {
    "detect_on": "canvas",
    "events": {
      "onhover": {
        "enable": true,
        "mode": "grab" 
      },
      "onclick": {
        "enable": true,
        "mode": "push" 
      },
      "resize": true
    }
  },
  "retina_detect": true
});


const PRODUCTS_DATA = [
    { 
        id: 1, 
        name: "Borracha Escolar", 
        description: "Borracha macia de alta qualidade", 
        price: 2.90, 
        category: "materiais-escolares", 
        image: "/apps/pvd/assets/materiais/Borracha Pequena.png", 
        rating: 5, 
        popular: false 
    },
    { 
        id: 2, 
        name: "Apontador Duplo", 
        description: "Apontador com dois tamanhos", 
        price: 5.45, 
        category: "materiais-escolares", 
        image:"/apps/pvd/assets/materiais/Apontador De Lápis.png", 
        rating: 5, 
        popular: false 
    },
    { 
        id: 3, 
        name: "Lápis de Cor 12 Cores", 
        description: "Caixa com 12 cores vibrantes", 
        price: 5.90, 
        category: "materiais-escolares", 
        image:"/apps/pvd/assets/materiais/Lápis de cor Faber-Castell.png",
        rating: 5, 
        popular: false 
    },
    { 
        id: 4, 
        name: "Caderno Universitário 200 Folhas", 
        description: "Caderno espiral com 10 matérias", 
        price: 24.90, 
        category: "materiais-escolares", 
        image:"/apps/pvd/assets/materiais/cadernoazul.png",
        rating: 5, 
        popular: true 
    },
    { 
        id: 5, 
        name: "Caneta Esferográfica Azul", 
        description: "Pacote com 5 canetas", 
        price: 3.50, 
        category: "materiais-escolares", 
        image:"/apps/pvd/assets/materiais/caneta azul.png",
        rating: 5, 
        popular: false 
    },
    { 
        id: 6, 
        name: "Régua de 30cm", 
        description: "Kit de réguas", 
        price: 10.90, 
        category: "materiais-escolares", 
        image:"/apps/pvd/assets/materiais/Réguas.png",
        rating: 5, 
        popular: true 
    },
    { 
        id: 7, 
        name: "Camiseta Branca Senai", 
        description: "Camiseta de malha 100% algodão", 
        price: 35.00, 
        category: "uniformes", 
        image: "/apps/pvd/assets/uniformes/uniforme_senai.png", 
        rating: 4, 
        popular: false 
    },
    { 
        id: 8, 
        name: "Calça Senai", 
        description: "Calça social preta", 
        price: 55.00, 
        category: "uniformes", 
        image: "/apps/pvd/assets/uniformes/calca_senai.png", 
        rating: 4, 
        popular: false 
    },
    { 
        id: 9, 
        name: "Tecido TNT Branco", 
        description: "Rolo com 50 metros", 
        price: 78.00, 
        category: "materiais-texteis", 
        image: "/apps/pvd/assets/materiais_texteis/tecido_tnt.png", 
        rating: 5, 
        popular: false 
    },
    { 
        id: 10, 
        name: "Linha de Costura", 
        description: "Carretel 500m", 
        price: 8.50, 
        category: "materiais-texteis", 
        image: "/apps/pvd/assets/materiais_texteis/linha_costura.png", 
        rating: 5, 
        popular: false 
    },
    { 
        id: 11, 
        name: "Alicate Universal", 
        description: "Alicate profissional 8 polegadas", 
        price: 32.90, 
        category: "ferramentas", 
        image: "/apps/pvd/assets/ferramentas/alicate_universal.png", 
        rating: 5, 
        popular: false 
    },
    { 
        id: 12, 
        name: "Chave de Fenda Kit", 
        description: "Kit com 6 chaves", 
        price: 28.50, 
        category: "ferramentas", 
        image: "/apps/pvd/assets/ferramentas/chave_fenda.png", 
        rating: 4, 
        popular: false 
    }
];

const CATEGORIES = {
    "materiais-escolares": { name: "Materiais Escolares", count: 84 },
    "uniformes": { name: "Uniformes", count: 23 },
    "materiais-texteis": { name: "Materiais Têxteis", count: 42 },
    "ferramentas": { name: "Ferramentas", count: 19 }
};

let state = {
    selectedCategory: "materiais-escolares",
    searchQuery: "",
    currentPage: 1,
    itemsPerPage: 6,
    cart: []
};

function formatPrice(price) {
    return `R$ ${price.toFixed(2).replace('.', ',')}`;
}

function getFilteredProducts() {
    return PRODUCTS_DATA.filter(product => {
        const matchesCategory = product.category === state.selectedCategory;
        const matchesSearch = product.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                            product.description.toLowerCase().includes(state.searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });
}

function getPaginatedProducts() {
    const filtered = getFilteredProducts();
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    return filtered.slice(startIndex, startIndex + state.itemsPerPage);
}

function calculateCartTotal() {
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = total * 0.05;
    return { total, discount, final: total - discount };
}

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    const products = getPaginatedProducts();
    
    grid.innerHTML = products.map(product => `
        <div class="card" data-product-id="${product.id}">
            ${product.popular ? '<span class="badge-popular">Popular</span>' : ''}
            <div class="card-image">
                <img src="${product.image}" alt="${product.name}" loading="lazy">
            </div>
            <div class="card-content">
                <h2 class="card-title">${product.name}</h2>
                <p class="card-description">${product.description}</p>
                <div class="stars">
                    ${[...Array(5)].map((_, i) => 
                        `<i class="fa-solid fa-star${i < product.rating ? '' : ' text-gray-300'}"></i>`
                    ).join('')}
                </div>
                <div class="price">${formatPrice(product.price)}</div>
                <button class="card-button" onclick="addToCart(${product.id})">
                    <i class="fa-solid fa-cart-shopping"></i>
                    Adicionar ao Carrinho
                </button>
            </div>
        </div>
    `).join('');
}

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    const { total, discount, final } = calculateCartTotal();
    
    cartItems.innerHTML = state.cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-img">
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="cart-item-info">
                <span class="cart-item-name">${item.name}</span>
                <span class="cart-item-qty">Qtd: ${item.quantity}</span>
            </div>
            <span class="cart-item-price">${formatPrice(item.price)}</span>
            <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
    
    document.getElementById('cartTotal').textContent = formatPrice(final);
    document.getElementById('cartDiscount').textContent = `-${formatPrice(discount)}`;
}

function renderPagination() {
    const filtered = getFilteredProducts();
    const totalPages = Math.ceil(filtered.length / state.itemsPerPage);
    const pageNumbers = document.getElementById('pageNumbers');
    
    pageNumbers.innerHTML = [...Array(totalPages)].map((_, i) => {
        const pageNum = i + 1;
        return `<button class="page-num ${state.currentPage === pageNum ? 'active' : ''}" 
                        onclick="goToPage(${pageNum})">${pageNum}</button>`;
    }).join('');
    
    const startIndex = (state.currentPage - 1) * state.itemsPerPage + 1;
    const endIndex = Math.min(state.currentPage * state.itemsPerPage, filtered.length);
    document.getElementById('resultCount').textContent = `${startIndex}-${endIndex} de ${filtered.length} resultados`;
    
    document.getElementById('prevPage').disabled = state.currentPage === 1;
    document.getElementById('nextPage').disabled = state.currentPage === totalPages || totalPages === 0;
    
    document.querySelector('.product-count').textContent = `(${filtered.length})`;
}

function addToCart(productId) {
    const product = PRODUCTS_DATA.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = state.cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            image: product.image
        });
    }
    
    renderCart();
    
    const button = event.target.closest('.card-button');
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fa-solid fa-check"></i> Adicionado!';
    button.style.backgroundColor = '#22c55e';
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.backgroundColor = '';
    }, 1500);
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    renderCart();
}

function changeCategory(category) {
    state.selectedCategory = category;
    state.currentPage = 1;
    
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.toggle('cat-active', btn.dataset.category === category);
    });
    
    document.getElementById('categoryName').textContent = CATEGORIES[category].name;
    
    renderProducts();
    renderPagination();
}

function searchProducts(query) {
    state.searchQuery = query;
    state.currentPage = 1;
    renderProducts();
    renderPagination();
}

function goToPage(page) {
    state.currentPage = page;
    renderProducts();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function previousPage() {
    if (state.currentPage > 1) {
        goToPage(state.currentPage - 1);
    }
}

function nextPage() {
    const totalPages = Math.ceil(getFilteredProducts().length / state.itemsPerPage);
    if (state.currentPage < totalPages) {
        goToPage(state.currentPage + 1);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateSidebarCounts(); 
    
    renderProducts();
    renderCart();
    renderPagination();

    renderProducts();
    renderCart();
    renderPagination();
    
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchProducts(e.target.value);
    });
    
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            changeCategory(btn.dataset.category);
        });
    });
    
    document.getElementById('prevPage').addEventListener('click', previousPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);
    
    document.querySelector('.btn-close-order').addEventListener('click', () => {
        alert('Função "Fechar Pedido" será implementada em breve!');
    });
    
    document.querySelector('.btn-view-cart').addEventListener('click', () => {
        alert('Função "Ver Carrinho" será implementada em breve!');
    });
});

function updateSidebarCounts() {
    // 1. Cria um objeto para armazenar a contagem de cada categoria
    const counts = {
        "materiais-escolares": 0,
        "uniformes": 0,
        "materiais-texteis": 0,
        "ferramentas": 0
    };

    // 2. Contabiliza os itens existentes no seu PRODUCTS_DATA
    PRODUCTS_DATA.forEach(product => {
        if (counts[product.category] !== undefined) {
            counts[product.category]++;
        }
    });

    // 3. Atualiza o HTML de cada contador na barra lateral
    document.querySelectorAll('.cat-count').forEach(em => {
        const cat = em.dataset.category;
        if (counts[cat] !== undefined) {
            em.textContent = `(${counts[cat]})`;
        }
    });
}