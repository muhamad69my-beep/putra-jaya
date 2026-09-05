// PUTRAJAYA 2 — Service Worker (kerangka app saja)
// Cuma menyimpan file kerangka (index.html, manifest.json, ikon) secara lokal.
// TIDAK menyimpan data transaksi/produk — itu selalu diambil langsung dari
// Supabase saat online. Tujuannya cuma supaya halaman tetap bisa terbuka saat
// tidak ada internet, dan menampilkan layar "Tidak ada koneksi" milik app
// sendiri, bukan halaman offline bawaan browser.

const CACHE_VERSION = 'v1';
const CACHE_NAME = 'putrajaya2-shell-' + CACHE_VERSION;
const SHELL_FILES = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon.png'];
const SHELL_URLS = SHELL_FILES.map(function (f) {
  return new URL(f, self.location.href).href;
});

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_URLS);
    }).catch(function () {})
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Biarkan request ke Supabase/API lain (beda origin) langsung ke network,
  // tidak disentuh service worker sama sekali.
  if (url.origin !== self.location.origin) return;

  const isShell = SHELL_URLS.indexOf(url.href.split('?')[0]) !== -1 || req.mode === 'navigate';
  if (!isShell) return;

  // Strategi: network-first (selalu coba ambil versi terbaru dulu kalau online),
  // fallback ke cache kalau offline.
  event.respondWith(
    fetch(req).then(function (res) {
      const resClone = res.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || caches.match(new URL('index.html', self.location.href).href);
      });
    })
  );
});
