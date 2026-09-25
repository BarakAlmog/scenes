import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded, canvasTex } from '../lib/util.js';
import { NOISE_GLSL, hash2, fbm } from '../lib/noise.js';
import { TU, normalAt } from './terrain.js';

/* What grows: one-seed junipers and shrubs where the aerial photos show them (their real places and sizes), dry
   grass tufts and stones scattered by rule around wherever you are, and on the grassland a field of grass.
   Every plant reads the ground's horizon map at its own foot, so a mesa's shadow at sunset falls across them too. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- geometry ---------- */
function jitter(g, amt, seed) {
  const r = seeded(seed), p = g.attributes.position, m = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!m.has(k)) m.set(k, [(r() - .5) * amt, (r() - .5) * amt, (r() - .5) * amt]);
    const [a, b, c] = m.get(k); p.setXYZ(i, p.getX(i) + a, p.getY(i) + b, p.getZ(i) + c);
  }
  return g;
}
/* normals from the canopy's centre: a soft, leafy shading instead of facets */
function puffNormals(g, c = V(0, .5, 0), mixFlat = .35) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, v = V(0, 0, 0), f = V(0, 0, 0);
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).sub(c).normalize(); f.set(n.getX(i), n.getY(i), n.getZ(i));
    v.lerp(f, mixFlat).normalize(); n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
const strip = g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g; };
/* a one-seed juniper: a low, lumpy, many-stemmed crown, about as wide as it is tall; normalised to height 1, radius 1 */
function juniperGeo(detail = 1) {
  const parts = [], r = seeded(5 + detail);
  const blobs = [[0, .5, 0, .55], [.45, .38, .15, .42], [-.42, .42, -.2, .44], [.1, .72, -.1, .38], [-.18, .3, .4, .36], [.25, .3, -.42, .34], [-.05, .88, .12, .26]];
  blobs.forEach(([x, y, z, rr], i) => {
    const s = strip(new THREE.IcosahedronGeometry(rr, detail)); s.scale(1, .82, 1); s.translate(x, y, z);
    parts.push(jitter(s, rr * .45, 11 + i + detail * 7));
  });
  const canopy = mergeVertices(mergeGeometries(parts));
  canopy.computeBoundingBox();
  const bb = canopy.boundingBox, h = bb.max.y - Math.max(0, bb.min.y), w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
  canopy.translate(0, -Math.max(0, bb.min.y) + .06, 0); canopy.scale(1 / w, 1 / h, 1 / w);
  puffNormals(canopy, V(0, .45, 0), .3);
  const trunk = strip(new THREE.CylinderGeometry(.06, .1, .45, 6)); trunk.translate(0, .15, 0); trunk.computeVertexNormals();
  return { canopy, trunk };
}
function shrubGeo(seed) {
  const s = strip(new THREE.IcosahedronGeometry(.5, 1)); s.scale(1, .62, 1); s.translate(0, .24, 0);
  return puffNormals(mergeVertices(jitter(s, .18, seed)), V(0, .1, 0), .25);
}
function rockGeo(seed) {
  const s = strip(new THREE.IcosahedronGeometry(.5, 1)); jitter(s, .32, seed);
  const p = s.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -.05) p.setY(i, -.05 + (p.getY(i) + .05) * .3);
  s.computeVertexNormals(); return s;
}
function grassGeo() {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const q = new THREE.PlaneGeometry(.55, .5, 1, 2); q.translate(0, .25, 0); q.rotateY(k * Math.PI / 3);
    parts.push(q);
  }
  const g = mergeGeometries(parts);
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
function grassTex(col = ['#d9b878', '#b8955a', '#e6cc8e', '#9c7a48']) {
  const rnd = seeded(5);
  const t = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const x = 10 + rnd() * (w - 20), bend = (rnd() - .5) * 26, top = 6 + rnd() * 50;
      g.strokeStyle = col[Math.floor(rnd() * col.length)]; g.lineWidth = 1.4 + rnd() * 1.6;
      g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + bend * .3, (h + top) / 2, x + bend, top); g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true;
  return t;
}

/* ---------- material: instanced, reads the horizon map and the clouds at its foot, sways if it is grass ---------- */
export const floraU = { uWind: { value: 0 } };
function vegMaterial(base, { sway = 0, rings = [], upNormal = false } = {}) {
  const m = new THREE.MeshStandardMaterial(base);
  m.defines = { BB_SUN: '' };
  if (upNormal) m.defines.BB_UP = '';
  const u = {
    tHA0: { value: rings[0]?.dirs[0] ?? null }, tHB0: { value: rings[0]?.dirs[0] ?? null }, tAO0: { value: rings[0]?.ao ?? null }, uH0: { value: rings[0]?.half ?? 1 },
    tHA1: { value: rings[1]?.dirs[0] ?? null }, tHB1: { value: rings[1]?.dirs[0] ?? null }, tAO1: { value: rings[1]?.ao ?? null }, uH1: { value: rings[1]?.half ?? 1 },
    uSway: { value: sway }, uHasHor: { value: rings.length ? 1 : 0 },
  };
  m.userData.u = u; m.userData.rings = rings;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, TU, floraU, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        ${NOISE_GLSL}
        uniform sampler2D tHA0, tHB0, tAO0, tHA1, tHB1, tAO1; uniform float uH0, uH1, uSway, uHasHor, uWind, uTime, uHorT, uSunSoft; uniform vec4 uMaskA, uMaskB; uniform vec3 uSunW;
        varying float vVis; varying float vAO;
        float bbHor(sampler2D a, sampler2D b, float hs, vec2 xz, out float ao, sampler2D aot) {
          vec2 uv = ((xz + hs) / (2. * hs) * 256. + .5) / 257.;
          ao = texture2D(aot, uv).r;
          return mix(dot(texture2D(a, uv), uMaskA), dot(texture2D(b, uv), uMaskB), uHorT) * 1.5707963 - .5235988;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 bbFoot = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        #else
        vec3 bbFoot = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;
        #endif
        if (uSway > 0.) {
          float h = max(0., position.y);
          float w = sin(uTime * 1.7 + bbFoot.x * .35 + bbFoot.z * .21) * .6 + sin(uTime * 3.1 + bbFoot.x * .9) * .25;
          transformed.x += w * h * h * uSway * (.6 + uWind);
          transformed.z += w * h * h * uSway * .5 * (.6 + uWind);
        }
        vVis = 1.; vAO = 1.;
        if (uHasHor > .5) {
          float ao, hor, d = max(abs(bbFoot.x), abs(bbFoot.z));
          if (d < uH0 - 2.) hor = bbHor(tHA0, tHB0, uH0, bbFoot.xz, ao, tAO0);
          else hor = bbHor(tHA1, tHB1, uH1, bbFoot.xz, ao, tAO1);
          vVis = smoothstep(hor - uSunSoft, hor + uSunSoft, asin(clamp(uSunW.y, -1., 1.)));
          vAO = ao;
        }
        vVis *= bbCloudShade(bbFoot.xz);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vVis; varying float vAO; float bbSunVis; uniform vec3 uSunW;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef BB_UP\n/* blades stand up: they catch a low sun side-on */\nnormal = normalize(mat3(viewMatrix) * normalize(vec3(0., .45, 0.) + normalize(vec3(uSunW.x, 0., uSunW.z) + vec3(1e-4)) * .55));\n#endif')
      .replace('#include <lights_fragment_begin>', 'bbSunVis = vVis;\n#include <lights_fragment_begin>')
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= mix(1., vAO, .85); reflectedLight.indirectSpecular *= mix(1., vAO, .85);\nreflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, vec3(dot(reflectedLight.indirectDiffuse, vec3(.3333))), .35);');
  };
  m.customProgramCacheKey = () => 'bbVeg';
  return m;
}
/* the horizon textures follow the sun's sector each frame, like the ground's */
const vegMats = new Set();
export function updateFloraHorizon(i0, i1) {
  for (const m of vegMats) {
    const r = m.userData.rings, u = m.userData.u;
    if (r[0]) { u.tHA0.value = r[0].dirs[i0 >> 2]; u.tHB0.value = r[0].dirs[i1 >> 2]; }
    if (r[1]) { u.tHA1.value = r[1].dirs[i0 >> 2]; u.tHB1.value = r[1].dirs[i1 >> 2]; }
  }
}

/* thin: the mesh can show fewer on slower devices (floraDensity); its list is shuffled so fewer stays even */
function instanced(geo, material, list, place, { cast = false, recv = true, thin = false } = {}) {
  if (thin) { const r = seeded(list.length + 7); list = list.slice(); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } }
  const im = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(1, 1, 1), p = V(0, 0, 0), c = new THREE.Color();
  list.forEach((it, i) => { place(it, p, q, s, c); m4.compose(p, q, s); im.setMatrixAt(i, m4); im.setColorAt(i, c); });
  im.count = list.length;
  im.castShadow = cast; im.receiveShadow = recv; im.frustumCulled = false; im.userData.keep = true; im.userData.thin = thin; im.userData.full = list.length;
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

/* ---------- the pilot site ---------- */
export function buildPilotFlora(place) {
  const T = place.T, rings = place.T.horizon.map((h, k) => ({ ...h, half: T.rings[k].half }));
  const group = new THREE.Group(); group.name = 'flora';
  const rnd = seeded(123);
  const up = V(0, 1, 0), nv = V(0, 0, 0);
  const clearOf = (x, z) => {
    if (Math.abs(x) < 9 && Math.abs(z) < 9) return false;                    /* the RV's pad */
    for (const l of place.lines) for (let i = 0; i < l.length - 1; i++) {
      const [ax, az] = l[i], [bx, bz] = l[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < 3.2) return false;
    }
    return true;
  };
  const trees = place.trees.filter(t => clearOf(t.x, t.z));
  const jun = trees.filter(t => t.r >= 1.15), shrubs = trees.filter(t => t.r < 1.15 && t.ring < 2);
  const dist = t => Math.hypot(t.x, t.z);
  const close = jun.filter(t => dist(t) < 90), near = jun.filter(t => dist(t) >= 90 && Math.max(Math.abs(t.x), Math.abs(t.z)) < 520);
  const far = jun.filter(t => Math.max(Math.abs(t.x), Math.abs(t.z)) >= 520 && dist(t) < 1700);
  const J = juniperGeo(1), Jlow = juniperGeo(0), Jfar = strip(new THREE.OctahedronGeometry(.6, 0)); Jfar.scale(1, .9, 1); Jfar.translate(0, .55, 0); puffNormals(Jfar, V(0, .3, 0), .2);
  const canopyMat = vegMaterial({ color: 0xffffff, roughness: .92 }, { rings });
  const trunkMat = vegMaterial({ color: 0x5a4632, roughness: .9 }, { rings });
  const place3 = (t, p, q, s, c) => {
    const y = T.heightAt(t.x, t.z), k = hash2(t.x + 7, t.z - 3);
    const r = Math.min(3.4, t.r * 1.0), h = Math.min(4.6, (.85 + .45 * hash2(t.x, t.z)) * r + .5);
    p.set(t.x, y - .1, t.z); q.setFromAxisAngle(up, hash2(t.z, t.x) * 6.28);
    s.set(r, h, r * (.85 + hash2(t.x * 3, t.z) * .3));
    c.setRGB(.032 + .018 * k, .05 + .02 * k, .026 + .01 * k);
  };
  group.add(instanced(J.canopy, canopyMat, close, (t, p, q, s, c) => place3(t, p, q, s, c), { cast: true }));
  group.add(instanced(J.trunk, trunkMat, close.filter(t => t.r > 1.6), (t, p, q, s, c) => { place3(t, p, q, s, c); s.set(1, 1, 1); c.setRGB(.35, .28, .2); }, { cast: true }));
  const nearJ = instanced(Jlow.canopy, canopyMat, near, (t, p, q, s, c) => place3(t, p, q, s, c)), farJ = instanced(Jfar, canopyMat, far, (t, p, q, s, c) => place3(t, p, q, s, c));
  group.add(nearJ, farJ);
  const closeMeshes = group.children.slice(0, 2);
  place.blockers = [{ mesh: closeMeshes[0], list: close }, { mesh: nearJ, list: near.filter(t => dist(t) < 260) , all: near }];
  place.obstacles = close.filter(t => t.r > 1.3).map(t => ({ x: t.x, z: t.z, r: t.r * .8 }));
  place.floraCounts = { close: close.length, near: near.length, far: far.length, shrubs: shrubs.length };
  /* shrubs: grey sage, olive saltbush, and chamisa in yellow bloom at the end of September */
  const shrubMat = vegMaterial({ color: 0xffffff, roughness: .95 }, { rings });
  const S = shrubGeo(3);
  const shrubPlace = (t, p, q, s, c) => {
    const y = T.heightAt(t.x, t.z), r = .45 + t.r * .55, k = hash2(t.x * 1.3, t.z * .7);
    p.set(t.x, y - .06, t.z); q.setFromAxisAngle(up, k * 6.28); s.set(r, r * (.75 + .5 * hash2(t.z, t.x)), r);
    if (k < .5) c.setRGB(.16, .18, .12); else if (k < .8) c.setRGB(.12, .13, .07); else c.setRGB(.36, .27, .04);
  };
  group.add(instanced(S, shrubMat, shrubs.filter(t => dist(t) < 60), shrubPlace, { cast: true }));
  const farShrubs = instanced(S, shrubMat, shrubs.filter(t => dist(t) >= 60), shrubPlace, { thin: true }); group.add(farShrubs);
  /* stones: at the foot of the cliffs and scattered on the flats, more near the rock */
  const stones = [];
  for (let i = 0; i < 9000; i++) {
    const x = (rnd() - .5) * 500, z = (rnd() - .5) * 500;
    if (!clearOf(x, z)) continue;
    normalAt(T, x, z, 2, nv);
    const steep = 1 - nv.y, base = normalAt(T, x + nv.x * 6, z + nv.z * 6, 3, V(0, 0, 0));
    const talus = steep > .08 && steep < .35 && (1 - base.y) > .3;
    if (talus ? rnd() < .75 : rnd() < .12 + .3 * fbm(x * .02, z * .02, 2)) stones.push({ x, z, s: talus ? .25 + rnd() * 1.1 : .08 + rnd() * .28, k: rnd() });
  }
  const rockMat = vegMaterial({ color: 0xffffff, roughness: .92 }, { rings });
  const rockPlace = (t, p, q, s, c) => {
    p.set(t.x, T.heightAt(t.x, t.z) - t.s * .15, t.z); q.setFromEuler(new THREE.Euler(t.k * .6, t.k * 9, t.k * .4)); s.set(t.s * (1 + t.k * .5), t.s * .7, t.s);
    const k = t.k; c.setRGB(.26 + .1 * k, .11 + .04 * k, .07 + .03 * k);
  };
  const RG = rockGeo(9);
  group.add(instanced(RG, rockMat, stones.filter(t => Math.hypot(t.x, t.z) < 60), rockPlace, { cast: true }));
  const farRocks = instanced(RG, rockMat, stones.filter(t => Math.hypot(t.x, t.z) >= 60), rockPlace, { thin: true }); group.add(farRocks);
  /* dry grass tufts, and a denser band where the washes run */
  const tufts = [];
  for (let i = 0; i < 20000 && tufts.length < 9000; i++) {
    const r = Math.sqrt(rnd()) * 150, a = rnd() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!clearOf(x, z) && (Math.abs(x) < 7.5 && Math.abs(z) < 7.5)) continue;
    normalAt(T, x, z, 1, nv); if (nv.y < .85) continue;
    if (rnd() < .35 + .5 * fbm(x * .05 + 3, z * .05, 3)) tufts.push({ x, z, k: rnd() });
  }
  const grassMat = vegMaterial({ color: 0xffffff, map: grassTex(), alphaTest: .45, side: THREE.DoubleSide, roughness: .95 }, { sway: .35, rings, upNormal: true });
  let tuftMesh;
  group.add(tuftMesh = instanced(grassGeo(), grassMat, tufts, (t, p, q, s, c) => {
    p.set(t.x, T.heightAt(t.x, t.z) - .03, t.z); q.setFromAxisAngle(up, t.k * 6.28); const sc = .4 + t.k * .55; s.set(sc, sc * (.6 + t.k * .6), sc);
    c.setRGB(.62 + .1 * t.k, .5 + .08 * t.k, .36);
  }, { thin: true }));
  for (const m of [canopyMat, trunkMat, shrubMat, rockMat, grassMat]) vegMats.add(m);
  /* far plants stay out of the ambient-occlusion and outline passes */
  place.noAO = [nearJ, farJ, farShrubs, farRocks, tuftMesh];
  return group;
}

/* ---------- the grassland: grass to every horizon ---------- */
const smoothEdge = r => { const t = Math.min(1, Math.max(0, (r - 70) / 70)); return t * t * (3 - 2 * t); };
export function buildGrassField(place) {
  const T = place.T, rings = T.horizon.map((h, k) => ({ ...h, half: T.rings[k].half }));
  const group = new THREE.Group(); group.name = 'flora';
  const rnd = seeded(321), up = V(0, 1, 0);
  const tufts = [];
  for (let i = 0; i < 70000; i++) {
    const r = Math.pow(rnd(), .55) * 140, a = rnd() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 6.2 && Math.abs(z) < 3.2) continue;
    /* thinner toward the edge of the field, so it fades into the ground's own grass */
    if (rnd() < smoothEdge(r)) continue;
    tufts.push({ x, z, k: rnd(), r });
  }
  const grassMat = vegMaterial({ color: 0xffffff, map: grassTex(['#dcc07e', '#c7a462', '#ead48f', '#b08a52']), alphaTest: .42, side: THREE.DoubleSide, roughness: .95 }, { sway: .55, rings, upNormal: true });
  group.add(instanced(grassGeo(), grassMat, tufts, (t, p, q, s, c) => {
    p.set(t.x, T.heightAt(t.x, t.z) - .02, t.z); q.setFromAxisAngle(up, t.k * 6.28);
    const near = Math.min(1, t.r / 12), sc = (.75 + t.k * .6) * (.7 + .3 * near); s.set(sc * 1.2, sc * (.55 + t.k * .45) * (.6 + .4 * near), sc * 1.2);
    c.setRGB(.56 + .1 * t.k, .45 + .07 * t.k, .28);
  }, { thin: true }));
  const shrubMat = vegMaterial({ color: 0xffffff, roughness: .95 }, { rings });
  const sh = [];
  for (let i = 0; i < 700; i++) { const x = (rnd() - .5) * 600, z = (rnd() - .5) * 600; if (Math.hypot(x, z) > 14) sh.push({ x, z, k: rnd() }); }
  group.add(instanced(shrubGeo(5), shrubMat, sh, (t, p, q, s, c) => {
    p.set(t.x, T.heightAt(t.x, t.z) - .05, t.z); q.setFromAxisAngle(up, t.k * 6.28); const r = .5 + t.k * .7; s.set(r, r * .8, r);
    c.setRGB(.36, .36, .26);
  }, { cast: true, thin: true }));
  for (const m of [grassMat, shrubMat]) vegMats.add(m);
  return group;
}

/* ---------- the yard: weeds along the fence ---------- */
export function buildYardWeeds(place, spots) {
  const T = place.T, rings = T.horizon.map((h, k) => ({ ...h, half: T.rings[k].half }));
  const group = new THREE.Group(); group.name = 'flora';
  const rnd = seeded(99), up = V(0, 1, 0), tufts = [];
  for (const [x0, z0, x1, z1, n] of spots) for (let i = 0; i < n; i++) tufts.push({ x: x0 + rnd() * (x1 - x0), z: z0 + rnd() * (z1 - z0), k: rnd() });
  const grassMat = vegMaterial({ color: 0xffffff, map: grassTex(['#b6a172', '#9c8a5c', '#c8b27a', '#86734a']), alphaTest: .45, side: THREE.DoubleSide, roughness: .95 }, { sway: .3, rings, upNormal: true });
  group.add(instanced(grassGeo(), grassMat, tufts, (t, p, q, s, c) => {
    p.set(t.x, T.heightAt(t.x, t.z) - .02, t.z); q.setFromAxisAngle(up, t.k * 6.28); const sc = .5 + t.k * .6; s.set(sc, sc, sc); c.setRGB(.8, .74, .6);
  }, { thin: true }));
  vegMats.add(grassMat);
  return group;
}

/* trees between a scripted camera and what it looks at step out of the way (and come back after) */
const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
/* how much of the thinnable ground cover to show: 1 all, less on slower devices */
export function floraDensity(group, k) {
  group?.traverse(o => { if (o.isInstancedMesh && o.userData.thin) o.count = Math.max(1, Math.round(o.userData.full * k)); });
}
export function clearView(place, cam, target) {
  if (!place?.blockers) return;
  const dx = target.x - cam.x, dz = target.z - cam.z, L2 = dx * dx + dz * dz || 1;
  for (const b of place.blockers) {
    const list = b.list, mesh = b.mesh; let dirty = false;
    b.hidden ??= new Set();
    for (let i = 0; i < list.length; i++) {
      const t = list[i], u = ((t.x - cam.x) * dx + (t.z - cam.z) * dz) / L2;
      const px = cam.x + dx * u - t.x, pz = cam.z + dz * u - t.z;
      const block = u > -.02 && u < .98 && Math.hypot(px, pz) < t.r + 1.2;
      const idx = b.all ? b.all.indexOf(t) : i;
      if (idx < 0) continue;
      if (block && !b.hidden.has(idx)) { mesh.getMatrixAt(idx, m4); b.saved ??= new Map(); b.saved.set(idx, m4.clone()); mesh.setMatrixAt(idx, zero); b.hidden.add(idx); dirty = true; }
      else if (!block && b.hidden.has(idx)) { mesh.setMatrixAt(idx, b.saved.get(idx)); b.hidden.delete(idx); dirty = true; }
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  }
}
export function restoreView(place) {
  if (!place?.blockers) return;
  for (const b of place.blockers) { if (!b.hidden?.size) continue; for (const idx of b.hidden) b.mesh.setMatrixAt(idx, b.saved.get(idx)); b.hidden.clear(); b.mesh.instanceMatrix.needsUpdate = true; }
}
