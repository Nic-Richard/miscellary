import { build } from 'esbuild';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(mobile, '../web');
const mime = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', ttf: 'font/ttf' };
const bundles = {};
for (const variant of ['card', 'pack', 'full']) {
  const assets = new Map();
  async function asset(path) {
    if (!assets.has(path))
      assets.set(
        path,
        `data:${mime[path.split('.').pop()]};base64,${(await readFile(path)).toString('base64')}`,
      );
    return `__ASSET_${[...assets.keys()].indexOf(path)}__`;
  }
  const result = await build({
    ...(variant === 'full'
      ? { entryPoints: [resolve(mobile, 'surfaces/entry.tsx')] }
      : {
          stdin: {
            loader: 'tsx',
            resolveDir: resolve(mobile, 'surfaces'),
            contents: `import { createRoot } from 'react-dom/client'; import Component from '../../web/components/${variant === 'card' ? 'CardPreview' : 'PackPouch'}'; import { send } from './bridge'; import '../../web/app/globals.css'; import './surface.css'; const root = createRoot(document.getElementById('root')); window.miscellaryRender = ({data}) => { document.body.dataset.surface = '${variant}'; root.render(<main id="content"><Component ${variant === 'card' ? '{...data} size="large"' : 'title={data.set.title} identity={data.set}'} /></main>); }; send('ready');`,
          },
        }),
    bundle: true,
    write: false,
    outdir: 'out',
    minify: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'desktop-surfaces',
        setup(builder) {
          builder.onResolve({ filter: /^__ASSET_\d+__$/ }, ({ path }) => ({
            path,
            external: true,
          }));
          builder.onResolve({ filter: /^next\/link$/ }, () => ({
            path: resolve(mobile, 'surfaces/Link.tsx'),
          }));
          builder.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, ({ path }) => ({
            path: fileURLToPath(import.meta.resolve(path)),
          }));
          builder.onResolve({ filter: /^@\// }, ({ path }) => ({
            path: resolve(web, `${path.slice(2)}${path.endsWith('.css') ? '' : '.ts'}`),
          }));
          builder.onLoad({ filter: /apps[\\/]web[\\/]lib[\\/]api\.ts$/ }, async () => ({
            contents: await readFile(resolve(mobile, 'surfaces/api.ts'), 'utf8'),
            loader: 'ts',
            resolveDir: resolve(mobile, 'surfaces'),
          }));
          builder.onLoad({ filter: /\.(tsx?|css)$/ }, async ({ path }) => {
            let source = await readFile(path, 'utf8');
            if (source.includes('/materials/${file}')) {
              const files = await readdir(resolve(web, 'public/materials'));
              const map = {};
              for (const file of files.filter(
                (file) => file.startsWith('tex-') && file.endsWith('.png'),
              ))
                map[file] = await asset(resolve(web, 'public/materials', file));
              source = source.replaceAll(
                '/materials/${file}',
                '${' + JSON.stringify(map) + '[file]}',
              );
            }
            for (const match of source.matchAll(/(['"])\/materials\/([^'"]+)\1/g)) {
              source = source.replaceAll(
                match[0],
                `${match[1]}${await asset(resolve(web, 'public/materials', match[2]))}${match[1]}`,
              );
            }
            if (path === resolve(web, 'lib/upload.ts')) {
              source =
                `import { request } from '${resolve(mobile, 'surfaces/bridge').replaceAll('\\', '/')}';\n` +
                source;
              source = source.replace(
                'export async function uploadImage(',
                'async function browserUploadImage(',
              );
              source += `\nexport async function uploadImage(blob: Blob, kind: ImageKind): Promise<ImageRef> { const size = await dimensions(blob); const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); }); return request('upload', { data, kind, contentType: blob.type, ...size }) as Promise<ImageRef>; }`;
              source = source.replace(
                'export const hasNativePicker = false;',
                'const browserHasNativePicker = false;',
              );
              source = source.replace(
                'export async function pickNativeImage(',
                'async function browserPickNativeImage(',
              );
              source +=
                `
export const hasNativePicker = true;` +
                `
export async function pickNativeImage(kind: ImageKind, aspect: number):` +
                ` Promise<ImageRef | null> {` +
                ` return request('pickImage', { kind, aspect }) as Promise<ImageRef | null>; }`;
            }
            return {
              contents: source,
              loader: path.endsWith('.module.css')
                ? 'local-css'
                : path.endsWith('.css')
                  ? 'css'
                  : path.endsWith('.tsx')
                    ? 'tsx'
                    : 'ts',
              resolveDir: dirname(path),
            };
          });
        },
      },
    ],
  });
  let fonts = '';
  for (const [family, file, weight] of [
    ['Bebas Neue', 'BebasNeue-Regular', 400],
    ['Roboto Condensed', 'RobotoCondensed-Regular', 400],
    ['Roboto Condensed', 'RobotoCondensed-SemiBold', 600],
    ['Playfair Display', 'PlayfairDisplay_400Regular', 400],
    ['Cinzel', 'Cinzel_400Regular', 400],
    ['Archivo Black', 'ArchivoBlack_400Regular', 400],
    ['Space Mono', 'SpaceMono_400Regular', 400],
    ['Caveat', 'Caveat_400Regular', 400],
    ['Alfa Slab One', 'AlfaSlabOne_400Regular', 400],
    ['Oswald', 'Oswald_400Regular', 400],
    ['Marcellus SC', 'MarcellusSC_400Regular', 400],
    ['EB Garamond', 'EBGaramond_400Regular', 400],
    ['Spectral', 'Spectral_400Regular', 400],
    ['Cabin', 'Cabin_400Regular', 400],
    ['Jost', 'Jost_400Regular', 400],
  ])
    fonts += `@font-face{font-family:'${family}';font-weight:${weight};src:url('${await asset(resolve(mobile, `assets/fonts/${file}.ttf`))}')}`;
  const css = result.outputFiles.find((file) => file.path.endsWith('.css')).text;
  const js = result.outputFiles.find((file) => file.path.endsWith('.js')).text;
  const resources = [...assets.values()];
  const bootstrap = `const assets=${JSON.stringify(resources)}; const urls=assets.map(uri=>{const [head,data]=uri.split(',');const bytes=Uint8Array.from(atob(data), c=>c.charCodeAt(0));return URL.createObjectURL(new Blob([bytes],{type:head.slice(5).split(';')[0]}));}); const expand=value=>value.replace(/__ASSET_(\\d+)__/g,(_,i)=>urls[Number(i)]);const style=document.createElement('style');style.textContent=expand(${JSON.stringify(fonts + css)});document.head.appendChild(style);const script=document.createElement('script');script.textContent=expand(${JSON.stringify(js)});document.body.appendChild(script);`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script>${bootstrap.replaceAll('</script', '<\\/script')}</script></body></html>`;
  bundles[variant] = { html };
  console.log(
    `Bundled ${variant} shared surface with ${assets.size} local assets (${Math.round(html.length / 1024)} KB).`,
  );
}
await mkdir(resolve(mobile, 'generated'), { recursive: true });
await writeFile(resolve(mobile, 'generated/surfaces.json'), JSON.stringify(bundles));
