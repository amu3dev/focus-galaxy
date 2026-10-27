import assert from 'node:assert/strict';
import * as utils from '../src/lib/utils.ts';

assert.equal(typeof utils.createId, 'function', 'creation needs an HTTP-compatible ID generator');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const descriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
try {
  for (const native of [true, false]) {
    if (!native) Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined });
    const ids = Array.from({ length: 1000 }, () => utils.createId());
    ids.forEach(id => assert.match(id, uuid));
    assert.equal(new Set(ids).size, ids.length, 'IDs must remain distinct during rapid creation');
    console.log(`PASS UUID generation ${native ? 'with' : 'without'} crypto.randomUUID`);
  }
} finally {
  if (descriptor) Object.defineProperty(globalThis.crypto, 'randomUUID', descriptor);
  else delete globalThis.crypto.randomUUID;
}
