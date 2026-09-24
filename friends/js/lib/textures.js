import * as THREE from 'three';
import { canvasTex, normalTex, seeded } from './util.js';

const shade = (hex, k) => {
  const c = new THREE.Color(hex); c.multiplyScalar(k);
  return '#' + c.getHexString();
};

/* ---------- floors ---------- */

/* Monica's parquet: 4:1 planks in herringbone. H(n) = [n, n+4] x [n, n+1] and V(n) = [n, n+1] x [n+1, n+5]
   tile the plane with period 8 units both ways, so each plank's look depends only on n mod 8. */
export function herringbone() {
  const U = 64, S = U * 8, rnd = seeded(31);
  const tones = [0, 1].map(() => Array.from({ length: 8 }, () => [.86 + rnd() * .26, rnd()]));
  const each = fn => {
    for (let k = -2; k <= 2; k++) for (let n = -9; n <= 17; n++) {
      fn(n, n + 8 * k, 4, 1, tones[0][((n % 8) + 8) % 8]);
      fn(n, n + 1 + 8 * k, 1, 4, tones[1][((n % 8) + 8) % 8]);
    }
  };
  const map = canvasTex(S, S, g => {
    g.fillStyle = '#6b4424'; g.fillRect(0, 0, S, S);
    each((x, y, w, h, [k, s]) => {
      const X = x * U, Y = y * U, Wp = w * U, Hp = h * U;
      if (X > S || Y > S || X + Wp < 0 || Y + Hp < 0) return;
      g.fillStyle = shade(0xc28a52, k); g.fillRect(X + 1, Y + 1, Wp - 2, Hp - 2);
      g.strokeStyle = 'rgba(110,64,30,.22)'; g.lineWidth = 1;
      const horiz = w > h;
      for (let i = 0; i < 4; i++) {
        const o = ((s * 7 + i * .23) % 1) * (horiz ? Hp : Wp);
        g.beginPath();
        if (horiz) { g.moveTo(X, Y + o); g.bezierCurveTo(X + Wp * .3, Y + o + 3, X + Wp * .7, Y + o - 3, X + Wp, Y + o); }
        else { g.moveTo(X + o, Y); g.bezierCurveTo(X + o + 3, Y + Hp * .3, X + o - 3, Y + Hp * .7, X + o, Y + Hp); }
        g.stroke();
      }
    });
  });
  const normal = normalTex(S, S, g => {
    g.fillStyle = '#202020'; g.fillRect(0, 0, S, S);
    each((x, y, w, h) => { g.fillStyle = '#a8a8a8'; g.fillRect(x * U + 1.5, y * U + 1.5, w * U - 3, h * U - 3); });
  }, 2.4);
  for (const t of [map, normal]) { t.repeat.set(1 / .52, 1 / .52); t.rotation = Math.PI / 4; }
  return { map, normal };
}

/* the guys' parquet: squares of three strips, alternating direction */
export function basketweave() {
  const S = 384, q = S / 2, st = q / 3, rnd = seeded(47);
  const strips = Array.from({ length: 12 }, () => .84 + rnd() * .3);
  const map = canvasTex(S, S, g => {
    g.fillStyle = '#5a3a20'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let s = 0; s < 3; s++) {
      const k = strips[(i * 2 + j) * 3 + s], X = i * q, Y = j * q, horiz = (i + j) % 2 === 0;
      g.fillStyle = shade(0xa8703f, k);
      if (horiz) g.fillRect(X + 1, Y + s * st + 1, q - 2, st - 2); else g.fillRect(X + s * st + 1, Y + 1, st - 2, q - 2);
      g.strokeStyle = 'rgba(80,45,20,.2)';
      for (let l = 0; l < 3; l++) {
        const o = (l + .5) / 3 * (st - 4) + 2; g.beginPath();
        if (horiz) { g.moveTo(X, Y + s * st + o); g.lineTo(X + q, Y + s * st + o + (l - 1) * 1.5); }
        else { g.moveTo(X + s * st + o, Y); g.lineTo(X + s * st + o + (l - 1) * 1.5, Y + q); }
        g.stroke();
      }
    }
  });
  const normal = normalTex(S, S, g => {
    g.fillStyle = '#202020'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let s = 0; s < 3; s++) {
      const X = i * q, Y = j * q; g.fillStyle = '#a8a8a8';
      if ((i + j) % 2 === 0) g.fillRect(X + 1.5, Y + s * st + 1.5, q - 3, st - 3); else g.fillRect(X + s * st + 1.5, Y + 1.5, st - 3, q - 3);
    }
  }, 2.2);
  for (const t of [map, normal]) t.repeat.set(1 / .5, 1 / .5);
  return { map, normal };
}

export function checker(a = '#f2f0ea', b = '#1f1f22', size = .25) {
  const map = canvasTex(128, 128, g => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? b : a; g.fillRect(i * 64, j * 64, 64, 64); }
    g.strokeStyle = 'rgba(120,120,120,.5)'; g.lineWidth = 1.5; g.strokeRect(0, 0, 64, 64); g.strokeRect(64, 64, 64, 64);
  });
  map.repeat.set(1 / (size * 2), 1 / (size * 2));
  return map;
}

export function tiles(base, grout, rep = 1 / 1.3) {
  const grid = g => {
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke();
    }
  };
  const map = canvasTex(128, 128, g => { g.fillStyle = base; g.fillRect(0, 0, 128, 128); g.strokeStyle = grout; g.lineWidth = 3; grid(g); });
  const normal = normalTex(128, 128, g => { g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#303030'; g.lineWidth = 3; grid(g); }, 2.2);
  map.repeat.set(rep, rep); normal.repeat.set(rep, rep);
  return { map, normal };
}

export function speckle(base, dots, rep = 1) {
  const rnd = seeded(61);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = dots[Math.floor(rnd() * dots.length)];
      g.globalAlpha = .25 + rnd() * .4; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.4, 1 + rnd() * 2.4);
    }
    g.globalAlpha = 1;
  }, rep, rep);
}

/* ---------- brick: 6 bricks by 16 courses in 1.2 m, running bond ---------- */
export function brick(palette, mortar) {
  const S = 512, bw = S / 6, ch = S / 16, rnd = seeded(palette.length * 7 + 3);
  const tone = Array.from({ length: 6 * 16 }, () => [palette[Math.floor(rnd() * palette.length)], .88 + rnd() * .22, rnd()]);
  const each = fn => {
    for (let r = 0; r < 16; r++) for (let c = -1; c < 7; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), idx = r * 6 + ((c % 6) + 6) % 6;
      fn(x, r * ch, tone[idx]);
    }
  };
  const map = canvasTex(S, S, g => {
    g.fillStyle = mortar; g.fillRect(0, 0, S, S);
    each((x, y, [col, k, s]) => {
      g.fillStyle = shade(col, k); g.fillRect(x + 2.5, y + 2.5, bw - 5, ch - 5);
      g.fillStyle = `rgba(255,235,215,${.05 + s * .06})`; g.fillRect(x + 4, y + 3, (bw - 8) * s, 3);
      g.fillStyle = 'rgba(40,15,8,.12)'; g.fillRect(x + 2.5, y + ch - 7, bw - 5, 4.5);
      if (s > .82) { g.fillStyle = 'rgba(230,220,205,.25)'; g.fillRect(x + bw * .2, y + 4, bw * .4, ch - 9); }
    });
  });
  const normal = normalTex(S, S, g => {
    g.fillStyle = '#303030'; g.fillRect(0, 0, S, S);
    each((x, y) => { g.fillStyle = '#b0b0b0'; g.fillRect(x + 3, y + 3, bw - 6, ch - 6); });
  }, 2.6);
  for (const t of [map, normal]) t.repeat.set(1 / 1.2, 1 / 1.2);
  return { map, normal };
}

/* ---------- rugs and fabrics ---------- */
export function rugFloral() {
  const rnd = seeded(71);
  const map = canvasTex(512, 360, (g, w, h) => {
    g.fillStyle = '#28304d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8dcc1'; g.fillRect(26, 26, w - 52, h - 52);
    g.strokeStyle = '#b29762'; g.lineWidth = 3; g.strokeRect(38, 38, w - 76, h - 76);
    const flower = (x, y, r, c) => {
      g.fillStyle = '#8ea879';
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + x; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, r * .9, r * .45, a, 0, 7); g.fill(); }
      g.fillStyle = c; for (let k = 0; k < 6; k++) { const a = k * 1.047; g.beginPath(); g.arc(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .5, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,240,220,.5)'; g.beginPath(); g.arc(x, y, r * .3, 0, 7); g.fill();
    };
    const cols = ['#d7899b', '#b9505e', '#86a4c9', '#e2c16f', '#c98fb8'];
    for (let i = 0; i < 44; i++) flower(50 + rnd() * (w - 100), 50 + rnd() * (h - 100), 7 + rnd() * 9, cols[i % cols.length]);
    g.strokeStyle = '#b29762'; g.lineWidth = 4; g.beginPath(); g.ellipse(w / 2, h / 2, 110, 70, 0, 0, 7); g.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; flower(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 36, 12, cols[i % cols.length]); }
    flower(w / 2, h / 2, 20, '#b9505e');
    for (let x = 0; x < w; x += 18) for (const y of [8, h - 16]) { g.fillStyle = '#c9b27f'; g.fillRect(x + 4, y, 8, 8); }
  });
  return { map, normal: pileNormal(3) };
}

export function rugZigzag() {
  const map = canvasTex(512, 360, (g, w, h) => {
    g.fillStyle = '#e7e1d3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1e1e20'; g.lineWidth = 7; g.lineJoin = 'miter';
    for (const y of [36, h - 36]) for (const off of [0, 16]) {
      g.beginPath();
      for (let x = 20, i = 0; x <= w - 20; x += 22, i++) g.lineTo(x, y + off * (y < h / 2 ? 1 : -1) + (i % 2 ? -9 : 9));
      g.stroke();
    }
    g.fillStyle = '#c9a7a0'; g.fillRect(w * .3, h * .38, w * .4, h * .24);
    g.fillStyle = '#6d6a66';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(w * .32 + i * 42, h * .6); g.lineTo(w * .35 + i * 42, h * .4); g.lineTo(w * .38 + i * 42, h * .6); g.fill(); }
    g.strokeStyle = '#1e1e20'; g.lineWidth = 3; g.strokeRect(w * .3, h * .38, w * .4, h * .24);
    g.fillStyle = '#b8b2a4'; for (const x of [70, w - 90]) g.fillRect(x, h * .45, 20, h * .1);
  });
  return { map, normal: pileNormal(3) };
}

export function floralDrape() {
  const rnd = seeded(83);
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#efe3c9'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 10, c = rnd() < .5 ? '#c24e59' : '#df8e9a';
      g.strokeStyle = '#6f8f5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + r); g.quadraticCurveTo(x + 8, y + r * 3, x - 4, y + r * 4.2); g.stroke();
      g.fillStyle = '#7f9d66'; g.beginPath(); g.ellipse(x + 9, y + r * 2.6, 11, 4, .7, 0, 7); g.fill();
      for (const [dx, dy] of [[-.2, 0], [.2, 0], [0, -.3]]) {
        for (const ox of [0, w, -w]) { g.fillStyle = c; g.beginPath(); g.ellipse(x + ox + dx * r * 2, y + dy * r, r * .45, r, dx * 2, 0, 7); g.fill(); }
      }
    }
  }, 1, 1);
}

export function plaid(bg = '#b1a0c6', band = '#6f5e92', fine = '#e8e4f0') {
  return canvasTex(64, 64, g => {
    g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
    g.globalAlpha = .75; g.strokeStyle = band; g.lineWidth = 7;
    for (let i = 0; i < 2; i++) {
      g.beginPath(); g.moveTo(i * 32 + 8, 0); g.lineTo(i * 32 + 8, 64); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32 + 8); g.lineTo(64, i * 32 + 8); g.stroke();
    }
    g.globalAlpha = 1; g.strokeStyle = fine; g.lineWidth = 1.6;
    for (let i = 0; i < 2; i++) {
      g.beginPath(); g.moveTo(i * 32 + 24, 0); g.lineTo(i * 32 + 24, 64); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32 + 24); g.lineTo(64, i * 32 + 24); g.stroke();
    }
  }, 2, 2);
}

export function floral(bg, dot, leaf, rep = 3) {
  const rnd = seeded(8);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.fillStyle = leaf; g.beginPath(); g.ellipse(x + 5, y + 4, 4, 2, .6, 0, 7); g.fill();
      g.fillStyle = dot; for (let k = 0; k < 5; k++) { const a = k * 1.256; g.beginPath(); g.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.2, 0, 7); g.fill(); }
      g.fillStyle = '#f3e3a0'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill();
    }
  }, rep, rep);
}

export function patchwork(cols) {
  const rnd = seeded(97);
  return canvasTex(128, 128, g => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(i * 32, j * 32, 32, 32);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeRect(i * 32 + .5, j * 32 + .5, 31, 31);
      if (rnd() < .4) { g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 4; k++) g.fillRect(i * 32 + 4 + k * 7, j * 32 + 4, 3, 24); }
    }
  });
}

/* ---------- surface normals ---------- */
export function pileNormal(rep = 4) {
  const rnd = seeded(5);
  return normalTex(128, 128, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      const v = rnd() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`;
      g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    }
  }, 1.2, rep, rep);
}

export function fabricNormal() {
  return normalTex(64, 64, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const tx = x % 8, ty = y % 8, over = ((x >> 3) + (y >> 3)) % 2;
      const v = 90 + 120 * (over ? Math.sin(Math.PI * ty / 8) : Math.sin(Math.PI * tx / 8));
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, 1.4, 5, 5);
}

export function plasterNormal() {
  const rnd = seeded(3);
  return normalTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = rnd() < .5 ? '255,255,255' : '0,0,0';
      gr.addColorStop(0, `rgba(${c},.07)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
    }
  }, 1, .5, .5);
}

/* raised panels for a wainscot band from y .14 to .98, one panel per 0.6 m */
export function panelNormal() {
  const t = normalTex(128, 180, (g, w, h) => {
    g.fillStyle = '#707070'; g.fillRect(0, 0, w, h);
    const x0 = 14, y0 = 20, x1 = w - 14, y1 = h - 20, b = 9;
    g.fillStyle = '#9a9a9a'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = '#c4c4c4'; g.fillRect(x0 + b, y0 + b, x1 - x0 - 2 * b, y1 - y0 - 2 * b);
    g.strokeStyle = '#505050'; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }, 3);
  t.repeat.set(1 / .6, 1 / .84); t.offset.set(0, -.14 / .84);
  return t;
}

/* ---------- stage-mode surfaces ---------- */
export function plywood() {
  const rnd = seeded(17);
  const t = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#d2b27c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, a = .04 + rnd() * .08;
      g.strokeStyle = `rgba(120,80,40,${a})`; g.lineWidth = .6 + rnd() * 1.8; g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * .02 + i) * 6, y);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.fillStyle = 'rgba(110,70,35,.35)'; g.beginPath(); g.ellipse(x, y, 5, 9, 0, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(70,45,20,.55)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
  t.repeat.set(1 / 1.22, 1 / 2.44);
  return t;
}

export function concrete() {
  const rnd = seeded(29);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#4a494c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = rnd() < .5 ? 255 : 0;
      g.fillStyle = `rgba(${v},${v},${v},${.015 + rnd() * .035})`;
      const r = 2 + rnd() * 30; g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  }, 30, 30);
}

/* ---------- the street across from the windows: Village walk-ups ----------
   One window, straight across from Monica's, belongs to Ugly Naked Guy: lit at night, blind half down. */
export const UNG = { u: .565, v: .555 };
export function facade() {
  const W = 2048, H = 1024, pxm = W / 60, rnd = seeded(21);
  const blds = [
    { x0: 0, w: 13, h: 22, brick: '#8b4a3b', trim: '#d9cfbd', escape: true },
    { x0: 13, w: 16, h: 24.5, brick: '#a0694f', trim: '#e6dccb', tower: true },
    { x0: 29, w: 15, h: 23, brick: '#7a4a40', trim: '#cfc4b1', escape: true },
    { x0: 44, w: 16, h: 21.5, brick: '#96573f', trim: '#e2d6c2' },
  ];
  const lit = []; let ung = null, best = 1e9;
  const map = canvasTex(W, H, g => {
    g.clearRect(0, 0, W, H);
    for (const b of blds) {
      const X = b.x0 * pxm, Wd = b.w * pxm, top = H - b.h * pxm;
      g.fillStyle = b.brick; g.fillRect(X, top, Wd, H - top);
      g.fillStyle = 'rgba(0,0,0,.10)';
      for (let y = top; y < H; y += 3) g.fillRect(X, y, Wd, 1);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,230,210' : '40,10,5'},.06)`; g.fillRect(X + rnd() * Wd, top + rnd() * (H - top), 6, 3); }
      g.fillStyle = b.trim; g.fillRect(X - 6, top - 4, Wd + 12, 16); g.fillRect(X, top + 20, Wd, 5);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X - 6, top + 12, Wd + 12, 3);
      const floorH = 3.2 * pxm, winW = 1.15 * pxm, winH = 1.75 * pxm, pitch = 2.5 * pxm;
      const cols = Math.floor((Wd - pxm) / pitch), offX = X + (Wd - cols * pitch) / 2 + (pitch - winW) / 2;
      for (let fy = top + 1.35 * pxm; fy + winH < H - .6 * pxm; fy += floorH) {
        for (let c = 0; c < cols; c++) {
          const wx = offX + c * pitch;
          g.fillStyle = b.trim; g.fillRect(wx - 6, fy - 8, winW + 12, 7); g.fillRect(wx - 5, fy + winH, winW + 10, 6);
          g.fillStyle = '#e8e2d6'; g.fillRect(wx, fy, winW, winH);
          const s = rnd();
          g.fillStyle = s < .3 ? '#26303b' : s < .65 ? '#333d4a' : '#434d59';
          g.fillRect(wx + 4, fy + 4, winW - 8, winH - 8);
          g.fillStyle = '#e8e2d6'; g.fillRect(wx, fy + winH * .47, winW, 4);
          if (rnd() < .38) { g.fillStyle = rnd() < .5 ? '#d9cfb8' : '#b98f6a'; g.fillRect(wx + 4, fy + 4, winW - 8, (winH - 8) * (.2 + rnd() * .55)); }
          g.fillStyle = 'rgba(210,225,240,.10)'; g.fillRect(wx + 4, fy + 4, (winW - 8) * .45, winH - 8);
          const d = Math.hypot((wx + winW / 2) / W - UNG.u, 1 - (fy + winH / 2) / H - UNG.v);
          if (d < best) { best = d; ung = [wx + 4, fy + 4, winW - 8, winH - 8]; }
          if (rnd() < .4) lit.push([wx + 4, fy + 4, winW - 8, winH - 8, rnd()]);
        }
      }
      if (b.escape) {
        g.strokeStyle = '#1d1d1f'; g.fillStyle = '#1d1d1f'; g.lineWidth = 3;
        const ex = offX + pitch - 10, ew = pitch * 2 - winW / 2;
        for (let fy = top + 1.35 * pxm + winH; fy < H - 2 * pxm; fy += floorH) {
          g.fillRect(ex, fy + 2, ew, 5);
          for (let k = 0; k <= 8; k++) g.fillRect(ex + k * ew / 8, fy - 22, 2, 24);
          g.fillRect(ex, fy - 22, ew, 2);
          g.beginPath(); g.moveTo(ex + ew * .15, fy + 4); g.lineTo(ex + ew * .8, fy + floorH); g.stroke();
        }
      }
      if (b.tower) {
        const tx = X + Wd * .62, tw = 4.2 * pxm, legs = 3 * pxm, th = 4.4 * pxm, base = top - 4;
        g.fillStyle = '#2a2320';
        for (let k = 0; k < 4; k++) g.fillRect(tx + k * (tw - 6) / 3, base - legs, 6, legs);
        g.fillRect(tx - 6, base - legs - 4, tw + 12, 6);
        g.fillStyle = '#6b4a33'; g.fillRect(tx, base - legs - th, tw, th);
        g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 1; k < 5; k++) g.fillRect(tx, base - legs - th + k * th / 5, tw, 3);
        g.fillStyle = '#4a3325'; g.beginPath(); g.moveTo(tx - 8, base - legs - th); g.lineTo(tx + tw / 2, base - legs - th - 2.2 * pxm); g.lineTo(tx + tw + 8, base - legs - th); g.fill();
      }
      g.fillStyle = '#6f6862'; g.fillRect(X + Wd * .08, top - 1.1 * pxm, .9 * pxm, 1.1 * pxm);
      g.fillStyle = '#222'; g.fillRect(X + Wd * .85, top - 2.6 * pxm, 3, 2.6 * pxm);
    }
    if (ung) {
      /* a bigger double window, frame and all */
      const [x0, y0, w0, h0] = ung, x = x0 - w0 * .35, y = y0 - h0 * .08, w = w0 * 1.7, h = h0 * 1.12; ung = [x, y, w, h];
      g.fillStyle = '#e8e2d6'; g.fillRect(x - 8, y - 8, w + 16, h + 16);
      g.fillStyle = '#2c333d'; g.fillRect(x, y, w, h);
      g.fillStyle = '#e8e2d6'; g.fillRect(x + w / 2 - 3, y, 6, h); g.fillRect(x, y + h * .5 - 3, w, 6);
      g.fillStyle = '#d8c7a4'; g.fillRect(x, y, w, h * .22);
    }
  });
  const lights = canvasTex(W, H, g => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (const [x, y, w, h, k] of lit) { g.fillStyle = k < .7 ? '#ffcf85' : k < .9 ? '#ffe6b5' : '#a8c4ff'; g.fillRect(x, y, w, h); }
    if (ung) {
      const [x, y, w, h] = ung;
      g.fillStyle = '#ffd08a'; g.fillRect(x, y, w, h);
      g.fillStyle = '#9a7648'; g.fillRect(x, y, w, h * .22);
      g.fillStyle = '#5a4630'; g.fillRect(x + w / 2 - 3, y, 6, h); g.fillRect(x, y + h * .5 - 3, w, 6);
      /* a round silhouette, arms up, mid-exercise */
      g.fillStyle = '#2e1c0e';
      g.beginPath(); g.ellipse(x + w * .42, y + h * .78, w * .17, h * .2, 0, 0, 7); g.fill();
      g.beginPath(); g.arc(x + w * .42, y + h * .47, w * .085, 0, 7); g.fill();
      g.save(); g.translate(x + w * .42, y + h * .62);
      for (const s of [-1, 1]) { g.save(); g.rotate(s * .5); g.fillRect(s * w * .1 - w * .025, -h * .32, w * .05, h * .3); g.restore(); }
      g.restore();
    }
  });
  for (const t of [map, lights]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; }
  return { map, lights, size: [60, 30] };
}

/* ---------- signs and labels ---------- */
export function plateTex(text) {
  return canvasTex(128, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8b465'); gr.addColorStop(1, '#9c7a36');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6e5424'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#2a2116'; g.font = 'bold 38px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

/* brass numerals screwed straight onto a door */
export function numeralTex(text) {
  const t = canvasTex(128, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 10, 0, h - 10); gr.addColorStop(0, '#f1d58a'); gr.addColorStop(.5, '#c79b45'); gr.addColorStop(1, '#8e6a2a');
    g.font = 'italic 600 78px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText(text, w / 2 + 3, h / 2 + 5);
    g.fillStyle = gr; g.fillText(text, w / 2, h / 2 + 2);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function applauseTex() {
  const draw = on => (g, w, h) => {
    g.fillStyle = '#0d0b0b'; g.fillRect(0, 0, w, h);
    g.font = 'bold 84px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (on) { g.shadowColor = '#ff3a2a'; g.shadowBlur = 18; }
    g.fillStyle = on ? '#ff4a36' : '#3a1512'; g.fillText('APPLAUSE', w / 2, h / 2 + 4);
  };
  return { map: canvasTex(512, 128, draw(false)), emissive: canvasTex(512, 128, draw(true)) };
}

export function stencilTex(text) {
  const t = canvasTex(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,24,18,.8)'; g.font = 'bold 54px Courier New, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
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

/* ---------- posters and pictures ---------- */
const clampTex = t => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };

/* a toy-shop poster in the manner of Jules Chéret's Aux Buttes Chaumont posters (1890s) */
export function jouetsPoster() {
  return clampTex(canvasTex(256, 352, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6e6b6'); gr.addColorStop(.55, '#f0c56b'); gr.addColorStop(1, '#d9843c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a8321f'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#8a2a1a'; g.textAlign = 'center';
    g.font = 'bold 17px Georgia, serif'; g.fillText('AUX BUTTES CHAUMONT', w / 2, 34);
    g.font = 'italic 13px Georgia, serif'; g.fillText('grands magasins', w / 2, 52);
    /* the rocking horse */
    g.fillStyle = '#7a3b1f'; g.beginPath(); g.ellipse(w / 2, 262, 88, 16, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#f7f1e2'; g.beginPath(); g.ellipse(w / 2, 196, 62, 30, -.05, 0, 7); g.fill();
    g.beginPath(); g.moveTo(w / 2 + 40, 184); g.quadraticCurveTo(w / 2 + 70, 120, w / 2 + 88, 118); g.lineTo(w / 2 + 96, 146); g.quadraticCurveTo(w / 2 + 70, 160, w / 2 + 58, 200); g.fill();
    g.fillStyle = '#2b2522'; g.beginPath(); g.moveTo(w / 2 + 50, 150); g.quadraticCurveTo(w / 2 + 64, 112, w / 2 + 86, 112); g.lineTo(w / 2 + 78, 128); g.quadraticCurveTo(w / 2 + 66, 132, w / 2 + 58, 168); g.fill();
    g.fillStyle = '#c8341f'; g.fillRect(w / 2 - 22, 170, 40, 22);
    g.fillStyle = '#f7f1e2'; for (const x of [-44, -22, 24, 44]) g.fillRect(w / 2 + x - 5, 214, 10, 44);
    g.strokeStyle = '#2b2522'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 60, 196); g.quadraticCurveTo(w / 2 - 92, 220, w / 2 - 80, 250); g.stroke();
    g.fillStyle = '#c8341f'; g.font = 'bold 56px Georgia, serif'; g.fillText('JOUETS', w / 2, 330);
  }));
}

/* a French serial poster, red and black */
export function mysteresPoster() {
  return clampTex(canvasTex(240, 340, (g, w, h) => {
    g.fillStyle = '#c42a1f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f1d27a'; g.fillRect(0, 0, w, 64);
    g.fillStyle = '#1b1414'; g.textAlign = 'center';
    g.font = 'bold 20px Georgia, serif'; g.fillText('LES MYSTÈRES', w / 2, 28); g.fillText('DE NEW-YORK', w / 2, 54);
    g.fillStyle = '#f3dcc6'; g.beginPath(); g.ellipse(w / 2, 170, 44, 56, 0, 0, 7); g.fill();
    g.fillStyle = '#1b1414'; g.beginPath(); g.ellipse(w / 2, 142, 60, 42, 0, Math.PI, 0); g.fill();
    g.fillRect(w / 2 - 60, 142, 18, 70); g.fillRect(w / 2 + 42, 142, 18, 70);
    g.fillStyle = '#8a1a14'; g.beginPath(); g.ellipse(w / 2, 196, 12, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#1b1414'; g.fillRect(w / 2 - 22, 160, 14, 5); g.fillRect(w / 2 + 8, 160, 14, 5);
    g.beginPath(); g.moveTo(10, h); g.lineTo(w / 2, 238); g.lineTo(w - 10, h); g.fill();
    g.fillStyle = '#f1d27a'; g.font = 'bold 16px Georgia, serif'; g.fillText('GRAND ROMAN-CINÉMA', w / 2, h - 22);
  }));
}

/* two comics in bowler hats, a thin one and a stout one, in black and white */
export function comicsPhoto() {
  const rnd = seeded(5);
  return clampTex(canvasTex(300, 220, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b9b6b0'); gr.addColorStop(1, '#6c6a66');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const man = (x, fat) => {
      g.fillStyle = '#1c1c1c'; g.fillRect(x - (fat ? 46 : 28), 110, fat ? 92 : 56, 120);
      g.fillStyle = '#e6e3dc'; g.fillRect(x - 10, 110, 20, 30);
      g.fillStyle = '#d8d3c8'; g.beginPath(); g.ellipse(x, 84, fat ? 30 : 22, fat ? 30 : 26, 0, 0, 7); g.fill();
      g.fillStyle = '#141414'; g.beginPath(); g.ellipse(x, 58, fat ? 34 : 27, 8, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x, 50, fat ? 22 : 18, 16, 0, Math.PI, 0); g.fill();
      g.fillRect(x - 8, 118, 16, 6);
    };
    man(92, false); man(200, true);
    for (let i = 0; i < 1400; i++) { const v = rnd() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},.08)`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    g.strokeStyle = '#f2efe8'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  }));
}

/* Rachel's painted poster: a man in a hat, FILM NOIR across the foot */
export function noirPoster() {
  return clampTex(canvasTex(320, 240, (g, w, h) => {
    g.fillStyle = '#efe0c8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d88a6a'; g.beginPath(); g.ellipse(w * .45, h * .45, 62, 74, .2, 0, 7); g.fill();
    g.fillStyle = '#b8563f'; g.beginPath(); g.ellipse(w * .4, h * .5, 30, 60, .2, 0, 7); g.fill();
    g.fillStyle = '#6a2e22'; g.beginPath(); g.ellipse(w * .47, h * .18, 96, 20, .15, 0, 7); g.fill();
    g.beginPath(); g.ellipse(w * .47, h * .12, 54, 30, .15, Math.PI, 0); g.fill();
    g.fillStyle = '#e6c27a'; g.fillRect(w * .62, h * .3, 70, 90);
    g.fillStyle = '#c42a2a'; g.font = 'bold 38px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('FILM NOIR', w / 2, h - 18);
    g.strokeStyle = '#8a6a4a'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  }));
}

/* three panels in one frame, over Monica's bed */
export function triptych() {
  return clampTex(canvasTex(384, 160, (g, w, h) => {
    g.fillStyle = '#f1ead8'; g.fillRect(0, 0, w, h);
    const p = w / 3;
    g.fillStyle = '#2c4a8a'; g.beginPath(); g.ellipse(p * .5, h * .5, 34, 50, 0, 0, 7); g.fill();
    g.fillStyle = '#f1ead8'; g.beginPath(); g.ellipse(p * .56, h * .42, 12, 16, 0, 0, 7); g.fill();
    const cols = ['#c83a2a', '#2c7a4a', '#e0b030', '#2c4a8a'];
    for (let i = 0; i < 4; i++) { g.strokeStyle = cols[i]; g.lineWidth = 9; g.beginPath(); g.arc(p * 1.5, h * .5, 16 + i * 12, 0, 7); g.stroke(); }
    g.fillStyle = '#d8642a'; g.beginPath(); g.arc(p * 2.5, h * .5, 46, 0, 7); g.fill();
    g.fillStyle = '#f0c040'; g.beginPath(); g.arc(p * 2.5, h * .5, 22, 0, 7); g.fill();
    g.fillStyle = '#2a2622'; g.fillRect(p - 3, 0, 6, h); g.fillRect(2 * p - 3, 0, 6, h);
  }));
}

/* a boxing-bill poster for Joey's room, and a stout ad */
export function fightPoster() {
  return clampTex(canvasTex(220, 320, (g, w, h) => {
    g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b3261e'; g.fillRect(0, 0, w, 70); g.fillRect(0, h - 56, w, 56);
    g.fillStyle = '#f3e9d2'; g.font = 'bold 38px Arial Black, Arial, sans-serif'; g.textAlign = 'center';
    g.fillText('FIGHT', w / 2, 50);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 22px Arial, sans-serif'; g.fillText('SATURDAY NIGHT', w / 2, 104);
    for (const [x, c] of [[62, '#2a2a2a'], [158, '#6a3a24']]) {
      g.fillStyle = c; g.beginPath(); g.arc(x, 160, 22, 0, 7); g.fill(); g.fillRect(x - 26, 184, 52, 70);
      g.fillStyle = '#c8241e'; g.beginPath(); g.arc(x + (x < w / 2 ? 26 : -26), 196, 14, 0, 7); g.fill();
    }
    g.fillStyle = '#f3e9d2'; g.font = 'bold 20px Arial, sans-serif'; g.fillText('MADISON SQ.', w / 2, h - 22);
  }));
}
export function stoutPoster() {
  return clampTex(canvasTex(220, 320, (g, w, h) => {
    g.fillStyle = '#151515'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a120a'; g.beginPath(); g.moveTo(66, 90); g.lineTo(154, 90); g.lineTo(142, 262); g.lineTo(78, 262); g.fill();
    g.fillStyle = '#efe6cf'; g.beginPath(); g.ellipse(w / 2, 92, 46, 16, 0, 0, 7); g.fill(); g.fillRect(64, 88, 92, 18);
    g.fillStyle = '#d9c38a'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.fillText('STOUT', w / 2, 300);
    g.font = 'italic 14px Georgia, serif'; g.fillText('good for you', w / 2, 60);
  }));
}

export function corkboard() {
  const rnd = seeded(13);
  return clampTex(canvasTex(256, 180, (g, w, h) => {
    g.fillStyle = '#b98a58'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { g.fillStyle = rnd() < .5 ? 'rgba(90,55,25,.35)' : 'rgba(230,200,150,.3)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    const notes = [['#fff38a', 20, 18, 60, 50, -.1], ['#f4f1ea', 96, 12, 70, 56, .06], ['#9fd4f0', 178, 24, 58, 48, -.05],
      ['#f4f1ea', 30, 96, 80, 62, .08], ['#f7b6c2', 130, 100, 54, 46, -.12], ['#ffffff', 196, 92, 44, 64, .1]];
    for (const [c, x, y, nw, nh, r] of notes) {
      g.save(); g.translate(x + nw / 2, y + nh / 2); g.rotate(r);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-nw / 2 + 3, -nh / 2 + 3, nw, nh);
      g.fillStyle = c; g.fillRect(-nw / 2, -nh / 2, nw, nh);
      g.fillStyle = 'rgba(40,40,60,.55)'; for (let l = 0; l < 4; l++) g.fillRect(-nw / 2 + 6, -nh / 2 + 10 + l * 10, nw * (.4 + ((l * 37) % 5) / 10), 2);
      g.fillStyle = '#c8241e'; g.beginPath(); g.arc(0, -nh / 2 + 4, 3, 0, 7); g.fill();
      g.restore();
    }
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  }));
}

export function dartboardTex() {
  return clampTex(canvasTex(256, 256, (g, w) => {
    const c = w / 2; g.fillStyle = '#141414'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 20; i++) {
      const a0 = (i - .5) / 20 * Math.PI * 2 - Math.PI / 2, a1 = (i + .5) / 20 * Math.PI * 2 - Math.PI / 2;
      const ring = (r0, r1, col) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r1, a0, a1); g.arc(c, c, r0, a1, a0, true); g.fill(); };
      ring(12, 110, i % 2 ? '#e9dfc4' : '#1b1b1b');
      ring(68, 76, i % 2 ? '#2e8a4a' : '#c8241e');
      ring(102, 110, i % 2 ? '#2e8a4a' : '#c8241e');
    }
    g.fillStyle = '#2e8a4a'; g.beginPath(); g.arc(c, c, 12, 0, 7); g.fill();
    g.fillStyle = '#c8241e'; g.beginPath(); g.arc(c, c, 5, 0, 7); g.fill();
    g.fillStyle = '#e9dfc4'; g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5].forEach((n, i) => {
      const a = i / 20 * Math.PI * 2 - Math.PI / 2; g.fillText(n, c + Math.cos(a) * 119, c + Math.sin(a) * 119);
    });
  }));
}

export function foosField() {
  return clampTex(canvasTex(512, 280, (g, w, h) => {
    g.fillStyle = '#2f7a3c'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 8; i++) if (i % 2) g.fillRect(i * w / 8, 0, w / 8, h);
    g.strokeStyle = '#f2f2ea'; g.lineWidth = 4;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2, h - 10); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.stroke();
    g.strokeRect(10, h / 2 - 60, 60, 120); g.strokeRect(w - 70, h / 2 - 60, 60, 120);
  }));
}

/* simple framed pictures */
export function artTex(kind) {
  return clampTex(canvasTex(160, 200, (g, w, h) => {
    if (kind === 'flowers') {
      g.fillStyle = '#2e3a4a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#6a4a2a'; g.fillRect(w * .35, h * .62, w * .3, h * .3);
      for (let i = 0; i < 9; i++) { g.fillStyle = ['#e0708a', '#f0d070', '#e8e0d0', '#c84a5a'][i % 4]; g.beginPath(); g.arc(w * (.3 + (i * 37 % 40) / 100), h * (.3 + (i * 23 % 30) / 100), 14, 0, 7); g.fill(); }
    } else if (kind === 'photo') {
      g.fillStyle = '#d9cdb6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#8a7a5d'; g.fillRect(18, 30, w - 36, h - 80); g.fillStyle = '#bfae8d'; g.fillRect(30, 46, w - 60, 40);
    } else if (kind === 'sketch') {
      g.fillStyle = '#f1ece0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#6a5a4a'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(20, 40 + i * 22); g.bezierCurveTo(60, 20 + i * 24, 100, 70 + i * 18, 140, 44 + i * 22); g.stroke(); }
    } else {
      g.fillStyle = '#dfd8c6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9aa98f'; g.fillRect(12, h * .55, w - 24, h * .3); g.fillStyle = '#b9c8d6'; g.fillRect(12, 16, w - 24, h * .4);
      g.fillStyle = '#7d6b4f'; g.fillRect(12, h * .62, w - 24, 6);
    }
  }));
}
