import * as THREE from 'three';
import { app } from '../app.js';
import { N, makeTerrain, morphRings, editRing, computeHorizon, buildTerrainMeshes, normalAt } from '../world/terrain.js';
import { groundMaterial } from '../world/ground.js';
import { Forest } from '../world/trees.js';
import { levelRoads, roadRibbon, asphaltTex, patch } from '../world/roads.js';
import { seeded, inPoly, canvasTex } from '../lib/util.js';
import { fbm } from '../lib/noise.js';
import { bin, json, image, maskOf, decodeRings } from '../lib/data.js';
import { tod } from '../world/lighting.js';
import { buildHouse, FLOOR, SW_FLOOR, GARAGE_FLOOR, uvToWorld, stToWorld } from './model.js';
import { buildYard, DECK, STEP_SLABS, smoothLoop } from './yard.js';
import { buildNeighbours } from './neighbours.js';
import { paverTex } from './textures.js';

/* The Soprano house at 14 Aspen Drive, North Caldwell, on the real ground (USGS 3DEP lidar) with the streets and
   the drive from OpenStreetMap, the woods from the aerial. One world, two seasons: June 1998 (the ducks) and late
   autumn 2003 (the bear). The origin is the pool; x east, z south, y up from the pool deck, metres. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const HOUSE_LL = { lat: 40.86803, lon: -74.2454 };

const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
const lineDist = (pts, x, z) => { let b = 1e9; for (let i = 0; i < pts.length - 1; i++) b = Math.min(b, segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return b; };
const loopDist = (pts, x, z) => { let b = 1e9; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; b = Math.min(b, segDist(x, z, p[0], p[1], q[0], q[1])); } return b; };
const withBB = pts => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } pts.bb = [x0, x1, z0, z1]; return pts; };
const ss = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/* level the ground to y inside a polygon, blended out over `blend` metres */
function levelPoly(T, poly, y, blend, k = 0) {
  const bb = withBB(poly.slice()).bb;
  editRing(T, k, bb[0] - blend, bb[2] - blend, bb[1] + blend, bb[3] + blend, (x, z, h) => {
    if (inPoly(x, z, poly)) return y;
    const d = loopDist(poly, x, z); if (d > blend) return h;
    return h + (y - h) * ss(1 - d / blend);
  });
}

export async function loadHouseWorld({ status, season = 'summer' } = {}) {
  const summer = season === 'summer';
  status && (status.textContent = 'Driving up Aspen Drive…');
  const [hb, lines, mi] = await Promise.all([bin('house-terrain.bin'), json('house-lines.json'), image('house-mask.png')]);
  const { rings, skyline } = decodeRings(hb, { lo: lines.lo, halves: [170, 680, 2720, 10880], sky: { az: 512, rad: 48, r0: 10880, r1: 42000 } }, N);
  const T = makeTerrain({ name: 'house', rings, skyline });
  /* the lidar near the house keeps lumps (shrubs, the edges of paving): two soft passes over the yard and the front */
  {const r = T.rings[0], h = r.h, tmp = new Float32Array(h.length);
   for (let pass = 0; pass < 2; pass++) {
     tmp.set(h);
     for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
       const x = -r.half + i * r.step, z = -r.half + j * r.step, d = Math.hypot(x + 25, z + 12); if (d > 80) continue;
       let sum = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) sum += tmp[(j + b) * N + i + a];
       const k = ss((80 - d) / 20); h[j * N + i] = tmp[j * N + i] * (1 - k) + sum / 9 * k;
     }
   }
   /* the front lawn between the house and the drive: an even slope, as it is in the stills */
   for (let pass = 0; pass < 8; pass++) {
     tmp.set(h);
     for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
       const x = -r.half + i * r.step, z = -r.half + j * r.step, d = Math.hypot(x + 40, z + 24); if (d > 26) continue;
       let sum = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) sum += tmp[(j + b) * N + i + a];
       const k = ss((26 - d) / 8); h[j * N + i] = tmp[j * N + i] * (1 - k) + sum / 9 * k;
     }
   }}

  /* the lawns the stills show open: behind the patio, south of the house, east of the pool, and down both sides
     of the drive to the street; the aerial sees tree crowns over most of them */
  const drive = lines.drives[0];
  const lawnK = (x, z) => {
    const ell = (cx, cz, rx, rz) => 1 - ss((Math.hypot((x - cx) / rx, (z - cz) / rz) - 1) / .45);
    let k = Math.max(ell(-16, 13.5, 16, 8.5), ell(-36, 13, 9, 6.5), ell(13.5, 1, 4.5, 7), ell(-37, -19, 6.5, 12), ell(-60, -30, 25, 15));
    if (x < -40 && x > -86) k = Math.max(k, 1 - ss((lineDist(drive, x, z) - 11) / 6));
    return k;
  };
  const mask = maskOf(mi, (d, w, h) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = -170 + (i + .5) * 340 / w, z = -170 + (j + .5) * 340 / h;
      if (Math.hypot(x + 20, z + 5) > 110) continue;
      const k = lawnK(x, z); if (k > 0) d[(j * w + i) * 4] *= 1 - k;
    }
  });
  const maskAt = (x, z) => {
    const u = Math.floor((x + 170) / 340 * mask.w), v = Math.floor((z + 170) / 340 * mask.h);
    if (u < 0 || v < 0 || u >= mask.w || v >= mask.h) return [.8, 0, 16];
    const i = (v * mask.w + u) * 4; return [mask.d[i] / 255, mask.d[i + 1] / 255, mask.d[i + 2] / 255 * 16];
  };

  /* the streets and the drives: the ground levelled under them */
  status && (status.textContent = 'Paving the drive…');
  const near = (pts, r) => pts.some(([x, z]) => Math.abs(x) < r && Math.abs(z) < r);
  const streets = lines.streets.filter(s => near(s.pts, 900)).map(s => ({ ...s, w: s.name === 'Mountain Avenue' ? 10 : s.name === 'Aspen Drive' ? 8 : 7.4, kind: 'street' }));
  const drives = [
    { name: 'drive', pts: lines.drives[0], w: 4.2, kind: 'drive' },
    { name: 'branch', pts: lines.drives[1], w: 4.2, kind: 'drive' },
    { name: 'east drive', pts: lines.drives[2], w: 3.6, kind: 'drive' },
    { name: 'north drive', pts: lines.drives[3], w: 3.6, kind: 'drive' },
  ];
  const levelled = levelRoads(T, [...streets, ...drives], [0, 1], 3);
  /* the courts at the two garages, the front walk, the patio round the pool, the pavilion's pad */
  const UV = uvToWorld, ST = stToWorld;
  const swCourt = [UV(-42.4, -17.8), UV(-31.4, -17.8), UV(-31.4, -10.4), UV(-42.4, -10.4)];
  const gaCourt = [UV(-16.2, -44.5), UV(-2.4, -44.5), UV(-2.4, -37.2), UV(-16.2, -37.2)];
  levelPoly(T, swCourt, SW_FLOOR - .04, 4);
  levelPoly(T, gaCourt, GARAGE_FLOOR - .04, 4);
  {const a = ST(-5.25, -36.5), b = ST(-5.25, -44.2), ya = FLOOR - .02 - .17 * Math.max(2, Math.round((FLOOR - .02 - T.heightAt(...ST(-5.25, -36.6))) / .17)), yb = T.heightAt(b[0], b[1]);
   editRing(T, 0, Math.min(a[0], b[0]) - 4, Math.min(a[1], b[1]) - 4, Math.max(a[0], b[0]) + 4, Math.max(a[1], b[1]) + 4, (x, z, h) => {
     const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)), d = segDist(x, z, a[0], a[1], b[0], b[1]);
     if (d > 3) return h; const y = ya + (yb - ya) * t; return h + (y - h) * ss(1 - (d - 1.3) / 1.7);
   });}
  const patioPts = smoothLoop([[-28.6, 7.8], [-27.6, 10.3], [-22, 10.6], [-17, 9.3], [-12.5, 8.5], [-8.5, 8.3], [-5.2, 8.7], [-2.4, 8.9], [-.4, 7.9], [1.3, 7.35], [3.8, 7.6], [5.6, 8.3], [7.3, 7.2], [9.4, 5.2], [10.4, 2.2], [10.2, -.8], [8.8, -3.4], [6, -5.7], [2.6, -7.2], [-1.2, -7.7], [-5, -7.5], [-8.3, -9.4], [-10.6, -12.5], [-12.3, -16.4], [-14.6, -16.9], [-16.8, -12.4], [-22.5, -2.6]], 160);
  levelPoly(T, patioPts, DECK - .01, 5);
  const pv = lines.neighbours[0].slice(0, -1), pvc = [pv.reduce((s, p) => s + p[0], 0) / pv.length, pv.reduce((s, p) => s + p[1], 0) / pv.length];
  editRing(T, 0, pvc[0] - 8, pvc[1] - 8, pvc[0] + 8, pvc[1] + 8, (x, z, h) => { const d = Math.hypot(x - pvc[0], z - pvc[1]); return d > 7 ? h : h + (DECK + .02 - h) * ss(1 - (d - 3.6) / 3.4); });
  morphRings(T, [21, 85, 340]);

  /* the pool is a hole in the ground */
  const poolLoop = smoothLoop(lines.pool, 120);
  const hr = withBB(poolLoop.slice()).bb, pad = 1.2, rect = [hr[0] - pad, hr[2] - pad, hr[1] + pad, hr[3] + pad];
  const holeTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath();
    poolLoop.forEach(([x, z], i) => { const u = (x - rect[0]) / (rect[2] - rect[0]) * w, v = (z - rect[1]) / (rect[3] - rect[1]) * h; i ? g.lineTo(u, v) : g.moveTo(u, v); });
    g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke();
  });
  holeTex.colorSpace = THREE.NoColorSpace; holeTex.flipY = false; holeTex.wrapS = holeTex.wrapT = THREE.ClampToEdgeWrapping;

  status && (status.textContent = 'Working out where the trees throw their shadows…');
  const horizon = computeHorizon(T);
  const mode = summer ? 'lawn' : 'leaves';
  const mats = [
    groundMaterial({ ringHalf: 170, horizon: horizon[0], mask: mask.tex, maskHalf: 170, mode, detail: 1, hole: { tex: holeTex, rect } }),
    groundMaterial({ ringHalf: 680, horizon: horizon[1], mode, detail: .3 }),
    groundMaterial({ ringHalf: 2720, horizon: horizon[2], mode, far: true }),
    groundMaterial({ ringHalf: 10880, horizon: horizon[3], mode, far: true }),
    groundMaterial({ ringHalf: 1, mode, far: true }),
  ];
  const groups = buildTerrainMeshes(T, mats);
  const nearG = groups.near;

  /* asphalt: the streets grey and worn, the drive newer and black; no lines on these streets */
  const po = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const streetMat = new THREE.MeshStandardMaterial({ map: asphaltTex({ center: false, edges: false, tone: '#3b3b3d' }), roughness: .84, ...po });
  const driveMat = new THREE.MeshStandardMaterial({ map: asphaltTex({ center: false, edges: false, tone: '#303032' }), roughness: .78, ...po });
  for (const L of levelled) if (near(L.pts, 700)) nearG.add(roadRibbon(T, L, L.kind === 'drive' ? driveMat : streetMat, { lift: .035 }));
  for (const c of [swCourt, gaCourt]) nearG.add(patch(T, c, driveMat, { uvScale: .12, lift: .04 }));
  const walkMat = new THREE.MeshStandardMaterial({ map: paverTex([176, 160, 140]), roughness: .88, ...po });
  nearG.add(patch(T, [ST(-6.5, -36.45), ST(-4.0, -36.45), ST(-4.0, -44.4), ST(-6.5, -44.4)], walkMat, { uvScale: 1, lift: .04 }));

  /* the house, the yard, the houses round it */
  status && (status.textContent = 'Building the house…');
  const house = buildHouse({ T }); nearG.add(house.group);
  const yard = buildYard({ T, lines, season }); nearG.add(yard.group);
  const nb = buildNeighbours(T); nearG.add(nb.group);

  /* ---------- the trees ---------- */
  status && (status.textContent = summer ? 'Growing the trees…' : 'The leaves are down…');
  const rnd = seeded(1987), trees = [];
  const housePolys = house.polys.map(p => withBB(p.slice()));
  const nbPolys = nb.polys.map(p => withBB(p.slice()));
  const inflated = (polys, x, z, r) => polys.some(p => x > p.bb[0] - r && x < p.bb[1] + r && z > p.bb[2] - r && z < p.bb[3] + r && (inPoly(x, z, p) || loopDist(p, x, z) < r));
  const driveLines = drives.map(d => d.pts);
  const streetLines = streets.map(s => s.pts);
  /* the views' cameras stand in the open */
  const cams = [[17, 7, 9], [-56, -42, 8], [9.2, 2.4, 3]];
  const clear = (x, z, r = 0) => {
    for (const [cx, cz, cr] of cams) if (Math.hypot(x - cx, z - cz) < cr + r) return true;
    if (inflated(housePolys, x, z, 4 + r)) return true;
    if (Math.hypot(x - pvc[0], z - pvc[1]) < 5.5 + r) return true;
    if (Math.abs(x + 5) < 40 && Math.abs(z) < 30 && (inPoly(x, z, patioPts) || loopDist(patioPts, x, z) < 2.2 + r)) return true;
    for (const d of driveLines) if (lineDist(d, x, z) < 4.4 + r) return true;
    for (const c of [swCourt, gaCourt]) if (inPoly(x, z, c) || loopDist(c, x, z) < 3 + r) return true;
    if (inflated(nbPolys, x, z, 3.5 + r)) return true;
    return false;
  };
  const streetClear = (x, z) => { if (Math.max(Math.abs(x), Math.abs(z)) < 168) return maskAt(x, z)[2] < 5.5; for (const s of streetLines) if (lineDist(s, x, z) < 7) return true; return false; };
  const scale = { oak: [.8, 1.2], maple: [.75, 1.15], beech: [.55, 1.2], sapling: [.5, 1.3], snag: [.7, 1.1], pine: [.75, 1.15], hemlock: [.65, 1.15], laurel: [.6, 1.3] };
  const variants = { oak: 4, maple: 3, beech: 3, sapling: 3, snag: 2, pine: 3, hemlock: 2, laurel: 3 };
  const put = (x, z, kind, s = null) => {
    const [a, b] = scale[kind];
    trees.push({ x, z, y: T.heightAt(x, z), kind, v: Math.floor(rnd() * variants[kind]), s: s ?? a + rnd() * (b - a), a: rnd() * 6.283, tint: .84 + rnd() * .28, thin: rnd() });
  };
  const pick = (x, z) => {
    const conif = fbm(x * .008 + 11, z * .008 - 4, 3), r = rnd();
    if (conif > .63 && r < .5) return rnd() < .55 ? 'hemlock' : 'pine';
    if (r < .46) return 'oak';
    if (r < .8) return 'maple';
    if (r < .83) return 'snag';
    return rnd() < .5 ? 'oak' : 'hemlock';
  };
  /* the canopy on a jittered grid where the aerial shows crowns; the understory finer */
  for (let gx = -168; gx < 168; gx += 7) for (let gz = -168; gz < 168; gz += 7) {
    const x = gx + rnd() * 7, z = gz + rnd() * 7, [dens] = maskAt(x, z);
    if (rnd() > dens * .95 || clear(x, z) || streetClear(x, z)) continue;
    put(x, z, pick(x, z));
  }
  for (let gx = -168; gx < 168; gx += 4) for (let gz = -168; gz < 168; gz += 4) {
    const x = gx + rnd() * 4, z = gz + rnd() * 4, [dens] = maskAt(x, z);
    if (rnd() > dens * (.12 + .4 * fbm(x * .03 + 5, z * .03 - 2, 3)) || clear(x, z, 1) || streetClear(x, z)) continue;
    put(x, z, fbm(x * .02 - 9, z * .02 + 3, 3) > .62 ? 'laurel' : rnd() < .55 ? 'beech' : 'sapling');
  }
  /* the specimen trees on the lawns, and the big ones that frame the drive */
  for (const [x, z, k, s] of [[-24, 21, 'oak', 1.25], [-9, 18.5, 'maple', 1.1], [-31, 23, 'oak', 1.15], [13, 13, 'oak', 1.2], [16, -8, 'maple', 1.05], [7.5, 13.5, 'hemlock', 1.1], [9.5, 16.5, 'hemlock', 1.0], [-3, 19, 'oak', 1.1],
    [-49, -41, 'oak', 1.2], [-66, -18, 'maple', 1.1], [-68, -43, 'oak', 1.15], [-47, 2, 'oak', 1.2], [-36, 24, 'maple', 1.0]]) if (!clear(x, z, -3)) put(x, z, k, s);
  /* beyond the aerial: wooded lots on every side, thinning along the streets */
  for (let gx = -470; gx < 470; gx += 9) for (let gz = -470; gz < 470; gz += 9) {
    if (Math.max(Math.abs(gx), Math.abs(gz)) < 168) continue;
    const x = gx + rnd() * 9, z = gz + rnd() * 9; if (Math.hypot(x, z) > 480) continue;
    const dens = .3 + .55 * fbm(x * .006 + 2, z * .006 - 7, 3);
    if (rnd() > dens || streetClear(x, z) || inflated(nbPolys, x, z, 4)) continue;
    put(x, z, pick(x, z));
  }
  const forest = new Forest(trees, { season: summer ? 'summer' : 'late', snow: 0, rings: [{ ...horizon[0], half: 170 }], near: 45, mid: 140, far: 520 });
  nearG.add(forest.group);

  /* ---------- walking ---------- */
  const poolPoly = withBB(yard.P.slice()); poolPoly.off = false;
  const polys = [...housePolys, ...nbPolys, poolPoly];
  const solidsNear = (x, z, r) => {
    const out = [];
    for (const t of forest.near(x, z, r)) { if (t.kind === 'laurel') out.push({ x: t.x, z: t.z, r: .5 * t.s }); else if (!(t.kind === 'beech' || t.kind === 'sapling') || t.s > 1) out.push({ x: t.x, z: t.z, r: t.r + .05 }); }
    for (const s of yard.solids) if (Math.abs(s.x - x) < r + 2 && Math.abs(s.z - z) < r + 2) out.push(s);
    return out;
  };
  const floorAt = (x, z) => {
    if (x > poolPoly.bb[0] && x < poolPoly.bb[1] && z > poolPoly.bb[2] && z < poolPoly.bb[3] && inPoly(x, z, poolPoly)) {
      if (x > -2.2 && x < .2) for (const [z0, z1, top] of STEP_SLABS) if (z >= z0 && z < z1) return top + .02;
      return DECK - yard.depth([x, z]) + .02;
    }
    if (Math.hypot(x - pvc[0], z - pvc[1]) < 3.1) return yard.pavFloor;
    return T.heightAt(x, z);
  };
  const bound = p => { const r = Math.hypot(p.x + 25, p.z + 10); if (r > 150) { p.x = -25 + (p.x + 25) / r * 150; p.z = -10 + (p.z + 10) / r * 150; } };

  /* ---------- lights that come on at night: the lanterns, the drive lamps, the windows, the pavilion ---------- */
  const world = { season };
  const M_ = house.mats;
  app.onUpdate(() => {
    if (app.place?.world !== world) return;
    const n = tod.night ?? 0, dim = tod.dim ?? 0, on = world.lightsOn ?? Math.max(n, dim * .8);
    M_.lit.emissiveIntensity = on * 1.3; M_.glow.emissiveIntensity = on * 3.2;
    yard.downM.emissiveIntensity = (world.pavOn ?? on) * 3; yard.pavLight.intensity = (world.pavOn ?? on) * 7;
  }, 30);

  const noAO = forest.meshes.filter(m => m.material.transparent || m.material.alphaTest > 0 || m.userData.lod === 'lod1').concat([forest.impMesh]);
  const SPOTS = {
    frontDoor: house.frontDoor, walkEnd: house.walkEnd, backDoor: house.backDoor, bayDoor: house.bayDoor,
    paper: [yard.paper.position.x, yard.paper.position.z], street: [-78.8, -31.9], pillars: [-73.9, -31.8],
    pool: [yard.poolCenter.x, yard.poolCenter.z], steps: [-1.0, 4.25], ramp: [yard.ramp.userData.top.x, yard.ramp.userData.top.z],
    grill: yard.GRILL, watch: [yard.WATCH.x, yard.WATCH.z], tub: [yard.tub.position.x, yard.tub.position.z], feeder: [yard.feeder.position.x, yard.feeder.position.z],
    pav: pvc, swGarage: UV(-37.2, -11.4), gaGarage: UV(-6.5, -38.2), chimney: ST(.1, -19.4),
  };
  return Object.assign(world, {
    T, groups, mats, lines, mask, maskAt, forest, trees, house, yard, neighbours: nb, levelled, patioPts, poolPoly, polys,
    solidsNear, floorAt, bound, noAO, SPOTS, horizon, UV, ST, HOUSE_LL,
  });
}
export { V };
