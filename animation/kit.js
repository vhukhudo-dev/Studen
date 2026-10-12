// Small toolkit of 3D building blocks shared by all scenes.
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE };

export const C = {
  teal: 0x2dd4bf, sky: 0x38bdf8, amber: 0xf59e0b, red: 0xef4444, violet: 0xa78bfa,
  green: 0x34d399, gold: 0xfbbf24, white: 0xe8eefc, slate: 0x334155, dark: 0x0f172a,
  ink: 0x1e293b, steel: 0x94a3b8, blue: 0x60a5fa,
};

// ---------- easing ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ramp = (t, a, b) => clamp((t - a) / (b - a));
export const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const back = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const wave = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * Math.PI * 2);
// Deterministic pseudo-random in [0,1) from a number.
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- materials & primitives ----------
export function M(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, metalness: o.metal ?? 0.25, roughness: o.rough ?? 0.35,
    emissive: o.emissive ?? (o.glow ? color : 0x000000), emissiveIntensity: o.glow ?? o.ei ?? 1,
    transparent: true, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
    depthWrite: o.depthWrite ?? true,
  });
}
const mesh = (g, m) => new THREE.Mesh(g, m);
export const rbox = (w, h, d, color, o = {}) =>
  mesh(new RoundedBoxGeometry(w, h, d, 3, o.r ?? Math.min(w, h, d) * 0.2), M(color, o));
export const box = (w, h, d, color, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), M(color, o));
export const cyl = (rt, rb, h, color, o = {}, seg = 40) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(color, o));
export const sphere = (r, color, o = {}) => mesh(new THREE.SphereGeometry(r, 32, 20), M(color, o));
export const torus = (R, r, color, o = {}, arcLen = Math.PI * 2) => mesh(new THREE.TorusGeometry(R, r, 14, 96, arcLen), M(color, o));
export const cone = (r, h, color, o = {}) => mesh(new THREE.ConeGeometry(r, h, 32), M(color, o));

export function group(...kids) { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; }
export function at(obj, x, y, z = 0) { obj.position.set(x, y, z); return obj; }
export function rot(obj, x = 0, y = 0, z = 0) { obj.rotation.set(x, y, z); return obj; }

// ---------- 3D text ----------
let FONT = null;
export function setFont(f) { FONT = f; }
const textCache = new Map();
export function txt(str, size, color, o = {}) {
  const key = `${str}|${size}|${o.depth ?? 0.25}`;
  let g = textCache.get(key);
  if (!g) {
    g = new TextGeometry(str, {
      font: FONT, size, depth: o.depth ?? size * 0.28, curveSegments: 6,
      bevelEnabled: true, bevelThickness: size * 0.04, bevelSize: size * 0.025, bevelSegments: 3,
    });
    g.center();
    textCache.set(key, g);
  }
  return mesh(g, M(color, { metal: 0.55, rough: 0.25, ...o }));
}

// ---------- extruded shapes ----------
export function extrude(shape, depth, color, o = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: depth * 0.25, bevelSize: depth * 0.18, bevelSegments: 3, curveSegments: 18,
  });
  g.center();
  return mesh(g, M(color, o));
}
const poly = (pts) => { const s = new THREE.Shape(); s.moveTo(...pts[0]); pts.slice(1).forEach((p) => s.lineTo(...p)); s.closePath(); return s; };

export function bolt(h, color, o = {}) {
  const k = h / 3;
  return extrude(poly([[0.3, 1.5], [-0.75, -0.1], [-0.05, -0.1], [-0.35, -1.5], [0.8, 0.25], [0.1, 0.25], [0.55, 1.5]].map(([x, y]) => [x * k, y * k])), 0.3 * k, color, { glow: 0.6, ...o });
}
export function check(s, color = C.green, o = {}) {
  return extrude(poly([[-1, 0.1], [-0.35, -0.6], [1, 0.8], [0.75, 1.05], [-0.35, -0.08], [-0.75, 0.38]].map(([x, y]) => [x * s, y * s])), 0.3 * s, color, { glow: 0.35, ...o });
}
export function cross(s, color = C.red, o = {}) {
  const g = group(rot(rbox(2.2 * s, 0.5 * s, 0.4 * s, color, { glow: 0.4, ...o }), 0, 0, Math.PI / 4),
                  rot(rbox(2.2 * s, 0.5 * s, 0.4 * s, color, { glow: 0.4, ...o }), 0, 0, -Math.PI / 4));
  return g;
}
function shieldOutline(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 1.6 * s); sh.lineTo(-1.4 * s, 1.25 * s); sh.lineTo(-1.4 * s, 0.2 * s);
  sh.quadraticCurveTo(-1.3 * s, -1.2 * s, 0, -1.8 * s); sh.quadraticCurveTo(1.3 * s, -1.2 * s, 1.4 * s, 0.2 * s);
  sh.lineTo(1.4 * s, 1.25 * s); sh.closePath();
  return sh;
}
export const shield = (s, color, o = {}) => extrude(shieldOutline(s), 0.35 * s, color, { metal: 0.6, rough: 0.25, ...o });
// A shield made of two halves with a jagged crack between them.
export function crackedShield(s, color, o = {}) {
  const zig = [[0, 1.6], [-0.1, 0.9], [0.18, 0.2], [-0.12, -0.5], [0.15, -1.2], [0, -1.8]];
  const L = new THREE.Shape(); L.moveTo(0, 1.6 * s); L.lineTo(-1.4 * s, 1.25 * s); L.lineTo(-1.4 * s, 0.2 * s);
  L.quadraticCurveTo(-1.3 * s, -1.2 * s, 0, -1.8 * s); [...zig].reverse().slice(1).forEach(([x, y]) => L.lineTo(x * s, y * s));
  const R = new THREE.Shape(); R.moveTo(0, 1.6 * s); zig.slice(1).forEach(([x, y]) => R.lineTo(x * s, y * s));
  R.quadraticCurveTo(1.3 * s, -1.2 * s, 1.4 * s, 0.2 * s); R.lineTo(1.4 * s, 1.25 * s); R.closePath();
  const mk = (shape) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.35 * s, bevelEnabled: true, bevelThickness: 0.08 * s, bevelSize: 0.05 * s, bevelSegments: 2, curveSegments: 18 });
    g.translate(0, 0, -0.175 * s);
    return mesh(g, M(color, { metal: 0.6, rough: 0.25, ...o }));
  };
  const left = mk(L), right = mk(R);
  return { group: group(left, right), left, right };
}
export function heart(s, color, o = {}) {
  const h = new THREE.Shape();
  h.moveTo(0, -1.0 * s);
  h.bezierCurveTo(-0.2 * s, -0.75 * s, -1.2 * s, -0.25 * s, -1.2 * s, 0.35 * s);
  h.bezierCurveTo(-1.2 * s, 0.95 * s, -0.4 * s, 1.15 * s, 0, 0.6 * s);
  h.bezierCurveTo(0.4 * s, 1.15 * s, 1.2 * s, 0.95 * s, 1.2 * s, 0.35 * s);
  h.bezierCurveTo(1.2 * s, -0.25 * s, 0.2 * s, -0.75 * s, 0, -1.0 * s);
  return extrude(h, 0.4 * s, color, { glow: 0.25, ...o });
}
export function triangle(s, color, o = {}) {
  const sh = poly([[0, 1.1 * s], [-1.25 * s, -0.95 * s], [1.25 * s, -0.95 * s]]);
  const g = group(extrude(sh, 0.3 * s, color, { glow: 0.3, ...o }));
  const bang = txt('!', 0.9 * s, C.dark, { depth: 0.12 * s, metal: 0.1 });
  bang.position.set(0, -0.1 * s, 0.25 * s); g.add(bang);
  return g;
}
export function chevrons(s, color, o = {}) {
  const g = group();
  for (let i = 0; i < 3; i++) {
    const c = extrude(poly([[-0.5, 0.8], [0.2, 0], [-0.5, -0.8], [-0.15, -0.8], [0.55, 0], [-0.15, 0.8]].map(([x, y]) => [x * s, y * s])), 0.3 * s, color, { glow: 0.4, ...o });
    c.position.x = (i - 1) * 0.65 * s; g.add(c);
  }
  return g;
}
export function gear(r, color, o = {}, teeth = 10) {
  const sh = new THREE.Shape();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.78 : r;
    const p0 = [Math.cos(a0) * rr, Math.sin(a0) * rr], p1 = [Math.cos(a1) * rr, Math.sin(a1) * rr];
    if (i === 0) sh.moveTo(...p0); else sh.lineTo(...p0);
    sh.lineTo(...p1);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.32, 0, Math.PI * 2, true); sh.holes.push(hole);
  return extrude(sh, r * 0.3, color, { metal: 0.7, rough: 0.3, ...o });
}

// ---------- composite icons ----------
export function pin(s, color, o = {}) {
  const head = sphere(0.45 * s, color, { glow: 0.3, ...o }); head.position.y = 0.55 * s;
  const tip = cone(0.32 * s, 0.8 * s, color, o); tip.rotation.x = Math.PI; tip.position.y = 0.05 * s;
  const dot = sphere(0.17 * s, C.white, { glow: 0.6 }); dot.position.set(0, 0.6 * s, 0.33 * s);
  return group(head, tip, dot);
}
export function person(s, color, o = {}) {
  const body = mesh(new THREE.CapsuleGeometry(0.32 * s, 0.6 * s, 6, 16), M(color, o)); body.position.y = 0.62 * s;
  const head = sphere(0.27 * s, color, o); head.position.y = 1.5 * s;
  return group(body, head);
}
export function cloud(s, color = C.white, o = {}) {
  const g = group();
  [[0, 0, 0.9], [-0.95, -0.25, 0.65], [0.95, -0.2, 0.7], [0.45, 0.45, 0.62], [-0.45, 0.35, 0.6]].forEach(([x, y, r]) =>
    g.add(at(sphere(r * s, color, { rough: 0.6, metal: 0, ...o }), x * s, y * s, 0)));
  return g;
}
export function store(s, color = C.slate, o = {}) {
  const body = rbox(2 * s, 1.4 * s, 1.4 * s, color, o); body.position.y = 0.7 * s;
  const awn = rbox(2.2 * s, 0.3 * s, 0.5 * s, o.awning ?? C.red, { glow: 0.15 }); awn.position.set(0, 1.25 * s, 0.75 * s);
  const door = box(0.5 * s, 0.8 * s, 0.05 * s, C.dark); door.position.set(0, 0.4 * s, 0.71 * s);
  const win = box(0.55 * s, 0.4 * s, 0.05 * s, C.gold, { glow: 0.6 }); win.position.set(-0.6 * s, 0.7 * s, 0.71 * s);
  const win2 = win.clone(); win2.material = win.material.clone(); win2.position.x = 0.6 * s;
  const roof = box(2.1 * s, 0.12 * s, 1.5 * s, C.ink); roof.position.y = 1.46 * s;
  const g = group(body, awn, door, win, win2, roof);
  g.userData.windows = [win, win2];
  return g;
}
export function lock(s, color, open = false, o = {}) {
  const body = rbox(1.2 * s, 1.0 * s, 0.5 * s, color, { metal: 0.6, ...o });
  const shackle = torus(0.38 * s, 0.09 * s, C.steel, { metal: 0.9, rough: 0.2 }, Math.PI);
  shackle.position.y = 0.5 * s;
  const legs = [-0.38, 0.38].map((x) => at(cyl(0.09 * s, 0.09 * s, 0.3 * s, C.steel, { metal: 0.9, rough: 0.2 }), x * s, 0.5 * s, 0));
  const top = group(shackle, ...legs);
  const hole = at(cyl(0.1 * s, 0.1 * s, 0.1 * s, C.dark), 0, 0, 0.26 * s); hole.rotation.x = Math.PI / 2;
  const g = group(body, top, hole);
  g.userData.shackle = top;
  g.userData.setOpen = (k) => { top.position.y = 0.32 * s * k; top.rotation.y = k * 0.9; top.position.x = -0.38 * s * k * 0.6; };
  g.userData.setOpen(open ? 1 : 0);
  return g;
}
export function database(s, color, o = {}) {
  const g = group();
  for (let i = 0; i < 3; i++) {
    const d = cyl(0.9 * s, 0.9 * s, 0.5 * s, color, { metal: 0.5, ...o }); d.position.y = i * 0.6 * s; g.add(d);
    const ring = torus(0.9 * s, 0.035 * s, C.white, { glow: 0.5 }); ring.rotation.x = Math.PI / 2; ring.position.y = i * 0.6 * s + 0.27 * s; g.add(ring);
  }
  return g;
}
export function rack(s, led, o = {}) {
  const body = rbox(2 * s, 3 * s, 1.4 * s, 0x111827, { metal: 0.6, rough: 0.3 }); body.position.y = 1.5 * s;
  const g = group(body); const leds = [];
  for (let i = 0; i < 6; i++) {
    const slot = box(1.6 * s, 0.3 * s, 0.05 * s, 0x1f2937); slot.position.set(0, (0.4 + i * 0.44) * s, 0.71 * s); g.add(slot);
    const l = box(0.35 * s, 0.08 * s, 0.06 * s, led, { glow: 1.2 }); l.position.set(0.5 * s, (0.4 + i * 0.44) * s, 0.74 * s); g.add(l); leds.push(l);
  }
  g.userData.leds = leds;
  return g;
}
export function battery(s, o = {}) {
  const shell = cyl(0.55 * s, 0.55 * s, 1.6 * s, 0x1f2937, { metal: 0.6, opacity: 0.55, depthWrite: false }); shell.position.y = 0.8 * s;
  const cap = cyl(0.22 * s, 0.22 * s, 0.2 * s, C.steel, { metal: 0.9 }); cap.position.y = 1.7 * s;
  const g = group(shell, cap); const cells = [];
  for (let i = 0; i < 4; i++) { const c = cyl(0.45 * s, 0.45 * s, 0.3 * s, C.green, { glow: 0.6 }); c.position.y = (0.25 + i * 0.36) * s; g.add(c); cells.push(c); }
  g.userData.cells = cells;
  return g;
}
export function coins(n, s, o = {}) {
  const g = group();
  for (let i = 0; i < n; i++) { const c = cyl(0.42 * s, 0.42 * s, 0.14 * s, C.gold, { metal: 0.9, rough: 0.2, ...o }); c.position.y = i * 0.16 * s; g.add(c); }
  return g;
}

// ---------- progress rings & drawn tubes ----------
// Ring that fills clockwise from 12 o'clock; call .set(p) with p in [0,1].
export function arcRing(R, r, color, o = {}) {
  const m = mesh(new THREE.BufferGeometry(), M(color, { side: THREE.DoubleSide, glow: 0.5, ...o }));
  m.rotation.z = -Math.PI / 2; m.scale.x = -1;
  let last = -1;
  m.userData.set = (p) => {
    p = clamp(p); const q = Math.round(p * 240) / 240;
    if (q === last) return; last = q;
    m.geometry.dispose();
    m.geometry = new THREE.TorusGeometry(R, r, 12, 120, Math.max(1e-4, q * Math.PI * 2));
    m.visible = q > 0;
  };
  m.userData.set(0);
  return m;
}
// Tube along points that can be "drawn" progressively with .set(p).
export function drawTube(points, r, color, o = {}, segs = 160) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const radial = 10;
  const g = new THREE.TubeGeometry(curve, segs, r, radial, false);
  const m = mesh(g, M(color, { glow: 0.45, ...o }));
  m.userData.curve = curve;
  m.userData.set = (p) => { g.setDrawRange(0, Math.floor(clamp(p) * segs) * radial * 6); };
  m.userData.set(1);
  return m;
}

// ---------- animation helpers ----------
// Pop-in with overshoot: t is seconds since the pop started.
export function pop(obj, t, dur = 0.55, base = 1) {
  const s = t <= 0 ? 0 : back(t / dur) * base;
  obj.scale.setScalar(Math.max(s, 1e-4));
  obj.visible = s > 1e-3;
}
export const fade = (obj, a) => { obj.userData.fade = clamp(a); };
export function tint(obj, color, k) {
  const c = new THREE.Color(color);
  obj.traverse((m) => {
    if (!m.material) return;
    m.userData.baseColor ??= m.material.color.clone();
    m.material.color.copy(m.userData.baseColor).lerp(c, k);
  });
}
export function glowTo(obj, intensity) {
  obj.traverse((m) => { if (m.material) m.material.emissiveIntensity = intensity; });
}
export function emissive(obj, color, intensity) {
  obj.traverse((m) => { if (m.material) { m.material.emissive.set(color); m.material.emissiveIntensity = intensity; } });
}
