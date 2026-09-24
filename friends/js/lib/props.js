import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from './materials.js';
import { M, box, rbox, cyl, sph, mat, seeded, keep } from './util.js';
import { hotspot } from '../ctrl/hotspots.js';

/* Furniture and small things shared by both apartments. Every piece faces +z and stands on y = 0;
   place it with put(obj, position, rotY), where rotY = atan2(dx, dz) turns it to face (dx, dz). */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const faceTo = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);

/* ---------- seating ---------- */
export function sofa({ w = 2.1, d = .95, cover = MAT.couchW, cushion = cover, legs = MAT.woodDark, seats = 3, armH = .62, backH = .82 } = {}) {
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, .03, .025, .1, legs, sx * (w / 2 - .12), .05, sz * (d / 2 - .1));
  rbox(g, w, .28, d, .06, cover, 0, .24, 0);
  rbox(g, w, backH - .1, .24, .08, cover, 0, (backH + .1) / 2 + .02, -d / 2 + .12);
  for (const s of [-1, 1]) rbox(g, .24, armH - .08, d, .09, cover, s * (w / 2 - .12), (armH + .08) / 2, 0);
  const sw = (w - .48) / seats;
  for (let i = 0; i < seats; i++) {
    const x = -w / 2 + .24 + sw * (i + .5);
    rbox(g, sw - .02, .17, d - .3, .06, cushion, x, .46, .06);
    const b = rbox(g, sw - .04, .44, .17, .07, cushion, x, .72, -d / 2 + .31); b.rotation.x = -.14;
  }
  g.userData.seatY = .52; g.userData.seatZ = .08;
  return g;
}

export function armchair({ cover = MAT.couchCream, legs = MAT.woodDark, wide = 1 } = {}) {
  const g = new THREE.Group(), w = .9 * wide;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, .03, .025, .1, legs, sx * (w / 2 - .08), .05, sz * .36);
  rbox(g, w - .1, .3, .9, .06, cover, 0, .25, 0);
  rbox(g, w + .04, .72, .26, .1, cover, 0, .64, -.34);
  for (const s of [-1, 1]) rbox(g, .22, .58, .92, .1, cover, s * (w / 2 - .06), .45, 0);
  rbox(g, w - .44, .18, .7, .07, cover, 0, .48, .06);
  const b = rbox(g, w - .46, .46, .18, .07, cover, 0, .78, -.22); b.rotation.x = -.14;
  g.userData.seatY = .54;
  return g;
}

/* A Barcalounger: back and footrest turn with recline(k), 0 upright to 1 flat out */
export function recliner(cover = MAT.leather) {
  const g = new THREE.Group();
  rbox(g, .86, .16, .84, .05, MAT.leatherD, 0, .1, 0);
  rbox(g, .78, .22, .74, .07, cover, 0, .33, .04);
  for (const s of [-1, 1]) rbox(g, .2, .5, .9, .09, cover, s * .38, .43, 0);
  const back = new THREE.Group(); back.position.set(0, .4, -.3); g.add(back);
  rbox(back, .6, .78, .24, .1, cover, 0, .42, -.02);
  rbox(back, .5, .2, .16, .07, cover, 0, .72, .1);
  rbox(back, .52, .24, .12, .06, cover, 0, .2, .1);
  const foot = new THREE.Group(); foot.position.set(0, .3, .42); g.add(foot);
  rbox(foot, .56, .08, .34, .04, cover, 0, 0, .17);
  const lever = keep(box(g, .03, .14, .05, MAT.chrome, .49, .4, .2)); keep(back); keep(foot);
  const r = { group: g, back, foot, k: 0, target: 0, lever,
    set(k) { r.k = k; back.rotation.x = -.62 * k; foot.rotation.x = 1.35 * (1 - k); foot.position.y = .3 + .08 * k; foot.visible = k > .04; lever.rotation.x = -.6 * k; } };
  r.set(0);
  g.userData.seatY = .47;
  return r;
}

export function diningChair(style, paint) {
  const g = new THREE.Group(), p = paint ?? MAT.woodMid;
  const legs = (h = .45) => { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, .035, h, .035, p, sx * .19, h / 2, sz * .18); };
  if (style === 'windsor') {
    legs(); cyl(g, .23, .23, .04, p, 0, .47, 0, 20);
    const bow = M(new THREE.TorusGeometry(.2, .018, 8, 18, Math.PI), p); bow.position.set(0, .77, -.18); g.add(bow);
    for (let i = 0; i < 5; i++) cyl(g, .009, .009, .34, p, -.14 + i * .07, .64, -.19, 6);
  } else if (style === 'ladder') {
    legs(); box(g, .44, .04, .42, p, 0, .47, 0);
    for (const s of [-1, 1]) box(g, .035, .5, .035, p, s * .19, .72, -.19);
    for (const y of [.62, .76, .9]) box(g, .38, .045, .02, p, 0, y, -.19);
  } else if (style === 'bistro') {
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const l = cyl(g, .016, .02, .46, p, Math.cos(a) * .17, .23, Math.sin(a) * .17, 8); l.rotation.set(-Math.sin(a) * .08, 0, Math.cos(a) * .08); }
    cyl(g, .2, .2, .04, p, 0, .47, 0, 18); cyl(g, .19, .19, .03, mat(0xd9a0a8, .9), 0, .5, 0, 18);
    const arc = M(new THREE.TorusGeometry(.18, .016, 8, 16, Math.PI), p); arc.position.set(0, .8, -.16); g.add(arc);
    cyl(g, .012, .012, .34, p, 0, .64, -.18, 6);
  } else {
    legs(); box(g, .44, .05, .42, p, 0, .47, 0);
    for (const s of [-1, 1]) box(g, .04, .52, .04, p, s * .19, .74, -.19);
    box(g, .4, .2, .03, p, 0, .86, -.19);
    box(g, .3, .06, .02, p, 0, .66, -.19);
  }
  g.userData.seatY = .5;
  return g;
}

export function barStool(seat, legsMat) {
  const g = new THREE.Group(), h = .7;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const l = cyl(g, .016, .02, h, legsMat, Math.cos(a) * .15, h / 2, Math.sin(a) * .15, 8); l.rotation.set(-Math.sin(a) * .06, 0, Math.cos(a) * .06); }
  const ring = M(new THREE.TorusGeometry(.16, .01, 6, 20), legsMat); ring.rotation.x = Math.PI / 2; ring.position.y = .26; g.add(ring);
  rbox(g, .36, .09, .36, .04, seat, 0, h + .045, 0);
  return g;
}

/* ---------- tables and storage ---------- */
export function roundTable(r = .56, top = MAT.woodHoney, legs = MAT.woodMid) {
  const g = new THREE.Group();
  cyl(g, r, r, .045, top, 0, .745, 0, 32);
  cyl(g, r - .04, r - .04, .06, legs, 0, .7, 0, 28);
  cyl(g, .07, .09, .66, legs, 0, .36, 0, 14);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const f = box(g, .5, .05, .09, legs, Math.cos(a) * .2, .04, Math.sin(a) * .2); f.rotation.y = -a; }
  return g;
}

export function shelfUnit(w, h, d, frame, rows, fill) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) box(g, .03, h, d, frame, s * (w / 2 - .015), h / 2, 0);
  for (let i = 0; i <= rows; i++) box(g, w, .03, d, frame, 0, .015 + i * (h - .03) / rows, 0);
  if (fill) for (let i = 0; i < rows; i++) fill(g, .03 + i * (h - .03) / rows, (h - .03) / rows - .03);
  return g;
}

const rnd = seeded(101);
export function books(g, x0, x1, y, z, maxH = .26, cols = [0xb03a2a, 0x2a4d8f, 0x3a7a3f, 0xc8a23c, 0x6b4a36, 0x46506b, 0x8a3a5a, 0xe0d6c0]) {
  let x = x0;
  while (x < x1 - .05) {
    const bw = .025 + rnd() * .045, bh = maxH * (.7 + rnd() * .3);
    box(g, bw, bh, .18, mat(cols[Math.floor(rnd() * cols.length)], .85), x + bw / 2, y + bh / 2, z);
    x += bw + .006; if (rnd() < .12) x += .06;
  }
}

/* jars, tins and crockery for kitchen shelves */
export function pantry(g, x0, x1, y, z, depth = .22) {
  const cols = [0xd8453b, 0xf2c94c, 0x3a9a5a, 0x2f6fc4, 0xe8862a, 0xf1ece0, 0x8a5a3b, 0xc98fb8];
  let x = x0;
  while (x < x1 - .06) {
    const k = rnd();
    if (k < .35) { const r = .03 + rnd() * .02, h = .08 + rnd() * .1; cyl(g, r, r, h, mat(cols[Math.floor(rnd() * cols.length)], .5), x + r, y + h / 2, z + (rnd() - .5) * depth * .4, 12); x += r * 2 + .015; }
    else if (k < .6) { const w = .06 + rnd() * .06, h = .1 + rnd() * .14; box(g, w, h, .06, mat(cols[Math.floor(rnd() * cols.length)], .7), x + w / 2, y + h / 2, z, (rnd() - .5) * .2); x += w + .012; }
    else if (k < .8) { const r = .09 + rnd() * .04; const p = cyl(g, r, r, .015, mat(cols[Math.floor(rnd() * cols.length)], .4), x + .02, y + r, z - depth * .3, 20); p.rotation.x = Math.PI / 2 - .2; x += .05; }
    else { cyl(g, .045, .035, .08, mat(0xf4f1ea, .3), x + .045, y + .04, z, 14); x += .11; }
  }
}

export function plant(kind = 'fern', pot = mat(0xb8653f, .7)) {
  const g = new THREE.Group(), leaf = mat(kind === 'fern' ? 0x4f7a3a : 0x3f6a36, .7);
  cyl(g, .16, .12, .26, pot, 0, .13, 0, 16);
  cyl(g, .145, .145, .02, mat(0x3a2a1e, 1), 0, .25, 0, 16);
  const n = kind === 'fern' ? 14 : 9;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rnd(), up = kind === 'fern' ? .5 : .9, len = kind === 'fern' ? .42 : .55;
    const l = M(new THREE.ConeGeometry(.05, len, 4), leaf); l.scale.z = .3;
    l.position.set(Math.cos(a) * .12, .28 + len * .4 * up, Math.sin(a) * .12);
    l.rotation.set(Math.sin(a) * (1.2 - up * .6), 0, -Math.cos(a) * (1.2 - up * .6)); g.add(l);
  }
  return g;
}

export function flowers(g, x, y, z, cols = [0xd84a5a, 0xf0c040, 0xf2eee0, 0xe07a9a]) {
  cyl(g, .05, .04, .16, mat(0xdfe8ea, .1, .1), x, y + .08, z, 12);
  for (let i = 0; i < 7; i++) { const a = i * .9; sph(g, .035, mat(cols[i % cols.length], .7), x + Math.cos(a) * .05, y + .2 + (i % 3) * .03, z + Math.sin(a) * .05, 8, 6); }
}

/* ---------- lights ---------- */
export function tableLamp(shadeCol = 0xf4ecd9, glow = 0xffe2b0, baseMat = MAT.brass) {
  const g = new THREE.Group();
  cyl(g, .07, .09, .03, baseMat, 0, .015, 0, 16);
  cyl(g, .012, .012, .3, baseMat, 0, .17, 0, 8);
  sph(g, .06, baseMat, 0, .12, 0, 12, 10);
  const shadeMat = new THREE.MeshStandardMaterial({ color: shadeCol, roughness: .6, emissive: glow, emissiveIntensity: 5, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, .2, 20, 1, true), shadeMat); shade.position.y = .38; shade.castShadow = true; g.add(shade);
  return { group: g, shadeMat, top: .4 };
}

export function floorLamp(shadeCol = 0xe9c7a0, glow = 0xffd8a8) {
  const g = new THREE.Group();
  cyl(g, .16, .18, .03, MAT.brass, 0, .015, 0, 18);
  cyl(g, .014, .014, 1.5, MAT.brass, 0, .76, 0, 8);
  const shadeMat = new THREE.MeshStandardMaterial({ color: shadeCol, roughness: .7, emissive: glow, emissiveIntensity: 5, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.16, .26, .3, 20, 1, true), shadeMat); shade.position.y = 1.55; shade.castShadow = true; g.add(shade);
  return { group: g, shadeMat, top: 1.55 };
}

/* a lamp that the day dims around and a click switches; registers with the lighting */
export function litLamp(lamp, parent, pos, rotY, { color = 0xffd9a0, day = 5, night = 8, dist = 5.5, name } = {}) {
  lamp.group.position.copy(pos); lamp.group.rotation.y = rotY ?? 0; parent.add(lamp.group); keep(lamp.group);
  const light = new THREE.PointLight(color, day, dist, 2); light.position.set(0, lamp.top + .05, 0); lamp.group.add(light);
  const rec = { light, shadeMat: lamp.shadeMat, on: true, day, night, name, group: lamp.group };
  app.lamps.push(rec);
  if (name) hotspot(lamp.group, { title: name, text: () => rec.on ? 'On. Click to switch it off.' : 'Off. Click to switch it on.',
    action: () => { rec.on = !rec.on; app.emit('lamp', rec); } });
  return rec;
}

/* ---------- walls: pictures, windows, drapes ---------- */
export function framed(w, h, map, frame = MAT.woodDark, depth = .03) {
  const g = new THREE.Group();
  box(g, w + .06, h + .06, depth, frame, 0, 0, 0);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: .85 }));
  pic.position.z = depth / 2 + .002; g.add(pic);
  return g;
}

/* a window frame filling an opening, cols x rows of panes; the group's origin is the opening centre */
export function paneFrame(w, h, cols, rows, frame, { depth = .12, bar = .035, sash = .06 } = {}) {
  const g = new THREE.Group();
  box(g, w + sash * 2, sash, depth, frame, 0, h / 2 + sash / 2, 0);
  box(g, w + sash * 2, sash * 1.4, depth + .04, frame, 0, -h / 2 - sash * .7, .02);
  for (const s of [-1, 1]) box(g, sash, h + sash, depth, frame, s * (w / 2 + sash / 2), 0, 0);
  for (let c = 1; c < cols; c++) box(g, bar, h, depth * .6, frame, -w / 2 + c * w / cols, 0, 0);
  for (let r = 1; r < rows; r++) box(g, w, bar, depth * .6, frame, 0, -h / 2 + r * h / rows, 0);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.glass); gl.position.z = .01; g.add(gl);
  return g;
}

/* two gathered drape panels and a valance across the top */
export function drapes(w, h, fabric, { gap = 0, valance = .32, swag = true } = {}) {
  const g = new THREE.Group(), pw = w * .24;
  for (const s of [-1, 1]) {
    const folds = 5;
    for (let i = 0; i < folds; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(pw / folds * 1.25, h - valance * .6), fabric);
      p.position.set(s * (w / 2 - pw / 2 + gap) + (i - (folds - 1) / 2) * pw / folds, (h - valance * .6) / 2, (i % 2 ? .03 : 0));
      p.rotation.y = (i % 2 ? .45 : -.45) * s; p.castShadow = true; g.add(p);
    }
  }
  if (swag) {
    /* three scallops hanging below the valance */
    for (let i = 0; i < 3; i++) {
      const sw = new THREE.Mesh(new THREE.CircleGeometry(w / 6, 24, Math.PI, Math.PI), fabric);
      sw.scale.set(1, valance * 1.3 / (w / 6), 1); sw.position.set(-w / 3 + i * w / 3, h - valance * .5, .065); sw.castShadow = true; g.add(sw);
    }
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + .1, valance * .5, .06), fabric); top.position.set(0, h - valance * .25, .03); g.add(top);
  cyl(g, .014, .014, w + .2, MAT.brass, 0, h + .01, .05).rotation.z = Math.PI / 2;
  return g;
}

export function blinds(w, h, slatMat, open = .5) {
  const g = new THREE.Group(), n = Math.round(h * (1 - open) / .045);
  box(g, w, .05, .06, slatMat, 0, h - .025, 0);
  for (let i = 0; i < n; i++) { const s = box(g, w - .02, .004, .05, slatMat, 0, h - .06 - i * .045, 0); s.rotation.x = .35; }
  box(g, w - .02, .02, .05, slatMat, 0, h - .07 - n * .045, 0);
  return g;
}

export function rugMesh(w, d, material) {
  const r = new THREE.Mesh(new THREE.BoxGeometry(w, .016, d), material);
  r.receiveShadow = true; return r;
}

export function pillow(g, w, h, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  const p = rbox(g, w, h, .13, .05, m, x, y, z); p.rotation.set(rx, ry, rz); return p;
}

export { V as vec };
