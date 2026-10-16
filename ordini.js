/* OviAmo – scheda di una prenotazione con pagamenti e consegne anche parziali.
   OviOrd.row(o)                    → HTML della scheda
   OviOrd.bind(contenitore, post, ricarica)  → gestisce i pulsanti dentro il contenitore
   OviOrd.paid(o), OviOrd.done(o)   → utilità */
(function () {
  const css = `
.oo{display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--card)}
.oo.done{opacity:.8}
.oo-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.oo-h b.nm{font-size:1rem}
.oo-w{color:var(--muted);font-size:.84rem;margin-top:2px}
.oo-w a{color:inherit}
.oo-e{font-family:Fraunces,Georgia,serif;font-weight:700;white-space:nowrap}
.oo-nt{font-size:.85rem;color:var(--muted);font-style:italic}
.oo-r{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.oo-l{flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:.88rem}
.oo-t{white-space:nowrap}
.oo-bar{flex:1;height:6px;border-radius:9px;background:var(--line);overflow:hidden;min-width:60px;max-width:140px}
.oo-bar i{display:block;height:100%;background:var(--brand-2)}
.oo-ok{color:var(--brand);font-weight:700}
.oo button.ob{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border:1px solid var(--line);border-radius:99px;background:var(--bg);color:var(--ink);font:600 .8rem Inter,sans-serif;cursor:pointer}
.oo button.ob:hover{border-color:var(--brand-2)}
.oo button.sq{width:32px;height:32px;padding:0;justify-content:center;font-size:1.05rem}
.oo .sp{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:4px;background:#f43;color:#fff;font:800 .62rem Inter,sans-serif}
.oo-pf{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.oo-pf input,.oo-pf select{font:inherit;font-size:.88rem;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);width:90px}
.oo-pf select{width:auto}
.oo-pl{display:grid;gap:3px;font-size:.8rem;color:var(--muted)}
.oo-pl span{display:flex;gap:6px;align-items:center}
.oo-pl button{border:0;background:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:0 4px}
.oo-badge{font:700 .7rem Inter,sans-serif;padding:1px 8px;border-radius:99px;background:color-mix(in srgb,var(--yolk) 45%,var(--card));color:#6b4a00;vertical-align:2px}
.oo-badge.rb{background:color-mix(in srgb,#25d366 22%,var(--card));color:#0b5a2a}`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = n => (Math.round((+n || 0) * 100) / 100).toFixed(2).replace('.', ',') + ' €';
  const dIt = s => { const d = String(s || '').slice(0, 10).split('-'); return d.length === 3 ? `${+d[2]}/${+d[1]}/${d[0].slice(2)}` : ''; };
  const paid = o => +o.paid || 0;
  const rest = o => Math.max(0, Math.round((o.euro - paid(o)) * 100) / 100);
  const cons = o => Math.min(o.uova, +o.consegnate || 0);
  const done = o => rest(o) <= 0.005 && cons(o) >= o.uova;
  const MET = { contanti: '💶 Contanti', satispay: '<span class="sp">S</span> Satispay' };
  const open = new Set();   // moduli "pagamento parziale" aperti

  function row(o) {
    const r = rest(o), c = cons(o), pp = o.euro ? Math.min(100, paid(o) / o.euro * 100) : 100, cp = o.uova ? c / o.uova * 100 : 100;
    const qty = [o.q6 ? `${o.q6}×6` : '', o.q1 ? `${o.q1} sing.` : ''].filter(Boolean).join(' + ');
    const per = o.perIl ? `<b style="color:var(--brand)">per ${new Date(o.perIl + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric' })}</b> · ` : '';
    return `<div class="oo ${done(o) ? 'done' : ''}" data-oid="${esc(o.id)}">
  <div class="oo-h"><div><b class="nm">${esc(o.nome)} ${esc(o.cognome)}</b>${o.stato === 'attesa' ? ' <span class="oo-badge">Da confermare</span>' : ''}${o.contatto ? ' <span class="oo-badge rb">Rubrica</span>' : ''}
    <div class="oo-w">${per}${dIt(o.data)} · ${o.uova} uova${qty ? ` (${qty})` : ''}${o.telefono ? ` · <a href="tel:${esc(o.telefono)}">${esc(o.telefono)}</a>` : ''}</div></div>
    <div class="oo-e">${eur(o.euro)}</div></div>
  ${o.note ? `<div class="oo-nt">“${esc(o.note)}”</div>` : ''}
  <div class="oo-r"><span class="oo-l"><span class="oo-t">Pagato <b>${eur(paid(o))}</b> di ${eur(o.euro)}</span><span class="oo-bar"><i style="width:${pp}%"></i></span>${r <= 0.005 ? '<span class="oo-ok">✓ pagato</span>' : `<span>manca ${eur(r)}</span>`}</span>
    ${r > 0.005 ? `<button type="button" class="ob" data-oa="rest" data-m="contanti">${MET.contanti}</button><button type="button" class="ob" data-oa="rest" data-m="satispay">${MET.satispay}</button><button type="button" class="ob" data-oa="part">+ Parziale</button>` : ''}</div>
  ${open.has(o.id) && r > 0.005 ? `<form class="oo-pf" data-of="${esc(o.id)}"><input name="e" inputmode="decimal" placeholder="€" value="${String(r).replace('.', ',')}" aria-label="Importo"><select name="m" aria-label="Metodo"><option value="contanti">Contanti</option><option value="satispay">Satispay</option></select><button class="ob">Salva</button><button type="button" class="ob" data-oa="part">Annulla</button></form>` : ''}
  ${(o.payments || []).length ? `<div class="oo-pl">${o.payments.map(p => `<span>${dIt(p.data)} · ${eur(p.euro)} · ${p.metodo === 'satispay' ? 'Satispay' : p.metodo === 'contanti' ? 'Contanti' : 'pagato'}<button type="button" data-oa="pdel" data-pid="${esc(p.id)}" aria-label="Togli questo pagamento">×</button></span>`).join('')}</div>` : ''}
  <div class="oo-r"><span class="oo-l"><span class="oo-t">Consegnate <b>${c}</b> di ${o.uova} uova</span><span class="oo-bar"><i style="width:${cp}%"></i></span>${c >= o.uova ? '<span class="oo-ok">✓ consegnate</span>' : ''}</span>
    <button type="button" class="ob sq" data-oa="dlv" data-d="-1" aria-label="Una in meno" ${c ? '' : 'disabled'}>−</button><button type="button" class="ob sq" data-oa="dlv" data-d="1" aria-label="Una in più" ${c < o.uova ? '' : 'disabled'}>+</button>
    ${o.q6 && c < o.uova ? `<button type="button" class="ob" data-oa="dlv" data-d="6">+6</button>` : ''}
    ${c < o.uova ? `<button type="button" class="ob" data-oa="dlvall">Tutte</button>` : `<button type="button" class="ob" data-oa="dlvnone">Annulla consegna</button>`}</div>
</div>`;
  }

  function bind(el, post, reload, getOrder) {
    if (!document.getElementById('ooCss')) { const s = document.createElement('style'); s.id = 'ooCss'; s.textContent = css; document.head.appendChild(s); }
    if (el.dataset.ooBound) return; el.dataset.ooBound = '1';
    const toast = t => (window.toast ? window.toast(t) : alert(t));
    const run = async (body, msg) => {
      try { const j = await post(body); if (!j.ok) throw new Error(j.error || 'Non salvato'); if (msg) toast(msg); await reload(); }
      catch (x) { toast(x.message || 'Non salvato, riprova'); }
    };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-oa]'); if (!b || !el.contains(b)) return;
      const card = b.closest('[data-oid]'), id = card && card.dataset.oid, o = getOrder(id); if (!o) return;
      const a = b.dataset.oa;
      if (a === 'part') { open.has(id) ? open.delete(id) : open.add(id); reload(true); return; }
      b.disabled = true;
      if (a === 'rest') run({ action: 'pay', id, euro: '', metodo: b.dataset.m }, `${o.nome}: pagato ${eur(rest(o))} ${b.dataset.m === 'satispay' ? 'con Satispay' : 'in contanti'}`);
      else if (a === 'pdel') { if (confirm('Togliere questo pagamento?')) run({ action: 'payDel', pid: b.dataset.pid }, 'Pagamento tolto'); else b.disabled = false; }
      else if (a === 'dlv') run({ action: 'deliver', id, n: Math.max(0, Math.min(o.uova, cons(o) + +b.dataset.d)) });
      else if (a === 'dlvall') run({ action: 'deliver', id, n: o.uova }, `${o.nome}: tutte consegnate`);
      else if (a === 'dlvnone') { if (confirm('Segnare come non consegnate?')) run({ action: 'deliver', id, n: 0 }); else b.disabled = false; }
    });
    el.addEventListener('submit', e => {
      const f = e.target.closest('[data-of]'); if (!f) return; e.preventDefault();
      const id = f.dataset.of; open.delete(id);
      run({ action: 'pay', id, euro: f.e.value.trim(), metodo: f.m.value }, 'Pagamento registrato');
    });
  }
  window.OviOrd = { row, bind, paid, rest, cons, done, eur };
})();
