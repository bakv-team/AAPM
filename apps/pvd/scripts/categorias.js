// =======================================================================
// 1. EFEITO VISUAL: CANVAS DE PARTÍCULAS (ANIMAÇÃO)
// =======================================================================
const canvas = document.getElementById("particles");
if (canvas) {
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles = [];

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 3 + 1;
            this.speedX = (Math.random() - .5) * .4;
            this.speedY = (Math.random() - .5) * .4;
            this.color = Math.random() > .5 ? "rgba(58,92,233,.35)" : "rgba(245,138,31,.35)";
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((particle) => {
            particle.update();
            particle.draw();
        });
        connect();
        requestAnimationFrame(animate);
    }

    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        init();
    });

    init();
    animate();
}

// =======================================================================
// 2. FUNÇÕES E LÓGICAS COMPLEMENTARES DE PRODUTOS
// =======================================================================
let produtos = JSON.parse(localStorage.getItem('produtos_aapm')) || [];

const categoriasMock = [
    { id: "materiais-escolares", nome: "Materiais Escolares" },
    { id: "uniformes", nome: "Uniformes" },
    { id: "materiais-texteis", nome: "Materiais Têxteis" },
    { id: "ferramentas", nome: "Ferramentas" }
];

const formFiltro = document.querySelector('form[action="/produtos"]');
const inputBusca = document.querySelector('input[name="busca"]');
const selectCategoria = document.querySelector('select[name="categoria_id"]');
const tbody = document.querySelector('tbody');

function carregarCategoriasNoSelect() {
    if (!selectCategoria) return;
    selectCategoria.innerHTML = '<option value="0">Todas as categorias</option>';
    categoriasMock.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.nome;
        selectCategoria.appendChild(option);
    });
}

function injetarBotaoNovoProduto() {
    const tabela = document.querySelector('table');
    if (!tabela) return;

    const headers = document.querySelectorAll('table thead th');
    if (headers.length !== 6) return; 

    const btnNovo = document.createElement('button');
    btnNovo.innerHTML = '<i class="fa-solid fa-plus"></i> + Novo produto';
    btnNovo.style.cssText = "margin-bottom: 15px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;";
    
    btnNovo.addEventListener('click', () => {
        const nome = prompt("Nome do produto:");
        if (!nome) return;

        const preco = parseFloat(prompt("Preço do produto (Ex: 25.50):"));
        if (isNaN(preco)) return alert("Preço inválido!");

        const estoque = parseInt(prompt("Quantidade em estoque (Ex: 10):"), 10);
        if (isNaN(estoque)) return alert("Estoque inválido!");

        let msgCat = "Escolha o número da Categoria:\n";
        categoriasMock.forEach((c, index) => msgCat += `${index + 1} - ${c.nome}\n`);
        const indexCat = parseInt(prompt(msgCat)) - 1;
        
        if (indexCat < 0 || indexCat >= categoriasMock.length || isNaN(indexCat)) {
            return alert("Categoria inválida!");
        }
        const categoria_id = categoriasMock[indexCat].id;
        const imagem = prompt("URL da Imagem (Deixe em branco para usar padrão):");

        const novo = {
            id: Date.now().toString(),
            nome: nome,
            preco: preco,
            estoque: estoque || 0,
            categoria: categoria_id,
            imagem: imagem || 'https://via.placeholder.com/150'
        };

        produtos.push(novo);
        salvarDados();
        alert("Produto cadastrado com sucesso!");
        renderizarTabela();
    });

    tabela.parentNode.insertBefore(btnNovo, tabela);
}

function renderizarTabela(produtosFiltrados = produtos) {
    if (!tbody) return;
    const headers = document.querySelectorAll('table thead th');
    if (headers.length !== 6) return; 

    tbody.innerHTML = '';

    if (produtosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #777;">Nenhum produto encontrado.</td></tr>`;
        return;
    }

    produtosFiltrados.forEach(p => {
        const tr = document.createElement('tr');
        const objCategoria = categoriasMock.find(c => c.id === p.categoria);
        const nomeCategoria = objCategoria ? objCategoria.nome : "—";

        tr.innerHTML = `
            <td><img src="${p.imagem}" alt="${p.nome}" width="50" height="50" style="object-fit:cover; border-radius:4px;"></td>
            <td><a href="#" onclick="alert('Visualizando ID: ${p.id}')">${p.nome}</a></td>
            <td>${nomeCategoria}</td>
            <td>R$ ${p.preco.toFixed(2).replace('.', ',')}</td>
            <td>${p.estoque !== undefined ? p.estoque : 0}</td>
            <td>
                <button onclick="editarProduto('${p.id}')" style="margin-right: 5px; background: #ffc107; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Editar</button>
                <button onclick="desativarProduto('${p.id}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Desativar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editarProduto = function(id) {
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;

    const novoNome = prompt("Editar Nome:", prod.nome);
    if (novoNome === null) return;

    const novoPreco = parseFloat(prompt("Editar Preço:", prod.preco));
    if (isNaN(novoPreco)) return alert("Preço inválido!");

    const novoEstoque = parseInt(prompt("Editar Estoque:", prod.estoque || 0), 10);
    if (isNaN(novoEstoque)) return alert("Estoque inválido!");

    prod.nome = novoNome;
    prod.preco = novoPreco;
    prod.estoque = novoEstoque;
    prod.imagem = prompt("Editar URL da Imagem:", prod.imagem) || 'https://via.placeholder.com/150';

    salvarDados();
    alert("Produto updated!");
    renderizarTabela();
};

window.desativarProduto = function(id) {
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;
    if (confirm(`Tem certeza que deseja desativar (excluir) o produto "${prod.nome}"?`)) {
        produtos = produtos.filter(p => p.id !== id);
        salvarDados();
        renderizarTabela();
    }
};

function salvarDados() {
    localStorage.setItem('produtos_aapm', JSON.stringify(produtos));
}

if (formFiltro) {
    formFiltro.addEventListener('submit', (e) => {
        e.preventDefault();
        const termoBusca = inputBusca.value.toLowerCase().trim();
        const categoriaSelecionada = selectCategoria.value;
        const resultado = produtos.filter(p => {
            const bateBusca = p.nome.toLowerCase().includes(termoBusca);
            const bateCategoria = (categoriaSelecionada === "0" || p.categoria === categoriaSelecionada);
            return bateBusca && bateCategoria;
        });
        renderizarTabela(resultado);
    });
}

// =======================================================================
// 3. INTERAÇÃO DE TELA ÚNICA (CHAMADA DO FORMULÁRIO DE CATEGORIA)
// =======================================================================
document.addEventListener('DOMContentLoaded', () => {
    carregarCategoriasNoSelect();
    injetarBotaoNovoProduto();
    renderizarTabela();

    const listaSection = document.getElementById('lista-categorias-section');
    const formSection = document.getElementById('form-categoria-section');
    const formTitulo = document.getElementById('form-titulo');
    const form = document.getElementById('categoria-form');
    const inputNome = document.getElementById('input-nome-categoria');
    const btnSubmit = document.getElementById('btn-submit-form');
    
    const btnNovaCategoria = document.getElementById('btn-nova-categoria');
    const btnsEditarCategoria = document.querySelectorAll('.btn-editar-js');
    const btnCancelarForm = document.getElementById('btn-cancelar-form');

    // Transição para Nova Categoria
    if (btnNovaCategoria) {
        btnNovaCategoria.addEventListener('click', (e) => {
            e.preventDefault(); 
            formTitulo.textContent = "Nova categoria";
            btnSubmit.textContent = "Criar categoria";
            form.action = "/categorias/nova"; 
            inputNome.value = ""; 
            
            listaSection.classList.add('hidden'); 
            formSection.classList.remove('hidden'); 
            inputNome.focus();
        });
    }

    // Transição para Editar Categoria preenchendo os dados vindos do backend
    btnsEditarCategoria.forEach(botao => {
        botao.addEventListener('click', (e) => {
            const btnAtual = e.currentTarget;
            const idCategoria = btnAtual.getAttribute('data-id');
            const nomeCategoria = btnAtual.getAttribute('data-name') || btnAtual.getAttribute('data-nome');

            formTitulo.textContent = "Editar categoria";
            btnSubmit.textContent = "Salvar alterações";
            
            form.action = `/categorias/${idCategoria}/editar`; 
            inputNome.value = nomeCategoria || ""; 

            listaSection.classList.add('hidden'); 
            formSection.classList.remove('hidden'); 
            inputNome.focus();
        });
    });

    // Cancelar operação e retornar à listagem limpa
    if (btnCancelarForm) {
        btnCancelarForm.addEventListener('click', () => {
            formSection.classList.add('hidden');
            listaSection.classList.remove('hidden');
            inputNome.value = "";
        });
    }

    console.log("Painel de Controle carregado com sucesso.");
});