const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];

// 1. A ESTRUTURA DE CADA PARTÍCULA
class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 3 + 1;
    this.speedX = (Math.random() - .5) * .4;
    this.speedY = (Math.random() - .5) * .4;
    
    // Define a cor aleatória (Azul ou Laranja)
    this.color = Math.random() > .5 ? "rgba(58,92,233,.35)" : "rgba(245,138,31,.35)";
  }

  // Move a partícula e rebate nas bordas da tela
  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
    if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
  }

  // Desenha a bolinha na tela
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

// 2. CRIA AS 75 PARTÍCULAS INICIAIS
function init() {
  particles = [];
  for (let i = 0; i < 75; i++) {
    particles.push(new Particle());
  }
}

// 3. CALCULA A DISTÂNCIA E CRIA AS LINHAS ENTRE ELAS
function connect() {
  for (let a = 0; a < particles.length; a++) {
    for (let b = a; b < particles.length; b++) {
      const dx = particles[a].x - particles[b].x;
      const dy = particles[a].y - particles[b].y;
      const distance = dx * dx + dy * dy; // Teorema de Pitágoras

      // Se estiverem perto o suficiente, desenha a linha cinza transparente
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

// 4. O LOOP DE ANIMAÇÃO (Roda continuamente)
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpa a tela anterior

  particles.forEach((particle) => {
    particle.update(); // Move
    particle.draw();   // Desenha
  });

  connect(); // Conecta com linhas
  requestAnimationFrame(animate); // Chama o próximo frame
}

// 5. SE REAJUSTAR A JANELA, REINICIA PARA NÃO QUEBRAR O EFEITO
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  init();
});

// Inicialização do efeito
init();
animate();


//------------- Funções --------------

let produtos = JSON.parse(localStorage.getItem('produtos_aapm')) || [];

const categorias = [
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
    categorias.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.nome;
        selectCategoria.appendChild(option);
    });
}

function renderizarTabela(produtosFiltrados = produtos) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (produtosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color: #777;">
                    Nenhum produto encontrado.
                </td>
            </tr>
        `;
        return;
    }

    produtosFiltrados.forEach(p => {
        const tr = document.createElement('tr');
        
        // Encontra o nome limpo da categoria correspondente
        const objCategoria = categorias.find(c => c.id === p.categoria);
        const nomeCategoria = objCategoria ? objCategoria.nome : "—";

        tr.innerHTML = `
            <td>
                <img src="${p.imagem}" alt="${p.nome}" width="50" height="50" style="object-fit:cover; border-radius:4px;">
            </td>
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

// ==========================================
// 4. FUNÇÕES DE AÇÃO (EDITAR E EXCLUIR)
// ==========================================

window.editarProduto = function(id) {
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;

    // Prompt com valores antigos pré-preenchidos
    const novoNome = prompt("Editar Nome:", prod.nome);
    if (novoNome === null) return; // Se cancelar, para

    const novoPreco = parseFloat(prompt("Editar Preço:", prod.preco));
    if (isNaN(novoPreco)) return alert("Preço inválido!");

    const novoEstoque = parseInt(prompt("Editar Estoque:", prod.estoque || 0), 10);
    if (isNaN(novoEstoque)) return alert("Estoque inválido!");

    const novaImagem = prompt("Editar URL da Imagem:", prod.imagem);

    prod.nome = novoNome;
    prod.preco = novoPreco;
    prod.estoque = novoEstoque;
    prod.imagem = novaImagem || 'https://via.placeholder.com/150';

    salvarDados();
    alert("Produto atualizado!");
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
    // Intercepta o envio do formulário para o filtro acontecer no Front-End
    formFiltro.addEventListener('submit', (e) => {
        e.preventDefault(); // Impede o envio para a rota "/produtos" do backend

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

document.addEventListener('DOMContentLoaded', () => {
    carregarCategoriasNoSelect();
    injetarBotaoNovoProduto();
    renderizarTabela();
    
    console.log("Painel de Controle de Produtos da AAPM carregado.");
});