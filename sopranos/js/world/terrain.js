import * as THREE from 'three';
import { app } from '../app.js';
import { NOISE_GLSL } from '../lib/noise.js';

/* The ground: square rings of 257 x 257 heights, each four times the size of the last, and a polar skyline out to
   the horizon. Each finer ring blends into the next at its edge, so they meet. A GPU pass marches every texel toward
   16 compass points and keeps the highest horizon angle: the ground shader turns that into shadows of the hills at
   any hour, and into sky light (ambient occlusion). */
export const N = 257, DIRS = 16;
const R_EFF = 6371000 * 1.15;   /* the earth's radius, stretched for refraction */
export const drop = d2 => d2 / (2 * R_EFF);

/* ---------- a terrain: heights, and the CPU surface that matches the triangles ---------- */
export function makeTerrain({ name, rings, skyline }) {
  const T = { name, rings, skyline, meshes: [], horizon: null };
  for (const r of rings) r.step = 2 * r.half / (N - 1);
  T.heightAt = (x, z) => heightAt(T, x, z);
  return T;
}

function ringSurface(r, x, z) {
  const u = Math.min(N - 1.000001, Math.max(0, (x + r.half) / r.step)), v = Math.min(N - 1.000001, Math.max(0, (z + r.half) / r.step));
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, h = r.h, o = j * N + i;
  const a = h[o], b = h[o + 1], c = h[o + N], d = h[o + N + 1];
  return fu + fv <= 1 ? a + (b - a) * fu + (c - a) * fv : d + (c - d) * (1 - fu) + (b - d) * (1 - fv);
}

function skySurface(s, x, z) {
  const r = Math.hypot(x, z), th = ((Math.atan2(z, x) / (2 * Math.PI)) % 1 + 1) % 1;
  const c = Math.cos(th * 2 * Math.PI), sn = Math.sin(th * 2 * Math.PI), r0 = s.r0 / Math.max(Math.abs(c), Math.abs(sn));
  const t = Math.log(Math.max(r, r0) / r0) / Math.log(s.r1 / r0) * (s.rad - 1);
  const a = th * s.az, i0 = Math.floor(a) % s.az, i1 = (i0 + 1) % s.az, fa = a - Math.floor(a);
  const k0 = Math.min(s.rad - 2, Math.floor(t)), fk = Math.min(1, t - k0);
  const H = (k, i) => s.h[k * s.az + i];
  return (H(k0, i0) * (1 - fa) + H(k0, i1) * fa) * (1 - fk) + (H(k0 + 1, i0) * (1 - fa) + H(k0 + 1, i1) * fa) * fk;
}

export function heightAt(T, x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  let h;
  for (const r of T.rings) if (d <= r.half) { h = ringSurface(r, x, z); break; }
  if (h === undefined) h = T.skyline ? skySurface(T.skyline, x, z) : ringSurface(T.rings[T.rings.length - 1], x, z);
  return h - drop(x * x + z * z);
}

export function normalAt(T, x, z, e = 1, out = new THREE.Vector3()) {
  const hx = T.heightAt(x + e, z) - T.heightAt(x - e, z), hz = T.heightAt(x, z + e) - T.heightAt(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

/* the finer ring's outer band takes the coarser ring's surface, so the edges meet exactly */
export function morphRings(T, band = [16, 64, 256]) {
  for (let k = 0; k < T.rings.length - 1; k++) {
    const f = T.rings[k], c = T.rings[k + 1], b = band[k] ?? f.half / 8;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -f.half + i * f.step, z = -f.half + j * f.step, d = Math.max(Math.abs(x), Math.abs(z));
      const t = Math.min(1, Math.max(0, (d - (f.half - b)) / b));
      if (t > 0) f.h[j * N + i] = f.h[j * N + i] * (1 - t) + ringSurface(c, x, z) * t;
    }
  }
}

/* a change to the near heights: fn(x, z, h) returns the new height */
export function editRing(T, k, x0, z0, x1, z1, fn) {
  const r = T.rings[k];
  const i0 = Math.max(0, Math.floor((x0 + r.half) / r.step)), i1 = Math.min(N - 1, Math.ceil((x1 + r.half) / r.step));
  const j0 = Math.max(0, Math.floor((z0 + r.half) / r.step)), j1 = Math.min(N - 1, Math.ceil((z1 + r.half) / r.step));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -r.half + i * r.step, z = -r.half + j * r.step;
    r.h[j * N + i] = fn(x, z, r.h[j * N + i]);
  }
}

/* ---------- horizon angles on the CPU, for one point (the RV) ---------- */
export function horizonAt(T, x, z, lift = 1.5) {
  const h0 = T.heightAt(x, z) + lift, out = new Float32Array(DIRS);
  for (let k = 0; k < DIRS; k++) {
    const a = k / DIRS * Math.PI * 2, dx = Math.sin(a), dz = -Math.cos(a);
    let best = -.6, t = 2;
    for (let s = 0; s < 110 && t < (T.skyline?.r1 ?? 60000); s++, t *= 1.1) {
      const e = (T.heightAt(x + dx * t, z + dz * t) - h0) / t;
      if (e > best) best = e;
    }
    out[k] = Math.atan(best);
  }
  return out;
}

/* ---------- geometry ---------- */
function ringGeometry(T, k) {
  const r = T.rings[k], inner = k > 0 ? T.rings[k - 1].half : 0, pos = new Float32Array(N * N * 3), nor = new Float32Array(N * N * 3);
  const nv = new THREE.Vector3();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -r.half + i * r.step, z = -r.half + j * r.step, o = (j * N + i) * 3;
    pos[o] = x; pos[o + 1] = r.h[j * N + i] - drop(x * x + z * z); pos[o + 2] = z;
    normalAt(T, x, z, r.step, nv); nor[o] = nv.x; nor[o + 1] = nv.y; nor[o + 2] = nv.z;
  }
  const idx = [];
  const eps = r.step * .01;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const x0 = -r.half + i * r.step, z0 = -r.half + j * r.step;
    if (inner && x0 >= -inner - eps && x0 + r.step <= inner + eps && z0 >= -inner - eps && z0 + r.step <= inner + eps) continue;
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  /* a skirt hangs from the outer edge and hides any hairline crack against the next ring */
  const base = N * N, edge = [], depth = r.step * 1.5;
  for (let i = 0; i < N - 1; i++) edge.push(i);
  for (let j = 0; j < N - 1; j++) edge.push(j * N + N - 1);
  for (let i = N - 1; i > 0; i--) edge.push((N - 1) * N + i);
  for (let j = N - 1; j > 0; j--) edge.push(j * N);
  const sk = new Float32Array(edge.length * 3), skn = new Float32Array(edge.length * 3);
  edge.forEach((v, n) => { sk[n * 3] = pos[v * 3]; sk[n * 3 + 1] = pos[v * 3 + 1] - depth; sk[n * 3 + 2] = pos[v * 3 + 2]; skn.set(nor.subarray(v * 3, v * 3 + 3), n * 3); });
  for (let n = 0; n < edge.length; n++) {
    const a = edge[n], b = edge[(n + 1) % edge.length], c = base + n, d = base + (n + 1) % edge.length;
    idx.push(a, b, c, b, d, c);
  }
  const P = new Float32Array(pos.length + sk.length); P.set(pos); P.set(sk, pos.length);
  const Nn = new Float32Array(nor.length + skn.length); Nn.set(nor); Nn.set(skn, nor.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setIndex(idx);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

function skylineGeometry(T) {
  const s = T.skyline, pos = new Float32Array(s.az * s.rad * 3), nor = new Float32Array(s.az * s.rad * 3), nv = new THREE.Vector3();
  for (let k = 0; k < s.rad; k++) for (let a = 0; a < s.az; a++) {
    const th = a / s.az * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), r0 = s.r0 / Math.max(Math.abs(c), Math.abs(sn));
    const r = r0 * Math.pow(s.r1 / r0, k / (s.rad - 1)), x = c * r, z = sn * r, o = (k * s.az + a) * 3;
    pos[o] = x; pos[o + 1] = s.h[k * s.az + a] - drop(x * x + z * z); pos[o + 2] = z;
    normalAt(T, x, z, Math.max(60, r * .01), nv); nor[o] = nv.x; nor[o + 1] = nv.y; nor[o + 2] = nv.z;
  }
  const idx = [];
  for (let k = 0; k < s.rad - 1; k++) for (let a = 0; a < s.az; a++) {
    const a1 = (a + 1) % s.az, p = k * s.az + a, q = k * s.az + a1, u = p + s.az, w = q + s.az;
    idx.push(p, u, q, q, u, w);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

/* ---------- horizon maps on the GPU ---------- */
const HOR_VS = /* glsl */`void main(){ gl_Position = vec4(position.xy, 0., 1.); }`;
const HOR_FS = /* glsl */`
precision highp float;
uniform sampler2D tR0, tR1, tR2, tR3, tSky;
uniform vec4 uHalf;          /* the four ring half sizes */
uniform vec4 uSky;           /* az count, rad count, r0, r1 */
uniform float uHasSky, uRing, uDir0, uREff, uLift, uMaxD;
float ringH(sampler2D t, float hs, vec2 p) {
  vec2 g = clamp((p + hs) / (2. * hs) * 256., vec2(0.), vec2(255.999));
  ivec2 i = ivec2(floor(g)); vec2 f = g - vec2(i);
  float a = texelFetch(t, i, 0).r, b = texelFetch(t, i + ivec2(1, 0), 0).r, c = texelFetch(t, i + ivec2(0, 1), 0).r, d = texelFetch(t, i + ivec2(1, 1), 0).r;
  return f.x + f.y <= 1. ? a + (b - a) * f.x + (c - a) * f.y : d + (c - d) * (1. - f.x) + (b - d) * (1. - f.y);
}
float skyH(vec2 p) {
  float r = length(p), th = fract(atan(p.y, p.x) / 6.2831853 + 1.);
  float c = cos(th * 6.2831853), s = sin(th * 6.2831853), r0 = uSky.z / max(abs(c), abs(s));
  float t = log(max(r, r0) / r0) / log(uSky.w / r0) * (uSky.y - 1.);
  float a = th * uSky.x; int i0 = int(mod(floor(a), uSky.x)); int i1 = int(mod(float(i0 + 1), uSky.x)); float fa = fract(a);
  int k0 = int(min(uSky.y - 2., floor(t))); float fk = min(1., t - float(k0));
  float h00 = texelFetch(tSky, ivec2(i0, k0), 0).r, h01 = texelFetch(tSky, ivec2(i1, k0), 0).r;
  float h10 = texelFetch(tSky, ivec2(i0, k0 + 1), 0).r, h11 = texelFetch(tSky, ivec2(i1, k0 + 1), 0).r;
  return mix(mix(h00, h01, fa), mix(h10, h11, fa), fk);
}
float H(vec2 p) {
  float d = max(abs(p.x), abs(p.y)), h;
  if (d <= uHalf.x) h = ringH(tR0, uHalf.x, p);
  else if (d <= uHalf.y) h = ringH(tR1, uHalf.y, p);
  else if (d <= uHalf.z) h = ringH(tR2, uHalf.z, p);
  else if (d <= uHalf.w || uHasSky < .5) h = ringH(tR3, uHalf.w, p);
  else h = skyH(p);
  return h - dot(p, p) / (2. * uREff);
}
void main() {
  vec2 ij = gl_FragCoord.xy - .5;
  float hs = uRing < .5 ? uHalf.x : uRing < 1.5 ? uHalf.y : uRing < 2.5 ? uHalf.z : uHalf.w;
  float stp = 2. * hs / 256.;
  vec2 p0 = -hs + ij * stp;
  float h0 = H(p0) + uLift;
  vec4 outv;
  for (int k = 0; k < 4; k++) {
    float a = (uDir0 + float(k)) / 16. * 6.2831853;
    vec2 dir = vec2(sin(a), -cos(a));
    float best = -.6, t = stp * .6;
    for (int s = 0; s < 110; s++) {
      vec2 p = p0 + dir * t;
      float e = (H(p) - h0) / t;
      best = max(best, e);
      t *= 1.085;
      if (t > uMaxD) break;
    }
    float ang = atan(best);                       /* -0.54 .. 1.57 */
    outv[k] = clamp((ang + .5235988) / 1.5707963, 0., 1.);
  }
  gl_FragColor = outv;
}`;
const AO_FS = /* glsl */`
precision highp float;
uniform sampler2D t0, t1, t2, t3;
void main() {
  ivec2 i = ivec2(gl_FragCoord.xy);
  vec4 a[4]; a[0] = texelFetch(t0, i, 0); a[1] = texelFetch(t1, i, 0); a[2] = texelFetch(t2, i, 0); a[3] = texelFetch(t3, i, 0);
  float s = 0.;
  for (int k = 0; k < 4; k++) for (int c = 0; c < 4; c++) { float ang = max(0., a[k][c] * 1.5707963 - .5235988); float cs = cos(ang); s += cs * cs; }
  gl_FragColor = vec4(s / 16., 0., 0., 1.);
}`;

function floatTex(data, w, h) {
  const t = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

export function computeHorizon(T) {
  const r = app.renderer;
  const ringTex = T.rings.map(g => floatTex(g.h, N, N));
  while (ringTex.length < 4) ringTex.push(ringTex[ringTex.length - 1]);
  const halves = T.rings.map(g => g.half); while (halves.length < 4) halves.push(halves[halves.length - 1]);
  const s = T.skyline, skyTex = s ? floatTex(s.h, s.az, s.rad) : ringTex[2];
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({ vertexShader: HOR_VS, fragmentShader: HOR_FS, depthTest: false, depthWrite: false,
    uniforms: { tR0: { value: ringTex[0] }, tR1: { value: ringTex[1] }, tR2: { value: ringTex[2] }, tR3: { value: ringTex[3] }, tSky: { value: skyTex },
      uHalf: { value: new THREE.Vector4(...halves) }, uSky: { value: new THREE.Vector4(s?.az ?? 1, s?.rad ?? 2, s?.r0 ?? 1, s?.r1 ?? 2) },
      uHasSky: { value: s ? 1 : 0 }, uRing: { value: 0 }, uDir0: { value: 0 }, uREff: { value: R_EFF }, uLift: { value: .4 }, uMaxD: { value: s?.r1 ?? halves[3] } } });
  const aoMat = new THREE.ShaderMaterial({ vertexShader: HOR_VS, fragmentShader: AO_FS, depthTest: false, depthWrite: false,
    uniforms: { t0: { value: null }, t1: { value: null }, t2: { value: null }, t3: { value: null } } });
  const prev = r.getRenderTarget(), out = [];
  const rt = () => { const t = new THREE.WebGLRenderTarget(N, N, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false });
    t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter; t.texture.generateMipmaps = false; return t; };
  T.rings.forEach((_, k) => {
    const dirs = [];
    for (let q = 0; q < 4; q++) {
      const target = rt(); quad.material = mat; mat.uniforms.uRing.value = k; mat.uniforms.uDir0.value = q * 4;
      r.setRenderTarget(target); r.render(scene, cam); dirs.push(target);
    }
    const ao = rt(); quad.material = aoMat;
    dirs.forEach((d, i) => { aoMat.uniforms['t' + i].value = d.texture; });
    r.setRenderTarget(ao); r.render(scene, cam);
    out.push({ dirs: dirs.map(d => d.texture), ao: ao.texture, targets: [...dirs, ao] });
  });
  r.setRenderTarget(prev);
  new Set(ringTex).forEach(t => t.dispose()); if (s) skyTex.dispose();
  mat.dispose(); aoMat.dispose(); quad.geometry.dispose();
  T.horizon = out;
  return out;
}

/* ---------- the ground material ---------- */
/* uniforms every terrain shares; lighting.js and sky.js keep them current */
export const TU = {
  uSunW: { value: new THREE.Vector3(0, 1, 0) }, uSunSoft: { value: .03 },
  uHorT: { value: 0 }, uMaskA: { value: new THREE.Vector4(1, 0, 0, 0) }, uMaskB: { value: new THREE.Vector4(0, 1, 0, 0) },
  tHaze: { value: null }, uHazeDensity: { value: 1 / 60000 },
  bbCloud: { value: new THREE.Vector4(0, .0012, .55, .12) }, bbCloudOff: { value: new THREE.Vector2() },
  uTime: { value: 0 },
};

const TERRAIN_PARS = /* glsl */`
${NOISE_GLSL}
varying vec3 vBBW; varying vec3 vBBN;
uniform sampler2D tAlb, tHorA, tHorB, tAO, tRoad, tHaze;
uniform vec4 uAlb;            /* x half size of the albedo map, y has map, z saturation, w brightness */
uniform vec3 uTint;           /* ground colour where there is no map */
uniform float uRingHalf, uHorOn, uHorT, uSunSoft, uHazeDensity, uDetail, uTime;
uniform vec4 uMaskA, uMaskB;
uniform vec3 uSunW;
uniform vec4 uStrata;         /* x elevation offset, y noise, z strength, w steepness start */
uniform vec3 uPal0, uPal1, uPal2, uPal3, uPal4, uPal5;
uniform vec4 uBands;          /* layer tops above base for pal1..pal4 */
uniform float uBand5;
uniform vec4 uRoad;           /* x half size of the road map, y on, z width, w rut depth */
uniform vec3 uRoadCol;
uniform vec4 uGrass;          /* x amount of dry-grass streaks, y scale, z unused, w unused */
uniform vec3 uGrassCol;
float bbSunVis, bbAO, bbDet;
vec3 bbStrata(float y, vec2 xz) {
  float n = (bbFbm(xz * .015, 3) - .5) * 5. * uStrata.y + (bbNoise(xz * .21) - .5) * .8;
  float yy = y + uStrata.x + n;
  vec3 c = uPal0;
  c = mix(c, uPal1, smoothstep(-.5, .5, yy - uBands.x));
  c = mix(c, uPal2, smoothstep(-.4, .4, yy - uBands.y));
  c = mix(c, uPal3, smoothstep(-.3, .3, yy - uBands.z));
  c = mix(c, uPal4, smoothstep(-.4, .4, yy - uBands.w));
  c = mix(c, uPal5, smoothstep(-.6, .6, yy - uBand5));
  /* thin bedding lines */
  float bed = sin(yy * 5.3 + bbNoise(xz * .8) * 1.3) * .5 + .5;
  c *= .9 + .12 * bed + .08 * sin(yy * 1.7);
  return c;
}
`;

export function terrainMaterial({ albedo = null, albHalf = 1, tint = 0xa0603f, sat = 1.2, bright = 1, ringHalf, horizon = null,
  strata = null, detail = 0, road = null, grass = null, far = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .96, metalness: 0, envMapIntensity: 1 });
  const pal = strata?.pal ?? [0x8a3b26, 0x9c4a2e, 0xb0582f, 0xd9c6a5, 0xcfc8b8, 0xa8573a];
  const C = h => new THREE.Color(h);
  const u = {
    tAlb: { value: albedo }, uAlb: { value: new THREE.Vector4(albHalf, albedo ? 1 : 0, sat, bright) }, uTint: { value: C(tint) },
    uRingHalf: { value: ringHalf }, uHorOn: { value: horizon ? 1 : 0 },
    tHorA: { value: horizon?.dirs[0] ?? null }, tHorB: { value: horizon?.dirs[0] ?? null }, tAO: { value: horizon?.ao ?? null },
    uStrata: { value: new THREE.Vector4(strata?.offset ?? 0, strata?.noise ?? 1, strata ? (strata.strength ?? 1) : 0, strata?.steep ?? .3) },
    uPal0: { value: C(pal[0]) }, uPal1: { value: C(pal[1]) }, uPal2: { value: C(pal[2]) }, uPal3: { value: C(pal[3]) }, uPal4: { value: C(pal[4]) }, uPal5: { value: C(pal[5]) },
    uBands: { value: new THREE.Vector4(...(strata?.bands ?? [0, 12, 30, 36])) }, uBand5: { value: strata?.band5 ?? 46 },
    uDetail: { value: detail },
    tRoad: { value: road?.tex ?? null }, uRoad: { value: new THREE.Vector4(road?.half ?? 1, road ? 1 : 0, road?.width ?? 2, road?.rut ?? .12) },
    uRoadCol: { value: C(road?.color ?? 0xc9a07c) },
    uGrass: { value: new THREE.Vector4(grass?.amount ?? 0, grass?.scale ?? .08, 0, 0) }, uGrassCol: { value: C(grass?.color ?? 0xc8a868) },
  };
  m.userData.u = u; m.userData.horizon = horizon;
  m.defines = { BB_SUN: '' };
  if (far) m.defines.BB_FAR = '';
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, TU, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBBW; varying vec3 vBBN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBBW = (modelMatrix * vec4(transformed, 1.)).xyz; vBBN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + TERRAIN_PARS)
      .replace('#include <map_fragment>', /* glsl */`
        vec3 wN = normalize(vBBN);
        vec2 xz = vBBW.xz;
        float camD = distance(cameraPosition, vBBW);
        float slope = 1. - wN.y;
        vec3 base = uTint;
        if (uAlb.y > .5) base = texture2D(tAlb, (xz + uAlb.x) / (2. * uAlb.x)).rgb;
        float lum = dot(base, vec3(.2126, .7152, .0722));
        base = max(vec3(0.), mix(vec3(lum), base, uAlb.z)) * uAlb.w;
        /* dry grass: tan streaks on the flats */
        if (uGrass.x > 0.) {
          float gN = bbFbm(xz * uGrass.y, 4);
          float gS = bbNoise(vec2(xz.x * 1.7 + xz.y * .4, xz.y * .35) * 2.2);
          base = mix(base, uGrassCol * (.78 + .34 * gN) * (.9 + .2 * gS), uGrass.x * (1. - smoothstep(.2, .5, slope)));
        }
        /* rock layers on the steep faces */
        if (uStrata.z > 0.) {
          float steep = smoothstep(uStrata.w, uStrata.w + .3, slope);
          vec3 rock = bbStrata(vBBW.y, xz) * (.86 + .28 * bbNoise(xz * 1.3 + vBBW.y));
          base = mix(base, rock, steep * uStrata.z);
        }
        #ifndef BB_FAR
        /* the dirt road: packed pale dirt, two wheel ruts */
        if (uRoad.y > .5) {
          vec2 ruv = (xz + uRoad.x) / (2. * uRoad.x);
          if (ruv.x > 0. && ruv.x < 1. && ruv.y > 0. && ruv.y < 1.) {
            float rd = texture2D(tRoad, ruv).r * 16.;
            float edge = rd + (bbNoise(xz * .7) - .5) * .7;
            float onRoad = 1. - smoothstep(uRoad.z - .4, uRoad.z + .5, edge);
            float rut = exp(-pow((rd - .82) / .26, 2.));
            vec3 rc = uRoadCol * (.9 + .2 * bbNoise(xz * 2.1));
            base = mix(base, rc, onRoad * .42);
            base *= 1. - rut * onRoad * uRoad.w;
          }
        }
        /* up close: grit, pebbles, a crust */
        bbDet = uDetail * (1. - smoothstep(25., 120., camD));
        if (bbDet > 0.) {
          float g = bbNoise(xz * 9.3), p = smoothstep(.8, .86, bbNoise(xz * 6.1 + 7.1)), cr = bbNoise(xz * .9 + 3.);
          base *= mix(1., (.88 + .22 * g) * (1. - .16 * p) * (.95 + .1 * cr), bbDet);
        }
        #else
        bbDet = 0.;
        #endif
        diffuseColor.rgb *= base;
      `)
      .replace('#include <normal_fragment_maps>', /* glsl */`
        #include <normal_fragment_maps>
        {
          vec3 nW = wN;
          /* sandstone ledges: steep faces break into horizontal steps */
          if (uStrata.z > 0.) {
            float st = smoothstep(uStrata.w, uStrata.w + .25, slope);
            if (st > 0.) {
              float yy = vBBW.y + (bbNoise(xz * .35) - .5) * .9;
              float ph = fract(yy * 1.6);
              float ledge = smoothstep(.0, .12, ph) * (1. - smoothstep(.55, 1., ph));
              vec2 hd = normalize(wN.xz + vec2(1e-4));
              nW = normalize(nW + vec3(hd.x, 0., hd.y) * (ledge - .5) * .9 * st + vec3(0., (ledge - .4) * .5 * st, 0.));
            }
          }
          #ifndef BB_FAR
          if (bbDet > 0.) {
            vec2 q = xz * 3.1; float e = .07;
            float h0 = bbFbm(q, 2), hx = bbFbm(q + vec2(e, 0.), 2), hz = bbFbm(q + vec2(0., e), 2);
            nW = normalize(nW + vec3(-(hx - h0), 0., -(hz - h0)) / e * .09 * bbDet);
          }
          #endif
          /* where dry grass covers the flats it stands up: it catches a low sun side-on, like the tufts */
          if (uGrass.x > 0.) {
            float gk = uGrass.x * (1. - smoothstep(.15, .45, slope)) * .8;
            nW = normalize(mix(nW, normalize(vec3(0., .45, 0.) + normalize(vec3(uSunW.x, 0., uSunW.z) + vec3(1e-4)) * .55), gk));
          }
          normal = normalize(mat3(viewMatrix) * nW);
        }
      `)
      .replace('#include <lights_fragment_begin>', /* glsl */`
        {
          float hor = -.5;
          if (uHorOn > .5) {
            vec2 huv = ((xz + uRingHalf) / (2. * uRingHalf) * 256. + .5) / 257.;
            float hA = dot(texture2D(tHorA, huv), uMaskA), hB = dot(texture2D(tHorB, huv), uMaskB);
            hor = mix(hA, hB, uHorT) * 1.5707963 - .5235988;
            bbAO = texture2D(tAO, huv).r;
          } else bbAO = 1.;
          float sunEl = asin(clamp(uSunW.y, -1., 1.));
          bbSunVis = smoothstep(hor - uSunSoft, hor + uSunSoft, sunEl);
          bbSunVis *= bbCloudShade(xz);
        }
        #include <lights_fragment_begin>
      `)
      .replace('#include <aomap_fragment>', /* glsl */`
        reflectedLight.indirectDiffuse *= mix(1., bbAO, .92);
        reflectedLight.indirectSpecular *= mix(1., bbAO, .92);
        /* the blue sky light, a little greyer, so shadows on warm ground do not turn green */
        reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, vec3(dot(reflectedLight.indirectDiffuse, vec3(.3333))), .35);
      `)
      .replace('#include <fog_fragment>', /* glsl */`
        {
          vec3 V = vBBW - cameraPosition; float d = length(V); V /= max(d, 1e-3);
          vec2 sh = normalize(uSunW.xz + vec2(1e-5));
          float cs = dot(normalize(V.xz + vec2(1e-5)), sh);
          vec3 hz = texture2D(tHaze, vec2(cs * .5 + .5, .5)).rgb;
          float f = 1. - exp(-d * uHazeDensity);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, f);
        }
      `);
  };
  m.customProgramCacheKey = () => 'bbTerrain' + (far ? 'F' : '');
  return m;
}

/* the sun's compass sector decides which two horizon textures the shader reads this frame */
export function setHorizonSun(sunW) {
  const az = ((Math.atan2(sunW.x, -sunW.z) / (2 * Math.PI)) % 1 + 1) % 1 * DIRS;
  const i0 = Math.floor(az) % DIRS, i1 = (i0 + 1) % DIRS, t = az - Math.floor(az);
  TU.uHorT.value = t;
  TU.uMaskA.value.set(0, 0, 0, 0).setComponent(i0 % 4, 1);
  TU.uMaskB.value.set(0, 0, 0, 0).setComponent(i1 % 4, 1);
  for (const m of terrainMaterials) {
    const h = m.userData.horizon; if (!h) continue;
    m.userData.u.tHorA.value = h.dirs[i0 >> 2]; m.userData.u.tHorB.value = h.dirs[i1 >> 2];
  }
  return { i0, i1, t };
}

export const terrainMaterials = new Set();

/* build the meshes of a terrain; main-scene rings go to `near`, the far ring and the skyline to `far` */
export function buildTerrainMeshes(T, mats) {
  const near = new THREE.Group(), far = new THREE.Group();
  const last = T.rings.length - 1;
  T.rings.forEach((_, k) => {
    const mesh = new THREE.Mesh(ringGeometry(T, k), mats[k]);
    mesh.receiveShadow = k < 2; mesh.castShadow = false; mesh.matrixAutoUpdate = false; mesh.userData.keep = true;
    (k < last ? near : far).add(mesh); T.meshes.push(mesh); terrainMaterials.add(mats[k]);
  });
  if (T.skyline) {
    const mesh = new THREE.Mesh(skylineGeometry(T), mats[last + 1]);
    mesh.matrixAutoUpdate = false; mesh.userData.keep = true; far.add(mesh); T.meshes.push(mesh); terrainMaterials.add(mats[last + 1]);
  }
  return { near, far };
}
