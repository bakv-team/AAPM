const canvas = document.getElementById("particles");
const ctx = canvas?.getContext("2d");

if(canvas){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

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
  if(!canvas){
    return;
  }

  particles = [];

  for(let i = 0; i < 75; i++){

    particles.push(
      new Particle()
    );

  }

}

function connect(){
  if(!ctx){
    return;
  }

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
  if(!canvas || !ctx){
    return;
  }

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
  if(!canvas){
    return;
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  init();

});

init();
animate();

const form =
document.getElementById("loginForm");
const loadingOverlay =
document.getElementById("loginLoadingOverlay");
const passwordInput =
document.getElementById("passwordInput");
const passwordToggle =
document.getElementById("passwordToggle");
const forgotPasswordLink =
document.getElementById("forgotPasswordLink");
const forgotPasswordFeedback =
document.getElementById("forgotPasswordFeedback");
const loginEmailInput =
document.getElementById("loginEmailInput");
const resetPasswordInput =
document.getElementById("resetPasswordInput");
const resetPasswordToggle =
document.getElementById("resetPasswordToggle");
const resetConfirmInput =
document.getElementById("resetConfirmInput");
const loginEmailError =
document.getElementById("loginEmailError");
const loginPasswordError =
document.getElementById("loginPasswordError");

let loadingTimer = null;

function refreshIcons(){
  if(window.lucide){
    window.lucide.createIcons();
  }
}

function replayEntryAnimation(element){
  if(!element){
    return;
  }
  element.style.animation = "none";
  element.offsetHeight;
  element.style.animation = "";
}

function clearTemporaryLoginError(){
  if(form?.dataset.temporaryError !== "true"){
    return;
  }
  const cleanPath = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanPath);
  form.dataset.temporaryError = "false";
}

function toast(message, type = "warn"){
  const wrap = document.getElementById("toastWrap");
  if(!wrap || !message){
    return;
  }

  const item = document.createElement("div");
  item.className = `toast ${type}`;

  const marker = document.createElement("i");
  marker.setAttribute("data-lucide", type === "error" ? "circle-x" : "triangle-alert");

  const text = document.createElement("span");
  text.textContent = message;

  item.append(marker, text);
  wrap.appendChild(item);
  refreshIcons();

  window.setTimeout(()=>{
    item.classList.add("leaving");
    window.setTimeout(()=>item.remove(), 260);
  }, 4600);
}

function resetLoginLoading(){
  window.clearTimeout(loadingTimer);
  document.body.classList.remove("login-loading","login-loading-slow");
  loadingOverlay?.setAttribute("aria-hidden","true");

  const btn =
  form?.querySelector(".login-btn");

  if(btn){
    btn.disabled = false;
    btn.innerHTML = `
      <span>Entrar</span>
      <i data-lucide="arrow-right"></i>
    `;
    refreshIcons();
  }
}

function startLoginLoading(){
  document.body.classList.add("login-loading");
  loadingOverlay?.setAttribute("aria-hidden","false");

  loadingTimer = window.setTimeout(()=>{
    document.body.classList.add("login-loading-slow");
  },650);
}

form?.addEventListener("submit",(e)=>{
  const btn =
  form.querySelector(".login-btn");

  startLoginLoading();

  if(btn){
    btn.disabled = true;
    btn.innerHTML = `
      <span>Entrando...</span>
      <i data-lucide="loader-circle"></i>
    `;
    refreshIcons();
  }

});

passwordToggle?.addEventListener("click",()=>{
  if(!passwordInput){
    return;
  }

  const isVisible = passwordInput.type === "text";

  passwordInput.type = isVisible ? "password" : "text";
  passwordToggle.setAttribute("aria-pressed", String(!isVisible));
  passwordToggle.setAttribute("aria-label", isVisible ? "Mostrar senha" : "Ocultar senha");
  passwordToggle.innerHTML = `<i data-lucide="${isVisible ? "eye" : "eye-off"}"></i>`;
  refreshIcons();
  passwordInput.focus();
});

passwordInput?.addEventListener("input", () => {
  passwordInput.removeAttribute("aria-invalid");
  passwordInput.closest(".input-box")?.classList.remove("has-error");
  loginPasswordError?.remove();
});

loginEmailInput?.addEventListener("input", () => {
  loginEmailInput.removeAttribute("aria-invalid");
  loginEmailInput.closest(".input-box")?.classList.remove("has-error");
  loginEmailError?.remove();
});

resetPasswordToggle?.addEventListener("click",()=>{
  if(!resetPasswordInput){
    return;
  }

  const isVisible = resetPasswordInput.type === "text";
  resetPasswordInput.type = isVisible ? "password" : "text";
  if(resetConfirmInput){
    resetConfirmInput.type = isVisible ? "password" : "text";
  }
  resetPasswordToggle.setAttribute("aria-pressed", String(!isVisible));
  resetPasswordToggle.setAttribute("aria-label", isVisible ? "Mostrar senha" : "Ocultar senha");
  resetPasswordToggle.innerHTML = `<i data-lucide="${isVisible ? "eye" : "eye-off"}"></i>`;
  refreshIcons();
  resetPasswordInput.focus();
});

forgotPasswordLink?.addEventListener("click", async event => {
  event.preventDefault();
  const email = loginEmailInput?.value.trim();

  if(!email){
    loginEmailInput?.focus();
    if(forgotPasswordFeedback){
      forgotPasswordFeedback.hidden = false;
      forgotPasswordFeedback.className = "auth-feedback error";
      forgotPasswordFeedback.textContent = "Digite seu e-mail antes de solicitar a recuperação.";
      replayEntryAnimation(forgotPasswordFeedback);
    }
    return;
  }

  const originalText = forgotPasswordLink.textContent;
  forgotPasswordLink.textContent = "Enviando...";
  forgotPasswordLink.style.pointerEvents = "none";

  try{
    const formData = new FormData();
    formData.append("email", email);
    const response = await fetch("/auth/forgot-password", {
      method: "POST",
      body: formData,
      credentials: "same-origin"
    });
    const data = await response.json();
    if(!response.ok){
      throw new Error(data.detail || "Nao foi possivel solicitar a recuperacao.");
    }
    if(forgotPasswordFeedback){
      forgotPasswordFeedback.hidden = false;
      forgotPasswordFeedback.className = "auth-feedback success";
      forgotPasswordFeedback.textContent = data.message || "Se o e-mail estiver cadastrado, enviaremos o link de recuperação.";
      replayEntryAnimation(forgotPasswordFeedback);
    }
  }catch(error){
    if(forgotPasswordFeedback){
      forgotPasswordFeedback.hidden = false;
      forgotPasswordFeedback.className = "auth-feedback error";
      forgotPasswordFeedback.textContent = error.message || "Nao foi possivel solicitar a recuperacao.";
      replayEntryAnimation(forgotPasswordFeedback);
    }
  }finally{
    forgotPasswordLink.textContent = originalText;
    forgotPasswordLink.style.pointerEvents = "";
  }
});

window.addEventListener("pageshow",(event)=>{
  if(event.persisted){
    resetLoginLoading();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  clearTemporaryLoginError();

  const notfoundMessage = document.getElementById("toastWrap")?.dataset.notfoundMessage;
  if(notfoundMessage){
    toast(notfoundMessage, "warn");
  }

  const animated = document.querySelectorAll(
    '.brand, .tag, .content h2, .text, .mini-cards, ' +
    '.mini-card, .login-card, .line, .header h3, ' +
    '.header p, .input-box, .options, .login-btn, ' +
    '.login-field-error, .auth-feedback:not([hidden]), .security, .blur'
  );

  animated.forEach(el => {
    el.addEventListener('animationend', () => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.animation = 'none';
    }, { once: true });
  });
});
