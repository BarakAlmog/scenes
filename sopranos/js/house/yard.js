import * as THREE from 'three';
import { app } from '../app.js';
import { M, box, cyl, rbox, mat, tube, seeded, canvasTex } from '../lib/util.js';
import { labelTex } from '../lib/textures.js';
import { upright } from '../world/roads.js';
import { bakeStatic } from '../lib/merge.js';
import { hipRoof, houseMats } from './model.js';
import { paverTex, poolTex, mosaicTex, stoneTex, coverTex, brickTex } from './textures.js';

/* The yard behind the house and the front down to the street, after the stills and the aerial: the free-form pool
   (its outline from OpenStreetMap) with white coping and the blue mosaic band, the brick patio, the eight-sided
   pavilion with its brick back wall, white metal lounge chairs, hedges; in 1998 the ducks' ramp, the grill and the
   party; in 2003 the pool cover, the bird feeder and the duck-feed tub. At the street, the brick pillars with the
   white lions. World metres, y up from the pool deck. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const DECK = 0;
/* the pool's steps: z from, z to, the tread's height; they span x -2.2 to .2 */
export const STEP_SLABS = [[4.5, 5.3, DECK - .32], [4.0, 4.5, DECK - .62], [3.5, 4.0, DECK - .92]];

/* a closed outline through the points, resampled to n points */
export function smoothLoop(pts, n = 96) {
  const P = pts.slice(); if (P.length > 2 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1]) P.pop();
  const m = P.length, out = [];
  const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  const dense = [];
  for (let i = 0; i < m; i++) for (let k = 0; k < 12; k++) {
    const t = k / 12, a = P[(i + m - 1) % m], b = P[i], c = P[(i + 1) % m], d = P[(i + 2) % m];
    dense.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]);
  }
  let L = 0; const cum = [0];
  for (let i = 1; i <= dense.length; i++) { const p = dense[i - 1], q = dense[i % dense.length]; L += Math.hypot(q[0] - p[0], q[1] - p[1]); cum.push(L); }
  for (let k = 0, j = 0; k < n; k++) {
    const s = k / n * L; while (cum[j + 1] < s) j++;
    const p = dense[j], q = dense[(j + 1) % dense.length], t = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return out;
}
const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
/* the outline pushed out by d (in along -d); normals averaged at each point */
function offsetLoop(pts, d) {
  const s = area(pts) > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    return [p[0] + tz * d * s, p[1] - tx * d * s];
  });
}
/* a flat polygon at height y, facing up */
function flat(pts, y, m, uvScale = 1, holes = []) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
  const g = new THREE.ShapeGeometry(sh);
  const p = g.attributes.position, uv = g.attributes.uv, pos = [];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getY(i); pos.push(x, y, z); uv.setXY(i, x * uvScale, z * uvScale); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('uv', uv); out.setIndex([...g.index.array]);
  upright(out);
  return M(out, m);
}
/* a band between two loops (same count): walls, coping, the lip */
function band(A, yA, B, yB, m, { vA = 0, vB = 1, uScale = 1, flip = false } = {}) {
  const pos = [], uv = [], idx = []; let u = 0;
  for (let i = 0; i <= A.length; i++) {
    const a = A[i % A.length], b = B[i % B.length];
    if (i > 0) { const p = A[(i - 1) % A.length]; u += Math.hypot(a[0] - p[0], a[1] - p[1]); }
    pos.push(a[0], typeof yA === 'function' ? yA(a) : yA, a[1], b[0], typeof yB === 'function' ? yB(b) : yB, b[1]);
    uv.push(u * uScale, vA, u * uScale, vB);
    if (i > 0) { const k = (i - 1) * 2; if (flip) idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); else idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return M(g, m);
}

function waterNormal(seed) {
  const rnd = seeded(seed);
  const t = canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data, hs = new Float32Array(w * h);
    for (let k = 0; k < 46; k++) {
      const cx = rnd() * w, cy = rnd() * h, r = 16 + rnd() * 50, a = .4 + rnd();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let dx = Math.abs(x - cx), dy = Math.abs(y - cy); dx = Math.min(dx, w - dx); dy = Math.min(dy, h - dy);
        const q = Math.hypot(dx, dy) / r; if (q < 3) hs[y * w + x] += Math.cos(q * 6.28) * Math.exp(-q * 1.4) * a;
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, dx = hs[y * w + (x + 1) % w] - hs[y * w + (x + w - 1) % w], dy = hs[((y + 1) % h) * w + x] - hs[((y + h - 1) % h) * w + x];
      d[i * 4] = 128 + dx * 60; d[i * 4 + 1] = 128 + dy * 60; d[i * 4 + 2] = 255; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
/* white lattice for the chair sides */
function latticeTex() {
  const t = canvasTex(128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 3.2;
    for (let x = -h; x < w + h; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); g.beginPath(); g.moveTo(x + h, 0); g.lineTo(x, h); g.stroke(); }
    g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function buildYard({ T, lines, season }) {
  const group = new THREE.Group(); group.name = 'yard';
  const summer = season === 'summer';
  const solids = [], polys = [];
  const HM = houseMats();
  const ground = (x, z) => T.heightAt(x, z);

  /* ---------- the pool ---------- */
  const P = smoothLoop(lines.pool, 120);
  if (area(P) < 0) P.reverse();
  const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
  /* shallow at the west end and the round lobe of steps on the south side, deep in the big east lobe */
  const depth = ([x]) => 1.05 + 1.25 * THREE.MathUtils.smoothstep(x, -1.2, 4.2);
  const coping = new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: .65, side: THREE.DoubleSide });
  const tile = new THREE.MeshStandardMaterial({ map: poolTex(), roughness: .3, side: THREE.DoubleSide });
  const mosaic = new THREE.MeshStandardMaterial({ map: mosaicTex(), roughness: .25, side: THREE.DoubleSide }); mosaic.map.repeat.set(1 / 1.2, 1);
  const out1 = offsetLoop(P, .38);
  const cop = band(P, DECK + .035, out1, DECK + .035, coping, { vA: 0, vB: .38 }); cop.castShadow = false; group.add(cop);
  const lip = band(P, DECK - .06, P, DECK + .035, coping, { vA: 0, vB: .1 }); group.add(lip);
  const inner = offsetLoop(P, -.001);
  const bandM = band(inner, DECK - .32, inner, DECK - .06, mosaic, { uScale: 1, flip: true }); group.add(bandM);
  const walls = band(inner, p => DECK - depth(p), inner, DECK - .32, tile, { uScale: .5, vA: 0, vB: 1, flip: true }); group.add(walls);
  {const fl = flat(P, 0, tile, .5); const p = fl.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, DECK - depth([p.getX(i)])); fl.geometry.computeVertexNormals(); group.add(fl);}
  /* the steps in the round lobe on the south side */
  /* three steps down from the south edge of the lobe toward the pool; their ends run into the walls */
  for (const [z0, z1, top] of STEP_SLABS) { const s = box(group, 2.4, .3, z1 - z0, tile, -1.0, top - .15, (z0 + z1) / 2); s.castShadow = false; }
  /* the water */
  const wn = waterNormal(9); wn.repeat.set(.18, .18);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3fb9cc, roughness: .03, metalness: .05, transparent: true, opacity: .8, normalMap: wn, normalScale: new THREE.Vector2(.28, .28), envMapIntensity: 1.8, depthWrite: false });
  const water = flat(P, DECK - .13, waterMat, 1); water.castShadow = false; water.renderOrder = 2; water.userData.keep = true; group.add(water);
  app.onUpdate(dt => { if (!water.parent?.parent) return; wn.offset.x += dt * .004; wn.offset.y += dt * .0027; }, 20);
  polys.push(P);
  /* the ducks' ramp in 1998: a board of slats from the coping down into the water on the house side */
  const ramp = new THREE.Group(); ramp.name = 'ramp';
  {let best = 0, bi = 0; P.forEach(([x, z], i) => { if (x > -3 && x < 1 && z < best) { best = z; bi = i; } });
   const p = P[bi], q = P[(bi + 2) % P.length], ex = q[0] - p[0], ez = q[1] - p[1], el = Math.hypot(ex, ez);
   const nx = ez / el, nz = -ex / el, inward = (cx - p[0]) * nx + (cz - p[1]) * nz > 0 ? 1 : -1;
   ramp.position.set(p[0], DECK + .05, p[1]); ramp.rotation.y = Math.atan2(nx * inward, nz * inward); group.add(ramp);
   const slope = new THREE.Group(); slope.rotation.x = .5; ramp.add(slope);
   const board = mat(0xb48c5c, .85), slat = mat(0x8a6a44, .85);
   box(slope, .5, .04, 1.45, board, 0, 0, .7);
   for (let i = 0; i < 8; i++) box(slope, .5, .025, .03, slat, 0, .03, .1 + i * .17);
   ramp.userData.top = V(p[0], DECK + .05, p[1]); ramp.userData.dir = V(nx * inward, 0, nz * inward);}
  ramp.visible = summer;
  /* the winter cover over the pool, sagging, puddles on it */
  const cover = new THREE.Group(); cover.name = 'cover';
  {const outer = offsetLoop(P, .3), rings = [outer, offsetLoop(P, -.6), offsetLoop(P, -1.6), offsetLoop(P, -2.6)], sag = [0, -.12, -.24, -.3];
   const cm = new THREE.MeshStandardMaterial({ map: coverTex(), roughness: .35, metalness: .05, envMapIntensity: 1.2 }); cm.map.repeat.set(.25, .25);
   for (let r = 0; r < rings.length - 1; r++) { const b = band(rings[r], DECK + .04 + sag[r], rings[r + 1], DECK + .04 + sag[r + 1], cm, { flip: true }); b.castShadow = false; cover.add(b); }
   const cap = flat(rings[3], DECK + .04 + sag[3], cm, .25); cover.add(cap);
   /* water sits in the middle of it */
   const pud = flat(smoothLoop(offsetLoop(P, -3.0), 60), DECK - .245, new THREE.MeshStandardMaterial({ color: 0x0f1414, roughness: .04, metalness: .1, transparent: true, opacity: .55, envMapIntensity: .8 }), 1); pud.castShadow = false; cover.add(pud);
   /* the water bags along the edge that hold it down */
   const bagM = mat(0x5a7f9a, .5);
   for (let i = 0; i < outer.length; i += 6) { const [x, z] = outer[i], [x2, z2] = outer[(i + 1) % outer.length], b = rbox(cover, .95, .12, .3, .05, bagM, x, DECK + .09, z); b.rotation.y = Math.atan2(-(z2 - z), x2 - x); }}
  group.add(cover); cover.visible = !summer;
  if (!summer) water.visible = false;

  /* ---------- the patio ---------- */
  const patioPts = [[-28.6, 7.8], [-27.6, 10.3], [-22, 10.6], [-17, 9.3], [-12.5, 8.5], [-8.5, 8.3], [-5.2, 8.7], [-2.4, 8.9], [-.4, 7.9], [1.3, 7.35], [3.8, 7.6], [5.6, 8.3], [7.3, 7.2], [9.4, 5.2], [10.4, 2.2], [10.2, -.8], [8.8, -3.4], [6, -5.7], [2.6, -7.2], [-1.2, -7.7], [-5, -7.5], [-8.3, -9.4], [-10.6, -12.5], [-12.3, -16.4], [-14.6, -16.9], [-16.8, -12.4], [-22.5, -2.6]];
  const patioLoop = smoothLoop(patioPts, 160);
  const paver = new THREE.MeshStandardMaterial({ map: paverTex(), roughness: .88 }); paver.map.repeat.set(1 / .8, 1 / .8);
  const patio = flat(patioLoop, DECK + .012, paver, 1, [offsetLoop(P, .3)]); patio.castShadow = false; group.add(patio);
  /* a brick edging round it */
  const edge = band(patioLoop, DECK + .03, offsetLoop(patioLoop, .22), DECK + .01, new THREE.MeshStandardMaterial({ map: brickTex([160, 110, 84]), roughness: .9 }), { vA: 0, vB: .22 }); edge.castShadow = false; group.add(edge);

  /* ---------- the pavilion: eight sides, white columns on brick piers, a brick wall on the woods side ---------- */
  const pv = lines.neighbours[0];
  const pc = [pv.slice(0, -1).reduce((s, p) => s + p[0], 0) / (pv.length - 1), pv.slice(0, -1).reduce((s, p) => s + p[1], 0) / (pv.length - 1)];
  const pav = new THREE.Group(); pav.name = 'pavilion';
  const face = Math.atan2(cx - pc[0], cz - pc[1]);          /* a flat side toward the pool */
  const pfy = Math.max(DECK + .16, ground(pc[0], pc[1]) + .2);
  pav.position.set(pc[0], 0, pc[1]); pav.rotation.y = face; group.add(pav);
  const Rc = 2.85, brickP = new THREE.MeshStandardMaterial({ map: brickTex(), roughness: .9 }), white = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: .5, side: THREE.DoubleSide }), capS = new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: .85, side: THREE.DoubleSide });
  const oct = r => Array.from({ length: 8 }, (_, i) => { const a = (i + .5) / 8 * Math.PI * 2; return [Math.sin(a) * r, Math.cos(a) * r]; });
  /* corners at angles (i + .5)/8 turns from the local +z, so sides face +z (toward the pool), +x, -z ... */
  const C8 = oct(Rc);
  {const fl = flat(oct(3.2), pfy, paver, 1); pav.add(fl);
   const side = band(oct(3.2), ground(pc[0], pc[1]) - .1, oct(3.2), pfy, capS, { vB: .3 }); pav.add(side);}
  /* side i runs from corner i to corner i+1 and faces (i + 1) eighths of a turn from the pool: 7 looks at the pool, 3 at the woods */
  const backSides = new Set([2, 3, 4]), kneeSides = new Set([1, 5]);
  const ceilY = pfy + 2.72;
  C8.forEach(([x, z], i) => {
    box(pav, .52, .9, .52, brickP, x, pfy + .45, z); box(pav, .6, .07, .6, capS, x, pfy + .93, z);
    cyl(pav, .13, .15, 1.65, white, x, pfy + .97 + .825, z, 16); box(pav, .34, .1, .34, white, x, pfy + 1.0, z); box(pav, .34, .08, .34, white, x, ceilY - .04, z);
    solids.push({ x: pc[0] + x * Math.cos(face) + z * Math.sin(face), z: pc[1] - x * Math.sin(face) + z * Math.cos(face), r: .38 });
  });
  for (let i = 0; i < 8; i++) {
    const [ax, az] = C8[i], [bx, bz] = C8[(i + 1) % 8], mx = (ax + bx) / 2, mz = (az + bz) / 2, L = Math.hypot(bx - ax, bz - az) - .5, ry = Math.atan2(-(bz - az), bx - ax);
    if (backSides.has(i)) {
      const w = box(pav, L, ceilY - pfy, .3, brickP, mx, (pfy + ceilY) / 2, mz); w.rotation.y = ry;
      const wm = w.geometry.attributes.uv; for (let k = 0; k < wm.count; k++) wm.setXY(k, wm.getX(k) * L, wm.getY(k) * (ceilY - pfy));
    } else if (kneeSides.has(i)) { const w = box(pav, L, .9, .3, brickP, mx, pfy + .45, mz); w.rotation.y = ry; const c = box(pav, L + .1, .06, .38, capS, mx, pfy + .93, mz); c.rotation.y = ry; }
    if (backSides.has(i) || kneeSides.has(i)) for (let k = 1; k < 4; k++) { const x = ax + (bx - ax) * k / 4, z = az + (bz - az) * k / 4; solids.push({ x: pc[0] + x * Math.cos(face) + z * Math.sin(face), z: pc[1] - x * Math.sin(face) + z * Math.cos(face), r: .3 }); }
  }
  /* the entablature, the ceiling with its downlights, the roof */
  {const R0 = oct(Rc + .2), R1 = oct(Rc - .2);
   const ent = band(R0, ceilY - .02, R0, ceilY + .42, white); pav.add(ent);
   const entIn = band(R1, ceilY - .02, R1, ceilY + .42, white, { flip: true }); pav.add(entIn);
   const ceil = flat(R0, ceilY + .0, mat(0xefebe2, .8)); ceil.geometry.scale(1, 1, 1); ceil.rotation.x = 0; {const g = ceil.geometry, ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals();} pav.add(ceil);
   hipRoof(pav, HM, oct(Rc + .2), ceilY + .42, .52, .55, { soffit: true });}
  const downM = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: .4 });
  const downs = [];
  for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2, d = cyl(pav, .08, .08, .015, downM, Math.sin(a) * (Rc + .45), ceilY + .24, Math.cos(a) * (Rc + .45), 12); d.castShadow = false; downs.push(d); }
  const pavLight = new THREE.PointLight(0xffd2a0, 0, 11, 1.6); pavLight.position.set(0, ceilY - .3, 0); pavLight.castShadow = false; pav.add(pavLight);
  /* two lanterns on the inside of the back wall */
  const pavLanterns = [];
  for (const i of [2, 4]) {
    const [ax, az] = C8[i], [bx, bz] = C8[(i + 1) % 8], mx = (ax + bx) / 2 * .9, mz = (az + bz) / 2 * .9;
    const l = new THREE.Group(); l.position.set(mx, pfy + 2.0, mz); l.rotation.y = Math.atan2(-mx, -mz); pav.add(l); l.userData.keep = true;
    box(l, .2, .3, .2, HM.black, 0, 0, .12); const g = box(l, .15, .24, .15, HM.glow, 0, 0, .12); g.castShadow = false; pavLanterns.push(g);
  }
  /* a white table and chairs inside */
  const chairWhite = mat(0xf4f2ec, .45, .15), cushion = mat(0xf1ede2, .92);
  const tableSet = (parent, x, z, y, n = 4, r = .5) => {
    const t = new THREE.Group(); t.position.set(x, y, z); parent.add(t);
    cyl(t, r, r, .03, chairWhite, 0, .72, 0, 24); cyl(t, .03, .03, .7, chairWhite, 0, .36, 0, 8); cyl(t, .3, .3, .02, chairWhite, 0, .01, 0, 16);
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.28 + .4, c = new THREE.Group(); c.position.set(Math.cos(a) * (r + .38), 0, Math.sin(a) * (r + .38)); c.rotation.y = -a - Math.PI / 2; t.add(c);
      rbox(c, .46, .07, .46, .03, cushion, 0, .46, 0); rbox(c, .46, .52, .05, .02, chairWhite, 0, .74, -.22);
      for (const [px, pz] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) tube(c, V(px, 0, pz), V(px, .44, pz), .014, chairWhite);
    }
    return t;
  };
  tableSet(pav, -1.35, .35, pfy + .01);
  /* a point in the pavilion's own frame (x across, z toward the pool) in the world */
  const pavAt = (lx, lz) => [pc[0] + lx * Math.cos(face) + lz * Math.sin(face), pc[1] - lx * Math.sin(face) + lz * Math.cos(face)];

  /* ---------- furniture on the patio ---------- */
  const lat = new THREE.MeshStandardMaterial({ map: latticeTex(), alphaTest: .5, side: THREE.DoubleSide, roughness: .45, color: 0xf6f4ee });
  const lounge = (x, z, a, { back = .95, parent = group } = {}) => {
    /* a looks from the head of the chair to its foot */
    const c = new THREE.Group(); c.position.set(x, DECK + .015, z); c.rotation.y = a + Math.PI; parent.add(c);
    for (const s of [-1, 1]) {
      tube(c, V(s * .3, .33, -.9), V(s * .3, .33, .55), .018, chairWhite);
      const pl = M(new THREE.PlaneGeometry(1.4, .3), lat); pl.position.set(s * .3, .18, -.18); pl.rotation.y = Math.PI / 2; c.add(pl);
      for (const zz of [-.85, .5]) tube(c, V(s * .3, 0, zz), V(s * .3, .33, zz), .018, chairWhite);
      /* the arm */
      tube(c, V(s * .32, .58, .05), V(s * .32, .58, .55), .016, chairWhite); tube(c, V(s * .32, .33, .05), V(s * .32, .58, .05), .016, chairWhite);
    }
    rbox(c, .6, .1, 1.3, .04, cushion, 0, .39, -.22);
    const bk = new THREE.Group(); bk.position.set(0, .38, .48); bk.rotation.x = -back; c.add(bk);
    rbox(bk, .6, .1, .75, .04, cushion, 0, .05, .36); tube(bk, V(-.3, 0, 0), V(-.3, 0, .76), .018, chairWhite); tube(bk, V(.3, 0, 0), V(.3, 0, .76), .018, chairWhite);
    solids.push({ x: x + Math.sin(a) * -.2, z: z + Math.cos(a) * -.2, r: .55 });
    return c;
  };
  const sideTable = (x, z) => {
    const t = new THREE.Group(); t.position.set(x, DECK + .015, z); group.add(t);
    for (const [px, pz] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]]) tube(t, V(px, 0, pz), V(px, .42, pz), .014, chairWhite);
    for (const y of [.05, .42]) { tube(t, V(-.22, y, -.22), V(.22, y, -.22), .014, chairWhite); tube(t, V(-.22, y, .22), V(.22, y, .22), .014, chairWhite); tube(t, V(-.22, y, -.22), V(-.22, y, .22), .014, chairWhite); tube(t, V(.22, y, -.22), V(.22, y, .22), .014, chairWhite); }
    box(t, .46, .012, .46, new THREE.MeshStandardMaterial({ color: 0xcfe0e0, roughness: .05, metalness: .1, transparent: true, opacity: .45 }), 0, .43, 0).castShadow = false;
    return t;
  };
  const face2 = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const chairs = [];
  for (const [x, z] of [[-4.6, -6.0], [-2.2, -6.6], [.4, -6.9]]) { chairs.push(lounge(x, z, face2(x, z, x + .6, z + 5))); }
  for (const [x, z] of [[3.4, 7.1], [5.6, 6.9]]) chairs.push(lounge(x, z, face2(x, z, x - 1, z - 5)));
  /* by the grill: a lounge chair and its footstool, as in the shot from above */
  chairs.push(lounge(-12.4, 7.2, face2(-12.4, 7.2, -12, 12)));
  {const f = new THREE.Group(); f.position.set(-12.2, DECK + .015, 8.5); group.add(f); rbox(f, .6, .1, .55, .04, cushion, 0, .36, 0); for (const [px, pz] of [[-.26, -.22], [.26, -.22], [-.26, .22], [.26, .22]]) tube(f, V(px, 0, pz), V(px, .32, pz), .016, chairWhite); solids.push({ x: -12.2, z: 8.5, r: .4 });}
  chairs.push(lounge(9.4, .9, face2(9.4, .9, 3, .6)));
  sideTable(-3.4, -6.4); sideTable(4.7, 6.5);
  const tables = [tableSet(group, -12.4, 3.4, DECK + .015), tableSet(group, -20.4, 4.3, DECK + .015)];
  for (const t of tables) solids.push({ x: t.position.x, z: t.position.z, r: 1.15 });
  /* the round stone table with its curved benches by the corner of the house */
  {const st = new THREE.Group(); st.position.set(-24.2, DECK, 6.3); group.add(st); const sm = mat(0xe9e5dc, .8);
   cyl(st, .75, .75, .08, sm, 0, .74, 0, 28); cyl(st, .16, .26, .7, sm, 0, .35, 0, 12);
   for (const a of [0, Math.PI]) { const b = new THREE.Group(); b.rotation.y = a; st.add(b); const pts = []; for (let k = 0; k <= 12; k++) { const t = -.7 + 1.4 * k / 12; pts.push([Math.sin(t) * 1.45, Math.cos(t) * 1.45]); } for (let k = 12; k >= 0; k--) { const t = -.7 + 1.4 * k / 12; pts.push([Math.sin(t) * 1.05, Math.cos(t) * 1.05]); } const seat = flat(pts, .45, sm); b.add(seat); for (const s of [-.45, .45]) cyl(b, .1, .12, .42, sm, Math.sin(s) * 1.25, .21, Math.cos(s) * 1.25, 8); }
   solids.push({ x: -24.2, z: 6.3, r: 1.6 });}

  /* ---------- planting ---------- */
  const hedgeM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, map: canvasTex(128, 128, (g, w, h) => { const r = seeded(4); g.fillStyle = '#3d5e2c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = r(); g.fillStyle = v < .5 ? 'rgba(20,40,14,.5)' : 'rgba(110,140,70,.35)'; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); } }) });
  const hedge = (pts, h = 1.0, w = .9) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
      const o = rbox(group, L + .3, h, w, .3, hedgeM, (ax + bx) / 2, ground((ax + bx) / 2, (az + bz) / 2) + h / 2 - .05, (az + bz) / 2); o.rotation.y = Math.atan2(-(bz - az), bx - ax);
      for (let k = 0; k <= Math.ceil(L / 1.2); k++) solids.push({ x: ax + (bx - ax) * k / Math.ceil(L / 1.2), z: az + (bz - az) * k / Math.ceil(L / 1.2), r: w / 2 + .05 });
    }
  };
  /* along the patio's edge by the lawn, and against the back of the house past the chimney */
  hedge([[-27.2, 11.6], [-23.5, 11.8], [-19.4, 11.0]]);
  hedge([[-15.5, -11.1], [-13.8, -13.9]], .9, .8);
  hedge([[11.6, -1.5], [11.4, 3.2]], 1.1, 1.0);
  /* a round clipped shrub on the lawn past the grill */
  {const o = rbox(group, 1.6, 1.2, 1.5, .55, hedgeM, -10.4, ground(-10.4, 10.6) + .55, 10.6); o.rotation.y = .4; solids.push({ x: -10.4, z: 10.6, r: .85 });}
  /* flower beds: red and pink impatiens along the hedge in summer */
  const flowers = new THREE.Group(); flowers.visible = summer; group.add(flowers);
  {const r = seeded(12), fm = [mat(0xd8286a, .8), mat(0xf05a8a, .8), mat(0xf4f0f0, .8), mat(0xc81e2a, .8)], leafM = mat(0x2f5a24, .9);
   const bed = (a, b, n) => { for (let i = 0; i < n; i++) { const t = r(), x = a[0] + (b[0] - a[0]) * t + (r() - .5) * .7, z = a[1] + (b[1] - a[1]) * t + (r() - .5) * .7, y = ground(x, z); const s = M(new THREE.SphereGeometry(.13 + r() * .07, 7, 5), leafM); s.position.set(x, y + .08, z); s.scale.y = .6; flowers.add(s); for (let k = 0; k < 4; k++) { const f = M(new THREE.SphereGeometry(.035, 5, 4), fm[Math.floor(r() * fm.length)]); f.position.set(x + (r() - .5) * .2, y + .16, z + (r() - .5) * .2); f.castShadow = false; flowers.add(f); } } };
   bed([-27, 12.6], [-19.6, 12.1], 70); bed([-9.6, 11.6], [-11.4, 11.8], 14);}
  /* potted palms and red geraniums by the back doors, 1998 */
  const pots = new THREE.Group(); pots.visible = summer; group.add(pots);
  {const potM = mat(0xdcd6ca, .7), palmM = new THREE.MeshStandardMaterial({ color: 0x4a6b2c, roughness: .8, side: THREE.DoubleSide }), gerM = mat(0xc8202c, .8), gLeaf = mat(0x2f5a24, .9);
   const palm = (x, z) => { const g = new THREE.Group(); g.position.set(x, DECK + .015, z); pots.add(g); cyl(g, .3, .22, .52, potM, 0, .26, 0, 16); for (let i = 0; i < 11; i++) { const a = i / 11 * 6.28, l = M(new THREE.PlaneGeometry(.16, 1.0), palmM); l.position.set(Math.cos(a) * .22, 1.0, Math.sin(a) * .22); l.rotation.set(0, -a + Math.PI / 2, .75); l.rotateX(-.3); g.add(l); } cyl(g, .03, .04, .7, mat(0x5a4632, .9), 0, .8, 0, 6); solids.push({ x, z, r: .35 }); };
   const ger = (x, z) => { const g = new THREE.Group(); g.position.set(x, DECK + .015, z); pots.add(g); cyl(g, .26, .2, .4, mat(0xb2643e, .85), 0, .2, 0, 14); const r = seeded(Math.round(x * 13 + z * 7)); for (let i = 0; i < 14; i++) { const s = M(new THREE.SphereGeometry(.09, 6, 5), i % 3 ? gLeaf : gerM); s.position.set((r() - .5) * .4, .48 + r() * .2, (r() - .5) * .4); g.add(s); } solids.push({ x, z, r: .3 }); };
   palm(-17.2, -.2); palm(-12.1, -5.9); ger(-15.9, 1.1); ger(-11.6, -4.6); ger(-20.1, 4.2);}

  /* ---------- 1998: the barbecue ---------- */
  /* the party is weeks after the morning of the ducks: it shows when the moment gets there */
  const party = new THREE.Group(); party.name = 'party'; party.visible = false; group.add(party);
  const grill = new THREE.Group(); grill.name = 'grill';
  const GRILL = [-14.9, 8.9];
  {grill.position.set(GRILL[0], DECK + .015, GRILL[1]); party.add(grill);
   const k = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: .35, metalness: .3 });
   const bowl = M(new THREE.SphereGeometry(.3, 22, 12, 0, 6.28, Math.PI / 2, Math.PI / 2), k); bowl.position.y = .8; grill.add(bowl);
   /* the lid off, leaning against a leg on the side away from the cook */
   const lid = new THREE.Group(); lid.position.set(-.34, .31, -.12); lid.rotation.set(-.2, .5, 1.45); grill.add(lid);
   const lm = M(new THREE.SphereGeometry(.305, 22, 10, 0, 6.28, 0, Math.PI / 2), k); lid.add(lm); grill.userData.lid = lid;
   cyl(grill, .02, .02, .06, k, 0, .8 + .31, 0, 6).visible = false;
   for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28 + .5; tube(grill, V(Math.cos(a) * .2, .62, Math.sin(a) * .2), V(Math.cos(a) * .33, 0, Math.sin(a) * .33), .016, k); }
   tube(grill, V(-.3, .1, 0), V(.28, .1, 0), .012, k);
   for (const s of [-1, 1]) { const w = cyl(grill, .08, .08, .03, k, s * .33, .08, .0, 14); w.rotation.z = Math.PI / 2; }
   cyl(grill, .29, .29, .008, mat(0x9a9a9c, .35, .9), 0, .79, 0, 22);
   const coals = cyl(grill, .24, .24, .03, new THREE.MeshStandardMaterial({ color: 0x2a2220, emissive: 0xff5a1a, emissiveIntensity: 0 }), 0, .68, 0, 16); coals.userData.keep = true; grill.userData.coals = coals;
   /* the ash pan under it */
   cyl(grill, .16, .12, .05, k, 0, .3, 0, 14);}
  solids.push({ x: GRILL[0], z: GRILL[1], r: .45 });
  const cart = new THREE.Group(); cart.name = 'cart';
  {cart.position.set(GRILL[0] + 1.05, DECK + .015, GRILL[1] - .1); cart.rotation.y = .35; party.add(cart);
   const k = mat(0x1d1d1f, .4, .4), top = mat(0xe8e6e0, .6);
   box(cart, .95, .04, .52, top, 0, .82, 0); box(cart, .85, .03, .42, top, 0, .22, 0);
   for (const s of [-1, 1]) { tube(cart, V(-.42, .8, s * .22), V(.38, .05, s * .22), .016, k); tube(cart, V(.42, .8, s * .22), V(-.38, .05, s * .22), .016, k); }
   for (const s of [-1, 1]) { const w = cyl(cart, .09, .09, .04, k, .38, .09, s * .24, 14); w.rotation.x = Math.PI / 2; }
   const fluid = new THREE.Group(); fluid.position.set(.3, .84, .12); cart.add(fluid); cyl(fluid, .045, .045, .26, mat(0x2c6fb0, .5), 0, .13, 0, 10); cyl(fluid, .015, .02, .06, mat(0xe8e0d0, .5), 0, .29, 0, 8); cart.userData.fluid = fluid;
   /* the platter of burgers and the tongs */
   cyl(cart, .2, .2, .02, mat(0xf2f0ea, .5), -.2, .85, 0, 18); for (let i = 0; i < 5; i++) cyl(cart, .05, .05, .02, mat(0x5a3322, .8), -.2 + Math.cos(i * 1.3) * .1, .87, Math.sin(i * 1.3) * .1, 10);}
  solids.push({ x: cart.position.x, z: cart.position.z, r: .5 });
  /* the party table in front of the family room's sliders: the party cloth over a white one, food, the gift bag */
  const partyTable = new THREE.Group();
  {partyTable.position.set(-13.3, DECK + .015, -1.2); partyTable.rotation.y = Math.atan2(-15.4 + 13.3, -3.05 + 1.2) + Math.PI / 2; party.add(partyTable);
   box(partyTable, 2.3, .04, .95, mat(0xf6f4ee, .8), 0, .76, 0);
   const cloth = new THREE.MeshStandardMaterial({ roughness: .85, map: canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#23285e'; g.fillRect(0, 0, w, h); const c = ['#e23b3b', '#f6c633', '#39b86a', '#3a8ff0', '#f06cc8', '#ffffff']; const r = seeded(3); for (let i = 0; i < 260; i++) { g.fillStyle = c[i % 6]; g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3); g.fillRect(-4, -1.5, 8, 3); g.restore(); } }) });
   box(partyTable, 2.2, .5, .9, cloth, .15, .5, 0); box(partyTable, 2.36, .02, 1.0, mat(0xf8f6f0, .85), 0, .785, 0);
   const food = [[-.8, 0xc9a26a], [-.35, 0xd8442a], [.15, 0xe9c24a], [.6, 0x8a5a3a]];
   for (const [x, c] of food) { cyl(partyTable, .17, .15, .04, mat(0x3a8ad8, .5), x, .81, .1, 16); cyl(partyTable, .13, .1, .05, mat(c, .8), x, .84, .1, 12); }
   const bag = new THREE.MeshStandardMaterial({ roughness: .7, map: labelTex([['HAPPY', 34, 44, 'bold', '#ffe23a'], ['BIRTHDAY', 30, 90, 'bold', '#ff6fb0']], '#3246b8', '#fff', 160, 128) });
   box(partyTable, .38, .44, .16, bag, .9, 1.02, -.22);
   for (const [x, z, c] of [[-.9, -.25, 0x2a6fd0], [-.55, -.28, 0xd02a3a], [.35, -.3, 0xe8b820]]) box(partyTable, .26, .2, .24, mat(c, .6), x, .9, z);}
  solids.push({ x: partyTable.position.x, z: partyTable.position.z, r: 1.2 });
  /* balloons, blue and silver, tied to the table */
  const balloons = new THREE.Group(); balloons.name = 'balloons'; party.add(balloons);
  {const ry = partyTable.rotation.y, at = V(-1.1 * Math.cos(ry) + .3 * Math.sin(ry), .8, 1.1 * Math.sin(ry) + .3 * Math.cos(ry)).add(partyTable.position); const r = seeded(21);
   for (let i = 0; i < 7; i++) {
     const b = M(new THREE.SphereGeometry(.17, 16, 12), new THREE.MeshPhysicalMaterial({ color: i % 2 ? 0xc6cad0 : 0x2a58d8, metalness: i % 2 ? .9 : 0, roughness: .22, clearcoat: 1 }));
     b.scale.y = 1.15; b.position.set(at.x + (r() - .5) * .6, at.y + 1.5 + r() * .6, at.z + (r() - .5) * .6); balloons.add(b); b.castShadow = true;
     tube(balloons, at.clone(), b.position.clone().add(V(0, -.18, 0)), .003, mat(0xeeeeee, .5));
   }}

  /* ---------- 2003: the bird feeder, the duck-feed tub, the pots, the watch chair, a bicycle ---------- */
  const late = new THREE.Group(); late.name = 'late'; late.visible = !summer; group.add(late);
  const feeder = new THREE.Group(); feeder.name = 'feeder';
  {const x = -13.6, z = 14.6; feeder.position.set(x, ground(x, z), z); late.add(feeder);
   cyl(feeder, .025, .025, 1.9, mat(0x2a2a2a, .5, .6), 0, .95, 0, 8);
   cyl(feeder, .11, .11, .32, new THREE.MeshStandardMaterial({ color: 0xc8e0e8, transparent: true, opacity: .5, roughness: .1 }), 0, 1.78, 0, 12);
   cyl(feeder, .085, .085, .22, mat(0x9a7a4a, .95), 0, 1.74, 0, 10);
   const roof = M(new THREE.ConeGeometry(.2, .13, 12), mat(0x3a5a3a, .7)); roof.position.y = 2.01; feeder.add(roof); cyl(feeder, .15, .15, .02, mat(0x3a5a3a, .7), 0, 1.6, 0, 12);}
  solids.push({ x: -13.6, z: 14.6, r: .2 });
  const tub = new THREE.Group(); tub.name = 'tub';
  {const x = -5.6, z = 9.8; tub.position.set(x, ground(x, z) + .01, z); late.add(tub);
   const galv = mat(0x9aa0a4, .42, .85); cyl(tub, .3, .26, .72, galv, 0, .36, 0, 20); for (const y of [.12, .6]) cyl(tub, .305, .305, .03, galv, 0, y, 0, 20);
   for (const s of [-1, 1]) { const h = M(new THREE.TorusGeometry(.07, .012, 6, 12, Math.PI), galv); h.position.set(s * .3, .62, 0); h.rotation.set(0, Math.PI / 2, 0); tub.add(h); }
   const lid = new THREE.Group(); lid.position.y = .73; tub.add(lid); lid.userData.keep = true; cyl(lid, .32, .32, .04, galv, 0, 0, 0, 20); box(lid, .14, .04, .04, galv, 0, .05, 0); tub.userData.lid = lid;
   /* the feed, gone to mould */
   cyl(tub, .27, .27, .02, mat(0x6d6a3e, 1), 0, .62, 0, 16);}
  solids.push({ x: tub.position.x, z: tub.position.z, r: .42 });
  const potsPans = new THREE.Group(); potsPans.name = 'pots';
  {const t = tables[0]; potsPans.position.set(t.position.x, DECK + .015, t.position.z); late.add(potsPans);
   const steel = mat(0xc4c8cc, .22, 1); cyl(potsPans, .15, .13, .15, steel, -.15, .82, 0, 18); cyl(potsPans, .13, .11, .09, steel, .2, .79, .06, 18);
   tube(potsPans, V(.32, .8, .08), V(.56, .81, .14), .012, mat(0x222222, .5)); tube(potsPans, V(-.3, .86, 0), V(-.5, .86, -.05), .012, mat(0x222222, .5));}
  /* Tony's chair for the watch: on the patio by the chimney, looking out over the pool to the woods */
  const WATCH = { x: -13.2, z: -7.9 };
  const watchChair = lounge(WATCH.x, WATCH.z, face2(WATCH.x, WATCH.z, 0, 7), { back: .55, parent: late });
  watchChair.name = 'watchChair';
  const bike = new THREE.Group(); bike.name = 'bike';
  {const b = bike, x = -15.4, z = -9.3; b.position.set(x, DECK + .015, z); b.rotation.set(0, .9, .12); late.add(b);
   const fm = mat(0x2a2f3a, .4, .5), tm = mat(0x151515, .8);
   for (const s of [-.52, .52]) { const w = M(new THREE.TorusGeometry(.33, .025, 8, 28), tm); w.position.set(s, .35, 0); b.add(w); }
   tube(b, V(-.52, .35, 0), V(0, .38, 0), .018, fm); tube(b, V(0, .38, 0), V(.38, .8, 0), .018, fm); tube(b, V(-.52, .35, 0), V(-.12, .82, 0), .018, fm); tube(b, V(-.12, .82, 0), V(.38, .8, 0), .018, fm); tube(b, V(.38, .8, 0), V(.52, .35, 0), .018, fm); tube(b, V(0, .38, 0), V(-.12, .82, 0), .018, fm);
   box(b, .22, .05, .1, tm, -.14, .88, 0); tube(b, V(.4, .92, -.25), V(.4, .92, .25), .014, fm);}

  /* ---------- the front: lamp posts along the drive, the pillars with the lions and the curved walls ---------- */
  const lamps = [];
  const lampM = mat(0x1c1c1e, .5, .4);
  for (const [x, z] of [[-44.2, -11.5], [-43.4, -24.8], [-60, -33.9]]) {
    const y = ground(x, z), g = new THREE.Group(); g.position.set(x, y, z); group.add(g);
    cyl(g, .07, .09, .3, lampM, 0, .15, 0, 10); cyl(g, .045, .055, 2.2, lampM, 0, 1.25, 0, 10);
    box(g, .3, .05, .3, lampM, 0, 2.4, 0); const gl = box(g, .24, .36, .24, HM.glow, 0, 2.6, 0); gl.castShadow = false; box(g, .34, .05, .34, lampM, 0, 2.8, 0);
    const cap = M(new THREE.ConeGeometry(.24, .18, 4), lampM); cap.position.y = 2.92; cap.rotation.y = Math.PI / 4; g.add(cap);
    g.userData.keep = true; lamps.push({ g, glow: gl }); solids.push({ x, z, r: .15 });
  }
  const pillars = new THREE.Group(); pillars.name = 'pillars'; group.add(pillars);
  {const brk = new THREE.MeshStandardMaterial({ map: brickTex([198, 172, 136]), roughness: .9 }), statue = mat(0xf3f1eb, .5), capM = mat(0xe4e0d6, .7);
   const d0 = [-58.74, -31.46], d1 = [-78.78, -31.94], dx = d1[0] - d0[0], dz = d1[1] - d0[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
   const at = (t, off) => [d0[0] + ux * t + nx * off, d0[1] + uz * t + nz * off];
   const lion = (p) => {
     const l = new THREE.Group(); p.add(l);
     rbox(l, .32, .34, .56, .12, statue, 0, .2, -.02); rbox(l, .3, .36, .3, .12, statue, 0, .5, .16);
     rbox(l, .16, .14, .16, .06, statue, 0, .5, .34); rbox(l, .38, .4, .2, .15, statue, 0, .52, .1);
     for (const s of [-1, 1]) { box(l, .09, .3, .1, statue, s * .09, .15, .26); rbox(l, .12, .18, .26, .05, statue, s * .13, .1, -.14); }
     const tail = M(new THREE.TorusGeometry(.14, .025, 6, 10, Math.PI), statue); tail.position.set(.14, .06, -.3); tail.rotation.set(Math.PI / 2, 0, 0); l.add(tail);
     return l;
   };
   for (const s of [-1, 1]) {
     const [x, z] = at(15.2, s * 3.1), y = ground(x, z) - .1, p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = Math.atan2(-dz, dx) - Math.PI / 2; pillars.add(p);
     box(p, .72, 1.95, .72, brk, 0, .98, 0); box(p, .86, .1, .86, capM, 0, 2.0, 0); box(p, .8, .08, .8, capM, 0, 1.2, 0);
     const l = lion(p); l.position.y = 2.05; l.rotation.y = Math.PI / 2 * 0;
     solids.push({ x, z, r: .55 });
     /* the wall sweeps from the pillar out toward the street, dropping as it goes */
     for (let i = 0; i < 9; i++) {
       const a = (i + .5) / 9, t = 15.2 + .6 + a * 3.4, off = s * (3.1 + .3 + a * a * 5.2), [wx, wz] = at(t, off), [wx2, wz2] = at(t + .4, s * (3.1 + .3 + ((i + 1) / 9) ** 2 * 5.2));
       const h = .95 - a * .45, wy = ground(wx, wz);
       const seg = box(pillars, .95, h, .34, brk, wx, wy + h / 2 - .05, wz); seg.rotation.y = Math.atan2(-(wz2 - wz), wx2 - wx);
       const c = box(pillars, 1.0, .06, .42, capM, wx, wy + h - .02, wz); c.rotation.y = seg.rotation.y;
       solids.push({ x: wx, z: wz, r: .3 });
     }
   }}
  /* the paper at the bottom of the drive, 1998 */
  const paper = new THREE.Group(); paper.name = 'paper'; paper.visible = summer; group.add(paper);
  {const x = -69.5, z = -31.1; paper.position.set(x, ground(x, z) + .06, z); paper.rotation.y = .5; paper.userData.keep = true;
   const roll = M(new THREE.CylinderGeometry(.055, .055, .32, 12), new THREE.MeshStandardMaterial({ roughness: .7, map: labelTex([['THE STAR-LEDGER', 15, 20], ['— — — — — —', 12, 44, 'normal']], '#efe9da', '#1b1b1b', 128, 64) })); roll.rotation.z = Math.PI / 2; paper.add(roll);
   const bag = M(new THREE.CylinderGeometry(.06, .06, .3, 12), new THREE.MeshStandardMaterial({ color: 0xe6eef2, transparent: true, opacity: .35, roughness: .2 })); bag.rotation.z = Math.PI / 2; bag.castShadow = false; paper.add(bag);}

  group.traverse(o => { if (o.isMesh && o.receiveShadow !== false) o.receiveShadow = true; });
  /* what moves or is clicked stays as it is; each group that comes and goes is merged on its own */
  for (const o of [grill, cart, balloons, tub, potsPans, feeder, paper, ramp, water, cover]) o.userData.keep = true;
  for (const g of [party, late, flowers, pots]) { bakeStatic(g); g.userData.keep = true; }
  bakeStatic(group);
  return {
    pavAt, group, P, poolCenter: V(cx, DECK, cz), depth, water, waterMat, cover, ramp, patioLoop, patio, pav, pavCenter: pc, pavFloor: pfy, pavLight, downs, downM, pavLanterns,
    chairs, tables, summer: [flowers, pots, party, ramp, paper], late, party, grill, cart, partyTable, balloons, feeder, tub, potsPans, watchChair, WATCH, GRILL, bike,
    lamps, pillars, paper, solids, polys, lounge,
  };
}
