import * as THREE from 'three';
import { app } from './app.js';
import { easeInOutCubic, lerp } from './lib/util.js';
import { caption, note, clearCaptions } from './ui/captions.js';
import { fps } from './ctrl/fps.js';

/* Cutscenes: an async function of steps that runs on the world's clock (so a skipped scene fast-forwards the same
   code, and the tests can step it frame by frame). The camera is the scene's while it runs. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const waits = [];
const cam = { on: false, t: 0, dur: 1, p0: V(), p1: V(), q0: new THREE.Quaternion(), q1: new THREE.Quaternion(), follow: null, f0: 50, f1: 50 };
export const seq = { running: null, skipping: false };

app.onUpdate(() => {
  for (const w of waits.slice()) if (app.time >= w.t || (w.pred && w.pred())) { waits.splice(waits.indexOf(w), 1); w.res(); }
}, -50);
/* the camera move, after everything that moved this frame */
app.onUpdate(dt => {
  const c = app.camera;
  if (cam.follow) { const r = cam.follow(dt); if (r) { c.position.copy(r.pos); c.lookAt(r.target); } return; }
  if (!cam.on) return;
  cam.t = Math.min(1, cam.t + dt / cam.dur);
  const e = cam.ease(cam.t);
  c.position.lerpVectors(cam.p0, cam.p1, e);
  c.quaternion.slerpQuaternions(cam.q0, cam.q1, e);
  if (cam.f0 !== cam.f1) { c.fov = lerp(cam.f0, cam.f1, e); c.updateProjectionMatrix(); }
  if (cam.t >= 1) cam.on = false;
}, 85);

const look = new THREE.Matrix4(), up = V(0, 1, 0);
function quatFor(pos, target, out) { look.lookAt(pos, target, up); return out.setFromRotationMatrix(look); }

export const S = {
  wait: sec => new Promise(res => waits.push({ t: app.time + sec, res })),
  until: (pred, max = 60) => new Promise(res => waits.push({ t: app.time + max, pred, res })),
  /* fly the camera to pos, looking at target, over dur seconds (0 cuts) */
  cam(pos, target, dur = 0, { fov = null, ease = easeInOutCubic } = {}) {
    cam.follow = null;
    const c = app.camera;
    cam.p0.copy(c.position); cam.q0.copy(c.quaternion); cam.p1.copy(pos); quatFor(pos, target, cam.q1);
    cam.f0 = c.fov; cam.f1 = fov ?? c.fov; cam.ease = ease;
    if (dur <= 0) { c.position.copy(pos); c.quaternion.copy(cam.q1); if (fov) { c.fov = fov; c.updateProjectionMatrix(); } cam.on = false; return; }
    cam.t = 0; cam.dur = dur; cam.on = true;
  },
  /* the camera follows fn(dt) -> { pos, target } each frame until cam() or stopFollow() */
  follow(fn) { cam.on = false; cam.follow = fn; },
  stopFollow() { cam.follow = null; },
  say: (who, text, dur = 2.8) => caption(text, { who, dur }),
  note: (text, dur = 3.4) => note(text, dur),
};

/* run a cutscene; resolves when it is done (or skipped to its end) */
export async function run(fn, { mode = 'scripted', skippable = true, keepCamera = false } = {}) {
  if (seq.running) return;
  const prevMode = app.mode, wasFps = fps.on;
  seq.running = { skippable }; seq.skipping = false;
  if (wasFps) fps.freeze(true);
  app.mode = mode; if (app.controls) app.controls.enabled = false;
  app.emit('scripted', true);
  try { await fn(S); }
  catch (e) { console.error(e); dispatchEvent(new ErrorEvent('error', { message: e.message, error: e })); }
  finally {
    cam.on = false; cam.follow = null;
    if (seq.skipping) { app.timeScale = 1; app.fadeK = 0; seq.skipping = false; app.skipping = false; }
    seq.running = null;
    if (wasFps && fps.on) fps.freeze(false);
    app.mode = fps.on ? fps.opts.mode : (prevMode === 'scripted' ? 'orbit' : prevMode);
    if (app.mode === 'orbit' && app.controls) app.controls.enabled = true;
    app.emit('scripted', false);
  }
}

/* skip: fade to black and run the rest of the scene fast */
export function skip() {
  if (!seq.running?.skippable || seq.skipping) return false;
  seq.skipping = true; app.skipping = true; clearCaptions();
  app.fadeK = 1; app.timeScale = 40;
  app.emit('skip');
  return true;
}
