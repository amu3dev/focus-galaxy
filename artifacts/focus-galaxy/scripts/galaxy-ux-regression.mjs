import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CDP, viewport, pointer, target, click, key, screenshot } from './cdp-harness.mjs';

const port = Number(process.env.CDP_PORT || 9228);
const baseUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const output = process.env.QA_OUTPUT_DIR;
const downloadPath = path.resolve(output || tmpdir(), 'focus-galaxy-ux-downloads');
const suite = process.env.QA_SUITE || 'geometry';
const sizes = [[1440,900],[844,390],[430,932],[390,844],[360,780]];
const results = [], evidence = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;

async function page(width, height, { reduced = false, noLocks = false } = {}) {
  const { browserContextId } = await browser.send('Target.createBrowserContext', { disposeOnDetach:true });
  if(noLocks) {
    await mkdir(downloadPath,{recursive:true});
    await browser.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId,downloadPath,eventsEnabled:true});
  }
  const { targetId } = await browser.send('Target.createTarget', { url:'about:blank', browserContextId });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const c = await CDP.connect(targets.find(t => t.id === targetId).webSocketDebuggerUrl);
  c.context = browserContextId;
  await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Page.bringToFront');
  c.touch = width <= 767 || (width <= 1024 && height <= 560);
  await viewport(c, width,height,c.touch);
  await c.send('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}] });
  if (noLocks) await c.send('Page.addScriptToEvaluateOnNewDocument', { source:`
    Object.defineProperty(navigator,'locks',{ configurable:true,value:undefined });
    window.qaWrites=[]; const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){window.qaWrites.push(k);return set.call(this,k,v)};
    window.qaExports=[]; const create=URL.createObjectURL.bind(URL);
    URL.createObjectURL=b=>{window.qaExports.push(b.text());return create(b)};
    window.qaNames=[]; const anchor=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){window.qaNames.push(this.download);return anchor.call(this)};
  ` });
  await c.send('Page.navigate',{url:baseUrl});
  await c.wait(`!!document.querySelector('.core-body') && document.querySelectorAll('.orb-screen-hit').length === 6`);
  await c.evaluate('document.fonts.ready');
  await sleep(500);
  return c;
}
async function test(name, width,height, options, run) {
  let c;
  try {
    c = await page(width,height,options);
    evidence.push(await c.evaluate(`(()=>{
      const rect=e=>e.getBoundingClientRect().toJSON();
      const bodies=[...document.querySelectorAll('.orb-screen-visual')].map(e=>({id:e.dataset.priorityId,rect:rect(e),label:rect(e.querySelector('.orb-label'))}));
      const panels=[...document.querySelectorAll('.panel-card')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({className:e.className,rect:rect(e)}));
      return {kind:'visual-audit',width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,app:rect(document.querySelector('.focus-galaxy-app')),layer:rect(document.querySelector('.galaxy-layer')),core:rect(document.querySelector('.core-body')),rings:[...document.querySelectorAll('.orbit-track')].map(rect),bodies,panels};
    })()`));
    const detail = await run(c, c.touch);
    assert.deepEqual(c.errors, [], 'Runtime errors');
    results.push({name,status:'PASS',detail});
  } catch(e) {
    results.push({name,status:'FAIL',error:String(e.stack||e)});
    if(c) await screenshot(c,output,`${suite}-${name}-failure`);
  } finally {
    if(c) { c.close(); await browser.send('Target.disposeBrowserContext',{browserContextId:c.context}); }
  }
  console.log(JSON.stringify(results.at(-1)));
}
async function sample(c,label,frames = 12) {
  const rows = await c.evaluate(`new Promise(resolve=>{
    const rows=[];
    function take(){
      const describe=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e); return {x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2,transform:s.transform,origin:s.transformOrigin,translate:s.translate,inline:e.style.transform};};
      const body=document.querySelector('.core-body'), core=document.querySelector('.core-container');
      const ref=document.querySelector('#qa-orbit-origin');
      const b=describe(body), anchor=describe(ref);
      rows.push({label:${JSON.stringify(label)},time:performance.now(),body:b,core:describe(core),anchor,plane:describe(ref.parentElement),layer:describe(document.querySelector('.galaxy-layer')),viewport:describe(document.querySelector('.galaxy-viewport')),dx:b.cx-anchor.cx,dy:b.cy-anchor.cy,sameNode:window.qaCore===core,selected:document.querySelector('.orb-screen-hit[aria-pressed="true"]')?.dataset.testid});
      if(rows.length<${frames})requestAnimationFrame(take);else resolve(rows);
    } take();
  })`);
  evidence.push(...rows);
  return rows;
}
async function geometry(c,touch) {
  // Zero-sized probe projects the actual orbital origin, not the center of a
  // perspective-distorted bounding rectangle. No scene styles are changed.
  await c.evaluate(`(()=>{const p=document.createElement('i');p.id='qa-orbit-origin';p.style.cssText='position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none';document.querySelector('.orbital-plane').append(p);window.qaCore=document.querySelector('.core-container')})()`);
  const all = [];
  const capture = async label => all.push(...await sample(c,label));
  await capture('before');
  await screenshot(c,output,`geometry-${await c.evaluate('innerWidth+"x"+innerHeight')}-before`);
  // Collapse legitimate panel occlusion before checking center and planet hits.
  await key(c,'Escape');
  await c.wait(`!document.querySelector('.orb-screen-hit[aria-pressed="true"]')`);
  await key(c,'f','KeyF',70); await sleep(650);
  for(let cycle=0;cycle<3;cycle++) {
    const p = await target(c,'.core-container');
    await capture(`cycle-${cycle}-before-down`);
    await pointer(c,'down',p.x,p.y,touch); await capture(`cycle-${cycle}-down`);
    await pointer(c,'up',p.x,p.y,touch); await capture(`cycle-${cycle}-release`);
    await screenshot(c,output,`geometry-${await c.evaluate('innerWidth+"x"+innerHeight')}-release`);
    const releasedMax = Math.max(...all.map(r=>Math.hypot(r.dx,r.dy)));
    assert.ok(releasedMax<=2,`Center displaced ${releasedMax.toFixed(3)} CSS px relative to orbital origin (limit 2)`);
    await c.wait(`document.querySelector('[data-testid="orb-job-search"]')?.getAttribute('aria-pressed')==='true'`);
    await capture(`cycle-${cycle}-panel-open`);
    if(cycle===0) await screenshot(c,output,`geometry-${await c.evaluate('innerWidth+"x"+innerHeight')}-after-tap`);
    await sleep(550);
    await click(c,'[aria-label="Close panel"]',touch);
    await c.wait(`!document.querySelector('.orb-screen-hit[aria-pressed="true"]')`);
    await capture(`cycle-${cycle}-panel-closed`);
    await key(c,'f','KeyF',70); await sleep(650);
    const planet = await c.evaluate(`(()=>{for(const e of document.querySelectorAll('.orb-screen-hit')){const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(document.elementFromPoint(x,y)===e)return {selector:'[data-testid="'+e.dataset.testid+'"]',id:e.dataset.testid};}return null})()`);
    assert.ok(planet,'A visible planet must be available');
    await click(c,planet.selector,touch);
    await c.wait(`document.querySelector(${JSON.stringify(planet.selector)})?.getAttribute('aria-pressed')==='true'`);
    await capture(`cycle-${cycle}-planet-selected`);
    await sleep(550); await click(c,'[aria-label="Close panel"]',touch);
    await c.wait(`!document.querySelector('.orb-screen-hit[aria-pressed="true"]')`);
    await key(c,'f','KeyF',70); await sleep(1300);
    await capture(`cycle-${cycle}-next-orbital-phase`);
  }
  const max = Math.max(...all.map(r=>Math.hypot(r.dx,r.dy)));
  assert.ok(all.every(r=>r.sameNode),'Center must not remount');
  assert.ok(max<=2,`Center displaced ${max.toFixed(3)} CSS px relative to orbital origin (limit 2)`);
  return {samples:all.length,maxDeviation:max};
}
async function settledPanel(c,selector) {
  await c.wait(`new Promise(resolve=>{
    const e=document.querySelector(${JSON.stringify(selector)});
    if(!e)return resolve(false);
    const a=e.getBoundingClientRect();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const b=e.getBoundingClientRect();
      resolve(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.width-b.width)+Math.abs(a.height-b.height)<0.1 && Number(getComputedStyle(e).opacity)>.999);
    }));
  })`);
}
async function reset(c,touch) {
  if(touch && await c.evaluate(`document.querySelector('#mobile-galaxy-controls-trigger')?.getAttribute('aria-expanded')==='false'`)) {
    await click(c,'#mobile-galaxy-controls-trigger',true); await sleep(250);
  }
  await click(c,'[aria-label="Reset priorities"]',touch);
  await c.wait(`!!document.querySelector('.focus-confirm-destructive')`);
  await settledPanel(c,'[role="alertdialog"]');
  await click(c,'.focus-confirm-destructive',touch);
  await c.wait(`document.querySelector('.focus-toast[data-state="open"]')?.innerText.includes('Galaxy Reset')`);
  await c.wait(`!document.querySelector('[role="alertdialog"]') && !document.querySelector('body > [data-state="closed"].fixed.inset-0')`);
  await settledPanel(c,'.focus-toast');
}
async function notifications(c,touch) {
  await reset(c,touch);
  const snapshot = await c.evaluate(`(()=>{
    const toast=document.querySelector('.focus-toast'),r=toast.getBoundingClientRect();
    const controls=[...document.querySelectorAll('.app-header button,.app-header input,.app-header select')].filter(e=>!e.closest('.focus-toast')).map(e=>{
      const b=e.getBoundingClientRect(); if(!b.width||!b.height)return null;
      const x=b.x+b.width/2,y=b.y+b.height/2,hit=document.elementFromPoint(x,y);
      return {label:e.getAttribute('aria-label'),rect:b.toJSON(),overlap:Math.max(0,Math.min(r.right,b.right)-Math.max(r.left,b.left))*Math.max(0,Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)),reachable:hit===e||e.contains(hit),hit:hit?.outerHTML.slice(0,200)};
    }).filter(Boolean);
    return {toast:r.toJSON(),viewport:document.querySelector('.focus-toast-viewport').getBoundingClientRect().toJSON(),controls,active:document.activeElement?.outerHTML.slice(0,250),live:[...document.querySelectorAll('[aria-live]')].map(e=>({live:e.getAttribute('aria-live'),text:e.textContent})),count:document.querySelectorAll('.focus-toast').length};
  })()`);
  evidence.push({kind:'notification',width:await c.evaluate('innerWidth'),...snapshot});
  await screenshot(c,output,`notifications-${await c.evaluate('innerWidth+"x"+innerHeight')}`);
  assert.equal(snapshot.count,1,'One reset creates one notification');
  assert.ok(snapshot.controls.every(e=>e.overlap===0),`Toast visually covers toolbar: ${JSON.stringify(snapshot.controls.filter(e=>e.overlap))}`);
  assert.ok(snapshot.controls.every(e=>e.reachable),'Toolbar hit targets must remain reachable');
  assert.ok(!snapshot.active?.includes('focus-toast'),'Success must not steal focus');
  assert.ok(snapshot.live.some(e=>e.live==='polite' && e.text.includes('Galaxy Reset')),'Success is announced politely');
  assert.ok(await c.evaluate(`getComputedStyle(document.querySelector('.focus-toast')).pointerEvents==='none' && getComputedStyle(document.querySelector('.focus-toast-viewport')).pointerEvents==='none'`),'Noninteractive notification areas pass pointer events through');
  // Exercise real mouse/touch actions and real keyboard activation while visible.
  await target(c,'[aria-label="Add priority"]');
  await c.evaluate(`document.querySelector('[aria-label="Add priority"]').focus()`);
  await key(c,'Enter'); await c.wait(`!!document.querySelector('[role="dialog"]')`);
  await key(c,'Escape'); await c.wait(`!document.querySelector('[role="dialog"]')`); await sleep(350);
  if(touch) { await click(c,'#mobile-galaxy-controls-trigger',true); await sleep(250); }
  await click(c,'[aria-label="Manage priorities"]',touch); await c.wait(`!!document.querySelector('.manage-dialog')`);
  await settledPanel(c,'.manage-dialog');
  await key(c,'Escape'); await c.wait(`!document.querySelector('.manage-dialog')`); await sleep(350);
  await reset(c,touch);
  assert.equal(await c.evaluate(`document.querySelectorAll('.focus-toast[data-state="open"]').length`),1,'Repeated resets replace rather than duplicate feedback');
  await click(c,'.focus-toast-close',touch); await c.wait(`!document.querySelector('.focus-toast[data-state="open"]')`);
  await reset(c,touch);
  await c.send('Page.bringToFront');
  // CDP touch also synthesizes mouse hover. Clear it before timing the toast;
  // Radix deliberately pauses dismissal while hovered, focused, or unfocused.
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:300});
  await c.evaluate(`document.activeElement instanceof HTMLElement && document.activeElement.blur()`);
  const started=Date.now();
  await c.wait(`!document.querySelector('.focus-toast[data-state="open"]')`);
  const dismissalMs=Date.now()-started;
  assert.ok(dismissalMs<6500,`Transient success dismissed in ${dismissalMs}ms`);
  await c.send('Page.reload'); await c.wait(`!!document.querySelector('.core-body')`);
  assert.equal(await c.evaluate(`document.querySelectorAll('.focus-toast').length`),0,'Notifications do not survive reload');
  return {controls:snapshot.controls.length,dismissalMs};
}
async function warning(c,touch) {
  assert.ok(touch,'Warning case uses touch emulation');
  await c.wait(`!!document.querySelector('.priority-recovery-warning')`);
  const saved = await c.evaluate(`localStorage.getItem('focus-galaxy-priorities-v2')`);
  const measure = await c.evaluate(`(()=>{const w=document.querySelector('.storage-warning-indicator') || document.querySelector('.priority-recovery-warning'),r=w.getBoundingClientRect(),p=document.querySelector('.selected-panel-card').getBoundingClientRect();return {rect:r.toJSON(),panel:p.toJSON(),overlap:Math.max(0,Math.min(r.right,p.right)-Math.max(r.left,p.left))*Math.max(0,Math.min(r.bottom,p.bottom)-Math.max(r.top,p.top)),text:w.innerText,scrollWidth:document.documentElement.scrollWidth,innerWidth};})()`);
  evidence.push({kind:'warning',...measure});
  await screenshot(c,output,`warning-${await c.evaluate('innerWidth+"x"+innerHeight')}-collapsed`);
  assert.equal(measure.overlap,0,'Persistent warning must not cover selected sheet');
  assert.ok(measure.rect.height<=64,`Collapsed warning is compact: ${measure.rect.height}px`);
  assert.ok(/not saved/i.test(measure.text),'Unsaved state is always explicit');
  await click(c,'.mobile-sheet-summary',true); await sleep(350);
  await target(c,'.selected-panel-focus');
  await click(c,'.selected-panel-focus',true);
  await c.wait(`!!document.querySelector('[data-testid="planet-focus-mode"]')`);
  await c.evaluate(`document.querySelector('textarea').scrollIntoView({block:'center'})`);
  await click(c,'textarea',true);
  await c.send('Input.insertText',{text:'Unsaved mobile note'});
  await click(c,'.planet-content-compose button[type="submit"]',true);
  await c.wait(`document.querySelector('.planet-content-list')?.textContent.includes('Unsaved mobile note')`);
  await c.evaluate(`document.querySelector('.storage-warning-indicator').scrollIntoView({block:'center'})`);
  await click(c,'.storage-warning-indicator',true); await sleep(100);
  assert.match(await c.evaluate(`document.querySelector('.priority-recovery-warning').innerText`),/Saving is unavailable/);
  const eventStart = browser.downloadEvents.length;
  for(let i=0;i<2;i++) await click(c,'.storage-warning-actions button',true);
  const deadline = Date.now()+10000;
  const completed = () => browser.downloadEvents.slice(eventStart).filter(e=>e.method==='Browser.downloadProgress' && e.params.state==='completed');
  while(completed().length<2 && Date.now()<deadline) await sleep(50);
  assert.equal(completed().length,2,'Both session downloads complete');
  const copies=await c.evaluate(`Promise.all(window.qaExports).then(items=>items.map(JSON.parse))`);
  for(const event of completed()) {
    const downloaded=JSON.parse(await readFile(path.join(downloadPath,event.params.guid),'utf8'));
    assert.deepEqual(downloaded,copies[0],'Downloaded bytes contain the session snapshot');
  }
  const names=await c.evaluate('window.qaNames');
  assert.equal(copies.length,2,'Repeated exports execute'); assert.equal(new Set(names).size,2,'Repeated downloads have distinct names');
  assert.ok(copies.every(copy=>copy.some(p=>p.entries?.some(e=>e.text==='Unsaved mobile note'))),'Exports contain current memory-only changes');
  assert.equal(await c.evaluate(`localStorage.getItem('focus-galaxy-priorities-v2')`),saved,'No unsafe fallback write');
  assert.equal(await c.evaluate(`window.qaWrites.filter(k=>k==='focus-galaxy-priorities-v2').length`),0);
  await click(c,'.storage-warning-close',true);
  await c.evaluate(`document.querySelector('.planet-focus-back').scrollIntoView({block:'center'})`);
  await click(c,'.planet-focus-back',true); await c.wait(`!document.querySelector('[data-testid="planet-focus-mode"]')`); await sleep(350);
  await click(c,'[aria-label="Close panel"]',true);
  await click(c,'#mobile-galaxy-controls-trigger',true); await sleep(250);
  await click(c,'[aria-label="Manage priorities"]',true); await c.wait(`!!document.querySelector('.manage-dialog')`);
  await settledPanel(c,'.manage-dialog');
  await target(c,'[aria-label="Close dialog"]');
  await click(c,'[aria-label="Close dialog"]',true); await c.wait(`!document.querySelector('.manage-dialog')`);
  return {warningHeight:measure.rect.height,overlap:measure.overlap,exports:names,persistenceWrites:0};
}
async function main() {
  if(output) await mkdir(output,{recursive:true});
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  browser=await CDP.connect(version.webSocketDebuggerUrl);
  if(suite==='geometry') {
    for(const [w,h] of sizes) await test(`${w}x${h}`,w,h,{},geometry);
    for(const [w,h] of [sizes[0],sizes[3]]) await test(`${w}x${h}-reduced`,w,h,{reduced:true},geometry);
    assert.equal(results.length,7,'Every geometry case ran');
  } else if(suite==='notifications') {
    for(const [w,h] of [...sizes,[1152,720],[960,600]]) await test(`${w}x${h}`,w,h,{},notifications);
    assert.equal(results.length,7,'Every notification case ran');
  } else if(suite==='warning') {
    for(const [w,h] of sizes.slice(1)) await test(`${w}x${h}`,w,h,{noLocks:true},warning);
    assert.equal(results.length,4,'Every warning case ran');
  } else throw new Error(`Unknown suite: ${suite}`);
  const summary={suite,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status!=='PASS').length,results};
  if(output) await writeFile(path.join(output,`${suite}.json`),JSON.stringify({...summary,evidence},null,2));
  console.log(JSON.stringify(summary,null,2));
  process.exitCode=summary.failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>browser?.close());
