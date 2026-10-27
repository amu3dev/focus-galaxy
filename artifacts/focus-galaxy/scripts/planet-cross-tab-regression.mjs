import assert from 'node:assert/strict';
import { CDP, click as hitClick } from './cdp-harness.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

// Connects to an already-approved Chrome/CDP session; never launches a browser.
// Each case uses a fresh disposable browser context. No personal profile data.
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const port = Number(process.env.CDP_PORT || 9228);
const key = 'focus-galaxy-priorities-v2';
const lockName = `${key}:write`;
const output = process.env.QA_OUTPUT_DIR;
const seed = [{
  id: 'review-a', name: 'Review A', importance: 8, urgency: 8, energy: 7, hue: '#f04e76',
  entries: [
    { id: 'note-a', type: 'note', text: 'Original note', createdAt: 1, updatedAt: 1 },
    { id: 'task-a', type: 'task', text: 'Original task', completed: false, createdAt: 2, updatedAt: 2 },
  ],
}];
const rawSeed = JSON.stringify(seed);
const results = [];
const downloadPath = path.resolve(output || path.join(tmpdir(), 'focus-galaxy-cross-tab-downloads'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
let activeTabs = [];

// Transport shared with touch and geometry regressions.
async function tab(context, { seedRaw, ignoreEvents = false, noLocks = false, rejectLocks = false, denyRead = false, blockBackup = false, width = 1440, height = 900 } = {}) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: context });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const client = await CDP.connect(targets.find((target) => target.id === targetId).webSocketDebuggerUrl);
  activeTabs.push(client);
  await client.send('Page.enable'); await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, mobile: false, deviceScaleFactor: 1 });
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.qaBoot = crypto.randomUUID();
    ${seedRaw === undefined ? '' : `if (!sessionStorage.qaSeeded) { localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(seedRaw)}); sessionStorage.qaSeeded = 'yes'; }`}
    window.qaWrites = []; window.qaAttempts = []; window.qaBlock = false; window.qaBlockBackup = ${blockBackup};
    window.qaIgnoreEvents = ${ignoreEvents}; window.qaDenyRead = ${denyRead};
    const originalSet = Storage.prototype.setItem, originalGet = Storage.prototype.getItem;
    Storage.prototype.setItem = function(name, value) {
      window.qaAttempts.push(name);
      if (name === ${JSON.stringify(key)} && window.qaBlock) throw new DOMException('Test quota', 'QuotaExceededError');
      if (name.startsWith(${JSON.stringify(`${key}.corrupt`)}) && window.qaBlockBackup) throw new DOMException('Test recovery quota', 'QuotaExceededError');
      originalSet.call(this, name, value); window.qaWrites.push({name, value});
    };
    Storage.prototype.getItem = function(name) {
      if (name === ${JSON.stringify(key)} && window.qaDenyRead) throw new DOMException('Test read denied', 'SecurityError');
      return originalGet.call(this, name);
    };
    for (const name of ['storage', 'focus', 'pageshow']) window.addEventListener(name, event => { if (window.qaIgnoreEvents) event.stopImmediatePropagation(); }, true);
    document.addEventListener('visibilitychange', event => { if (window.qaIgnoreEvents) event.stopImmediatePropagation(); }, true);
    ${noLocks ? `Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });` : ''}
    ${rejectLocks ? `navigator.locks.request = () => Promise.reject(new DOMException('Test lock denied', 'SecurityError'));` : ''}
    const createURL = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => {
      window.qaExport = blob.text(); return createURL(blob);
    };
  ` });
  await client.send('Page.navigate', { url: baseUrl });
  await client.wait(`document.readyState === 'complete' && !!document.querySelector('[aria-label="Add priority"]')`);
  await sleep(300);
  return client;
}
const stored = (t) => t.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))`);
const writes = (t) => t.evaluate(`window.qaWrites.filter(entry => entry.name === ${JSON.stringify(key)}).length`);
const conflict = (t) => t.wait(`!!document.querySelector('[data-testid="priority-conflict-warning"]')`);
async function openWarning(t) {
  if (await t.evaluate(`document.querySelector('.priority-recovery-warning')?.matches(':not(:popover-open)')`)) {
    await t.evaluate(`document.querySelector('.storage-warning-indicator').scrollIntoView({block:'center'})`);
    await hitClick(t, '.storage-warning-indicator');
    await t.wait(`document.querySelector('.priority-recovery-warning')?.matches(':popover-open')`);
  }
}
async function press(t, selector) {
  await t.wait(`!!document.querySelector(${JSON.stringify(selector)})`);
  if (/priority-(conflict|save|recovery)-warning|focus-confirm-/.test(selector)) {
    await t.send('Page.bringToFront');
    if (selector.includes('warning')) await openWarning(t);
    await t.wait(`(()=>{const e=document.querySelector(${JSON.stringify(selector)})?.closest('[role="alertdialog"]');return !e || e.getAnimations().every(a=>a.playState!=='running')})()`);
    await t.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    await t.wait(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e?.getBoundingClientRect();return !!r?.width && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);
    await hitClick(t, selector);
  } else await t.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
async function input(t, selector, text) {
  await t.wait(`!!document.querySelector(${JSON.stringify(selector)})`);
  await t.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(text)}); e.dispatchEvent(new Event('input', {bubbles:true})); })()`);
}
async function focus(t) { await press(t, '.selected-panel-focus'); await t.wait(`!!document.querySelector('[data-testid="planet-focus-mode"]')`); }
async function note(t, text) { await input(t, 'textarea[aria-label="New note for Review A"]', text); await press(t, '.planet-content-compose button[type="submit"]'); }
async function rename(t, name) {
  await input(t, '#selected-priority-name', name);
  await t.evaluate(`document.querySelector('#selected-priority-name').focus(); document.querySelector('#selected-priority-name').blur()`);
}
async function exported(t) {
  const before = browser.downloadEvents.length;
  await press(t, '[data-testid="priority-conflict-warning"] .storage-warning-actions button');
  const expected = await t.evaluate('window.qaExport.then(JSON.parse)');
  let completed;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    completed = browser.downloadEvents.slice(before).find((event) => event.method === 'Browser.downloadProgress' && event.params.state === 'completed');
    if (completed) break;
    await sleep(50);
  }
  assert.ok(completed, 'Session copy actually downloaded');
  const downloaded = JSON.parse(await readFile(path.join(downloadPath, completed.params.guid), 'utf8'));
  assert.deepEqual(downloaded, expected);
  return downloaded;
}
async function hold(t) {
  await t.evaluate(`void navigator.locks.request(${JSON.stringify(lockName)}, async () => { window.qaHeld = true; await new Promise(resolve => window.qaRelease = resolve); window.qaHeld = false; }); true`);
  await t.wait('window.qaHeld === true');
}
const release = (t) => t.evaluate('window.qaRelease()');
const queued = (t, count) => t.wait(`navigator.locks.query().then(state => state.pending.filter(lock => lock.name === ${JSON.stringify(lockName)}).length >= ${count})`);

async function test(name, run) {
  const { browserContextId } = await browser.send('Target.createBrowserContext', { disposeOnDetach: true });
  activeTabs = [];
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', browserContextId, downloadPath, eventsEnabled: true });
  try {
    await run(browserContextId);
    assert.deepEqual(activeTabs.flatMap((t) => t.errors), [], 'Browser runtime errors');
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: String(error.stack || error) });
    if (output) for (let i = 0; i < activeTabs.length; i++) {
      const shot = await activeTabs[i].send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) await writeFile(path.join(output, `cross-tab-failure-${results.length}-${i}.png`), Buffer.from(shot.data, 'base64'));
    }
  } finally {
    for (const t of activeTabs) t.close();
    await browser.send('Target.disposeBrowserContext', { browserContextId });
  }
  console.log(`${results.at(-1).status} ${name}${results.at(-1).error ? `: ${results.at(-1).error}` : ''}`);
}

async function main() {
  if (output) await mkdir(output, { recursive: true });
  await mkdir(downloadPath, { recursive: true });
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  browser = await CDP.connect(version.webSocketDebuggerUrl);
  await test('canonical hydration has no writes; single-tab saves advance the content revision', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }); assert.equal(await writes(a), 0);
    await focus(a); await note(a, 'First save'); await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length === 3`);
    await note(a, 'Second save'); await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length === 4`);
    assert.equal(await writes(a), 2);
  });
  await test('A saves note; stale B completes without overwriting and can export its session', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }), b = await tab(ctx);
    assert.equal(await writes(a), 0); assert.equal(await writes(b), 0);
    await focus(a); await note(a, 'Saved in A'); await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length === 3`);
    await conflict(b); await press(b, '[aria-label="Complete task"]');
    assert.equal((await stored(a))[0].completed, undefined); assert.equal((await stored(a))[0].entries.at(-1).text, 'Saved in A');
    assert.equal(await writes(b), 0); assert.equal((await exported(b))[0].completed, true);
    assert.deepEqual((await exported(b))[0].entries, seed[0].entries);
  });
  await test('A modifies task; stale B renames while preserving both conflicting snapshots', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }), b = await tab(ctx);
    await focus(a); await press(a, '[aria-label="Edit task"]'); await input(a, 'input[aria-label="Edit task"]', 'Updated in A'); await press(a, '[aria-label="Save task changes"]');
    await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.some(e=>e.text==='Updated in A')`);
    await conflict(b); await rename(b, 'Renamed in B');
    assert.equal((await stored(a))[0].name, 'Review A'); assert.equal((await stored(a))[0].entries[1].text, 'Updated in A');
    const copy = await exported(b); assert.equal(copy[0].name, 'Renamed in B'); assert.equal(copy[0].entries[1].text, 'Original task'); assert.equal(await writes(b), 0);
  });
  await test('locked revision check blocks stale writes even with storage notifications suppressed', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }), b = await tab(ctx, { ignoreEvents: true });
    await focus(a); await note(a, 'Newer saved note'); await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length === 3`);
    assert.equal(await b.evaluate(`!!document.querySelector('[data-testid="priority-conflict-warning"]')`), false);
    await press(b, '[aria-label="Complete task"]'); await conflict(b);
    assert.equal((await stored(a))[0].entries.at(-1).text, 'Newer saved note'); assert.equal((await stored(a))[0].completed, undefined); assert.equal(await writes(b), 0);
  });
  await test('quota retry checks revision and preserves the failed session edit', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }), b = await tab(ctx, { ignoreEvents: true });
    await focus(b); await b.evaluate('window.qaBlock = true'); await note(b, 'Unsaved B note'); await b.wait(`!!document.querySelector('[data-testid="priority-save-warning"]')`);
    await focus(a); await note(a, 'Saved A note'); await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length === 3`);
    await b.evaluate('window.qaBlock = false'); await press(b, '[data-testid="priority-save-warning"] button'); await conflict(b);
    assert.equal(await b.evaluate(`!!document.querySelector('[data-testid="priority-save-warning"]')`), false);
    assert.equal(await writes(b), 0); assert.equal((await stored(a))[0].entries.at(-1).text, 'Saved A note');
    assert.ok((await exported(b))[0].entries.some((entry) => entry.text === 'Unsaved B note'));
  });
  await test('a queued retry keeps the unsaved warning until persistence actually succeeds', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }); await focus(a); await a.evaluate('window.qaBlock = true');
    await note(a, 'Pending retry note'); await a.wait(`!!document.querySelector('[data-testid="priority-save-warning"]')`);
    await hold(a); await a.evaluate('window.qaBlock = false'); await press(a, '[data-testid="priority-save-warning"] button'); await queued(a, 1);
    assert.ok(await a.evaluate(`!!document.querySelector('[data-testid="priority-save-warning"]')`));
    assert.deepEqual(await stored(a), seed); assert.equal(await writes(a), 0);
    await release(a); await a.wait(`!document.querySelector('[data-testid="priority-save-warning"]')`);
    assert.equal((await stored(a))[0].entries.at(-1).text, 'Pending retry note'); assert.equal(await writes(a), 1);
  });
  await test('conflict reload is confirmed, cancels safely inside Focus, and refreshes the revision', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }), b = await tab(ctx);
    await focus(b); await focus(a); await note(a, 'Saved before reload'); await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length === 3`);
    await conflict(b); await note(b, 'B session content');
    await input(b, 'textarea[aria-label="New note for Review A"]', 'Unfinished draft');
    const copy = await exported(b); assert.ok(copy[0].entries.some((entry) => entry.text === 'B session content'));
    assert.ok(!copy[0].entries.some((entry) => entry.text === 'Unfinished draft'));
    await press(b, '[data-testid="priority-conflict-warning"] .storage-warning-actions button:last-child'); await b.wait(`!!document.querySelector('[role="alertdialog"]')`);
    assert.match(await b.evaluate(`document.querySelector('[role="alertdialog"]').innerText`), /unsaved changes and unfinished input drafts/);
    await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.ok(await b.evaluate(`!!document.activeElement.closest('[role="alertdialog"]')`));
    await press(b, '.focus-confirm-cancel'); await b.wait(`!document.querySelector('[role="alertdialog"]')`); await conflict(b);
    assert.ok((await exported(b))[0].entries.some((entry) => entry.text === 'B session content')); assert.equal(await writes(b), 0);
    assert.equal(await b.evaluate(`document.querySelector('textarea[aria-label="New note for Review A"]').value`), 'Unfinished draft');
    await press(b, '[data-testid="priority-conflict-warning"] .storage-warning-actions button:last-child'); await b.wait(`!!document.querySelector('[role="alertdialog"]')`);
    const boot = await b.evaluate('window.qaBoot'); await press(b, '.focus-confirm-destructive');
    await b.wait(`window.qaBoot !== ${JSON.stringify(boot)} && !!document.querySelector('.selected-panel-focus')`); await sleep(300);
    assert.equal(await writes(b), 0); assert.equal(await b.evaluate(`!!document.querySelector('[data-testid="priority-conflict-warning"]')`), false);
    await focus(b); await note(b, 'Saved after confirmed reload'); await b.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length === 4`);
    assert.equal((await stored(b))[0].entries.at(-1).text, 'Saved after confirmed reload');
    assert.ok(!(await stored(b))[0].entries.some((entry) => entry.text === 'B session content'));
  });
  await test('simultaneous writes from the same revision produce one winner and a preserved loser', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }), b = await tab(ctx, { ignoreEvents: true }); await focus(a);
    await hold(a);
    await Promise.all([note(a, 'Overlapping A note'), press(b, '[aria-label="Complete task"]')]);
    await queued(a, 2); await release(a);
    await a.wait(`navigator.locks.query().then(state=>state.pending.length===0 && state.held.length===0)`);
    await a.wait(`!!document.querySelector('[data-testid="priority-conflict-warning"]') || JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length===3`);
    await sleep(100);
    const snapshot = (await stored(a))[0]; assert.equal((await writes(a)) + (await writes(b)), 1);
    if (snapshot.completed) {
      assert.deepEqual(snapshot.entries, seed[0].entries); await conflict(a);
      assert.ok((await exported(a))[0].entries.some((entry) => entry.text === 'Overlapping A note'));
    } else {
      assert.equal(snapshot.entries.at(-1).text, 'Overlapping A note'); await conflict(b); assert.equal((await exported(b))[0].completed, true);
    }
  });
  await test('obsolete queued same-tab saves are cancelled; latest state saves once', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }); await focus(a); await hold(a);
    await note(a, 'Queued one'); await note(a, 'Queued two'); await queued(a, 1); await release(a);
    await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length===4`);
    assert.equal(await writes(a), 1); assert.equal(await a.evaluate(`!!document.querySelector('[data-testid="priority-conflict-warning"]')`), false);
  });
  await test('a hydration queued behind a newer writer cannot rewrite its old snapshot', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }); await focus(a); await hold(a);
    await note(a, 'Saved ahead of B hydration'); await queued(a, 1);
    const b = await tab(ctx, { ignoreEvents: true }); await queued(a, 2); await release(a); await conflict(b);
    assert.equal((await stored(a))[0].entries.at(-1).text, 'Saved ahead of B hydration'); assert.equal(await writes(b), 0);
    assert.equal(await b.evaluate(`window.qaWrites.length`), 0, 'No backup or canonical write during stale hydration');
  });
  await test('legacy notes normalize once under the lock and remain compatible', async (ctx) => {
    const legacy = [{ ...seed[0], notes: 'Legacy saved note' }];
    const a = await tab(ctx, { seedRaw: JSON.stringify(legacy) }); await a.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.length===3`);
    assert.equal((await stored(a))[0].entries[0].text, 'Legacy saved note'); assert.equal((await stored(a))[0].notes, undefined);
    const b = await tab(ctx); assert.equal(await writes(b), 0); assert.equal((await stored(b))[0].entries.length, 3);
  });
  await test('recovery backup precedes replacement; unsupported recovery never writes', async (ctx) => {
    const a = await tab(ctx, { seedRaw: '{broken' });
    await a.wait(`window.qaWrites.some(entry=>entry.name===${JSON.stringify(key)})`);
    const recovered = await a.evaluate('window.qaWrites'); assert.equal(recovered[0].name, `${key}.corrupt`); assert.equal(recovered[0].value, '{broken'); assert.equal(recovered[1].name, key);
    // Existing recovery copies are preserved, and a failed backup is latched until reload.
    const b = await tab(ctx, { seedRaw: '{another-broken', noLocks: true });
    assert.equal(await b.evaluate(`localStorage.getItem(${JSON.stringify(key)})`), '{another-broken');
    assert.equal(await b.evaluate('window.qaWrites.length'), 0);
  });
  await test('failed backup preserves original bytes and stays blocked after further edits', async (ctx) => {
    const a = await tab(ctx, { seedRaw: '{backup-failure', blockBackup: true });
    await a.wait(`document.querySelector('[data-testid="priority-recovery-warning"]')?.innerText.includes('Saved data needs recovery')`);
    await a.evaluate('window.qaBlockBackup = false');
    await press(a, '[aria-label="Add priority"]'); await input(a, '.name-input', 'Still memory only'); await press(a, '[role="dialog"] button[type="submit"]'); await sleep(100);
    assert.equal(await a.evaluate(`localStorage.getItem(${JSON.stringify(key)})`), '{backup-failure'); assert.equal(await a.evaluate('window.qaWrites.length'), 0);
  });
  await test('missing coordination fails closed, including recovery and editing', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed, noLocks: true });
    await a.wait(`document.querySelector('[data-testid="priority-recovery-warning"]')?.innerText.includes('Saving is unavailable')`);
    await focus(a); await note(a, 'Memory only'); assert.equal(await writes(a), 0); assert.deepEqual(await stored(a), seed);
    await press(a, '[data-testid="priority-recovery-warning"] button');
    assert.ok((await a.evaluate('window.qaExport.then(JSON.parse)'))[0].entries.some((entry) => entry.text === 'Memory only'));
  });
  await test('denied lock requests never fall back to an uncoordinated write', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed, rejectLocks: true }); await a.wait(`!!document.querySelector('[data-testid="priority-save-warning"]')`);
    await press(a, '[data-testid="priority-save-warning"] button'); await sleep(100); assert.equal(await writes(a), 0); assert.deepEqual(await stored(a), seed);
  });
  await test('failed initial read never overwrites existing data, even after editing', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed, denyRead: true }); await a.wait(`!!document.querySelector('[data-testid="priority-recovery-warning"]')`);
    await press(a, '[aria-label="Add priority"]'); await input(a, '.name-input', 'Memory-only priority'); await press(a, '[role="dialog"] button[type="submit"]');
    assert.equal(await writes(a), 0); await a.evaluate('window.qaDenyRead = false'); assert.deepEqual(await stored(a), seed);
    assert.equal(await a.evaluate(`!!document.querySelector('[data-testid="priority-save-warning"]')`), false);
  });
  await test('external storage clear is a conflict, never an invitation to repopulate stale data', async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }), b = await tab(ctx); await b.evaluate('localStorage.clear()'); await conflict(a);
    await press(a, '[aria-label="Complete task"]'); assert.equal(await a.evaluate(`localStorage.getItem(${JSON.stringify(key)})`), null); assert.equal(await writes(a), 0);
  });
  for (const [width, height] of [[390, 844], [844, 390]]) await test(`conflict warning and reload confirmation remain reachable at ${width}x${height}`, async (ctx) => {
    const a = await tab(ctx, { seedRaw: rawSeed }), b = await tab(ctx, { width, height }); await focus(b); await focus(a); await note(a, 'Mobile conflict note');
    await b.send('Page.bringToFront');
    await b.wait(`Number(getComputedStyle(document.querySelector('[data-testid="planet-focus-mode"]')).opacity) > .99`);
    await conflict(b);
    await openWarning(b);
    await b.evaluate(`document.querySelector('[data-testid="priority-conflict-warning"] .storage-warning-actions button:last-child').scrollIntoView({block:'nearest'})`);
    await sleep(100);
    assert.ok(await b.evaluate(`(() => {const e=document.querySelector('[data-testid="priority-conflict-warning"] .storage-warning-actions button:last-child'),r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`));
    if (output) {
      const shot = await b.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, `conflict-warning-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    await press(b, '[data-testid="priority-conflict-warning"] .storage-warning-actions button:last-child'); await b.wait(`!!document.querySelector('[role="alertdialog"]')`);
    await sleep(300);
    if (output) {
      const shot = await b.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(output, `conflict-confirm-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    assert.ok(await b.evaluate(`(() => {const e=document.querySelector('.focus-confirm-cancel'),r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`));
    await press(b, '.focus-confirm-cancel'); await conflict(b); assert.equal(await writes(b), 0);
  });
  assert.equal(results.length,19,'Every cross-tab case ran');
  const summary = { passed: results.filter((r) => r.status === 'PASS').length, failed: results.filter((r) => r.status === 'FAIL').length, results };
  console.log(JSON.stringify(summary, null, 2));
  if (output) await writeFile(path.join(output, 'cross-tab-results.json'), JSON.stringify(summary, null, 2));
  process.exitCode = summary.failed ? 1 : 0;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => browser?.close());
