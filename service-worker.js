// ─────────────────────────────────────────────
// service-worker.js — Estratégia cache-first
// Garante funcionamento 100% offline
// ─────────────────────────────────────────────

const CACHE_NAME = 'gymcontrol-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/database.js',
  '/js/auth.js',
  '/js/alunas.js',
  '/js/relatorios.js',
  '/js/backup.js',
  '/js/app.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

// Install: pré-cache de todos os assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => console.log('Falha ao cachear:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: limpa caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first
self.addEventListener('fetch', (e) => {
  // Ignora requisições que não sejam GET
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      // Não está no cache, tenta rede
      return fetch(e.request).then(response => {
        // Cacheia respostas válidas
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline e não cacheado: retorna página principal como fallback
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
