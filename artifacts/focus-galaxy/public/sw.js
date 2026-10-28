const CACHE_NAME = 'focus-galaxy-shell-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
];

function extractShellAssetUrls(html) {
  const urls = new Set();
  const pattern = /\b(?:src|href)=["'](\/assets\/[^"'?#]+)["']/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    urls.add(match[1]);
  }
  return Array.from(urls);
}

async function pruneStaleBuildAssets(cache, assetUrls) {
  if (assetUrls.length === 0) return;
  const activeAssets = new Set(assetUrls);
  const requests = await cache.keys();
  await Promise.all(
    requests
      .filter((req) => {
        const pathname = new URL(req.url).pathname;
        return pathname.startsWith('/assets/') && !activeAssets.has(pathname);
      })
      .map((req) => cache.delete(req)),
  );
}

async function syncShellCache() {
  const cache = await caches.open(CACHE_NAME);
  const htmlResponse = await fetch('/index.html', { cache: 'no-cache' });
  let assetUrls = [];
  if (htmlResponse.ok && htmlResponse.type === 'basic') {
    const html = await htmlResponse.clone().text();
    assetUrls = extractShellAssetUrls(html);
    await Promise.all([
      cache.put('/', htmlResponse.clone()),
      cache.put('/index.html', htmlResponse),
    ]);
  }
  const urlsToCache = [
    ...PRECACHE_URLS.filter((url) => url !== '/' && url !== '/index.html'),
    ...assetUrls,
  ];
  await Promise.all(
    urlsToCache.map(async (url) => {
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok && response.type === 'basic') {
        await cache.put(url, response);
      }
    }),
  );
  await pruneStaleBuildAssets(cache, assetUrls);
}

self.addEventListener('install', (event) => {
  event.waitUntil(syncShellCache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('focus-galaxy-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Strictly restrict caching to same-origin static/app requests.
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  const isHtmlShell =
    request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          if (isHtmlShell) {
            void (async () => {
              const cache = await caches.open(CACHE_NAME);
              const html = await copy.text();
              const assetUrls = extractShellAssetUrls(html);
              await Promise.all([
                cache.put('/', new Response(html, { headers: response.headers })),
                cache.put('/index.html', new Response(html, { headers: response.headers })),
                ...assetUrls.map(async (assetUrl) => {
                  if (!(await cache.match(assetUrl))) {
                    const assetRes = await fetch(assetUrl, { cache: 'no-cache' });
                    if (assetRes.ok && assetRes.type === 'basic') {
                      await cache.put(assetUrl, assetRes);
                    }
                  }
                }),
              ]);
              await pruneStaleBuildAssets(cache, assetUrls);
            })();
          } else {
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return (await caches.match('/index.html')) || (await caches.match('/'));
        }
        throw new Error('Offline and not in cache');
      }),
  );
});
