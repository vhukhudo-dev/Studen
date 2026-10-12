// Timeline engine: turns script/beats.json + script/timings.json into a
// deterministic 3D animation. window.renderAt(t) draws the frame at t seconds.
import { THREE, clamp, ramp, eo, eio, lerp, hash, setFont } from './kit.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SCENES } from './scenes.js';

const W = 1920, H = 1080;
const params = new URLSearchParams(location.search);
const corner = params.get('corner') === 'left' ? 'left' : 'right';
document.body.classList.toggle('corner-left', corner === 'left');
if (params.has('pip')) document.body.classList.add('show-pip');

const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
// No timings yet (nothing recorded/aligned): spread beats over ~3 minutes by word count.
function estimateTimings(script, duration = 180) {
  const words = script.beats.map((b) => b.text.split(/\s+/).length);
  const per = (duration - 1.5) / words.reduce((a, b) => a + b, 0);
  let t = 0.5;
  return { method: 'estimate', duration, beats: script.beats.map((b, i) => { const start = i ? t : 0; t += words[i] * per; return { id: b.id, start, cues: [] }; }) };
}
const [script, timingsFile, fontJson] = await Promise.all([
  getJSON('../script/beats.json'),
  getJSON(params.get('timings') || '../script/timings.json').catch(() => null),
  getJSON('../node_modules/three/examples/fonts/helvetiker_bold.typeface.json'),
]);
const timings = timingsFile || estimateTimings(script);
setFont(new FontLoader().parse(fontJson));

// ---------- timeline ----------
const DURATION = timings.duration;
const tmap = Object.fromEntries(timings.beats.map((b) => [b.id, b]));
const beats = script.beats.map((b) => ({ ...b, cues: b.cues || [], start: tmap[b.id]?.start ?? 0, cueTimes: tmap[b.id]?.cues || [] }));
beats.forEach((b, i) => {
  b.end = i + 1 < beats.length ? beats[i + 1].start : DURATION;
  if (b.cueTimes.length !== b.cues.length) {
    const n = b.cues.length, d = b.end - b.start;
    b.cueTimes = b.cues.map((_, j) => b.start + d * (0.08 + 0.8 * j / Math.max(1, n)));
  }
});
const slideTitle = Object.fromEntries(script.slides.map((s) => [s.n, s.title]));
const slideStart = {};
beats.forEach((b) => { slideStart[b.slide] ??= b.start; });
const beatAt = (t) => { let k = 0; for (let i = 0; i < beats.length; i++) if (beats[i].start <= t) k = i; return beats[k]; };

// ---------- renderer ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
scene.fog = new THREE.Fog(0x070b16, 22, 60);

const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x0b1220, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(6, 9, 12); scene.add(key);
const rimA = new THREE.PointLight(0xf59e0b, 60, 40); rimA.position.set(-9, 6, -3); scene.add(rimA);
const rimB = new THREE.PointLight(0x38bdf8, 40, 40); rimB.position.set(9, -2, 4); scene.add(rimB);

// ---------- ambient background ----------
const SLIDE_LOOK = {
  1: { a: '#2a1430', b: '#070912', accent: '#f59e0b', rim: 0xf97316 },
  2: { a: '#13224d', b: '#050914', accent: '#60a5fa', rim: 0x6366f1 },
  3: { a: '#08343a', b: '#041015', accent: '#2dd4bf', rim: 0x14b8a6 },
  4: { a: '#0c3324', b: '#04110c', accent: '#fbbf24', rim: 0x22c55e },
};
const bgEl = document.getElementById('bg');
const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const N = 600, pos = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  pos[i * 3] = (hash(i) - 0.5) * 60; pos[i * 3 + 1] = (hash(i + 0.37) - 0.35) * 24; pos[i * 3 + 2] = -hash(i + 0.71) * 40 + 4;
}
const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const pmat = new THREE.PointsMaterial({ size: 0.16, map: dotTex, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xf59e0b });
const particles = new THREE.Points(pg, pmat); scene.add(particles);
const grid = new THREE.GridHelper(90, 90, 0x64748b, 0x334155);
grid.position.y = -2.3; grid.material.transparent = true; grid.material.opacity = 0.16; grid.material.depthWrite = false; scene.add(grid);
const wires = [0, 1, 2].map((i) => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + i * 1.5, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.05 }));
  m.position.set([-16, 15, 2][i], [7, 4, 11][i], [-22, -26, -34][i]); scene.add(m); return m;
});

// ---------- scenes ----------
const labelsEl = document.getElementById('labels');
const labels = [];
let building = null;
const api = {
  // DOM label pinned to a 3D object. Returns a handle with .fade and .html().
  label(anchor, html, cls = '', offset = [0, 0, 0]) {
    const el = document.createElement('div'); el.className = `lbl ${cls}`; el.innerHTML = html; labelsEl.appendChild(el);
    const L = { el, anchor, offset: new THREE.Vector3(...offset), fade: 1, scene: building, html: (h) => { if (L._h !== h) { el.innerHTML = h; L._h = h; } } };
    labels.push(L); return L;
  },
};
const scenes = [];
for (const b of beats) {
  let sc = scenes[scenes.length - 1];
  if (!sc || sc.key !== b.scene) { sc = { key: b.scene, beats: [] }; scenes.push(sc); }
  sc.beats.push(b);
}
for (const sc of scenes) {
  sc.start = sc.beats[0].start; sc.end = sc.beats[sc.beats.length - 1].end;
  sc.outer = new THREE.Group(); building = sc;
  const builder = SCENES[sc.key];
  if (!builder) throw new Error(`no scene builder for "${sc.key}"`);
  Object.assign(sc, builder(api));
  sc.outer.add(sc.group); sc.outer.visible = false; scene.add(sc.outer);
}
building = null;

const IN = 0.9, OUT = 0.55;
function applyOpacity(obj, f) {
  f *= obj.visible ? (obj.userData.fade ?? 1) : 0;
  obj.userData.acc = f;
  const m = obj.material;
  if (m && !Array.isArray(m)) {
    if (m.userData.base === undefined) { m.userData.base = m.opacity; m.userData.dw = m.depthWrite; }
    m.opacity = m.userData.base * f;
    m.depthWrite = m.userData.dw && f > 0.97;
    m.visible = f > 0.004;
  }
  for (const c of obj.children) applyOpacity(c, f);
}

function stateFor(sc, t) {
  let b = sc.beats[0];
  for (const x of sc.beats) if (x.start <= t) b = x;
  const stepStart = (k) => { const x = sc.beats.find((y) => y.step === k); return x ? x.start : Infinity; };
  return {
    t, T: t - sc.start, dur: sc.end - sc.start, beat: b, step: b.step, st: t - b.start, sd: b.end - b.start,
    since: (k) => t - stepStart(k),
    cue: (i) => t - (b.cueTimes[i] ?? b.start),
    cueOf: (k, i) => { const x = sc.beats.find((y) => y.step === k); return x ? t - (x.cueTimes[i] ?? x.start) : -1e9; },
  };
}

const CAM = { pos: [0, 1.4, 14.5], target: [0, 0.9, 0] };
function camFor(sc, t) {
  const c = sc?.cam || CAM;
  const push = sc ? eio(ramp(t, sc.start, sc.end + OUT)) * 0.9 : 0;
  return { pos: [c.pos[0], c.pos[1], c.pos[2] - push], target: c.target };
}

// ---------- DOM overlay ----------
const header = document.getElementById('header');
const hNum = header.querySelector('.num'), hTitle = header.querySelector('.title');
const hDots = [...header.querySelectorAll('.dots b')];
const cap = document.getElementById('caption'), capH = cap.querySelector('.h'), capS = cap.querySelector('.s');
const mixHex = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

const tmpV = new THREE.Vector3(), tmpT = new THREE.Vector3();
function renderAt(t) {
  t = clamp(t, 0, DURATION);
  const beat = beatAt(t);
  const n = beat.slide;

  // background look, blended across slide changes
  const k = eio(ramp(t, slideStart[n], slideStart[n] + 1.2));
  const prev = SLIDE_LOOK[n - 1] || SLIDE_LOOK[n], cur = SLIDE_LOOK[n];
  const ca = mixHex(prev.a, cur.a, k), cb = mixHex(prev.b, cur.b, k), acc = mixHex(prev.accent, cur.accent, k);
  bgEl.style.background = `radial-gradient(1400px 900px at 62% 32%, ${ca}, ${cb} 72%)`;
  document.documentElement.style.setProperty('--accent', acc);
  scene.fog.color.set(cb);
  pmat.color.set(acc);
  rimA.color.set(new THREE.Color(prev.rim).lerp(new THREE.Color(cur.rim), k));
  particles.rotation.y = t * 0.012; particles.position.y = Math.sin(t * 0.15) * 0.4;
  wires.forEach((w, i) => { w.rotation.x = t * (0.03 + i * 0.01); w.rotation.y = t * (0.05 - i * 0.012); });

  // scenes
  let active = null, prevScene = null;
  for (const sc of scenes) {
    if (sc.start <= t) { prevScene = active; active = sc; }
    const on = t >= sc.start - 0.001 && t <= sc.end + OUT;
    sc.active = on; sc.outer.visible = on;
    if (!on) continue;
    const a = eo(ramp(t, sc.start, sc.start + IN));
    const o = sc === scenes[scenes.length - 1] ? 0 : eio(ramp(t, sc.end, sc.end + OUT));
    sc.outer.position.set(0, -(1 - a) * 1.2 + o * 0.8, o * 2.2);
    sc.outer.rotation.set(0, (1 - a) * -0.55 + o * 0.3, 0);
    sc.outer.scale.setScalar(0.86 + 0.14 * a);
    sc.update?.(stateFor(sc, t));
    applyOpacity(sc.outer, a * (1 - o));
  }

  // camera: blend from the previous scene's framing to the current one
  const cNow = camFor(active, t), cPrev = camFor(prevScene || active, t);
  const kb = active ? eio(ramp(t, active.start - 0.2, active.start + 1.3)) : 1;
  const P = cNow.pos.map((v, i) => lerp(cPrev.pos[i], v, kb)), T = cNow.target.map((v, i) => lerp(cPrev.target[i], v, kb));
  camera.position.set(P[0] + Math.sin(t * 0.21) * 0.45, P[1] + Math.sin(t * 0.17) * 0.22, P[2]);
  camera.lookAt(T[0], T[1], T[2]);
  camera.updateMatrixWorld();

  // labels
  for (const L of labels) {
    if (!L.scene.active) { L.el.style.display = 'none'; continue; }
    const f = (L.anchor.userData.acc ?? 0) * L.fade * clamp(L.anchor.scale.x);
    if (f < 0.01) { L.el.style.display = 'none'; continue; }
    L.anchor.getWorldPosition(tmpV).add(L.offset).project(camera);
    if (tmpV.z > 1) { L.el.style.display = 'none'; continue; }
    L.el.style.display = 'block';
    L.el.style.opacity = f.toFixed(3);
    L.el.style.left = `${((tmpV.x + 1) / 2 * W).toFixed(1)}px`;
    L.el.style.top = `${((1 - tmpV.y) / 2 * H).toFixed(1)}px`;
  }

  // header + caption
  hNum.textContent = String(n).padStart(2, '0');
  hTitle.textContent = slideTitle[n];
  const slideEnd = Math.max(...beats.filter((b) => b.slide === n).map((b) => b.end));
  hDots.forEach((d, i) => { d.style.width = i + 1 < n ? '100%' : i + 1 === n ? `${(ramp(t, slideStart[n], slideEnd) * 100).toFixed(1)}%` : '0%'; });
  header.style.opacity = eo(t / 0.8).toFixed(3);
  if (capH.textContent !== beat.headline) { capH.textContent = beat.headline; capS.textContent = beat.sub || ''; }
  const inA = eo((t - beat.start) / 0.45);
  const outA = beat === beats[beats.length - 1] ? 1 : clamp((beat.end - t) / 0.22);
  cap.style.opacity = Math.min(inA, outA).toFixed(3);
  cap.style.transform = `translateY(${((1 - inA) * 26).toFixed(1)}px)`;

  renderer.render(scene, camera);
}

window.DURATION = DURATION;
window.renderAt = renderAt;
window.beats = beats;
renderAt(+params.get('t') || 0);
window.ready = true;

// Live preview: open index.html?live (optionally &audio=path/to/voice.mp3&t=start).
if (params.has('live')) {
  const audio = params.get('audio') ? new Audio(params.get('audio')) : null;
  const t0 = +params.get('t') || 0;
  let startMs = null;
  const go = () => {
    if (audio) { audio.currentTime = t0; audio.play(); }
    startMs = performance.now();
    const loop = () => {
      const t = audio ? audio.currentTime : t0 + (performance.now() - startMs) / 1000;
      renderAt(t);
      if (t < DURATION) requestAnimationFrame(loop);
    };
    loop();
  };
  audio ? document.addEventListener('click', go, { once: true }) : go();
}
