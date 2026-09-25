import * as THREE from 'three';
import { canvasTex, seeded } from './util.js';

/* Canvas textures made at load: labels, puffs, cloth patterns, bark. */

/* a label on a box, a sign, a bag */
export function labelTex(lines, bg = '#f1ece0', fg = '#2a241e', w = 256, h = 128, font = 'Arial, sans-serif') {
  const t = canvasTex(w, h, g => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([text, size, y, weight = 'bold', color]) => { g.fillStyle = color ?? fg; g.font = `${weight} ${size}px ${font}`; g.fillText(text, w / 2, y); });
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

/* a puff of smoke, breath or snow dust: soft, lumpy */
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

/* a tartan: bands of colour across and down, with a twill hatch; rep repeats per unit of uv */
export function plaidTex(base, bands, rep = 3) {
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (const [c, a, pos, width] of bands) {
      g.globalAlpha = a; g.fillStyle = c;
      g.fillRect(pos * w, 0, width * w, h); g.fillRect(0, pos * h, w, width * h);
    }
    g.globalAlpha = .12; g.strokeStyle = '#000';
    for (let i = -h; i < w; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); }
    g.globalAlpha = 1;
  }, rep, rep);
  return t;
}

/* woodland camouflage: blotches of four colours */
export function camoTex(cols = ['#6b6a4c', '#3f3a2a', '#8a7f5c', '#2a2a22'], rep = 2, seed = 7) {
  const rnd = seeded(seed);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = cols[0]; g.fillRect(0, 0, w, h);
    for (let k = 1; k < cols.length; k++) for (let i = 0; i < 22; i++) {
      g.fillStyle = cols[k]; g.beginPath();
      const x = rnd() * w, y = rnd() * h, r = 5 + rnd() * 12;
      for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, rr = r * (.6 + rnd() * .7); g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * .7); }
      g.fill();
      /* wrap the blotch so the tile repeats */
      if (x < 20 || y < 20) { g.save(); g.translate(x < 20 ? w : 0, y < 20 ? h : 0); g.fill(); g.restore(); }
    }
  }, rep, rep);
}

/* bark: vertical fissures (oak) or smooth grey with lenticels (beech); returns the colour map */
export function barkTex(kind = 'oak', seed = 3) {
  const rnd = seeded(seed);
  return canvasTex(128, 256, (g, w, h) => {
    const base = kind === 'beech' ? [150, 148, 140] : kind === 'birch' ? [210, 205, 196] : kind === 'pine' ? [96, 72, 58] : [92, 84, 76];
    g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, w, h);
    const n = kind === 'beech' ? 40 : 90;
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, len = kind === 'beech' ? 4 + rnd() * 6 : 30 + rnd() * 120, y = rnd() * h, k = .55 + rnd() * .35;
      g.strokeStyle = `rgba(${base.map(v => Math.round(v * k)).join(',')},.9)`; g.lineWidth = kind === 'beech' ? 1 : 1.5 + rnd() * 3;
      g.beginPath(); g.moveTo(x, y);
      if (kind === 'beech' || kind === 'birch') g.lineTo(x + len, y + (rnd() - .5) * 2);
      else g.bezierCurveTo(x + (rnd() - .5) * 8, y + len * .3, x + (rnd() - .5) * 8, y + len * .6, x + (rnd() - .5) * 6, y + len);
      g.stroke();
      if (y + len > h) { g.save(); g.translate(0, -h); g.stroke(); g.restore(); }
    }
    /* light ridges and lichen */
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${kind === 'beech' ? '190,190,182' : '140,136,120'},${.08 + rnd() * .12})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 6 + rnd() * 20);
    }
    if (kind !== 'birch') for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(120,140,110,${.08 + rnd() * .1})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 3 + rnd() * 8, 0, 7); g.fill(); }
  });
}
