/* OviAmo – scheda di una prenotazione: uova consegnate e soldi ricevuti, anche in parte o in anticipo.
   Ogni "movimento" registra insieme uova consegnate e/o soldi incassati.
   OviOrd.row(o)                                  → HTML della scheda
   OviOrd.bind(contenitore, post, ricarica, getOrdine) → gestisce i pulsanti
   OviOrd.paid / rest / cons / left / done / eur  → utilità */
(function () {
  const css = `
.oo{display:grid;gap:10px;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--card)}
.oo.done{opacity:.85}
.oo-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.oo-h b.nm{font-size:1rem}
.oo-w{color:var(--muted);font-size:.84rem;margin-top:2px}
.oo-w a{color:inherit}
.oo-e{text-align:right;white-space:nowrap}
.oo-e b{font-family:Fraunces,Georgia,serif;font-size:1.05rem;display:block}
.oo-e small{color:var(--muted);font-size:.78rem}
.oo-nt{font-size:.85rem;color:var(--muted);font-style:italic}
.oo-s{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.oo-b{border-radius:12px;padding:8px 10px;background:var(--bg);display:grid;gap:4px;font-size:.84rem}
.oo-b .k{color:var(--muted);font-size:.76rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.oo-b .v{font-size:.95rem}
.oo-b .r{font-weight:700;color:var(--err)}
.oo-b .ok{font-weight:700;color:var(--brand)}
.oo-bar{height:6px;border-radius:9px;background:var(--line);overflow:hidden}
.oo-bar i{display:block;height:100%;background:var(--brand-2)}
.oo-a{display:flex;flex-wrap:wrap;gap:6px}
.oo button.ob{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border:1px solid var(--line);border-radius:99px;background:var(--bg);color:var(--ink);font:600 .82rem Inter,sans-serif;cursor:pointer}
.oo button.ob:hover{border-color:var(--brand-2)}
.oo a.ob{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:99px;font:700 .82rem Inter,sans-serif;text-decoration:none}
.oo a.ob.wa{background:#25d366;color:#0b2e17;border:1px solid #25d366}
.oo button.ob.pr{background:var(--brand);border-color:var(--brand);color:#fff}
@media (prefers-color-scheme:dark){.oo button.ob.pr{color:#13200c}}
.oo .sp{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:4px;background:#e8433d;color:#fff;font:800 .62rem Inter,sans-serif}
.oo-f{display:grid;gap:10px;padding:10px;border:1.5px solid var(--brand-2);border-radius:12px;background:color-mix(in srgb,var(--brand-2) 6%,var(--card))}
.oo-f h4{margin:0;font-size:.92rem}
.oo-q{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.88rem}
.oo-q .lb{flex:1 1 100%;font-weight:600}
.oo-q input{width:84px;font:inherit;font-size:.95rem;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);text-align:center}
.oo-q .st{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--brand);font-size:1.1rem;cursor:pointer}
.oo-m{display:flex;gap:6px;flex-wrap:wrap}
.oo-m button{padding:7px 11px;border-radius:99px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);font:600 .82rem Inter,sans-serif;cursor:pointer}
.oo-m button.on{border-color:var(--brand-2);background:color-mix(in srgb,var(--brand-2) 16%,var(--card));color:var(--brand)}
.oo-dec{display:grid;gap:6px;padding:9px 10px;border-radius:12px;background:color-mix(in srgb,var(--yolk) 22%,var(--card));font-size:.86rem;font-weight:600}
.oo-dec.rej{background:var(--bg);color:var(--muted)}
.oo-wap{position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.45);display:grid;place-items:center;padding:16px}
.oo-wapb{background:var(--card,#fff);color:var(--ink);border-radius:16px;padding:16px;max-width:420px;width:100%;display:grid;gap:10px;font:500 .92rem Inter,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)}
.oo-wapt{white-space:pre-wrap;font-size:.85rem;padding:9px 11px;border-radius:10px;background:color-mix(in srgb,#25d366 12%,var(--card,#fff));border:1px solid color-mix(in srgb,#25d366 35%,var(--line,#ddd))}
.oo-wapb a.ob.wa{display:flex;justify-content:center;padding:11px 14px;border-radius:99px;background:#25d366;color:#0b2e17;font:700 .95rem Inter,sans-serif;text-decoration:none}
.oo-wapb .oo-lk{justify-self:center;border:0;background:none;color:var(--muted);text-decoration:underline;cursor:pointer;font:inherit}
.oo-sum{font-size:.86rem;padding:8px 10px;border-radius:10px;background:var(--card);border:1px dashed var(--line)}
.oo-del{color:var(--err)!important;font-size:.8rem!important}
.oo-lk{border:0;background:none;padding:0;color:var(--brand);text-decoration:underline;cursor:pointer;font:inherit;font-size:.84rem}
.oo .pp{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:4px;background:#1f4fa0;color:#fff;font:800 italic .62rem Inter,sans-serif}
.oo-k{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch}
.oo-kd{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);color:var(--ink);font:600 .88rem Inter,sans-serif;cursor:pointer}
.oo-kd .ck{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;border:2px solid var(--muted);background:var(--card);color:#fff;font-size:.8rem;line-height:1}
.oo-kd.on{border-color:var(--brand-2);background:color-mix(in srgb,var(--brand-2) 14%,var(--card))}
.oo-kd.on .ck{background:var(--brand);border-color:var(--brand)}
.oo-kp{display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 12px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);font:600 .88rem Inter,sans-serif}
.oo-kp.on{border-color:var(--brand-2);background:color-mix(in srgb,var(--brand-2) 14%,var(--card))}
.oo-kp button{display:inline-grid;place-items:center;width:38px;height:32px;border:1.5px solid var(--line);border-radius:9px;background:var(--card);cursor:pointer;padding:0}
.oo-kp button.on{border-color:var(--brand);box-shadow:0 0 0 2px color-mix(in srgb,var(--brand-2) 45%,transparent)}
.oo-kp button .sp,.oo-kp button .pp{width:20px;height:20px;font-size:.75rem}
.oo-kp svg{width:24px;height:16px}
.oo-adv{border:1px solid var(--line);border-radius:12px;padding:0 10px}
.oo-adv[open]{padding-bottom:10px}
.oo-adv>summary{cursor:pointer;padding:9px 0;font:600 .86rem Inter,sans-serif;color:var(--muted);list-style:none}
.oo-adv>summary::-webkit-details-marker{display:none}
.oo-adv>div{display:grid;gap:10px}
.oo-badge.rj{background:var(--bg);color:var(--muted)}
.oo-hist summary{cursor:pointer;font-size:.82rem;color:var(--muted);list-style:none}
.oo-hist summary::-webkit-details-marker{display:none}
.oo-pl{display:grid;gap:4px;font-size:.82rem;margin-top:6px}
.oo-pl span{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.oo-pl button{border:0;background:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:0 4px}
.oo-badge{font:700 .7rem Inter,sans-serif;padding:1px 8px;border-radius:99px;background:color-mix(in srgb,var(--yolk) 45%,var(--card));color:#6b4a00;vertical-align:2px}
.oo-badge.rb{background:color-mix(in srgb,#25d366 22%,var(--card));color:#0b5a2a}
@media (max-width:420px){.oo-s{grid-template-columns:1fr}}`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const eur = n => r2(n).toFixed(2).replace('.', ',') + ' €';
  const num = s => parseFloat(String(s || '').replace(',', '.')) || 0;
  const dIt = s => { const d = String(s || '').slice(0, 10).split('-'); return d.length === 3 ? `${+d[2]}/${+d[1]}/${d[0].slice(2)}` : ''; };
  const paid = o => +o.paid || 0;
  const rest = o => Math.max(0, r2(o.euro - paid(o)));
  const cons = o => Math.min(o.uova, +o.consegnate || 0);
  const left = o => Math.max(0, o.uova - cons(o));
  const done = o => rest(o) <= 0.005 && left(o) <= 0;
  const unit = o => o.uova ? o.euro / o.uova : 0;
  const uTxt = n => n === 1 ? '1 uovo' : n + ' uova';
  const CASH = '<svg viewBox="0 0 24 16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" rx="2.5" fill="#cfe8bf" stroke="#3f7a2a" stroke-width="1.6"/><circle cx="12" cy="8" r="3.4" fill="none" stroke="#3f7a2a" stroke-width="1.6"/><circle cx="5" cy="8" r="1.1" fill="#3f7a2a"/><circle cx="19" cy="8" r="1.1" fill="#3f7a2a"/></svg>';
  const ICO = { contanti: CASH, satispay: '<span class="sp">S</span>', paypal: '<span class="pp">P</span>' };
  const MNAME = { contanti: 'in contanti', satispay: 'con Satispay', paypal: 'con PayPal' };
  const MET = { contanti: '💶 Contanti', satispay: '<span class="sp">S</span> Satispay', paypal: '<span class="pp">P</span> PayPal' };
  const usedM = o => [...new Set((o.payments || []).filter(m => m.euro > 0).map(m => m.metodo))];
  const waNum = t => { let n = String(t || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, ''); if (/^3\d{8,9}$/.test(n)) n = '39' + n; return n.length >= 8 ? n : ''; };
  const giorno = d => new Date(d + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  /** Testi predefiniti (gli stessi del server); quelli modificati nella scheda 💬 Messaggi arrivano in window.OviTpl */
  const TPL = {
    ricevuta: 'Ciao {nome}! Ho ricevuto la tua richiesta di {uova} per {giorno} ({euro}). Ti scrivo qualche giorno prima per confermarti se ci sono. Grazie! – OviAmo 🥚',
    conferma: 'Ciao {nome}! Ti confermo le tue {uova} per {giorno} ({euro}). Puoi pagare in contanti o con Satispay al {satispay}. Grazie! – OviAmo 🥚',
    normale: 'Ciao {nome}! Ho ricevuto la tua prenotazione di {uova} ({euro}). Puoi pagare in contanti o con Satispay al {satispay}. Grazie! – OviAmo 🥚',
    rifiuto: 'Ciao {nome}, mi dispiace: per {giorno} non riusciamo ad avere le {uova} che hai chiesto. Quando le vedi disponibili sul sito puoi prenotarle subito. – OviAmo 🥚',
    rifiutoSubito: 'Ciao {nome}, mi dispiace: non riusciamo a darti le {uova} che hai prenotato. Quando le vedi di nuovo disponibili sul sito puoi prenotarle. – OviAmo 🥚'
  };
  const fill = (t, o) => {
    const n = String(o.nome || '').trim().split(' ')[0];
    const v = { nome: n.charAt(0).toUpperCase() + n.slice(1), uova: uTxt(o.uova), euro: eur(o.euro), giorno: o.perIl ? giorno(o.perIl) : 'ora', satispay: '393 160 9967', paypal: 'https://paypal.me/bartoccifrancesco/' + (+o.euro || 0).toFixed(2) + 'EUR' };
    return String(t || '').replace(/\{(nome|uova|euro|giorno|satispay|paypal)\}/gi, (m, k) => v[k.toLowerCase()]);
  };
  const tplKind = o => o.stato === 'attesa' ? 'ricevuta' : o.stato === 'rifiutata' ? (o.perIl ? 'rifiuto' : 'rifiutoSubito') : o.perIl ? 'conferma' : 'normale';
  /** Nome del tasto WhatsApp: dice quale messaggio prepara */
  const WA_LBL = { normale: 'conferma ordine', ricevuta: 'richiesta ricevuta', conferma: 'conferma data', rifiuto: 'rifiuto', rifiutoSubito: 'rifiuto' };
  const WA_SH = { normale: 'Conferma', ricevuta: 'Ricevuta', conferma: 'Conferma data', rifiuto: 'Rifiuto', rifiutoSubito: 'Rifiuto' };
  const waLabel = (o, short) => short ? '💬 ' + WA_SH[tplKind(o)] : '💬 WhatsApp: ' + WA_LBL[tplKind(o)];
  /** Finestrella dopo Conferma/Rifiuta: tasto WhatsApp col messaggio giusto, pronto da premere */
  function waPrompt(o) {
    const u = waConf(o), old = document.getElementById('ooWaP'); if (old) old.remove();
    const k = tplKind(o), t = k === 'rifiuto' || k === 'rifiutoSubito' ? 'Rifiutata' : 'Confermata ✓';
    const d = document.createElement('div'); d.id = 'ooWaP'; d.className = 'oo-wap';
    d.innerHTML = `<div class="oo-wapb" role="dialog" aria-label="Messaggio WhatsApp"><b>${t}: ${esc(o.nome)} ${esc(o.cognome || '')}</b>
      ${u ? `<span>Vuoi avvisarla su WhatsApp? Il messaggio è già scritto:</span><div class="oo-wapt">${esc(waText(o))}</div>
      <a class="ob wa" href="${esc(u)}" target="_blank" rel="noopener">${waLabel(o)}</a>` : '<span>Non c\'è un numero di telefono: avvisala in un altro modo.</span>'}
      <button type="button" class="oo-lk" data-wapx>${u ? 'Non adesso' : 'Chiudi'}</button></div>`;
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-wapx]') || e.target.closest('a.wa')) d.remove(); });
    if (!document.getElementById('ooCss')) { const s = document.createElement('style'); s.id = 'ooCss'; s.textContent = css; document.head.appendChild(s); }
    document.body.appendChild(d);
  }
  /** Messaggio WhatsApp adatto alla prenotazione: ricevuta, conferma (anche per una data) o rifiuto */
  const waText = o => { const k = tplKind(o), T = window.OviTpl || {}; return fill((T[k] && String(T[k]).trim()) ? T[k] : TPL[k], o); };
  const waConf = o => { const n = waNum(o.telefono); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(waText(o)) : ''; };
  const forms = new Map();   // id → { mode, n, e, m, eTouched }
  const advOpen = new Set();   // schede con "Gestione avanzata" aperta (resta aperta quando la scheda si ridisegna)

  function sumTxt(o, f) {
    const n = f.n, e = f.m ? r2(f.e) : 0, dl = left(o) - n, dr = r2(rest(o) - e);
    const parts = [];
    if (n) parts.push(`consegni <b>${uTxt(n)}</b>`);
    if (e > 0) parts.push(`incassi <b>${eur(e)}</b>${f.m ? (' ' + (MNAME[f.m] || 'in contanti')) : ''}`);
    if (!parts.length) return 'Scrivi le uova consegnate adesso o i soldi ricevuti adesso.';
    let after = [];
    after.push(dl > 0 ? `restano <b>${uTxt(dl)}</b> da consegnare` : 'uova tutte consegnate');
    after.push(dr > 0.005 ? `restano <b>${eur(dr)}</b> da pagare` : 'tutto pagato');
    let warn = '';
    if (n && !(e > 0)) warn = ' <br>⚠️ Le uova consegnate adesso non risultano pagate.';
    else if (!n && e > 0 && left(o)) warn = ' <br>💡 Pagamento in anticipo.';
    return 'Adesso ' + parts.join(' e ') + '. Dopo: ' + after.join(', ') + '.' + warn;
  }

  const eqOf = (o, f) => Math.min(left(o), unit(o) ? Math.round(r2(f.e) / unit(o)) : 0);
  const eqTxt = n => `Ho consegnato anche le ${uTxt(n)} di questo importo`;
  function formHtml(o, f) {
    const L = left(o), R = rest(o), eqN = Math.min(L, unit(o) ? Math.round(f.e / unit(o)) : 0);
    return `<form class="oo-f" data-of="${esc(o.id)}">
      <h4>${f.mode === 'pay' ? '💶 Pagamento ricevuto' : '🥚 Uova consegnate'}</h4>
      <div class="oo-q"><span class="lb">Uova consegnate ora</span>
        <button type="button" class="st" data-oa="fn" data-d="-1" aria-label="Meno">−</button>
        <input name="n" type="number" inputmode="numeric" min="0" max="${L}" value="${f.n}" aria-label="Uova consegnate ora">
        <button type="button" class="st" data-oa="fn" data-d="1" aria-label="Più">+</button>
        <small style="color:var(--muted)">su ${uTxt(L)} da consegnare</small></div>
      ${f.mode === 'pay' && L ? `<div><button type="button" class="oo-lk" data-oa="fneq" ${eqN && f.n !== eqN ? '' : 'hidden'}>${eqTxt(eqN)}</button></div>` : ''}
      <div class="oo-q"><span class="lb">${f.mode === 'dlv' ? 'Sono pagate?' : 'Pagato ora €'}</span>
        <div class="oo-m">${f.mode === 'dlv' ? `<button type="button" data-oa="fm" data-m="" class="${f.m === '' && f.answered ? 'on' : ''}">Non pagate</button>` : ''}
          <button type="button" data-oa="fm" data-m="contanti" class="${f.m === 'contanti' ? 'on' : ''}">${MET.contanti}</button>
          <button type="button" data-oa="fm" data-m="satispay" class="${f.m === 'satispay' ? 'on' : ''}">${MET.satispay}</button>
          <button type="button" data-oa="fm" data-m="paypal" class="${f.m === 'paypal' ? 'on' : ''}">${MET.paypal}</button></div></div>
      ${f.m ? `<div class="oo-q"><span class="lb">Importo €</span><input name="e" inputmode="decimal" value="${String(r2(f.e)).replace('.', ',')}" aria-label="Importo pagato ora"><small style="color:var(--muted)">su ${eur(R)} da pagare</small></div>` : ''}
      <div class="oo-sum">${sumTxt(o, f)}</div>
      <div class="oo-a"><button class="ob pr" ${f.mode === 'dlv' && !f.answered ? 'disabled title="Scegli se sono pagate"' : ''}>Registra</button><button type="button" class="ob" data-oa="fx">Annulla</button></div>
    </form>`;
  }

  /** Un ordine "subito" si può rifiutare finché non è iniziata consegna o pagamento */
  const canRej = o => (o.stato || 'ok') === 'ok' && !o.perIl && !cons(o) && paid(o) <= 0.005;
  function row(o, opt) {
    opt = opt || {};
    const L = left(o), R = rest(o), c = cons(o), p = paid(o), f = forms.get(o.id);
    const qty = [o.q6 ? `${o.q6}×6` : '', o.q1 ? `${o.q1} sing.` : ''].filter(Boolean).join(' + ');
    const per = o.perIl ? `<b style="color:var(--brand)">per ${new Date(o.perIl + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric' })}</b> · ` : '';
    const mv = o.payments || [];
    return `<div class="oo ${done(o) ? 'done' : ''}" data-oid="${esc(o.id)}"${opt.del ? ' data-del="1"' : ''}>
  <div class="oo-h"><div><b class="nm">${esc(o.nome)} ${esc(o.cognome)}</b>${o.stato === 'attesa' ? ' <span class="oo-badge">Da confermare</span>' : o.stato === 'rifiutata' ? ' <span class="oo-badge rj">Rifiutata</span>' : ''}${o.contatto ? ' <span class="oo-badge rb">Rubrica</span>' : ''}
    <div class="oo-w">${per}${dIt(o.data)}${qty ? ` · ${qty}` : ''}${o.telefono ? ` · <a href="tel:${esc(o.telefono)}">${esc(o.telefono)}</a>` : ''}</div></div>
    <div class="oo-e"><b>${eur(o.euro)}</b><small>${uTxt(o.uova)}</small></div></div>
  ${o.note ? `<div class="oo-nt">“${esc(o.note)}”</div>` : ''}
  <div class="oo-s">
    <div class="oo-b"><span class="k">🥚 Uova</span><span class="v">consegnate <b>${c}</b> di ${o.uova}</span><span class="oo-bar"><i style="width:${o.uova ? c / o.uova * 100 : 100}%"></i></span>${L ? `<span class="r">da consegnare: ${uTxt(L)}</span>` : '<span class="ok">✓ tutte consegnate</span>'}</div>
    <div class="oo-b"><span class="k">💶 Soldi</span><span class="v">pagati <b>${eur(p)}</b> di ${eur(o.euro)}</span><span class="oo-bar"><i style="width:${o.euro ? Math.min(100, p / o.euro * 100) : 100}%"></i></span>${R > 0.005 ? `<span class="r">da pagare: ${eur(R)}</span>` : '<span class="ok">✓ tutto pagato</span>'}</div>
  </div>
  ${o.stato !== 'rifiutata' ? `<div class="oo-k">
    <button type="button" class="oo-kd ${L ? '' : 'on'}" data-oa="kdlv" aria-pressed="${!L}" title="${L ? 'Segna tutte le uova come consegnate' : 'Togli la consegna'}"><span class="ck">${L ? '' : '✓'}</span>Consegnati</button>
    <div class="oo-kp ${R > 0.005 ? '' : 'on'}"><span>${R > 0.005 ? 'Pagamento' : '✓ Pagato'}</span>${['contanti', 'satispay', 'paypal'].map(m => `<button type="button" data-oa="kpay" data-m="${m}" class="${usedM(o).includes(m) ? 'on' : ''}" aria-pressed="${usedM(o).includes(m)}" title="${R > 0.005 ? 'Pagato ' + MNAME[m] : usedM(o).includes(m) ? 'Togli il pagamento' : 'Cambia: pagato ' + MNAME[m]}" aria-label="Pagato ${MNAME[m]}">${ICO[m]}</button>`).join('')}</div>
  </div>` : ''}
  <details class="oo-adv" data-adv${f || advOpen.has(o.id) ? ' open' : ''}><summary>⚙️ Gestione avanzata ▾</summary><div>
  ${o.stato === 'attesa' ? `<div class="oo-dec"><span>📅 Richiesta da confermare${o.perIl ? ' per ' + giorno(o.perIl) : ''}</span><div class="oo-a"><button type="button" class="ob pr" data-oa="dec" data-v="ok">✓ Conferma</button><button type="button" class="ob" data-oa="dec" data-v="rifiutata">✕ Rifiuta</button></div></div>`
    : o.stato === 'rifiutata' ? (o.perIl ? `<div class="oo-dec rej"><span>Richiesta rifiutata</span><div class="oo-a"><button type="button" class="ob" data-oa="dec" data-v="attesa">Rimetti in attesa</button></div></div>`
      : `<div class="oo-dec rej"><span>Ordine rifiutato</span><div class="oo-a"><button type="button" class="ob" data-oa="dec" data-v="ok">Annulla il rifiuto</button></div></div>`) : ''}
  ${o.stato === 'rifiutata' ? (waConf(o) ? `<div class="oo-a"><a class="ob wa" href="${esc(waConf(o))}" target="_blank" rel="noopener">${waLabel(o)}</a></div>` : '')
    : f ? formHtml(o, f) : !done(o) || waConf(o) ? `<div class="oo-a">
    ${waConf(o) ? `<a class="ob wa" href="${esc(waConf(o))}" target="_blank" rel="noopener">${waLabel(o)}</a>` : ''}
    ${L ? `<button type="button" class="ob pr" data-oa="open" data-mode="dlv">🥚 Consegna uova</button>` : ''}
    ${R > 0.005 ? `<button type="button" class="ob pr" data-oa="open" data-mode="pay">💶 Pagamento</button>` : ''}
    ${L && R > 0.005 ? `<button type="button" class="ob" data-oa="all" data-m="contanti">✓ Tutto, in contanti</button><button type="button" class="ob" data-oa="all" data-m="satispay">✓ Tutto, Satispay</button><button type="button" class="ob" data-oa="all" data-m="paypal">✓ Tutto, PayPal</button>` : ''}
  </div>` : ''}
  ${canRej(o) ? `<div class="oo-a"><button type="button" class="oo-lk oo-del" data-oa="dec" data-v="rifiutata">✕ Rifiuta ordine</button></div>` : ''}
  </div></details>
  ${opt.del ? `<div class="oo-a"><button type="button" class="oo-lk oo-del" data-oa="del">🗑️ Elimina</button></div>` : ''}
  ${mv.length ? `<details class="oo-hist"><summary>📋 Movimenti (${mv.length}) ▾</summary><div class="oo-pl">${mv.map(m => `<span>${dIt(m.data)} · ${m.uova ? '🥚 ' + uTxt(m.uova) + ' consegnate' : ''}${m.uova && m.euro > 0 ? ' · ' : ''}${m.euro > 0 ? '💶 ' + eur(m.euro) + (m.metodo === 'satispay' ? ' Satispay' : m.metodo === 'paypal' ? ' PayPal' : m.metodo === 'contanti' ? ' contanti' : '') : ''}<button type="button" data-oa="pdel" data-pid="${esc(m.id)}" aria-label="Annulla questo movimento">×</button></span>`).join('')}</div></details>` : ''}
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
    const redraw = id => { const o = getOrder(id), card = el.querySelector(`[data-oid="${CSS.escape(id)}"]`); if (o && card) { card.outerHTML = row(o, { del: card.dataset.del === '1' }); } };
    const autoE = (o, f) => { if (!f.eTouched) f.e = f.mode === 'pay' && !f.n ? rest(o) : Math.min(rest(o), r2(f.n * unit(o))); };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-oa]'); if (!b || !el.contains(b)) return;
      const card = b.closest('[data-oid]'), id = card && card.dataset.oid, o = getOrder(id); if (!o) return;
      const a = b.dataset.oa, f = forms.get(id);
      if (a === 'open') {
        const mode = b.dataset.mode;
        const nf = { mode, n: mode === 'dlv' ? left(o) : 0, e: 0, m: mode === 'pay' ? '' : '', answered: false, eTouched: false };
        if (mode === 'pay') { nf.e = rest(o); nf.m = 'contanti'; nf.answered = true; } else autoE(o, nf);
        forms.set(id, nf); redraw(id); return;
      }
      if (a === 'fx') { forms.delete(id); redraw(id); return; }
      if (a === 'fn' && f) { f.n = Math.max(0, Math.min(left(o), f.n + +b.dataset.d)); autoE(o, f); redraw(id); return; }
      if (a === 'fneq' && f) { f.n = eqOf(o, f); redraw(id); return; }
      if (a === 'fm' && f) { f.m = b.dataset.m; f.answered = true; if (f.m) { if (!f.e) { f.eTouched = false; autoE(o, f); } } else f.e = 0; redraw(id); return; }
      b.disabled = true;
      if (a === 'dec') {
        const v = b.dataset.v;
        (async () => {
          try {
            if (v === 'rifiutata' && (o.stato || 'ok') === 'ok' && !confirm(`Rifiutare l'ordine di ${o.nome} ${o.cognome || ''} (${uTxt(o.uova)})? Le uova tornano disponibili.`)) { b.disabled = false; return; }
            let j = await post({ action: 'decide', id, value: v });
            if (!j.ok && j.short && confirm(`Adesso ci sono solo ${j.available} uova disponibili e ne servono ${j.need}.\n\nConfermare lo stesso? Le prossime uova che carichi andranno prima a questa prenotazione.`)) j = await post({ action: 'decide', id, value: v, force: true });
            if (!j.ok) { if (!j.short) toast(j.error || 'Non salvato'); b.disabled = false; return; }
            toast(v === 'ok' ? 'Confermata ✓ ora è tra le prenotazioni da gestire' : v === 'rifiutata' ? 'Rifiutata' : 'Rimessa in attesa');
            await reload();
            if (v === 'ok' || v === 'rifiutata') waPrompt({ ...o, stato: v });
          } catch (x) { toast('Non salvato, riprova'); b.disabled = false; }
        })();
        return;
      }
      if (a === 'kdlv') {   // "Consegnati": tutte le uova consegnate / togli la consegna
        const on = left(o) > 0;
        run({ action: 'flag', ids: [id], field: 'consegnato', value: on }, on ? `${o.nome}: uova consegnate ✓` : `${o.nome}: consegna tolta`);
        return;
      }
      if (a === 'kpay') {   // icona del metodo: paga il resto così / tocca di nuovo per togliere / cambia metodo
        const m = b.dataset.m, used = usedM(o);
        if (rest(o) > 0.005) run({ action: 'flag', ids: [id], field: 'pagato', value: true, metodo: m }, `${o.nome}: pagato ${MNAME[m]} ✓`);
        else if (used.length === 1 && used[0] === m) run({ action: 'flag', ids: [id], field: 'pagato', value: false }, `${o.nome}: pagamento tolto`);
        else (async () => {
          try { let j = await post({ action: 'flag', ids: [id], field: 'pagato', value: false }); if (!j.ok) throw new Error(j.error);
            j = await post({ action: 'flag', ids: [id], field: 'pagato', value: true, metodo: m }); if (!j.ok) throw new Error(j.error);
            toast(`${o.nome}: ora pagato ${MNAME[m]}`); await reload(); } catch (x) { toast(x.message || 'Non salvato, riprova'); b.disabled = false; }
        })();
        return;
      }
      if (a === 'all') run({ action: 'move', id, uova: left(o), euro: rest(o), metodo: b.dataset.m }, `${o.nome}: consegnate e pagate`);
      else if (a === 'del') { if (confirm(`Eliminare la prenotazione di ${o.nome} ${o.cognome} (${uTxt(o.uova)})? Va nel cestino: le uova tornano disponibili e si può ripristinare dal report per 30 giorni.`)) run({ action: 'delOrders', ids: [id] }, 'Spostata nel cestino'); else b.disabled = false; }
      else if (a === 'pdel') { if (confirm('Annullare questo movimento?')) run({ action: 'payDel', pid: b.dataset.pid }, 'Movimento annullato'); else b.disabled = false; }
    });
    el.addEventListener('toggle', e => { const d = e.target; if (!d.matches || !d.matches('details[data-adv]')) return; const id = d.closest('[data-oid]').dataset.oid; d.open ? advOpen.add(id) : advOpen.delete(id); }, true);
    el.addEventListener('input', e => {
      const fm = e.target.closest('[data-of]'); if (!fm) return;
      const id = fm.dataset.of, o = getOrder(id), f = forms.get(id); if (!o || !f) return;
      if (e.target.name === 'n') { f.n = Math.max(0, Math.min(left(o), parseInt(e.target.value, 10) || 0)); autoE(o, f); }
      if (e.target.name === 'e') { f.e = num(e.target.value); f.eTouched = true; }
      const s = fm.querySelector('.oo-sum'); if (s) s.innerHTML = sumTxt(o, f);
      if (e.target.name === 'n') { const ei = fm.querySelector('input[name=e]'); if (ei && !f.eTouched) ei.value = String(r2(f.e)).replace('.', ','); }
      const lk = fm.querySelector('[data-oa=fneq]'); if (lk) { const q = eqOf(o, f); lk.hidden = !q || q === f.n; lk.textContent = eqTxt(q); }
    });
    el.addEventListener('submit', e => {
      const fm = e.target.closest('[data-of]'); if (!fm) return; e.preventDefault();
      const id = fm.dataset.of, o = getOrder(id), f = forms.get(id); if (!o || !f) return;
      if (f.mode === 'dlv' && !f.answered) return toast('Scegli se sono pagate');
      const euro = f.m ? r2(f.e) : 0;
      if (!f.n && !(euro > 0)) return toast('Niente da registrare');
      forms.delete(id);
      run({ action: 'move', id, uova: f.n, euro, metodo: f.m || '' }, 'Registrato');
    });
  }
  window.OviOrd = { row, bind, paid, rest, cons, left, done, eur, waConf, waText, waLabel, waPrompt, fill, TPL };
})();
