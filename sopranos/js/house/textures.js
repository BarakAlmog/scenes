import * as THREE from 'three';
import { canvasTex, seeded } from '../lib/util.js';

/* The house's surfaces, drawn on canvases: tan brick with its mortar, cream shingle siding, grey asphalt shingles,
   brick pavers, the pool's tiles with the blue mosaic band. Each tile is 1 m square unless said. */
export function brickTex(base = [196, 170, 132]) {
  const rnd = seeded(31);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, w, h);                               /* mortar */
    const bw = 256 / 4.6, bh = 256 / 14.5;                                          /* 21.7 x 6.9 cm bricks, 1 m tile */
    for (let r = 0; r < 15; r++) for (let c = -1; c < 6; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh, k = .82 + rnd() * .3;
      g.fillStyle = `rgb(${base.map(v => Math.min(255, Math.round(v * k))).join(',')})`;
      g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      if (rnd() < .3) { g.fillStyle = 'rgba(90,70,50,.12)'; g.fillRect(x + 1.5, y + 1.5, bw - 3, (bh - 3) / 2); }
    }
  });
}
export function sidingTex() {
  const rnd = seeded(17);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e9e0cc'; g.fillRect(0, 0, w, h);
    const rows = 7;                                                                 /* 14 cm courses */
    for (let r = 0; r < rows; r++) {
      const y = r * h / rows;
      g.fillStyle = 'rgba(120,100,70,.35)'; g.fillRect(0, y, w, 2.5);                /* the shadow line under each course */
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y + 3, w, 3);
      for (let x = rnd() * 40; x < w; x += 18 + rnd() * 30) { g.fillStyle = 'rgba(120,100,70,.18)'; g.fillRect(x, y, 1.2, h / rows); }
    }
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '120,100,70'},.04)`; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
  });
}
export function roofTex() {
  const rnd = seeded(9);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6e6e70'; g.fillRect(0, 0, w, h);
    const rows = 5, tw = w / 3;
    for (let r = 0; r < rows; r++) for (let c = -1; c < 4; c++) {
      const x = c * tw + (r % 2 ? tw / 2 : 0), y = r * h / rows, k = .78 + rnd() * .35;
      g.fillStyle = `rgb(${Math.round(104 * k)},${Math.round(104 * k)},${Math.round(106 * k)})`; g.fillRect(x + 1, y + 1, tw - 2, h / rows - 3);
      g.fillStyle = 'rgba(30,30,32,.45)'; g.fillRect(x, y + h / rows - 3, tw, 3);
    }
    for (let i = 0; i < 4000; i++) { const v = 60 + rnd() * 90; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(rnd() * w, rnd() * h, 1, 1); }
  });
}
/* brick pavers in a basket weave: pairs of 20 x 10 cm bricks turned alternately, sand in the joints; the tile is 80 cm */
export function paverTex(tone = [190, 164, 136]) {
  const rnd = seeded(5);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9ab94'; g.fillRect(0, 0, w, h);
    const u = w / 8;                                                          /* 10 cm */
    const brick = (x, y, bw, bh) => {
      const k = .86 + rnd() * .22, c = tone.map(v => Math.round(Math.min(255, v * k)));
      g.fillStyle = `rgb(${c.join(',')})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(255,245,230,.08)'; g.fillRect(x + 2, y + 2, bw - 4, 3);
      if (rnd() < .3) { g.fillStyle = 'rgba(70,50,35,.1)'; g.fillRect(x + 2 + rnd() * bw * .5, y + 2, bw * .4, bh - 4); }
    };
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 2 * u, y = j * 2 * u;
      if ((i + j) % 2) { brick(x, y, 2 * u, u); brick(x, y + u, 2 * u, u); } else { brick(x, y, u, 2 * u); brick(x + u, y, u, 2 * u); }
    }
    for (let i = 0; i < 2200; i++) { const v = rnd(); g.fillStyle = v < .5 ? 'rgba(60,45,35,.06)' : 'rgba(255,250,240,.05)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  });
}
export function poolTex() {
  const rnd = seeded(3);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#bfe3ea'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { g.fillStyle = `rgba(120,180,200,${.1 + rnd() * .15})`; g.fillRect(x + 1, y + 1, 14, 14); }
  });
}
/* the band of blue mosaic at the waterline: 2.5 cm tiles in three blues */
export function mosaicTex() {
  const rnd = seeded(8);
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#e8eef0'; g.fillRect(0, 0, w, h);
    const pal = ['#1f4f8c', '#2e6fb0', '#4b8fc9', '#16407a', '#6aa6d6'];
    for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { g.fillStyle = pal[Math.floor(rnd() * pal.length)]; g.fillRect(x + 1, y + 1, 6, 6); }
    /* the wave pattern of lighter tiles */
    for (let x = 0; x < w; x += 8) { const y = Math.round((Math.sin(x / w * Math.PI * 4) * .3 + .5) * (h - 8) / 8) * 8; g.fillStyle = '#9cc8ea'; g.fillRect(x + 1, y + 1, 6, 6); }
  }, 1, 1);
}
export function stoneTex() {
  const rnd = seeded(21);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e4dfd4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { const v = 170 + rnd() * 70; g.fillStyle = `rgba(${v},${v - 6},${v - 14},.4)`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    g.fillStyle = 'rgba(120,110,95,.5)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  });
}
/* a pool cover: a heavy dark green tarp with a drawstring edge and puddles */
export function coverTex() {
  const rnd = seeded(44);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#23372e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 40; const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(40,60,60,.5)'); gr.addColorStop(1, 'rgba(40,60,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(10,20,15,.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(rnd() * w, 0); g.lineTo(rnd() * w, h); g.stroke(); }
  });
}
