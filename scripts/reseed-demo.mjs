// Rebuild demo data and every derived render asset.
// Baking stays outside Django because it requires a browser and the mobile surface bundle.

import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { accessSync, constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { values: args } = parseArgs({
  options: {
    api: { type: 'string' },
    chrome: { type: 'string' },
    runner: { type: 'string' },
    output: { type: 'string' },
    yes: { type: 'boolean' },
    'keep-renders': { type: 'boolean' },
    'bake-only': { type: 'boolean' },
    set: { type: 'string', multiple: true },
  },
});

const api = String(args.api ?? 'http://localhost:8000').replace(/\/$/, '');
const chromeEndpoint = String(args.chrome ?? 'http://127.0.0.1:9224').replace(/\/$/, '');
const runner = String(args.runner ?? 'docker');
const outputRelative = String(args.output ?? 'tmp/card-renders');
const output = resolve(repo, outputRelative);
if (runner !== 'docker' && runner !== 'local') {
  fail(`Unknown --runner ${runner}. Use "docker" or "local".`);
}
// The API container sees the repository at /repo, so the manifest it is handed
// has to be the path on its side of the mount.
const manifest =
  runner === 'docker' ? `/repo/${outputRelative}/manifest.json` : join(output, 'manifest.json');

let step = 0;
const bakeOnly = Boolean(args['bake-only']);
const only = args.set ?? [];
const total = bakeOnly ? 4 : only.length ? 5 : 6;

function heading(text) {
  step += 1;
  process.stdout.write(`\n[1m[${step}/${total}] ${text}[0m\n`);
}

function fail(message) {
  process.stderr.write(`\n[31m${message}[0m\n`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  return new Promise((done) => {
    const child = spawn(command, commandArgs, {
      cwd: repo,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });
    child.on('error', (error) => fail(`Could not run ${command}: ${error.message}`));
    child.on('close', (code) => {
      if (code !== 0) fail(`${command} ${commandArgs.join(' ')} exited with ${code}.`);
      done();
    });
  });
}

/** A Django management command, wherever the API happens to be running. */
function manage(commandArgs) {
  return runner === 'docker'
    ? run('docker', [
        'compose',
        'exec',
        '-T',
        'api',
        'uv',
        'run',
        'python',
        'manage.py',
        ...commandArgs,
      ])
    : run('uv', ['run', 'python', 'manage.py', ...commandArgs], { cwd: join(repo, 'apps', 'api') });
}

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

function firstExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      // F_OK, not X_OK: Windows does not carry an execute bit, and asking for
      // one there answers a question the file system cannot be asked.
      accessSync(candidate, constants.F_OK);
      return candidate;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/** Where Windows itself says a browser is, which beats guessing at a path. */
function registeredOnWindows(exe) {
  for (const root of ['HKLM', 'HKCU']) {
    try {
      const output = execFileSync(
        'reg',
        [
          'query',
          `${root}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`,
          '/ve',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      const match = output.match(/REG_SZ\s+(.+?)\s*$/m);
      if (match) return match[1];
    } catch {
      /* not registered under this root */
    }
  }
  return null;
}

function chromeCandidates() {
  const { CHROME_PATH, PUPPETEER_EXECUTABLE_PATH, LOCALAPPDATA, ProgramFiles } = process.env;
  const named = [CHROME_PATH, PUPPETEER_EXECUTABLE_PATH];
  if (process.platform === 'win32') {
    const files86 = process.env['ProgramFiles(x86)'];
    return [
      ...named,
      registeredOnWindows('chrome.exe'),
      `${ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
      `${files86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      // Edge is Chromium and speaks the same debugging protocol.
      registeredOnWindows('msedge.exe'),
      `${ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${files86}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ];
  }
  if (process.platform === 'darwin') {
    return [
      ...named,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    ...named,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

async function startChrome() {
  const port = new URL(chromeEndpoint).port || '9224';
  if (await reachable(`${chromeEndpoint}/json/version`)) {
    process.stdout.write(`Using the browser already listening on ${chromeEndpoint}.\n`);
    return null;
  }
  const binary = firstExecutable(chromeCandidates());
  if (!binary) {
    fail(
      `No Chromium found to bake with, and nothing is listening on ${chromeEndpoint}.\n` +
        'Set CHROME_PATH, or start one yourself:\n' +
        `  chrome --headless=new --remote-debugging-port=${port}`,
    );
  }
  const profile = await mkdtemp(join(tmpdir(), 'miscellary-bake-'));
  const child = spawn(
    binary,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--remote-allow-origins=*',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
    ],
    { stdio: 'ignore', detached: false },
  );
  child.on('error', (error) => fail(`Could not start ${binary}: ${error.message}`));
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await reachable(`${chromeEndpoint}/json/version`)) {
      process.stdout.write(`Started ${binary} on ${chromeEndpoint}.\n`);
      return { child, profile };
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  child.kill();
  fail(`The browser did not start listening on ${chromeEndpoint}.`);
}

async function stopChrome(started) {
  if (!started) return;
  started.child.kill();
  await rm(started.profile, { recursive: true, force: true }).catch(() => undefined);
}

async function confirm() {
  if (bakeOnly) return;
  process.stdout.write(
    only.length
      ? `[33mThis removes and recreates ${only.join(', ')} from the catalogue.[0m\n` +
          '  Demo activity is replaced, and only those sets are baked again.\n' +
          '  Accounts that are not demo accounts are left alone.\n'
      : '[33mThis creates any missing catalogue sets and re-bakes every render.[0m\n' +
          '  Demo collections, likes, follows and showcases are replaced.\n' +
          '  Baking every render takes a few minutes.\n' +
          '  Accounts that are not demo accounts are left alone.\n',
  );
  if (args.yes) {
    process.stdout.write('Continuing (--yes).\n');
    return;
  }
  if (!process.stdin.isTTY) {
    fail('Refusing to reseed without confirmation. Re-run with --yes to continue.');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "reseed" to continue: ');
  rl.close();
  if (answer.trim() !== 'reseed') fail('Left the database alone.');
}

if (!(await reachable(`${api}/api/v1/health/`))) {
  fail(`The API is not answering at ${api}. Start it first (docker compose up).`);
}

await confirm();

if (only.length && !bakeOnly) {
  heading(`Rebuild ${only.join(', ')} from the catalogue`);
  await manage(['rebuild_catalogue_set', ...only]);
  await manage(['refresh_demo_activity']);
} else if (!bakeOnly) {
  heading('Prepare source images');
  await manage(['bootstrap_catalogue', '--prepare-photos']);

  heading('Create the catalogue and refresh demo social data');
  await manage(['bootstrap_catalogue']);
  await manage(['refresh_demo_activity']);
}

heading('Build the shared render surface');
await run('pnpm', ['--filter', 'mobile', 'surfaces:build']);

heading('Bake card fronts, thumbnails, masks, set backs and packs');
if (!args['keep-renders'] && !only.length) await rm(output, { recursive: true, force: true });
const chrome = await startChrome();
try {
  await run('node', [
    'apps/mobile/scripts/render-card-assets.mjs',
    '--api',
    api,
    '--chrome',
    chromeEndpoint,
    '--output',
    outputRelative,
    ...only.flatMap((slug) => ['--set', slug]),
  ]);
} finally {
  await stopChrome(chrome);
}

heading('Import the baked renders');
await manage(['import_card_renders', manifest]);

heading('Verify every published card and set is ready');
await manage(['verify_renders']);

process.stdout.write(
  bakeOnly
    ? '\n\u001b[32mEvery render is baked again and in place.\u001b[0m\n'
    : '\n\u001b[32mThe demo catalogue is rebuilt and every render is in place.\u001b[0m\n',
);
