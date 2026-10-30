// Service worker de Tesoro PA: guarda la app en el teléfono para que abra sin señal.
// La página siempre intenta traer la última versión; si no hay señal (o tarda más de 3 s), usa la guardada.
// Si cambiás este archivo, subí el número de VERSION.
const VERSION = 'tesoro-pa-1';
const FUENTES = 'tesoro-pa-fuentes';
const BASE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('tesoro-pa') && k !== VERSION && k !== FUENTES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function conLimite(promesa, ms) {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error('sin respuesta')), ms);
    promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); });
  });
}

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (u.origin === self.location.origin) {
    if (r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')) {
      e.respondWith(
        conLimite(fetch(r), 3000)
          .then((res) => {
            if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copia)); }
            return res;
          })
          .catch(() => caches.match('./index.html').then((h) => h || fetch(r)))
      );
      return;
    }
    e.respondWith(
      caches.match(r).then((h) => h || fetch(r).then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(r, copia)); }
        return res;
      }))
    );
    return;
  }

  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FUENTES).then((c) => c.match(r).then((h) => h || fetch(r).then((res) => { c.put(r, res.clone()); return res; })))
    );
  }
});
