const CACHE_NAME = 'robot-env-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/runner.js'
];

// Separate cache for CDN modules
const CDN_CACHE = 'cdn-modules-v1';

// Install: pre-cache core assets (avoid pre-caching heavy editor & designer — load lazily)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(CORE_ASSETS).catch(()=>{})
    )
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME && k !== CDN_CACHE) return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Helper: network-first with cache fallback
async function networkFirst(req, cacheName){
  try{
    const res = await fetch(req);
    if(res && res.status === 200){
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  }catch(e){
    const cached = await caches.match(req);
    if(cached) return cached;
    throw e;
  }
}

// Fetch: navigation -> network-first with fallback to cached index.html
// CDN (esm.sh) -> network-first but cached in CDN_CACHE
// Other same-origin -> stale-while-revalidate from CORE cache
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigation requests: prefer network then fallback to cached index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', res.clone()));
        }
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // CDN modules (esm.sh) -> network-first, cache in CDN_CACHE
  if (url.hostname.endsWith('esm.sh')) {
    e.respondWith(
      networkFirst(req, CDN_CACHE).catch(()=> caches.match(req))
    );
    return;
  }

  // Other same-origin resources -> stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes.clone()));
          }
          return networkRes.clone();
        }).catch(()=>undefined);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Fallback for other cross-origin -> try network then cache
  e.respondWith(
    fetch(req).catch(()=> caches.match(req))
  );
});