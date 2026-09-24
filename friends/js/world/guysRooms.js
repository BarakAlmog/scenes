import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { box, rbox, cyl, sph, tube, put, mat } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { onW } from './monica.js';
import { bed, nightstand, dresser } from './monicaRooms.js';
import { windowView } from './outside.js';
import { tableLamp, litLamp, framed, paneFrame, blinds, rugMesh, diningChair } from '../lib/props.js';
import { hotspot, hitBox } from '../ctrl/hotspots.js';

/* Chandler's room, Joey's room, and their bathroom */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const S = () => app.static;

function sideWindow(name, v) {
  const fr = paneFrame(1.2, 1.4, 2, 3, MAT.white, { depth: .1 });
  const view = windowView(1.2, 1.4); view.position.z = -.07; fr.add(view);
  onW(name, v, 1.5, fr, 'center');
  onW(name, v, .8, blinds(1.16, 1.4, mat(0xefe9da, .8), .35), .03);
}

export function buildGuysRooms() {
  /* ---------- Chandler's room ---------- */
  {const quilt = mat(0x5f7fa8, .95);
   const b = bed({ quilt, frame: MAT.woodDark, head: 1.0, foot: .5, posts: false });
   put(b, V(-9.95, 0, -3.25 + 1.08), 0);
   for (const s of [-1, 1]) put(nightstand(MAT.woodDark), V(-9.95 + s * 1.05, 0, -3.0), 0);
   litLamp(tableLamp(0xe6e0d0, 0xffe0b0, MAT.chrome), app.root, V(-8.9, .56, -3.0), 0, { day: .7, night: 2.2, dist: 3.4, name: 'Chandler’s lamp' });
   sideWindow('cbW', -1.7);
   /* a desk with a computer: Chandler does something in statistical analysis and data reconfiguration */
   const d = new THREE.Group();
   box(d, 1.2, .04, .6, MAT.woodMid, 0, .74, 0);
   for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(d, .04, .72, .04, MAT.black, sx * .56, .36, sz * .26);
   box(d, .4, .32, .36, mat(0xe8e2d2, .6), -.15, .92, -.05); box(d, .32, .24, .01, mat(0x2a3a4a, .3), -.15, .93, .135);
   box(d, .42, .03, .15, mat(0xe8e2d2, .6), -.1, .765, .2);
   put(d, V(-9.3, 0, -.25), Math.PI);
   put(diningChair('plain', MAT.black), V(-9.3, 0, -.9), 0);
   put(rugMesh(1.6, 1.2, mat(0x8a93a0, .95)), V(-10.2, .02, -1.0), 0);
   onW('cbN', -8.75, 1.5, framed(.34, .44, TX.artTex('sketch')));
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, 1.7, 1.1, 2.2, -9.95, .55, -2.2);
   hotspot(hit, { title: 'Chandler’s room', text: 'Its door got sawn in half while Joey built the entertainment unit. They stuck it back together.' });}

  /* ---------- Joey's room ---------- */
  {const quilt = mat(0xb8653a, .95);
   const b = bed({ w: 1.7, quilt, frame: mat(0x3a2a1e, .6), head: 1.1, foot: .55, posts: false });
   put(b, V(-10.0, 0, .27 + 1.08), 0);
   put(nightstand(mat(0x3a2a1e, .6)), V(-11.15, 0, .5), 0);
   litLamp(tableLamp(0xd8c8a8, 0xffd0a0, MAT.black), app.root, V(-11.15, .56, .5), 0, { day: .7, night: 2.2, dist: 3.4, name: 'Joey’s lamp' });
   sideWindow('jbW', 1.6);
   onW('gW2', 1.2, 1.55, framed(.42, .62, TX.fightPoster(), MAT.black), .015);
   onW('jbW', .62, 1.55, framed(.34, .5, TX.stoutPoster(), MAT.black), .015);
   put(dresser(1.0, .82, mat(0x5a4230, .6)), V(-9.4, 0, 2.78), Math.PI);
   const ball = sph(S(), .12, mat(0xc8662a, .8), -8.7, .12, 1.0, 14, 10); ball.castShadow = true;
   put(rugMesh(1.4, 1.0, mat(0x6a5a48, .95)), V(-9.2, .02, 1.6), .3);
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, 1.8, 1.1, 2.2, -10, .55, 1.35);
   hotspot(hit, { title: 'Joey’s room', text: 'A big bed. A boxing bill and a stout poster stand in for the Scarface and Guinness posters on his walls.' });}

  /* ---------- their bathroom ---------- */
  {const g = new THREE.Group(), por = MAT.porcelain;
   rbox(g, 1.6, .56, .74, .06, por, -3.2, .28, -4.08);
   box(g, 1.44, .05, .58, mat(0xdfe6e8, .15), -3.2, .54, -4.08);
   cyl(g, .012, .012, 1.4, MAT.chrome, -3.2, 1.95, -3.7, 8).rotation.z = Math.PI / 2;
   const cur = new THREE.MeshStandardMaterial({ color: 0xcfe0e4, roughness: .6, side: THREE.DoubleSide });
   for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(.12, 1.4), cur); p.position.set(-3.95 + i * .1, 1.24, -3.7); p.rotation.y = Math.PI / 2 + (i % 2 ? .6 : -.6); p.castShadow = true; g.add(p); }
   rbox(g, .2, .38, .42, .04, por, -1.28, .62, -3.2);
   rbox(g, .5, .36, .38, .1, por, -1.55, .2, -3.2); rbox(g, .48, .04, .4, .03, por, -1.56, .4, -3.2);
   cyl(g, .07, .09, .72, por, -2.8, .36, -2.18, 12);
   rbox(g, .46, .1, .38, .05, por, -2.8, .76, -2.2);
   box(g, .44, .56, .02, mat(0xcad6dd, .05, .9), -2.8, 1.5, -2.0);
   box(g, .5, .62, .02, mat(0xe8e2d2, .5), -2.8, 1.5, -1.99);
   box(g, .5, .5, .03, mat(0x2a5a8a, .9), -1.3, 1.3, -4.44);
   box(g, .6, .012, .4, mat(0x2f5a8a, .95), -2.3, .018, -3.2);
   S().add(g);}
}
