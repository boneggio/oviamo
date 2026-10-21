/**
 * OviAmo – motore su Cloudflare (Pages Function + database D1)
 * Indirizzo: /api   (GET ?action=info|report|area, POST con JSON)
 * Segreti da impostare in Cloudflare (Settings > Variables and Secrets):
 *   MASTER_KEY      = password iniziale del report (finché non la cambi dal report; poi vale quella cifrata nel database)
 *   TELEGRAM_TOKEN  = token del bot Telegram per gli avvisi (facoltativo)
 * La chat Telegram a cui scrivere si collega dal report (azione 'tgLink'): scrivi al bot, poi collega.
 */

const SITE = 'https://oviamo.boneggio.it';
const SATISPAY_PHONE = '+393931609967';
const TZ = 'Europe/Rome';
const PRICE_1 = 0.5;     // un uovo
const PRICE_6 = 3;       // confezione da 6
const DEFAULT_MSG = 'Al momento le uova sono finite. Appena le galline ne fanno altre vi avviseremo. Grazie!';

/* ---------- utilità ---------- */

const json = o => new Response(JSON.stringify(o), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
});
const romeParts = () => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const now_ = () => romeParts().slice(0, 16);          // yyyy-MM-dd HH:mm
const today_ = () => romeParts().slice(0, 10);        // yyyy-MM-dd
const newId = p => p + crypto.randomUUID().replace(/-/g, '').slice(0, 9);
const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dIt = ymd => new Date(ymd + 'T12:00:00Z').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
// uova impegnate = solo le prenotazioni confermate (le richieste "in attesa" o "rifiutate" non contano)
// (le prenotazioni nel cestino non contano)
const BOOKED = "(SELECT COALESCE(SUM(uova),0) FROM orders WHERE COALESCE(stato,'ok') = 'ok' AND COALESCE(eliminato,'') = '')";
const TRASH_DAYS = 30;   // dopo quanti giorni il cestino si svuota da solo
const LOADED = '(SELECT COALESCE(SUM(uova),0) FROM loads)';
const REMIND_DAYS = 3;   // promemoria Telegram per le richieste da confermare
const WA_MSG = 'Ciao, se vuoi ci sono {uova} uova disponibili';   // testo predefinito "Avvisa su WhatsApp"
/** Messaggi WhatsApp per i clienti (modificabili nel report, scheda 💬 Messaggi) */
const WA_TPL = {
  ricevuta: 'Ciao {nome}! Ho ricevuto la tua richiesta di {uova} per {giorno} ({euro}). Ti scrivo qualche giorno prima per confermarti se ci sono. Grazie! – OviAmo 🥚',
  conferma: 'Ciao {nome}! Ti confermo le tue {uova} per {giorno} ({euro}). Puoi pagare in contanti o con Satispay al {satispay}. Grazie! – OviAmo 🥚',
  normale: 'Ciao {nome}! Ho ricevuto la tua prenotazione di {uova} ({euro}). Puoi pagare in contanti o con Satispay al {satispay}. Grazie! – OviAmo 🥚',
  rifiuto: 'Ciao {nome}, mi dispiace: per {giorno} non riusciamo ad avere le {uova} che hai chiesto. Quando le vedi disponibili sul sito puoi prenotarle subito. – OviAmo 🥚',
  rifiutoSubito: 'Ciao {nome}, mi dispiace: non riusciamo a darti le {uova} che hai prenotato. Quando le vedi di nuovo disponibili sul sito puoi prenotarle. – OviAmo 🥚'
};
const all = async (db, sql, ...b) => (await db.prepare(sql).bind(...b).all()).results;

/* ---------- dati ---------- */

const orders_ = async db => {
  const pays = {};
  (await all(db, 'SELECT id, order_id, data, euro, uova, metodo, utente FROM payments ORDER BY data, ins')).forEach(p => (pays[p.order_id] = pays[p.order_id] || []).push({ id: p.id, data: p.data, euro: p.euro, uova: p.uova || 0, metodo: p.metodo || '', utente: p.utente || '' }));
  return (await all(db, 'SELECT * FROM orders ORDER BY data')).map(r => {
    const payments = pays[r.id] || [];
    return {
      id: r.id, data: r.data, nome: r.nome, cognome: r.cognome, telefono: r.telefono || '',
      q1: r.q1, q6: r.q6, uova: r.uova, euro: r.euro, note: r.note || '',
      pagato: !!r.pagato, consegnato: !!r.consegnato, dataPag: r.data_pag || '', metodo: r.metodo || '', perIl: r.per_il || '',
      stato: r.stato || 'ok', contatto: r.contatto || '', eliminato: r.eliminato || '',
      payments, paid: Math.round(payments.reduce((t, p) => t + p.euro, 0) * 100) / 100,
      consegnate: Math.min(r.uova, payments.reduce((t, p) => t + p.uova, 0))
    };
  });
};
/** vendite per il grafico: un elemento per ogni pagamento (uova in proporzione all'importo) */
const sales_ = ord => ord.filter(o => !o.eliminato).flatMap(o => o.payments.filter(p => p.euro > 0).map(p => ({ data: p.data, euro: p.euro, uova: o.euro ? Math.round(o.uova * p.euro / o.euro * 10) / 10 : 0 })));
const loads_ = db => all(db, 'SELECT id, data, uova, utente, note, ins FROM loads ORDER BY data, ins');
const costs_ = db => all(db, 'SELECT id, data, descr, euro, utente, ins, qta, unita FROM costs ORDER BY data, ins');
const hens_ = db => all(db, 'SELECT id, data, tot, prod, utente, note, ins FROM hens ORDER BY data, ins');
const users_ = db => all(db, 'SELECT tk, nome, ruolo, creato FROM users ORDER BY creato, nome');
async function userByToken(db, tk) {
  tk = String(tk || '');
  return tk.length >= 10 ? await db.prepare('SELECT tk, nome, ruolo FROM users WHERE tk = ?').bind(tk).first() : null;
}
async function available_(db) {
  const r = await db.prepare(`SELECT ${LOADED} - ${BOOKED} AS n`).first();
  return Math.max(0, r.n || 0);
}
async function settings_(db) {
  const s = {}; (await all(db, 'SELECT k, v FROM settings')).forEach(r => s[r.k] = r.v);
  return { open: s.open !== '0', msg: s.msg || '' };
}
const contacts_ = db => all(db, 'SELECT id, nome, tel FROM contacts ORDER BY nome COLLATE NOCASE');
async function waMsg_(db) {
  const r = await db.prepare("SELECT v FROM settings WHERE k = 'wa_msg'").first();
  return (r && r.v) || WA_MSG;
}

async function waTpl_(db) {
  const r = await db.prepare("SELECT v FROM settings WHERE k = 'wa_tpl'").first();
  let s = {}; try { s = JSON.parse((r && r.v) || '{}') || {}; } catch (e) {}
  const o = {}; for (const k in WA_TPL) o[k] = (typeof s[k] === 'string' && s[k].trim()) ? s[k] : WA_TPL[k];
  return o;
}

/* ---------- avvisi (Telegram) ---------- */

const tgApi = (env, method, body) => fetch('https://api.telegram.org/bot' + env.TELEGRAM_TOKEN + '/' + method, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(r => r.json());

/** Numero per wa.me: solo cifre, con prefisso 39 per i cellulari italiani scritti senza */
const waNum = t => { let n = String(t || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, ''); if (/^3\d{8,9}$/.test(n)) n = '39' + n; return n.length >= 8 ? n : ''; };
const eurTxt = e => (+e || 0).toFixed(2).replace('.', ',') + ' €';
/** Riempie un messaggio per il cliente (lo stesso testo del pulsante WhatsApp nelle schede) */
async function waFill(db, kind, nome, uova, euro, perIl) {
  const t = (await waTpl_(db))[kind] || '';
  const n = String(nome || '').trim().split(' ')[0], g = perIl ? new Date(perIl + 'T12:00:00Z').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'ora';
  const v = { nome: n.charAt(0).toUpperCase() + n.slice(1), uova: uova === 1 ? '1 uovo' : uova + ' uova', euro: eurTxt(euro), giorno: g,
    satispay: SATISPAY_PHONE.replace('+39', '').replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3') };
  return t.replace(/\{(nome|uova|euro|giorno|satispay)\}/gi, (m, k) => v[k.toLowerCase()]);
}

async function telegram(env, db, text, buttons) {
  if (!env.TELEGRAM_TOKEN) return false;
  const c = await db.prepare("SELECT v FROM settings WHERE k = 'tg_chat'").first();
  if (!c || !c.v) return false;
  const extra = buttons && buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {};
  try {
    let r = await tgApi(env, 'sendMessage', { chat_id: c.v, text, disable_web_page_preview: true, ...extra });
    const nuovo = r.parameters && r.parameters.migrate_to_chat_id;   // il gruppo è diventato "supergruppo": nuovo id
    if (!r.ok && nuovo) {
      await db.prepare("INSERT OR REPLACE INTO settings (k, v) VALUES ('tg_chat', ?)").bind(String(nuovo)).run();
      r = await tgApi(env, 'sendMessage', { chat_id: nuovo, text, disable_web_page_preview: true, ...extra });
    }
    return r.ok;
  }
  catch (err) { return false; }
}

/** Promemoria: richieste in attesa con data entro REMIND_DAYS giorni (controllo al massimo una volta l'ora) */
async function remind_(env, db) {
  if (!env.TELEGRAM_TOKEN) return;
  const now = Date.now(), last = await db.prepare("SELECT v FROM settings WHERE k = 'last_remind'").first();
  if (last && now - (+last.v || 0) < 3600e3) return;
  await db.prepare("INSERT OR REPLACE INTO settings (k, v) VALUES ('last_remind', ?)").bind(String(now)).run();
  await purge_(db, "eliminato <> '' AND eliminato < ?", addDays(today_(), -TRASH_DAYS));
  const L = await all(db, "SELECT id, nome, cognome, telefono, uova, per_il FROM orders WHERE stato = 'attesa' AND COALESCE(eliminato,'') = '' AND COALESCE(ricordato,0) = 0 AND per_il <> '' AND per_il <= ? ORDER BY per_il", addDays(today_(), REMIND_DAYS));
  if (!L.length) return;
  const ok = await telegram(env, db, '⏰ OviAmo – richieste da confermare\n' +
    L.map(o => '• ' + dIt(o.per_il) + ': ' + o.nome + ' ' + o.cognome + ', ' + o.uova + ' uova' + (o.telefono ? ' (' + o.telefono + ')' : '')).join('\n') +
    '\nUova disponibili ora: ' + await available_(db) + '\n' + SITE + '/report.html');
  if (ok) await db.prepare(`UPDATE orders SET ricordato = 1 WHERE id IN (${L.map(() => '?').join(',')})`).bind(...L.map(o => o.id)).run();
}

/** Collega la chat: prende l'ultima persona che ha scritto al bot e le manda una conferma */
async function tgLink_(db, env) {
  if (!env.TELEGRAM_TOKEN) return json({ ok: false, error: 'Manca il segreto TELEGRAM_TOKEN su Cloudflare' });
  const up = await tgApi(env, 'getUpdates', { limit: 100 });
  if (!up.ok) return json({ ok: false, error: 'Telegram: ' + (up.description || 'token non valido') });
  const msgs = (up.result || []).map(u => u.message || u.edited_message || u.my_chat_member).filter(m => m && m.chat && !(m.new_chat_member && m.new_chat_member.status === 'left'));
  if (!msgs.length) return json({ ok: false, error: 'Scrivi prima un messaggio al bot su Telegram (es. "ciao"), poi riprova.' });
  const chat = msgs[msgs.length - 1].chat;
  await db.prepare("INSERT OR REPLACE INTO settings (k, v) VALUES ('tg_chat', ?)").bind(String(chat.id)).run();
  const sent = await tgApi(env, 'sendMessage', { chat_id: chat.id, text: '🥚 OviAmo collegato! ' + (chat.type === 'private' ? 'Qui riceverai' : 'In questo gruppo arriverà') + ' un messaggio per ogni nuova prenotazione e richiesta.' });
  return json({ ok: !!sent.ok, chat: chat.first_name || chat.title || '', error: sent.ok ? undefined : sent.description });
}


/* ---------- accesso del gestore: password cifrata, codice a 6 cifre (TOTP), sessioni ---------- */

const SESSION_DAYS = 30, SESSION_HOURS_SHORT = 12, PBKDF2_ITER = 10000, MAX_FAIL = 5, MAX_FAIL_ALL = 30, LOCK_MIN = 15;
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async t => hex(await crypto.subtle.digest('SHA-256', enc.encode(t)));
const same = (a, b) => { a = String(a); b = String(b); let r = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return r === 0; };
const getS = async (db, k) => { const r = await db.prepare('SELECT v FROM settings WHERE k = ?').bind(k).first(); return r ? r.v : ''; };
const setS = (db, k, v) => v === null ? db.prepare('DELETE FROM settings WHERE k = ?').bind(k).run() : db.prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)').bind(k, String(v)).run();

async function pbkdf2(pw, salt, it = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: it }, key, 256));
}
async function hashPw(pw) { const salt = rnd(16); return b64(salt) + ':' + await pbkdf2(pw, salt) + ':' + PBKDF2_ITER; }
/** La password è quella cambiata dal report (salvata cifrata); se non è mai stata cambiata vale il segreto MASTER_KEY */
async function checkPw(db, env, pw) {
  pw = String(pw || ''); if (!pw) return false;
  const h = await getS(db, 'pw_hash');
  if (h) { const [salt, hash, it] = h.split(':'); return same(await pbkdf2(pw, unb64(salt), +it || PBKDF2_ITER), hash); }
  return !!env.MASTER_KEY && same(pw, env.MASTER_KEY);
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = bytes => { let bits = 0, val = 0, out = ''; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(val << (5 - bits)) & 31]; return out; };
const b32dec = s => { let bits = 0, val = 0; const out = []; for (const c of s.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); };
async function totp(secret, step) {
  const key = await crypto.subtle.importKey('raw', b32dec(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8); new DataView(msg).setUint32(4, step);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg)), o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
/** Verifica un codice a 6 cifre (accetta 30 secondi prima/dopo; ogni codice vale una volta sola) */
async function checkTotp(db, secret, code) {
  code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return false;
  const now = Math.floor(Date.now() / 30000), last = +(await getS(db, 'tfa_last')) || 0;
  for (const st of [now - 1, now, now + 1]) if (st > last && same(await totp(secret, st), code)) { await setS(db, 'tfa_last', st); return true; }
  return false;
}
/** Codici di emergenza (se perdi il telefono): ognuno vale una volta */
async function useRecovery(db, code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B'); if (c.length !== 10) return false;
  const L = JSON.parse(await getS(db, 'tfa_recovery') || '[]'), h = await sha256(c), i = L.indexOf(h);
  if (i < 0) return false;
  L.splice(i, 1); await setS(db, 'tfa_recovery', JSON.stringify(L)); return true;
}
/** Controlla un codice di emergenza senza consumarlo */
async function hasRecovery(db, code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B'); if (c.length !== 10) return false;
  return JSON.parse(await getS(db, 'tfa_recovery') || '[]').includes(await sha256(c));
}
async function checkSecond(db, code) {
  const sec = await getS(db, 'tfa_secret');
  if (!sec) return true;
  return await checkTotp(db, sec, code) || await useRecovery(db, code);
}

async function newSession(db, long) {
  const tok = b64(rnd(32)).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
  const exp = Date.now() + (long ? SESSION_DAYS * 864e5 : SESSION_HOURS_SHORT * 36e5);
  await db.prepare('DELETE FROM sessions WHERE exp < ?').bind(Date.now()).run();
  await db.prepare('INSERT INTO sessions (h, creato, exp) VALUES (?, ?, ?)').bind(await sha256(tok), now_(), exp).run();
  return tok;
}
async function isMaster(db, request, d) {
  const tok = (request.headers.get('X-Ovi-Session') || (d && d.s) || '').trim();
  if (tok.length < 20) return false;
  const r = await db.prepare('SELECT exp FROM sessions WHERE h = ?').bind(await sha256(tok)).first();
  return !!r && r.exp > Date.now();
}

/** Limite ai tentativi sbagliati: 5 per indirizzo IP e 30 in tutto, negli ultimi 15 minuti */
const ipOf = request => (request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'x').split(',')[0].trim().slice(0, 64);
async function limiter(db, env, request) {
  const keys = ['lf:' + ipOf(request), 'lf:*'], now = Date.now(), win = LOCK_MIN * 6e4;
  const st = await Promise.all(keys.map(async k => { const v = JSON.parse(await getS(db, k) || 'null'); return v && now - v.t0 < win ? v : { n: 0, t0: now }; }));
  const locked = () => st[0].n >= MAX_FAIL || st[1].n >= MAX_FAIL_ALL;
  const left = () => Math.max(1, Math.ceil((Math.max(st[0].n >= MAX_FAIL ? st[0].t0 : 0, st[1].n >= MAX_FAIL_ALL ? st[1].t0 : 0) + win - now) / 6e4));
  return {
    locked, blockedMsg: () => 'Troppi tentativi sbagliati: riprova tra ' + left() + ' minuti.',
    async fail() {
      const was = locked();
      st.forEach(v => v.n++);
      await Promise.all(keys.map((k, i) => setS(db, k, JSON.stringify(st[i]))));
      if (!was && locked()) await telegram(env, db, '⚠️ OviAmo – troppi tentativi sbagliati di accesso al report (indirizzo ' + ipOf(request) + '): bloccato per ' + LOCK_MIN + ' minuti.');
      await new Promise(r => setTimeout(r, 800));   // rallenta i tentativi a raffica
    },
    ok: () => setS(db, keys[0], null)
  };
}

async function login_(db, env, request, d) {
  const lim = await limiter(db, env, request);
  if (lim.locked()) return json({ ok: false, error: lim.blockedMsg() });
  const fail = async msg => { await lim.fail(); return json({ ok: false, error: lim.locked() ? lim.blockedMsg() : msg }); };
  if (!await checkPw(db, env, d.password)) return await fail('Password errata');
  const tfa = !!(await getS(db, 'tfa_secret'));
  if (tfa && !String(d.code || '').trim()) return json({ ok: false, need2fa: true });
  if (tfa && !await checkSecond(db, d.code)) return await fail('Codice errato');
  await lim.ok();
  const s = await newSession(db, !!d.remember);
  await telegram(env, db, '🔐 OviAmo – accesso al report' + (d.remember ? ' (dispositivo ricordato 30 giorni)' : '') + '.\nSe non sei stato tu, cambia subito la password.');
  return json({ ok: true, s, tfa });
}

/** Password dimenticata: servono un codice di emergenza E il codice a 6 cifre dell'app (tutti e due) */
async function pwReset_(db, env, request, d) {
  const lim = await limiter(db, env, request);
  if (lim.locked()) return json({ ok: false, error: lim.blockedMsg() });
  const sec = await getS(db, 'tfa_secret');
  if (!sec) return json({ ok: false, error: 'Il recupero funziona solo con la verifica in due passaggi attiva.' });
  const pw = String(d.new || '');
  if (pw.length < 10) return json({ ok: false, error: 'La nuova password deve avere almeno 10 caratteri' });
  const fail = async () => { await lim.fail(); return json({ ok: false, error: lim.locked() ? lim.blockedMsg() : 'Codice di emergenza o codice a 6 cifre non validi' }); };
  if (!await hasRecovery(db, d.recovery)) return await fail();
  if (!await checkTotp(db, sec, d.code)) return await fail();
  if (!await useRecovery(db, d.recovery)) return await fail();
  await lim.ok();
  await setS(db, 'pw_hash', await hashPw(pw));
  await db.prepare('DELETE FROM sessions').run();     // chiude l'accesso su tutti gli altri dispositivi
  const left = JSON.parse(await getS(db, 'tfa_recovery') || '[]').length;
  await telegram(env, db, '🔐 OviAmo – la password del report è stata reimpostata con un codice di emergenza (ne restano ' + left + ').\nSe non sei stato tu, avvisa subito chi gestisce il sito.');
  return json({ ok: true, s: await newSession(db, !!d.remember), left });
}

async function security_(db, env, request, d) {
  if (!['secInfo', 'logout', 'logoutAll', 'pwChange', 'tfaStart', 'tfaConfirm', 'tfaOff'].includes(d.action)) return null;
  const tfa = !!(await getS(db, 'tfa_secret'));
  const lim = await limiter(db, env, request);
  if (['pwChange', 'tfaConfirm', 'tfaOff'].includes(d.action) && lim.locked()) return json({ ok: false, error: lim.blockedMsg() });
  const bad = async msg => { await lim.fail(); return json({ ok: false, error: lim.locked() ? lim.blockedMsg() : msg }); };
  switch (d.action) {
    case 'secInfo':
      return json({ ok: true, tfa, recovery: JSON.parse(await getS(db, 'tfa_recovery') || '[]').length, custom: !!(await getS(db, 'pw_hash')) });
    case 'logout': {
      const tok = request.headers.get('X-Ovi-Session') || d.s || '';
      await db.prepare('DELETE FROM sessions WHERE h = ?').bind(await sha256(tok)).run();
      return json({ ok: true });
    }
    case 'logoutAll': {
      await db.prepare('DELETE FROM sessions').run();
      await telegram(env, db, '🔐 OviAmo – chiuse le sessioni del report su tutti i dispositivi.');
      return json({ ok: true });
    }
    case 'pwChange': {
      const pw = String(d.new || '');
      if (pw.length < 10) return json({ ok: false, error: 'La nuova password deve avere almeno 10 caratteri' });
      if (!await checkPw(db, env, d.old)) return await bad('La password attuale non è giusta');
      if (tfa && !await checkSecond(db, d.code)) return await bad('Codice a 6 cifre errato');
      await setS(db, 'pw_hash', await hashPw(pw));
      await db.prepare('DELETE FROM sessions').run();     // esci da tutti gli altri dispositivi
      await telegram(env, db, '🔐 OviAmo – la password del report è stata cambiata.');
      return json({ ok: true, s: await newSession(db, !!d.remember) });
    }
    case 'tfaStart': {
      if (tfa) return json({ ok: false, error: 'La verifica in due passaggi è già attiva' });
      const sec = b32enc(rnd(20));
      await setS(db, 'tfa_pending', sec);
      return json({ ok: true, secret: sec, uri: 'otpauth://totp/OviAmo:report?secret=' + sec + '&issuer=OviAmo&digits=6&period=30' });
    }
    case 'tfaConfirm': {
      const sec = await getS(db, 'tfa_pending');
      if (!sec) return json({ ok: false, error: 'Ricomincia l\'attivazione' });
      if (!await checkTotp(db, sec, d.code)) return await bad('Codice errato: controlla l\'ora del telefono e riprova');
      const codes = [...Array(8)].map(() => b32enc(rnd(7)).slice(0, 10));
      await setS(db, 'tfa_recovery', JSON.stringify(await Promise.all(codes.map(sha256))));
      await setS(db, 'tfa_secret', sec); await setS(db, 'tfa_pending', null);
      await telegram(env, db, '🔐 OviAmo – verifica in due passaggi attivata per il report.');
      return json({ ok: true, recovery: codes.map(c => c.slice(0, 5) + '-' + c.slice(5)) });
    }
    case 'tfaOff': {
      if (!await checkPw(db, env, d.password)) return await bad('Password errata');
      if (!await checkSecond(db, d.code)) return await bad('Codice errato');
      await setS(db, 'tfa_secret', null); await setS(db, 'tfa_recovery', null);
      await telegram(env, db, '⚠️ OviAmo – verifica in due passaggi DISATTIVATA per il report.');
      return json({ ok: true });
    }
  }
  return null;
}

/* ---------- GET ---------- */

export async function onRequestGet({ request, env, waitUntil }) {
  const db = env.DB, p = Object.fromEntries(new URL(request.url).searchParams);
  waitUntil(remind_(env, db).catch(() => {}));
  if (p.action === 'info') {
    const s = await settings_(db), left = await available_(db);
    return json({ ok: true, open: s.open && left > 0, closedByHand: !s.open, available: left, msg: s.msg || DEFAULT_MSG, price1: PRICE_1, price6: PRICE_6, minData: addDays(today_(), 1) });
  }
  if (p.action === 'report') {
    if (!await isMaster(db, request, null)) return json({ ok: false, auth: true, error: 'Accesso scaduto: entra di nuovo' });
    const [orders, loads, costs, hens, users, settings, available, contacts, waMsg, waTpl] = await Promise.all([orders_(db), loads_(db), costs_(db), hens_(db), users_(db), settings_(db), available_(db), contacts_(db), waMsg_(db), waTpl_(db)]);
    return json({ ok: true, orders, loads, costs, hens, users, settings, available, contacts, waMsg, waTpl, waTplDef: WA_TPL, sales: sales_(orders) });
  }
  if (p.action === 'area') {
    const u = await userByToken(db, p.t);
    if (!u) return json({ ok: false, error: 'Link non valido. Chiedi un nuovo link a chi gestisce OviAmo.' });
    const out = { ok: true, nome: u.nome, ruolo: u.ruolo, available: await available_(db), contacts: await contacts_(db), waMsg: await waMsg_(db), waTpl: await waTpl_(db) };
    const loads = await loads_(db);
    if (u.ruolo === 'intermedio') {
      out.loads = loads; out.costs = await costs_(db); out.hens = await hens_(db);
      const ord = (await orders_(db)).filter(o => !o.eliminato);
      out.orders = ord;
      out.sales = sales_(ord);
    } else {
      out.loads = loads.filter(l => l.utente === u.nome);
    }
    return json(out);
  }
  return json({ ok: true, service: 'oviamo' });
}

/* ---------- POST ---------- */

export async function onRequestPost({ request, env, waitUntil }) {
  const db = env.DB, ctx = { waitUntil };
  try {
    const d = JSON.parse(await request.text() || '{}');
    if (!d.action) return await order_(db, env, ctx, d);
    if (d.action === 'login') return await login_(db, env, request, d);
    if (d.action === 'pwReset') return await pwReset_(db, env, request, d);

    const master = await isMaster(db, request, d);
    if (master) { const r = await security_(db, env, request, d); if (r) return r; }
    const u = master ? { nome: 'Master', ruolo: 'master' } : await userByToken(db, d.t);
    if (!u) return json({ ok: false, auth: true, error: 'Accesso non valido' });
    const canCost = master || u.ruolo === 'intermedio';

    switch (d.action) {
      case 'load': return await addLoad_(db, d, u);
      case 'cost': if (!canCost) break; return await addCost_(db, d, u);
      case 'delLoad': return await delEntry_(db, 'loads', d.id, u, master);
      case 'delCost': if (!canCost) break; return await delEntry_(db, 'costs', d.id, u, master);
      case 'hens': if (!canCost) break; return await addHens_(db, d, u);
      case 'delHens': if (!canCost) break; return await delEntry_(db, 'hens', d.id, u, master);
      case 'flag': if (!canCost) break; return await flag_(db, d, u);
      case 'move': if (!canCost) break; return await move_(db, d, u);
      case 'payDel': if (!canCost) break; return await payDel_(db, d);
      case 'contactOrder': if (!canCost) break; return await contactOrder_(db, d);
      case 'decide': if (!canCost) break; return await decide_(db, d);
      case 'delOrders': if (!canCost) break; return await delOrders_(db, d);   // va nel cestino: si ripristina dal report
      case 'contactSave': return await contactSave_(db, d);
      case 'contactDel': await db.prepare('DELETE FROM contacts WHERE id = ?').bind(String(d.id)).run(); return json({ ok: true, contacts: await contacts_(db) });
      case 'waMsg': {
        const t = clean(d.testo, 500);
        await db.prepare("INSERT OR REPLACE INTO settings (k, v) VALUES ('wa_msg', ?)").bind(t).run();
        return json({ ok: true, waMsg: t || WA_MSG });
      }
    }
    if (!master) return json({ ok: false, error: 'Operazione non consentita' });
    switch (d.action) {
      case 'delOrders': return await delOrders_(db, d);
      case 'restore': return await restore_(db, d);
      case 'purge': {
        const ids = (d.ids || []).map(String);
        return json({ ok: true, purged: ids.length ? await purge_(db, `eliminato <> '' AND id IN (${ids.map(() => '?').join(',')})`, ...ids) : 0 });
      }
      case 'settings': return await saveSettings_(db, d);
      case 'waTpl': {   // messaggi WhatsApp per i clienti: un testo vuoto torna a quello originale
        const t = d.tpl || {}, o = {};
        for (const k in WA_TPL) { const v = clean(t[k], 600); if (v && v !== WA_TPL[k]) o[k] = v; }
        await db.prepare("INSERT OR REPLACE INTO settings (k, v) VALUES ('wa_tpl', ?)").bind(JSON.stringify(o)).run();
        return json({ ok: true, waTpl: await waTpl_(db) });
      }
      case 'userSave': return await userSave_(db, d);
      case 'decide': return await decide_(db, d);
      case 'tgLink': return await tgLink_(db, env);
      case 'tgTest': return json({ ok: await telegram(env, db, '🥚 OviAmo: messaggio di prova.') });
      case 'userDelete': await db.prepare('DELETE FROM users WHERE tk = ?').bind(String(d.tk)).run(); return json({ ok: true, users: await users_(db) });
    }
    return json({ ok: false, error: 'Azione sconosciuta' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

export function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Ovi-Session' } });
}

async function order_(db, env, ctx, d) {
  const rid = d.rid ? 'rid:' + String(d.rid).slice(0, 64) : '';
  if (rid) {   // stesso invio ripetuto: restituisco la risposta di prima
    const prev = await db.prepare('SELECT res FROM idem WHERE rid = ?').bind(rid).first();
    if (prev) return json(JSON.parse(prev.res));
  }
  const s = await settings_(db), left = await available_(db);
  if (d.tipo === 'data') return await request_(db, env, d, rid);
  if (!s.open || left <= 0) return json({ ok: false, closed: true, error: s.msg || DEFAULT_MSG });

  const nome = clean(d.nome, 60), cognome = clean(d.cognome, 60);
  if (!nome || !cognome) return json({ ok: false, error: 'Nome e cognome obbligatori' });
  const q1 = Math.max(0, Math.min(99, parseInt(d.q1, 10) || 0));
  const q6 = Math.max(0, Math.min(50, parseInt(d.q6, 10) || 0));
  const uova = q1 + 6 * q6;
  if (!uova) return json({ ok: false, error: 'Scegli almeno un uovo' });
  if (uova > left) return json({ ok: false, error: 'Sono rimaste solo ' + left + ' uova disponibili.' });
  const euro = Math.round((q1 * PRICE_1 + q6 * PRICE_6) * 100) / 100;
  const perIl = '';   // le prenotazioni "subito" non hanno data: per una data si usa la richiesta
  const telefono = clean(d.telefono, 30), note = clean(d.note, 500);

  // inserisce solo se le uova bastano ancora (evita di prenotare due volte le stesse)
  const r = await db.prepare(`INSERT INTO orders (id, data, nome, cognome, telefono, q1, q6, uova, euro, note, per_il)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE ${LOADED} - ${BOOKED} >= ?`)
    .bind(newId('p'), now_(), nome, cognome, telefono, q1, q6, uova, euro, note, perIl, uova).run();
  if (!r.meta.changes) {
    const l2 = await available_(db);
    return json({ ok: false, error: l2 > 0 ? 'Sono rimaste solo ' + l2 + ' uova disponibili.' : (s.msg || DEFAULT_MSG), closed: l2 <= 0 });
  }
  const res = { ok: true, uova, euro, left: left - uova, satispay: SATISPAY_PHONE, perIl };
  if (rid) await db.prepare('INSERT OR REPLACE INTO idem (rid, res, ts) VALUES (?, ?, ?)').bind(rid, JSON.stringify(res), Date.now()).run();

  await telegram(env, db, '🥚 OviAmo – nuova prenotazione\n' + nome + ' ' + cognome + ': ' + (uova === 1 ? '1 uovo' : uova + ' uova') + '\n' +
    (q6 ? q6 + ' confezioni da 6' + (q1 ? ' + ' + q1 + ' singole' : '') : q1 + ' singole') +
    ' · ' + euro.toFixed(2).replace('.', ',') + ' €' +
    (perIl ? '\nPer il: ' + perIl.split('-').reverse().join('/') : '') +
    (telefono ? '\nTel: ' + telefono : '') +
    (note ? '\nNote: ' + note : '') +
    '\nUova ancora disponibili: ' + (left - uova),
    [...(waNum(telefono) ? [[{ text: '💬 Conferma su WhatsApp', url: 'https://wa.me/' + waNum(telefono) + '?text=' + encodeURIComponent(await waFill(db, perIl ? 'conferma' : 'normale', nome, uova, euro, perIl)) }]] : []),
     [{ text: '📋 Apri il report', url: SITE + '/report.html' }]]);
  return json(res);
}

/** Richiesta per una data futura: non impegna le uova, resta "in attesa" finché il gestore non conferma */
async function request_(db, env, d, rid) {
  const nome = clean(d.nome, 60), cognome = clean(d.cognome, 60), telefono = clean(d.telefono, 30), note = clean(d.note, 500);
  if (!nome || !cognome) return json({ ok: false, error: 'Nome e cognome obbligatori' });
  if (telefono.replace(/\D/g, '').length < 6) return json({ ok: false, error: 'Per le richieste con data serve il telefono: ti scriviamo per la conferma.' });
  const minData = addDays(today_(), 1);
  if (!isDate(d.perIl) || d.perIl < minData) return json({ ok: false, error: 'Scegli una data da domani in poi.' });
  if (d.perIl > addDays(today_(), 90)) return json({ ok: false, error: 'Puoi chiedere al massimo per i prossimi 3 mesi.' });
  const q1 = Math.max(0, Math.min(99, parseInt(d.q1, 10) || 0));
  const q6 = Math.max(0, Math.min(50, parseInt(d.q6, 10) || 0));
  const uova = q1 + 6 * q6;
  if (!uova) return json({ ok: false, error: 'Scegli almeno un uovo' });
  const euro = Math.round((q1 * PRICE_1 + q6 * PRICE_6) * 100) / 100;
  await db.prepare(`INSERT INTO orders (id, data, nome, cognome, telefono, q1, q6, uova, euro, note, per_il, stato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'attesa')`)
    .bind(newId('p'), now_(), nome, cognome, telefono, q1, q6, uova, euro, note, d.perIl).run();
  const res = { ok: true, richiesta: true, uova, euro, perIl: d.perIl };
  if (rid) await db.prepare('INSERT OR REPLACE INTO idem (rid, res, ts) VALUES (?, ?, ?)').bind(rid, JSON.stringify(res), Date.now()).run();
  const ack = await waFill(db, 'ricevuta', nome, uova, euro, d.perIl);
  await telegram(env, db, '📅 OviAmo – nuova richiesta da confermare\n' + nome + ' ' + cognome + ': ' + (uova === 1 ? '1 uovo' : uova + ' uova') +
    ' per ' + dIt(d.perIl) + '\nTel: ' + telefono + (note ? '\nNote: ' + note : '') +
    '\nUova disponibili ora: ' + await available_(db),
    [...(waNum(telefono) ? [[{ text: '💬 Rispondi su WhatsApp (ricevuta)', url: 'https://wa.me/' + waNum(telefono) + '?text=' + encodeURIComponent(ack) }]] : []),
     [{ text: '📋 Apri il report per confermare', url: SITE + '/report.html' }]]);
  return json(res);
}

/** Conferma (stato 'ok', impegna le uova se bastano), rifiuta o rimette in attesa una richiesta */
async function decide_(db, d) {
  const id = String(d.id || ''), v = d.value;
  if (!['ok', 'rifiutata', 'attesa'].includes(v)) return json({ ok: false, error: 'Valore non valido' });
  let r;
  if (v === 'ok') {
    // d.force: conferma anche se adesso le uova non bastano (le prossime caricate andranno prima a questa)
    r = d.force ? await db.prepare(`UPDATE orders SET stato = 'ok' WHERE id = ? AND stato <> 'ok'`).bind(id).run()
      : await db.prepare(`UPDATE orders SET stato = 'ok' WHERE id = ? AND stato <> 'ok' AND ${LOADED} - ${BOOKED} >= uova`).bind(id).run();
    if (!r.meta.changes) {
      const o = await db.prepare('SELECT uova, stato FROM orders WHERE id = ?').bind(id).first();
      if (!o) return json({ ok: false, error: 'Richiesta non trovata' });
      if (o.stato === 'ok') return json({ ok: true, already: true });
      const av = await available_(db);
      return json({ ok: false, short: true, need: o.uova, available: av, error: 'Uova insufficienti: ne servono ' + o.uova + ', disponibili ' + av + '.' });
    }
  } else {
    r = await db.prepare('UPDATE orders SET stato = ? WHERE id = ?').bind(v, id).run();
    if (!r.meta.changes) return json({ ok: false, error: 'Richiesta non trovata' });
  }
  return json({ ok: true, available: await available_(db) });
}

async function addLoad_(db, d, u) {
  const n = parseInt(d.uova, 10) || 0;
  if (!n || (n < 0 && u.ruolo !== 'master')) return json({ ok: false, error: 'Numero di uova non valido' });
  if (Math.abs(n) > 5000) return json({ ok: false, error: 'Numero troppo grande' });
  const data = isDate(d.data) ? d.data : today_();
  await db.prepare('INSERT INTO loads (id, data, uova, utente, note, ins) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(newId('c'), data, n, u.nome, clean(d.note, 200), now_()).run();
  return json({ ok: true, available: await available_(db) });
}

async function addCost_(db, d, u) {
  const imp = Math.round((parseFloat(String(d.importo).replace(',', '.')) || 0) * 100) / 100;
  const descr = clean(d.descr, 120);
  if (!imp || imp < 0) return json({ ok: false, error: 'Importo non valido' });
  if (!descr) return json({ ok: false, error: 'Scrivi una descrizione (es. mangime 25 kg)' });
  const data = isDate(d.data) ? d.data : today_();
  const qta = Math.round((parseFloat(String(d.qta || '').replace(',', '.')) || 0) * 1000) / 1000;
  if (qta < 0 || qta > 100000) return json({ ok: false, error: 'Quantità non valida' });
  const unita = qta ? (['kg', 'pz', 'l'].indexOf(d.unita) >= 0 ? d.unita : 'kg') : '';
  await db.prepare('INSERT INTO costs (id, data, descr, euro, utente, ins, qta, unita) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('k'), data, descr, imp, u.nome, now_(), qta, unita).run();
  return json({ ok: true });
}

async function addHens_(db, d, u) {
  const tot = parseInt(d.tot, 10), prod = parseInt(d.prod, 10);
  if (!(tot >= 0) || !(prod >= 0) || tot > 10000) return json({ ok: false, error: 'Numero di galline non valido' });
  if (prod > tot) return json({ ok: false, error: 'Le galline in produzione non possono essere più del totale' });
  const data = isDate(d.data) ? d.data : today_();
  await db.prepare('INSERT INTO hens (id, data, tot, prod, utente, note, ins) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('g'), data, tot, prod, u.nome, clean(d.note, 200), now_()).run();
  return json({ ok: true, hens: await hens_(db) });
}

/** Cancella un carico, un costo o un dato galline: il master tutto, gli altri solo quello che hanno inserito loro */
async function delEntry_(db, table, id, u, master) {
  if (!master) {
    const it = await db.prepare(`SELECT utente FROM ${table} WHERE id = ?`).bind(String(id)).first();
    if (!it || it.utente !== u.nome) return json({ ok: false, error: 'Puoi cancellare solo quello che hai inserito tu' });
  }
  const r = await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(String(id)).run();
  return json({ ok: r.meta.changes > 0, available: await available_(db) });
}

/** Ricalcola pagato / consegnato / metodo / data_pag / consegnate di un ordine dai suoi movimenti (tabella payments) */
async function sync_(db, id) {
  const o = await db.prepare('SELECT euro, uova FROM orders WHERE id = ?').bind(id).first();
  if (!o) return;
  const P = await all(db, 'SELECT data, euro, uova, metodo FROM payments WHERE order_id = ? ORDER BY data, ins', id);
  const M = P.filter(p => p.euro > 0), paid = M.reduce((t, p) => t + p.euro, 0), dl = P.reduce((t, p) => t + (p.uova || 0), 0);
  const met = [...new Set(M.map(p => p.metodo || ''))];
  await db.prepare('UPDATE orders SET pagato = ?, data_pag = ?, metodo = ?, consegnate = ?, consegnato = ? WHERE id = ?')
    .bind(paid >= o.euro - 0.005 ? 1 : 0, M.length ? M[M.length - 1].data : '', met.length === 1 ? met[0] : met.length ? 'misto' : '',
      Math.min(dl, o.uova), dl >= o.uova ? 1 : 0, id).run();
}
/** Quanto manca da pagare e quante uova da consegnare */
const remaining_ = async (db, id) => {
  const r = await db.prepare(`SELECT euro - COALESCE((SELECT SUM(euro) FROM payments WHERE order_id = orders.id), 0) AS e,
    uova - COALESCE((SELECT SUM(uova) FROM payments WHERE order_id = orders.id), 0) AS u FROM orders WHERE id = ?`).bind(id).first();
  return r ? { e: Math.max(0, Math.round(r.e * 100) / 100), u: Math.max(0, r.u) } : null;
};
const addMove_ = (db, id, data, uova, euro, metodo, u) => db.prepare('INSERT INTO payments (id, order_id, data, euro, uova, metodo, utente, ins) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  .bind(newId('m'), id, data, euro, uova, euro > 0 ? (metodo === 'satispay' ? 'satispay' : 'contanti') : '', u.nome, now_()).run();

/** Dal report: tutto pagato / niente pagato, tutto consegnato / niente consegnato */
async function flag_(db, d, u) {
  const field = d.field === 'pagato' ? 'pagato' : d.field === 'consegnato' ? 'consegnato' : '';
  if (!field) return json({ ok: false, error: 'Campo non valido' });
  const ids = (d.ids || []).map(String), on = d.value === true;
  let n = 0;
  for (const id of ids) {
    const rest = await remaining_(db, id);
    if (!rest) continue;
    if (on) {
      if (field === 'pagato' && rest.e > 0.005) await addMove_(db, id, today_(), 0, rest.e, d.metodo, u);
      if (field === 'consegnato' && rest.u > 0) await addMove_(db, id, today_(), rest.u, 0, '', u);
    } else {
      await db.prepare(field === 'pagato' ? "UPDATE payments SET euro = 0, metodo = '' WHERE order_id = ?" : 'UPDATE payments SET uova = 0 WHERE order_id = ?').bind(id).run();
      await db.prepare('DELETE FROM payments WHERE order_id = ? AND euro <= 0 AND COALESCE(uova,0) <= 0').bind(id).run();
    }
    await sync_(db, id); n++;
  }
  return json({ ok: true, updated: n });
}

/** Un movimento: uova consegnate adesso (d.uova) e/o soldi ricevuti adesso (d.euro, d.metodo). Anche in anticipo o in parte. */
async function move_(db, d, u) {
  const id = String(d.id || ''), rest = await remaining_(db, id);
  if (!rest) return json({ ok: false, error: 'Prenotazione non trovata' });
  const n = Math.max(0, parseInt(d.uova, 10) || 0);
  const e = Math.round((parseFloat(String(d.euro == null ? '' : d.euro).replace(',', '.')) || 0) * 100) / 100;
  if (!n && !(e > 0)) return json({ ok: false, error: 'Scrivi le uova consegnate o l\'importo pagato' });
  if (n > rest.u) return json({ ok: false, error: rest.u ? 'Restano da consegnare solo ' + rest.u + ' uova' : 'Le uova sono già tutte consegnate' });
  if (e < 0 || e > rest.e + 0.005) return json({ ok: false, error: rest.e > 0 ? 'Restano da pagare solo ' + rest.e.toFixed(2).replace('.', ',') + ' €' : 'È già tutto pagato' });
  if (e > 0 && d.metodo !== 'contanti' && d.metodo !== 'satispay') return json({ ok: false, error: 'Scegli Contanti o Satispay' });
  await addMove_(db, id, isDate(d.data) ? d.data : today_(), n, e, d.metodo, u);
  await sync_(db, id);
  return json({ ok: true });
}
async function payDel_(db, d) {
  const p = await db.prepare('SELECT order_id FROM payments WHERE id = ?').bind(String(d.pid || '')).first();
  if (!p) return json({ ok: false, error: 'Movimento non trovato' });
  await db.prepare('DELETE FROM payments WHERE id = ?').bind(String(d.pid)).run();
  await sync_(db, p.order_id);
  return json({ ok: true });
}

/** Uova prese da una persona della rubrica: diventa una prenotazione come le altre (toglie uova dalla disponibilità) */
async function contactOrder_(db, d) {
  const c = await db.prepare('SELECT id, nome, tel FROM contacts WHERE id = ?').bind(String(d.cid || '')).first();
  if (!c) return json({ ok: false, error: 'Persona non trovata' });
  const uova = Math.max(0, Math.min(1000, parseInt(d.uova, 10) || 0));
  if (!uova) return json({ ok: false, error: 'Scrivi quante uova ha preso' });
  const q6 = Math.floor(uova / 6), q1 = uova % 6;
  const euro = d.euro === '' || d.euro == null ? q1 * PRICE_1 + q6 * PRICE_6 : Math.round((parseFloat(String(d.euro).replace(',', '.')) || 0) * 100) / 100;
  if (!(euro >= 0) || euro > 10000) return json({ ok: false, error: 'Importo non valido' });
  const data = (isDate(d.data) ? d.data : today_()) + now_().slice(10);
  const r = await db.prepare(`INSERT INTO orders (id, data, nome, cognome, telefono, q1, q6, uova, euro, note, per_il, contatto)
    SELECT ?, ?, ?, '', ?, ?, ?, ?, ?, ?, '', ? WHERE ${LOADED} - ${BOOKED} >= ?`)
    .bind(newId('p'), data, c.nome, c.tel, q1, q6, uova, euro, clean(d.note, 500), c.id, uova).run();
  if (!r.meta.changes) return json({ ok: false, error: 'Uova insufficienti: disponibili ' + await available_(db) + '. Carica prima le uova.' });
  return json({ ok: true, available: await available_(db) });
}

/** "Elimina" sposta nel cestino: le uova tornano disponibili, ma si può ripristinare */
async function delOrders_(db, d) {
  const ids = (d.ids || []).map(String);
  if (!ids.length) return json({ ok: true, deleted: 0 });
  const r = await db.prepare(`UPDATE orders SET eliminato = ? WHERE COALESCE(eliminato,'') = '' AND id IN (${ids.map(() => '?').join(',')})`).bind(now_(), ...ids).run();
  return json({ ok: true, deleted: r.meta.changes });
}
async function restore_(db, d) {
  const ids = (d.ids || []).map(String);
  if (!ids.length) return json({ ok: true, restored: 0 });
  const r = await db.prepare(`UPDATE orders SET eliminato = '' WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).run();
  return json({ ok: true, restored: r.meta.changes, available: await available_(db) });
}
/** Cancella per sempre (solo dal cestino) */
async function purge_(db, where, ...b) {
  const L = await all(db, `SELECT id FROM orders WHERE ${where}`, ...b);
  if (!L.length) return 0;
  const ids = L.map(o => o.id), marks = ids.map(() => '?').join(',');
  await db.prepare(`DELETE FROM payments WHERE order_id IN (${marks})`).bind(...ids).run();
  await db.prepare(`DELETE FROM orders WHERE id IN (${marks})`).bind(...ids).run();
  return ids.length;
}

async function saveSettings_(db, d) {
  const st = [];
  if ('open' in d) st.push(db.prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)').bind('open', d.open ? '1' : '0'));
  if ('msg' in d) st.push(db.prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)').bind('msg', clean(d.msg, 300)));
  if (st.length) await db.batch(st);
  return json({ ok: true, settings: await settings_(db) });
}

/** Aggiunge o modifica un utente: d.tk vuoto = nuovo; d.nome, d.ruolo ('intermedio'|'caricatore') */
async function userSave_(db, d) {
  const nome = clean(d.nome, 60), ruolo = d.ruolo === 'intermedio' ? 'intermedio' : 'caricatore';
  if (!nome) return json({ ok: false, error: 'Nome obbligatorio' });
  const list = await users_(db);
  if (list.some(x => x.nome.toLowerCase() === nome.toLowerCase() && x.tk !== d.tk)) return json({ ok: false, error: 'Esiste già un utente con questo nome' });
  if (d.tk) {
    const r = await db.prepare('UPDATE users SET nome = ?, ruolo = ? WHERE tk = ?').bind(nome, ruolo, String(d.tk)).run();
    if (!r.meta.changes) return json({ ok: false, error: 'Utente non trovato' });
  } else {
    await db.prepare('INSERT INTO users (tk, nome, ruolo, creato) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID().replace(/-/g, '').slice(0, 16), nome, ruolo, today_()).run();
  }
  return json({ ok: true, users: await users_(db) });
}

/** Rubrica "Avvisa su WhatsApp": aggiunge (o aggiorna, se d.id) una persona */
async function contactSave_(db, d) {
  const nome = clean(d.nome, 60), tel = clean(d.tel, 30);
  if (!nome) return json({ ok: false, error: 'Scrivi il nome' });
  if (tel.replace(/\D/g, '').length < 8) return json({ ok: false, error: 'Controlla il numero di telefono' });
  if (d.id) await db.prepare('UPDATE contacts SET nome = ?, tel = ? WHERE id = ?').bind(nome, tel, String(d.id)).run();
  else await db.prepare('INSERT INTO contacts (id, nome, tel) VALUES (?, ?, ?)').bind(newId('r'), nome, tel).run();
  return json({ ok: true, contacts: await contacts_(db) });
}
