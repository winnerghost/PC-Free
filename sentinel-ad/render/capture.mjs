#!/usr/bin/env node
/* Frame-accurate renderer for the Sentinel film.
 *
 *   node render/capture.mjs --w 1080 --h 1920 --out out/sentinel-9x16.mp4
 *   node render/capture.mjs --w 1080 --h 1920 --stills 0,3.2,6.5 --outdir out/stills
 *
 * Every output frame is the average of N sub-frames spread across a 180°
 * shutter (real motion blur). Work is split across parallel headless
 * browsers; each writes an H.264 chunk and the chunks are joined losslessly.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import url from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = await import('playwright')); }

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);
const W = +(args.w || 1080), H = +(args.h || 1920);
const FPS = +(args.fps || 60);
const SUB = +(args.sub || 1);           // extra sub-frames blended by ffmpeg (the page does its own motion blur)
const LAUNCH = { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] };
const SHUTTER = +(args.shutter || 0.5); // 0.5 = 180° shutter
const WORKERS = +(args.workers || 3);
const CRF = +(args.crf || 20);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(p.endsWith(path.sep) ? path.join(p, 'index.html') : p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const PAGE = `http://127.0.0.1:${PORT}/index.html?render&w=${W}&h=${H}&mb=${args.mb || 4}${args.query ? '&' + args.query : ''}`;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  const cdp = await page.context().newCDPSession(page);
  return { page, cdp };
}
async function shot(page, cdp, t, frame) {
  await page.evaluate(([tt, ff]) => window.__render(tt, ff), [t, frame]);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
  return Buffer.from(data, 'base64');
}

function ffmpeg(argv) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed\n' + err.slice(-3000))))));
  return { p, done };
}
const write = (stream, buf) => new Promise((res, rej) => (stream.write(buf, (e) => (e ? rej(e) : res())) ));

// ── stills ────────────────────────────────────────────────────────────────
if (args.stills) {
  const outdir = path.resolve(args.outdir || path.join(ROOT, 'out', 'stills'));
  await mkdir(outdir, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const { page, cdp } = await openPage(browser);
  for (const ts of String(args.stills).split(',')) {
    const t = +ts;
    const png = await shot(page, cdp, t, Math.round(t * FPS));
    const f = path.join(outdir, `t${t.toFixed(2).padStart(5, '0')}_${W}x${H}.png`);
    await writeFile(f, png);
    console.log(f);
  }
  await browser.close();
  server.close();
  process.exit(0);
}

// ── video ─────────────────────────────────────────────────────────────────
const out = path.resolve(args.out || path.join(ROOT, 'out', `sentinel_${W}x${H}.mp4`));
const tmp = path.join(path.dirname(out), `.chunks_${W}x${H}`);
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
const browser0 = await chromium.launch(LAUNCH);
const info = await (async () => { const { page } = await openPage(browser0); const i = await page.evaluate(() => window.__info); await page.close(); return i; })();
await browser0.close();
const DUR = +(args.duration || info.duration);
const N = Math.round(DUR * FPS);
const FROM = +(args.from || 0), TO = Math.min(N, +(args.to || N));
const total = TO - FROM;
console.log(`Rendering ${W}x${H} @ ${FPS}fps, ${total} frames x ${SUB} sub-frames, ${WORKERS} workers`);

const t0 = Date.now();
let doneFrames = 0;
const chunks = [];
const ranges = [];
for (let k = 0; k < WORKERS; k++) {
  const a = FROM + Math.floor((total * k) / WORKERS), b = FROM + Math.floor((total * (k + 1)) / WORKERS);
  if (b > a) ranges.push([a, b]);
}
await Promise.all(ranges.map(async ([a, b], k) => {
  const file = path.join(tmp, `chunk_${String(k).padStart(2, '0')}.mp4`);
  chunks.push(file);
  const vf = SUB > 1
    ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),format=yuv420p`
    : `setpts=N/(${FPS}*TB),format=yuv420p`;
  const ff = ffmpeg(['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS * SUB), '-i', '-',
    '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-tune', String(args.tune || 'grain'),
    '-x264-params', String(args.x264 || 'aq-mode=3:aq-strength=0.8:deblock=-1,-1'), '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-pix_fmt', 'yuv420p', '-threads', '2', file]);
  const browser = await chromium.launch(LAUNCH);
  const { page, cdp } = await openPage(browser);
  for (let f = a; f < b; f++) {
    for (let s = 0; s < SUB; s++) {
      const off = SUB > 1 ? ((s + 0.5) / SUB - 0.5) * SHUTTER : 0;
      const t = (f + off) / FPS;
      const png = await shot(page, cdp, ((t % DUR) + DUR) % DUR, f);
      await write(ff.p.stdin, png);
    }
    doneFrames++;
    if (doneFrames % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`  ${doneFrames}/${total} frames  ${el.toFixed(0)}s elapsed  ~${((el / doneFrames) * (total - doneFrames)).toFixed(0)}s left`);
    }
  }
  ff.p.stdin.end();
  await ff.done;
  await browser.close();
}));
chunks.sort();
await writeFile(path.join(tmp, 'list.txt'), chunks.map((c) => `file '${c}'`).join('\n'));
const audio = args.audio ? path.resolve(args.audio) : null;
const joinArgs = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt')];
if (audio) joinArgs.push('-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
joinArgs.push('-c:v', 'copy', '-movflags', '+faststart', out);
await ffmpeg(joinArgs).done;
await rm(tmp, { recursive: true, force: true });
console.log(`Done: ${out}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
server.close();
process.exit(0);
