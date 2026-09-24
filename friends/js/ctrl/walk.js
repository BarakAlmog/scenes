import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { app } from '../app.js';
import { blockers } from '../world/walls.js';
import { doors, heightAt } from '../world/plan.js';
import { cast } from '../cast/cast.js';
import { clamp, damp } from '../lib/util.js';
import { flyTo, cancelFlight } from './camera.js';

/* First person: mouse look on a desktop, two thumbs on a phone. Walls, furniture and people block
   the way; the front doors open as you reach them, and the stairs take you up to the landing. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = 1.62, R = .24;
const keys = new Set();
const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, lookTouch = { id: null, x: 0, y: 0 };
let plc, saved = null, yaw = 0, pitch = 0, bob = 0, eyeY = EYE, drag = null;
const opened = new Set();

function requestLock() {
  const p = app.renderer.domElement.requestPointerLock?.();
  if (p && typeof p.catch === 'function') p.catch(() => app.emit('walk:nolock'));
}
const solids = [];   /* {x, z, hx, hz, c, s} boxes and {x, z, r} circles */
const obb = (x, z, hx, hz, rot = 0) => solids.push({ x, z, hx, hz, c: Math.cos(rot), s: Math.sin(rot) });
const disc = (x, z, r) => solids.push({ x, z, r });

function buildSolids() {
  /* Monica's kitchen and living room */
  obb(3.12, -2.19, 1.25, .33); obb(4.68, -2.17, .34, .33); obb(2.25, -1.35, .36, .55);
  disc(3.15, .35, .98); obb(5.95, .1, .5, 1.1); obb(7.1, .1, .37, .64); disc(7.7, -1.72, .5); disc(8.75, 1.8, .46);
  disc(7.95, 1.05, .3); disc(8.3, -.55, .28); obb(7.05, 2.62, .96, .22); obb(9.25, -.15, .26, .66); disc(9.2, -1.25, .2);
  disc(5.4, -1.25, .17); obb(7.6, -3.32, .62, .3); disc(7.45, -2.9, .22); disc(5.95, 1.52, .3); disc(5.1, -2.48, .1); disc(5.1, 3.0, .1);
  /* Monica's bathroom and bedrooms */
  obb(1.6, -3.55, .4, .82); disc(3.65, -4.18, .28); disc(4.3, -4.28, .22);
  obb(11.35, -3.97, .85, 1.06); disc(10.25, -4.8, .25); disc(12.45, -4.8, .25); obb(12.68, -1.55, .26, .56); obb(11.35, -2.6, .6, .23); disc(10.25, -1.6, .42);
  obb(11.65, .25, .85, 1.06); disc(10.6, -.55, .25); disc(12.7, -.55, .25); obb(9.96, 1.0, .26, .5); obb(12.63, 2.55, .31, .56);
  /* Joey and Chandler's */
  obb(-3.14, -1.51, 1.18, .33); obb(-1.58, -1.49, .38, .34); obb(-4.12, -1.0, .42, .78); disc(-4.68, -1.0, .2); disc(-4.68, -.55, .2);
  obb(-2.55, 2.0, .7, .4); obb(-5.4, -.52, .6, .46); obb(-5.55, .98, .8, .46); disc(-5.25, .23, .24);
  obb(-7.8, .22, .31, 1.16); disc(-7.62, -1.72, .3); obb(-6.6, -2.28, 1.0, .47); disc(-4.85, -2.35, .17); disc(-7.95, 2.7, .2);
  obb(-3.2, -4.08, .8, .38); disc(-1.5, -3.2, .28); disc(-2.8, -2.2, .22);
  obb(-9.95, -2.17, .85, 1.06); disc(-8.9, -3.0, .25); disc(-11.0, -3.0, .25); obb(-9.3, -.25, .62, .3); disc(-9.3, -.9, .22);
  obb(-10.0, 1.35, .9, 1.06); disc(-11.15, .5, .25); obb(-9.4, 2.78, .52, .27);
  /* the hall: the radiator, Ross's sofa. You climb the first flight to the landing window; the
     upper flight rises past the tops of the walls, so it stays closed. */
  obb(-.84, -4.05, .09, .43); obb(.47, -3.1, .46, 1.02);
  blockers.push([0, -4.64, 0, -6.45], [.06, -4.64, 1.62, -4.64], [0, -6.45, 1.62, -6.45]);
}

/* push a circle at (x, z) out of everything it overlaps */
function resolve(p) {
  const people = Object.values(cast).map(c => c.rig.root.position);
  for (let it = 0; it < 3; it++) {
    for (const [ax, az, bx, bz] of blockers) {
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const t = clamp(((p.x - ax) * dx + (p.z - az) * dz) / L2, 0, 1);
      const cx = ax + dx * t, cz = az + dz * t, ex = p.x - cx, ez = p.z - cz, d = Math.hypot(ex, ez);
      const r = R + .1;
      if (d < r && d > 1e-6) { p.x = cx + ex / d * r; p.z = cz + ez / d * r; }
    }
    for (const s of [...solids, ...people.map(q => ({ x: q.x, z: q.z, r: .25 }))]) {
      if (s.r) {
        const ex = p.x - s.x, ez = p.z - s.z, d = Math.hypot(ex, ez), r = s.r + R;
        if (d < r && d > 1e-6) { p.x = s.x + ex / d * r; p.z = s.z + ez / d * r; }
      } else {
        const lx = (p.x - s.x) * s.c - (p.z - s.z) * s.s, lz = (p.x - s.x) * s.s + (p.z - s.z) * s.c;
        const qx = clamp(lx, -s.hx, s.hx), qz = clamp(lz, -s.hz, s.hz), ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
        if (d < R) {
          let nx, nz, push;
          if (d > 1e-6) { nx = ex / d; nz = ez / d; push = R - d; }
          else { const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + R; } else { nx = 0; nz = Math.sign(lz) || 1; push = pz + R; } }
          const wx = nx * s.c + nz * s.s, wz = -nx * s.s + nz * s.c;
          p.x += wx * push; p.z += wz * push;
        }
      }
    }
  }
}

export const walk = {
  get active() { return app.mode === 'walk'; },
  enter() {
    if (app.mode === 'walk') return;
    if (!solids.length) buildSolids();
    cancelFlight();
    const c = app.camera;
    saved = { pos: c.position.clone(), target: app.controls.target.clone(), fov: c.fov };
    app.mode = 'walk'; app.controls.enabled = false;
    c.position.set(2.0, EYE, 1.75); eyeY = EYE;
    yaw = Math.atan2(-(7.6 - c.position.x), -(-.9 - c.position.z)); pitch = -.06;
    c.fov = 62; c.updateProjectionMatrix();
    applyLook();
    if (!app.touch) requestLock();
    app.emit('walk', true);
  },
  exit() {
    if (app.mode !== 'walk') return;
    app.mode = 'orbit'; keys.clear();
    if (plc.isLocked) plc.unlock();
    const c = app.camera; c.fov = saved.fov; c.updateProjectionMatrix();
    app.controls.enabled = true;
    app.controls.target.copy(saved.target);
    flyTo({ pos: saved.pos, target: saved.target }, 1.2);
    for (const d of opened) d.close(); opened.clear();
    app.emit('walk', false);
  },
  lock() { if (app.mode === 'walk' && !app.touch) requestLock(); },
  get locked() { return plc?.isLocked; },
};

function applyLook() {
  const e = new THREE.Euler(pitch, yaw, 0, 'YXZ');
  app.camera.quaternion.setFromEuler(e);
}

export function buildWalk() {
  plc = new PointerLockControls(app.camera, app.renderer.domElement);
  plc.pointerSpeed = .8;
  plc.addEventListener('change', () => { const e = new THREE.Euler().setFromQuaternion(app.camera.quaternion, 'YXZ'); yaw = e.y; pitch = e.x; });
  plc.addEventListener('unlock', () => app.emit('walk:unlock'));
  plc.addEventListener('lock', () => app.emit('walk:lock'));
  addEventListener('keydown', e => { if (app.mode === 'walk') keys.add(e.code); });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  /* mouse without pointer lock: drag to look */
  const el = app.renderer.domElement;
  el.addEventListener('pointerdown', e => { if (app.mode === 'walk' && e.pointerType === 'mouse' && !plc.isLocked) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointermove', e => {
    if (!drag || app.mode !== 'walk') return;
    yaw -= (e.clientX - drag.x) * .004; pitch = clamp(pitch - (e.clientY - drag.y) * .004, -1.2, 1.2);
    drag.x = e.clientX; drag.y = e.clientY; applyLook(); app.lastInput = app.time;
  });
  addEventListener('pointerup', () => { drag = null; });

  /* touch: left half moves, right half looks */
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
      if (t.identifier === lookTouch.id) {
        yaw -= (t.clientX - lookTouch.x) * .005; pitch = clamp(pitch - (t.clientY - lookTouch.y) * .005, -1.2, 1.2);
        lookTouch.x = t.clientX; lookTouch.y = t.clientY; applyLook();
      }
    }
  }, { passive: true });
  const endTouch = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; app.emit('joy', { on: false }); }
      if (t.identifier === lookTouch.id) lookTouch.id = null;
    }
  };
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
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.2 : 1.6;
  if (mx || mz) app.lastInput = app.time;
  fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.crossVectors(fwd, up);
  const p = { x: c.position.x + (fwd.x * mz + right.x * mx) * speed * dt, z: c.position.z + (fwd.z * mz + right.z * mx) * speed * dt };
  resolve(p);
  c.position.x = p.x; c.position.z = p.z;
  bob = (mx || mz) && !app.reducedMotion ? bob + dt * speed * 5.5 : damp(bob, Math.round(bob / Math.PI) * Math.PI, 8, dt);
  eyeY = damp(eyeY, EYE + heightAt(p.x, p.z, true), 12, dt);
  c.position.y = eyeY + Math.sin(bob) * .025;

  /* the front doors open for you and close behind you */
  for (const D of [doors.m20, doors.g19]) {
    const dd = Math.hypot(c.position.x - D.center.x, c.position.z - D.center.z);
    if (dd < 1.15 && !D.isOpen) { D.open(); opened.add(D); }
    if (opened.has(D) && dd > 2.3 && D.isOpen) { D.close(); opened.delete(D); }
  }
}
