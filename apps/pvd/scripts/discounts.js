/* Shared discount management and purchase selection. */
window.PurchaseDiscounts = (() => {
  let rules = [], selected = new Set(), manual = {tipo:'percentual', valor:0};
  const admin = Boolean(document.getElementById('productStatusFilter'));
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => Number(value).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const context = () => window.discountContext?.() || {gross:0, quantity:0, payment:''};
  const eligible = d => { const c = context(); return c.gross >= d.minimo && c.quantity >= d.quantidade && (!d.pagamento || c.payment === d.pagamento); };
  const active = () => rules.filter(d => selected.has(d.id) && eligible(d));
  const afterRules = net => active().reduce((total,d) => Math.max(0, Math.round((total - (d.tipo === 'percentual' ? total*d.valor/100 : d.valor))*100)/100), net);
  const amount = net => {
    const afterRulesTotal = afterRules(net);
    const cut = manual.tipo === 'percentual' ? afterRulesTotal*manual.valor/100 : manual.valor;
    return Math.max(0, Math.round((afterRulesTotal-cut)*100)/100);
  };
  async function request(method='GET', data=null, suffix='') {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('csrf_token='));
    const response = await fetch('/api/v1/pdv/discounts'+suffix, {method, credentials:'same-origin', headers:{'Content-Type':'application/json','X-CSRF-Token':cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''}, ...(data ? {body:JSON.stringify(data)} : {})});
    if (!response.ok) { const error = await response.json().catch(()=>({})); throw new Error(typeof error.detail === 'string' ? error.detail : 'Confira os valores informados.'); }
    return response.json();
  }
  function notify(message) { const el = document.getElementById('discountMessage'); if(el) el.textContent = message; }
  function refresh() { window.refreshPurchaseDiscounts?.(); render(); }
  function render() {
    const list = document.getElementById('discountRules'); if (!list) return;
    list.innerHTML = rules.length ? rules.map(d => `<div class="discount-rule"><div><strong>${esc(d.nome)}</strong><p>${d.tipo === 'percentual' ? `${d.valor}%` : money(d.valor)} de desconto</p><small>Compra a partir de ${money(d.minimo)} · ${d.quantidade} item(ns)${d.pagamento ? ' · '+esc(d.pagamento) : ''}</small>${!admin ? `<small class="discount-condition">${eligible(d) ? 'Condições atendidas' : 'Condições ainda não atendidas'}</small>` : ''}</div>${admin ? `<button type="button" class="ghost-btn" data-remove-discount="${d.id}" aria-label="Remover ${esc(d.nome)}"><i class="fa-solid fa-trash"></i></button>` : `<label class="discount-choice"><input type="checkbox" data-select-discount="${d.id}" ${selected.has(d.id) ? 'checked' : ''} ${eligible(d) ? '' : 'disabled'}> Aplicar</label>`}</div>`).join('') : '<p class="muted">Nenhum desconto cadastrado.</p>';
    const status = document.getElementById('purchaseDiscountStatus'); if(status) status.textContent = active().length || manual.valor ? 'Desconto aplicado' : 'Adicionar desconto à compra';
    const manualForm = document.getElementById('purchaseManualDiscount');
    if (manualForm) { manualForm.elements.tipo.value = manual.tipo; manualForm.elements.valor.value = String(manual.valor); }
  }
  async function open() {
    const dialog = document.getElementById('discountDialog');
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    notify('Carregando descontos...');
    try { rules = await request(); notify(''); refresh(); } catch(e) {notify(e.message);}
  }
  function init() {
    const button = document.createElement('button'); button.type='button'; button.className=admin ? 'ghost-btn' : 'discount-purchase-button';
    button.innerHTML='<i class="fa-solid fa-tags"></i> Descontos'+(admin ? '' : ' <small id="purchaseDiscountStatus">Selecionar descontos</small>');
    if(admin) document.getElementById('productStatusFilter').after(button);
    else { const anchor = document.getElementById('paymentExceptionBox'); if(!anchor) return; anchor.after(button); }
    button.addEventListener('click',open);
    document.body.insertAdjacentHTML('beforeend', `<dialog id="discountDialog" class="discount-dialog"><div class="discount-dialog-head"><h3><i class="fa-solid fa-tags"></i> ${admin ? 'Gerenciar descontos' : 'Descontos da compra'}</h3><button type="button" class="ghost-btn" id="closeDiscountDialog" aria-label="Fechar">×</button></div><p class="muted">${admin ? 'Cadastre um percentual ou valor em dinheiro e suas condições.' : 'Descontos válidos são somados ao benefício de associado. O valor fixo é aplicado uma vez por compra.'}</p><p role="status" id="discountMessage"></p><div id="discountRules"></div>${admin ? `<form id="discountForm" class="discount-form"><label>Nome<input name="nome" required maxlength="80" placeholder="Ex.: Volta às aulas"></label><label>Tipo<select name="tipo"><option value="percentual">Porcentagem (%)</option><option value="fixo">Dinheiro (R$)</option></select></label><label>Valor<input name="valor" type="number" min="0.01" max="100" step="0.01" required></label><label>Compra mínima (R$)<input name="minimo" type="number" min="0" step="0.01" value="0" required></label><label>Quantidade mínima<input name="quantidade" type="number" min="1" step="1" value="1" required></label><label>Forma de pagamento<select name="pagamento"><option value="">Qualquer forma</option><option value="pix">Pix</option><option value="debito">Débito</option><option value="credito">Crédito</option><option value="dinheiro">Dinheiro</option></select></label><button class="primary-btn" type="submit">Cadastrar desconto</button></form>` : '<p class="muted">As condições consideram o subtotal sem descontos e a quantidade total. Se a compra mudar, os descontos serão reavaliados.</p>'}</dialog>`);
    if (!admin) document.getElementById('discountRules').insertAdjacentHTML('afterend', '<form id="purchaseManualDiscount" class="discount-form"><label>Tipo do desconto<select name="tipo"><option value="percentual">Porcentagem (%)</option><option value="fixo">Valor em reais (R$)</option></select></label><label>Desconto da compra<input name="valor" type="number" min="0" step="0.01" value="0" required></label><button class="primary-btn" type="submit">Aplicar desconto na compra</button></form><p class="muted">O desconto será limitado ao valor restante e aparecerá no resumo do pedido.</p>');
    document.getElementById('closeDiscountDialog').onclick=()=>document.getElementById('discountDialog').close();
    const manualForm=document.getElementById('purchaseManualDiscount');
    manualForm?.addEventListener('submit',e=>{e.preventDefault();const value=Number(manualForm.elements.valor.value);const gross=context().gross;const membershipNet=gross-(document.getElementById('btnToggleAssociado')?.classList.contains('active')?Math.round(gross*0.1*100)/100:0);const max=manualForm.elements.tipo.value==='percentual'?100:afterRules(membershipNet);if(!Number.isFinite(value)||value<0||value>max){notify(manualForm.elements.tipo.value==='percentual'?'Informe um percentual entre 0 e 100.':'O desconto não pode superar o total restante da compra.');return;}manual={tipo:manualForm.elements.tipo.value,valor:value};refresh();notify('Desconto aplicado à compra.');});
    document.getElementById('discountRules').addEventListener('change',e=> { if(e.target.dataset.selectDiscount) {const id=Number(e.target.dataset.selectDiscount); e.target.checked ? selected.add(id) : selected.delete(id); refresh();} });
    document.getElementById('discountRules').addEventListener('click',async e=> {const b=e.target.closest('[data-remove-discount]'); if(!b) return; b.disabled=true; try {await request('DELETE',null,'/'+b.dataset.removeDiscount); rules=await request(); render();} catch(error){notify(error.message); b.disabled=false;} });
    const form=document.getElementById('discountForm');
    form?.elements.tipo.addEventListener('change',()=>{
      const percentual = form.elements.tipo.value === 'percentual';
      form.elements.valor.max = percentual ? '100' : '9999999999.99';
      form.elements.valor.placeholder = percentual ? 'Ex.: 10' : 'Ex.: 5,00';
    });
    form?.addEventListener('submit',async e=>{
      e.preventDefault();
      if (!form.reportValidity()) return;
      const submit=form.querySelector('[type=submit]'); submit.disabled=true;
      try {
        const data = Object.fromEntries(new FormData(form));
        data.valor = Number(data.valor);
        data.minimo = Number(data.minimo);
        data.quantidade = Number(data.quantidade);
        await request('POST',data);
        rules=await request();
        form.reset(); form.elements.valor.max='100'; form.elements.valor.placeholder='';
        render(); notify('Desconto cadastrado.');
      } catch(error) { notify(error.message); }
      finally { submit.disabled=false; }
    });
    if(!admin) request().then(data=>{rules=data; refresh();}).catch(()=>{button.title='Não foi possível carregar os descontos. Clique para tentar novamente.';});
  }
  document.addEventListener('DOMContentLoaded',init);
  return {amount, remaining:afterRules, ids:()=>active().map(d=>d.id), manual:()=>manual, reset:()=>{selected.clear();manual={tipo:'percentual',valor:0};const form=document.getElementById('purchaseManualDiscount');if(form){form.reset();form.elements.valor.value='0';}render();}, render};
})();
