import * as THREE from 'three';
import { app } from '../app.js';
import { fps } from '../ctrl/fps.js';
import { post } from '../fx/post.js';
import { run, seq } from '../seq.js';
import { hud } from '../ui/hud.js';
import { caption, note, clearCaptions } from '../ui/captions.js';
import { person, stage, hide, walkTo, cast } from '../cast/people.js';
import { emit } from '../fx/particles.js';
import { setHour } from '../world/lighting.js';
import { playV } from '../audio.js';
import { waitFade, titleCard, byId } from '../scenes.js';
import { jumpTo } from '../ctrl/camera.js';
import { rbox, box, mat, damp } from '../lib/util.js';
import { SHOP } from './layout.js';

/* "It happens". You are Christopher, on an errand for Tony: pastry for the guys. Take a number and wait; the counter
   serves the others. Gino comes back from the gas station and gets served first. Walk him out, turn the sign to
   CLOSED; then the box, at gunpoint, and a shot past Doug's head whenever he stops. The last shot is his foot. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const G = { phase: 'idle', ticket: 0, serving: 0, seated: false, prompt: null, box: 0, picks: [], dougBusy: false, stall: 0, stalled: false, shots: 0, t: 0 };
const CZ = SHOP.counterZ;
const DOOR_IN = V(0, 0, -.5), DOOR_OUT = V(0, 0, 1.2);
const PEOPLE = ['doug', 'oldman', 'lady', 'gino', 'chris'];

/* ---------- Christopher's hand ---------- */
let vm = null;
function buildHands() {
  const g = new THREE.Group(); g.userData.vm = true; g.visible = false;
  const lea = new THREE.MeshStandardMaterial({ color: 0x131212, roughness: .4 }), sk = mat(0xd7a47f, .7), silver = mat(0xc4c8cc, .25, 1);
  const R = new THREE.Group(); R.position.set(.2, -.25, -.45); g.add(R);
  rbox(R, .07, .07, .1, .03, sk, 0, 0, 0); rbox(R, .11, .11, .32, .045, lea, .01, -.03, .2);
  const gun = new THREE.Group(); gun.position.set(0, .04, -.05); R.add(gun);
  box(gun, .026, .042, .14, silver, 0, .01, -.04); box(gun, .024, .07, .03, mat(0x2a2a2c, .5, .3), 0, -.035, .03); box(gun, .006, .01, .01, silver, 0, .036, -.1);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(.1, .1), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.position.set(0, .01, -.13); gun.add(flash);
  post.vm.scene.add(g);
  return { g, R, gun, flash, kick: 0, flashT: 0, aim: 0 };
}
function hands(dt) {
  if (!vm) return;
  const on = fps.on && app.mode === 'game' && !seq.running && G.phase !== 'idle';
  vm.g.visible = on; if (!on) { vm.flashT = 0; vm.kick = 0; return; }
  vm.gun.visible = G.phase === 'box';
  vm.kick = Math.max(0, vm.kick - dt * 7); vm.flashT = Math.max(0, vm.flashT - dt);
  vm.aim = damp(vm.aim, G.phase === 'box' ? 1 : 0, 6, dt);
  vm.R.position.set(.2 - .06 * vm.aim, -.25 + .06 * vm.aim, -.45 - .04 * vm.aim + vm.kick * .05);
  vm.R.rotation.x = vm.kick * .35;
  vm.flash.material.opacity = vm.flashT > 0 ? 1 : 0; vm.flash.rotation.z = Math.random() * 6;
}

/* ---------- the people in the shop ---------- */
function setShop(place) {
  const S = place.shop;
  for (const k of PEOPLE) hide(k);
  S.sign.rotation.y = 0; S.door.rotation.y = 0;
  for (const s of Object.values(S.slots)) s.g.children.forEach(c => { c.visible = true; });
  if (place.box) place.box.removeFromParent();
  place.box = null;
  stage('doug', { look: 'bakery', pos: V(-.4, 0, CZ - .7), rot: 0, pose: 'stand' });
}
/* walk someone through the door: it opens as they reach it, closes behind them */
function through(place, key, pts, speed, done) {
  walkTo(key, pts, speed, done);
  playV('bell', { pos: V(0, 2.2, -.1), ref: 4, gain: .7 });
}

/* ---------- the pastry, the box ---------- */
const KIND = { sfogliatelle: 'sfogliatelle', sfogliatelle2: 'sfogliatelle', sfogliatelle3: 'sfogliatelle', cannoli: 'cannoli', cannoli2: 'cannoli', cookies: 'cookies', cookies2: 'cookies', rainbow: 'rainbow cookies' };
function aimed(place) {
  const c = app.camera.position, f = fps.forward(V());
  let best = null, ba = .16;
  for (const [k, s] of Object.entries(place.shop.slots)) {
    if (!s.g.children.some(o => o.visible)) continue;
    const a = s.at.clone().sub(c).normalize().angleTo(f);
    if (a < ba) { ba = a; best = k; }
  }
  return best;
}
function makeBox(place) {
  const b = new THREE.Group(); b.position.set(.35, 1.03, CZ - .05); place.shop.ins.add(b);
  const w = mat(0xf6f4ee, .8);
  box(b, .34, .012, .26, w, 0, .006, 0); for (const [x, z, sx, sz] of [[-.17, 0, .012, .26], [.17, 0, .012, .26], [0, -.13, .34, .012], [0, .13, .34, .012]]) box(b, sx, .12, sz, w, x, .06, z);
  const lid = new THREE.Group(); lid.position.set(0, .12, -.13); b.add(lid); box(lid, .34, .012, .26, w, 0, 0, .13); lid.rotation.x = -1.9; b.userData.lid = lid;
  b.userData.inside = new THREE.Group(); b.add(b.userData.inside);
  place.box = b; return b;
}
async function pick(place, key) {
  if (G.dougBusy || G.box >= 4) return;
  G.dougBusy = true; G.picks.push(KIND[key]);
  const s = place.shop.slots[key], d = cast.doug;
  const to = V(s.at.x, 0, CZ - .6), toBox = V(.35, 0, CZ - .6);
  walkTo('doug', [to], G.stalled ? 1.2 : 2.0, null, V(s.at.x, 1, CZ));
  await until(() => !d.walker, 8);
  stage('doug', { look: 'bakery', pos: d.rig.root.position.clone(), rot: 0, pose: 'serve' });
  await wait(.7);
  /* a row of four off the tray */
  const row = s.g.children.find(o => o.visible); if (row) row.visible = false;
  playV('tray', { pos: s.at, ref: 3, gain: .4 });
  walkTo('doug', [toBox], G.stalled ? 1.2 : 2.0, null, V(.35, 1, CZ));
  await until(() => !d.walker, 8);
  stage('doug', { look: 'bakery', pos: d.rig.root.position.clone(), rot: 0, pose: 'serve' });
  await wait(.5);
  const inside = place.box.userData.inside, m = mat([0xd9a45a, 0xf3ead6, 0xe9a0b4, 0x6aa35a][G.box % 4], .7);
  for (let i = 0; i < 4; i++) box(inside, .07, .03, .05, m, -.12 + i * .08, .03 + G.box * .018, -.06 + (G.box % 2) * .1);
  G.box++; G.dougBusy = false;
  stage('doug', { look: 'bakery', pos: d.rig.root.position.clone(), rot: 0, pose: 'hands_up' });
  note(`${G.picks[G.picks.length - 1][0].toUpperCase() + G.picks[G.picks.length - 1].slice(1)}, into the box.`, 1.8);
  /* now and then he freezes, until a shot goes past his head */
  if (G.box < 4 && Math.random() < .6) { G.stalled = true; G.stall = 0; note('He stops, hands up, shaking.', 2.2); }
  else G.stalled = false;
  if (G.box >= 4) { place.box.userData.lid.rotation.x = 0; playV('boxfold', { pos: V(.35, 1.1, CZ), ref: 3, gain: .6 }); G.footAt = app.time + 1.2; }
}
let clock = 0;
const waits = [];
function wait(s) { return new Promise(r => waits.push({ t: clock + s, r })); }
function until(p, max = 30) { return new Promise(r => waits.push({ t: clock + max, p, r })); }

function shoot(place) {
  if (G.phase !== 'box' || seq.running) return;
  vm.kick = 1; vm.flashT = .06; G.shots++;
  playV('pistol', { gain: .9 });
  const c = app.camera.position, f = fps.forward(V()), d = cast.doug, head = d.rig.head.getWorldPosition(V());
  /* where it goes: never into him; past his head, into the cabinet behind him */
  const t = Math.max(0, head.clone().sub(c).dot(f)), q = c.clone().addScaledVector(f, t), off = q.distanceTo(head);
  const near = off < 1.4 && t > .5;
  const hit = near ? head.clone().add(q.clone().sub(head).setLength(Math.max(.35, off))).setZ(SHOP.z0 + .55) : c.clone().addScaledVector(f, 5);
  for (let i = 0; i < 16; i++) emit('dust', { x: hit.x, y: hit.y, z: hit.z, vx: (Math.random() - .5) * 2.5, vy: Math.random() * 2, vz: 1 + Math.random() * 2, life: .9, s0: .02, s1: .06, a: .9, c: [[.85, .65, .35], [.95, .92, .85], [.9, .6, .7]][i % 3], grav: 7 });
  if (near) {
    playV('glass', { pos: hit, ref: 4, gain: .7 });
    if (G.stalled) { G.stalled = false; note('He moves.', 1.4); }
  }
}

/* ---------- the moment ---------- */
async function intro(place) {
  G.phase = 'intro';
  await run(async S => {
    await waitFade(1, 5);
    setHour(14.5); setShop(place);
    stage('oldman', { look: 'bakery', pos: V(-.7, 0, CZ + 1.0), rot: Math.PI, pose: 'stand' });
    stage('lady', { look: 'bakery', pos: V(1.5, 0, CZ + 1.9), rot: Math.PI * 1.1, pose: 'stand' });
    S.cam(V(9.5, 1.6, 18.5), V(0, 2, 0), 0, { fov: 40 });
    await waitFade(0, 2);
    titleCard(byId.bakery, 'North Arlington, New Jersey. 1998.');
    note('Christopher is on an errand for Tony: pastry for the guys.', 4.5);
    S.cam(V(4.5, 1.6, 7.5), V(0, 1.6, 0), 5, { fov: 42 });
    await S.wait(5.2);
    await waitFade(1, 4);
  });
  G.phase = 'number';
  fps.enter({ mode: 'game', pos: V(.1, 0, -.9), yaw: 0, pitch: -.1, walk: 1.3, run: 2.2, eye: 1.68, fov: 64 });
  fps.onFire = () => shoot(place);
  fps.onUse = () => use(place);
  await waitFade(0, 3);
  hud.goal('Take a number from the machine on the counter: E, or tap TAKE.', 'IT HAPPENS');
}
function use(place) {
  if (seq.running) return;
  if (G.prompt === 'ticket') { G.ticket = 58; G.serving = 55; G.prompt = null; app.emit('use', null); playV('ticket', { gain: .6 }); note('Number 58. Now serving 55.', 3); hud.goal('Wait your turn. The ledge by the door is a seat: E, or tap SIT.', 'IT HAPPENS'); G.phase = 'wait'; G.t = 0; return; }
  if (G.prompt === 'sit') { G.seated = true; G.prompt = null; fps.place(1.9, -.62, .15, -.12); fps.eye = 1.05; app.emit('use', null); return; }
  if (G.prompt === 'gino') { walkGinoOut(place); return; }
  if (G.prompt === 'sign') { turnSign(place); return; }
  if (G.phase === 'box') { const k = aimed(place); if (k) pick(place, k); else note('Point at the pastry you want.', 1.5); }
}
async function queue(place) {
  /* the older man gets his bag and goes; the lady is served; Gino comes back in */
  const d = cast.doug;
  G.q = 'oldman';
  stage('doug', { look: 'bakery', pos: V(-.7, 0, CZ - .7), rot: 0, pose: 'serve' });
  await wait(3);
  playV('bag', { pos: V(-.7, 1.1, CZ), ref: 3, gain: .6 }); playV('register', { pos: V(-.95, 1.1, CZ), ref: 3, gain: .5, delay: 1 });
  cast.oldman.rig.props.bag.visible = true;
  await wait(2);
  through(place, 'oldman', [V(-.4, 0, -1.6), DOOR_IN, DOOR_OUT, V(12, 0, 2.6)], 1.2, () => hide('oldman'));
  G.serving = 56; await wait(1.5); note('Now serving 56.', 2.4);
  stage('doug', { look: 'bakery', pos: V(.9, 0, CZ - .7), rot: 0, pose: 'stand' });
  walkTo('lady', [V(.9, 0, CZ + 1.0)], 1.1, null, V(.9, 1, CZ));
  await until(() => !cast.lady.walker, 8);
  stage('doug', { look: 'bakery', pos: V(.9, 0, CZ - .7), rot: 0, pose: 'serve' });
  await wait(4);
  cast.lady.rig.props.bag.visible = true; playV('bag', { pos: V(.9, 1.1, CZ), ref: 3, gain: .6 }); playV('register', { pos: V(-.95, 1.1, CZ), ref: 3, gain: .5, delay: .8 });
  await wait(1.5);
  through(place, 'lady', [V(.5, 0, -1.8), DOOR_IN, DOOR_OUT, V(-14, 0, 2.4)], 1.2, () => hide('lady'));
  await wait(3);
  /* Gino, back from putting gas in his car */
  stage('gino', { look: 'bakery', pos: V(10, 0, 2.6), rot: -Math.PI / 2, pose: 'stand' });
  through(place, 'gino', [V(2, 0, 2.2), DOOR_OUT, DOOR_IN, V(-.6, 0, CZ + 1.0)], 1.25);
  await until(() => !cast.gino.walker, 20);
  note('Gino, a regular, comes back in. He was in line before and went out to put gas in his car.', 4.5);
  stage('doug', { look: 'bakery', pos: V(-.6, 0, CZ - .7), rot: 0, pose: 'stand' });
  await wait(2.5);
  note('Doug serves him first: his usual, two Neapolitan loaves.', 3.5);
  walkTo('doug', [V(2.7, 0, -6.4)], 1.5);
  await until(() => !d.walker, 8); await wait(.8);
  d.rig.props.bag.visible = false;
  walkTo('doug', [V(-.6, 0, CZ - .7)], 1.5, null, V(-.6, 1, CZ + 1));
  await until(() => !d.walker, 8);
  cast.gino.rig.props.bread.visible = true;
  G.phase = 'snap';
}
async function snap(place) {
  G.phase = 'snap-cut';
  await run(async S => {
    const c = app.camera.position.clone();
    S.cam(c, V(-.6, 1.5, CZ + .6), 1, { fov: 60 });
    await S.wait(1.2);
    note('Christopher says something crude about the cashier’s sister.', 3.2);
    await S.wait(3.4);
    note('Gino offers to let him go first. Doug says no: not with that attitude.', 4);
    await S.wait(4.4);
  });
  if (G.seated) { G.seated = false; fps.eye = 1.68; fps.place(1.9, -.95, .15, -.08); }
  G.phase = 'gino';
  hud.goal('Walk Gino out: E next to him, or tap WALK OUT.', 'IT HAPPENS');
}
async function walkGinoOut(place) {
  G.prompt = null; app.emit('use', null); hud.goal(null);
  G.phase = 'out-cut';
  await run(async S => {
    fps.place(-.2, -2.6, Math.PI * .92, -.08);
    stage('gino', { look: 'bakery', pos: cast.gino.rig.root.position.clone(), rot: 0, pose: 'stand' }); cast.gino.rig.props.bread.visible = false;
    through(place, 'gino', [V(-.3, 0, -1.4), DOOR_IN, DOOR_OUT, V(1.2, 0, 2.4)], 1.1, null);
    S.follow(() => ({ pos: V(-.4, 1.68, -2.9), target: cast.gino.rig.root.position.clone().add(V(0, 1.4, 0)) }));
    await S.wait(3.4);
    caption('What about my bread?', { who: 'Gino', dur: 2.8 });
    await S.wait(2.6);
    note('Christopher tells him to come back in ten minutes.', 3);
    await S.wait(3);
    S.stopFollow();
    stage('gino', { look: 'bakery', pos: V(1.2, 0, 2.4), rot: Math.PI, pose: 'stand' });
  });
  G.phase = 'sign';
  hud.goal('Turn the sign on the door to CLOSED: E, or tap CLOSED.', 'IT HAPPENS');
}
function turnSign(place) {
  G.prompt = null; app.emit('use', null);
  place.shop.sign.userData.flip = 1; playV('door', { gain: .5 });
  note('CLOSED.', 1.6);
  G.phase = 'gun'; G.gunAt = clock + 1.4;
}
async function gun(place) {
  G.phase = 'box'; G.box = 0; G.picks = []; G.stalled = false;
  makeBox(place); playV('boxfold', { pos: V(.35, 1.1, CZ), ref: 3, gain: .6 });
  stage('doug', { look: 'bakery', pos: V(.35, 0, CZ - .7), rot: 0, pose: 'hands_up' });
  fps.opts.gun = true; app.emit('fps', { on: true, mode: 'game', gun: true });
  document.getElementById('fire').textContent = 'FIRE';
  note('The gun comes out. He makes Doug fill a box.', 3);
  hud.goal('Point at the pastry you want: E, or tap THAT ONE, and he boxes it. When he stops, a shot past his head: click, or tap FIRE.', 'IT HAPPENS');
  app.emit('use', 'THAT ONE');
}
async function foot(place) {
  G.phase = 'foot';
  hud.goal(null); app.emit('use', null);
  await run(async S => {
    const d = cast.doug, dp = d.rig.root.position.clone();
    stage('doug', { look: 'bakery', pos: dp, rot: 0, pose: 'stand' });
    person('chris', ['bakery']);
    stage('chris', { look: 'bakery', pos: V(.4, 0, -2.8), rot: Math.PI, pose: 'aim' });
    cast.chris.rig.props.pistol.visible = true;
    S.cam(V(-1.4, 1.2, -2.2), V(.2, .6, CZ - .4), 0, { fov: 48 });
    await S.wait(1.2);
    playV('pistol', { gain: 1 }); vm.flashT = 0;
    for (let i = 0; i < 10; i++) emit('dust', { x: dp.x - .1, y: .05, z: dp.z + .1, vx: (Math.random() - .5), vy: Math.random() * 1.2, vz: (Math.random() - .5), life: .6, s0: .02, s1: .08, a: .8, c: [.8, .78, .74], grav: 6 });
    stage('doug', { look: 'bakery', pos: dp, rot: 0, pose: 'hop' });
    note('Then he shoots Doug in the foot.', 2.8);
    await S.wait(1.4);
    note('Doug cries out.', 2);
    await S.wait(1.6);
    S.cam(V(.05, 1.58, -3.95), V(.4, 1.62, -2.8), 0, { fov: 46 });
    caption('It happens.', { who: 'Christopher', dur: 2.8 });
    await S.wait(2.6);
    /* out with the box, without paying */
    cast.chris.rig.props.pistol.visible = false; cast.chris.rig.props.box.visible = true;
    if (place.box) place.box.visible = false;
    stage('chris', { look: 'bakery', pos: V(.4, 0, -2.8), rot: Math.PI, pose: 'stand' });
    cast.chris.rig.props.box.visible = true;
    through(place, 'chris', [V(.2, 0, -1.4), DOOR_IN, DOOR_OUT, V(-9, 0, 2.6)], 1.3);
    S.cam(V(6.5, 1.5, 7.5), V(0, 1.3, 1.2), 0, { fov: 40 });
    await S.wait(5.5);
    await waitFade(1, 3);
    note('Doug went to hospital and lost a toe. The police are looking for the man who did it.', 5);
    await S.wait(4.5);
    caption('…because you had to wait for buns.', { who: 'Tony', dur: 4 });
    await S.wait(4.5);
  });
  finish(place);
}
async function finish(place) {
  if (G.phase === 'idle' || G.phase === 'end') return;
  G.phase = 'end';
  clearCaptions(); hud.goal(null); app.emit('use', null);
  await waitFade(1, 3);
  if (fps.on) fps.exit(true);
  setShop(place); setHour(place.P.hour);
  place.shop.sign.userData.flip = 0; place.shop.sign.rotation.y = 0;
  app.emit('game', false);
  app.mode = 'orbit'; app.controls.enabled = true;
  jumpTo(place.startView);
  await waitFade(0, 3);
  G.phase = 'idle'; app.emit('act');
}

export function buildBakeryMoment(place) {
  vm = buildHands();
  person('doug', ['bakery']); person('oldman', ['bakery']); person('lady', ['bakery']); person('gino', ['bakery']); person('chris', ['bakery']);
  place.people = new THREE.Group(); place.people.name = 'people'; place.groups.near.add(place.people);
  app.onUpdate(dt => {
    if (app.place !== place) return;
    clock += dt;
    for (const w of waits.slice()) if (clock >= w.t || (w.p && w.p())) { waits.splice(waits.indexOf(w), 1); w.r(); }
    hands(dt);
    /* the sign turns over when it is flipped; the door swings open for whoever is at it */
    const sg = place.shop.sign; sg.rotation.y = damp(sg.rotation.y, (sg.userData.flip ?? 0) * Math.PI, 8, dt);
    let atDoor = fps.on && Math.abs(fps.pos.x) < .8 && fps.pos.z > -1.3 && fps.pos.z < 1.1 && G.phase !== 'box';
    for (const k of PEOPLE) { const c = cast[k]; if (c?.visible && c.rig) { const q = c.rig.root.position; if (Math.abs(q.x) < .9 && q.z > -1.3 && q.z < 1.1) atDoor = true; } }
    const dr = place.shop.door; dr.rotation.y = damp(dr.rotation.y, atDoor ? -1.3 : 0, 6, dt);
    if (G.phase === 'idle' || G.phase === 'end' || seq.running) return;
    const p = fps.pos;
    const setPrompt = (k, label) => { if (G.prompt !== k) { G.prompt = k; app.emit('use', label); } };
    const clear = k => { if (G.prompt === k) { G.prompt = null; app.emit('use', null); } };
    if (G.phase === 'number') { if (Math.hypot(p.x - 2.55, p.z - (CZ + .75)) < 1.3) setPrompt('ticket', 'TAKE'); else clear('ticket'); }
    if (G.phase === 'wait') {
      if (!G.queueOn) { G.queueOn = true; queue(place); }
      if (!G.seated) { if (Math.hypot(p.x - 1.9, p.z + .8) < 1.2) setPrompt('sit', 'SIT'); else clear('sit'); }
      if (G.seated && fps.moving) { G.seated = false; fps.eye = 1.68; }
    }
    if (G.phase === 'snap') { snap(place); return; }
    if (G.phase === 'gino') { const g = cast.gino.rig.root.position; if (Math.hypot(p.x - g.x, p.z - g.z) < 1.6) setPrompt('gino', 'WALK OUT'); else clear('gino'); }
    if (G.phase === 'sign') { if (Math.hypot(p.x, p.z + .5) < 1.4) setPrompt('sign', 'CLOSED'); else clear('sign'); }
    if (G.phase === 'gun' && clock > G.gunAt) { gun(place); return; }
    if (G.phase === 'box') {
      if (G.footAt && clock > G.footAt) { G.footAt = 0; foot(place); return; }
      if (G.stalled) { G.stall += dt; if (G.stall > 6) { G.stalled = false; note('He moves.', 1.4); } }
    }
  }, 33);

  return {
    label: () => G.phase === 'idle' ? 'TAKE A NUMBER' : 'STOP',
    title: () => G.phase === 'idle' ? 'Play the bakery (Space)' : 'Stop the scene',
    busy: () => G.phase !== 'idle',
    async run() {
      if (G.phase !== 'idle') return;
      Object.assign(G, { ticket: 0, serving: 0, seated: false, prompt: null, box: 0, picks: [], dougBusy: false, stall: 0, stalled: false, shots: 0, queueOn: false, footAt: 0, gunAt: 0 });
      app.emit('game', true); app.emit('act');
      await intro(place);
      app.emit('act');
    },
    stop() { finish(place); },
    pause() { if (fps.on && app.walkLocked) document.exitPointerLock?.(); },
    state: G,
  };
}
