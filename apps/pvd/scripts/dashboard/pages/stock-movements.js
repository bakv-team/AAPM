/* Dashboard: página de movimentações de estoque. */

window.StockMovementsPage = (function () {
  let page = 1;
  const perPage = 10;
  let total = 0;
  async function refreshMovements() {
    try {
      const result = await window.API.getStockMovements({ offset: (page - 1) * perPage, limit: perPage });
      window.DB.stockMovements = result.items || [];
      total = Number(result.total) || 0;
    } catch (err) {
      console.error("Falha ao carregar movimentações de estoque:", err);
      window.DB.stockMovements = [];
      UI.toast("Não foi possível carregar as movimentações.", "warn");
    }
  }

  function renderRows() {
    const body = document.getElementById("stockMovementsBody");
    if (!body) return;

    const movements = window.DB.stockMovements || [];
    body.innerHTML = movements.length ? movements.map(m => {
      const isEntrada = m.type === "entrada";
      const pill = isEntrada ? "green" : "red";
      const icon = isEntrada ? "fa-arrow-trend-up" : "fa-arrow-trend-down";
      const sign = isEntrada ? "+" : "-";
      return `
        <tr>
          <td>${m.createdAt ? UI.dateBR(m.createdAt) : "—"}</td>
          <td><strong>${m.productName || "Produto"}</strong></td>
          <td><span class="pill ${pill}"><i class="fa-solid ${icon}"></i> ${m.typeLabel || (isEntrada ? "Entrada" : "Saída")}</span></td>
          <td><strong>${sign}${UI.num(m.quantity || 0)}</strong></td>
          <td>${UI.money(m.total || 0)}</td>
          <td>${m.userName || "Usuário"}</td>
          <td class="muted">${m.note || "—"}</td>
        </tr>
      `;
    }).join("") : `
      <tr>
        <td colspan="7" class="empty-cell">Nenhuma movimentação registrada ainda.</td>
      </tr>
    `;
    UI.renderServerPager(body.closest(".table-wrap"), "stock-movements", page, total, perPage, nextPage => { page = nextPage; render(); });
  }

  async function render() {
    await refreshMovements();
    renderRows();
  }

  function init() {
    render();
  }

  return { init, render };
})();



