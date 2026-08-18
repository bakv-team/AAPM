/* Dashboard: página de pedidos. */

window.OrdersPage = (function () {
  let filters = { q: "", status: "" };

  function statusPill(s) {
    if (s === "concluido") return `<span class="pill green">ConcluÃ­do</span>`;
    if (s === "pendente")  return `<span class="pill yellow">Pendente</span>`;
    if (s === "cancelado") return `<span class="pill red">Cancelado</span>`;
    return `<span class="pill gray">${UI.escapeHTML(s)}</span>`;
  }

  function sortedOrderItems(order) {
    return [...(order.items || [])].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })
    );
  }

  function orderItemsCount(order) {
    return (order.items || []).reduce((total, item) => total + (Number(item.qty) || 0), 0);
  }

  function renderItemsButton(order) {
    const count = orderItemsCount(order);
    const label = `${count} ${count === 1 ? "item" : "itens"}`;
    return `
      <button class="order-items-btn" type="button" data-order-items="${UI.escapeHTML(order.number)}" aria-label="Ver produtos do pedido ${UI.escapeHTML(order.number)}">
        <span>${label}</span>
        <i class="fa-solid fa-list-check"></i>
      </button>
    `;
  }

  function paymentExceptionMeta(order) {
    return order.paymentException || {};
  }

  function paymentExceptionStatus(order) {
    const exception = paymentExceptionMeta(order);
    if (exception.status === "pago") return `<span class="pill green">Pago</span>`;
    const due = exception.dueAt ? new Date(exception.dueAt) : null;
    if (due && due < new Date()) return `<span class="pill red">Vencido</span>`;
    return `<span class="pill yellow">Pendente</span>`;
  }

  async function markPaymentExceptionPaid(orderId) {
    const order = window.DB.orders.find(item => String(item.id) === String(orderId));
    if (!order) return;
    const ok = await UI.confirmDialog({
      title: "Marcar pagamento",
      text: `Confirmar que o pedido ${order.number} foi pago?`,
      okLabel: "Marcar como pago"
    });
    if (!ok) return;

    try {
      const updated = await window.API.markPaymentExceptionPaid(orderId);
      const index = window.DB.orders.findIndex(item => String(item.id) === String(updated.id));
      if (index >= 0) window.DB.orders[index] = updated;
      UI.toast(`Pedido ${updated.number} marcado como pago.`, "success");
      await render();
    } catch (err) {
      console.error("Falha ao marcar excecao como paga:", err);
      UI.toast(err.message || "Nao foi possivel marcar como pago.", "error");
    }
  }

  function renderOrderItemsList(order) {
    const items = sortedOrderItems(order);
    const list = document.getElementById("orderItemsList");
    const total = document.getElementById("orderItemsTotal");
    const empty = document.getElementById("orderItemsEmpty");
    if (!list || !total || !empty) return;

    total.textContent = UI.money(order.total);
    list.innerHTML = "";
    empty.hidden = Boolean(items.length);

    items.forEach(item => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const subtotal = Number(item.subtotal) || qty * price;
      const row = document.createElement("li");
      row.className = "order-item-row";
      row.innerHTML = `
        <div class="order-item-index">${String(qty).padStart(2, "0")}</div>
        <div class="order-item-info">
          <strong>${UI.escapeHTML(item.name || "Produto sem nome")}</strong>
          <span>${qty} ${qty === 1 ? "unidade" : "unidades"} x ${UI.money(price)}</span>
        </div>
        <strong class="order-item-subtotal">${UI.money(subtotal)}</strong>
      `;
      list.appendChild(row);
    });
  }

  function openOrderItemsModal(orderNumber) {
    const order = window.DB.orders.find(item => item.number === orderNumber);
    if (!order) return;
    document.getElementById("orderItemsModalTitle").textContent = `Produtos do pedido ${order.number}`;
    document.getElementById("orderItemsCustomer").textContent = order.customerName || "Cliente";
    document.getElementById("orderItemsDate").textContent = UI.dateBR(order.createdAt);
    renderOrderItemsList(order);
    UI.openModal("orderItemsModal");
  }

  async function refreshFromApi() {
    try {
      window.DB.orders = await window.API.getOrders(filters);
    } catch (err) {
      console.error("Falha ao carregar pedidos:", err);
      UI.toast("Nao foi possivel carregar os pedidos.", "warn");
    }
  }

  async function render() {
    const body = document.getElementById("ordersBody");
    const exceptionsBody = document.getElementById("paymentExceptionsBody");
    if (!body) return;

    await refreshFromApi();
    const rows = window.DB.orders.filter(o => {
      if (filters.q && !(`${o.number} ${o.customerName}`.toLowerCase().includes(filters.q.toLowerCase()))) return false;
      if (filters.status && o.status !== filters.status) return false;
      return true;
    });
    const regularRows = rows.filter(o => !paymentExceptionMeta(o).enabled);
    const exceptionRows = rows.filter(o => paymentExceptionMeta(o).enabled);

    if (!regularRows.length) {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--text-mute)">Nenhum pedido encontrado.</td></tr>`;
    } else {
      body.innerHTML = regularRows.map(o => `
        <tr>
          <td><strong>${UI.escapeHTML(o.number)}</strong></td>
          <td>${UI.escapeHTML(o.customerName)}</td>
          <td>${renderItemsButton(o)}</td>
          <td><strong>${UI.money(o.total)}</strong></td>
          <td><span class="pill blue">${UI.escapeHTML(o.payment)}</span></td>
          <td class="muted">${UI.dateBR(o.createdAt)}</td>
          <td>${statusPill(o.status)}</td>
        </tr>
      `).join("");
    }

    if (exceptionsBody) {
      exceptionsBody.innerHTML = exceptionRows.length ? exceptionRows.map(o => {
        const exception = paymentExceptionMeta(o);
        const isPaid = exception.status === "pago";
        return `
          <tr>
            <td><strong>${UI.escapeHTML(o.number)}</strong></td>
            <td>${UI.escapeHTML(o.customerName)}</td>
            <td>${renderItemsButton(o)}</td>
            <td><strong>${UI.money(o.total)}</strong></td>
            <td class="muted">${exception.dueAt ? UI.dateBR(exception.dueAt) : "-"}</td>
            <td>${UI.escapeHTML(exception.note || "-")}</td>
            <td>${paymentExceptionStatus(o)}</td>
            <td class="right">
              <div class="actions-cell">
                <button class="act-btn view" data-mark-exception-paid="${o.id}" title="Marcar como pago"${isPaid ? " disabled" : ""}><i class="fa-solid fa-check"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="8" style="text-align:center;padding:36px;color:var(--text-mute)">Nenhuma exceÃ§Ã£o de pagamento encontrada.</td></tr>`;
    }

    [body, exceptionsBody].filter(Boolean).forEach(tableBody => tableBody.querySelectorAll("[data-order-items]").forEach(button => {
      button.addEventListener("click", () => openOrderItemsModal(button.dataset.orderItems));
    }));
    exceptionsBody?.querySelectorAll("[data-mark-exception-paid]").forEach(button => {
      button.addEventListener("click", () => markPaymentExceptionPaid(button.dataset.markExceptionPaid));
    });
    UI.paginateTable(body, "orders");
    UI.paginateTable(exceptionsBody, "payment-exceptions");
  }

  function init() {
    document.getElementById("orderSearch").addEventListener("input", e => { filters.q = e.target.value; render(); });
    document.getElementById("orderStatusFilter").addEventListener("change", e => { filters.status = e.target.value; render(); });
    document.querySelectorAll("[data-close-modal='orderItemsModal']").forEach(button => {
      button.addEventListener("click", () => UI.closeModal("orderItemsModal"));
    });
    document.getElementById("orderItemsModal")?.addEventListener("click", e => {
      if (e.target.id === "orderItemsModal") UI.closeModal("orderItemsModal");
    });
    render();
  }

  return { init, render };
})();


