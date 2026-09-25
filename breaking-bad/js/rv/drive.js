import * as THREE from 'three';
import { app } from '../app.js';
import { clamp, damp, lerp } from '../lib/util.js';
import { vnoise } from '../lib/noise.js';
import { RV, rv } from './rv.js';
import { cancelFlight, flyTo, writeHash } from '../ctrl/camera.js';

/* Drive the RV over the real ground. Turn the key first: it cranks and often does not catch. The body sits on its
   four wheels (pitch and roll from the ground under them) on soft springs, so it rocks over every rut. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WB = RV.frontAxle - RV.rearAxle, TRACK = 2.12;
export const car = { x: 0, z: 0, yaw: 0, v: 0, steer: 0, pitch: 0, roll: 0, pv: 0, rv: 0, spin: 0,
  engine: 'off', crank: 0, tries: 0, rpm: 0, dead: false, horn: false };
const keys = new Set();
const touch = { gas: false, brake: false, steer: 0 };
let camMode = 'chase', saved = null;

/* ---------- where the body sits on the ground ---------- */
const bump = (x, z) => (vnoise(x * .9, z * .9) - .5) * .05 + (vnoise(x * .27 + 5, z * .27) - .5) * .08;
export function groundPose(x, z, yaw, out = {}) {
  const T = app.terrain, c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => { const wx = x + c * lx + s * lz, wz = z - s * lx + c * lz; return T.heightAt(wx, wz) + bump(wx, wz); };
  const fl = at(RV.frontAxle, -TRACK / 2), fr = at(RV.frontAxle, TRACK / 2), bl = at(RV.rearAxle, -TRACK / 2), br = at(RV.rearAxle, TRACK / 2);
  const hf = (fl + fr) / 2, hb = (bl + br) / 2;
  out.pitch = Math.atan2(hf - hb, WB);
  out.roll = Math.atan2(((fl + bl) - (fr + br)) / 2, TRACK);
  out.y = hb + (hf - hb) * (-RV.rearAxle / WB);
  return out;
}
const gp = {};
/* put the RV at (x, z) facing yaw, sitting on the ground; settle = no spring motion left */
export function setRVPose(x, z, yaw, settle = true) {
  groundPose(x, z, yaw, gp);
  car.x = x; car.z = z; car.yaw = yaw;
  if (settle) { car.pitch = gp.pitch; car.roll = gp.roll; car.pv = car.rv = 0; }
  rv.root.position.set(x, gp.y, z); rv.root.rotation.set(0, yaw, 0);
  rv.body.rotation.set(car.roll, 0, car.pitch, 'YXZ');
}

export const drive = {
  get active() { return app.mode === 'drive'; },
  /* for the tests */
  state: () => `${car.engine} v ${car.v.toFixed(1)} m/s rpm ${car.rpm.toFixed(2)} tries ${car.tries} dead ${car.dead}`,
  enter() {
    if (app.mode === 'drive' || !rv.root) return;
    cancelFlight();
    saved = { fov: app.camera.fov };
    const r = rv.root; car.x = r.position.x; car.z = r.position.z; car.yaw = r.rotation.y; car.v = 0; car.steer = 0; car.tries = 0;
    car.dead = app.place?.id === 'days' && !app.batteryOK;
    app.mode = 'drive'; app.controls.enabled = false;
    rv.door.target = 0;
    app.emit('drive', true); app.emit('engine', car.engine);
    help();
  },
  exit() {
    if (app.mode !== 'drive') return;
    app.mode = 'orbit'; app.controls.enabled = true; keys.clear();
    const c = app.camera; c.fov = saved?.fov ?? 40; c.updateProjectionMatrix();
    rv.lights.heads.forEach(l => { l.intensity = 0; }); rv.lights.headMat.emissiveIntensity = 0;
    if (car.engine !== 'off') setEngine('off');
    car.v = 0; app.shadowFocus = null;
    /* back to an orbit around wherever it is now */
    const r = rv.root, fwd = V(Math.cos(r.rotation.y), 0, -Math.sin(r.rotation.y)), side = V(Math.sin(r.rotation.y), 0, Math.cos(r.rotation.y));
    const target = r.position.clone().add(V(0, 1.4, 0));
    const pos = target.clone().addScaledVector(fwd, 12).addScaledVector(side, 18); pos.y += 7;
    app.controls.target.copy(target);
    flyTo({ pos, target }, 1.4);
    app.emit('drive', false); app.emit('rv:parked'); writeHash();
  },
  key(down) {
    if (!down || app.mode !== 'drive') return;
    if (car.engine === 'running') { setEngine('off'); return; }
    if (car.engine === 'off' || car.engine === 'stalled') startCrank();
  },
  pedal(k, on) { touch[k] = on; },
  steerTouch(s) { touch.steer = s; },
  toggleCam() { camMode = camMode === 'chase' ? 'cab' : 'chase'; help(); },
  get engine() { return car.engine; },
};

function help() {
  const t = app.touch ? (car.engine === 'running' ? 'GAS and BRAKE · slide to steer · KEY to stop' : 'Tap KEY to start it')
    : car.engine === 'running' ? 'W S to drive · A D to steer · Space horn · V camera · Esc to get out'
    : 'Press E to turn the key · Esc to get out';
  app.emit('drive:help', t);
}

function setEngine(st) { car.engine = st; app.emit('engine', st); help(); }
function startCrank() { car.crank = 0; car.tries++; setEngine('cranking'); app.emit('crank', { dead: car.dead }); }
/* it catches on the second or third try; with a flat battery it only clicks */
function crankResult() {
  if (car.dead) { setEngine('off'); app.emit('card', { title: 'Nothing', text: 'Click. The battery is flat: the keys stayed in the ignition for four days.' }); app.emit('engine:dead'); return; }
  const ok = car.tries >= 3 || Math.random() < (car.tries === 1 ? .35 : .7);
  if (ok) { setEngine('running'); car.tries = 0; app.emit('engine:start'); }
  else { setEngine('stalled'); app.emit('engine:stall'); app.emit('card', { title: 'It won’t catch', text: 'The old engine coughs and dies. Try the key again.', hold: 2600 }); }
}

export function buildDrive() {
  addEventListener('keydown', e => {
    if (app.mode !== 'drive') return;
    keys.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) drive.key(true);
    if (e.code === 'KeyV' && !e.repeat) drive.toggleCam();
    if (e.code === 'Space') { e.preventDefault(); if (!car.horn) { car.horn = true; app.emit('horn', true); } }
  });
  addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'Space' && car.horn) { car.horn = false; app.emit('horn', false); } });
  addEventListener('blur', () => keys.clear());
  app.onUpdate(update, 6);
}

/* one step of the vehicle for a scripted drive too: controls in, pose out */
export function stepCar(dt, { gas = 0, brake = 0, steer = 0, run = true } = {}) {
  car.steer = damp(car.steer, clamp(steer, -1, 1), 3.2, dt);
  let a = 0;
  if (run) {
    if (gas) a += (car.v >= -.2 ? 3.4 * (1 - clamp(car.v / 24, 0, 1)) : 7) * gas;
    if (brake) a -= (car.v > .3 ? 7 : 1.8 * (1 - clamp(-car.v / 5, 0, 1))) * brake;
  } else if (brake || gas) a -= Math.sign(car.v) * 6;
  a -= car.v * .06 + Math.sign(car.v) * Math.min(Math.abs(car.v) * 3, .5) + car.v * Math.abs(car.v) * .004;
  a -= 9.8 * Math.sin(car.pitch) * .9;
  car.v = clamp(car.v + a * dt, -5, 26);
  if (!run && Math.abs(car.v) < .05 && !gas) car.v = 0;
  const maxSteer = lerp(.62, .12, clamp(Math.abs(car.v) / 20, 0, 1));
  const yawRate = car.v / WB * Math.tan(car.steer * maxSteer);
  let nyaw = car.yaw + yawRate * dt, nx = car.x + Math.cos(nyaw) * car.v * dt, nz = car.z - Math.sin(nyaw) * car.v * dt;
  groundPose(nx, nz, nyaw, gp);
  const tooSteep = Math.abs(gp.pitch) > .42 || Math.abs(gp.roll) > .4, off = Math.max(Math.abs(nx), Math.abs(nz)) > 470;
  const dir = Math.sign(car.v || 1), fx = nx + Math.cos(nyaw) * 3.8 * dir, fz = nz - Math.sin(nyaw) * 3.8 * dir;
  const hit = !tooSteep && !off && (app.place?.obstacles ?? []).some(o => Math.hypot(fx - o.x, fz - o.z) < o.r + 1.3);
  let blocked = false;
  if (tooSteep || off || hit) {
    blocked = true;
    if (Math.abs(car.v) > 3) { app.emit('shake', Math.min(.12, Math.abs(car.v) * .01)); app.emit('rv:bump', Math.abs(car.v)); }
    car.v *= -.15; nx = car.x; nz = car.z; nyaw = car.yaw; groundPose(nx, nz, nyaw, gp);
  }
  car.x = nx; car.z = nz; car.yaw = nyaw;
  const lean = -yawRate * car.v * .012;
  const spring = (val, vel, target, kk = 38, c = 7) => { const acc = (target - val) * kk - vel * c; vel += acc * dt; return [val + vel * dt, vel]; };
  [car.pitch, car.pv] = spring(car.pitch, car.pv, gp.pitch - a * .004);
  [car.roll, car.rv] = spring(car.roll, car.rv, gp.roll + lean);
  rv.root.position.set(car.x, gp.y, car.z); rv.root.rotation.set(0, car.yaw, 0);
  rv.body.rotation.set(car.roll, 0, car.pitch, 'YXZ');
  rv.steer = car.steer;
  car.spin -= car.v * dt / RV.wheelR;
  for (const w of rv.wheels) { w.spin.rotation.z = car.spin; w.group.rotation.y = w.steer ? car.steer * maxSteer : 0; }
  car.rpm = run ? damp(car.rpm, .18 + .82 * clamp(Math.abs(car.v) / 20 + gas * .35, 0, 1), 3, dt) : damp(car.rpm, 0, 4, dt);
  if (Math.abs(car.v) > 1.2) app.emit('dust', { x: car.x, z: car.z, yaw: car.yaw, v: car.v, y: gp.y });
  return { blocked, a };
}

const camPos = V(), camLook = V(), fwd = V();
function update(dt) {
  if (app.mode !== 'drive') return;
  if (car.engine === 'cranking') { car.crank += dt; if (car.crank > (car.dead ? .5 : 1.25)) crankResult(); }
  const run = car.engine === 'running', k = c => keys.has(c);
  const gas = (k('KeyW') || k('ArrowUp') || touch.gas) ? 1 : 0, brake = (k('KeyS') || k('ArrowDown') || touch.brake) ? 1 : 0;
  const steer = clamp((k('KeyA') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0) - touch.steer, -1, 1);
  stepCar(dt, { gas, brake, steer, run });
  app.emit('drive:speed', Math.abs(car.v) * 2.237);
  app.emit('engine:rpm', car.rpm);
  const dark = (app.tod?.dim ?? 0) > .45 && run;
  rv.lights.heads.forEach(l => { l.intensity = dark ? 60 : 0; }); rv.lights.headMat.emissiveIntensity = dark ? 3 : 0;
  const c = app.camera; fwd.set(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
  app.shadowFocus = rv.root.position;
  if (camMode === 'chase') {
    const back = 13 + Math.abs(car.v) * .25, y = rv.root.position.y;
    camPos.set(car.x - fwd.x * back, y + 5.2, car.z - fwd.z * back);
    const g = app.terrain.heightAt(camPos.x, camPos.z) + 1.5; if (camPos.y < g) camPos.y = g;
    c.position.lerp(camPos, 1 - Math.exp(-dt * 4));
    camLook.set(car.x + fwd.x * 4, y + 1.6, car.z + fwd.z * 4);
    c.lookAt(camLook);
    if (c.fov !== 50) { c.fov = 50; c.updateProjectionMatrix(); }
  } else {
    rv.body.updateMatrixWorld();
    /* the driver's eyes, just in front of his face, so his head stays behind the camera and his hands are on the wheel */
    c.position.copy(V(3.63, 1.99, -.6).applyMatrix4(rv.body.matrixWorld));
    camLook.copy(V(12, 1.4, -.6).applyMatrix4(rv.body.matrixWorld));
    c.lookAt(camLook);
    if (c.fov !== 62) { c.fov = 62; c.updateProjectionMatrix(); }
  }
  app.controls.target.copy(rv.root.position).add(V(0, 1.4, 0));
}
