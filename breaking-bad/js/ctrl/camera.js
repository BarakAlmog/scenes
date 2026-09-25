import * as THREE from 'three';
import { app } from '../app.js';
import { easeInOutCubic, clamp, lerp, wrapAngle } from '../lib/util.js';
import { cutaway, insideRV } from '../rv/cutaway.js';

/* Named views, set in the RV's own frame so they follow it wherever it is parked, with flights between them
   that arc around the target. The address bar keeps the view, the hour and the stop. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const VIEWS = {
  overview: { label: 'Overview', pos: V(13, 7.5, 21), target: V(-.6, 1.3, 0) },
  wide: { label: 'Wide', pos: V(70, 9, 120), target: V(-2, 4, 0) },
  lab: { label: 'The lab', pos: V(-1.2, 7.8, 7.4), target: V(-1.4, 1.1, -.2), open: true },
  plan: { label: 'From above', pos: V(-.2, 17, .02), target: V(-.2, 0, 0) },
  cab: { label: 'The cab', pos: V(2.35, 1.95, .05), target: V(6, 1.55, -.1) },
};
const mat = new THREE.Matrix4();
/* a view in world space, for where the RV stands now */
export function resolve(name) {
  const v = VIEWS[name], b = app.rv?.body;
  if (!b) return { pos: v.pos.clone(), target: v.target.clone() };
  b.updateMatrixWorld();
  /* level with the RV's heading only: a tilted RV must not tilt the camera */
  const r = app.rv.root, yaw = r.rotation.y;
  mat.makeRotationY(yaw).setPosition(r.position);
  const out = { pos: v.pos.clone().applyMatrix4(mat), target: v.target.clone().applyMatrix4(mat) };
  if (name === 'wide') clearWide(out, r.position);
  return out;
}
/* the wide view stands far off on real ground: turn it around the RV, and raise it, until no rise and no tree is in
   the way; the least blocked place wins */
function clearWide(out, c) {
  const T = app.terrain, trees = (app.place?.blockers ?? []).flatMap(b => b.list);
  if (!T) return;
  const d0 = Math.hypot(out.pos.x - c.x, out.pos.z - c.z), a0 = Math.atan2(out.pos.z - c.z, out.pos.x - c.x), up = out.pos.y - c.y;
  const cost = p => {
    let k = 0;
    for (let i = 1; i < 30; i++) { const t = i / 30, x = p.x + (out.target.x - p.x) * t, z = p.z + (out.target.z - p.z) * t; if (T.heightAt(x, z) > p.y + (out.target.y - p.y) * t - .6) k += 3; }
    const dx = out.target.x - p.x, dz = out.target.z - p.z, L2 = dx * dx + dz * dz;
    for (const tr of trees) {
      const u = ((tr.x - p.x) * dx + (tr.z - p.z) * dz) / L2; if (u < -.03 || u > .6) continue;
      const gap = Math.hypot(p.x + dx * u - tr.x, p.z + dz * u - tr.z) - (tr.r + 2.5 + 8 * Math.max(0, u));
      if (gap < 0) k += 4 * (1 - u);
    }
    return k;
  };
  let best = null;
  for (const lift of [0, 5, 11]) for (let k = -12; k <= 12; k++) {
    const a = a0 + k * .1, p = V(c.x + Math.cos(a) * d0, 0, c.z + Math.sin(a) * d0);
    p.y = Math.max(T.heightAt(p.x, p.z) + 6, c.y + up) + lift;
    const score = cost(p) + Math.abs(k) * .15 + lift * .08;
    if (!best || score < best.score) best = { score, p };
    if (score < .01) break;
  }
  if (best) out.pos.copy(best.p);
}

/* ---------- flights ---------- */
const tw = { on: false, t: 0, dur: 1.6, p0: V(), p1: V(), t0: V(), t1: V(), s0: new THREE.Spherical(), s1: new THREE.Spherical(), arc: true };
export const view = { name: null, moved: false, flying: false };
const tmp = V(), sp = new THREE.Spherical();

export function flyTo(target, dur = 1.8) {
  const { pos, target: tg } = typeof target === 'string' ? resolve(target) : target;
  const c = app.camera, ctl = app.controls;
  tw.t0.copy(ctl.target); tw.t1.copy(tg); tw.p0.copy(c.position); tw.p1.copy(pos);
  tw.s0.setFromVector3(tmp.copy(c.position).sub(ctl.target)); tw.s1.setFromVector3(tmp.copy(pos).sub(tg));
  tw.arc = !(insideRV(tw.p0) || insideRV(tw.p1)) && tw.p0.distanceTo(tw.p1) < 600;
  tw.t = 0; tw.dur = app.reducedMotion ? .001 : dur; tw.on = true; view.flying = true;
  if (typeof target === 'string') { view.name = target; view.moved = false; cutaway.force = !!VIEWS[target].open; } else { view.moved = true; cutaway.force = false; }
  ctl.autoRotate = false;
  app.emit('view', view.name);
}
export const jumpTo = name => flyTo(name, .001);
export function cancelFlight() { tw.on = false; view.flying = false; }

function stepFlight(dt) {
  if (!tw.on) return;
  tw.t = Math.min(1, tw.t + dt / tw.dur);
  const e = easeInOutCubic(tw.t), c = app.camera, ctl = app.controls;
  ctl.target.lerpVectors(tw.t0, tw.t1, e);
  if (!tw.arc) c.position.lerpVectors(tw.p0, tw.p1, e);
  else {
    sp.radius = Math.exp(lerp(Math.log(tw.s0.radius), Math.log(tw.s1.radius), e));
    sp.phi = lerp(tw.s0.phi, tw.s1.phi, e); sp.theta = tw.s0.theta + wrapAngle(tw.s1.theta - tw.s0.theta) * e;
    c.position.setFromSpherical(sp).add(ctl.target);
  }
  if (tw.t >= 1) { tw.on = false; view.flying = false; writeHash(); }
}

/* ---------- the address bar ---------- */
let hashTimer = 0;
export function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const q = new URLSearchParams();
    if (app.stops?.id && app.stops.id !== 'pilot') q.set('stop', app.stops.id);
    if (view.name && !view.moved) q.set('v', view.name);
    if (app.tod && app.place && Math.abs(app.tod.hour - app.place.P.hour) > .05) q.set('t', app.tod.hour.toFixed(2));
    if (app.shoot) q.set('shoot', '1');
    history.replaceState(null, '', q.toString() ? '#' + q.toString() : location.pathname + location.search);
  }, 350);
}
export function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  return { v: VIEWS[q.get('v')] ? q.get('v') : null, t: q.get('t'), stop: q.get('stop'), shoot: q.get('shoot') === '1' };
}

/* ---------- per frame: flights, the idle turntable, the camera stays above the ground ---------- */
export function updateCamera(dt) {
  stepFlight(dt);
  const ctl = app.controls, idle = app.time - app.lastInput;
  if (app.mode !== 'orbit') return;
  ctl.autoRotate = !tw.on && !app.reducedMotion && idle > 16 && !insideRV(app.camera.position) && !app.clean && view.name !== 'plan';
  ctl.update();
  const T = app.terrain; if (!T) return;
  /* keep the target near the ground and inside the near ground; lift the camera over hills */
  const t = ctl.target, r = app.rv.root.position;
  const dx = t.x - r.x, dz = t.z - r.z, far = Math.hypot(dx, dz), lim = 420;
  if (far > lim) { const k = lim / far; const nx = r.x + dx * k, nz = r.z + dz * k; app.camera.position.x += nx - t.x; app.camera.position.z += nz - t.z; t.x = nx; t.z = nz; }
  const gt = T.heightAt(t.x, t.z); if (t.y < gt - .5) { app.camera.position.y += gt - .5 - t.y; t.y = gt - .5; }
  if (!insideRV(app.camera.position)) {
    const c = app.camera.position, g = T.heightAt(c.x, c.z) + .6;
    if (c.y < g) c.y = g;
  }
}

export function onResize() { if (view.name && !view.moved && !tw.on && app.mode === 'orbit') jumpTo(view.name); }
export { clamp };
