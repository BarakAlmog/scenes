import * as THREE from 'three';
import { app } from '../app.js';
import { seeded } from '../lib/util.js';

/* ---------- the TV: a canvas redrawn a few times a second ---------- */
const CHANNELS = [
  { id: 'ballgame', light: 0xcfe8c8, level: 1.0 },
  { id: 'news', light: 0x9fb8ff, level: .9 },
  { id: 'cartoon', light: 0xffe2a8, level: 1.1 },
  { id: 'bars', light: 0xf0f0ff, level: 1.2 },
  { id: 'static', light: 0xc8d0e0, level: .8 },
  { id: 'off', light: 0x000000, level: 0 },
];
export const tv = { ch: 0, mesh: null, mat: null, light: null, get channel() { return CHANNELS[this.ch]; } };

const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const noise = mkCanvas(64, 48), ng = noise.getContext('2d');

function drawTV(g, w, h, t) {
  const id = tv.channel.id;
  if (id === 'off') { g.fillStyle = '#050608'; g.fillRect(0, 0, w, h); return; }
  if (id === 'ballgame') {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f6b2f'); gr.addColorStop(1, '#4f9a45');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 8; i++) g.fillRect(0, 30 + i * 22, w, 11);
    const pan = Math.sin(t * .2) * 10;
    g.fillStyle = '#b98a5a'; g.beginPath(); g.moveTo(128 + pan, 70); g.lineTo(200 + pan, 130); g.lineTo(128 + pan, 190); g.lineTo(56 + pan, 130); g.fill();
    g.fillStyle = '#4f9a45'; g.beginPath(); g.moveTo(128 + pan, 96); g.lineTo(172 + pan, 130); g.lineTo(128 + pan, 164); g.lineTo(84 + pan, 130); g.fill();
    g.fillStyle = '#fff'; for (const [x, y] of [[128, 76], [194, 130], [128, 184], [62, 130]]) g.fillRect(x + pan - 3, y - 3, 6, 6);
    const k = (t * .6) % 1, bx = 128 + pan, by = 125 + k * 55;
    g.fillStyle = '#eee'; g.beginPath(); g.arc(bx, by, 2, 0, 7); g.fill();
    g.fillStyle = '#e8e8e8'; g.beginPath(); g.arc(128 + pan, 122, 5, 0, 7); g.fill(); g.fillRect(125 + pan, 126, 6, 12);
    g.fillStyle = '#1d3f8f'; g.beginPath(); g.arc(128 + pan, 180, 5, 0, 7); g.fill(); g.fillRect(125 + pan, 184, 6, 12);
    for (const [x, y] of [[190, 118], [70, 118], [150, 80], [100, 60]]) { g.fillStyle = '#e8e8e8'; g.fillRect(x + pan + Math.sin(t + x) * 3, y, 5, 10); }
    g.fillStyle = 'rgba(10,20,40,.85)'; g.fillRect(8, 8, 118, 22);
    g.fillStyle = '#fff'; g.font = 'bold 14px Arial, sans-serif'; g.fillText('NY 3   BOS 2   7th', 14, 24);
  } else if (id === 'news') {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1b3a78'); gr.addColorStop(1, '#0d1d40');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 6; i++) g.fillRect(150 + i * 16, 20, 8, 110);
    g.fillStyle = '#2a2a33'; g.beginPath(); g.ellipse(96, 140, 58, 44, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#d9a37e'; g.beginPath(); g.arc(96, 78 + Math.sin(t * 2.3) * 1.2, 24, 0, 7); g.fill();
    g.fillStyle = '#3a2618'; g.beginPath(); g.arc(96, 68, 24, Math.PI, 0); g.fill();
    g.fillStyle = '#6b4a2f'; g.fillRect(0, 138, w, 20);
    g.fillStyle = '#b8212b'; g.fillRect(0, 158, w, 34);
    g.fillStyle = '#fff'; g.font = 'bold 13px Arial, sans-serif'; g.fillText('NEWS AT 6', 8, 172);
    g.font = '12px Arial, sans-serif';
    const msg = 'WEATHER: CLEAR AND MILD, 68° · TRAFFIC ON THE WEST SIDE HIGHWAY · SUBWAY RUNNING ON TIME · ';
    const x = -((t * 40) % (msg.length * 6.4));
    g.fillText(msg + msg, 8 + x, 187);
  } else if (id === 'cartoon') {
    g.fillStyle = '#7ec8f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(214, 36, 20, 0, 7); g.fill();
    g.fillStyle = '#6cc04a'; g.fillRect(0, 150, w, 42);
    const k = Math.abs(Math.sin(t * 3)), x = (t * 50) % (w + 60) - 30, y = 140 - k * 80;
    g.fillStyle = '#e8423a'; g.beginPath(); g.ellipse(x, y, 18 + (1 - k) * 4, 18 - (1 - k) * 4, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 6, y - 5, 5, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(x + 7, y - 5, 2.4, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 3; i++) { const cx = ((t * 12 + i * 110) % (w + 80)) - 40; g.beginPath(); g.ellipse(cx, 40 + i * 18, 26, 9, 0, 0, 7); g.fill(); }
  } else if (id === 'bars') {
    const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 7, 0, w / 7 + 1, h * .7); });
    ['#0000c0', '#111', '#c000c0', '#111', '#00c0c0', '#111', '#c0c0c0'].forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 7, h * .7, w / 7 + 1, h * .08); });
    g.fillStyle = '#0d1b3a'; g.fillRect(0, h * .78, w * .6, h * .22); g.fillStyle = '#eee'; g.fillRect(w * .6, h * .78, w * .2, h * .22);
    g.fillStyle = '#111'; g.fillRect(w * .8, h * .78, w * .2, h * .22);
  } else {
    const d = ng.createImageData(64, 48);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    ng.putImageData(d, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(noise, 0, 0, w, h);
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
}

export function makeTVScreen(w, h) {
  const c = mkCanvas(256, 192), g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tv.mat = new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: .22, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.7 });
  tv.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tv.mat);
  let acc = 1;
  drawTV(g, 256, 192, 0);
  app.onUpdate(dt => {
    acc += dt; if (acc < 1 / 14) return; acc = 0;
    drawTV(g, 256, 192, app.time); tex.needsUpdate = true;
  });
  return tv.mesh;
}

export function tvNext() {
  tv.ch = (tv.ch + 1) % CHANNELS.length;
  app.emit('tv:channel', tv.channel);
  return tv.channel;
}

/* flicker of the set, 0..1.3 */
export function tvLevel(t) {
  const ch = tv.channel;
  if (ch.id === 'off') return 0;
  const n = .72 + .16 * Math.sin(t * 9.7) + .1 * Math.sin(t * 23.3) + (ch.id === 'static' ? .2 * (Math.random() - .5) : .06 * (Math.random() - .5));
  return Math.max(.2, n) * ch.level;
}

/* ---------- the desk computer ---------- */
const PC_MODES = ['notes', 'stars', 'off'];
export const pc = { mode: 0, mat: null };
const rnd = seeded(41);
const stars = Array.from({ length: 60 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd()]);
const lines = [34, 52, 46, 58, 40, 28, 55, 49, 36];

function drawPC(g, w, h, t) {
  const mode = PC_MODES[pc.mode];
  if (mode === 'off') { g.fillStyle = '#0a0c0f'; g.fillRect(0, 0, w, h); return; }
  if (mode === 'stars') {
    g.fillStyle = '#02030a'; g.fillRect(0, 0, w, h);
    for (const s of stars) {
      s[2] -= .012; if (s[2] < .02) { s[0] = rnd() * 2 - 1; s[1] = rnd() * 2 - 1; s[2] = 1; }
      const x = w / 2 + s[0] / s[2] * 40, y = h / 2 + s[1] / s[2] * 40, r = (1 - s[2]) * 2.4;
      g.fillStyle = '#fff'; g.fillRect(x, y, r, r);
    }
    return;
  }
  g.fillStyle = '#9aa3ad'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < h; y += 2) for (let x = (y / 2) % 2 * 2; x < w; x += 4) g.fillRect(x, y, 1, 1);
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, 12); g.fillStyle = '#222'; g.fillRect(0, 12, w, 1);
  g.font = 'bold 8px Arial, sans-serif'; g.fillText('File   Edit   View   Special', 8, 9);
  g.fillStyle = '#fff'; g.fillRect(18, 22, 150, 106); g.strokeStyle = '#222'; g.strokeRect(18.5, 22.5, 150, 106);
  g.fillStyle = '#222'; for (let i = 0; i < 5; i++) g.fillRect(20, 25 + i * 2, 146, 1);
  g.fillStyle = '#fff'; g.fillRect(70, 23, 46, 11); g.fillStyle = '#222'; g.fillText('notes', 82, 31);
  const typed = (t * 14) % 420;
  let c = 0;
  lines.forEach((len, i) => {
    const show = Math.max(0, Math.min(len, typed - c)); c += len;
    g.fillStyle = '#555'; g.fillRect(26, 42 + i * 9, show * 2.2, 3);
    if (show > 0 && show < len && (t * 2 | 0) % 2) { g.fillStyle = '#000'; g.fillRect(26 + show * 2.2 + 1, 40 + i * 9, 1, 7); }
  });
  for (const [x, y] of [[176, 26], [176, 58]]) { g.fillStyle = '#e8e8e8'; g.fillRect(x, y, 14, 12); g.strokeStyle = '#333'; g.strokeRect(x + .5, y + .5, 14, 12); }
}

export function makePCScreen(w, h) {
  const c = mkCanvas(192, 144), g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  pc.mat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: .3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.05 });
  let acc = 1;
  drawPC(g, 192, 144, 0);
  app.onUpdate(dt => { acc += dt; if (acc < 1 / 10) return; acc = 0; drawPC(g, 192, 144, app.time); tex.needsUpdate = true; });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), pc.mat);
}

export function pcNext() { pc.mode = (pc.mode + 1) % PC_MODES.length; return PC_MODES[pc.mode]; }
