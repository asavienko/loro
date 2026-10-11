#!/usr/bin/env node
// Captures every screen and sheet of the app, in each of its states, as static HTML files: the web
// build runs in a headless Chromium with the API answered from the seeded content (seed.ts), each
// scenario (scenarios.mjs) opens a screen and puts it in a state, and the page as rendered — its DOM,
// its CSS rules, the fonts and images it uses — is written to a static .html file that opens from
// disk, with an index.html that shows them all side by side.
//
//   pnpm --filter @loro/mobile screens                    # every scenario into .screens/out
//   pnpm --filter @loro/mobile screens -- --only home     # the scenarios whose name has "home"
//   pnpm --filter @loro/mobile screens -- --rebuild       # export the web build again first
//   pnpm --filter @loro/mobile screens -- --probe home    # print a scenario's accessibility tree
//
// Options: --out DIR, --viewport 390x844, --rebuild, --only TEXT (repeatable), --probe NAME,
// --headed, --list, --inline (each file self-contained, fonts and images as data URLs, ~4 MB
// each; otherwise they share out/assets), --png (a screenshot beside each file).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/* global document, location, FileReader, requestAnimationFrame -- page.evaluate callbacks run in the browser */
import { chromium } from 'playwright';
import { API_ORIGIN, NOW, SCENARIOS } from './scenarios.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORK = join(APP, '.screens');
const WEB = join(WORK, 'web');

function parseArgs(argv) {
  const opts = { out: join(WORK, 'out'), viewport: '390x844', rebuild: false, only: [], probe: null, headed: false, list: false, inline: false, png: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue;
    else if (a === '--out') opts.out = resolve(argv[++i]);
    else if (a === '--viewport') opts.viewport = argv[++i];
    else if (a === '--rebuild') opts.rebuild = true;
    else if (a === '--only') opts.only.push(argv[++i]);
    else if (a === '--probe') opts.probe = argv[++i];
    else if (a === '--headed') opts.headed = true;
    else if (a === '--list') opts.list = true;
    else if (a === '--inline') opts.inline = true;
    else if (a === '--png') opts.png = true;
    else throw new Error(`Unknown option ${a}`);
  }
  const [width, height] = opts.viewport.split('x').map(Number);
  if (!width || !height) throw new Error(`--viewport takes WIDTHxHEIGHT, not ${opts.viewport}`);
  opts.size = { width, height };
  return opts;
}

/** The web build, exported once with the API at a host only the capture answers. */
function build(rebuild) {
  if (!rebuild && existsSync(join(WEB, 'index.html'))) return;
  console.log('Exporting the web build…');
  rmSync(WEB, { recursive: true, force: true });
  const run = spawnSync('pnpm', ['exec', 'expo', 'export', '--platform', 'web', '--output-dir', WEB, '--clear'], {
    cwd: APP,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_API_URL: `${API_ORIGIN}/v1`, EXPO_PUBLIC_POSTHOG_KEY: '' },
  });
  if (run.status !== 0) throw new Error('expo export failed');
}

/** The content and saved states (seed.ts, through tsx). */
function seed() {
  const run = spawnSync('pnpm', ['exec', 'tsx', 'scripts/screens/seed.ts', String(NOW)], { cwd: APP, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`seed failed:\n${run.stderr}`);
  return JSON.parse(run.stdout);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

/** Serves the export, with index.html for every route (output: 'single'). */
function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(WEB, path);
    if (!file.startsWith(WEB) || !existsSync(file) || statSync(file).isDirectory()) file = join(WEB, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** What a signed-in learner's account allows today (GET /library/usage). */
const usage = () => ({
  day: new Date(NOW).toISOString().slice(0, 10),
  resetsAt: NOW + 15 * 3600_000,
  daily: { phrases: { used: 1, limit: 5 }, cover: { used: 0, limit: 5 }, song: { used: 0, limit: 2 }, lyrics: { used: 0, limit: 6 } },
  kept: { sets: { used: 1, limit: 50 }, albums: { used: 0, limit: 20 }, songs: { used: 0, limit: 50 } },
  writers: { phrases: 'ai', cover: 'ai', lyrics: 'ai', music: 'elevenlabs' },
});

/** A second of silence (8 kHz, 8-bit mono WAV): every phrase clip. */
const SILENCE = (() => {
  const samples = 8000;
  const wav = Buffer.alloc(44 + samples, 0x80);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples, 40);
  return wav;
})();

/** The API, as the server would answer this learner; a scenario's `api` answers first. */
function answer(data, scenario) {
  return async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/v1/, '');
    const method = route.request().method();
    if (scenario.offline) return route.abort('internetdisconnected');
    const own = scenario.api?.({ path, method, url, data });
    if (own === 'hang') return;
    if (own !== undefined) return own === null ? route.abort('internetdisconnected') : json(route, own.body ?? own, own.status ?? 200);
    if (path.startsWith('/library/audio/')) return path.endsWith('.json') ? json(route, { status: 'ready' }) : route.fulfill({ status: 200, contentType: 'audio/wav', body: SILENCE });
    const { album, song } = data;
    if (path === '/library/languages') return json(route, data.languages);
    const packs = scenario.signedIn ? data.signedInPacks : data.packs;
    if (path === '/library/pack') return json(route, packs[url.searchParams.get('target')] ?? packs['es-ES']);
    if (path === `/library/shared/${data.other.set.shareCode}`) return json(route, { kind: 'set', ...data.other });
    if (path === `/library/sets/${data.other.set.id}`) return json(route, data.other);
    if (path === '/auth/capabilities') return json(route, { email: true, google: true, apple: true });
    if (path.startsWith('/library/community')) return json(route, url.searchParams.get('kind') === 'sets' ? { sets: [{ ...data.other.set, saved: false }], phrases: data.other.phrases } : { albums: [] });
    if (path === `/library/albums/${album.id}`) return json(route, { album, songs: [song] });
    if (path === `/library/songs/${song.id}`) return json(route, song);
    if (/^\/library\/sets\/[^/]+\/songs$/.test(path)) return json(route, path.includes(`/${song.setId}/`) ? { songs: [song], albums: [album] } : { songs: [], albums: [] });
    if (/^\/library\/sets\/[^/]+\/more$/.test(path)) return json(route, { sets: [], phrases: [] });
    if (/^\/library\/albums\/[^/]+\/more$/.test(path)) return json(route, { albums: [] });
    if (scenario.signedIn) {
      if (path === '/auth/refresh') return json(route, { access_token: 'screens-access', expires_in: 3600, refresh_token: 'screens-refresh' });
      if (path === '/library/usage') return json(route, usage());
      if (path === '/library/progress') return json(route, method === 'GET' ? { progress: null, revision: 0 } : { revision: 1 });
      if (path.startsWith('/library/covers/') && method === 'GET') return json(route, { covers: [], current: null });
      if (path === '/library/profile') return json(route, { displayName: 'Ana' });
      if (path.startsWith('/library/push')) return json(route, { registered: true });
    }
    if (!scenario.signedIn && method !== 'GET') return json(route, { code: 'UNAUTHORIZED', message: 'Sign in' }, 401);
    return json(route, { code: 'NOT_FOUND', message: 'Not found' }, 404);
  };
}

/** The storage a scenario starts with: the installed content and its saved state. */
function storageFor(data, scenario) {
  const items = scenario.noContent && !scenario.keepLanguages ? {} : { 'loro.content.languages': JSON.stringify(data.languages) };
  if (!scenario.noContent) for (const [lang, pack] of Object.entries(scenario.signedIn ? data.signedInPacks : data.packs)) items[`loro.content.pack.${lang}`] = JSON.stringify(pack);
  const state = data.states[scenario.state ?? 'learning'];
  if (state) items['loro.prototype.state'] = state;
  if (scenario.signedIn) {
    items['loro.refresh'] = 'screens-refresh';
    items['loro.account'] = JSON.stringify({ userId: '0192f000-0000-7000-8000-000000000001', email: 'ana@example.com', provider: 'email', displayName: 'Ana' });
  }
  return items;
}

/** Opens the scenario's page in a new context, which goes into `held` before any step can fail. */
async function open(browser, data, origin, scenario, size, held = {}) {
  const context = (held.context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Europe/London', hasTouch: true, isMobile: false, reducedMotion: 'reduce' }));
  await context.route(`${API_ORIGIN}/**`, answer(data, scenario));
  // Nothing leaves the machine: analytics, remote images and anything else not served here.
  await context.route((url) => !url.href.startsWith(origin) && !url.href.startsWith(API_ORIGIN) && !url.href.startsWith('data:') && !url.href.startsWith('blob:'), (route) => route.abort());
  await context.clock.install({ time: NOW });
  await context.addInitScript((items) => {
    if (sessionStorage.getItem('screens.seeded')) return;
    sessionStorage.setItem('screens.seeded', '1');
    localStorage.clear();
    for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
  }, storageFor(data, scenario));
  const page = await context.newPage();
  // A confirmation (Clear queue, Delete) is answered yes, as the learner going on would.
  page.on('dialog', (dialog) => void dialog.accept().catch(() => {}));
  page.on('pageerror', (error) => console.warn(`  [${scenario.name}] page error: ${error.message}`));
  await page.goto(origin + (scenario.path ?? '/'));
  await settle(page);
  if (scenario.steps) await scenario.steps(page);
  await settle(page);
  return { context, page };
}

/** Waits for the page to stop changing: fonts loaded, no pending requests, two quiet frames. */
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.waitForTimeout(400);
}

/**
 * The page as it is now, as static HTML: the app's scripts removed (one line puts scrolled lists
 * back where they were), the CSS rules React Native Web inserted
 * through the CSSOM written out and form values kept. Fonts and images are inlined as data URLs
 * (`inline`), or left as absolute URLs on the served build for `keepAssets` to copy.
 */
async function snapshot(page, title, inline) {
  return page.evaluate(async ({ title, inline }) => {
    const toData = async (url) => {
      if (!inline) return url;
      try {
        const blob = await (await fetch(url)).blob();
        return await new Promise((done) => {
          const reader = new FileReader();
          reader.onload = () => done(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch {
        return url;
      }
    };
    const inlineUrls = async (css, base) => {
      const urls = [...new Set([...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]).filter((u) => !u.startsWith('data:')))];
      for (const u of urls) css = css.split(u).join(await toData(new URL(u, base).href));
      return css;
    };
    let css = '';
    for (const sheet of document.styleSheets) {
      try {
        css += [...sheet.cssRules].map((r) => r.cssText).join('\n') + '\n';
      } catch {
        // A cross-origin sheet: nothing of ours.
      }
    }
    css = await inlineUrls(css, location.href);
    for (const el of document.querySelectorAll('input, textarea')) {
      if (el.type === 'checkbox' || el.type === 'radio') el.toggleAttribute('checked', el.checked);
      else if (el.tagName === 'TEXTAREA') el.textContent = el.value;
      else el.setAttribute('value', el.value);
    }
    // Where each scrolled list was: a short script in the file scrolls it there again.
    for (const el of document.querySelectorAll('*')) if (el.scrollTop || el.scrollLeft) el.setAttribute('data-screens-scroll', `${el.scrollLeft},${el.scrollTop}`);
    const root = document.documentElement.cloneNode(true);
    for (const el of document.querySelectorAll('[data-screens-scroll]')) el.removeAttribute('data-screens-scroll');
    root.querySelectorAll('script, noscript, link[rel="preload"], link[rel="modulepreload"], style, link[rel="stylesheet"]').forEach((el) => el.remove());
    for (const img of root.querySelectorAll('img[src]')) {
      const src = img.getAttribute('src');
      if (!src.startsWith('data:')) img.setAttribute('src', await toData(new URL(src, location.href).href));
    }
    for (const el of root.querySelectorAll('[style*="url("]')) el.setAttribute('style', await inlineUrls(el.getAttribute('style'), location.href));
    const head = root.querySelector('head');
    head.querySelector('title')?.remove();
    head.insertAdjacentHTML('afterbegin', `<meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>`);
    const style = document.createElement('style');
    style.textContent = css;
    head.appendChild(style);
    root.querySelector('body').insertAdjacentHTML(
      'beforeend',
      `<script>for (const el of document.querySelectorAll('[data-screens-scroll]')) { const [x, y] = el.dataset.screensScroll.split(',').map(Number); el.scrollLeft = x; el.scrollTop = y; }</script>`,
    );
    return '<!doctype html>\n' + root.outerHTML;
  }, { title, inline });
}

/**
 * Copies every file of the served build the HTML refers to into `out/assets` (once for all the
 * captures) and points the HTML at the copy, so the files open from disk without a server.
 */
function keepAssets(html, origin, out) {
  const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`${escaped}(/[^"'()\\s?#]+)(\\?[^"'()\\s#]*)?`, 'g'), (whole, path) => {
    const source = join(WEB, decodeURIComponent(path));
    if (!source.startsWith(WEB) || !existsSync(source) || statSync(source).isDirectory()) return whole;
    const name = `assets/${createHash('sha1').update(path).digest('hex').slice(0, 12)}${extname(path)}`;
    const target = join(out, name);
    if (!existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
    return name;
  });
}

async function capture(page, title, opts, origin) {
  const html = await snapshot(page, title, opts.inline);
  return opts.inline ? html : keepAssets(html, origin, opts.out);
}

function indexPage(results, size) {
  const groups = new Map();
  for (const r of results) {
    const g = r.scenario.group ?? 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const cards = [...groups]
    .map(
      ([group, rows]) => `<h2>${esc(group)}</h2><div class="grid">${rows
        .map(
          (r) => `<figure${r.error ? ' class="failed"' : ''}><a href="${r.file}" target="_blank"><div class="frame"><iframe src="${r.file}" loading="lazy" tabindex="-1"></iframe></div></a><figcaption><b>${esc(r.scenario.name)}</b>${r.scenario.description ? `<br>${esc(r.scenario.description)}` : ''}${r.error ? `<br><span class="err">${esc(r.error)}</span>` : ''}</figcaption></figure>`,
        )
        .join('')}</div>`,
    )
    .join('\n');
  const scale = 0.5;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Loro screens</title><style>
body{font:14px system-ui,sans-serif;margin:24px;background:#f3f1ec;color:#222}
h1{margin:0 0 4px}h2{margin:32px 0 12px;font-size:18px}
.grid{display:flex;flex-wrap:wrap;gap:20px}
figure{margin:0;width:${size.width * scale}px}
.frame{width:${size.width * scale}px;height:${size.height * scale}px;overflow:hidden;border-radius:12px;box-shadow:0 1px 4px #0003;background:#fff}
iframe{width:${size.width}px;height:${size.height}px;border:0;transform:scale(${scale});transform-origin:0 0;pointer-events:none}
figcaption{margin-top:6px;font-size:12px;line-height:1.35}
.failed .frame{outline:3px solid #c33}.err{color:#c33}
</style></head><body><h1>Loro screens</h1><p>${results.length} captures at ${size.width}×${size.height}, clock at ${new Date(NOW).toISOString()}.</p>${cards}</body></html>`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const scenarios = SCENARIOS.filter((s) => (opts.probe ? s.name === opts.probe : opts.only.length === 0 || opts.only.some((o) => s.name.includes(o))));
  if (opts.list) {
    for (const s of SCENARIOS) console.log(`${s.name.padEnd(36)} ${s.description ?? ''}`);
    return;
  }
  if (scenarios.length === 0) throw new Error('No scenario matches');
  build(opts.rebuild);
  const data = seed();
  const { server, origin } = await serve();
  const browser = await chromium.launch({ headless: !opts.headed });
  try {
    if (opts.probe) {
      const { page } = await open(browser, data, origin, scenarios[0], opts.size);
      console.log(await page.locator('body').ariaSnapshot());
      return;
    }
    mkdirSync(opts.out, { recursive: true });
    const results = [];
    for (const scenario of scenarios) {
      const file = `${scenario.name}.html`;
      process.stdout.write(`${scenario.name} … `);
      const held = {};
      try {
        const { page } = await open(browser, data, origin, scenario, opts.size, held);
        writeFileSync(join(opts.out, file), await capture(page, `Loro — ${scenario.name}`, opts, origin));
        if (opts.png) await page.screenshot({ path: join(opts.out, `${scenario.name}.png`) });
        results.push({ scenario, file });
        console.log('ok');
      } catch (error) {
        const message = String(error?.message ?? error).split('\n')[0];
        console.log(`FAILED: ${message}`);
        results.push({ scenario, file, error: message });
        // What the page showed when the step failed, so the failure can be seen.
        const page = held.context?.pages()[0];
        if (page) writeFileSync(join(opts.out, file), await capture(page, `Loro — ${scenario.name} (failed)`, opts, origin).catch(() => ''));
      } finally {
        await held.context?.close();
      }
    }
    // Merge into an existing index when only some scenarios ran.
    const indexFile = join(opts.out, 'index.json');
    const previous = existsSync(indexFile) && opts.only.length > 0 ? JSON.parse(readFileSync(indexFile, 'utf8')) : [];
    const byName = new Map(previous.map((r) => [r.name, r]));
    for (const r of results) byName.set(r.scenario.name, { name: r.scenario.name, file: r.file, error: r.error ?? null });
    const order = SCENARIOS.map((s) => s.name).filter((n) => byName.has(n));
    writeFileSync(indexFile, JSON.stringify(order.map((n) => byName.get(n)), null, 2));
    const all = order.map((n) => ({ scenario: SCENARIOS.find((s) => s.name === n), file: byName.get(n).file, error: byName.get(n).error }));
    writeFileSync(join(opts.out, 'index.html'), indexPage(all, opts.size));
    const failed = results.filter((r) => r.error).length;
    console.log(`\n${results.length - failed}/${results.length} captured into ${opts.out}/index.html`);
    if (failed) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
