import * as THREE from 'three';
import { app } from '../app.js';
import { clamp, smooth, damp, easeInOut } from '../lib/util.js';
import { cast, stage, speak, walkTo } from './cast.js';
import { RV, rv, setDoor } from '../rv/rv.js';
import { lab, setCook } from '../rv/lab.js';
import { cutaway } from '../rv/cutaway.js';
import { onStop, stops, placeRV } from '../world/stops.js';
import { tod, setHour } from '../world/lighting.js';
import { groundPose, car } from '../rv/drive.js';
import { flyTo, cancelFlight } from '../ctrl/camera.js';
import { emit } from '../fx/particles.js';
import * as P from '../world/props.js';
import { clearView, restoreView } from '../world/flora.js';
import { buildDaysQuest, days } from './days.js';
import { buildCrush, crush } from './crush.js';

/* Who stands where in each stop, the props that belong there, and the three scenes: the pilot's cold open,
   the dead battery of 4 Days Out, and the crusher in Sunset. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const toWorld = (lx, ly, lz) => { rv.root.updateMatrixWorld(); return V(lx, ly, lz).applyMatrix4(rv.root.matrixWorld); };
const yawOut = localYaw => rv.root.rotation.y + localYaw;
export const scenes = { act, label, title, busy: () => !!seq, canSkip: () => !!seq, get name() { return seq?.name ?? null; } };

/* ---------- a small sequence runner on the app clock ---------- */
let seq = null;
const waiters = [];
class Abort extends Error {}
const wait = s => new Promise((res, rej) => { if (seq?.abort) return rej(new Abort()); waiters.push({ until: app.time + s, res, rej }); });
async function waitUntil(ok, max = 10) { const t0 = app.time; while (!ok() && app.time - t0 < max) await wait(.05); }
function runSeq(name, fn, finish) {
  if (seq) return;
  seq = { name, abort: false, frame: null, finish };
  app.mode = 'scripted'; app.controls.enabled = false; cutaway.enabled = false; cancelFlight();
  app.emit('scripted', true); app.emit('act');
  fn().catch(e => { if (!(e instanceof Abort)) { console.error(e); dispatchEvent(new ErrorEvent('error', { message: e.message, error: e })); } }).finally(() => {
    const f = seq?.finish; seq = null; waiters.length = 0; cam.from = null; restoreView(app.place);
    app.mode = 'orbit'; app.controls.enabled = true; cutaway.enabled = true; app.shadowFocus = null;
    app.camera.fov = 40; app.camera.updateProjectionMatrix();
    try { f?.(); } catch (e) { console.error(e); }
    app.emit('scripted', false); app.emit('act'); app.emit('shot', '');
  });
}
function abortSeq() { if (!seq) return; seq.abort = true; for (const w of waiters.splice(0)) w.rej(new Abort()); }
app.onUpdate(dt => {
  for (let i = waiters.length - 1; i >= 0; i--) if (app.time >= waiters[i].until) { const w = waiters.splice(i, 1)[0]; w.res(); }
  seq?.frame?.(dt);
}, 4);

/* the camera in a scene: a move from a to b over dur */
const cam = { from: null, to: null, lf: null, lt: null, t: 0, dur: 1, fov: 40, ease: easeInOut, follow: null, shake: 0 };
/* a camera point inside the RV's body is moved out through the nearest side, unless the shot is meant to be inside */
const inv = new THREE.Matrix4(), lp = V();
function outside(p) {
  rv.root.updateMatrixWorld(); inv.copy(rv.root.matrixWorld).invert(); lp.copy(p).applyMatrix4(inv);
  if (lp.x > RV.x0 - .4 && lp.x < RV.x1 + .4 && Math.abs(lp.z) < RV.halfW + .4 && lp.y < RV.roof + .5) { lp.z = Math.sign(lp.z || 1) * (RV.halfW + 1.2); p.copy(lp.applyMatrix4(rv.root.matrixWorld)); }
  const g = app.terrain?.heightAt(p.x, p.z); if (g != null && p.y < g + .35) p.y = g + .35;
  return p;
}
function shot(pos, look, { to = null, lookTo = null, dur = 4, fov = 40, ease = easeInOut, follow = null, inside = false } = {}) {
  cam.from = pos.clone(); cam.to = (to ?? pos).clone(); cam.lf = look.clone(); cam.lt = (lookTo ?? look).clone();
  if (!inside) { outside(cam.from); outside(cam.to); }
  cam.t = 0; cam.dur = dur; cam.fov = fov; cam.ease = ease; cam.follow = follow;
}
const cp = V(), cl = V();
app.onUpdate(dt => {
  if (app.mode !== 'scripted' || !cam.from) return;
  cam.t = Math.min(1, cam.t + dt / cam.dur);
  const e = cam.ease(cam.t), c = app.camera;
  cp.lerpVectors(cam.from, cam.to, e); cl.lerpVectors(cam.lf, cam.lt, e);
  if (cam.follow) cam.follow(cp, cl, dt);
  c.position.copy(cp);
  if (cam.shake > .001) { c.position.x += (Math.random() - .5) * cam.shake; c.position.y += (Math.random() - .5) * cam.shake; cam.shake *= Math.exp(-dt * 6); }
  c.lookAt(cl);
  if (Math.abs(c.fov - cam.fov) > .01) { c.fov = cam.fov; c.updateProjectionMatrix(); }
  app.controls.target.copy(cl);
  app.shadowFocus = cl;
  clearView(app.place, c.position, cl);
}, 45);
app.on('shake', k => { cam.shake = Math.max(cam.shake, k ?? .04); });

/* ---------- staging ---------- */
const clothes = P.clothesOnMirror();
const tmpB = V();
const bodyPoint = f => { rv.body.updateMatrixWorld(); return tmpB.set(f.x, f.y, f.z).applyMatrix4(rv.body.matrixWorld); };
function stageStop(id) {
  const F = RV.floor;
  const head = rv.parts.mirrors.right.head;
  if (clothes.parent !== head) { head.add(clothes); clothes.position.set(.02, -.1, .02); }
  clothes.visible = id === 'pilot'; clothes.userData.shirt.visible = true;
  for (const k of ['walt', 'jesse', 'hank', 'joe']) stage(k, { look: 'sunset', visible: false, pos: V() });
  if (cast.walt.variants.pilot.apron) for (const m of cast.walt.variants.pilot.apron) m.visible = true;
  if (id === 'pilot') {
    stage('walt', { look: 'pilot', frame: 'rv', pos: V(-2.4, F, -.3), rot: Math.PI, pose: 'cook', focus: () => lab.flasks[2] && bodyPoint(lab.flasks[2]) });
    stage('jesse', { look: 'pilot', pos: toWorld(2.6, 0, 3.1), rot: yawOut(-.4), pose: 'smoke', focus: () => cast.walt.rig?.headPos(V()) });
    setCook(true);
  } else if (id === 'days') {
    stage('walt', { look: 'days', pos: toWorld(-.4, 0, 3.8), rot: yawOut(0), pose: 'sit', hy: .47 });
    stage('jesse', { look: 'days', pos: toWorld(.9, 0, 3.9), rot: yawOut(-.15), pose: 'sit', hy: .47, focus: () => cast.walt.rig?.headPos(V()) });
    setCook(false);
  } else if (id === 'sunset') {
    stage('walt', { look: 'sunset', frame: 'rv', pos: V(1.62, F, .75), rot: 0, pose: 'push', focus: () => cast.hank.rig?.headPos(V()) });
    stage('jesse', { look: 'sunset', frame: 'rv', pos: V(.55, F, .45), rot: .3, pose: 'stand', focus: () => cast.hank.rig?.headPos(V()) });
    stage('hank', { look: 'sunset', pos: toWorld(1.65, 0, 2.25), rot: yawOut(Math.PI), pose: 'hips', focus: () => toWorld(1.6, 1.8, 1.2) });
    setCook(false);
  }
  app.emit('staged', id);
}

/* ---------- the smoke from the roof vent while they cook: blue from season 2 on ---------- */
let smokeT = 0;
const ventPos = V();
app.onUpdate(dt => {
  if (!lab.cooking || !rv.parts.vents?.length || app.mode === 'drive') return;
  smokeT += dt;
  const blue = stops.id !== 'pilot', rate = blue ? .05 : .16;
  const v = rv.parts.vents[0]; v.updateMatrixWorld(); ventPos.set(0, .2, 0).applyMatrix4(v.matrixWorld);
  if (!v.visible || !rv.roof.group.visible) return;
  while (smokeT > rate) {
    smokeT -= rate;
    if (blue) emit('smoke', { x: ventPos.x, y: ventPos.y, z: ventPos.z, vx: 1.2 + (Math.random() - .5) * .6, vy: 2.6 + Math.random(), vz: .4 + (Math.random() - .5) * .6, life: 9, s0: .5, s1: 7, a: .55, c: [.2, .38, .95], drag: .25, buoy: .15, fadeIn: .05 });
    else emit('smoke', { x: ventPos.x, y: ventPos.y, z: ventPos.z, vx: .7 + (Math.random() - .5) * .3, vy: .9, vz: .25, life: 5, s0: .2, s1: 2.2, a: .18, c: [.92, .9, .86], drag: .6, buoy: .05 });
  }
}, 61);

/* ---------- the scene button ---------- */
function label() {
  if (seq) return 'SKIP';
  if (stops.id === 'pilot') return 'COLD OPEN';
  if (stops.id === 'days') return days.label();
  if (stops.id === 'sunset') return crush.done ? 'RESTORE' : 'CRUSH';
  return 'PLAY';
}
function title() {
  if (stops.id === 'pilot') return 'The cold open: the pants, the chase, the ditch, the sirens (Space)';
  if (stops.id === 'days') return 'Stranded four days out: get the RV started (Space)';
  return 'Old Joe’s loader crushes the RV (Space)';
}
function act() {
  if (seq) { abortSeq(); return; }
  if (app.mode === 'walk' || app.mode === 'drive' || stops.busy) return;
  if (app.mode === 'cinema') app.emit('cinema:exit');
  const ctx = { wait, waitUntil, shot, cam, runSeq, stageStop, toWorld, yawOut, V, get seq() { return seq; } };
  if (stops.id === 'pilot') runSeq('cold', coldOpen, endCold);
  else if (stops.id === 'days') days.next(ctx);
  else if (stops.id === 'sunset') { if (crush.done) crush.restore(ctx); else runSeq('crush', () => crush.play(ctx), () => crush.finish(ctx)); }
}

/* ---------- the pilot: the cold open ---------- */
const path = new THREE.CatmullRomCurve3([[-153, -279], [-122, -250], [-62, -202], [-2, -142], [53, -77], [88, -32], [106, -4], [117, 21], [125, 40], [129.2, 52.9]].map(([x, z]) => V(x, 0, z)));
const pants = P.flyingPants(); pants.visible = false;
let savedHour = 14;
/* a camera spot with no tree against the lens and none across the view: turned round what it looks at, and raised
   a little if it must; the least blocked spot wins */
function clearSpot(p, look) {
  const trees = (app.place?.blockers ?? []).flatMap(b => b.list), T = app.terrain;
  const d = Math.hypot(p.x - look.x, p.z - look.z), a0 = Math.atan2(p.z - look.z, p.x - look.x), up = p.y - T.heightAt(p.x, p.z);
  const cost = q => {
    const dx = look.x - q.x, dz = look.z - q.z, L2 = dx * dx + dz * dz || 1; let c = 0;
    for (const tr of trees) {
      const near = Math.hypot(tr.x - q.x, tr.z - q.z); if (near < tr.r + 6) c += 4 * (1 - near / (tr.r + 6));
      const u = ((tr.x - q.x) * dx + (tr.z - q.z) * dz) / L2, off = Math.hypot(q.x + dx * u - tr.x, q.z + dz * u - tr.z);
      if (u > 0 && u < .85 && off < tr.r + 1.2) c += 3;
      /* big in the frame: in the view cone and near the camera */
      else if (u > 0 && u < .6 && off < u * Math.sqrt(L2) * .6 + tr.r) c += 2.5 * (1 - u / .6);
    }
    for (let i = 1; i < 16; i++) { const t = i / 16; if (T.heightAt(q.x + dx * t, q.z + dz * t) > q.y + (look.y - q.y) * t - .3) c += 2; }
    return c;
  };
  let best = { c: cost(p), q: p };
  for (const lift of [0, 1.2, 2.6]) for (let k = -10; k <= 10; k++) {
    const a = a0 + k * .09, q = V(look.x + Math.cos(a) * d, 0, look.z + Math.sin(a) * d); q.y = T.heightAt(q.x, q.z) + up + lift;
    const c = cost(q) + Math.abs(k) * .08 + lift * .15;
    if (c < best.c) best = { c, q };
  }
  return best.q;
}

async function coldOpen() {
  const T = app.terrain, L = path.getLength();
  savedHour = tod.hour; tod.playing = false; setHour(13.6);
  setCook(false); setDoor(false); clothes.visible = true; clothes.userData.shirt.visible = true;
  stage('walt', { look: 'pilot', frame: 'rv', pos: V(3.55, .72, -.62), rot: Math.PI / 2, pose: 'drive', hy: .47 });
  cast.walt.rig.props.mask.visible = true;
  for (const m of cast.walt.rig.apron ?? []) m.visible = false;
  stage('jesse', { look: 'pilot', frame: 'rv', pos: V(3.55, .72, .62), rot: Math.PI / 2, pose: 'slump', hy: .47 });
  cast.jesse.rig.props.mask.visible = true;
  /* the RV runs the road at 17 m/s, then veers off into the ditch */
  /* it starts 75 m before the pants, so it is in the shot soon after they land */
  let s = Math.max(0, L * .66 - 75), vel = 0, running = false, crashed = false, wob = 0;
  const pose = {}, pos = V(), tan = V();
  const place = dt => {
    const u = clamp(s / L, 0, 1);
    path.getPointAt(u, pos); path.getTangentAt(u, tan);
    const wobble = crashed ? 0 : Math.sin(app.time * 2.3) * .06 + Math.sin(app.time * 5.1) * .025;
    wob = damp(wob, wobble, 4, dt);
    const yaw = Math.atan2(-tan.z, tan.x) + wob;
    groundPose(pos.x, pos.z, yaw, pose);
    car.pitch = damp(car.pitch, pose.pitch, crashed ? 18 : 9, dt); car.roll = damp(car.roll, pose.roll + wob * .4, 9, dt);
    rv.root.position.set(pos.x, pose.y, pos.z); rv.root.rotation.set(0, yaw, 0);
    rv.body.rotation.set(car.roll, 0, car.pitch, 'YXZ');
    car.spin -= vel * dt / RV.wheelR; for (const w of rv.wheels) { w.spin.rotation.z = car.spin; w.group.rotation.y = w.steer ? wob * 2.5 : 0; }
    rv.steer = wob * 3;
    if (vel > 3) app.emit('dust', { x: pos.x, z: pos.z, yaw, v: vel, y: pose.y });
  };
  place(0);
  const land = path.getPointAt(.66).clone(), landY = T.heightAt(land.x, land.z);
  let ft = 0;
  pants.userData.fall = dt => {
    ft += dt; const k = clamp(ft / 4.2, 0, 1);
    pants.position.set(land.x - 3 * (1 - k) + Math.sin(ft * 1.7) * .6 * (1 - k), landY + .08 + 11 * (1 - smooth(k)) * (1 - k * .15), land.z + 2 * (1 - k) + Math.cos(ft * 1.3) * .5 * (1 - k));
    pants.rotation.set(Math.sin(ft * 2.1) * 1.2 * (1 - k) + k * Math.PI / 2, ft * 1.3 * (1 - k), Math.cos(ft * 1.7) * .8 * (1 - k));
    pants.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(ft * 5 + i) * .5 * (1 - k); });
  };
  seq.frame = dt => {
    if (running && !crashed) {
      const remain = L - s, target = remain < 40 ? Math.max(6, remain * .45) : 17;
      vel = damp(vel, target, 1.5, dt); s += vel * dt;
      if (s >= L) {
        s = L; crashed = true; vel = 0; app.emit('crash'); app.emit('shake', .35);
        const p = rv.root.position;
        for (let i = 0; i < 60; i++) emit('dust', { x: p.x + (Math.random() - .5) * 6, y: p.y + .3, z: p.z + (Math.random() - .5) * 6, vx: (Math.random() - .5) * 6, vy: 1 + Math.random() * 2, vz: (Math.random() - .5) * 6, life: 3 + Math.random() * 2, s0: .8, s1: 5, a: .5, c: [.72, .52, .4], drag: .9, buoy: .05 });
      }
    }
    place(dt);
    if (pants.visible) pants.userData.fall(dt);
  };
  /* 1. the pants fall onto the dirt road */
  pants.visible = true; app.root.add(pants); pants.userData.fall(0);
  /* from low on the road, looking back the way the RV will come; the pants tumble down into the frame */
  const t66 = path.getTangentAt(.66), eye = land.clone().addScaledVector(t66, 4.6).add(V(0, 1.05, 0)); eye.y = T.heightAt(eye.x, eye.z) + 1.05;
  shot(eye, V(land.x - 3, landY + 9, land.z + 2), { lookTo: land.clone().addScaledVector(t66, -9).add(V(0, .9, 0)), dur: 4.4, fov: 40 });
  app.emit('shot', 'S1 · E1  ·  PILOT');
  await wait(1.6); running = true;
  await wait(3.2);
  /* 2. the RV comes down the road: a low shot from the verge, the pants in front */
  const tl = path.getTangentAt(.66), side = V(-tl.z, 0, tl.x).normalize();
  const low = land.clone().addScaledVector(side, -3.2).addScaledVector(tl, 3.5); low.y = T.heightAt(low.x, low.z) + .7;
  shot(low, rv.root.position.clone().add(V(0, 1.6, 0)), { dur: 5, fov: 36, follow: (p, l) => l.copy(rv.root.position).add(V(0, 1.4, 0)) });
  await waitUntil(() => s > L * .66 + 12, 9);
  /* 3. alongside: Walt at the wheel in his gas mask and underwear */
  shot(V(), V(), { dur: 3.2, fov: 42, follow: (p, l) => {
    rv.root.updateMatrixWorld(); p.copy(V(6.5, 3.0, 5.5).applyMatrix4(rv.root.matrixWorld)); l.copy(V(3.2, 1.8, .2).applyMatrix4(rv.root.matrixWorld));
    const g = T.heightAt(p.x, p.z) + 1.5; if (p.y < g) p.y = g; } });
  await waitUntil(() => s > L - 45, 6);
  /* 4. into the ditch, seen wide from the door side */
  const end = path.getPointAt(1).clone(), endT = path.getTangentAt(1).clone(); end.y = T.heightAt(end.x, end.z);
  const endYaw = Math.atan2(-endT.z, endT.x), eR = V(Math.sin(endYaw), 0, Math.cos(endYaw));
  let wide = end.clone().addScaledVector(eR, 21).addScaledVector(endT, -7); wide.y = T.heightAt(wide.x, wide.z) + 3.2;
  wide = clearSpot(wide, end.clone().add(V(0, 1.2, 0)));
  shot(wide, end.clone().add(V(0, 1.2, 0)), { dur: 5, fov: 36, lookTo: end.clone().add(V(0, .8, 0)) });
  await waitUntil(() => crashed, 6);
  await wait(1.6);
  /* 5. Walt climbs out, pulls off the mask, takes his shirt off the mirror */
  setDoor(true); await wait(.8);
  const doorOut = toWorld(1.64, 0, 2.0);
  stage('walt', { look: 'pilot', pos: doorOut, rot: yawOut(Math.PI / 2), pose: 'stand' });
  for (const m of cast.walt.rig.apron ?? []) m.visible = false;
  cast.walt.rig.props.mask.visible = true;
  const mirror = toWorld(4.25, 0, 1.95);
  let watch = toWorld(-1.5, 0, 8.5); watch.y = T.heightAt(watch.x, watch.z) + 1.75; watch = clearSpot(watch, doorOut.clone().add(V(0, 1.3, 0)));
  shot(watch, doorOut.clone().add(V(0, 1.3, 0)), { to: toWorld(.5, 0, 7.5).setY(watch.y), dur: 9, fov: 40, follow: (p, l) => l.copy(cast.walt.rig.root.position).add(V(0, 1.3, 0)) });
  await wait(.6); cast.walt.rig.props.mask.visible = false; speak('walt', '(coughs)', 1.2);
  walkTo('walt', [mirror], 1.1);
  await waitUntil(() => !cast.walt.walker, 5);
  clothes.userData.shirt.visible = false; cast.walt.rig.props.shirt.visible = true;
  await wait(.5);
  const clear = toWorld(3.2, 0, 5.2);
  walkTo('walt', [clear], 1.2);
  await waitUntil(() => !cast.walt.walker, 4);
  /* he turns his back to the RV to face the lens */
  const rvc = rv.root.position, wq = cast.walt.rig.root.position;
  cast.walt.rig.root.rotation.y = Math.atan2(wq.x - rvc.x, wq.z - rvc.z);
  /* 6. the camcorder, the message, the sirens, out onto the road with the gun */
  cast.walt.pose = 'record'; cast.walt.rig.props.camcorder.visible = true;
  /* from in front and to his left, so both his face and the camcorder in his left hand are in the frame */
  {const wp = cast.walt.rig.root.position, f = V(Math.sin(cast.walt.rig.root.rotation.y), 0, Math.cos(cast.walt.rig.root.rotation.y)), left = V(-f.z, 0, f.x);
   const dir = f.clone().multiplyScalar(Math.cos(.62)).addScaledVector(left, Math.sin(.62));
   const c1 = wp.clone().addScaledVector(dir, 2.7); c1.y = wp.y + 1.55;
   shot(c1, wp.clone().add(V(0, 1.45, 0)), { to: wp.clone().addScaledVector(dir, 2.1).setY(wp.y + 1.52), dur: 3.6, fov: 34 });}
  speak('walt', 'My name is Walter Hartwell White.', 3.2);
  await wait(3.4);
  app.emit('sirens');
  cast.walt.rig.props.camcorder.visible = false;
  /* the nearest bit of road; he walks toward it, and the cut puts him on it */
  let onRoad = null, best = 1e9;
  for (let u = .5; u < .97; u += .005) { const q = path.getPointAt(u); q.y = T.heightAt(q.x, q.z); const d = q.distanceTo(cast.walt.rig.root.position); if (d < best) { best = d; onRoad = q.clone(); } }
  walkTo('walt', [onRoad], 1.5);
  {const wp = cast.walt.rig.root.position, c2 = toWorld(-6, 0, 11); c2.y = T.heightAt(c2.x, c2.z) + 1.6;
   shot(c2, wp.clone().add(V(0, 1.2, 0)), { dur: 3.5, fov: 38, follow: (p, l) => l.copy(cast.walt.rig.root.position).add(V(0, 1.2, 0)) });}
  await wait(3.5);
  cast.walt.walker = null; cast.walt.rig.root.position.set(onRoad.x, T.heightAt(onRoad.x, onRoad.z), onRoad.z);
  const back = path.getPointAt(.6); back.y = T.heightAt(back.x, back.z);
  cast.walt.rig.root.rotation.y = Math.atan2(back.x - onRoad.x, back.z - onRoad.z);
  cast.walt.pose = 'aim'; cast.walt.rig.props.gun.visible = true;
  /* the poster: low, in front of him, the RV in the ditch behind */
  const fwd = V(back.x - onRoad.x, 0, back.z - onRoad.z).normalize();
  const hero = onRoad.clone().addScaledVector(fwd, 4.2); hero.y = T.heightAt(hero.x, hero.z) + .5;
  shot(hero, onRoad.clone().add(V(0, 1.6, 0)), { to: hero.clone().addScaledVector(fwd, -1.2).add(V(0, .1, 0)), dur: 5.5, fov: 34 });
  await wait(5.5);
}
function endCold() {
  pants.visible = false; if (pants.parent) pants.parent.remove(pants);
  setHour(savedHour);
  placeRV('pilot'); setDoor(false);
  stageStop('pilot');
  cast.walt.variants.pilot.props.shirt.visible = false;
  app.emit('sirens:off');
  flyTo('overview', 1.6);
}

export function buildScenes() {
  onStop({ enter: id => stageStop(id), leave: () => { if (seq) abortSeq(); } });
  const ctx = { wait, waitUntil, shot, cam, runSeq, stageStop, toWorld, yawOut, V, get seq() { return seq; } };
  buildDaysQuest(ctx);
  buildCrush(ctx);
  app.on('rv:parked', () => { if (stops.id) stageStop(stops.id); });
  app.on('drive', on => {
    if (!on) return;
    const look = stops.id;
    stage('walt', { look, frame: 'rv', pos: V(3.55, .72, -.62), rot: Math.PI / 2, pose: 'drive', hy: .47 });
    stage('jesse', { look, frame: 'rv', pos: V(3.55, .72, .62), rot: Math.PI / 2, pose: 'sit', hy: .47 });
    for (const k of ['hank', 'joe']) stage(k, { look: 'sunset', visible: false, pos: V() });
    clothes.visible = false;
    setCook(false);
  });
}
export { stageStop };
