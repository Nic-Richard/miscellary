import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const bundle = JSON.parse(await readFile('apps/mobile/generated/surfaces.json', 'utf8'));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(bundle[request.url === '/card' ? 'card' : 'full'].html);
}).listen(9811, '127.0.0.1');
const target = await (await fetch('http://127.0.0.1:9224/json/new', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const exceptions = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown')
    exceptions.push(message.params.exceptionDetails.text);
  const callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  if (message.error) callback.reject(new Error(message.error.message));
  else callback.resolve(message.result);
});
function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  await call('Runtime.enable');
  await call('Page.enable');
  const catalogue = await (await fetch('http://localhost:8000/api/v1/sets/')).json();
  const sets = await Promise.all(
    catalogue.results.map((set) =>
      fetch(`http://localhost:8000/api/v1/sets/${set.slug}/`).then((response) => response.json()),
    ),
  );
  const templates = new Map();
  for (const card of sets.flatMap((set) => set.cards))
    if (!templates.has(card.template_key)) templates.set(card.template_key, card);
  async function render(mode, data, width, height) {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await call('Page.navigate', {
      url: `http://127.0.0.1:9811/${mode === 'card' ? 'card' : 'full'}`,
    });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('typeof window.miscellaryRender === "function"')) break;
      await pause(50);
    }
    await evaluate(`window.miscellaryRender(${JSON.stringify({ mode, data })})`);
    await pause(100);
    await evaluate(
      `document.fonts.ready.then(() => Promise.all([...document.images].map(img => img.complete ? Promise.resolve() : new Promise((resolve, reject) => { img.onload=resolve; img.onerror=()=>reject(new Error('Image failed: '+img.src)); setTimeout(()=>reject(new Error('Image timeout')),10000); }))))`,
    );
  }
  for (const width of [104, 150, 220, 300]) {
    for (const card of templates.values()) {
      await render(
        'card',
        {
          title: card.title,
          description: card.description,
          rarity: card.rarity,
          imageUrl: card.image.url,
          templateKey: card.template_key,
          templateConfig: card.template_config,
        },
        width,
        Math.ceil(width * 1.4),
      );
      const result = await evaluate(
        `(()=>{const card=document.querySelector('#content > div');const img=document.querySelector('img');return {width:card.getBoundingClientRect().width,height:card.getBoundingClientRect().height,image:img?.naturalWidth,artWidth:img?.getBoundingClientRect().width,artHeight:img?.getBoundingClientRect().height};})()`,
      );
      if (
        Math.abs(result.width - width) > 1 ||
        Math.abs(result.height - width * 1.4) > 1 ||
        !result.image ||
        !result.artWidth ||
        !result.artHeight
      )
        throw new Error(`${card.template_key} at ${width}: ${JSON.stringify(result)}`);
    }
  }
  await mkdir('tmp/surface-review', { recursive: true });
  const set = sets.find((set) => set.title === 'Shutter Shelf');
  for (const [half, width, height] of [
    [true, 390, 600],
    [false, 844, 514],
  ]) {
    await render('binder', { set, page: 0, half }, width, height);
    const screenshot = await call('Page.captureScreenshot');
    await writeFile(
      resolve(`tmp/surface-review/binder-${half ? 'portrait' : 'landscape'}.png`),
      Buffer.from(screenshot.data, 'base64'),
    );
  }
  await render(
    'inspect',
    {
      card: set.cards[4],
      setTitle: set.title,
      setSlug: set.slug,
      mark: set.mark,
      packColour: set.pack_colour,
    },
    390,
    844,
  );
  const center = await evaluate(
    `(()=>{const r=document.querySelector('[role="img"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  );
  await call('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...center,
    button: 'left',
    clickCount: 1,
  });
  await call('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: center.x + 100,
    y: center.y + 25,
    button: 'left',
    buttons: 1,
  });
  await call('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: center.x + 100,
    y: center.y + 25,
    button: 'left',
    clickCount: 1,
  });
  await pause(200);
  if (!(await evaluate(`!!document.querySelector('[style*="--turn"]')`)))
    throw new Error('Inspector drag did not rotate the card.');
  const screenshot = await call('Page.captureScreenshot');
  await writeFile('tmp/surface-review/inspector.png', Buffer.from(screenshot.data, 'base64'));
  if (exceptions.length) throw new Error(exceptions.join('\n'));
  console.log(
    `Verified ${templates.size} desktop templates at four widths, binder views, image loads, and inspector drag in Chromium. Android WebView/device QA remains required.`,
  );
} finally {
  await fetch(`http://127.0.0.1:9224/json/close/${target.id}`);
  socket.close();
  server.close();
}
