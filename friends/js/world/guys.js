import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, rbox, cyl, sph, tube, put, mat, seeded, keep } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { doors } from './plan.js';
import { onW, play } from './monica.js';
import { windowView } from './outside.js';
import { sofa, recliner, barStool, shelfUnit, pantry, books, plant, floorLamp, litLamp, framed, paneFrame, drapes, blinds, rugMesh, faceTo } from '../lib/props.js';
import { makeFridge } from './appliances.js';
import { hotspot, hitBox } from '../ctrl/hotspots.js';
import { sconce } from './hallway.js';

/* Joey and Chandler's apartment, 19: the kitchen by the door, the foosball table, the recliners
   facing the entertainment unit, the yellow sofa under the windows, and the big white dog. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const S = () => app.static;

export function buildGuys() {
  const khaki = MAT.khaki, khakiD = MAT.khakiD, topW = MAT.counterW, rnd = seeded(401);
  const wallZ = -1.82, cd = .62, ct = .9;

  /* ---------- the kitchen counter along the back ---------- */
  {const g = new THREE.Group();
   const base = (x0, x1) => {
     box(g, x1 - x0, .82, cd - .04, khaki, (x0 + x1) / 2, .45, wallZ + cd / 2 - .02);
     box(g, x1 - x0, .08, cd - .1, MAT.black, (x0 + x1) / 2, .04, wallZ + cd / 2 - .06);
     const n = Math.max(1, Math.round((x1 - x0) / .45));
     for (let i = 0; i < n; i++) {
       const x = x0 + (x1 - x0) / n * (i + .5);
       box(g, (x1 - x0) / n - .05, .6, .02, khakiD, x, .48, wallZ + cd - .03);
       box(g, (x1 - x0) / n - .15, .46, .012, khaki, x, .48, wallZ + cd - .015);
       cyl(g, .012, .012, .04, MAT.chrome, x, .72, wallZ + cd, 8).rotation.x = Math.PI / 2;
     }
     box(g, x1 - x0 + .02, .045, cd + .02, topW, (x0 + x1) / 2, ct - .02, wallZ + cd / 2);
   };
   base(-4.32, -3.52);
   base(-2.5, -1.97);
   /* the white double-oven range */
   {const r = new THREE.Group(), en = mat(0xf4f2ec, .3), cr = MAT.chrome; r.position.set(-3.01, 0, wallZ + .33);
    box(r, 1.0, .88, .64, en, 0, .46, 0);
    box(r, 1.02, .03, .66, mat(0x2a2a2c, .5), 0, .905, 0);
    for (const x of [-.24, .24]) { box(r, .44, .4, .02, mat(0x2c2c2e, .2, .2), x, .45, .325); box(r, .4, .025, .03, cr, x, .7, .34); }
    for (const [x, z] of [[-.3, -.15], [-.3, .15], [.3, -.15], [.3, .15]]) cyl(r, .08, .08, .015, MAT.iron, x, .925, z, 14);
    box(r, .26, .02, .3, MAT.iron, 0, .925, 0);
    box(r, 1.0, .5, .1, en, 0, 1.15, -.28); box(r, .9, .08, .02, cr, 0, 1.36, -.225);
    for (let i = 0; i < 6; i++) cyl(r, .022, .022, .03, MAT.black, -.4 + i * .16, .82, .33, 10).rotation.x = Math.PI / 2;
    box(r, .3, .14, .02, mat(0x2a2a2c, .3), 0, 1.14, -.225);
    const kt = sph(r, .1, MAT.chrome, .3, 1.02, .15, 14, 10); kt.scale.y = .78; tube(r, V(.3, 1.08, .15), V(.3, 1.14, .15), .01, MAT.black);
    g.add(r);}
   /* two microwaves, a pizza box, a toaster */
   const micro = (x, z, ry, s = 1) => { const m = new THREE.Group(); rbox(m, .5 * s, .3 * s, .36 * s, .015, MAT.white, 0, .15 * s, 0); box(m, .3 * s, .22 * s, .02, mat(0x2c2c2e, .3), -.06 * s, .15 * s, .185 * s); box(m, .1 * s, .22 * s, .02, mat(0xe0ded8, .5), .17 * s, .15 * s, .185 * s); m.position.set(x, ct, z); m.rotation.y = ry; g.add(m); };
   micro(-2.23, wallZ + .26, 0);
   micro(-4.01, .02, Math.PI / 2, .9);
   const pz = new THREE.Group(); box(pz, .4, .05, .4, mat(0xd8c8a8, .9), 0, .025, 0); box(pz, .4, .01, .4, mat(0xc8342a, .6), 0, .052, 0); pz.position.set(-3.95, ct, -.7); pz.rotation.y = .3; g.add(pz);
   rbox(g, .26, .18, .16, .03, MAT.chrome, -3.9, ct + .09, wallZ + .22);
   S().add(g);}

  /* ---------- the peninsula and its stools ---------- */
  {const g = new THREE.Group(), x0 = -4.32, x1 = -3.7, z0 = wallZ + cd, z1 = -.25, xc = (x0 + x1) / 2, L = z1 - z0;
   box(g, x1 - x0 - .04, .82, L, khaki, xc, .45, (z0 + z1) / 2);
   for (let i = 0; i < 2; i++) { box(g, .02, .6, L / 2 - .06, khakiD, x1 - .01, .48, z0 + L / 4 + i * L / 2); cyl(g, .012, .012, .04, MAT.chrome, x1 + .01, .72, z0 + L / 4 + i * L / 2 + .1, 8).rotation.z = Math.PI / 2; }
   box(g, .04, .8, L, khakiD, x0 + .02, .45, (z0 + z1) / 2);
   box(g, x1 - x0 + .26, .05, L + .1, topW, xc - .1, ct - .02, (z0 + z1) / 2 + .03);
   S().add(g);
   const seat = mat(0x1f5e5a, .7), legs = mat(0x8a2a22, .55);
   for (const z of [-1.0, -.55]) put(barStool(seat, legs), V(-4.68, 0, z), Math.PI / 2);}

  /* ---------- uppers, the open shelf, the dartboard ---------- */
  {const up = new THREE.Group();
   box(up, 1.5, .8, .34, khaki, 0, 0, 0);
   for (let i = 0; i < 3; i++) { box(up, .46, .72, .02, khakiD, -.5 + i * .5, 0, .175); box(up, .36, .6, .012, khaki, -.5 + i * .5, 0, .186); cyl(up, .012, .012, .04, MAT.chrome, -.32 + i * .5, -.22, .19, 8).rotation.x = Math.PI / 2; }
   onW('gN1', -3.55, 1.88, up, .17);
   const sh = shelfUnit(.62, .8, .3, khaki, 2, (g, y) => pantry(g, -.28, .28, y, 0));
   onW('gN1', -2.49, 1.48, sh, .15);
   const top = new THREE.Group(); box(top, .78, .4, .36, khaki, 0, 0, 0); box(top, .7, .32, .02, khakiD, 0, 0, .185);
   onW('gN1', -1.58, 2.2, top, .18);
   const db = new THREE.Group();
   cyl(db, .23, .23, .04, mat(0x1c1c1c, .7), 0, 0, 0, 32).rotation.x = Math.PI / 2;
   const face = new THREE.Mesh(new THREE.CircleGeometry(.21, 40), new THREE.MeshStandardMaterial({ map: TX.dartboardTex(), roughness: .85 })); face.position.z = .022; db.add(face);
   const dart = new THREE.Group(); tube(dart, V(0, 0, 0), V(0, 0, .12), .006, MAT.chrome); box(dart, .04, .002, .05, mat(0xd8453b, .6), 0, 0, .11); box(dart, .002, .04, .05, mat(0xd8453b, .6), 0, 0, .11);
   dart.position.set(.05, .06, .02); db.add(keep(dart));
   onW('gN2', -4.85, 1.72, db, .02);
   hotspot(db, { title: 'The dartboard', text: 'Darts, and on bad days hammer darts. Click to throw.',
     action: () => { const x = (rnd() - .5) * .28, y = (rnd() - .5) * .28; play(.45, t => { dart.position.set(x, y + (1 - t) * .25, .02 + (1 - t) * 2.2); }); app.emit('dart'); } });}

  /* ---------- the fridge by the door ---------- */
  makeFridge('guys', { at: V(-1.58, 0, wallZ + .34), rotY: 0, w: .74, h: 1.78, d: .66, rounded: false, body: mat(0xf1efe9, .4),
    title: 'The fridge', text: open => open ? 'Beer, a jar of something, and whatever Joey hasn’t eaten. Click to close it.' : 'Mostly beer. Click to open it.' });

  /* ---------- the front door: the Magna Doodle ---------- */
  {const d = doors.g19, L = d.leaf, si = Math.sign(d.in);
   const board = new THREE.Group();
   rbox(board, .34, .28, .02, .01, mat(0x2a5ab8, .5), 0, 0, 0);
   const scr = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 }));
   scr.position.z = .012; board.add(scr); box(board, .08, .02, .025, mat(0xd8453b, .5), .12, -.13, .005);
   board.position.set(d.w / 2, 1.5, d.in + si * .015); board.rotation.y = d.inRot; L.add(board);
   app.doodle = { mesh: scr, board };
   for (const y of [1.3, 1.42]) box(L, .08, .03, .02, MAT.brass, d.w - .1, y, d.in + si * .01);
   tube(L, V(d.w - .06, 1.46, d.in + si * .02), V(d.w - .32, 1.38, d.in + si * .02), .005, MAT.chrome);
   hitBox(L, d.w, 2.05, .12, d.w / 2, 1.03, 0);
   hotspot(d.pivot, { title: 'Apartment 19', text: 'Number 4 in the first episodes. The Magna Doodle on the inside gets a new message all the time. Click it.', action: () => { d.isOpen ? d.close() : d.open(.7); } });
   const ic = new THREE.Group(); box(ic, .14, .22, .04, mat(0xe8e2d0, .5), 0, 0, 0); for (let i = 0; i < 3; i++) box(ic, .09, .008, .01, MAT.black, 0, .05 - i * .02, .025);
   onW('gE', 1.62, 1.45, ic, .02);}

  /* ---------- the wall by the door: masks, the corkboard, the poster ---------- */
  onW('gE', 2.05, 1.45, framed(.58, .4, TX.corkboard(), mat(0x6b4a2a, .6)));
  onW('gE', 2.7, 1.55, framed(.42, .6, TX.mysteresPoster(), MAT.black));
  {const wood = mat(0x4a2e1c, .6);
   for (const [z, s] of [[1.82, 1], [2.3, .85]]) {
     const m = new THREE.Group();
     const f = sph(m, .12 * s, wood, 0, 0, 0, 12, 10); f.scale.set(.7, 1.3, .4);
     for (const dx of [-.04, .04]) box(m, .03 * s, .015 * s, .02, MAT.black, dx * s, .05 * s, .05 * s);
     box(m, .05 * s, .02 * s, .02, MAT.black, 0, -.07 * s, .05 * s);
     onW('gE', z, 2.18, m, .05);
   }}

  /* ---------- the foosball table ---------- */
  {const g = keep(new THREE.Group()), body = mat(0x1d1b1a, .45, .2), red = mat(0xc8241e, .5), yel = mat(0xf0c030, .5);
   for (const s of [-1, 1]) { box(g, 1.36, .24, .06, body, 0, .74, s * .36); box(g, .06, .24, .66, body, s * .65, .74, 0); }
   box(g, 1.3, .04, .72, body, 0, .62, 0);
   const field = new THREE.Mesh(new THREE.PlaneGeometry(1.24, .66), new THREE.MeshStandardMaterial({ map: TX.foosField(), roughness: .6 }));
   field.rotation.x = -Math.PI / 2; field.position.y = .645; g.add(field);
   for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { box(g, .1, .64, .1, MAT.chrome, sx * .6, .32, sz * .32); box(g, .16, .04, .16, MAT.black, sx * .6, .02, sz * .32); }
   for (const s of [-1, 1]) box(g, .04, .1, .3, body, s * .7, .8, 0);
   const rods = [];
   for (let i = 0; i < 8; i++) {
     const x = -.56 + i * .16, team = [0, 1, 0, 1, 1, 0, 1, 0][i], n = [1, 2, 3, 5, 5, 3, 2, 1][i];
     const rod = keep(new THREE.Group()); rod.position.set(x, .79, 0); g.add(rod); rods.push(rod);
     cyl(rod, .009, .009, 1.2, MAT.chrome, 0, 0, 0, 8).rotation.x = Math.PI / 2;
     const hz = team ? .58 : -.58; cyl(rod, .022, .022, .12, MAT.black, 0, 0, hz, 10).rotation.x = Math.PI / 2;
     for (let k = 0; k < n; k++) { const z = n === 1 ? 0 : -.24 + k * .48 / (n - 1); const p = box(rod, .03, .1, .035, team ? yel : red, 0, -.06, z); box(rod, .028, .03, .03, mat(0xe8c8a8, .6), 0, 0, z); p.castShadow = true; }
   }
   const ball = keep(sph(g, .02, MAT.white, 0, .667, 0, 10, 8));
   put(g, V(-2.55, 0, 2.0), 0, app.root);
   app.foosball = { group: g, rods, ball };
   let rally = 0;
   hotspot(g, { title: 'The foosball table', text: 'It replaced the kitchen table when that broke. They eat over the sink now. Click for a rally.',
     action: () => {
       if (rally > app.time) return; rally = app.time + 2.2; app.emit('foos');
       const bx = [], seed = rnd();
       for (let i = 0; i < 8; i++) bx.push([(rnd() - .5) * 1.1, (rnd() - .5) * .55]);
       play(2.1, t => {
         const k = Math.min(6, Math.floor(t * 6)), f = t * 6 - k, a = bx[k], b = bx[k + 1];
         ball.position.set(a[0] + (b[0] - a[0]) * f, .667, a[1] + (b[1] - a[1]) * f);
         rods.forEach((r, i) => { r.rotation.z = Math.sin(t * 40 + i * 1.7 + seed * 9) * 1.2 * (1 - t); r.position.z = Math.sin(t * 13 + i) * .08 * (1 - t); });
         if (t >= 1) { ball.position.set(0, .667, 0); rods.forEach(r => { r.rotation.z = 0; r.position.z = 0; }); }
       });
     } });}

  /* ---------- the living room: recliners, the unit, the dog, the yellow sofa ---------- */
  put(rugMesh(2.1, 2.7, MAT.rugG), V(-5.75, .02, .22), Math.PI / 2);
  app.recliners = {};
  for (const [who, z] of [['chandler', -.52], ['joey', .98]]) {
    const r = recliner(MAT.leather); put(r.group, V(-5.25, 0, z), -Math.PI / 2, app.root); keep(r.group);
    Object.assign(r, { pos: V(-5.25, 0, z), rot: -Math.PI / 2 }); app.recliners[who] = r;
    if (who === 'joey') { r.target = 1; r.set(1); }
    hotspot(r.group, { title: who === 'joey' ? 'Joey’s recliner' : 'Chandler’s recliner', text: 'Twin Barcaloungers, aimed at the TV. Click to recline.',
      action: () => { const rc = app.recliners[who]; rc.target = rc.target > .5 ? 0 : 1; app.emit('recline', who); } });
  }
  app.onUpdate(dt => { for (const r of Object.values(app.recliners)) { const k = r.k + (r.target - r.k) * Math.min(1, dt * 5); if (Math.abs(k - r.k) > 1e-4) r.set(k); } });
  {const g = new THREE.Group();
   cyl(g, .23, .23, .015, MAT.glass, 0, .55, 0, 24); cyl(g, .018, .018, .54, MAT.chrome, 0, .27, 0, 8); cyl(g, .16, .18, .02, MAT.chrome, 0, .01, 0, 16);
   cyl(g, .035, .03, .1, mat(0x3a6a2a, .3), .05, .61, 0, 10);
   put(g, V(-5.25, 0, .23), 0);}

  /* the entertainment unit */
  {const g = new THREE.Group(), w = MAT.woodPale, wd = mat(0xc7a47a, .55);
   box(g, .96, 2.0, .6, w, 0, 1.0, 0);
   box(g, .86, .64, .5, mat(0x121214, .6), 0, 1.16, .06);
   for (const s of [-1, 1]) {
     const x = s * .8;
     box(g, .64, 1.8, .5, w, x, .9, -.05);
     box(g, .56, 1.6, .02, mat(0x241e18, .8), x, .95, -.29);
     for (const y of [.5, .95, 1.4]) box(g, .56, .012, .42, MAT.glass, x, y, -.02);
     books(g, x - .24, x + .1, .52, -.05, .2);
     sph(g, .08, mat(0xc8a040, .4, .5), x + .15, 1.03, -.05, 12, 10);
   }
   box(g, 2.3, .06, .62, wd, 0, 2.03, 0);
   box(g, .86, .3, .5, w, 0, .5, .03); box(g, .4, .08, .3, MAT.black, -.1, .72, .2); box(g, .26, .06, .22, mat(0x3a3a3e, .5), .25, .7, .2);
   /* the Three Stooges on top */
   const stooge = (x, hair) => { const s = new THREE.Group(); box(s, .06, .1, .05, mat(0x2a2a2a, .6), 0, .05, 0); sph(s, .03, mat(0xe8c0a0, .6), 0, .13, 0, 10, 8); hair(s); s.position.set(x, 2.06, .1); g.add(s); };
   stooge(-.12, s => sph(s, .032, mat(0x1a1a1a, .8), 0, .15, -.005, 10, 8));
   stooge(0, s => { sph(s, .02, mat(0x8a6a4a, .8), -.025, .14, 0, 8, 6); sph(s, .02, mat(0x8a6a4a, .8), .025, .14, 0, 8, 6); });
   stooge(.12, s => box(s, .06, .02, .06, mat(0x4a3322, .8), 0, .16, 0));
   put(g, V(-7.8, 0, .22), Math.PI / 2);
   app.tvSpot = { ...app.tvSpot, guys: { pos: V(-7.8 + .316, 1.16, .22), rot: Math.PI / 2 } };
   const hit = new THREE.Group(); app.root.add(hit); hitBox(hit, .7, 2.1, 2.3, -7.8, 1.05, .22);
   hotspot(hit, { title: 'The entertainment unit', text: 'Joey built one big enough to hold a grown man, and traded it for a canoe. This one opens with a remote.' });}
  onW('gW1', -.05, 2.36, framed(.6, .44, TX.comicsPhoto(), MAT.black));
  onW('gW2', .55, 2.36, framed(.4, .3, TX.artTex('photo'), MAT.black));

  /* the big white dog */
  {const g = keep(new THREE.Group()), por = mat(0xf6f5f1, .18);
   const b = sph(g, .2, por, 0, .5, -.05, 16, 12); b.scale.set(.8, 1.1, 1.35); b.rotation.x = -.5;
   const chest = sph(g, .16, por, 0, .66, .12, 14, 10); chest.scale.set(.8, 1.1, .9);
   const neck = cyl(g, .07, .09, .3, por, 0, .88, .16, 12); neck.rotation.x = .35;
   const head = keep(new THREE.Group()); head.position.set(0, 1.06, .23); g.add(head);
   app.dog = { group: g, head };
   sph(head, .09, por, 0, 0, 0, 14, 10).scale.set(.85, .9, 1.1);
   const snout = cyl(head, .03, .055, .2, por, 0, -.03, .13, 12); snout.rotation.x = Math.PI / 2 + .15;
   sph(head, .018, MAT.black, 0, -.05, .23, 8, 6);
   for (const s of [-1, 1]) { const ear = box(head, .03, .09, .06, por, s * .06, .08, -.04); ear.rotation.z = s * .5; }
   for (const s of [-1, 1]) { cyl(g, .028, .024, .5, por, s * .07, .25, .2, 8); const h = sph(g, .1, por, s * .1, .22, -.18, 12, 10); h.scale.set(.6, 1, 1.3); cyl(g, .03, .03, .08, por, s * .1, .04, -.06, 8); }
   const tail = cyl(g, .018, .01, .45, por, 0, .18, -.36, 8); tail.rotation.x = 1.3;
   box(g, .34, .03, .5, mat(0xe8e6e0, .3), 0, .015, 0);
   put(g, V(-7.62, 0, -1.72), faceTo([-7.62, -1.72], [-5, .8]), app.root);
   hotspot(g, { title: 'The white dog', text: 'A big white dog statue from Joey’s time on Days of Our Lives. The burglars left it behind.',
     action: () => play(.9, t => { head.rotation.z = Math.sin(t * Math.PI * 4) * .25 * (1 - t); g.rotation.z = Math.sin(t * Math.PI * 6) * .03 * (1 - t); }) });}

  /* the yellow sofa under the windows */
  {const s = sofa({ w: 2.0, d: .92, cover: MAT.mustard, cushion: mat(0xe0b848, .5), legs: MAT.chrome, seats: 2 });
   put(s, V(-6.6, 0, -2.28), 0);
   app.sofa = { ...app.sofa, guys: { pos: V(-6.6, 0, -2.28), rot: 0 } };}

  /* ---------- the two tall windows: blinds half down, plaid drapes ---------- */
  for (const x of [-7.375, -5.825]) {
    const w = .95, h = 1.9, cy = .55 + h / 2;
    const fr = paneFrame(w, h, 2, 4, MAT.white, { depth: .1, bar: .03, sash: .055 });
    const view = windowView(w, h); view.position.z = -.07; fr.add(view);
    onW('gN2', x, cy, fr, 'center');
    const bl = blinds(w - .04, h, mat(0xefe9da, .8), .55); onW('gN2', x, .55, bl, .03);
    onW('gN2', x, .06, drapes(1.3, 2.52, MAT.drapeG, { valance: .16, swag: false }), .05);
  }
  MAT.gSconce = new THREE.MeshStandardMaterial({ color: 0x9ab8e8, roughness: .3, emissive: 0x4a7ad8, emissiveIntensity: 2, side: THREE.DoubleSide });
  app.glows.push({ mat: MAT.gSconce, day: 1.4, night: 4 });
  onW('gN2', -6.6, 2.12, sconce(MAT.gSconce), 0);
  onW('gW1', -1.2, 2.02, sconce(MAT.gSconce), 0);
  litLamp(floorLamp(0xe8dcc4, 0xffd8a8), app.root, V(-4.85, 0, -2.35), 0, { day: 2.5, night: 5.5, dist: 6, name: 'The floor lamp' });
  {const p = plant('palm'); put(p, V(-7.95, 0, 2.7), 0);}
}
