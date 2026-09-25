import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { app } from '../app.js';
import { clamp, damp } from '../lib/util.js';
import { flyTo, cancelFlight } from './camera.js';

/* First person: walking a scene (explore), or playing it (game). Mouse look on a desktop (pointer lock, or drag),
   two thumbs on a phone with FIRE and USE buttons. The ground is the scene's terrain (or its floorAt), and what is in
   the way comes from the scene: circles (trees, rocks, people), boxes (counters, cars) and a boundary. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const keys = new Set();
const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, lookTouch = { id: null, x: 0, y: 0 };
let plc, saved = null, drag = null, bob = 0, eyeY = 0, walked = 0;

export const fps = {
  on: false, frozen: false, opts: null,
  pos: V(), yaw: 0, pitch: 0, speed: 0, moving: false, running: false, eye: 1.62, radius: .26,
  firing: false, using: false, onFire: null, onUse: null,
  get locked() { return plc?.isLocked; },

  /* opts: { pos, yaw, pitch, eye, walk, run, radius, fov, mode ('walk' | 'game'), gun, bounds(p) } */
  enter(opts = {}) {
    if (this.on) this.exit(true);
    cancelFlight();
    const c = app.camera;
    saved = { pos: c.position.clone(), target: app.controls.target.clone(), fov: c.fov };
    this.opts = { walk: 1.5, run: 3.3, fov: 64, mode: 'walk', ...opts };
    this.on = true; this.frozen = false; app.mode = this.opts.mode; app.controls.enabled = false;
    this.eye = this.opts.eye ?? 1.62; this.radius = this.opts.radius ?? .26;
    const p = this.opts.pos ?? app.place?.walkStart?.pos ?? V(0, 0, 0);
    this.pos.set(p.x, 0, p.z);
    this.yaw = this.opts.yaw ?? app.place?.walkStart?.yaw ?? 0; this.pitch = this.opts.pitch ?? -.05;
    eyeY = floorAt(this.pos.x, this.pos.z) + this.eye;
    c.position.set(this.pos.x, eyeY, this.pos.z);
    c.fov = this.opts.fov; c.updateProjectionMatrix();
    applyLook();
    if (!app.touch) requestLock();
    app.shadowFocus = c.position;
    document.body.classList.toggle('fps', true);
    app.emit('fps', { on: true, mode: this.opts.mode, gun: !!this.opts.gun });
  },
  exit(quiet = false) {
    if (!this.on) return;
    this.on = false; keys.clear(); this.firing = false; this.using = false;
    if (plc.isLocked) plc.unlock();
    const c = app.camera; c.fov = saved.fov; c.updateProjectionMatrix();
    app.mode = 'orbit'; app.controls.enabled = true; app.controls.target.copy(saved.target); app.shadowFocus = null;
    if (!quiet) flyTo({ pos: saved.pos, target: saved.target, fov: saved.fov }, 1.2);
    document.body.classList.toggle('fps', false);
    app.emit('fps', { on: false });
  },
  lock() { if (this.on && !app.touch) requestLock(); },
  /* a cutscene takes the camera: input stops, the camera is left alone */
  freeze(on) { this.frozen = on; if (on) { keys.clear(); joy.x = joy.y = 0; } },
  place(x, z, yaw = this.yaw, pitch = this.pitch) {
    this.pos.set(x, 0, z); this.yaw = yaw; this.pitch = pitch;
    eyeY = floorAt(x, z) + this.eye; app.camera.position.set(x, eyeY, z); applyLook();
  },
  face(target, k = 1) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const want = Math.atan2(-dx, -dz), dy = target.y - app.camera.position.y, wp = Math.atan2(dy, Math.hypot(dx, dz));
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * k; this.pitch += (wp - this.pitch) * k; applyLook();
  },
  forward(out = V()) { return out.set(0, 0, -1).applyQuaternion(app.camera.quaternion); },
};

function floorAt(x, z) {
  const P = app.place;
  if (P?.floorAt) return P.floorAt(x, z);
  return app.terrain ? app.terrain.heightAt(x, z) : 0;
}

function requestLock() {
  if (navigator.userActivation && !navigator.userActivation.isActive) { app.emit('walk:nolock'); return; }
  const p = app.renderer.domElement.requestPointerLock?.();
  if (p && typeof p.catch === 'function') p.catch(() => app.emit('walk:nolock'));
}
const eul = new THREE.Euler(0, 0, 0, 'YXZ');
function applyLook() { eul.set(fps.pitch, fps.yaw, 0); app.camera.quaternion.setFromEuler(eul); }

/* push a circle at p out of everything solid */
function pushBox(p, x0, x1, z0, z1, R) {
  const cx = clamp(p.x, x0, x1), cz = clamp(p.z, z0, z1), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
  if (d > R) return;
  if (d > 1e-5) { p.x = cx + dx / d * R; p.z = cz + dz / d * R; return; }
  const px = Math.min(p.x - x0, x1 - p.x), pz = Math.min(p.z - z0, z1 - p.z);
  if (px < pz) p.x = p.x - x0 < x1 - p.x ? x0 - R : x1 + R; else p.z = p.z - z0 < z1 - p.z ? z0 - R : z1 + R;
}
export function resolveSolids(p, R, P = app.place) {
  if (!P) return;
  const circles = P.solidsNear ? P.solidsNear(p.x, p.z, R + 3) : (P.solids ?? []);
  for (let it = 0; it < 2; it++) {
    for (const s of circles) {
      const ex = p.x - s.x, ez = p.z - s.z, d = Math.hypot(ex, ez), r = s.r + R;
      if (d < r && d > 1e-6) { p.x = s.x + ex / d * r; p.z = s.z + ez / d * r; }
    }
    for (const b of P.boxes ?? []) if (!b.off) pushBox(p, b[0], b[1], b[2], b[3], R);
    for (const poly of P.polys ?? []) if (!poly.off) pushPoly(p, poly, R);
    for (const s of P.dynamicSolids?.() ?? []) {
      const ex = p.x - s.x, ez = p.z - s.z, d = Math.hypot(ex, ez), r = s.r + R;
      if (d < r && d > 1e-6) { p.x = s.x + ex / d * r; p.z = s.z + ez / d * r; }
    }
  }
  P.bound?.(p);
}

export function buildFPS() {
  plc = new PointerLockControls(app.camera, app.renderer.domElement);
  plc.pointerSpeed = .8;
  plc.addEventListener('change', () => { if (!fps.on || fps.frozen) return; eul.setFromQuaternion(app.camera.quaternion, 'YXZ'); fps.yaw = eul.y; fps.pitch = clamp(eul.x, -1.3, 1.3); });
  plc.addEventListener('unlock', () => { app.walkLocked = false; app.emit('walk:unlock'); });
  plc.addEventListener('lock', () => { app.walkLocked = true; app.emit('walk:lock'); });
  addEventListener('keydown', e => { if (fps.on) keys.add(e.code); if (fps.on && !fps.frozen && e.code === 'KeyE') { if (!e.repeat) fps.onUse?.(); fps.using = true; } });
  addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyE') fps.using = false; });
  addEventListener('blur', () => { keys.clear(); fps.firing = false; });
  const el = app.renderer.domElement;
  el.addEventListener('mousedown', e => {
    if (!fps.on || fps.frozen || e.button !== 0) return;
    if (plc.isLocked || app.touch) { if (fps.opts?.gun) { fps.firing = true; fps.onFire?.(); } }
  });
  addEventListener('mouseup', () => { fps.firing = false; });
  el.addEventListener('pointerdown', e => { if (fps.on && e.pointerType === 'mouse' && !plc.isLocked) drag = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  addEventListener('pointermove', e => {
    if (!drag || !fps.on || fps.frozen) return;
    fps.yaw -= (e.clientX - drag.x) * .004; fps.pitch = clamp(fps.pitch - (e.clientY - drag.y) * .004, -1.3, 1.3);
    drag.x = e.clientX; drag.y = e.clientY; applyLook(); app.lastInput = app.time;
  });
  addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('touchstart', e => {
    if (!fps.on) return;
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2 && joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; app.emit('joy', { x: t.clientX, y: t.clientY, on: true }); }
      else if (lookTouch.id === null) { lookTouch.id = t.identifier; lookTouch.x = t.clientX; lookTouch.y = t.clientY; }
    }
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!fps.on || fps.frozen) return;
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.x = clamp((t.clientX - joy.ox) / 60, -1, 1); joy.y = clamp((t.clientY - joy.oy) / 60, -1, 1); app.emit('joy', { dx: joy.x, dy: joy.y, on: true }); }
      if (t.identifier === lookTouch.id) { fps.yaw -= (t.clientX - lookTouch.x) * .005; fps.pitch = clamp(fps.pitch - (t.clientY - lookTouch.y) * .005, -1.3, 1.3); lookTouch.x = t.clientX; lookTouch.y = t.clientY; applyLook(); }
    }
  }, { passive: true });
  const endTouch = e => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; app.emit('joy', { on: false }); } if (t.identifier === lookTouch.id) lookTouch.id = null; } };
  el.addEventListener('touchend', endTouch); el.addEventListener('touchcancel', endTouch);
  const fire = document.getElementById('fire'), use = document.getElementById('use');
  fire.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (fps.on && !fps.frozen) { fps.firing = true; fps.onFire?.(); } });
  fire.addEventListener('pointerup', () => { fps.firing = false; });
  use.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (fps.on && !fps.frozen) { fps.onUse?.(); fps.using = true; } });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) use.addEventListener(ev, () => { fps.using = false; });
  app.onUpdate(update, 5);
}

/* push a circle at p out of a polygon (a house's walls, the pool): to the nearest edge, then R beyond it */
function pushPoly(p, pts, R) {
  if (pts.bb && (p.x < pts.bb[0] - R || p.x > pts.bb[1] + R || p.z < pts.bb[2] - R || p.z > pts.bb[3] + R)) return;
  let best = 1e9, bx = 0, bz = 0, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, az] = pts[j], [cx, cz] = pts[i];
    if ((az > p.z) !== (cz > p.z) && p.x < (cx - ax) * (p.z - az) / (cz - az) + ax) inside = !inside;
    const dx = cx - ax, dz = cz - az, l2 = dx * dx + dz * dz || 1, t = clamp(((p.x - ax) * dx + (p.z - az) * dz) / l2, 0, 1);
    const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(p.x - qx, p.z - qz);
    if (d < best) { best = d; bx = qx; bz = qz; }
  }
  if (!inside && best >= R) return;
  let nx = p.x - bx, nz = p.z - bz; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
  if (inside) { nx = -nx; nz = -nz; }
  p.x = bx + nx * R; p.z = bz + nz * R;
}

const fwd = V(), right = V(), up = V(0, 1, 0), p = { x: 0, z: 0 };
function update(dt) {
  if (!fps.on || fps.frozen) return;
  const c = app.camera, o = fps.opts;
  let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
  let mz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y;
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  fps.running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > .92;
  const surface = app.place?.surfaceAt?.(fps.pos.x, fps.pos.z) ?? 1;   /* deep snow slows you down */
  const want = (fps.running ? o.run : o.walk) * surface * (o.speedK?.() ?? 1);
  fps.speed = damp(fps.speed, (mx || mz) ? want : 0, 8, dt);
  fps.moving = fps.speed > .2;
  if (mx || mz) app.lastInput = app.time;
  fwd.set(-Math.sin(fps.yaw), 0, -Math.cos(fps.yaw)); right.crossVectors(fwd, up);
  p.x = fps.pos.x + (fwd.x * mz + right.x * mx) * fps.speed * dt;
  p.z = fps.pos.z + (fwd.z * mz + right.z * mx) * fps.speed * dt;
  resolveSolids(p, fps.radius);
  const moved = Math.hypot(p.x - fps.pos.x, p.z - fps.pos.z);
  fps.pos.x = p.x; fps.pos.z = p.z;
  const floor = floorAt(p.x, p.z);
  bob = moved > 1e-4 && !app.reducedMotion ? bob + moved * 5.2 : damp(bob, Math.round(bob / Math.PI) * Math.PI, 8, dt);
  eyeY = damp(eyeY, floor + fps.eye, 12, dt);
  c.position.set(p.x, eyeY + Math.sin(bob) * .03 * (fps.running ? 1.4 : 1), p.z);
  walked += moved;
  if (walked > (fps.running ? .95 : .72)) { walked = 0; app.emit('step', { pos: fps.pos, who: 'you', run: fps.running }); }
  if (!fps.frozen) applyLook();
}
export { keys };
