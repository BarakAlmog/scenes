import * as THREE from 'three';
import { canvasTex, normalTex, seeded } from './util.js';

/* ---------- floors ---------- */
export function woodFloor() {
  const rows = 8;
  const map = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#c9a36e'; g.fillRect(0, 0, w, h);
    const ph = h / rows;
    for (let r = 0; r < rows; r++) {
      const tone = 18 - ((r * 53) % 36);
      g.fillStyle = `rgb(${201 + tone - 10},${163 + tone - 12},${110 + tone - 14})`;
      g.fillRect(0, r * ph, w, ph - 1.4);
      g.strokeStyle = 'rgba(120,85,45,.35)'; g.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = r * ph + (i * 7.3 + r * 5) % ph; g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(w * .3, y + 2, w * .6, y - 2, w, y + 1); g.stroke();
      }
      g.fillStyle = 'rgba(100,70,40,.5)';
      const sx = ((r * 197) % w); g.fillRect(sx, r * ph, 2, ph);
      g.fillStyle = 'rgba(90,60,35,.28)'; g.fillRect(0, r * ph + ph - 1.6, w, 1.6);
    }
  });
  const rnd = seeded(11);
  const normal = normalTex(512, 256, (g, w, h) => {
    const ph = h / rows;
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < 30; i++) {
        g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
        g.fillRect(0, r * ph + rnd() * ph, w, 1 + rnd() * 2);
      }
      g.fillStyle = '#2a2a2a'; g.fillRect(0, r * ph + ph - 1.8, w, 1.8);
      g.fillRect((r * 197) % w, r * ph, 2, ph);
    }
  }, 3);
  map.repeat.set(1 / 2.6, 1 / 1.3); normal.repeat.copy(map.repeat);
  return { map, normal };
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

export function rug() {
  const map = canvasTex(256, 180, (g, w, h) => {
    g.fillStyle = '#2d3645'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cfd3cd';
    for (let i = 0; i < 6; i++) { const y = 18 + i * 26; g.fillRect(10, y, w - 20, 3); g.fillRect(10, y + 7, w - 20, 1.6); }
    g.strokeStyle = '#cfd3cd'; g.lineWidth = 2; g.strokeRect(6, 6, w - 12, h - 12);
  });
  return { map, normal: pileNormal(4) };
}

export function hallCarpet() {
  const map = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6a2b2d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8913f'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.lineTo(0, h / 2); g.closePath(); g.stroke();
    g.fillStyle = '#8a3a36'; g.beginPath(); g.arc(w / 2, h / 2, 26, 0, 7); g.fill();
    g.fillStyle = '#c9a14a'; g.beginPath(); g.arc(w / 2, h / 2, 9, 0, 7); g.fill();
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
  }, 1 / 1.2, 1 / 1.2);
  const normal = pileNormal(1 / 1.2 * 4);
  return { map, normal };
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

/* raised panels for the wainscot band (one panel per 0.6 m, band from y .13 to .97) */
export function panelNormal() {
  const t = normalTex(128, 180, (g, w, h) => {
    g.fillStyle = '#707070'; g.fillRect(0, 0, w, h);
    const x0 = 14, y0 = 20, x1 = w - 14, y1 = h - 20, b = 9;
    g.fillStyle = '#9a9a9a'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = '#c4c4c4'; g.fillRect(x0 + b, y0 + b, x1 - x0 - 2 * b, y1 - y0 - 2 * b);
    g.strokeStyle = '#505050'; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }, 3);
  t.repeat.set(1 / .6, 1 / .84); t.offset.set(0, -.13 / .84);
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

/* ---------- the street outside the window ---------- */
export function facade() {
  const W = 2048, H = 1024, pxm = W / 60, rnd = seeded(21);
  const blds = [
    { x0: 0, w: 17, h: 21, brick: '#8b4a3b', trim: '#d9cfbd' },
    { x0: 17, w: 25, h: 24, brick: '#a0694f', trim: '#e6dccb', tower: true, escape: true },
    { x0: 42, w: 18, h: 19.5, brick: '#7a4a40', trim: '#cfc4b1' },
  ];
  const lit = [];
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
          if (rnd() < .4) lit.push([wx + 4, fy + 4, winW - 8, winH - 8, rnd()]);
        }
      }
      if (b.escape) {
        g.strokeStyle = '#1d1d1f'; g.fillStyle = '#1d1d1f'; g.lineWidth = 3;
        const ex = offX + pitch * 2 - 10, ew = pitch * 2 - winW / 2;
        for (let fy = top + 1.35 * pxm + winH; fy < H - 2 * pxm; fy += floorH) {
          g.fillRect(ex, fy + 2, ew, 5);
          for (let k = 0; k <= 8; k++) g.fillRect(ex + k * ew / 8, fy - 22, 2, 24);
          g.fillRect(ex, fy - 22, ew, 2);
          g.beginPath(); g.moveTo(ex + ew * .15, fy + 4); g.lineTo(ex + ew * .8, fy + floorH); g.stroke();
        }
      }
      if (b.tower) {
        const tx = X + Wd * .68, tw = 4.2 * pxm, legs = 3 * pxm, th = 4.4 * pxm, base = top - 4;
        g.fillStyle = '#2a2320';
        for (let k = 0; k < 4; k++) g.fillRect(tx + k * (tw - 6) / 3, base - legs, 6, legs);
        g.fillRect(tx - 6, base - legs - 4, tw + 12, 6);
        g.fillStyle = '#6b4a33'; g.fillRect(tx, base - legs - th, tw, th);
        g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 1; k < 5; k++) g.fillRect(tx, base - legs - th + k * th / 5, tw, 3);
        g.fillStyle = '#4a3325'; g.beginPath(); g.moveTo(tx - 8, base - legs - th); g.lineTo(tx + tw / 2, base - legs - th - 2.2 * pxm); g.lineTo(tx + tw + 8, base - legs - th); g.fill();
        g.fillStyle = '#5c5550'; g.fillRect(X + Wd * .2, top - 2.2 * pxm, 3.2 * pxm, 2.2 * pxm);
        g.fillRect(X + Wd * .45, top - 1.2 * pxm, 1.4 * pxm, 1.2 * pxm);
      }
      g.fillStyle = '#6f6862'; g.fillRect(X + Wd * .08, top - 1.1 * pxm, .9 * pxm, 1.1 * pxm);
      g.fillStyle = '#222'; g.fillRect(X + Wd * .85, top - 2.6 * pxm, 3, 2.6 * pxm);
    }
  });
  const lights = canvasTex(W, H, g => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (const [x, y, w, h, k] of lit) { g.fillStyle = k < .7 ? '#ffcf85' : k < .9 ? '#ffe6b5' : '#a8c4ff'; g.fillRect(x, y, w, h); }
  });
  for (const t of [map, lights]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; }
  return { map, lights, size: [60, 30] };
}

/* ---------- props ---------- */
export function cerealLabel(name, bg, fg) {
  return canvasTex(128, 192, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.fillRect(0, 0, w, 30); g.fillRect(0, h - 16, w, 16);
    g.fillStyle = bg; g.font = 'bold 13px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('CEREAL', w / 2, 20);
    g.fillStyle = '#fff'; g.font = 'bold 22px Arial Black, Arial, sans-serif';
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowOffsetY = 2;
    name.split(' ').forEach((wd, i) => g.fillText(wd, w / 2, 62 + i * 26));
    g.shadowColor = 'transparent';
    g.fillStyle = '#f5f1e8'; g.beginPath(); g.ellipse(w / 2, 150, 42, 14, 0, 0, Math.PI); g.fill();
    g.fillStyle = fg; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(w / 2 - 30 + (i * 37) % 60, 140 + (i * 13) % 9, 5, 0, 7); g.fill(); }
  });
}

export function plateTex(text) {
  return canvasTex(128, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8b465'); gr.addColorStop(1, '#9c7a36');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6e5424'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#2a2116'; g.font = 'bold 38px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
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

export function plaid() {
  return canvasTex(64, 64, g => {
    g.fillStyle = '#b1a0c6'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#6f5e92'; g.lineWidth = 7;
    for (let i = 0; i < 2; i++) {
      g.beginPath(); g.moveTo(i * 32 + 8, 0); g.lineTo(i * 32 + 8, 64); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32 + 8); g.lineTo(64, i * 32 + 8); g.stroke();
    }
    g.strokeStyle = '#e8e4f0'; g.lineWidth = 1.6;
    for (let i = 0; i < 2; i++) {
      g.beginPath(); g.moveTo(i * 32 + 24, 0); g.lineTo(i * 32 + 24, 64); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32 + 24); g.lineTo(64, i * 32 + 24); g.stroke();
    }
  }, 2, 2);
}

export function floral(bg, dot, leaf) {
  const rnd = seeded(8);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.fillStyle = leaf; g.beginPath(); g.ellipse(x + 5, y + 4, 4, 2, .6, 0, 7); g.fill();
      g.fillStyle = dot; for (let k = 0; k < 5; k++) { const a = k * 1.256; g.beginPath(); g.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.2, 0, 7); g.fill(); }
      g.fillStyle = '#f3e3a0'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill();
    }
  }, 3, 3);
}

export function softDot() {
  return canvasTex(64, 64, g => {
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}

/* world-domination board */
export function riskBoard() {
  return canvasTex(256, 176, (g, w, h) => {
    g.fillStyle = '#e9dfc4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b5a47c'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    const blobs = [['#c9a35a', 46, 52, 30, 20], ['#9ec07a', 120, 38, 26, 16], ['#c97f5a', 196, 58, 30, 22],
      ['#7fa3c9', 64, 124, 26, 18], ['#b48ac9', 150, 120, 30, 20], ['#c9c46a', 218, 128, 22, 16]];
    for (const [c, x, y, rx, ry] of blobs) {
      g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, (x + y) % 2, 0, 7); g.fill();
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 1.2; g.stroke();
    }
    g.strokeStyle = '#9a8a6a'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(60, 60); g.lineTo(120, 45); g.lineTo(196, 64); g.stroke();
    g.beginPath(); g.moveTo(70, 120); g.lineTo(150, 118); g.lineTo(214, 126); g.stroke();
  });
}

/* simple framed art */
export function artTex(kind) {
  return canvasTex(160, 200, (g, w, h) => {
    if (kind === 'cars') {
      g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, w, h);
      ['#b03a2a', '#2a4d8f', '#3a7a3f'].forEach((c, i) => {
        const y = 30 + i * 55; g.fillStyle = c; g.fillRect(25, y, w - 50, 26);
        g.fillStyle = '#222'; g.beginPath(); g.arc(48, y + 28, 8, 0, 7); g.arc(w - 48, y + 28, 8, 0, 7); g.fill();
      });
    } else if (kind === 'poster') {
      g.fillStyle = '#1d2435'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c8452e'; g.beginPath(); g.moveTo(0, h); g.lineTo(w, 40); g.lineTo(w, h); g.fill();
      g.fillStyle = '#e8e2d2'; g.fillRect(18, 18, w - 36, 8); g.fillRect(18, 34, w - 70, 5);
    } else if (kind === 'photo') {
      g.fillStyle = '#d9cdb6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#8a7a5d'; g.fillRect(18, 30, w - 36, h - 80); g.fillStyle = '#bfae8d'; g.fillRect(30, 46, w - 60, 40);
    } else {
      g.fillStyle = '#dfd8c6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9aa98f'; g.fillRect(12, h * .55, w - 24, h * .3); g.fillStyle = '#b9c8d6'; g.fillRect(12, 16, w - 24, h * .4);
      g.fillStyle = '#7d6b4f'; g.fillRect(12, h * .62, w - 24, 6);
    }
  });
}
