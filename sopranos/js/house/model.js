import * as THREE from 'three';
import { M, box, cyl, mat, canvasTex, seeded } from '../lib/util.js';
import { bakeStatic } from '../lib/merge.js';
import { brickTex, sidingTex, roofTex, stoneTex } from './textures.js';

/* The Soprano house, from its outline in OpenStreetMap and the stills. Two frames: the end wings (the south-west
   wing with a two-car garage, the garage wing at the north-east end) stand 14 degrees off the map's grid; the main
   body between them, the one-storey family room with its bowed bay, and the chimney stand 45 degrees further on.
   Tan brick toward the drive, cream shingle siding toward the pool, grey hip roofs, white trim.
   World metres: x east, z south, y up from the pool deck. */
export const FRAME_YAW = 14 * Math.PI / 180;
const C = Math.cos(FRAME_YAW), S = Math.sin(FRAME_YAW), R2 = Math.SQRT1_2;
export const uvToWorld = (u, v) => [u * C + v * S, -u * S + v * C];
export const worldToUV = (x, z) => [x * C - z * S, x * S + z * C];
/* the diagonal frame: s along the body toward the garage, t across it toward the pool */
export const stToWorld = (s, t) => uvToWorld((s + t) * R2, (t - s) * R2);
export const ST_YAW = FRAME_YAW + Math.PI / 4;

export const FLOOR = .2;            /* the main floor, one step above the patio */
export const GARAGE_FLOOR = -2.2;   /* the garage wing's floor, down at the court */
export const SW_FLOOR = -1.35;      /* the south-west wing's garage, at the end of the drive */

function diamondTex() {
  const rnd = seeded(61);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, w, h);
    const bw = 256 / 4.6, bh = 256 / 14.5;
    for (let r = 0; r < 15; r++) for (let c = -1; c < 6; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh, k = .8 + rnd() * .3;
      g.fillStyle = `rgb(${[190, 164, 126].map(v => Math.round(v * k)).join(',')})`; g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    }
    /* a diamond of darker bricks */
    g.strokeStyle = 'rgba(110,84,58,.55)'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w - 14, h / 2); g.lineTo(w / 2, h - 14); g.lineTo(14, h / 2); g.closePath(); g.stroke();
    g.strokeStyle = 'rgba(255,245,230,.25)'; g.lineWidth = 2; g.stroke();
  });
}
function doorTex() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#f3f0e8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,112,100,.55)'; g.lineWidth = 3;
    for (const [x, y, ww, hh] of [[14, 16, 40, 70], [74, 16, 40, 70], [14, 104, 40, 60], [74, 104, 40, 60], [14, 180, 40, 60], [74, 180, 40, 60]]) g.strokeRect(x, y, ww, hh);
  });
}
function garageTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f1efe9'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.strokeStyle = 'rgba(120,115,105,.5)'; g.lineWidth = 3; g.strokeRect(c * w / 4 + 8, r * h / 4 + 8, w / 4 - 16, h / 4 - 16); }
    for (let r = 1; r < 4; r++) { g.fillStyle = 'rgba(90,85,78,.6)'; g.fillRect(0, r * h / 4 - 1, w, 2); }
  });
}

export function houseMats() {
  const brick = new THREE.MeshStandardMaterial({ map: brickTex(), roughness: .9 });
  const siding = new THREE.MeshStandardMaterial({ map: sidingTex(), roughness: .82 });
  const roof = new THREE.MeshStandardMaterial({ map: roofTex(), roughness: .88 });
  const trim = mat(0xf4f1ea, .6), soffit = mat(0xece8de, .8);
  const glass = new THREE.MeshStandardMaterial({ color: 0x3a4a52, roughness: .06, metalness: .25, envMapIntensity: 1.5 });
  /* the windows with a room behind: the same glass by day, warm light at night */
  const lit = new THREE.MeshStandardMaterial({ color: 0x3a4a52, roughness: .06, metalness: .25, envMapIntensity: 1.5, emissive: 0xffc98a, emissiveIntensity: 0 });
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: .85 });
  const garage = new THREE.MeshStandardMaterial({ map: garageTex(), roughness: .6 });
  const door = new THREE.MeshStandardMaterial({ map: doorTex(), roughness: .55 });
  const diamond = new THREE.MeshStandardMaterial({ map: diamondTex(), roughness: .9 });
  const pot = mat(0xa85a34, .8), black = mat(0x1b1b1d, .45, .5);
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffc27a, emissiveIntensity: 0, roughness: .3 });
  return { brick, siding, roof, trim, soffit, glass, lit, stone, garage, door, diamond, pot, black, glow };
}

/* ---------- walls, openings, roofs ---------- */
/* a wall from a to b (world x, z), outer face on the line, facing away from `inside`; uv in metres */
function wallFace(g, m, a, b, y0, y1, inside) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  let nx = dz / L, nz = -dx / L;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  if ((inside[0] - mx) * nx + (inside[1] - mz) * nz > 0) { nx = -nx; nz = -nz; }
  const geo = new THREE.PlaneGeometry(L + .02, y1 - y0);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L, uv.getY(i) * (y1 - y0) + y0);
  const o = M(geo, m); o.position.set(mx, (y0 + y1) / 2, mz); o.rotation.y = Math.atan2(nx, nz); g.add(o);
  /* t runs from a to b; the face looks along n */
  return { o, L, n: [nx, nz], at: (t, off = 0) => [a[0] + dx * t + nx * off, a[1] + dz * t + nz * off], ry: Math.atan2(nx, nz) };
}
/* a window: white frame, glass, a grid of muntins, a sill; an arched head if asked */
function windowUnit(M_, w, h, { grid = [2, 3], arch = false, lit = false, sill = true } = {}) {
  const f = new THREE.Group();
  if (h > .05) {
    box(f, w + .18, h + .18, .06, M_.trim, 0, 0, .03);
    box(f, w, h, .02, lit ? M_.lit : M_.glass, 0, 0, .065);
    const [cx, cy] = grid;
    for (let i = 1; i < cx; i++) box(f, .035, h, .03, M_.trim, -w / 2 + w * i / cx, 0, .08);
    for (let j = 1; j < cy; j++) box(f, w, .035, .03, M_.trim, 0, -h / 2 + h * j / cy, .08);
    if (sill) box(f, w + .32, .06, .14, M_.trim, 0, -h / 2 - .12, .07);
  }
  if (arch) {
    const r = w / 2;
    const gl = M(new THREE.CircleGeometry(r, 20, 0, Math.PI), lit ? M_.lit : M_.glass); gl.position.set(0, h / 2, .065); f.add(gl);
    const rim = M(new THREE.TorusGeometry(r + .06, .07, 6, 22, Math.PI), M_.trim); rim.position.set(0, h / 2, .05); f.add(rim);
    box(f, w + .18, .07, .05, M_.trim, 0, h / 2, .06);
    for (let i = 1; i < 4; i++) { const b = box(f, .03, r, .03, M_.trim, 0, 0, .08); const a = Math.PI * i / 4; b.position.set(Math.cos(a) * r / 2, h / 2 + Math.sin(a) * r / 2, .08); b.rotation.z = a - Math.PI / 2; }
  }
  return f;
}
/* French doors: two glazed leaves with muntins, an arched transom if asked; origin at the threshold */
function frenchDoors(M_, w, h, { arch = false, lit = false } = {}) {
  const f = new THREE.Group();
  box(f, w + .2, h + .12, .06, M_.trim, 0, h / 2, .03);
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group(); leaf.position.set(s * w / 4, h / 2, 0); f.add(leaf);
    box(leaf, w / 2 - .04, h - .04, .03, lit ? M_.lit : M_.glass, 0, 0, .065);
    for (let j = 1; j < 5; j++) box(leaf, w / 2 - .04, .035, .03, M_.trim, 0, -h / 2 + h * j / 5, .085);
    box(leaf, .035, h, .03, M_.trim, 0, 0, .085);
    box(leaf, .07, h, .04, M_.trim, s * (w / 4 - .02), 0, .08);
  }
  box(f, w, .16, .04, M_.trim, 0, .08, .08);
  if (arch) { const t = windowUnit(M_, w, .01, { grid: [1, 1], arch: true, lit, sill: false }); t.position.set(0, h + .02, 0); f.add(t); }
  return f;
}
function slider(M_, w, h, lit = false) {
  const f = new THREE.Group();
  box(f, w + .16, h + .1, .06, M_.trim, 0, h / 2, .03);
  box(f, w, h, .02, lit ? M_.lit : M_.glass, 0, h / 2, .065);
  box(f, .06, h, .05, M_.trim, 0, h / 2, .08);
  box(f, w, .08, .05, M_.trim, 0, h - .04, .08);
  return f;
}
/* a black carriage lantern for a wall; its glass glows at night */
function lanternOn(M_) {
  const l = new THREE.Group(); l.userData.keep = true;
  box(l, .05, .34, .1, M_.black, 0, -.02, 0);
  box(l, .22, .05, .22, M_.black, 0, .2, .14); box(l, .18, .04, .18, M_.black, 0, -.2, .14);
  const gl = box(l, .16, .34, .16, M_.glow, 0, 0, .14); gl.castShadow = false;
  const top = M(new THREE.ConeGeometry(.16, .14, 4), M_.black); top.position.set(0, .29, .14); top.rotation.y = Math.PI / 4; l.add(top);
  l.userData.glow = gl;
  return l;
}

/* a hip roof over a convex footprint: each face is the part of the roof whose eave is nearest, so a rectangle
   gets its ridge and a many-sided plan a point; pitch is rise per run, o the overhang */
export function hipRoof(g, M_, poly, eaveY, pitch, o = .45, { fascia = true, soffit = true } = {}) {
  const n = poly.length, cx = poly.reduce((s, p) => s + p[0], 0) / n, cz = poly.reduce((s, p) => s + p[1], 0) / n;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    let nx = dz / L, nz = -dx / L; if ((cx - a[0]) * nx + (cz - a[1]) * nz > 0) { nx = -nx; nz = -nz; }
    return { nx, nz, c: nx * a[0] + nz * a[1] + o, ex: dx / L, ez: dz / L };
  });
  const cross = (A, B) => { const d = A.nx * B.nz - A.nz * B.nx; return [(A.c * B.nz - B.c * A.nz) / d, (A.nx * B.c - B.nx * A.c) / d]; };
  const outer = lines.map((L, i) => cross(lines[(i + n - 1) % n], L));
  const dist = (L, p) => L.c - (L.nx * p[0] + L.nz * p[1]);
  const clip = (pts, ax, az, c) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], fp = ax * p[0] + az * p[1] - c, fq = ax * q[0] + az * q[1] - c;
      if (fp <= 1e-9) out.push(p);
      if ((fp < 0) !== (fq < 0) && Math.abs(fp - fq) > 1e-12) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  };
  const y0 = eaveY - pitch * o, pos = [], uv = [], k = Math.sqrt(1 + pitch * pitch);
  lines.forEach((L, i) => {
    let F = outer.slice();
    lines.forEach((J, j) => { if (j !== i) F = clip(F, J.nx - L.nx, J.nz - L.nz, J.c - L.c); });
    if (F.length < 3) return;
    for (let t = 1; t < F.length - 1; t++) for (const p of [F[0], F[t], F[t + 1]]) { pos.push(p[0], y0 + pitch * dist(L, p), p[1]); uv.push(p[0] * L.ex + p[1] * L.ez, dist(L, p) * k); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  /* every face must look up */
  const nr = geo.attributes.normal;
  for (let t = 0; t < nr.count; t += 3) if (nr.getY(t) < 0) for (const a of ['position', 'uv']) {
    const at = geo.attributes[a], s = at.itemSize;
    for (let c = 0; c < s; c++) { const v1 = at.array[(t + 1) * s + c]; at.array[(t + 1) * s + c] = at.array[(t + 2) * s + c]; at.array[(t + 2) * s + c] = v1; }
  }
  geo.computeVertexNormals();
  const r = M(geo, M_.roof); g.add(r);
  if (fascia) outer.forEach((a, i) => {
    const b = outer[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const f = box(g, L + .03, .22, .04, M_.trim, (a[0] + b[0]) / 2, y0 - .09, (a[1] + b[1]) / 2); f.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  });
  if (soffit) {
    const sg = new THREE.ShapeGeometry(new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, z))));
    sg.rotateX(Math.PI / 2); sg.computeVertexNormals();
    if (sg.attributes.normal.getY(0) > 0) { const ix = sg.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } sg.computeVertexNormals(); }
    const so = M(sg, M_.soffit); so.position.y = y0 - .2; so.castShadow = false; g.add(so);
  }
  return { mesh: r, y0, outer };
}

/* one wing: a convex footprint (world), walls from the ground to the eave with their openings, a hip roof.
   faces[i] belongs to the wall from poly[i] to poly[i + 1]; an opening's t runs along that wall, y is its centre
   (windows) above the floor; doors stand on the floor */
function wingOf(g, M_, T, { poly, floor, eave, pitch = .56, faces = [], name, overhang = .45 }) {
  const n = poly.length, cx = poly.reduce((s, p) => s + p[0], 0) / n, cz = poly.reduce((s, p) => s + p[1], 0) / n;
  const out = { faces: [], name, lanterns: [] };
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % n], F = faces[i] ?? {};
    if (F.skip) { out.faces.push(null); return; }
    let lo = floor; for (let k = 0; k <= 6; k++) lo = Math.min(lo, T.heightAt(a[0] + (b[0] - a[0]) * k / 6, a[1] + (b[1] - a[1]) * k / 6) - .25);
    const f = wallFace(g, F.mat ?? M_.siding, a, b, lo, eave, [cx, cz]);
    /* a band of stone where the wall stands above the grade */
    if (lo < floor - .1) { const s = wallFace(g, M_.stone, a, b, lo, floor - .05, [cx, cz]); s.o.position.x += s.n[0] * .03; s.o.position.z += s.n[1] * .03; }
    for (const op of F.open ?? []) {
      let u = null;
      if (op.kind === 'french') u = frenchDoors(M_, op.w, op.h, op);
      else if (op.kind === 'slider') u = slider(M_, op.w, op.h, op.lit);
      else if (op.kind === 'door') {
        u = new THREE.Group(); box(u, op.w + .24, op.h + .14, .07, M_.trim, 0, op.h / 2, .035); box(u, op.w, op.h, .04, M_.door, 0, op.h / 2, .06);
        if (op.side) for (const sx of [-1, 1]) { const sl = windowUnit(M_, .36, op.h - .2, { grid: [1, 4], sill: false }); sl.position.set(sx * (op.w / 2 + .36), op.h / 2, 0); u.add(sl); }
        if (op.fan) { const fa = windowUnit(M_, op.w + 1.3, .02, { grid: [1, 1], arch: true, sill: false }); fa.position.set(0, op.h + .1, 0); u.add(fa); }
      }
      else if (op.kind === 'garage') { u = new THREE.Group(); box(u, op.w + .24, op.h + .14, .07, M_.trim, 0, op.h / 2, .035); box(u, op.w, op.h, .04, M_.garage, 0, op.h / 2, .06); }
      else if (op.kind !== 'lantern') u = windowUnit(M_, op.w, op.h, op);
      if (u) { const [x, z] = f.at(op.t, .005); u.position.set(x, floor + (op.kind ? 0 : op.y), z); u.rotation.y = f.ry; g.add(u); }
      if (op.kind === 'lantern' || op.lantern != null) {
        const l = lanternOn(M_), [x, z] = f.at(op.t + (op.lantern ?? 0) / f.L, .02);
        l.position.set(x, floor + 2.15, z); l.rotation.y = f.ry; g.add(l); out.lanterns.push(l);
      }
    }
    out.faces.push(f);
  });
  out.roof = hipRoof(g, M_, poly, eave, pitch, overhang);
  return out;
}

export function buildHouse({ T }) {
  const M_ = houseMats(), group = new THREE.Group(); group.name = 'house';
  const ST = stToWorld, UV = uvToWorld;
  const lanterns = [], polys = [];
  const add = w => { lanterns.push(...w.lanterns); return w; };
  const wf = (k, o) => ({ ...o, lit: o.lit ?? (k % 3 !== 1) });

  /* the south-west wing: two garage doors where the drive ends, brick toward the court, siding toward the lawn */
  const sw = [UV(-41.5, -10.55), UV(-29.0, -10.55), UV(-29.0, .55), UV(-41.5, .55)];
  add(wingOf(group, M_, T, { name: 'sw', poly: sw, floor: SW_FLOOR, eave: 6.0, pitch: .58, faces: [
    { mat: M_.brick, open: [{ kind: 'garage', t: .17, w: 2.6, h: 2.2 }, { kind: 'garage', t: .43, w: 2.6, h: 2.2 }, ...[.17, .43].map((t, k) => wf(k, { t, y: 5.7, w: 1.05, h: 1.35 }))] },
    { skip: true },
    { mat: M_.siding, open: [.2, .5, .8].flatMap((t, k) => [wf(k, { t, y: 2.95, w: 1.15, h: 1.6 }), wf(k + 1, { t, y: 5.7, w: 1.05, h: 1.35 })]) },
    { mat: M_.brick, open: [.22, .5, .78].flatMap((t, k) => [wf(k, { t, y: 2.95, w: 1.15, h: 1.7, grid: [2, 4] }), wf(k + 2, { t, y: 5.7, w: 1.05, h: 1.35 })]) },
  ] }));
  polys.push(sw);

  /* the main body on the diagonal: the front door toward the drive, French doors and the arched window to the patio */
  const s0 = -20.6, s1 = 5.1, tN = -32.2, tS = -20.5, L = s1 - s0, fr = s => (s - s0) / L, rf = s => (s1 - s) / L;
  const body = [ST(s0, tN), ST(s1, tN), ST(s1, tS), ST(s0, tS)];
  const bodyW = add(wingOf(group, M_, T, { name: 'body', poly: body, floor: FLOOR, eave: 6.0, pitch: .58, faces: [
    /* NW, the front: tall ground-floor windows of many panes, the upper row */
    { mat: M_.brick, open: [
      ...[-12.2, -10.4, .6, 2.7].map((s, k) => wf(k, { t: fr(s), y: 1.8, w: 1.2, h: 2.0, grid: [3, 5] })),
      ...[-12.2, -10.4, .6, 2.7].map((s, k) => wf(k + 1, { t: fr(s), y: 4.65, w: 1.1, h: 1.4 })) ] },
    /* NE end toward the court */
    { mat: M_.brick, open: [wf(0, { t: .15, y: 4.65, w: 1.0, h: 1.3 })] },
    /* SE, the back: from the garage end toward the south-west wing */
    { mat: M_.siding, open: [
      { kind: 'french', t: rf(2.9), w: 1.35, h: 2.3, arch: true, lit: true },
      { kind: 'lantern', t: rf(4.35) },
      ...[3.2, -4.1, -7.3, -12.1, -15.5, -18.6].map((s, k) => wf(k, { t: rf(s), y: 4.65, w: 1.05, h: 1.35 })),
      { kind: 'french', t: rf(-13.6), w: 1.6, h: 2.3, lit: true },
      wf(1, { t: rf(-11.4), y: 1.65, w: 1.2, h: 1.6 }), wf(2, { t: rf(-16.4), y: 1.65, w: 1.2, h: 1.6 }), wf(0, { t: rf(-19.0), y: 1.65, w: 1.0, h: 1.6 }) ] },
    { skip: true },
  ] }));
  polys.push(body);
  /* the front bay with the door: sidelights, a fanlight, the big windows either side */
  const bay = [ST(-9.0, -33.3), ST(-1.5, -33.3), ST(-1.5, tN + .05), ST(-9.0, tN + .05)];
  add(wingOf(group, M_, T, { name: 'bay', poly: bay, floor: FLOOR, eave: 6.0, pitch: .5, overhang: .3, faces: [
    { mat: M_.brick, open: [{ kind: 'door', t: .5, w: 1.25, h: 2.35, side: true, fan: true }, wf(0, { t: .5, y: 4.65, w: 1.5, h: 1.4, grid: [3, 3] }), wf(1, { t: .15, y: 1.8, w: 1.1, h: 2.0, grid: [3, 5] }), wf(2, { t: .85, y: 1.8, w: 1.1, h: 2.0, grid: [3, 5] })] },
    { mat: M_.brick }, { skip: true }, { mat: M_.brick },
  ] }));
  polys.push(bay);

  /* the family room: one storey, a bowed bay of five facets toward the patio, brick on its north-east side */
  const famST = [[-9.7, tS + .05], [-9.7, -17.75], [-7.35, -15.2], [-6.4, -14.75], [-4.2, -14.75], [-3.2, -15.3], [-.85, -17.62], [-.85, tS + .05]];
  const fam = famST.map(([s, t]) => ST(s, t));
  add(wingOf(group, M_, T, { name: 'family', poly: fam, floor: FLOOR, eave: 3.35, pitch: .5, faces: [
    { mat: M_.siding, open: [{ t: .5, y: 1.65, w: 1.2, h: 1.6, lit: true }] },
    { mat: M_.siding, open: [{ t: .5, y: 1.5, w: 2.0, h: 2.0, grid: [4, 4], lit: true }] },
    { mat: M_.siding, open: [{ t: .5, y: 1.5, w: .6, h: 2.0, grid: [1, 4], lit: true }] },
    { mat: M_.siding, open: [{ kind: 'slider', t: .5, w: 1.9, h: 2.25, lit: true }] },
    { mat: M_.siding, open: [{ t: .5, y: 1.5, w: .6, h: 2.0, grid: [1, 4], lit: true }] },
    { mat: M_.brick, open: [{ kind: 'french', t: .42, w: 1.25, h: 2.3, arch: true, lit: true, lantern: 1.25 }] },
    { mat: M_.brick },
    { skip: true },
  ] }));
  polys.push(fam);

  /* the chimney against the back wall, past the ridge: a panel with a brick diamond, a stone cap, two clay pots */
  {const ch = new THREE.Group(); ch.name = 'chimney';
   const c = ST(.1, tS); ch.position.set(c[0], 0, c[1]); ch.rotation.y = ST_YAW; group.add(ch);
   let lo = FLOOR; for (const s of [-.85, .1, 1.05]) { const p = ST(s, tS + .95); lo = Math.min(lo, T.heightAt(p[0], p[1]) - .3); }
   const H = 11.4 - lo, shaft = new THREE.BoxGeometry(1.9, H, .95), uvA = shaft.attributes.uv, pA = shaft.attributes.position, nA = shaft.attributes.normal;
   for (let i = 0; i < uvA.count; i++) { const ax = Math.abs(nA.getX(i)) > .5; uvA.setXY(i, (ax ? pA.getZ(i) : pA.getX(i)) + 1, pA.getY(i) + H / 2); }
   const sm = M(shaft, M_.brick); sm.position.set(0, lo + H / 2, .475); ch.add(sm);
   const pan = M(new THREE.PlaneGeometry(1.2, 1.9), M_.diamond); pan.position.set(0, FLOOR + 1.6, .955); pan.castShadow = false; ch.add(pan);
   box(ch, 1.3, .06, .06, M_.stone, 0, FLOOR + .62, .97); box(ch, 1.3, .06, .06, M_.stone, 0, FLOOR + 2.58, .97);
   box(ch, 2.0, .12, 1.05, M_.brick, 0, 11.28, .475);
   box(ch, 2.15, .22, 1.2, M_.stone, 0, 11.45, .475);
   for (const x of [-.42, .42]) { cyl(ch, .15, .19, .55, M_.pot, x, 11.83, .475, 12); cyl(ch, .17, .17, .05, M_.pot, x, 12.1, .475, 12); }}
  polys.push([ST(-.9, tS + .05), ST(1.1, tS + .05), ST(1.1, tS + 1), ST(-.9, tS + 1)]);

  /* a skylight in the back slope of the body's roof */
  {const pitch = .58, run = 1.5, c = ST(2.2, tS + .45 - run - .6);
   const sk = new THREE.Group(); sk.position.set(c[0], bodyW.roof.y0 + pitch * (run + .6), c[1]); sk.rotation.y = ST_YAW; group.add(sk);
   const inner = new THREE.Group(); inner.rotation.x = Math.atan(pitch); sk.add(inner);
   box(inner, .85, .1, 1.2, M_.trim, 0, .05, 0); box(inner, .75, .03, 1.1, M_.glass, 0, .11, 0);}

  /* the connector to the garage wing: one storey, a side door toward the court */
  const con = [ST(5.05, -28.1), ST(12.1, -28.1), ST(12.1, -23.8), ST(5.05, -23.8)];
  add(wingOf(group, M_, T, { name: 'connector', poly: con, floor: FLOOR, eave: 3.4, pitch: .5, faces: [
    { mat: M_.brick, open: [{ kind: 'door', t: .35, w: .95, h: 2.1 }, wf(0, { t: .75, y: 1.6, w: 1.0, h: 1.3 })] },
    { skip: true },
    { mat: M_.siding, open: [wf(1, { t: .3, y: 1.6, w: 1.1, h: 1.35 }), wf(0, { t: .7, y: 1.6, w: 1.1, h: 1.35 })] },
    { mat: M_.siding },
  ] }));
  polys.push(con);

  /* the garage wing at the north-east end: two doors at the court, a floor of rooms over them */
  const ga = [UV(-14.3, -37.35), UV(-3.35, -37.35), UV(-3.35, -25.6), UV(-14.3, -25.6)];
  add(wingOf(group, M_, T, { name: 'garage', poly: ga, floor: GARAGE_FLOOR, eave: 4.3, pitch: .58, faces: [
    { mat: M_.brick, open: [{ kind: 'garage', t: .7, w: 2.7, h: 2.2 }, { kind: 'garage', t: .36, w: 2.7, h: 2.2 }, ...[.36, .7].map((t, k) => wf(k, { t, y: 4.35, w: 1.05, h: 1.3 }))] },
    { mat: M_.siding, open: [.3, .7].flatMap((t, k) => [wf(k, { t, y: 1.25, w: 1.0, h: 1.2 }), wf(k + 1, { t, y: 4.35, w: 1.05, h: 1.3 })]) },
    { mat: M_.siding, open: [.15, .36].flatMap((t, k) => [wf(k, { t, y: 1.25, w: 1.0, h: 1.2 }), wf(k, { t, y: 4.35, w: 1.05, h: 1.3 })]) },
    { mat: M_.brick, open: [wf(2, { t: .25, y: 4.35, w: 1.05, h: 1.3 })] },
  ] }));
  polys.push(ga);

  /* the front steps: a stone landing at the door, steps down, low brick cheek walls with a white urn on each */
  const urns = [];
  {const steps = new THREE.Group(); steps.name = 'steps';
   const c = ST(-5.25, -33.3); steps.position.set(c[0], 0, c[1]); steps.rotation.y = ST_YAW + Math.PI; group.add(steps);
   const g0 = T.heightAt(...ST(-5.25, -36.6)), rise = Math.max(.34, FLOOR - .02 - g0), n = Math.max(2, Math.round(rise / .17)), st = rise / n;
   box(steps, 3.2, .16, 1.6, M_.stone, 0, FLOOR - .08, .8);
   for (let i = 0; i < n; i++) box(steps, 3.0, st, .36, M_.stone, 0, FLOOR - .16 - st * (i + .5) + .08, 1.6 + .36 * (i + .5));
   const len = 1.6 + .36 * n;
   for (const x of [-1.75, 1.75]) {
     box(steps, .36, .6 + (FLOOR - g0), len, M_.brick, x, (FLOOR + .45 + g0 - .15) / 2, len / 2);
     box(steps, .44, .06, len + .04, M_.stone, x, FLOOR + .48, len / 2);
     const u = new THREE.Group(); u.position.set(x, FLOOR + .51, len - .3); steps.add(u);
     const pts = [[.05, 0], [.14, .02], [.1, .1], [.12, .2], [.2, .34], [.24, .42], [.22, .44]].map(([r, y]) => new THREE.Vector2(r, y));
     u.add(M(new THREE.LatheGeometry(pts, 16), mat(0xf2f0ea, .5)));
     urns.push(u);
   }}

  group.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  bakeStatic(group);
  return {
    group, mats: M_, lanterns, polys, urns, bodyW,
    frontDoor: ST(-5.25, -34.2), backDoor: ST(-13.6, tS + 1.2), bayDoor: ST(-5.3, -14.0), walkEnd: ST(-5.25, -37.2),
  };
}
