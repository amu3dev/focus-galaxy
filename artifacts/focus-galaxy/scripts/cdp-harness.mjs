import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.errors = [];
    this.downloadEvents = [];
    socket.addEventListener('message', ({ data }) => {
      const event = JSON.parse(data);
      if (event.method?.startsWith('Browser.download')) this.downloadEvents.push(event);
      const request = this.pending.get(event.id);
      if (request) {
        this.pending.delete(event.id);
        clearTimeout(request.timeout);
        if (event.error) request.reject(new Error(event.error.message));
        else request.resolve(event.result);
      }
      if (event.method === 'Runtime.exceptionThrown') this.errors.push(event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text);
      if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') this.errors.push(event.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    });
    socket.addEventListener('close', () => {
      for (const request of this.pending.values()) { clearTimeout(request.timeout); request.reject(new Error('CDP closed')); }
      this.pending.clear();
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    return new CDP(socket);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  }
  async wait(expression) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) { if (await this.evaluate(expression)) return; await sleep(50); }
    throw new Error(`Timed out: ${expression}`);
  }
  close() { this.socket.close(); }
}

export async function viewport(client, width, height, mobile = width < 1025) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
}
export async function pointer(client, type, x, y, touch) {
  if (touch) return client.send('Input.dispatchTouchEvent', { type: type === 'down' ? 'touchStart' : 'touchEnd', touchPoints: type === 'down' ? [{ x, y, id: 1 }] : [] });
  if (type === 'down') await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  return client.send('Input.dispatchMouseEvent', { type: type === 'down' ? 'mousePressed' : 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
export async function target(client, selector) {
  const result = await client.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) return null;
    const r = e.getBoundingClientRect(), x = r.x + r.width/2, y = r.y + r.height/2;
    const hit = document.elementFromPoint(x,y);
    return { x, y, width:r.width, height:r.height, reachable:!!hit && (hit===e || e.contains(hit)), hit:hit?.outerHTML.slice(0,300), visible:r.width>0 && r.height>0 && x>=0 && y>=0 && x<innerWidth && y<innerHeight };
  })()`);
  if (!result?.visible || !result.reachable) throw new Error(`Unreachable ${selector}: ${JSON.stringify(result)}`);
  return result;
}
export async function click(client, selector, touch = false) {
  const { x,y } = await target(client, selector);
  await pointer(client, 'down', x,y,touch);
  await pointer(client, 'up', x,y,touch);
}
export async function key(client, key, code = key, value = key === 'Enter' ? 13 : key === 'Escape' ? 27 : 9) {
  for (const type of ['keyDown','keyUp']) await client.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode:value, nativeVirtualKeyCode:value, ...(type === 'keyDown' && key === 'Enter' ? {text:'\r'} : {}) });
}
export async function screenshot(client, output, name) {
  if (!output) return;
  await mkdir(output, { recursive:true });
  const shot = await client.send('Page.captureScreenshot', { format:'png' });
  await writeFile(path.join(output, `${name}.png`), Buffer.from(shot.data,'base64'));
}
