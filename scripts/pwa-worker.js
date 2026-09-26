const cachePrefix = `math-marsh-${new URL(self.registration.scope).pathname}-`;
const cacheName = `${cachePrefix}__CACHE_VERSION__`;
const files = __PRECACHE_FILES__;
const scope = self.registration.scope;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    files.map(file => new URL(file, scope).href),
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(names => Promise.all(names
      .filter(name => name.startsWith(cachePrefix) && name !== cacheName)
      .map(name => caches.delete(name)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(scope)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.open(cacheName);
      return cached.match(new URL('index.html', scope).href);
    }));
    return;
  }

  event.respondWith(caches.open(cacheName).then(async cache =>
    (await cache.match(request)) ?? fetch(request)));
});
