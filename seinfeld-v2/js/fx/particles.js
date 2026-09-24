import * as THREE from 'three';
import { app } from '../app.js';
import { seeded } from '../lib/util.js';
import * as TX from '../lib/textures.js';

/* dust motes in the air, steam off the coffee maker */
export function buildParticles() {
  const rnd = seeded(13), N = 130, dot = TX.softDot();
  const base = new Float32Array(N * 3), ph = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    base[i * 3] = -5.4 + rnd() * 11.2; base[i * 3 + 1] = .2 + rnd() * 2.2; base[i * 3 + 2] = -3.1 + rnd() * 6.2;
    ph[i * 2] = rnd() * Math.PI * 2; ph[i * 2 + 1] = .4 + rnd() * .8;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff4d8, size: .035, map: dot, transparent: true, opacity: .5,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  dust.userData.keep = true; dust.frustumCulled = false; app.root.add(dust);

  const anchor = app.steamAnchor;
  const steam = [0, 1, 2].map(() => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .12, map: dot, transparent: true, opacity: .3, depthWrite: false }));
    p.userData.keep = true; p.frustumCulled = false; app.root.add(p); return p;
  });

  app.onUpdate(() => {
    const t = app.time, still = app.reducedMotion;
    if (!still) {
      const p = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const a = ph[i * 2], s = ph[i * 2 + 1];
        p[i * 3] = base[i * 3] + Math.sin(t * .3 * s + a) * .25;
        p[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * .22 * s + a * 2) * .18;
        p[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * .26 * s + a) * .25;
      }
      geo.attributes.position.needsUpdate = true;
    }
    dust.material.opacity = .5 * (1 - .6 * (app.tod?.dim ?? 0));
    steam.forEach((s, i) => {
      const k = (t * .45 + i / 3) % 1;
      s.position.set(anchor.x + Math.sin(t * 2 + i * 2) * .02, anchor.y + k * .5, anchor.z);
      s.material.opacity = .3 * Math.sin(Math.PI * k);
      s.material.size = .1 + k * .22;
    });
  });
}
