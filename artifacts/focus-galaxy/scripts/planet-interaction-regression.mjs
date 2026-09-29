const port = Number(process.env.CDP_PORT || 9228);
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const appOrigin = new URL(baseUrl).origin;
const expectedSteps = [
  'immediate rendered planets are real-hit-test clickable',
  'moving rendered planets remain real-hit-test clickable',
  'Planet Detail opens and closes without losing planet hit targets',
  'Manage opens and closes without losing planet hit targets',
  'Focus Signal interaction preserves planet hit targets',
  'built-in audio interaction preserves planet hit targets',
  'responsive viewport changes preserve planet hit targets',
  'planets remain clickable after several orbital cycles',
];
const results = [];
const runtimeErrors = [];
const observations = [];
let nextId = 1;
let socket;
const pending = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target = targets.find((item) => item.type === 'page' && item.url.startsWith(appOrigin));
  if (!target) throw new Error(`No page target for ${appOrigin}`);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else request.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push({ type: 'exception', text: message.params.exceptionDetails?.text || 'Runtime exception' });
    }
    if (message.method === 'Runtime.consoleAPICalled') {
      const type = message.params.type;
      if (type === 'error') {
        runtimeErrors.push({ type: 'console', text: message.params.args?.map((arg) => arg.value ?? arg.description ?? '').join(' ') || 'console.error' });
      }
    }
    if (message.method === 'Log.entryAdded' && ['error', 'assert'].includes(message.params.entry.level)) {
      runtimeErrors.push({ type: 'log', text: message.params.entry.text || message.params.entry.source || 'browser log error' });
    }
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
}

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return response.result?.value;
}

async function navigateFresh() {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: baseUrl });
  await sleep(2500);
  await evaluate(`(() => {
    window.localStorage.removeItem('focus-galaxy-priorities-v2');
    window.sessionStorage.clear();
    return true;
  })()`);
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
}

function summarizeFailure(error) {
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

async function inspect(label) {
  const snapshot = await evaluate(`(() => {
    const describe = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: typeof element.className === 'string' ? element.className : String(element.className || ''),
        testId: element.getAttribute('data-testid'),
        priorityId: element.getAttribute('data-priority-id'),
        ariaLabel: element.getAttribute('aria-label'),
        ariaPressed: element.getAttribute('aria-pressed'),
        pointerEvents: computed.pointerEvents,
        zIndex: computed.zIndex,
        position: computed.position,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    };
    const hits = [...document.querySelectorAll('.orb-screen-hit')];
    const visuals = [...document.querySelectorAll('.orb-screen-visual')];
    const hitForId = new Map(hits.map((hit) => [hit.getAttribute('data-testid')?.replace(/^orb-/, ''), hit]));
    const planets = visuals.map((visual) => {
      const id = visual.getAttribute('data-priority-id');
      const planet = visual.querySelector('.orb-planet');
      const hit = hitForId.get(id);
      const planetRect = planet?.getBoundingClientRect();
      const visualRect = visual.getBoundingClientRect();
      const hitRect = hit?.getBoundingClientRect();
      const center = planetRect ? { x: planetRect.left + planetRect.width / 2, y: planetRect.top + planetRect.height / 2 } : null;
      const hitCenter = hitRect ? { x: hitRect.left + hitRect.width / 2, y: hitRect.top + hitRect.height / 2 } : null;
      const stack = center ? document.elementsFromPoint(center.x, center.y).slice(0, 10).map(describe) : [];
      const topHit = stack.find((element) => element?.classes.split(/\\s+/).includes('orb-screen-hit'));
      const hitAtCenter = center ? document.elementFromPoint(center.x, center.y) : null;
      const hitCenterStack = hitCenter ? document.elementsFromPoint(hitCenter.x, hitCenter.y).slice(0, 6).map(describe) : [];
      const topHitAtHitCenter = hitCenterStack.find((element) => element?.classes.split(/\\s+/).includes('orb-screen-hit'));
      return {
        id,
        planetRect: planet ? describe(planet) : null,
        visualRect: describe(visual),
        hitRect: hit ? describe(hit) : null,
        center,
        hitCenter,
        alignmentDelta: center && hitCenter ? Math.hypot(center.x - hitCenter.x, center.y - hitCenter.y) : null,
        elementFromPoint: describe(hitAtCenter),
        topHitIdAtPlanetCenter: topHit?.testId?.replace(/^orb-/, '') || null,
        topHitIdAtHitCenter: topHitAtHitCenter?.testId?.replace(/^orb-/, '') || null,
        ownHitTopAtPlanetCenter: hitAtCenter === hit,
        ownHitTopAtHitCenter: hitCenter ? document.elementFromPoint(hitCenter.x, hitCenter.y) === hit : false,
        stack,
        hitCenterStack,
      };
    });
    const selected = document.querySelector('.orb-screen-hit[aria-pressed="true"]')?.getAttribute('data-testid')?.replace(/^orb-/, '') || null;
    const app = document.querySelector('.focus-galaxy-app');
    const appRect = app?.getBoundingClientRect();
    const layer = document.getElementById('orb-hit-layer');
    const layerStyle = layer ? getComputedStyle(layer) : null;
    return {
      label: ${JSON.stringify(label)},
      now: performance.now(),
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      selected,
      counts: { visuals: visuals.length, hits: hits.length, dialogs: document.querySelectorAll('[role="dialog"]').length },
      storageCount: (() => {
        try { return JSON.parse(localStorage.getItem('focus-galaxy-priorities-v2') || '[]').length; } catch { return null; }
      })(),
      layer: { exists: !!layer, childCount: layer?.children.length || 0, pointerEvents: layerStyle?.pointerEvents || null, zIndex: layerStyle?.zIndex || null, rect: appRect ? { x: appRect.x, y: appRect.y, width: appRect.width, height: appRect.height } : null },
      planets,
    };
  })()`);
  observations.push(snapshot);
  return snapshot;
}

async function realClick(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function realClickSelector(selector, label) {
  const target = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, pointerEvents: style.pointerEvents, disabled: element.disabled === true, label: element.getAttribute('aria-label') || element.textContent?.trim() || null };
  })()`);
  if (!target || target.width <= 0 || target.height <= 0) throw new Error(`${label}: selector not visible: ${selector}`);
  if (target.pointerEvents === 'none' || target.disabled) throw new Error(`${label}: selector not interactive: ${JSON.stringify(target)}`);
  await realClick(target.x, target.y);
  await sleep(250);
  return target;
}

async function keyPress(key) {
  await evaluate('document.activeElement instanceof HTMLElement && document.activeElement.blur()');
  const upper = key.toUpperCase();
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: `Key${upper}`, windowsVirtualKeyCode: upper.charCodeAt(0), nativeVirtualKeyCode: upper.charCodeAt(0) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: `Key${upper}`, windowsVirtualKeyCode: upper.charCodeAt(0), nativeVirtualKeyCode: upper.charCodeAt(0) });
  await sleep(650);
}

async function ensurePanelsClosed() {
  const expanded = await evaluate(`document.querySelector('.insight-dock > button')?.getAttribute('aria-expanded') || null`);
  if (expanded === 'true') await keyPress('f');
}

async function waitFor(expression, label, timeoutMs = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`${label}: condition timed out after ${timeoutMs}ms`);
}

async function findSelectablePoint(snapshot, id) {
  return evaluate(`(() => {
    const visual = document.querySelector('.orb-screen-visual[data-priority-id="${id}"]');
    const hit = document.querySelector('.orb-screen-hit[data-testid="orb-${id}"]');
    const planet = visual?.querySelector('.orb-planet');
    if (!visual || !hit || !planet) return null;
    const rect = planet.getBoundingClientRect();
    const candidates = [];
    for (let iy = -4; iy <= 4; iy += 1) {
      for (let ix = -4; ix <= 4; ix += 1) {
        const ox = ix / 5;
        const oy = iy / 5;
        if (ox * ox + oy * oy <= 0.82) candidates.push([ox, oy]);
      }
    }
    candidates.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
    for (const [ox, oy] of candidates) {
      const x = rect.left + rect.width * (0.5 + ox);
      const y = rect.top + rect.height * (0.5 + oy);
      const nearest = [...document.querySelectorAll('.orb-screen-hit')]
        .map((candidate) => {
          const candidateRect = candidate.getBoundingClientRect();
          return {
            id: candidate.getAttribute('data-testid')?.replace(/^orb-/, ''),
            distance: Math.hypot(x - (candidateRect.left + candidateRect.width / 2), y - (candidateRect.top + candidateRect.height / 2)),
          };
        })
        .sort((a, b) => a.distance - b.distance)[0];
      if (document.elementFromPoint(x, y) === hit && nearest?.id === ${JSON.stringify(id)}) return { x, y, offset: [ox, oy], expectedId: ${JSON.stringify(id)} };
    }
    return null;
  })()`);
}

async function clickEveryPlanet(label) {
  await ensurePanelsClosed();
  const before = await inspect(label);
  const failures = [];
  if (!before.layer.exists) failures.push('orb-hit-layer missing');
  if (before.counts.visuals === 0 || before.counts.hits === 0) failures.push(`planet count visuals=${before.counts.visuals} hits=${before.counts.hits}`);
  for (const listedPlanet of before.planets) {
    await ensurePanelsClosed();
    const planet = (await inspect(`${label}:${listedPlanet.id}:before`)).planets.find((item) => item.id === listedPlanet.id) || listedPlanet;
    if (!planet.hitRect) {
      failures.push(`${planet.id}: expected hit target missing`);
      continue;
    }
    if (planet.hitRect.pointerEvents !== 'auto') failures.push(`${planet.id}: pointer-events=${planet.hitRect.pointerEvents}`);
    if (planet.alignmentDelta === null || planet.alignmentDelta > 8) failures.push(`${planet.id}: visual/hit centers diverged by ${planet.alignmentDelta}`);
    if (!planet.elementFromPoint) failures.push(`${planet.id}: elementFromPoint returned null at visible planet center`);
    const point = await findSelectablePoint(planet, planet.id);
    const expectedId = point?.expectedId || planet.topHitIdAtPlanetCenter || planet.topHitIdAtHitCenter;
    if (!point && !expectedId) {
      failures.push(`${planet.id}: no topmost interactive element at visible planet center; element=${planet.elementFromPoint?.tag || 'none'}`);
      continue;
    }
    const clickPoint = point || { x: planet.center.x, y: planet.center.y, offset: [0, 0] };
    await realClick(clickPoint.x, clickPoint.y);
    await sleep(180);
    const after = await inspect(`${label}:${planet.id}`);
    if (after.selected !== expectedId) {
      failures.push(`${planet.id}: real click selected ${after.selected || 'none'}, expected topmost ${expectedId}; pointOffset=${JSON.stringify(clickPoint.offset)}`);
    }
  }
  return { before, failures };
}

async function runStep(name, callback) {
  try {
    const detail = await callback();
    results.push({ name, status: 'PASS', detail: detail || undefined });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: summarizeFailure(error) });
  }
}

async function waitAndSample(durationMs, intervalMs, label) {
  const start = Date.now();
  let next = 0;
  while (Date.now() - start < durationMs) {
    const elapsed = Date.now() - start;
    if (elapsed >= next) {
      const snapshot = await inspect(`${label}+${elapsed}ms`);
      const interactiveAtCenter = snapshot.planets.filter((planet) => planet.topHitIdAtPlanetCenter).length;
      if (snapshot.planets.length > 0 && interactiveAtCenter === 0) {
        throw new Error(`${label}: all ${snapshot.planets.length} visible planet centers lost their topmost hit at ${elapsed}ms: ${JSON.stringify(snapshot.planets.map((planet) => ({ id: planet.id, center: planet.center, elementFromPoint: planet.elementFromPoint, hitRect: planet.hitRect, hitCenter: planet.hitCenter, stack: planet.stack.slice(0, 4) })))}`);
      }
      next += intervalMs;
    }
    await sleep(Math.min(250, durationMs - (Date.now() - start)));
  }
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(650);
}

async function main() {
  await connect();
  await navigateFresh();

  await runStep(expectedSteps[0], async () => {
    const result = await clickEveryPlanet('immediate');
    if (result.failures.length) throw new Error(result.failures.join('; '));
    return { planets: result.before.planets.length };
  });

  await runStep(expectedSteps[1], async () => {
    await waitAndSample(6500, 1500, 'moving');
    const result = await clickEveryPlanet('moving-click');
    if (result.failures.length) throw new Error(result.failures.join('; '));
    return { planets: result.before.planets.length };
  });

  await runStep(expectedSteps[2], async () => {
    await ensurePanelsClosed();
    const initial = await inspect('detail-open-before');
    const first = initial.planets[0];
    if (!first) throw new Error('no planet available for Planet Detail');
    const point = await findSelectablePoint(initial, first.id);
    if (!point) throw new Error(`${first.id}: no real hit-test point before Planet Detail open`);
    await realClick(point.x, point.y);
    await sleep(300);
    const open = await inspect('detail-open');
    if (!open.selected) throw new Error('Planet Detail did not open after real planet click');
    await sleep(700);
    await realClickSelector('button[aria-label="Close panel"]', 'Planet Detail close');
    await waitFor(`!document.querySelector('.orb-screen-hit[aria-pressed="true"]')`, 'Planet Detail close');
    const closed = await inspect('detail-closed');
    if (closed.selected) throw new Error(`Planet Detail close left selected=${closed.selected}`);
    const result = await clickEveryPlanet('after-detail-close');
    if (result.failures.length) throw new Error(result.failures.join('; '));
    return { selectedBeforeClose: open.selected };
  });

  await runStep(expectedSteps[3], async () => {
    await ensurePanelsClosed();
    await realClickSelector('button[aria-label="Manage priorities"]', 'Manage open');
    await waitFor('document.querySelectorAll("[role=dialog]").length === 1', 'Manage open');
    const open = await inspect('manage-open');
    await realClickSelector('button[aria-label="Close dialog"]', 'Manage close');
    await waitFor('document.querySelectorAll("[role=dialog]").length === 0', 'Manage close');
    const closed = await inspect('manage-closed');
    const result = await clickEveryPlanet('after-manage-close');
    if (result.failures.length) throw new Error(result.failures.join('; '));
    return { planets: result.before.planets.length, dialogs: { open: open.counts.dialogs, closed: closed.counts.dialogs } };
  });

  await runStep(expectedSteps[4], async () => {
    await ensurePanelsClosed();
    await keyPress('f');
    await waitFor('document.querySelector(".insight-dock > button")?.getAttribute("aria-expanded") === "true"', 'Focus Signal open');
    const signalInput = await evaluate(`(() => {
      const element = document.querySelector('[data-testid="focus-signal-list"] input');
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.left + Math.min(rect.width / 2, 70), y: rect.top + rect.height / 2, label: element.getAttribute('aria-label') };
    })()`);
    if (!signalInput) throw new Error('Focus Signal input missing');
    await realClick(signalInput.x, signalInput.y);
    await sleep(300);
    const focused = await inspect('focus-signal-interaction');
    if (!focused.selected) throw new Error('Focus Signal interaction did not select a priority');
    const result = await clickEveryPlanet('after-focus-signal');
    if (result.failures.length) throw new Error(result.failures.join('; '));
    return { selected: focused.selected, input: signalInput.label };
  });

  await runStep(expectedSteps[5], async () => {
    await ensurePanelsClosed();
    await realClickSelector('button[aria-label="Play focus music"]', 'audio play');
    await sleep(700);
    const playing = await evaluate(`document.querySelector('button[aria-label="Pause focus music"]')?.getAttribute('aria-label') || null`);
    if (playing !== 'Pause focus music') throw new Error(`built-in audio did not enter playing state: ${playing || 'none'}`);
    await realClickSelector('button[aria-label="Pause focus music"]', 'audio pause');
    const paused = await evaluate(`document.querySelector('button[aria-label="Play focus music"]')?.getAttribute('aria-label') || null`);
    if (paused !== 'Play focus music') throw new Error(`built-in audio did not return to paused state: ${paused || 'none'}`);
    const result = await clickEveryPlanet('after-audio');
    if (result.failures.length) throw new Error(result.failures.join('; '));
    return { playing, paused };
  });

  await runStep(expectedSteps[6], async () => {
    for (const [width, height] of [[1024, 768], [390, 844], [1440, 900]]) {
      await setViewport(width, height);
      await ensurePanelsClosed();
      const result = await clickEveryPlanet(`viewport-${width}x${height}`);
      if (result.failures.length) throw new Error(`${width}x${height}: ${result.failures.join('; ')}`);
    }
    return { viewports: ['1024x768', '390x844', '1440x900'] };
  });

  await runStep(expectedSteps[7], async () => {
    await ensurePanelsClosed();
    const waitMs = Number(process.env.ORBIT_WAIT_MS || 130000);
    await waitAndSample(waitMs, 5000, 'orbital-cycles');
    const result = await clickEveryPlanet('after-orbital-cycles');
    if (result.failures.length) throw new Error(result.failures.join('; '));
    return { planets: result.before.planets.length, waitMs };
  });

  const failed = results.filter((result) => result.status !== 'PASS');
  if (results.length !== expectedSteps.length) {
    failed.push({ name: 'expected step count', status: 'FAIL', error: `recorded=${results.length} expected=${expectedSteps.length}` });
  }
  if (runtimeErrors.length) {
    failed.push({ name: 'browser runtime errors', status: 'FAIL', error: JSON.stringify(runtimeErrors) });
  }
  const summary = {
    results,
    passed: results.filter((result) => result.status === 'PASS').length,
    failed: failed.length,
    runtimeErrors,
    observationCount: observations.length,
    firstObservation: observations[0] ? { label: observations[0].label, counts: observations[0].counts, viewport: observations[0].viewport } : null,
    lastObservation: observations.at(-1) ? { label: observations.at(-1).label, counts: observations.at(-1).counts, viewport: observations.at(-1).viewport } : null,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = failed.length ? 1 : 0;
  socket.close();
}

main().catch((error) => {
  console.error(JSON.stringify({ fatal: summarizeFailure(error), results, runtimeErrors }, null, 2));
  process.exitCode = 1;
  if (socket) socket.close();
});
