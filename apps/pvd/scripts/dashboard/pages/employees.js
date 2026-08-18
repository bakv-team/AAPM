/* Dashboard: página de funcionários. */

window.EmployeesPage = (function () {
  function rows() {
    return Array.from(document.querySelectorAll("[data-employee-row]"));
  }

  function render() {
    const q = (document.getElementById("employeeSearch")?.value || "").trim().toLowerCase();
    const role = document.getElementById("employeeRoleFilter")?.value || "";
    const active = document.getElementById("employeeStatusFilter")?.value || "";
    let visible = 0;

    rows().forEach(row => {
      const matches =
        (!q || row.dataset.name.includes(q) || row.dataset.email.includes(q)) &&
        (!role || row.dataset.role === role) &&
        (!active || row.dataset.active === active);

      row.style.display = matches ? "" : "none";
      row.dataset.paginationEligible = String(matches);
      if (matches) visible += 1;
    });

    const count = document.getElementById("employeesCount");
    if (count) count.textContent = `${visible} funcionÃ¡rio${visible === 1 ? "" : "s"}`;

    const empty = document.getElementById("employeesEmptyRow");
    if (empty) empty.style.display = rows().length && visible === 0 ? "" : "none";
    UI.paginateTable(document.getElementById("employeesBody"), "employees");
  }

  function openForm(employee = null) {
    const form = document.getElementById("employeeForm");
    const password = document.getElementById("employeePassword");
    const roleSelect = document.getElementById("employeeRole");
    if (!form || !password) return;

    form.reset();
    document.querySelectorAll("#employeePermissionsFieldset input[type='checkbox']").forEach(input => {
      input.checked = false;
      input.disabled = false;
    });
    if (employee) {
      form.action = `/usuarios/${employee.id}/editar`;
      document.getElementById("employeeModalTitle").textContent = "Editar funcionÃ¡rio";
      document.getElementById("employeeName").value = employee.name || "";
      document.getElementById("employeeEmail").value = employee.email || "";
      document.getElementById("employeeRole").value = employee.role === "admin" ? "admin" : "funcionario";
      const permissions = new Set((employee.permissions || "").split(",").filter(Boolean));
      document.querySelectorAll("#employeePermissionsFieldset input[type='checkbox']").forEach(input => {
        input.checked = permissions.has(input.value) || (permissions.has("stock_movements") && (input.value === "stock" || input.value === "movements"));
      });
      syncLinkedPermissionInputs();
      password.required = false;
      password.placeholder = "Deixe em branco para manter";
    } else {
      form.action = "/usuarios/novo";
      document.getElementById("employeeModalTitle").textContent = "Novo funcionÃ¡rio";
      document.getElementById("employeeRole").value = "funcionario";
      password.required = true;
      password.placeholder = "";
    }
    syncPermissionFieldset(roleSelect?.value || "funcionario");
    UI.openModal("employeeModal");
  }

  function syncLinkedPermissionInputs(source = null) {
    const fieldset = document.getElementById("employeePermissionsFieldset");
    if (!fieldset) return;
    const key = source?.dataset.linkedPermission;
    if (!key) {
      const grouped = new Map();
      fieldset.querySelectorAll("input[data-linked-permission]").forEach(input => {
        const group = grouped.get(input.dataset.linkedPermission) || [];
        group.push(input);
        grouped.set(input.dataset.linkedPermission, group);
      });
      grouped.forEach(inputs => {
        const checked = inputs.some(input => input.checked);
        inputs.forEach(input => {
          input.checked = checked;
        });
      });
      return;
    }
    fieldset.querySelectorAll(`input[data-linked-permission="${key}"]`).forEach(input => {
      input.checked = source.checked;
    });
  }

  function syncPermissionFieldset(role) {
    const isAdmin = role === "admin";
    document.querySelectorAll("#employeePermissionsFieldset input[type='checkbox']").forEach(input => {
      input.disabled = isAdmin;
      if (isAdmin) input.checked = false;
    });
  }

  function init() {
    if (!document.getElementById("page-funcionarios")) return;

    ["employeeSearch", "employeeRoleFilter", "employeeStatusFilter"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", render);
      document.getElementById(id)?.addEventListener("change", render);
    });

    document.getElementById("newEmployeeBtn")?.addEventListener("click", () => openForm());

    document.querySelectorAll("[data-edit-employee]").forEach(button => {
      button.addEventListener("click", () => openForm({
        id: button.dataset.id,
        name: button.dataset.name,
        email: button.dataset.email,
        role: button.dataset.role,
        permissions: button.dataset.permissions || ""
      }));
    });

    document.getElementById("employeeRole")?.addEventListener("change", event => {
      syncPermissionFieldset(event.target.value);
    });

    document.getElementById("employeePermissionsFieldset")?.addEventListener("change", event => {
      if (event.target.matches("input[data-linked-permission]")) {
        syncLinkedPermissionInputs(event.target);
      }
    });

    document.querySelectorAll("[data-employee-confirm]").forEach(form => {
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const ok = await UI.confirmDialog({
          title: "Alterar acesso",
          text: form.dataset.employeeConfirm,
          okLabel: "Confirmar"
        });
        if (ok) form.submit();
      });
    });

    document.getElementById("employeeModal")?.addEventListener("click", event => {
      if (event.target.id === "employeeModal") UI.closeModal("employeeModal");
    });

    render();
  }

  return { init, render };
})();



