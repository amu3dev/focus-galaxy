import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CDP, viewport, pointer, click, key, target, screenshot } from './cdp-harness.mjs';

const port = Number(process.env.CDP_PORT || 9228);
const url = process.env.APP_URL || 'http://127.0.0.1:5173/';
const output = process.env.QA_OUTPUT_DIR;
const storageKey = 'focus-galaxy-priorities-v2';
const seed = [{ id:'review-a', name:'Review A', importance:8, urgency:8, energy:7, hue:'#f04e76', entries:[] }];
const sizes = [[1440,900],[390,844]];
const cases = ['manage-shift-tab','manage-tab','escape-manage','escape-focus','escape-galaxy','light-manage','light-focus','reload-manage','reload-focus','reload-galaxy'];
const expected = sizes.flatMap(([w,h]) => cases.map(name => `${w}x${h}-${name}`));
const results = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
let browser, tabs = [];

async function page(context,w,h,{seeded=false,noLocks=false}={}) {
  const {targetId} = await browser.send('Target.createTarget',{url:'about:blank',browserContextId:context});
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const c = await CDP.connect(targets.find(t=>t.id===targetId).webSocketDebuggerUrl);
  tabs.push(c); c.touch = w < 768;
  await c.send('Page.enable'); await c.send('Runtime.enable');
  await viewport(c,w,h,c.touch);
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    ${seeded ? `localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(seed))});` : ''}
    ${noLocks ? `Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});` : ''}
    window.qaWrites=[]; const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){window.qaWrites.push(k);return set.call(this,k,v)};
  `});
  await c.send('Page.navigate',{url});
  await c.wait(`!!document.querySelector('.selected-panel-focus')`);
  await c.evaluate('document.fonts.ready'); await sleep(200);
  return c;
}
async function openView(c,view) {
  if(view==='manage') {
    if(c.touch) { await click(c,'#mobile-galaxy-controls-trigger',true); await sleep(100); }
    await click(c,'[aria-label="Manage priorities"]',c.touch);
    await c.wait(`!!document.querySelector('.manage-dialog')`);
  } else if(view==='focus') {
    if(c.touch) { await click(c,'.mobile-sheet-summary',true); await sleep(100); }
    await click(c,'.selected-panel-focus',c.touch);
    await c.wait(`!!document.querySelector('.planet-focus-overlay')`);
  }
  await sleep(200);
}
const focus = (c,selector) => c.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus({preventScroll:true})`);
const popoverOpen = `!!document.querySelector('#priority-storage-details:popover-open')`;
async function openDetails(c) {
  await c.evaluate(`document.querySelector('.storage-warning-indicator').scrollIntoView({block:'center'})`);
  await click(c,'.storage-warning-indicator',c.touch); await c.wait(popoverOpen);
}
async function assertView(c,view) {
  assert.equal(await c.evaluate(`!!document.querySelector('.manage-dialog')`),view==='manage','Manage stays open only when requested');
  assert.equal(await c.evaluate(`!!document.querySelector('.planet-focus-overlay')`),view==='focus','Focus stays open only when requested');
  assert.ok(await c.evaluate(`!!document.querySelector('.orb-screen-hit[aria-pressed="true"]')`),'Escape must not deselect the galaxy');
}
async function assertIndicatorFocus(c) {
  assert.ok(await c.evaluate(`document.activeElement?.matches('.storage-warning-indicator') && document.activeElement.getClientRects().length>0`),'Focus returns to the visible saving indicator');
  await target(c,'.storage-warning-indicator');
}
async function shiftTab(c) {
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9,modifiers:8});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9,modifiers:8});
}
async function run(name,w,h) {
  const {browserContextId:context} = await browser.send('Target.createBrowserContext',{disposeOnDetach:true});
  tabs=[]; let c;
  const id=`${w}x${h}-${name}`;
  try {
    const reload = name.startsWith('reload-');
    c=await page(context,w,h,{seeded:true,noLocks:!reload});
    const before = await c.evaluate(`localStorage.getItem(${JSON.stringify(storageKey)})`);
    if(reload) {
      const writer=await page(context,1440,900);
      await writer.evaluate(`(()=>{const e=document.querySelector('#selected-priority-name');e.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Saved in writer');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await writer.evaluate(`document.querySelector('#selected-priority-name').blur()`);
      await writer.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}))[0].name==='Saved in writer'`);
      await c.wait(`!!document.querySelector('[data-testid="priority-conflict-warning"]')`);
    } else await c.wait(`!!document.querySelector('.storage-warning-indicator')`);
    await c.send('Page.bringToFront');
    const view=name.startsWith('manage-')?'manage':name.split('-')[1];
    await openView(c,view);
    if(name==='manage-shift-tab' || name==='manage-tab') {
      assert.equal(await c.evaluate(popoverOpen),false);
      const first='.manage-dialog [aria-label="Close dialog"]';
      if(name==='manage-shift-tab') {
        await focus(c,first); await shiftTab(c);
        await assertIndicatorFocus(c);
      } else {
        await focus(c,'.storage-warning-indicator'); await key(c,'Tab');
        assert.ok(await c.evaluate(`document.activeElement?.matches(${JSON.stringify(first)})`),'Tab wraps from visible last control to first');
      }
    } else if(name.startsWith('escape-')) {
      await openDetails(c);
      await focus(c,'.storage-warning-close');
      await key(c,'Escape'); await sleep(300);
      assert.equal(await c.evaluate(popoverOpen),false,'Escape dismisses saving details');
      await assertView(c,view); await assertIndicatorFocus(c);
      await screenshot(c,output,`${id}-indicator-focus`);
      // A second Escape belongs to the outer view again.
      await key(c,'Escape');
      await c.wait(view==='galaxy' ? `!document.querySelector('.orb-screen-hit[aria-pressed="true"]')` : `!document.querySelector(${JSON.stringify(view==='manage'?'.manage-dialog':'.planet-focus-overlay')})`);
    } else if(name.startsWith('light-')) {
      await openDetails(c);
      const outside = await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(view==='manage'?'.manage-dialog':'.planet-focus-overlay')}),r=e.getBoundingClientRect(),x=r.right-8,y=r.top+8,hit=document.elementFromPoint(x,y);return {x,y,reachable:e.contains(hit)&&!hit.closest('[popover]')};})()`);
      assert.ok(outside.reachable,'Light-dismiss point is outside saving details but inside the outer view');
      await pointer(c,'down',outside.x,outside.y,c.touch); await pointer(c,'up',outside.x,outside.y,c.touch);
      await c.wait(`!(${popoverOpen})`);
      await assertView(c,view);
    } else {
      await openDetails(c);
      await click(c,'.storage-warning-actions button:last-child',c.touch);
      await c.wait(`!!document.querySelector('[role="alertdialog"]')`); await sleep(150);
      const hits = {};
      for(const selector of ['.focus-confirm-cancel','.focus-confirm-destructive']) {
        try { hits[selector]=await target(c,selector); } catch(e) { hits[selector]={error:String(e)}; }
      }
      const open=await c.evaluate(popoverOpen);
      if(output) await writeFile(path.join(output,`${id}-hits.json`),JSON.stringify({popoverOpen:open,hits},null,2));
      await screenshot(c,output,`${id}-confirmation`);
      assert.equal(open,false,`Saving popover must leave the top layer before confirmation; hits=${JSON.stringify(hits)}`);
      assert.ok(Object.values(hits).every(h=>!h.error),'Both confirmation actions must be real-hit reachable');
      await key(c,'Tab');
      assert.ok(await c.evaluate(`!!document.activeElement.closest('[role="alertdialog"]')`),'Confirmation owns keyboard focus');
      await click(c,'.focus-confirm-cancel',c.touch);
      await c.wait(`!document.querySelector('[role="alertdialog"]')`); await sleep(150);
      await assertView(c,view); await assertIndicatorFocus(c);
      assert.equal(await c.evaluate(`document.querySelector('.manage-dialog input')?.value ?? document.querySelector('#planet-focus-title')?.textContent ?? document.querySelector('#selected-priority-name')?.value ?? document.querySelector('.mobile-sheet-name')?.textContent`),'Review A','Cancel preserves the stale session');
    }
    assert.deepEqual(tabs.flatMap(t=>t.errors),[],'Runtime errors');
    assert.equal(await c.evaluate(`window.qaWrites.filter(k=>k===${JSON.stringify(storageKey)}).length`),0,'Warning interactions never write storage');
    if(!reload) assert.equal(await c.evaluate(`localStorage.getItem(${JSON.stringify(storageKey)})`),before,'No fallback write');
    results.push({name:id,status:'PASS'});
  } catch(e) {
    results.push({name:id,status:'FAIL',error:String(e.stack||e)});
    if(c) await screenshot(c,output,`${id}-failure`);
  } finally {
    for(const t of tabs)t.close();
    await browser.send('Target.disposeBrowserContext',{browserContextId:context});
  }
  console.log(JSON.stringify(results.at(-1)));
}
async function main() {
  if(output)await mkdir(output,{recursive:true});
  const version=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  browser=await CDP.connect(version.webSocketDebuggerUrl);
  for(const [w,h] of sizes)for(const name of cases)await run(name,w,h);
  assert.deepEqual(results.map(r=>r.name),expected,'Every expected case ran');
  const summary={passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,results};
  if(output)await writeFile(path.join(output,'storage-warning-accessibility.json'),JSON.stringify(summary,null,2));
  console.log(`storage-warning-accessibility: ${summary.passed}/${expected.length} passed; ${summary.failed} failed`);
  process.exitCode=summary.failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>browser?.close());
