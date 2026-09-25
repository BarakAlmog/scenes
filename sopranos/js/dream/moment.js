import * as THREE from 'three';
import { app } from '../app.js';
import { fps } from '../ctrl/fps.js';
import { post } from '../fx/post.js';
import { run, seq } from '../seq.js';
import { hud, choose, clearChoice } from '../ui/hud.js';
import { caption, note, clearCaptions } from '../ui/captions.js';
import { person, stage, hide, walkTo, cast } from '../cast/people.js';
import { setHour } from '../world/lighting.js';
import { playV } from '../audio.js';
import { waitFade, titleCard, byId } from '../scenes.js';
import { jumpTo } from '../ctrl/camera.js';
import { rbox, box, mat, damp, lerp, smooth } from '../lib/util.js';
import { HOTEL } from './layout.js';

/* The dream. Costa Mesa: Tony wakes as Kevin Finnerty, a salesman, and a beacon glows on the horizon. He follows it
   to the Inn at the Oaks. A man like his dead cousin, in a tuxedo, comes to take his briefcase; a woman like his
   mother waits in the doorway; from the trees a little girl's voice. Go in, or turn back. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const G = { phase: 'idle', kept: true, prompt: null, flash: 0 };
const PEOPLE = ['tonyb', 'livia', 'guest1', 'guest2', 'tony'];

let vm = null;
function buildHands() {
  const g = new THREE.Group(); g.userData.vm = true; g.visible = false;
  const suit = mat(0x1f2330, .7), sk = mat(0xd9a888, .7);
  const L = new THREE.Group(); L.position.set(-.24, -.36, -.42); g.add(L);
  rbox(L, .08, .08, .1, .03, sk, 0, 0, 0); rbox(L, .12, .12, .32, .045, suit, -.01, .02, .2);
  const bc = new THREE.Group(); bc.position.set(0, -.1, 0); L.add(bc);
  box(bc, .1, .32, .44, mat(0x2a1a12, .5), 0, -.12, -.02); box(bc, .03, .03, .12, mat(0x111, .4), 0, .05, -.02);
  post.vm.scene.add(g);
  return { g, L, bc };
}
function hands() {
  if (!vm) return;
  const on = fps.on && app.mode === 'game' && !seq.running && (G.phase === 'walk' || G.phase === 'steps');
  vm.g.visible = on; if (!on) return;
  vm.bc.visible = G.kept;
}
/* a white that fills the screen and goes */
function toWhite(k) { post.grade.uniforms.uFlash.value = k; }

async function hotel(place) {
  G.phase = 'hotel-cut';
  await run(async S => {
    await waitFade(1, 5);
    setHour(place.P.hour + .6); resetDream(place);
    S.cam(HOTEL.clone().add(V(.9, 1.55, 1.8)), place.hotel.glow.getWorldPosition(V()), 0, { fov: 46 });
    await waitFade(0, 2);
    titleCard(byId.inn, 'Costa Mesa, California.');
    note('After the shooting, in his coma, Tony wakes up in a hotel room as Kevin Finnerty, a salesman of precision optics.', 5.5);
    S.cam(HOTEL.clone().add(V(.3, 1.6, -.6)), place.hotel.glow.getWorldPosition(V()), 5.5, { fov: 42 });
    await S.wait(5.8);
  });
  G.phase = 'hotel';
  fps.enter({ mode: 'game', pos: HOTEL.clone().add(V(.3, 0, -.9)), yaw: 0, pitch: -.02, walk: 1.0, run: 1.0, eye: 1.62, fov: 56 });
  fps.onUse = () => { if (G.prompt === 'beacon') follow(place); };
  note('On the horizon, a beacon.', 3);
  hud.goal('Look at the beacon and follow it: E, or tap FOLLOW.', 'THE DREAM');
}
async function follow(place) {
  G.prompt = null; app.emit('use', null); hud.goal(null);
  G.phase = 'drive-cut';
  await run(async S => {
    /* the beacon fills the window, the room goes white */
    const t0 = app.time;
    S.follow(() => { toWhite(smooth(Math.min(1, (app.time - t0) / 2.4))); return null; });
    await S.wait(2.6); S.stopFollow();
    fps.exit(true); app.mode = 'scripted'; app.controls.enabled = false;
    setHour(place.P.hour);
    /* along the drive between the oaks, headlights on, up to the lit house */
    const car = place.car, L = car.userData.lamp, curve = place.groups.near.userData.drive;
    L.intensity = 30; playV('engine', { gain: .8 });
    const t1 = app.time, dur = 11;
    S.follow(dt => {
      const k = Math.min(1, (app.time - t1) / dur), e = 1 - Math.pow(1 - k, 2), u = .02 + e * .86;
      const p = curve.getPointAt(Math.min(.999, u)), q = curve.getPointAt(Math.min(.999, u + .02));
      car.position.set(p.x, 0, p.z); car.rotation.y = Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2 * 0 - Math.PI / 2;
      L.position.set(p.x, .8, p.z); L.target.position.set(q.x + (q.x - p.x) * 8, 0, q.z + (q.z - p.z) * 8);
      toWhite(damp(post.grade.uniforms.uFlash.value, 0, 1.2, dt));
      const back = p.clone().add(p.clone().sub(q).setLength(6.5)).add(V(0, 2.4, 0));
      return { pos: back, target: p.clone().add(V(0, 1.4, 0)).add(q.clone().sub(p).setLength(10)) };
    });
    note('In the briefcase, a flier for the Finnerty family reunion. He drives to the Inn at the Oaks.', 5);
    await S.wait(dur); S.stopFollow(); toWhite(0);
    playV('cardoor', { pos: car.position, ref: 4, gain: .8 });
    L.intensity = 0;
    await S.wait(.8);
  });
  G.phase = 'walk'; G.kept = true;
  const cp = place.car.position;
  fps.enter({ mode: 'game', pos: V(cp.x - 1.4, 0, cp.z - .4), yaw: Math.atan2(cp.x, cp.z - 1) , pitch: 0, walk: 1.3, run: 1.3, eye: 1.7, fov: 58 });
  fps.onUse = () => use(place);
  stage('tonyb', { look: 'inn', pos: V(-.5, 0, -.4), rot: 0, pose: 'stand' });
  stage('livia', { look: 'inn', pos: V(0, 0, -1.7), rot: 0, pose: 'hands', visible: false });
  stage('guest1', { look: 'inn', pos: V(-4.5, 0, .2), rot: .4, pose: 'chat' }); stage('guest2', { look: 'inn', pos: V(-3.8, 0, .7), rot: -2.4, pose: 'chat' });
  hud.goal('Go to the house.', 'THE DREAM');
}
function use(place) {
  if (seq.running) return;
  if (G.prompt === 'steps') steps(place);
}
async function meet(place) {
  G.phase = 'meet-cut';
  hud.goal(null);
  await run(async S => {
    const c = app.camera.position.clone(), b = cast.tonyb;
    S.follow(() => ({ pos: c, target: b.rig.root.position.clone().add(V(0, 1.55, 0)) }));
    note('A man like his cousin Tony Blundetto, dead, in a tuxedo, comes down to meet him.', 4);
    await S.wait(3.6);
    note('Everyone is here, he says. Tony is going home.', 3.6);
    await S.wait(3.4);
    caption('Let me take that for you, it looks like it weighs a ton.', { who: 'The man in the tuxedo', dur: 4 });
    await S.wait(3.2);
    S.stopFollow();
  });
  const k = await choose([{ key: 'keep', label: 'Keep the briefcase', sub: 'He will not let go of it' }, { key: 'give', label: 'Give it to him' }]);
  if (k === 'give') {
    G.kept = false; cast.tonyb.rig.props.briefcase.visible = true;
    note('He takes it and goes up to the porch ahead of him.', 3);
  } else note('Tony won’t let go. He already gave away one briefcase, and it had his whole life in it.', 5);
  walkTo('tonyb', [V(1.2, 0, 2.9), V(1.6, 0, .6)], 1.2, null, V(0, 1.6, 6));
  G.phase = 'steps-walk';
  hud.goal('The steps up to the door.', 'THE DREAM');
}
async function steps(place) {
  G.prompt = null; app.emit('use', null); hud.goal(null);
  G.phase = 'door-cut';
  await run(async S => {
    const c = app.camera.position.clone(), door = V(0, 1.9, -1.9);
    S.cam(c, door, 1.4, { fov: 52 });
    await S.wait(1.4);
    stage('livia', { look: 'inn', pos: V(0, 0, -1.75), rot: 0, pose: 'hands', visible: true });
    note('In the doorway, against the light, a woman like his mother.', 4);
    await S.wait(4.2);
    /* from the dark trees behind him, a little girl's voice */
    const back = c.clone().add(V(0, 0, 14));
    S.cam(c, back.setY(1.6), 2.2, { fov: 52 });
    caption('Don’t go, Daddy.', { who: 'A little girl’s voice, from the trees', dur: 4 });
    await S.wait(3.4);
    S.cam(c, door, 2.0, { fov: 52 });
    await S.wait(2);
  });
  const k = await choose([{ key: 'in', label: 'Go in' }, { key: 'back', label: 'Turn back to the voice' }]);
  await (k === 'in' ? goIn(place) : turnBack(place));
}
async function goIn(place) {
  G.phase = 'end-cut';
  await run(async S => {
    fps.exit(true); app.mode = 'scripted'; app.controls.enabled = false;
    const c = app.camera.position.clone(), t0 = app.time;
    S.follow(() => { const k = Math.min(1, (app.time - t0) / 4); toWhite(smooth(k)); return { pos: c.clone().lerp(V(0, 1.7, -1.6), smooth(k)), target: V(0, 1.8, -8) }; });
    await S.wait(4.2); S.stopFollow();
    await waitFade(1, 1.2); toWhite(0);
    note('He goes in. The screen goes to black.', 4);
    await S.wait(4.5);
  });
  finish(place);
}
async function turnBack(place) {
  G.phase = 'end-cut';
  await run(async S => {
    fps.exit(true); app.mode = 'scripted'; app.controls.enabled = false;
    const c = app.camera.position.clone(), t0 = app.time;
    S.follow(() => { const k = Math.min(1, (app.time - t0) / 3.5); toWhite(smooth(k)); return { pos: c, target: c.clone().add(V(Math.sin(k * 3) * .5, 0, 10)) }; });
    await S.wait(3.8); S.stopFollow();
    note('He does not go in. The screen goes white.', 3);
    /* he wakes in the hospital, looking up at the lights */
    const b = place.hospital.bed;
    S.cam(b, b.clone().add(V(0, 1.7, .05)), 0, { fov: 60 });
    const t1 = app.time;
    S.follow(() => { const k = Math.min(1, (app.time - t1) / 3.2); toWhite(1 - smooth(k) * .92); return { pos: b, target: b.clone().add(V(.3 * (1 - k), 1.7, .05)) }; });
    await S.wait(3.4);
    caption('I’m dead, right?', { who: 'Tony', dur: 4 });
    await S.wait(4.4); S.stopFollow();
    await waitFade(1, 2); toWhite(0);
  });
  finish(place);
}
function resetDream(place) {
  for (const k of PEOPLE) hide(k);
  G.kept = true; toWhite(0);
  const car = place.car; car.position.set(4.6, 0, 11); car.rotation.y = Math.PI * .98 + Math.PI / 2; car.userData.lamp.intensity = 0;
}
async function finish(place) {
  if (G.phase === 'idle' || G.phase === 'end') return;
  G.phase = 'end';
  clearCaptions(); clearChoice(); hud.goal(null); app.emit('use', null);
  await waitFade(1, 3);
  if (fps.on) fps.exit(true);
  resetDream(place); setHour(place.P.hour);
  app.emit('game', false);
  app.mode = 'orbit'; app.controls.enabled = true;
  jumpTo(place.startView);
  await waitFade(0, 3);
  G.phase = 'idle'; app.emit('act');
}

export function buildDreamMoment(place) {
  vm = buildHands();
  for (const k of ['tonyb', 'livia', 'guest1', 'guest2']) person(k, ['inn']);
  person('tony', ['finnerty']);
  place.people = new THREE.Group(); place.people.name = 'people'; place.groups.near.add(place.people);
  app.onUpdate(dt => {
    if (app.place !== place) return;
    hands();
    /* the beacon: a slow pulse, and a beam that sweeps past now and then */
    const H = place.hotel, t = app.time;
    H.glow.material.opacity = .75 + .25 * Math.sin(t * 2.1);
    const sweep = (t * .35) % 1; H.beam.material.opacity = Math.max(0, 1 - Math.abs(sweep - .5) * 8) * .5; H.beam.rotation.y = (sweep - .5) * 1.4;
    if (G.phase === 'idle' || seq.running) return;
    if (G.phase === 'hotel') {
      const to = H.glow.getWorldPosition(V()).sub(app.camera.position).normalize(), ang = to.angleTo(fps.forward(V()));
      if (ang < .09) { if (G.prompt !== 'beacon') { G.prompt = 'beacon'; app.emit('use', 'FOLLOW'); } } else if (G.prompt === 'beacon') { G.prompt = null; app.emit('use', null); }
    }
    if (G.phase === 'walk') { const b = cast.tonyb.rig.root.position; if (fps.pos.z < 9.5 && !G.tbDown) { G.tbDown = true; walkTo('tonyb', [V(.4, 0, 3.4), V(1.2, 0, 5.2)], 1.1, null, fps.pos); } if (Math.hypot(fps.pos.x - b.x, fps.pos.z - b.z) < 3.2) meet(place); }
    if (G.phase === 'steps-walk') { if (Math.abs(fps.pos.x) < 1.6 && fps.pos.z < 3.6 && fps.pos.z > 1.5) { if (G.prompt !== 'steps') { G.prompt = 'steps'; app.emit('use', 'GO UP'); hud.goal('Go up to the door: E, or tap GO UP.', 'THE DREAM'); } } else if (G.prompt === 'steps') { G.prompt = null; app.emit('use', null); } }
  }, 34);

  return {
    label: () => G.phase === 'idle' ? 'FOLLOW THE BEACON' : 'STOP',
    title: () => G.phase === 'idle' ? 'Play the dream (Space)' : 'Stop the scene',
    busy: () => G.phase !== 'idle',
    async run() {
      if (G.phase !== 'idle') return;
      Object.assign(G, { kept: true, prompt: null, tbDown: false });
      app.emit('game', true); app.emit('act');
      await hotel(place);
      app.emit('act');
    },
    stop() { finish(place); },
    pause() { if (fps.on && app.walkLocked) document.exitPointerLock?.(); },
    state: G,
  };
}
