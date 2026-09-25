import * as THREE from 'three';
import { app } from './app.js';

/* Sound: CC0 field recordings and foley (audio/CREDITS.md) through Web Audio. Each scene brings its own set: its
   air as loops faded by gain, and one-shots placed where they happen. Sound starts muted; the first unmute loads
   the files the open scene asks for (browsers need a click). A file that fails to load stays silent. */
export const audio = { on: false, ready: false, loading: false, files: new Set(), loaded: 0 };
let ctx = null, out = null, amb = null;
const B = {}, pending = new Map();
const vary = (k = .08) => 1 - k + Math.random() * k * 2;

async function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
  amb = ctx.createGain(); amb.connect(out);
  app.onUpdate(tick, 70);
}
function load(name) {
  if (B[name] || pending.has(name)) return pending.get(name);
  const p = fetch(new URL(`../audio/${name}.mp3`, import.meta.url)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => ctx.decodeAudioData(b)).then(buf => { B[name] = buf; audio.loaded++; app.emit('audio:loaded', name); return buf; })
    .catch(e => { console.warn('sound', name, e.message); });
  pending.set(name, p); return p;
}
/* the scene asks for its files; they load when sound is on */
export function want(names) { for (const n of names) audio.files.add(n); if (ctx && audio.on) for (const n of names) load(n); }

const setPos = (p, v) => { const t = ctx.currentTime; p.positionX.setTargetAtTime(v.x, t, .02); p.positionY.setTargetAtTime(v.y, t, .02); p.positionZ.setTargetAtTime(v.z, t, .02); };
export function panner(pos, ref = 5, dest = out) {
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.1; p.maxDistance = 5000;
  if (pos) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
  p.connect(dest); return p;
}
/* a one-shot; pos places it in the world */
export function play(name, { pos = null, ref = 5, gain = 1, rate = 1, delay = 0, offset = 0, dur, dest = null } = {}) {
  if (!ctx || !audio.on) return null;
  const buf = B[name]; if (!buf) { load(name); return null; }
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(g).connect(dest ?? (pos ? panner(pos, ref) : out)); s.start(ctx.currentTime + delay, offset, dur);
  return { s, g };
}
export const playV = (name, o = {}) => play(name, { ...o, rate: (o.rate ?? 1) * vary(o.vary ?? .06) });
/* one of n equal slices of a file (steps.mp3 holds single footsteps, slot seconds apart) */
export const slice = (name, n, slot, o = {}) => play(name, { ...o, offset: Math.floor(Math.random() * n) * slot, dur: slot * .92, rate: vary(.07) });
/* a loop that is always there, faded in and out; pos makes it a place in the world */
const loops = new Map();
export function loop(name, { pos = null, ref = 6, ambient = !pos } = {}) {
  if (loops.has(name)) return loops.get(name);
  const L = { name, gain: 0, want: 0, rate: 1, pos: pos?.clone?.() ?? null, ref, ambient, node: null, g: null, p: null,
    set(v, tc = .4) { this.want = v; if (this.g) this.g.gain.setTargetAtTime(v, ctx.currentTime, tc); },
    at(v) { this.pos = this.pos ?? new THREE.Vector3(); this.pos.copy(v); if (this.p) setPos(this.p, v); },
    speed(v) { this.rate = v; if (this.node) this.node.playbackRate.setTargetAtTime(v, ctx.currentTime, .08); } };
  loops.set(name, L);
  return L;
}
function startLoop(L) {
  const buf = B[L.name]; if (!buf || L.node) return;
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = L.rate;
  const g = ctx.createGain(); g.gain.value = 0;
  L.p = L.pos || !L.ambient ? panner(L.pos, L.ref) : null;
  s.connect(g).connect(L.p ?? amb); s.start(ctx.currentTime, Math.random() * buf.duration);
  L.node = s; L.g = g; g.gain.setTargetAtTime(L.want, ctx.currentTime, .5);
}
export function stopLoops(prefix = '') { for (const L of loops.values()) if (L.name.startsWith(prefix)) L.set(0, .3); }

/* per frame: the listener is the camera; loops start once their file is in */
const fwd = new THREE.Vector3(), upv = new THREE.Vector3();
function tick() {
  if (!audio.on) return;
  const c = app.camera, l = ctx.listener, t = ctx.currentTime;
  fwd.set(0, 0, -1).applyQuaternion(c.quaternion); upv.set(0, 1, 0).applyQuaternion(c.quaternion);
  if (l.positionX) {
    l.positionX.setTargetAtTime(c.position.x, t, .02); l.positionY.setTargetAtTime(c.position.y, t, .02); l.positionZ.setTargetAtTime(c.position.z, t, .02);
    l.forwardX.setTargetAtTime(fwd.x, t, .02); l.forwardY.setTargetAtTime(fwd.y, t, .02); l.forwardZ.setTargetAtTime(fwd.z, t, .02);
    l.upX.setTargetAtTime(upv.x, t, .02); l.upY.setTargetAtTime(upv.y, t, .02); l.upZ.setTargetAtTime(upv.z, t, .02);
  } else { l.setPosition(c.position.x, c.position.y, c.position.z); l.setOrientation(fwd.x, fwd.y, fwd.z, upv.x, upv.y, upv.z); }
  for (const L of loops.values()) if (!L.node && B[L.name]) startLoop(L);
  app.place?.sound?.(ctx);
}

export async function setSound(on) {
  await ensure();
  audio.on = on;
  if (on) {
    if (ctx.state === 'suspended') await ctx.resume();
    audio.loading = true;
    await Promise.all([...audio.files].map(load));
    audio.loading = false; audio.ready = true;
  }
  out.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, .15);
  app.emit('sound', on);
}
export const toggleSound = () => setSound(!audio.on);
export const now = () => ctx?.currentTime ?? 0;
export { vary };
