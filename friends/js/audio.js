import * as THREE from 'three';
import { app } from './app.js';
import { cast } from './cast/cast.js';

/* Sound: short CC0 recordings (audio/CREDITS.md), played through Web Audio so they sit in the rooms.
   Sound starts muted; the first unmute loads the files (browsers need a click). A file that fails to
   load stays silent. */
export const audio = { on: false, ready: false };
let ctx, listener, out;
const B = {};   /* decoded buffers by name */
const L = {};   /* live nodes */
const FILES = ['entrance', 'laugh-1', 'laugh-2', 'laugh-3', 'laugh-4', 'cheer', 'door-open', 'door-shut', 'sting', 'news', 'horn', 'siren',
  'static', 'tv-voices', 'walla', 'quack', 'cheep', 'strum', 'foos', 'thud', 'recline', 'boil', 'junk', 'drag'];
const STAIRS = new THREE.Vector3(-.8, 1, -5.6), STREET = new THREE.Vector3(0, -2, -14);

const bq = (type, f, q = 1) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };

/* where a sound happens; null means everywhere */
function panner(pos) {
  if (!pos) return out;
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1;
  p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.2; p.positionZ.value = pos.z;
  p.connect(out); return p;
}

function play(name, { pos = null, gain = 1, rate = 1, delay = 0, dest = null, offset = 0, dur } = {}) {
  const buf = B[name]; if (!buf) return null;
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(g).connect(dest ?? panner(pos)); s.start(ctx.currentTime + delay, offset, dur);
  return s;
}
const at = o => o?.getWorldPosition ? o.getWorldPosition(new THREE.Vector3()) : o;
const vary = (k = .08) => 1 - k + Math.random() * k * 2;

const sfx = {
  /* the laugh-and-applause when the sofa lands; the studio crowd joins in on the stage */
  applause() { play('entrance', { gain: app.stage ? .95 : .75 }); if (app.stage) play('cheer', { gain: .55, delay: .15 }); },
  /* the audience laughs a beat after the last line of an exchange */
  laugh() {
    clearTimeout(L.laughTimer);
    L.laughTimer = setTimeout(() => play(`laugh-${1 + Math.floor(Math.random() * 4)}`, { gain: .55 }), 1300);
  },
  foos(pos) { for (let i = 0; i < 7; i++) play('foos', { pos, gain: .55 + Math.random() * .4, rate: vary(.15), delay: i * .29 + Math.random() * .08 }); },
  street() {
    const quiet = (1 - (app.stageK ?? 0)) * (1 - .5 * (app.tod?.night ?? 0));
    if (Math.random() < .8) play('horn', { pos: STREET, gain: .3 * quiet, rate: vary() });
    else play('siren', { pos: STREET, gain: .26 * quiet });
  },
};

/* ---------- the two TV sets, the studio crowd, Monica's pot ---------- */
function loop(name, dest, gain = 0, rate = 1) {
  const buf = B[name]; if (!buf) return null;
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain; s.connect(g).connect(dest);
  s.start(ctx.currentTime, Math.random() * buf.duration);
  return { s, g };
}

function buildLoops() {
  L.tv = {};
  for (const tv of Object.values(app.tvs)) {
    const bus = ctx.createGain();
    const nodes = { bus, voices: loop('tv-voices', bus, 0, tv.name === 'guys' ? 1.04 : .96), cartoon: loop('tv-voices', bus, 0, 1.3), static: loop('static', bus) };
    const pa = new THREE.PositionalAudio(listener);
    pa.setRefDistance(2.4); pa.setRolloffFactor(1.1); pa.setDistanceModel('inverse');
    pa.setNodeSource(bus); pa.setFilters([bq('highpass', 220, .7), bq('lowpass', 4800, .7)]);
    tv.mesh.add(pa); nodes.pa = pa; L.tv[tv.name] = nodes;
    setTVSound(tv, false);
  }
  L.studio = loop('walla', out);
  if (B.boil && app.steamAnchor) {
    const pa = new THREE.PositionalAudio(listener); pa.setRefDistance(1.2); pa.setRolloffFactor(1.6); pa.setDistanceModel('inverse');
    const g = ctx.createGain(); g.gain.value = .5; const n = loop('boil', g, 1); if (n) { pa.setNodeSource(g); }
    const holder = new THREE.Object3D(); holder.position.copy(app.steamAnchor); app.root.add(holder); holder.add(pa);
  }
}

function setTVSound(tv, changed = true) {
  const n = L.tv?.[tv.name]; if (!n) return;
  const id = tv.channel.id, now = ctx.currentTime, set = (x, v) => x?.g.gain.setTargetAtTime(v, now, .08);
  set(n.voices, id === 'soap' || id === 'news' ? 1 : id === 'hoops' || id === 'beach' ? .55 : 0);
  set(n.cartoon, id === 'cartoon' ? .8 : 0);
  set(n.static, id === 'static' ? .6 : 0);
  if (changed) { play('static', { dest: n.bus, gain: .5, dur: .16 }); if (id === 'news') play('news', { dest: n.bus, gain: .9 }); }
}

let streetIn = 9;
function tick(dt) {
  if (!audio.ready) return;
  const now = ctx.currentTime, sk = app.stageK ?? 0;
  L.studio?.g.gain.setTargetAtTime(.5 * sk, now, .4);
  streetIn -= dt;
  if (streetIn < 0) { streetIn = 16 + Math.random() * 24; sfx.street(); }
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
  audio.ready = true;
  await load();
  buildLoops();
  app.on('door:open', d => play('door-open', { pos: at(d.pivot), gain: .8, rate: vary(.05) }));
  app.on('door:shut', d => play('door-shut', { pos: at(d.pivot), gain: .85, rate: vary(.05) }));
  app.on('applause', () => sfx.applause());
  app.on('say', () => sfx.laugh());
  app.on('fridge', f => play('door-shut', { pos: at(app.fridges[f.name].group), gain: .3, rate: f.open ? 1.5 : 1.25 }));
  app.on('tv:channel', tv => setTVSound(tv));
  app.on('quack', p => play('quack', { pos: p, gain: 1, rate: vary(.06) }));
  app.on('cheep', p => play('cheep', { pos: p, gain: .9, rate: vary(.06) }));
  app.on('cast:click', k => { if (k === 'phoebe') play('strum', { pos: at(cast.phoebe.guitar), gain: .9 }); });
  app.on('foos', () => sfx.foos(at(app.foosball.group)));
  app.on('recline', who => play('recline', { pos: app.recliners[who].pos, gain: .8, rate: vary(.05) }));
  app.on('pivot:stuck', () => play('thud', { pos: STAIRS, gain: .5, rate: 1.3 }));
  app.on('pivot:fall', () => play('drag', { pos: STAIRS, gain: .9, rate: 1.25 }));
  app.on('sofa:thud', () => play('thud', { pos: STAIRS, gain: 1 }));
  app.on('closet', () => play('junk', { pos: new THREE.Vector3(5.85, 1, -6.4), gain: 1, delay: .25 }));
  app.on('dart', () => play('thud', { pos: new THREE.Vector3(-4.85, 1.7, -2.7), gain: .45, rate: 2.4, delay: .4 }));
  app.on('sitcom', on => { if (on) play('sting', { gain: .7 }); });
  app.on('stage', () => play('sting', { gain: .7 }));
  app.onUpdate(tick, 50);
}

export function setSound(on) {
  if (on && !audio.ready) init();
  audio.on = on;
  if (!ctx) { app.emit('sound', on); return; }
  if (on) ctx.resume();
  listener.setMasterVolume(on ? 1 : 0);
  app.emit('sound', on);
}
export const toggleSound = () => setSound(!audio.on);

document.addEventListener('visibilitychange', () => { if (listener) listener.setMasterVolume(document.hidden || !audio.on ? 0 : 1); });
