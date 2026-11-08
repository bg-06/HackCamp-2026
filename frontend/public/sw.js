const CACHE = 'block-by-block-offline-v1'
const OFFLINE_PAGE = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_PAGE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('block-by-block-offline-') && key !== CACHE).map((key) => caches.delete(key)))))
})

// Only fall back for page navigations. API responses and authenticated content are never cached.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(OFFLINE_PAGE)) || Response.error()))
})
