import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { app } from '../app.js';

/* ---------- materials ---------- */
const matCache = {};
export const mat = (c, r = .85, m = 0) => {
  const k = c + '_' + r + '_' + m;
  return matCache[k] ?? (matCache[k] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
};

/* ---------- small geometry helpers ---------- */
export const M = (geo, material) => { const o = new THREE.Mesh(geo, material); o.castShadow = true; o.receiveShadow = true; return o; };
export const box = (p, w, h, d, m, x, y, z, ry = 0) => { const o = M(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o; };
export const rbox = (p, w, h, d, r, m, x, y, z, ry = 0) => { const o = M(new RoundedBoxGeometry(w, h, d, 3, r), m); o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o; };
export const cyl = (p, rt, rb, h, m, x, y, z, seg = 20) => { const o = M(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); p.add(o); return o; };
export const sph = (p, r, m, x, y, z, ws = 12, hs = 10) => { const o = M(new THREE.SphereGeometry(r, ws, hs), m); o.position.set(x, y, z); p.add(o); return o; };
export const tube = (p, a, b, r, m) => {
  const v = new THREE.Vector3().subVectors(b, a);
  const o = M(new THREE.CylinderGeometry(r, r, v.length(), 10), m);
  o.position.copy(a).add(b).multiplyScalar(.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); p.add(o); return o;
};

/* marks an object as moving or clickable, so the static merge leaves it alone */
export const keep = o => { o.userData.keep = true; return o; };

/* ---------- canvas textures ---------- */
export const canvasTex = (w, h, draw, rx = 1, ry = 1) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = app.maxAniso; return t;
};

/* normal map from a grey height field drawn on a canvas (light = high) */
export const normalTex = (w, h, drawHeight, strength = 2, rx = 1, ry = 1) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  drawHeight(g, w, h);
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), d = out.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * .5 + .5) * 255; d[i + 1] = (dy / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = app.maxAniso; return t;
};

/* ---------- wall-space placement ---------- */
export const WP = (a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
  return { a, b, L, u: [ux, uz], rotY: Math.atan2(-dz, dx), n: [nx, nz],
    at: (t, off = 0, y = 0) => new THREE.Vector3(a[0] + ux * t + nx * off, y, a[1] + uz * t + nz * off) };
};
export const put = (obj, v, ry, parent = app.static) => { obj.position.copy(v); if (ry != null) obj.rotation.y = ry; parent.add(obj); return obj; };

/* ---------- numbers ---------- */
export const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = x => x * x * (3 - 2 * x);
export const easeInOut = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
export const easeInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
export const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const dampAngle = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));

export const inPoly = (x, z, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
};
