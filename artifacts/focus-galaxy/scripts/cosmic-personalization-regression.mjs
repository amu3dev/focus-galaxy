import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { CDP, viewport, click, key, screenshot } from './cdp-harness.mjs';

const port = Number(process.env.CDP_PORT || 9228);
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const output = path.resolve(process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'focus-galaxy-cosmic'));
const storageKey = 'focus-galaxy-priorities-v2';
const fixture = {
  id: 'cosmic', name: 'My small universe', importance: 8, urgency: 7, energy: 7, hue: '#9b5be4',
  entries: [
    { id: 'task-a', type: 'task', text: 'Build something useful', completed: false, createdAt: 1, updatedAt: 1 },
    { id: 'task-b', type: 'task', text: 'A finished milestone', completed: true, createdAt: 2, updatedAt: 2 },
    { id: 'note-a', type: 'note', text: 'Leave space for curiosity.', createdAt: 3, updatedAt: 3 },
    { id: 'note-unknown', type: 'note', text: 'A future design must stay readable.', appearance: 'future-unknown', createdAt: 4, updatedAt: 4 },
  ],
};
const studio = '[data-testid="planet-color-studio"]';
const library = '[data-testid="celestial-library"]';
const colorTrigger = '[data-testid="planet-color-trigger"]';
const appearanceTrigger = '[data-testid="appearance-trigger"]';
const object = id => `.planet-orbit-object[data-entry-id="${id}"]`;
const results = [];
const contexts = [];
const clients = [];
let browser;

async function act(c, selector) {
  await c.send('Page.bringToFront');
  await c.wait(`!!document.querySelector(${JSON.stringify(selector)})`);
  if (!selector.includes('selected-panel-focus')) await c.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  await c.wait(`(() => {const e=document.querySelector(${JSON.stringify(selector)}),r=e?.getBoundingClientRect();if(!r)return false;const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&(h===e||e.contains(h));})()`);
  await click(c, selector, c.touch);
}
async function button(c, parent, text) {
  const selector = await c.evaluate(`(() => {const b=[...document.querySelectorAll(${JSON.stringify(parent+' button')})].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button: '+${JSON.stringify(text)});b.dataset.qaAction='true';return '[data-qa-action="true"]';})()`);
  await act(c, selector);
  await c.evaluate(`document.querySelector('[data-qa-action]')?.removeAttribute('data-qa-action')`);
}
async function open(priorities = [fixture], width = 1440, reduced = true) {
  const { browserContextId } = await browser.send('Target.createBrowserContext');
  contexts.push(browserContextId);
  const { targetId } = await browser.send('Target.createTarget', { url:'about:blank', browserContextId });
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const c = await CDP.connect(tabs.find(t=>t.id===targetId).webSocketDebuggerUrl);
  clients.push(c);
  c.browserContextId = browserContextId;
  c.touch = width===320;
  await c.send('Runtime.enable');
  await c.send('Page.enable');
  await viewport(c,width,width===320?740:900,c.touch);
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`if(!sessionStorage.qaSeed){localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(priorities))});sessionStorage.qaSeed='1'}`});
  await c.send('Page.navigate',{url:appUrl});
  await c.send('Page.bringToFront');
  await c.wait(`!!document.querySelector('.core-container')`);
  return c;
}
async function selectPlanet(c) {
  await c.wait(`!!document.querySelector('[data-testid="orb-cosmic"]')`);
  await c.evaluate(`document.querySelector('[data-testid="orb-cosmic"]').focus({preventScroll:true})`);
  await key(c,'Enter');
  await c.wait(`!!document.querySelector('.selected-panel-focus')`);
}
async function enter(c) {
  await selectPlanet(c);
  await act(c,'.selected-panel-focus');
  await c.wait(`getComputedStyle(document.querySelector('.planet-focus-overlay')).opacity==='1'`);
}
async function persisted(c, expression) {
  await c.wait(`(() => {const p=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}))[0];return ${expression};})()`);
}
async function stored(c) { return c.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}))`); }
async function layout(c, selector) {
  await c.wait(`!!document.querySelector(${JSON.stringify(selector)})`);
  const measure = await c.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:innerHeight,internal:e.scrollWidth<=e.clientWidth+1};})()`);
  assert.ok(measure.scroll<=measure.width && measure.internal && measure.left>=0 && measure.right<=measure.width+1 && measure.top>=0 && measure.bottom<=measure.height+1,JSON.stringify(measure));
  return measure;
}
async function check(name, run) {
  try {const detail=await run();results.push({name,status:'PASS',detail});console.log(`PASS ${name}`);}
  catch(error) {results.push({name,status:'FAIL',error:error.stack});console.error(`FAIL ${name}: ${error.stack}`);if(clients.length)await screenshot(clients.at(-1),output,`failure-${name}`).catch(()=>{});}
}

try {
  await mkdir(output,{recursive:true});
  const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  browser=await CDP.connect(version.webSocketDebuggerUrl);
  await check('planet-color-cancel-save-reload-and-signals',async()=>{
    const c=await open();
    await selectPlanet(c);
    assert.equal(await c.evaluate(`document.querySelectorAll(${JSON.stringify(colorTrigger)}).length`),1,'Planet editor exposes Color Studio');
    const before=await stored(c);
    const score=await c.evaluate(`document.querySelector('.selected-panel-score').textContent`);
    await act(c,colorTrigger);
    assert.equal(await c.evaluate(`document.querySelectorAll(${JSON.stringify(studio+' [data-color]')}).length`),12);
    await act(c,studio+' [data-color="aurora"]');
    assert.deepEqual(await stored(c),before,'Color draft does not persist before Save');
    await button(c,studio,'Cancel');
    await c.wait(`document.activeElement?.matches(${JSON.stringify(colorTrigger)})`);
    assert.deepEqual(await stored(c),before,'Cancel preserves galaxy');
    await act(c,colorTrigger);
    await c.wait(`!!document.querySelector(${JSON.stringify(studio)})`);
    await c.evaluate(`document.querySelector('${studio} [data-color="aurora"]').focus()`);
    await key(c,'Enter');
    await c.wait(`document.querySelector('${studio} [data-color="aurora"]').getAttribute('aria-pressed')==='true'`);
    await screenshot(c,output,'desktop-color-studio');
    await button(c,studio,'Save color');
    await persisted(c,`p.hue!==${JSON.stringify(fixture.hue)}`);
    const changed=await stored(c);
    assert.deepEqual({...changed[0],hue:fixture.hue},before[0],'Only visual hue changed');
    assert.equal(await c.evaluate(`document.querySelector('.selected-panel-score').textContent`),score);
    assert.equal(await c.evaluate(`document.querySelector('.selected-panel-card').style.borderColor`),await c.evaluate(`(() => {const e=document.createElement('i');e.style.borderColor=${JSON.stringify(changed[0].hue+'50')};return e.style.borderColor;})()`));
    await act(c,'.selected-panel-focus');
    await c.wait(`!!document.querySelector('.planet-focus-overlay')`);
    assert.equal(await c.evaluate(`document.querySelector('.planet-focus-overlay').style.getPropertyValue('--planet-focus-hue')`),changed[0].hue);
    assert.equal(await c.evaluate(`document.querySelector('.planet-focus-orb-art').style.getPropertyValue('--orb-color')`),changed[0].hue);
    await c.send('Page.reload');
    await enter(c);
    assert.equal((await stored(c))[0].hue,changed[0].hue);
    return {hue:changed[0].hue,score};
  });
  await check('task-and-note-library-stable-selection-completion-and-legacy',async()=>{
    const c=await open();
    await enter(c);
    assert.equal(await c.evaluate(`document.querySelector('${object('task-a')} svg').dataset.appearance`),'lunar-moon');
    assert.equal(await c.evaluate(`document.querySelector('${object('note-unknown')} svg').dataset.appearance`),'crystal-shard');
    assert.deepEqual((await stored(c))[0],fixture,'Legacy and unknown metadata are not rewritten');
    for(const [id,variant] of [['task-a','rocket'],['note-a','quantum-cube']]) {
      await act(c,object(id));
      await act(c,appearanceTrigger);
      assert.equal(await c.evaluate(`document.querySelectorAll(${JSON.stringify(library+' [data-appearance-option]')}).length`),10);
      assert.equal(await c.evaluate(`new Set([...document.querySelectorAll(${JSON.stringify(library+' [data-appearance-option] .celestial-object')})].map(e=>e.dataset.appearance)).size`),10,'Every gallery design renders its own SVG');
      await act(c,library+` [data-appearance-option="${variant}"]`);
      assert.equal((await stored(c))[0].entries.find(e=>e.id===id).appearance,undefined,'Appearance stays draft');
      await screenshot(c,output,id==='task-a'?'desktop-task-library':'desktop-note-library');
      await button(c,library,'Save appearance');
      await persisted(c,`p.entries.find(e=>e.id===${JSON.stringify(id)}).appearance===${JSON.stringify(variant)}`);
      assert.equal(await c.evaluate(`document.querySelector('${object(id)} svg').dataset.appearance`),variant);
      await c.wait(`document.activeElement?.matches(${JSON.stringify(appearanceTrigger)})`);
    }
    await act(c,object('task-a'));
    await act(c,'.planet-orbit-task-toggle');
    await persisted(c,`p.entries.find(e=>e.id==='task-a').completed===true`);
    assert.ok(await c.evaluate(`!!document.querySelector('${object('task-a')} .planet-orbit-complete')`));
    await c.evaluate(`document.querySelector('.planet-focus-overlay').scrollTop=0`);
    await screenshot(c,output,'desktop-level-two');
    await c.send('Page.reload');
    await enter(c);
    for(const [id,variant] of [['task-a','rocket'],['note-a','quantum-cube']]) assert.equal(await c.evaluate(`document.querySelector('${object(id)} svg').dataset.appearance`),variant);
    return {task:'rocket',note:'quantum-cube',completed:true};
  });
  await check('keyboard-escape-focus-trap-and-mobile-touch-320',async()=>{
    const c=await open([fixture],320);
    await enter(c);
    const focusColorTrigger = '.planet-focus-overlay '+colorTrigger;
    await act(c,focusColorTrigger);
    await layout(c,studio);
    assert.ok(await c.evaluate(`document.querySelector(${JSON.stringify(studio)}).contains(document.activeElement)`));
    for(let i=0;i<18;i++) {
      await key(c,'Tab');
      assert.ok(await c.evaluate(`document.querySelector(${JSON.stringify(studio)}).contains(document.activeElement)`),'Tab stays in the inner dialog');
    }
    const sizes=await c.evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(studio+' [data-color]')}),e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})`);
    assert.ok(sizes.every(([w,h])=>w>=44&&h>=44),JSON.stringify(sizes));
    await act(c,studio+' [data-color="gold"]');
    await screenshot(c,output,'mobile-320-color-studio');
    await key(c,'Escape');
    await c.wait(`!document.querySelector(${JSON.stringify(studio)}) && document.activeElement?.matches(${JSON.stringify(focusColorTrigger)})`);
    assert.ok(await c.evaluate(`!!document.querySelector('.planet-focus-overlay')`),'Escape dismisses inner dialog only');
    assert.equal((await stored(c))[0].hue,fixture.hue);
    await act(c,object('note-a'));
    await act(c,appearanceTrigger);
    await layout(c,library);
    await act(c,library+' [data-appearance-option="prism"]');
    await c.evaluate(`document.querySelector('.cosmic-dialog-body').scrollTop=0`);
    await screenshot(c,output,'mobile-320-note-library');
    await button(c,library,'Save appearance');
    await persisted(c,`p.entries.find(e=>e.id==='note-a').appearance==='prism'`);
    assert.equal(await c.evaluate(`document.querySelector('.planet-orbital-system').dataset.paused`),'true');
    return {width:320,touch:true,reducedMotion:true,swatchSizes:sizes};
  });
  await check('new-item-variety-and-cosmetic-cross-tab-conflict',async()=>{
    const c=await open();
    await enter(c);
    for(let i=0;i<3;i++) {
      await act(c,'.planet-content-compose textarea');
      await c.send('Input.insertText',{text:`New thought ${i}`});
      await act(c,'.planet-content-compose button[type="submit"]');
      await persisted(c,`p.entries.length===${fixture.entries.length+i+1}`);
    }
    const added=(await stored(c))[0].entries.slice(fixture.entries.length);
    assert.equal(new Set(added.map(e=>e.appearance)).size,3,'New notes prefer variety in this planet');
    const {targetId}=await browser.send('Target.createTarget',{url:'about:blank',browserContextId:c.browserContextId});
    const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const writer=await CDP.connect(tabs.find(t=>t.id===targetId).webSocketDebuggerUrl);
    clients.push(writer);
    await writer.send('Runtime.enable');await writer.send('Page.enable');
    await viewport(writer,1440,900,false);
    await writer.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await writer.send('Page.navigate',{url:appUrl});
    await selectPlanet(writer);
    await act(c,object('note-a'));
    await act(c,appearanceTrigger);
    await act(c,library+' [data-appearance-option="solar-gem"]');
    await act(writer,colorTrigger);
    await act(writer,studio+' [data-color="gold"]');
    await button(writer,studio,'Save color');
    await persisted(writer,`p.hue!==${JSON.stringify(fixture.hue)}`);
    const newest=await stored(writer);
    await button(c,library,'Save appearance');
    await c.wait(`!!document.querySelector('[data-testid="priority-conflict-warning"]')`);
    assert.deepEqual(await stored(c),newest,'Stale cosmetic save never overwrites the newer color or content');
    return {automaticDesigns:added.map(e=>e.appearance),conflictProtected:true};
  });
  await check('nested-escape-preserves-pending-content-deletion',async()=>{
    const c=await open();
    await enter(c);
    await act(c,'.planet-content-item[data-entry-id="note-a"] [aria-label="Delete note"]');
    await c.wait(`!!document.querySelector('.planet-content-delete-confirm')`);
    await act(c,'.planet-focus-overlay '+colorTrigger);
    await c.wait(`!!document.querySelector(${JSON.stringify(studio)})`);
    await key(c,'Escape');
    await c.wait(`!document.querySelector(${JSON.stringify(studio)})`);
    assert.ok(await c.evaluate(`!!document.querySelector('.planet-content-delete-confirm')`),'Inner Escape must not cancel the underlying deletion confirmation');
    await button(c,'.planet-content-delete-confirm','Cancel deletion');
    assert.deepEqual((await stored(c))[0],fixture,'Nested cancellation preserves all records');
    return {innermostEscape:true,pendingDeletionPreserved:true};
  });
  await check('genesis-full-galaxy-stable-customized-objects',async()=>{
    const c=await open([]);
    await act(c,'.core-container');
    await act(c,'[data-template="full-galaxy"]');
    await act(c,'.genesis-apply');
    await c.wait(`!document.querySelector('[data-testid="galaxy-genesis"]') && document.querySelectorAll('.orb-screen-hit').length===6`);
    const galaxy=await stored(c);
    assert.equal(galaxy.length,6);
    const entries=galaxy.flatMap(p=>p.entries);
    assert.ok(entries.every(e=>typeof e.appearance==='string'));
    assert.ok(new Set(entries.filter(e=>e.type==='task').map(e=>e.appearance)).size>=6);
    assert.ok(new Set(entries.filter(e=>e.type==='note').map(e=>e.appearance)).size>=4);
    await c.wait(`!document.querySelector('.genesis-solar-wave')`);
    await screenshot(c,output,'desktop-full-galaxy');
    await c.send('Page.reload');
    await c.wait(`document.querySelectorAll('.orb-screen-hit').length===6`);
    assert.deepEqual(await stored(c),galaxy);
    return {priorities:galaxy.length,variants:[...new Set(entries.map(e=>e.appearance))]};
  });
  await check('no-runtime-errors',async()=>{
    const errors=clients.flatMap(c=>c.errors);
    assert.deepEqual(errors,[]);
    return {pages:clients.length};
  });
} finally {
  await writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
  clients.forEach(c=>c.close());
  for(const browserContextId of contexts) await browser?.send('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});
  browser?.close();
}
const expected=7;
assert.equal(results.length,expected,'Every planned scenario must run');
const failures=results.filter(r=>r.status==='FAIL');
console.log(`${results.length-failures.length}/${expected} cosmic scenarios passed; evidence: ${output}`);
if(failures.length) process.exitCode=1;
