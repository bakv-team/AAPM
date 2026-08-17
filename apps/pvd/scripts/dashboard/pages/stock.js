/* Dashboard: página de estoque. */

window.StockPage = (function () {
  function openStockForm(product) {
    if (!product) return;

    document.getElementById("stockForm").reset();
    document.getElementById("stockProductId").value = product.id;
    document.getElementById("stockProductName").value = product.name;
    document.getElementById("stockCurrent").value = product.stock;
    const variationField = document.getElementById("stockVariationField");
    const variationSelect = document.getElementById("stockVariation");
    variationField.hidden = !product.hasVariations;
    variationSelect.required = product.hasVariations;
    variationSelect.innerHTML = product.hasVariations
      ? product.variations.map(v => `<option value="${v.id}" data-stock="${v.stock}">${UI.escapeHTML([v.size, v.color].filter(Boolean).join(" / "))} â€” ${v.stock} un.</option>`).join("")
      : "";
    if (product.hasVariations) {
      document.getElementById("stockCurrent").value = product.variations[0]?.stock || 0;
    }
    document.getElementById("stockQuantity").value = "";
    document.getElementById("stockModalTitle").textContent = `Repor estoque`;
    UI.openModal("stockModal");
  }

  async function saveStock(event) {
    event.preventDefault();

    const id = document.getElementById("stockProductId").value;
    const product = window.DB.getProduct(id);
    const quantity = parseInt(document.getElementById("stockQuantity").value, 10);
    const variationId = document.getElementById("stockVariation").value || null;

    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
      UI.toast("Informe uma quantidade maior que zero.", "error");
      return;
    }

    try {
      const updated = await window.API.addProductStock(id, quantity, variationId);
      Object.assign(product, updated);
      UI.toast(`+${quantity} unidades adicionadas a ${product.name}.`, "success");
      UI.closeModal("stockModal");
      render();
      if (window.StockMovementsPage) window.StockMovementsPage.render();
      if (window.ProductsPage) window.ProductsPage.render();
      if (window.Dashboard) window.Dashboard.refresh();
    } catch (err) {
      console.error("Falha ao repor estoque:", err);
      UI.toast("NÃ£o foi possÃ­vel atualizar o estoque.", "error");
    }
  }

  async function render() {
    const body = document.getElementById("stockBody");
    if (!body) return;

    const prods = window.DB.products.slice().sort((a, b) => a.stock - b.stock);
    body.innerHTML = prods.map(p => {
      const cat = window.DB.getCategory(p.categoryId);
      const s = UI.stockStatus(p);
      return `
        <tr>
          <td><strong>${p.name}</strong>${p.hasVariations ? `<div class="stock-variation-list">${p.variations.map(v => `<span>${UI.escapeHTML([v.size, v.color].filter(Boolean).join(" / "))}: <b>${v.stock} un.</b></span>`).join("")}</div>` : ""}</td>
          <td><span class="pill gray">${cat?.name || "â€”"}</span></td>
          <td><strong>${p.stock}</strong></td>
          <td><span class="pill ${s.pill}">${s.label}</span></td>
          <td class="right">
            <div class="actions-cell">
              <button class="act-btn edit" data-id="${p.id}" title="Repor estoque"><i class="fa-solid fa-plus"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // KPIs
    const productCodeCount = window.DB.products.length;
    const stockValue = window.DB.products.reduce((s, p) => s + (p.cost || p.price * 0.5) * p.stock, 0);
    const low = window.DB.products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const out = window.DB.products.filter(p => p.stock <= 0).length;
    document.getElementById("productCodeCount").textContent = UI.num(productCodeCount);
    document.getElementById("stockValue").textContent = UI.money(stockValue);
    document.getElementById("lowStockCount").textContent = low;
    document.getElementById("outOfStockCount").textContent = out;

    document.querySelectorAll("#stockBody .act-btn").forEach(b => {
      b.addEventListener("click", () => {
        const p = window.DB.getProduct(b.dataset.id);
        openStockForm(p);
      });
    });

  }

  function init() {
    document.getElementById("stockForm")?.addEventListener("submit", saveStock);
    document.getElementById("stockVariation")?.addEventListener("change", event => {
      document.getElementById("stockCurrent").value = event.target.selectedOptions[0]?.dataset.stock || 0;
    });
    document.getElementById("stockModal")?.addEventListener("click", event => {
      if (event.target.id === "stockModal") UI.closeModal("stockModal");
    });
    render();
  }

  return { render, init };
})();


