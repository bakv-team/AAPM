/* Dashboard: rotas, integrações globais e inicialização. */

(function () {
  const USER_ROLE = window.AAPM_USER_ROLE || document.body.dataset.userRole || "";
  const USER_PERMISSIONS = new Set(window.AAPM_DASHBOARD_PERMISSIONS || (document.body.dataset.userPermissions || "").split(",").filter(Boolean));
  const IS_ADMIN = USER_ROLE === "admin";
  const ROUTE_REQUIREMENTS = {
    smart: "smart",
    dashboard: "dashboard",
    grafico: "charts",
    pedidos: "orders",
    clientes: "customers",
    funcionarios: "admin",
    armarios: "admin",
    relatorios: "reports",
    configuracoes: "settings",
    admin: "products",
    categorias: "categories",
    estoque: ["stock", "stock_movements"],
    movimentacoes: ["movements", "stock_movements"]
  };
  const ROUTE_META = {
    smart:         { title: "AAPM Smart",            sub: "Inteligencia artificial de vendas" },
    dashboard:     { title: "Dashboard",             sub: "VisÃ£o geral das vendas e operaÃ§Ãµes." },
    admin:         { title: "Produtos",              sub: "Gerencie os produtos da sua loja." },
    grafico:       { title: "Painel GrÃ¡fico",        sub: "Indicadores e grÃ¡ficos em tempo real." },
    pedidos:       { title: "Pedidos",               sub: "Acompanhe transaÃ§Ãµes e status." },
    clientes:      { title: "Associados",            sub: "Cadastre associados e acompanhe benefÃ­cios de desconto." },
    funcionarios:  { title: "FuncionÃ¡rios",          sub: "Cadastre acessos e acompanhe permissÃµes da equipe." },
    armarios:      { title: "ArmÃ¡rios",              sub: "Controle a disponibilidade e valide os aluguÃ©is." },
    categorias:    { title: "Categorias",            sub: "Organize seus produtos por categoria." },
    estoque:       { title: "Estoque",               sub: "Controle de produtos, mÃ­nimos e reposiÃ§Ãµes." },
    movimentacoes: { title: "MovimentaÃ§Ãµes",         sub: "Acompanhe entradas, saÃ­das e ajustes do estoque." },
    relatorios:    { title: "RelatÃ³rios",            sub: "ExportaÃ§Ãµes e anÃ¡lises detalhadas." },
    configuracoes: { title: "ConfiguraÃ§Ãµes",         sub: "PreferÃªncias da loja e do painel." }
  };

  function can(permission) {
    if ((permission === "stock" || permission === "movements") && USER_PERMISSIONS.has("stock_movements")) return true;
    return IS_ADMIN || USER_PERMISSIONS.has(permission);
  }

  function canRoute(route) {
    const requirement = ROUTE_REQUIREMENTS[route];
    if (!requirement) return IS_ADMIN;
    if (requirement === "admin") return IS_ADMIN;
    if (Array.isArray(requirement)) return requirement.some(can);
    return can(requirement);
  }

  function firstAllowedRoute() {
    return Object.keys(ROUTE_META).find(canRoute) || "admin";
  }

  function applyPermissionUI() {
    document.querySelectorAll("[data-admin-only='true']").forEach(element => {
      if (!IS_ADMIN) element.hidden = true;
    });
    document.querySelectorAll("[data-requires-permission]").forEach(element => {
      if (!can(element.dataset.requiresPermission)) element.hidden = true;
    });
  }

  function setupMotionObserver(root = document) {
    const targets = root.querySelectorAll(".kpi, .glass, .card, .customer-card, .category-card, .report-card, .table-wrap");
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

  function setupChartScrollObserver(root = document) {
    const page = root.matches?.("#page-dashboard, #page-grafico")
      ? root
      : root.querySelector?.("#page-dashboard, #page-grafico");
    if (!page) return;

    const cards = [...page.querySelectorAll(".chart-wrap")]
      .map(chart => chart.closest(".card"))
      .filter(Boolean);
    if (!cards.length) return;

    cards.forEach((card, index) => {
      card.classList.add("chart-scroll-reveal");
      card.style.setProperty("--chart-scroll-delay", `${Math.min(index, 5) * 90}ms`);
      if (card.dataset.chartScrollObserved) return;
      card.dataset.chartScrollObserved = "1";
    });

    if (!("IntersectionObserver" in window)) {
      cards.forEach(card => card.classList.add("chart-scroll-in"));
      return;
    }

    if (!window.__aapmChartScrollObserver) {
      window.__aapmChartScrollObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("chart-scroll-in");
          window.__aapmChartScrollObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -14% 0px", threshold: 0.16 });
    }

    cards.forEach(card => {
      if (card.classList.contains("chart-scroll-in")) return;
      window.__aapmChartScrollObserver.observe(card);
    });
  }

  function navigate(route) {
    if (!ROUTE_META[route]) route = "dashboard";
    if (!canRoute(route)) route = firstAllowedRoute();

    document.body.classList.add("route-changing");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.route === route));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const pg = document.getElementById("page-" + route);
    if (pg) {
      pg.classList.add("active");
      setupMotionObserver(pg);
      setupChartScrollObserver(pg);
    }

    document.getElementById("pageTitle").textContent = ROUTE_META[route].title;
    document.getElementById("pageSubtitle").textContent = ROUTE_META[route].sub;

    // Close sidebar on mobile
    document.getElementById("sidebar").classList.remove("open");

    // Page-specific refreshes
    try {
      if (route === "dashboard" && can("dashboard"))  window.Dashboard.refresh();
      if (route === "grafico" && can("charts"))    window.Dashboard.refresh();
      if (route === "admin" && can("products"))      window.ProductsPage.render();
      if (route === "pedidos" && can("orders"))    window.OrdersPage.render();
      if (route === "clientes" && can("customers"))   window.CustomersPage.render();
      if (route === "funcionarios" && IS_ADMIN && window.EmployeesPage) window.EmployeesPage.render();
      if (route === "armarios" && IS_ADMIN && window.LockersPage) window.LockersPage.render();
      if (route === "categorias" && can("categories")) window.CategoriesPage.render();
      if (route === "estoque" && (can("stock") || can("stock_movements")))    window.StockPage.render();
      if (route === "movimentacoes" && (can("movements") || can("stock_movements"))) window.StockMovementsPage.render();
    } catch (err) {
      console.error(`Falha ao renderizar rota ${route}:`, err);
      UI.toast("Nao foi possivel atualizar esta tela.", "warn");
    }

    location.hash = "#" + route;
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => window.CHARTS?.resizeAll?.());
    window.setTimeout(() => document.body.classList.remove("route-changing"), 260);
  }

  const SmartGoals = (() => {
    const YEAR_DAYS = 364;
    const MONTH_DAYS = 30;

    function numberFromInput(id, fallback = 0) {
      const value = Number.parseFloat(document.getElementById(id)?.value);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    }

    function setText(id, value) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }

    function buildStrategy(quantity, goal, missing, todayProfit) {
      if (window.DB.smart?.goals?.strategy && goal === Number(window.DB.smart.goals.dailyGoal)) {
        return window.DB.smart.goals.strategy;
      }
      if (quantity >= goal) {
        return `Meta atingida. Se esse ritmo continuar, priorize manter estoque dos produtos de maior giro e acompanhe o caixa para sustentar aproximadamente ${UI.money(todayProfit * MONTH_DAYS)} no mes.`;
      }

      if (missing <= 5) {
        return `A meta ficou perto: faltam ${missing} vendas. Para amanha, tente um combo simples com os produtos mais comprados e deixe esses itens prontos antes do intervalo.`;
      }

      if (missing <= 12) {
        return `A meta nao foi atingida: faltam ${missing} vendas. Para o proximo dia, reduza a friccao do atendimento, destaque produtos de giro rapido e crie uma oferta curta no horario de pico.`;
      }

      return `A meta ficou distante: faltam ${missing} vendas. Para amanha, revise a meta, confira estoque antes da abertura e use uma estrategia mais agressiva: combo promocional, produto destaque e reposicao antecipada.`;
    }

    function render() {
      const quantity = Math.round(numberFromInput("smartQtyToday", 0));
      const profitPerItem = numberFromInput("smartProfitPerItem", 0);
      const goal = Math.max(1, Math.round(numberFromInput("smartDailyGoal", 1)));
      const todayProfit = quantity * profitPerItem;
      const progress = Math.min(100, Math.round((quantity / goal) * 100));
      const missing = Math.max(0, goal - quantity);
      const reached = quantity >= goal;
      const status = document.getElementById("smartGoalStatus");
      const meter = document.getElementById("smartGoalMeter");
      const strategy = document.getElementById("smartGoalStrategy");

      setText("smartProfitToday", UI.money(todayProfit));
      setText("smartProfitMonth", UI.money(todayProfit * MONTH_DAYS));
      setText("smartProfitYear", UI.money(todayProfit * YEAR_DAYS));

      if (meter) meter.style.width = `${progress}%`;

      if (status) {
        status.textContent = reached ? `Meta atingida: ${progress}%` : `Faltam ${missing} vendas`;
        status.classList.toggle("reached", reached);
        status.classList.toggle("missed", !reached);
      }

      const strategyText = strategy?.querySelector("p");
      if (strategyText) {
        strategyText.textContent = buildStrategy(quantity, goal, missing, todayProfit);
      }
    }

    function renderSmartData(data) {
      if (!data) return;
      const forecast = data.forecast || {};
      const goals = data.goals || {};
      setText("smartRevenueToday", UI.money(forecast.revenueToday || 0));
      setText("smartItemsToday", UI.num(forecast.itemsToday || 0));
      setText("smartRiskCount", `${UI.num(forecast.stockRiskCount || 0)} produtos`);
      setText("smartConfidence", `${forecast.confidence || 0}%`);
      setText("smartPeakHint", forecast.peakHint || "Maior saÃ­da entre 09h e 10h");
      setText("smartDemandTitle", data.summary?.title || `Demanda ${String(forecast.demand || "em anÃ¡lise").toLowerCase()}`);
      setText("smartSummaryText", data.summary?.text || "A AAPM Smart estÃ¡ lendo histÃ³rico recente, estoque e giro dos produtos.");
      setText("smartStockAlert", `${UI.num(forecast.stockRiskCount || 0)} produto(s) perto do limite mÃ­nimo.`);
      const revenueHint = document.getElementById("smartRevenueHint");
      if (revenueHint) revenueHint.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> PrevisÃ£o gerada pela AAPM Smart`;
      const confidenceMeter = document.getElementById("smartConfidenceMeter");
      if (confidenceMeter) confidenceMeter.style.width = `${Math.min(100, Math.max(0, forecast.confidence || 0))}%`;

      const qty = document.getElementById("smartQtyToday");
      const profit = document.getElementById("smartProfitPerItem");
      const goal = document.getElementById("smartDailyGoal");
      if (qty && forecast.itemsToday !== undefined) qty.value = forecast.itemsToday;
      if (profit && goals.profitPerItem !== undefined) profit.value = goals.profitPerItem;
      if (goal && goals.dailyGoal !== undefined) goal.value = goals.dailyGoal;

      const restock = document.getElementById("smartRestockList");
      if (restock && Array.isArray(data.restock)) {
        restock.innerHTML = data.restock.map(item => `
          <div><span>${item.name}</span><strong>+${UI.num(item.quantity)} un.</strong></div>
        `).join("");
      }

      const opportunities = document.getElementById("smartOpportunitiesList");
      if (opportunities && Array.isArray(data.opportunities)) {
        opportunities.innerHTML = data.opportunities.map(item => `
          <button type="button"><i class="fa-solid ${item.icon || "fa-lightbulb"}"></i><span>${item.text}</span></button>
        `).join("");
      }

      render();
    }

    function init() {
      const form = document.getElementById("smartGoalForm");
      if (!form) return;
      form.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", render);
      });
      renderSmartData(window.DB.smart);
      render();
    }

    return { init, render, renderSmartData };
  })();

  const SmartExperience = (() => {
    const scrollTargetsSelector = [
      ".smart-hero",
      ".smart-kpi",
      ".smart-neural-band",
      ".smart-panel",
      ".smart-restock-list div",
      ".smart-opportunities button",
      ".smart-goals",
      ".smart-goal-form label",
      ".smart-goal-results div",
      ".smart-goal-progress",
      ".smart-strategy",
      ".smart-assistant",
      ".smart-chat-message",
      ".smart-chat-form"
    ].join(", ");

    function bindTilt(card) {
      if (!card || card.dataset.smartTiltReady) return;
      card.dataset.smartTiltReady = "1";

      card.addEventListener("pointermove", event => {
        if (window.matchMedia("(max-width: 768px)").matches) return;
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        card.style.setProperty("--smart-tilt-x", `${(-y * 5).toFixed(2)}deg`);
        card.style.setProperty("--smart-tilt-y", `${(x * 5).toFixed(2)}deg`);
      });

      card.addEventListener("pointerleave", () => {
        card.style.removeProperty("--smart-tilt-x");
        card.style.removeProperty("--smart-tilt-y");
      });
    }

    function bindScrollAnimations() {
      const items = Array.from(document.querySelectorAll(`#page-smart ${scrollTargetsSelector}`));
      if (!items.length) return;

      items.forEach((item, index) => {
        item.classList.add("smart-scroll-item");
        item.classList.remove("smart-scroll-in");
        item.style.setProperty("--smart-scroll-delay", `${Math.min(index % 5, 4) * 22}ms`);
      });

      if (window.__aapmSmartScrollObserver) {
        window.__aapmSmartScrollObserver.disconnect();
      }

      const updateScrollState = () => {
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        items.forEach(item => {
          const rect = item.getBoundingClientRect();
          const shouldShow = rect.top < vh * 0.86 && rect.bottom > vh * 0.14;
          if (shouldShow) item.classList.add("smart-scroll-in");
        });
      };

      let ticking = false;
      const requestUpdate = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          updateScrollState();
          ticking = false;
        });
      };

      window.removeEventListener("scroll", window.__aapmSmartScrollHandler);
      window.removeEventListener("resize", window.__aapmSmartScrollHandler);
      window.__aapmSmartScrollHandler = requestUpdate;
      window.addEventListener("scroll", requestUpdate, { passive: true });
      window.addEventListener("resize", requestUpdate);

      if ("IntersectionObserver" in window) {
        window.__aapmSmartScrollObserver = new IntersectionObserver(() => requestUpdate(), {
          rootMargin: "-12% 0px -12% 0px",
          threshold: [0, 0.08, 0.18, 0.38]
        });
        items.forEach(item => window.__aapmSmartScrollObserver.observe(item));
      }

      updateScrollState();
    }

    function init() {
      document.querySelectorAll("#page-smart .smart-depth-card").forEach(bindTilt);
      bindScrollAnimations();
    }

    return { init };
  })();

  const SmartAssistant = (() => {
    const RESPONSE_DELAY_MS = 5000;

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function waitRemaining(startedAt) {
      return wait(Math.max(0, RESPONSE_DELAY_MS - (Date.now() - startedAt)));
    }

    function appendMessage(type, text) {
      const log = document.getElementById("smartChatLog");
      if (!log) return;
      const icon = type === "user" ? "fa-user" : "fa-brain";
      const message = document.createElement("div");
      message.className = `smart-chat-message ${type} is-new`;
      message.innerHTML = `<i class="fa-solid ${icon}"></i><p></p>`;
      message.querySelector("p").textContent = text;
      log.appendChild(message);
      log.scrollTop = log.scrollHeight;
      message.addEventListener("animationend", () => message.classList.remove("is-new"), { once: true });
    }

    function appendLoadingMessage() {
      const log = document.getElementById("smartChatLog");
      if (!log) return null;
      const message = document.createElement("div");
      message.className = "smart-chat-message ai smart-chat-loading is-new";
      message.innerHTML = `
        <i class="fa-solid fa-brain"></i>
        <p><span></span><span></span><span></span></p>
      `;
      log.appendChild(message);
      log.scrollTop = log.scrollHeight;
      message.addEventListener("animationend", () => message.classList.remove("is-new"), { once: true });
      return message;
    }

    function setStatus(text, mode = "") {
      const status = document.getElementById("smartAiStatus");
      if (!status) return;
      status.textContent = text;
      status.classList.toggle("external", mode === "external");
      status.classList.toggle("local", mode === "local");
    }

    async function submit(event) {
      event.preventDefault();
      const input = document.getElementById("smartChatInput");
      const form = document.getElementById("smartChatForm");
      const message = input?.value.trim();
      if (!message) return;

      appendMessage("user", message);
      input.value = "";
      setStatus("Pensando...");
      form?.querySelector("button")?.setAttribute("disabled", "true");
      form?.classList.add("is-sending");
      const loadingMessage = appendLoadingMessage();
      const startedAt = Date.now();

      try {
        const payload = {
          message,
          meta_diaria: Number(document.getElementById("smartDailyGoal")?.value) || 30,
          lucro_unidade: Number(document.getElementById("smartProfitPerItem")?.value) || 3.5
        };
        const [response] = await Promise.all([
          window.API.askSmartAssistant(payload),
          wait(RESPONSE_DELAY_MS)
        ]);
        if (response?.insights) {
          window.DB.smart = response.insights;
          SmartGoals.renderSmartData(response.insights);
        }
        loadingMessage?.remove();
        appendMessage("ai", response?.answer || "Nao consegui gerar uma resposta agora.");
        setStatus(response?.mode === "external" ? "IA externa ativa" : "IA local ativa", response?.mode || "local");
      } catch (error) {
        console.error("Falha na AAPM Smart externa:", error);
        await waitRemaining(startedAt);
        loadingMessage?.remove();
        appendMessage("ai", "Nao consegui acessar a IA agora. Verifique a conexao ou a chave configurada.");
        setStatus("IA indisponivel", "local");
      } finally {
        form?.querySelector("button")?.removeAttribute("disabled");
        form?.classList.remove("is-sending");
        input?.focus();
      }
    }

    function init() {
      document.getElementById("smartChatForm")?.addEventListener("submit", submit);
    }

    return { init };
  })();

  function renderNotifications() {
    const list = document.getElementById("notifList");
    if (!list) return;
    const visible = filterUnreadNotifications(window.DB.notifications);
    window.DB.notifications = visible;
    if (visible.length && renderNotifications._lastCount !== visible.length) {
      window.AAPMSound?.play(visible.some(item => item.type === "error" || item.type === "warn") ? "alert" : "notification");
    }
    renderNotifications._lastCount = visible.length;
    document.querySelector("#notifBtn .dot")?.classList.toggle("hidden", !visible.length);
    if (!visible.length) {
      list.innerHTML = `<li class="info"><i class="fa-solid fa-circle-info"></i><div>Sem notificaÃ§Ãµes no momento.<time>Agora</time></div></li>`;
      return;
    }
    list.innerHTML = visible.map(n => `
      <li class="${n.type}">
        <i class="fa-solid ${n.icon}"></i>
        <div>${n.text}<time>${n.time}</time></div>
      </li>
    `).join("");
  }

  const NOTIF_READ_STORAGE_KEY = "aapm_read_notifications";

  function notificationKey(item) {
    return [item?.id || "", item?.text || "", item?.time || ""].join("|");
  }

  function getReadNotificationKeys() {
    try {
      return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_STORAGE_KEY) || "[]"));
    } catch (err) {
      return new Set();
    }
  }

  function setReadNotificationKeys(keys) {
    localStorage.setItem(NOTIF_READ_STORAGE_KEY, JSON.stringify([...keys].slice(-80)));
  }

  function filterUnreadNotifications(items) {
    const read = getReadNotificationKeys();
    return (items || []).filter(item => !read.has(notificationKey(item)));
  }

  function markCurrentNotificationsRead() {
    const read = getReadNotificationKeys();
    window.DB.notifications.forEach(item => read.add(notificationKey(item)));
    setReadNotificationKeys(read);
    window.DB.notifications = [];
  }

  async function runPreventiveChecks() {
    try {
      const health = await window.API.getSystemHealth();
      const warnings = filterUnreadNotifications(health?.warnings || []);
      if (!warnings.length) return;
      const severe = warnings.find(item => item.type === "error") || warnings[0];
      UI.toast(severe.text || "Ha alertas preventivos no sistema.", severe.type === "error" ? "error" : "warn");
      document.querySelector("#notifBtn .dot")?.classList.remove("hidden");
    } catch (err) {
      console.warn("Falha na checagem preventiva:", err);
    }
  }

  function updateSidebarBadges() {
    const lowStock = window.DB.products.filter(p => p.stock <= 5).length;
    document.getElementById("navLowStock").textContent = lowStock;
    document.getElementById("navLowStock").style.display = lowStock ? "" : "none";
    const pending = window.DB.orders.filter(o => o.status === "pendente").length;
    document.getElementById("navOrdersBadge").textContent = pending;
    document.getElementById("navOrdersBadge").style.display = pending ? "" : "none";
  }

  async function openProfileModal() {
    try {
      const profile = await window.API.getProfile();
      document.getElementById("profileName").textContent = profile.nome || "Usuario";
      document.getElementById("profileEmail").textContent = profile.email || "-";
      document.getElementById("profileRole").textContent = profile.role === "admin" ? "Administrador" : "Funcionario";
      document.getElementById("profileStatus").textContent = profile.ativo ? "Ativo" : "Inativo";
      document.getElementById("profileInitials").textContent = UI.initialsFromName(profile.nome || profile.email || "U") || "U";
      UI.openModal("profileModal");
    } catch (err) {
      console.error("Falha ao carregar perfil:", err);
      UI.toast("Nao foi possivel carregar o perfil.", "error");
    }
  }

  function openSecurityModal() {
    document.getElementById("securityForm")?.reset();
    UI.openModal("securityModal");
  }

  function openSupportModal() {
    document.getElementById("supportForm")?.reset();
    UI.openModal("supportModal");
  }

  async function submitSecurity(event) {
    event.preventDefault();
    const submitBtn = event.submitter;
    const atual = document.getElementById("currentPassword")?.value || "";
    const nova = document.getElementById("newPassword")?.value || "";
    const confirma = document.getElementById("confirmPassword")?.value || "";
    if (nova.length < 6) {
      UI.toast("A nova senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }
    if (nova !== confirma) {
      UI.toast("A confirmacao da senha nao confere.", "error");
      return;
    }
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando`;
      }
      await window.API.changePassword({ senha_atual: atual, nova_senha: nova });
      UI.closeModal("securityModal");
      document.getElementById("securityForm")?.reset();
      UI.toast("Senha atualizada com sucesso.", "success");
    } catch (err) {
      console.error("Falha ao atualizar senha:", err);
      UI.toast(err.message || "Nao foi possivel atualizar a senha.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Salvar senha";
      }
    }
  }

  async function submitSupport(event) {
    event.preventDefault();
    const submitBtn = event.submitter;
    const assunto = document.getElementById("supportSubject")?.value || "Suporte";
    const mensagem = document.getElementById("supportMessage")?.value || "";
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Enviando`;
      }
      await window.API.sendSupport({ assunto, mensagem });
      UI.closeModal("supportModal");
      document.getElementById("supportForm")?.reset();
      UI.toast("Solicitacao enviada para o suporte.", "success");
    } catch (err) {
      console.error("Falha ao registrar suporte:", err);
      UI.toast("Nao foi possivel registrar o suporte.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Enviar";
      }
    }
  }

  async function submitAssociate(event) {
    event.preventDefault();
    const submitBtn = event.submitter;
    const nome = document.getElementById("associateName")?.value.trim() || "";
    const matricula = document.getElementById("associateRegistry")?.value.trim() || "";
    const telefone = document.getElementById("associatePhone")?.value.trim() || "";
    const is_associado = Boolean(document.getElementById("associateActiveDiscount")?.checked);
    if (!nome) {
      UI.toast("Informe o nome do associado.", "error");
      return;
    }
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando`;
      }
      const associado = await window.API.createCustomer({ nome, matricula, telefone, is_associado });
      const index = window.DB.customers.findIndex(c => String(c.id) === String(associado.id));
      if (index >= 0) window.DB.customers[index] = associado;
      else window.DB.customers.push(associado);
      window.CustomersPage.render();
      UI.closeModal("associateModal");
      document.getElementById("associateForm")?.reset();
      UI.toast("Associado cadastrado.", "success");
    } catch (err) {
      console.error("Falha ao cadastrar associado:", err);
      UI.toast("Nao foi possivel cadastrar o associado.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Salvar associado";
      }
    }
  }

  function bindGlobal() {
    const appShell = document.getElementById("appShell");
    const sidebar = document.getElementById("sidebar");
    const sidebarCollapse = document.getElementById("sidebarCollapse");
    const mobileSidebarToggle = document.getElementById("toggleSidebar");
    const mobileQuery = window.matchMedia("(max-width: 880px)");

    function syncChartsAfterLayoutChange() {
      requestAnimationFrame(() => window.CHARTS?.resizeAll?.());
      window.setTimeout(() => window.CHARTS?.resizeAll?.(), 120);
      window.setTimeout(() => window.CHARTS?.resizeAll?.(), 340);
    }

    function setSidebarCollapsed(collapsed, persist = true) {
      if (!appShell || !sidebarCollapse) return;

      appShell.classList.toggle("sidebar-collapsed", collapsed);
      sidebarCollapse.setAttribute("aria-expanded", String(!collapsed));
      sidebarCollapse.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
      sidebarCollapse.querySelector("i").className = collapsed ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-left";

      if (persist) localStorage.setItem("aapm_sidebar_collapsed", collapsed ? "1" : "0");
      syncChartsAfterLayoutChange();
    }

    setSidebarCollapsed(localStorage.getItem("aapm_sidebar_collapsed") === "1", false);

    document.querySelectorAll(".nav-item[data-route]").forEach(b => {
      b.addEventListener("click", () => navigate(b.dataset.route));
    });
    document.querySelectorAll("[data-route-link]").forEach(b => {
      b.addEventListener("click", () => navigate(b.dataset.routeLink));
    });

    mobileSidebarToggle?.addEventListener("click", () => {
      sidebar?.classList.toggle("open");
    });

    sidebarCollapse?.addEventListener("click", () => {
      if (mobileQuery.matches) {
        sidebar?.classList.remove("open");
        return;
      }

      setSidebarCollapsed(!appShell.classList.contains("sidebar-collapsed"));
    });

    appShell?.addEventListener("transitionend", event => {
      if (event.target === appShell && event.propertyName === "grid-template-columns") {
        window.CHARTS?.resizeAll?.();
      }
    });

    const themeToggle = document.getElementById("themeToggle");
    const applySavedTheme = () => {
      const storedTheme = localStorage.getItem("aapm_theme");
      if (storedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        return;
      }
      document.documentElement.removeAttribute("data-theme");
    };
    const setStoredTheme = theme => {
      localStorage.setItem("aapm_theme", theme);
    };
    const syncThemeIcon = () => {
      const icon = themeToggle?.querySelector("i");
      if (!icon) return;
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
      themeToggle?.setAttribute("aria-pressed", String(isDark));
      themeToggle?.setAttribute("title", isDark ? "Alternar para tema claro" : "Alternar para tema escuro");
    };
    applySavedTheme();
    syncThemeIcon();

    const soundEffectsToggle = document.getElementById("soundEffectsToggle");
    if (soundEffectsToggle) {
      soundEffectsToggle.checked = window.AAPMSound?.isEnabled?.() !== false;
      soundEffectsToggle.addEventListener("change", () => {
        window.AAPMSound?.setEnabled?.(soundEffectsToggle.checked);
        if (soundEffectsToggle.checked) window.AAPMSound?.suppressNextToast?.();
        UI.toast(soundEffectsToggle.checked ? "Efeitos sonoros ativados." : "Efeitos sonoros desativados.", "info");
      });
    }

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
      window.CHARTS.refreshAll();
    });

    const notifBtn = document.getElementById("notifBtn");
    const notifTray = document.getElementById("notifTray");
    notifBtn.addEventListener("click", e => {
      e.stopPropagation();
      const isHidden = notifTray.classList.toggle("hidden");
      document.getElementById("adminTray").classList.add("hidden");
      notifBtn.setAttribute("aria-expanded", String(!isHidden));
      adminChip?.setAttribute("aria-expanded", "false");
    });
    notifTray?.addEventListener("click", e => {
      e.stopPropagation();
    });

    const adminChip = document.getElementById("adminChip");
    const adminTray = document.getElementById("adminTray");
    adminChip.addEventListener("click", e => {
      e.stopPropagation();
      const isHidden = adminTray.classList.toggle("hidden");
      notifTray.classList.add("hidden");
      adminChip.setAttribute("aria-expanded", String(!isHidden));
      notifBtn?.setAttribute("aria-expanded", "false");
    });
    adminTray?.addEventListener("click", e => {
      e.stopPropagation();
    });
    adminChip?.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      adminChip.click();
    });

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      window.location.href = "/auth/logout";
    });
    document.getElementById("profileBtn")?.addEventListener("click", openProfileModal);
    document.getElementById("settingsBtn")?.addEventListener("click", () => navigate("configuracoes"));
    document.getElementById("securityBtn")?.addEventListener("click", openSecurityModal);
    document.getElementById("supportBtn")?.addEventListener("click", openSupportModal);
    document.getElementById("profileSecurityShortcut")?.addEventListener("click", () => {
      UI.closeModal("profileModal");
      openSecurityModal();
    });
    document.getElementById("profileSupportShortcut")?.addEventListener("click", () => {
      UI.closeModal("profileModal");
      openSupportModal();
    });
    document.getElementById("markNotifRead")?.addEventListener("click", event => {
      event.preventDefault();
      markCurrentNotificationsRead();
      renderNotifications();
      document.querySelector("#notifBtn .dot")?.classList.add("hidden");
      UI.toast("Notificacoes marcadas como lidas.", "success");
    });
    document.querySelectorAll("[data-report-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const target = button.dataset.reportTab;
        document.querySelectorAll("[data-report-tab]").forEach(tab => {
          const active = tab === button;
          tab.classList.toggle("active", active);
          tab.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll("[data-report-panel]").forEach(panel => {
          const active = panel.dataset.reportPanel === target;
          panel.classList.toggle("active", active);
          panel.hidden = !active;
        });
      });
    });
    document.querySelectorAll("[data-report]").forEach(button => {
      button.addEventListener("click", () => window.API.downloadReport(button.dataset.report, button.dataset.period || ""));
    });
    document.getElementById("securityForm")?.addEventListener("submit", submitSecurity);
    document.getElementById("supportForm")?.addEventListener("submit", submitSupport);
    document.getElementById("associateForm")?.addEventListener("submit", submitAssociate);

    document.addEventListener("click", () => {
      notifTray.classList.add("hidden");
      adminTray.classList.add("hidden");
      notifBtn?.setAttribute("aria-expanded", "false");
      adminChip?.setAttribute("aria-expanded", "false");
    });

    // Cmd+K for search
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("globalSearch").focus();
      }
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(m => UI.closeModal(m.id));
      }
    });

    const globalSearch = document.getElementById("globalSearch");
    const globalSearchResults = document.getElementById("globalSearchResults");

    function closeGlobalSearchResults() {
      globalSearchResults?.replaceChildren();
      globalSearchResults?.classList.add("hidden");
    }

    function globalSearchMatches(query) {
      const q = query.toLocaleLowerCase("pt-BR");
      const matches = [];
      const include = value => String(value || "").toLocaleLowerCase("pt-BR").includes(q);
      const categoryName = id => window.DB.categories.find(category => String(category.id) === String(id))?.name || "Sem categoria";

      if (can("products")) {
        window.DB.products.filter(product => include(`${product.name} ${product.description || ""} ${categoryName(product.categoryId)} ${product.stock}`)).forEach(product => {
          matches.push({ route: "admin", filter: "productSearch", icon: "fa-box", type: "Produto", title: product.name, detail: `${categoryName(product.categoryId)} Â· Estoque: ${product.stock}` });
        });
      }
      if (can("orders")) {
        window.DB.orders.filter(order => include(`${order.number} ${order.customerName} ${order.status} ${order.payment} ${order.total}`)).forEach(order => {
          matches.push({ route: "pedidos", filter: "orderSearch", icon: "fa-receipt", type: "Pedido", title: order.number, detail: `${order.customerName || "Cliente nao informado"} Â· ${UI.money(order.total)}` });
        });
      }
      if (can("customers")) {
        window.DB.customers.filter(customer => include(`${customer.name} ${customer.email || ""} ${customer.matricula || ""} ${customer.phone || ""}`)).forEach(customer => {
          matches.push({ route: "clientes", filter: "customerSearch", icon: "fa-user-group", type: "Associado", title: customer.name, detail: customer.matricula || customer.email || customer.phone || "Sem dados de contato" });
        });
      }
      if (can("categories")) {
        window.DB.categories.filter(category => include(`${category.name} ${category.description || ""}`)).forEach(category => {
          const productCount = category.productCount ?? window.DB.products.filter(product => String(product.categoryId) === String(category.id)).length;
          matches.push({ route: "categorias", icon: "fa-tags", type: "Categoria", title: category.name, detail: `${productCount} produto(s)` });
        });
      }
      if (IS_ADMIN) {
        document.querySelectorAll("[data-employee-row]").forEach(row => {
          if (!include(`${row.dataset.name || ""} ${row.dataset.email || ""} ${row.dataset.role || ""}`)) return;
          matches.push({ route: "funcionarios", filter: "employeeSearch", icon: "fa-user-tie", type: "Funcionario", title: row.dataset.name || "Funcionario", detail: row.dataset.email || row.dataset.role || "" });
        });
      }
      return matches.slice(0, 12);
    }

    function openGlobalSearchResult(result) {
      navigate(result.route);
      const target = result.filter ? document.getElementById(result.filter) : null;
      if (target) {
        target.value = globalSearch.value.trim();
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
      closeGlobalSearchResults();
    }

    function renderGlobalSearchResults() {
      const query = globalSearch?.value.trim() || "";
      closeGlobalSearchResults();
      if (!query || !globalSearchResults) return;

      const results = globalSearchMatches(query);
      if (!results.length) {
        const empty = document.createElement("div");
        empty.className = "global-search-result";
        empty.textContent = "Nenhuma informacao encontrada.";
        globalSearchResults.append(empty);
      } else {
        results.forEach(result => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "global-search-result";
          button.setAttribute("role", "option");
          button.innerHTML = `<i class="fa-solid ${result.icon}"></i><div><strong>${UI.escapeHTML(result.title)}</strong><span>${UI.escapeHTML(result.detail)}</span></div><em>${UI.escapeHTML(result.type)}</em>`;
          button.addEventListener("click", () => openGlobalSearchResult(result));
          globalSearchResults.append(button);
        });
      }
      globalSearchResults.classList.remove("hidden");
    }

    globalSearch?.addEventListener("input", renderGlobalSearchResults);
    globalSearch?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const firstResult = globalSearchResults?.querySelector(".global-search-result[role='option']");
      if (!firstResult) return;
      event.preventDefault();
      firstResult.click();
    });
    globalSearch?.addEventListener("blur", () => window.setTimeout(closeGlobalSearchResults, 150));

    // Global search routes to products if there's a query.
    globalSearch?.addEventListener("input", e => {
      const q = e.target.value.trim();
      if (!q || !can("products")) return;
      document.getElementById("productSearch").value = q;
      navigate("admin");
      window.ProductsPage.render();
    });
  }

  function labelResponsiveTable(table) {
    if (!table || table.dataset.responsiveLabels === "off") return;
    const labels = [...table.querySelectorAll("thead th")].map(header => header.textContent.trim());
    table.querySelectorAll("tbody tr").forEach(row => {
      [...row.children].forEach((cell, index) => {
        if (cell.tagName !== "TD") return;
        if (cell.hasAttribute("colspan")) {
          cell.removeAttribute("data-label");
          return;
        }
        cell.dataset.label = labels[index] || "InformaÃ§Ã£o";
      });
    });
  }

  function setupResponsiveTables() {
    const syncAll = () => document.querySelectorAll(".data-table").forEach(labelResponsiveTable);
    syncAll();
    const observer = new MutationObserver(mutations => {
      const tables = new Set();
      mutations.forEach(mutation => {
        const table = mutation.target.closest?.(".data-table");
        if (table) tables.add(table);
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches(".data-table")) tables.add(node);
          node.querySelectorAll?.(".data-table").forEach(item => tables.add(item));
        });
      });
      tables.forEach(labelResponsiveTable);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    applyPermissionUI();
    try {
      if (IS_ADMIN) {
        const [cats, prods, customers, orders, daily, hourly, notifications, metrics, topProducts, smart] = await Promise.all([
          window.API.getCategories(),
          window.API.getProducts(),
          window.API.getCustomers(),
          window.API.getOrders(),
          window.API.getDailySales(30),
          window.API.getHourlySales(),
          window.API.getNotifications(),
          window.API.getDashboardMetrics(),
          window.API.getTopProducts(),
          window.API.getSmartInsights()
        ]);
        window.DB.categories = cats;
        window.DB.products = prods;
        window.DB.customers = customers;
        window.DB.orders = orders;
        window.DB.daily = daily;
        window.DB.hourly = hourly;
        window.DB.notifications = notifications;
        window.DB.metrics = metrics;
        window.DB.topProducts = topProducts;
        window.DB.smart = smart;
      } else {
        if (can("products") || can("categories") || can("stock") || can("movements") || can("stock_movements") || can("dashboard") || can("charts") || can("reports") || can("smart")) {
          window.DB.categories = await window.API.getCategories();
        }
        if (can("products") || can("stock") || can("movements") || can("stock_movements") || can("dashboard") || can("charts") || can("reports") || can("smart")) {
          window.DB.products = await window.API.getProducts();
        }
        window.DB.customers = can("customers") || can("reports") ? await window.API.getCustomers() : [];
        window.DB.orders = can("orders") || can("dashboard") || can("charts") || can("reports") || can("smart") ? await window.API.getOrders() : [];
        window.DB.daily = can("dashboard") || can("charts") || can("reports") || can("smart") ? await window.API.getDailySales(30) : [];
        window.DB.hourly = can("dashboard") || can("charts") ? await window.API.getHourlySales() : [];
        window.DB.notifications = [];
        window.DB.metrics = can("dashboard") || can("charts") ? await window.API.getDashboardMetrics() : null;
        window.DB.topProducts = can("dashboard") || can("charts") || can("smart") ? await window.API.getTopProducts() : [];
        window.DB.smart = can("smart") ? await window.API.getSmartInsights() : null;
      }
    } catch (err) {
      console.error("Falha ao carregar dados do backend:", err);
      window.DB.customers = [];
      window.DB.orders = [];
      window.DB.daily = [];
      window.DB.hourly = [];
      window.DB.notifications = [];
      window.DB.metrics = null;
      window.DB.topProducts = [];
      window.DB.smart = null;
      UI.toast("Dados do banco indisponiveis no momento.", "warn");
    }

    bindGlobal();

    const safeInit = (label, fn) => {
      try {
        fn?.();
      } catch (err) {
        console.error(`Falha ao iniciar ${label}:`, err);
        UI.toast(`Nao foi possivel iniciar ${label}.`, "warn");
      }
    };

    // Init pages
    if (IS_ADMIN || can("dashboard") || can("charts")) safeInit("dashboard", () => window.Dashboard.init());
    if (can("products")) safeInit("produtos", () => window.ProductsPage.init());
    if (can("orders")) safeInit("pedidos", () => window.OrdersPage.init());
    if (can("customers")) safeInit("associados", () => window.CustomersPage.init());
    if (IS_ADMIN && window.LockersPage) safeInit("armarios", () => window.LockersPage.init());
    if (IS_ADMIN) safeInit("funcionarios", () => window.EmployeesPage.init());
    if (can("categories")) safeInit("categorias", () => window.CategoriesPage.init());
    if (can("stock") || can("stock_movements")) safeInit("estoque", () => window.StockPage.init());
    if (can("movements") || can("stock_movements")) safeInit("movimentacoes", () => window.StockMovementsPage.init());
    if (can("smart")) safeInit("AAPM Smart", () => SmartGoals.init());
    if (can("smart")) safeInit("experiencia AAPM Smart", () => SmartExperience.init());
    if (can("smart")) safeInit("assistente AAPM Smart", () => SmartAssistant.init());
    renderNotifications();
    updateSidebarBadges();
    runPreventiveChecks();
    setupMotionObserver();
    setupChartScrollObserver();
    setupResponsiveTables();

    // Initial route via hash
    const route = (location.hash || (IS_ADMIN ? "#dashboard" : `#${firstAllowedRoute()}`)).replace("#", "");
    navigate(route);

    // Periodic refresh of badges (simulate real-time)
    setInterval(updateSidebarBadges, 5000);
  });
})();

