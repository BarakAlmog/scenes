import * as THREE from 'three';
import { app } from '../app.js';
import { N, makeTerrain, morphRings, editRing, computeHorizon, terrainMaterial, buildTerrainMeshes } from './terrain.js';
import { fbm, vnoise } from '../lib/noise.js';
import { buildPilotFlora, buildGrassField } from './flora.js';

/* The three stops. Each has a place (for the sun and the stars), a date, a ground and a sky.
   Pilot: the real ground at the first cook site. 4 Days Out and Sunset: made grounds. */
const C = h => new THREE.Color(h);
export const PLACES = {
  pilot: {
    id: 'pilot', ep: 'S1 · E1', title: 'Pilot', where: 'To’hajiilee, New Mexico', short: 'To’hajiilee',
    date: [2008, 8, 28], lat: 35.101972, lon: -107.137222, grid: -1.229, hour: 14.2,
    turbidity: 2.0, rayleigh: 1.55, mie: .004, mieG: .8, haze: 1 / 38000, sunI: 3.4, exposure: .92,
    groundAlbedo: C(0xa05a3e).multiplyScalar(.55), clouds: { cover: .06, scale: .0005, soft: .1, alt: 3200, depth: .35, wind: [5, 1.5] },
  },
  days: {
    id: 'days', ep: 'S2 · E9', title: '4 Days Out', where: 'the grassland, New Mexico', short: 'the grassland',
    date: [2009, 4, 3], lat: 35.02, lon: -106.95, grid: -1.1, hour: 19.35,
    turbidity: 2.8, rayleigh: 1.45, mie: .0045, mieG: .82, haze: 1 / 26000, sunI: 3.3, exposure: .95,
    groundAlbedo: C(0xc2a066).multiplyScalar(.6), clouds: { cover: .4, scale: .00042, soft: .13, alt: 2600, depth: .5, wind: [7, 2.5] },
  },
  sunset: {
    id: 'sunset', ep: 'S3 · E6', title: 'Sunset', where: 'Old Joe’s yard, Albuquerque', short: 'Old Joe’s yard',
    date: [2010, 3, 25], lat: 35.02, lon: -106.69, grid: -.98, hour: 17.4,
    turbidity: 3.6, rayleigh: 1.5, mie: .006, mieG: .84, haze: 1 / 30000, sunI: 3.1, exposure: .95,
    groundAlbedo: C(0x9a8470).multiplyScalar(.55), clouds: { cover: .12, scale: .00035, soft: .15, alt: 5200, depth: .25, wind: [9, 1] },
  },
};
export const ORDER = ['pilot', 'days', 'sunset'];

/* ---------- small helpers ---------- */
async function bin(name) {
  const r = await fetch(new URL(`../../data/${name}`, import.meta.url));
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.arrayBuffer();
}
function texture(name) {
  return new Promise((ok, fail) => new THREE.TextureLoader().load(new URL(`../../data/${name}`, import.meta.url).href, t => {
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = app.maxAniso; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; ok(t);
  }, undefined, () => fail(new Error(name + ' did not load'))));
}
/* distance to a set of polylines, in a square texture: 0..16 m in 0..1 */
function roadTexture(lines, half, size = 512) {
  const data = new Uint8Array(size * size), segs = [];
  for (const l of lines) for (let i = 0; i < l.length - 1; i++) segs.push([...l[i], ...l[i + 1]]);
  const px = 2 * half / size;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -half + (i + .5) * px, z = -half + (j + .5) * px;
    let best = 1e9;
    for (const [ax, az, bx, bz] of segs) {
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez;
      if (d < best) best = d;
    }
    data[j * size + i] = Math.min(255, Math.sqrt(best) / 16 * 255);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
export function distToLines(lines, x, z) {
  let best = 1e9, at = null;
  for (const l of lines) for (let i = 0; i < l.length - 1; i++) {
    const [ax, az] = l[i], [bx, bz] = l[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; at = [ax + dx * t, az + dz * t]; }
  }
  return { d: best, at };
}

/* ---------- the pilot site: USGS 3DEP heights, NAIP colour, the real road and the track to the cook site ---------- */
/* the road in the aerial photo, traced by hand at 1 m, and the faint track that ends where the RV parks */
export const PILOT_ROAD = [[-176, -512], [-178, -462], [-183, -412], [-182, -367], [-171, -322], [-153, -279], [-122, -250], [-62, -202], [-2, -142],
  [53, -77], [88, -32], [123, 18], [158, 68], [188, 118], [203, 168], [223, 228], [248, 278], [288, 318], [328, 348], [368, 378], [413, 403], [488, 423], [540, 432]];
export const PILOT_TRACK = [[5, -110], [-2, -78], [1, -38], [-2, -8], [-8, 22], [-15, 57], [-25, 87], [-31, 128], [-36, 170]];
export const DITCH = { x: 131, z: 58, ax: -.84, az: .54, len: 20, w: 5.5, depth: 2.4 };   /* where the cold open ends */

export async function loadPilot() {
  const P = PLACES.pilot;
  const [hb, tb] = await Promise.all([bin('pilot-terrain.bin'), bin('pilot-trees.bin')]);
  const meta = { lo: -282, scale: .05, halves: [128, 512, 2048, 8192], sky: { az: 512, rad: 48, r0: 8192, r1: 60000 } };
  const u16 = new Uint16Array(hb), dec = (off, n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = meta.lo + u16[off + i] * meta.scale; return a; };
  const rings = meta.halves.map((half, k) => ({ half, h: dec(k * N * N, N * N) }));
  const skyline = { ...meta.sky, h: dec(4 * N * N, meta.sky.az * meta.sky.rad) };
  const T = makeTerrain({ name: 'pilot', rings, skyline });

  /* a level pad where the RV parks, a bed along the track, and the ditch the RV ends in */
  const h0 = T.heightAt(0, 0);
  editRing(T, 0, -16, -16, 16, 16, (x, z, h) => { const d = Math.hypot(x, z * .8); const k = 1 - Math.min(1, Math.max(0, (d - 7) / 8)); return h + (h0 - .05 - h) * k * k * (3 - 2 * k); });
  const D = DITCH, ditch = (x, z, h) => {
    const dx = x - D.x, dz = z - D.z, a = dx * D.ax + dz * D.az, b = -dx * D.az + dz * D.ax;
    const along = Math.max(0, Math.abs(a) - D.len / 2), k = Math.exp(-(b * b) / (D.w * D.w * .35)) * Math.exp(-(along * along) / 10);
    return h - D.depth * k;
  };
  for (const k of [0, 1]) editRing(T, k, D.x - 20, D.z - 20, D.x + 20, D.z + 20, ditch);
  morphRings(T);

  const lines = [PILOT_ROAD, PILOT_TRACK];
  const road = { tex: roadTexture(lines, 512), half: 512, width: 1.55, rut: .1, color: 0xb88a6a };
  const [aDet, aNear, aMid, aFar] = await Promise.all([texture('pilot-detail.jpg'), texture('pilot-near.jpg'), texture('pilot-mid.jpg'), texture('pilot-far.jpg')]);
  const horizon = computeHorizon(T);
  const strata = { offset: 0, noise: 1, strength: .92, steep: .32, bands: [-6, 6, 16, 20], band5: 47,
    pal: [0x74382a, 0x94472e, 0xa9552f, 0xcfa27e, 0x9a4a31, 0xc3ab8c] };
  const common = { sat: 1.32, bright: 1.12, strata };
  const mats = [
    terrainMaterial({ ...common, albedo: aDet, albHalf: 128, ringHalf: 128, horizon: horizon[0], detail: 1, road }),
    terrainMaterial({ ...common, albedo: aNear, albHalf: 512, ringHalf: 512, horizon: horizon[1], detail: .8, road }),
    terrainMaterial({ ...common, albedo: aMid, albHalf: 2048, ringHalf: 2048, horizon: horizon[2], detail: .3 }),
    terrainMaterial({ ...common, albedo: aFar, albHalf: 8192, ringHalf: 8192, horizon: horizon[3], far: true }),
    terrainMaterial({ tint: 0x9a6a50, sat: 1, bright: 1, ringHalf: 1, strata: { ...strata, strength: .4 }, far: true }),
  ];
  const groups = buildTerrainMeshes(T, mats);

  /* trees and shrubs where the photos show them: 0.5 m photo inside 128 m, 1 m to 512 m, 4 m beyond */
  const tv = new DataView(tb), nDet = tv.getUint32(0, true), nNear = tv.getUint32(4, true), nMid = tv.getUint32(8, true), trees = [];
  for (let i = 0; i < nDet + nNear + nMid; i++) {
    const o = 12 + i * 5;
    trees.push({ x: tv.getInt16(o, true) / 10, z: tv.getInt16(o + 2, true) / 10, r: tv.getUint8(o + 4) / 20, ring: i < nDet ? 0 : i < nDet + nNear ? 1 : 2 });
  }
  const place = { id: 'pilot', P, T, groups, mats, trees, lines, road };
  place.flora = buildPilotFlora(place); groups.near.add(place.flora);
  return place;
}

/* ---------- 4 Days Out: flat grassland to every horizon, far blue mountains ---------- */
export async function loadDays() {
  const P = PLACES.days;
  const half = [128, 512, 2048, 8192];
  const gh = (x, z) => {
    const r = Math.hypot(x, z);
    return (fbm(x * .0022 + 3.1, z * .0022 - 1.7, 4) - .5) * 5 + (fbm(x * .0004, z * .0004, 3) - .5) * 22 * Math.min(1, r / 3000)
      + (vnoise(x * .02, z * .02) - .5) * .35;
  };
  const rings = half.map(h => { const step = 2 * h / (N - 1), a = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) a[j * N + i] = gh(-h + i * step, -h + j * step); return { half: h, h: a }; });
  /* mountains on the horizon: ridges 30 to 60 km out, higher to the east and the north-west */
  const sk = { az: 512, rad: 48, r0: 8192, r1: 60000 }; sk.h = new Float32Array(sk.az * sk.rad);
  for (let k = 0; k < sk.rad; k++) for (let a = 0; a < sk.az; a++) {
    const th = a / sk.az * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), r0 = sk.r0 / Math.max(Math.abs(c), Math.abs(s));
    const r = r0 * Math.pow(sk.r1 / r0, k / (sk.rad - 1)), x = c * r, z = s * r;
    const ridge = 1 - Math.abs(fbm(x * .00011 + 7, z * .00011 - 3, 5) * 2 - 1);
    const far = Math.min(1, Math.max(0, (r - 24000) / 16000));
    const tall = .45 + .55 * Math.max(0, Math.cos(th - .1)) + .35 * Math.max(0, Math.cos(th + 2.3));
    sk.h[k * sk.az + a] = k === 0 ? gh(x, z) : gh(x, z) + far * Math.pow(ridge, 2.2) * 1100 * tall;
  }
  const T = makeTerrain({ name: 'days', rings, skyline: sk });
  const h0 = T.heightAt(0, 0);
  editRing(T, 0, -16, -16, 16, 16, (x, z, h) => { const d = Math.hypot(x, z * .8); const k = 1 - Math.min(1, Math.max(0, (d - 7) / 8)); return h + (h0 - .05 - h) * k * k * (3 - 2 * k); });
  morphRings(T);
  const horizon = computeHorizon(T);
  const grass = { amount: .9, scale: .05, color: 0xc9a86a };
  const mats = [
    terrainMaterial({ tint: 0xa88a58, sat: 1.1, bright: 1, ringHalf: 128, horizon: horizon[0], detail: .7, grass }),
    terrainMaterial({ tint: 0xa88a58, sat: 1.1, bright: 1, ringHalf: 512, horizon: horizon[1], detail: .5, grass }),
    terrainMaterial({ tint: 0xa88a58, sat: 1.1, bright: 1, ringHalf: 2048, horizon: horizon[2], detail: .2, grass: { ...grass, scale: .012 } }),
    terrainMaterial({ tint: 0xa4895a, sat: 1, bright: 1, ringHalf: 8192, horizon: horizon[3], grass: { ...grass, amount: .7, scale: .003 }, far: true }),
    terrainMaterial({ tint: 0x7d7466, sat: 1, bright: 1, ringHalf: 1, strata: { strength: .5, steep: .25, bands: [300, 600, 900, 1200], band5: 1500,
      pal: [0x9c8a62, 0x8a7a64, 0x6e6a66, 0x77746e, 0x807c76, 0x8a8680] }, far: true }),
  ];
  const groups = buildTerrainMeshes(T, mats);
  const place = { id: 'days', P, T, groups, mats, trees: [], lines: [] };
  place.flora = buildGrassField(place); groups.near.add(place.flora);
  return place;
}

/* ---------- Sunset: Old Joe's yard on the flat of the Rio Grande valley, the Sandias to the east ---------- */
export async function loadSunset() {
  const P = PLACES.sunset;
  const half = [128, 512, 2048, 8192];
  const gh = (x, z) => (fbm(x * .003 + 11, z * .003, 3) - .5) * 1.6 + (vnoise(x * .05, z * .05) - .5) * .12;
  const rings = half.map(h => { const step = 2 * h / (N - 1), a = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) a[j * N + i] = gh(-h + i * step, -h + j * step); return { half: h, h: a }; });
  const sk = { az: 512, rad: 48, r0: 8192, r1: 60000 }; sk.h = new Float32Array(sk.az * sk.rad);
  /* the Sandia and Manzano mountains: a long wall 20 to 30 km to the east, rising to 1,550 m above the valley */
  for (let k = 0; k < sk.rad; k++) for (let a = 0; a < sk.az; a++) {
    const th = a / sk.az * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), r0 = sk.r0 / Math.max(Math.abs(c), Math.abs(s));
    const r = r0 * Math.pow(sk.r1 / r0, k / (sk.rad - 1)), x = c * r, z = s * r;
    const eastK = Math.max(0, c);                                   /* +x is east */
    const wall = Math.exp(-Math.pow((x - 24000 - 3000 * Math.sin(z * .00009)) / 5200, 2)) * (1 - Math.min(1, Math.max(0, (z - 14000) / 26000) ** 2));
    const rough = fbm(x * .00025, z * .00025 + 4, 5);
    const west = Math.max(0, -c) * Math.min(1, Math.max(0, (r - 14000) / 10000)) * (150 + 200 * fbm(x * .0002, z * .0002, 4));
    sk.h[k * sk.az + a] = k === 0 ? gh(x, z) : gh(x, z) + wall * (900 + 700 * rough) * eastK + west + Math.max(0, (r - 9000)) * .004;
  }
  const T = makeTerrain({ name: 'sunset', rings, skyline: sk });
  const h0 = T.heightAt(0, 0);
  editRing(T, 0, -60, -60, 60, 60, (x, z, h) => { const d = Math.max(Math.abs(x), Math.abs(z)); const k = 1 - Math.min(1, Math.max(0, (d - 40) / 18)); return h + (h0 - h) * k; });
  morphRings(T);
  const horizon = computeHorizon(T);
  const yard = { amount: .22, scale: .04, color: 0xa89878 };
  const mats = [
    terrainMaterial({ tint: 0x8c7866, sat: 1, bright: 1, ringHalf: 128, horizon: horizon[0], detail: 1, grass: yard }),
    terrainMaterial({ tint: 0x8c7866, sat: 1, bright: 1, ringHalf: 512, horizon: horizon[1], detail: .8, grass: yard }),
    terrainMaterial({ tint: 0x8e7c68, sat: 1, bright: 1, ringHalf: 2048, horizon: horizon[2], detail: .2, grass: { amount: .3, scale: .01, color: 0x9a9070 } }),
    terrainMaterial({ tint: 0x8a7a66, sat: 1, bright: 1, ringHalf: 8192, horizon: horizon[3], far: true, grass: { amount: .25, scale: .003, color: 0x8f8a6e } }),
    terrainMaterial({ tint: 0x6f6660, sat: 1, bright: 1, ringHalf: 1, strata: { strength: .6, steep: .2, bands: [200, 500, 800, 1100], band5: 1400,
      pal: [0x8a7a68, 0x7a6e66, 0x6a6466, 0x75707a, 0x807a80, 0x8c8890] }, far: true }),
  ];
  const groups = buildTerrainMeshes(T, mats);
  return { id: 'sunset', P, T, groups, mats, trees: [], lines: [] };
}

export const LOADERS = { pilot: loadPilot, days: loadDays, sunset: loadSunset };
