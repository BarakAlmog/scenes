import * as THREE from 'three';
import { app } from '../app.js';
import { easeInOutCubic, clamp, lerp, wrapAngle } from '../lib/util.js';
import { OUTLINE } from '../world/plan.js';
import { insideModel } from './cutaway.js';

/* Named views, framed to fit the screen's shape, with smooth flights between them. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const corners = (x0, x1, z0, z1, ys) => ys.flatMap(y => [V(x0, y, z0), V(x1, y, z0), V(x0, y, z1), V(x1, y, z1)]);
const FOOT = OUTLINE.flatMap(([x, z]) => [V(x, 0, z), V(x, 2.75, z)]);
const FRONT = corners(-11.7, 13.1, -3.8, 3.2, [0, 2.5]);
const MIDDLE = corners(-5.5, 7, -3.8, 3.2, [0, 2.5]);

export const VIEWS = {
  overview: { label: 'Overview', dir: V(.35, 6.6, 10).normalize(), portraitDir: V(6.5, 8, 7.5).normalize(), target: V(.7, .1, -2.0), pts: FOOT, margin: .92 },
  audience: { label: 'Audience', dir: V(0, .12, 1).normalize(), target: V(.7, 1.1, -.6), pts: FRONT, portraitPts: MIDDLE, margin: .97 },
  plan: { label: 'Floor plan', dir: V(0, 1, .02).normalize(), portraitDir: V(.02, 1, 0).normalize(), target: V(.7, 0, -2.1), pts: FOOT.filter(p => p.y > 1), margin: .95 },
  monica: { label: 'Monica’s', pos: V(8.6, 2.45, 6.4), target: V(4.9, .95, -1.3) },
  guys: { label: 'Joey & Chandler’s', pos: V(-9.4, 2.5, 6.5), target: V(-5.1, .95, -.7) },
  hall: { label: 'The hall', pos: V(0, 1.62, 3.05), target: V(-.35, 1.45, -5.6) },
  studio: { label: 'Studio', dir: V(.4, .46, 1).normalize(), target: V(.7, 1.2, 1.2), pts: corners(-15, 16.5, -10, 15.5, [-.4, 6]), margin: .98, hidden: true },
};

const cam = new THREE.PerspectiveCamera(), tmp = V();
const dirOf = view => app.camera.aspect < .8 && view.portraitDir ? view.portraitDir : view.dir;
function fit(view) {
  const c = app.camera; cam.fov = c.fov; cam.aspect = c.aspect; cam.near = .1; cam.far = 500; cam.updateProjectionMatrix();
  const pts = c.aspect < 1 && view.portraitPts ? view.portraitPts : view.pts, dir = dirOf(view);
  /* on a tall screen the title, the view bar and the dock cover the top and bottom */
  const my = c.aspect < .8 ? Math.min(view.margin, .66) : view.margin;
  let lo = 1, hi = 150;
  for (let i = 0; i < 26; i++) {
    const d = (lo + hi) / 2;
    cam.position.copy(view.target).addScaledVector(dir, d); cam.lookAt(view.target); cam.updateMatrixWorld();
    let ok = true;
    for (const p of pts) { tmp.copy(p).project(cam); if (Math.abs(tmp.x) > view.margin || Math.abs(tmp.y) > my || tmp.z > 1 || tmp.z < -1) { ok = false; break; } }
    if (ok) hi = d; else lo = d;
  }
  return hi;
}
export function resolve(name) {
  const v = VIEWS[name];
  if (v.pos) return { pos: v.pos.clone(), target: v.target.clone() };
  return { pos: v.target.clone().addScaledVector(dirOf(v), fit(v)), target: v.target.clone() };
}

/* ---------- flights, in orbit coordinates so moves arc around the model ---------- */
const tw = { on: false, t: 0, dur: 1.6, p0: V(), p1: V(), t0: V(), t1: V(), s0: new THREE.Spherical(), s1: new THREE.Spherical() };
export const view = { name: null, moved: false, flying: false };

export function flyTo(target, dur = 1.6) {
  const { pos, target: tg } = typeof target === 'string' ? resolve(target) : target;
  const c = app.camera, ctl = app.controls;
  tw.t0.copy(ctl.target); tw.t1.copy(tg); tw.p0.copy(c.position); tw.p1.copy(pos);
  tw.s0.setFromVector3(tmp.copy(c.position).sub(ctl.target)); tw.s1.setFromVector3(tmp.copy(pos).sub(tg));
  tw.t = 0; tw.dur = app.reducedMotion ? .001 : dur; tw.on = true; view.flying = true;
  if (typeof target === 'string') { view.name = target; view.moved = false; } else view.moved = true;
  ctl.autoRotate = false;
  app.emit('view', view.name);
}
export function jumpTo(name) { flyTo(name, .001); }

const sp = new THREE.Spherical();
function stepFlight(dt) {
  if (!tw.on) return;
  tw.t = Math.min(1, tw.t + dt / tw.dur);
  const e = easeInOutCubic(tw.t), c = app.camera, ctl = app.controls;
  ctl.target.lerpVectors(tw.t0, tw.t1, e);
  /* orbit-style arc unless either end is inside the rooms */
  if (insideModel(tw.p0) || insideModel(tw.p1)) c.position.lerpVectors(tw.p0, tw.p1, e);
  else {
    sp.radius = lerp(tw.s0.radius, tw.s1.radius, e); sp.phi = lerp(tw.s0.phi, tw.s1.phi, e);
    sp.theta = tw.s0.theta + wrapAngle(tw.s1.theta - tw.s0.theta) * e;
    c.position.setFromSpherical(sp).add(ctl.target);
  }
  if (tw.t >= 1) { tw.on = false; view.flying = false; writeHash(); }
}

export function cancelFlight() { tw.on = false; view.flying = false; }

/* ---------- the address bar remembers the view ---------- */
let hashTimer = 0;
export function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const c = app.camera.position, t = app.controls.target, q = new URLSearchParams();
    if (app.mode === 'sitcom') q.set('sitcom', '1');
    else if (view.name && !view.moved) q.set('v', view.name);
    else q.set('c', [c.x, c.y, c.z, t.x, t.y, t.z].map(n => n.toFixed(2)).join(','));
    if (Math.abs((app.tod?.hour ?? 16) - 16) > .05) q.set('t', app.tod.hour.toFixed(1));
    if (app.stage) q.set('stage', '1');
    history.replaceState(null, '', '#' + q.toString());
  }, 350);
}
export function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const out = { v: q.get('v'), stage: q.get('stage') === '1', sitcom: q.get('sitcom') === '1', t: q.get('t') };
  const c = q.get('c')?.split(',').map(Number);
  if (c?.length === 6 && c.every(Number.isFinite)) out.c = { pos: V(c[0], c[1], c[2]), target: V(c[3], c[4], c[5]) };
  if (out.v && !VIEWS[out.v]) out.v = null;
  return out;
}

/* ---------- per frame: flights, idle turntable, keep the target near the set ---------- */
export function updateCamera(dt) {
  stepFlight(dt);
  const ctl = app.controls, idle = app.time - app.lastInput;
  if (app.mode === 'orbit') {
    ctl.autoRotate = !tw.on && !app.reducedMotion && idle > 14 && !insideModel(app.camera.position) && !app.clean;
    ctl.update();
    const t = ctl.target, zMax = app.stage ? 13 : 4.5;
    const cx = clamp(t.x, -14, 15.5), cy = clamp(t.y, -.2, 3.2), cz = clamp(t.z, -10, zMax);
    if (cx !== t.x || cy !== t.y || cz !== t.z) { const d = V(cx - t.x, cy - t.y, cz - t.z); t.add(d); app.camera.position.add(d); }
  }
}

export function onResize() {
  if (view.name && !view.moved && !tw.on && app.mode === 'orbit') jumpTo(view.name);
}
