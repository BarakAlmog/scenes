import * as THREE from 'three';

/* The baked data of a scene, from sopranos/data: height rings, masks, lines. */
const url = name => new URL(`../../data/${name}`, import.meta.url);
export async function bin(name) { const r = await fetch(url(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.arrayBuffer(); }
export async function json(name) { const r = await fetch(url(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); }
export function image(name) {
  return new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => fail(new Error(name + ' did not load')); im.src = url(name).href; });
}
/* a mask image as pixels to read and a texture to sample; paint(d, w, h) may change the pixels first */
export function maskOf(im, paint = null) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const img = g.getImageData(0, 0, im.width, im.height), d = img.data;
  if (paint) { paint(d, im.width, im.height); g.putImageData(img, 0, 0); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  return { w: im.width, h: im.height, d, tex };
}
/* decode the Uint16 height rings and the skyline */
export function decodeRings(buf, { lo, scale = .05, halves, sky }, N) {
  const u16 = new Uint16Array(buf), dec = (off, n) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = lo + u16[off + i] * scale; return a; };
  const rings = halves.map((half, k) => ({ half, h: dec(k * N * N, N * N) }));
  const skyline = { ...sky, h: dec(halves.length * N * N, sky.az * sky.rad) };
  return { rings, skyline };
}
