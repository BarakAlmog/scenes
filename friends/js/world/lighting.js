import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { clamp, lerp, smooth } from '../lib/util.js';
import { setSky } from './outside.js';
/* Time of day. The sun stands over the street to the north, so it comes in through
   the back windows of both apartments, rising and falling with the hour; at night it
   becomes a blue moon.
   Each look below is a stop on the sun's elevation, and the frame blends two.
   The sun is strong against a soft fill, so the blinds throw stripes. */
const C = x => new THREE.Color(x);
const STOPS = [
  { e: -9, sun: C(0x8fa8ff), sunI: .55, sky: C(0x3a4a70), gnd: C(0x15151c), hemiI: .1, fill: .05,
    bg: ['#1c2334', '#131722', '#0b0d12'], top: C(0x070b18), hor: C(0x1d2745), ground: C(0x161922), env: .16, exp: 1.2, day: .06, night: 1, dim: 1 },
  { e: -1, sun: C(0x7486c8), sunI: .75, sky: C(0x6070a0), gnd: C(0x24242c), hemiI: .15, fill: .08,
    bg: ['#3b4159', '#2a2f42', '#1a1d28'], top: C(0x1f2a55), hor: C(0xb3748a), ground: C(0x252733), env: .26, exp: 1.16, day: .22, night: .8, dim: .85 },
  { e: 4, sun: C(0xff8a5a), sunI: 2.4, sky: C(0xffc4a0), gnd: C(0x8a7a70), hemiI: .22, fill: .16,
    bg: ['#f6dccb', '#e3c3b6', '#b9a2a0'], top: C(0x6c79a8), hor: C(0xf7a26f), ground: C(0xdcc3b3), env: .42, exp: 1.08, day: .72, night: .2, dim: .35 },
  { e: 16, sun: C(0xffc88a), sunI: 4.0, sky: C(0xffe8cc), gnd: C(0xb3a797), hemiI: .28, fill: .24,
    bg: ['#fff6ea', '#f3e7d6', '#dac8b0'], top: C(0xa9c1e0), hor: C(0xffdcae), ground: C(0xefe5d8), env: .58, exp: 1.04, day: 1.05, night: 0, dim: .1 },
  { e: 36, sun: C(0xfff2dd), sunI: 4.4, sky: C(0xfff6e8), gnd: C(0xb9b3a8), hemiI: .32, fill: .28,
    bg: ['#ffffff', '#f3f1ec', '#dcd8d0'], top: C(0x9ec5ec), hor: C(0xe9eef0), ground: C(0xefede8), env: .66, exp: 1.02, day: 1.2, night: 0, dim: 0 },
];
const STUDIO = { bg: ['#16161a', '#0e0e11', '#08080a'], ground: C(0x2c2b2e), env: .32, exp: 1.1 };

export const tod = { hour: 16, playing: false, look: null, night: 0, dim: 0 };
const L = {};
const TARGET = new THREE.Vector3(.7, 0, -1.8);
const A0 = Math.atan2(-9, -2.6);

let bgTex, lastKey = '';
const BG_H = 256, bgData = new Uint16Array(2 * BG_H * 4);

function blendStops(e) {
  let i = 0; while (i < STOPS.length - 2 && e > STOPS[i + 1].e) i++;
  const a = STOPS[i], b = STOPS[i + 1], k = clamp((e - a.e) / (b.e - a.e), 0, 1);
  const o = {};
  for (const key in a) {
    const va = a[key], vb = b[key];
    if (va instanceof THREE.Color) o[key] = va.clone().lerp(vb, k);
    else if (Array.isArray(va)) o[key] = va.map((c, j) => '#' + C(c).lerp(C(vb[j]), k).getHexString());
    else o[key] = lerp(va, vb, k);
  }
  return o;
}

export const elevation = h => {
  const hh = h < 6 ? h + 24 : h;
  return hh <= 20 ? 58 * Math.sin(Math.PI * (hh - 6) / 14) : -12 * Math.sin(Math.PI * (hh - 20) / 10);
};

/* The output pass tone-maps the whole frame, background included. To show the
   gradient as painted, store the value that ACES maps back to it. */
function invACES(y, exposure) {
  y = Math.min(y, .95);
  const A = 1 - .983729 * y, B = .0245786 - .432951 * y, Cc = -(.000090537 + .238081 * y);
  return (-B + Math.sqrt(B * B - 4 * A * Cc)) / (2 * A) * .6 / exposure;
}

export function buildLighting() {
  const s = app.scene;
  L.hemi = new THREE.HemisphereLight(0xfff6e8, 0xb9b3a8, .32); s.add(L.hemi);
  L.sun = new THREE.DirectionalLight(0xfff2dd, 4.4);
  L.sun.castShadow = true;
  L.sun.shadow.mapSize.set(app.shadowSize, app.shadowSize);
  const sc = L.sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
  L.sun.shadow.bias = -.0005; L.sun.shadow.normalBias = .02; L.sun.shadow.radius = 2.5;
  L.sun.target.position.copy(TARGET); s.add(L.sun, L.sun.target);
  L.fill = new THREE.DirectionalLight(0xeaf0ff, .28); L.fill.position.set(6, 9, 14); s.add(L.fill);
  const pl = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 2); l.position.set(x, y, z); l.userData.base = i; app.root.add(l); return l; };
  L.mKitchen = pl(0xffe6c0, 4.2, 7.5, 3.1, 2.35, -1.1);
  L.gKitchen = pl(0xfff0d6, 3.4, 6.5, -2.7, 2.35, -.4);
  L.gLiving = pl(0xffe9cc, 2.2, 10, -5.6, 2.5, .6);
  L.hall = pl(0xffdca8, 2.4, 6.5, 0, 2.25, -1.2);
  app.lights = L; app.tod = tod;

  bgTex = new THREE.DataTexture(bgData, 2, BG_H, THREE.RGBAFormat, THREE.HalfFloatType);
  bgTex.colorSpace = THREE.LinearSRGBColorSpace; bgTex.magFilter = bgTex.minFilter = THREE.LinearFilter;
  s.background = bgTex;

  const h = parseFloat(app.params.get('t'));
  if (!Number.isNaN(h)) tod.hour = ((h % 24) + 24) % 24;
  app.onUpdate(updateLighting, 30);
}

export function setHour(h) { tod.hour = ((h % 24) + 24) % 24; app.emit('hour', tod.hour); }

const col = new THREE.Color();
function paintBg(stops, exposure) {
  const keys = [[0, stops[0]], [.45, stops[1]], [1, stops[2]]];
  for (let row = 0; row < BG_H; row++) {
    const v = 1 - row / (BG_H - 1);   /* texture row 0 is the bottom */
    let i = 0; while (i < keys.length - 2 && v > keys[i + 1][0]) i++;
    const [p0, c0] = keys[i], [p1, c1] = keys[i + 1];
    col.set(c0).lerp(C(c1), clamp((v - p0) / (p1 - p0), 0, 1));
    const rgb = [invACES(col.r, exposure), invACES(col.g, exposure), invACES(col.b, exposure)];
    for (let x = 0; x < 2; x++) {
      const o = (row * 2 + x) * 4;
      for (let k = 0; k < 3; k++) bgData[o + k] = THREE.DataUtils.toHalfFloat(rgb[k]);
      bgData[o + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  bgTex.needsUpdate = true;
}

const mix = (a, b, k) => a.map((c, i) => '#' + C(c).lerp(C(b[i]), k).getHexString());

function updateLighting(dt) {
  if (tod.playing) setHour(tod.hour + dt / 3.2);
  const e = elevation(tod.hour), look = blendStops(e), sk = app.stageK ?? 0;
  tod.look = look; tod.night = look.night; tod.dim = look.dim;

  /* sun or moon */
  const kMoon = smooth(clamp((2 - e) / 6, 0, 1));
  const az = lerp(A0 + (tod.hour - 13) * .085, A0 + .5, kMoon);
  const el = THREE.MathUtils.degToRad(lerp(Math.max(e, 2.5), 42, kMoon));
  const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
  L.sun.position.copy(TARGET).addScaledVector(dir, 26);
  L.sun.color.copy(look.sun); L.sun.intensity = look.sunI * (1 - .75 * sk);
  L.hemi.color.copy(look.sky); L.hemi.groundColor.copy(look.gnd); L.hemi.intensity = look.hemiI;
  L.fill.intensity = look.fill * (1 - .5 * sk);

  /* practical lights: brighter as the day dims */
  const d = look.dim;
  for (const l of [L.mKitchen, L.gKitchen, L.gLiving, L.hall]) l.intensity = l.userData.base * lerp(1, 1.3, d);
  for (const lp of app.lamps) { lp.light.intensity = lp.on ? lerp(lp.day, lp.night, d) : 0; lp.shadeMat.emissiveIntensity = lp.on ? lerp(1.6, 2.6, d) : .1; }
  for (const gl of app.glows ?? []) gl.mat.emissiveIntensity = lerp(gl.day, gl.night, d);
  for (const tv of Object.values(app.tvs)) {
    const n = tv.level(app.time);
    tv.light.color.setHex(tv.channel.light || 0x000000);
    tv.light.intensity = 2 * n + 2.6 * n * d;
    tv.mat.emissiveIntensity = tv.channel.id === 'off' ? 0 : 1.6 + .9 * n;
  }

  const key = `${e.toFixed(1)}|${sk.toFixed(2)}`;
  if (key !== lastKey) {
    lastKey = key;
    const exposure = lerp(look.exp, STUDIO.exp, sk);
    app.renderer.toneMappingExposure = exposure;
    paintBg(mix(look.bg, STUDIO.bg, sk), exposure);
    MAT.ground?.color.copy(look.ground).lerp(STUDIO.ground, sk);
    const env = lerp(look.env, STUDIO.env, sk);
    for (const m of app.materials ?? []) if ('envMapIntensity' in m) m.envMapIntensity = env;
    setSky({ top: look.top, hor: look.hor, sun: look.sun.clone().lerp(C(0xffffff), .6), day: look.day, night: look.night });
    document.body.classList.toggle('night', look.night > .5 || sk > .5);
  }
}
