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