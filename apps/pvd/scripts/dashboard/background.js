/* Dashboard: animação de fundo. */


/* =====================================================================
 *  BACKGROUND DO DASHBOARD â€” mesmo canvas da tela de login, atrÃ¡s do app shell
 * ===================================================================== */
(function () {
  const canvas = document.getElementById("particles");
  const shell = document.getElementById("appShell");
  const ctx = canvas?.getContext("2d");

  if (!canvas || !shell || !ctx) return;

  let particles = [];
  let animationFrame = null;

  function resizeCanvas() {
    const rect = shell.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
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

  restartParticles();
  animateParticles();

  window.addEventListener("resize", restartParticles);

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(restartParticles);
    observer.observe(shell);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    } else if (!document.hidden && !animationFrame) {
      animateParticles();
    }
  });
})();

/* =====================================================================
 *  CAMADA DE API â€” ponte com FastAPI + SQLite + Alembic
 *  ---------------------------------------------------------------------
 *  As funÃ§Ãµes abaixo conversam com FastAPI e mantÃªm window.DB apenas como
 *  cache de tela para os componentes jÃ¡ existentes.
 * ===================================================================== */
