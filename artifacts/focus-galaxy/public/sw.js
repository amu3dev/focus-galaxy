const CACHE_NAME = 'focus-galaxy-shell-v1';
const STAGE_CACHE_PREFIX = 'focus-galaxy-shell-stage-';
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

let promoteQueue = Promise.resolve();

function enqueuePromotion(task) {
  const next = promoteQueue.then(task, task);
  promoteQueue = next.catch(() => {});
  return next;
}

async function stageAndPromoteShell(html, htmlHeaders, includeStaticPrecache) {
  if (!html || !html.includes('<div id="root">') || !html.includes('<script')) {
    throw new Error('Invalid application shell HTML');
  }
  const assetUrls = extractShellAssetUrls(html);
  const staticUrls = includeStaticPrecache
    ? PRECACHE_URLS.filter((url) => url !== '/' && url !== '/index.html')
    : [];
  const urlsToStage = Array.from(new Set([...staticUrls, ...assetUrls]));
  const stageCacheName = `${STAGE_CACHE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const activeCache = await caches.open(CACHE_NAME);

    const settled = await Promise.allSettled(
      urlsToStage.map(async (url) => {
        if (!includeStaticPrecache && url.startsWith('/assets/')) {
          const existing = await activeCache.match(url);
          if (existing && existing.status === 200) {
            return { url, response: existing };
          }
        }
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response || response.status !== 200 || response.type !== 'basic') {
          throw new Error(`Failed to stage required shell asset: ${url}`);
        }
        return { url, response };
      }),
    );

    const rejected = settled.find((item) => item.status === 'rejected');
    if (rejected) {
      throw rejected.reason;
    }

    const stagedAssets = settled.map((item) => item.value);
    const stageCache = await caches.open(stageCacheName);
    await Promise.all(
      stagedAssets.map(({ url, response }) => stageCache.put(url, response.clone())),
    );

    const headers = new Headers(htmlHeaders);
    await Promise.all([
      stageCache.put('/', new Response(html, { headers })),
      stageCache.put('/index.html', new Response(html, { headers })),
    ]);

    for (const url of ['/', '/index.html', ...urlsToStage]) {
      const verified = await stageCache.match(url);
      if (!verified || verified.status !== 200) {
        throw new Error(`Stage verification failed for: ${url}`);
      }
    }

    await enqueuePromotion(async () => {
      await Promise.all(
        stagedAssets.map(({ url, response }) => activeCache.put(url, response)),
      );
      await Promise.all([
        activeCache.put('/', new Response(html, { headers })),
        activeCache.put('/index.html', new Response(html, { headers })),
      ]);
      await pruneStaleBuildAssets(activeCache, assetUrls);
    });
  } finally {
    await caches.delete(stageCacheName);
  }
}

async function syncShellCache() {
  const htmlResponse = await fetch('/index.html', { cache: 'no-cache' });
  if (!htmlResponse || htmlResponse.status !== 200 || htmlResponse.type !== 'basic') {
    throw new Error('Failed to fetch application shell HTML');
  }
  const html = await htmlResponse.text();
  await stageAndPromoteShell(html, htmlResponse.headers, true);
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
            .filter(
              (key) =>
                (key.startsWith('focus-galaxy-shell-') && key !== CACHE_NAME) ||
                key.startsWith(STAGE_CACHE_PREFIX),
            )
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

  if (isHtmlShell) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (!response || response.status !== 200 || response.type !== 'basic') {
            throw new Error('Non-OK shell response');
          }
          const html = await response.clone().text();
          await stageAndPromoteShell(html, response.headers, false);
          return response;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cached =
            (await cache.match(request)) ||
            (await cache.match('/index.html')) ||
            (await cache.match('/'));
          if (cached) return cached;
          throw new Error('Offline and not in cache');
        }
      })(),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error('Offline and not in cache');
      }),
  );
});
