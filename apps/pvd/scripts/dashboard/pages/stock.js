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
      ? product.variations.map(v => `<option value="${v.id}" data-stock="${v.stock}">${UI.escapeHTML([v.size, v.color].filter(Boolean).join(" / "))} — ${v.stock} un.</option>`).join("")
      : "";
    if (product.hasVariations) {
      document.getElementById("stockCurrent").value = product.variations[0]?.stock || 0;
    }
    document.getElementById("stockQuantity").value = "";
    document.getElementById("stockModalTitle").textContent = `Repor estoque`;
    UI.openModal("stockModal");
  }

  function openStockItemsModal(product) {
    const variations = product?.variations || [];
    const title = document.getElementById("stockItemsModalTitle");
    const subtitle = document.getElementById("stockItemsModalSubtitle");
    const list = document.getElementById("stockItemsList");
    if (!product || !title || !subtitle || !list) return;
    title.textContent = `Itens de ${product.name}`;
    subtitle.textContent = `${variations.length} ${variations.length === 1 ? "variação cadastrada" : "variações cadastradas"}`;
    list.innerHTML = variations.map((variation, index) => {
      const label = [variation.size, variation.color].filter(Boolean).join(" / ") || `Item ${index + 1}`;
      return `<li class="order-item-row stock-item-row"><span class="order-item-qty">${String(index + 1).padStart(2, "0")}</span><div class="order-item-info"><strong>${UI.escapeHTML(label)}</strong><span>Estoque disponível</span></div><strong class="order-item-subtotal">${Number(variation.stock) || 0} un.</strong></li>`;
    }).join("");
    UI.openModal("stockItemsModal");
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
      UI.toast("Não foi possível atualizar o estoque.", "error");
    }
  }

  async function render() {
    const body = document.getElementById("stockBody");
    if (!body) return;

    const prods = window.DB.products.slice().sort((a, b) => a.stock - b.stock);
    body.innerHTML = prods.map(p => {
      const cat = window.DB.getCategory(p.categoryId);
      const s = UI.stockStatus(p);
      const variationCount = p.hasVariations ? (p.variations || []).length : 0;
      const itemSummary = variationCount
        ? `<button type="button" class="stock-item-count" data-stock-items="${p.id}"><span>${variationCount} ${variationCount === 1 ? "item" : "itens"}</span><i class="fa-solid fa-list-check" aria-hidden="true"></i></button>`
        : "";
      return `
        <tr>
          <td><div class="stock-product-name"><strong>${UI.escapeHTML(p.name)}</strong>${itemSummary}</div></td>
          <td><span class="pill gray">${cat?.name || "—"}</span></td>
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
    document.querySelectorAll("#stockBody [data-stock-items]").forEach(button => {
      button.addEventListener("click", () => openStockItemsModal(window.DB.getProduct(button.dataset.stockItems)));
    });
    UI.paginateTable(body, "stock");

  }

  function init() {
    document.getElementById("stockForm")?.addEventListener("submit", saveStock);
    document.getElementById("stockVariation")?.addEventListener("change", event => {
      document.getElementById("stockCurrent").value = event.target.selectedOptions[0]?.dataset.stock || 0;
    });
    document.getElementById("stockModal")?.addEventListener("click", event => {
      if (event.target.id === "stockModal") UI.closeModal("stockModal");
    });
    document.querySelectorAll("[data-close-modal='stockItemsModal']").forEach(button => button.addEventListener("click", () => UI.closeModal("stockItemsModal")));
    document.getElementById("stockItemsModal")?.addEventListener("click", event => {
      if (event.target.id === "stockItemsModal") UI.closeModal("stockItemsModal");
    });
    render();
  }

  return { render, init };
})();


