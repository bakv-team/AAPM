/* Dashboard: página de pedidos. */

window.OrdersPage = (function () {
  let filters = { q: "", status: "" };
  let page = 1;
  const perPage = 10;
  let total = 0;

  function statusPill(s) {
    if (s === "concluido") return `<span class="pill green">Concluído</span>`;
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

  async function markPaymentExceptionPaid(orderId, payment, received = null) {
    const order = window.DB.orders.find(item => String(item.id) === String(orderId));
    if (!order) return;
    const paymentLabels = { pix: "Pix", debito: "D\u00e9bito", credito: "Cr\u00e9dito", dinheiro: "Dinheiro" };
    const pending = Number(paymentExceptionMeta(order).pending ?? order.total) || 0;
    const receivedSummary = payment === "dinheiro" && received !== null
      ? `Recebimento de ${UI.money(received)}; saldo pendente ${UI.money(pending)}; troco ${UI.money(Math.max(0, received - pending))}.`
      : `Confirmar ${UI.money(pending)} recebidos via ${paymentLabels[payment]}.`;
    const ok = await UI.confirmDialog({
      title: "Confirmar pagamento",
      text: `${receivedSummary} Pedido ${order.number}.`,
      okLabel: "Confirmar pagamento"
    });
    if (!ok) return;

    try {
      const updated = await window.API.markPaymentExceptionPaid(orderId, payment, received);
      const index = window.DB.orders.findIndex(item => String(item.id) === String(updated.id));
      if (index >= 0) window.DB.orders[index] = updated;
      UI.toast(`Pedido ${updated.number} marcado como pago via ${paymentLabels[payment]}.`, "success");
      await render();
    } catch (err) {
      console.error("Falha ao marcar excecao como paga:", err);
      UI.toast(err.message || "N\u00e3o foi poss\u00edvel marcar como pago.", "error");
    }
  }

  function openCashPaymentModal(orderId) {
    const order = window.DB.orders.find(item => String(item.id) === String(orderId));
    if (!order) return;
    const pending = Number(paymentExceptionMeta(order).pending ?? order.total) || 0;
    const modal = document.getElementById("cashPaymentModal");
    const amount = document.getElementById("cashPaymentReceived");
    const result = document.getElementById("cashPaymentResult");
    const confirm = document.getElementById("cashPaymentConfirm");
    document.getElementById("cashPaymentPendingLabel").textContent = `Saldo pendente: ${UI.money(pending)}`;
    amount.value = "";
    confirm.disabled = true;
    result.textContent = "Informe o valor recebido.";
    result.classList.remove("is-short");
    modal.classList.remove("hidden");

    const update = () => {
      const received = Number(amount.value || 0);
      const difference = Math.round((received - pending) * 100) / 100;
      confirm.disabled = !Number.isFinite(received) || received < pending;
      result.classList.toggle("is-short", difference < 0);
      result.textContent = difference < 0
        ? `Falta: ${UI.money(Math.abs(difference))}`
        : `Troco: ${UI.money(difference)}`;
    };
    const close = () => {
      modal.classList.add("hidden");
      amount.removeEventListener("input", update);
      confirm.removeEventListener("click", submit);
      document.getElementById("cashPaymentClose").removeEventListener("click", close);
      document.getElementById("cashPaymentCancel").removeEventListener("click", close);
    };
    const submit = () => {
      const received = Number(amount.value || 0);
      close();
      markPaymentExceptionPaid(orderId, "dinheiro", received);
    };
    amount.addEventListener("input", update);
    update();
    confirm.addEventListener("click", submit);
    document.getElementById("cashPaymentClose").addEventListener("click", close);
    document.getElementById("cashPaymentCancel").addEventListener("click", close);
  }

  function openPaymentMethodModal(orderId) {
    const order = window.DB.orders.find(item => String(item.id) === String(orderId));
    if (!order) return;
    const modal = document.getElementById("paymentMethodModal");
    modal.dataset.orderId = orderId;
    document.getElementById("paymentMethodOrderLabel").textContent = `Pedido ${order.number} - selecione a forma de pagamento.`;
    modal.classList.remove("hidden");
  }

  function selectExceptionPayment(orderId, payment) {
    document.getElementById("paymentMethodModal")?.classList.add("hidden");
    if (payment === "dinheiro") openCashPaymentModal(orderId);
    else markPaymentExceptionPaid(orderId, payment);
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
      const result = await window.API.getOrders({ ...filters, offset: (page - 1) * perPage, limit: perPage });
      window.DB.orders = result.items || [];
      total = Number(result.total) || 0;
    } catch (err) {
      console.error("Falha ao carregar pedidos:", err);
      UI.toast("Não foi possível carregar os pedidos.", "warn");
    }
  }

  async function render() {
    const body = document.getElementById("ordersBody");
    const exceptionsBody = document.getElementById("paymentExceptionsBody");
    if (!body) return;

    await refreshFromApi();
    const rows = window.DB.orders;
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
            <td>${UI.money(exception.paid ?? 0)}</td>
            <td><strong>${UI.money(exception.pending ?? o.total)}</strong></td>
            <td class="muted">${exception.dueAt ? UI.dateBR(exception.dueAt) : "-"}</td>
            <td>${UI.escapeHTML(exception.note || "-")}</td>
            <td>${paymentExceptionStatus(o)}</td>
            <td class="right">
              <div class="actions-cell">
                <div class="payment-action-wrap">
                  <button class="act-btn view" type="button" data-open-payment="${o.id}" title="Registrar pagamento" aria-label="Registrar pagamento do pedido ${UI.escapeHTML(o.number)}"${isPaid ? " disabled" : ""}><i class="fa-solid fa-money-bill-wave"></i></button>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="10" style="text-align:center;padding:36px;color:var(--text-mute)">Nenhuma exceção de pagamento encontrada.</td></tr>`;
    }

    [body, exceptionsBody].filter(Boolean).forEach(tableBody => tableBody.querySelectorAll("[data-order-items]").forEach(button => {
      button.addEventListener("click", () => openOrderItemsModal(button.dataset.orderItems));
    }));
    exceptionsBody?.querySelectorAll("[data-open-payment]").forEach(button => {
      button.addEventListener("click", () => openPaymentMethodModal(button.dataset.openPayment));
    });
    UI.renderServerPager(body.closest(".table-wrap"), "orders", page, total, perPage, nextPage => { page = nextPage; render(); });
  }

  function init() {
    const paymentMethodModal = document.getElementById("paymentMethodModal");
    paymentMethodModal?.querySelectorAll("[data-modal-payment]").forEach(button => {
      button.addEventListener("click", () => selectExceptionPayment(paymentMethodModal.dataset.orderId, button.dataset.modalPayment));
    });
    ["paymentMethodClose", "paymentMethodCancel"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", () => paymentMethodModal?.classList.add("hidden"));
    });
    paymentMethodModal?.addEventListener("click", event => {
      if (event.target === paymentMethodModal) paymentMethodModal.classList.add("hidden");
    });
    document.getElementById("orderSearch").addEventListener("input", e => { filters.q = e.target.value; page = 1; render(); });
    document.getElementById("orderStatusFilter").addEventListener("change", e => { filters.status = e.target.value; page = 1; render(); });
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


