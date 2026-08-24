/* Dashboard: página de controle de armários. */

window.LockersPage = (function () {
  let lockers = [];
  let associates = [];
  let page = 1;
  const perPage = 10;
  let total = 0;
  let summary = { total: 0, disponiveis: 0, alugados: 0 };

  const $ = id => document.getElementById(id);
  const escape = value => UI.escapeHTML(String(value || ""));

  async function load() {
    const result = await window.API.getLockers({
      status: $("lockerStatusFilter")?.value,
      location: $("lockerLocationFilter")?.value,
      includeInactive: $("lockerIncludeInactive")?.checked,
      offset: (page - 1) * perPage,
      limit: perPage
    });
    lockers = result.armarios || [];
    summary = result.resumo || summary;
    total = Number(result.total) || 0;
    updateLocations(result.localizacoes || []);
  }

  function updateLocations(locations) {
    const select = $("lockerLocationFilter");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Todas as localizações</option>${locations.map(location => `<option value="${escape(location)}">${escape(location)}</option>`).join("")}`;
    select.value = locations.includes(current) ? current : "";
  }

  function statusPill(locker) {
    if (!locker.ativo || locker.status === "inativo") return '<span class="pill gray">Inativo</span>';
    return locker.status === "alugado"
      ? '<span class="pill orange">Alugado</span>'
      : '<span class="pill green">Disponível</span>';
  }

  function filteredLockers() {
    const query = ($("lockerSearch")?.value || "").trim().toLowerCase();
    if (!query) return lockers;
    return lockers.filter(locker => [locker.numero, locker.localizacao, locker.locatario_nome, locker.semestre]
      .some(value => String(value || "").toLowerCase().includes(query)));
  }

  function render() {
    const body = $("lockersBody");
    if (!body) return;
    $("lockersTotal").textContent = summary.total || 0;
    $("lockersAvailable").textContent = summary.disponiveis || 0;
    $("lockersRented").textContent = summary.alugados || 0;

    const items = filteredLockers();
    $("lockersCount").textContent = `${total} armário${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`;
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--text-mute)">Nenhum armário encontrado.</td></tr>';
      UI.renderServerPager(body.closest(".table-wrap"), "lockers", page, total, perPage, nextPage => { page = nextPage; refresh(); });
      return;
    }
    body.innerHTML = items.map(locker => {
      const active = locker.ativo !== false;
      const rented = locker.status === "alugado";
      const primary = active && !rented
        ? `<button class="act-btn rent" data-locker-action="rent" data-id="${locker.id}" title="Alugar"><i class="fa-solid fa-key"></i></button>`
        : rented
          ? `<button class="act-btn release" data-locker-action="release" data-id="${locker.id}" title="Liberar"><i class="fa-solid fa-lock-open"></i></button>`
          : "";
      return `<tr>
        <td><div class="locker-number"><i class="fa-solid fa-box-archive"></i><div><strong>${escape(locker.numero)}</strong><small>${escape(locker.observacao || "Sem observação")}</small></div></div></td>
        <td>${escape(locker.localizacao || "Não informada")}</td>
        <td>${rented ? escape(locker.locatario_nome) : "—"}</td>
        <td>${rented ? escape(locker.semestre) : "—"}</td>
        <td>${statusPill(locker)}</td>
        <td class="right"><div class="actions-cell">${primary}<button class="act-btn edit" data-locker-action="edit" data-id="${locker.id}" title="Editar"><i class="fa-solid fa-pen"></i></button><button class="act-btn ${active ? "deactivate" : "view"}" data-locker-action="toggle" data-id="${locker.id}" title="${active ? "Desativar" : "Reativar"}"><i class="fa-solid ${active ? "fa-ban" : "fa-check"}"></i></button></div></td>
      </tr>`;
    }).join("");
    body.querySelectorAll("[data-locker-action]").forEach(button => button.addEventListener("click", () => handleAction(button.dataset.lockerAction, button.dataset.id)));
    UI.renderServerPager(body.closest(".table-wrap"), "lockers", page, total, perPage, nextPage => { page = nextPage; refresh(); });
  }

  function openLockerForm(locker = null) {
    $("lockerForm").reset();
    $("lockerId").value = locker?.id || "";
    $("lockerModalTitle").textContent = locker ? `Editar armário ${locker.numero}` : "Novo armário";
    $("lockerNumber").value = locker?.numero || "";
    $("lockerLocation").value = locker?.localizacao || "";
    $("lockerNote").value = locker?.observacao || "";
    UI.openModal("lockerModal");
  }

  async function openRentalForm(locker) {
    $("lockerRentalForm").reset();
    $("lockerRentalId").value = locker.id;
    $("lockerRentalDescription").textContent = `Você está validando o aluguel do armário ${locker.numero}${locker.localizacao ? ` — ${locker.localizacao}` : ""}.`;
    const tenant = $("lockerTenant");
    tenant.innerHTML = '<option value="">Carregando associados...</option>';
    UI.openModal("lockerRentalModal");
    try {
      associates = await window.API.getCustomers();
      const eligible = associates.filter(customer => customer.isAssociado === true);
      tenant.innerHTML = `<option value="">Selecione o associado</option>${eligible.map(customer => `<option value="${escape(customer.name)}" data-customer-id="${customer.id}">${escape(customer.name)}${customer.matricula ? ` — ${escape(customer.matricula)}` : ""}</option>`).join("")}`;
      if (!eligible.length) tenant.innerHTML = '<option value="">Não há associados elegíveis</option>';
    } catch (error) {
      tenant.innerHTML = '<option value="">Não foi possível carregar associados</option>';
      UI.toast(error.message || "Não foi possível carregar os associados.", "error");
    }
  }

  async function handleAction(action, id) {
    const locker = lockers.find(item => String(item.id) === String(id));
    if (!locker) return;
    if (action === "edit") return openLockerForm(locker);
    if (action === "rent") return openRentalForm(locker);
    const release = action === "release";
    const ok = await UI.confirmDialog({
      title: release ? "Liberar armário" : (locker.ativo ? "Desativar armário" : "Reativar armário"),
      text: release ? `Confirmar a liberação do armário ${locker.numero}?` : `Confirmar que deseja ${locker.ativo ? "desativar" : "reativar"} o armário ${locker.numero}?`,
      okLabel: release ? "Liberar" : (locker.ativo ? "Desativar" : "Reativar")
    });
    if (!ok) return;
    try {
      if (release) await window.API.releaseLocker(id);
      else await window.API.toggleLockerActive(id);
      UI.toast(`Armário ${locker.numero} atualizado.`, "success");
      await refresh();
    } catch (error) { UI.toast(error.message || "Não foi possível atualizar o armário.", "error"); }
  }

  async function refresh() {
    try { await load(); render(); }
    catch (error) { console.error("Falha ao carregar armários:", error); UI.toast(error.message || "Não foi possível carregar os armários.", "error"); }
  }

  function init() {
    $("lockerSearch")?.addEventListener("input", render);
    ["lockerStatusFilter", "lockerLocationFilter", "lockerIncludeInactive"].forEach(id => $(id)?.addEventListener("change", () => { page = 1; refresh(); }));
    $("newLockerBtn")?.addEventListener("click", () => openLockerForm());
    $("lockerForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const id = $("lockerId").value;
      const payload = { numero: $("lockerNumber").value, localizacao: $("lockerLocation").value, observacao: $("lockerNote").value };
      try {
        if (id) await window.API.updateLocker(id, payload); else await window.API.createLocker(payload);
        UI.closeModal("lockerModal"); UI.toast(`Armário ${id ? "atualizado" : "cadastrado"}.`, "success"); await refresh();
      } catch (error) { UI.toast(error.message || "Não foi possível salvar o armário.", "error"); }
    });
    $("lockerRentalForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const id = $("lockerRentalId").value;
      try {
        const selected = $("lockerTenant").selectedOptions[0];
        if (!selected?.dataset.customerId) throw new Error("Selecione um associado elegível.");
        await window.API.rentLocker(id, { locatario_nome: $("lockerTenant").value, semestre: $("lockerSemester").value, observacao: $("lockerRentalNote").value });
        UI.closeModal("lockerRentalModal"); UI.toast("Aluguel validado com sucesso.", "success"); await refresh();
      } catch (error) { UI.toast(error.message || "Não foi possível validar o aluguel.", "error"); }
    });
    refresh();
  }

  return { init, render: refresh };
})();
