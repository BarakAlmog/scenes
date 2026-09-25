import * as THREE from 'three';
import { M, box, mat, canvasTex, seeded } from '../lib/util.js';
import { bakeStatic } from '../lib/merge.js';
import { hipRoof } from './model.js';
import { roofTex } from './textures.js';

/* The houses round the Sopranos': big two-storey colonials in the trees, placed after the roofs on the aerial.
   Only their volumes, siding, windows and roofs: they are seen through the woods and from the drive. The large
   white one across the street stands up on the hill, as in the shot of the drive in the pilot. */
const LIST = [
  /* x, z, width, depth, turn, storeys, siding */
  [-124, -63, 21, 12, -.2, 2.5, '#f1efe8'],
  [-53, -71, 22, 13, .35, 2, '#e6dcc4'],
  [-154, -24, 20, 12, .1, 2, '#c9ccc8'],
  [72, -90, 22, 13, -.4, 2, '#d8c3a0'],
  [-68, 31, 17, 11, .6, 2, '#eeeae0'],
  [-33, 58, 20, 12, .3, 2, '#e3d9c0'],
  [-104, 90, 16, 11, .2, 1, '#bfc4c2'],
  [-8, 104, 15, 10, 0, 2, '#efece4'],
  [33, 106, 18, 11, .1, 2, '#d5bf9c'],
  [70, 111, 16, 10, .05, 2, '#e8dfc8'],
  [146, 120, 16, 10, 0, 2, '#c4c9c6'],
  [-70, 148, 16, 11, .3, 2, '#f0ede6'],
  [160, 66, 16, 11, .5, 2, '#e6dcc4'],
  [-150, 58, 16, 11, .2, 2, '#f0ede6'],
  [-153, -145, 24, 14, .4, 2, '#f2f0ea'],
  [100, -150, 18, 12, .3, 2, '#c9ccc8'],
];

function facadeTex(color, storeys, seed) {
  const rnd = seeded(seed);
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, w, 1); }
    const rows = Math.round(storeys), cols = 6;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rnd() < .12) continue;
      const x = (c + .5) * w / cols - 16, y = h - (r + 1) * h / (storeys + .4) + 14;
      g.fillStyle = '#f7f6f2'; g.fillRect(x - 4, y - 4, 40, 58);
      g.fillStyle = rnd() < .25 ? '#6b5a3c' : '#2a3136'; g.fillRect(x, y, 32, 50);
      g.fillStyle = '#f7f6f2'; g.fillRect(x + 15, y, 2, 50); g.fillRect(x, y + 24, 32, 2);
      if (rnd() < .5) { g.fillStyle = '#2d3a2f'; g.fillRect(x - 14, y - 2, 10, 54); g.fillRect(x + 36, y - 2, 10, 54); }
    }
  });
}

export function buildNeighbours(T) {
  const group = new THREE.Group(); group.name = 'neighbours';
  const roofM = new THREE.MeshStandardMaterial({ map: roofTex(), roughness: .9, color: 0xb8b4ae });
  const M_ = { roof: roofM, trim: mat(0xf2f0ea, .7), soffit: mat(0xe6e2d8, .8) };
  const solids = [];
  LIST.forEach(([x, z, w, d, a, st, col], i) => {
    const hgt = st * 3 + .6, c = Math.cos(a), s = Math.sin(a);
    const corner = (u, v) => [x + u * c + v * s, z - u * s + v * c];
    const poly = [corner(-w / 2, -d / 2), corner(w / 2, -d / 2), corner(w / 2, d / 2), corner(-w / 2, d / 2)];
    let lo = 1e9, hi = -1e9; for (const [px, pz] of poly) { const y = T.heightAt(px, pz); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const floor = hi + .3, base = lo - .4, eave = floor + hgt;
    const g = new THREE.Group(); group.add(g);
    const fm = new THREE.MeshStandardMaterial({ map: facadeTex(col, st, 40 + i), roughness: .85 });
    fm.map.repeat.set(w / 14, 1);
    const body = M(new THREE.BoxGeometry(w, eave - base, d), fm); body.position.set(x, (eave + base) / 2, z); body.rotation.y = a; g.add(body);
    /* the stone below the first floor, where the ground falls */
    if (floor - base > .9) box(g, w + .06, floor - base, d + .06, mat(0x8f877c, .9), x, (floor + base) / 2, z, a);
    hipRoof(g, M_, poly, eave, .6, .45, { soffit: false });
    /* a chimney on one end */
    const [cx, cz] = corner(w / 2 - 1.2, 0); box(g, 1.1, 4.2, 1.1, mat(0x9a6b50, .9), cx, eave + 1.6, cz, a);
    solids.push({ poly });
  });
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  bakeStatic(group);
  return { group, polys: solids.map(s => s.poly) };
}
