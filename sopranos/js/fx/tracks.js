import * as THREE from 'three';
import { app } from '../app.js';
import { GU } from '../world/ground.js';

/* Footprints in the snow: a canvas in world space around the player (R: how deep, G: blood). Every print is kept in a
   list, so when the player walks off the map it re-centres and draws them again. Falling snow slowly fills the old
   ones. The ground shader reads it (tTracks, uTracks). */
const SIZE = 1024, HALF = 48;          /* 96 m square, about 9 cm a pixel */
export const tracks = { prints: [], drops: [], center: new THREE.Vector2(0, 0), fill: 0, tex: null, dirty: false };
let cv, g;

export function buildTracks() {
  cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
  g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, SIZE, SIZE);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  tracks.tex = t; GU.tTracks.value = t; GU.uTracks.value.set(0, 0, HALF, 0);
  app.onUpdate(update, 88);
}

const px = x => (x - tracks.center.x + HALF) / (2 * HALF) * SIZE, pz = z => (z - tracks.center.y + HALF) / (2 * HALF) * SIZE;
function stamp(p) {
  /* a boot print: an oval pressed in, a shallow heel; its depth fades as snow fills it */
  const age = (app.time - p.t) * tracks.fill, depth = Math.max(0, p.d * (1 - age / 600));
  if (depth < .02) return;
  const x = px(p.x), z = pz(p.z), s = SIZE / (2 * HALF);
  g.save(); g.translate(x, z); g.rotate(-p.a);
  g.fillStyle = `rgba(${Math.round(255 * depth)},0,0,1)`;
  g.beginPath(); g.ellipse(0, -.07 * s, .075 * s * p.w, .13 * s * p.w, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(0, .12 * s, .065 * s * p.w, .075 * s * p.w, 0, 0, Math.PI * 2); g.fill();
  if (p.drag) { g.fillStyle = `rgba(${Math.round(160 * depth)},0,0,1)`; g.fillRect(-.04 * s, -.45 * s, .08 * s, .35 * s); }
  g.restore();
}
function drop(d) {
  const x = px(d.x), z = pz(d.z), s = SIZE / (2 * HALF);
  g.fillStyle = `rgba(0,${Math.round(255 * d.k)},0,1)`;
  g.globalCompositeOperation = 'lighter';
  g.beginPath(); g.arc(x, z, Math.max(1, d.r * s), 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
}
function redraw() {
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, SIZE, SIZE);
  for (const p of tracks.prints) if (Math.abs(p.x - tracks.center.x) < HALF + 1 && Math.abs(p.z - tracks.center.y) < HALF + 1) stamp(p);
  for (const d of tracks.drops) if (Math.abs(d.x - tracks.center.x) < HALF && Math.abs(d.z - tracks.center.y) < HALF) drop(d);
  tracks.dirty = true;
}

/* a print at (x, z) facing a (radians, 0 = +z), w width scale, d depth 0..1 */
export function print(x, z, a, { w = 1, d = .9, drag = false, who = '' } = {}) {
  const p = { x, z, a, w, d, drag, t: app.time, who };
  tracks.prints.push(p);
  if (tracks.prints.length > 6000) tracks.prints.splice(0, 1000);
  if (Math.abs(x - tracks.center.x) < HALF && Math.abs(z - tracks.center.y) < HALF) { g.globalCompositeOperation = 'lighten'; stamp(p); g.globalCompositeOperation = 'source-over'; tracks.dirty = true; }
  return p;
}
export function blood(x, z, k = 1, r = .05) {
  const d = { x, z, k, r }; tracks.drops.push(d);
  if (Math.abs(x - tracks.center.x) < HALF && Math.abs(z - tracks.center.y) < HALF) { drop(d); tracks.dirty = true; }
}
export function clearTracks() { tracks.prints.length = 0; tracks.drops.length = 0; redraw(); }
/* the prints of one walker, for the game's logic */
export const printsOf = who => tracks.prints.filter(p => p.who === who);

let lastFill = 0;
function update() {
  if (!cv || !app.place || GU.uTracks.value.w < .5) return;
  const c = app.shadowFocus ?? app.camera.position;
  if (Math.abs(c.x - tracks.center.x) > HALF * .4 || Math.abs(c.z - tracks.center.y) > HALF * .4) {
    tracks.center.set(Math.round(c.x), Math.round(c.z)); redraw();
  }
  /* the snow fills them in: redraw now and then while it falls */
  if (tracks.fill > 0 && app.time - lastFill > 4) { lastFill = app.time; redraw(); }
  GU.uTracks.value.x = tracks.center.x; GU.uTracks.value.y = tracks.center.y;
  if (tracks.dirty) { tracks.tex.needsUpdate = true; tracks.dirty = false; }
}
