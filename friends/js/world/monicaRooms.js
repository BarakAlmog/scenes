import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { box, rbox, cyl, sph, tube, put, mat, seeded, easeOutCubic } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { doors } from './plan.js';
import { onW, play } from './monica.js';
import { windowView } from './outside.js';
import { plant, flowers, tableLamp, litLamp, framed, paneFrame, drapes, rugMesh, pillow, books, armchair } from '../lib/props.js';
import { hotspot, hitBox } from '../ctrl/hotspots.js';

/* Monica's bathroom, her bedroom and Rachel's, and the closet behind the green door */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const S = () => app.static;

export function bed({ w = 1.6, l = 2.05, frame = MAT.white, quilt, head = 1.15, foot = .62, posts = true }) {
  const g = new THREE.Group();
  box(g, w + .08, head, .08, frame, 0, head / 2, -l / 2);
  box(g, w + .08, foot, .07, frame, 0, foot / 2, l / 2);
  if (posts) for (const [x, z, h] of [[-1, -1, head + .08], [1, -1, head + .08], [-1, 1, foot + .06], [1, 1, foot + .06]]) {
    cyl(g, .045, .045, h, frame, x * (w / 2 + .04), h / 2, z * l / 2, 10); sph(g, .06, frame, x * (w / 2 + .04), h + .02, z * l / 2, 10, 8);
  }
  for (let i = 0; i < 3; i++) box(g, w - .1, .08, .02, mat(0xe0dccf, .6), 0, head - .25 - i * .25, -l / 2 + .045);
  box(g, w, .22, l - .1, frame, 0, .26, 0);
  rbox(g, w - .06, .2, l - .14, .06, MAT.sheet, 0, .46, 0);
  rbox(g, w + .04, .1, l * .72, .04, quilt, 0, .58, l * .12);
  for (const s of [-1, 1]) rbox(g, w * .42, .16, .4, .07, MAT.sheet, s * w * .23, .63, -l / 2 + .32);
  return g;
}

export function nightstand(top = MAT.white) {
  const g = new THREE.Group();
  box(g, .46, .56, .4, top, 0, .28, 0);
  box(g, .4, .16, .02, mat(0xe6e0d0, .6), 0, .42, .205); cyl(g, .012, .012, .03, MAT.brass, 0, .42, .22, 8).rotation.x = Math.PI / 2;
  return g;
}

export function dresser(w = 1.1, h = .92, body = MAT.woodMid) {
  const g = new THREE.Group();
  box(g, w, h, .5, body, 0, h / 2, 0);
  const rows = 3;
  for (let i = 0; i < rows; i++) for (const s of [-1, 1]) {
    box(g, w / 2 - .06, h / rows - .07, .02, body, s * w / 4, .1 + (i + .5) * (h - .1) / rows, .255);
    cyl(g, .014, .014, .03, MAT.brass, s * w / 4, .1 + (i + .5) * (h - .1) / rows, .27, 8).rotation.x = Math.PI / 2;
  }
  return g;
}

export function buildMonicaRooms() {
  /* ---------- the bathroom: black and white floor, clawfoot tub ---------- */
  {const g = new THREE.Group(), por = MAT.porcelain;
   /* the tub along the west wall */
   rbox(g, .78, .52, 1.62, .18, por, 1.6, .38, -3.55);
   box(g, .64, .05, 1.46, mat(0xdfe6e8, .15), 1.6, .62, -3.55);
   for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sph(g, .05, MAT.brass, 1.6 + x * .3, .06, -3.55 + z * .68, 8, 6);
   cyl(g, .012, .012, 1.0, MAT.chrome, 1.25, 1.1, -4.2, 8);
   tube(g, V(1.25, 1.6, -4.2), V(1.4, 1.62, -4.2), .012, MAT.chrome);
   cyl(g, .07, .05, .03, MAT.chrome, 1.42, 1.6, -4.2, 12);
   const cur = new THREE.MeshStandardMaterial({ color: 0xe8dff4, roughness: .7, side: THREE.DoubleSide });
   for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(.2, 1.5), cur); p.position.set(2.0, 1.25, -4.35 + i * .17); p.rotation.y = i % 2 ? .5 : -.5; p.castShadow = true; g.add(p); }
   cyl(g, .012, .012, 1.7, MAT.chrome, 2.0, 2.0, -3.55, 8).rotation.x = Math.PI / 2;
   /* toilet and sink along the north wall arm */
   rbox(g, .42, .38, .2, .05, por, 3.65, .62, -4.35);
   rbox(g, .38, .38, .5, .12, por, 3.65, .21, -4.12); rbox(g, .4, .04, .48, .04, por, 3.65, .42, -4.12);
   cyl(g, .08, .1, .74, por, 4.3, .37, -4.28, 12);
   rbox(g, .5, .12, .4, .06, por, 4.3, .8, -4.24);
   cyl(g, .012, .012, .12, MAT.chrome, 4.3, .92, -4.4, 8);
   box(g, .5, .6, .02, mat(0xcad6dd, .05, .9), 4.3, 1.55, -4.44);
   box(g, .56, .66, .02, MAT.white, 4.3, 1.55, -4.46);
   box(g, .5, .5, .03, mat(0xd98aa0, .9), 2.9, 1.25, -4.45);
   box(g, .6, .012, .4, mat(0x7fa3b8, .95), 2.9, .018, -3.4);
   S().add(g);}

  /* ---------- Monica's bedroom ---------- */
  {const quilt = new THREE.MeshStandardMaterial({ map: TX.floral('#f5f1e8', '#d98aa0', '#8fb09a', 4), roughness: .95 });
   const b = bed({ quilt, frame: mat(0xf2ede0, .6) });
   put(b, V(11.35, 0, -5.05 + 1.08), 0);
   for (const s of [-1, 1]) put(nightstand(mat(0xf2ede0, .6)), V(11.35 + s * 1.1, 0, -4.8), 0);
   litLamp(tableLamp(0xe8b070, 0xffc07a), app.root, V(10.25, .56, -4.8), 0, { day: .8, night: 2.6, dist: 3.5, name: 'Monica’s bedside lamp' });
   onW('mbdN', 11.35, 1.72, framed(1.35, .56, TX.triptych(), MAT.woodDark));
   put(rugMesh(2.2, 1.5, MAT.rugM), V(11.35, .02, -2.4), 0);
   put(dresser(1.1, .92, mat(0xc9a36e, .55)), V(12.68, 0, -1.55), -Math.PI / 2);
   const box1 = new THREE.Group(); box(box1, 1.2, .45, .45, MAT.woodDark, 0, .225, 0); put(box1, V(11.35, 0, -2.6), 0);
   onW('mbdE', -3.1, .8 + .7, paneFrame(1.2, 1.4, 2, 2, MAT.white, { depth: .1 }), 'center');
   const view = windowView(1.2, 1.4); onW('mbdE', -3.1, .8 + .7, view, -.12);
   onW('mbdE', -3.1, .8 - .05, drapes(1.7, 1.75, new THREE.MeshStandardMaterial({ map: TX.floral('#efe4d4', '#c86a7a', '#8aa878', 2), roughness: .9, side: THREE.DoubleSide }), { valance: .25, swag: false }), .02);
   put(armchair({ cover: mat(0xe8d2c8, .95), wide: .85 }), V(10.25, 0, -1.6), .6);
   onW('mbdS', 12.4, 1.6, framed(.36, .46, TX.artTex('flowers')));
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, 1.7, 1.2, 2.2, 11.35, .6, -3.95);
   hotspot(hit, { title: 'Monica’s bedroom', text: 'Mauve walls, a white wooden bed and a floral quilt. Chandler moves in here in season 6.' });}

  /* ---------- Rachel's bedroom ---------- */
  {const quilt = new THREE.MeshStandardMaterial({ map: TX.floral('#f1e6cf', '#c8886a', '#a8b07a', 4), roughness: .95 });
   const b = bed({ quilt, frame: mat(0x8a6a4a, .6), head: 1.0, posts: false });
   const pc = [0xd8b48a, 0xe6d2b0, 0xc89a78];
   for (let i = 0; i < 3; i++) pillow(b, .5, .44, mat(pc[i], .9), -.5 + i * .5, .78, -.82, -.2);
   put(b, V(11.65, 0, -.83 + 1.08), 0);
   onW('mbdS', 11.65, 1.75, framed(1.1, .8, TX.noirPoster(), mat(0x8a6a4a, .6)), .015);
   for (const s of [-1, 1]) put(nightstand(mat(0x8a6a4a, .6)), V(11.65 + s * 1.05, 0, -.55), 0);
   litLamp(tableLamp(0xd9b88a, 0xffc88a), app.root, V(12.7, .56, -.55), 0, { day: .8, night: 2.4, dist: 3.5, name: 'Rachel’s bedside lamp' });
   {const g = new THREE.Group(); box(g, 1.0, .75, .5, mat(0xefe6d6, .6), 0, .375, 0); box(g, .9, .8, .03, mat(0xcad6dd, .05, .9), 0, 1.3, -.22);
    box(g, .98, .88, .02, mat(0x8a6a4a, .6), 0, 1.3, -.235);
    for (let i = 0; i < 5; i++) cyl(g, .02, .02, .06 + i * .02, mat([0xd8453b, 0xf2c94c, 0x9ab0d8, 0xe8a0b0, 0x2a2a2a][i], .4), -.3 + i * .12, .78, .05, 10);
    put(g, V(9.96, 0, 1.0), Math.PI / 2);}
   {const w = new THREE.Group(); box(w, 1.1, 2.0, .6, mat(0xb98a5a, .6), 0, 1.0, 0); for (const s of [-1, 1]) box(w, .53, 1.9, .02, mat(0xa87a4a, .6), s * .28, 1.0, .31); put(w, V(12.63, 0, 2.55), -Math.PI / 2);}
   onW('rbdE', 1.1, 1.5, paneFrame(1.2, 1.4, 2, 2, MAT.white, { depth: .1 }), 'center');
   const view = windowView(1.2, 1.4); onW('rbdE', 1.1, 1.5, view, -.12);
   onW('rbdE', 1.1, .75, drapes(1.7, 1.75, new THREE.MeshStandardMaterial({ color: 0xe9c9b8, roughness: .9, side: THREE.DoubleSide }), { valance: .2, swag: false }), .02);
   put(rugMesh(1.8, 1.3, MAT.rugM), V(11.3, .02, 2.2), .2);
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, 1.6, 1.1, 2.1, 11.65, .55, .25);
   hotspot(hit, { title: 'Rachel’s room', text: 'Pink walls and the Film Noir poster. Later Phoebe’s, and for a while Joey and Chandler’s.' });}

  /* ---------- the secret closet: open it and the junk comes out ---------- */
  {const d = doors.closet, junk = [], rnd = seeded(303), g = new THREE.Group(); app.root.add(g); g.visible = false;
   const cols = [0xd8453b, 0x2a4d8f, 0xf2c94c, 0x3a9a5a, 0xe8862a, 0x8a3a5a, 0xefe6d6, 0x6b4a36];
   for (let i = 0; i < 26; i++) {
     const k = rnd(), c = mat(cols[i % cols.length], .8);
     const m = k < .45 ? box(g, .18 + rnd() * .25, .12 + rnd() * .22, .16 + rnd() * .2, c, 0, 0, 0)
       : k < .75 ? sph(g, .07 + rnd() * .09, c, 0, 0, 0, 10, 8) : cyl(g, .05 + rnd() * .06, .05 + rnd() * .06, .2 + rnd() * .3, c, 0, 0, 0, 10);
     const home = V(5.35 + rnd() * 1.0, .2 + rnd() * 1.6, -7.05 + rnd() * .7);
     const out = V(5.35 + rnd() * 1.0, .16 + .08, -5.9 + rnd() * 1.9);
     m.position.copy(home); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
     junk.push({ m, home, out, r0: m.rotation.clone(), spin: V(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4), delay: rnd() * .35 });
   }
   for (let i = 0; i < 3; i++) box(g, 1.2, .02, .9, mat(0x9a8a78, .8), 5.85, .6 + i * .55, -6.75);
   let busy = false;
   const spill = () => {
     if (busy) return; busy = true;
     d.open(1); app.emit('closet'); g.visible = true;
     play(1.3, t => junk.forEach(j => {
       const k = easeOutCubic(Math.min(1, Math.max(0, (t - j.delay) / (1 - j.delay))));
       j.m.position.lerpVectors(j.home, j.out, k); j.m.position.y += Math.sin(k * Math.PI) * .5;
       j.m.rotation.set(j.r0.x + j.spin.x * k, j.r0.y + j.spin.y * k, j.r0.z + j.spin.z * k);
     }));
     setTimeout(() => play(1.1, t => {
       junk.forEach(j => { j.m.position.lerpVectors(j.out, j.home, easeOutCubic(t)); });
       if (t >= 1) { d.close(); busy = false; setTimeout(() => { if (!busy) g.visible = false; }, 900); }
     }), 4200);
   };
   hotspot(d.pivot, { title: 'The secret closet', text: 'Behind the green door: the one messy place in Monica’s apartment, found out in season 8.', action: spill });
   hitBox(d.leaf, d.w, 2.0, .12, d.w / 2, 1.0, 0);}
}
