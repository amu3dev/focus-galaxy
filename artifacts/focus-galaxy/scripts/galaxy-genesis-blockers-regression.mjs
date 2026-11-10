// Run with: node --test scripts/galaxy-genesis-blockers-regression.mjs
// Execute the actual TS hook/component; only React, DOM, and storage are adapters.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const ACTIVE = 'focus-galaxy-priorities-v2';
const BACKUP = `${ACTIVE}.genesis-backup`;
const A = JSON.stringify([{ name: 'Recovery A' }]);
const B = JSON.stringify([{ name: 'Active B' }]);
const C = JSON.stringify([{ name: 'Template C' }]);
const tick = () => new Promise(resolve => setImmediate(resolve));

function load(path, adapters, globals) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: id => adapters[id] ?? require(id), AbortController, ...globals }, { filename: path });
  return exports;
}

function hooks() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  return {
    begin() { cursor = 0; },
    flush() { const pending = effects; effects = []; pending.forEach(effect => effect()); },
    react: {
      useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
      useState(value) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value;
        return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
      },
      useEffect(effect, deps) {
        const i = cursor++;
        if (!slots[i] || deps.some((value, index) => !Object.is(value, slots[i][index]))) effects.push(effect);
        slots[i] = deps;
      },
    },
  };
}

function storage() {
  const data = new Map([[ACTIVE, B], [BACKUP, A]]);
  return {
    data, fail: () => false,
    getItem(key) { if (this.fail('get', key)) throw Error('blocked read'); return data.get(key) ?? null; },
    setItem(key, value) { if (this.fail('set', key, value)) throw Error('blocked write'); data.set(key, value); },
    removeItem(key) { if (this.fail('remove', key)) throw Error('blocked cleanup'); data.delete(key); },
  };
}

async function mount(store, { locks = true, needsRecovery = false } = {}) {
  const adapter = hooks();
  const requests = [];
  const navigator = { locks: locks ? { request: async (key, options, callback) => {
    requests.push(key);
    if (options.signal?.aborted) throw Error('aborted');
    return callback();
  } } : undefined };
  const { usePriorityPersistence } = load('../src/hooks/use-priority-persistence.ts', { react: adapter.react }, {
    navigator, window: { localStorage: store, addEventListener() {}, removeEventListener() {} },
    document: { addEventListener() {}, removeEventListener() {} },
  });
  let snapshot = store.getItem(ACTIVE);
  let priorities = JSON.parse(snapshot ?? '[]');
  let result;
  const render = () => { adapter.begin(); result = usePriorityPersistence(priorities, snapshot, needsRecovery); adapter.flush(); };
  async function settle() { for (let i = 0; i < 3; i++) { render(); await tick(); } }
  await settle();
  return {
    get current() { render(); return result; }, requests,
    async edit(next) { priorities = JSON.parse(next); await settle(); },
    async retry() { result.retry(); await settle(); },
  };
}

for (const [action, next] of [['template replacement', C], ['restore', A]]) {
  test(`failed ${action} preserves recovery A across reload even if rollback and cleanup fail`, async () => {
    const store = storage();
    const hook = await mount(store);
    store.fail = (operation, key) => (operation === 'set' && (key === ACTIVE || key === BACKUP)) || operation === 'remove';
    // Permit the first backup write only, reproducing the original destructive ordering.
    let firstBackup = true;
    const blocked = store.fail;
    store.fail = (operation, key) => {
      if (operation === 'set' && key === BACKUP && firstBackup) { firstBackup = false; return false; }
      return blocked(operation, key);
    };
    assert.equal(await hook.current.replacePriorities(JSON.parse(next)), false);
    assert.equal(store.data.get(ACTIVE), B, 'failed replacement leaves active snapshot unchanged');
    assert.equal(hook.current.backup, A, 'failed replacement must not replace the session recovery');
    const reloaded = await mount(store);
    assert.equal(reloaded.current.backup, A, 'recovery A must survive reload without a successful rollback');
    assert.equal(hook.current.status, 'error', 'failed writes do not leave saving pending');
  });
}

test('a blocked normal backup write fails closed before changing the active galaxy', async () => {
  const store = storage();
  const hook = await mount(store);
  store.fail = (operation, key) => operation === 'set' && key === BACKUP;
  assert.equal(await hook.current.replacePriorities(JSON.parse(C)), false);
  assert.equal(store.data.get(ACTIVE), B);
  assert.equal(hook.current.backup, A);
  assert.equal(hook.current.status, 'error');
});

const PENDING = `${BACKUP}.pending`;

test('a blocked durable undo write leaves both snapshots untouched', async () => {
  const store = storage();
  const hook = await mount(store);
  store.fail = (operation, key) => operation === 'set' && key === PENDING;
  assert.equal(await hook.current.replacePriorities(JSON.parse(C)), false);
  assert.equal(store.data.get(ACTIVE), B);
  assert.equal(store.data.get(BACKUP), A);
  assert.equal(hook.current.status, 'error');
});

test('failed rollback is retried before replacement, then restore swaps healthy JSON backups', async () => {
  const store = storage();
  const hook = await mount(store);
  store.fail = (operation, key, value) => operation === 'set' && (key === ACTIVE || (key === BACKUP && value === A));
  assert.equal(await hook.current.replacePriorities(JSON.parse(C)), false);
  assert.equal(store.data.get(BACKUP), B, 'failed rollback really leaves the normal backup overwritten');
  assert.ok(store.data.has(PENDING), 'durable undo remains when rollback fails');
  const reloaded = await mount(store);
  assert.equal(reloaded.current.backup, A);
  assert.equal(reloaded.current.status, 'error');
  store.fail = () => false;
  await reloaded.retry();
  assert.equal(store.data.get(BACKUP), A);
  assert.equal(store.data.has(PENDING), false);
  assert.equal(await reloaded.current.replacePriorities(JSON.parse(A)), true);
  assert.equal(store.data.get(ACTIVE), A);
  assert.equal(store.data.get(BACKUP), B);
  assert.equal(store.data.has(PENDING), false);
  assert.deepEqual([...store.data.keys()].sort(), [ACTIVE, BACKUP].sort());
  assert.ok(reloaded.requests.every(key => key === `${ACTIVE}:write`));
});

test('a failed first replacement cannot invent a recovery copy after reload', async () => {
  const store = storage();
  store.data.delete(BACKUP);
  const hook = await mount(store);
  store.fail = (operation, key) => (operation === 'set' && key === ACTIVE) || operation === 'remove';
  assert.equal(await hook.current.replacePriorities(JSON.parse(C)), false);
  assert.equal(store.data.get(BACKUP), B);
  const reloaded = await mount(store);
  assert.equal(reloaded.current.backup, null, 'undo distinguishes no prior backup from the failed candidate');
  assert.equal(reloaded.current.status, 'error');
});

test('a committed undo record cannot be invalidated by an ordinary edit until cleanup succeeds', async () => {
  const store = storage();
  const hook = await mount(store);
  store.fail = operation => operation === 'remove';
  assert.equal(await hook.current.replacePriorities(JSON.parse(C)), true);
  assert.equal(store.data.get(ACTIVE), C);
  const reloaded = await mount(store);
  assert.equal(reloaded.current.backup, B);
  await reloaded.edit(A);
  assert.equal(store.data.get(ACTIVE), C, 'cleanup failure must block subsequent active writes');
  assert.equal(reloaded.current.status, 'error');
  store.fail = () => false;
  await reloaded.retry();
  assert.equal(store.data.get(ACTIVE), A);
  assert.equal(store.data.get(BACKUP), B);
  assert.equal(store.data.has(PENDING), false);
});

test('revision conflicts and absent Web Locks do not mutate either recovery snapshot', async () => {
  const store = storage();
  const hook = await mount(store);
  store.data.set(ACTIVE, C);
  assert.equal(await hook.current.replacePriorities(JSON.parse(A)), false);
  assert.equal(hook.current.status, 'conflict');
  assert.equal(store.data.get(ACTIVE), C);
  assert.equal(store.data.get(BACKUP), A);
  assert.equal(store.data.has(PENDING), false);
  const unavailable = await mount(store, { locks: false });
  assert.equal(await unavailable.current.replacePriorities(JSON.parse(B)), false);
  assert.equal(unavailable.current.status, 'unavailable');
  assert.equal(store.data.get(ACTIVE), C);
});

test('aborted and overlapping replacements do not perform a second transaction', async () => {
  const store = storage();
  const hook = await mount(store);
  const abort = new AbortController();
  abort.abort();
  assert.equal(await hook.current.replacePriorities(JSON.parse(C), abort.signal), false);
  assert.equal(hook.current.status, 'saved');
  assert.equal(store.data.get(BACKUP), A);
  const replace = hook.current.replacePriorities;
  assert.deepEqual(await Promise.all([replace(JSON.parse(C)), replace(JSON.parse(A))]), [true, false]);
  assert.equal(store.data.get(ACTIVE), C);
  assert.equal(store.data.get(BACKUP), B);
});

class Element {
  constructor({ connected = true, visible = true, visibility = 'visible', menu = false } = {}) {
    Object.assign(this, { isConnected: connected, visible, visibility, menu, focused: false });
  }
  getClientRects() { return this.visible ? [{}] : []; }
  closest(selector) { return selector === '.header-utilities' && this.menu ? this : null; }
  focus() { this.focused = true; }
}

function closeGenesis(opener, { mobile = new Element(), core = new Element(), otherDialog = false } = {}) {
  const adapter = hooks();
  const jsx = (type, props) => ({ type, props });
  const document = {
    activeElement: opener,
    getElementById: id => id === 'mobile-galaxy-controls-trigger' ? mobile : null,
    querySelector: selector => selector === '[role="dialog"]' ? (otherDialog ? {} : null) : selector === '.core-container' ? core : null,
  };
  const { GalaxyGenesis } = load('../src/components/galaxy-genesis.tsx', {
    react: adapter.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@radix-ui/react-dialog': Object.fromEntries(['Root', 'Portal', 'Overlay', 'Content', 'Title', 'Description', 'Close'].map(name => [name, name])),
    'lucide-react': { ArrowRight: 'ArrowRight', RotateCcw: 'RotateCcw', X: 'X' },
    '@/lib/galaxy-templates': { galaxyTemplates: [{ id: 'blank', priorities: [] }], templateCounts: () => ({ priorities: 0, tasks: 0, notes: 0 }) },
    '@/components/ui/alert-dialog': Object.fromEntries(['AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle'].map(name => [name, name])),
  }, { document, HTMLElement: Element, getComputedStyle: element => ({ visibility: element.visibility }), requestAnimationFrame: callback => callback() });
  adapter.begin();
  const tree = GalaxyGenesis({ canApply: true });
  function findContent(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.props?.['data-testid'] === 'galaxy-genesis') return node;
    return [node.props?.children].flat().map(findContent).find(Boolean);
  }
  let prevented = false;
  findContent(tree).props.onCloseAutoFocus({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  return { mobile, core };
}

test('closing Genesis returns focus to a still-visible connected opener', () => {
  const opener = new Element();
  closeGenesis(opener);
  assert.equal(opener.focused, true);
});

test('hidden mobile-menu launcher returns focus to the visible controls toggle', () => {
  const opener = new Element({ menu: true, visible: false });
  const { mobile } = closeGenesis(opener);
  assert.equal(mobile.focused, true);
  assert.equal(opener.focused, false);
});

test('removed blank-universe launcher returns focus to the persistent core', () => {
  const opener = new Element({ connected: false });
  const { core } = closeGenesis(opener);
  assert.equal(core.focused, true);
  assert.equal(opener.focused, false);
});

test('visibility-hidden opener or mobile toggle is never chosen as a focus target', () => {
  const opener = new Element({ menu: true, visibility: 'hidden' });
  const mobile = new Element({ visible: false });
  const { core } = closeGenesis(opener, { mobile });
  assert.equal(core.focused, true);
  assert.equal(opener.focused || mobile.focused, false);
});

test('closing Genesis does not steal focus from another open dialog', () => {
  const opener = new Element();
  const { core, mobile } = closeGenesis(opener, { otherDialog: true });
  assert.equal(opener.focused || core.focused || mobile.focused, false);
});
