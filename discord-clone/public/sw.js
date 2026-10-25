// CapyChat Service Worker — PWA & Static Asset Cache
// Versão do cache estático (apenas assets da aplicação, NUNCA APIs privadas)
const CACHE_NAME = 'capychat-static-v1.0.0';

// Recursos estáticos básicos do app shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/logos/capy-white.png',
  '/logos/capy-colored.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        // Pre-cache não bloqueia a instalação se algum recurso falhar
        console.warn('[ServiceWorker] Precache aviso:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Limpando cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // REGRA DE SEGURANÇA ABSOLUTA:
  // NUNCA interceptar ou fazer cache de requisições ao Supabase, APIs dinâmicas,
  // autenticação, chamadas de voz/vídeo ou websockets.
  if (
    request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/v1/') ||
    url.pathname.includes('/realtime/') ||
    url.protocol.startsWith('ws')
  ) {
    return; // Passa direto para a rede sem cache
  }

  // Para navegação HTML (páginas): Network-First com fallback pro cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Para assets estáticos locais (JS, CSS, imagens, fontes): Stale-While-Revalidate seguro
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Falha de rede silenciosa se já houver cache
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
