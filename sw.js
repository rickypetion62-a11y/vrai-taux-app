/* Service worker : cache versionné, hors ligne d'abord, mise à jour sur demande de l'utilisateur. */
const VERSION = 'vraih-v8';
const FICHIERS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'taux-2026.json',
  'src/ui.js',
  'src/calc.js',
  'src/taxes.js',
  'src/storage.js',
  'src/security.js',
  'src/i18n.js',
  'src/importcsv.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon.ico',
  'favicon-32.png',
  'confidentialite.html',
  'conditions.html',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((k) => Promise.all(k.filter((x) => x !== VERSION).map((x) => caches.delete(x))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (r) =>
        r ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const cp = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, cp));
          }
          return res;
        }),
    ),
  );
});
