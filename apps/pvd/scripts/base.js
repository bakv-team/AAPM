// ==========================================
// 1. MAPEAMENTO DE ELEMENTOS DO DOM
// ==========================================
const modal = document.getElementById('modalCadastro');
const btnAbrirModal = document.getElementById('btnAbrirModal');
const btnFecharModal = document.getElementById('btnFecharModal');
const formCadastro = document.getElementById('formCadastro');
const productsGrid = document.getElementById('productsGrid');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalElement = document.getElementById('cartTotal');
const cartDiscountElement = document.getElementById('cartDiscount'); 
const searchInput = document.getElementById('searchInput');

// Seleção dos botões do Carrinho
const btnToggleAssociado = document.getElementById('btnToggleAssociado');
const btnFecharPedido = document.getElementById('btnFecharPedido');

// ==========================================
// 2. ESTADO DA APLICAÇÃO (DADOS)
// ==========================================
let produtos = JSON.parse(localStorage.getItem('produtos_aapm')) || [];
let carrinho = JSON.parse(localStorage.getItem('carrinho_aapm')) || [];
let ehAssociado = false; // Começa sempre desligado (cliente comum)
const TAXA_DESCONTO = 0.10; // 10% de desconto global
let categoriaAtual = 'todos';

// ==========================================
// 3. CONTROLE DO MODAL DE CADASTRO
// ==========================================
if (btnAbrirModal) btnAbrirModal.addEventListener('click', () => modal.style.display = 'flex');
if (btnFecharModal) btnFecharModal.addEventListener('click', () => modal.style.display = 'none');

// ==========================================
// 4. CADASTRO DE NOVOS PRODUTOS
// ==========================================
if (formCadastro) {
    formCadastro.addEventListener('submit', (e) => {
        e.preventDefault();

        const novoProduto = {
            id: Date.now().toString(), 
            nome: document.getElementById('prodNome').value,
            preco: parseFloat(document.getElementById('prodPreco').value),
            categoria: document.getElementById('prodCategoria').value,
            imagem: document.getElementById('prodImagem').value || 'https://via.placeholder.com/150'
        };

        produtos.push(novoProduto);
        localStorage.setItem('produtos_aapm', JSON.stringify(produtos));

        formCadastro.reset();
        modal.style.display = 'none';
        
        filtrarEVisualizarVitrine();
        atualizarContadoresCategorias();
    });
}

// ==========================================
// 5. RENDERIZAR PRODUTOS NA VITRINE
// ==========================================
function exibirProdutosNaVitrine(listaDeProdutos) {
    if (!productsGrid) return;
    productsGrid.innerHTML = '';

    if (listaDeProdutos.length === 0) {
        productsGrid.innerHTML = '<p style="color:#666; grid-column: 1/-1; text-align:center; padding: 40px 0;">Nenhum produto encontrado.</p>';
        const countVisual = document.querySelector('.product-count');
        if (countVisual) countVisual.innerText = '(0)';
        return;
    }

    listaDeProdutos.forEach(produto => {
        const card = document.createElement('div');
        card.classList.add('card'); 

        card.innerHTML = `
            <div class="card-image">
                <img src="${produto.imagem}" alt="${produto.nome}">
            </div>
            <div class="card-content">
                <h3 class="card-title">${produto.nome}</h3>
                <p class="price">R$ ${produto.preco.toFixed(2).replace('.', ',')}</p>
                <button class="card-button" onclick="adicionarAoCarrinho('${produto.id}')">
                    <i class="fa-solid fa-cart-plus"></i> Adicionar
                </button>
            </div>
        `;
        productsGrid.appendChild(card);
    });

    const countVisual = document.querySelector('.product-count');
    if (countVisual) countVisual.innerText = `(${listaDeProdutos.length})`;
}

function filtrarEVisualizarVitrine() {
    const termoBusca = searchInput ? searchInput.value.toLowerCase().trim() : '';
    let resultado = produtos;
    
    if (categoriaAtual !== 'todos') {
        resultado = resultado.filter(p => p.categoria === categoriaAtual);
    }
    if (termoBusca !== '') {
        resultado = resultado.filter(p => p.nome.toLowerCase().includes(termoBusca));
    }
    exibirProdutosNaVitrine(resultado);
}

if (searchInput) {
    searchInput.addEventListener('input', filtrarEVisualizarVitrine);
}

// ==========================================
// 6. LÓGICA INTERNA DO CARRINHO DE COMPRAS
// ==========================================
window.adicionarAoCarrinho = function(idProduto) {
    const produto = produtos.find(p => p.id === idProduto);
    if (!produto) return;

    const itemNoCarrinho = carrinho.find(item => item.id === idProduto);

    if (itemNoCarrinho) {
        itemNoCarrinho.quantidade += 1; 
    } else {
        carrinho.push({ ...produto, quantidade: 1 });
    }

    salvarEAtualizarCarrinho();
};

window.alterarQuantidade = function(idProduto, mudanca) {
    const item = carrinho.find(item => item.id === idProduto);
    if (!item) return;

    item.quantidade += mudanca;

    if (item.quantidade <= 0) {
        carrinho = carrinho.filter(item => item.id !== idProduto);
    }

    salvarEAtualizarCarrinho();
};

window.removerDoCarrinho = function(idProduto) {
    carrinho = carrinho.filter(item => item.id !== idProduto);
    salvarEAtualizarCarrinho();
};

function salvarEAtualizarCarrinho() {
    localStorage.setItem('carrinho_aapm', JSON.stringify(carrinho));
    renderizarCarrinho();
}

function renderizarCarrinho() {
    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = '';

    let totalBrutoGeral = 0;

    carrinho.forEach(item => {
        const subtotalItemBruto = item.preco * item.quantidade;
        totalBrutoGeral += subtotalItemBruto;

        const cartItemHtml = document.createElement('div');
        cartItemHtml.classList.add('cart-item'); 
        
        cartItemHtml.innerHTML = `
            <div class="cart-item-info">
                <span class="cart-item-name" style="font-weight:600; font-size:14px; display:block;">${item.nome}</span>
                <small style="color:var(--text-soft); font-size:12px;">R$ ${item.preco.toFixed(2).replace('.', ',')} un.</small>
                
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                    <button onclick="alterarQuantidade('${item.id}', -1)" style="background:var(--border); border:none; width:24px; height:24px; cursor:pointer; border-radius:4px; font-weight:bold;">-</button>
                    <span style="font-weight:600; font-size:13px;">${item.quantidade}</span>
                    <button onclick="alterarQuantidade('${item.id}', 1)" style="background:var(--border); border:none; width:24px; height:24px; cursor:pointer; border-radius:4px; font-weight:bold;">+</button>
                </div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end;">
                <button class="cart-item-remove" onclick="removerDoCarrinho('${item.id}')" style="background:none; border:none; color:#dc3545; cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <span style="font-weight: 700; font-size: 14px; margin-top: 10px; color: var(--text);">
                    R$ ${subtotalItemBruto.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `;
        cartItemsContainer.appendChild(cartItemHtml);
    });

    // Cálculos matemáticos baseados no estado do botão externo
    let valorDescontoGeral = ehAssociado ? (totalBrutoGeral * TAXA_DESCONTO) : 0;
    let totalGeralLiquido = totalBrutoGeral - valorDescontoGeral;

    if (cartDiscountElement) {
        cartDiscountElement.innerText = `-R$ ${valorDescontoGeral.toFixed(2).replace('.', ',')}`;
        cartDiscountElement.style.color = valorDescontoGeral > 0 ? 'var(--green)' : 'var(--text-soft)';
    }

    if (cartTotalElement) {
        cartTotalElement.innerText = `R$ ${totalGeralLiquido.toFixed(2).replace('.', ',')}`;
    }

    // Altera as classes visuais do botão sem quebrar a lógica
    if (btnToggleAssociado) {
        const icone = btnToggleAssociado.querySelector('i');
        if (ehAssociado) {
            btnToggleAssociado.classList.add('active');
            if (icone) icone.className = 'fa-solid fa-circle-check';
        } else {
            btnToggleAssociado.classList.remove('active');
            if (icone) icone.className = 'fa-regular fa-circle';
        }
    }
}

// ==========================================
// 7. LISTENERS DO BOTÃO ASSOCIADO E FECHAMENTO
// ==========================================

// Ativa/Desativa o desconto global ao clicar no botão da AAPM
if (btnToggleAssociado) {
    btnToggleAssociado.addEventListener('click', () => {
        ehAssociado = !ehAssociado; // Alterna true / false
        renderizarCarrinho(); // Recalcula os valores na tela imediatamente
    });
}

if (btnFecharPedido) {
    btnFecharPedido.addEventListener('click', () => {
        if (carrinho.length === 0) {
            alert('O carrinho está vazio!');
            return;
        }

        const totalTexto = cartTotalElement ? cartTotalElement.innerText : 'R$ 0,00';
        let resumo = `--- RESUMO DA VENDA ---\n\n`;
        resumo += `Total Final: ${totalTexto}\n`;
        resumo += `Perfil: ${ehAssociado ? 'Associado AAPM (10% de desconto)' : 'Não Associado (Preço Integral)'}\n\n`;
        resumo += `Deseja finalizar a venda e atualizar o estoque?`;

        if (confirm(resumo)) {
            // Puxa os dados reais salvos no LocalStorage
            let bancoProdutos = JSON.parse(localStorage.getItem('produtos_aapm')) || [];

            // Reduz a quantidade baseando-se no carrinho
            carrinho.forEach(itemComprado => {
                const produtoNoBanco = bancoProdutos.find(p => p.id === itemComprado.id);
                if (produtoNoBanco) {
                    let estoqueAtual = produtoNoBanco.estoque !== undefined ? produtoNoBanco.estoque : 0;
                    produtoNoBanco.estoque = Math.max(0, estoqueAtual - itemComprado.quantidade);
                }
            });

            // Atualiza de fato o LocalStorage
            localStorage.setItem('produtos_aapm', JSON.stringify(bancoProdutos));
            
            // Atualiza a vitrine da página atual com a nova lista modificada
            produtos = bancoProdutos;

            alert('Pedido processado com sucesso! Estoque atualizado.');
            
            // Reseta carrinho e estado do desconto para a próxima venda
            carrinho = [];
            ehAssociado = false; 

            salvarEAtualizarCarrinho();
            filtrarEVisualizarVitrine();
            atualizarContadoresCategorias();
        }
    });
}

// ==========================================
// 8. FUNÇÕES AUXILIARES (CONTADORES DA SIDEBAR)
// ==========================================
function atualizarContadoresCategorias() {
    const counts = {
        'todos': produtos.length, 
        'materiais-escolares': 0,
        'uniformes': 0,
        'materiais-texteis': 0,
        'ferramentas': 0
    };

    produtos.forEach(p => {
        if (counts[p.categoria] !== undefined) counts[p.categoria]++;
    });

    Object.keys(counts).forEach(cat => {
        const el = document.querySelector(`.cat-count[data-category="${cat}"]`);
        if (el) el.innerText = `(${counts[cat]})`;
    });
}

// ==========================================
// 9. LÓGICA DE FILTRAGEM POR CATEGORIAS
// ==========================================
const botoesCategoria = document.querySelectorAll('.cat-btn');
const tituloCategoria = document.getElementById('categoryName');

botoesCategoria.forEach(botao => {
    botao.addEventListener('click', () => {
        botoesCategoria.forEach(btn => btn.classList.remove('cat-active'));
        botao.classList.add('cat-active');

        categoriaAtual = botao.getAttribute('data-category');

        const textoBotao = botao.querySelector('span').childNodes[0].textContent.trim();
        if (tituloCategoria) tituloCategoria.innerText = categoriaAtual === 'todos' ? 'Todos os Produtos' : textoBotao;

        filtrarEVisualizarVitrine();
    });
});

// ==========================================
// 10. INICIALIZAÇÃO DA PÁGINA
// ==========================================
filtrarEVisualizarVitrine();
renderizarCarrinho();
atualizarContadoresCategorias();