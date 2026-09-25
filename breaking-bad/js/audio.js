import * as THREE from 'three';
import { app } from './app.js';
import { rv } from './rv/rv.js';
import { car } from './rv/drive.js';
import { lab } from './rv/lab.js';
import { insideRV } from './rv/cutaway.js';
import { cast } from './cast/cast.js';
import { days } from './cast/days.js';
import { crush } from './cast/crush.js';
import { shoot } from './world/shoot.js';

/* Sound: CC0 field recordings and foley (audio/CREDITS.md) through Web Audio. Each place has its own air (desert
   wind, dry grass, a far freeway), crickets come up as the light goes, and the RV has an engine that idles and
   pulls, gravel under the tyres, a starter that clicks when the battery is flat. Sounds sit where they happen.
   Sound starts muted; the first unmute loads the files (browsers need a click). A file that fails to load stays
   silent. */
export const audio = { on: false, ready: false, loading: false };
let ctx, listener, out, ambIn, ambLP;
const B = {};
const FILES = ['amb-desert', 'amb-grass', 'amb-night', 'amb-yard', 'coyote', 'raven', 'key', 'click', 'crank', 'engine-start', 'engine-idle',
  'engine-drive', 'gravel', 'crash', 'glass', 'door-open', 'door-shut', 'siren', 'horn', 'thud', 'boil', 'bubble', 'flame', 'fire', 'splash',
  'spark', 'clink', 'phone', 'suv', 'loader', 'hydraulic', 'crunch', 'clapper', 'shutter', 'steps', 'walla', 'generator'];
const V = () => new THREE.Vector3();
const vary = (k = .08) => 1 - k + Math.random() * k * 2;
const W = (x, y, z) => { rv.body.updateMatrixWorld(); return new THREE.Vector3(x, y, z).applyMatrix4(rv.body.matrixWorld); };
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerpExp = (a, b, t) => a * Math.pow(b / a, t);

/* a place in the world; ref is the distance at which it plays at full level */
const setPos = (p, v) => { const t = ctx.currentTime; p.positionX.setTargetAtTime(v.x, t, .02); p.positionY.setTargetAtTime(v.y, t, .02); p.positionZ.setTargetAtTime(v.z, t, .02); };
function panner(pos, ref = 5, dest = out) {
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.1; p.maxDistance = 4000;
  if (pos) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
  p.connect(dest); return p;
}
function play(name, { pos = null, ref = 5, gain = 1, rate = 1, delay = 0, dest = null, offset = 0, dur } = {}) {
  const buf = B[name]; if (!buf || !audio.on) return null;
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(g).connect(dest ?? (pos ? panner(pos, ref) : out)); s.start(ctx.currentTime + delay, offset, dur);
  return { s, g };
}
/* a loop that is always running, faded in and out by its gain */
function loop(name, dest, { from = 0, to = 0 } = {}) {
  const buf = B[name]; if (!buf) return null;
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
  if (to) { s.loopStart = from; s.loopEnd = to; }
  const g = ctx.createGain(); g.gain.value = 0; s.connect(g).connect(dest);
  s.start(ctx.currentTime, to ? from : Math.random() * buf.duration);
  return { s, g, set(v, tc = .3) { g.gain.setTargetAtTime(v, ctx.currentTime, tc); }, rate(v) { s.playbackRate.setTargetAtTime(v, ctx.currentTime, .08); } };
}
/* steps.mp3 holds single footsteps on gravel, half a second apart */
const step = o => { const i = Math.floor(Math.random() * 4); play('steps', { ...o, offset: i * .5, dur: .34, rate: vary(.07) }); };

/* ---------- what is always there ---------- */
const L = {};
function buildLoops() {
  /* the air of each place, muffled when you are inside the RV */
  ambIn = ctx.createGain(); ambLP = ctx.createBiquadFilter(); ambLP.type = 'lowpass'; ambLP.frequency.value = 18000; ambLP.Q.value = .5;
  ambIn.connect(ambLP).connect(out);
  for (const n of ['amb-desert', 'amb-grass', 'amb-yard', 'amb-night']) L[n] = loop(n, ambIn);
  /* the RV: engine at the front, gravel under the middle, the horn */
  L.enginePan = panner(null, 7); L.idle = loop('engine-idle', L.enginePan); L.drive = loop('engine-drive', L.enginePan);
  L.gravelPan = panner(null, 6); L.gravel = loop('gravel', L.gravelPan);
  L.hornPan = panner(null, 8); L.horn = loop('horn', L.hornPan);
  /* the lab while it cooks */
  L.labPan = panner(null, 2.5); L.boil = loop('boil', L.labPan); L.bubble = loop('bubble', L.labPan);
  /* the generator fire in 4 Days Out, the loader, the sirens */
  L.firePan = panner(null, 4); L.fire = loop('fire', L.firePan);
  L.loaderPan = panner(null, 8); L.loader = loop('loader', L.loaderPan);
  L.sirenPan = panner(null, 400); L.siren = loop('siren', L.sirenPan);
  /* the shoot: the crew talking low, their generator far off */
  L.crewPan = panner(null, 6); L.crew = loop('walla', L.crewPan);
  L.genPan = panner(null, 6); L.gen = loop('generator', L.genPan);
}

/* ---------- per frame ---------- */
const st = { idle: false, sirensOn: false, sirens: 0, loader: false, suv: null, suvT: 0, lastRV: V(), rvSpeed: 0, walked: 0, lastCam: V(), raven: 12, coyote: 20, bump: 0, crank: null };
const tmp = V(), off = new THREE.Vector3();
function tick(dt) {
  if (!audio.ready || !rv.root) return;
  const now = ctx.currentTime, id = app.stops?.id, night = app.tod?.night ?? 0, dim = app.tod?.dim ?? 0;
  /* the air: the day sound of the place, crickets as the light goes; muffled and lower inside the RV */
  const inK = app.insideK ?? 0, day = 1 - .45 * night;
  L['amb-desert']?.set((id === 'pilot' ? .9 : id === 'sunset' ? .35 : 0) * day);
  L['amb-grass']?.set((id === 'days' ? .95 : 0) * day);
  L['amb-yard']?.set((id === 'sunset' ? .8 : 0) * day);
  L['amb-night']?.set(Math.min(1, night * 1.1 + dim * .35) * .8);
  ambIn.gain.setTargetAtTime(1 - .45 * inK, now, .2);
  ambLP.frequency.setTargetAtTime(lerpExp(18000, 900, inK), now, .2);

  /* the RV moving, from its own speed, so the scripted drives sound too */
  const p = rv.root.position, sp = st.lastRV.distanceTo(p) / Math.max(dt, 1e-3); st.lastRV.copy(p);
  if (sp < 60) st.rvSpeed += (sp - st.rvSpeed) * Math.min(1, dt * 6);
  const running = car.engine === 'running' || st.idle || st.rvSpeed > .6;
  const rpm = app.mode === 'drive' ? car.rpm : Math.min(1, .18 + st.rvSpeed / 14);
  setPos(L.enginePan, W(3.9, .8, 0)); setPos(L.gravelPan, W(0, .3, 0)); setPos(L.hornPan, W(4.3, .9, 0));
  L.idle?.set(running ? .85 * (1 - smoothstep(.35, .8, rpm)) : 0, .12); L.drive?.set(running ? .9 * smoothstep(.3, .75, rpm) : 0, .12);
  L.idle?.rate(.85 + .55 * rpm); L.drive?.rate(.8 + .4 * rpm);
  L.gravel?.set(Math.min(1, st.rvSpeed / 9) * .9, .15); L.gravel?.rate(.8 + Math.min(.5, st.rvSpeed / 30));

  /* the lab */
  setPos(L.labPan, W(-2.4, 1.9, -.85));
  L.boil?.set(lab.cooking ? .5 : 0, .6); L.bubble?.set(lab.cooking ? .7 : 0, .6);

  /* 4 Days Out: the fire on the generator. Sunset: the loader, the SUV driving off */
  const gen = days.props?.gen;
  if (id === 'days' && gen) setPos(L.firePan, tmp.copy(gen.position).setY(gen.position.y + .6));
  if (crush.loader) setPos(L.loaderPan, tmp.copy(crush.loader.position).setY(crush.loader.position.y + 1.5));
  L.loader?.set(id === 'sunset' && st.loader && !crush.done ? .9 : 0, .5);
  if (st.suvT > 0) { st.suvT -= dt; if (st.suv && crush.suv) setPos(st.suv, crush.suv.position); }

  /* the sirens come closer from the road */
  st.sirens = Math.max(0, Math.min(1, st.sirens + (st.sirensOn ? dt / 9 : -dt / 2)));
  if (st.sirens > 0) setPos(L.sirenPan, tmp.copy(p).add(off.set(-900 + 500 * st.sirens, 20, -600 + 300 * st.sirens)));
  L.siren?.set(st.sirens * .9, .2);

  /* the shoot */
  const sk = app.shootK ?? 0;
  if (sk > 0) { setPos(L.crewPan, W(-10, 1.5, 3)); setPos(L.genPan, W(-27.5, 1, -10.5)); }
  L.crew?.set(sk * .18, .5); L.gen?.set(sk * .5, .5);

  /* walking: a step every stride, gravel outside, the RV's floor inside */
  const c = app.camera.position;
  if (app.mode === 'walk') {
    const d = Math.hypot(c.x - st.lastCam.x, c.z - st.lastCam.z);
    if (d < 2) st.walked += d;
    if (st.walked > .72) { st.walked = 0; const inside = insideRV(c); step({ gain: inside ? .28 : .34, dest: inside ? L.floorF : out }); }
  }
  st.lastCam.copy(c);

  /* now and then: a raven by day in the desert and the grass, coyotes at night */
  st.raven -= dt; st.coyote -= dt; st.bump = Math.max(0, st.bump - dt);
  if (st.raven < 0) { st.raven = 25 + Math.random() * 40; if (night < .3 && id !== 'sunset') far('raven', 90 + Math.random() * 120, .7); }
  if (st.coyote < 0) { st.coyote = 45 + Math.random() * 60; if (night > .5) far('coyote', 400 + Math.random() * 400, .5); }
}
/* a sound far off in a random direction, at a level that reads */
function far(name, d, gain) {
  const a = Math.random() * Math.PI * 2, c = app.camera.position;
  play(name, { pos: new THREE.Vector3(c.x + Math.cos(a) * d, c.y + 10, c.z + Math.sin(a) * d), ref: d * .8, gain, rate: vary(.05) });
}

/* ---------- the starter: cranks until it catches, stalls or runs out ---------- */
function crankStart(long) {
  crankStop();
  const buf = B.crank; if (!buf || !audio.on) return;
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = .2; s.loopEnd = buf.duration - .1;
  const g = ctx.createGain(); g.gain.value = .9; s.connect(g).connect(panner(W(3.9, .8, 0), 6)); s.start();
  const until = ctx.currentTime + (long ? 4.5 : 1.6);
  g.gain.setTargetAtTime(0, until - .1, .05); s.stop(until + .3);
  st.crank = { s, g };
}
function crankStop() {
  if (!st.crank) return;
  const { s, g } = st.crank, t = ctx.currentTime; st.crank = null;
  g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, .03);
  try { s.stop(t + .2); } catch { /* already stopped */ }
}

function wire() {
  const E = (n, f) => app.on(n, f);
  const at = o => o?.getWorldPosition ? o.getWorldPosition(V()) : o;
  const key = () => play('key', { pos: W(3.7, 1.2, -.6), ref: 2, gain: .7 });
  E('crank', c => { key(); if (c?.dead) play('click', { pos: W(3.9, .8, 0), ref: 3, gain: .75, delay: .12 }); else crankStart(c?.long); });
  E('engine:start', () => { crankStop(); st.idle = true; play('engine-start', { pos: W(3.9, .8, 0), ref: 7, gain: 1 }); });
  E('engine:stall', () => crankStop());
  E('engine:dead', () => crankStop());
  E('engine', s => { if (s === 'off' || s === 'stalled') st.idle = false; if (s !== 'cranking' && s !== 'running') crankStop(); });
  E('stop', () => { st.idle = false; st.sirensOn = false; st.sirens = 0; st.loader = false; crankStop(); });
  E('horn', on => L.horn?.set(on ? .9 : 0, .02));
  E('rv:door:open', () => play('door-open', { pos: at(rv.door.pivot), ref: 3, gain: .9, rate: vary(.04) }));
  E('rv:door:closed', () => play('door-shut', { pos: at(rv.door.pivot), ref: 3, gain: .95, rate: vary(.04) }));
  E('crash', () => { st.idle = false; play('crash', { pos: W(3, 1, 0), ref: 10, gain: 1 }); play('thud', { pos: W(0, .5, 0), ref: 8, gain: .8, delay: .15, rate: .7 }); });
  E('rv:bump', v => { if (st.bump > 0) return; st.bump = .6; play('thud', { pos: W(0, .4, 0), ref: 5, gain: Math.min(.5, v / 30), rate: .6 * vary(.1) }); });
  E('sirens', () => { st.sirensOn = true; });
  E('sirens:off', () => { st.sirensOn = false; });
  E('fire', on => { if (on && days.props?.gen) play('flame', { pos: at(days.props.gen), ref: 5, gain: 1 }); L.fire?.set(on ? 1 : 0, on ? .15 : .5); });
  E('splash', () => { if (days.props?.gen) play('splash', { pos: at(days.props.gen), ref: 4, gain: 1 }); });
  E('clink', () => play('clink', { pos: days.props?.tub ? at(days.props.tub) : W(-2.4, 1.9, -.85), ref: 2, gain: .6, rate: vary(.12) }));
  E('spark', () => play('spark', { pos: W(4.55, .75, .7), ref: 3, gain: .9, rate: vary(.06) }));
  E('phone', () => { const h = cast.hank?.rig; play('phone', { pos: h ? h.headPos(V()) : W(1.6, 1.5, 2.2), ref: 3, gain: .8 }); });
  E('car:start', () => { if (!crush.suv) return; st.suv = panner(crush.suv.position, 8); st.suvT = 14; play('suv', { dest: st.suv, gain: 1 }); });
  E('loader:start', () => { st.loader = true; if (crush.loader) play('hydraulic', { pos: at(crush.loader), ref: 6, gain: .6, delay: 1.5 }); });
  E('crunch', hit => { play('crunch', { pos: W(0, 1.5, 0), ref: 10, gain: 1, offset: [0, 2.2, 4.4][hit % 3] ?? 0, dur: 2.2 }); play('hydraulic', { pos: W(3, 3, 3), ref: 6, gain: .35, rate: .9 }); });
  E('glass', () => play('glass', { pos: W(4.4, 1.9, 0), ref: 6, gain: .9 }));
  E('clapper', () => { const a = shoot.crew?.ac2; if (app.mode === 'cinema' || !a || !app.shoot) play('clapper', { gain: .45 }); else play('clapper', { pos: a.headPos(V()), ref: 4, gain: .75 }); });
  E('photo', () => play('shutter', { gain: .6 }));
  E('step', s => { if (s?.pos && s.pos.distanceTo(app.camera.position) < 30) step({ pos: s.pos, ref: 3, gain: .5 }); });
}

async function load() {
  const base = new URL('../audio/', import.meta.url);
  await Promise.all(FILES.map(async name => {
    try {
      const res = await fetch(new URL(`${name}.mp3`, base));
      if (!res.ok) throw new Error(`${res.status}`);
      B[name] = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch (e) { console.warn(`sound ${name} did not load (${e.message})`); }
  }));
}

async function init() {
  listener = new THREE.AudioListener(); app.camera.add(listener);
  ctx = listener.context; out = listener.getInput();
  listener.setMasterVolume(audio.on && !document.hidden ? 1 : 0);
  /* footsteps on the RV's floor sound duller */
  L.floorF = ctx.createBiquadFilter(); L.floorF.type = 'lowpass'; L.floorF.frequency.value = 1400; L.floorF.connect(out);
  await load();
  buildLoops(); wire();
  audio.ready = true; audio.loaded = Object.keys(B).length; audio.files = FILES.length;
  app.onUpdate(tick, 50);
  app.emit('sound:ready');
}

export function setSound(on) {
  audio.on = on;
  if (on && !ctx && !audio.loading) { audio.loading = true; init(); }
  if (ctx) { if (on) ctx.resume(); listener.setMasterVolume(on && !document.hidden ? 1 : 0); }
  app.emit('sound', on);
}
export const toggleSound = () => setSound(!audio.on);
/* for the tests: the level of everything that is playing, in dB */
audio.meter = () => {
  if (!ctx) return -99;
  if (!L.meter) { L.meter = ctx.createAnalyser(); L.meter.fftSize = 2048; listener.gain.connect(L.meter); }
  const a = new Float32Array(L.meter.fftSize); L.meter.getFloatTimeDomainData(a);
  let s = 0; for (const v of a) s += v * v; return 10 * Math.log10(s / a.length + 1e-12);
};
document.addEventListener('visibilitychange', () => { if (listener) listener.setMasterVolume(document.hidden || !audio.on ? 0 : 1); });
