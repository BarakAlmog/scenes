import * as THREE from 'three';
import { app } from '../app.js';
import { post } from '../fx/post.js';
import { studio } from '../world/stage.js';
import { flyTo, writeHash, cancelFlight } from './camera.js';
import { damp } from '../lib/util.js';

/* Broadcast mode: a 4:3 frame, a 90s video look, and a director cutting
   between the four studio cameras the way a multi-camera sitcom does. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SHOTS = {
  wide: { pos: V(.7, 2.05, 10.8), target: V(.7, 1.2, -1.5), cam: 1 },
  mKitchen: { pos: V(4.8, 1.65, 4.9), target: V(2.9, 1.15, -1.3), cam: 2 },
  mLiving: { pos: V(9.2, 1.62, 4.6), target: V(6.6, 1.0, -.5), cam: 3 },
  gLiving: { pos: V(-7.35, 1.62, 4.9), target: V(-5.3, 1.0, .1), cam: 0 },
  gKitchen: { pos: V(-2.0, 1.7, 5.2), target: V(-2.9, 1.15, -.7), cam: 1 },
  hall: { pos: V(.15, 1.72, 4.9), target: V(-.3, 1.45, -4.9), cam: 2 },
  stairs: { pos: V(.55, 1.95, -.9), target: V(-.8, 1.35, -5.7), cam: 2 },
};
const ROTATION = ['wide', 'mLiving', 'mKitchen', 'gLiving', 'wide', 'gKitchen', 'mLiving', 'hall'];
const s = { on: false, k: 0, shot: 'wide', start: 0, until: 0, i: 0, saved: null };

export const sitcom = {
  get on() { return s.on; },
  enter() {
    if (s.on || app.mode === 'walk') return;
    cancelFlight();
    s.on = true; app.mode = 'sitcom'; app.controls.enabled = false;
    s.saved = { pos: app.camera.position.clone(), target: app.controls.target.clone(), fov: app.camera.fov };
    cut('wide', 6);
    app.emit('sitcom', true); writeHash();
  },
  exit() {
    if (!s.on) return;
    s.on = false; app.mode = 'orbit'; app.controls.enabled = true; studio.tally = -1;
    const c = app.camera; c.fov = s.saved.fov; c.updateProjectionMatrix();
    app.controls.target.copy(s.saved.target);
    flyTo({ pos: s.saved.pos, target: s.saved.target }, .001);
    app.emit('sitcom', false); writeHash();
  },
  toggle() { s.on ? sitcom.exit() : sitcom.enter(); },
  get shot() { return s.shot; },
  cut(name, hold = 30) { if (s.on && SHOTS[name]) cut(name, hold); },
};

function cut(name, hold) {
  s.shot = name; s.start = app.time; s.until = app.time + (hold ?? 4.5 + Math.random() * 3);
  studio.tally = SHOTS[name].cam;
  app.emit('cut', name);
}

export function buildSitcom() {
  app.on('pivot:start', () => { if (s.on) cut('hall', 6); });
  app.on('pivot:stuck', () => { if (s.on) cut('stairs', 7.5); });
  app.on('pivot:fall', () => { if (s.on) cut('wide', 4.5); });
  app.onUpdate(update, 12);
}

const look = V();
function update(dt) {
  s.k = damp(s.k, s.on ? 1 : 0, 6, dt);
  post.grade.uniforms.uSitcom.value = s.k < .002 ? 0 : s.k;
  if (!s.on) return;
  if (app.time > s.until) { s.i = (s.i + 1) % ROTATION.length; cut(ROTATION[s.i]); }
  const sh = SHOTS[s.shot], c = app.camera, u = Math.min(1, (app.time - s.start) / 8);
  c.position.lerpVectors(sh.pos, look.copy(sh.pos).lerp(sh.target, .07), u);
  c.lookAt(sh.target);
  /* frame the 4:3 area whatever the screen shape */
  const a = c.aspect, want = 34;
  const fov = a >= 4 / 3 ? want : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(want / 2)) * (4 / 3) / a));
  if (Math.abs(c.fov - fov) > .01) { c.fov = fov; c.updateProjectionMatrix(); }
}
