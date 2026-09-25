import * as THREE from 'three';
import { canvasTex, normalTex, seeded } from './util.js';

/* ---------- the Bounder's skin ----------
   One tall texture covers the body from y 0.4 m to 3.0 m: the ribbed cream siding, the stripe band under the
   windows (yellow-orange, orange, a wide rust-red band, brown), the thin band under the roof, and dust.
   u runs 4 m along the body and repeats; v is the height. */
export const SKIN = { y0: .4, y1: 3.0, u: 4 };
const Y = (y, h) => h - (y - SKIN.y0) / (SKIN.y1 - SKIN.y0) * h;
export const BANDS = [
  /* [top, bottom, colour] in metres above the ground */
  [2.845, 2.83, '#c98a3a'], [2.82, 2.79, '#b8612b'], [2.785, 2.775, '#6a3a25'],
  [1.315, 1.296, '#d8a23c'], [1.284, 1.246, '#c7702c'], [1.236, 1.118, '#8e3b23'], [1.11, 1.094, '#5e3522'], [1.078, 1.068, '#c7702c'],
];
export function siding({ dirt = .5 } = {}) {
  const W = 512, H = 1024, rnd = seeded(7);
  const map = canvasTex(W, H, g => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#ece3cf'); gr.addColorStop(.6, '#e6dac1'); gr.addColorStop(1, '#d8c6a4');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    /* ribs: a shadow line every 3.2 cm */
    const rib = (SKIN.y1 - SKIN.y0) / H, step = .032 / rib;
    for (let y = 0; y < H; y += step) { g.fillStyle = 'rgba(120,100,70,.10)'; g.fillRect(0, y, W, 1.2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y + 1.4, W, 1); }
    for (const [t, b, c] of BANDS) { g.fillStyle = c; g.fillRect(0, Y(t, H), W, Y(b, H) - Y(t, H)); }
    /* dust: heavier low down and in streaks under the windows */
    const dg = g.createLinearGradient(0, Y(1.2, H), 0, H);
    dg.addColorStop(0, 'rgba(150,110,70,0)'); dg.addColorStop(1, `rgba(150,105,65,${.35 * dirt})`);
    g.fillStyle = dg; g.fillRect(0, Y(1.2, H), W, H - Y(1.2, H));
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, top = Y(2.4 - rnd() * .6, H), len = 40 + rnd() * 220;
      const sg = g.createLinearGradient(0, top, 0, top + len);
      sg.addColorStop(0, `rgba(120,90,60,${(.05 + rnd() * .08) * dirt})`); sg.addColorStop(1, 'rgba(120,90,60,0)');
      g.fillStyle = sg; g.fillRect(x, top, 2 + rnd() * 5, len);
    }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '110,80,50' : '255,250,240'},${.04 + rnd() * .06})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 2); }
    /* rust freckles near the bottom */
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(140,70,30,${.2 + rnd() * .3})`; g.beginPath(); g.arc(rnd() * W, Y(.45 + rnd() * .5, H), .8 + rnd() * 2.2, 0, 7); g.fill(); }
  }, 1 / SKIN.u, 1);
  map.wrapT = THREE.ClampToEdgeWrapping;
  const normal = normalTex(64, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    const step = .032 / ((SKIN.y1 - SKIN.y0) / h);
    for (let y = 0; y < h; y += step) { g.fillStyle = '#5a5a5a'; g.fillRect(0, y, w, 1); g.fillStyle = '#a0a0a0'; g.fillRect(0, y + 1, w, 1); }
  }, 1.6, 1 / SKIN.u, 1);
  normal.wrapT = THREE.ClampToEdgeWrapping;
  return { map, normal };
}
/* uv for the skin from a point in the RV's frame: u along the surface, v the height */
export const skinV = y => (y - SKIN.y0) / (SKIN.y1 - SKIN.y0);

/* 1980s wood-grain paneling: vertical grooves every 20 cm */
export function paneling() {
  const rnd = seeded(19);
  const map = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#7a4f2e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const x = rnd() * w, a = .05 + rnd() * .12;
      g.strokeStyle = rnd() < .5 ? `rgba(60,34,18,${a})` : `rgba(170,120,75,${a})`; g.lineWidth = .6 + rnd() * 2.2;
      g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 24) g.lineTo(x + Math.sin(y * .015 + i) * 4, y); g.stroke();
    }
    for (let i = 0; i < 5; i++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = 'rgba(50,28,14,.35)'; g.beginPath(); g.ellipse(x, y, 4, 10, 0, 0, 7); g.fill(); }
    for (const x of [0, w / 2]) { g.fillStyle = 'rgba(30,16,8,.8)'; g.fillRect(x, 0, 3, h); }
  }, 1 / .4, 1 / 1.2);
  const normal = normalTex(128, 64, (g, w, h) => { g.fillStyle = '#909090'; g.fillRect(0, 0, w, h); g.fillStyle = '#303030'; g.fillRect(0, 0, 3, h); g.fillRect(w / 2, 0, 3, h); }, 2.5, 1 / .4, 1);
  return { map, normal };
}

/* a New Mexico plate of the time: red on yellow, LAND OF ENCHANTMENT */
export function plateTex(text, dirty = false) {
  const t = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#e8c63a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a3261c'; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#b3261c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 17px Arial, sans-serif'; g.fillText('NEW MEXICO', w / 2, 22);
    g.font = 'bold 60px Arial Narrow, Arial, sans-serif'; g.fillText(text, w / 2, 68);
    g.font = 'bold 12px Arial, sans-serif'; g.fillText('LAND OF ENCHANTMENT', w / 2, 108);
    if (dirty) { g.fillStyle = 'rgba(120,90,60,.45)'; g.fillRect(0, h * .55, w, h * .45); }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* the element tile, for labels and the like */
export function elementTex(sym, num, mass) {
  const t = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3d8150'); gr.addColorStop(1, '#24583a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#f6f1e4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 60px Arial, sans-serif'; g.fillText(sym, w / 2, h / 2 + 2);
    g.font = '600 16px Arial'; g.textAlign = 'right'; g.fillText(num, w - 12, 20);
    g.font = '500 13px Arial'; g.textAlign = 'center'; g.fillText(mass, w / 2, h - 16);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* a label on a drum or a box */
export function labelTex(lines, bg = '#f1ece0', fg = '#2a241e', w = 256, h = 128) {
  const t = canvasTex(w, h, g => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([text, size, y]) => { g.font = `bold ${size}px Arial, sans-serif`; g.fillText(text, w / 2, y); });
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function softDot() {
  return canvasTex(64, 64, g => {
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}

/* a puff of smoke or dust: soft, lumpy */
export function puffTex() {
  const rnd = seeded(41);
  const t = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (rnd() - .5) * 60, y = h / 2 + (rnd() - .5) * 60, r = 14 + rnd() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* stencilled text for the crew's cases and the slate */
export function stencilTex(text, color = 'rgba(30,24,18,.85)') {
  const t = canvasTex(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color; g.font = 'bold 54px Courier New, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* the clapperboard */
export function slateTex(scene, take) {
  const t = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#1b1b1d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8e4da'; g.lineWidth = 3;
    g.strokeRect(10, 50, w - 20, h - 60); g.beginPath(); g.moveTo(10, 110); g.lineTo(w - 10, 110); g.moveTo(w / 2, 110); g.lineTo(w / 2, h - 10); g.stroke();
    g.fillStyle = '#e8e4da'; g.font = 'bold 20px Arial'; g.fillText('BREAKING BAD', 20, 88);
    g.font = '13px Arial'; g.fillText('SCENE', 20, 128); g.fillText('TAKE', w / 2 + 10, 128);
    g.font = 'bold 30px Arial'; g.fillText(scene, 20, 166); g.fillText(take, w / 2 + 10, 166);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8e4da' : '#1b1b1d'; g.fillRect(10 + i * 30, 10, 30, 30); }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
