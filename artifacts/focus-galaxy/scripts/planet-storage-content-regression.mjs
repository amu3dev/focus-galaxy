import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

// Uses the same isolated Chrome/CDP setup as test:planet-interaction.
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const port = Number(process.env.CDP_PORT || 9228);
const key = 'focus-galaxy-priorities-v2';
const seed = [
  { id: 'review-a', name: 'Review A', importance: 8, urgency: 8, energy: 7, hue: '#f04e76', entries: [
    { id: 'note-a', type: 'note', text: 'Keep this note', createdAt: 1, updatedAt: 1 },
    { id: 'task-a', type: 'task', text: 'Keep this task', completed: false, createdAt: 2, updatedAt: 2 },
  ] },
  { id: 'review-b', name: 'Review B', importance: 6, urgency: 6, energy: 6, hue: '#9b5be4' },
];
const errors = [];
const pending = new Map();
const results = [];
let nextId = 0;
let socket;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function waitFor(expression) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out: ${expression}`);
}

async function load(value, width = 1440, height = 900, options = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(options.raw ?? JSON.stringify(value))});
      ${options.blockRecovery ? `
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(name, value) {
          if (name.startsWith(${JSON.stringify(`${key}.corrupt`)})) throw new DOMException('Test storage quota', 'QuotaExceededError');
          return originalSetItem.call(this, name, value);
        };
      ` : ''}`,
  });
  await send('Page.navigate', { url: baseUrl });
  await waitFor(`!!document.querySelector('button[aria-label="Add priority"]')`);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  await sleep(350);
}

const saved = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))`);
const recoveryCopies = () => evaluate(`Object.keys(localStorage).filter(name => name.startsWith(${JSON.stringify(`${key}.corrupt`)})).map(name => localStorage.getItem(name))`);

async function escape() {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
}

async function click(selector) {
  let position;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !position) {
    await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (!element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))) {
        element.scrollIntoView({ block: 'center' });
      }
    })()`);
    // Scrolling can reposition a centered, animated dialog on the next frame.
    // Read the hit target after layout settles, rather than using stale coordinates.
    await sleep(100);
    position = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    if (!rect.width || !rect.height || !element.contains(document.elementFromPoint(x, y))) return null;
    return { x, y };
  })()`);
    if (position) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...position });
      await sleep(50);
      const stillOnTarget = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.contains(document.elementFromPoint(${position.x}, ${position.y}))`);
      if (!stillOnTarget) position = null;
    }
    if (!position) await sleep(100);
  }
  assert.ok(position, `No visible hit-test target: ${selector}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...position });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...position });
}

async function screenshot(name) {
  if (!process.env.QA_OUTPUT_DIR) return;
  const result = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(process.env.QA_OUTPUT_DIR, `${name}.png`), Buffer.from(result.data, 'base64'));
}

async function input(selector, text) {
  await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(text)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

async function test(name, run) {
  await run();
  assert.deepEqual(errors, [], 'Browser runtime errors');
  results.push(name);
  console.log(`PASS ${name}`);
}

async function openFocus() {
  await waitFor(`!!document.querySelector('.selected-panel-focus')`);
  await click('.selected-panel-focus');
  await waitFor(`!!document.querySelector('[data-testid="planet-focus-mode"]')`);
  await sleep(800);
}

async function main() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target = targets.find((item) => item.type === 'page' && item.url.startsWith(new URL(baseUrl).origin))
    ?? targets.find((item) => item.type === 'page' && item.url === 'about:blank');
  assert.ok(target, 'Open an isolated Chrome page for the app first');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (request) {
      clearTimeout(request.timeout);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');
  errors.length = 0;

  await test('invalid priority fields are rejected without crashing', async () => {
    await load([{}, null, [], { ...seed[0], id: '' }, { ...seed[0], name: 42 },
      { ...seed[0], importance: '8' }, { ...seed[0], urgency: 11 },
      { ...seed[0], energy: null }, { ...seed[0], hue: 'garbage' }, seed[1]]);
    assert.deepEqual((await saved()).map((priority) => priority.id), ['review-b']);
    assert.equal(await evaluate(`document.querySelectorAll('.orb-screen-hit').length`), 1);
  });

  await test('rejected priorities/entries retain exact recovery copies across reloads', async () => {
    const first = [seed[0], { rejected: 'priority recovery check' }];
    const second = [{ ...seed[0], entries: [...seed[0].entries, { rejected: 'entry recovery check' }] }];
    await load(first);
    assert.ok((await recoveryCopies()).includes(JSON.stringify(first)));
    await load(second);
    assert.ok((await recoveryCopies()).includes(JSON.stringify(first)));
    assert.ok((await recoveryCopies()).includes(JSON.stringify(second)));
    assert.equal((await saved())[0].entries.length, 2);
    const copies = await recoveryCopies();
    await send('Page.reload');
    await waitFor(`!!document.querySelector('.selected-panel-focus')`);
    assert.deepEqual(await recoveryCopies(), copies);
  });

  await test('malformed JSON and non-array storage are backed up before fallback', async () => {
    for (const raw of ['{broken-json', '{"unexpected":"object"}']) {
      await load(null, 1440, 900, { raw });
      assert.ok((await recoveryCopies()).includes(raw));
      assert.ok((await saved()).length > 0);
      assert.ok(await evaluate(`document.querySelectorAll('.orb-screen-hit').length > 0`));
    }
  });

  await test('failed recovery writes preserve the original data and explain unsaved changes', async () => {
    const raw = '[{"rejected":"quota recovery check"}]';
    await load(null, 1440, 900, { raw, blockRecovery: true });
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(key)})`), raw);
    assert.match(await evaluate(`document.querySelector('.priority-recovery-warning')?.innerText`), /changes in this session will not be saved/);
    await click('[aria-label="Add priority"]');
    await input('.name-input', 'Unsaved session priority');
    await click('[role="dialog"] button[type="submit"]');
    await sleep(200);
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(key)})`), raw);
  });

  await test('an entirely malformed array leaves the empty galaxy usable', async () => {
    await load([{}, {}]);
    assert.deepEqual(await saved(), []);
    await click('[aria-label="Add priority"]');
    assert.ok(await evaluate(`!!document.querySelector('#add-priority-title')`));
  });

  await test('legacy notes migrate once while invalid entries are discarded', async () => {
    await load([{ ...seed[0], notes: 'Legacy note', entries: [
      ...seed[0].entries, { ...seed[0].entries[0], id: 'legacy-note-review-a' },
      { ...seed[0].entries[0], id: '' }, { ...seed[0].entries[1], completed: 'yes' },
    ] }]);
    const entries = (await saved())[0].entries;
    assert.equal(entries.length, 4);
    assert.equal(entries[0].id, 'legacy-note-review-a-1');
    assert.equal(entries[0].text, 'Legacy note');
    await send('Page.reload');
    await waitFor(`!!document.querySelector('.selected-panel-focus')`);
    assert.deepEqual((await saved())[0].entries, entries);
  });

  await test('duplicate priority/entry IDs preserve content and avoid suffix collisions', async () => {
    await load([{ ...seed[0], entries: [...seed[0].entries, seed[0].entries[0], { ...seed[0].entries[0], id: 'note-a-1' }, {}] },
      { ...seed[0], name: 'Duplicate' }, { ...seed[1], id: 'review-a-1' }]);
    const priorities = await saved();
    assert.deepEqual(priorities.map((priority) => priority.id), ['review-a', 'review-a-2', 'review-a-1']);
    assert.deepEqual(priorities[0].entries.map((entry) => entry.id), ['note-a', 'task-a', 'note-a-2', 'note-a-1']);
    assert.equal(priorities[1].entries.length, 2);
    await send('Page.reload');
    await waitFor(`document.querySelectorAll('.orb-screen-hit').length === 3`);
    assert.deepEqual((await saved()).map((priority) => priority.id), priorities.map((priority) => priority.id));
  });

  await test('completion followed immediately by Focus never leaves the galaxy inert', async () => {
    await load(seed);
    await evaluate(`(() => {
      document.querySelector('[aria-label="Complete task"]').click();
      document.querySelector('.selected-panel-focus')?.click();
    })()`);
    await sleep(1500);
    assert.equal(await evaluate(`!!document.querySelector('[inert], [data-testid="planet-focus-mode"]')`), false);
    assert.equal((await saved())[0].completed, true);
    assert.deepEqual((await saved())[0].entries, seed[0].entries);
    await click('[aria-label="Add priority"]');
    assert.ok(await evaluate(`!!document.querySelector('#add-priority-title')`));
  });

  await test('completion and restoration stay reversible when persistence fails', async () => {
    await load(seed);
    await evaluate(`(() => {
      window.qaBlockWrites = true;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(name, value) {
        if (name === ${JSON.stringify(key)} && window.qaBlockWrites) throw new DOMException('Storage denied', 'SecurityError');
        return original.call(this, name, value);
      };
    })()`);
    await click('[aria-label="Complete task"]');
    await waitFor(`!!document.querySelector('[data-testid="priority-save-warning"]')`);
    assert.equal((await saved())[0].completed, undefined);
    await sleep(800);
    await click('[aria-label="Manage priorities"]');
    await waitFor(`!!document.querySelector('[aria-label="Restore Review A"]')`);
    await click('[aria-label="Restore Review A"]');
    await waitFor(`document.querySelectorAll('.orb-screen-hit').length === 2`);
    assert.ok(await evaluate(`!!document.querySelector('[data-testid="priority-save-warning"]')`));
    await evaluate('window.qaBlockWrites = false');
    await click('[data-testid="priority-save-warning"] button');
    await waitFor(`!document.querySelector('[data-testid="priority-save-warning"]')`);
    assert.equal((await saved())[0].completed, false);
    assert.deepEqual((await saved())[0].entries, seed[0].entries);
  });

  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    await test(`quota failure preserves latest edits and retry persists them at ${width}x${height}`, async () => {
      await load(seed, width, height);
      await openFocus();
      await evaluate(`(() => {
        window.qaBlockWrites = true;
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(name, value) {
          if (name === ${JSON.stringify(key)} && window.qaBlockWrites) throw new DOMException('Quota test', 'QuotaExceededError');
          return original.call(this, name, value);
        };
      })()`);
      await input('textarea[aria-label="New note for Review A"]', 'Unsaved first note');
      await click('.planet-content-compose button[type="submit"]');
      await waitFor(`!!document.querySelector('[data-testid="priority-save-warning"]')`);
      assert.deepEqual((await saved())[0].entries, seed[0].entries);
      assert.ok(await evaluate(`document.querySelector('[data-testid="planet-focus-mode"]').innerText.includes('Unsaved first note')`));
      assert.equal(await evaluate(`document.querySelector('[data-testid="planet-focus-mode"]').innerText.includes('Note saved')`), false);
      await click('[data-testid="priority-save-warning"] button');
      assert.ok(await evaluate(`!!document.querySelector('[data-testid="priority-save-warning"]')`));
      await input('textarea[aria-label="New note for Review A"]', 'Unsaved latest note');
      await click('.planet-content-compose button[type="submit"]');
      assert.ok(await evaluate(`(() => {
        const rect = document.querySelector('[data-testid="priority-save-warning"] button').getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
      })()`));
      await screenshot(`unsaved-${width}`);
      // Shift+Tab from the first modal control must reach Retry save.
      await evaluate(`document.querySelector('[aria-label="Return to galaxy"]').focus()`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      assert.ok(await evaluate(`!!document.activeElement?.closest('[data-testid="priority-save-warning"]')`));
      // The session-copy action is last in the warning; Shift+Tab reaches Retry.
      if (await evaluate(`document.activeElement?.textContent !== 'Retry save'`)) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      }
      assert.equal(await evaluate(`document.activeElement?.textContent`), 'Retry save');
      await evaluate('window.qaBlockWrites = false');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await waitFor(`!document.querySelector('[data-testid="priority-save-warning"]')`);
      assert.ok((await saved())[0].entries.some(entry => entry.text === 'Unsaved first note'));
      assert.ok((await saved())[0].entries.some(entry => entry.text === 'Unsaved latest note'));
      await send('Page.reload');
      await waitFor(`!!document.querySelector('.selected-panel-focus')`);
      await openFocus();
      assert.ok(await evaluate(`document.querySelector('[data-testid="planet-focus-mode"]').innerText.includes('Unsaved latest note')`));
    });

    await test(`completion and restoration preserve content across reload at ${width}x${height}`, async () => {
      await load([seed[0]], width, height);
      if (width < 1025) {
        await click('.mobile-sheet-summary');
        await sleep(700);
      }
      await click('[aria-label="Complete task"]');
      await sleep(1000);
      assert.equal((await saved()).length, 1);
      assert.equal((await saved())[0].completed, true);
      assert.deepEqual((await saved())[0].entries, seed[0].entries);
      await waitFor(`document.querySelectorAll('.orb-screen-hit').length === 0`);
      await send('Page.reload');
      await waitFor(`!!document.querySelector('button[aria-label="Add priority"]')`);
      assert.equal(await evaluate(`document.querySelectorAll('.orb-screen-hit').length`), 0);
      if (width < 1025) await click('#mobile-galaxy-controls-trigger');
      await click('[aria-label="Manage priorities"]');
      await waitFor(`!!document.querySelector('[aria-label="Restore Review A"]')`);
      await sleep(400);
      assert.ok(await evaluate(`(() => {
        const rect = document.querySelector('[aria-label="Restore Review A"]').getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
      })()`));
      await screenshot(`restore-${width}`);
      await click('[aria-label="Restore Review A"]');
      await waitFor(`document.querySelectorAll('.orb-screen-hit').length === 1`);
      assert.equal((await saved())[0].completed, false);
      assert.deepEqual((await saved())[0].entries, seed[0].entries);
      await send('Page.reload');
      await waitFor(`document.querySelectorAll('.orb-screen-hit').length === 1`);
      await openFocus();
      assert.ok(await evaluate(`document.querySelector('[data-testid="planet-focus-mode"]').innerText.includes('Keep this note')`));
      assert.ok(await evaluate(`document.querySelector('[data-testid="planet-focus-mode"]').innerText.includes('Keep this task')`));
    });
  }

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await test(`priority removal warns, cancels safely, and preserves focus at ${width}x${height}`, async () => {
      await load(seed, width, height);
      if (width < 768) {
        await click('.mobile-sheet-summary');
        await sleep(700);
      }
      const requestRemoval = async () => {
        if (width < 768) {
          await click('.selected-panel-more');
          await sleep(250);
          await click('[role="menuitem"].focus-context-danger');
        } else await click('[aria-label="Delete priority"]');
      };
      await requestRemoval();
      await waitFor(`!!document.querySelector('[role="alertdialog"]')`);
      assert.match(await evaluate(`document.querySelector('[role="alertdialog"]').innerText`), /all 2 attached notes\/tasks/);
      await sleep(350);
      await screenshot(`priority-removal-${width}`);
      await click('.focus-confirm-cancel');
      await sleep(400);
      assert.equal((await saved()).length, 2);
      await requestRemoval();
      await sleep(350);
      await click('.focus-confirm-destructive');
      await sleep(1200);
      assert.equal((await saved()).length, 1);
      assert.equal(await evaluate(`document.activeElement === document.body || !document.activeElement.isConnected`), false);
      assert.equal(await evaluate(`!!document.activeElement.closest('.selected-panel-card')`), false);
    });
  }

  await test('note/task deletion requires confirmation and cancellation keeps storage intact', async () => {
    await load(seed);
    await openFocus();
    for (const type of ['note', 'task']) {
      await click(`[aria-label="Delete ${type}"]`);
      await waitFor(`!!document.querySelector('.planet-content-delete-confirm')`);
      assert.equal(await evaluate(`document.activeElement.textContent`), 'Cancel deletion');
      assert.ok((await saved())[0].entries.some((entry) => entry.type === type));
      await click('.planet-content-delete-confirm button:first-child');
      assert.ok((await saved())[0].entries.some((entry) => entry.type === type));
      await click(`[aria-label="Delete ${type}"]`);
      await click('.planet-content-delete-confirm button:last-child');
      await sleep(150);
      assert.equal((await saved())[0].entries.some((entry) => entry.type === type), false);
      assert.equal(await evaluate(`document.activeElement === document.body`), false);
    }
  });

  await test('new notes/tasks and edited content persist trimmed text', async () => {
    await load(seed);
    await openFocus();
    await input('textarea[aria-label="New note for Review A"]', '  New note  ');
    await click('.planet-content-compose button[type="submit"]');
    await waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.some(entry => entry.text === 'New note')`);
    assert.ok((await saved())[0].entries.some((entry) => entry.text === 'New note'));
    await click('[aria-label="Edit note"]');
    await input('textarea[aria-label="Edit note"]', '  Edited note  ');
    await click('[aria-label="Save note changes"]');
    await waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.some(entry => entry.text === 'Edited note')`);
    assert.ok((await saved())[0].entries.some((entry) => entry.text === 'Edited note'));
    await click('[aria-label="Edit task"]');
    await input('input[aria-label="Edit task"]', '  Edited task  ');
    await click('[aria-label="Save task changes"]');
    await waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.some(entry => entry.text === 'Edited task')`);
    assert.ok((await saved())[0].entries.some((entry) => entry.text === 'Edited task'));
    await click('.planet-content-switch button:last-child');
    await input('input[aria-label="New task for Review A"]', '  New task  ');
    await click('.planet-content-task-compose button[type="submit"]');
    await waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].entries.some(entry => entry.text === 'New task')`);
    assert.ok((await saved())[0].entries.some((entry) => entry.text === 'New task'));
  });

  await test('mobile note confirmation stays visible and cancel restores its opener', async () => {
    await load(seed, 390, 844);
    await openFocus();
    await click('[aria-label="Delete note"]');
    await waitFor(`document.activeElement?.textContent === 'Cancel deletion'`);
    await screenshot('note-deletion-390');
    assert.ok(await evaluate(`(() => {
      const rect = document.activeElement.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    })()`));
    await click('.planet-content-delete-confirm button:first-child');
    assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Delete note');
    assert.equal((await saved())[0].entries.length, 2);
  });

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await test(`Escape cancels note/task deletion without closing Focus at ${width}x${height}`, async () => {
      await load(seed, width, height);
      await openFocus();
      for (const type of ['note', 'task']) {
        await click(`[aria-label="Delete ${type}"]`);
        await waitFor(`!!document.querySelector('.planet-content-delete-confirm')`);
        // Escape must also cancel after focus moves outside the composer.
        if (type === 'task') await evaluate(`document.querySelector('[aria-label="Return to galaxy"]').focus()`);
        await escape();
        await waitFor(`!document.querySelector('.planet-content-delete-confirm')`);
        assert.ok(await evaluate(`!!document.querySelector('[data-testid="planet-focus-mode"]')`));
        assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), `Delete ${type}`);
        assert.equal((await saved())[0].entries.length, 2);
      }
      // Once no confirmation remains, Escape keeps its normal Focus behavior.
      await escape();
      await waitFor(`!document.querySelector('[data-testid="planet-focus-mode"]')`);
    });
  }
  console.log(JSON.stringify({ passed: results.length, runtimeErrors: errors }));
}

main().catch(async (error) => { console.error(error); if (socket?.readyState === WebSocket.OPEN) await screenshot('storage-content-failure'); process.exitCode = 1; }).finally(() => socket?.close());
