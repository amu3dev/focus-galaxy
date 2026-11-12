import assert from 'node:assert/strict';
import { galaxyTemplates, instantiateTemplate, templateCounts } from '../src/lib/galaxy-templates.ts';

const expected = [
  ['blank', 'Blank Universe', [0, 0, 0], []],
  ['first-orbit', 'First Orbit', [3, 4, 2], ['Plan My Week', 'Learn Something New', 'Organize My Space']],
  ['full-galaxy', 'Full Galaxy', [6, 12, 6]],
  ['project-launch', 'Project Launch', [4, 9, 4], ['Discovery & Planning', 'Design & Preparation', 'Build & Execution', 'Testing & Launch']],
  ['balanced-week', 'Balanced Week', [5, 8, 3], ['Work', 'Learning', 'Wellbeing', 'Personal Projects', 'Life Admin']],
];
const palette = new Set(['#f04e76', '#9b5be4', '#3aa2f7', '#f1883b', '#466bf0', '#85d852', '#f0c04e', '#4ef0c0']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ids = new Set();
const references = new Set();
const snapshot = structuredClone(galaxyTemplates);

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}

function freshId(id) {
  assert.match(id, uuid);
  assert.ok(!ids.has(id), `duplicate ID: ${id}`);
  ids.add(id);
}

function freshReference(value) {
  assert.ok(!references.has(value), 'instantiations must never share mutable references');
  references.add(value);
}

freeze(galaxyTemplates);
assert.deepEqual(galaxyTemplates.map(template => template.id), expected.map(([id]) => id));
for (const [index, template] of galaxyTemplates.entries()) {
  const [id, name, [priorities, tasks, notes], names] = expected[index];
  assert.equal(template.name, name);
  for (const field of ['purpose', 'description']) {
    assert.equal(typeof template[field], 'string');
    assert.ok(template[field].trim().length > 0);
  }
  assert.ok(palette.has(template.accent));
  assert.deepEqual(templateCounts(template), { priorities, tasks, notes });
  if (names) assert.deepEqual(template.priorities.map(priority => priority.name), names);
  assert.equal(new Set(template.priorities.map(priority => priority.name)).size, priorities);
  for (const priority of template.priorities) {
    assert.ok(Object.keys(priority).every(key => ['name', 'importance', 'urgency', 'energy', 'hue', 'entries', 'completed', 'notes'].includes(key)));
    for (const entry of priority.entries ?? []) {
      assert.ok(Object.keys(entry).every(key => ['type', 'text', ...(entry.type === 'task' ? ['completed'] : [])].includes(key)));
      assert.ok(entry.completed === undefined || typeof entry.completed === 'boolean');
    }
  }

  for (let run = 0; run < 10; run += 1) {
    const before = Date.now();
    const result = instantiateTemplate(template);
    const after = Date.now();
    const stable = structuredClone(result);
    freshReference(result);
    assert.equal(result.length, priorities);
    const entries = result.flatMap(priority => priority.entries ?? []);
    assert.equal(entries.filter(entry => entry.type === 'task').length, tasks);
    assert.equal(entries.filter(entry => entry.type === 'note').length, notes);
    assert.ok(entries.every(entry => typeof entry.appearance === 'string'), 'new template entries have saved cosmic identities');
    const again = instantiateTemplate(template).flatMap(priority => priority.entries ?? []);
    assert.deepEqual(again.map(entry => entry.appearance), entries.map(entry => entry.appearance), 'template identities are stable across creation runs');
    for (const [priorityIndex, priority] of result.entries()) {
      const seed = template.priorities[priorityIndex];
      freshReference(priority);
      freshId(priority.id);
      for (const field of ['name', 'importance', 'urgency', 'energy', 'hue']) assert.equal(priority[field], seed[field]);
      assert.ok(priority.name.trim().length > 0);
      assert.ok(!priority.completed, 'template priorities remain visible and editable');
      assert.ok(palette.has(priority.hue));
      for (const metric of ['importance', 'urgency', 'energy']) {
        assert.ok(Number.isFinite(priority[metric]) && priority[metric] >= 1 && priority[metric] <= 10);
      }
      assert.ok(Array.isArray(priority.entries));
      freshReference(priority.entries);
      assert.notEqual(priority.entries, seed.entries);
      assert.equal(priority.entries.length, seed.entries?.length ?? 0);
      for (const [entryIndex, entry] of priority.entries.entries()) {
        freshReference(entry);
        freshId(entry.id);
        assert.notEqual(entry, seed.entries[entryIndex]);
        assert.ok(['note', 'task'].includes(entry.type));
        assert.equal(entry.type, seed.entries[entryIndex].type);
        assert.equal(entry.text, seed.entries[entryIndex].text);
        assert.ok(typeof entry.text === 'string' && entry.text.trim().length > 0);
        for (const field of ['createdAt', 'updatedAt']) {
          assert.ok(Number.isSafeInteger(entry[field]) && entry[field] >= before && entry[field] <= after);
          assert.ok(Number.isFinite(new Date(entry[field]).getTime()));
        }
        assert.ok(entry.updatedAt >= entry.createdAt);
        if (entry.type === 'task') assert.equal(entry.completed, seed.entries[entryIndex].completed ?? false);
        else assert.ok(!Object.hasOwn(entry, 'completed'));
      }
    }
    assert.deepEqual(result, stable, 'IDs and timestamps are stable after creation');
    if (id === 'full-galaxy') {
      assert.ok(new Set(entries.filter(entry => entry.type === 'task').map(entry => entry.appearance)).size >= 6);
      assert.ok(new Set(entries.filter(entry => entry.type === 'note').map(entry => entry.appearance)).size >= 4);
      assert.ok(result.every(priority => priority.entries.length > 0));
      for (const metric of ['importance', 'urgency', 'energy']) assert.ok(new Set(result.map(priority => priority[metric])).size >= 3);
      const taskEntries = entries.filter(entry => entry.type === 'task');
      assert.ok(taskEntries.some(entry => entry.completed));
      assert.ok(taskEntries.some(entry => !entry.completed));
    }
    // Mutating every returned layer must not affect later runs or the catalog.
    for (const priority of result) {
      priority.name = 'Edited priority';
      priority.importance = 1;
      priority.completed = true;
      for (const entry of priority.entries) {
        entry.text = 'Edited entry';
        if (entry.type === 'task') entry.completed = !entry.completed;
      }
      priority.entries.push({ id: 'local-edit', type: 'note', text: 'New note', createdAt: after, updatedAt: after });
    }
    result.push({ id: 'local-priority', name: 'New priority', importance: 5, urgency: 5, energy: 5, hue: '#9b5be4' });
    assert.deepEqual(galaxyTemplates, snapshot, 'the catalog must not be mutated');
  }
  console.log(`PASS ${id}: ${priorities} priorities / ${tasks} tasks / ${notes} notes`);
}

const custom = {
  ...galaxyTemplates[0],
  priorities: [{ name: 'Optional fields', importance: 5, urgency: 5, energy: 5, hue: '#9b5be4', completed: true, notes: 'Legacy note' }],
};
freeze(custom);
const [optional] = instantiateTemplate(custom);
assert.equal(optional.completed, true);
assert.equal(optional.notes, 'Legacy note');
assert.deepEqual(optional.entries, []);
assert.deepEqual(templateCounts(custom), { priorities: 1, tasks: 0, notes: 0 });
console.log('PASS fresh unique IDs, valid timestamps, editable deep isolation, optional fields, and immutable seeds');
