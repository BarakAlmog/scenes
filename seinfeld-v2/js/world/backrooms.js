import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, rbox, cyl, tube, keep, put, mat } from '../lib/util.js';
import { W } from './apartment.js';
import { attach } from './walls.js';
import { hotspot } from '../ctrl/hotspots.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildBackRooms() {
  /* ---------- entry alcove: the bike on its hook ---------- */
  {const bike = keep(new THREE.Group()), F = MAT.green;
   const Pt = (x, y) => V(x, y, 0);
   const bb = Pt(0, 0), seat = Pt(-.15, .34), rA = Pt(-.42, .01), fA = Pt(.42, .01);
   tube(bike, bb, seat, .018, F); tube(bike, seat, Pt(.31, .36), .018, F);
   tube(bike, bb, Pt(.29, .32), .018, F); tube(bike, bb, rA, .014, F); tube(bike, rA, seat, .014, F);
   tube(bike, Pt(.31, .37), fA, .016, F);
   const wheels = [];
   for (const ax of [rA, fA]) {
     const w = new THREE.Group(); w.position.copy(ax); bike.add(w); wheels.push(w);
     w.add(M(new THREE.TorusGeometry(.26, .018, 10, 28), mat(0x2b2b2e, .5)));
     for (let i = 0; i < 6; i++) { const sp = M(new THREE.CylinderGeometry(.003, .003, .5, 6), MAT.steel); sp.rotation.z = i * Math.PI / 6; w.add(sp); }
     const hub = M(new THREE.CylinderGeometry(.02, .02, .05, 10), MAT.steel); hub.rotation.x = Math.PI / 2; w.add(hub);
   }
   box(bike, .13, .03, .05, MAT.black, -.16, .39, 0);
   cyl(bike, .014, .014, .1, MAT.black, .32, .42, 0).rotation.z = .2;
   const hb = M(new THREE.CylinderGeometry(.012, .012, .22, 8), MAT.black); hb.position.set(.33, .45, 0); hb.rotation.x = Math.PI / 2; bike.add(hb);
   const cr = M(new THREE.TorusGeometry(.055, .012, 8, 18), MAT.steel); cr.position.set(0, 0, .03); bike.add(cr);
   cyl(bike, .01, .01, .09, MAT.black, .04, -.06, .05).rotation.z = .5;
   bike.scale.setScalar(.8); bike.position.set(.3, 1.5, -4.38); bike.rotation.z = Math.PI / 2;
   app.root.add(bike);
   box(app.static, .04, .12, .1, MAT.steel, .3, 1.99, -4.45);
   let spin = 0;
   app.onUpdate(dt => { if (spin > .01) { spin *= Math.exp(-dt * .9); for (const w of wheels) w.rotation.z -= spin * dt; } });
   hotspot(bike, { title: 'Jerry’s bike', text: 'Hung on the wall of the entry by its front wheel. Click to spin the wheels.', action: () => { spin = 14; } });}

  /* ---------- back hall ---------- */
  {const cab = new THREE.Group();
   box(cab, 1.05, .95, .34, MAT.woodMid, 0, .5, 0);
   box(cab, 1.13, .05, .4, MAT.woodDark, 0, 1.0, 0);
   for (const s of [-1, 1]) box(cab, .42, .7, .02, MAT.woodDark, s * .25, .5, .18);
   box(cab, .2, .22, .02, mat(0xd9cdb6, .9), -.2, 1.16, -.05, .1);
   cyl(cab, .06, .05, .16, mat(0x3a6a8a, .4), .3, 1.11, 0);
   put(cab, V(-1.85, 0, -4.73), Math.PI);
   const run = new THREE.Mesh(new THREE.BoxGeometry(3.0, .014, .7), MAT.rug); run.position.set(-.95, .02, -5.25); run.receiveShadow = true; app.static.add(run);
   const fr = new THREE.Group(); box(fr, .36, .46, .03, MAT.black, 0, 0, 0); box(fr, .3, .4, .01, mat(0xcfc3a8, .9), 0, 0, .018);
   put(fr, V(-.62, 1.55, -5.755), 0, app.root); attach(W.hallN, fr);}

  /* ---------- bedroom ---------- */
  {const g = new THREE.Group(), bx = -3.52, hz = -7.6;
   const frame = mat(0x4a3526, .6);
   box(g, 1.55, 1.1, .08, frame, bx, .55, hz);
   box(g, 1.5, .3, 2.0, frame, bx, .2, hz + 1.02);
   rbox(g, 1.42, .22, 1.94, .06, MAT.sheet, bx, .44, hz + 1.02);
   rbox(g, 1.46, .1, 1.45, .04, MAT.duvet, bx, .58, hz + 1.28);
   for (const s of [-1, 1]) rbox(g, .58, .14, .36, .06, MAT.sheet, bx + s * .35, .62, hz + .3);
   for (const [z, x] of [[hz + .35, -2.52]]) {
     box(g, .45, .5, .4, MAT.woodMid, x, .25, z); box(g, .47, .03, .42, MAT.woodDark, x, .51, z);
     cyl(g, .07, .09, .03, MAT.black, x, .54, z); cyl(g, .012, .012, .25, MAT.black, x, .67, z);
     const sh = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, .2, 18, 1, true),
       new THREE.MeshStandardMaterial({ color: 0xf4ecd9, roughness: .6, emissive: 0xffe6b0, emissiveIntensity: 5, side: THREE.DoubleSide }));
     sh.position.set(x, .86, z); g.add(sh);
   }
   const rg = new THREE.Mesh(new THREE.BoxGeometry(1.1, .014, 1.6), MAT.rug); rg.position.set(-2.35, .02, -6.6); rg.receiveShadow = true; g.add(rg);
   /* dresser + mirror on the bath partition */
   box(g, .48, .82, 1.0, MAT.woodMid, -.74, .41, -6.8);
   for (let i = 0; i < 3; i++) { box(g, .02, .22, .92, MAT.woodDark, -.99, .15 + i * .26, -6.8); cyl(g, .012, .012, .03, MAT.brass, -1.0, .15 + i * .26, -6.8).rotation.z = Math.PI / 2; }
   box(g, .03, .7, .6, MAT.woodDark, -.52, 1.25, -6.8);
   box(g, .01, .6, .5, mat(0xcad6dd, .05, .9), -.54, 1.25, -6.8);
   /* wardrobe in the front of the room */
   box(g, 1.4, 2.0, .45, MAT.woodMid, -1.7, 1.0, -4.245);
   for (const s of [-1, 1]) { box(g, .66, 1.9, .02, MAT.woodDark, -1.7 + s * .345, 1.0, -4.01); cyl(g, .012, .012, .12, MAT.brass, -1.7 + s * .05, 1.0, -3.99); }
   /* hamper + chair by the window */
   cyl(g, .2, .17, .55, mat(0xb9a57e, .9), -4.2, .275, -4.1);
   app.static.add(g);}
  /* bedroom window with the blinds shut */
  {const g = new THREE.Group(), w = 1.1, h = 1.25;
   box(g, w + .12, .08, .2, MAT.white, 0, h / 2 + .02, 0); box(g, w + .12, .1, .22, MAT.white, 0, -h / 2 - .03, 0);
   for (const s of [-1, 1]) box(g, .07, h + .08, .2, MAT.white, s * (w / 2 + .02), 0, 0);
   const sl = new THREE.MeshStandardMaterial({ color: 0xefe9da, roughness: .8, emissive: 0xfff2d8, emissiveIntensity: .25 });
   for (let i = 0; i < 20; i++) { const s = box(g, w - .04, .06, .012, sl, 0, h / 2 - .05 - i * .06, .06); s.rotation.x = .5; }
   g.position.set(-4.6, 1.575, -6.85); g.rotation.y = Math.PI / 2;
   app.root.add(g); attach(W.bedW, g); app.bedBlinds = sl;}

  /* ---------- bathroom ---------- */
  {const g = new THREE.Group(), por = MAT.porcelain;
   /* tub + curtain */
   rbox(g, 1.42, .55, .74, .05, por, 1.53, .275, -7.28);
   box(g, 1.26, .05, .58, mat(0xdfe6e8, .15), 1.53, .52, -7.28);
   cyl(g, .012, .012, 1.42, MAT.steel, 1.53, 1.95, -6.92).rotation.z = Math.PI / 2;
   const cur = new THREE.MeshStandardMaterial({ color: 0xdfeaf0, roughness: .6, side: THREE.DoubleSide });
   for (let i = 0; i < 7; i++) {
     const p = new THREE.Mesh(new THREE.PlaneGeometry(.11, 1.42), cur);
     p.position.set(.88 + i * .085, 1.23, -6.92); p.rotation.y = Math.PI / 2 + (i % 2 ? .6 : -.6); p.castShadow = true; g.add(p);
   }
   /* toilet against the east wall */
   rbox(g, .22, .38, .5, .04, por, 2.12, .44, -6.35);
   rbox(g, .42, .36, .38, .1, por, 1.86, .2, -6.35);
   rbox(g, .45, .04, .4, .03, por, 1.84, .4, -6.35);
   /* sink + medicine cabinet on the bedroom partition */
   cyl(g, .07, .09, .7, por, -.12, .35, -6.9);
   rbox(g, .42, .1, .52, .04, por, -.1, .74, -6.9);
   cyl(g, .012, .012, .12, MAT.steel, -.26, .84, -6.9);
   box(g, .1, .6, .5, mat(0xe8e6df, .5), -.28, 1.42, -6.9);
   box(g, .01, .52, .42, mat(0xcad6dd, .05, .9), -.225, 1.42, -6.9);
   /* mat + towel */
   box(g, .6, .012, .4, mat(0x7fa3b8, .95), 1.0, .018, -6.55);
   box(g, .5, .5, .03, mat(0xc8452e, .9), 1.6, 1.3, -5.955);
   app.static.add(g);}

  /* ---------- the public corridor: elevator ---------- */
  {const g = new THREE.Group(), st = mat(0x9ea3a8, .35, .8);
   box(g, .06, 2.1, 1.1, mat(0x5a5048, .6), 4.82, 1.05, -4.85);
   for (const s of [-1, 1]) box(g, .02, 2.0, .5, st, 4.79, 1.0, -4.85 + s * .255);
   box(g, .02, .12, .08, MAT.brass, 4.79, 1.1, -4.15);
   box(g, .02, .12, .3, mat(0x1a1a1a, .5), 4.79, 2.2, -4.85);
   put(g, V(0, 0, 0), null, app.root); attach(W.corE, g);}
}
