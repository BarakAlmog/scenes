import * as THREE from 'three';
import { app } from '../app.js';
import { julian, sidereal, sunPosition, moonPosition, toWorld, localToUTC } from '../lib/astro.js';
import { sky, skyU, updateHaze, preetham, sunTransmit, setCelestial } from './sky.js';
import { TU, setHorizonSun, horizonAt, DIRS } from './terrain.js';
import { cloudShade } from '../lib/noise.js';
import { updateFloraHorizon } from './flora.js';
import { clamp, lerp, smooth } from '../lib/util.js';

/* The hour of the day on the stop's date, at the stop's place. The sun and the moon are where they really were;
   one directional light is the sun by day and the moon by night. Everything that is not the ground takes one
   more factor for the sun: the mesas' shadow and the clouds' shadow at the RV (objects.sunVis). */
export const tod = { hour: 14, playing: false, speed: 1 / 3.2, sunW: new THREE.Vector3(), moonW: new THREE.Vector3(), sunAlt: 0, moonAlt: 0,
  day: 1, night: 0, dim: 0, phase: .5, place: null };
/* sunVis: the sun's share where the RV stands; rvInv and inside: the RV's shell, and how much sky reaches into it */
export const objects = { sunVis: { value: 1 }, rvInv: { value: new THREE.Matrix4() }, inside: { value: new THREE.Vector2(1, 0) } };
const L = {};
let pmrem, envRT = null, lastEnv = -1, lastHaze = -1, envDirty = true, horRV = null, horAt = new THREE.Vector2(1e9, 1e9);

export function buildLighting(farScene) {
  const s = app.scene;
  L.sun = new THREE.DirectionalLight(0xffffff, 3.2);
  L.sun.castShadow = true;
  L.sun.shadow.mapSize.set(app.shadowSize, app.shadowSize);
  const sc = L.sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 160;
  L.sun.shadow.bias = -.0004; L.sun.shadow.normalBias = .03; L.sun.shadow.radius = 2;
  s.add(L.sun, L.sun.target);
  L.hemi = new THREE.HemisphereLight(0x8aa0c0, 0x4a3024, .0); s.add(L.hemi);
  /* the far pass has its own copies (no shadows) */
  L.farSun = new THREE.DirectionalLight(0xffffff, 3.2); farScene.add(L.farSun, L.farSun.target);
  L.farHemi = new THREE.HemisphereLight(0x8aa0c0, 0x4a3024, 0); farScene.add(L.farHemi);
  pmrem = new THREE.PMREMGenerator(app.renderer);
  TU.tHaze.value = sky.haze;
  app.lights = L; app.tod = tod;
  const h = parseFloat(app.params.get('t'));
  if (!Number.isNaN(h)) tod.hour = ((h % 24) + 24) % 24;
  app.onUpdate(updateLighting, 30);
}

export function setHour(h) { tod.hour = ((h % 24) + 24) % 24; app.emit('hour', tod.hour); }
export function setPlace(p) { tod.place = p; envDirty = true; horAt.set(1e9, 1e9); }
export const markEnvDirty = () => { envDirty = true; };

/* the sky's parameters for a stop and the hour */
function skyParams(P, day, night) {
  return { turbidity: P.turbidity ?? 2.6, rayleigh: P.rayleigh ?? 1.35, mie: P.mie ?? .0045, mieG: P.mieG ?? .82, day, skyK: P.skyK ?? .24, night: P.night ?? new THREE.Color(0x02040b).multiplyScalar(night) };
}

const col = new THREE.Color(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
function updateLighting(dt) {
  const P = tod.place; if (!P) return;
  if (tod.playing) setHour(tod.hour + dt * tod.speed);
  const [y, m, d] = P.date;
  const jd = julian(localToUTC(y, m, d, tod.hour));
  const sp = sunPosition(jd, P.lat, P.lon), mp = moonPosition(jd, P.lat, P.lon);
  toWorld(sp.alt, sp.az, P.grid, tod.sunW); toWorld(mp.alt, mp.az, P.grid, tod.moonW);
  tod.sunAlt = sp.alt; tod.moonAlt = mp.alt;
  const sunY = tod.sunW.y;
  /* day: the sun's light; twilight lasts to about -8 degrees */
  const day = smooth(clamp((sp.alt + 8) / 12, 0, 1));
  const night = 1 - smooth(clamp((sp.alt + 14) / 12, 0, 1));
  tod.day = day; tod.night = night; tod.dim = 1 - smooth(clamp((sp.alt + 2) / 14, 0, 1));
  /* moon phase: 0 new, 1 full */
  const elong = Math.acos(clamp(tod.sunW.dot(tod.moonW), -1, 1)); tod.phase = (1 - Math.cos(elong)) / 2;

  const SP = skyParams(P, day, 1);
  skyU.uSun.value.copy(tod.sunW); skyU.uDay.value = day;
  skyU.uSkyK.value = SP.skyK; skyU.uTurbidity.value = SP.turbidity; skyU.uRayleigh.value = SP.rayleigh; skyU.uMie.value = SP.mie; skyU.uMieG.value = SP.mieG;
  skyU.uNight.value.copy(P.nightCol ?? col.setHex(0x010208)).multiplyScalar(lerp(1, .35 + .9 * tod.phase * smooth(clamp(mp.alt / 10, 0, 1)), night) );
  skyU.uTime.value = app.time;

  /* the key light: the sun, or the moon when the sun is well down */
  const moonUp = smooth(clamp(mp.alt / 6, 0, 1)) * tod.phase;
  const useMoon = sp.alt < -4;
  const keyDir = useMoon ? tod.moonW : tod.sunW;
  const tr = sunTransmit(useMoon ? tod.moonW : tod.sunW, SP);
  if (!useMoon) {
    const k = smooth(clamp((sp.alt + 1.5) / 7, 0, 1));
    col.setRGB(tr[0], tr[1], tr[2]);
    const lum = col.r * .2126 + col.g * .7152 + col.b * .0722; col.multiplyScalar(1 / Math.max(.02, lum));
    col.lerp(new THREE.Color(1, .97, .92), .15);
    L.sun.color.copy(col); L.sun.intensity = (P.sunI ?? 3.3) * k * Math.pow(lum, .35);
  } else {
    L.sun.color.setRGB(.62, .72, 1); L.sun.intensity = .22 * moonUp;
  }
  L.farSun.color.copy(L.sun.color); L.farSun.intensity = L.sun.intensity;
  /* ambient that the sky map does not give at night */
  L.hemi.color.setRGB(.30, .38, .62); L.hemi.groundColor.setRGB(.10, .08, .07); L.hemi.intensity = .05 + night * (.15 + .1 * moonUp);   /* starlight and airglow: a moonless desert still reads, dark and blue */
  L.farHemi.color.copy(L.hemi.color); L.farHemi.groundColor.copy(L.hemi.groundColor); L.farHemi.intensity = L.hemi.intensity;

  /* the shadow box follows what you look at, in whole shadow texels so edges do not crawl */
  const focus = app.shadowFocus ?? app.controls?.target ?? tmpV.set(0, 0, 0);
  /* a low sun throws long shadows: the box grows, and slides toward where they fall */
  const long = 1 - smooth(clamp((keyDir.y - .06) / .4, 0, 1)), ext = Math.round(26 + 34 * long);
  const sc = L.sun.shadow.camera;
  if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.far = 160 + 120 * long; sc.updateProjectionMatrix(); }
  const texel = ext * 2 / L.sun.shadow.mapSize.x;
  tmpV.copy(focus).addScaledVector(tmpV2.set(-keyDir.x, 0, -keyDir.z).normalize(), ext * .45 * long);
  tmpV.x = Math.round(tmpV.x / texel) * texel; tmpV.z = Math.round(tmpV.z / texel) * texel;
  L.sun.target.position.copy(tmpV); L.sun.position.copy(tmpV).addScaledVector(keyDir, 80 + 60 * long);
  L.farSun.target.position.set(0, 0, 0); L.farSun.position.copy(keyDir).multiplyScalar(1000);

  /* the ground: sun direction, horizon sector, haze */
  TU.uSunW.value.copy(keyDir); TU.uTime.value = app.time;
  const sector = setHorizonSun(keyDir);
  updateFloraHorizon(sector.i0, sector.i1);
  TU.uHazeDensity.value = P.haze ?? 1 / 70000;
  if (Math.abs(tod.hour - lastHaze) > .02 || envDirty) { lastHaze = tod.hour; updateHaze(tod.sunW, SP); }

  /* clouds drift with the wind; their shadow on the ground is offset along the sun */
  const cl = P.clouds;
  if (cl) {
    skyU.uCloudP.value.set(cl.cover, cl.scale, cl.soft ?? .12, cl.alt ?? 2200);
    skyU.uCloudOff.value.set(app.time * (cl.wind?.[0] ?? 6), app.time * (cl.wind?.[1] ?? 2));
    const sy = Math.max(.08, keyDir.y), H = cl.alt ?? 2200;
    TU.bbCloud.value.set(cl.cover * (useMoon ? .6 : 1), cl.scale, cl.depth ?? .5, cl.soft ?? .12);
    TU.bbCloudOff.value.set(skyU.uCloudOff.value.x + keyDir.x / sy * H, skyU.uCloudOff.value.y + keyDir.z / sy * H);
  } else { skyU.uCloudP.value.x = 0; TU.bbCloud.value.x = 0; }

  /* night sky */
  const L0 = sidereal(jd, P.lon);
  setCelestial(P.lat, L0, P.grid);
  const nk = night * (1 - .75 * tod.phase * smooth(clamp(mp.alt / 15, 0, 1)));
  if (sky.stars) { sky.stars.material.uniforms.uK.value = nk; sky.stars.material.uniforms.uPx.value = app.renderer.getPixelRatio(); }
  if (sky.milky) sky.milky.material.uniforms.uK.value = nk * (P.milky ?? 1);
  if (sky.moon) {
    const cam = app.camera.position, dist = 30000;
    sky.moon.position.copy(cam).addScaledVector(tod.moonW, dist);
    sky.moon.scale.setScalar(dist * Math.tan(.26 * Math.PI / 180) * 1.35);
    sky.moon.visible = mp.alt > -2;
  }

  /* one sun factor for everything that is not the ground: horizon and clouds at the focus */
  if (!horRV || horAt.distanceTo(tmpV.set(focus.x, focus.z, 0)) > 3) {
    horAt.set(focus.x, focus.z);
    horRV = app.terrain ? horizonAt(app.terrain, focus.x, focus.z, 1.2) : null;
  }
  let vis = 1;
  if (horRV) {
    const h = horRV[sector.i0] * (1 - sector.t) + horRV[sector.i1] * sector.t, el = Math.asin(clamp(keyDir.y, -1, 1));
    vis = smooth(clamp((el - h + TU.uSunSoft.value) / (2 * TU.uSunSoft.value), 0, 1));
  }
  if (cl) vis *= cloudShade(focus.x, focus.z, TU.bbCloud.value, TU.bbCloudOff.value);
  objects.sunVis.value = vis;

  /* exposure: brighter at night so the moonlight reads, darker at noon */
  app.exposureBase = (P.exposure ?? 1) * lerp(1, 2.6, night) * lerp(1, 1.25, tod.dim * (1 - night));
  /* and the eye adapts inside the RV */
  app.renderer.toneMappingExposure = app.exposureBase * lerp(1, 1.75, app.insideK ?? 0);

  /* the image-based light: the sky and the lit ground, rebuilt when the sun has moved */
  const key = tod.hour;
  if (envDirty || Math.abs(key - lastEnv) > (tod.playing ? .25 : .04)) {
    lastEnv = key; envDirty = false;
    const g = P.groundAlbedo ?? new THREE.Color(.34, .2, .14);
    const E = Math.max(0, sunY) * L.sun.intensity * (useMoon ? 0 : 1) * vis + .35 * day;
    sky.envGround.material.color.copy(g).multiplyScalar(E / Math.PI).addScalar(.0015);
    const next = pmrem.fromScene(sky.envScene, 0, .1, 2000);
    app.scene.environment = next.texture; app.farScene.environment = next.texture;
    envRT?.dispose(); envRT = next;
  }
  const nightAmb = lerp(1, .5, night);
  for (const mt of app.materials ?? []) if ('envMapIntensity' in mt && !mt.userData.noEnv) mt.envMapIntensity = (mt.userData.env ?? 1) * nightAmb;
  document.body.classList.toggle('night', tod.dim > .6);
  tod.sky = preetham;   /* exposed for the debug console */
}

export { DIRS };
