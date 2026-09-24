import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { app } from '../app.js';
import { blockers } from '../world/walls.js';
import { P, doors } from '../world/apartment.js';
import { SEATS } from '../cast/cast.js';
import { clamp, damp } from '../lib/util.js';
import { flyTo } from './camera.js';

/* First person: mouse look on a desktop, two thumbs on a phone. Walls, furniture
   and people block the way; the front door opens as you reach it. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = 1.62, R = .24;
const keys = new Set();
const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, lookTouch = { id: null, x: 0, y: 0 };
let plc, saved = null, yaw = 0, pitch = 0, bob = 0, openedDoor = false, drag = null;

/* pointer lock can be refused (embedded pages, some browsers); dragging still looks around */
function requestLock() {
  const p = app.renderer.domElement.requestPointerLock?.();
  if (p && typeof p.catch === 'function') p.catch(() => app.emit('walk:nolock'));
}
const solids = [];   /* {x, z, hx, hz, c, s} boxes and {x, z, r} circles */

const obb = (x, z, hx, hz, rot = 0) => solids.push({ x, z, hx, hz, c: Math.cos(rot), s: Math.sin(rot) });
const disc = (x, z, r) => solids.push({ x, z, r });

function buildSolids() {
  const at = (Pw, t, off) => Pw.at(t, off);
  obb(-1.95, .55, 1.18, .5); obb(-3.62, .78, .5, .6, 1.12); obb(-3.3, -.32, .3, .3, .5); obb(-1.5, 2.28, .66, .26);
  disc(-.45, -1.45, 1.02);
  obb(2.42, .42, 1.33, .57, -.563);
  const k = at(P.Kit, 2.115, .41); obb(k.x, k.z, .74, .33, P.Kit.rotY);
  const e = at(P.East, 1.41, .45); obb(e.x, e.z, 1.29, .33, P.East.rotY);
  const f = at(P.Kit, .78, .49); obb(f.x, f.z, .46, .4, P.Kit.rotY);
  obb(-1.45, -3.08, .65, .2);
  const d = at(P.Win, 3.28, .52); obb(d.x, d.z, .65, .31, P.Win.rotY);
  const dc = at(P.Win, 3.28, 1.18); disc(dc.x, dc.z, .28);
  const c = at(P.West, 1.5, .35); obb(c.x, c.z, .73, .18, P.West.rotY);
  const m = at(P.SW, 1.45, .34); obb(m.x, m.z, .65, .17, P.SW.rotY);
  const o = at(P.Door, .2, .75); obb(o.x, o.z, .28, .28, .35);
  for (const t of [1.32, 2.22]) { const r = at(P.Win, t, .3); obb(r.x, r.z, .38, .1, P.Win.rotY); }
  const tr = at(P.Kit, .18, .42); disc(tr.x, tr.z, .22);
  for (const [x, z] of [[.35, .85], [1.0, .9], [-1.55, .15]]) { const s = app.island.local(x, z); disc(s.x, s.z, .2); }
  obb(-3.52, -6.58, .78, 1.05); obb(-2.52, -7.25, .23, .2); obb(-.74, -6.8, .24, .5); obb(-1.7, -4.245, .7, .225); disc(-4.2, -4.1, .2);
  obb(1.53, -7.28, .71, .37); obb(1.95, -6.35, .28, .25); disc(-.1, -6.9, .25); obb(-1.85, -4.73, .55, .2);
  obb(3.85, -6.94, 1.3, 1.01);
  disc(app.island.local(-.3, .72).x, app.island.local(-.3, .72).z, .3);
  for (const s of [SEATS.newman, SEATS.kramer]) disc(s.pos.x, s.pos.z, .3);
}

/* push a circle at (x, z) out of everything it overlaps */
function resolve(p) {
  for (let it = 0; it < 3; it++) {
    for (const [ax, az, bx, bz] of blockers) {
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const t = clamp(((p.x - ax) * dx + (p.z - az) * dz) / L2, 0, 1);
      const cx = ax + dx * t, cz = az + dz * t, ex = p.x - cx, ez = p.z - cz, d = Math.hypot(ex, ez);
      const r = R + .1;
      if (d < r && d > 1e-6) { p.x = cx + ex / d * r; p.z = cz + ez / d * r; }
    }
    for (const s of solids) {
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
    const c = app.camera;
    saved = { pos: c.position.clone(), target: app.controls.target.clone(), fov: c.fov };
    app.mode = 'walk'; app.controls.enabled = false;
    const door = doors.front, n = door.n;
    c.position.set(door.center.x + n[0] * .9, EYE, door.center.z + n[1] * .9);
    yaw = Math.atan2(-(-1.7 - c.position.x), -(.9 - c.position.z)); pitch = -.05;
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
  c.position.y = EYE + Math.sin(bob) * .025;

  /* the door opens for you and closes behind you */
  const D = doors.front, dd = Math.hypot(c.position.x - D.center.x, c.position.z - D.center.z);
  if (dd < 1.1 && !D.isOpen) { D.open(); openedDoor = true; }
  if (openedDoor && dd > 2.2 && D.isOpen) { D.close(); openedDoor = false; }
}
