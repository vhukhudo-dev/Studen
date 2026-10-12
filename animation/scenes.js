// One builder per scene. Each returns { group, update(s) } where s carries the
// scene clock: s.T (seconds since scene start), s.step / s.st (current step and
// time inside it), s.since(k) (time since step k began), s.cue(i) / s.cueOf(k, i)
// (time since the i-th cue phrase was spoken). Everything is a pure function of
// time so any frame can be rendered on its own.
//
// Layout rule: the bottom-right corner (x > ~5.4, y < 0) is where the presenter
// video sits, and the caption lives bottom-left (y < -1.8), so content stays clear.
import {
  THREE, C, clamp, ramp, eo, eio, back, lerp, wave, hash, M, rbox, box, cyl, sphere, torus, cone, group, at, rot,
  txt, bolt, check, cross, shield, crackedShield, heart, triangle, chevrons, gear, pin, person, cloud,
  store, lock, database, rack, battery, coins, arcRing, drawTube, pop, fade, tint,
} from './kit.js';

const anchor = (x, y, z = 0) => at(new THREE.Object3D(), x, y, z);
// Re-origin a mesh's geometry so it grows from its base (scale.y) or left edge (scale.x).
const baseGeom = (mesh) => { const g = mesh.geometry.clone(); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); mesh.geometry = g; return mesh; };
const leftGeom = (mesh) => { const g = mesh.geometry.clone(); g.computeBoundingBox(); g.translate(-g.boundingBox.min.x, 0, 0); mesh.geometry = g; return mesh; };
// Smoothly move an object between "inactive" and "active" values when a step starts.
const stepBlend = (s, k, dur = 0.5) => eo(s.since(k) / dur);

// ===================================================== Slide 1
function title({ label }) {
  const g = group();
  const sixty = at(txt('60', 2.4, C.teal, { glow: 0.12 }), 0, 1.0, 0.2);
  const base = at(torus(2.9, 0.05, C.white, { opacity: 0.25 }), 0, 1.0, 0);
  const ring = at(arcRing(2.9, 0.15, C.teal), 0, 1.0, 0);
  const ticks = at(group(), 0, 1.0, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const k = at(box(0.09, i % 3 ? 0.25 : 0.45, 0.09, C.white, { glow: 0.3 }), Math.sin(a) * 3.4, Math.cos(a) * 3.4, 0);
    k.rotation.z = -a; ticks.add(k);
  }
  const orbit = at(group(), 0, 1.0, 0); orbit.rotation.x = 1.2;
  const pc = [C.amber, C.teal, C.white, C.sky, C.amber, C.green, C.violet];
  pc.forEach((c, i) => { const a = (i / pc.length) * Math.PI * 2; orbit.add(at(rbox(0.6, 0.45, 0.45, c, { glow: 0.15 }), Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0)); });
  g.add(sixty, base, ring, ticks, orbit);
  label(sixty, 'MINUTE DELIVERY PROMISE', 'small', [0, -1.75, 0]);
  return {
    group: g,
    update(s) {
      ring.userData.set(eio(s.T / 3.2));
      pop(sixty, s.T - 0.15, 0.7);
      ticks.children.forEach((k, i) => pop(k, s.T - 0.3 - i * 0.05, 0.35));
      orbit.rotation.z = s.t * 0.35;
      orbit.children.forEach((p, i) => { p.rotation.set(s.t * (0.8 + i * 0.1), s.t * 0.6, 0); pop(p, s.T - 0.6 - i * 0.08, 0.5); });
      g.rotation.y = Math.sin(s.t * 0.4) * 0.22;
    },
  };
}

function surge({ label }) {
  const g = group(); g.rotation.set(0.14, -0.38, 0);
  const plate = at(rbox(10, 0.2, 2.2, C.ink), -0.3, -1.6, 0);
  const H = [1.0, 1.15, 0.95, 1.2, 1.05, 1.1];
  const bars = H.map((h, i) => at(baseGeom(box(0.85, 1, 0.85, C.teal, { metal: 0.5 })), -4.6 + i * 1.15, -1.5, 0));
  const big = at(baseGeom(box(1.05, 1, 1.05, C.red, { glow: 0.35, metal: 0.4 })), 3.3, -1.5, 0);
  const plus = txt('+300%', 0.78, C.amber, { glow: 0.3 });
  const arrow = rot(cone(0.35, 0.6, C.amber, { glow: 0.4 }), 0, 0, 0);
  g.add(plate, ...bars, big, plus, arrow);
  const nlab = label(anchor(-1.7, 0.4), 'Normal demand', 'small'); g.add(nlab.anchor);
  label(big, 'SURGE', 'tag', [0, 0.5, 0.9]);
  return {
    group: g,
    update(s) {
      bars.forEach((b, i) => { b.scale.set(1, Math.max(1e-3, H[i] * eo((s.T - 0.15 - i * 0.07) / 0.7)), 1); });
      const h = 4.4 * back(ramp(s.T, 0.9, 2.0));
      big.scale.set(1, Math.max(1e-3, h), 1);
      big.material.emissiveIntensity = 0.35 + 0.25 * wave(s.t, 1.4);
      at(plus, 3.3, -1.5 + h + 0.85, 0.2); pop(plus, s.T - 1.5);
      at(arrow, 3.3, -1.5 + h + 1.75, 0.2); pop(arrow, s.T - 1.8, 0.4); arrow.position.y += 0.12 * wave(s.t, 1.2);
      nlab.fade = ramp(s.T, 0.6, 1.0);
      g.rotation.y = -0.38 + Math.sin(s.t * 0.3) * 0.06;
    },
  };
}

function power({ label }) {
  const g = group(); g.rotation.set(0.1, -0.15, 0);
  const hs = [1.8, 2.6, 2.0, 2.9, 2.2];
  const offAt = [0.0, 0.45, 0.2, 0.65, 0.3];
  const blds = hs.map((h, i) => {
    const b = group(at(rbox(1.6, h, 1.3, 0x1e293b, { metal: 0.4 }), 0, h / 2, 0));
    const wins = [];
    for (let r = 0; r < Math.floor((h - 0.5) / 0.5); r++) for (let c = 0; c < 3; c++) {
      const w = at(box(0.3, 0.26, 0.04, 0xfde68a, { glow: 1.1 }), (c - 1) * 0.45, 0.45 + r * 0.5, 0.66); b.add(w); wins.push(w);
    }
    b.userData.wins = wins;
    return at(b, -4.4 + i * 2.2, -1.6, 0);
  });
  const ground = at(rbox(11.4, 0.18, 2.2, C.ink), 0, -1.7, 0);
  const zap = at(bolt(2.3, C.amber), -1.4, 3.0, 0.6);
  const stage = at(txt('STAGE 6', 0.66, C.red, { glow: 0.45 }), 1.9, 3.0, 0.4);
  const flash = at(new THREE.PointLight(0xfff1c1, 0, 30), 0, 3, 4);
  g.add(ground, ...blds, zap, stage, flash);
  label(blds[2], 'Stores go dark', 'tag', [0, 2.8, 1]);
  return {
    group: g,
    update(s) {
      blds.forEach((b, i) => {
        const lt = s.T - 0.6 - offAt[i];
        const on = lt < 0 ? 1 : lt < 0.55 ? (hash(Math.floor(s.t * 18) + i * 7) > 0.45 ? 1 : 0.1) : 0.03;
        b.userData.wins.forEach((w) => { w.material.emissiveIntensity = on * 1.1; w.material.color.setHex(on > 0.5 ? 0xfde68a : 0x334155); });
        pop(b, s.T - i * 0.07, 0.5);
      });
      pop(zap, s.T - 0.5, 0.5); zap.rotation.z = 0.1 * wave(s.t, 0.7);
      pop(stage, s.T - 0.85);
      flash.intensity = s.T > 0.55 ? 120 * Math.exp(-(s.T - 0.55) * 5) : 0;
    },
  };
}

function clock({ label }) {
  const g = group(); g.rotation.y = 0.18;
  const cx = -1.7, cy = 1.1;
  const face = at(rot(cyl(2.2, 2.2, 0.25, 0x0f172a, { metal: 0.4 }), Math.PI / 2, 0, 0), cx, cy, 0);
  const rim = at(torus(2.22, 0.13, C.steel, { metal: 0.9, rough: 0.2 }), cx, cy, 0);
  const ticks = group();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ticks.add(rot(at(box(0.08, 0.3, 0.05, C.white, { glow: 0.4 }), cx + Math.sin(a) * 1.85, cy + Math.cos(a) * 1.85, 0.15), 0, 0, -a)); }
  const sector = at(new THREE.Mesh(new THREE.BufferGeometry(), M(C.red, { glow: 0.55, opacity: 0.8, side: THREE.DoubleSide })), cx, cy, 0.14);
  const minute = at(box(0.12, 1.7, 0.08, C.white, { glow: 0.3 }), cx, cy, 0.24); minute.geometry.translate(0, 0.8, 0);
  const hour = at(box(0.16, 1.1, 0.08, C.steel), cx, cy, 0.2); hour.geometry.translate(0, 0.5, 0); hour.rotation.z = -Math.PI / 3;
  const cap = at(rot(cyl(0.16, 0.16, 0.2, C.amber), Math.PI / 2, 0, 0), cx, cy, 0.3);
  const thirty = at(txt('30', 1.6, C.amber, { glow: 0.3 }), 3.2, 1.7, 0);
  g.add(face, rim, ticks, sector, minute, hour, cap, thirty);
  label(thirty, 'MINUTES BEHIND', 'tag', [0, -1.35, 0]);
  let last = -1;
  return {
    group: g,
    update(s) {
      const len = Math.PI * eio(ramp(s.T, 0.4, 2.4));
      const q = Math.round(len * 200) / 200;
      if (q !== last) { last = q; sector.geometry.dispose(); sector.geometry = new THREE.RingGeometry(0.15, 1.95, 72, 1, Math.PI / 2 - q, Math.max(q, 1e-4)); }
      minute.rotation.z = -len;
      pop(thirty, s.T - 1.1);
      g.rotation.y = 0.18 + Math.sin(s.t * 0.35) * 0.07;
    },
  };
}

function goods({ label }) {
  const g = group(); g.rotation.x = 0.16;
  const platform = at(cyl(3.9, 3.9, 0.25, 0x1e293b, { metal: 0.5 }), 0, -1.35, 0);
  const turn = at(group(), 0, -1.22, 0);
  const milk = group(at(rbox(0.95, 1.7, 0.95, 0xf8fafc, { rough: 0.6 }), 0, 0.85, 0), at(box(0.97, 0.35, 0.97, C.sky, { glow: 0.2 }), 0, 1.1, 0));
  const bread = group(at(rbox(1.7, 0.85, 1.05, 0xd6a35c, { r: 0.38, rough: 0.7, metal: 0 }), 0, 0.43, 0));
  const can = group(at(cyl(0.5, 0.5, 1.35, C.red, { metal: 0.7 }), 0, 0.68, 0), at(cyl(0.51, 0.51, 0.3, C.white), 0, 0.68, 0));
  const prods = [at(milk, -2.4, 0, 0.3), at(bread, 0, 0, 0.6), at(can, 2.4, 0, 0.3)];
  const xs = prods.map((p) => at(cross(0.42), p.position.x, 2.5, p.position.z + 0.4));
  turn.add(...prods, ...xs);
  const oos = anchor(0, 3.6); g.add(platform, turn, oos);
  const L = label(oos, '<span class="bad">OUT OF STOCK</span>', 'tag big');
  return {
    group: g,
    update(s) {
      turn.rotation.y = Math.sin(s.t * 0.4) * 0.35;
      prods.forEach((p, i) => {
        pop(p, s.T - 0.1 - i * 0.15);
        const k = eo(ramp(s.T, 0.6 + i * 0.3, 1.0 + i * 0.3));
        tint(p, 0x475569, k * 0.8); p.position.y = -0.15 * k;
        pop(xs[i], s.T - (0.6 + i * 0.3));
        xs[i].rotation.y = Math.sin(s.t * 1.3 + i) * 0.4;
      });
      L.fade = ramp(s.T, 0.7, 1.1);
    },
  };
}

function phone({ label }) {
  const g = group();
  const ph = at(group(), -2.0, 1.0, 0);
  const body = rbox(2.3, 4.4, 0.28, 0x0b1020, { metal: 0.7, rough: 0.2, r: 0.3 });
  const screen = at(box(2.0, 4.0, 0.02, 0x1d4ed8, { glow: 0.35 }), 0, 0, 0.15);
  ph.add(body, screen);
  for (let i = 0; i < 6; i++) ph.add(rot(at(box(2.0, 0.05, 0.01, C.white, { opacity: 0.35, glow: 0.4 }), 0, -1.7 + i * 0.68, 0.17), 0, 0, (hash(i) - 0.5) * 0.4));
  for (let i = 0; i < 3; i++) ph.add(rot(at(box(0.05, 4.0, 0.01, C.white, { opacity: 0.35, glow: 0.4 }), -0.6 + i * 0.6, 0, 0.17), 0, 0, (hash(i + 9) - 0.5) * 0.2));
  const pins = [[-0.45, 0.9], [0.45, -0.2], [-0.2, -1.2]].map(([x, y], i) => at(pin(0.55, i === 0 ? C.red : C.amber), x, y, 0.45));
  ph.add(...pins);
  const lk = at(lock(0.95, C.red, true), 2.7, 2.2, 0);
  const code = at(txt('4719', 0.6, C.white, { glow: 0.2 }), 2.7, 0.15, 0);
  g.add(ph, lk, code);
  label(pins[0], 'Customer address', 'tag', [0, 1.0, 0]);
  label(code, 'Gate code', 'small', [0, -0.65, 0]);
  label(lk, '<span class="bad">Unsecured device</span>', 'small', [0, -0.95, 0]);
  return {
    group: g,
    update(s) {
      pop(ph, s.T - 0.05, 0.6);
      ph.rotation.set(-0.1, 0.45 + Math.sin(s.t * 0.5) * 0.08, 0.05); ph.position.y = 1.0 + Math.sin(s.t * 0.8) * 0.08;
      pins.forEach((p, i) => { pop(p, s.T - 0.45 - i * 0.3); p.position.z = 0.45 + 0.08 * wave(s.t, 0.8, i * 0.3); });
      pop(lk, s.T - 1.1); lk.userData.setOpen(0.8 + 0.2 * wave(s.t, 0.6)); lk.rotation.y = Math.sin(s.t * 0.7) * 0.3;
      pop(code, s.T - 1.5);
    },
  };
}

function conveyor({ label }) {
  const g = group(); g.rotation.set(0.22, -0.22, 0);
  const belt = at(rbox(10.4, 0.3, 1.8, 0x1f2937, { metal: 0.6 }), 0, -1.0, 0);
  const rollers = group();
  for (let i = 0; i < 11; i++) rollers.add(rot(at(cyl(0.16, 0.16, 1.9, C.steel, { metal: 0.9 }), -5 + i, -1.25, 0), Math.PI / 2, 0, 0));
  const gate = group(at(box(0.25, 2.6, 0.25, C.red, { glow: 0.3 }), 0, 0.3, 1.0), at(box(0.25, 2.6, 0.25, C.red, { glow: 0.3 }), 0, 0.3, -1.0), at(box(0.3, 0.3, 2.3, C.red, { glow: 0.5 }), 0, 1.6, 0));
  const pts = [[-3.2, -0.45, 0], [-1.9, 2.3, 0], [0, 3.3, 0], [1.9, 2.3, 0], [3.2, -0.45, 0]];
  const bypass = drawTube(pts, 0.08, C.amber);
  const curve = bypass.userData.curve;
  const parcels = Array.from({ length: 8 }, (_, i) => rbox(0.75, 0.6, 0.75, i % 2 ? 0xb45309 : 0xd97706, { rough: 0.7, metal: 0 }));
  const peak = anchor(0, 3.3);
  g.add(belt, rollers, gate, bypass, ...parcels, peak);
  label(peak, '<span class="warn">Shortcut</span>', 'tag', [0, 0.6, 0]);
  label(gate.children[2], 'Control check', 'small', [0, 0.55, 0]);
  return {
    group: g,
    update(s) {
      const drawn = eo(ramp(s.T, 0.5, 1.6));
      bypass.userData.set(drawn);
      gate.children.forEach((m) => { m.material.emissiveIntensity = 0.3 + 0.3 * wave(s.t, 1.1); });
      parcels.forEach((p, i) => {
        const x = ((s.t * 1.3 + i * 1.3) % 10.4) - 5.2;
        let y = -0.55;
        if (Math.abs(x) < 3.2) y = lerp(y, curve.getPoint((x + 3.2) / 6.4).y + 0.4, drawn);
        p.position.set(x, y, 0); p.rotation.y = s.t * 0.4 + i;
        fade(p, ramp(x, -5.2, -4.5) * (1 - ramp(x, 4.5, 5.2)));
      });
    },
  };
}

function pillars({ label }) {
  const g = group(); g.rotation.x = 0.08;
  const base = at(rbox(10, 0.4, 2.6, 0x1e293b), 0, -1.6, 0);
  const names = ['Resilience investment', 'Privacy safeguards', 'Accountability'];
  const cols = [C.teal, C.violet, C.sky].map((c, i) => {
    const p = group(at(cyl(0.55, 0.62, 3.1, c, { metal: 0.5, glow: 0.12 }), 0, 1.75, 0), at(rbox(1.5, 0.3, 1.5, c, { metal: 0.5 }), 0, 3.35, 0), at(rbox(1.4, 0.25, 1.4, c, { metal: 0.5 }), 0, 0.12, 0));
    return at(p, -3.2 + i * 3.2, -1.4, 0);
  });
  const roof = group(rbox(10.4, 0.45, 2.8, 0xe2e8f0, { metal: 0.6 }));
  const Ls = cols.map((p, i) => label(p, names[i], 'tag', [0, 1.75, 1.0]));
  g.add(base, ...cols, roof);
  const rl = label(roof, 'BOARD DIRECTION', 'small', [0, 0.65, 0]);
  return {
    group: g,
    update(s) {
      cols.forEach((p, i) => { const k = back(ramp(s.cue(i), 0, 0.7)); p.scale.set(1, Math.max(1e-3, k), 1); p.visible = k > 0.002; Ls[i].fade = ramp(s.cue(i), 0.3, 0.6); });
      const d = back(ramp(s.cue(2), 0.6, 1.3));
      roof.position.set(0, lerp(6.5, 2.35, d), 0); fade(roof, ramp(s.cue(2), 0.5, 0.75)); rl.fade = ramp(s.cue(2), 1.0, 1.3);
      g.rotation.y = Math.sin(s.t * 0.3) * 0.12;
    },
  };
}

function risk({ label }) {
  const g = group();
  const sh = crackedShield(1.25, 0xdc2626, { glow: 0.15 });
  at(sh.group, 0, 1.1, 0);
  const crate = at(group(rbox(1.4, 1.1, 1.1, 0xb45309, { rough: 0.7, metal: 0 }), at(cross(0.3), 0, 0, 0.62)), -4.3, 1.5, 0);
  const hrt = at(heart(0.85, 0xf43f5e), 4.3, 1.5, 0);
  const law = at(txt('POPIA s19', 0.62, C.amber, { glow: 0.3 }), 0, 4.0, 0);
  g.add(sh.group, crate, hrt, law);
  label(crate, 'Cancelled orders', 'tag', [0, -1.15, 0]);
  label(hrt, 'Lost trust', 'tag', [0, -1.25, 0]);
  const ex = label(sh.group, '<span class="bad">Legal exposure</span>', 'tag', [0, -2.6, 0]);
  return {
    group: g,
    update(s) {
      pop(sh.group, s.T - 0.1, 0.7);
      sh.group.rotation.y = Math.sin(s.t * 0.6) * 0.25;
      const k = eo(ramp(s.cue(2), 0, 0.5));
      sh.left.position.x = -0.35 * k; sh.right.position.x = 0.35 * k;
      sh.left.rotation.z = 0.12 * k; sh.right.rotation.z = -0.12 * k;
      [sh.left, sh.right].forEach((m) => { m.material.emissiveIntensity = 0.15 + k * (0.4 + 0.3 * wave(s.t, 1.5)); });
      ex.fade = k;
      pop(crate, s.cue(0)); crate.rotation.y = Math.sin(s.t * 0.8) * 0.3;
      pop(hrt, s.cue(1));
      const b = eo(ramp(s.cue(1), 0.6, 1.2)); tint(hrt, 0x475569, b * 0.85); hrt.rotation.z = -0.35 * b; hrt.position.y = 1.5 - 0.3 * b;
      pop(law, s.cue(2) - 0.1);
    },
  };
}

function promise({ label }) {
  const g = group();
  const bg = at(torus(2.6, 0.06, C.white, { opacity: 0.2 }), 0, 1.2, 0);
  const arc = at(arcRing(2.6, 0.2, C.teal), 0, 1.2, 0);
  const sixty = at(txt('60', 1.9, C.white, { glow: 0.1 }), 0, 1.4, 0.1);
  const st = rot(at(store(1.0), -5.0, -0.4, 0), 0, 0.35, 0);
  const ck1 = at(check(0.45), -5.0, 1.9, 0.3);
  const lk = at(lock(1.0, C.teal, true), 4.8, 1.4, 0);
  const ck2 = at(check(0.45), 4.8, 3.0, 0.3);
  g.add(bg, arc, sixty, st, ck1, lk, ck2);
  label(sixty, 'MINUTE PROMISE', 'small', [0, -1.45, 0]);
  label(st, 'Resilient stores', 'tag', [0, -0.5, 0.8]);
  label(lk, 'Secure delivery', 'tag', [0, -1.05, 0]);
  return {
    group: g,
    update(s) {
      arc.userData.set(eio(ramp(s.T, 0.3, 2.6)));
      pop(sixty, s.T - 0.1, 0.7);
      pop(st, s.cue(0)); pop(ck1, s.cue(0) - 0.5);
      pop(lk, s.cue(1)); lk.userData.setOpen(1 - eo(ramp(s.cue(1), 0.45, 0.85))); pop(ck2, s.cue(1) - 0.9);
      g.rotation.y = Math.sin(s.t * 0.35) * 0.1;
    },
  };
}

// ===================================================== Slide 2
function sam({ label }) {
  const g = group(); g.rotation.x = 0.06;
  const P = [[-2.7, 2.7], [2.7, 2.7], [-2.7, -0.1], [2.7, -0.1]];
  const acc = [C.sky, C.violet, C.amber, C.red];
  const names = ['Business strategy', 'IT strategy', 'Business infrastructure<br>&amp; processes', 'IT infrastructure<br>&amp; processes'];
  const tiles = P.map(([x, y], i) => at(group(rbox(4.4, 2.1, 0.4, 0x1e293b, { metal: 0.4 }), at(box(0.2, 2.0, 0.44, acc[i], { glow: 0.5 }), -2.1, 0, 0)), x, y, 0));
  tiles.forEach((t, i) => label(t, names[i], 'tile', [0.1, 0, 0.35]));
  const links = group(
    at(rot(cyl(0.06, 0.06, 1.0, C.white, { glow: 0.5 }), 0, 0, Math.PI / 2), 0, 2.7, 0),
    at(rot(cyl(0.06, 0.06, 1.0, C.white, { glow: 0.5 }), 0, 0, Math.PI / 2), 0, -0.1, 0),
    at(cyl(0.06, 0.06, 0.8, C.white, { glow: 0.5 }), -2.7, 1.3, 0),
    at(cyl(0.06, 0.06, 0.8, C.white, { glow: 0.5 }), 2.7, 1.3, 0));
  const gaps = [[0, 2.7], [0, -0.1], [-2.7, 1.3], [2.7, 1.3]].map(([x, y]) => at(torus(0.26, 0.07, C.red, { glow: 0.8 }), x, y, 0.25));
  const icons = [chevrons(0.5, C.sky), cloud(0.5), bolt(1.5, C.amber), triangle(0.55, C.red)];
  icons.forEach((ic, i) => tiles[i].add(at(ic, 1.75, 0.95, 0.75)));
  const heads = [anchor(-2.7, 4.15), anchor(2.7, 4.15), anchor(-6.1, 2.7), anchor(-6.1, -0.1)];
  g.add(...tiles, links, ...gaps, ...heads);
  ['BUSINESS', 'IT', 'STRATEGY', 'INFRASTRUCTURE'].forEach((h, i) => label(heads[i], h, 'small'));
  return {
    group: g,
    update(s) {
      const active = s.step - 1, prevActive = s.step - 2;
      const k = eo(s.st / 0.5);
      tiles.forEach((t, i) => {
        pop(t, s.T - i * 0.15, 0.6);
        const z0 = i === prevActive ? 0.9 : 0, z1 = i === active ? 0.9 : 0;
        const d0 = prevActive >= 0 && i !== prevActive ? 0.4 : 1, d1 = active >= 0 && i !== active ? 0.4 : 1;
        t.position.z = lerp(z0, z1, k);
        fade(t, s.step === 0 ? 1 : lerp(s.step === 1 ? 1 : d0, d1, k));
      });
      fade(links, ramp(s.T, 0.8, 1.2));
      gaps.forEach((m, i) => { pop(m, s.T - 1.0 - i * 0.15); if (m.visible && s.T > 1.6) m.scale.setScalar(1 + 0.25 * wave(s.t, 1.2, i * 0.25)); fade(m, s.step === 0 ? 1 : 0.5); });
      icons.forEach((ic, i) => {
        if (i === active) pop(ic, s.st - 0.2);
        else if (i === prevActive) ic.scale.setScalar(Math.max(1e-4, 1 - eo(s.st / 0.3)));
        else { ic.scale.setScalar(1e-4); ic.visible = false; }
        ic.rotation.y = Math.sin(s.t * 0.9) * 0.4;
      });
    },
  };
}

function drift({ label }) {
  const g = group();
  const chart = group();
  const xs = Array.from({ length: 21 }, (_, i) => -5 + i * 0.5);
  const gy = (x) => -1.2 + 4.6 * Math.pow((x + 5) / 10, 1.7);
  const ry = (x) => -1.0 + 0.9 * ((x + 5) / 10);
  const axisX = at(box(10.6, 0.06, 0.06, C.white, { opacity: 0.5 }), 0, -1.45, 0);
  const axisY = at(box(0.06, 5.2, 0.06, C.white, { opacity: 0.5 }), -5.3, 1.1, 0);
  const growth = drawTube(xs.map((x) => [x, gy(x), 0]), 0.1, C.teal);
  const resil = drawTube(xs.map((x) => [x, ry(x), 0]), 0.1, C.amber);
  const shape = new THREE.Shape();
  xs.forEach((x, i) => (i ? shape.lineTo(x, gy(x)) : shape.moveTo(x, gy(x))));
  [...xs].reverse().forEach((x) => shape.lineTo(x, ry(x)));
  const gap = at(new THREE.Mesh(new THREE.ShapeGeometry(shape), M(C.red, { opacity: 0.28, glow: 0.4, side: THREE.DoubleSide, depthWrite: false })), 0, 0, -0.05);
  const gEnd = anchor(5, gy(5)), rEnd = anchor(5, ry(5)), gapMid = anchor(3.0, 1.0);
  chart.add(axisX, axisY, growth, resil, gap, gEnd, rEnd, gapMid);
  label(gEnd, 'Growth', 'tag', [0, 0.6, 0]);
  label(rEnd, 'Store resilience', 'tag', [-0.4, -0.65, 0]);
  const dl = label(gapMid, '<span class="bad">DRIFT</span>', 'big');

  const two = group();
  const st = at(store(1.15), -4.0, -1.5, 0);
  const cl = at(cloud(1.0), 3.4, 2.8, 0);
  const link = drawTube([[-3.6, 0.3, 0], [-1.5, 2.5, 0.5], [1.2, 2.8, 0.3], [2.6, 2.3, 0]], 0.05, C.sky);
  const packets = Array.from({ length: 4 }, () => rbox(0.38, 0.38, 0.38, C.amber, { glow: 0.3 }));
  const late = at(txt('+30 min', 0.45, C.amber, { glow: 0.3 }), -0.9, 3.6, 0.3);
  const no = at(cross(0.38), 4.7, 3.8, 0.8);
  two.add(st, cl, link, ...packets, late, no);
  label(st, 'Delayed store data', 'tag', [0, 2.3, 0.6]);
  label(cl, 'Cloud services', 'tag', [0, -1.45, 0]);
  g.add(chart, two);
  return {
    group: g,
    update(s) {
      const k1 = stepBlend(s, 1);
      growth.userData.set(eo(ramp(s.T, 0.3, 1.6)));
      resil.userData.set(eo(ramp(s.T, 0.5, 1.8)));
      fade(gap, ramp(s.T, 1.6, 2.2)); dl.fade = ramp(s.T, 1.9, 2.3);
      fade(chart, 1 - k1); chart.position.x = -2 * k1; chart.visible = k1 < 0.999;
      two.visible = s.since(1) > 0; fade(two, k1);
      if (two.visible) {
        const t1 = s.since(1);
        pop(st, t1); pop(cl, t1 - 0.2);
        link.userData.set(eo(ramp(t1, 0.3, 1.0)));
        packets.forEach((p, i) => {
          const u = (t1 * 0.16 + i * 0.25) % 1;
          p.position.copy(link.userData.curve.getPoint(u)); p.rotation.set(s.t, s.t * 0.7, 0);
          fade(p, ramp(t1, 0.9, 1.2) * ramp(u, 0, 0.08) * (1 - ramp(u, 0.92, 1)));
        });
        pop(late, t1 - 1.0);
        pop(no, t1 - 1.6); no.rotation.y = Math.sin(s.t) * 0.4;
      }
    },
  };
}

function maturity({ label }) {
  const g = group(); g.rotation.set(0.1, 0.16, 0);
  const names = ['Initial', 'Repeatable', 'Defined', 'Managed', 'Optimising'];
  const H = names.map((_, i) => 0.7 + i * 0.65);
  const blocks = names.map((n, i) => at(baseGeom(rbox(2.1, H[i], 1.8, i === 0 ? C.amber : 0x334155, { glow: i === 0 ? 0.25 : 0, metal: 0.4 })), -5.4 + i * 2.25, -1.6, 0));
  blocks.forEach((b, i) => label(b, `<b>${i + 1}</b> ${names[i]}`, 'tag', [0, H[i] / 2, 0.95]));
  const mark = pin(0.85, C.amber);
  const one = at(txt('1', 1.3, C.amber, { glow: 0.35 }), -5.4, 2.5, 0);
  const people = [-0.6, 0, 0.6].map((x) => at(person(0.55, C.white), -5.4 + x, -0.9, 0.2));
  const gears = [2, 3, 4].map((i) => at(gear(0.5, C.steel), -5.4 + i * 2.25, -1.6 + H[i] + 0.8, 0));
  const q = at(txt('?', 1.2, C.sky, { glow: 0.3 }), 1.2, 4.0, 0);
  const stampA = anchor(-1.3, 0.4, 2.0);
  g.add(...blocks, mark, one, ...people, ...gears, q, stampA);
  label(people[1], 'Individuals', 'tag', [0, 2.0, 0]);
  label(gears[1], '<span class="warn">Controlled procedures</span>', 'small', [0, 0.9, 0]);
  const stamp = label(stampA, 'PROVISIONAL', 'stamp');
  return {
    group: g,
    update(s) {
      blocks.forEach((b, i) => { const k = eo(ramp(s.T, i * 0.12, i * 0.12 + 0.6)); b.scale.set(1, Math.max(1e-3, k), 1); });
      blocks[0].material.emissiveIntensity = 0.25 + 0.25 * wave(s.t, 0.9);
      const d = back(ramp(s.T, 0.9, 1.5));
      const lift = stepBlend(s, 1, 0.6);
      mark.position.set(-5.4, lerp(4.5, -0.85, d) + lift * 4, 0.2); fade(mark, ramp(s.T, 0.9, 1.0) * (1 - lift));
      pop(one, s.T - 1.2);
      people.forEach((p, i) => { pop(p, s.since(1) - i * 0.15); p.rotation.z = 0.15 * wave(s.t, 0.9, i * 0.33); });
      gears.forEach((gg, i) => { pop(gg, s.since(1) - 0.6 - i * 0.12); gg.rotation.z = s.t * 0.5 * (i % 2 ? -1 : 1); fade(gg, 0.55); });
      stamp.fade = ramp(s.since(2), 0.15, 0.4);
      pop(q, s.since(2) - 0.7); q.rotation.y = s.t * 1.2;
    },
  };
}

function controls({ label }) {
  const g = group();
  const A = group();
  const drv = at(person(1.0, C.steel), -4.6, -1.3, 0);
  const qm = at(txt('?', 0.8, C.amber, { glow: 0.3 }), -4.6, 1.3, 0);
  const tri = at(triangle(1.15, C.amber), 0, 1.4, 0);
  const db = at(database(0.85, C.sky), 4.4, -1.1, 0);
  const lk = at(lock(0.8, C.red, true), 4.4, 1.5, 0);
  A.add(drv, qm, tri, db, lk);
  label(drv, 'Unvetted drivers', 'tag', [0, -0.45, 0]);
  label(tri, '<span class="warn">POPIA Section 19</span>', 'tag', [0, -1.65, 0]);
  label(db, 'Uncontrolled customer data', 'tag', [0, -0.45, 0]);
  const B = group();
  const names = ['Controlled access', 'Vetted onboarding', 'Clear accountability'];
  const icons = [lock(0.55, C.teal, false), person(0.6, C.teal), shield(0.38, C.teal)];
  const tiles = names.map((n, i) => {
    const t = at(group(rbox(3.4, 2.6, 0.35, 0x0f2f2a, { metal: 0.4 }), at(icons[i], -0.75, i === 1 ? -0.6 : 0, 0.4)), -4.2 + i * 4.2, 1.3, 0);
    t.userData.ck = at(check(0.42), 0.75, 0, 0.45); t.add(t.userData.ck);
    label(t, n, 'tag', [0, -1.75, 0]);
    return t;
  });
  B.add(...tiles);
  g.add(A, B);
  return {
    group: g,
    update(s) {
      const k1 = stepBlend(s, 1, 0.4);
      fade(A, 1 - k1); A.visible = k1 < 0.999;
      pop(drv, s.T - 0.2); pop(qm, s.T - 0.5); qm.rotation.y = s.t * 1.5; qm.position.y = 1.3 + 0.1 * wave(s.t, 0.8);
      pop(tri, s.T - 0.05, 0.6); tri.rotation.y = Math.sin(s.t * 0.7) * 0.3;
      pop(db, s.T - 0.35); pop(lk, s.T - 0.65); lk.rotation.y = Math.sin(s.t * 0.8) * 0.3;
      B.visible = s.since(1) > 0;
      tiles.forEach((t, i) => { pop(t, s.cueOf(1, i) + 0.1); pop(t.userData.ck, s.cueOf(1, i) - 0.25); });
    },
  };
}

// ===================================================== Slide 3
function mtd({ label }) {
  const g = group(); g.rotation.set(0.12, -0.1, 0);
  const u = 0.3, x0 = -4.8;
  const mk = (y, mins, rto, name) => {
    const L = mins * u;
    const glass = at(leftGeom(box(1, 0.75, 0.75, C.white, { opacity: 0.12, rough: 0.1, depthWrite: false })), x0, y, 0);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    glass.add(edges);
    const cap = at(box(0.14, 1.25, 1.0, C.red, { glow: 0.6 }), x0 + L, y, 0);
    const fill = at(leftGeom(box(1, 0.5, 0.5, C.teal, { glow: 0.35 })), x0, y, 0);
    const head = at(leftGeom(box(1, 0.5, 0.5, C.green, { opacity: 0.4, glow: 0.6, depthWrite: false })), x0 + rto * u, y, 0);
    const big = at(txt(String(mins), 0.6, C.amber, { glow: 0.3 }), x0 + L + 0.75, y, 0);
    const nameA = anchor(x0 + L / 2, y + 0.85);
    g.add(glass, cap, fill, head, big, nameA);
    label(nameA, name, 'small');
    label(cap, `MTD ${mins} min`, 'tag', [0, 1.0, 0]);
    const rl = label(fill, `Restore in ${rto} min`, 'tag', [rto * u / 2, -0.85, 0]);
    const hl = label(head, `<span class="ok">${mins - rto} min headroom</span>`, 'small', [(mins - rto) * u / 2, -0.75, 0]);
    const ticks = [];
    for (let m = 0; m <= mins; m += 5) { const tk = at(box(0.04, 0.2, 0.04, C.white, { opacity: 0.6 }), x0 + m * u, y - 0.5, 0.3); g.add(tk); ticks.push(tk); }
    return { glass, cap, fill, head, big, rl, hl, L, rto, mins, ticks };
  };
  const T1 = mk(2.2, 30, 15, 'Stock-valid fulfilment');
  const T2 = mk(-0.3, 15, 10, 'Secure delivery-detail access');
  return {
    group: g,
    update(s) {
      [T1, T2].forEach((T, i) => {
        const c0 = s.cueOf(0, i);
        const grow = eo(ramp(c0, 0, 0.9));
        T.glass.scale.set(Math.max(1e-3, grow * T.L), 1, 1); T.glass.visible = grow > 0.002;
        pop(T.cap, c0 - 0.8); pop(T.big, c0 - 0.9);
        T.ticks.forEach((tk, j) => fade(tk, ramp(c0, 0.2 + j * 0.08, 0.4 + j * 0.08)));
        const f = eo(ramp(s.cueOf(1, i), 0, 0.9));
        T.fill.scale.set(Math.max(1e-3, f * T.rto * u), 1, 1); T.fill.visible = f > 0.002; T.rl.fade = ramp(s.cueOf(1, i), 0.5, 0.9);
        const h = eo(ramp(s.cueOf(1, 2), 0, 0.7));
        T.head.scale.set(Math.max(1e-3, h * (T.mins - T.rto) * u), 1, 1); T.head.visible = h > 0.002; T.hl.fade = h;
        T.head.material.emissiveIntensity = 0.5 + 0.3 * wave(s.t, 1.2);
      });
    },
  };
}

function rpo({ label }) {
  const g = group(); g.rotation.x = 0.1;
  const A = group();
  const n = 16, x0 = -5.6, dx = 0.62;
  const blocks = Array.from({ length: n }, (_, i) => at(rbox(0.5, 0.5, 0.5, C.sky, { glow: 0.2 }), x0 + i * dx, 1.4, 0));
  const zap = at(bolt(1.9, C.red, { glow: 0.8 }), x0 + n * dx + 0.2, 2.6, 0.3);
  const bw = 5 * dx;
  const bracket = at(group(box(bw, 0.07, 0.07, C.red, { glow: 0.6 }), at(box(0.07, 0.35, 0.07, C.red, { glow: 0.6 }), -bw / 2, -0.15, 0), at(box(0.07, 0.35, 0.07, C.red, { glow: 0.6 }), bw / 2, -0.15, 0)), x0 + 13 * dx, 2.15, 0);
  const zero = anchor(-2.4, -0.4);
  A.add(...blocks, zap, bracket, zero);
  label(bracket, 'RPO: lose at most <b>5 min</b> of logs', 'tag', [0, 0.55, 0]);
  label(blocks[11], '−5 min', 'small', [0, -0.65, 0]);
  label(zap, '<span class="bad">Crash</span>', 'small', [0, -1.65, 0]);
  const zl = label(zero, '<span class="strike">Zero-loss promise</span>', 'big');
  const B = group();
  const dbA = at(database(1.0, C.slate), -3.6, -1.0, 0);
  const off = at(cross(0.45), -3.6, 1.9, 0.4);
  const dbB = at(database(1.0, C.teal, { glow: 0.2 }), 3.6, -1.0, 0);
  const q = at(txt('?', 0.9, C.amber, { glow: 0.35 }), 3.6, 2.2, 0);
  const dots = Array.from({ length: 9 }, (_, i) => at(sphere(0.1, C.white, { glow: 0.6 }), -2.2 + i * 0.55, 0.3, 0));
  B.add(dbA, off, dbB, q, ...dots);
  label(dbA, 'System offline', 'tag', [0, -0.5, 0.9]);
  label(dbB, 'Backup', 'tag', [0, -0.5, 0.9]);
  label(q, '<span class="warn">must be tested</span>', 'small', [0, -0.85, 0]);
  g.add(A, B);
  return {
    group: g,
    update(s) {
      const k1 = stepBlend(s, 1, 0.45);
      fade(A, 1 - k1); A.visible = k1 < 0.999;
      blocks.forEach((b, i) => {
        pop(b, s.T - i * 0.07, 0.4);
        const lost = i >= 11 ? eo(ramp(s.T, 1.6, 2.0)) : 0;
        tint(b, C.red, lost); fade(b, 1 - 0.55 * lost);
      });
      pop(zap, s.T - 1.25, 0.4); pop(bracket, s.T - 1.8);
      zl.fade = ramp(s.T, 2.4, 2.8);
      B.visible = s.since(1) > 0;
      const t1 = s.since(1);
      pop(dbA, t1); pop(dbB, t1 - 0.25); pop(off, t1 - 0.6); pop(q, t1 - 1.0); q.rotation.y = s.t * 1.3;
      tint(dbA, 0x1e293b, eo(ramp(t1, 0.5, 0.9)));
      dots.forEach((d, i) => { fade(d, ramp(t1, 0.4, 0.7) * (0.25 + 0.75 * Math.max(0, wave(s.t * 0.8 - i * 0.08, 1)))); });
    },
  };
}

function standby({ label }) {
  const g = group(); g.rotation.x = 0.1;
  const X = [-4.6, -0.2, 4.2];
  const leds = [0x93c5fd, C.teal, C.red];
  const racks = X.map((x, i) => at(rack(1.0, leds[i]), x, -1.6, 0));
  const stacks = [1, 3, 7].map((n, i) => at(coins(n, 0.9), X[i] - 1.5, -1.6, 0.4));
  const ring = rot(at(torus(1.8, 0.07, C.teal, { glow: 0.9 }), X[1], -1.55, 0), Math.PI / 2, 0, 0);
  const ck = at(check(0.5), X[1] + 1.5, 2.2, 0.6);
  const no = at(cross(0.35), X[0], 2.6, 0.3);
  g.add(...racks, ...stacks, ring, ck, no);
  const NAMES = ['Cold', 'Warm', 'Hot'];
  const SUB = ['<span class="bad">recovers slower</span>', '<span class="ok">recommended</span>', '<span class="warn">costs more</span>'];
  racks.forEach((r, i) => { label(r, NAMES[i], 'tag big', [0, 3.75, 0]); label(r, SUB[i], 'small', [0, 3.15, 0]); });
  return {
    group: g,
    update(s) {
      racks.forEach((r, i) => {
        pop(r, s.T - i * 0.15);
        const rate = [0.4, 1.2, 3][i];
        r.userData.leds.forEach((l, j) => { l.material.emissiveIntensity = (i === 0 ? 0.4 : 1.2) * (0.4 + 0.6 * (hash(Math.floor(s.t * rate * 4) + j * 3 + i * 17) > 0.4)); });
      });
      stacks.forEach((st, i) => st.children.forEach((c, j) => pop(c, (i === 2 ? s.cue(1) : s.T - 0.6) - j * 0.09, 0.35)));
      const w = eo(ramp(s.cue(0), 0, 0.6));
      racks[1].position.y = -1.6 + 0.35 * w; ring.position.y = -1.55 + 0.35 * w;
      pop(ring, s.cue(0)); ring.material.emissiveIntensity = 0.6 + 0.4 * wave(s.t, 1);
      pop(ck, s.cue(0) - 0.35); ck.rotation.y = Math.sin(s.t) * 0.3;
      tint(racks[0], 0x60a5fa, 0.5 * eo(ramp(s.cue(2), 0, 0.5))); pop(no, s.cue(2));
      g.rotation.y = Math.sin(s.t * 0.25) * 0.1;
    },
  };
}

function links({ label }) {
  const g = group();
  const st = at(store(1.2), -4.4, -1.6, 0);
  const bat = at(battery(0.8), -6.5, -1.6, 0);
  const cl = at(cloud(1.1), 4.0, 2.9, 0);
  const lA = drawTube([[-4.0, 0.3, 0], [-1.6, 3.7, 0.4], [1.5, 4.0, 0.4], [3.0, 2.8, 0]], 0.08, C.teal);
  const lB = drawTube([[-3.6, 0.2, 0], [-0.8, 0.6, 0.6], [1.9, 1.0, 0.5], [3.6, 1.8, 0]], 0.08, C.sky);
  const pk = [lA, lB].map(() => Array.from({ length: 4 }, () => sphere(0.14, C.white, { glow: 1 })));
  const sparks = [lA, lB].map((l) => at(cross(0.3), ...l.userData.curve.getPoint(0.5).toArray()));
  const timer = anchor(0.6, -0.9);
  g.add(st, bat, cl, lA, lB, ...pk.flat(), ...sparks, timer);
  label(bat, 'Backup power', 'small', [0, -0.45, 0.6]);
  label(cl, 'Stock sync', 'tag', [0, -1.5, 0]);
  const la = label(anchor(-2.6, 3.4), 'Internet connection', 'small'); g.add(la.anchor);
  const lb = label(anchor(0.6, 0.15), 'Backup connection', 'small'); g.add(lb.anchor);
  const tl = label(timer, '', 'tag big');
  return {
    group: g,
    update(s) {
      pop(st, s.T); pop(bat, s.T - 0.2); pop(cl, s.T - 0.3);
      bat.userData.cells.forEach((c, i) => pop(c, s.T - 0.5 - i * 0.2, 0.3));
      lA.userData.set(eo(ramp(s.T, 0.4, 1.2))); lB.userData.set(eo(ramp(s.T, 0.6, 1.4)));
      const t1 = s.since(1);
      [lA, lB].forEach((l, i) => {
        const br = eo(ramp(t1, 0.2 + i * 0.8, 0.5 + i * 0.8));
        tint(l, C.red, br);
        fade(l, 1 - 0.6 * br * (0.6 + 0.4 * (hash(Math.floor(s.t * 14) + i) > 0.5)));
        pop(sparks[i], t1 - 0.2 - i * 0.8);
        pk[i].forEach((p, j) => {
          const u = (s.t * 0.35 + j * 0.25) % 1;
          p.position.copy(l.userData.curve.getPoint(u));
          fade(p, ramp(s.T, 1.2, 1.5) * (1 - br) * ramp(u, 0, 0.06) * (1 - ramp(u, 0.94, 1)));
        });
      });
      const breached = t1 > 1.2;
      tl.html(breached ? '<span class="bad">Targets missed</span>' : '<span class="ok">Recovery within 15 min</span>');
      tl.fade = ramp(s.T, 1.4, 1.8);
    },
  };
}

function languages({ label }) {
  const g = group();
  const L = [['English', 'Hello', 0x1e40af], ['isiZulu', 'Sawubona', 0x92400e], ['Afrikaans', 'Hallo', 0x115e59]];
  const cards = L.map(([n, hi, c], i) => {
    const card = at(group(rbox(3.6, 2.6, 0.25, c, { metal: 0.35 }), at(box(3.2, 0.12, 0.27, C.white, { glow: 0.4, opacity: 0.7 }), 0, -0.95, 0)), -4.4 + i * 4.4, 1.4, 0);
    card.userData.lbl = label(card, `<div style="font-size:40px;font-weight:800">${n}</div><div class="small" style="margin-top:6px">“${hi}”</div>`, 'tile', [0, 0.15, 0.3]);
    return card;
  });
  const glass = group(torus(0.6, 0.1, C.white, { metal: 0.9, rough: 0.15 }), at(rot(cyl(0.09, 0.12, 1.2, C.gold, { metal: 0.7 }), 0, 0, 0.75), 0.75, -0.95, 0),
                      rot(cyl(0.55, 0.55, 0.04, 0xbfdbfe, { opacity: 0.35, depthWrite: false }), Math.PI / 2, 0, 0));
  const badge = anchor(0, -0.75);
  g.add(...cards, glass, badge);
  const bl = label(badge, '<span class="warn">Checked for accuracy</span>', 'tag big');
  return {
    group: g,
    update(s) {
      cards.forEach((c, i) => {
        const k = eo(ramp(s.cue(i), 0, 0.8));
        c.rotation.y = Math.PI * (1 - k); pop(c, s.cue(i), 0.5);
        c.position.y = 1.4 + 0.1 * wave(s.t, 0.5, i * 0.3);
        c.userData.lbl.fade = clamp(Math.cos(c.rotation.y) * 2);
      });
      const m = ramp(s.cue(3), 0, 2.2);
      glass.position.set(lerp(-6.2, 6.0, eio(m)), 1.5 + 0.3 * Math.sin(m * Math.PI * 3), 1.4);
      pop(glass, s.cue(3) + 0.05, 0.4); fade(glass, 1 - ramp(m, 0.9, 1));
      bl.fade = ramp(s.cue(3), 0.4, 0.8);
    },
  };
}

// ===================================================== Slide 4
function pilot({ label }) {
  const g = group(); g.rotation.x = 0.18;
  const x0 = -5.6, len = 10.8, y = 1.2;
  const track = at(rbox(len + 0.6, 0.3, 0.8, 0x1e293b), x0 + len / 2, y, 0);
  const fill = at(leftGeom(box(1, 0.32, 0.82, C.gold, { glow: 0.45 })), x0, y, 0);
  const ms = [0, 0.5, 1].map((p) => at(rot(cyl(0.55, 0.55, 0.25, C.white, { metal: 0.6 }), Math.PI / 2, 0, 0), x0 + p * len, y, 0.15));
  const nums = ['0', '30', '60'].map((n, i) => at(txt(n, 0.85, i ? C.gold : C.white, { glow: 0.25 }), ms[i].position.x, y + 1.5, 0));
  const dot = sphere(0.36, C.gold, { glow: 0.8 });
  g.add(track, fill, ...ms, ...nums, dot);
  ['Day 0 · Start', 'Day 30 · Pilot ends', 'Day 60 · Review results'].forEach((t, i) => label(ms[i], t, 'tag', [0, -0.95, 0]));
  return {
    group: g,
    update(s) {
      pop(track, s.T); pop(ms[0], s.T - 0.2); pop(nums[0], s.T - 0.3);
      const p = 0.5 * eio(ramp(s.cue(0), 0.2, 1.8)) + 0.5 * eio(ramp(s.cue(1), 0.2, 1.8));
      fill.scale.set(Math.max(1e-3, p * len), 1, 1);
      dot.position.set(x0 + p * len, y + 0.05, 0.55);
      pop(ms[1], s.cue(0)); pop(nums[1], s.cue(0) - 0.2);
      pop(ms[2], s.cue(1)); pop(nums[2], s.cue(1) - 0.2);
      ms.forEach((m, i) => { m.material.emissive.setHex(C.gold); m.material.emissiveIntensity = p >= i * 0.5 - 0.01 ? 0.5 : 0; });
      g.rotation.y = Math.sin(s.t * 0.3) * 0.1;
    },
  };
}

function kpis({ label }) {
  const g = group();
  const clockIcon = () => {
    const c = group(rot(cyl(0.55, 0.55, 0.12, C.dark), Math.PI / 2, 0, 0), torus(0.56, 0.06, C.amber, { glow: 0.5 }));
    const h1 = at(box(0.07, 0.4, 0.05, C.white), 0, 0.17, 0.1); const h2 = rot(at(box(0.07, 0.3, 0.05, C.white), 0.1, -0.06, 0.1), 0, 0, -2.2);
    c.add(h1, h2); c.userData.hand = h1; return c;
  };
  const ICONS = [clockIcon(), gear(0.5, C.amber, { glow: 0.2 }), database(0.42, C.amber, { glow: 0.2 }), lock(0.65, C.amber, true)];
  const T = ['Stock delays', 'System recovery time', 'Possible data loss', 'Unauthorised access'];
  const n = T.length;
  const tiles = T.map((name, i) => {
    const off = i - (n - 1) / 2;
    const t = at(group(rbox(2.8, 3.0, 0.3, 0x1e293b, { metal: 0.4 })), off * 3.2, 1.8, -Math.abs(off) * 0.4);
    t.rotation.y = -off * 0.13;
    const icon = at(ICONS[i], 0, i === 2 ? 0.05 : 0.45, 0.4);
    const ring = at(torus(0.85, 0.05, C.amber, { glow: 0.9 }), 0, 0.45, 0.2);
    t.add(icon, ring); t.userData.icon = icon; t.userData.ring = ring;
    label(t, name, 'kpi', [0, -0.95, 0.3]);
    return t;
  });
  g.add(...tiles);
  return {
    group: g,
    update(s) {
      tiles.forEach((t, i) => {
        const c = s.cue(i);
        pop(t, c + 0.15, 0.5); pop(t.userData.icon, c - 0.1);
        pop(t.userData.ring, c - 0.3); if (c > 0.85) t.userData.ring.scale.setScalar(1 + 0.12 * wave(s.t, 1.1, i * 0.2));
        t.position.y = 1.8 + 0.08 * wave(s.t, 0.4, i * 0.2);
      });
      tiles[0].userData.icon.userData.hand.rotation.z = -s.t * 2;
      tiles[1].userData.icon.rotation.z = s.t * 0.8;
      tiles[3].userData.icon.rotation.y = Math.sin(s.t) * 0.4;
    },
  };
}

function gates({ label }) {
  const g = group(); g.rotation.set(0.2, -0.3, 0);
  const road = at(rbox(11, 0.25, 1.8, 0x1f2937), -0.4, -0.6, 0);
  const dashes = Array.from({ length: 10 }, (_, i) => at(box(0.5, 0.02, 0.08, C.white, { opacity: 0.5 }), -5.4 + i * 1.1, -0.47, 0));
  const mkGate = (x) => {
    const panel = at(box(0.12, 1.5, 1.9, C.red, { glow: 0.35, opacity: 0.85 }), 0, 0.3, 0);
    const gg = at(group(at(box(0.25, 2.8, 0.25, C.steel), 0, 0.8, 1.05), at(box(0.25, 2.8, 0.25, C.steel), 0, 0.8, -1.05), at(box(0.3, 0.3, 2.4, C.steel), 0, 2.2, 0), panel), x, -0.5, 0);
    gg.userData.panel = panel; gg.userData.ck = at(check(0.4), x, 2.6, 0); return gg;
  };
  const G = [mkGate(-2.4), mkGate(1.6)];
  const flag = at(group(at(cyl(0.06, 0.06, 2.8, C.white), 0, 0.9, 0), at(box(1.1, 0.7, 0.04, C.gold, { glow: 0.3 }), 0.55, 1.95, 0)), 4.4, -0.5, 0);
  const tok = sphere(0.4, C.teal, { glow: 0.6 });
  g.add(road, ...dashes, ...G, ...G.map((x) => x.userData.ck), flag, tok);
  label(G[0], 'Tested again', 'tag', [0, 3.3, 0]);
  label(G[1], 'Costs approved', 'tag', [0, 3.3, 0]);
  label(flag, 'All stores', 'tag big', [0.4, 3.0, 0]);
  return {
    group: g,
    update(s) {
      G.forEach((gg, i) => {
        const o = eo(ramp(s.cue(i), 0, 0.6));
        gg.userData.panel.position.y = 0.3 + 1.4 * o; tint(gg.userData.panel, C.green, o); fade(gg.userData.panel, 1 - 0.6 * o);
        pop(gg.userData.ck, s.cue(i) - 0.3);
        pop(gg, s.T - 0.2 - i * 0.15);
      });
      pop(flag, s.T - 0.5); flag.children[1].rotation.y = 0.25 * wave(s.t, 0.8);
      let x = lerp(-5.6, -3.3, eo(ramp(s.T, 0.3, 1.2)));
      x = lerp(x, 0.7, eio(ramp(s.cue(0), 0.5, 1.5)));
      x = lerp(x, 3.8, eio(ramp(s.cue(1), 0.9, 2.1)));
      tok.position.set(x, 0.0 + 0.1 * Math.abs(wave(s.t, 1.2)), 0); pop(tok, s.T - 0.3);
    },
  };
}

function protect({ label }) {
  const g = group();
  const cols = [C.teal, C.sky, C.violet];
  const names = ['Customer trust', 'Delivery running', 'Stronger business'];
  const bars = group(...[0.5, 0.8, 1.1].map((h, i) => at(baseGeom(box(0.28, h, 0.2, C.white, { glow: 0.3 })), -0.4 + i * 0.4, -0.55, 0)));
  const icons = [heart(0.38, C.white), chevrons(0.32, C.white), bars];
  const sh = cols.map((c, i) => {
    const s = at(group(shield(0.95, c, { glow: 0.12 }), at(icons[i], 0, 0.1, 0.5)), -4.2 + i * 4.0, 1.4, 0);
    label(s, names[i], 'tag', [0, -2.35, 0]);
    return s;
  });
  g.add(...sh);
  return {
    group: g,
    update(s) {
      sh.forEach((m, i) => {
        const k = eo(ramp(s.cue(i), 0, 0.9));
        m.position.y = lerp(-1.5, 1.4, k) + 0.08 * wave(s.t, 0.5, i * 0.3);
        m.rotation.y = (1 - k) * Math.PI * 2 + Math.sin(s.t * 0.6 + i) * 0.15;
        pop(m, s.cue(i), 0.5);
      });
    },
  };
}

function signoff({ label }) {
  const g = group();
  const doc = at(group(), -2.8, 1.2, 0); doc.rotation.set(-0.12, 0.32, 0);
  doc.add(rbox(3.6, 4.6, 0.08, 0xf8fafc, { rough: 0.85, metal: 0, r: 0.03 }), at(box(2.6, 0.24, 0.02, 0x334155), 0, 1.75, 0.05));
  for (let i = 0; i < 6; i++) doc.add(at(box(i % 3 === 2 ? 2.0 : 2.8, 0.08, 0.02, 0x94a3b8), i % 3 === 2 ? -0.4 : 0, 1.15 - i * 0.38, 0.05));
  doc.add(at(box(2.3, 0.04, 0.02, 0x0f172a), 0, -1.75, 0.05));
  const sig = drawTube([[-1.1, -1.6, 0.07], [-0.8, -1.15, 0.07], [-0.6, -1.65, 0.07], [-0.35, -1.25, 0.07], [-0.1, -1.6, 0.07], [0.15, -1.3, 0.07], [0.4, -1.55, 0.07], [0.7, -1.35, 0.07], [1.05, -1.5, 0.07]], 0.035, 0x1d4ed8, { glow: 0.2 });
  const pen = group(at(cyl(0.08, 0.08, 1.5, C.gold, { metal: 0.8 }), 0, 0.85, 0), at(cone(0.08, 0.22, C.dark), 0, 0, 0));
  pen.children[1].rotation.x = Math.PI; pen.children[1].position.y = 0.0;
  const seal = at(group(rot(cyl(0.55, 0.55, 0.06, C.gold, { metal: 0.8 }), Math.PI / 2, 0, 0), at(check(0.25, C.dark), 0, 0, 0.08)), 1.2, -0.7, 0.12);
  doc.add(sig, pen, seal);
  const chips = ['Approve the pilot', 'Assign a responsible manager', 'Decide on full rollout'].map((t, i) => {
    const ck = at(check(0.38), 1.9, 3.0 - i * 1.25, 0);
    const a = anchor(4.0, 3.0 - i * 1.25); g.add(ck, a);
    return { ck, L: label(a, t, 'tag') };
  });
  g.add(doc);
  return {
    group: g,
    update(s) {
      pop(doc, s.T, 0.6);
      const p = eo(ramp(s.cue(0), 0, 1.4));
      sig.userData.set(p);
      const tip = sig.userData.curve.getPoint(Math.max(p, 0.001));
      pen.position.set(tip.x, tip.y, 0.1); pen.rotation.z = -0.45;
      fade(pen, ramp(s.cue(0), -0.4, 0) * (1 - ramp(s.cue(0), 1.5, 1.8)));
      pop(seal, s.cue(2) - 0.6, 0.45);
      chips.forEach(({ ck, L }, i) => { pop(ck, s.cue(i)); L.fade = ramp(s.cue(i), 0.15, 0.45); ck.rotation.y = Math.sin(s.t + i) * 0.3; });
      g.rotation.y = Math.sin(s.t * 0.3) * 0.08;
    },
  };
}

function thanks({ label }) {
  const g = group();
  const ring = at(arcRing(4.1, 0.12, C.gold), 0, 1.2, -0.6);
  const ty = at(txt('Thank you', 1.0, C.white, { glow: 0.12 }), 0, 1.45, 0.2);
  const orbit = at(group(), 0, 1.2, 0); orbit.rotation.x = 1.2;
  [C.amber, C.teal, C.white, C.sky, C.gold, C.green, C.violet, C.red].forEach((c, i, arr) => {
    const a = (i / arr.length) * Math.PI * 2;
    orbit.add(at(rbox(0.5, 0.4, 0.4, c, { glow: 0.2 }), Math.cos(a) * 5.3, Math.sin(a) * 5.3, 0));
  });
  g.add(ring, ty, orbit);
  label(ty, 'SIXTY60 · AUDIT &amp; RISK COMMITTEE', 'tag', [0, -1.3, 0.3]);
  return {
    group: g,
    update(s) {
      ring.userData.set(eio(s.T / 1.6));
      pop(ty, s.T - 0.1, 0.7);
      orbit.rotation.z = s.t * 0.4;
      orbit.children.forEach((p, i) => { p.rotation.set(s.t * (0.7 + i * 0.1), s.t * 0.5, 0); pop(p, s.T - 0.3 - i * 0.06, 0.5); });
      g.rotation.y = Math.sin(s.t * 0.5) * 0.15;
    },
  };
}

export const SCENES = {
  title, surge, power, clock, goods, phone, conveyor, pillars, risk, promise,
  sam, drift, maturity, controls,
  mtd, rpo, standby, links, languages,
  pilot, kpis, gates, protect, signoff, thanks,
};
