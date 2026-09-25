import * as THREE from 'three';
import { app } from '../app.js';
import { NOISE_GLSL } from '../lib/noise.js';

/* The sky dome: the Preetham daylight model (as in three's Sky, with a longer twilight), a sun disc, a layer of
   clouds, and the night: the Milky Way and 5,080 real stars from the Bright Star Catalogue, turned by the local
   sidereal time. The moon is a lit ball. The same sky feeds the ground haze and the image-based light. */
const C = {
  totalRayleigh: [5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5],
  MieConst: [1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14],
  cutoff: 1.6755, steep: 1.5, EE: 1000, rZen: 8.4E3, mZen: 1.25E3,
};

export const skyU = {
  uSun: { value: new THREE.Vector3(0, 1, 0) }, uTurbidity: { value: 2.6 }, uRayleigh: { value: 1.35 }, uMie: { value: .0045 }, uMieG: { value: .82 },
  uNight: { value: new THREE.Color(0x02040b) }, uDay: { value: 1 },
  uCloudP: { value: new THREE.Vector4(0, .0006, .12, 2200) },   /* cover, scale (1/m), softness, altitude */
  uCloudOff: { value: new THREE.Vector2() }, uCloudTint: { value: new THREE.Color(1, 1, 1) }, uCloudShade: { value: new THREE.Color(.55, .58, .66) },
  uTime: { value: 0 }, uSunDisc: { value: 1 }, uSkyK: { value: .24 }, uTwiK: { value: .5 },
};

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  gl_Position = p.xyww;
}`;

/* the daylight part is shared with the haze computed on the CPU (hazeAt below) */
const SKY_FS = /* glsl */`
${NOISE_GLSL}
varying vec3 vDir;
uniform vec3 uSun, uNight, uCloudTint, uCloudShade;
uniform float uTurbidity, uRayleigh, uMie, uMieG, uDay, uTime, uSunDisc, uSkyK, uTwiK;
uniform vec4 uCloudP; uniform vec2 uCloudOff;
const float pi = 3.141592653589793;
const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
float sunIntensity(float c) { return 1000. * max(0., 1. - exp(-((1.6755 - acos(clamp(c, -1., 1.))) / 1.5))); }
vec3 preetham(vec3 dir, out vec3 fexOut) {
  vec3 up = vec3(0., 1., 0.);
  float sunE = sunIntensity(dot(uSun, up));
  vec3 betaR = totalRayleigh * uRayleigh;
  vec3 betaM = .434 * (.2 * uTurbidity * 10E-18) * MieConst * uMie;
  float zen = acos(max(0., dot(up, dir)));
  float inv = 1. / (cos(zen) + .15 * pow(93.885 - zen * 180. / pi, -1.253));
  vec3 Fex = exp(-(betaR * 8.4E3 * inv + betaM * 1.25E3 * inv));
  fexOut = Fex;
  float ct = dot(dir, uSun);
  float rPh = .05968310365946075 * (1. + pow(ct * .5 + .5, 2.));
  float g2 = uMieG * uMieG;
  float mPh = .07957747154594767 * ((1. - g2) / pow(1. - 2. * uMieG * ct + g2, 1.5));
  vec3 r = (betaR * rPh + betaM * mPh) / (betaR + betaM);
  vec3 Lin = pow(sunE * r * (1. - Fex), vec3(1.5));
  Lin *= mix(vec3(1.), pow(sunE * r * Fex, vec3(.5)), clamp(pow(1. - dot(up, uSun), 5.), 0., 1.));
  vec3 L0 = vec3(.1) * Fex * uDay;
  return pow((Lin + L0) * .04 + vec3(0., .0003, .00075) * uDay, vec3(1. / 2.4));
}
/* twilight, which the daylight model does not give: the glow where the sun went down, the blue dome, and the pink
   Belt of Venus over the Earth's shadow opposite; it fades out by the time the sun is 12 degrees down */
vec3 twilight(vec3 d, vec3 sun) {
  float h = asin(clamp(sun.y, -1., 1.));
  float tw = smoothstep(-.21, -.005, h) * (1. - smoothstep(.03, .1, h));
  if (tw <= 0.) return vec3(0.);
  float depr = clamp(-h / .21, 0., 1.), up = max(d.y, 0.);
  float az = dot(normalize(d.xz + vec2(1e-5)), normalize(sun.xz + vec2(1e-5)));
  float glow = pow(az * .5 + .5, 3.) * exp(-up / (.07 + .12 * (1. - depr)));
  vec3 gc = mix(vec3(1., .38, .1), vec3(1., .72, .36), clamp(up * 5., 0., 1.));
  vec3 dome = mix(vec3(.09, .14, .30), vec3(.025, .05, .14), sqrt(up)) * (1. - .7 * depr);
  float belt = pow(-az * .5 + .5, 2.) * exp(-pow((up - .05 - .05 * depr) / .05, 2.)) * (1. - depr);
  return (dome * .55 + gc * glow * 1.3 * (1. - .75 * depr) + vec3(.5, .3, .36) * belt * .3) * tw;
}
void main() {
  vec3 dir = normalize(vDir);
  vec3 d = vec3(dir.x, max(dir.y, 0.), dir.z); d = normalize(d + vec3(0., .0001, 0.));
  vec3 fex;
  vec3 col = preetham(d, fex) * uDay * uSkyK + twilight(d, uSun) * uTwiK;
  /* night: a deep blue, a little lighter low down */
  col += uNight * (1. + 1.6 * pow(1. - d.y, 3.));
  /* the sun */
  float ct = dot(dir, uSun);
  float disc = smoothstep(.99994, .99997, ct) * uSunDisc;
  float limb = sqrt(max(0., 1. - pow((1. - ct) / (1. - .99994), 1.)));
  col += fex * disc * (60. + 30. * limb) * uDay * smoothstep(-.03, .02, uSun.y);
  /* clouds on a sheet at the cloud altitude */
  if (uCloudP.x > 0. && dir.y > .005) {
    float t = uCloudP.w / dir.y;
    vec2 p = dir.xz * t;
    float fade = 1. - smoothstep(25000., 90000., t);
    float n = bbFbm((p + uCloudOff) * uCloudP.y, 6);
    float dens = smoothstep(1. - uCloudP.x - uCloudP.z, 1. - uCloudP.x + uCloudP.z, n) * fade;
    if (dens > .001) {
      vec2 sdir = normalize(uSun.xz + vec2(1e-5));
      float n2 = bbFbm((p + uCloudOff + sdir * 260.) * uCloudP.y, 5);
      float lit = clamp(.55 + (n - n2) * 5., 0., 1.);
      float fwd = pow(max(0., ct), 12.);
      vec3 sunCol = fex * sunIntensity(uSun.y) * .0012;
      vec3 cc = mix(uCloudShade * (.35 + .65 * uDay) * col * 2.2 + uCloudShade * .05 * uDay, uCloudTint * (sunCol + .18 * uDay), lit);
      cc += uCloudTint * sunCol * fwd * 1.6 * (1. - dens);
      col = mix(col, cc, dens * .96);
    }
  }
  gl_FragColor = vec4(col, 1.);
}`;

/* ---------- the same daylight on the CPU, for the haze texture and the light colours ---------- */
const V3 = () => [0, 0, 0];
function sunIntensity(c) { return C.EE * Math.max(0, 1 - Math.exp(-((C.cutoff - Math.acos(Math.max(-1, Math.min(1, c)))) / C.steep))); }
export function preetham(dir, sun, P, out = V3()) {
  const sunE = sunIntensity(sun.y);
  const zen = Math.acos(Math.max(0, dir.y));
  const inv = 1 / (Math.cos(zen) + .15 * Math.pow(93.885 - zen * 180 / Math.PI, -1.253));
  const ct = dir.x * sun.x + dir.y * sun.y + dir.z * sun.z;
  const rPh = .05968310365946075 * (1 + Math.pow(ct * .5 + .5, 2));
  const g2 = P.mieG * P.mieG, mPh = .07957747154594767 * ((1 - g2) / Math.pow(1 - 2 * P.mieG * ct + g2, 1.5));
  const up5 = Math.min(1, Math.max(0, Math.pow(1 - sun.y, 5)));
  for (let k = 0; k < 3; k++) {
    const bR = C.totalRayleigh[k] * P.rayleigh, bM = .434 * (.2 * P.turbidity * 10E-18) * C.MieConst[k] * P.mie;
    const Fex = Math.exp(-(bR * C.rZen * inv + bM * C.mZen * inv));
    const r = (bR * rPh + bM * mPh) / (bR + bM);
    let Lin = Math.pow(sunE * r * (1 - Fex), 1.5);
    Lin *= 1 + (Math.pow(sunE * r * Fex, .5) - 1) * up5;
    const L0 = .1 * Fex * P.day;
    out[k] = Math.pow((Lin + L0) * .04 + [0, .0003, .00075][k] * P.day, 1 / 2.4) * P.day * (P.skyK ?? .24);
  }
  return out;
}
/* the same twilight on the CPU, for the haze at the horizon */
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function twilight(d, sun, k = .5, out = V3()) {
  const h = Math.asin(Math.max(-1, Math.min(1, sun.y))), tw = sstep(-.21, -.005, h) * (1 - sstep(.03, .1, h));
  out[0] = out[1] = out[2] = 0; if (tw <= 0) return out;
  const depr = Math.min(1, Math.max(0, -h / .21)), up = Math.max(d.y, 0);
  const hl = Math.hypot(d.x, d.z) || 1, sl = Math.hypot(sun.x, sun.z) || 1, az = (d.x * sun.x + d.z * sun.z) / (hl * sl);
  const glow = Math.pow(az * .5 + .5, 3) * Math.exp(-up / (.07 + .12 * (1 - depr))), m = Math.min(1, up * 5);
  const gc = [1, .38 + .34 * m, .1 + .26 * m], su = Math.sqrt(up);
  const dome = [.09 + (.025 - .09) * su, .14 + (.05 - .14) * su, .30 + (.14 - .30) * su].map(v => v * (1 - .7 * depr));
  const belt = Math.pow(-az * .5 + .5, 2) * Math.exp(-Math.pow((up - .05 - .05 * depr) / .05, 2)) * (1 - depr);
  const bc = [.5, .3, .36];
  for (let i = 0; i < 3; i++) out[i] = (dome[i] * .55 + gc[i] * glow * 1.3 * (1 - .75 * depr) + bc[i] * belt * .3) * tw * k;
  return out;
}
/* sunlight left after the air: per channel */
export function sunTransmit(sun, P) {
  const zen = Math.acos(Math.max(0, Math.min(1, sun.y))), inv = 1 / (Math.cos(zen) + .15 * Math.pow(Math.max(.01, 93.885 - zen * 180 / Math.PI), -1.253));
  return [0, 1, 2].map(k => {
    const bR = C.totalRayleigh[k] * P.rayleigh, bM = .434 * (.2 * P.turbidity * 10E-18) * C.MieConst[k] * P.mie;
    return Math.exp(-(bR * C.rZen * inv + bM * C.mZen * inv));
  });
}

/* ---------- build ---------- */
export const sky = { mesh: null, stars: null, milky: null, moon: null, haze: null, envScene: null, params: null, eq: new THREE.Matrix3() };
const HAZE_W = 64;
let hazeData;

export function buildSky(farScene) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false });
  const mesh = new THREE.Mesh(box, mat); mesh.scale.setScalar(100000); mesh.renderOrder = -10; mesh.frustumCulled = false;
  farScene.add(mesh); sky.mesh = mesh;
  /* the haze the ground fades into: horizon colour by the angle to the sun */
  hazeData = new Uint16Array(HAZE_W * 4);
  sky.haze = new THREE.DataTexture(hazeData, HAZE_W, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  sky.haze.minFilter = sky.haze.magFilter = THREE.LinearFilter; sky.haze.colorSpace = THREE.LinearSRGBColorSpace; sky.haze.needsUpdate = true;
  buildMilkyWay(farScene); buildMoon(farScene);
  loadStars(farScene);
  /* the scene the image-based light is made from: the sky, and the ground below it */
  sky.envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(box, mat); envSky.scale.setScalar(900); sky.envScene.add(envSky);
  sky.envGround = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16, 0, Math.PI * 2, Math.PI / 2 + .04, Math.PI / 2 - .04),
    new THREE.MeshBasicMaterial({ color: 0x402a20, side: THREE.BackSide }));
  sky.envScene.add(sky.envGround);
}

export function updateHaze(sun, P) {
  const d = { x: 0, y: .035, z: 0 }, c = V3(), tw = V3(), hs = Math.hypot(sun.x, sun.z) || 1;
  const sx = sun.x / hs, sz = sun.z / hs;
  for (let i = 0; i < HAZE_W; i++) {
    const cs = i / (HAZE_W - 1) * 2 - 1, sn = Math.sqrt(Math.max(0, 1 - cs * cs));
    /* a horizontal direction at angle acos(cs) from the sun's compass bearing */
    d.x = (sx * cs - sz * sn) * .9994; d.z = (sz * cs + sx * sn) * .9994;
    preetham(d, sun, P, c); twilight(d, sun, P.twiK ?? .5, tw);
    const nightK = 1 + 1.6 * Math.pow(1 - d.y, 3);
    for (let k = 0; k < 3; k++) hazeData[i * 4 + k] = THREE.DataUtils.toHalfFloat(c[k] + tw[k] + [P.night.r, P.night.g, P.night.b][k] * nightK);
    hazeData[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  sky.haze.needsUpdate = true;
}

/* ---------- the Milky Way: a band on the celestial sphere, brightest toward Sagittarius, split by the Great Rift ---------- */
const EQ2GAL = new THREE.Matrix3().set(-.0548755604, -.8734370902, -.4838350155, .4941094279, -.4448296300, .7469822445, -.8676661490, -.1980763734, .4559837762);
function buildMilkyWay(farScene) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    uniforms: { uWorld2Eq: { value: new THREE.Matrix3() }, uEq2Gal: { value: EQ2GAL }, uK: { value: 0 } },
    vertexShader: SKY_VS,
    fragmentShader: /* glsl */`
      ${NOISE_GLSL}
      varying vec3 vDir; uniform mat3 uWorld2Eq, uEq2Gal; uniform float uK;
      void main() {
        vec3 w = normalize(vDir);
        if (uK < .002 || w.y < -.05) { gl_FragColor = vec4(0.); return; }
        vec3 e = uWorld2Eq * w;          /* equatorial, x to the vernal point, z to the pole */
        vec3 g = uEq2Gal * e;            /* galactic */
        float b = asin(clamp(g.z, -1., 1.)), l = atan(g.y, g.x);
        float core = exp(-pow(l / .55, 2.)) * exp(-pow(b / .16, 2.));
        float bw = .11 + .07 * (.5 + .5 * cos(l)), along = .35 + .65 * pow(.5 + .5 * cos(l), 1.6);
        float band = exp(-pow(b / bw, 2.)) * along, halo = exp(-pow(b / (bw * 3.2), 2.)) * along * .22;
        vec2 q = vec2(l * 3.2, b * 9.);
        float mot = bbFbm(q * 2.1 + 3.1, 6), clump = smoothstep(.35, .8, bbFbm(q * 4.3 - 1.7, 5));
        float rift = smoothstep(.3, .75, bbFbm(q * 1.3 + vec2(1.7, 0.), 5)) * exp(-pow((b - .012) / .035, 2.)) * smoothstep(-.4, .1, l) * (1. - smoothstep(1.2, 1.9, l));
        float I = (band * (.3 + 1.2 * mot * mot + .7 * clump) + halo + core * 1.5) * (1. - .85 * rift);
        vec3 col = mix(vec3(.62, .68, .85), vec3(1., .86, .66), clamp(core * 2. + .2, 0., 1.)) * I;
        /* the faint stars below the catalogue, thickest in the band */
        vec2 sq = vec2(l, b) * 760.; vec2 f = fract(sq) - .5; float h = bbHash2(floor(sq));
        float dust = step(.993 - .035 * clamp(band * 1.4 + core, 0., 1.) * (1. - .7 * rift), h) * smoothstep(.5, .1, length(f)) * (.35 + .65 * fract(h * 91.7));
        col += vec3(.86, .89, 1.) * dust * 2.4;
        float air = smoothstep(-.02, .25, w.y);
        gl_FragColor = vec4(col * .045 * uK * air, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(95000, 64, 32), m); mesh.renderOrder = -9; mesh.frustumCulled = false;
  farScene.add(mesh); sky.milky = mesh;
}

/* ---------- stars ---------- */
async function loadStars(farScene) {
  try {
    const res = await fetch(new URL('../../data/stars.bin', import.meta.url));
    if (!res.ok) throw new Error(res.status);
    const buf = new DataView(await res.arrayBuffer()), n = buf.byteLength / 8;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), mag = new Float32Array(n);
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const ra = buf.getUint16(i * 8, true) / 65535 * Math.PI * 2, de = buf.getInt16(i * 8 + 2, true) / 360 * Math.PI / 180;
      const v = buf.getInt16(i * 8 + 4, true) / 100, bv = buf.getUint16(i * 8 + 6, true) / 10000 - .5;
      pos[i * 3] = Math.cos(de) * Math.cos(ra); pos[i * 3 + 1] = Math.cos(de) * Math.sin(ra); pos[i * 3 + 2] = Math.sin(de);
      mag[i] = v;
      /* colour from B-V: blue-white hot stars to orange cool ones */
      const t = Math.max(0, Math.min(1, (bv + .3) / 2.0));
      tmp.setRGB(.72 + .28 * t, .78 + .12 * (1 - Math.abs(t - .4) * 2), 1 - .55 * t);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uEq2World: { value: new THREE.Matrix3() }, uK: { value: 0 }, uTime: skyU.uTime, uPx: { value: 1 } },
      vertexShader: /* glsl */`
        attribute vec3 color; attribute float mag;
        uniform mat3 uEq2World; uniform float uK, uTime, uPx;
        varying vec3 vCol; varying float vA;
        void main() {
          vec3 w = uEq2World * position;
          vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + w * 90000., 1.);
          gl_Position = p;
          float flux = pow(10., -.4 * (mag - 1.));
          float tw = .85 + .15 * sin(uTime * (3. + fract(mag * 17.3) * 6.) + mag * 40.);
          float air = smoothstep(-.01, .18, w.y);
          vA = clamp(pow(flux, .62) * 2.2, 0., 2.6) * uK * air * tw;
          gl_PointSize = clamp(1.4 + sqrt(flux) * 2.2, 1.4, 6.) * uPx;
          vCol = color;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol; varying float vA;
        void main() {
          vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.;
          float a = exp(-r * 3.2) * vA;
          if (a < .003) discard;
          gl_FragColor = vec4(vCol * a * .9, 1.);
        }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -8;
    farScene.add(pts); sky.stars = pts;
    app.emit('stars:ready');
  } catch (e) { console.warn('stars did not load', e.message); }
}

/* ---------- the moon: a lit ball in the sky ---------- */
function buildMoon(farScene) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSun: skyU.uSun, uK: { value: 1 }, uDay: skyU.uDay },
    vertexShader: /* glsl */`varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    fragmentShader: /* glsl */`
      ${NOISE_GLSL}
      varying vec3 vN, vW; uniform vec3 uSun; uniform float uK, uDay;
      void main() {
        vec3 n = normalize(vN);
        float maria = smoothstep(.45, .7, bbFbm(n.xy * 2.2 + n.z * 1.3 + 4., 5));
        vec3 alb = vec3(.62, .6, .57) * (1. - .42 * maria) * (.9 + .2 * bbNoise(n.xy * 30.));
        float l = max(0., dot(n, uSun));
        vec3 col = alb * l * 2.4 + vec3(.004, .005, .008);
        float a = clamp(.25 + l * 1.2, 0., 1.) * uK * mix(1., .55, uDay);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m); mesh.renderOrder = -7; mesh.frustumCulled = false;
  farScene.add(mesh); sky.moon = mesh;
}

/* the matrix from equatorial unit vectors to the world, for a latitude, the local sidereal time and the map grid */
export function setCelestial(latDeg, lstDeg, gridDeg) {
  const phi = latDeg * Math.PI / 180, L = lstDeg * Math.PI / 180, g = gridDeg * Math.PI / 180;
  /* equatorial -> (east, north, up): hour angle H = LST - RA */
  const cL = Math.cos(L), sL = Math.sin(L), sp = Math.sin(phi), cp = Math.cos(phi);
  /* e = (cos d cos a, cos d sin a, sin d); cos H = cos(L - a) = cL ca + sL sa, sin H = sL ca - cL sa */
  const east = [-sL, cL, 0];
  const north = [-sp * cL, -sp * sL, cp];
  const up = [cp * cL, cp * sL, sp];
  /* world x = east, y = up, z = -north, then the grid turn about y */
  const cg = Math.cos(g), sg = Math.sin(g);
  const wx = [0, 1, 2].map(k => east[k] * cg - north[k] * sg);
  const wz = [0, 1, 2].map(k => -north[k] * cg - east[k] * sg);
  sky.eq.set(wx[0], wx[1], wx[2], up[0], up[1], up[2], wz[0], wz[1], wz[2]);
  if (sky.stars) sky.stars.material.uniforms.uEq2World.value.copy(sky.eq);
  if (sky.milky) sky.milky.material.uniforms.uWorld2Eq.value.copy(sky.eq).transpose();
}
