/* Dashboard: utilitários de interface. */

window.UI = (function () {
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const NUM = new Intl.NumberFormat("pt-BR");

  function money(v) { return BRL.format(v || 0); }
  function num(v) { return NUM.format(v || 0); }
  function pct(v, decimals = 1) {
    const n = Number(v) || 0;
    return n.toFixed(decimals) + "%";
  }
  function todayBR() {
    return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  }
  function dayShort(date) {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  function dateBR(date) {
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("pt-BR") + " " + parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function stockStatus(product) {
    if (product.stock <= 0) return { pill: "red", label: "Sem estoque" };
    if (product.stock <= 5) return { pill: "yellow", label: "Estoque baixo" };
    return { pill: "green", label: "Em estoque" };
  }
  function initialsFromName(name) {
    return (name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0])
      .join("")
      .toUpperCase();
  }
  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  }

  const paginationState = new Map();
  function paginateTable(body, key, perPage = 10) {
    if (!body) return;
    const rows = Array.from(body.querySelectorAll(":scope > tr")).filter(row => !row.querySelector("td[colspan]") && row.dataset.paginationEligible !== "false");
    const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
    const current = Math.min(paginationState.get(key) || 1, totalPages);
    paginationState.set(key, current);
    rows.forEach((row, index) => { row.hidden = index < (current - 1) * perPage || index >= current * perPage; });

    const pagerId = `pager-${key}`;
    document.getElementById(pagerId)?.remove();
    if (rows.length <= perPage) return;
    const pager = document.createElement("div");
    pager.id = pagerId;
    pager.className = "pager table-pagination";
    pager.setAttribute("aria-label", "Paginação da tabela");
    pager.innerHTML = `<button type="button" data-page="${current - 1}" ${current === 1 ? "disabled" : ""} aria-label="Página anterior"><i class="fa-solid fa-chevron-left"></i></button>${Array.from({ length: totalPages }, (_, index) => `<button type="button" data-page="${index + 1}" class="${index + 1 === current ? "active" : ""}">${index + 1}</button>`).join("")}<button type="button" data-page="${current + 1}" ${current === totalPages ? "disabled" : ""} aria-label="Próxima página"><i class="fa-solid fa-chevron-right"></i></button>`;
    pager.querySelectorAll("button[data-page]").forEach(button => button.addEventListener("click", () => {
      paginationState.set(key, Number(button.dataset.page));
      paginateTable(body, key, perPage);
    }));
    body.closest(".table-wrap")?.insertAdjacentElement("afterend", pager);
  }

  function renderServerPager(anchor, key, page, total, perPage, onPage) {
    const pagerId = `server-pager-${key}`;
    document.getElementById(pagerId)?.remove();
    const pages = Math.max(1, Math.ceil((Number(total) || 0) / perPage));
    if (pages <= 1 || !anchor) return;
    const pager = document.createElement("div");
    pager.id = pagerId;
    pager.className = "pager table-pagination";
    pager.innerHTML = `<button type="button" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Página anterior"><i class="fa-solid fa-chevron-left"></i></button>${Array.from({ length: pages }, (_, index) => `<button type="button" data-page="${index + 1}" class="${index + 1 === page ? "active" : ""}">${index + 1}</button>`).join("")}<button type="button" data-page="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="Próxima página"><i class="fa-solid fa-chevron-right"></i></button>`;
    pager.querySelectorAll("button[data-page]").forEach(button => button.addEventListener("click", () => onPage(Number(button.dataset.page))));
    anchor.insertAdjacentElement("afterend", pager);
  }

  // Toast notification
  function toast(message, type = "info") {
    if (window.AAPMSound?.shouldPlayToast?.() !== false) {
      window.AAPMSound?.play(window.AAPMSound.soundForToast(type));
    }

    const wrap = document.getElementById("toastWrap");
    if (!wrap) return;
    const t = document.createElement("div");
    t.className = "toast " + type;
    const iconMap = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info", warn: "fa-triangle-exclamation" };
    const icon = document.createElement("i");
    icon.className = `fa-solid ${iconMap[type] || iconMap.info}`;
    const text = document.createElement("span");
    text.textContent = message;
    t.append(icon, text);
    wrap.appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      setTimeout(() => t.remove(), 280);
    }, 2800);
  }

  // Simple modal helpers
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("is-closing");
    el.classList.remove("hidden");
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains("hidden") || el.classList.contains("is-closing")) return;
    el.classList.add("is-closing");
    window.setTimeout(() => {
      el.classList.add("hidden");
      el.classList.remove("is-closing");
    }, 220);
  }

  // Confirm dialog (returns Promise<boolean>)
  function confirmDialog({ title = "Confirmar ação", text = "Tem certeza?", okLabel = "Confirmar", cancelLabel = "Cancelar" } = {}) {
    return new Promise(resolve => {
      const m = document.getElementById("confirmModal");
      document.getElementById("confirmTitle").textContent = title;
      document.getElementById("confirmText").textContent = text;
      const okBtn = document.getElementById("confirmOk");
      const cancelBtn = document.getElementById("confirmCancel");
      okBtn.textContent = okLabel;
      cancelBtn.textContent = cancelLabel;
      m.classList.remove("hidden");
      const clean = () => {
        m.classList.add("hidden");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
      };
      const onOk = () => { clean(); resolve(true); };
      const onCancel = () => { clean(); resolve(false); };
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
    });
  }

  // CSV exporter
  function downloadCSV(filename, rows) {
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? "");
      return /[",n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("n");
    const blob = new Blob(["ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }


  const palette = ["#FF6B35", "#2D7BFF", "#7C5CFF", "#16C784", "#F5A623", "#FF4D6D", "#22D3EE", "#A855F7"];

  return { money, num, pct, todayBR, dayShort, dateBR, stockStatus, initialsFromName, escapeHTML, paginateTable, renderServerPager, toast, openModal, closeModal, confirmDialog, downloadCSV, palette };

})();
