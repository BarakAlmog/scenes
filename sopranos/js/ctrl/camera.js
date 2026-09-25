import * as THREE from 'three';
import { app } from '../app.js';
import { easeInOutCubic, clamp, lerp, wrapAngle } from '../lib/util.js';

/* Named views per scene (app.place.views: { name: { label, pos, target } }), with flights between them that arc
   around the target. The address bar keeps the scene, the view and the hour. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function resolve(name) {
  const v = app.place?.views?.[name];
  if (!v) return null;
  const r = typeof v.get === 'function' ? v.get() : v;
  return { pos: r.pos.clone(), target: r.target.clone(), fov: r.fov };
}

/* ---------- flights ---------- */
const tw = { on: false, t: 0, dur: 1.6, p0: V(), p1: V(), t0: V(), t1: V(), s0: new THREE.Spherical(), s1: new THREE.Spherical(), arc: true, f0: 40, f1: 40 };
export const view = { name: null, moved: false, flying: false };
const tmp = V(), sp = new THREE.Spherical();

export function flyTo(target, dur = 1.8) {
  const r = typeof target === 'string' ? resolve(target) : target;
  if (!r) return;
  const c = app.camera, ctl = app.controls;
  tw.t0.copy(ctl.target); tw.t1.copy(r.target); tw.p0.copy(c.position); tw.p1.copy(r.pos);
  tw.s0.setFromVector3(tmp.copy(c.position).sub(ctl.target)); tw.s1.setFromVector3(tmp.copy(r.pos).sub(r.target));
  tw.f0 = c.fov; tw.f1 = r.fov ?? app.place?.fov ?? 40;
  const d = tw.p0.distanceTo(tw.p1);
  tw.arc = d < 600 && !r.straight;
  /* a view in another place altogether (the dream's hotel, kilometres away) is a cut, not a flight */
  tw.t = 0; tw.dur = app.reducedMotion || d > 3000 ? .001 : dur; tw.on = true; view.flying = true;
  if (typeof target === 'string') { view.name = target; view.moved = false; } else view.moved = true;
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
    sp.radius = Math.exp(lerp(Math.log(Math.max(.01, tw.s0.radius)), Math.log(Math.max(.01, tw.s1.radius)), e));
    sp.phi = lerp(tw.s0.phi, tw.s1.phi, e); sp.theta = tw.s0.theta + wrapAngle(tw.s1.theta - tw.s0.theta) * e;
    c.position.setFromSpherical(sp).add(ctl.target);
  }
  if (Math.abs(tw.f1 - tw.f0) > .01) { c.fov = lerp(tw.f0, tw.f1, e); c.updateProjectionMatrix(); }
  if (tw.t >= 1) { tw.on = false; view.flying = false; writeHash(); }
}

/* ---------- the address bar ---------- */
let hashTimer = 0;
export function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const q = new URLSearchParams();
    if (app.sceneId) q.set('s', app.sceneId);
    if (view.name && !view.moved && view.name !== app.place?.startView) q.set('v', view.name);
    if (app.tod && app.place && Math.abs(app.tod.hour - app.place.P.hour) > .05) q.set('t', app.tod.hour.toFixed(2));
    history.replaceState(null, '', '#' + q.toString());
  }, 350);
}
export function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  return { s: q.get('s'), v: q.get('v'), t: q.get('t') };
}

/* ---------- per frame: flights, the idle turntable, the camera stays in the scene and above the ground ---------- */
export function updateCamera(dt) {
  stepFlight(dt);
  const ctl = app.controls, idle = app.time - app.lastInput, P = app.place;
  if (app.mode !== 'orbit' || !P) return;
  ctl.autoRotate = !tw.on && !app.reducedMotion && idle > 18 && !app.clean && P.turntable !== false;
  ctl.update();
  /* keep the target inside the scene, and the camera out of the ground and inside the room if there is one. A scene
     can have several areas (the dream: the Inn, and the hotel room far away): the nearest one holds the target */
  const t = ctl.target, areas = Array.isArray(P.orbit) ? P.orbit : [P.orbit ?? { x: 0, z: 0, r: 400 }];
  let o = areas[0]; for (const a of areas) if (Math.hypot(t.x - a.x, t.z - a.z) - a.r < Math.hypot(t.x - o.x, t.z - o.z) - o.r) o = a;
  const dx = t.x - o.x, dz = t.z - o.z, far = Math.hypot(dx, dz);
  if (far > o.r) { const k = o.r / far, nx = o.x + dx * k, nz = o.z + dz * k; app.camera.position.x += nx - t.x; app.camera.position.z += nz - t.z; t.x = nx; t.z = nz; }
  const T = app.terrain;
  if (T) {
    const gt = T.heightAt(t.x, t.z); if (t.y < gt - .5) { app.camera.position.y += gt - .5 - t.y; t.y = gt - .5; }
    const c = app.camera.position, g = T.heightAt(c.x, c.z) + (P.minEye ?? .6);
    if (c.y < g) c.y = g;
  }
  if (o.box ?? P.box) {
    const c = app.camera.position, b = o.box ?? P.box;
    c.x = clamp(c.x, b[0], b[1]); c.y = clamp(c.y, b[2], b[3]); c.z = clamp(c.z, b[4], b[5]);
  }
}

export function onResize() { if (view.name && !view.moved && !tw.on && app.mode === 'orbit') jumpTo(view.name); }
export { clamp };
