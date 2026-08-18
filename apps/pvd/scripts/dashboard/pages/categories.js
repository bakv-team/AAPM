/* Dashboard: página de categorias. */

window.CategoriesPage = (function () {
  function syncProductCategoryFilter() {
    const sel = document.getElementById("productCategoryFilter");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">Todas categorias</option>` +
      window.DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    sel.value = window.DB.categories.some(c => c.id === current) ? current : "";
  }

  function render() {
    const grid = document.getElementById("categoriesGrid");
    if (!grid) return;

    if (!window.DB.categories.length) {
      grid.innerHTML = `<p class="muted" style="grid-column:1/-1;text-align:center;padding:32px">Nenhuma categoria cadastrada.</p>`;
      document.getElementById("pager-categories")?.remove();
      syncProductCategoryFilter();
      return;
    }

    const agg = window.CHARTS.aggregateByCategory();
    const rowsHtml = window.DB.categories.map(c => {
      const a = agg.find(x => x.id === c.id) || { value: 0, color: c.color || "#2D7BFF" };
      const productCount = c.productCount ?? window.DB.products.filter(p => p.categoryId === c.id).length;
      return `
        <tr data-category-id="${c.id}">
          <td>
            <div class="category-table-name">
              <span class="cat-ic" style="background:linear-gradient(135deg, ${a.color}, ${a.color}aa)"><i class="fa-solid ${c.icon || "fa-box"}"></i></span>
              <strong title="${c.name}">${c.name}</strong>
            </div>
          </td>
          <td>${productCount} produto${productCount === 1 ? "" : "s"}</td>
          <td class="right"><strong>${UI.money(a.value)}</strong></td>
          <td class="right">
            <div class="actions-cell">
              <button class="act-btn edit" type="button" data-edit-category="${c.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="act-btn delete" type="button" data-delete-category="${c.id}" title="Remover"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
    grid.innerHTML = `
      <div class="card glass no-pad category-table-card">
        <div class="table-wrap">
          <table class="data-table category-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Produtos</th>
                <th class="right">Receita vinculada</th>
                <th class="right">Acoes</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
    bindActions();
    UI.paginateTable(grid.querySelector("tbody"), "categories");
    syncProductCategoryFilter();
  }

  function openForm(category = null) {
    const form = document.getElementById("categoryForm");
    if (!form) return;

    form.reset();
    document.getElementById("categoryId").value = category?.id || "";
    document.getElementById("categoryName").value = category?.name || "";
    document.getElementById("categoryModalTitle").textContent = category ? "Editar categoria" : "Nova categoria";
    UI.openModal("categoryModal");
  }

  async function saveCategory(event) {
    event.preventDefault();

    const id = document.getElementById("categoryId").value;
    const nome = document.getElementById("categoryName").value.trim();
    if (!nome) {
      UI.toast("Informe o nome da categoria.", "error");
      return;
    }

    try {
      if (id) {
        const updated = await window.API.updateCategory(id, { nome });
        Object.assign(window.DB.categories.find(c => c.id === id), updated);
        UI.toast(`Categoria "${updated.name}" atualizada.`, "success");
      } else {
        const created = await window.API.createCategory({ nome });
        window.DB.categories.push(created);
        UI.toast(`Categoria "${created.name}" criada.`, "success");
      }
      UI.closeModal("categoryModal");
      render();
      if (window.ProductsPage) window.ProductsPage.render();
      if (window.StockPage) window.StockPage.render();
      if (window.Dashboard) window.Dashboard.refresh();
    } catch (err) {
      console.error("Falha ao salvar categoria:", err);
      UI.toast(err.message || "NÃ£o foi possÃ­vel salvar a categoria.", "error");
    }
  }

  async function deleteCategory(id) {
    const category = window.DB.categories.find(c => c.id === id);
    if (!category) return;

    const ok = await UI.confirmDialog({
      title: "Remover categoria",
      text: `Remover "${category.name}"? Categorias com produtos ativos vinculados nÃ£o podem ser removidas.`,
      okLabel: "Remover"
    });
    if (!ok) return;

    try {
      await window.API.deleteCategory(id);
      window.DB.categories = window.DB.categories.filter(c => c.id !== id);
      UI.toast(`Categoria "${category.name}" removida.`, "success");
      render();
      if (window.ProductsPage) window.ProductsPage.render();
      if (window.StockPage) window.StockPage.render();
      if (window.Dashboard) window.Dashboard.refresh();
    } catch (err) {
      console.error("Falha ao remover categoria:", err);
      UI.toast(err.message || "NÃ£o foi possÃ­vel remover. Verifique se hÃ¡ produtos vinculados.", "error");
    }
  }

  function bindActions() {
    document.querySelectorAll("[data-edit-category]").forEach(button => {
      button.addEventListener("click", () => {
        const category = window.DB.categories.find(c => c.id === button.dataset.editCategory);
        openForm(category);
      });
    });

    document.querySelectorAll("[data-delete-category]").forEach(button => {
      button.addEventListener("click", () => deleteCategory(button.dataset.deleteCategory));
    });
  }

  function init() {
    document.getElementById("newCategoryBtn").addEventListener("click", () => openForm());
    document.getElementById("categoryForm")?.addEventListener("submit", saveCategory);
    document.getElementById("categoryModal")?.addEventListener("click", event => {
      if (event.target.id === "categoryModal") UI.closeModal("categoryModal");
    });
    render();
  }

  return { init, render };
})();


