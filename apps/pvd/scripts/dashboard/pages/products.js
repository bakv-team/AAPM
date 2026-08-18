/* Dashboard: página de produtos. */

window.ProductsPage = (function () {
  let page = Math.max(1, Number(window.AAPM_INITIAL_PAGE) || 1);
  const perPage = 10;
  let filters = { q: "", category: "", stock: "", status: "active" };
  let imageLibraryItems = [];
  let productsPageItems = [];
  let totalProducts = 0;

  function pageFromUrl() {
    const value = Number(new URLSearchParams(window.location.search).get("page"));
    return Number.isInteger(value) && value > 0 ? value : 1;
  }

  function syncPageToUrl(mode = "replace") {
    const url = new URL(window.location.href);
    if (page > 1) url.searchParams.set("page", String(page));
    else url.searchParams.delete("page");
    window.history[`${mode}State`](null, "", url);
  }


  async function loadProductsPage() {
    try {
      const result = await window.API.getProducts({ ...filters, offset: (page - 1) * perPage, limit: perPage });
      productsPageItems = result.items || [];
      totalProducts = Number(result.total) || 0;
      const lastPage = Math.max(1, Math.ceil(totalProducts / perPage));
      if (page > lastPage) {
        page = lastPage;
        syncPageToUrl();
        return loadProductsPage();
      }
    } catch (err) {
      console.error("Falha ao carregar produtos paginados:", err);
      UI.toast("Não foi possível carregar os produtos.", "error");
      productsPageItems = window.DB.products.slice((page - 1) * perPage, page * perPage);
      totalProducts = window.DB.products.length;
    }
  }

  function render() {
    const body = document.getElementById("productsBody");
    if (!body) return;
    const total = totalProducts;
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (page > pages) page = pages;
    const items = productsPageItems;

    if (!items.length) {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--text-mute)">Nenhum produto encontrado.</td></tr>`;
    } else {
      body.innerHTML = items.map(p => {
        const cat = window.DB.getCategory(p.categoryId);
        const catIndex = window.DB.categories.findIndex(c => c.id === p.categoryId);
        const color = UI.palette[(catIndex >= 0 ? catIndex : 0) % UI.palette.length];
        const s = UI.stockStatus(p);
        const active = p.ativo !== false;
        const variations = p.hasVariations ? (p.variations || []) : [];
        const variationPrices = variations.map(v => Number(v.price) || 0);
        const minVariationPrice = variationPrices.length ? Math.min(...variationPrices) : Number(p.price) || 0;
        const maxVariationPrice = variationPrices.length ? Math.max(...variationPrices) : Number(p.price) || 0;
        const totalVariationStock = variations.reduce((totalStock, variation) => totalStock + (Number(variation.stock) || 0), 0);
        const variationChips = variations.slice(0, 2).map(variation => {
          const label = [variation.size, variation.color].filter(Boolean).join(" · ") || "Opção";
          return `<span class="product-variation-chip">${UI.escapeHTML(label)}</span>`;
        }).join("") + (variations.length > 2 ? `<span class="product-variation-chip more">+${variations.length - 2}</span>` : "");
        const thumb = p.imageUrl
          ? `<div class="prod-thumb image"><img src="${p.imageUrl}" alt=""></div>`
          : `<div class="prod-thumb" style="background:linear-gradient(135deg, ${color}, ${color}aa)"><i class="fa-solid ${cat?.icon || "fa-box"}"></i></div>`;
        const actions = active
          ? `
                <button class="act-btn edit" data-action="edit" data-id="${p.id}" data-testid="edit-product-${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="act-btn deactivate" data-action="deactivate" data-id="${p.id}" data-testid="deactivate-product-${p.id}" title="Desativar"><i class="fa-solid fa-ban"></i></button>
                <button class="act-btn delete" data-action="delete" data-id="${p.id}" data-testid="delete-product-${p.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            `
          : `
                <button class="act-btn view" data-action="activate" data-id="${p.id}" data-testid="activate-product-${p.id}" title="Ativar"><i class="fa-solid fa-check"></i></button>
                <button class="act-btn delete" data-action="delete" data-id="${p.id}" data-testid="delete-product-${p.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            `;
        return `
          <tr data-id="${p.id}">
            <td>
              <div class="prod-cell">
                ${thumb}
                <div class="prod-name product-table-name">
                  <strong>${p.name}</strong>
                  ${variations.length
                    ? `<div class="product-table-variations"><span class="product-variation-count"><i class="fa-solid fa-shapes"></i>${variations.length} opç${variations.length === 1 ? "ão" : "ões"}</span>${variationChips}</div>`
                    : `<span class="product-simple-label">Produto simples</span>`}
                </div>
              </div>
            </td>
            <td><span class="pill gray">${cat?.name || "—"}</span></td>
            <td><div class="product-table-value"><strong>${variations.length && minVariationPrice !== maxVariationPrice ? `${UI.money(minVariationPrice)} – ${UI.money(maxVariationPrice)}` : UI.money(variations.length ? minVariationPrice : p.price)}</strong><span>${variations.length ? (minVariationPrice === maxVariationPrice ? "Mesmo preço" : "Faixa de preço") : "Preço unitário"}</span></div></td>
            <td><div class="product-table-value stock"><strong>${variations.length ? totalVariationStock : p.stock}<small> un.</small></strong><span>${variations.length ? `Somado em ${variations.length} opç${variations.length === 1 ? "ão" : "ões"}` : "Estoque atual"}</span></div></td>
            <td><span class="pill ${s.pill}">${s.label}</span></td>
            <td><span class="pill ${active ? "green" : "red"}">${active ? "Ativo" : "Inativo"}</span></td>
            <td class="right">
              <div class="actions-cell">
                ${actions}
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    document.getElementById("productsCount").textContent = `${total} produto${total === 1 ? "" : "s"}`;
    renderPager(pages);
    bindRowActions();
  }

  function renderPager(pages) {
    const pager = document.getElementById("productsPager");
    if (!pager) return;
    const btns = [];
    btns.push(`<button data-pg="prev"${page === 1 ? " disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>`);
    for (let i = 1; i <= pages; i++) {
      btns.push(`<button data-pg="${i}" class="${i === page ? "active" : ""}">${i}</button>`);
    }
    btns.push(`<button data-pg="next"${page === pages ? " disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`);
    pager.innerHTML = btns.join("");
    pager.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        const v = b.getAttribute("data-pg");
        if (v === "prev") page = Math.max(1, page - 1);
        else if (v === "next") page = Math.min(pages, page + 1);
        else page = Number(v);
        syncPageToUrl("push");
        loadProductsPage().then(render);
      });
    });
  }

  function bindRowActions() {
    document.querySelectorAll("#productsBody [data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === "edit") openProductForm(id);
        else if (btn.dataset.action === "deactivate") deactivateProduct(id);
        else if (btn.dataset.action === "delete") deleteProduct(id);
        else if (btn.dataset.action === "activate") activateProduct(id);
      });
    });
  }

  async function deactivateProduct(id) {
    const p = productsPageItems.find(item => String(item.id) === String(id)) || window.DB.getProduct(id);
    if (!p) return;
    const ok = await UI.confirmDialog({
      title: "Desativar produto",
      text: `Tem certeza que deseja desativar "${p.name}"? Ele sairá do PDV, mas poderá ser ativado novamente.`,
      okLabel: "Desativar"
    });
    if (!ok) return;

    try {
      const updated = await window.API.setProductActive(id, false);
      window.DB.products = window.DB.products.filter(item => String(item.id) !== String(id));
      if (filters.status === "active") {
        productsPageItems = productsPageItems.filter(item => String(item.id) !== String(id));
      } else {
        Object.assign(p, updated);
      }
      UI.toast(`Produto "${updated.name}" desativado.`, "success");
      await loadProductsPage();
      render();
      if (window.Dashboard) window.Dashboard.refresh();
      if (window.StockPage) window.StockPage.render();
    } catch (err) {
      console.error("Falha ao desativar produto:", err);
      UI.toast("Não foi possível desativar o produto.", "error");
    }
  }

  async function deleteProduct(id) {
    const p = productsPageItems.find(item => String(item.id) === String(id)) || window.DB.getProduct(id);
    if (!p) return;
    const ok = await UI.confirmDialog({
      title: "Excluir produto",
      text: `Tem certeza que deseja excluir "${p.name}"? O historico de vendas sera preservado.`,
      okLabel: "Excluir"
    });
    if (!ok) return;

    try {
      await window.API.deleteProduct(id);
      window.DB.products = window.DB.products.filter(x => String(x.id) !== String(id));
      productsPageItems = productsPageItems.filter(x => String(x.id) !== String(id));
      window.AAPMSound?.play("remove");
      window.AAPMSound?.suppressNextToast();
      UI.toast(`Produto "${p.name}" excluido.`, "success");
      await loadProductsPage();
      render();
      if (window.Dashboard) window.Dashboard.refresh();
      if (window.StockPage) window.StockPage.render();
    } catch (err) {
      console.error("Falha ao excluir produto:", err);
      UI.toast("Não foi possível excluir o produto.", "error");
    }
  }

  async function activateProduct(id) {
    const p = productsPageItems.find(item => String(item.id) === String(id));
    if (!p) return;

    try {
      const updated = await window.API.setProductActive(id, true);
      const existing = window.DB.products.find(item => String(item.id) === String(id));
      if (existing) Object.assign(existing, updated);
      else window.DB.products.push(updated);
      if (filters.status === "inactive") {
        productsPageItems = productsPageItems.filter(item => String(item.id) !== String(id));
      } else {
        Object.assign(p, updated);
      }
      UI.toast(`Produto "${updated.name}" ativado.`, "success");
      await loadProductsPage();
      render();
      if (window.Dashboard) window.Dashboard.refresh();
      if (window.StockPage) window.StockPage.render();
    } catch (err) {
      console.error("Falha ao ativar produto:", err);
      UI.toast("Não foi possível ativar o produto.", "error");
    }
  }

  function resetProductImageChoice(text = "Escolher imagem", hint = "PNG, JPG ou WEBP, com até 5 MB. Você também pode escolher uma imagem já salva.") {
    const fileInput = document.getElementById("productImage");
    const existingInput = document.getElementById("productExistingImage");
    const fileName = document.getElementById("productImageFileName");
    const imageHint = document.getElementById("productImageHint");
    if (fileInput) fileInput.value = "";
    if (existingInput) existingInput.value = "";
    if (fileName) fileName.textContent = text;
    if (imageHint) imageHint.textContent = hint;
  }

  function handleProductImageFileChange(event) {
    const file = event.target.files?.[0];
    const existingInput = document.getElementById("productExistingImage");
    const fileName = document.getElementById("productImageFileName");
    const imageHint = document.getElementById("productImageHint");
    if (existingInput) existingInput.value = "";
    if (fileName) fileName.textContent = file ? file.name : "Escolher imagem";
    if (imageHint) {
      imageHint.textContent = file
        ? "Imagem nova selecionada. Ela sera salva no projeto ao cadastrar o produto."
        : "PNG, JPG ou WEBP, com até 5 MB. Você também pode escolher uma imagem ja salva.";
    }
  }

  function chooseExistingImage(image) {
    const fileInput = document.getElementById("productImage");
    const existingInput = document.getElementById("productExistingImage");
    const fileName = document.getElementById("productImageFileName");
    const imageHint = document.getElementById("productImageHint");
    if (fileInput) fileInput.value = "";
    if (existingInput) existingInput.value = image.path || "";
    if (fileName) fileName.textContent = image.name || "Imagem da galeria";
    if (imageHint) imageHint.textContent = "Imagem selecionada da galeria do projeto.";
    UI.closeModal("imageLibraryModal");
  }

  function renderImageLibrary(images, term = "") {
    const grid = document.getElementById("imageLibraryGrid");
    if (!grid) return;
    const query = term.trim().toLowerCase();
    const visibleImages = query
      ? images.filter(image => `${image.name || ""} ${image.path || ""}`.toLowerCase().includes(query))
      : images;
    grid.innerHTML = "";
    if (!visibleImages.length) {
      const empty = document.createElement("div");
      empty.className = "image-library-empty";
      empty.textContent = images.length
        ? "Nenhuma imagem encontrada com esse nome."
        : "Nenhuma imagem encontrada em database/static/uploads.";
      grid.appendChild(empty);
      return;
    }
    visibleImages.forEach(image => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "image-library-item";
      const preview = document.createElement("img");
      preview.src = image.url;
      preview.alt = image.name || "Imagem do produto";
      preview.loading = "lazy";
      const name = document.createElement("span");
      name.textContent = image.name || image.path;
      button.append(preview, name);
      button.addEventListener("click", () => chooseExistingImage(image));
      grid.appendChild(button);
    });
  }

  async function openImageLibrary() {
    const grid = document.getElementById("imageLibraryGrid");
    const search = document.getElementById("imageLibrarySearch");
    if (search) search.value = "";
    if (grid) grid.innerHTML = `<div class="image-library-empty">Carregando imagens...</div>`;
    UI.openModal("imageLibraryModal");
    try {
      imageLibraryItems = await window.API.getProductImages();
      renderImageLibrary(imageLibraryItems);
    } catch (err) {
      console.error("Falha ao carregar galeria de produtos:", err);
      if (grid) grid.innerHTML = `<div class="image-library-empty">Não foi possível carregar as imagens.</div>`;
      UI.toast("Não foi possível abrir a galeria de imagens.", "error");
    }
  }

  function addProductVariationRow(variation = {}) {
    const list = document.getElementById("productVariations");
    const row = document.createElement("div");
    row.className = "product-variation-row";
    row.innerHTML = `
      <label data-mobile-label="Tamanho"><span class="sr-only">Tamanho (opcional)</span><input type="text" data-variation-size list="productSizeSuggestions" maxlength="50" placeholder="Ex.: M"></label>
      <label data-mobile-label="Cor"><span class="sr-only">Cor (opcional)</span><input type="text" data-variation-color list="productColorSuggestions" maxlength="50" placeholder="Ex.: Azul"></label>
      <label data-mobile-label="Preço"><span class="sr-only">Preço</span><div class="variation-number-field"><span class="variation-number-prefix">R$</span><input type="number" data-variation-price min="0" step="0.01" placeholder="0,00" required><span class="variation-number-controls"><button type="button" data-variation-step="up" aria-label="Aumentar preço"><i class="fa-solid fa-chevron-up"></i></button><button type="button" data-variation-step="down" aria-label="Diminuir preço"><i class="fa-solid fa-chevron-down"></i></button></span></div></label>
      <label data-mobile-label="Estoque"><span class="sr-only">Estoque</span><div class="variation-number-field"><input type="number" data-variation-stock min="0" step="1" placeholder="0" required><span class="variation-number-controls"><button type="button" data-variation-step="up" aria-label="Aumentar estoque"><i class="fa-solid fa-chevron-up"></i></button><button type="button" data-variation-step="down" aria-label="Diminuir estoque"><i class="fa-solid fa-chevron-down"></i></button></span></div></label>
      <div class="variation-row-actions">
        <button type="button" class="act-btn variation-duplicate" data-duplicate-variation title="Duplicar opção" aria-label="Duplicar opção"><i class="fa-regular fa-copy"></i></button>
        <button type="button" class="act-btn delete variation-remove" data-remove-variation title="Remover opção" aria-label="Remover opção"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    row.querySelector("[data-variation-size]").value = variation.size || variation.tamanho || "";
    row.querySelector("[data-variation-color]").value = variation.color || variation.cor || "";
    row.querySelector("[data-variation-price]").value = variation.price ?? variation.preco ?? document.getElementById("productPrice").value ?? "";
    row.querySelector("[data-variation-stock]").value = variation.stock ?? variation.estoque_atual ?? 0;
    list.appendChild(row);
    row.querySelectorAll("[data-variation-size], [data-variation-color]").forEach(input => {
      input.addEventListener("input", () => updateVariationRowLabels());
    });
    updateVariationFieldState();
    requestAnimationFrame(() => row.classList.add("is-visible"));
    if (!variation.id && !variation.size && !variation.tamanho && !variation.color && !variation.cor) {
      row.querySelector("[data-variation-size]")?.focus({ preventScroll: true });
    }
  }

  function updateVariationRowLabels() {
    document.querySelectorAll(".product-variation-row").forEach((row, index) => {
      const size = row.querySelector("[data-variation-size]")?.value.trim();
      const color = row.querySelector("[data-variation-color]")?.value.trim();
      row.setAttribute("aria-label", `Opção ${index + 1}: ${[size, color].filter(Boolean).join(", ") || "sem identificação"}`);
    });
    renderProductVariationSummary();
  }

  function renderProductVariationSummary() {
    const rows = [...document.querySelectorAll(".product-variation-row")];
    const summary = document.getElementById("productVariationSummary");
    const title = document.getElementById("productVariationSummaryTitle");
    const chips = document.getElementById("productVariationSummaryChips");
    const footerCount = document.getElementById("productVariationFooterCount");
    if (!summary || !title || !chips) return;
    summary.hidden = rows.length === 0;
    title.textContent = `${rows.length} combinaç${rows.length === 1 ? "ão" : "ões"}`;
    if (footerCount) footerCount.textContent = `${rows.length} combinaç${rows.length === 1 ? "ão configurada" : "ões configuradas"}`;
    chips.replaceChildren();
    rows.slice(0, 3).forEach((row, index) => {
      const size = row.querySelector("[data-variation-size]")?.value.trim();
      const color = row.querySelector("[data-variation-color]")?.value.trim();
      const chip = document.createElement("span");
      chip.textContent = [size, color].filter(Boolean).join(" · ") || `Combinação ${index + 1}`;
      chips.appendChild(chip);
    });
    if (rows.length > 3) {
      const more = document.createElement("span");
      more.className = "is-more";
      more.textContent = `+${rows.length - 3}`;
      chips.appendChild(more);
    }
  }

  function setProductVariations(variations) {
    document.getElementById("productVariations").replaceChildren();
    (variations || []).forEach(addProductVariationRow);
    updateVariationFieldState();
  }

  function readProductVariations() {
    return [...document.querySelectorAll(".product-variation-row")].map(row => ({
      size: row.querySelector("[data-variation-size]").value.trim(),
      color: row.querySelector("[data-variation-color]").value.trim(),
      price: Number(row.querySelector("[data-variation-price]").value),
      stock: Number(row.querySelector("[data-variation-stock]").value)
    }));
  }

  function updateVariationFieldState() {
    const count = document.querySelectorAll(".product-variation-row").length;
    const hint = document.getElementById("productVariationHint");
    const countBadge = document.getElementById("productVariationCount");
    const list = document.getElementById("productVariations");
    const hasVariations = count > 0;
    const typeButtons = document.querySelectorAll("[data-product-type]");
    document.getElementById("productBasePriceField").hidden = hasVariations;
    document.getElementById("productBaseStockField").hidden = hasVariations;
    document.getElementById("productPrice").required = !hasVariations;
    document.getElementById("productStock").required = !hasVariations;
    typeButtons.forEach(button => {
      const active = button.dataset.productType === (hasVariations ? "variations" : "simple");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (countBadge) {
      countBadge.textContent = count;
    }
    updateVariationRowLabels();
    if (hint) hint.textContent = hasVariations
      ? `${count} variação${count === 1 ? "" : "ões"}. Preço e estoque são definidos somente em cada combinação.`
      : "Crie opções por tamanho ou cor; sem variações, o preço e o estoque gerais serão usados.";
  }

  function openProductForm(id) {
    const titleEl = document.getElementById("productModalTitle");
    const catSel = document.getElementById("productCategory");
    catSel.innerHTML = window.DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    if (id) {
      const p = productsPageItems.find(item => String(item.id) === String(id)) || window.DB.getProduct(id);
      if (!p || p.ativo === false) return;
      titleEl.textContent = "Editar produto";
      document.getElementById("productId").value = p.id;
      document.getElementById("productName").value = p.name;
      document.getElementById("productCategory").value = p.categoryId;
      document.getElementById("productPrice").value = p.price;
      document.getElementById("productStock").value = p.stock;
      setProductVariations(p.variations || p.variacoes || []);
      resetProductImageChoice(
        p.imageUrl ? "Manter imagem atual" : "Escolher imagem",
        p.imageUrl ? "Imagem atual mantida. Escolha outra se quiser trocar." : "PNG, JPG ou WEBP, com até 5 MB. Você também pode escolher uma imagem já salva."
      );
      document.getElementById("productDesc").value = p.description || "";
    } else {
      titleEl.textContent = "Novo produto";
      document.getElementById("productForm").reset();
      document.getElementById("productId").value = "";
      setProductVariations([]);
      resetProductImageChoice();
    }
    UI.openModal("productModal");
  }

  async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById("productId").value;
    const data = {
      name: document.getElementById("productName").value.trim(),
      categoryId: document.getElementById("productCategory").value,
      price: parseFloat(document.getElementById("productPrice").value) || 0,
      stock: parseInt(document.getElementById("productStock").value, 10) || 0,
      description: document.getElementById("productDesc").value.trim(),
      image: document.getElementById("productImage").files[0] || null,
      existingImage: document.getElementById("productExistingImage").value || ""
    };
    data.variations = readProductVariations();
    if (!data.name) { UI.toast("Informe o nome do produto.", "error"); return; }
    if (data.stock < 0) { UI.toast("O estoque não pode ser negativo.", "error"); return; }
    const variationRows = [...document.querySelectorAll(".product-variation-row")];
    const invalidVariationRow = variationRows.find(row => {
      const price = row.querySelector("[data-variation-price]");
      const stock = row.querySelector("[data-variation-stock]");
      const size = row.querySelector("[data-variation-size]").value.trim();
      const color = row.querySelector("[data-variation-color]").value.trim();
      return (!size && !color) || !price.value || !stock.value || !price.checkValidity() || !stock.checkValidity();
    });
    if (invalidVariationRow) {
      UI.toast("Revise tamanho/cor, preço e estoque das variações.", "error");
      UI.openModal("productVariationsModal");
      invalidVariationRow.querySelector(":invalid, [data-variation-size]")?.focus();
      return;
    }

    try {
      if (id) {
        const updated = await window.API.updateProduct(id, data);
        Object.assign(window.DB.getProduct(id), updated);
        const localProduct = productsPageItems.find(p => String(p.id) === String(id));
        if (localProduct) Object.assign(localProduct, updated);
        UI.toast(`Produto "${data.name}" atualizado.`, "success");
      } else {
        const created = await window.API.createProduct(data);
        const existing = window.DB.products.find(product => String(product.id) === String(created.id));
        if (existing) {
          Object.assign(existing, created);
          const pageProduct = productsPageItems.find(product => String(product.id) === String(created.id));
          if (pageProduct) Object.assign(pageProduct, created);
          else if (filters.status !== "inactive") productsPageItems.push(created);
        } else {
          window.DB.products.push(created);
          if (filters.status !== "inactive") productsPageItems.push(created);
        }
        window.AAPMSound?.play("add");
        window.AAPMSound?.suppressNextToast();
        UI.toast(existing ? `Nova variação adicionada a "${data.name}".` : `Produto "${data.name}" criado.`, "success");
      }
    } catch (err) {
      console.error("Falha ao salvar produto:", err);
      UI.toast(err.message || "Não foi possível salvar o produto.", "error");
      return;
    }
    UI.closeModal("productModal");
    await loadProductsPage();
    render();
    if (window.Dashboard) window.Dashboard.refresh();
    if (window.StockPage) window.StockPage.render();
  }

  function init() {
    const sel = document.getElementById("productCategoryFilter");
    totalProducts = window.DB.products.length;

    sel.innerHTML = `<option value="">Todas categorias</option>` +
      window.DB.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    document.getElementById("productSearch").addEventListener("input", e => {
      filters.q = e.target.value; page = 1; syncPageToUrl(); loadProductsPage().then(render);
    });
    sel.addEventListener("change", e => { filters.category = e.target.value; page = 1; syncPageToUrl(); loadProductsPage().then(render); });
    document.getElementById("productStockFilter").addEventListener("change", e => {
      filters.stock = e.target.value; page = 1; syncPageToUrl(); loadProductsPage().then(render);
    });
    document.getElementById("productStatusFilter").addEventListener("change", async e => {
      filters.status = e.target.value;
      page = 1;
      syncPageToUrl();
      await loadProductsPage();
      render();
    });

    document.getElementById("newProductBtn").addEventListener("click", () => openProductForm());
    document.getElementById("productForm").addEventListener("submit", saveProduct);
    document.getElementById("productImage").addEventListener("change", handleProductImageFileChange);
    document.getElementById("openImageLibrary").addEventListener("click", openImageLibrary);
    document.getElementById("addProductVariation").addEventListener("click", () => addProductVariationRow());
    document.querySelectorAll("[data-product-type]").forEach(button => {
      button.addEventListener("click", async () => {
        if (button.dataset.productType === "variations") {
          if (!document.querySelector(".product-variation-row")) addProductVariationRow();
          UI.openModal("productVariationsModal");
          return;
        }
        if (document.querySelector(".product-variation-row")) {
          const confirmed = await UI.confirmDialog({
            title: "Voltar para produto simples?",
            text: "As combinações configuradas serão removidas. O produto voltará a usar apenas um preço e um estoque.",
            okLabel: "Voltar para simples",
            cancelLabel: "Manter variações"
          });
          if (!confirmed) return;
        }
        setProductVariations([]);
      });
    });
    document.getElementById("manageProductVariations").addEventListener("click", () => UI.openModal("productVariationsModal"));
    document.getElementById("productVariations").addEventListener("click", event => {
      const stepButton = event.target.closest("[data-variation-step]");
      if (stepButton) {
        const input = stepButton.closest(".variation-number-field")?.querySelector("input[type=number]");
        if (input) {
          stepButton.dataset.variationStep === "up" ? input.stepUp() : input.stepDown();
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      }
      const remove = event.target.closest("[data-remove-variation]");
      if (remove) {
        const row = remove.closest(".product-variation-row");
        row?.classList.add("is-removing");
        setTimeout(() => {
          row?.remove();
          updateVariationFieldState();
        }, 180);
        return;
      }
      const duplicate = event.target.closest("[data-duplicate-variation]");
      if (duplicate) {
        const row = duplicate.closest(".product-variation-row");
        addProductVariationRow({
          size: row.querySelector("[data-variation-size]").value,
          color: row.querySelector("[data-variation-color]").value,
          price: row.querySelector("[data-variation-price]").value,
          stock: row.querySelector("[data-variation-stock]").value
        });
      }
    });
    document.getElementById("imageLibrarySearch").addEventListener("input", e => {
      renderImageLibrary(imageLibraryItems, e.target.value);
    });

    document.getElementById("exportProducts").addEventListener("click", async () => {
      const rows = [["Nome", "Variações", "Categoria", "Preço", "Estoque", "Situação"]];
      const exportItems = await window.API.getProducts(filters);
      exportItems.forEach(p => {
        rows.push([p.name, (p.variations || []).map(v => [v.size, v.color].filter(Boolean).join(" / ")).join("; "), window.DB.getCategory(p.categoryId)?.name || "", p.price.toFixed(2).replace(".", ","), p.stock, p.ativo !== false ? "Ativo" : "Inativo"]);
      });
      UI.downloadCSV("produtos.csv", rows);
      UI.toast("Exportação CSV gerada.", "success");
    });

    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => UI.closeModal(btn.getAttribute("data-close-modal")));
    });
    document.getElementById("productModal").addEventListener("click", e => {
      if (e.target.id === "productModal") UI.closeModal("productModal");
    });
    document.getElementById("productVariationsModal").addEventListener("click", e => {
      if (e.target.id === "productVariationsModal") UI.closeModal("productVariationsModal");
    });
    document.getElementById("imageLibraryModal").addEventListener("click", e => {
      if (e.target.id === "imageLibraryModal") UI.closeModal("imageLibraryModal");
    });

    window.addEventListener("popstate", () => {
      const nextPage = pageFromUrl();
      if (nextPage === page) return;
      page = nextPage;
      loadProductsPage().then(render);
    });

    loadProductsPage().then(render);
  }

  return { init, render, openProductForm };
})();


