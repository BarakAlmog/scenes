import * as THREE from 'three';
import { app } from './app.js';
import { tv } from './world/screens.js';
import { doors } from './world/apartment.js';

/* Sound: short CC0 recordings (audio/CREDITS.md), played through Web Audio so they
   sit in the room. Sound starts muted; the first unmute loads the files (browsers
   need a click). If a file fails, a small synthesized stand-in plays instead. */
export const audio = { on: false, ready: false };
let ctx, listener, out, noiseBuf;
const B = {};   /* decoded buffers by name */
const L = {};   /* live nodes */
const FILES = ['entrance', 'laugh-1', 'laugh-2', 'laugh-3', 'laugh-4', 'cheer', 'door-open', 'door-bang', 'door-shut',
  'squeak', 'sting', 'news', 'horn', 'siren', 'static', 'tv-voices', 'walla'];

const bq = (type, f, q = 1) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };

/* where a sound happens; null means everywhere */
function panner(pos) {
  if (!pos) return out;
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1;
  p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.2; p.positionZ.value = pos.z;
  p.connect(out); return p;
}

function play(name, { pos = null, gain = 1, rate = 1, delay = 0, dest = null } = {}) {
  const buf = B[name]; if (!buf) return null;
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(g).connect(dest ?? panner(pos)); s.start(ctx.currentTime + delay);
  return s;
}

/* stand-ins, used only if a recording did not load */
function burst(dest, t, dur, freq, gain, type = 'lowpass', q = .8) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = bq(type, freq, q), g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 1.5, dur + .05);
}
function tone(dest, t, dur, f0, f1, gain, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + .05);
}
const at = o => o?.getWorldPosition ? o.getWorldPosition(new THREE.Vector3()) : o;

const sfx = {
  bang() { if (!play('door-bang', { pos: doors.front.center, gain: 1, delay: .12 })) { const t = ctx.currentTime, d = panner(doors.front.center); burst(d, t, .14, 1500, .7); tone(d, t, .22, 140, 70, .45); } },
  open(d) { play('door-open', { pos: at(d.pivot), gain: .8 }); },
  shut(d) { if (!play('door-shut', { pos: at(d.pivot), gain: .9 })) { const t = ctx.currentTime, p = panner(at(d.pivot)); burst(p, t, .09, 900, .28); } },
  squeak() { if (!play('squeak', { pos: doors.front.center, gain: .9 })) tone(panner(doors.front.center), ctx.currentTime, .25, 1600, 2200, .08); },
  step(pos) { burst(panner(pos), ctx.currentTime, .045, 900, .04, 'bandpass', 1.2); },
  click(pos) { burst(panner(pos), ctx.currentTime, .02, 3000, .1, 'highpass'); },
  buzz(pos) {
    const t = ctx.currentTime, d = panner(pos), g = ctx.createGain(), f = bq('bandpass', 900, 1.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.1, t + .02); g.gain.setValueAtTime(.1, t + .9); g.gain.linearRampToValueAtTime(0, t + .95);
    for (const fr of [180, 271]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 1); }
    f.connect(g).connect(d);
  },
  /* the laugh-and-applause after Kramer's entrance; the studio crowd joins in on the stage */
  applause() {
    play('entrance', { gain: app.stage ? .95 : .7 });
    if (app.stage) play('cheer', { gain: .55, delay: .15 });
  },
  /* the audience laughs a beat after the last line of an exchange */
  laugh() {
    clearTimeout(L.laughTimer);
    L.laughTimer = setTimeout(() => play(`laugh-${1 + Math.floor(Math.random() * 4)}`, { gain: .55 }), 1300);
  },
  sting() { play('sting', { gain: .7 }); },
  street() {
    const pos = app.windowGroup.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-4, -1, -4));
    const quiet = (1 - (app.stageK ?? 0)) * (1 - .5 * (app.tod?.night ?? 0));
    if (Math.random() < .8) play('horn', { pos, gain: .35 * quiet, rate: .92 + Math.random() * .16 });
    else play('siren', { pos, gain: .3 * quiet });
  },
};

/* ---------- the TV set and the studio crowd ---------- */
function loop(name, dest, gain = 0, rate = 1) {
  const buf = B[name]; if (!buf) return null;
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain; s.connect(g).connect(dest);
  s.start(ctx.currentTime, Math.random() * buf.duration);
  return { s, g };
}

function buildLoops() {
  const tvBus = ctx.createGain(); L.tvBus = tvBus;
  L.voices = loop('tv-voices', tvBus);
  L.cartoon = loop('tv-voices', tvBus, 0, 1.3);
  L.static = loop('static', tvBus);
  const osc = ctx.createOscillator(); osc.frequency.value = 1000; L.tone = ctx.createGain(); L.tone.gain.value = 0; osc.connect(L.tone).connect(tvBus); osc.start();
  const pa = new THREE.PositionalAudio(listener);
  pa.setRefDistance(2.4); pa.setRolloffFactor(1); pa.setDistanceModel('inverse');
  pa.setNodeSource(tvBus); pa.setFilters([bq('highpass', 220, .7), bq('lowpass', 4800, .7)]);
  tv.mesh.parent.add(pa); L.tv = pa;
  L.cheerAt = ctx.currentTime + 5;
  L.studio = loop('walla', out);
  setTVSound(false);
}

function setTVSound(changed = true) {
  if (!L.tv) return;
  const id = tv.channel.id, now = ctx.currentTime, set = (n, v) => n?.g.gain.setTargetAtTime(v, now, .08);
  set(L.voices, id === 'news' ? 1 : id === 'ballgame' ? .6 : 0);
  set(L.cartoon, id === 'cartoon' ? .8 : 0);
  set(L.static, id === 'static' ? .6 : 0);
  L.tone.gain.setTargetAtTime(id === 'bars' ? .008 : 0, now, .08);
  if (changed && id === 'news') play('news', { dest: L.tvBus, gain: .9 });
}

let streetIn = 9;
function tick(dt) {
  if (!audio.ready) return;
  const now = ctx.currentTime, sk = app.stageK ?? 0;
  L.studio?.g.gain.setTargetAtTime(.5 * sk, now, .4);
  if (tv.channel.id === 'ballgame' && now > L.cheerAt) { L.cheerAt = now + 8 + Math.random() * 10; play('cheer', { dest: L.tvBus, gain: .35 }); }
  streetIn -= dt;
  if (streetIn < 0) { streetIn = 14 + Math.random() * 22; sfx.street(); }
}

async function load() {
  const base = new URL('../audio/', import.meta.url);
  await Promise.all(FILES.map(async name => {
    try {
      const res = await fetch(new URL(`${name}.mp3`, base));
      if (!res.ok) throw new Error(`${res.status}`);
      B[name] = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch (e) { console.warn(`sound ${name} did not load (${e.message}); a stand-in plays instead`); }
  }));
}

async function init() {
  listener = new THREE.AudioListener(); app.camera.add(listener);
  ctx = listener.context; out = listener.getInput();
  const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  audio.ready = true;
  await load();
  buildLoops();
  app.on('door:burst', () => sfx.bang());
  app.on('door:open', dr => sfx.open(dr));
  app.on('door:shut', dr => sfx.shut(dr));
  app.on('kramer:skid', () => sfx.squeak());
  app.on('applause', () => sfx.applause());
  app.on('say', () => sfx.laugh());
  app.on('step', e => sfx.step(e.pos));
  app.on('fridge', () => sfx.click(at(app.fridge.group)));
  app.on('tv:channel', () => { sfx.click(at(tv.mesh)); setTVSound(); });
  app.on('buzz', () => sfx.buzz(at(app.intercom)));
  app.on('sitcom', on => { if (on) sfx.sting(); });
  app.on('stage', () => sfx.sting());
  app.on('lamp', () => sfx.click(at(app.lamp.light)));
  app.onUpdate(tick, 50);
}

export function setSound(on) {
  if (on && !audio.ready) init();
  audio.on = on;
  if (!ctx) return;
  if (on) ctx.resume();
  listener.setMasterVolume(on ? 1 : 0);
  app.emit('sound', on);
}
export const toggleSound = () => setSound(!audio.on);

document.addEventListener('visibilitychange', () => { if (listener) listener.setMasterVolume(document.hidden || !audio.on ? 0 : 1); });
