import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { CDP, viewport, click } from './cdp-harness.mjs';

const port = Number(process.env.CDP_PORT || 9228);
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const distDir = path.resolve(import.meta.dirname, '../dist/public');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

async function startControlledProdServer() {
  const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const swJs = await readFile(path.join(distDir, 'sw.js'), 'utf8');
  const scriptMatch = indexHtml.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const cssMatch = indexHtml.match(/href="(\/assets\/index-[^"]+\.css)"/);
  assert.ok(scriptMatch, 'Production dist/public/index.html must reference a hashed entry script');
  assert.ok(cssMatch, 'Production dist/public/index.html must reference a hashed stylesheet');
  const build1EntryPath = scriptMatch[1];
  const build1CssPath = cssMatch[1];
  const build1EntryJs = await readFile(path.join(distDir, build1EntryPath.slice(1)), 'utf8');
  const build1Css = await readFile(path.join(distDir, build1CssPath.slice(1)), 'utf8');
  const build2EntryPath = '/assets/index-build2-verify.js';
  const build2CssPath = '/assets/index-build2-verify.css';
  const build2IndexHtml = indexHtml
    .replace(build1EntryPath, build2EntryPath)
    .replace(build1CssPath, build2CssPath);
  const baseBuild2SwJs = swJs.replace(/^\/\/ build-digest: [^\n]+\n/, '');

  let online = true;
  let activeBuild = 1;
  let swRevision = 1;
  let failRule = null;
  const failedAssetRequests = [];

  const server = http.createServer(async (req, res) => {
    if (!online) {
      req.socket.destroy();
      return;
    }
    const reqPath = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (failRule && reqPath === failRule.path) {
      failedAssetRequests.push({ path: reqPath, mode: failRule.mode });
      if (failRule.mode === 'network-reset') {
        req.socket.destroy();
        return;
      }
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Service Unavailable during update');
      return;
    }
    if (reqPath === '/' || reqPath === '/index.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      res.end(activeBuild === 1 ? indexHtml : build2IndexHtml);
      return;
    }
    if (reqPath === '/sw.js') {
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-cache' });
      res.end(activeBuild === 1 ? swJs : `// build-digest: build2-verify-${swRevision}\n${baseBuild2SwJs}`);
      return;
    }
    if (reqPath === build2EntryPath) {
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'public, max-age=31536000, immutable' });
      res.end(`${build1EntryJs}\nwindow.__PWA_BUILD_VERSION__ = 2;\n`);
      return;
    }
    if (reqPath === build2CssPath) {
      res.writeHead(200, { 'Content-Type': MIME['.css'], 'Cache-Control': 'public, max-age=31536000, immutable' });
      res.end(`${build1Css}\n/* build-2-verified */\n`);
      return;
    }
    let filePath = path.join(distDir, reqPath);
    try {
      const st = await stat(filePath);
      if (st.isDirectory()) filePath = path.join(filePath, 'index.html');
      const data = await readFile(filePath);
      const ext = path.extname(filePath);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': reqPath.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    build1EntryPath,
    build1CssPath,
    build2EntryPath,
    build2CssPath,
    failedAssetRequests,
    setOnline: (val) => { online = val; },
    setBuild: (val) => { activeBuild = val; swRevision += 1; },
    setFailRule: (rule) => { failRule = rule; swRevision += 1; },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const results = [];
function recordCase(name, detail = {}) {
  const entry = { name, status: 'PASS', detail };
  results.push(entry);
  console.log(JSON.stringify(entry));
}

async function main() {
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const browser = await CDP.connect(version.webSocketDebuggerUrl);
  const { browserContextId } = await browser.send('Target.createBrowserContext', { disposeOnDetach: true });
  let c;

  try {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    c = await CDP.connect(targets.find((t) => t.id === targetId).webSocketDebuggerUrl);
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Page.bringToFront');
    await viewport(c, 390, 844, true);

    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__ENABLE_SW__ = true;
        window.__persistCalled = 0;
        if (navigator.storage) {
          const origPersist = navigator.storage.persist?.bind(navigator.storage);
          Object.defineProperty(navigator.storage, 'persist', {
            configurable: true,
            value: () => {
              window.__persistCalled += 1;
              return origPersist ? origPersist() : Promise.resolve(true);
            },
          });
        }
      `,
    });

    await c.send('Page.navigate', { url: baseUrl });
    await c.wait(`!!document.querySelector('.core-body') && document.querySelectorAll('.orb-screen-hit').length === 6`);

    // 1. Verify PWA meta tags, manifest, and PNG icons
    const pwaCheck = await c.evaluate(`(async () => {
      const manifestHref = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
      const touchIconHref = document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
      const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
      const appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content');
      const res = await fetch(manifestHref);
      const manifest = await res.json();
      const iconChecks = [];
      for (const src of [touchIconHref, ...manifest.icons.map((i) => i.src)]) {
        const iconRes = await fetch(src);
        const buf = new Uint8Array(await iconRes.arrayBuffer());
        iconChecks.push({
          src,
          status: iconRes.status,
          size: buf.byteLength,
          isPngOrSvg: src.endsWith('.svg') || (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47),
        });
      }
      return { manifestHref, touchIconHref, themeColor, appleCapable, manifest, iconChecks };
    })()`);

    assert.equal(pwaCheck.manifestHref, '/manifest.webmanifest', 'Manifest link present');
    assert.equal(pwaCheck.touchIconHref, '/apple-touch-icon.png', 'Apple touch icon link present');
    assert.equal(pwaCheck.themeColor, '#090a18', 'Theme color meta present');
    assert.equal(pwaCheck.appleCapable, 'yes', 'Apple mobile web app capable present');
    assert.equal(pwaCheck.manifest.display, 'standalone', 'Manifest uses standalone display');
    assert.ok(pwaCheck.iconChecks.every((i) => i.status === 200 && i.size > 100 && i.isPngOrSvg), 'All PWA icons resolve with valid bytes');
    recordCase('pwa-manifest-and-icons', { icons: pwaCheck.iconChecks.length });

    // 2. Verify storage durability persist() request
    await c.wait(`window.__persistCalled >= 1`);
    const persistCalls = await c.evaluate(`window.__persistCalled`);
    assert.ok(persistCalls >= 1, 'navigator.storage.persist() requested on load');
    recordCase('storage-persist-request', { persistCalls });

    // 3. Verify Service Worker registration and shell precache
    await c.wait(`(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const keys = await caches.keys();
      return Boolean(reg?.active) && keys.includes('focus-galaxy-shell-v1');
    })()`);
    recordCase('dev-sw-registration-and-precache', { cache: 'focus-galaxy-shell-v1' });

    // 4. Verify visualViewport soft-keyboard inset and composer/save reachability in PlanetFocusMode
    await click(c, '.selected-panel-focus', true);
    await c.wait(`!!document.querySelector('[data-testid="planet-focus-mode"]')`);
    await sleep(300);

    const insetBefore = await c.evaluate(`
      document.querySelector('[data-testid="planet-focus-mode"]').style.getPropertyValue('--keyboard-inset')
    `);
    assert.equal(insetBefore, '0px', 'Keyboard inset is 0px when keyboard is closed');

    const keyboardReachability = await c.evaluate(`(() => {
      const vv = window.visualViewport;
      const dialog = document.querySelector('[data-testid="planet-focus-mode"]');
      const topbar = dialog.querySelector('.planet-focus-topbar');
      const textarea = dialog.querySelector('textarea[aria-label^="New note"]');
      const saveNoteBtn = dialog.querySelector('.planet-content-compose button[type="submit"]');
      textarea.focus();
      Object.defineProperty(vv, 'height', { configurable: true, get: () => 500 });
      vv.dispatchEvent(new Event('resize'));
      const inset = dialog.style.getPropertyValue('--keyboard-inset');
      const topBound = topbar.getBoundingClientRect().bottom;
      const taRect = textarea.getBoundingClientRect();
      const saveRect = saveNoteBtn.getBoundingClientRect();
      const noteVisible = taRect.top >= topBound && taRect.bottom <= vv.height;
      const saveVisible = saveRect.top >= topBound && saveRect.bottom <= vv.height;

      // Switch to Task composer while keyboard remains open
      dialog.querySelector('.planet-content-switch button:last-child').click();
      return { inset, noteVisible, saveVisible };
    })()`);
    assert.equal(keyboardReachability.inset, '344px', 'Keyboard inset reflects simulated 344px mobile soft keyboard');
    assert.ok(keyboardReachability.noteVisible, 'Focused note textarea is scrolled above the soft keyboard');
    assert.ok(keyboardReachability.saveVisible, 'Save Note button remains visible above the soft keyboard');

    const taskKeyboardReachability = await c.evaluate(`(() => {
      const vv = window.visualViewport;
      const dialog = document.querySelector('[data-testid="planet-focus-mode"]');
      const topbar = dialog.querySelector('.planet-focus-topbar');
      const taskInput = dialog.querySelector('input[aria-label^="New task"]');
      const addTaskBtn = dialog.querySelector('.planet-content-task-compose button[type="submit"]');
      taskInput.focus();
      const topBound = topbar.getBoundingClientRect().bottom;
      const inpRect = taskInput.getBoundingClientRect();
      const btnRect = addTaskBtn.getBoundingClientRect();
      const taskVisible = inpRect.top >= topBound && inpRect.bottom <= vv.height;
      const btnVisible = btnRect.top >= topBound && btnRect.bottom <= vv.height;
      delete vv.height;
      vv.dispatchEvent(new Event('resize'));
      return {
        taskVisible,
        btnVisible,
        insetAfterClose: dialog.style.getPropertyValue('--keyboard-inset'),
      };
    })()`);
    assert.ok(taskKeyboardReachability.taskVisible, 'Switched task input is visible above the soft keyboard');
    assert.ok(taskKeyboardReachability.btnVisible, 'Add Task button is visible above the soft keyboard');
    assert.equal(taskKeyboardReachability.insetAfterClose, '0px', 'Keyboard inset resets to 0px when keyboard closes');
    recordCase('focus-mode-soft-keyboard-reachability', {
      inset: keyboardReachability.inset,
      noteVisible: keyboardReachability.noteVisible,
      saveVisible: keyboardReachability.saveVisible,
      taskVisible: taskKeyboardReachability.taskVisible,
      btnVisible: taskKeyboardReachability.btnVisible,
    });

    await c.evaluate(`(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg) await reg.unregister();
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })()`);

    assert.deepEqual(c.errors, [], 'Zero runtime errors in dev/preview check');
  } finally {
    if (c) c.close();
    await browser.send('Target.disposeBrowserContext', { browserContextId });
  }

  // 5. Verify production Service Worker lifecycle: Fresh install -> Offline reload -> Interrupted update -> Recovery -> Complete update
  const prodServer = await startControlledProdServer();
  const { browserContextId: prodCtx } = await browser.send('Target.createBrowserContext', { disposeOnDetach: true });
  let p1, p2, p3;
  try {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: prodCtx });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    p1 = await CDP.connect(targets.find((t) => t.id === targetId).webSocketDebuggerUrl);
    await p1.send('Runtime.enable');
    await p1.send('Page.enable');
    await viewport(p1, 390, 844, true);

    // Case 5: Fresh installation online on Version A (Build 1)
    await p1.send('Page.navigate', { url: prodServer.url });
    await p1.wait(`!!document.querySelector('.core-body') && document.querySelectorAll('.orb-screen-hit').length === 6`);
    await p1.wait(`(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/');
      return Boolean(reg?.active) && Boolean(navigator.serviceWorker.controller);
    })()`);

    const build1Cached = await p1.evaluate(`(async () => {
      const cacheNames = await caches.keys();
      const cache = await caches.open('focus-galaxy-shell-v1');
      const paths = (await cache.keys()).map((r) => new URL(r.url).pathname).sort();
      return { cacheNames, paths };
    })()`);
    assert.deepEqual(build1Cached.cacheNames, ['focus-galaxy-shell-v1'], 'Only committed shell cache remains after install');
    assert.ok(build1Cached.paths.includes(prodServer.build1EntryPath), 'Fresh install precaches Vite hashed entry bundle');
    assert.ok(build1Cached.paths.includes(prodServer.build1CssPath), 'Fresh install precaches Vite hashed stylesheet');

    // Modify disposable priority online and confirm persistence
    await click(p1, '[aria-label="Add priority"]', true);
    await p1.wait(`!!document.querySelector('.name-input')`);
    await p1.evaluate(`(() => {
      const el = document.querySelector('.name-input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Offline PWA Priority');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await click(p1, '[role="dialog"] button[type="submit"]', true);
    await p1.wait(`(localStorage.getItem('focus-galaxy-priorities-v2') || '').includes('Offline PWA Priority')`);
    recordCase('prod-fresh-install-online', {
      entry: prodServer.build1EntryPath,
      css: prodServer.build1CssPath,
      cachedAssets: build1Cached.paths.length,
    });

    // Case 6: Cut server connectivity completely and open in a fresh tab + reload offline
    prodServer.setOnline(false);
    await p1.send('Page.reload');
    await p1.wait(`!!document.querySelector('.core-body') && document.querySelectorAll('.orb-screen-hit').length === 7`);
    const { targetId: tab2Id } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: prodCtx });
    const targets2 = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    p2 = await CDP.connect(targets2.find((t) => t.id === tab2Id).webSocketDebuggerUrl);
    await p2.send('Runtime.enable');
    await p2.send('Page.enable');
    await viewport(p2, 390, 844, true);
    await p2.send('Page.navigate', { url: prodServer.url });
    await p2.wait(`!!document.querySelector('.core-body') && document.querySelectorAll('.orb-screen-hit').length === 7`);
    const offlineHasPriority = await p2.evaluate(`(localStorage.getItem('focus-galaxy-priorities-v2') || '').includes('Offline PWA Priority')`);
    assert.ok(offlineHasPriority, 'Offline reload preserves saved priorities');
    recordCase('prod-fresh-install-reopen-offline', { orbCount: 7, savedPriority: true });

    // Case 7: Restore online connectivity and verify no conflict or corruption
    prodServer.setOnline(true);
    await sleep(200);
    const hasConflictWarning = await p2.evaluate(`!!document.querySelector('[data-testid="priority-conflict-warning"]')`);
    assert.equal(hasConflictWarning, false, 'Offline-to-online recovery does not trigger false conflict warning');
    recordCase('prod-offline-to-online-recovery', { conflictWarning: false });

    // Case 8: Interrupted A -> B update (both network socket failure on required JS and HTTP 503 on required CSS)
    prodServer.setBuild(2);
    for (const rule of [
      { path: prodServer.build2EntryPath, mode: 'network-reset' },
      { path: prodServer.build2CssPath, mode: 'http-503' },
    ]) {
      const beforeCount = prodServer.failedAssetRequests.length;
      prodServer.setFailRule(rule);
      await p1.evaluate(`(async () => {
        const reg = await navigator.serviceWorker.getRegistration('/');
        try {
          await reg.update();
        } catch {}
      })()`);
      await p1.wait(`(async () => {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const keys = await caches.keys();
        return !reg?.installing && !keys.some((k) => k.startsWith('focus-galaxy-shell-stage-'));
      })()`);
      assert.ok(
        prodServer.failedAssetRequests.length > beforeCount &&
        prodServer.failedAssetRequests.some((r) => r.path === rule.path && r.mode === rule.mode),
        `Update genuinely attempted and failed required asset ${rule.path} (${rule.mode})`,
      );
      const interruptedCacheState = await p1.evaluate(`(async () => {
        const cacheNames = await caches.keys();
        const cache = await caches.open('focus-galaxy-shell-v1');
        const paths = (await cache.keys()).map((r) => new URL(r.url).pathname).sort();
        const rootHtml = await (await cache.match('/'))?.text();
        const indexHtml = await (await cache.match('/index.html'))?.text();
        return {
          cacheNames,
          paths,
          rootHasBuild1: rootHtml?.includes(${JSON.stringify(prodServer.build1EntryPath)}),
          indexHasBuild1: indexHtml?.includes(${JSON.stringify(prodServer.build1EntryPath)}),
          indexHasBuild2: indexHtml?.includes(${JSON.stringify(prodServer.build2EntryPath)}),
        };
      })()`);
      assert.deepEqual(interruptedCacheState.cacheNames, ['focus-galaxy-shell-v1'], 'Failed staging cache is cleaned up');
      assert.equal(interruptedCacheState.rootHasBuild1, true, 'Root HTML in cache remains Version A');
      assert.equal(interruptedCacheState.indexHasBuild1, true, 'index.html in cache remains Version A');
      assert.equal(interruptedCacheState.indexHasBuild2, false, 'Incomplete Version B HTML is never exposed in cache');
      assert.ok(interruptedCacheState.paths.includes(prodServer.build1EntryPath), 'Version A entry JS remains in cache');
      assert.ok(interruptedCacheState.paths.includes(prodServer.build1CssPath), 'Version A CSS remains in cache');
      assert.ok(!interruptedCacheState.paths.includes(prodServer.build2EntryPath), 'Version B entry JS is not promoted');
    }
    recordCase('prod-interrupted-update-asset-failure', {
      failedAssetRequests: prodServer.failedAssetRequests,
    });

    // Case 9: Offline reload of existing tab after interrupted update
    prodServer.setOnline(false);
    p1.errors = [];
    await p1.send('Page.reload');
    await p1.wait(`!!document.querySelector('.core-body') && document.querySelectorAll('.orb-screen-hit').length === 7`);
    const p1AfterInterruptedReload = await p1.evaluate(`({
      buildVersion: window.__PWA_BUILD_VERSION__ ?? 1,
      scriptSrc: document.querySelector('script[type="module"]')?.getAttribute('src'),
      cssHref: document.querySelector('link[rel="stylesheet"][href^="/assets/"]')?.getAttribute('href'),
      hasPriority: (localStorage.getItem('focus-galaxy-priorities-v2') || '').includes('Offline PWA Priority'),
    })`);
    assert.equal(p1AfterInterruptedReload.buildVersion, 1, 'Reloaded tab stays on working Version A');
    assert.equal(p1AfterInterruptedReload.scriptSrc, prodServer.build1EntryPath, 'Reloaded tab uses Version A entry JS');
    assert.equal(p1AfterInterruptedReload.cssHref, prodServer.build1CssPath, 'Reloaded tab uses Version A CSS');
    assert.equal(p1AfterInterruptedReload.hasPriority, true, 'Reloaded tab preserves saved priorities');
    assert.deepEqual(p1.errors, [], 'Zero runtime errors on offline reload after interrupted update');
    recordCase('prod-offline-reload-after-interrupted-update', p1AfterInterruptedReload);

    // Case 10: Fresh-tab offline reopen after interrupted update
    const { targetId: tab3Id } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: prodCtx });
    const targets3 = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    p3 = await CDP.connect(targets3.find((t) => t.id === tab3Id).webSocketDebuggerUrl);
    await p3.send('Runtime.enable');
    await p3.send('Page.enable');
    await viewport(p3, 390, 844, true);
    await p3.send('Page.navigate', { url: prodServer.url });
    await p3.wait(`!!document.querySelector('.core-body') && document.querySelectorAll('.orb-screen-hit').length === 7`);
    const p3OfflineOpen = await p3.evaluate(`({
      buildVersion: window.__PWA_BUILD_VERSION__ ?? 1,
      scriptSrc: document.querySelector('script[type="module"]')?.getAttribute('src'),
      cssHref: document.querySelector('link[rel="stylesheet"][href^="/assets/"]')?.getAttribute('href'),
      hasPriority: (localStorage.getItem('focus-galaxy-priorities-v2') || '').includes('Offline PWA Priority'),
    })`);
    assert.equal(p3OfflineOpen.buildVersion, 1, 'Fresh offline tab opens working Version A');
    assert.equal(p3OfflineOpen.scriptSrc, prodServer.build1EntryPath, 'Fresh offline tab uses Version A entry JS');
    assert.equal(p3OfflineOpen.cssHref, prodServer.build1CssPath, 'Fresh offline tab uses Version A CSS');
    assert.equal(p3OfflineOpen.hasPriority, true, 'Fresh offline tab preserves saved priorities');
    assert.deepEqual(p3.errors, [], 'Zero runtime errors on fresh-tab offline reopen after interrupted update');
    recordCase('prod-fresh-tab-offline-reopen-after-interrupted-update', p3OfflineOpen);

    // Case 11: Reconnect and successfully retry Version B update while p2 has an active unsaved draft in Focus Mode
    prodServer.setFailRule(null);
    prodServer.setOnline(true);
    await click(p2, '.selected-panel-focus', true);
    await p2.wait(`!!document.querySelector('[data-testid="planet-focus-mode"]')`);
    await p2.evaluate(`(() => {
      const ta = document.querySelector('textarea[aria-label^="New note"]');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, 'Unsaved draft during SW update');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

    await p2.evaluate(`(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/');
      await reg.update();
    })()`);
    await p2.wait(`(async () => {
      const cache = await caches.open('focus-galaxy-shell-v1');
      const paths = (await cache.keys()).map((r) => new URL(r.url).pathname);
      return (
        paths.includes(${JSON.stringify(prodServer.build2EntryPath)}) &&
        paths.includes(${JSON.stringify(prodServer.build2CssPath)}) &&
        !paths.includes(${JSON.stringify(prodServer.build1EntryPath)}) &&
        !paths.includes(${JSON.stringify(prodServer.build1CssPath)})
      );
    })()`);

    // Confirm active editing session was NOT forcibly reloaded or destroyed
    const draftStillPresent = await p2.evaluate(`document.querySelector('textarea[aria-label^="New note"]')?.value`);
    assert.equal(draftStillPresent, 'Unsaved draft during SW update', 'SW update does not destroy active editing session');
    recordCase('prod-reconnect-retry-update-preserves-draft', {
      promotedEntry: prodServer.build2EntryPath,
      promotedCss: prodServer.build2CssPath,
      draftPreserved: true,
    });

    // Case 12: Reload into Version B online and offline, verifying updated bundle + preserved saved priorities
    await p2.send('Page.reload');
    await p2.wait(`window.__PWA_BUILD_VERSION__ === 2 && document.querySelectorAll('.orb-screen-hit').length === 7`);
    prodServer.setOnline(false);
    await p2.send('Page.reload');
    await p2.wait(`window.__PWA_BUILD_VERSION__ === 2 && document.querySelectorAll('.orb-screen-hit').length === 7`);
    const postUpdatePriority = await p2.evaluate(`(localStorage.getItem('focus-galaxy-priorities-v2') || '').includes('Offline PWA Priority')`);
    assert.equal(postUpdatePriority, true, 'Saved priorities preserved after Version B update and offline reload');
    recordCase('prod-complete-update-online-and-offline-with-priorities', {
      buildVersion: 2,
      orbCount: 7,
      savedPriorityPreserved: postUpdatePriority,
    });

    assert.equal(results.length, 12, 'Every expected mobile-pwa case ran');
    assert.deepEqual(p1.errors, [], 'Zero runtime errors in p1');
    assert.deepEqual(p2.errors, [], 'Zero runtime errors in p2');
    assert.deepEqual(p3.errors, [], 'Zero runtime errors in p3');
    console.log(
      JSON.stringify({
        suite: 'mobile-pwa',
        status: 'PASS',
        passed: results.length,
        failed: 0,
        offlineShell: 'VERIFIED',
        updateLifecycle: 'VERIFIED',
        interruptedUpdateSafety: 'VERIFIED',
      }),
    );
  } finally {
    if (p1) p1.close();
    if (p2) p2.close();
    if (p3) p3.close();
    await browser.send('Target.disposeBrowserContext', { browserContextId: prodCtx });
    await prodServer.close();
    browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
