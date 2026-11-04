/**
 * OviAmo – sito riservato.
 * Se nel report è acceso "Sito riservato", la pagina pubblica si apre solo con il link
 * https://oviamo.boneggio.it/?c=CODICE (il codice si cambia dal report: quello vecchio smette di valere).
 * Chi apre il link una volta resta dentro (cookie ovi_inv per un anno). Report, aree personali e immagini non cambiano.
 */
const PAGINE = new Set(['/', '/index.html', '/index']);

const RISERVATA = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>OviAmo – pagina riservata</title>
<meta property="og:title" content="OviAmo – Uova fresche">
<meta property="og:description" content="Pagina riservata: chiedi il link a chi ti ha parlato delle nostre uova.">
<meta property="og:image" content="https://oviamo.boneggio.it/og-image.jpg">
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#f3f7ec;--card:#fffff9;--ink:#1f2a17;--muted:#55644e;--brand:#3f6b2a}
@media (prefers-color-scheme:dark){:root{--bg:#121a0f;--card:#1a2416;--ink:#eaf2e2;--muted:#a7b79d;--brand:#8cc46a}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,sans-serif;text-align:center}
main{max-width:420px;background:var(--card);border-radius:26px;padding:30px 24px;box-shadow:0 18px 40px -24px rgba(40,60,20,.5)}
img{width:110px;height:110px}
h1{font-family:Fraunces,Georgia,serif;font-weight:800;font-size:2.4rem;margin:.3em 0 .1em;color:var(--brand)}
p{margin:.6em 0 0;color:var(--muted)}
b{color:var(--ink)}
</style></head>
<body><main>
<img src="/logo.svg" alt="">
<h1>OviAmo</h1>
<p><b>Questa pagina è riservata.</b></p>
<p>Chiedi il link a chi ti ha parlato delle nostre uova.</p>
</main></body></html>`;

const cookieOf = (request, k) => { const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + k + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; };

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (!PAGINE.has(url.pathname)) return next();
  const s = {};
  try { (await env.DB.prepare("SELECT k, v FROM settings WHERE k IN ('riservato','invito')").all()).results.forEach(r => s[r.k] = r.v); }
  catch (e) { return next(); }
  if (s.riservato !== '1') return next();
  const inv = s.invito || '', q = (url.searchParams.get('c') || '').trim().toLowerCase(), c = cookieOf(request, 'ovi_inv');
  if (inv && (q === inv || c === inv)) {
    const res = await next(), r = new Response(res.body, res);
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    r.headers.set('Cache-Control', 'no-store');
    if (q === inv && c !== inv) r.headers.append('Set-Cookie', 'ovi_inv=' + encodeURIComponent(inv) + '; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax');
    return r;
  }
  return new Response(RISERVATA, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
