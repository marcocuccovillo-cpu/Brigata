// Brigata — service worker: l'app si apre anche senza rete.
// Cambia il numero di versione a ogni aggiornamento dei file.
const C = 'br38';
const F = ['./', 'index.html', 'menu.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'app.css',
  'config.js', 'core.js', 'qr.js', 'cloud.js', 'cucina.js', 'haccp.js', 'magazzino.js',
  'bacheca.js', 'turni.js', 'libro.js', 'profilo.js', 'staff.js', 'scanner.js', 'attestati.js', 'preparazioni.js', 'fornitori.js', 'abbattimento.js', 'manutenzioni.js', 'inventario.js', 'report.js', 'app.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => Promise.all(F.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {})))));
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x != C).map(x => caches.delete(x)))).then(() => self.clients.claim())
));

// prima la rete, poi la copia salvata; solo file dell'app (mai le chiamate al database)
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method != 'GET' || u.origin != location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(C).then(x => x.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request, {ignoreSearch: u.pathname.endsWith('menu.html')}).then(r => r || caches.match('index.html')))
  );
});
