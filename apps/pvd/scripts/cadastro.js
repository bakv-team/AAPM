const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];

class Particle{

  constructor(){

    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;

    this.size = Math.random() * 3 + 1;

    this.speedX = (Math.random() - .5) * .4;
    this.speedY = (Math.random() - .5) * .4;

    this.color =
      Math.random() > .5
      ? "rgba(58,92,233,.35)"
      : "rgba(245,138,31,.35)";
  }

  update(){

    this.x += this.speedX;
    this.y += this.speedY;

    if(this.x > canvas.width || this.x < 0){
      this.speedX *= -1;
    }

    if(this.y > canvas.height || this.y < 0){
      this.speedY *= -1;
    }

  }

  draw(){

    ctx.beginPath();

    ctx.arc(
      this.x,
      this.y,
      this.size,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = this.color;
    ctx.fill();

  }

}

function init(){

  particles = [];

  for(let i = 0; i < 75; i++){

    particles.push(
      new Particle()
    );

  }

}

function connect(){

  for(let a = 0; a < particles.length; a++){

    for(let b = a; b < particles.length; b++){

      const dx =
        particles[a].x -
        particles[b].x;

      const dy =
        particles[a].y -
        particles[b].y;

      const distance =
        dx * dx + dy * dy;

      if(distance < 10000){

        ctx.beginPath();

        ctx.strokeStyle =
          "rgba(120,120,160,.07)";

        ctx.lineWidth = 1;

        ctx.moveTo(
          particles[a].x,
          particles[a].y
        );

        ctx.lineTo(
          particles[b].x,
          particles[b].y
        );

        ctx.stroke();

      }

    }

  }

}

function animate(){

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  particles.forEach((particle)=>{

    particle.update();
    particle.draw();

  });

  connect();

  requestAnimationFrame(animate);

}

window.addEventListener("resize",()=>{

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  init();

});

init();
animate();

// ... Todo o código anterior das partículas e animações (Particle, connect, animate...) continua exatamente igual

// AJUSTE DO FORMULÁRIO DE CADASTRO:
const form = document.getElementById("cadastroForm"); // Mudado de 'loginForm' para 'cadastroForm'

if (form) {
  form.addEventListener("submit", (e) => {
    // Nota: Remova o e.preventDefault() se você quer que o formulário seja enviado 
    // convencionalmente para o backend processar via Jinja. 
    // Se o envio for via Fetch/API assíncrona, mantenha o e.preventDefault().

    const btn = document.querySelector(".cadastro-btn"); // Mudado de '.login-btn' para '.cadastro-btn'
    
    if (btn) {
      btn.innerHTML = `
        <span>Cadastrando...</span>
      `;
    }
  });
}

// Código do DOMContentLoaded e animações de entrada permanece idêntico abaixo...
document.addEventListener('DOMContentLoaded', () => {
  const animated = document.querySelectorAll(
    '.brand, .tag, .content h2, .text, .mini-cards, ' +
    '.mini-card, .cadastro-card, .line, .header h3, ' + // Mudado '.login-card' para '.cadastro-card'
    '.header p, .input-box, .options, .cadastro-btn, ' + // Mudado '.login-btn' para '.cadastro-btn'
    '.security, .blur'
  );

  animated.forEach(el => {
    el.addEventListener('animationend', () => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.animation = 'none';
    }, { once: true });
  });
});