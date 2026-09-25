import * as THREE from 'three';
import { app } from '../app.js';
import { fps } from '../ctrl/fps.js';
import { post } from '../fx/post.js';
import { run, seq } from '../seq.js';
import { hud } from '../ui/hud.js';
import { caption, note, clearCaptions } from '../ui/captions.js';
import { person, stage, hide, walkTo, react, cast } from '../cast/people.js';
import { emit } from '../fx/particles.js';
import { setHour } from '../world/lighting.js';
import { playV, slice, loop } from '../audio.js';
import { waitFade, titleCard, byId } from '../scenes.js';
import { jumpTo } from '../ctrl/camera.js';
import { rbox, box, cyl, mat, clamp, damp, lerp, smooth } from '../lib/util.js';
import { Flock } from './duck3d.js';
import { DECK } from './yard.js';

/* The ducks. You are Tony, June 1998. The paper at the bottom of the drive in your robe; round the back, the
   mallards in the pool: bread for them, then into the water with them, the robe floating out. Weeks later, AJ's
   birthday: the grill, the lighter fluid, and the ducks go, all of them, over the trees. He cannot breathe; he
   falls; the fluid goes into the grill and it bursts into flame. The last shot is the empty pool. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WATER = DECK - .13;
const G = { phase: 'idle', thrown: 0, eaten: 0, handT: 0, squirt: 0, lit: false, prompt: null, paper: false, last: null, fire: 0, flying: [], vmForce: false };
const PEOPLE = ['carmela', 'meadow', 'aj', 'phil', 'chris', 'guest1', 'guest2', 'guest3', 'kid1', 'kid2'];
const STEPS = { x: -1.0, z: 5.65 };

/* ---------- Tony's hands ---------- */
let vm = null;
function buildHands() {
  const g = new THREE.Group(); g.userData.vm = true; g.visible = false;
  const satin = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: .38, metalness: .05 }), sk = mat(0xd9a888, .7), polo = mat(0x7a1c2a, .8);
  /* the right arm: a robe sleeve, or the bare forearm under the polo's short sleeve */
  const R = new THREE.Group(); R.position.set(.19, -.2, -.42); g.add(R);
  rbox(R, .075, .07, .1, .03, sk, 0, 0, 0);
  const robe = new THREE.Group(); R.add(robe); rbox(robe, .11, .11, .34, .045, satin, .01, -.035, .2).rotation.x = .1; rbox(robe, .125, .125, .06, .04, satin, .01, -.03, .04);
  const bare = new THREE.Group(); R.add(bare); rbox(bare, .08, .08, .3, .035, sk, .01, -.03, .18); rbox(bare, .115, .115, .1, .04, polo, .015, -.04, .36);
  const bread = new THREE.Group(); R.add(bread); box(bread, .095, .015, .1, mat(0xeadcb8, .95), -.01, .045, -.03); box(bread, .1, .01, .105, mat(0xa06a3a, .9), -.01, .038, -.03);
  const fluid = new THREE.Group(); R.add(fluid); cyl(fluid, .04, .04, .2, mat(0x2c6fb0, .5), 0, .08, -.02, 12); cyl(fluid, .012, .018, .05, mat(0xe8e0d0, .5), 0, .2, -.02, 8);
  const lighter = new THREE.Group(); R.add(lighter); box(lighter, .03, .07, .015, mat(0xc02a2a, .4), 0, .05, -.02);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 })); flame.scale.y = 2; flame.position.set(0, .1, -.02); lighter.add(flame);
  /* the left hand with the paper */
  const L = new THREE.Group(); L.position.set(-.21, -.24, -.4); g.add(L);
  rbox(L, .075, .07, .1, .03, sk, 0, 0, 0); rbox(L, .11, .11, .3, .045, satin, -.01, -.035, .18);
  const paper = cyl(L, .045, .045, .3, mat(0xefe9da, .8), .01, .03, -.02, 12); paper.rotation.z = Math.PI / 2 - .3;
  post.vm.scene.add(g);
  return { g, R, L, robe, bare, bread, fluid, lighter, flame, reach: 0, chest: 0, throwT: 0 };
}
const PARTY = new Set(['party', 'lit', 'faint']);
function hands(dt) {
  if (!vm) return;
  const on = (fps.on && app.mode === 'game' && !seq.running && G.phase !== 'idle') || G.vmForce;
  vm.g.visible = !!on; if (!on) return;
  const party = PARTY.has(G.phase);
  vm.robe.visible = !party; vm.bare.visible = party;
  vm.bread.visible = !party && (G.phase === 'pool' || G.phase === 'hand');
  vm.fluid.visible = party && G.phase === 'party'; vm.lighter.visible = party && G.phase === 'lit' && !G.lit;
  vm.L.visible = G.paper && G.phase === 'paper';
  const t = app.time, mv = fps.moving ? (fps.running ? 1.6 : 1) : 0;
  vm.reach = damp(vm.reach, fps.using && (G.phase === 'hand' || G.phase === 'party') ? 1 : 0, 6, dt);
  vm.throwT = Math.max(0, vm.throwT - dt * 3);
  const th = Math.sin(Math.min(1, vm.throwT) * Math.PI), low = G.phase === 'hand' ? 1 : 0;
  vm.R.position.set(.19 - .05 * vm.reach - .12 * vm.chest, -.2 - Math.abs(Math.cos(t * 5.2)) * .01 * mv + .06 * th - .12 * vm.reach * low - .1 * vm.chest, -.42 - .12 * vm.reach + .1 * th + .14 * vm.chest);
  vm.R.rotation.set(-.5 * th - .3 * vm.reach * (party ? 1 : 0) + .9 * vm.chest, .2 * vm.chest, .5 * vm.chest);
  vm.L.position.y = -.24 - Math.abs(Math.cos(t * 5.2 + 1)) * .01 * mv;
  vm.flame.scale.set(1 + Math.random() * .3, 2 + Math.random() * .8, 1);
}

/* ---------- the two days ---------- */
function flockDay(place, day) {
  const F = place.flock; F.clear();
  const young = day === 'morning' ? .42 : .82;
  const spots = [[-3.6, -.8], [-2.2, .6], [-1, -1.6], [.4, .8], [1.6, -.6], [2.8, 1.8], [-4.4, .9], [.2, 2.4]];
  F.add('hen', 1, ...spots[0]); F.add('drake', 1.06, ...spots[1]);
  for (let i = 0; i < 6; i++) F.add('duckling', young * (.95 + Math.random() * .1), spots[2 + i][0] + (Math.random() - .5) * .4, spots[2 + i][1] + (Math.random() - .5) * .4);
  F.group.visible = true; F.avoid = null;
}
function setDay(place, day) {
  const Y = place.world.yard;
  Y.party.visible = day === 'party'; Y.paper.visible = day === 'morning' && !G.paper;
  Y.grill.userData.coals.material.emissiveIntensity = 0;
  Y.cart.rotation.set(0, .35, 0); Y.cart.position.set(Y.GRILL[0] + 1.05, DECK + .015, Y.GRILL[1] - .1); Y.cart.userData.fluid.visible = true;
  for (const k of PEOPLE) hide(k); hide('tony');
  if (day === 'party') stageParty(place);
  flockDay(place, day);
}
function stageParty(place) {
  const at = (x, z) => V(x, 0, z), face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z), g = place.world.yard.GRILL;
  const put = (k, x, z, pose, tx, tz) => stage(k, { look: 'party', pos: at(x, z), rot: face(x, z, tx, tz), pose });
  put('carmela', -12.3, -.3, 'chat', -13.9, -1.6); put('meadow', -14.2, -2.0, 'chat', -12.3, -.3);
  put('phil', -6.6, 1.8, 'chat', -5.7, 3.1); put('chris', -5.7, 3.1, 'chat', -6.6, 1.8);
  put('guest1', -9.9, 3.9, 'chat', -9.3, 1.2); put('guest2', -9.3, 1.2, 'chat', -9.9, 3.9); put('guest3', -11.4, 6.1, 'chat', g[0], g[1]);
  put('aj', -18.6, 13.8, 'chat', -16.9, 14.7); put('kid1', -16.9, 14.7, 'chat', -18.6, 13.8); put('kid2', -20.3, 12.5, 'chat', -18.6, 13.8);
}

/* ---------- bread ---------- */
const breadMat = mat(0xeadcb8, .95);
function throwBread(place) {
  if (G.phase !== 'pool' || seq.running) return;
  const F = place.flock, c = app.camera.position, dir = fps.forward(V());
  vm.throwT = 1; playV('toss', { gain: .5 });
  /* it lands on the water where you aimed, or on the deck if you aimed there */
  const t = clamp(dir.y < -.02 ? (WATER - c.y) / dir.y : 6, 1.5, 12);
  const to = c.clone().addScaledVector(dir, t), from = c.clone().add(V(0, -.25, 0)).addScaledVector(dir, .4);
  const piece = new THREE.Mesh(new THREE.BoxGeometry(.06, .02, .05), breadMat); piece.castShadow = true; place.groups.near.add(piece);
  G.flying.push({ piece, from, to, t: 0, dur: .45 + t * .04, onWater: F.inside(to.x, to.z, .15) });
  G.thrown++;
}
function stepBread(place, dt) {
  for (const b of G.flying.slice()) {
    b.t += dt; const k = Math.min(1, b.t / b.dur);
    b.piece.position.lerpVectors(b.from, b.to, k); b.piece.position.y += Math.sin(k * Math.PI) * .8;
    b.piece.rotation.set(b.t * 9, b.t * 5, 0);
    if (k < 1) continue;
    G.flying.splice(G.flying.indexOf(b), 1);
    if (b.onWater) {
      b.piece.rotation.set(0, Math.random() * 6, 0); place.flock.toss(b.to.x, b.to.z, b.piece); slice('plop', 4, .45, { pos: b.to, ref: 4, gain: .45 });
      for (let i = 0; i < 4; i++) emit('dust', { x: b.to.x, y: WATER + .02, z: b.to.z, vx: (Math.random() - .5) * .6, vy: .5 + Math.random() * .5, vz: (Math.random() - .5) * .6, life: .5, s0: .02, s1: .06, a: .5, c: [.85, .95, 1], grav: 6 });
    } else { b.piece.position.y = place.floorAt(b.to.x, b.to.z) + .01; G.stray = [...(G.stray ?? []), b.piece]; }
  }
}

/* in the water: the shallow end and the round end only */
function wadeBound(place) {
  const F = place.flock, depth = place.world.yard.depth;
  return p => {
    const ok = F.inside(p.x, p.z, .3) && depth([p.x, p.z]) < 1.32;
    if (ok) G.last = { x: p.x, z: p.z }; else if (G.last) { p.x = G.last.x; p.z = G.last.z; }
  };
}

/* ---------- the scene ---------- */
async function intro(place) {
  G.phase = 'intro';
  await run(async S => {
    await waitFade(1, 6);
    setHour(4.75); setDay(place, 'morning');
    S.cam(V(-76, -3.2, -46), V(-36, -.4, -12), 0, { fov: 38 });
    await waitFade(0, 2);
    titleCard(byId.ducks, 'North Caldwell, New Jersey. June 1998.');
    /* night turns to morning over the house, seen through the trees; the drive lamps are on */
    const t0 = app.time;
    S.follow(() => { setHour(lerp(4.75, 6.6, smooth(Math.min(1, (app.time - t0) / 6)))); return null; });
    await S.wait(6.1); S.stopFollow();
    S.cam(V(-72, -2.6, -42), V(-36, -.4, -12), 3.5, { fov: 34 });
    await S.wait(2.2);
    await waitFade(1, 5);
    setHour(7.6);
  });
}

async function paperWalk(place) {
  G.phase = 'paper'; G.paper = false;
  const [dx, dz] = place.world.SPOTS.frontDoor;
  fps.enter({ mode: 'game', pos: V(dx, 0, dz), yaw: 1.03, pitch: -.08, walk: 1.45, run: 3.4, eye: 1.7 });
  fps.onFire = null;
  fps.onUse = () => { if (G.prompt === 'paper') pickPaper(place); else if (G.prompt === 'steps') stepIn(place); else if (G.phase === 'pool') throwBread(place); };
  await waitFade(0, 3);
  hud.goal('Get the paper at the bottom of the drive.', 'THE DUCKS');
  note('Morning. Tony walks down the drive in his robe for the paper.', 4.5);
}
function pickPaper(place) {
  if (G.paper) return;
  G.paper = true; G.prompt = null; app.emit('use', null);
  place.world.yard.paper.visible = false;
  playV('paper', { gain: .7 });
  hud.goal(null);
  note('The Star-Ledger.', 2.2);
  G.toPoolAt = app.time + 1.6;
}
async function toPool(place) {
  G.phase = 'pool-cut';
  await run(async S => {
    await waitFade(1, 3);
    fps.place(-1.4, -5.9, Math.PI, -.32);
    await S.wait(.2);
  }, { skippable: false });
  G.phase = 'pool';
  await waitFade(0, 3);
  fps.onFire = () => throwBread(place); fps.opts.gun = true;
  app.emit('fps', { on: true, mode: 'game', gun: true }); document.getElementById('fire').textContent = 'THROW';
  note('Round the back: the ducks are in the pool, the pair and their ducklings. Tony built them a ramp.', 5);
  hud.goal('Throw them bread: click, E, or tap THROW.', 'THE DUCKS');
}
async function stepIn(place) {
  if (G.phase !== 'pool') return;
  G.prompt = null; app.emit('use', null); hud.goal(null);
  G.phase = 'step-in';
  const W = place.world;
  await run(async S => {
    /* down the steps at the round end, into the water to the waist */
    const path = [[STEPS.x, STEPS.z - .1], [-1.0, 4.75], [-1.05, 4.2], [-1.1, 3.6], [-1.9, 2.6], [-2.7, 1.6]];
    W.poolPoly.off = true;
    const segs = path.slice(1).map((b, i) => ({ a: path[i], b, L: Math.hypot(b[0] - path[i][0], b[1] - path[i][1]) })), total = segs.reduce((s, q) => s + q.L, 0), dur = 2.8;
    const t0 = app.time; let splashed = 0, eye = app.camera.position.y;
    S.follow(dt => {
      let d = Math.min(1, (app.time - t0) / dur) * total;
      for (const q of segs) { if (d <= q.L || q === segs[segs.length - 1]) { const t = Math.min(1, d / q.L); fps.place(q.a[0] + (q.b[0] - q.a[0]) * t, q.a[1] + (q.b[1] - q.a[1]) * t, Math.atan2(-(q.b[0] - q.a[0]), -(q.b[1] - q.a[1])), -.15); break; } d -= q.L; }
      eye = damp(eye, place.floorAt(fps.pos.x, fps.pos.z) + fps.eye, 7, dt); app.camera.position.y = eye;
      if (app.time - t0 > splashed * .7) { splashed++; slice('wade', 4, .9, { gain: .6 }); }
      return null;
    });
    await S.wait(dur + .2);
    S.stopFollow();
    place.bound = wadeBound(place); G.last = { x: fps.pos.x, z: fps.pos.z };
    /* the shot from the pilot: Tony waist-deep in his robe, the robe floating out, the ducks round him */
    person('tony', ['robe', 'polo']);
    stage('tony', { look: 'robe', pos: V(fps.pos.x, 0, fps.pos.z), rot: Math.PI * .75, pose: 'wade' });
    cast.tony.rig.props.bread.visible = true;
    place.flock.avoid = { x: fps.pos.x, z: fps.pos.z, hand: false, hx: 0, hz: 0 };
    const f = V(fps.pos.x, WATER, fps.pos.z);
    S.cam(V(f.x + 4.2, WATER + .9, f.z - 2.4), V(f.x, WATER + .55, f.z), 0, { fov: 42 });
    S.cam(V(f.x + 3.4, WATER + .8, f.z - 1.9), V(f.x, WATER + .6, f.z), 4, { fov: 38 });
    note('Into the water with them, bread in his hand, the robe floating out round him.', 4);
    await S.wait(4.2);
    hide('tony');
    fps.place(fps.pos.x, fps.pos.z, fps.yaw, -.12);
  });
  G.phase = 'hand'; G.handT = 0;
  hud.goal('Hold the bread out to them: hold E, or hold USE.', 'THE DUCKS');
  app.emit('use', 'HOLD OUT');
}
async function toParty(place) {
  G.phase = 'party-cut';
  hud.goal(null); app.emit('use', null);
  const [gx, gz] = place.world.yard.GRILL;
  await run(async S => {
    await waitFade(1, 2);
    place.flock.avoid = null; place.world.poolPoly.off = false; place.bound = place.world.bound;
    for (const b of [...G.flying.map(f => f.piece), ...(G.stray ?? [])]) b.removeFromParent(); G.flying = []; G.stray = [];
    setHour(15.2); setDay(place, 'party');
    /* at the grill, on the lawn side of it, facing the house and the party */
    fps.place(gx + .15, gz + 1.3, .08, -.24); fps.opts.gun = false;
    await S.wait(.3);
  }, { skippable: false });
  await waitFade(0, 2);
  titleCard(byId.ducks, 'Weeks later. AJ’s birthday party.');
  G.phase = 'party'; G.squirt = 0; G.lit = false;
  fps.onFire = null; app.emit('fps', { on: true, mode: 'game', gun: false }); document.getElementById('fire').textContent = 'FIRE';
  fps.onUse = () => { if (G.phase === 'lit') light(place); };
  hud.goal('Light the grill. First the lighter fluid: hold E, or hold USE.', 'THE PARTY');
  app.emit('use', 'SQUIRT');
}
function light(place) {
  if (G.lit) return;
  G.lit = true; hud.goal(null); app.emit('use', null);
  const Y = place.world.yard, [gx, gz] = Y.GRILL;
  playV('ignite', { pos: V(gx, .8, gz), ref: 3, gain: .8 });
  Y.grill.userData.coals.material.emissiveIntensity = 2.5;
  G.fire = 2.5; G.takeOffAt = app.time + 2.6;
}

async function takeOff(place) {
  G.phase = 'takeoff';
  const F = place.flock, c = app.camera.position.clone();
  await run(async S => {
    /* the ducklings have learned to fly: the whole family up off the water, round over the yard, away over the trees */
    for (const d of F.ducks) d.flap = 1.8;
    playV('quack', { pos: F.ducks[0].pos, ref: 6, gain: .8 });
    for (let k = 0; k < 10; k++) { const d = F.ducks[k % F.ducks.length]; emit('dust', { x: d.pos.x, y: WATER + .05, z: d.pos.z, vx: (Math.random() - .5) * 2, vy: 1 + Math.random(), vz: (Math.random() - .5) * 2, life: .7, s0: .05, s1: .2, a: .6, c: [.85, .95, 1], grav: 6 }); }
    const centre = () => { let x = 0, y = 0, z = 0, n = 0; for (const d of F.ducks) if (!d.gone) { x += d.pos.x; y += d.pos.y; z += d.pos.z; n++; } return n ? V(x / n, y / n, z / n) : null; };
    const aim = centre();
    S.follow(dt => { const m = centre(); if (m) aim.lerp(m, 1 - Math.exp(-dt * 2.5)); return { pos: c, target: aim }; });
    await S.wait(1.2);
    playV('wings', { pos: F.ducks[0].pos, ref: 8, gain: .9 }); playV('flap2', { pos: F.ducks[3].pos, ref: 8, gain: .8, delay: .25 }); playV('quackfly', { pos: F.ducks[1].pos, ref: 10, gain: .8, delay: .4 });
    F.takeOff([V(2, 3.5, -2), V(-6, 7, 6), V(-14, 11, 2), V(-4, 15, -12), V(18, 22, -30), V(50, 34, -70)]);
    G.quackAt = app.time + 1.4;
    await S.until(() => F.ducks.every(d => d.gone), 14);
    note('The ducks are gone.', 2.6);
    await S.wait(1.4);
    S.stopFollow();
    await faint(place, S);
  });
  finish(place);
}

async function faint(place, S) {
  G.phase = 'faint';
  const Y = place.world.yard, [gx, gz] = Y.GRILL, c = app.camera.position.clone();
  const breath = loop('breath'), heart = loop('heart'), g = post.grade.uniforms;
  G.vmForce = true;
  const fromDir = V(); app.camera.getWorldDirection(fromDir);
  let pan = 0, sway = 0;
  const t0 = app.time;
  S.follow(dt => {
    pan = Math.min(1, pan + dt / 4.5); sway += dt;
    g.uPanic.value = pan * .82; breath.set(pan * .9); heart.set(pan * .8); heart.speed(1 + pan * .35);
    vm.chest = damp(vm.chest, pan > .45 ? 1 : 0, 3, dt);
    /* the eyes come back down from the sky to the grill, swimming */
    const k = smooth(Math.min(1, (app.time - t0) / 1.5)), grill = V(gx + Math.sin(sway * 1.3) * .6 * pan, .6 - Math.sin(sway * .9) * .4 * pan, gz + Math.cos(sway * 1.1) * .3 * pan);
    const look = c.clone().addScaledVector(fromDir, 6).lerp(grill, k);
    return { pos: V(c.x, c.y - .06 * pan, c.z), target: look };
  });
  note('He can’t breathe.', 3);
  await S.wait(5);
  /* the knees go: he falls back, into the side table, and the fluid goes into the grill */
  G.vmForce = false; vm.g.visible = false;
  const t1 = app.time;
  S.follow(dt => {
    const k = Math.min(1, (app.time - t1) / 1.1), e = k * k;
    g.uPanic.value = damp(g.uPanic.value, .45, 3, dt);
    return { pos: V(c.x - .2 * e, lerp(c.y, DECK + .45, e), c.z + 1.0 * e), target: V(gx + .1, lerp(.6, 1.3, e), gz) };
  });
  await S.wait(.8);
  playV('thud', { gain: .9 });
  Y.cart.rotation.set(0, .35, 1.45); Y.cart.position.y = DECK + .25; Y.cart.userData.fluid.visible = false;
  await S.wait(.25);
  playV('whoosh', { pos: V(gx, .8, gz), ref: 4, gain: 1.2 }); g.uFlash.value = .5;
  for (let i = 0; i < 60; i++) emit('fire', { x: gx + (Math.random() - .5) * .5, y: .9, z: gz + (Math.random() - .5) * .5, vx: (Math.random() - .5) * 2.5, vy: 2.5 + Math.random() * 3, vz: (Math.random() - .5) * 2.5, life: .9 + Math.random() * .6, s0: .25, s1: 1.1, a: .9, c: [1, .55, .18], drag: 2, buoy: 1.5 });
  G.fire = 9;
  await S.wait(.35); g.uFlash.value = 0;
  await S.wait(1.1);
  await waitFade(1, 4);
  g.uPanic.value = 0; breath.set(0, 1.5); heart.set(0, 1.5);
  S.stopFollow();
  /* from above: Tony on his back on the lawn, the grill burning on its stand, the cart over, the chair and the stool */
  const lie = V(gx - .3, 0, gz + 2.3);
  person('tony', ['robe', 'polo']);
  stage('tony', { look: 'polo', pos: lie, rot: Math.PI + .3, pose: 'fallen' });
  S.cam(V(lie.x + .9, 12, lie.z - 1.2), V(lie.x + .9, 0, lie.z - 1.5), 0, { fov: 46 });
  await waitFade(0, 3);
  walkTo('carmela', [V(-13.8, 0, 6.8), V(lie.x + 1, 0, lie.z - .4)], 3.6, null, lie);
  walkTo('guest3', [V(lie.x + 1.6, 0, lie.z + .3)], 2.8, null, lie);
  walkTo('aj', [V(lie.x - 1.4, 0, lie.z + 1.6)], 3, null, lie);
  for (const k of ['meadow', 'phil', 'chris', 'guest1', 'guest2']) react(k, lie.clone().setY(.3), 6);
  S.cam(V(lie.x + .9, 9.5, lie.z - 1.2), V(lie.x + .9, 0, lie.z - 1.5), 5, { fov: 46 });
  await S.wait(5);
  await waitFade(1, 3);
  /* the last shot: the pool, empty */
  for (const k of PEOPLE) hide(k); hide('tony');
  place.flock.group.visible = false; G.fire = 0; Y.party.visible = false;
  setHour(18.6);
  S.cam(V(6.5, 1.3, 3.8), V(-2, -.1, -.5), 0, { fov: 46 });
  S.cam(V(4.2, 1.0, 2.6), V(-2, -.1, -.5), 6, { fov: 42 });
  await waitFade(0, 1.5);
  await S.wait(1.2);
  caption('I’m afraid I’m gonna lose my family like I lost the ducks.', { who: 'Tony, to Dr. Melfi', dur: 5.5 });
  await S.wait(5.5);
  await waitFade(1, 2.5);
}

async function finish(place) {
  if (G.phase === 'idle' || G.phase === 'end') return;
  G.phase = 'end';
  clearCaptions(); hud.goal(null); app.emit('use', null);
  await waitFade(1, 3);
  if (fps.on) fps.exit(true);
  post.grade.uniforms.uPanic.value = 0; post.grade.uniforms.uFlash.value = 0;
  loop('breath').set(0); loop('heart').set(0);
  G.paper = false; G.fire = 0; G.vmForce = false; if (vm) vm.chest = 0;
  place.world.poolPoly.off = false; place.bound = place.world.bound; place.flock.avoid = null;
  for (const b of [...G.flying.map(f => f.piece), ...(G.stray ?? [])]) b.removeFromParent(); G.flying = []; G.stray = [];
  for (const b of place.flock.bread) b.mesh?.removeFromParent();
  setDay(place, 'morning'); setHour(place.P.hour);
  document.getElementById('fire').textContent = 'FIRE';
  app.emit('game', false);
  app.mode = 'orbit'; app.controls.enabled = true;
  jumpTo('pool');
  await waitFade(0, 3);
  G.phase = 'idle'; app.emit('act');
}

export function buildDucks(place) {
  vm = buildHands();
  const W = place.world;
  place.flock = new Flock(W.yard.P, WATER); place.groups.near.add(place.flock.group);
  for (const k of ['carmela', 'meadow', 'aj', 'phil', 'chris', 'guest1', 'guest2', 'guest3', 'kid1', 'kid2']) person(k, ['party']);
  place.people = new THREE.Group(); place.people.name = 'people'; place.groups.near.add(place.people);
  const fireLight = new THREE.PointLight(0xff8a3a, 0, 9, 1.8); fireLight.position.set(W.yard.GRILL[0], 1.4, W.yard.GRILL[1]); place.groups.near.add(fireLight);
  setDay(place, 'morning');
  app.on('duck:eat', () => { if (app.place !== place) return; G.eaten++; if (Math.random() < .5) playV('quack', { pos: place.flock.ducks[0]?.pos, ref: 5, gain: .5 }); });
  app.onUpdate(dt => {
    if (app.place !== place) return;
    hands(dt);
    stepBread(place, dt);
    const Y = W.yard, [gx, gz] = Y.GRILL;
    /* the grill's fire */
    const fireLoop = loop('fire', { pos: V(gx, .9, gz), ref: 4 });
    if (G.fire > 0) {
      G.fire = Math.max(0, G.fire - dt * (G.phase === 'faint' ? .12 : .6));
      /* big after the fluid goes in: a column of flame off the grill, black smoke; small while the coals catch */
      const big = G.fire > 3, rate = big ? 90 : 30, n = Math.floor(rate * dt + Math.random());
      for (let i = 0; i < n; i++) emit('fire', { x: gx + (Math.random() - .5) * (big ? .5 : .3), y: .85, z: gz + (Math.random() - .5) * (big ? .5 : .3), vx: (Math.random() - .5) * (big ? .8 : .3), vy: big ? 1.8 + Math.random() * 2.6 : .6 + Math.random() * .8, vz: (Math.random() - .5) * (big ? .8 : .3), life: big ? .7 + Math.random() * .5 : .45 + Math.random() * .3, s0: big ? .2 : .07, s1: big ? .95 : .25, a: .85, c: Math.random() < .3 ? [1, .85, .45] : [1, .55, .16], drag: 1.4, buoy: 1.4 });
      if (Math.random() < dt * (big ? 14 : 5)) emit('dust', { x: gx + (Math.random() - .5) * .3, y: big ? 2.2 : 1.3, z: gz + (Math.random() - .5) * .3, vx: (Math.random() - .5) * .4, vy: big ? 1.4 : .8, vz: (Math.random() - .5) * .4, life: big ? 3.5 : 2.5, s0: .3, s1: big ? 2.2 : 1.1, a: big ? .35 : .16, c: big ? [.16, .15, .15] : [.42, .42, .44], buoy: .5 });
      fireLight.intensity = (big ? 14 : 4) * (.75 + Math.random() * .5) * Math.min(1, G.fire);
      fireLoop.set(Math.min(1, G.fire / 3) * .8);
    } else { fireLoop.set(0); fireLight.intensity = 0; }
    if (G.quackAt && app.time > G.quackAt) { G.quackAt = 0; playV('quack', { pos: V(-6, 7, 6), ref: 10, gain: .7 }); }
    if (G.phase === 'idle' || G.phase === 'end' || seq.running) return;
    /* what you can do from where you stand */
    const p = fps.pos;
    if (G.phase === 'paper') {
      if (G.toPoolAt && app.time > G.toPoolAt) { G.toPoolAt = 0; toPool(place); return; }
      if (!G.paper) {
        const [px, pz] = W.SPOTS.paper, near = Math.hypot(p.x - px, p.z - pz) < 1.8;
        if (near && G.prompt !== 'paper') { G.prompt = 'paper'; app.emit('use', 'PICK UP'); hud.goal('Pick up the paper: E, or tap PICK UP.', 'THE DUCKS'); }
        if (!near && G.prompt === 'paper') { G.prompt = null; app.emit('use', null); hud.goal('Get the paper at the bottom of the drive.', 'THE DUCKS'); }
      }
    }
    if (G.phase === 'pool') {
      if (G.eaten >= 4 && !G.toSteps) { G.toSteps = true; hud.goal('Get in with them: the steps are in the round end of the pool, on the far side.', 'THE DUCKS'); note('They take it from the water.', 2.5); }
      if (G.toSteps) {
        const near = Math.hypot(p.x - STEPS.x, p.z - STEPS.z) < 1.5;
        if (near && G.prompt !== 'steps') { G.prompt = 'steps'; app.emit('use', 'STEP IN'); hud.goal('Step into the pool: E, or tap STEP IN.', 'THE DUCKS'); }
        if (!near && G.prompt === 'steps') { G.prompt = null; app.emit('use', null); hud.goal('Get in with them: the steps are in the round end of the pool, on the far side.', 'THE DUCKS'); }
      }
    }
    if (G.phase === 'hand') {
      const f = fps.forward(V()), hx = f.x * .6, hz = f.z * .6;
      place.flock.avoid = { x: p.x, z: p.z, hand: fps.using, hx, hz };
      if (fps.using) {
        const hxw = p.x + hx, hzw = p.z + hz, close = place.flock.ducks.filter(d => Math.hypot(d.pos.x - hxw, d.pos.z - hzw) < .55);
        for (const d of close) if (d.peck <= 0 && Math.random() < dt * 2) d.peck = .8;
        if (close.length) G.handT += dt;
        if (G.handT > 4.5 && !G.handDone) { G.handDone = true; note('He talks to them.', 2.6); G.partyAt = app.time + 2.8; }
      }
      if (G.partyAt && app.time > G.partyAt) { G.partyAt = 0; toParty(place); return; }
      if (fps.moving && Math.random() < dt * 1.2) slice('wade', 4, .9, { gain: .3 });
    }
    if (G.phase === 'party' && fps.using) {
      G.squirt += dt;
      const f = fps.forward(V()), from = app.camera.position.clone().add(V(0, -.18, 0)).addScaledVector(f, .45);
      for (let i = 0; i < 2; i++) emit('dust', { x: from.x, y: from.y, z: from.z, vx: (gx - from.x) * 1.6 + (Math.random() - .5) * .2, vy: (.9 - from.y) * 1.6 + .6, vz: (gz - from.z) * 1.6 + (Math.random() - .5) * .2, life: .5, s0: .015, s1: .025, a: .7, c: [.75, .82, .9], grav: 4, drag: .2 });
      if (Math.random() < dt * 4) playV('fluid', { gain: .35 });
      if (G.squirt > 1.6) { G.phase = 'lit'; hud.goal('Now light it: E, or tap LIGHT.', 'THE PARTY'); app.emit('use', 'LIGHT'); }
    }
    if (G.phase === 'lit' && G.lit && G.takeOffAt && app.time > G.takeOffAt) { G.takeOffAt = 0; takeOff(place); }
  }, 32);

  return {
    label: () => G.phase === 'idle' ? 'FEED THE DUCKS' : 'STOP',
    title: () => G.phase === 'idle' ? 'Play the ducks (Space)' : 'Stop the scene',
    busy: () => G.phase !== 'idle',
    async run() {
      if (G.phase !== 'idle') return;
      Object.assign(G, { thrown: 0, eaten: 0, handT: 0, handDone: false, toSteps: false, squirt: 0, lit: false, prompt: null, paper: false, fire: 0, toPoolAt: 0, partyAt: 0, takeOffAt: 0, quackAt: 0 });
      app.emit('game', true); app.emit('act');
      await intro(place);
      await paperWalk(place);
      app.emit('act');
    },
    stop() { finish(place); },
    pause() { if (fps.on && app.walkLocked) document.exitPointerLock?.(); },
    state: G,
  };
}
