import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(mobile, '../..');

const { values: args } = parseArgs({
  options: {
    api: { type: 'string' },
    chrome: { type: 'string' },
    output: { type: 'string' },
  },
});
const api = String(args.api ?? 'http://localhost:8000').replace(/\/$/, '');
const chrome = String(args.chrome ?? 'http://127.0.0.1:9224').replace(/\/$/, '');
const output = resolve(repo, String(args.output ?? 'tmp/card-renders'));
const bundle = JSON.parse(await readFile(resolve(mobile, 'generated/surfaces.json'), 'utf8'));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(bundle.full.html);
});
await new Promise((resolveListening, rejectListening) => {
  server.once('error', rejectListening);
  server.listen(0, '127.0.0.1', resolveListening);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Could not start the render surface.');
const port = address.port;

async function catalogue() {
  const sets = [];
  let next = `${api}/api/v1/sets/`;
  while (next) {
    const response = await fetch(next);
    if (!response.ok) throw new Error(`Set catalogue failed with ${response.status}.`);
    const page = await response.json();
    sets.push(
      ...(await Promise.all(
        page.results.map(async (set) => {
          const detail = await fetch(`${api}/api/v1/sets/${set.slug}/`);
          if (!detail.ok) throw new Error(`Set ${set.slug} failed with ${detail.status}.`);
          return detail.json();
        }),
      )),
    );
    next = page.next;
  }
  return sets;
}

let target;
let socket;
try {
  let response;
  try {
    response = await fetch(`${chrome}/json/new`, { method: 'PUT' });
  } catch {
    throw new Error(
      `Chromium is not listening at ${chrome}. Start it with --headless=new --remote-debugging-port=9224.`,
    );
  }
  if (!response.ok) throw new Error(`Chromium could not create a page: ${response.status}.`);
  target = await response.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done) => socket.addEventListener('open', done, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  });
  const call = (method, params = {}) => {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1000,
    height: 1400,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call('Page.navigate', { url: `http://127.0.0.1:${port}` });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    ready = await evaluate('typeof window.miscellaryRender === "function"');
    if (ready) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  if (!ready) throw new Error('The render surface did not become ready.');

  async function render(mode, data, format, quality) {
    await evaluate(`window.miscellaryRender(${JSON.stringify({ mode, data })})`);
    await evaluate('window.miscellaryReady');
    const failed = await evaluate(
      `[...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src)`,
    );
    if (failed.length) throw new Error(`Images did not load: ${failed.join(', ')}`);
    return call('Page.captureScreenshot', {
      format,
      quality,
      fromSurface: true,
      captureBeyondViewport: false,
      omitBackground: true,
    });
  }

  async function resize(data, type, quality) {
    return evaluate(
      `(async()=>{const image=new Image();image.src=${JSON.stringify(
        `data:image/${type};base64,${data}`,
      )};await image.decode();const canvas=document.createElement('canvas');canvas.width=300;canvas.height=420;canvas.getContext('2d').drawImage(image,0,0,300,420);return canvas.toDataURL(${JSON.stringify(
        `image/${type}`,
      )},${quality ?? 1}).split(',')[1]})()`,
    );
  }

  async function alphaMask(data) {
    return evaluate(
      `(async()=>{const image=new Image();image.src=${JSON.stringify(
        `data:image/png;base64,${data}`,
      )};await image.decode();const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1400;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,1000,1400);for(let index=0;index<pixels.data.length;index+=4){const alpha=Math.round((pixels.data[index]+pixels.data[index+1]+pixels.data[index+2])/3);pixels.data[index]=255;pixels.data[index+1]=255;pixels.data[index+2]=255;pixels.data[index+3]=alpha}context.putImageData(pixels,0,0);return canvas.toDataURL('image/png').split(',')[1]})()`,
    );
  }

  const sets = await catalogue();
  const manifest = { renderer_version: 1, sets: [], cards: [] };
  await mkdir(output, { recursive: true });
  for (const set of sets) {
    const backSignature = set.render_back?.signature;
    if (!backSignature) continue;
    const setDirectory = resolve(output, `set-${set.id}`);
    await mkdir(setDirectory, { recursive: true });
    const back = await render(
      'render-back',
      { title: set.title, mark: set.mark, packColour: set.pack_colour },
      'webp',
      92,
    );
    await writeFile(resolve(setDirectory, 'back.webp'), Buffer.from(back.data, 'base64'));
    manifest.sets.push({
      id: set.id,
      signature: backSignature,
      back: `set-${set.id}/back.webp`,
    });

    for (const card of set.cards) {
      const signature = card.render?.signature;
      if (!signature) continue;
      const directory = resolve(output, `card-${card.id}`);
      await mkdir(directory, { recursive: true });
      const data = {
        title: card.title,
        rarity: card.rarity,
        description: card.description,
        imageUrl: card.image.url,
        templateKey: card.template_key,
        templateConfig: card.template_config,
        number: card.position + 1,
        mark: set.mark,
      };
      const front = await render('render-front', data, 'webp', 92);
      const thumbnail = await resize(front.data, 'webp', 0.9);
      await writeFile(resolve(directory, 'front.webp'), Buffer.from(front.data, 'base64'));
      await writeFile(resolve(directory, 'thumbnail.webp'), Buffer.from(thumbnail, 'base64'));
      let mask = null;
      let maskThumbnail = null;
      if (['foil', 'holo'].includes(card.template_config.treatment)) {
        const capturedMask = await render('render-mask', data, 'png');
        mask = await alphaMask(capturedMask.data);
        maskThumbnail = await resize(mask, 'png');
        await writeFile(resolve(directory, 'mask.png'), Buffer.from(mask, 'base64'));
        await writeFile(
          resolve(directory, 'mask-thumbnail.png'),
          Buffer.from(maskThumbnail, 'base64'),
        );
      }
      manifest.cards.push({
        id: card.id,
        signature,
        front: `card-${card.id}/front.webp`,
        thumbnail: `card-${card.id}/thumbnail.webp`,
        mask: mask ? `card-${card.id}/mask.png` : null,
        mask_thumbnail: maskThumbnail ? `card-${card.id}/mask-thumbnail.png` : null,
      });
    }
  }
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  process.stdout.write(
    `Rendered ${manifest.cards.length} card(s) and ${manifest.sets.length} back(s) to ${output}.\n`,
  );
} finally {
  if (target) await fetch(`${chrome}/json/close/${target.id}`).catch(() => undefined);
  socket?.close();
  server.closeAllConnections?.();
  server.close();
}
