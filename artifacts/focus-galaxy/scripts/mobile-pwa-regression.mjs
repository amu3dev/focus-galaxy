import assert from 'node:assert/strict';
import { CDP, viewport, click } from './cdp-harness.mjs';

const port = Number(process.env.CDP_PORT || 9228);
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    // 2. Verify storage durability persist() request
    await c.wait(`window.__persistCalled >= 1`);
    const persistCalls = await c.evaluate(`window.__persistCalled`);
    assert.ok(persistCalls >= 1, 'navigator.storage.persist() requested on load');

    // 3. Verify Service Worker registration and shell precache
    await c.wait(`(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const keys = await caches.keys();
      return Boolean(reg?.active) && keys.includes('focus-galaxy-shell-v1');
    })()`);

    // 4. Verify visualViewport soft-keyboard inset handling in PlanetFocusMode
    await click(c, '.selected-panel-focus', true);
    await c.wait(`!!document.querySelector('[data-testid="planet-focus-mode"]')`);
    await sleep(300);

    const insetBefore = await c.evaluate(`
      document.querySelector('[data-testid="planet-focus-mode"]').style.getPropertyValue('--keyboard-inset')
    `);
    assert.equal(insetBefore, '0px', 'Keyboard inset is 0px when keyboard is closed');

    const insetAfter = await c.evaluate(`(() => {
      const vv = window.visualViewport;
      const textarea = document.querySelector('textarea');
      textarea.focus();
      Object.defineProperty(vv, 'height', { configurable: true, get: () => 500 });
      vv.dispatchEvent(new Event('resize'));
      const val = document.querySelector('[data-testid="planet-focus-mode"]').style.getPropertyValue('--keyboard-inset');
      delete vv.height;
      vv.dispatchEvent(new Event('resize'));
      return val;
    })()`);
    assert.equal(insetAfter, '344px', 'Keyboard inset reflects simulated 344px mobile soft keyboard');

    await c.evaluate(`(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg) await reg.unregister();
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })()`);

    assert.deepEqual(c.errors, [], 'Zero runtime errors');
    console.log(JSON.stringify({ suite: 'mobile-pwa', status: 'PASS', icons: pwaCheck.iconChecks.length, persistCalls }));
  } finally {
    if (c) c.close();
    await browser.send('Target.disposeBrowserContext', { browserContextId });
    browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

