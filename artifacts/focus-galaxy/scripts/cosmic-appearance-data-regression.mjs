import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const catalogUrl = new URL('../src/lib/cosmic-appearance.ts', import.meta.url);
assert.ok(existsSync(catalogUrl), 'centralized cosmic appearance catalog must exist');
const { planetColors, taskAppearances, noteAppearances, resolveAppearance } = await import(catalogUrl);
const expected = {
  task: ['lunar-moon', 'comet', 'asteroid', 'satellite', 'rocket', 'meteor', 'mini-planet', 'star-core', 'ringed-moon', 'explorer-probe'],
  note: ['crystal-shard', 'energy-orb', 'stardust-cluster', 'ice-fragment', 'prism', 'ancient-relic', 'vortex-core', 'nebula-pearl', 'solar-gem', 'quantum-cube'],
};
assert.equal(planetColors.length, 12);
assert.equal(new Set(planetColors.map(color => color.id)).size, 12);
assert.equal(new Set(planetColors.map(color => color.hue)).size, 12);
for (const color of planetColors) {
  assert.deepEqual(Object.keys(color).sort(), ['hue', 'id', 'name']);
  assert.match(color.hue, /^#[0-9a-f]{6}$/i);
  assert.ok(color.id && color.name.trim());
}
for (const [type, catalog] of [['task', taskAppearances], ['note', noteAppearances]]) {
  assert.deepEqual(catalog.map(item => item.id), expected[type]);
  for (const item of catalog) {
    assert.deepEqual(Object.keys(item).sort(), ['description', 'id', 'name']);
    assert.ok(item.name.trim() && item.description.trim());
    assert.equal(resolveAppearance(type, item.id), item.id);
  }
  for (const invalid of [undefined, null, '', 'unknown', 'toString', '__proto__', 0, 42, false, {}, [], Symbol('appearance'), ...expected[type === 'task' ? 'note' : 'task']]) {
    assert.equal(resolveAppearance(type, invalid), expected[type][0], `${type} rejects ${String(invalid)}`);
  }
}
console.log('PASS 12 planet presets, 20 named appearances, legacy defaults and category validation');

const { nextAppearance } = await import(catalogUrl);
assert.equal(typeof nextAppearance, 'function', 'creation needs a deterministic variety allocator');
for (const type of ['task', 'note']) {
  const opposite = type === 'task' ? 'note' : 'task';
  const entries = [];
  for (let index = 0; index < 120; index++) {
    const before = structuredClone(entries);
    const identity = `${type}-${index}`;
    const chosen = nextAppearance(type, entries, identity);
    assert.equal(nextAppearance(type, entries, identity), chosen, 'same input must give the same result');
    assert.deepEqual(entries, before, 'allocation must not mutate persisted entries');
    assert.ok(expected[type].includes(chosen));
    const counts = expected[type].map(id => entries.filter(entry => entry.appearance === id).length);
    assert.equal(counts[expected[type].indexOf(chosen)], Math.min(...counts), 'prefer a least-used appearance');
    assert.notEqual(chosen, entries.at(-1)?.appearance, 'avoid repeating the last same-type appearance when tied');
    entries.push({ type, appearance: chosen });
    const after = expected[type].map(id => entries.filter(entry => entry.appearance === id).length);
    assert.ok(Math.max(...after) - Math.min(...after) <= 1, 'saturate evenly across twelve full cycles');
  }
  const frozen = Object.freeze([
    Object.freeze({ type, appearance: undefined }),
    Object.freeze({ type, appearance: 'not-real' }),
    Object.freeze({ type: opposite, appearance: expected[opposite][0] }),
  ]);
  assert.notEqual(nextAppearance(type, frozen, 'legacy'), expected[type][0], 'missing and invalid appearances count as the legacy default');
  assert.equal(nextAppearance(type, [{ type: opposite, appearance: expected[opposite][0] }], 'isolated'), nextAppearance(type, [], 'isolated'), 'other categories do not affect allocation');
  const varied = new Set(Array.from({ length: 60 }, (_, i) => nextAppearance(type, [], `identity-${i}`)));
  assert.ok(varied.size > 1, 'identity must break ties rather than always choosing the first appearance');
  const saturated = expected[type].map(appearance => ({ type, appearance }));
  assert.notEqual(nextAppearance(type, [...saturated, { type: opposite }], 'last'), saturated.at(-1).appearance, 'ignore intervening other-type entries when avoiding repeats');
  const forced = expected[type].slice(1).map(appearance => ({ type, appearance }));
  assert.equal(nextAppearance(type, forced, 'only-minimum'), expected[type][0]);
  const uniqueMinimumIsLast = [...forced, ...forced, { type, appearance: expected[type][0] }];
  assert.equal(nextAppearance(type, uniqueMinimumIsLast, 'balance-first'), expected[type][0], 'least-used wins when avoiding a repeat would skew the distribution');
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('appearance allocation must not use randomness'); };
    for (const identity of ['', 'same', '星雲-λ']) {
      assert.equal(nextAppearance(type, frozen, identity), nextAppearance(type, frozen, identity));
    }
  } finally {
    Math.random = random;
  }
}
console.log('PASS deterministic least-used allocation, category isolation, legacy counts and 240 balanced creations');

const componentUrl = new URL('../src/components/celestial-object.tsx', import.meta.url);
assert.ok(existsSync(componentUrl), 'the shared decorative SVG renderer must exist');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const require = createRequire(componentUrl);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = readFileSync(componentUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(
  id => id.includes('cosmic-appearance') ? { resolveAppearance } : require(id), module, module.exports,
);
const { CelestialObject } = module.exports;
assert.equal(typeof CelestialObject, 'function');
const items = [...taskAppearances.map(item => ({ type: 'task', ...item })), ...noteAppearances.map(item => ({ type: 'note', ...item }))];
const gallery = renderToStaticMarkup(React.createElement('div', null,
  ...[...items, ...items].map((item, index) => React.createElement(CelestialObject, { key: index, type: item.type, appearance: item.id, className: 'gallery-preview' })),
));
const svgs = gallery.match(/<svg\b[\s\S]*?<\/svg>/g) ?? [];
assert.equal(svgs.length, 40);
const allIds = [...gallery.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.ok(allIds.length >= 40, 'each miniature owns gradient definitions');
assert.equal(new Set(allIds).size, allIds.length, 'useId must isolate repeated instances in the same tree');
const geometry = new Set();
for (const [index, svg] of svgs.entries()) {
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /aria-hidden="true"/);
  assert.match(svg, /focusable="false"/);
  assert.match(svg, /class="celestial-object gallery-preview"/);
  assert.ok(svg.includes(`data-appearance="${items[index % 20].id}"`));
  assert.doesNotMatch(svg, /NaN|Infinity|undefined|<filter\b|<animate\b|<animateTransform\b|<set\b|<script\b|<foreignObject\b|style="[^"]*animation/);
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const refs = [...svg.matchAll(/url\(#([^\)]+)\)/g)].map(match => match[1]);
  assert.ok(refs.length, 'use a material gradient for dimensional lighting');
  for (const ref of refs) assert.ok(ids.has(ref), `${ref} must reference a definition in the same SVG`);
  assert.ok((svg.match(/<(path|circle|ellipse|polygon|rect|line|polyline)\b/g) ?? []).length >= 4, 'authored internal geometry, not a single primitive');
  if (index < 20) geometry.add(svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/ (?:id|class|data-appearance|fill|stroke|opacity|fill-opacity|stroke-opacity)="[^"]*"/g, ''));
}
assert.equal(geometry.size, 20, 'each appearance must have distinct geometry, not just different colors');
for (const type of ['task', 'note']) for (const invalid of [undefined, 'unknown', expected[type === 'task' ? 'note' : 'task'][1]]) {
  const svg = renderToStaticMarkup(React.createElement(CelestialObject, { type, appearance: invalid }));
  assert.ok(svg.includes(`data-appearance="${expected[type][0]}"`));
  assert.match(svg, /class="celestial-object"/);
}
console.log('PASS all 20 distinct SSR miniatures, 40 isolated gradient sets, decorative semantics and invalid render fallbacks');
