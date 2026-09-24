import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { box, rbox, tube, mat, keep } from '../lib/util.js';
import { hotspot } from '../ctrl/hotspots.js';

/* The two TVs, canvases redrawn a dozen times a second, and the Magna Doodle on the guys' door. */
const CHANNELS = [
  { id: 'soap', name: 'a soap opera', light: 0xffc8c0, level: 1.0 },
  { id: 'beach', name: 'the lifeguard show', light: 0xbfe6ff, level: 1.1 },
  { id: 'hoops', name: 'the Knicks game', light: 0xffd8a8, level: 1.0 },
  { id: 'news', name: 'the news', light: 0x9fb8ff, level: .9 },
  { id: 'cartoon', name: 'cartoons', light: 0xffe2a8, level: 1.1 },
  { id: 'static', name: 'static', light: 0xc8d0e0, level: .8 },
  { id: 'off', name: 'nothing', light: 0x000000, level: 0 },
];
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const noise = mkCanvas(64, 48), ng = noise.getContext('2d');

function drawTV(g, w, h, t, id) {
  if (id === 'off') { g.fillStyle = '#050608'; g.fillRect(0, 0, w, h); return; }
  if (id === 'soap') {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e8b7b0'); gr.addColorStop(1, '#b77b86');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(150, 20, 80, 120);
    g.strokeStyle = '#3aff8a'; g.lineWidth = 2; g.beginPath();
    for (let x = 158; x < 222; x += 2) { const p = ((x + t * 60) % 40); g.lineTo(x, 70 - (p > 18 && p < 22 ? 26 : p > 22 && p < 25 ? -12 : 0)); }
    g.stroke();
    const tilt = Math.sin(t * .7) * .06;
    g.save(); g.translate(80, 190); g.rotate(tilt);
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.ellipse(0, -40, 46, 60, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#e1a986'; g.beginPath(); g.arc(0, -108, 22, 0, 7); g.fill();
    g.fillStyle = '#2a1a12'; g.beginPath(); g.arc(0, -116, 22, Math.PI, 0); g.fill();
    g.restore();
    g.fillStyle = '#6a2a4a'; g.beginPath(); g.ellipse(176, 190, 40, 60, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#e8b08e'; g.beginPath(); g.arc(176, 118, 20, 0, 7); g.fill();
    g.fillStyle = '#c89a4a'; g.beginPath(); g.ellipse(176, 118, 26, 28, 0, Math.PI * .9, Math.PI * 2.1); g.fill();
  } else if (id === 'beach') {
    g.fillStyle = '#7fc8f0'; g.fillRect(0, 0, w, h * .45);
    g.fillStyle = '#2f7fc0'; g.fillRect(0, h * .45, w, h * .2);
    g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 5; i++) { const x = ((t * 30 + i * 60) % (w + 40)) - 20; g.fillRect(x, h * .6 + (i % 2) * 6, 30, 3); }
    g.fillStyle = '#f0d898'; g.fillRect(0, h * .65, w, h * .35);
    g.fillStyle = '#c8412a'; g.fillRect(190, 70, 36, 26); g.fillStyle = '#8a6a4a'; for (const x of [192, 222]) g.fillRect(x, 96, 4, 60);
    const run = (t * 1.6) % 1, x = 30 + run * 150, bob = Math.abs(Math.sin(t * 9)) * 4;
    g.fillStyle = '#e8a878'; g.beginPath(); g.arc(x, 118 - bob, 7, 0, 7); g.fill();
    g.fillStyle = '#e83a2a'; g.fillRect(x - 6, 126 - bob, 12, 22);
    g.fillStyle = '#e8a878'; g.fillRect(x - 5, 148 - bob, 4, 16); g.fillRect(x + 1, 148 - bob, 4, 16);
    g.fillStyle = '#f0c040'; g.fillRect(x + 7, 132 - bob, 10, 6);
  } else if (id === 'hoops') {
    g.fillStyle = '#c8894a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a2a5a'; g.fillRect(0, 0, w, 44);
    g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 30; i++) g.fillRect((i * 37) % w, 8 + (i * 13) % 30, 3, 3);
    g.strokeStyle = '#f4efe4'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, 150, 46, 0, 7); g.stroke(); g.beginPath(); g.moveTo(w / 2, 44); g.lineTo(w / 2, h); g.stroke();
    const px = w / 2 + Math.sin(t * 1.3) * 70, py = 120 + Math.cos(t * 1.9) * 20;
    for (let i = 0; i < 4; i++) { const x = px + Math.sin(t * 2 + i * 1.6) * 40, y = py + Math.cos(t * 1.7 + i) * 26; g.fillStyle = i % 2 ? '#2a4db8' : '#f4f4f0'; g.fillRect(x - 5, y - 16, 10, 20); g.fillStyle = '#6a4a3a'; g.beginPath(); g.arc(x, y - 21, 5, 0, 7); g.fill(); }
    g.fillStyle = '#e8702a'; g.beginPath(); g.arc(px + 12, py - 30 - Math.abs(Math.sin(t * 6)) * 14, 5, 0, 7); g.fill();
    g.fillStyle = 'rgba(10,20,40,.85)'; g.fillRect(8, h - 30, 132, 22);
    g.fillStyle = '#fff'; g.font = 'bold 13px Arial, sans-serif'; g.fillText('NY 88   CHI 86   4th', 14, h - 14);
  } else if (id === 'news') {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1b3a78'); gr.addColorStop(1, '#0d1d40');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a2a33'; g.beginPath(); g.ellipse(96, 140, 58, 44, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#d9a37e'; g.beginPath(); g.arc(96, 78 + Math.sin(t * 2.3) * 1.2, 24, 0, 7); g.fill();
    g.fillStyle = '#3a2618'; g.beginPath(); g.arc(96, 68, 24, Math.PI, 0); g.fill();
    g.fillStyle = '#b8212b'; g.fillRect(0, 158, w, 34);
    g.fillStyle = '#fff'; g.font = 'bold 13px Arial, sans-serif'; g.fillText('EYEWITNESS AT 6', 8, 172);
    g.font = '12px Arial, sans-serif';
    const msg = 'SNOW IN THE VILLAGE TONIGHT · CROSSTOWN BUS DELAYS · KNICKS WIN AT THE GARDEN · ';
    g.fillText(msg + msg, 8 - ((t * 40) % (msg.length * 6.4)), 187);
  } else if (id === 'cartoon') {
    g.fillStyle = '#7ec8f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(214, 36, 20, 0, 7); g.fill();
    g.fillStyle = '#6cc04a'; g.fillRect(0, 150, w, 42);
    const k = Math.abs(Math.sin(t * 3)), x = (t * 50) % (w + 60) - 30, y = 140 - k * 80;
    g.fillStyle = '#e8423a'; g.beginPath(); g.ellipse(x, y, 18 + (1 - k) * 4, 18 - (1 - k) * 4, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 6, y - 5, 5, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(x + 7, y - 5, 2.4, 0, 7); g.fill();
  } else {
    const d = ng.createImageData(64, 48);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    ng.putImageData(d, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(noise, 0, 0, w, h);
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
}

function makeTV(name, w, h, start) {
  const c = mkCanvas(256, 192), g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: .22, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.7 });
  const mesh = keep(new THREE.Mesh(new THREE.PlaneGeometry(w, h), m));
  const tv = app.tvs[name] = {
    name, ch: start, mat: m, mesh, light: null,
    get channel() { return CHANNELS[tv.ch]; },
    next() { tv.ch = (tv.ch + 1) % CHANNELS.length; app.emit('tv:channel', tv); return tv.channel; },
    level(t) {
      const ch = tv.channel; if (ch.id === 'off') return 0;
      const n = .72 + .16 * Math.sin(t * 9.7 + start) + .1 * Math.sin(t * 23.3) + (ch.id === 'static' ? .2 * (Math.random() - .5) : .06 * (Math.random() - .5));
      return Math.max(.2, n) * ch.level;
    },
  };
  let acc = 1;
  drawTV(g, 256, 192, 0, tv.channel.id);
  app.onUpdate(dt => { acc += dt; if (acc < 1 / 12) return; acc = 0; drawTV(g, 256, 192, app.time + start * 7, tv.channel.id); tex.needsUpdate = true; });
  return tv;
}

/* ---------- the Magna Doodle ---------- */
const DOODLES = [
  { text: ['HOW YOU', 'DOIN’?'] },
  { draw: 'duck' },
  { text: ['THANKS FOR', 'ALL YOUR', 'STUFF'] },
  { draw: 'smile' },
  { text: ['GO', 'KNICKS!'], ball: true },
  { draw: 'chick' },
  { text: ['JOEY', 'DOESN’T', 'SHARE FOOD'] },
  { draw: 'pizza' },
];
export const doodle = { i: 0, t: 1 };
function drawDoodle(g, w, h, k) {
  g.fillStyle = '#d7d9d4'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.04)'; for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 * 2; x < w; x += 4) g.fillRect(x, y, 1, 1);
  const d = DOODLES[doodle.i];
  g.strokeStyle = '#3a3e44'; g.fillStyle = '#3a3e44'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  if (d.text) {
    g.font = 'bold 38px "Marker Felt", "Comic Sans MS", "Chalkboard SE", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = d.text.length, lh = 46, y0 = h / 2 - (n - 1) * lh / 2;
    g.save(); g.beginPath(); g.rect(0, 0, w * Math.min(1, k * 1.25), h); g.clip();
    d.text.forEach((line, i) => g.fillText(line, w / 2, y0 + i * lh));
    g.restore();
    if (d.ball && k > .8) { g.beginPath(); g.arc(w - 40, h - 36, 18, 0, 7); g.stroke(); g.beginPath(); g.moveTo(w - 58, h - 36); g.lineTo(w - 22, h - 36); g.stroke(); }
    return;
  }
  const path = pts => { const n = Math.max(1, Math.floor(pts.length * k)); g.beginPath(); pts.slice(0, n).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  const circle = (cx, cy, r, a0 = 0, a1 = Math.PI * 2, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  if (d.draw === 'smile') { path(circle(128, 96, 64)); if (k > .5) { path(circle(128, 104, 36, .3, Math.PI - .3, 20)); g.beginPath(); g.arc(104, 78, 6, 0, 7); g.arc(152, 78, 6, 0, 7); g.fill(); } }
  if (d.draw === 'duck') { path([...circle(120, 118, 50, 0, Math.PI * 2, 36), ...circle(170, 66, 26, Math.PI * .9, Math.PI * 3, 24)]); if (k > .7) { path([[194, 62], [226, 70], [196, 78]]); g.beginPath(); g.arc(176, 58, 5, 0, 7); g.fill(); } }
  if (d.draw === 'chick') { path(circle(128, 110, 44)); path(circle(128, 56, 22)); if (k > .6) { path([[148, 52], [166, 58], [148, 64]]); g.beginPath(); g.arc(134, 50, 4, 0, 7); g.fill(); path([[112, 154], [106, 176]]); path([[140, 154], [146, 176]]); } }
  if (d.draw === 'pizza') { path([[50, 50], [206, 50], [128, 170], [50, 50]]); if (k > .6) for (const [x, y] of [[100, 72], [150, 76], [126, 110], [118, 140]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); } }
}
function makeDoodle() {
  const c = mkCanvas(256, 192), g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = app.doodle.mesh; m.material.map = tex; m.material.needsUpdate = true;
  drawDoodle(g, 256, 192, 1);
  app.onUpdate(dt => { if (doodle.t >= 1) return; doodle.t = Math.min(1, doodle.t + dt / 1.1); drawDoodle(g, 256, 192, doodle.t); tex.needsUpdate = true; });
  hotspot(app.doodle.board, { title: 'The Magna Doodle', text: 'On the back of the door, with a new message or drawing nearly every episode. Click for the next one.',
    action: () => { doodle.i = (doodle.i + 1) % DOODLES.length; doodle.t = 0; app.emit('doodle'); } });
}

export function buildScreens() {
  /* Monica's: a small set on the dresser */
  {const s = app.tvSpot.monica, g = keep(new THREE.Group()), body = mat(0x2a2a2e, .5);
   rbox(g, .56, .46, .46, .03, body, 0, .23, 0); rbox(g, .44, .34, .1, .03, body, 0, .24, -.26);
   const tv = makeTV('monica', .4, .3, 0);
   tv.mesh.position.set(0, .25, .232); g.add(tv.mesh);
   for (const [x, a] of [[-.06, -.3], [.06, .35]]) tube(g, new THREE.Vector3(x, .46, -.05), new THREE.Vector3(x + a * .4, .78, -.08), .004, MAT.steel);
   const light = new THREE.PointLight(0xffc8c0, 3, 4.5, 2); light.position.set(0, .3, .6); g.add(light); tv.light = light;
   g.position.copy(s.pos); g.rotation.y = s.rot; app.root.add(g);
   hotspot(g, { title: 'Monica’s TV', text: () => `On ${tv.channel.name}. Click to change the channel.`, action: () => tv.next() });}
  /* the guys': the big set in the entertainment unit */
  {const s = app.tvSpot.guys, g = keep(new THREE.Group());
   box(g, .82, .6, .04, mat(0x161618, .4), 0, 0, -.02);
   const tv = makeTV('guys', .72, .52, 1);
   tv.mesh.position.set(0, 0, .002); g.add(tv.mesh);
   const light = new THREE.PointLight(0xbfe6ff, 3, 5.5, 2); light.position.set(0, 0, .8); g.add(light); tv.light = light;
   g.position.copy(s.pos); g.rotation.y = s.rot; app.root.add(g);
   hotspot(g, { title: 'Joey and Chandler’s TV', text: () => `On ${tv.channel.name}. Click to change the channel.`, action: () => tv.next() });}
  makeDoodle();
}
