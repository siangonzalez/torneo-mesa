// ==================== SERVICE WORKER: uso sin conexión ====================
// Guarda una copia de la app para que abra sin internet. Los datos del torneo NO pasan por
// aquí: los maneja Firebase, y app.js guarda una copia local del último estado.
//
// Estrategias:
//   - Página (index.html): primero la red, si no hay conexión la copia guardada. Así siempre
//     se ve la versión más nueva cuando hay internet.
//   - Archivos con versión (?v=…), SDK de Firebase, íconos y fuentes: primero la copia; como
//     cada versión tiene su propia URL, nunca se sirve un archivo viejo para una versión nueva.
//
// Al publicar una versión nueva, actualizar APP_VERSION y que coincida con los ?v= de
// index.html y app.js (lo comprueba tests/sw.test.js).

const APP_VERSION = '3.3.0';
const SHELL_CACHE = `torneo-shell-${APP_VERSION}`;
const RUNTIME_CACHE = 'torneo-runtime-v1';
const V = `?v=${APP_VERSION}`;

const SHELL_FILES = [
  './',
  'index.html',
  `css/styles.css${V}`,
  `js/app.js${V}`,
  `js/scoring.js${V}`,
  `js/sync.js${V}`,
  `js/text.js${V}`,
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/favicon-32.png',
];

const FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL_FILES);
    // El SDK y las fuentes vienen de otros servidores: si fallan, la instalación sigue igual
    // y se guardan la próxima vez que se usen.
    const runtime = await caches.open(RUNTIME_CACHE);
    await Promise.all(FIREBASE_SDK.map(url => runtime.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, RUNTIME_CACHE];
    for (const key of await caches.keys()) {
      if (key.startsWith('torneo-') && !keep.includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function isCacheFirst(url) {
  if (url.origin === self.location.origin) return url.search.includes('v=') || /\/(icons\/|manifest\.webmanifest)/.test(url.pathname);
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) return true;
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const shell = await caches.open(SHELL_CACHE);
        shell.put('index.html', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (!isCacheFirst(url)) return; // Firebase (datos) y todo lo demás va directo a la red

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
      const runtime = await caches.open(RUNTIME_CACHE);
      runtime.put(req, res.clone());
    }
    return res;
  })());
});
