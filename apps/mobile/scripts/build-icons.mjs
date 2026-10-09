import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(mobile, '../web');
const sharp = createRequire(resolve(web, 'package.json'))('sharp');
const source = await readFile(resolve(web, 'app/icon.svg'), 'utf8');
const background = source.match(/<rect width="64"[^>]+fill="([^"]+)"/)?.[1];
const foreground = source.match(/<g[^>]+stroke="([^"]+)"/)?.[1];
const mark = source.match(/<g[\s\S]*<\/g>/)?.[0];
if (!background || !foreground || !mark) throw new Error('Favicon mark or colours are missing.');

const svg = (content) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">${content}</svg>`,
  );
const centered = `<g transform="translate(0 -2)">${mark}</g>`;
const splash = centered
  .replaceAll(foreground, '__foreground__')
  .replaceAll(background, foreground)
  .replaceAll('__foreground__', background);

await sharp(svg(`<rect width="64" height="64" fill="${background}"/>${centered}`))
  .removeAlpha()
  .png()
  .toFile(resolve(mobile, 'assets/images/icon.png'));
await sharp(svg(`<g transform="translate(10.56 10.56) scale(.67)">${centered}</g>`))
  .png()
  .toFile(resolve(mobile, 'assets/images/adaptive-icon.png'));
await sharp(svg(splash)).png().toFile(resolve(mobile, 'assets/images/splash-icon.png'));
