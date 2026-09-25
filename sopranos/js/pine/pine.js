import * as THREE from 'three';
import { app } from '../app.js';
import { N, makeTerrain, morphRings, editRing, computeHorizon, buildTerrainMeshes, normalAt } from '../world/terrain.js';
import { groundMaterial, GU } from '../world/ground.js';
import { Forest } from '../world/trees.js';
import { levelRoads, roadRibbon, snowBanks, asphaltTex, lotTex, patch, resample } from '../world/roads.js';
import { seeded, inPoly, mat } from '../lib/util.js';
import { fbm, vnoise, hash2 } from '../lib/noise.js';
import { buildProps } from './props.js';
import { buildGame } from './game.js';
import { want, loop, play, slice, stopLoops } from '../audio.js';
import { tod } from '../world/lighting.js';
import { hotspot } from '../ctrl/hotspots.js';

/* Pine Barrens, filmed in Harriman State Park: the woods and the hill north of the Lake Tiorati picnic area, on the
   real ground (USGS 3DEP, 1 m lidar), with the roads and the lake from OpenStreetMap, on 9 January 2001, the morning
   after a snowfall. The origin is 170 m north-west of the picnic area; x east, z south, y up, metres. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = h => new THREE.Color(h);
export const P = {
  date: [2001, 0, 9], lat: 41.275898, lon: -74.090244, grid: .601, tz: -5, dst: true, hour: 11.6,
  turbidity: 2.1, rayleigh: 1.5, mie: .0036, mieG: .8, haze: 1 / 14000, sunI: 3.15, exposure: .74, nightExposure: 3.4,
  groundAlbedo: C(0xdfe4ea), skyK: .24,
  clouds: { cover: .1, scale: .00055, soft: .12, alt: 2800, depth: .28, wind: [4, 1] },
};
/* where things are in the story */
export const SPOTS = {
  car: { x: -118, z: 131, yaw: Math.PI * .96 },     /* Paulie's Cadillac at a pull-off on Arden Valley Road, nose to the woods */
  chain: { x: -120, z: 122 },                        /* two posts and a chain across the trail */
  grave: { x: -112, z: 96 },                         /* where Valery digs */
  top: { x: -98, z: -148 },                          /* the hilltop clearing: a phone signal */
  van: { x: 168, z: -236 },                          /* the abandoned van in the hollow */
};

async function bin(name) {
  const r = await fetch(new URL(`../../data/${name}`, import.meta.url));
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.arrayBuffer();
}
async function json(name) { const r = await fetch(new URL(`../../data/${name}`, import.meta.url)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); }
function image(name) {
  return new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => fail(new Error(name + ' did not load')); im.src = new URL(`../../data/${name}`, import.meta.url).href; });
}
function maskOf(im) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, im.width, im.height).data;
  const tex = new THREE.Texture(im); tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  return { w: im.width, h: im.height, d, tex };
}

export async function load({ status } = {}) {
  status && (status.textContent = 'Driving out to the woods…');
  const [hb, lines, m0, m1] = await Promise.all([bin('pine-terrain.bin'), json('pine-lines.json'), image('pine-mask.png'), image('pine-mask1.png')]);
  const meta = { lo: lines.lo, scale: .05, halves: [384, 1536, 6144, 24576], sky: { az: 512, rad: 48, r0: 24576, r1: 80000 } };
  const u16 = new Uint16Array(hb), dec = (off, n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = meta.lo + u16[off + i] * meta.scale; return a; };
  const rings = meta.halves.map((half, k) => ({ half, h: dec(k * N * N, N * N) }));
  const skyline = { ...meta.sky, h: dec(4 * N * N, meta.sky.az * meta.sky.rad) };
  const T = makeTerrain({ name: 'pine', rings, skyline });
  const mask0 = maskOf(m0), mask1 = maskOf(m1);
  const maskAt = (x, z) => {
    const M = Math.max(Math.abs(x), Math.abs(z)) < 380 ? { m: mask0, half: 384 } : { m: mask1, half: 1536 };
    const u = Math.floor((x + M.half) / (2 * M.half) * M.m.w), v = Math.floor((z + M.half) / (2 * M.half) * M.m.h);
    if (u < 0 || v < 0 || u >= M.m.w || v >= M.m.h) return [1, 0, 16];
    const i = (v * M.m.w + u) * 4; return [M.m.d[i] / 255, M.m.d[i + 1] / 255, M.m.d[i + 2] / 255 * 16];
  };

  /* the roads: levelled ground, the ribbons, the plow's banks; the pull-off where Paulie parks */
  const roads = lines.roads.filter(r => r.pts.some(([x, z]) => Math.abs(x) < 1500 && Math.abs(z) < 1500));
  const pull = { name: 'pull-off', w: 7, kind: 'service', pts: [[-132, 146], [-124, 138], [-118, 131]] };
  const levelled = levelRoads(T, [...roads, pull], [0, 1]);
  /* the picnic parking lot: level inside its outline */
  const lot = lines.parking[0];
  if (lot) {
    const pts = resample([...lot, lot[0]], 4), hs = pts.map(([x, z]) => T.heightAt(x, z)), hMean = hs.reduce((a, b) => a + b) / hs.length;
    editRing(T, 0, -40, 20, 150, 240, (x, z, h) => {
      if (inPoly(x, z, lot)) return hMean - .04;
      let best = 1e9; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(x - pts[i][0], z - pts[i][1]); if (d < best) best = d; }
      const f = Math.max(0, 1 - best / 6), s = f * f * (3 - 2 * f); return h + (hMean - .04 - h) * s;
    });
  }
  morphRings(T, [48, 192, 768]);
  status && (status.textContent = 'Working out where the hills throw their shadows…');
  const horizon = computeHorizon(T);
  const mats = [
    groundMaterial({ ringHalf: 384, horizon: horizon[0], mask: mask0.tex, maskHalf: 384, mode: 'snow', detail: 1 }),
    groundMaterial({ ringHalf: 1536, horizon: horizon[1], mask: mask1.tex, maskHalf: 1536, mode: 'snow', detail: .3 }),
    groundMaterial({ ringHalf: 6144, horizon: horizon[2], mode: 'snow', far: true }),
    groundMaterial({ ringHalf: 24576, horizon: horizon[3], mode: 'snow', far: true }),
    groundMaterial({ ringHalf: 1, mode: 'snow', far: true }),
  ];
  const groups = buildTerrainMeshes(T, mats);
  const near = groups.near;

  /* asphalt and banks */
  const winterAsphalt = new THREE.MeshStandardMaterial({ map: asphaltTex({ center: true, winter: true }), roughness: .72, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const plainAsphalt = new THREE.MeshStandardMaterial({ map: asphaltTex({ center: false, winter: true }), roughness: .75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const bankMat = mats[0];
  const junctions = [[165, 36, 14], [217, 41, 14], [206, 18, 14], [174, 58, 14], [111, 88, 9], [122, 42, 9], [184, 14, 8], [-124, 138, 9]];
  for (const L of levelled) {
    if (!L.pts.some(([x, z]) => Math.abs(x) < 700 && Math.abs(z) < 700)) continue;
    near.add(roadRibbon(T, L, L.w >= 6 ? winterAsphalt : plainAsphalt));
    near.add(snowBanks(T, L, bankMat, { gaps: junctions, height: L.w >= 6 ? .8 : .45 }));
  }
  if (lot) near.add(patch(T, lot, new THREE.MeshStandardMaterial({ map: lotTex(), roughness: .8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { uvScale: .04 }));

  /* the forest: every tree in the near ring, where the aerial shows canopy */
  status && (status.textContent = 'Growing the woods…');
  const rnd = seeded(2001), trees = [], rocks = [], logs = [];
  const nv = V(0, 0, 0);
  const keepClear = (x, z) => {
    for (const s of [SPOTS.car, SPOTS.grave, SPOTS.van]) if (Math.hypot(x - s.x, z - s.z) < (s === SPOTS.van ? 7 : 9)) return true;
    return Math.hypot(x - SPOTS.chain.x, z - SPOTS.chain.z) < 4;
  };
  const pickKind = (x, z, slope) => {
    const conif = fbm(x * .006 + 11, z * .006 - 4, 3), wet = fbm(x * .01 - 3, z * .01 + 8, 2), r = rnd();
    if (conif > .64 && r < .55) return rnd() < .6 ? 'pine' : 'hemlock';
    if (wet > .62 && r < .25) return 'hemlock';
    if (r < .34) return 'oak';
    if (r < .52) return 'maple';
    if (r < .56) return 'snag';
    return 'oak';
  };
  /* the canopy trees on a jittered grid, the understory on a finer one */
  const put = (x, z, kind) => {
    const y = T.heightAt(x, z), K = kind, vs = { oak: 4, maple: 3, beech: 3, sapling: 3, snag: 2, pine: 3, hemlock: 2, laurel: 3 }[K];
    trees.push({ x, z, y, kind: K, v: Math.floor(rnd() * vs), s: 0, a: rnd() * 6.283, tint: .82 + rnd() * .3, thin: rnd() });
    const t = trees[trees.length - 1];
    t.s = { oak: .8 + rnd() * .45, maple: .75 + rnd() * .45, beech: .55 + rnd() * .75, sapling: .5 + rnd() * .9, snag: .7 + rnd() * .5, pine: .75 + rnd() * .45, hemlock: .7 + rnd() * .5, laurel: .6 + rnd() * .7 }[K];
  };
  const HALF = 380;
  for (let gx = -HALF; gx < HALF; gx += 6.2) for (let gz = -HALF; gz < HALF; gz += 6.2) {
    const x = gx + rnd() * 6.2, z = gz + rnd() * 6.2;
    const [dens, lake, road] = maskAt(x, z);
    if (lake > .5 || road < 3.5 || keepClear(x, z)) continue;
    if (rnd() > dens * .92) continue;
    normalAt(T, x, z, 2, nv); const slope = 1 - nv.y;
    if (slope > .5 && rnd() < .7) continue;
    put(x, z, pickKind(x, z, slope));
  }
  for (let gx = -HALF; gx < HALF; gx += 3.6) for (let gz = -HALF; gz < HALF; gz += 3.6) {
    const x = gx + rnd() * 3.6, z = gz + rnd() * 3.6;
    const [dens, lake, road] = maskAt(x, z);
    if (lake > .5 || road < 2.5 || keepClear(x, z)) continue;
    const under = fbm(x * .02 + 5, z * .02 - 2, 3);
    if (rnd() > dens * (.2 + .55 * under)) continue;
    normalAt(T, x, z, 2, nv); const slope = 1 - nv.y;
    const laurel = fbm(x * .015 - 9, z * .015 + 3, 3) > .6 && slope > .05;
    put(x, z, laurel ? 'laurel' : rnd() < .62 ? 'beech' : 'sapling');
  }
  /* boulders where the hill steepens and a scatter of glacial erratics; fallen logs */
  for (let i = 0; i < 5200; i++) {
    const x = (rnd() - .5) * 2 * HALF, z = (rnd() - .5) * 2 * HALF;
    const [dens, lake, road] = maskAt(x, z); if (lake > .5 || road < 3 || keepClear(x, z)) continue;
    normalAt(T, x, z, 3, nv); const slope = 1 - nv.y;
    const p = slope > .12 ? .5 : .06 + .12 * fbm(x * .01, z * .01, 2);
    if (rnd() < p * .5) rocks.push({ x, z, y: T.heightAt(x, z), s: slope > .12 ? .5 + rnd() * rnd() * 2.6 : .3 + rnd() * rnd() * 1.6, k: rnd() });
  }
  for (let i = 0; i < 900; i++) {
    const x = (rnd() - .5) * 2 * HALF, z = (rnd() - .5) * 2 * HALF;
    const [dens, lake, road] = maskAt(x, z); if (lake > .5 || road < 4 || dens < .4 || keepClear(x, z)) continue;
    logs.push({ x, z, y: T.heightAt(x, z), a: rnd() * 6.283, l: 3 + rnd() * 7, r: .12 + rnd() * .2 });
  }
  /* the intro camera flies from the car to the grave at head height: no sapling or beech in its way. Taken out after
     the placing, so the rest of the woods stays where it was */
  const [ax, az, bx, bz] = [SPOTS.car.x - 6, SPOTS.car.z + 7, SPOTS.grave.x - 5, SPOTS.grave.z + 7.5];
  const fromPath = (x, z) => { const dx = bx - ax, dz = bz - az, k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - k * dx, z - az - k * dz); };
  for (let i = trees.length - 1; i >= 0; i--) { const t = trees[i], small = t.kind === 'beech' || t.kind === 'sapling' || t.kind === 'laurel'; if (fromPath(t.x, t.z) < (small ? 4.5 : 2)) trees.splice(i, 1); }
  const forest = new Forest(trees, { season: 'winter', snow: 1, rings: [{ ...horizon[0], half: 384 }], near: 40, mid: 125, far: 470 });
  near.add(forest.group);
  const props = buildProps({ T, rocks, logs, rings: horizon, SPOTS, lot, lines });
  near.add(props.group);

  /* what is in the way when you walk */
  const solidsNear = (x, z, r) => {
    const out = [];
    for (const t of forest.near(x, z, r)) { if (t.kind === 'laurel') out.push({ x: t.x, z: t.z, r: .45 * t.s }); else if (t.kind !== 'beech' || t.s > .9) out.push({ x: t.x, z: t.z, r: t.r + .05 }); }
    for (const s of props.solidsNear(x, z, r)) out.push(s);
    return out;
  };

  const place = {
    id: 'pine', P, T, groups, mats, forest, props, trees, rocks, logs, SPOTS, maskAt, lines,
    views: {
      overview: { label: 'Overview', pos: V(-160, 30, 196), target: V(-112, 4, 100), icon: '<path d="M3 17l5-7 4 5 3-3 6 5z"/>' },
      woods: { label: 'The woods', pos: V(-90, -4.5, 64), target: V(-60, -2, 20), icon: '<path d="M7 20V9M12 20V5M17 20V11"/><path d="M5 12l2-3 2 3M10 9l2-4 2 4M15 14l2-3 2 3"/>' },
      lake: { label: 'The lake', pos: V(120, -30, 330), target: V(-60, 0, 90), icon: '<path d="M3 15c3-2 6 2 9 0s6 2 9 0M3 19c3-2 6 2 9 0s6 2 9 0"/>' },
      van: { label: 'The van', pos: V(150, -38, -205), target: V(168, -44, -236), icon: '<rect x="3" y="8" width="18" height="9" rx="1.5"/><path d="M3 12h18M7 17v2M17 17v2"/>' },
      above: { label: 'From above', pos: V(-20, 420, 60), target: V(-20, 0, -40), icon: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>' },
    },
    viewOrder: ['overview', 'woods', 'lake', 'van', 'above'], startView: 'overview',
    orbit: { x: -40, z: 0, r: 420 }, fov: 40,
    walkStart: { pos: V(SPOTS.car.x + 4, 0, SPOTS.car.z - 6), yaw: .7 }, /* the posts and the sign at the edge of the lot, the woods behind */
    solidsNear,
    surfaceAt: (x, z) => { const [, , road] = maskAt(x, z); return road < .5 ? 1 : .78; },
    bound: p => { const r = Math.hypot(p.x + 20, p.z); if (r > 360) { p.x = -20 + (p.x + 20) / r * 360; p.z = p.z / r * 360; } },
    noAO: forest.meshes.filter(m => m.material.transparent || m.material.alphaTest > 0 || m.userData.lod === 'lod1').concat([forest.impMesh]),
    help: [['Space', 'Chase the Russian: the game. Click to shoot, WASD to move, Shift to run, E to use the phone.']],
    snowy: true,
    walkHelp: (mode, locked, noLock) => mode === 'game'
      ? (app.touch ? 'Left thumb to move · right thumb to aim · FIRE to shoot' : locked ? '' : 'Click to aim with the mouse · WASD to move · Shift to run · click to shoot · E for the phone')
      : null,
    enter() {
      GU.uTracks.value.w = 1; forest.update(true);
      want(['amb-winter', 'amb-wind', 'amb-night', 'owl', 'crow', 'stepsnow', 'pistol', 'pistol-far', 'echo', 'ricochet', 'shovel', 'thud', 'rustle', 'slide', 'phonebeep', 'static', 'rip', 'packet', 'reload', 'dryfire']);
    },
    /* the air: still winter woods by day, gusts when the light goes and you are lost, the frozen night; now and then a crow, an owl */
    sound() {
      const night = tod.night ?? 0, lost = place.act.state.phase === 'lost';
      loop('amb-winter').set((1 - night) * (lost ? .45 : .85));
      loop('amb-wind').set((lost ? .75 : .12) * (1 - night * .6));
      loop('amb-night').set(night * .9);
      const dt = Math.min(.2, app.time - (place.sT ?? app.time)); place.sT = app.time;
      place.birdT = (place.birdT ?? 8) - dt;
      if (place.birdT < 0) {
        place.birdT = 14 + Math.random() * 30;
        const c = app.camera.position, a = Math.random() * 6.28, d = 60 + Math.random() * 120, at = new THREE.Vector3(c.x + Math.cos(a) * d, c.y + 12, c.z + Math.sin(a) * d);
        if (night < .4) { play('crow', { pos: at, ref: d * .6, gain: .7 }); if (Math.random() < .6) play('crow', { pos: at, ref: d * .6, gain: .6, delay: .5 + Math.random() * .4 }); }
        else play('owl', { pos: at, ref: d * .7, gain: .7 });
      }
    },
    leave() { GU.uTracks.value.w = 0; place.act.stop?.(); stopLoops('amb-'); },
  };
  place.act = buildGame(place);
  hotspot(props.car, { title: 'Paulie’s Cadillac', text: 'Parked at a pull-off in the woods. Valery rode here in the trunk, rolled in a carpet: they thought Paulie had killed him with a floor lamp. By morning the car is gone, with Silvio’s $5,000 in it.' });
  hotspot(props.van, { title: 'The van', text: 'An abandoned plumber’s van in a hollow. Paulie and Christopher spend the night in it: the van’s carpet for warmth, frozen ketchup and relish packets from an old Nathan’s bag for dinner.' });
  hotspot(props.sign, { title: 'The chain across the trail', text: 'Two yellow posts and a chain, as in the episode. Past them the woods climb the hill.' });
  /* steps in the snow, for you and everyone who walks */
  app.on('step', e => { if (app.place !== place) return; const you = e.who === 'you'; slice('stepsnow', 4, .55, { pos: you ? null : new THREE.Vector3(e.pos.x, (e.pos.y ?? 0) + .1, e.pos.z), ref: 3, gain: you ? (e.run ? .42 : .32) : .45 }); });
  return place;
}
