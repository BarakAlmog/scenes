import * as THREE from 'three';
import { app } from '../app.js';
import { fps } from '../ctrl/fps.js';
import { post } from '../fx/post.js';
import { run, S, seq } from '../seq.js';
import { hud, choose, clearChoice } from '../ui/hud.js';
import { caption, note, clearCaptions } from '../ui/captions.js';
import { cast, person, stage, hide, walkTo, react } from '../cast/people.js';
import { print, blood, clearTracks, tracks } from '../fx/tracks.js';
import { snowfall } from '../fx/snow.js';
import { emit } from '../fx/particles.js';
import { tod, setHour } from '../world/lighting.js';
import { play, playV, slice } from '../audio.js';
import { makeDeer } from './deer.js';
import { waitFade, titleCard, byId } from '../scenes.js';
import { rbox, box, cyl, mat, clamp, damp, lerp, dampAngle, wrapAngle } from '../lib/util.js';
import { clockText } from '../ui/ui.js';

/* The game. You are Paulie. Valery gets away from the grave with the shovel; you chase him through the woods, follow
   his tracks, get one shot into his head, and the tracks end. A deer, a slope, a lost shoe. Then you are lost: the
   cold, the day running out, one bar of signal on the hill for a call to Tony. The van in the hollow; the night; at
   dawn the shoe comes off, you shoot it, and Tony and Bobby answer the shots. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ROUTE = [[-104, 74], [-92, 44], [-70, 12], [-42, -24], [-10, -58], [22, -88], [48, -112], [70, -128]];
const G = { phase: 'idle', t: 0, ammo: 8, mags: 2, shots: 0, hit: false, trailEnd: null, cold: 0, shoe: true, called: false, calls: 0,
  val: null, chris: null, deer: null, found: false, started: 0, events: [], paused: false, hitAt: 0, goneAt: 0, chaseStart: 0, lostStart: 0,
  deerBy: null, hinted: false, dawnShoe: null, shoeShots: 0, shoeAt: null, myAcc: 0, myFoot: 1, breathT: 0 };

/* ---------- the gun in your hand ---------- */
let vm = null, kick = 0, flashT = 0, muzzle = null, flashLight = null;
function buildViewmodel() {
  const g = new THREE.Group(); g.userData.vm = true; g.visible = false;
  const sleeve = mat(0xb89f7c, .8), sk = mat(0xd6a584, .7), gun = mat(0x19191b, .32, .65), gold = mat(0xd9b24a, .25, 1);
  const hold = new THREE.Group(); hold.position.set(.16, -.17, -.44); g.add(hold);
  /* the pistol: slide, frame, grip, the sights */
  box(hold, .034, .042, .19, gun, 0, .012, -.06); box(hold, .03, .03, .15, gun, 0, -.022, -.05);
  const grip = box(hold, .03, .1, .045, gun, 0, -.07, .03); grip.rotation.x = -.25;
  box(hold, .008, .01, .01, gun, 0, .038, -.15); box(hold, .016, .01, .01, gun, 0, .038, .025);
  /* the hand round the grip, the pinky ring */
  rbox(hold, .062, .07, .085, .025, sk, .004, -.06, .035);
  rbox(hold, .066, .03, .05, .012, sk, .002, -.03, -.018);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.012, .004, 6, 12), gold); ring.position.set(-.028, -.095, .05); ring.rotation.y = Math.PI / 2; hold.add(ring);
  /* the tan sleeve back to the elbow */
  const fore = new THREE.Group(); fore.position.set(.01, -.07, .07); hold.add(fore); fore.rotation.x = .38;
  rbox(fore, .09, .09, .34, .035, sleeve, 0, 0, .17);
  box(fore, .092, .012, .04, mat(0x8f7a5c, .8), 0, 0, .01);
  /* the flash at the muzzle */
  muzzle = new THREE.Mesh(new THREE.PlaneGeometry(.12, .12), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: flashTex() }));
  muzzle.position.set(0, .012, -.17); hold.add(muzzle);
  g.userData.hold = hold;
  post.vm.scene.add(g);
  flashLight = new THREE.PointLight(0xffc98a, 0, 9, 2); app.scene.add(flashLight);
  return g;
}
function flashTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(.3, 'rgba(255,190,90,.7)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 6; i++) { x.save(); x.translate(32, 32); x.rotate(i / 6 * Math.PI * 2 + .3); x.fillStyle = 'rgba(255,230,170,.6)'; x.beginPath(); x.moveTo(0, -3); x.lineTo(30, 0); x.lineTo(0, 3); x.fill(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function updateViewmodel(dt) {
  if (!vm) return;
  const on = fps.on && fps.opts?.gun && !seq.running && G.phase !== 'idle';
  /* out of first person (a cutscene) the gun is put away: no flash, no flash light left burning */
  vm.visible = on; if (!on) { flashT = 0; flashLight.intensity = 0; return; }
  const h = vm.userData.hold, t = app.time, mv = fps.moving ? (fps.running ? 1.6 : 1) : 0;
  kick = Math.max(0, kick - dt * 7);
  h.position.set(.16 + Math.sin(t * 5.6) * .006 * mv, -.17 - Math.abs(Math.cos(t * 5.6)) * .01 * mv - (G.cold > .6 ? Math.sin(t * 40) * .002 : 0), -.44 + kick * .05);
  h.rotation.set(kick * .32, Math.sin(t * .7) * .01, 0);
  flashT = Math.max(0, flashT - dt);
  muzzle.material.opacity = flashT > 0 ? 1 : 0; muzzle.rotation.z = Math.random() * 6;
  flashLight.intensity = flashT > 0 ? 1.6 : 0;
  if (flashT > 0) flashLight.position.copy(app.camera.position).addScaledVector(fps.forward(tmpV), .8);
}
const tmpV = V();

/* ---------- shooting ---------- */
const ray = new THREE.Ray();
function rayCapsule(r, a, b, rad) {
  /* nearest distance along the ray to a segment a-b, if within rad */
  let best = null;
  for (let i = 0; i <= 8; i++) {
    const p = a.clone().lerp(b, i / 8), t = Math.max(0, p.clone().sub(r.origin).dot(r.direction));
    const q = r.origin.clone().addScaledVector(r.direction, t);
    if (q.distanceTo(p) < rad && (best === null || t < best.t)) best = { t, y: p.y };
  }
  return best;
}
function shoot(from, dir, { you = true } = {}) {
  ray.set(from, dir);
  const P = app.place, forest = P.forest, T = app.terrain;
  let hit = { t: 160, kind: 'none' };
  /* Valery */
  const vr = G.val?.rig;
  if (vr && vr.root.visible && (G.val.state === 'flee' || G.val.state === 'hurt')) {
    const f = vr.root.position, c = rayCapsule(ray, V(f.x, f.y + .15, f.z), V(f.x, f.y + 1.75, f.z), .3);
    if (c && c.t < hit.t) hit = { t: c.t, kind: 'valery', head: c.y > f.y + 1.42 };
  }
  /* the deer */
  const d = G.deer;
  if (d && d.root.visible && d.state !== 'dead') {
    const f = d.root.position, c = rayCapsule(ray, V(f.x, f.y + .95, f.z).addScaledVector(V(Math.sin(d.root.rotation.y), 0, Math.cos(d.root.rotation.y)), -.5), V(f.x, f.y + 1.05, f.z).addScaledVector(V(Math.sin(d.root.rotation.y), 0, Math.cos(d.root.rotation.y)), .6), .42);
    if (c && c.t < hit.t) hit = { t: c.t, kind: 'deer' };
  }
  /* trunks along the ray, and the ground */
  for (let s = 1; s < 150; s += 1.5) {
    if (s > hit.t) break;
    const p = ray.origin.clone().addScaledVector(dir, s);
    if (p.y < T.heightAt(p.x, p.z)) { if (s < hit.t) hit = { t: s, kind: 'ground' }; break; }
    let tree = null;
    for (const tr of forest.near(p.x, p.z, 1.6)) {
      if (tr.kind === 'laurel') continue;
      const dx = p.x - tr.x, dz = p.z - tr.z;
      if (Math.hypot(dx, dz) < tr.r + .08 && p.y < tr.y + (tr.kind === 'sapling' || tr.kind === 'beech' ? 5 : 16) * tr.s) { tree = tr; break; }
    }
    if (tree) { hit = { t: s, kind: 'tree', tree }; break; }
  }
  const at = ray.origin.clone().addScaledVector(dir, hit.t);
  if (hit.kind === 'tree') {
    for (let i = 0; i < 8; i++) emit('dust', { x: at.x, y: at.y, z: at.z, vx: -dir.x * 2 + (Math.random() - .5) * 2, vy: Math.random() * 2, vz: -dir.z * 2 + (Math.random() - .5) * 2, life: .8, s0: .03, s1: .12, a: .8, c: [.4, .3, .22], grav: 6 });
    for (let i = 0; i < 10; i++) emit('dust', { x: at.x + (Math.random() - .5), y: at.y + 2 + Math.random() * 4, z: at.z + (Math.random() - .5), vx: 0, vy: -1.5, vz: 0, life: 2, s0: .1, s1: .6, a: .5, c: [.95, .96, .98], grav: 1.5 });
    playV('ricochet', { pos: at, ref: 6, gain: .5 });
  } else if (hit.kind === 'ground') {
    for (let i = 0; i < 12; i++) emit('dust', { x: at.x, y: at.y + .05, z: at.z, vx: (Math.random() - .5) * 2, vy: 1 + Math.random() * 2.5, vz: (Math.random() - .5) * 2, life: 1, s0: .08, s1: .5, a: .7, c: [.95, .96, .99], grav: 5 });
  } else if (hit.kind === 'valery' && you) hurtValery(at, hit.head);
  else if (hit.kind === 'deer') killDeer(you);
  return hit;
}
function fire() {
  if (G.phase !== 'chase' && G.phase !== 'lost' && G.phase !== 'dawn') return;
  if (seq.running) return;
  if (G.ammo <= 0) {
    if (G.mags > 0) { G.mags--; G.ammo = 8; playV('reload', { gain: .8 }); hud.ammo(G.ammo, G.mags); }
    else { play('dryfire', { gain: .7 }); note('Out of bullets.', 2); }
    return;
  }
  G.ammo--; G.shots++; kick = 1; flashT = .06; hud.ammo(G.ammo, G.mags);
  playV('pistol', { gain: 1 }); play('echo', { gain: .5, delay: .05 });
  const spread = (fps.running ? .03 : .008) + G.cold * .012;
  const dir = fps.forward(V()).add(V((Math.random() - .5) * spread, (Math.random() - .5) * spread, (Math.random() - .5) * spread)).normalize();
  const h = shoot(app.camera.position.clone(), dir);
  G.events.push({ t: app.time, shot: h.kind });
  app.emit('pine:shot', h.kind);
  if (G.phase === 'dawn' && G.dawnShoe && h.t > 0) {
    const s = G.dawnShoe.position;
    if (app.camera.position.distanceTo(s) < 30) { G.shoeShots = (G.shoeShots ?? 0) + (Math.abs(dir.clone().sub(s.clone().sub(app.camera.position).normalize()).length()) < .15 ? 1 : .5); emit('dust', { x: s.x, y: s.y + .1, z: s.z, vx: 0, vy: 2, vz: 0, life: .8, s0: .1, s1: .5, a: .8, c: [.95, .95, .98], grav: 5 }); }
  }
}

/* ---------- Valery ---------- */
function makeValery() {
  const p = person('valery', ['pine']);
  return { p, get rig() { return p.rig; }, pos: V(), heading: 0, speed: 0, state: 'wait', wp: 0, printAcc: 0, foot: 1, dropAcc: 0, t: 0, hurtT: 0, phase: 0, visibleT: 0 };
}
function hurtValery(at, head) {
  const v = G.val; if (G.hit) return;
  G.hit = true; v.state = 'hurt'; v.hurtT = 0;
  for (let i = 0; i < 14; i++) emit('dust', { x: at.x, y: at.y, z: at.z, vx: (Math.random() - .5) * 2, vy: Math.random() * 1.5, vz: (Math.random() - .5) * 2, life: .6, s0: .02, s1: .06, a: .9, c: [.55, .05, .04], grav: 9 });
  for (let i = 0; i < 6; i++) blood(v.pos.x + (Math.random() - .5) * .6, v.pos.z + (Math.random() - .5) * .6, .9, .06 + Math.random() * .06);
  play('thud', { pos: v.pos, ref: 8, gain: .8 });
  G.hitAt = app.time;
  S.say('Paulie', head ? 'I got him! In the head!' : 'I got him!', 2.2);
  setTimeout(() => { if (G.phase === 'chase') S.say('Christopher', 'He’s getting up! He’s getting up!', 2.4); }, 1500);
}
function stepValery(dt) {
  const v = G.val, r = v.rig; if (!r || v.state === 'wait' || v.state === 'gone' || v.state === 'dig') return;
  const P = app.place, T = app.terrain, me = fps.pos;
  const dx = me.x - v.pos.x, dz = me.z - v.pos.z, dp = Math.hypot(dx, dz);
  if (v.state === 'hurt') {
    v.hurtT += dt;
    r.setSit(0, 0); r.walk(0, 0);
    const k = v.hurtT < 1.4 ? Math.min(1, v.hurtT * 5) : Math.max(0, 1 - (v.hurtT - 1.4) * 2.5);
    r.body.position.y = r.standY - .7 * k; r.spine.rotation.x = 1.2 * k; r.body.rotation.z = .3 * k;
    if (v.hurtT > 2) { v.state = 'flee'; r.body.rotation.z = 0; }
    return;
  }
  /* where to: the next point of the route, away from you, round the trunks, a zigzag */
  const w = ROUTE[Math.min(v.wp, ROUTE.length - 1)];
  let tx = w[0] - v.pos.x, tz = w[1] - v.pos.z; const tl = Math.hypot(tx, tz);
  if (tl < 7 && v.wp < ROUTE.length - 1) v.wp++;
  tx /= tl || 1; tz /= tl || 1;
  if (dp < 22) { tx -= dx / dp * (22 - dp) / 22 * .9; tz -= dz / dp * (22 - dp) / 22 * .9; }
  const zz = Math.sin(app.time * 1.3 + v.t) * .45; tx += -tz * zz; tz += tx * zz;
  for (const t of P.forest.near(v.pos.x, v.pos.z, 2.6)) {
    if (t.kind === 'laurel' || t.kind === 'beech' || t.kind === 'sapling') continue;
    const ex = v.pos.x - t.x, ez = v.pos.z - t.z, d = Math.hypot(ex, ez), rr = t.r + 1.2;
    if (d < rr && d > .01) { tx += ex / d * (rr - d) * 1.4; tz += ez / d * (rr - d) * 1.4; }
  }
  const want = Math.atan2(tx, tz);
  v.heading = dampAngle(v.heading, want, 6, dt);
  const target = (dp < 12 ? 5.8 : dp < 28 ? 4.7 : dp < 48 ? 3.6 : 1.8) * (G.hit ? .9 : 1) * (P.surfaceAt?.(v.pos.x, v.pos.z) ?? 1);
  v.speed = damp(v.speed, target, 3, dt);
  const step = v.speed * dt;
  v.pos.x += Math.sin(v.heading) * step; v.pos.z += Math.cos(v.heading) * step;
  v.pos.y = T.heightAt(v.pos.x, v.pos.z);
  r.root.position.copy(v.pos); r.root.rotation.y = v.heading;
  v.phase += step / 1.9 * Math.PI * 2;
  r.setSit(0, 0); r.walk(v.phase, 1.35); r.spine.rotation.x = .2; r.armL.el.rotation.x = -1.2; r.armR.el.rotation.x = -1.2;
  /* his prints, and after the hit, his blood */
  v.printAcc += step;
  if (v.printAcc > .78) { v.printAcc = 0; v.foot *= -1; const ox = Math.cos(v.heading) * .13 * v.foot, oz = -Math.sin(v.heading) * .13 * v.foot; print(v.pos.x + ox, v.pos.z + oz, v.heading + Math.PI, { who: 'valery', d: .95, drag: v.speed < 3 }); slice('stepsnow', 4, .55, { pos: v.pos, ref: 4, gain: .5 }); }
  if (G.hit) { v.dropAcc += step; if (v.dropAcc > 1.1) { v.dropAcc = 0; blood(v.pos.x + (Math.random() - .5) * .4, v.pos.z + (Math.random() - .5) * .4, .8, .03 + Math.random() * .05); } }
  /* he is out of your sight? after the hit (or a long chase) the tracks end right here */
  const fwd = fps.forward(tmpV), toV = V(v.pos.x - app.camera.position.x, 0, v.pos.z - app.camera.position.z).normalize();
  const seen = fwd.x * toV.x + fwd.z * toV.z > .55 && dp < 60;
  v.visibleT = seen ? 0 : v.visibleT + dt;
  const chaseT = app.time - G.chaseStart;
  if (((G.hit && app.time - G.hitAt > 16) || chaseT > 150 || v.wp >= ROUTE.length - 1) && dp > 22 && v.visibleT > 1.2) {
    v.state = 'gone'; hide('valery'); G.trailEnd = v.pos.clone(); G.goneAt = app.time;
    app.emit('pine:gone', G.trailEnd);
  }
}

/* ---------- Christopher at your side ---------- */
function stepChris(dt) {
  const c = G.chris; if (!c || !c.p.rig || c.p.walker) return;
  const r = c.p.rig, me = fps.pos, y = fps.yaw;
  const want = V(me.x + Math.sin(y) * 2.2 - Math.cos(y) * 1.6, 0, me.z + Math.cos(y) * 2.2 + Math.sin(y) * 1.6);
  const pos = r.root.position, dx = want.x - pos.x, dz = want.z - pos.z, d = Math.hypot(dx, dz);
  if (d > 30) { pos.set(want.x, 0, want.z); }
  const sp = d > 6 ? 4.6 : d > 1.2 ? Math.max(1.2, fps.speed * 1.05) : 0;
  let hx = dx / (d || 1), hz = dz / (d || 1);
  for (const t of app.place.forest.near(pos.x, pos.z, 2)) {
    if (t.kind === 'laurel' || t.kind === 'sapling') continue;
    const ex = pos.x - t.x, ez = pos.z - t.z, dd = Math.hypot(ex, ez), rr = t.r + .8;
    if (dd < rr && dd > .01) { hx += ex / dd * (rr - dd) * 2; hz += ez / dd * (rr - dd) * 2; }
  }
  if (sp > 0) {
    const h = Math.atan2(hx, hz); c.heading = dampAngle(c.heading ?? 0, h, 7, dt);
    pos.x += Math.sin(c.heading) * sp * dt; pos.z += Math.cos(c.heading) * sp * dt;
    c.phase = (c.phase ?? 0) + sp * dt / (sp > 2.5 ? 1.9 : 1.25) * Math.PI * 2;
    r.setSit(0, 0); r.walk(c.phase, Math.min(1, sp / 2) * (sp > 2.5 ? 1.35 : 1));
    c.acc = (c.acc ?? 0) + sp * dt; if (c.acc > .8) { c.acc = 0; print(pos.x, pos.z, c.heading + Math.PI, { who: 'chris', d: .85 }); }
  } else { r.setSit(0, 0); r.walk(0, 0); }
  pos.y = damp(pos.y, app.terrain.heightAt(pos.x, pos.z), 12, dt);
  r.root.rotation.y = c.heading ?? 0;
  /* he shoots at the Russian too, and misses */
  c.fireT = (c.fireT ?? 3) - dt;
  const v = G.val;
  if (G.phase === 'chase' && v?.state === 'flee' && c.fireT < 0) {
    c.fireT = 3.5 + Math.random() * 5;
    const dv = v.pos.distanceTo(pos);
    if (dv < 45) {
      r.props.gun.visible = true;
      const from = r.armR.hand.getWorldPosition(V()), aim = v.pos.clone().add(V((Math.random() - .5) * 3, 1 + Math.random(), (Math.random() - .5) * 3)).sub(from).normalize();
      shoot(from, aim, { you: false });
      play('pistol-far', { pos: from, ref: 12, gain: .9 });
      emit('spark', { x: from.x, y: from.y, z: from.z, life: .06, s0: .3, s1: .4, a: 1, c: [1, .8, .5] });
    }
  }
  r.armR.sh.rotation.x = r.props.gun.visible && G.phase === 'chase' ? -1.3 : r.armR.sh.rotation.x;
}

/* ---------- the deer ---------- */
function killDeer(you) {
  const d = G.deer; if (!d || d.state === 'dead') return;
  d.state = 'dead'; d.speed = 0;
  play('thud', { pos: d.root.position, ref: 8, gain: .7 });
  G.deerBy = you ? 'you' : 'chris';
}
function stepDeer(dt) {
  const d = G.deer; if (!d || !d.root.visible) return;
  if (d.state === 'run') {
    const T = app.terrain, p = d.root.position;
    p.x += Math.sin(d.root.rotation.y) * d.speed * dt; p.z += Math.cos(d.root.rotation.y) * d.speed * dt;
    p.y = T.heightAt(p.x, p.z);
    d.run -= dt; if (d.run < 0) { d.state = 'stand'; d.speed = 0; }
    d.acc = (d.acc ?? 0) + d.speed * dt; if (d.acc > 1.4) { d.acc = 0; print(p.x, p.z, d.root.rotation.y + Math.PI, { who: 'deer', w: .6, d: .8 }); }
  }
  d.pose(dt, d.speed);
}

/* ---------- the game ---------- */
function setPhase(ph) { G.phase = ph; app.emit('pine:phase', ph); }

async function intro(P) {
  const T = app.terrain, sp = P.SPOTS, car = P.props.car;
  setHour(11.5); tod.playing = false; snowfall.amount = .35; tracks.fill = 0;
  clearTracks();
  person('paulie', ['pine', 'mess'], l => ['Paulie Gualtieri', l === 'mess' ? 'A night in a van, one shoe of carpet and wire.' : 'Coiffed and manicured this morning. He broke the Russian’s remote on purpose.']);
  person('chris', ['pine', 'cut'], l => ['Christopher Moltisanti', l === 'cut' ? 'The Russian caught him with the shovel.' : 'Hungry. He wanted breakfast at Roy Rogers.']);
  G.val = makeValery();
  G.chris = { p: person('chris', ['pine', 'cut']) };
  const grave = V(sp.grave.x, 0, sp.grave.z); grave.y = T.heightAt(grave.x, grave.z);
  await run(async s => {
    /* the car at the pull-off; Valery digs in the snow, Paulie and Christopher with their guns on him */
    stage('valery', { look: 'pine', pos: grave.clone().add(V(0, 0, -.8)), rot: Math.PI, pose: 'dig' });
    cast.valery.rig.props.shovel.visible = true;
    stage('paulie', { look: 'pine', pos: grave.clone().add(V(-1.8, 0, 2.6)), rot: Math.PI * .92, pose: 'aim', focus: () => cast.valery.rig.head.getWorldPosition(V()) });
    stage('chris', { look: 'pine', pos: grave.clone().add(V(1.9, 0, 2.2)), rot: Math.PI * 1.1, pose: 'aim', focus: () => cast.valery.rig.head.getWorldPosition(V()) });
    cast.paulie.rig.props.gun.visible = true; cast.chris.rig.props.gun.visible = true;
    const cp = car.position;
    s.cam(V(cp.x - 6, cp.y + 2.2, cp.z + 7), V(grave.x, grave.y + 1, grave.z), 0, { fov: 45 });
    s.cam(V(grave.x - 5, grave.y + 2.4, grave.z + 7.5), V(grave.x, grave.y + .9, grave.z), 5, { fov: 42 });
    s.note('9 January 2001, late morning. The woods off Seven Lakes Drive.', 4);
    await s.wait(2.5);
    s.say('Paulie', 'Dig.', 1.8);
    await s.wait(3);
    s.note('They thought he was dead. In the trunk he chewed through the duct tape.', 4);
    await s.wait(3.5);
    s.cam(V(grave.x + 3.4, grave.y + 1.5, grave.z + 3.2), V(grave.x, grave.y + 1.1, grave.z), 1.2, { fov: 38 });
    await s.wait(1.6);
    /* the shovel: Christopher's head, Paulie's groin, and he runs */
    cast.valery.pose = 'stand'; cast.valery.rig.armR.sh.rotation.set(-2.2, 0, -.4);
    play('shovel', { pos: grave, ref: 5, gain: 1 });
    stage('chris', { look: 'cut', pos: cast.chris.rig.root.position.clone(), rot: Math.PI * 1.1, pose: 'cold' });
    await s.wait(.5);
    play('thud', { pos: grave, ref: 5, gain: .8 });
    cast.paulie.pose = 'cold';
    s.say('Christopher', 'Ow! My head!', 1.6);
    await s.wait(.7);
    cast.valery.rig.props.shovel.visible = false;
    G.val.pos.copy(cast.valery.rig.root.position); G.val.heading = Math.PI + .4; G.val.state = 'flee'; G.val.speed = 4;
    s.follow(() => { const v = G.val.pos; return { pos: V(grave.x - 2, grave.y + 1.9, grave.z + 4), target: V(v.x, v.y + 1.2, v.z) }; });
    await s.wait(2.2);
  }, { skippable: true });
  /* hand the camera to Paulie, where he stood, looking where the Russian went */
  hide('paulie');
  const pr = V(grave.x - 1.8, 0, grave.z + 2.6);
  fps.enter({ mode: 'game', gun: true, pos: pr, yaw: Math.atan2(-(G.val.pos.x - pr.x), -(G.val.pos.z - pr.z)), pitch: -.02, walk: 1.8, run: 3.9, fov: 62, eye: 1.64 });
  if (G.val.state !== 'flee') { G.val.state = 'flee'; }
  stage('chris', { look: 'cut', pos: grave.clone().add(V(1.9, 0, 2.2)), rot: Math.PI });
  cast.chris.controlled = true; G.chris.heading = Math.PI;
  if (!cast.valery.visible) stage('valery', { look: 'pine', pos: G.val.pos, rot: G.val.heading });
  cast.valery.controlled = true;
}

async function trailEnds() {
  /* the tracks stop in the open: you stand at their end */
  hud.goal('Follow his tracks.', 'CHASE');
  await S.until(() => G.trailEnd && fps.pos.distanceTo(V(G.trailEnd.x, 0, G.trailEnd.z).setY(0).add(V(0, fps.pos.y, 0))) < 5 || app.time - G.goneAt > 45, 400);
  if (G.phase !== 'chase') return;
  S.note('His tracks end. No more prints, no more blood. Nothing.', 4);
  S.say('Christopher', 'Where’d he go?', 2.4);
  G.chris.p.rig.props.gun.visible = false;
  await S.wait(4.5);
  /* something moves in the trees ahead */
  const d = G.deer, f = fps.forward(V()); f.y = 0; f.normalize();
  const at = V(fps.pos.x + f.x * 24 + f.z * 6, 0, fps.pos.z + f.z * 24 - f.x * 6);
  d.root.position.set(at.x, app.terrain.heightAt(at.x, at.z), at.z); d.root.rotation.y = Math.atan2(f.x, f.z) + .9;
  d.root.visible = true; d.state = 'run'; d.speed = 7; d.run = 3.5;
  play('rustle', { pos: at, ref: 8, gain: 1 });
  S.say('Paulie', 'There!', 1.4);
  hud.goal('Something in the trees.', 'SHOOT');
  await S.wait(3.2);
  /* whoever hit it, they run to it, and the ground drops away */
  if (d.state !== 'dead') { killDeer(false); play('pistol-far', { pos: G.chris.p.rig.root.position, ref: 12 }); }
  await run(async s => {
    const c = app.camera, p0 = c.position.clone(), fwd = fps.forward(V()); fwd.y = 0; fwd.normalize();
    const slide = p0.clone().addScaledVector(fwd, 7); slide.y = app.terrain.heightAt(slide.x, slide.z) + .5;
    play('slide', { gain: 1 });
    s.cam(slide, slide.clone().addScaledVector(fwd, 5).add(V(0, -.6, 0)), 1.1);
    for (let i = 0; i < 16; i++) emit('dust', { x: p0.x + fwd.x * i * .4, y: p0.y - 1.4, z: p0.z + fwd.z * i * .4, vx: (Math.random() - .5) * 2, vy: 1 + Math.random(), vz: (Math.random() - .5) * 2, life: 1.2, s0: .2, s1: .9, a: .6, c: [.95, .96, .99], grav: 3 });
    await s.wait(1.4);
    G.shoe = false; G.shoeAt = slide.clone();
    s.say('Paulie', 'I lost my shoe!', 2.4);
    await s.wait(2.6);
    const dp = d.root.position;
    s.cam(slide.clone().add(V(0, .6, 0)), V(dp.x, dp.y + .5, dp.z), 1.4);
    s.note(G.deerBy === 'you' ? 'You shot a deer.' : 'Christopher shot a deer.', 3);
    await s.wait(3.2);
    fps.place(slide.x, slide.z, fps.yaw, -.05);
  });
  lost();
}

function lost() {
  setPhase('lost');
  G.lostStart = app.time;
  tod.playing = true; tod.speed = 1 / 55;
  snowfall.amount = .08; tracks.fill = .6;
  hud.show(['ammo', 'cold', 'phone', 'clock']); hud.ammo(G.ammo, G.mags);
  hud.goal('You are lost. Find shelter before dark. On high ground the phone might work: E, or tap CALL.', 'LOST');
  app.emit('use', 'CALL');
  S.note('Paulie cannot find the car. They are lost.', 3.6);
}

function phoneBars() {
  const y = app.terrain.heightAt(fps.pos.x, fps.pos.z);
  return clamp(Math.floor((y - 14) / 8), 0, 4);
}
async function call() {
  if (G.phase !== 'lost' || seq.running) return;
  const bars = phoneBars();
  if (bars < 1) { play('phonebeep', { gain: .7, rate: .7 }); play('phonebeep', { gain: .7, rate: .7, delay: .25 }); note('No signal down here. Try higher up.', 2.6); return; }
  G.calls++;
  if (G.called) { note('Tony does not pick up.', 2.4); return; }
  G.called = true;
  play('phonebeep', { gain: .8 });
  await run(async s => {
    stage('paulie', { look: 'mess', pos: fps.pos.clone(), rot: fps.yaw + Math.PI, pose: 'phone' });
    cast.paulie.rig.props.phone.visible = true;
    const c = app.camera.position.clone(), pp = fps.pos, f = fps.forward(V());
    s.cam(V(pp.x - f.x * 3 + f.z * 1.5, app.terrain.heightAt(pp.x, pp.z) + 1.8, pp.z - f.z * 3 - f.x * 1.5), V(pp.x, app.terrain.heightAt(pp.x, pp.z) + 1.5, pp.z), 1);
    await s.wait(1);
    s.say('Paulie', 'Tone? Can you hear me? We’re in the Pine Barrens. We’re lost.', 3.4); await s.wait(3.6);
    s.say('Tony', 'Slava says the guy was in the Interior Ministry. Killed sixteen Chechen rebels.', 3.6); play('static', { gain: .5 }); await s.wait(3.8);
    hide('paulie');
    s.say('Paulie', 'You’re not gonna believe this. He killed sixteen Czechoslovakians. The guy was an interior decorator.', 5); await s.wait(5.2);
    s.say('Christopher', 'His house looked like shit.', 2.6); await s.wait(2.8);
    s.say('Tony', 'Stay where you are. I’ll come when I can.', 3); play('static', { gain: .6 }); await s.wait(3.2);
    s.cam(c, c.clone().add(f), .6); await s.wait(.6);
  });
  hide('paulie');
  hud.goal('Find shelter before dark.', 'LOST');
}

function stepLost(dt) {
  const P = app.place, van = P.SPOTS.van;
  /* the cold: faster in one shoe, faster as the light goes */
  const rate = (G.shoe ? 1 / 700 : 1 / 330) * (1 + (tod.night ?? 0) * .8) * (fps.moving ? .8 : 1.15);
  G.cold = clamp(G.cold + rate * dt, 0, 1);
  hud.cold(G.cold); hud.phone(phoneBars()); hud.clock(clockText(tod.hour));
  app.exposureK = 1 - G.cold * .12;
  post.grade.uniforms.uVignette.value = .2 + G.cold * .55;
  /* one shoe: the other foot drags */
  if (!G.shoe) fps.opts.walk = 1.45, fps.opts.run = 2.9;
  const dv = Math.hypot(fps.pos.x - van.x, fps.pos.z - van.z);
  if (!G.hinted && (tod.hour > 16.6 || G.cold > .7) && dv > 40) {
    G.hinted = true;
    S.say('Christopher', 'Paulie! Down there. There’s something down there.', 3);
    G.chris.p.pose = 'point';
    hud.goal('Christopher saw something down in the hollow.', 'LOST');
  }
  if (dv < 9 || G.cold >= 1 || tod.hour > 17.6) { G.found = dv < 9; night(); }
}

async function night() {
  if (G.phase === 'night') return;
  setPhase('night'); tod.playing = false; hud.goal(null); app.emit('use', null);
  const P = app.place, van = P.props.van, vp = van.position;
  await waitFade(1, 4);
  fps.freeze(true);
  setHour(19.4); snowfall.amount = 0;
  stage('paulie', { look: 'mess', pos: vp.clone().add(V(-.4, 0, .4)), rot: van.rotation.y + Math.PI / 2, pose: 'cold', parent: null });
  stage('chris', { look: 'cut', pos: vp.clone().add(V(2.6, 0, 1.6)), rot: van.rotation.y, pose: 'cold' });
  hud.show([]);
  await run(async s => {
    s.cam(vp.clone().add(V(6, 2, 5)), vp.clone().add(V(0, 1, 0)), 0, { fov: 44 });
    await waitFade(0, 3);
    s.note(G.found ? 'An abandoned van in the hollow. A plumber’s van, out of the wind.' : 'Christopher found it: an abandoned van in the hollow.', 4);
    await s.wait(4);
    s.cam(vp.clone().add(V(1.2, 1.3, 2.4)), vp.clone().add(V(-.5, 1.2, -.2)), 3);
    s.note('Paulie rips up the van’s carpet to keep warm.', 3.6); play('rip', { pos: vp, ref: 5 }); await s.wait(3.8);
    s.note('Dinner: frozen ketchup and relish packets from an old Nathan’s bag, and Tic Tacs.', 4.2); play('packet', { pos: vp, ref: 4 }); await s.wait(4.4);
    s.note('Outside, Christopher tries to light a fire with sticks.', 3.4); await s.wait(3.6);
    s.note('They fight. Christopher pulls his gun on Paulie. Then he starts to laugh.', 4.4); await s.wait(4.6);
    s.say('Paulie', 'Promise me you won’t leave me.', 2.6); await s.wait(2.8);
  });
  await waitFade(1, 3);
  dawn();
}

async function dawn() {
  setPhase('dawn');
  const P = app.place, van = P.props.van, vp = van.position;
  setHour(7.35); tracks.fill = 0; snowfall.amount = 0; G.cold = Math.max(.35, G.cold * .8);
  hide('paulie');
  const start = vp.clone().add(V(-3, 0, 3));
  fps.place(start.x, start.z, Math.atan2(-(P.SPOTS.car.x - start.x), -(P.SPOTS.car.z - start.z)), -.05);
  fps.freeze(false);
  stage('chris', { look: 'cut', pos: start.clone().add(V(2, 0, 1)), rot: 0 }); cast.chris.controlled = true;
  await waitFade(0, 3);
  hud.show(['ammo', 'cold']); hud.ammo(G.ammo, G.mags); hud.cold(G.cold);
  S.note('Morning. They leave the van and walk.', 3.2);
  hud.goal('Walk out toward the road.', 'DAWN');
  const from = fps.pos.clone();
  await S.until(() => fps.pos.distanceTo(from) > 22, 120);
  /* the carpet shoe falls off */
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(.14, .08, .3), mat(0x7a7064, .95)); shoe.castShadow = true;
  const f = fps.forward(V()); f.y = 0; f.normalize();
  shoe.position.set(fps.pos.x + f.x * 2.2, 0, fps.pos.z + f.z * 2.2); shoe.position.y = app.terrain.heightAt(shoe.position.x, shoe.position.z) + .04;
  shoe.rotation.y = fps.yaw + .6; app.place.groups.near.add(shoe); G.dawnShoe = shoe; G.shoeShots = 0;
  S.note('The makeshift shoe falls off.', 2.8);
  hud.goal('Shoot the shoe.', 'DAWN');
  await S.until(() => (G.shoeShots ?? 0) >= 2, 60);
  S.note('Two shots in the morning quiet.', 2.4);
  await S.wait(2.4);
  S.say('Tony', 'Paulie! Chrissy!', 2.2);
  await S.wait(2.2);
  S.say('Paulie', 'Over here! Tony! Over here!', 2.4);
  /* Tony and Bobby come through the trees */
  person('tony', ['pine'], () => ['Tony Soprano', 'He drove down in the night with Bobby, and waited at the pull-off for first light.']);
  person('bobby', ['pine'], () => ['Bobby “Bacala” Baccalieri', 'Junior’s man, a skilled outdoorsman. He came in full hunting gear, and Tony laughed at him.']);
  const f2 = fps.forward(V()); f2.y = 0; f2.normalize();
  const tAt = V(fps.pos.x + f2.x * 30 - f2.z * 6, 0, fps.pos.z + f2.z * 30 + f2.x * 6);
  stage('tony', { look: 'pine', pos: tAt, rot: Math.atan2(-f2.x, -f2.z), focus: () => app.camera.position });
  stage('bobby', { look: 'pine', pos: tAt.clone().add(V(-f2.z * 2, 0, f2.x * 2)), rot: Math.atan2(-f2.x, -f2.z), focus: () => app.camera.position });
  cast.bobby.rig.props.rifle.visible = true;
  const meet = V(fps.pos.x + f2.x * 3.2, 0, fps.pos.z + f2.z * 3.2);
  walkTo('tony', [meet], 1.6); walkTo('bobby', [meet.clone().add(V(-f2.z * 1.6, 0, f2.x * 1.6))], 1.5);
  hud.goal(null); hud.show([]);
  await S.wait(8);
  await run(async s => {
    /* they have reached you: Tony and Bobby at the meeting place, facing you, seen from just behind you */
    const you = fps.pos.clone(), sd2 = V(-f2.z, 0, f2.x);
    /* Bobby on either side of Tony, the camera at one of four spots: the first set with no trunk in a sightline */
    const trunks = app.place.forest.near(meet.x, meet.z, 14).filter(t => t.kind !== 'beech' && t.kind !== 'sapling' && t.kind !== 'laurel');
    const inWay = (a, b) => trunks.some(t => { const dx = b.x - a.x, dz = b.z - a.z, k = Math.max(0, Math.min(1, ((t.x - a.x) * dx + (t.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(t.x - a.x - k * dx, t.z - a.z - k * dz) < t.r + .4; });
    let pick = null;
    for (const bs of [1.6, -1.6]) for (const cs of [-1.4, 1.4, -2.4, 2.4]) {
      const bm = meet.clone().addScaledVector(sd2, bs), eye = you.clone().addScaledVector(sd2, cs).addScaledVector(f2, -1.2);
      const cost = (inWay(eye, meet) ? 2 : 0) + (inWay(eye, bm) ? 2 : 0) + (inWay(eye, meet.clone().addScaledVector(sd2, bs / 2)) ? 1 : 0);
      if (!pick || cost < pick.cost) pick = { cost, bm, eye, bs };
    }
    const { bm, eye } = pick, aim = meet.clone().addScaledVector(sd2, pick.bs / 2);
    stage('tony', { look: 'pine', pos: meet, rot: Math.atan2(you.x - meet.x, you.z - meet.z), focus: () => app.camera.position });
    stage('bobby', { look: 'pine', pos: bm, rot: Math.atan2(you.x - bm.x, you.z - bm.z), focus: () => app.camera.position });
    cast.bobby.rig.props.rifle.visible = true;
    eye.y = app.terrain.heightAt(eye.x, eye.z) + 1.75; aim.y = app.terrain.heightAt(aim.x, aim.z) + 1.35;
    s.cam(eye, aim, 1.2, { fov: 42 });
    s.note('Tony and Bobby answer the shots. Bobby is in full hunting gear.', 3.6); await s.wait(3.8);
    s.note('Paulie’s car is gone, and Silvio’s five thousand dollars with it.', 3.8); await s.wait(4);
    s.say('Tony', 'Where’s the Russian?', 2.2); await s.wait(2.4);
    /* up at the pull-off: Tony's Suburban where Paulie's car stood, with food and drinks in it */
    const pr = app.place.props, car = pr.car;
    if (!pr.sub) {
      pr.sub = pr.suburban(); pr.sub.position.copy(car.position); pr.sub.rotation.copy(car.rotation);
      pr.sub.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      car.parent.add(pr.sub);
    }
    car.visible = false; pr.sub.visible = true;
    const c = car.position, a = car.rotation.y, fw = V(Math.cos(a), 0, -Math.sin(a)), sd = V(Math.sin(a), 0, Math.cos(a)), w2 = pr.sub.userData.W / 2;
    const at = (f, x) => { const p = c.clone().addScaledVector(fw, f).addScaledVector(sd, x); p.y = app.terrain.heightAt(p.x, p.z); return p; };
    const door = at(.9, w2);
    for (const [k, look, f, x, pose] of [['tony', 'pine', .9, w2 + .7, 'stand'], ['bobby', 'pine', -1.9, w2 + .9, 'stand'], ['paulie', 'mess', -.3, w2 + 2.4, 'cold'], ['chris', 'cut', -1.3, w2 + 3.1, 'cold']]) {
      const p = at(f, x); stage(k, { look, pos: p, rot: Math.atan2(door.x - p.x, door.z - p.z), pose });
    }
    cast.bobby.rig.props.rifle.visible = true;
    s.cam(at(7.5, 6.5).add(V(0, 1.7, 0)), at(-.5, w2 + 1).add(V(0, 1.1, 0)), 0, { fov: 44 });
    s.note('Tony’s Suburban at the pull-off, with food and drinks in it.', 3.6); await s.wait(3.8);
  });
  finish();
}

async function finish() {
  setPhase('end');
  fps.exit(true);
  hud.hide(); app.emit('use', null);
  const P = app.place, sp = P.SPOTS;
  for (const k of ['valery', 'chris', 'tony', 'bobby', 'paulie']) hide(k);
  /* the morning of the story again: Paulie's car at the pull-off */
  P.props.car.visible = true; if (P.props.sub) P.props.sub.visible = false;
  if (G.dawnShoe) { G.dawnShoe.removeFromParent(); G.dawnShoe = null; }
  await waitFade(1, 3);
  tod.playing = false; setHour(P.P.hour);
  post.grade.uniforms.uVignette.value = .2; app.exposureK = 1;
  const d = byId.pine;
  titleCard(d, 'Valery was never found.');
  const shots = G.shots, lines = [`Shots fired: ${shots}.`, G.hit ? 'You hit him in the head. He got up and ran.' : 'You never hit him.', G.found ? 'You found the van yourself.' : 'Christopher found the van.'];
  setTimeout(() => note(lines.join(' '), 6), 1200);
  setTimeout(() => caption('Who cares about some Russian?', { who: 'David Chase', dur: 5 }), 7500);
  app.emit('game', false);
  app.mode = 'orbit'; app.controls.enabled = true;
  await waitFade(0, 3);
  G.phase = 'idle'; app.emit('act');
}

export function buildGame(place) {
  vm = buildViewmodel();
  app.on('walk:unlock', () => { if (app.place === place && app.mode === 'game' && !app.touch && !seq.running) { G.paused = true; note('Paused. Click to go on.', 2.5); } });
  app.on('walk:lock', () => { G.paused = false; });
  G.deer = makeDeer(); G.deer.root.visible = false; place.groups.near.add(G.deer.root);
  app.onUpdate(dt => {
    if (app.place !== place) return;
    updateViewmodel(dt);
    if (G.phase === 'idle' || G.phase === 'end') return;
    /* with the mouse let go (Esc), the woods wait for you */
    if (G.paused) return;
    if (G.phase === 'chase' && !seq.running) stepValery(dt);
    if ((G.phase === 'chase' || G.phase === 'lost' || G.phase === 'dawn') && !seq.running) stepChris(dt);
    stepDeer(dt);
    if (G.phase === 'lost' && !seq.running) stepLost(dt);
    /* your own prints in the snow */
    if (fps.on && fps.moving && !seq.running) {
      G.myAcc = (G.myAcc ?? 0) + fps.speed * dt;
      if (G.myAcc > .74) { G.myAcc = 0; G.myFoot = -(G.myFoot ?? 1); const y = fps.yaw; print(fps.pos.x + Math.cos(y) * .13 * G.myFoot, fps.pos.z - Math.sin(y) * .13 * G.myFoot, y, { who: 'you', d: .8, w: G.shoe || G.myFoot > 0 ? 1 : 1.2 }); }
    }
    /* breath in the cold: yours, so not in a cutscene, where the camera is not your eyes */
    G.breathT = (G.breathT ?? 0) - dt;
    if (G.breathT < 0 && fps.on && !seq.running) {
      G.breathT = fps.running ? 1.1 : 2.4;
      const c = app.camera.position, f = fps.forward(tmpV);
      emit('dust', { x: c.x + f.x * .5, y: c.y - .16, z: c.z + f.z * .5, vx: f.x * .5, vy: .12, vz: f.z * .5, life: 1.2, s0: .04, s1: .28, a: .1, c: [.9, .92, .95], drag: 1.5 });
    }
  }, 30);
  return {
    label: () => G.phase === 'idle' ? 'CHASE HIM' : 'STOP',
    title: () => G.phase === 'idle' ? 'Chase the Russian (Space)' : 'Stop the game',
    busy: () => G.phase !== 'idle',
    async run() {
      if (G.phase !== 'idle') return;
      Object.assign(G, { phase: 'intro', ammo: 8, mags: 2, shots: 0, hit: false, trailEnd: null, cold: 0, shoe: true, called: false, calls: 0, found: false, hinted: false, events: [], deerBy: null, goneAt: 0, hitAt: 0 });
      G.deer.root.visible = false; G.deer.state = 'stand'; G.deer.fall = 0;
      app.emit('game', true); app.emit('act');
      fps.onFire = fire; fps.onUse = () => { if (G.phase === 'lost') call(); };
      await intro(place);
      setPhase('chase'); G.chaseStart = app.time;
      hud.show(['ammo']); hud.ammo(G.ammo, G.mags);
      app.emit('act');
      trailEnds();
    },
    stop() { if (G.phase === 'idle') return; clearCaptions(); clearChoice(); finish(); },
    pause() { if (fps.on && app.walkLocked) document.exitPointerLock?.(); },
    state: G,
  };
}
