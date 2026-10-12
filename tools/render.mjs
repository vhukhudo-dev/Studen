#!/usr/bin/env node
// Render the 3D animation to an MP4 by stepping the page frame by frame.
//
//   node tools/render.mjs --out work/animation.mp4 [--fps 30] [--from 0] [--to 12]
//        [--corner right|left] [--workers 3] [--stills 5,30,61.5 --stills-dir work/stills]
//
// The page is deterministic (window.renderAt(t)), so frames can be split across
// several browser workers and stitched back together.
import { createServer } from 'node:http';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); }
})();

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const FPS = +(args.fps || 30);
const OUT = resolve(args.out || join(ROOT, 'work', 'animation.mp4'));
const CORNER = args.corner || 'right';
const WORKERS = +(args.workers || 3);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, p);
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/animation/index.html?corner=${CORNER}${args.pip ? '&pip' : ''}`;

const launch = () => chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none'],
});

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(base);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

const shot = (page, t, type = 'jpeg') =>
  page.evaluate((tt) => window.renderAt(tt), t).then(() => page.screenshot({ type, quality: type === 'jpeg' ? 92 : undefined, animations: 'disabled', caret: 'hide' }));

// Stills mode: a handful of PNG frames for quick visual checks.
if (args.stills) {
  const dir = resolve(args['stills-dir'] || join(ROOT, 'work', 'stills'));
  await mkdir(dir, { recursive: true });
  const browser = await launch(); const page = await openPage(browser);
  for (const t of args.stills.split(',').map(Number)) {
    await writeFile(join(dir, `t${t.toFixed(2).padStart(7, '0')}.png`), await shot(page, t, 'png'));
  }
  await browser.close(); server.close();
  console.log(`stills written to ${dir}`);
  process.exit(0);
}

const probe = await launch();
const DURATION = await (await openPage(probe)).evaluate(() => window.DURATION);
await probe.close();
const from = +(args.from || 0), to = Math.min(+(args.to || DURATION), DURATION);
const total = Math.round((to - from) * FPS);
console.log(`rendering ${total} frames (${(to - from).toFixed(1)}s @ ${FPS}fps) with ${WORKERS} workers`);

const tmp = join(dirname(OUT), `.parts-${process.pid}`);
await mkdir(tmp, { recursive: true });
const per = Math.ceil(total / WORKERS);
let done = 0; const t0 = Date.now();
const progress = setInterval(() => {
  const el = (Date.now() - t0) / 1000, rate = done / Math.max(el, 1e-3);
  process.stdout.write(`\r  ${done}/${total} frames  ${rate.toFixed(1)} fps  eta ${((total - done) / Math.max(rate, 1e-3) / 60).toFixed(1)} min   `);
}, 2000);

async function worker(w) {
  const a = w * per, b = Math.min(total, a + per);
  if (a >= b) return null;
  const part = join(tmp, `part${w}.mp4`);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', part], { stdio: ['pipe', 'inherit', 'inherit'] });
  const browser = await launch(); const page = await openPage(browser);
  for (let f = a; f < b; f++) {
    const buf = await shot(page, from + f / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error(`ffmpeg exit ${c}`)) : r())));
  await browser.close();
  return part;
}

const parts = (await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)))).filter(Boolean);
clearInterval(progress);
await writeFile(join(tmp, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
await new Promise((r, j) => spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-c', 'copy', OUT], { stdio: 'inherit' })
  .on('close', (c) => (c ? j(new Error('concat failed')) : r())));
await rm(tmp, { recursive: true, force: true });
server.close();
console.log(`\nwrote ${OUT} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
