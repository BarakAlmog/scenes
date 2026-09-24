import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, cyl, tube, keep, mat } from '../lib/util.js';
import { W, STAIR, onWall } from './plan.js';
import { attach, WALL_H } from './walls.js';
import { windowView } from './outside.js';
import { hotspot, hitBox } from '../ctrl/hotspots.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* a cast-iron radiator, also used in the apartments */
export function radiator(n = 9) {
  const g = new THREE.Group(), m = mat(0xd3d0c6, .5, .35);
  for (let i = 0; i < n; i++) box(g, .05, .5, .16, m, -(n - 1) * .04 + i * .08, .36, 0);
  box(g, n * .08 + .02, .035, .18, m, 0, .62, 0);
  for (const s of [-1, 1]) { cyl(g, .016, .016, .12, m, s * (n - 1) * .04, .06, 0); }
  return g;
}

/* a wall light with a glass bowl */
export function sconce(glass) {
  const g = new THREE.Group();
  box(g, .06, .14, .03, MAT.brass, 0, 0, .015);
  tube(g, V(0, 0, .02), V(0, .05, .12), .008, MAT.brass);
  const b = new THREE.Mesh(new THREE.SphereGeometry(.085, 16, 8, 0, Math.PI * 2, Math.PI * .45, Math.PI * .55), glass);
  b.position.set(0, .1, .13); b.rotation.x = Math.PI; g.add(b);
  return g;
}

export function buildHallway() {
  const S = STAIR, tread = MAT.woodDark, riser = mat(0xe4dccb, .8), side = mat(0x4b4030, .75);
  const g = new THREE.Group();
  const x0 = S.x0 + .03, x1 = S.x1 - .03, well = .06;

  /* flight 1 climbs north along the west half, solid to the floor */
  for (let i = 1; i < S.n; i++) {
    const zf = S.zBottom - (i - 1) * S.run, zb = S.zBottom - i * S.run, y = i * S.rise;
    box(g, -well - x0, y - .03, zf - zb, side, (x0 - well) / 2, (y - .03) / 2, (zf + zb) / 2);
    box(g, -well - x0 + .02, .03, S.run + .03, tread, (x0 - well) / 2, y - .015, (zf + zb) / 2 + .015);
    box(g, -well - x0, S.rise - .03, .012, riser, (x0 - well) / 2, y - S.rise / 2 - .015, zf + .004);
  }
  /* the landing across the north end, and the block under its west half */
  const lz0 = S.zBack, lz1 = S.zLand, ly = S.rise * S.n;
  box(g, x1 - x0, .2, lz1 - lz0, side, (x0 + x1) / 2, ly - .1, (lz0 + lz1) / 2);
  box(g, x1 - x0 + .02, .03, lz1 - lz0 + .03, tread, (x0 + x1) / 2, ly + .015, (lz0 + lz1) / 2 + .015);
  box(g, -well - x0, ly - .2, lz1 - lz0, side, (x0 - well) / 2, (ly - .2) / 2, (lz0 + lz1) / 2);
  box(g, -well - x0, S.rise - .03, .012, riser, (x0 - well) / 2, ly - S.rise / 2, lz1 + .004);
  /* flight 2 climbs south along the east half, open underneath, cut at the wall tops */
  for (let j = 1; j < S.n; j++) {
    const zb = S.zLand + (j - 1) * S.run, zf = S.zLand + j * S.run, y = ly + j * S.rise;
    if (y > WALL_H + .01) break;
    box(g, x1 - well, .26, zf - zb, riser, (x1 + well) / 2, y - .16, (zf + zb) / 2);
    box(g, x1 - well + .02, .03, S.run + .03, tread, (x1 + well) / 2, y - .015, (zf + zb) / 2 - .015);
    box(g, x1 - well, S.rise, .012, riser, (x1 + well) / 2, y - S.rise / 2 - .015, zb - .004);
  }
  /* sloped soffit under flight 2 */
  {const len = Math.hypot(S.zBottom - S.zLand, S.rise * (S.n - 1)), a = Math.atan2(S.rise * (S.n - 1), S.zBottom - S.zLand);
   const sf = box(g, x1 - well, .03, len, mat(0xe6dfcf, .85), (x1 + well) / 2, ly - .25 + S.rise * (S.n - 1) / 2, (S.zLand + S.zBottom) / 2);
   sf.rotation.x = -a;}

  /* iron balusters and a wooden rail on the inner edges; the newel post at the foot */
  const rail = MAT.woodDark, bal = MAT.iron, H = .9;
  const flight1 = z => Math.min(S.n - 1, Math.max(0, Math.floor((S.zBottom - z) / S.run) + 1)) * S.rise;
  for (let i = 0; i < S.n - 1; i++) {
    const z = S.zBottom - (i + .5) * S.run, y = flight1(z);
    for (const dz of [-.07, .07]) cyl(g, .008, .008, H, bal, -well - .02, y + H / 2, z + dz, 6);
  }
  tube(g, V(-well - .02, H + .12, S.zBottom + .05), V(-well - .02, H + ly, S.zLand - .02), .028, rail);
  box(g, .11, 1.12, .11, rail, -well - .02, .56, S.zBottom + .05);
  cyl(g, .07, .05, .06, rail, -well - .02, 1.15, S.zBottom + .05, 12);
  for (let j = 0; j < S.n - 1; j++) {
    const z = S.zLand + (j + .5) * S.run, y = ly + (j + 1) * S.rise;
    if (y + H > WALL_H) break;
    for (const dz of [-.07, .07]) cyl(g, .008, .008, H, bal, well + .02, y + H / 2, z + dz, 6);
  }
  {const top = WALL_H - H - ly, zEnd = S.zLand + top / S.rise * S.run;
   tube(g, V(well + .02, ly + H, S.zLand - .02), V(well + .02, WALL_H, zEnd), .028, rail);
   tube(g, V(-well - .02, ly + H, S.zLand - .04), V(well + .02, ly + H, S.zLand - .04), .028, rail);}
  app.static.add(g);

  /* the window over the landing */
  {const ww = .9, wh = .67, wy = 1.95 + wh / 2, fr = MAT.white, win = new THREE.Group();
   const { pos, rotY } = onWall('sN', 0, wy, 0);
   win.position.copy(pos); win.rotation.y = rotY;
   box(win, ww + .1, .06, .2, fr, 0, wh / 2 + .02, 0); box(win, ww + .12, .08, .24, fr, 0, -wh / 2 - .03, .02);
   for (const s of [-1, 1]) box(win, .06, wh + .06, .2, fr, s * (ww / 2 + .02), 0, 0);
   box(win, ww, .04, .08, fr, 0, 0, 0); box(win, .04, wh, .08, fr, 0, 0, 0);
   const view = windowView(ww, wh); view.position.z = -.06; win.add(view);
   const gl = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), MAT.glass); gl.position.z = .02; win.add(gl);
   app.root.add(win); attach(W.sN, win);}

  /* hallway lights, a radiator, door mats */
  MAT.hallGlass = new THREE.MeshStandardMaterial({ color: 0xf6ecd6, roughness: .4, emissive: 0xffdfa8, emissiveIntensity: 2.2, side: THREE.DoubleSide });
  const hs = (name, v) => { const { pos, rotY } = onWall(name, v, 2.02, -.12); const s = sconce(MAT.hallGlass); s.position.copy(pos); s.rotation.y = rotY + Math.PI; app.root.add(s); return attach(W[name], s); };
  hs('mW', -1.1); hs('gE', 2.6);
  {const r = radiator(10); r.position.set(-.84, 0, -4.05); r.rotation.y = Math.PI / 2; app.static.add(r);}
  for (const x of [-.55, .55]) { const m = box(app.static, .5, .014, .8, mat(0x5a4a3a, .95), x, .012, .9); m.castShadow = false; }

  const hit = new THREE.Group(); app.root.add(hit);
  hitBox(hit, 3.1, 2.6, 2.6, 0, 1.3, (S.zBottom + S.zBack) / 2);
  hotspot(hit, { title: 'The stairs', text: 'Up to the next floor. Ross’s new sofa has to go up them: press PIVOT! to try.', action: () => app.emit('pivot:go') });
}
