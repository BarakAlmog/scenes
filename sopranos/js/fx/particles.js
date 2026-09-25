import * as THREE from 'three';
import { app } from '../app.js';
import * as TX from '../lib/textures.js';

/* Puffs and sparks: dust from the wheels, the blue smoke from the roof vent, fire, water, sparks, glass.
   Two pools of points: soft puffs blended normally, and glowing ones added on top. */
const N_SOFT = 2600, N_GLOW = 900;
function pool(n, additive) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), rot = new Float32Array(n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('rot', new THREE.BufferAttribute(rot, 1).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { tMap: { value: additive ? TX.softDot() : TX.puffTex() }, uScale: { value: 400 }, uLight: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: /* glsl */`
      attribute vec3 color; attribute float size, alpha, rot; uniform float uScale;
      varying vec3 vCol; varying float vA, vRot;
      void main() { vCol = color; vA = alpha; vRot = rot; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale / max(.5, -mv.z); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tMap; uniform vec3 uLight; varying vec3 vCol; varying float vA, vRot;
      void main() { vec2 c = gl_PointCoord - .5; float s = sin(vRot), k = cos(vRot); c = vec2(c.x * k - c.y * s, c.x * s + c.y * k) + .5;
        vec4 t = texture2D(tMap, c); float a = t.a * vA; if (a < .004) discard;
        gl_FragColor = vec4(vCol * ${additive ? '1.' : 'uLight'} * ${additive ? 'a' : '1.'}, ${additive ? '1.' : 'a'}); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.keep = true; pts.renderOrder = 6;
  const P = Array.from({ length: n }, () => ({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, s0: .1, s1: .5, a0: 1, r: 0, vr: 0, c: [1, 1, 1], drag: 1, grav: 0, buoy: 0 }));
  return { pts, P, next: 0, n };
}
export const fx = { soft: null, glow: null };

export function buildParticles() {
  fx.soft = pool(N_SOFT, false); fx.glow = pool(N_GLOW, true);
  app.scene.add(fx.soft.pts, fx.glow.pts);
  app.noAO.push(fx.soft.pts, fx.glow.pts);
  app.onUpdate(update, 60);
}

export function emit(kind, o) {
  const glow = kind === 'fire' || kind === 'spark' || kind === 'ember';
  const pl = glow ? fx.glow : fx.soft;
  const p = pl.P[pl.next]; pl.next = (pl.next + 1) % pl.n;
  Object.assign(p, { life: 0, max: o.life ?? 1, x: o.x, y: o.y, z: o.z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, s0: o.s0 ?? .2, s1: o.s1 ?? 1,
    a0: o.a ?? 1, r: Math.random() * 6.28, vr: (Math.random() - .5) * (o.spin ?? 1), c: o.c ?? [1, 1, 1], drag: o.drag ?? 1.2, grav: o.grav ?? 0, buoy: o.buoy ?? 0, fadeIn: o.fadeIn ?? .1 });
}

function update(dt) {
  const L = app.lights?.sun, lc = fx.soft.pts.material.uniforms.uLight.value;
  if (L) { const day = app.tod?.day ?? 1; lc.setRGB(.35 + .75 * L.color.r * day, .36 + .7 * L.color.g * day, .4 + .62 * L.color.b * day); }
  for (const pl of [fx.soft, fx.glow]) {
    const a = pl.pts.geometry.attributes, pos = a.position.array, col = a.color.array, size = a.size.array, al = a.alpha.array, rot = a.rot.array;
    for (let i = 0; i < pl.n; i++) {
      const p = pl.P[i];
      if (p.life >= p.max) { if (al[i] !== 0) { al[i] = 0; pos[i * 3 + 1] = -999; } continue; }
      p.life += dt; const k = p.life / p.max;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d + (p.buoy - p.grav) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += p.vr * dt;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      col[i * 3] = p.c[0]; col[i * 3 + 1] = p.c[1]; col[i * 3 + 2] = p.c[2];
      size[i] = p.s0 + (p.s1 - p.s0) * Math.sqrt(k);
      al[i] = p.a0 * Math.min(1, k / p.fadeIn) * (1 - k) * (1 - k * .3);
      rot[i] = p.r;
    }
    for (const k of ['position', 'color', 'size', 'alpha', 'rot']) a[k].needsUpdate = true;
  }
  const pr = app.renderer.getPixelRatio(); fx.soft.pts.material.uniforms.uScale.value = fx.glow.pts.material.uniforms.uScale.value = innerHeight * pr * .9;
}

export function clearParticles() { for (const pl of [fx.soft, fx.glow]) if (pl) for (const p of pl.P) p.life = p.max; }
