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
import { playV, slice } from '../audio.js';
import { waitFade, titleCard, byId } from '../scenes.js';
import { jumpTo } from '../ctrl/camera.js';
import { clockText } from '../ui/ui.js';
import { rbox, box, cyl, mat, damp, dampAngle } from '../lib/util.js';
import { makeBear } from './bear3d.js';

/* The bear. First you are Carmela, one evening: AJ screams, a black bear is at the bird feeder, and you drive it
   off with the pots and pans. Then you are Tony, the night he takes the watch himself: the lounge chair on the patio,
   a cigar, the rifle, a torch and the floodlights. Listen for it in the leaves; find it; scare it off before it
   gets to the duck feed. Most noises are only the wind. In the show nobody shoots the bear. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const G = { phase: 'idle', clock: 22, visits: [], visit: -1, hits: 0, came: 0, rounds: 30, torch: false, floods: false, seated: true, falseT: 22, puffT: 6, pots: false, shotBear: false, hinted: false, lastRustle: null };
const PATHS = {
  south: [[6, 36], [5, 22], [.5, 16.5], [-3.6, 12.9]],
  east: [[34, 8], [20, 12], [10, 15.2], [2, 15.6], [-3.6, 12.9]],
  sw: [[-32, 34], [-24, 22], [-14, 15], [-8.2, 12.4]],
  ne: [[22, -32], [14, -14], [12.4, -2], [11.4, 6], [6.2, 11.8], [-2.4, 12.9]],
};
const FEEDER_PATH = [[-32, 34], [-26, 24], [-19, 18.5], [-14.4, 15.7]];

/* ---------- the bear ---------- */
const B = { rig: null, state: 'away', pos: V(), heading: 0, speed: 0, path: [], seg: 0, pause: 0, fear: 0, thr: 1.3, eatT: 0, rearT: 0, acc: 0, growlT: 0, goal: 'tub', lit: 0, near: 0 };
function spawn(place, pts, { thr = 1.3, goal = 'tub' } = {}) {
  const T = place.T;
  B.path = pts.map(([x, z]) => V(x, T.heightAt(x, z), z)); B.seg = 0; B.goal = goal;
  B.pos.copy(B.path[0]); B.heading = Math.atan2(B.path[1].x - B.pos.x, B.path[1].z - B.pos.z);
  B.state = 'walk'; B.fear = 0; B.thr = thr; B.eatT = 0; B.lit = 0; B.near = 0; B.speed = 0;
  B.rig.root.visible = true; G.hinted = false;
}
function scare(place, amount, from, radius) {
  if (B.state === 'away' || B.state === 'flee' || B.state === 'rear' || B.state === 'shot') return;
  const d = from ? Math.hypot(B.pos.x - from.x, B.pos.z - from.z) : 0, k = Math.max(0, 1 - d / radius);
  B.fear += amount * k;
  if (k > .2 && B.state !== 'eat') { B.state = 'sniff'; B.pause = Math.max(B.pause, .8); }
}
function stepBear(place, dt) {
  const r = B.rig; if (!r || B.state === 'away') { if (r) r.root.visible = false; return; }
  const T = place.T;
  B.fear = Math.max(0, B.fear - dt * .05);
  if (B.fear >= B.thr && ['walk', 'sniff', 'eat', 'feeder'].includes(B.state)) {
    B.state = 'rear'; B.rearT = 1.3; playV('growl', { pos: B.pos, ref: 8, gain: .9 });
  }
  let want = 0;
  if (B.state === 'walk' || B.state === 'leave' || B.state === 'flee') {
    const pts = B.path, next = pts[B.seg + 1];
    if (!next) {
      if (B.state === 'walk') { B.state = B.goal === 'feeder' ? 'feeder' : 'eat'; B.eatT = 0; if (B.goal === 'tub') atTub(place); }
      else { B.state = 'away'; r.root.visible = false; app.emit('bear:gone'); }
    } else {
      const dx = next.x - B.pos.x, dz = next.z - B.pos.z, d = Math.hypot(dx, dz);
      want = B.state === 'flee' ? 4.2 : B.state === 'leave' ? 1.1 : 1.05;
      B.heading = dampAngle(B.heading, Math.atan2(dx, dz), B.state === 'flee' ? 6 : 2.5, dt);
      const step = Math.min(d, B.speed * dt);
      B.pos.x += Math.sin(B.heading) * step; B.pos.z += Math.cos(B.heading) * step;
      if (d < .35) { B.seg++; if (B.state === 'walk' && B.seg < pts.length - 1) { B.state = 'sniff'; B.pause = 1.4 + Math.random() * 1.8; } }
    }
  } else if (B.state === 'sniff') {
    B.pause -= dt; r.lookY = Math.sin(app.time * 1.3) * .6;
    if (B.pause <= 0) { B.state = 'walk'; r.lookY = 0; }
  } else if (B.state === 'eat' || B.state === 'feeder') {
    B.eatT += dt;
    if (Math.random() < dt * .25) playV('growl', { pos: B.pos, ref: 5, gain: .35, rate: .8, dur: .9, offset: Math.random() * 4 });
    if (B.state === 'eat' && B.eatT > 10) { B.state = 'leave'; B.path = B.path.slice().reverse(); B.seg = 0; note('It has had the feed. It goes back into the woods.', 3); }
  } else if (B.state === 'rear') {
    B.rearT -= dt;
    if (B.rearT <= 0) {
      B.state = 'flee'; const back = B.path.slice(0, B.seg + 1).reverse();
      B.path = [B.pos.clone(), ...back]; B.seg = 0; G.scared = (G.scared ?? 0) + 1;
      if (G.phase === 'watch') note('It runs back into the woods.', 2.6);
      playV('growl', { pos: B.pos, ref: 8, gain: .6, offset: 2.4, dur: 2 });
    }
  } else if (B.state === 'shot') {
    B.rearT = Math.min(1, B.rearT + dt * 1.6); r.root.rotation.z = B.rearT * 1.5; r.root.position.y = T.heightAt(B.pos.x, B.pos.z) + .1 * B.rearT;
    return;
  }
  B.speed = damp(B.speed, want, 3, dt);
  r.root.position.set(B.pos.x, T.heightAt(B.pos.x, B.pos.z), B.pos.z); r.root.rotation.set(0, B.heading, 0);
  r.pose(dt, B.speed, B.state === 'feeder' ? (B.eatT < 3.5 ? 'rear' : 'eat') : B.state === 'leave' || B.state === 'flee' ? 'walk' : B.state);
  /* its steps in the leaves */
  B.acc += B.speed * dt; if (B.acc > .8) { B.acc = 0; app.emit('step', { pos: B.pos, who: 'bear' }); }
  /* the feeder: it rears and swats it, the feeder hangs crooked */
  if (B.state === 'feeder' && B.eatT > 1.8 && !G.feederHit) { G.feederHit = true; const f = place.world.yard.feeder; f.rotation.z = .35; playV('lid', { pos: f.position, ref: 5, gain: .5, dur: 1 }); }
}
function atTub(place) {
  const lid = place.world.yard.tub.userData.lid;
  lid.position.set(.55, .05, .2); lid.rotation.set(1.3, 0, .3);
  playV('lid', { pos: place.world.yard.tub.position, ref: 6, gain: .9 });
  G.hits++; note('It’s at the duck feed.', 2.8);
}

/* ---------- hands ---------- */
let vm = null;
function buildHands() {
  const g = new THREE.Group(); g.userData.vm = true; g.visible = false;
  const sk = mat(0xd9a888, .7), skC = mat(0xecc2a4, .7), lea = new THREE.MeshStandardMaterial({ color: 0x151313, roughness: .38 }), steel = mat(0xc4c8cc, .22, 1), black = mat(0x151515, .45, .4);
  /* Tony: the rifle in the right hand, the torch in the left */
  const tony = new THREE.Group(); g.add(tony);
  const R = new THREE.Group(); R.position.set(.2, -.26, -.46); tony.add(R);
  rbox(R, .08, .08, .1, .03, sk, 0, 0, 0); rbox(R, .115, .115, .32, .045, lea, .01, -.03, .2);
  const rifle = new THREE.Group(); rifle.position.set(-.03, .02, -.04); rifle.rotation.set(.28, .1, 0); R.add(rifle);
  const wood = mat(0x7a4a26, .6), gun = mat(0x1a1a1c, .35, .6);
  box(rifle, .045, .07, .3, gun, 0, 0, -.05); box(rifle, .04, .055, .2, wood, 0, -.005, -.28); cyl(rifle, .01, .01, .3, gun, 0, .01, -.52, 8).rotation.x = Math.PI / 2;
  box(rifle, .038, .09, .26, wood, 0, -.03, .22); const mg = box(rifle, .028, .18, .06, gun, 0, -.11, -.07); mg.rotation.x = -.35;
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(.14, .14), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.position.set(0, .01, -.7); rifle.add(flash);
  const L = new THREE.Group(); L.position.set(-.2, -.25, -.44); tony.add(L);
  rbox(L, .08, .08, .1, .03, sk, 0, 0, 0); rbox(L, .115, .115, .3, .045, lea, -.01, -.03, .19);
  const torch = new THREE.Group(); torch.position.set(0, .03, -.06); L.add(torch);
  cyl(torch, .022, .022, .16, black, 0, 0, 0, 12).rotation.x = Math.PI / 2; cyl(torch, .03, .024, .04, black, 0, 0, -.09, 12).rotation.x = Math.PI / 2;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.026, 14), new THREE.MeshBasicMaterial({ color: 0x6a655c })); lens.position.z = -.112; torch.add(lens);
  /* Carmela: her hands, the blouse's sleeves; the pot and the pan once she has them */
  const carm = new THREE.Group(); g.add(carm);
  const blouse = new THREE.MeshStandardMaterial({ color: 0x23202a, roughness: .7 });
  const CR = new THREE.Group(); CR.position.set(.22, -.29, -.46); carm.add(CR); rbox(CR, .07, .065, .09, .03, skC, 0, 0, 0); rbox(CR, .1, .1, .3, .04, blouse, .01, -.03, .19);
  const CL = new THREE.Group(); CL.position.set(-.22, -.29, -.46); carm.add(CL); rbox(CL, .07, .065, .09, .03, skC, 0, 0, 0); rbox(CL, .1, .1, .3, .04, blouse, -.01, -.03, .19);
  const pot = new THREE.Group(); pot.position.set(.03, -.02, 0); pot.scale.setScalar(.62); CR.add(pot); cyl(pot, .11, .09, .1, steel, 0, .06, -.1, 20); box(pot, .02, .02, .14, black, 0, .03, 0);
  const pan = new THREE.Group(); pan.position.set(-.03, -.02, 0); pan.scale.setScalar(.62); CL.add(pan); cyl(pan, .13, .11, .03, steel, 0, .05, -.14, 20); box(pan, .025, .02, .16, black, 0, .03, 0);
  post.vm.scene.add(g);
  return { g, tony, carm, R, L, CR, CL, pot, pan, flash, lens, rifle, kick: 0, flashT: 0, bang: 0 };
}
function hands(dt) {
  if (!vm) return;
  const on = fps.on && app.mode === 'game' && !seq.running && (G.phase === 'carmela' || G.phase === 'watch');
  vm.g.visible = on; if (!on) { vm.flashT = 0; vm.kick = 0; return; }
  const carm = G.phase === 'carmela', t = app.time, mv = fps.moving ? 1 : 0;
  vm.tony.visible = !carm; vm.carm.visible = carm; vm.pot.visible = vm.pan.visible = G.pots;
  vm.bang = Math.max(0, vm.bang - dt * 4); vm.kick = Math.max(0, vm.kick - dt * 7); vm.flashT = Math.max(0, vm.flashT - dt);
  const b = Math.sin(Math.min(1, vm.bang) * Math.PI);
  vm.CR.position.set(.22 - .17 * b, -.29 + .06 * b - Math.abs(Math.cos(t * 5.2)) * .01 * mv, -.46 - .06 * b);
  vm.CL.position.set(-.22 + .17 * b, -.29 + .06 * b - Math.abs(Math.cos(t * 5.2 + 1)) * .01 * mv, -.46 - .06 * b);
  vm.R.position.set(.2, -.26 - Math.abs(Math.cos(t * 5.2)) * .01 * mv + (G.seated ? -.02 : 0), -.46 + vm.kick * .06);
  vm.rifle.rotation.x = .28 + vm.kick * .35;
  vm.flash.material.opacity = vm.flashT > 0 ? 1 : 0; vm.flash.rotation.z = Math.random() * 6;
  vm.lens.material.color.setHex(G.torch ? 0xfff6e0 : 0x6a655c);
}

/* ---------- the tools ---------- */
let torchL = null, muzzleL = null;
function setTorch(on) { G.torch = on; playV('click', { gain: .5 }); syncTools(); }
function setFloods(place, on) {
  G.floods = on; playV('switch', { gain: .6 });
  if (on) scare(place, .9, V(-8, 0, 0), 38);
  syncTools();
}
function bang(place) {
  if (G.phase === 'carmela' && !G.pots) return;
  vm.bang = 1; slice('pots', 4, .6, { gain: .9 });
  const at = app.camera.position;
  scare(place, G.phase === 'carmela' ? .5 : 1.0, at, G.phase === 'carmela' ? 26 : 32);
  if (G.phase === 'watch' && vm) { vm.tony.visible = false; }
}
function fire(place) {
  if (G.phase !== 'watch' || seq.running) return;
  if (G.rounds <= 0) { playV('dryfire', { gain: .6 }); return; }
  G.rounds--; hud.ammo(G.rounds);
  vm.kick = 1; vm.flashT = .06;
  const c = app.camera.position.clone(), f = fps.forward(V());
  playV('rifle', { gain: 1 }); playV('echo', { gain: .5, delay: .35 });
  muzzleL.position.copy(c).addScaledVector(f, .9); muzzleL.intensity = 30; G.muzzleT = .06;
  if (f.y > .26) { scare(place, 2.6, c, 150); return; }
  /* aimed low: does it hit him? */
  if (B.rig?.root.visible && B.state !== 'away' && B.state !== 'shot') {
    const hp = B.rig.hips.getWorldPosition(V()), hd = B.rig.head.getWorldPosition(V());
    for (let i = 0; i <= 10; i++) {
      const p = hp.clone().lerp(hd, i / 10), t = Math.max(0, p.clone().sub(c).dot(f)), q = c.clone().addScaledVector(f, t);
      if (q.distanceTo(p) < .42 && t < 120) { shotBear(place); return; }
    }
  }
  scare(place, 1.6, c, 90);
}
function syncTools() {
  for (const [k, b] of Object.entries(G.buttons ?? {})) b.classList.toggle('on', k === 'torch' ? G.torch : k === 'lights' ? G.floods : false);
}
function touchTools(place, on) {
  const ui = document.getElementById('walk-ui');
  G.toolsEl?.remove(); G.toolsEl = null; G.buttons = {};
  if (!on || !app.touch) return;
  const el = document.createElement('div'); el.className = 'tools'; ui.appendChild(el); G.toolsEl = el;
  const add = (k, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); el.appendChild(b); G.buttons[k] = b; };
  add('torch', 'TORCH', () => setTorch(!G.torch)); add('lights', 'LIGHTS', () => setFloods(place, !G.floods)); add('pots', 'POTS', () => bang(place));
}

/* ---------- the evening: Carmela ---------- */
async function evening(place) {
  G.phase = 'evening';
  const W = place.world, Y = W.yard;
  person('aj', ['2003']); person('carmela', ['2003']);
  await run(async S => {
    await waitFade(1, 5);
    setHour(16.85); resetYard(place);
    stage('aj', { look: '2003', pos: V(-9.8, 0, 8.2), rot: Math.PI * .1, pose: 'stand' });
    spawn(place, FEEDER_PATH, { thr: 1.4, goal: 'feeder' }); B.pos.copy(B.path[1]); B.seg = 1;
    S.cam(V(-11.2, 1.8, 2.4), V(-14, 1, 14.5), 0, { fov: 46 });
    await waitFade(0, 2);
    titleCard(byId.bear, 'North Caldwell, New Jersey. November 2003.');
    note('A year after Tony moved out. Carmela and AJ live in the house.', 4.5);
    await S.wait(4);
    S.cam(V(-11.6, 1.5, 6.2), V(-14, 1.2, 14.8), 5, { fov: 42 });
    await S.until(() => B.state === 'feeder', 18);
    await S.wait(2.2);
    stage('aj', { look: '2003', pos: V(-9.8, 0, 8.2), rot: Math.PI * .92, pose: 'hands', focus: B.pos });
    caption('Mommy! Mommy!', { who: 'AJ', dur: 2.6 });
    walkTo('aj', [V(-11.2, 0, 3.8)], 2.4, null, B.pos);
    await S.wait(2.4);
  });
  /* you are Carmela, out through the slider */
  G.phase = 'carmela'; G.pots = false;
  fps.enter({ mode: 'game', pos: V(-13.9, 0, -1.9), yaw: Math.atan2(-(-9.6 + 13.9), -(14.1 + 1.9)), pitch: -.08, walk: 1.5, run: 3.2, eye: 1.62, gun: !app.touch });
  fps.onFire = () => bang(place);
  fps.onUse = () => { if (G.prompt === 'pots') takePots(place); else bang(place); };
  touchTools(place, false);
  await waitFade(0, 3);
  hud.goal('Take the pots and pans off the table: E, or tap TAKE.', 'CARMELA');
}
function takePots(place) {
  G.pots = true; G.prompt = null; app.emit('use', 'BANG');
  place.world.yard.potsPans.visible = false;
  hud.goal('Bang them at the bear: click, E, or tap BANG. Get close enough for it to hear.', 'CARMELA');
  slice('pots', 4, .6, { gain: .4 });
}
async function toWatch(place) {
  G.phase = 'to-watch';
  hud.goal(null); app.emit('use', null);
  await run(async S => {
    await waitFade(1, 2);
    fps.exit(true); app.mode = 'scripted'; app.controls.enabled = false;
    hide('aj'); hide('carmela');
    B.state = 'away'; B.rig.root.visible = false;
    setHour(19.5);
    S.cam(V(-11, 1.7, -3.5), V(-6, 1, 11), 0, { fov: 46 });
    await waitFade(0, 2);
    note('Carmela calls for help. Wildlife control comes and can do nothing: the bear has not attacked anyone.', 5);
    await S.wait(5);
    note('The bear comes back. Tony sends Benny, then Little Paulie, to guard the yard.', 4.5);
    await S.wait(4.5);
    await waitFade(1, 2);
    /* the night he takes the watch himself: across the pool, the man in the chair */
    setHour(22);
    person('tony', ['leather']);
    const Wt = place.world.yard.WATCH;
    stage('tony', { look: 'leather', pos: V(Wt.x, 0, Wt.z), rot: Math.atan2(-Wt.x, 7 - Wt.z), pose: 'watch', hy: .44 });
    cast.tony.rig.props.ak.visible = true; cast.tony.rig.props.cigar.visible = true;
    S.cam(V(-3.6, 1.45, 1.4), V(Wt.x, .9, Wt.z), 0, { fov: 40 });
    S.cam(V(-4.9, 1.35, .3), V(Wt.x, .9, Wt.z), 6, { fov: 36 });
    await waitFade(0, 2);
    note('One night Tony sends Benny home and sits the watch himself.', 4.5);
    await S.wait(5.2);
    await waitFade(1, 3);
    hide('tony');
  }, { skippable: true });
  watch(place);
}

/* ---------- the night: Tony ---------- */
function watch(place) {
  G.phase = 'watch'; G.clock = 22; G.seated = true; G.nearChair = false; G.hits = 0; G.came = 0; G.rounds = 30; G.visit = -1; G.shotBear = false;
  resetYard(place);
  const Wt = place.world.yard.WATCH;
  fps.enter({ mode: 'game', pos: V(Wt.x, 0, Wt.z), yaw: Math.atan2(Wt.x - 0, Wt.z - 7) , pitch: -.05, walk: 1.4, run: 2.6, eye: 1.02, gun: true, fov: 62 });
  fps.onFire = () => fire(place);
  fps.onUse = () => { if (!G.seated && Math.hypot(fps.pos.x - Wt.x, fps.pos.z - Wt.z) < 1.3) sit(place); else setTorch(!G.torch); };
  document.getElementById('fire').textContent = 'FIRE';
  touchTools(place, true);
  hud.show(['ammo', 'clock']); hud.ammo(G.rounds); hud.clock(clockText(22));
  hud.goal('Keep the bear off the duck-feed tub by the pavilion until dawn.', 'THE WATCH');
  /* E is the torch, or the chair when you stand next to it; a phone has its own TORCH button, so USE shows only SIT */
  app.emit('use', null);
  waitFade(0, 2);
  const sides = ['south', 'east', 'sw', 'ne'].sort(() => Math.random() - .5);
  G.visits = [22.85, 24.9, 27.05, 29.15].map((h, i) => ({ h, side: sides[i], done: false }));
}
function sit(place) {
  const Wt = place.world.yard.WATCH;
  G.seated = true; G.nearChair = false; app.emit('use', null); fps.place(Wt.x, Wt.z, fps.yaw, fps.pitch); fps.eye = 1.02; fps.opts.walk = 1.4;
  note('Back in the chair.', 1.4);
}
async function dawn(place, { shot = false } = {}) {
  if (G.phase === 'dawn' || G.phase === 'end') return;
  G.phase = 'dawn'; hud.goal(null); app.emit('use', null); touchTools(place, false);
  G.torch = false; G.floods = false;
  await run(async S => {
    await waitFade(1, 3);
    fps.exit(true); app.mode = 'scripted'; app.controls.enabled = false;
    hud.hide();
    if (!shot) { B.state = 'away'; B.rig.root.visible = false; }
    setHour(shot ? G.clock % 24 : 6.75);
    const Wt = place.world.yard.WATCH;
    person('tony', ['leather']);
    stage('tony', { look: 'leather', pos: V(Wt.x, 0, Wt.z), rot: Math.atan2(-Wt.x, 7 - Wt.z), pose: 'watch', hy: .44 });
    cast.tony.rig.props.ak.visible = true; cast.tony.rig.props.cigar.visible = true;
    if (shot) { S.cam(V(B.pos.x + 3.5, 1.6, B.pos.z + 2.5), V(B.pos.x, .4, B.pos.z), 0, { fov: 40 }); }
    else { S.cam(V(-4.2, 1.35, .6), V(Wt.x, .9, Wt.z), 0, { fov: 40 }); S.cam(V(-5.4, 1.25, -.4), V(Wt.x, .9, Wt.z), 7, { fov: 36 }); }
    await waitFade(0, 1.5);
    if (shot) note('You shot the bear. In the show nobody shoots it: it goes back to the woods.', 5.5);
    else {
      titleCard(byId.bear, 'Tony keeps watch until the morning.');
      const n = G.came, lines = [n ? `The bear came ${n} time${n > 1 ? 's' : ''}.` : 'The bear did not come.', G.hits ? `It got into the duck feed ${G.hits} time${G.hits > 1 ? 's' : ''}.` : 'It never got to the duck feed.', `Rounds fired: ${30 - G.rounds}.`];
      await S.wait(1.5); note(lines.join(' '), 6);
    }
    await S.wait(6.5);
  });
  finish(place);
}
async function finish(place) {
  if (G.phase === 'idle' || G.phase === 'end') return;
  G.phase = 'end';
  clearCaptions(); hud.hide(); app.emit('use', null); touchTools(place, false);
  await waitFade(1, 3);
  if (fps.on) fps.exit(true);
  hide('tony'); hide('aj'); hide('carmela');
  B.state = 'away'; if (B.rig) { B.rig.root.visible = false; B.rig.root.rotation.set(0, 0, 0); }
  G.torch = false; G.floods = false; resetYard(place);
  setHour(place.P.hour);
  document.getElementById('fire').textContent = 'FIRE';
  app.emit('game', false);
  app.mode = 'orbit'; app.controls.enabled = true;
  jumpTo(place.startView);
  await waitFade(0, 3);
  G.phase = 'idle'; app.emit('act');
}
function shotBear(place) {
  B.state = 'shot'; B.rearT = 0; G.shotBear = true;
  playV('thud', { pos: B.pos, ref: 6, gain: .8, delay: .2 });
  G.dawnAt = app.time + 1.4;
}
function resetYard(place) {
  const Y = place.world.yard;
  Y.tub.userData.lid.position.set(0, .73, 0); Y.tub.userData.lid.rotation.set(0, 0, 0);
  Y.feeder.rotation.set(0, 0, 0); G.feederHit = false;
  Y.potsPans.visible = true;
}

export function buildBearGame(place) {
  vm = buildHands();
  B.rig = makeBear(); B.rig.root.visible = false; place.groups.near.add(B.rig.root);
  place.people = new THREE.Group(); place.people.name = 'people'; place.groups.near.add(place.people);
  torchL = new THREE.SpotLight(0xfff0d8, 0, 44, .27, .55, 1.3); torchL.castShadow = false;
  place.groups.near.add(torchL, torchL.target);
  muzzleL = new THREE.PointLight(0xffc98a, 0, 12, 2); place.groups.near.add(muzzleL);
  addEventListener('keydown', e => {
    if (app.place !== place || e.repeat || seq.running) return;
    if (G.phase === 'watch') { if (e.code === 'KeyF') setTorch(!G.torch); if (e.code === 'KeyL') setFloods(place, !G.floods); if (e.code === 'KeyB') bang(place); }
    if (G.phase === 'carmela' && e.code === 'KeyB') bang(place);
  });
  app.onUpdate(dt => {
    if (app.place !== place) return;
    hands(dt);
    stepBear(place, dt);
    /* the torch from the camera, the floodlights */
    const c = app.camera.position, f = fps.forward(V());
    torchL.intensity = G.torch && fps.on ? 180 : 0;
    if (G.torch) { torchL.position.copy(c).add(V(0, -.18, 0)).addScaledVector(f, .3); torchL.target.position.copy(c).addScaledVector(f, 12); }
    for (const L of place.floods) L.intensity = G.floods ? 320 : 0;
    place.floodM.emissiveIntensity = G.floods ? 4 : 0;
    G.muzzleT = Math.max(0, (G.muzzleT ?? 0) - dt); if (G.muzzleT <= 0) muzzleL.intensity = 0;
    /* eyes in the beam */
    if (B.rig.root.visible) {
      const hd = B.rig.head.getWorldPosition(V()), to = hd.clone().sub(c), d = to.length(), ang = to.normalize().angleTo(f);
      const lit = G.torch && fps.on && d < 40 && ang < .3 ? (1 - ang / .3) * (1 - d / 40) : 0;
      for (const e of B.rig.shine.children) e.material.opacity = Math.min(1, lit * 1.8);
      B.lit = lit;
      if (lit > .15) { scare(place, .32 * dt, null, 1); G.seenThisVisit = true; }
      if (G.floods && Math.hypot(B.pos.x + 4, B.pos.z - 5) < 19) scare(place, .12 * dt, null, 1);
    }
    if (G.phase === 'carmela') {
      const [tx, tz] = [place.world.yard.tables[0].position.x, place.world.yard.tables[0].position.z];
      if (!G.pots) { const near = Math.hypot(fps.pos.x - tx, fps.pos.z - tz) < 1.8; if (near && G.prompt !== 'pots') { G.prompt = 'pots'; app.emit('use', 'TAKE'); } if (!near && G.prompt === 'pots') { G.prompt = null; app.emit('use', null); } }
      if (B.state === 'away' && !G.leaving) { G.leaving = true; hud.goal(null); note('The bear runs off into the woods.', 2.6); G.watchAt = app.time + 2.8; }
      if (G.watchAt && app.time > G.watchAt) { G.watchAt = 0; toWatch(place); }
    }
    if (G.dawnAt && app.time > G.dawnAt) { G.dawnAt = 0; dawn(place, { shot: true }); return; }
    if (G.phase !== 'watch' || seq.running) return;
    /* the night goes by: 22:00 to dawn in six and a half minutes */
    G.clock += dt * 80 / 3600; setHour(G.clock % 24); hud.clock(clockText(G.clock % 24));
    if (G.clock >= 30.67) { dawn(place); return; }
    for (const v of G.visits) if (!v.done && G.clock >= v.h && B.state === 'away') { v.done = true; G.visit++; G.came++; G.seenThisVisit = false; spawn(place, PATHS[v.side], { thr: 1.3 + .45 * G.visit }); }
    /* up out of the chair when you walk */
    if (G.seated && fps.moving) { G.seated = false; fps.eye = 1.7; }
    if (!G.seated) { const Wt = place.world.yard.WATCH, near = Math.hypot(fps.pos.x - Wt.x, fps.pos.z - Wt.z) < 1.3; if (near !== G.nearChair) { G.nearChair = near; app.emit('use', near ? 'SIT' : null); } }
    /* a hint when it is close and you have not found it */
    if (B.state !== 'away' && !G.seenThisVisit && !G.hinted && Math.hypot(B.pos.x - c.x, B.pos.z - c.z) < 24) { G.hinted = true; note('Leaves. Something heavy in them.', 3); }
    /* the wind in the bushes: most noises are nothing */
    G.falseT -= dt;
    if (G.falseT < 0) {
      G.falseT = 14 + Math.random() * 22;
      const a = Math.random() * 6.28, d = 12 + Math.random() * 14, p = V(-4 + Math.cos(a) * d, 1, 6 + Math.sin(a) * d);
      slice('rustle', 1, 2.2, { pos: p, ref: 5, gain: .8 }); G.lastRustle = { p, t: app.time };
    }
    if (G.lastRustle && G.torch && app.time - G.lastRustle.t < 5 && G.lastRustle.p.clone().sub(c).normalize().angleTo(f) < .25) { G.lastRustle = null; if (B.state === 'away') note('Nothing there. The wind.', 2.2); }
    /* the cigar */
    G.puffT -= dt;
    if (G.puffT < 0) { G.puffT = 10 + Math.random() * 10; playV('puff', { gain: .35 }); for (let i = 0; i < 6; i++) emit('dust', { x: c.x + f.x * .35, y: c.y - .08, z: c.z + f.z * .35, vx: f.x * .4 + (Math.random() - .5) * .1, vy: .15, vz: f.z * .4 + (Math.random() - .5) * .1, life: 2.2, s0: .04, s1: .35, a: .12, c: [.8, .8, .82], drag: 1.2 }); }
  }, 32);

  return {
    label: () => G.phase === 'idle' ? 'BEAR WATCH' : 'STOP',
    title: () => G.phase === 'idle' ? 'Play the bear (Space)' : 'Stop the game',
    busy: () => G.phase !== 'idle',
    async run() {
      if (G.phase !== 'idle') return;
      Object.assign(G, { hits: 0, came: 0, rounds: 30, torch: false, floods: false, seated: true, nearChair: false, pots: false, shotBear: false, leaving: false, prompt: null, falseT: 22, puffT: 6, watchAt: 0, dawnAt: 0 });
      app.emit('game', true); app.emit('act');
      await evening(place);
      app.emit('act');
    },
    stop() { finish(place); },
    pause() { if (fps.on && app.walkLocked) document.exitPointerLock?.(); },
    state: G, bear: B,
  };
}
