/* Dashboard: página de associados. */

window.CustomersPage = (function () {
  let q = "";

  async function deleteCustomer(id) {
    const customer = window.DB.customers.find(c => String(c.id) === String(id));
    if (!customer) return;

    const ok = await UI.confirmDialog({
      title: "Excluir associado",
      text: `Tem certeza que deseja excluir "${customer.name}"? O histÃ³rico de vendas serÃ¡ preservado.`,
      okLabel: "Excluir"
    });
    if (!ok) return;

    try {
      await window.API.deleteCustomer(id);
      window.DB.customers = window.DB.customers.filter(c => String(c.id) !== String(id));
      UI.toast(`Associado "${customer.name}" excluÃ­do.`, "success");
      render();
      if (window.Dashboard) window.Dashboard.refresh();
    } catch (err) {
      console.error("Falha ao excluir associado:", err);
      UI.toast("NÃ£o foi possÃ­vel excluir o associado.", "error");
    }
  }

  function render() {
    const grid = document.getElementById("customersGrid");
    if (!grid) return;

    const rows = window.DB.customers.filter(c =>
      !q || `${c.name} ${c.email || ""} ${c.matricula || ""} ${c.phone || ""}`.toLowerCase().includes(q.toLowerCase())
    );

    if (!rows.length) {
      grid.innerHTML = `<p class="muted" style="grid-column:1/-1;text-align:center;padding:32px">Nenhum associado encontrado.</p>`;
      return;
    }

    const rowsHtml = rows.map(c => `
      <tr data-customer-id="${c.id}">
        <td>
          <div class="customer-table-name">
            <span class="avatar">${UI.initialsFromName(c.name)}</span>
            <strong title="${c.name}">${c.name}</strong>
          </div>
        </td>
        <p><i class="fa-solid fa-id-card"></i> ${c.matricula || "Sem matrÃ­cula"}</p>
        <p><i class="fa-solid fa-phone"></i> ${c.phone || "Sem telefone"}</p>
        <p><i class="fa-solid ${c.isAssociado ? "fa-circle-check" : "fa-circle-minus"}"></i> ${c.isAssociado ? "Desconto ativo" : "Sem desconto"}</p>
        <div class="customer-meta">
          <div><strong>${UI.money(c.totalSpent)}</strong><span>Total gasto</span></div>
          <div><strong>${c.orders}</strong><span>Pedidos</span></div>
          <div><strong>${c.lastOrder}</strong><span>Ãšltimo</span></div>
        </div>
      </article>
    `).join("");
    const tableRowsHtml = rows.map(c => `
      <tr data-customer-id="${c.id}">
        <td>
          <div class="customer-table-name">
            <span class="avatar">${UI.initialsFromName(c.name)}</span>
            <strong title="${c.name}">${c.name}</strong>
          </div>
        </td>
        <td title="${c.matricula || "Sem matricula"}">${c.matricula || "Sem matricula"}</td>
        <td title="${c.phone || "Sem telefone"}">${c.phone || "Sem telefone"}</td>
        <td><span class="pill ${c.isAssociado ? "green" : "gray"}">${c.isAssociado ? "Ativo" : "Sem desconto"}</span></td>
        <td class="right"><strong>${UI.money(c.totalSpent)}</strong></td>
        <td class="right">${c.orders}</td>
        <td class="right">${c.lastOrder}</td>
        <td class="right">
          <div class="actions-cell">
            <button class="act-btn delete" type="button" data-delete-customer="${c.id}" aria-label="Excluir ${c.name}" title="Excluir associado">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
    grid.innerHTML = `
      <div class="card glass no-pad customer-table-card">
        <div class="table-wrap">
          <table class="data-table customer-table">
            <thead>
              <tr>
                <th>Associado</th>
                <th>Matricula</th>
                <th>Telefone</th>
                <th>Desconto</th>
                <th class="right">Total gasto</th>
                <th class="right">Pedidos</th>
                <th class="right">Ultimo</th>
                <th class="right">Acoes</th>
              </tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
    bindActions();
  }

  function bindActions() {
    document.querySelectorAll("[data-delete-customer]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        deleteCustomer(button.dataset.deleteCustomer);
      });
    });
  }

  function init() {
    document.getElementById("customerSearch").addEventListener("input", e => { q = e.target.value; render(); });
    document.getElementById("newCustomerBtn").addEventListener("click", () => {
      document.getElementById("associateForm")?.reset();
      const discount = document.getElementById("associateActiveDiscount");
      if (discount) discount.checked = true;
      UI.openModal("associateModal");
    });
    render();
  }

  return { init, render };
})();

