import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, rbox, cyl, sph, tube, put, mat, seeded } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { W, onWall, doors } from './plan.js';
import { attach } from './walls.js';
import { windowView, setViewFrame } from './outside.js';
import { sofa, armchair, diningChair, roundTable, shelfUnit, pantry, books, plant, flowers, tableLamp, floorLamp, litLamp,
  framed, paneFrame, drapes, rugMesh, pillow, faceTo } from '../lib/props.js';
import { makeFridge } from './appliances.js';
import { hotspot, hitBox } from '../ctrl/hotspots.js';
import { sconce } from './hallway.js';

/* Monica's apartment, 20: the kitchen against the brick, the round table, the purple living room,
   the big window onto the balcony. The audience sees it from the south. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const S = () => app.static;
/* hang obj on a wall's room face; back is the distance from obj's origin to its back, or 'center' to sit in the wall */
export const onW = (name, v, y, obj, back = .015, parent = app.root) => {
  const o = onWall(name, v, y, back === 'center' ? 0 : W[name].th / 2 + back); put(obj, o.pos, o.rotY, parent);
  if (parent === app.root) attach(W[name], obj);
  return obj;
};

/* small one-shot animations on props */
const anims = [];
export const play = (dur, fn) => anims.push({ t: 0, dur, fn });
function tickAnims(dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t = Math.min(1, a.t + dt / a.dur);
    try { a.fn(a.t); } catch (e) { anims.splice(i, 1); throw e; }
    if (a.t >= 1) anims.splice(i, 1);
  }
}

export function buildMonica() {
  const teal = MAT.teal, tealD = MAT.tealD, top = MAT.butcher, rnd = seeded(211);
  const wallZ = -2.5, cd = .62, ct = .9;               /* the brick face, counter depth and height */

  /* ---------- the back counter, west to east ---------- */
  {const g = new THREE.Group();
   const base = (x0, x1, doorsOn = true) => {
     box(g, x1 - x0, .82, cd - .04, teal, (x0 + x1) / 2, .45, wallZ + cd / 2 - .02);
     box(g, x1 - x0, .08, cd - .1, MAT.black, (x0 + x1) / 2, .04, wallZ + cd / 2 - .06);
     if (doorsOn) {
       const n = Math.max(1, Math.round((x1 - x0) / .45));
       for (let i = 0; i < n; i++) {
         const x = x0 + (x1 - x0) / n * (i + .5);
         box(g, (x1 - x0) / n - .05, .58, .02, tealD, x, .5, wallZ + cd - .03);
         box(g, (x1 - x0) / n - .12, .46, .012, teal, x, .5, wallZ + cd - .015);
         cyl(g, .012, .012, .04, MAT.brass, x + ((x1 - x0) / n) * .32, .7, wallZ + cd, 8).rotation.x = Math.PI / 2;
       }
     }
     box(g, x1 - x0 + .02, .045, cd + .02, top, (x0 + x1) / 2, ct - .02, wallZ + cd / 2);
   };
   base(1.9, 2.62);
   base(3.38, 4.34, false);
   /* sink under the window, a floral skirt instead of doors */
   const skirt = new THREE.MeshStandardMaterial({ map: TX.floralDrape(), roughness: .9, side: THREE.DoubleSide });
   for (let i = 0; i < 7; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(.16, .74), skirt); p.position.set(3.46 + i * .13, .45, wallZ + cd - .01); p.rotation.y = i % 2 ? .3 : -.3; g.add(p); }
   box(g, .5, .05, .4, mat(0xdcdcd6, .25, .3), 3.9, ct + .005, wallZ + .3);
   box(g, .44, .02, .34, mat(0x9ea3a6, .2, .6), 3.9, ct + .02, wallZ + .3);
   cyl(g, .018, .018, .26, MAT.chrome, 3.9, ct + .13, wallZ + .08, 10);
   tube(g, V(3.9, ct + .26, wallZ + .08), V(3.9, ct + .22, wallZ + .24), .014, MAT.chrome);
   for (const s of [-1, 1]) cyl(g, .025, .025, .05, MAT.chrome, 3.9 + s * .12, ct + .04, wallZ + .08, 10);
   /* the range */
   {const r = new THREE.Group(); r.position.set(3.0, 0, wallZ + .32);
    box(r, .76, .86, .62, MAT.steel, 0, .45, 0);
    box(r, .78, .03, .64, mat(0x1d1d1f, .4), 0, .895, 0);
    for (const [x, z] of [[-.19, -.15], [.19, -.15], [-.19, .15], [.19, .15]]) { cyl(r, .085, .085, .015, MAT.iron, x, .915, z, 16); cyl(r, .03, .03, .02, MAT.steel, x, .92, z, 10); }
    box(r, .62, .42, .02, mat(0x2b2b2e, .15, .2), 0, .45, .312);
    box(r, .6, .03, .03, MAT.chrome, 0, .72, .33);
    box(r, .76, .26, .08, MAT.steel, 0, 1.03, -.29);
    for (let i = 0; i < 4; i++) cyl(r, .022, .022, .03, MAT.black, -.27 + i * .18, .82, .32, 10).rotation.x = Math.PI / 2;
    cyl(r, .05, .05, .01, mat(0xf4f1e6, .4), 0, 1.06, -.245, 16).rotation.x = Math.PI / 2;
    /* Monica's pot, steaming */
    cyl(r, .12, .11, .16, MAT.steel, -.19, 1.0, .15, 18);
    cyl(r, .1, .1, .01, mat(0xc87a3a, .6), -.19, 1.07, .15, 16);
    tube(r, V(-.19 + .12, 1.05, .15), V(-.19 + .27, 1.06, .15), .012, MAT.black);
    const kt = sph(r, .09, mat(0xc23227, .35), .19, 1.0, -.15, 14, 10); kt.scale.y = .8;
    g.add(r);
    app.steamAnchor = V(3.0 - .19, 1.12, wallZ + .32 + .15);
    app.stove = { monica: V(3.0, 0, wallZ + .32) };}
   /* things on the counters */
   {const mx = new THREE.Group(); mx.position.set(4.12, ct, wallZ + .26); mx.rotation.y = -.4;
    const red = mat(0xb8231e, .3, .2);
    rbox(mx, .2, .06, .3, .02, red, 0, .03, 0); rbox(mx, .08, .26, .09, .03, red, 0, .18, -.1);
    rbox(mx, .12, .12, .3, .05, red, 0, .34, -.02); cyl(mx, .09, .06, .14, MAT.chrome, 0, .12, .05, 16);
    g.add(mx);}
   rbox(g, .26, .18, .16, .03, MAT.chrome, 2.25, ct + .09, wallZ + .2);
   box(g, .34, .02, .24, MAT.woodHoney, 3.62, ct + .01, wallZ + .38, .1);
   for (let i = 0; i < 3; i++) sph(g, .04, mat([0xd83a2a, 0xf0a030, 0x6aa040][i], .5), 3.56 + i * .06, ct + .06, wallZ + .38, 10, 8);
   cyl(g, .11, .09, .2, mat(0xf2ede0, .3), 2.42, ct + .1, wallZ + .18, 16);
   cyl(g, .07, .07, .05, mat(0xc8a064, .5), 2.42, ct + .22, wallZ + .18, 16);
   S().add(g);}

  /* ---------- the peninsula: teal, open shelves toward the door ---------- */
  {const g = new THREE.Group(), x0 = 1.9, x1 = 2.6, z0 = wallZ + cd, z1 = -.85, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, L = z1 - z0;
   box(g, x1 - x0 - .04, .82, L, teal, xc, .45, zc);
   for (let i = 0; i < 3; i++) box(g, .01, .2, L - .1, mat(0x2a3b3c, .9), x0 - .005, .22 + i * .27, zc);
   for (const y of [.12, .38, .64]) {
     books(g, x0 + .02, x0 + .06, y, zc, .2);
     for (let k = 0; k < 4; k++) {
       const z = z0 + .12 + k * (L - .2) / 3;
       if (rnd() < .5) cyl(g, .07, .06, .1, mat([0xb89060, 0xe8d8b8, 0x8a6a4a][k % 3], .8), x0 + .12, y + .05, z, 12);
       else box(g, .16, .12, .18, mat(0xc9a36e, .9), x0 + .12, y + .06, z);
     }
   }
   box(g, x1 - x0 + .08, .05, L + .06, top, xc, ct - .02, zc + .02);
   box(g, x1 - x0 - .04, .82, .02, tealD, xc, .45, z1 + .005);
   cyl(g, .16, .1, .08, mat(0x3a6ac8, .4), xc, ct + .04, z1 - .25, 20);
   for (let i = 0; i < 5; i++) sph(g, .045, mat([0xe07b2a, 0xd83232, 0x7ab33c, 0xe6c33c, 0xe07b2a][i], .55), xc - .06 + (i % 3) * .06, ct + .1 + (i > 2 ? .04 : 0), z1 - .25 + (i % 2) * .05, 10, 8);
   box(g, .2, .04, .28, mat(0x8a2a2a, .8), xc, ct + .02, z1 - .7, .2);
   S().add(g);}

  /* ---------- on the brick: open shelves, the pot rack, plates, the yellow cabinet ---------- */
  {const sh = shelfUnit(1.4, .92, .3, teal, 3, (g, y) => pantry(g, -.66, .66, y, 0));
   onW('mN1', 2.66, 1.42, sh, .15);
   const rack = new THREE.Group();
   cyl(rack, .012, .012, .7, MAT.iron, 0, 0, .12).rotation.z = Math.PI / 2;
   for (const s of [-1, 1]) tube(rack, V(s * .35, 0, .12), V(s * .35, .1, 0), .01, MAT.iron);
   const copper = mat(0xb8733d, .3, .8);
   [[-.26, .22, .1], [-.08, .18, .12], [.1, .24, .11], [.27, .16, .09]].forEach(([x, drop, r]) => {
     tube(rack, V(x, 0, .12), V(x, -drop + r, .12), .004, MAT.iron);
     const p = cyl(rack, r, r * .9, .05, copper, x, -drop, .12, 18); p.rotation.x = Math.PI / 2;
     tube(rack, V(x, -drop + r, .12), V(x, -drop + r + .08, .12), .01, copper);
   });
   onW('mN1', 1.52, 2.05, rack, 0);
   for (const [x, y, c] of [[1.28, 2.38, 0x3a6ac8], [1.62, 2.44, 0xe0b53c], [1.9, 2.36, 0xd8453b]]) {
     const pl = new THREE.Group();
     cyl(pl, .09, .09, .015, mat(0xf4f1ea, .3), 0, 0, 0, 20).rotation.x = Math.PI / 2;
     cyl(pl, .06, .06, .017, mat(c, .4), 0, 0, .002, 20).rotation.x = Math.PI / 2;
     onW('mN1', x, y, pl, .008);
   }
   const yc = new THREE.Group(), yel = MAT.mYellow;
   box(yc, .66, .56, .34, yel, 0, 0, 0);
   for (const s of [-1, 1]) { box(yc, .3, .5, .02, mat(0xf6d45a, .45), s * .16, 0, .175); cyl(yc, .012, .012, .05, MAT.brass, s * .03, -.12, .19, 8); }
   onW('mN2', 4.68, 2.24, yc, .17);}

  /* ---------- the window over the sink ---------- */
  {const w = .9, h = 1.12, fr = paneFrame(w, h, 2, 3, MAT.tealD, { depth: .1, bar: .03, sash: .05 });
   const view = windowView(w, h); view.position.z = -.07; fr.add(view);
   onW('mN2', 3.9, 1.58, fr, 'center');
   const val = drapes(1.2, .55, new THREE.MeshStandardMaterial({ map: TX.floralDrape(), roughness: .9, side: THREE.DoubleSide }), { valance: .3 });
   onW('mN2', 3.9, 1.9, val, .01);}

  /* ---------- the fridge, the beam ---------- */
  makeFridge('monica', { at: V(4.68, 0, wallZ + .33), rotY: 0, w: .66, h: 1.72, d: .62, rounded: true,
    title: 'Monica’s fridge', text: open => open ? 'Everyone helps themselves, Joey most of all. Click to close it.' : 'Everyone helps themselves, Joey most of all. Click to open it.' });
  {const g = new THREE.Group(), wood = mat(0x5e3c22, .7), x = 5.1;
   box(g, .15, 2.75, .15, wood, x, 1.375, wallZ + .02);
   box(g, .15, 2.75, .15, wood, x, 1.375, 3.0);
   box(g, .16, .18, 5.7, wood, x, 2.66, .26);
   for (const [z, s] of [[wallZ + .1, 1], [3.0, -1]]) { const b = box(g, .09, .62, .09, wood, x, 2.36, z + s * .26); b.rotation.x = -s * .72; }
   S().add(g);
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, .4, 2.8, .4, x, 1.4, wallZ + .02);
   hotspot(hit, { title: 'The beam', text: 'A wooden beam between the kitchen and the living room. It came and went between seasons; it stayed when James Burrows directed.' });}

  /* ---------- the round table and its mismatched chairs ---------- */
  {const T = [3.15, .35];
   put(roundTable(.56), V(T[0], 0, T[1]), 0);
   const g = new THREE.Group(); flowers(g, 0, .77, 0); g.position.set(T[0], 0, T[1]); S().add(g);
   box(S(), .3, .012, .22, MAT.white, T[0] + .25, .78, T[1] + .15, .5);
   const chairs = [['windsor', mat(0xf2efe6, .5)], ['ladder', MAT.teal], ['bistro', MAT.woodHoney], ['plain', mat(0xe6c33c, .5)]];
   [-Math.PI / 2 - .2, 0, Math.PI / 2 + .15, Math.PI].forEach((a, i) => {
     const x = T[0] + Math.sin(a) * .74, z = T[1] + Math.cos(a) * .74;
     put(diningChair(...chairs[i]), V(x, 0, z), faceTo([x, z], T));
   });
   app.table = { monica: { pos: V(T[0], 0, T[1]) } };
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, 1.4, .9, 1.4, T[0], .45, T[1]);
   hotspot(hit, { title: 'The kitchen table', text: 'No two chairs match, and the set changed them all through the seasons.' });}

  /* ---------- the door wall: hooks, the sun, a phone ---------- */
  {const hooks = new THREE.Group();
   box(hooks, .7, .1, .05, MAT.woodDark, 0, 0, 0);
   for (let i = 0; i < 4; i++) cyl(hooks, .01, .01, .08, MAT.brass, -.27 + i * .18, 0, .04, 6).rotation.x = Math.PI / 2;
   rbox(hooks, .3, .5, .1, .05, mat(0x6a2f3a, .9), -.18, -.28, .08);
   cyl(hooks, .12, .14, .08, mat(0x2a2a30, .8), .15, -.05, .1, 16).rotation.x = Math.PI / 2 - .3;
   rbox(hooks, .2, .34, .08, .04, mat(0xc79a5a, .8), .3, -.2, .07);
   onW('mW', -.25, 1.72, hooks, .025);
   const sun = new THREE.Group(), gold = mat(0xc6983e, .35, .7);
   cyl(sun, .1, .1, .03, gold, 0, 0, 0, 20).rotation.x = Math.PI / 2;
   for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = M(new THREE.ConeGeometry(.025, i % 2 ? .12 : .18, 4), gold); r.position.set(Math.cos(a) * (.16 + (i % 2 ? 0 : .03)), Math.sin(a) * (.16 + (i % 2 ? 0 : .03)), 0); r.rotation.z = a - Math.PI / 2; sun.add(r); }
   onW('mW', -1.25, 1.95, sun, .015);
   const ph = new THREE.Group();
   rbox(ph, .1, .2, .06, .02, mat(0xe9e2d0, .5), 0, 0, 0);
   rbox(ph, .05, .2, .05, .02, mat(0xe9e2d0, .5), -.055, .01, .04);
   onW('mW', 2.2, 1.45, ph, .03);}

  /* ---------- the living room ---------- */
  put(rugMesh(2.6, 3.4, MAT.rugM), V(7.15, .02, .15), Math.PI / 2);
  {const s = sofa({ w: 2.15, d: .98 });
   const pw = new THREE.MeshStandardMaterial({ map: TX.patchwork(['#b8342e', '#2f6a3a', '#f1ece0', '#2a4d8f', '#d9ad3c']), roughness: .9 });
   pillow(s, .44, .42, pw, -.62, .74, -.2, -.25, 0, .3);
   pillow(s, .4, .38, mat(0x6b87b8, .9), .66, .72, -.22, -.25, 0, -.35);
   put(s, V(5.95, 0, .1), Math.PI / 2);
   app.sofa = { monica: { pos: V(5.95, 0, .1), rot: Math.PI / 2 } };}
  {const g = new THREE.Group(), w = MAT.woodRustic;
   box(g, 1.25, .07, .72, w, 0, .43, 0); box(g, 1.15, .04, .62, w, 0, .14, 0);
   for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, .08, .44, .08, w, sx * .56, .22, sz * .3);
   box(g, .34, .02, .26, mat(0xd8453b, .8), -.3, .475, .08, .2); box(g, .3, .02, .24, mat(0x2a4d8f, .8), -.28, .495, .06, -.1);
   cyl(g, .12, .08, .08, mat(0xf2ede0, .3), .32, .5, -.05, 16);
   put(g, V(7.1, 0, .1), Math.PI / 2);}
  {const g = new THREE.Group(), iron = mat(0xe8e2d4, .5);
   cyl(g, .3, .3, .02, MAT.glass, 0, .52, 0, 24);
   for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; tube(g, V(Math.cos(a) * .24, .5, Math.sin(a) * .24), V(Math.cos(a) * .12, .02, Math.sin(a) * .12), .015, iron); }
   cyl(g, .06, .06, .04, iron, 0, .26, 0, 12);
   put(g, V(5.95, 0, 1.52), 0);}
  {const chairP = armchair({ cover: MAT.couchCream, wide: 1.08 });
   pillow(chairP, .4, .36, new THREE.MeshStandardMaterial({ map: TX.plaid('#c8342e', '#f2ede1', '#f2ede1'), roughness: .9 }), .24, .7, -.18, -.2, .2, .2);
   const at = [7.7, -1.72], rot = faceTo(at, [6.3, .7]);
   put(chairP, V(at[0], 0, at[1]), rot);
   app.armchair = { monica: { pos: V(at[0], 0, at[1]), rot } };}
  put(armchair({ cover: mat(0xd9b3a3, .95), wide: .96 }), V(8.75, 0, 1.8), faceTo([8.75, 1.8], [7.1, .1]));
  rbox(S(), .52, .42, .52, .06, mat(0xefe6cf, .95), 7.95, .21, 1.05);
  rbox(S(), .5, .34, .5, .08, mat(0x1f4f4c, .85), 8.3, .17, -.55);
  {const g = new THREE.Group(), w = mat(0x4a2e1c, .7);
   box(g, 1.9, .06, .42, w, 0, .46, 0); box(g, 1.8, .12, .36, w, 0, .38, 0);
   for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, .07, .44, .07, w, sx * .86, .22, sz * .16);
   box(g, .36, .02, .28, MAT.white, -.4, .5, 0, .1); box(g, .3, .03, .22, mat(0xb03a2a, .8), .45, .505, 0, -.2);
   put(g, V(7.05, 0, 2.62), 0);}

  /* the TV dresser, the Jouets poster, a fern */
  {const g = new THREE.Group(), h = MAT.woodHoney;
   box(g, 1.3, .8, .5, h, 0, .44, 0);
   for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { box(g, .6, .2, .02, mat(0xc7925a, .5), s * .32, .2 + i * .25, .255); cyl(g, .015, .015, .03, MAT.brass, s * .32, .2 + i * .25, .27, 8).rotation.x = Math.PI / 2; }
   box(g, 1.34, .04, .54, mat(0x9c6a3a, .5), 0, .86, 0);
   for (const sx of [-1, 1]) cyl(g, .03, .02, .05, h, sx * .6, .025, .2, 8);
   put(g, V(9.25, 0, -.15), -Math.PI / 2);
   app.tvSpot = { monica: { pos: V(9.25, .88, -.15), rot: -Math.PI / 2 } };
   onW('mP2', -.15, 1.86, framed(.7, .96, TX.jouetsPoster(), mat(0x2a2016, .6)));
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, .1, 1.05, .78, 9.5, 1.86, -.15);
   hotspot(hit, { title: 'The Jouets poster', text: 'A French toy-shop poster after Jules Chéret, over the TV. On the set it hid a camera port in the wall.' });
   const st = new THREE.Group(); cyl(st, .18, .18, .03, MAT.woodDark, 0, .62, 0, 16); cyl(st, .03, .03, .6, MAT.woodDark, 0, .31, 0, 8); cyl(st, .14, .16, .02, MAT.woodDark, 0, .01, 0, 12);
   const pl = plant('fern'); pl.position.y = .63; st.add(pl); put(st, V(9.2, 0, -1.25), 0);}
  MAT.mSconce = new THREE.MeshStandardMaterial({ color: 0xf1c6a8, roughness: .4, emissive: 0xff9a6a, emissiveIntensity: 2, side: THREE.DoubleSide });
  app.glows.push({ mat: MAT.mSconce, day: 1.2, night: 4.2 });
  onW('mP1', -1.55, 1.98, sconce(MAT.mSconce), 0);
  onW('mP2', 1.25, 1.98, sconce(MAT.mSconce), 0);
  onW('mP2', 1.45, 1.55, framed(.3, .38, TX.artTex('flowers')));
  litLamp(floorLamp(0xd7b27a, 0xffc890), app.root, V(5.4, 0, -1.25), 0, { day: 3.5, night: 7, dist: 6.5, name: 'Monica’s lamp' });

  /* ---------- the big window onto the balcony ---------- */
  {const w = 2.54, h = 2.04, cy = .6 + h / 2, steel = mat(0x2d2e30, .45, .5);
   const fr = paneFrame(w, h, 6, 5, steel, { depth: .09, bar: .03, sash: .07 });
   box(fr, w, .06, .09, steel, 0, .15, 0);
   const view = windowView(w, h); view.position.z = -.07; fr.add(view);
   onW('mN3', 8.05, cy, fr, 'center');
   setViewFrame(view);
   onW('mN3', 8.05, .16, drapes(3.1, 2.46, MAT.drapeM, { valance: .42 }), .03);
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, 2.6, 2.1, .2, 8.05, cy, -3.62);
   hotspot(hit, { title: 'The window', text: 'Out to the balcony and across the street, to Ugly Naked Guy’s window. Slide the time to night.' });
   /* a writing table and a chair in front of it, up the step */
   const d = new THREE.Group(), wd = MAT.woodMid;
   box(d, 1.2, .05, .56, wd, 0, .76, 0);
   for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(d, .05, .74, .05, wd, sx * .55, .37, sz * .24);
   box(d, 1.1, .12, .5, wd, 0, .67, 0);
   books(d, -.5, -.25, .785, .05, .2);
   box(d, .2, .08, .14, mat(0xe8e0cf, .5), .15, .82, .1, .3);
   put(d, V(7.6, .16, -3.32), 0);
   litLamp(tableLamp(0xefd7a8, 0xffcf8a), app.root, V(8.05, .16 + .785, -3.38), 0, { day: 1.6, night: 3.6, dist: 3.5, name: 'The desk lamp' });
   put(diningChair('ladder', MAT.woodMid), V(7.45, .16, -2.9), Math.PI);}

  /* ---------- the corridor: a coat, the window to the balcony ---------- */
  {const coat = new THREE.Group(); cyl(coat, .01, .01, .08, MAT.brass, 0, 0, .04, 6).rotation.x = Math.PI / 2;
   rbox(coat, .36, .8, .12, .06, mat(0x3a2a22, .9), 0, -.42, .09);
   onW('mcW3', -5.85, 1.75, coat, 0);
   const w = .8, h = 1.26, fr = paneFrame(w, h, 1, 2, MAT.pine, { depth: .1, bar: .04, sash: .06 });
   const view = windowView(w, h); view.position.z = -.08; fr.add(view);
   onW('mcE1', -5.15, .72 + h / 2, fr, 'center');}

  /* ---------- the balcony ---------- */
  {const g = new THREE.Group(), iron = MAT.iron;
   const lawn = (x, z, ry) => {
     const c = new THREE.Group(), al = MAT.steel, web = mat(0x2f7a5a, .8);
     for (const s of [-1, 1]) { tube(c, V(s * .24, .02, .26), V(s * .24, .9, -.22), .012, al); tube(c, V(s * .24, .02, -.26), V(s * .24, .45, .22), .012, al); }
     box(c, .46, .02, .42, web, 0, .45, 0); const b = box(c, .46, .44, .02, web, 0, .68, -.14); b.rotation.x = -.25;
     c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
   };
   lawn(7.4, -5.2, .5); lawn(8.6, -5.3, -.4);
   const t = new THREE.Group(); cyl(t, .26, .26, .03, mat(0x3a3a3c, .5, .3), 0, .56, 0, 18); cyl(t, .025, .025, .5, iron, 0, .3, 0, 8); cyl(t, .18, .2, .03, iron, 0, .03, 0, 12);
   for (let i = 0; i < 3; i++) cyl(t, .025, .025, .08 + i * .03, mat(0xf2e8d0, .6), -.08 + i * .08, .6 + i * .015, .04, 10);
   t.position.set(8.0, 0, -5.45); g.add(t);
   for (const [x, z] of [[6.9, -5.9], [9.28, -5.9], [9.3, -4.2]]) { const p = plant(x < 7 ? 'palm' : 'fern', mat(0x6a6a6a, .8)); p.position.set(x, 0, z); g.add(p); }
   /* the fire escape ladder up the corridor's outside wall */
   for (const dz of [-.22, .22]) box(g, .04, 2.56, .04, iron, 6.7, 1.28, -5.95 + dz);
   for (let y = .3; y < 2.6; y += .3) box(g, .03, .03, .44, iron, 6.7, y, -5.95);
   g.position.y = .1; S().add(g);
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, 3.1, 1.2, 2.3, 8.05, .7, -5.0);
   hotspot(hit, { title: 'The balcony', text: 'Out through the big window: a brick parapet, lawn chairs, candles, and the ladder of the fire escape.' });}

  /* ---------- the front door: the yellow frame round the peephole ---------- */
  {const d = doors.m20, L = d.leaf, yel = mat(0xe2b33a, .35, .25), fr = new THREE.Group();
   const fw = .3, fh = .24, b = .045;
   for (const [x, y, w, h] of [[0, fh / 2, fw, b], [0, -fh / 2, fw, b], [-fw / 2, 0, b, fh + b], [fw / 2, 0, b, fh + b]]) box(fr, w, h, .025, yel, x, y, 0);
   for (const [x, y, w, h] of [[0, fh / 2 - b * .8, fw - b * 2, .012], [0, -fh / 2 + b * .8, fw - b * 2, .012], [-fw / 2 + b * .8, 0, .012, fh - b * 2], [fw / 2 - b * .8, 0, .012, fh - b * 2]]) box(fr, w, h, .03, mat(0xc8962a, .4, .3), x, y, 0);
   const si = Math.sign(d.in);
   fr.position.set(d.w / 2, 1.52, d.in + si * .012); L.add(fr);
   cyl(L, .045, .045, .03, MAT.brass, d.w / 2, 1.2, d.in + si * .015, 18).rotation.x = Math.PI / 2;
   for (const y of [1.3, 1.4]) box(L, .08, .03, .02, MAT.brass, d.w - .1, y, d.in + si * .01);
   tube(L, V(d.w - .06, 1.44, d.in + si * .02), V(d.w - .3, 1.36, d.in + si * .02), .005, MAT.chrome);
   hitBox(L, d.w, 2.05, .12, d.w / 2, 1.03, 0);
   hotspot(d.pivot, { title: 'Apartment 20', text: 'Number 5 for a while, until someone noticed it was too low for a top floor. The yellow frame round the peephole began as a picture frame with broken glass.',
     action: () => { d.isOpen ? d.close() : d.open(.7); } });}

  app.onUpdate(tickAnims);
}
