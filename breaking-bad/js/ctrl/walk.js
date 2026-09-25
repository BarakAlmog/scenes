import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { app } from '../app.js';
import { clamp, damp } from '../lib/util.js';
import { RV, rv, setDoor } from '../rv/rv.js';
import { cast } from '../cast/cast.js';
import { flyTo, cancelFlight } from './camera.js';

/* First person, on the ground and in the RV: mouse look on a desktop, two thumbs on a phone. The door opens as you
   reach it; up the steps you are in the lab. The RV's walls, counters and seats, the trees, the props and the people
   are in the way. Inside, the RV's own frame is used, so a parked RV on a slope still has a level floor to walk. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = 1.62, R = .24;
const keys = new Set();
const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, lookTouch = { id: null, x: 0, y: 0 };
let plc, saved = null, yaw = 0, pitch = 0, bob = 0, eyeY = EYE, drag = null, openedDoor = false;

/* inside the RV, in its frame: boxes [x0, x1, z0, z1] you cannot walk into */
const INSIDE = [
  [-3.98, 2.55, -1.2, -.56],          /* driver's side counters, stove */
  [-2.84, 1.2, .56, 1.2],             /* passenger side counter, fridge */
  [-4.7, -2.86, .16, 1.2],            /* the bed */
  [-4.7, -4.02, -1.2, -.57],          /* the chest */
  [-3.75, -2.55, -.56, 0],            /* the barrels */
  [3.25, 3.85, -.9, -.33], [3.25, 3.85, .33, .9],   /* the seats */
  [3.55, 4.4, -.3, .3],               /* the engine cover */
  [4.1, 4.9, -1.2, 1.2],              /* the dash */
];
const inRV = l => l.x > RV.x0 - .05 && l.x < RV.x1 && Math.abs(l.z) < RV.halfW;
const doorSpan = l => l.x > RV.door.x0 + .06 && l.x < RV.door.x1 - .06;
const toLocal = new THREE.Matrix4(), toWorld = new THREE.Matrix4(), lp = V(), wp = V();

function requestLock() {
  /* the lock needs a click or a key press; without one, drag to look */
  if (navigator.userActivation && !navigator.userActivation.isActive) { app.emit('walk:nolock'); return; }
  const p = app.renderer.domElement.requestPointerLock?.();
  if (p && typeof p.catch === 'function') p.catch(() => app.emit('walk:nolock'));
}

/* push a circle at (x, z) in the RV's frame out of the boxes, the walls and the door frame */
function resolveRV(l, wasIn) {
  const W = RV.halfW - .06;
  if (wasIn) {
    /* the walls, except the door when it is open */
    const out = rv.door.open > .6 && doorSpan(l);
    if (l.z > W - R && !out) l.z = W - R;
    if (l.z < -W + R) l.z = -W + R;
    if (l.x < RV.x0 + .08 + R) l.x = RV.x0 + .08 + R;
    if (l.x > 4.5 - R) l.x = 4.5 - R;
    for (const [x0, x1, z0, z1] of INSIDE) pushBox(l, x0, x1, z0, z1);
    /* the people inside */
    for (const c of Object.values(cast)) if (c.visible && c.frame === 'rv' && c.rig?.root.visible) {
      const p = c.rig.root.position, dx = l.x - p.x, dz = l.z - p.z, d = Math.hypot(dx, dz), r = R + .22;
      if (d < r && d > 1e-5) { l.x = p.x + dx / d * r; l.z = p.z + dz / d * r; }
    }
  } else {
    /* outside: the whole body, except through the open door */
    if (l.x > RV.x0 - R - .1 && l.x < RV.x1 + R && Math.abs(l.z) < RV.halfW + R + .05) {
      if (rv.door.open > .6 && doorSpan(l) && l.z > 0) return;
      pushBox(l, RV.x0 - .1, RV.x1, -RV.halfW - .05, RV.halfW + .05);
    }
  }
}
function pushBox(l, x0, x1, z0, z1) {
  const cx = clamp(l.x, x0, x1), cz = clamp(l.z, z0, z1), dx = l.x - cx, dz = l.z - cz, d = Math.hypot(dx, dz);
  if (d > R) return;
  if (d > 1e-5) { l.x = cx + dx / d * R; l.z = cz + dz / d * R; return; }
  const px = Math.min(l.x - x0, x1 - l.x), pz = Math.min(l.z - z0, z1 - l.z);
  if (px < pz) l.x = l.x - x0 < x1 - l.x ? x0 - R : x1 + R; else l.z = l.z - z0 < z1 - l.z ? z0 - R : z1 + R;
}
function resolveWorld(p) {
  const circles = [...(app.place?.obstacles ?? [])];
  for (const c of Object.values(cast)) if (c.visible && c.rig && c.frame === 'world' && c.rig.root.visible) circles.push({ x: c.rig.root.position.x, z: c.rig.root.position.z, r: .26 });
  for (const o of app.place?.solids ?? []) circles.push(o);
  if (app.shoot) for (const o of app.shootSolids ?? []) circles.push(o);
  for (const s of circles) {
    const ex = p.x - s.x, ez = p.z - s.z, d = Math.hypot(ex, ez), r = s.r + R;
    if (d < r && d > 1e-6) { p.x = s.x + ex / d * r; p.z = s.z + ez / d * r; }
  }
}

export const walk = {
  get active() { return app.mode === 'walk'; },
  enter() {
    if (app.mode === 'walk' || !rv.root) return;
    cancelFlight();
    const c = app.camera;
    saved = { pos: c.position.clone(), target: app.controls.target.clone(), fov: c.fov };
    app.mode = 'walk'; app.controls.enabled = false;
    rv.root.updateMatrixWorld();
    const start = V(2.6, 0, 5.2).applyMatrix4(rv.root.matrixWorld), look = V(1.6, 1.2, 1.2).applyMatrix4(rv.root.matrixWorld);
    c.position.set(start.x, app.terrain.heightAt(start.x, start.z) + EYE, start.z); eyeY = c.position.y;
    yaw = Math.atan2(-(look.x - start.x), -(look.z - start.z)); pitch = -.08;
    c.fov = 64; c.updateProjectionMatrix();
    applyLook();
    if (!app.touch) requestLock();
    app.shadowFocus = c.position;
    app.emit('walk', true);
  },
  exit() {
    if (app.mode !== 'walk') return;
    app.mode = 'orbit'; keys.clear();
    if (plc.isLocked) plc.unlock();
    const c = app.camera; c.fov = saved.fov; c.updateProjectionMatrix();
    app.controls.enabled = true; app.controls.target.copy(saved.target); app.shadowFocus = null;
    flyTo({ pos: saved.pos, target: saved.target }, 1.2);
    if (openedDoor) { setDoor(false); openedDoor = false; }
    app.emit('walk', false);
  },
  lock() { if (app.mode === 'walk' && !app.touch) requestLock(); },
  get locked() { return plc?.isLocked; },
};

function applyLook() { app.camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); }

export function buildWalk() {
  plc = new PointerLockControls(app.camera, app.renderer.domElement);
  plc.pointerSpeed = .8;
  plc.addEventListener('change', () => { const e = new THREE.Euler().setFromQuaternion(app.camera.quaternion, 'YXZ'); yaw = e.y; pitch = e.x; });
  plc.addEventListener('unlock', () => app.emit('walk:unlock'));
  plc.addEventListener('lock', () => app.emit('walk:lock'));
  addEventListener('keydown', e => { if (app.mode === 'walk') keys.add(e.code); });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const el = app.renderer.domElement;
  el.addEventListener('pointerdown', e => { if (app.mode === 'walk' && e.pointerType === 'mouse' && !plc.isLocked) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointermove', e => {
    if (!drag || app.mode !== 'walk') return;
    yaw -= (e.clientX - drag.x) * .004; pitch = clamp(pitch - (e.clientY - drag.y) * .004, -1.2, 1.2);
    drag.x = e.clientX; drag.y = e.clientY; applyLook(); app.lastInput = app.time;
  });
  addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('touchstart', e => {
    if (app.mode !== 'walk') return;
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2 && joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; app.emit('joy', { x: t.clientX, y: t.clientY, on: true }); }
      else if (lookTouch.id === null) { lookTouch.id = t.identifier; lookTouch.x = t.clientX; lookTouch.y = t.clientY; }
    }
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (app.mode !== 'walk') return;
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.x = clamp((t.clientX - joy.ox) / 60, -1, 1); joy.y = clamp((t.clientY - joy.oy) / 60, -1, 1); app.emit('joy', { dx: joy.x, dy: joy.y, on: true }); }
      if (t.identifier === lookTouch.id) { yaw -= (t.clientX - lookTouch.x) * .005; pitch = clamp(pitch - (t.clientY - lookTouch.y) * .005, -1.2, 1.2); lookTouch.x = t.clientX; lookTouch.y = t.clientY; applyLook(); }
    }
  }, { passive: true });
  const endTouch = e => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; app.emit('joy', { on: false }); } if (t.identifier === lookTouch.id) lookTouch.id = null; } };
  el.addEventListener('touchend', endTouch); el.addEventListener('touchcancel', endTouch);
  app.onUpdate(update, 5);
}

const fwd = V(), right = V(), up = V(0, 1, 0);
function update(dt) {
  if (app.mode !== 'walk') return;
  const c = app.camera;
  let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
  let mz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y;
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.4 : 1.6;
  if (mx || mz) app.lastInput = app.time;
  fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.crossVectors(fwd, up);
  /* where we were, in the RV's frame */
  rv.root.updateMatrixWorld(); toWorld.copy(rv.root.matrixWorld); toLocal.copy(toWorld).invert();
  lp.set(c.position.x, 0, c.position.z).applyMatrix4(toLocal);
  const wasIn = inRV(lp);
  const p = { x: c.position.x + (fwd.x * mz + right.x * mx) * speed * dt, z: c.position.z + (fwd.z * mz + right.z * mx) * speed * dt };
  if (!wasIn) resolveWorld(p);
  lp.set(p.x, 0, p.z).applyMatrix4(toLocal);
  resolveRV(lp, wasIn);
  wp.copy(lp).applyMatrix4(toWorld); p.x = wp.x; p.z = wp.z;
  c.position.x = p.x; c.position.z = p.z;
  /* the floor: the ground outside; the step well, then the RV's floor inside */
  lp.set(p.x, 0, p.z).applyMatrix4(toLocal);
  let floor;
  if (inRV(lp)) {
    const step = lp.z > RV.halfW - .45 && doorSpan(lp) ? (lp.z > RV.halfW - .22 ? RV.door.y0 + .18 : .68) : RV.floor;
    const cab = lp.x > 3.28 ? .72 : step;
    wp.set(lp.x, cab, lp.z).applyMatrix4(toWorld); floor = wp.y;
  } else floor = app.terrain.heightAt(p.x, p.z);
  bob = (mx || mz) && !app.reducedMotion ? bob + dt * speed * 5.5 : damp(bob, Math.round(bob / Math.PI) * Math.PI, 8, dt);
  eyeY = damp(eyeY, floor + EYE, 12, dt);
  c.position.y = eyeY + Math.sin(bob) * .025;
  /* the door opens as you reach it, from either side */
  const dl = V((RV.door.x0 + RV.door.x1) / 2, 0, RV.halfW), near = Math.hypot(lp.x - dl.x, lp.z - dl.z) < 1.6;
  if (near && rv.door.target < .5) { setDoor(true); openedDoor = true; }
  if (openedDoor && !near && Math.hypot(lp.x - dl.x, lp.z - dl.z) > 3.4) { setDoor(false); openedDoor = false; }
}
