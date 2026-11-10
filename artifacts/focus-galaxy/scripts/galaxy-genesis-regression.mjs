import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { CDP, viewport, click, key, screenshot } from './cdp-harness.mjs';

// Reuse an approved browser. Every case has disposable storage; never touch personal tabs.
const port = Number(process.env.CDP_PORT || 9228);
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const output = path.resolve(process.env.QA_OUTPUT_DIR || path.join(tmpdir(), 'focus-galaxy-genesis'));
const storageKey = 'focus-galaxy-priorities-v2';
const backupKey = `${storageKey}.genesis-backup`;
const original = [{ id: 'kept-planet', name: 'Keep my work', importance: 8, urgency: 5, energy: 4, hue: '#3aa2f7', entries: [
  { id: 'kept-task', type: 'task', text: 'Keep this task', completed: false, createdAt: 1, updatedAt: 1 },
  { id: 'kept-note', type: 'note', text: 'Keep this note', createdAt: 1, updatedAt: 1 },
] }];
const cases = [];
const EXPECTED = ['blank initialization', 'saved empty and existing data', 'five safe previews and applications', 'confirmation and recovery', 'backup and write failures', 'stale queued template', 'unavailable coordination', 'keyboard and 320px touch', 'reduced motion'];
let browser, tabs = [];
const read = c => c.evaluate(`JSON.parse(localStorage.getItem('${storageKey}'))`);
const raw = c => c.evaluate(`localStorage.getItem('${storageKey}')`);
const exists = (c, s) => c.wait(`!!document.querySelector(${JSON.stringify(s)})`);
async function act(c, selector, touch = false) {
  await c.send('Page.bringToFront');
  await exists(c, selector);
  if (!selector.includes('core-container') && !selector.includes('orb-screen-hit') && !selector.includes('selected-panel-focus'))
    await c.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  await c.wait(`(() => { const e=document.querySelector(${JSON.stringify(selector)}),r=e?.getBoundingClientRect(); if(!r?.width)return false; const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return (e===h||e.contains(h)) && e.getAnimations().every(a=>a.playState!=='running') })()`);
  await click(c, selector, touch);
}
async function tab(ctx, { seed, width = 1440, height = 1000, reduced = false, ignoreEvents = false, noLocks = false } = {}) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: ctx });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const c = await CDP.connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl); tabs.push(c);
  await c.send('Page.enable'); await c.send('Runtime.enable'); await viewport(c,width,height);
  await c.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.qaBoot=crypto.randomUUID();
    if (!sessionStorage.qaSeeded) { ${seed === undefined ? '' : `localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(seed))});`} sessionStorage.qaSeeded='yes'; }
    window.qaBlockBackup=false;window.qaBlockWrite=false;window.qaBlockRollback=false;window.qaWrites=[];
    const set=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){
      if(k==='${backupKey}'&&window.qaBlockBackup)throw new DOMException('Test quota','QuotaExceededError');
      if(k==='${storageKey}'&&window.qaBlockWrite){if(window.qaBlockRollback)window.qaBlockBackup=true;throw new DOMException('Test quota','QuotaExceededError');}
      set.call(this,k,v);window.qaWrites.push({key:k,value:v});
    };
    ${ignoreEvents ? `for(const n of ['storage','focus','pageshow'])window.addEventListener(n,e=>e.stopImmediatePropagation(),true);document.addEventListener('visibilitychange',e=>e.stopImmediatePropagation(),true);` : ''}
    ${noLocks ? `Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});` : ''}
  `});
  await c.send('Page.navigate',{url:appUrl}); await c.send('Page.bringToFront');
  await exists(c,'.core-container');
  return c;
}
async function reload(c) {
  const boot=await c.evaluate('window.qaBoot');
  await c.send('Page.reload');
  await c.wait(`window.qaBoot!==${JSON.stringify(boot)} && !!document.querySelector('.core-container')`);
}
async function settledShot(c,name) {
  await c.evaluate('document.fonts.ready');
  await c.wait(`!document.querySelector('.genesis-forming') && Array.from(document.querySelectorAll('.genesis-portal,.genesis-preview')).every(e=>e.getAnimations().every(a=>a.playState!=='running'))`);
  await screenshot(c,output,name);
}
async function open(c,touch=false) { await act(c,'.core-container',touch); await exists(c,'[data-testid="galaxy-genesis"]'); }
async function close(c) { await act(c,'[aria-label="Close Galaxy Genesis"]'); await c.wait(`!document.querySelector('[data-testid="galaxy-genesis"]')`); }
async function pick(c,id,touch=false) { await act(c,`[data-template="${id}"]`,touch); await c.wait(`document.querySelector('[data-template="${id}"]')?.getAttribute('aria-pressed')==='true'`); }
async function apply(c, populated=false) {
  await c.wait(`!document.querySelector('.genesis-apply')?.disabled`); await act(c,'.genesis-apply');
  if(populated) { await exists(c,'[role="alertdialog"]'); await act(c,'.genesis-confirm-apply'); }
  await c.wait(`!document.querySelector('[data-testid="galaxy-genesis"]')`);
}
async function test(name,fn) {
  if (process.env.QA_CASE && name !== process.env.QA_CASE) return;
  const {browserContextId:ctx}=await browser.send('Target.createBrowserContext',{disposeOnDetach:true}); tabs=[];
  try { await fn(ctx); assert.deepEqual(tabs.flatMap(c=>c.errors),[],'No browser runtime errors'); cases.push({name,status:'PASS'}); }
  catch(e) { cases.push({name,status:'FAIL',error:String(e.stack||e)}); for(let i=0;i<tabs.length;i++)await screenshot(tabs[i],output,`failure-${cases.length}-${i}`).catch(()=>{}); }
  finally {for(const c of tabs)c.close();await browser.send('Target.disposeBrowserContext',{browserContextId:ctx});}
  console.log(JSON.stringify(cases.at(-1)));
}
async function main(){
  await mkdir(output,{recursive:true});
  const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();browser=await CDP.connect(version.webSocketDebuggerUrl);
  await test(EXPECTED[0],async ctx=>{
    const c=await tab(ctx); await c.wait(`localStorage.getItem('${storageKey}')!==null`);
    assert.deepEqual(await read(c),[],'A genuinely new user has no sample data');
    await exists(c,'.genesis-empty');await settledShot(c,'blank-desktop');
    await open(c);await close(c);await reload(c);assert.deepEqual(await read(c),[]);
    await act(c,'.genesis-empty-add');await exists(c,'input.name-input');
  });
  await test(EXPECTED[1],async ctx=>{
    const c=await tab(ctx,{seed:[]});await reload(c);assert.deepEqual(await read(c),[]);
    const otherCtx=await browser.send('Target.createBrowserContext',{disposeOnDetach:true});
    try{const d=await tab(otherCtx.browserContextId,{seed:original});await open(d);await pick(d,'full-galaxy');await close(d);await reload(d);assert.deepEqual(await read(d),original);}
    finally{await browser.send('Target.disposeBrowserContext',otherCtx);}
  });
  await test(EXPECTED[2],async ctx=>{
    const c=await tab(ctx,{seed:[],reduced:true});
    const configs=[['first-orbit',3,4,2],['full-galaxy',6,12,6],['project-launch',4,9,4],['balanced-week',5,8,3],['blank',0,0,0]];
    const allIds=new Set();
    for(const [id,np,nt,nn]of configs){
      const before=await raw(c);await open(c);
      for(const [preview]of configs){await pick(c,preview);assert.equal(await raw(c),before,'Preview never writes');}
      await pick(c,id);await apply(c,JSON.parse(before).length>0);
      const data=await read(c),entries=data.flatMap(p=>p.entries??[]);
      assert.equal(data.length,np);assert.equal(entries.filter(e=>e.type==='task').length,nt);assert.equal(entries.filter(e=>e.type==='note').length,nn);
      await c.wait(`document.querySelectorAll('.orb-screen-hit').length===${np} && Array.from(document.querySelectorAll('.orb-screen-hit')).every(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e})`);
      assert.ok(await c.evaluate(`Array.from(document.querySelectorAll('.orb-screen-visual .orb-label')).every(e=>{const r=e.getBoundingClientRect();return r.x>=0 && r.right<=innerWidth && r.y>=0 && r.bottom<=innerHeight})`),'All initial planet labels fit the viewport');
      for(const item of [...data,...entries]){assert.ok(!allIds.has(item.id),'Fresh instance IDs');allIds.add(item.id);}
      await reload(c);assert.deepEqual(await read(c),data,'Refresh does not recreate or duplicate entries');
      await c.wait(`document.querySelectorAll('.orb-screen-hit').length===${np}`);
      for(const p of data){
        await c.evaluate(`document.querySelector('[data-testid="orb-${p.id}"]').focus({preventScroll:true})`);await key(c,'Enter');
        await act(c,'.selected-panel-focus');await exists(c,'.planet-orbital-system');
        const actual=await c.evaluate(`Array.from(document.querySelectorAll('.planet-orbit-object'),e=>e.dataset.entryId).sort()`);
        assert.deepEqual(actual,p.entries.map(e=>e.id).sort(),'Level 2 uses only this planet’s entries');
        if(id==='first-orbit'&&p===data[0]){
          const task=p.entries.find(e=>e.type==='task');
          await act(c,`.planet-orbit-object[data-entry-id="${task.id}"]`);
          await act(c,'.planet-orbit-task-toggle');
          await c.wait(`JSON.parse(localStorage.getItem('${storageKey}'))[0].entries.find(e=>e.id==='${task.id}').completed===${!task.completed}`);
          const note=p.entries.find(e=>e.type==='note');
          await act(c,'.planet-orbit-open-editor');
          await act(c,`.planet-content-item[data-entry-id="${note.id}"] [aria-label="Edit note"]`);
          await c.evaluate(`(()=>{const e=document.querySelector('textarea[aria-label="Edit note"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'A note edited after creation');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
          await act(c,'[aria-label="Save note changes"]');
          await c.wait(`JSON.parse(localStorage.getItem('${storageKey}'))[0].entries.find(e=>e.id==='${note.id}').text==='A note edited after creation'`);
        }
        await act(c,'.planet-focus-back');await c.wait(`!document.querySelector('.planet-focus-overlay')`);
        await c.wait(`document.activeElement?.matches('.selected-panel-focus')`);
      }
      if(id==='first-orbit'){
        const edited=await read(c);await reload(c);assert.deepEqual(await read(c),edited,'Completion and edited template note persist');
      }
    }
  });
  await test(EXPECTED[3],async ctx=>{
    const c=await tab(ctx,{seed:original,reduced:true});await open(c);await pick(c,'first-orbit');
    const before=await raw(c);await act(c,'.genesis-apply');await exists(c,'[role="alertdialog"]');await act(c,'.genesis-confirm-cancel');
    assert.equal(await raw(c),before);await apply(c,true);assert.equal(await c.evaluate(`localStorage.getItem('${backupKey}')`),before);
    await reload(c);await open(c);await act(c,'.genesis-restore');await exists(c,'[role="alertdialog"]');await act(c,'.genesis-confirm-apply');
    await c.wait(`!document.querySelector('[data-testid="galaxy-genesis"]')`);assert.deepEqual(await read(c),original,'Recoverable backup restores full content');
    await open(c);await pick(c,'first-orbit');await apply(c,true);const firstIds=(await read(c)).map(p=>p.id);
    await open(c);await pick(c,'first-orbit');await apply(c,true);const next=await read(c);assert.equal(next.length,3);assert.ok(next.every(p=>!firstIds.includes(p.id)));
  });
  await test(EXPECTED[4],async ctx=>{
    const c=await tab(ctx,{seed:original,reduced:true});await open(c);await pick(c,'full-galaxy');await c.evaluate('window.qaBlockBackup=true');
    await act(c,'.genesis-apply');await act(c,'.genesis-confirm-apply');await exists(c,'.genesis-error');assert.deepEqual(await read(c),original);
    assert.equal(await c.evaluate(`document.querySelectorAll('.orb-screen-hit').length`),1,'Failed backup must not replace in-memory galaxy');
    await reload(c);await open(c);await pick(c,'full-galaxy');await c.evaluate('window.qaBlockWrite=true');await act(c,'.genesis-apply');await act(c,'.genesis-confirm-apply');
    await exists(c,'.genesis-error');assert.deepEqual(await read(c),original);assert.equal(await c.evaluate(`document.querySelectorAll('.orb-screen-hit').length`),1);
    // A prior recovery copy must survive both failed replacement and failed restore.
    await reload(c);await open(c);await pick(c,'first-orbit');await apply(c,true);
    const current=await read(c);
    await open(c);await pick(c,'full-galaxy');await c.evaluate('window.qaBlockWrite=true');
    await act(c,'.genesis-apply');await act(c,'.genesis-confirm-apply');await exists(c,'.genesis-error');
    await reload(c);assert.deepEqual(await read(c),current);
    await open(c);await act(c,'.genesis-restore');await act(c,'.genesis-confirm-apply');
    await c.wait(`!document.querySelector('[data-testid="galaxy-genesis"]')`);assert.deepEqual(await read(c),original,'Prior backup survives failed replacement and reload');
    await open(c);await pick(c,'first-orbit');await apply(c,true);
    const beforeRestore=await read(c);
    await open(c);await c.evaluate('window.qaBlockWrite=true;window.qaBlockRollback=true');
    await act(c,'.genesis-restore');await act(c,'.genesis-confirm-apply');await exists(c,'.genesis-error');
    await reload(c);assert.deepEqual(await read(c),beforeRestore);
    await open(c);await act(c,'.genesis-restore');await act(c,'.genesis-confirm-apply');
    await c.wait(`!document.querySelector('[data-testid="galaxy-genesis"]')`);assert.deepEqual(await read(c),original,'Prior backup survives failed restore, failed rollback write and reload');
  });
  await test(EXPECTED[5],async ctx=>{
    const c=await tab(ctx,{seed:original,reduced:true,ignoreEvents:true});await open(c);await pick(c,'full-galaxy');
    const writer=await tab(ctx,{reduced:true});const newer=[{...original[0],name:'Newer work in another tab'}];
    await writer.evaluate(`void navigator.locks.request('${storageKey}:write',async()=>{window.qaHeld=true;await new Promise(r=>window.qaRelease=r);localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(newer))})});true`);await writer.wait('window.qaHeld===true');
    await act(c,'.genesis-apply');await act(c,'.genesis-confirm-apply');await c.wait(`navigator.locks.query().then(s=>s.pending.length>0)`);
    await writer.evaluate('window.qaRelease()');await exists(c,'.genesis-error');
    assert.deepEqual(await read(c),newer,'Locked comparison preserves the competing writer even without storage events');
    assert.equal(await c.evaluate(`localStorage.getItem('${backupKey}')`),null,'A stale tab must not replace the recovery copy either');
    assert.equal(await c.evaluate(`document.querySelectorAll('.orb-screen-hit').length`),1);
  });
  await test(EXPECTED[6],async ctx=>{
    const c=await tab(ctx,{seed:original,noLocks:true});await open(c);await pick(c,'full-galaxy');
    assert.ok(await c.evaluate(`document.querySelector('.genesis-apply').disabled`));assert.deepEqual(await read(c),original);
  });
  await test(EXPECTED[7],async ctx=>{
    const c=await tab(ctx,{seed:[],width:320,height:740});
    await c.evaluate(`document.querySelector('.core-container').focus({preventScroll:true})`);await key(c,'Enter');await exists(c,'[data-testid="galaxy-genesis"]');
    assert.ok(await c.evaluate(`!!document.activeElement.closest('[data-testid="galaxy-genesis"]')`));
    for(let i=0;i<12;i++){await key(c,'Tab');assert.ok(await c.evaluate(`!!document.activeElement.closest('[data-testid="galaxy-genesis"]')`));}
    await key(c,'Escape');await c.wait(`!document.querySelector('[data-testid="galaxy-genesis"]')`);
    await c.wait(`document.activeElement?.classList.contains('core-container')`);
    await act(c,'#mobile-galaxy-controls-trigger',true);await act(c,'[aria-label="Explore galaxy templates"]',true);
    await close(c);await c.wait(`document.activeElement?.id==='mobile-galaxy-controls-trigger'`);
    await act(c,'.genesis-empty button:last-child',true);await pick(c,'balanced-week',true);await settledShot(c,'mobile-320');
    assert.ok(await c.evaluate(`document.documentElement.scrollWidth<=innerWidth && document.querySelector('[data-testid="galaxy-genesis"]').scrollWidth<=innerWidth`));
    await apply(c);await c.wait(`document.querySelectorAll('.orb-screen-hit').length===5`);
    await exists(c,'.genesis-wave');
    await c.wait(`document.activeElement?.classList.contains('core-container')`);
    await c.wait(`!document.querySelector('.genesis-forming')`);
    assert.ok(await c.evaluate(`Array.from(document.querySelectorAll('.orb-screen-hit')).every(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e})`),'All created mobile planet centers are reachable');
  });
  await test(EXPECTED[8],async ctx=>{
    const c=await tab(ctx,{seed:[],reduced:true});await open(c);await pick(c,'full-galaxy');await settledShot(c,'selector-desktop');await apply(c);
    assert.equal(await c.evaluate(`document.querySelectorAll('.genesis-wave').length`),0,'Reduced motion applies immediately without creation wave');
    assert.ok(await c.evaluate(`Array.from(document.querySelectorAll('.orb-wrapper')).every(e=>getComputedStyle(e).opacity==='1')`));
    await settledShot(c,'full-galaxy-desktop');
  });
  assert.deepEqual(cases.map(c=>c.name),EXPECTED.filter(name=>!process.env.QA_CASE || name===process.env.QA_CASE),'Every required case ran');
  await writeFile(path.join(output,'results.json'),JSON.stringify(cases,null,2));
  console.log(`${cases.filter(c=>c.status==='PASS').length}/${cases.length} Galaxy Genesis checks passed; evidence: ${output}`);
  if(cases.some(c=>c.status!=='PASS'))process.exitCode=1;
}
try{await main();}finally{browser?.close();}
