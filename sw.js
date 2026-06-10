// Gezi Rotası — service worker (PWA: çevrimdışı açılış + statik kaynak önbelleği)
// v2: HTML artık "önce ağ" ile yüklenir — güncellemeler anında görünür
const CACHE = 'gezi-v2';
const SHELL = ['./', './index.html', './manifest.json'];
// Yalnızca statik CDN'ler önbelleğe alınır; Firebase auth/database istekleri ASLA önbelleğe alınmaz
const CACHEABLE = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com/firebasejs', 'img.icons8.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  const sameOrigin = url.startsWith(self.location.origin);
  const cdnOk = CACHEABLE.some(d => url.includes(d));
  if (!sameOrigin && !cdnOk) return; // Firebase vb. ağa gitsin

  const isHTML = e.request.mode === 'navigate' || (sameOrigin && (url.endsWith('/') || url.includes('.html')));

  if (isHTML) {
    // HTML: önce ağ — güncel sürüm gelsin; çevrimdışıysa önbellekten aç
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Statik kaynaklar (CDN, manifest): önce önbellek, yoksa ağ
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
