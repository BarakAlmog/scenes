import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { smooth, keep } from '../lib/util.js';

export const WALL_H = 2.62, STUB_H = .14;
export const walls = [];
export const blockers = [];   /* solid wall runs for walk-mode collision: [ax, az, bx, bz] */

/* [y0, y1, material key, extra thickness] from the floor up */
const LAYERS = {
  main: [[0, .13, 'base', 0], [.13, .97, 'wains', 0], [.97, 1.03, 'rail', .035], [1.03, 2.08, 'upper', 0], [2.08, 2.13, 'rail', .03], [2.13, 99, 'upper', 0]],
  plain: [[0, 99, 'plain', 0]],
  white: [[0, 99, 'skin', 0]],
  hall: [[0, .12, 'base', 0], [.12, .98, 'hallLow', 0], [.98, 1.03, 'rail', .03], [1.03, 99, 'hallUp', 0]],
  bath: [[0, 1.2, 'bathTile', 0], [1.2, 1.25, 'rail', .02], [1.25, 99, 'plain', 0]],
};

/* uv in metres along the wall, so tiling textures keep their scale */
function wallUV(geo, xc, yc) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + xc, y = p.getY(i) + yc, z = p.getZ(i);
    if (Math.abs(n.getY(i)) > .5) uv.setXY(i, x, z);
    else if (Math.abs(n.getX(i)) > .5) uv.setXY(i, z, y);
    else uv.setXY(i, n.getZ(i) > 0 ? x : -x, y);
  }
}

/* a wall from a to b; its upper part can drop to a stub when it blocks the view */
export function buildWall(o) {
  const [x1, z1] = o.a, [x2, z2] = o.b, dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  const th = o.t ?? .16, H = o.h ?? WALL_H;
  const g = new THREE.Group(); g.position.set(x1, 0, z1); g.rotation.y = Math.atan2(-dz, dx);
  const stub = new THREE.Group(), upper = new THREE.Group(); upper.position.y = STUB_H;
  g.add(stub, upper);
  const buckets = { stub: new Map(), upper: new Map() }, proxy = [];

  const addBox = (m, s0, s1, y0, y1, t, z) => {
    const L = s1 - s0, xc = s0 + L / 2;
    for (const [k, a, b] of [['stub', y0, Math.min(y1, STUB_H)], ['upper', Math.max(y0, STUB_H), y1]]) {
      if (b - a < .004) continue;
      const geo = new THREE.BoxGeometry(L, b - a, t);
      wallUV(geo, xc, (a + b) / 2);
      geo.translate(xc, (a + b) / 2, z);
      proxy.push(geo.clone());
      if (k === 'upper') geo.translate(0, -STUB_H, 0);
      const list = buckets[k].get(m) ?? []; buckets[k].set(m, list); list.push(geo);
    }
  };

  const ops = (o.openings || []).slice().sort((p, q) => p.from - q.from);
  const spans = []; let cur = 0;
  for (const op of ops) {
    if (op.from > cur + .005) spans.push([cur, op.from, 0, H]);
    if (op.y1 < H - .005) spans.push([op.from, op.to, op.y1, H]);
    if ((op.y0 ?? 0) > .005) spans.push([op.from, op.to, 0, op.y0]);
    cur = op.to;
  }
  if (cur < len - .005) spans.push([cur, len, 0, H]);

  const front = LAYERS[o.style || 'main'], back = o.back ? LAYERS[o.back] : null;
  for (const [s0, s1, y0, y1] of spans) {
    if (s1 - s0 <= .01) continue;
    for (const [a0, a1, key, extra] of front) {
      const yy0 = Math.max(y0, a0), yy1 = Math.min(y1, a1, H);
      if (yy1 - yy0 < .006) continue;
      if (back) { const t = th / 2 + extra / 2; addBox(MAT[key], s0, s1, yy0, yy1, t, t / 2); }
      else addBox(MAT[key], s0, s1, yy0, yy1, th + extra, 0);
    }
    if (back) for (const [a0, a1, key, extra] of back) {
      const yy0 = Math.max(y0, a0), yy1 = Math.min(y1, a1, H);
      if (yy1 - yy0 < .006) continue;
      const t = th / 2 + extra / 2; addBox(MAT[key], s0, s1, yy0, yy1, t, -t / 2);
    }
    if (o.skin) addBox(MAT.wallSkin, s0, s1, y0, y1, .05, -(th / 2 + .025));
  }

  const capW = th + (o.skin ? .1 : .05), capZ = o.skin ? -.025 : 0;
  if (o.cap !== false) {
    const geo = new THREE.BoxGeometry(len + th, .06, capW);
    geo.translate(len / 2, H + .03, capZ); proxy.push(geo.clone()); geo.translate(0, -STUB_H, 0);
    const list = buckets.upper.get(MAT.poche) ?? []; buckets.upper.set(MAT.poche, list); list.push(geo);
  }
  /* dark caps on the stub, shown only while the wall is cut down; none across doorways */
  const stubCaps = [];
  for (const [s0, s1, y0] of spans) {
    if (y0 > .005) continue;
    const e0 = s0 < .01 ? -th / 2 : 0, e1 = s1 > len - .01 ? th / 2 : 0;
    const c = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0 - e0 + e1, .02, capW), MAT.poche);
    c.position.set((s0 + e0 + s1 + e1) / 2, STUB_H + .01, capZ); c.visible = false; c.receiveShadow = true;
    stub.add(c); stubCaps.push(c);
  }

  for (const [k, grp] of [['stub', stub], ['upper', upper]]) {
    for (const [m, list] of buckets[k]) {
      const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.receiveShadow = true; grp.add(mesh);
      list.forEach(x => x.dispose());
    }
  }

  const rec = { g, stub, upper, stubCaps, a: o.a, b: o.b, len, H, n: [-uz, ux], name: o.name,
    cut: 0, target: 0, hidden: false, attach: [], cuttable: o.cuttable !== false,
    proxy: mergeGeometries(proxy) };
  proxy.forEach(x => x.dispose());
  keep(g); (o.parent ?? app.root).add(g);

  /* floor-level openings are passable; windows are not */
  const seg = (t0, t1) => blockers.push([x1 + ux * t0, z1 + uz * t0, x1 + ux * t1, z1 + uz * t1]);
  cur = 0;
  for (const op of ops) if ((op.y0 ?? 0) <= .05) { if (op.from > cur + .01) seg(cur, op.from); cur = op.to; }
  if (cur < len - .01) seg(cur, len);

  walls.push(rec);
  return rec;
}

/* wall-mounted things vanish with their wall */
export const attach = (rec, obj) => { rec.attach.push(keep(obj)); return obj; };

/* one invisible mesh casts every wall's shadow, so cutting a wall down keeps the light the same */
export function finalizeWalls() {
  const geos = walls.map(w => { w.g.updateMatrix(); return w.proxy.clone().applyMatrix4(w.g.matrix); });
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  geos.forEach(x => x.dispose());
  mesh.castShadow = true; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false;
  keep(mesh); app.root.add(mesh); app.shadowProxy = mesh;
}

export function updateWalls(dt) {
  for (const w of walls) {
    const tgt = w.hidden ? 1 : w.target;
    if (w.cut !== tgt) w.cut = tgt > w.cut ? Math.min(tgt, w.cut + dt / .32) : Math.max(tgt, w.cut - dt / .32);
    const k = smooth(w.cut);
    w.upper.visible = w.cut < 1;
    w.upper.scale.y = Math.max(.001, 1 - k);
    w.stub.visible = !(w.hidden && w.cut >= 1);
    for (const c of w.stubCaps) c.visible = w.cut > .5;
    const show = w.cut === 0 && tgt === 0;
    for (const a of w.attach) a.visible = show;
  }
}
