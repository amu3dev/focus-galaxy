import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CDP, viewport, target, click, key, screenshot } from './cdp-harness.mjs';

// Run serially against the parent's Chrome/app; never launch either here.
const port = Number(process.env.CDP_PORT || 9228);
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const output = path.resolve(process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'focus-galaxy-orbital-regression'));
const storageKey = 'focus-galaxy-priorities-v2';
const fixture = {
  id: 'orbital-fixture', name: 'Orbital fixture', importance: 8, urgency: 7, energy: 7, hue: '#9b5be4',
  entries: [
    { id: 'task-a', type: 'task', text: 'Real task A', completed: false, createdAt: 1, updatedAt: 1 },
    { id: 'task-b', type: 'task', text: 'Completed task B', completed: true, createdAt: 2, updatedAt: 2 },
    { id: 'note-a', type: 'note', text: 'Real note A', createdAt: 3, updatedAt: 3 },
  ],
};
const other = {
  ...fixture, id: 'other-priority', name: 'Other priority', importance: 3, urgency: 2,
  entries: [{ id: 'other-note', type: 'note', text: 'Only on the other planet', createdAt: 4, updatedAt: 4 }],
};
const empty = { ...other, id: 'empty-priority', name: 'Empty priority', entries: [] };
const dense = { ...fixture, entries: [...fixture.entries, ...fixture.entries.map(entry=>({...entry,id:`${entry.id}-extra`,text:`${entry.text} extra`}))] };
const many = {
  ...fixture,
  entries: Array.from({ length: 13 }, (_, i) => ({
    id: `many-${i}`, type: i < 8 ? 'task' : 'note', text: `Real record ${i}`,
    ...(i < 8 ? { completed: i < 5 } : {}), createdAt: i + 1, updatedAt: i + 1,
  })),
};
const object = id => `.planet-orbit-object[data-entry-id="${id}"]`;
const preview = id => `.planet-orbit-preview[data-entry-id="${id}"]`;
const row = id => `.planet-content-item[data-entry-id="${id}"]`;
const pause = '[aria-label="Pause orbital motion"]';
const resume = '[aria-label="Resume orbital motion"]';
const next = '[aria-label="Next orbital objects"]';
const previous = '[aria-label="Previous orbital objects"]';
const results = [], evidence = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;

async function exists(c, selector) {
  await c.wait(`!!document.querySelector(${JSON.stringify(selector)})`);
}
async function act(c, selector) {
  await c.send('Page.bringToFront');
  await exists(c, selector);
  // Fixed Level 1 controls are already in view; scrolling their transformed
  // overflow-hidden ancestors fights the focused planet's screen-space hit area.
  if(!selector.includes('selected-panel-focus')) await c.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  if(selector.includes('selected-panel-focus')) await c.wait(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false;
    const r=e.getBoundingClientRect(), rect=[r.x,r.y,r.width,r.height], now=performance.now(), last=window.qaOrbitalStable;
    (window.qaOrbitalRects??=[]).push({rect,time:now,selector:${JSON.stringify(selector)}});
    if(!last || last.selector!==${JSON.stringify(selector)} || rect.some((v,i)=>Math.abs(v-last.rect[i])>0.25)) {
      window.qaOrbitalStable={selector:${JSON.stringify(selector)},rect,since:now}; return false;
    }
    return now-last.since>=180;
  })()`);
  // Wait for real reachability, not an arbitrary overlay/scroll-animation delay.
  await c.wait(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false;
    const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2, h=document.elementFromPoint(x,y);
    return r.width>0 && r.height>0 && x>=0 && y>=0 && x<innerWidth && y<innerHeight && (h===e || e.contains(h));
  })()`);
  if(!c.touch && selector.includes('selected-panel-focus')) {
    const before=await target(c,selector);
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:before.x,y:before.y});
    await sleep(200);
    evidence.push({kind:'entry-hover-geometry',selector,before,after:await target(c,selector)});
  }
  await c.send('Page.bringToFront');
  await click(c, selector, c.touch);
}
async function clearAttention(c) {
  await c.evaluate('document.activeElement instanceof HTMLElement && document.activeElement.blur()');
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
}
async function enter(c, id = fixture.id) {
  const selector = `.orb-screen-hit[data-testid="orb-${id}"]`;
  await exists(c, selector);
  // Native keyboard selection avoids an unrelated Level 1 sheet covering a planet.
  await c.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus({preventScroll:true})`);
  await key(c, 'Enter');
  await c.wait(`document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-pressed')==='true'`);
  const name = await c.evaluate(`document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-label').slice('Select '.length)`);
  await act(c, `.selected-panel-focus[aria-label=${JSON.stringify('Enter Focus Mode for '+name)}]`);
  await exists(c, '[data-testid="planet-focus-mode"]');
  await exists(c, '.planet-orbital-system');
  await c.wait(`getComputedStyle(document.querySelector('[data-testid="planet-focus-mode"]')).opacity==='1'`);
  await c.evaluate('document.fonts.ready');
}
async function leave(c) {
  await act(c, '.planet-focus-back');
  await c.wait(`!document.querySelector('[data-testid="planet-focus-mode"]') && !document.querySelector('.planet-orbit-object')`);
  await c.wait(`document.activeElement?.matches('.selected-panel-focus')`);
}
async function readObjects(c) {
  return c.evaluate(`Array.from(document.querySelectorAll('.planet-orbit-object'), e => ({
    id:e.dataset.entryId, type:e.dataset.kind, completed:e.dataset.completed,
    tag:e.tagName, buttonType:e.getAttribute('type'), label:e.getAttribute('aria-label') || e.innerText
  }))`);
}
async function exactObjects(c, entries) {
  const actual = await readObjects(c);
  assert.equal(actual.length, entries.length, 'No missing, duplicate, hidden-page, or invented objects');
  assert.deepEqual(actual.map(e => ({ id:e.id, type:e.type, completed:e.completed })).sort((a,b) => a.id.localeCompare(b.id)),
    entries.map(e => ({ id:e.id, type:e.type, completed:String(e.type === 'task' && e.completed) })).sort((a,b) => a.id.localeCompare(b.id)));
  assert.ok(actual.every(e => e.tag === 'BUTTON' && e.buttonType === 'button' && e.label.trim()), 'Named native buttons, not decorative fake records');
  return actual;
}
async function select(c, entry) {
  await act(c, object(entry.id));
  await exists(c, preview(entry.id));
  assert.equal(await c.evaluate(`document.querySelectorAll('.planet-orbit-preview').length`), 1, 'Exactly one selected preview');
  assert.ok(await c.evaluate(`document.querySelector(${JSON.stringify(preview(entry.id))}).innerText.includes(${JSON.stringify(entry.text)})`), 'Preview reads the selected real record');
  await c.wait(`document.querySelector('.planet-orbital-system')?.dataset.paused==='true'`);
}
async function stored(c) {
  return c.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}))`);
}
async function persisted(c, id, field, value) {
  await c.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}))?.find(p=>p.id===${JSON.stringify(fixture.id)})?.entries.find(e=>e.id===${JSON.stringify(id)})?.[${JSON.stringify(field)}]===${JSON.stringify(value)}`);
}
async function position(c) {
  return c.evaluate(`(() => {
    const root=document.querySelector('.planet-orbital-system').getBoundingClientRect();
    return Array.from(document.querySelectorAll('.planet-orbit-object'),e=>{
      const r=e.getBoundingClientRect(); return {id:e.dataset.entryId,x:r.x-root.x,y:r.y-root.y,transform:getComputedStyle(e).transform};
    });
  })()`);
}
function displacement(a, b) {
  assert.deepEqual(a.map(e=>e.id), b.map(e=>e.id), 'Motion samples keep the same records/order');
  return Math.max(...a.map((e,i)=>Math.hypot(e.x-b[i].x,e.y-b[i].y)));
}
async function motion(c, label, moving) {
  // Preserve local pointer/focus state while measuring an already-visible tab.
  if(await c.evaluate('document.hidden')) await c.send('Page.bringToFront');
  assert.equal(await c.evaluate('document.hidden'), false, 'Motion observation must use a visible page');
  // Sample rendered button geometry, not just a class or a running animation flag.
  // A bounded window permits slow animation/settling without depending on its phase.
  const deadline = Date.now() + 6000;
  let samples, distance;
  do {
    samples = [await position(c)];
    assert.ok(samples[0].length, 'Motion requires real objects');
    for (let i=0; i<8; i++) { await sleep(125); samples.push(await position(c)); }
    distance = Math.max(...samples.map(s=>displacement(samples[0],s)));
    if (moving ? distance > 1 : distance <= 0.75) break;
  } while (Date.now() < deadline);
  evidence.push({label, moving, distance, samples});
  assert.ok(moving ? distance > 1 : distance <= 0.75, `${label}: expected ${moving ? 'motion >1px' : 'stability <=0.75px'}, got ${distance}px`);
  return distance;
}
async function noOverflow(c) {
  const geometry = await c.evaluate(`({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,
    overlay:document.querySelector('[data-testid="planet-focus-mode"]').scrollWidth})`);
  assert.ok(Object.values(geometry).every(w=>w<=geometry.width+1), `No horizontal overflow: ${JSON.stringify(geometry)}`);
  return geometry;
}
async function touchLayout(c) {
  const entries=c.fixture.entries;
  await enter(c);
  await act(c, pause);
  await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
  await exactObjects(c, entries);
  const hits = [];
  for (const entry of entries) {
    await c.evaluate(`document.querySelector(${JSON.stringify(object(entry.id))}).scrollIntoView({block:'center',behavior:'instant'})`);
    const hit = await target(c, object(entry.id));
    assert.ok(hit.width>=43.99 && hit.height>=43.99, `44x44 target (0.01px compositor tolerance) for ${entry.id}: ${JSON.stringify(hit)}`);
    // Center plus inset corners must hit this button, not its decorative sibling.
    assert.ok(await c.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(object(entry.id))}),r=e.getBoundingClientRect();
      return [[.2,.2],[.8,.2],[.2,.8],[.8,.8]].every(([x,y])=>{const h=document.elementFromPoint(r.x+r.width*x,r.y+r.height*y);return h===e||e.contains(h)});
    })()`), `Unoccluded hit area for ${entry.id}`);
    hits.push({id:entry.id,...hit});
    await select(c, entry); // Uses Input.dispatchTouchEvent, never DOM .click().
    await noOverflow(c);
    await act(c, '[aria-label="Close orbital preview"]');
    await c.wait(`!document.querySelector('.planet-orbit-preview')`);
  }
  const geometry = await noOverflow(c);
  await screenshot(c, output, `touch-${geometry.width}x${await c.evaluate('innerHeight')}-orbital-targets`);
  await leave(c);
  assert.equal(await c.evaluate(`document.querySelectorAll('.orb-screen-hit').length`), 1);
  return {hits, geometry};
}

const scenarios = [
  { name:'desktop-real-records-preview-and-priority-isolation', priorities:[fixture,other], run:async c=>{
    const initial = await stored(c);
    await enter(c);
    const records = await exactObjects(c, fixture.entries);
    for (const entry of fixture.entries) await select(c, entry);
    await leave(c);
    await enter(c, other.id);
    await exactObjects(c, other.entries);
    assert.equal(await c.evaluate(`document.querySelectorAll('.planet-orbit-preview').length`), 0, 'No stale selection on another planet');
    await select(c, other.entries[0]);
    assert.deepEqual(await stored(c), initial, 'Reading/navigation must not mutate persisted records');
    return {records, isolatedPriority:other.id};
  }},
  { name:'level-one-count-preserved-through-three-round-trips', priorities:[fixture,other], run:async c=>{
    const ids = () => c.evaluate(`Array.from(document.querySelectorAll('.orb-screen-hit'),e=>e.dataset.testid).sort()`);
    const original = await ids();
    assert.deepEqual(original, ['orb-orbital-fixture','orb-other-priority']);
    for (let cycle=0; cycle<3; cycle++) {
      assert.equal(await c.evaluate(`document.querySelectorAll('.planet-orbit-object,.planet-orbit-preview,.planet-orbital-system').length`), 0, 'No Level 2 objects in Level 1');
      await enter(c);
      await exactObjects(c, fixture.entries);
      await leave(c);
      assert.deepEqual(await ids(), original, `Original planet IDs/count after round trip ${cycle+1}`);
    }
    assert.equal(await c.evaluate(`document.querySelectorAll('.planet-orbital-system').length`), 0);
    return {roundTrips:3, original};
  }},
  { name:'preview-task-persistence-and-existing-composer-edit', priorities:[fixture,other], run:async c=>{
    await enter(c);
    await select(c, fixture.entries[0]);
    await act(c, '.planet-orbit-task-toggle');
    await persisted(c, 'task-a', 'completed', true);
    await c.wait(`document.querySelector(${JSON.stringify(object('task-a'))})?.dataset.completed==='true'`);
    await c.send('Page.reload'); // Init seeding is one-shot; reload must read the saved task.
    await exists(c, '.orb-screen-hit');
    await enter(c);
    await select(c, {...fixture.entries[0],completed:true});
    assert.equal((await readObjects(c)).find(e=>e.id==='task-a').completed, 'true');
    await act(c, '.planet-orbit-task-toggle');
    await persisted(c, 'task-a', 'completed', false);
    await c.wait(`document.querySelector(${JSON.stringify(object('task-a'))})?.dataset.completed==='false'`);
    await act(c, '[aria-label="Close orbital preview"]');
    const draft = 'Unsaved composer draft survives orbital selection';
    await act(c, '.planet-content-compose textarea');
    await c.send('Input.insertText', {text:draft});
    // Start from a conflicting filter; orbital handoff must reveal All, not auto-edit.
    await act(c, '.planet-content-filter button[aria-label^="Tasks,"]');
    await select(c, fixture.entries[2]);
    await act(c, '.planet-orbit-open-editor');
    await c.wait(`document.querySelector(${JSON.stringify(row('note-a'))})?.classList.contains('is-orbit-selected')`);
    assert.equal(await c.evaluate(`document.querySelector('.planet-content-filter button[aria-label^="All,"]').getAttribute('aria-pressed')`), 'true');
    assert.equal(await c.evaluate(`document.querySelectorAll('.planet-content-edit,.planet-content-task-edit').length`), 0, 'Handoff does not auto-edit or overwrite a draft');
    assert.equal(await c.evaluate(`document.querySelector('.planet-content-compose textarea').value`), draft);
    await act(c, `${row('note-a')} button[aria-label="Edit note"]`);
    await act(c, `${row('note-a')} textarea`);
    const suffix = ' edited through existing composer';
    await key(c, 'End', 'End', 35);
    await c.send('Input.insertText', {text:suffix});
    const edited = await c.evaluate(`document.querySelector(${JSON.stringify(row('note-a')+' textarea')}).value`);
    assert.notEqual(edited, fixture.entries[2].text, 'Existing editor received input');
    await select(c, fixture.entries[2]);
    await act(c, '.planet-orbit-open-editor');
    await c.wait(`document.activeElement===document.querySelector(${JSON.stringify(row('note-a')+' textarea')})`);
    assert.equal(await c.evaluate(`document.querySelector(${JSON.stringify(row('note-a')+' textarea')}).value`),edited,'Handoff focuses the existing editor without resetting its draft');
    await select(c, fixture.entries[1]);
    await act(c, '.planet-orbit-open-editor');
    assert.equal(await c.evaluate(`document.querySelector(${JSON.stringify(row('note-a')+' textarea')}).value`), edited, 'Selecting another object preserves an in-progress edit');
    assert.equal(await c.evaluate(`document.querySelector('.planet-content-compose textarea').value`), draft);
    await act(c, `${row('note-a')} [aria-label="Save note changes"]`);
    await persisted(c, 'note-a', 'text', edited);
    await select(c, {...fixture.entries[2],text:edited});
    const saved = await stored(c);
    assert.deepEqual(saved.find(p=>p.id===other.id), other, 'Existing mutation handlers isolate priorities');
    assert.deepEqual(saved.find(p=>p.id===fixture.id).entries.map(e=>e.id).sort(), fixture.entries.map(e=>e.id).sort(), 'Editing never creates an extra record');
    return {taskCompletedThenReopened:true, edited, createDraftPreserved:true, editDraftPreserved:true};
  }},
  { name:'actual-motion-manual-hover-focus-and-selection-pause', run:async c=>{
    await enter(c);
    await clearAttention(c);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='false'`);
    await motion(c, 'initial-live-motion', true);
    await act(c, pause);
    await clearAttention(c);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
    await exists(c, resume);
    await motion(c, 'manual-pause', false);
    await act(c, resume);
    await clearAttention(c);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='false'`);
    await motion(c, 'manual-resume', true);
    const hit = await target(c, object('task-a'));
    await c.send('Input.dispatchMouseEvent', {type:'mouseMoved',x:hit.x,y:hit.y});
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
    await motion(c, 'hover-pause', false);
    await clearAttention(c);
    await c.evaluate(`document.querySelector(${JSON.stringify(object('task-a'))}).focus()`);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
    await motion(c, 'keyboard-focus-pause', false);
    const focusedHit=await target(c,object('task-a'));
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:focusedHit.x,y:focusedHit.y});
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:2,y:2});
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
    await motion(c, 'pointer-leave-keeps-keyboard-focus-paused', false);
    await key(c, 'Enter');
    await exists(c, preview('task-a'));
    await clearAttention(c);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
    await motion(c, 'selected-preview-pause-without-hover-or-focus', false);
    await act(c, '[aria-label="Close orbital preview"]');
    await clearAttention(c);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='false'`);
    await motion(c, 'selection-dismissal-resumes', true);
    const stage=await target(c,'.planet-orbital-stage');
    await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:stage.x,y:stage.y,button:'left',clickCount:1});
    await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:2,y:2,button:'left',clickCount:1});
    await clearAttention(c);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='false'`);
    await motion(c, 'release-outside-stage-resumes', true);
    const hovered=await target(c,object('task-a'));
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:hovered.x,y:hovered.y});
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
    await c.evaluate(`document.querySelector(${JSON.stringify(row('task-a')+' [aria-label="Delete task"]')}).focus({preventScroll:true})`);
    await key(c,'Enter');
    await exists(c,'.planet-content-delete-confirm');
    await c.evaluate(`document.querySelector('.planet-content-delete-confirm button:last-child').focus({preventScroll:true})`);
    await key(c,'Enter');
    await c.wait(`!document.querySelector(${JSON.stringify(object('task-a'))})`);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='false'`);
    await motion(c,'deleting-hovered-object-resumes',true);
    const {targetId:backgroundTab}=await browser.send('Target.createTarget',{url:'about:blank',browserContextId:c.context});
    try {
      await browser.send('Target.activateTarget',{targetId:backgroundTab});
      await c.wait(`document.hidden && document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
      const before=await position(c); await sleep(350);
      assert.ok(displacement(before,await position(c))<=0.75,'Hidden tab stops orbital geometry');
    } finally {
      await browser.send('Target.closeTarget',{targetId:backgroundTab});
      await c.send('Page.bringToFront');
    }
    await c.wait(`!document.hidden && document.querySelector('.planet-orbital-system').dataset.paused==='false'`);
    await motion(c,'visible-tab-resumes',true);
    await viewport(c,390,600,true);
    await c.evaluate(`document.querySelector('.planet-focus-overlay').scrollTop=document.querySelector('.planet-focus-overlay').scrollHeight`);
    await c.wait(`document.querySelector('.planet-orbital-stage').getBoundingClientRect().bottom<0 && document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
    const offscreen=await position(c); await sleep(350);
    assert.ok(displacement(offscreen,await position(c))<=0.75,'Offscreen scene stops orbital geometry');
    await c.evaluate(`document.querySelector('.planet-focus-overlay').scrollTop=0`);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='false'`);
    await motion(c,'onscreen-scene-resumes',true);
    return {geometrySamples:evidence.filter(e=>e.label).map(e=>({label:e.label,distance:e.distance}))};
  }},
  { name:'touch-390x844-real-hits-minimum-targets-and-overflow', width:390, height:844, run:touchLayout },
  { name:'responsive-320x740-real-hits-and-overflow', width:320, height:740, priorities:[dense], run:touchLayout },
  { name:'reduced-motion-browse-thirteen-records-and-empty-priority', reduced:true, priorities:[many,empty], run:async c=>{
    await enter(c);
    assert.equal(await c.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`), true);
    await clearAttention(c);
    await c.wait(`document.querySelector('.planet-orbital-system').dataset.paused==='true'`);
    await motion(c, 'reduced-motion-stationary', false);
    const seen = new Set(), pages = [];
    for (let page=0; page<many.entries.length && seen.size<many.entries.length; page++) {
      const records = await readObjects(c);
      assert.ok(records.length>0 && records.length<=6, 'Each group has one to six real records');
      const expected = many.entries.filter(e=>records.some(r=>r.id===e.id));
      await exactObjects(c, expected);
      assert.equal(expected.length, records.length, 'No invented records in paginated groups');
      for (const record of records) { assert.ok(!seen.has(record.id), `Duplicate across groups: ${record.id}`); seen.add(record.id); }
      pages.push(records.map(e=>e.id));
      if (seen.size<many.entries.length) {
        const oldIds = records.map(e=>e.id);
        await act(c, next);
        await c.wait(`(() => {const ids=Array.from(document.querySelectorAll('.planet-orbit-object'),e=>e.dataset.entryId);
          return ids.length>0 && ids.length<=6 && ids.every(id=>!${JSON.stringify(oldIds)}.includes(id));})()`);
      }
    }
    assert.deepEqual([...seen].sort(), many.entries.map(e=>e.id).sort(), 'Every one of thirteen records is browsable exactly once');
    for (let page=pages.length-2; page>=0; page--) {
      await act(c, previous);
      await c.wait(`Array.from(document.querySelectorAll('.planet-orbit-object'),e=>e.dataset.entryId).join(',')===${JSON.stringify(pages[page].join(','))}`);
    }
    const completed = many.entries.find(e=>e.type==='task' && e.completed);
    const completedPage = pages.findIndex(ids=>ids.includes(completed.id));
    assert.ok(completedPage>=0, 'A completed fixture task is browsable');
    for (let page=0; page<completedPage; page++) {
      await act(c, next);
      await c.wait(`Array.from(document.querySelectorAll('.planet-orbit-object'),e=>e.dataset.entryId).join(',')===${JSON.stringify(pages[page+1].join(','))}`);
    }
    await act(c, '.planet-content-filter button[aria-label^="Tasks,"]');
    await c.wait(`document.querySelector('.planet-content-completed-toggle')?.getAttribute('aria-expanded')==='false'`);
    await select(c, completed);
    await act(c, '.planet-orbit-open-editor');
    await c.wait(`document.querySelector(${JSON.stringify(row(completed.id))})?.classList.contains('is-orbit-selected')`);
    assert.equal(await c.evaluate(`document.querySelector('.planet-content-filter button[aria-label^="All,"]').getAttribute('aria-pressed')`), 'true');
    await target(c, `${row(completed.id)} [aria-label="Edit task"]`);
    assert.equal(await c.evaluate(`document.querySelectorAll('.planet-content-task-edit').length`), 0, 'Collapsed completed record revealed without auto-edit');
    await leave(c);
    await enter(c, empty.id);
    await exactObjects(c, []);
    assert.equal(await c.evaluate(`document.querySelectorAll('.planet-orbit-preview').length`), 0, 'Empty priority has no invented or stale preview');
    assert.ok(await c.evaluate(`!!document.querySelector('.planet-content-empty')?.innerText.trim()`), 'Empty priority retains the real composer empty state');
    assert.deepEqual(await stored(c), [many,empty], 'Browsing and empty state preserve all persisted data');
    return {pages, seen:[...seen], emptyObjects:0};
  }},
];
const selectedScenarios = scenarios.filter(s=>!process.env.QA_CASE || s.name.includes(process.env.QA_CASE));
const expected = selectedScenarios.map(s=>s.name);

async function runScenario(s) {
  let c, context, detail, failure;
  try {
    ({browserContextId:context} = await browser.send('Target.createBrowserContext', {disposeOnDetach:true}));
    const {targetId} = await browser.send('Target.createTarget', {url:'about:blank',browserContextId:context});
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const endpoint = targets.find(t=>t.id===targetId)?.webSocketDebuggerUrl;
    assert.ok(endpoint, 'Disposable CDP page exists');
    c = await CDP.connect(endpoint);
    c.context=context;
    c.fixture=(s.priorities || [fixture])[0];
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Page.bringToFront');
    c.touch = (s.width || 1440) < 1280;
    await viewport(c, s.width || 1440, s.height || 900, c.touch);
    await c.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:s.reduced?'reduce':'no-preference'}]});
    // One-shot, before app code, and scoped to this disposable context only.
    const {identifier} = await c.send('Page.addScriptToEvaluateOnNewDocument', {source:`
      if(location.origin===${JSON.stringify(new URL(appUrl).origin)}) localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(s.priorities || [fixture]))});
    `});
    await c.send('Page.navigate', {url:appUrl});
    await c.wait(`document.querySelectorAll('.orb-screen-hit').length===${(s.priorities || [fixture]).length}`);
    await c.evaluate(`(() => {
      window.qaOrbitalEvents=[];
      for(const type of ['pointerdown','pointerup','click','keydown']) document.addEventListener(type,e=>{
        window.qaOrbitalEvents.push({type:e.type,key:e.key,x:e.clientX,y:e.clientY,label:e.target.closest('button')?.getAttribute('aria-label'),className:e.target.closest('button')?.className,trusted:e.isTrusted});
      },true);
    })()`);
    await c.send('Page.removeScriptToEvaluateOnNewDocument', {identifier});
    await c.evaluate('document.fonts.ready');
    detail = await s.run(c);
  } catch (error) { failure = error; }
  finally {
    if (c) {
      if(failure) try { evidence.push({scenario:s.name,diagnostic:await c.evaluate(`({rects:window.qaOrbitalRects?.slice(-12),hidden:document.hidden,focus:document.activeElement?.outerHTML.slice(0,300),events:window.qaOrbitalEvents?.slice(-25),panel:document.querySelector('.selected-panel-focus')?.getBoundingClientRect().toJSON(),expanded:document.querySelector('.mobile-sheet-handle')?.getAttribute('aria-expanded'),level2:!!document.querySelector('.planet-focus-overlay')})`)}); } catch {}
      try { await screenshot(c, output, `${s.name}-${failure?'failure':'success'}`); }
      catch (error) { failure ||= error; }
      try { await c.evaluate('0'); assert.deepEqual(c.errors, [], 'Unexpected runtime/console errors'); }
      catch (error) { failure ||= error; }
      if (c.errors.length) evidence.push({scenario:s.name,runtimeErrors:[...c.errors]});
      c.close();
    }
    if (context) {
      try { await browser.send('Target.disposeBrowserContext', {browserContextId:context}); }
      catch (error) { failure ||= error; }
    }
  }
  results.push({name:s.name,status:failure?'FAIL':'PASS',...(failure?{error:String(failure.stack || failure)}:{detail})});
  console.log(JSON.stringify(results.at(-1)));
}

async function main() {
  await mkdir(output, {recursive:true});
  let fatal;
  try {
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    browser = await CDP.connect(version.webSocketDebuggerUrl);
    assert.equal(scenarios.length, 7, 'Exactly seven approved scenarios');
    assert.ok(expected.length, 'Requested scenarios exist');
    for (const s of selectedScenarios) await runScenario(s);
    assert.deepEqual(results.map(r=>r.name), expected, 'Every scenario ran exactly once in order');
  } catch (error) { fatal = String(error.stack || error); }
  finally { browser?.close(); }
  const summary = {
    suite:'planet-orbital',appUrl,port,output,expected,
    passed:results.filter(r=>r.status==='PASS').length,
    failed:results.filter(r=>r.status==='FAIL').length,
    missing:expected.filter(name=>!results.some(r=>r.name===name)),
    ...(fatal?{fatal}:{}),results,evidence,
  };
  process.exitCode = fatal || summary.failed || summary.missing.length ? 1 : 0;
  await writeFile(path.join(output, 'planet-orbital.json'), JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
