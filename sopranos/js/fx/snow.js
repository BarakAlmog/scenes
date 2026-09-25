import * as THREE from 'three';
import { app } from '../app.js';
import { softDot } from '../lib/textures.js';

/* Falling snow in a box that travels with the camera: each flake falls and drifts, wraps round the box, and turns a
   little as it goes. amount 0..1 sets how many are drawn; wind pushes them. */
const N = 6000, BOX = 36;
export const snowfall = { amount: 0, wind: new THREE.Vector2(.4, .15), pts: null };

export function buildSnow() {
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * BOX; pos[i * 3 + 1] = Math.random() * BOX; pos[i * 3 + 2] = Math.random() * BOX; seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  g.setDrawRange(0, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tMap: { value: softDot() }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2() }, uScale: { value: 400 }, uLight: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: /* glsl */`
      attribute float seed; uniform float uTime, uScale; uniform vec3 uCam; uniform vec2 uWind; varying float vA;
      void main() {
        float fall = .6 + seed * .5;
        vec3 p = position;
        p.y -= uTime * fall;
        p.x += uTime * uWind.x + sin(uTime * (.8 + seed) + seed * 40.) * .35;
        p.z += uTime * uWind.y + cos(uTime * (.7 + seed) + seed * 17.) * .35;
        /* wrap into the box round the camera */
        vec3 o = uCam - vec3(${BOX / 2}.);
        p = o + mod(p - o, vec3(${BOX}.));
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = (.028 + seed * .03) * uScale / max(.3, d);
        vA = smoothstep(.3, 1.5, d) * (1. - smoothstep(${(BOX * .35).toFixed(1)}, ${(BOX * .5).toFixed(1)}, d));
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tMap; uniform vec3 uLight; varying float vA;
      void main() { float a = texture2D(tMap, gl_PointCoord).a * vA * .9; if (a < .01) discard; gl_FragColor = vec4(uLight, a); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 7; pts.userData.keep = true;
  app.scene.add(pts); app.noAO.push(pts);
  snowfall.pts = pts;
  app.onUpdate(dt => {
    const u = m.uniforms;
    g.setDrawRange(0, Math.round(N * Math.min(1, snowfall.amount) * (app.density ?? 1)));
    pts.visible = snowfall.amount > 0.001 && !!app.place?.snowy;
    if (!pts.visible) return;
    u.uTime.value += dt; u.uCam.value.copy(app.camera.position); u.uWind.value.copy(snowfall.wind);
    u.uScale.value = innerHeight * app.renderer.getPixelRatio();
    /* flakes take the light of the sky: grey on an overcast day, blue at night */
    const L = app.lights, k = .55 + .45 * (app.tod?.day ?? 1);
    if (L) u.uLight.value.setRGB(.75 * k + .1, .78 * k + .1, .84 * k + .12);
  }, 60);
}
