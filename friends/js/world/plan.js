import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, cyl, keep, WP, easeOutBack, easeInOut, clamp } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { buildWall } from './walls.js';

/* The floor plan, in metres. x runs east (to the audience's right), z south (toward the audience),
   y up. Joey and Chandler's apartment (19) is west of the hall, Monica's (20) east of it; the stairs
   are at the north end of the hall. Layout after the Iñaki Aliste Lizarralde plan and the set photos. */
const R = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
export const ROOMS = {
  monica: [[1.05, 3.2], [9.6, 3.2], [9.6, -3.8], [6.5, -3.8], [6.5, -7.2], [5.2, -7.2], [5.2, -2.6], [1.05, -2.6]],
  mbath: [[1.05, -2.6], [3.4, -2.6], [3.4, -3.7], [5.2, -3.7], [5.2, -4.6], [1.05, -4.6]],
  balcony: R(6.5, -6.2, 9.6, -3.8),
  mbed: R(9.6, -5.2, 13.1, -.9),
  rbed: R(9.6, -.9, 13.1, 3.2),
  hall: [[-1.05, 3.2], [1.05, 3.2], [1.05, -4.6], [1.7, -4.6], [1.7, -7.4], [-1.7, -7.4], [-1.7, -4.6], [-1.05, -4.6]],
  guys: [[-8.2, 3.2], [-1.05, 3.2], [-1.05, -1.9], [-4.4, -1.9], [-4.4, -2.9], [-8.2, -2.9]],
  gbath: R(-4.4, -4.6, -1.05, -1.9),
  cbed: R(-11.7, -3.4, -8.2, .2),
  jbed: R(-11.7, .2, -8.2, 3.2),
};
export const BOUNDS = { x0: -11.9, x1: 13.3, z0: -7.6, z1: 3.4 };
/* the building's outer face, for the base slab */
export const OUTLINE = [[-11.85, 3.35], [13.25, 3.35], [13.25, -5.35], [9.75, -5.35], [9.75, -6.35], [6.65, -6.35], [6.65, -7.35], [5.05, -7.35],
  [5.05, -4.75], [1.85, -4.75], [1.85, -7.55], [-1.85, -7.55], [-1.85, -4.75], [-4.55, -4.75], [-4.55, -3.05], [-8.075, -3.05], [-8.075, -3.55], [-11.85, -3.55]];

/* ---------- heights: Monica's step and corridor, the balcony, the stairs ---------- */
export const STAIR = { x0: -1.62, xm: 0, x1: 1.62, zBottom: -4.75, zLand: -6.55, zBack: -7.25, rise: .175, run: .2571, n: 8 };
export function heightAt(x, z, smooth = false) {
  if (x > 5.2 && x < 9.6 && z < -2.6 && z > -3.8) return .16;
  if (x > 5.2 && x < 6.5 && z <= -3.8 && z > -7.2) return .16;
  if (x > 6.5 && x < 9.6 && z < -3.8 && z > -6.2) return .1;
  const S = STAIR;
  if (x > S.x0 - .1 && x < S.x1 + .1 && z < S.zBottom + .02) {
    if (z <= S.zLand) return S.rise * S.n;
    const k = (S.zBottom - z) / S.run;               /* treads climbed from the bottom of flight 1 */
    const steps = smooth ? clamp(k, 0, S.n - 1) : clamp(Math.floor(k) + 1, 0, S.n - 1);
    if (x < S.xm) return steps * S.rise;               /* flight 1 climbs north */
    const k2 = (z - S.zLand) / S.run;                  /* flight 2 climbs south from the landing */
    const s2 = smooth ? clamp(k2, 0, S.n) : clamp(Math.floor(k2) + 1, 0, S.n);
    return S.rise * S.n + s2 * S.rise;
  }
  return 0;
}

export const W = {};   /* wall records by name */
export const P = {};   /* placement frames along walls */
export const doors = {};

/* A wall between a and b that faces the room holding `front`. Openings are given in world
   coordinates along the wall (x for east-west walls, z for north-south ones). */
function wall(name, a, b, front, o = {}) {
  let A = a, B = b;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  if ((front[0] - mx) * (-dz / L) + (front[1] - mz) * (dx / L) < 0) { A = b; B = a; }
  const horiz = Math.abs(dx) > Math.abs(dz), tOf = v => Math.abs(v - (horiz ? A[0] : A[1]));
  const openings = (o.openings || []).map(op => {
    const t0 = tOf(op.at[0]), t1 = tOf(op.at[1]);
    return { y0: op.y0, y1: op.y1, from: Math.min(t0, t1), to: Math.max(t0, t1) };
  });
  W[name] = buildWall({ name, ...o, a: A, b: B, openings });
  W[name].th = o.t ?? .14;
  P[name] = WP(A, B);
  return W[name];
}

/* a point on a wall's front face: v is the world coordinate along the wall */
export function onWall(name, v, y, off = .02) {
  const p = P[name], horiz = Math.abs(p.u[0]) > Math.abs(p.u[1]);
  const t = Math.abs(v - (horiz ? p.a[0] : p.a[1]));
  return { pos: p.at(t, off, y), rotY: p.rotY, n: p.n };
}

const shapeOf = pts => {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]);
  s.closePath(); return s;
};
const slab = (pts, y = -.34, d = .34) => {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: d, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); const o = M(g, MAT.slab); o.position.y = y; app.static.add(o); return o;
};
export const floorPoly = (pts, material, y = .012) => {
  const g = new THREE.ShapeGeometry(shapeOf(pts)); g.rotateX(-Math.PI / 2);
  const o = new THREE.Mesh(g, material); o.position.y = y; o.receiveShadow = true; app.static.add(o); return o;
};
/* a raised floor: a thin solid with its own top */
const deck = (pts, top, material) => {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: top, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); const o = M(g, [material, MAT.woodDark]); o.castShadow = false; app.static.add(o); return o;
};

/* ---------- doors ---------- */
/* a hinged leaf; open() swings it, burst() slams it, close() shuts it */
export function makeDoor(pivot, openAngle) {
  const base = pivot.rotation.y;
  const d = { pivot, openAngle, angle: 0, from: 0, to: 0, t: 1, dur: 1, ease: easeInOut, isOpen: false, wobble: 0, closing: false };
  const go = (to, dur, ease) => { d.from = d.angle; d.to = to; d.t = 0; d.dur = dur; d.ease = ease; };
  d.burst = () => { go(openAngle, .26, easeOutBack); d.isOpen = true; d.closing = false; d.wobble = 1; };
  d.open = (k = .92) => { if (d.isOpen) return; go(openAngle * k, .7, easeInOut); d.isOpen = true; d.closing = false; app.emit('door:open', d); };
  d.close = () => { if (!d.isOpen) return; go(0, .85, easeInOut); d.isOpen = false; d.closing = true; };
  d.update = dt => {
    if (d.t < 1) {
      d.t = Math.min(1, d.t + dt / d.dur); d.angle = d.from + (d.to - d.from) * d.ease(d.t);
      if (d.t === 1 && d.closing) { d.closing = false; app.emit('door:shut', d); }
    }
    d.wobble = Math.max(0, d.wobble - dt / 1.2);
    pivot.rotation.y = base + d.angle + (d.isOpen ? Math.sin(app.time * 14) * .014 * d.wobble : 0);
  };
  app.onUpdate(d.update);
  return d;
}

/* A door leaf hung at `hinge`, closing onto `jamb`, opening into the side that holds `into`.
   The leaf's local +z face looks out of that room; faces: [outside, inside]. */
export function hangDoor({ hinge, jamb, into, h = 2.08, t = .05, faces, open = 1.75, parent = app.root }) {
  const ux = jamb[0] - hinge[0], uz = jamb[1] - hinge[1], L = Math.hypot(ux, uz), w = L - .02;
  const th0 = Math.atan2(-uz / L, ux / L);
  /* opening turns the free edge toward m; the leaf's local +z face looks along -m */
  const m = [uz, -ux], sign = (m[0] * (into[0] - hinge[0]) + m[1] * (into[1] - hinge[1])) > 0 ? 1 : -1;
  const pivot = keep(new THREE.Group()); pivot.position.set(hinge[0], 0, hinge[1]); pivot.rotation.y = th0;
  const leaf = new THREE.Group(); leaf.position.x = .01; pivot.add(leaf);
  const edge = faces[2] ?? MAT.woodDark, outside = faces[0], inside = faces[1];
  const plusZ = sign > 0 ? outside : inside, minusZ = sign > 0 ? inside : outside;
  const slabMesh = M(new THREE.BoxGeometry(w, h, t), [edge, edge, edge, edge, plusZ, minusZ]);
  slabMesh.position.set(w / 2, h / 2 + .005, 0); leaf.add(slabMesh);
  parent.add(pivot);
  const d = makeDoor(pivot, open * sign);
  const out = sign * (t / 2 + .004);
  Object.assign(d, { leaf, w, h, t, out, in: -out, outRot: sign > 0 ? 0 : Math.PI, inRot: sign > 0 ? Math.PI : 0,
    center: new THREE.Vector3((hinge[0] + jamb[0]) / 2, 0, (hinge[1] + jamb[1]) / 2) });
  return d;
}

/* frame around a doorway on both faces of a wall, and a transom light above */
function doorFrame(name, v0, v1, top = 2.1, transom = true, trim = MAT.woodDark, backTrim = trim) {
  const p = P[name], horiz = Math.abs(p.u[0]) > Math.abs(p.u[1]);
  const tA = Math.abs(v0 - (horiz ? p.a[0] : p.a[1])), tB = Math.abs(v1 - (horiz ? p.a[0] : p.a[1]));
  const t0 = Math.min(tA, tB), t1 = Math.max(tA, tB), off = W[name].th / 2 + .012;
  const g = new THREE.Group();
  const H = transom ? 2.62 : top;
  for (const [side, m] of [[1, trim], [-1, backTrim]]) {
    for (const tt of [t0 - .04, t1 + .04]) { const q = p.at(tt, side * off, H / 2); box(g, .08, H, .025, m, q.x, q.y, q.z, p.rotY); }
    const q = p.at((t0 + t1) / 2, side * off, H + .04); box(g, t1 - t0 + .16, .08, .025, m, q.x, q.y, q.z, p.rotY);
    if (transom) { const r = p.at((t0 + t1) / 2, side * off, top + .04); box(g, t1 - t0, .06, .025, m, r.x, r.y, r.z, p.rotY); }
  }
  if (transom) {
    const q = p.at((t0 + t1) / 2, 0, (top + .07 + H) / 2), gl = new THREE.Mesh(new THREE.PlaneGeometry(t1 - t0 - .02, H - top - .09), MAT.transom);
    gl.position.copy(q); gl.rotation.y = p.rotY; g.add(gl);
  }
  app.root.add(g); keep(g);
  W[name].attach.push(g);
  return g;
}

export function buildPlan() {
  /* ---------- ground + base ---------- */
  MAT.ground = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: .95 });
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), MAT.ground);
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -.385; gnd.receiveShadow = true;
  keep(gnd); app.scene.add(gnd); app.ground = gnd;
  MAT.transom = new THREE.MeshStandardMaterial({ color: 0xdfe6e4, roughness: .25, metalness: .1, transparent: true, opacity: .55, side: THREE.DoubleSide });

  slab(OUTLINE);

  /* ---------- floors ---------- */
  floorPoly([[1.05, 3.2], [9.6, 3.2], [9.6, -2.6], [1.05, -2.6]], MAT.floorM);
  deck([[5.2, -2.6], [9.6, -2.6], [9.6, -3.8], [6.5, -3.8], [6.5, -7.2], [5.2, -7.2]], .16, MAT.floorM);
  floorPoly(ROOMS.mbath, MAT.checker);
  floorPoly(R(3.4, -3.7, 5.2, -2.6), MAT.court);
  deck(ROOMS.balcony, .1, MAT.tar);
  floorPoly(ROOMS.mbed, MAT.carpetM);
  floorPoly(ROOMS.rbed, MAT.carpetR);
  floorPoly(ROOMS.hall, MAT.hallFloor);
  floorPoly(ROOMS.guys, MAT.floorG);
  floorPoly(ROOMS.gbath, MAT.floorBathG);
  floorPoly(ROOMS.cbed, MAT.carpetC);
  floorPoly(ROOMS.jbed, MAT.carpetJ);

  /* ---------- Monica's (20) ---------- */
  const DOOR = [.45, 1.35], TOP = 2.62;
  wall('mW', [1.05, 3.2], [1.05, -2.6], [3, 0], { style: 'monica', back: 'hall', t: .2, openings: [{ at: DOOR, y1: TOP }] });
  wall('mbW', [1.05, -2.6], [1.05, -4.6], [2, -3.5], { style: 'mbath', back: 'hall', t: .2 });
  wall('mN1', [1.05, -2.6], [3.4, -2.6], [2, 0], { style: 'brick', back: 'mbath', t: .2 });
  wall('mN2', [3.4, -2.6], [5.2, -2.6], [4, 0], { style: 'brick', back: 'brickOut', t: .2, openings: [{ at: [3.45, 4.35], y0: 1.02, y1: 2.14 }] });
  wall('mCtW', [3.4, -2.6], [3.4, -3.7], [2.5, -3.2], { style: 'mbath', back: 'brickOut', t: .14 });
  wall('mCtN', [3.4, -3.7], [5.2, -3.7], [4.3, -4.2], { style: 'mbath', back: 'brickOut', t: .14 });
  wall('mbN1', [1.05, -4.6], [1.7, -4.6], [1.4, -3.5], { style: 'mbath', back: 'hall', t: .2 });
  wall('mbN2', [1.7, -4.6], [5.2, -4.6], [3, -3.5], { style: 'mbath', skin: true, t: .25 });
  wall('mcW1', [5.2, -2.6], [5.2, -3.7], [5.8, -3.2], { style: 'monica', back: 'brickOut', t: .14 });
  wall('mcW2', [5.2, -3.7], [5.2, -4.6], [5.8, -4.1], { style: 'monica', back: 'mbath', t: .14, openings: [{ at: [-4.5, -3.8], y1: 2.08 }] });
  wall('mcW3', [5.2, -4.6], [5.2, -7.2], [5.8, -5.5], { style: 'monica', skin: true, t: .25 });
  wall('mcE1', [6.5, -3.8], [6.5, -6.2], [5.8, -5], { style: 'monica', back: 'brickOut', t: .25, openings: [{ at: [-5.55, -4.75], y0: .72, y1: 1.98 }] });
  wall('mcE2', [6.5, -6.2], [6.5, -7.2], [5.8, -6.7], { style: 'plain', skin: true, t: .25 });
  wall('mcN', [5.2, -7.2], [6.5, -7.2], [5.8, -6.7], { style: 'plain', skin: true, t: .25 });
  wall('mcDoor', [5.2, -6.2], [6.5, -6.2], [5.8, -5.5], { style: 'green', back: 'plain', t: .12, openings: [{ at: [5.45, 6.25], y1: 2.06 }] });
  wall('mN3', [6.5, -3.8], [9.6, -3.8], [8, -2], { style: 'monica', back: 'brickOut', t: .25, openings: [{ at: [6.78, 9.32], y0: .6, y1: 2.64 }] });
  wall('balN', [6.5, -6.2], [9.6, -6.2], [8, -5], { style: 'brickOut', back: 'brickOut', t: .3, h: 1.05, cuttable: false });
  wall('balE', [9.6, -6.2], [9.6, -5.2], [8, -5.7], { style: 'brickOut', back: 'brickOut', t: .3, h: 1.05, cuttable: false });
  wall('mbdW', [9.6, -3.8], [9.6, -5.2], [11, -4.5], { style: 'mbed', back: 'brickOut', t: .25 });
  wall('mP1', [9.6, -3.8], [9.6, -.9], [8, -2], { style: 'monica', back: 'mbed', t: .16, openings: [{ at: [-3.45, -2.6], y1: TOP }] });
  wall('mP2', [9.6, -.9], [9.6, 3.2], [8, 1], { style: 'monica', back: 'rbed', t: .16, openings: [{ at: [1.9, 2.75], y1: TOP }] });
  wall('mbdN', [9.6, -5.2], [13.1, -5.2], [11, -3], { style: 'mbed', skin: true, t: .3 });
  wall('mbdE', [13.1, -5.2], [13.1, -.9], [11, -3], { style: 'mbed', skin: true, t: .3, openings: [{ at: [-3.7, -2.5], y0: .8, y1: 2.2 }] });
  wall('mbdS', [9.6, -.9], [13.1, -.9], [11, -3], { style: 'mbed', back: 'rbed', t: .14 });
  wall('rbdE', [13.1, -.9], [13.1, 3.2], [11, 1], { style: 'rbed', skin: true, t: .3, openings: [{ at: [.5, 1.7], y0: .8, y1: 2.2 }] });
  wall('rbdS', [9.6, 3.2], [13.1, 3.2], [11, 1], { style: 'rbed', skin: true, t: .3, h: 1.1 });
  wall('mS', [1.05, 3.2], [9.6, 3.2], [5, 0], { style: 'monica', skin: true, t: .3, h: 1.1 });

  /* ---------- Joey and Chandler's (19) ---------- */
  wall('gE', [-1.05, -1.9], [-1.05, 3.2], [-3, 1], { style: 'guys', back: 'hall', t: .2, openings: [{ at: DOOR, y1: TOP }] });
  wall('gbE', [-1.05, -4.6], [-1.05, -1.9], [-2.5, -3], { style: 'gbath', back: 'hall', t: .2 });
  wall('gN1', [-4.4, -1.9], [-1.05, -1.9], [-3, 0], { style: 'guys', back: 'gbath', t: .16 });
  wall('gJ', [-4.4, -2.9], [-4.4, -1.9], [-6, -1], { style: 'guys', back: 'gbath', t: .16, openings: [{ at: [-2.8, -2.02], y1: 2.08 }] });
  wall('gbW', [-4.4, -4.6], [-4.4, -2.9], [-3, -3.5], { style: 'gbath', skin: true, t: .25 });
  wall('gbN1', [-4.4, -4.6], [-1.7, -4.6], [-3, -3.5], { style: 'gbath', skin: true, t: .25 });
  wall('gbN2', [-1.7, -4.6], [-1.05, -4.6], [-1.4, -3.5], { style: 'gbath', back: 'hall', t: .2 });
  wall('gN2', [-8.2, -2.9], [-4.4, -2.9], [-6, 0], { style: 'guys', skin: true, t: .3, openings: [{ at: [-7.85, -6.9], y0: .55, y1: 2.45 }, { at: [-6.3, -5.35], y0: .55, y1: 2.45 }] });
  wall('gW1', [-8.2, -2.9], [-8.2, .2], [-6, -1], { style: 'guys', back: 'cbed', t: .16, openings: [{ at: [-2.72, -1.87], y1: TOP }] });
  wall('gW2', [-8.2, .2], [-8.2, 3.2], [-6, 1.5], { style: 'guys', back: 'jbed', t: .16, openings: [{ at: [1.95, 2.8], y1: TOP }] });
  wall('cbE', [-8.2, -3.4], [-8.2, -2.9], [-10, -2], { style: 'cbed', skin: true, t: .25 });
  wall('cbN', [-11.7, -3.4], [-8.2, -3.4], [-10, -2], { style: 'cbed', skin: true, t: .3 });
  wall('cbW', [-11.7, -3.4], [-11.7, .2], [-10, -1], { style: 'cbed', skin: true, t: .3, openings: [{ at: [-2.3, -1.1], y0: .8, y1: 2.2 }] });
  wall('cbS', [-11.7, .2], [-8.2, .2], [-10, -1], { style: 'cbed', back: 'jbed', t: .14 });
  wall('jbW', [-11.7, .2], [-11.7, 3.2], [-10, 1.5], { style: 'jbed', skin: true, t: .3, openings: [{ at: [1.0, 2.2], y0: .8, y1: 2.2 }] });
  wall('jbS', [-11.7, 3.2], [-8.2, 3.2], [-10, 1.5], { style: 'jbed', skin: true, t: .3, h: 1.1 });
  wall('gS', [-8.2, 3.2], [-1.05, 3.2], [-5, 0], { style: 'guys', skin: true, t: .3, h: 1.1 });

  /* ---------- the stairwell ---------- */
  wall('sW', [-1.7, -4.6], [-1.7, -7.4], [0, -6], { style: 'hall', skin: true, t: .25 });
  wall('sE', [1.7, -4.6], [1.7, -7.4], [0, -6], { style: 'hall', skin: true, t: .25 });
  wall('sN', [-1.7, -7.4], [1.7, -7.4], [0, -6], { style: 'hall', skin: true, t: .3, openings: [{ at: [-.45, .45], y0: 1.95, y1: 2.62 }] });

  /* ---------- door frames ---------- */
  doorFrame('mW', ...DOOR, 2.1, true, MAT.purpleDoor, MAT.woodDark);
  doorFrame('gE', ...DOOR, 2.1, true, MAT.creamDoor, MAT.woodDark);
  doorFrame('mP1', -3.45, -2.6, 2.1, true, MAT.purpleDoor, MAT.cream);
  doorFrame('mP2', 1.9, 2.75, 2.1, true, MAT.purpleDoor, MAT.cream);
  doorFrame('gW1', -2.72, -1.87, 2.1, true, MAT.creamDoor, MAT.creamDoor);
  doorFrame('gW2', 1.95, 2.8, 2.1, true, MAT.creamDoor, MAT.creamDoor);
  doorFrame('mcW2', -4.5, -3.8, 2.06, false, MAT.purpleDoor, MAT.white);
  doorFrame('gJ', -2.8, -2.02, 2.06, false, MAT.creamDoor, MAT.white);
  doorFrame('mcDoor', 5.45, 6.25, 2.04, false, MAT.pine, MAT.cream);

  /* ---------- the two front doors ---------- */
  MAT.doorNum19 = new THREE.MeshStandardMaterial({ map: TX.numeralTex('19'), transparent: true, roughness: .3, metalness: .7 });
  MAT.doorNum20 = new THREE.MeshStandardMaterial({ map: TX.numeralTex('20'), transparent: true, roughness: .3, metalness: .7 });
  const front = (x, into, inside, numMat) => {
    const d = hangDoor({ hinge: [x, DOOR[1]], jamb: [x, DOOR[0]], into, faces: [MAT.greenDoor, inside, MAT.woodDark] });
    const L = d.leaf, knobX = d.w - .1;
    const num = new THREE.Mesh(new THREE.PlaneGeometry(.2, .15), numMat); num.position.set(d.w / 2, 1.62, d.out + Math.sign(d.out) * .002); num.rotation.y = d.outRot; L.add(num);
    for (const s of [d.out, d.in]) {
      const side = Math.sign(s);
      cyl(L, .03, .03, .06, MAT.brass, knobX, 1.0, s + side * .03).rotation.x = Math.PI / 2;
      cyl(L, .045, .045, .01, MAT.brass, knobX, 1.0, s + side * .005).rotation.x = Math.PI / 2;
      cyl(L, .026, .026, .02, MAT.brass, knobX, 1.22, s + side * .01).rotation.x = Math.PI / 2;
      cyl(L, .01, .01, .015, MAT.brass, d.w / 2, 1.52, s + side * .008).rotation.x = Math.PI / 2;
    }
    return d;
  };
  doors.m20 = front(1.05, [3, 1], MAT.purpleDoor, MAT.doorNum20);
  doors.g19 = front(-1.05, [-3, 1], MAT.creamDoor, MAT.doorNum19);

  /* interior doors, hung open */
  const inner = (hinge, jamb, into, faces, open, k) => {
    const d = hangDoor({ hinge, jamb, into, faces, open, h: 2.04 });
    d.angle = d.to = d.openAngle * k; d.isOpen = true; d.update(0);
    return d;
  };
  doors.mbed = inner([9.6, -2.6], [9.6, -3.45], [11, -2.5], [MAT.purpleDoor, MAT.cream, MAT.cream], 1.45, .85);
  doors.rbed = inner([9.6, 2.75], [9.6, 1.9], [11, 2], [MAT.purpleDoor, MAT.cream, MAT.cream], 1.45, .8);
  doors.cbed = inner([-8.2, -1.87], [-8.2, -2.72], [-10, -2], [MAT.creamDoor, MAT.creamDoor, MAT.creamDoor], 1.45, .78);
  doors.jbed = inner([-8.2, 2.8], [-8.2, 1.95], [-10, 2], [MAT.creamDoor, MAT.creamDoor, MAT.creamDoor], 1.45, .8);
  doors.mbath = inner([5.2, -3.8], [5.2, -4.5], [4.4, -4.1], [MAT.purpleDoor, MAT.white, MAT.white], 1.4, .6);
  doors.gbath = inner([-4.4, -2.02], [-4.4, -2.8], [-3, -2.4], [MAT.creamDoor, MAT.white, MAT.white], 1.4, .55);
  doors.closet = hangDoor({ hinge: [5.45, -6.2], jamb: [6.25, -6.2], into: [5.8, -5.5], faces: [MAT.cream, MAT.pine, MAT.pine], open: 1.6, h: 2.02 });
}
