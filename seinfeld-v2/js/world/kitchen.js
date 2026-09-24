import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, rbox, cyl, sph, keep, put, mat, easeInOut } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { P, W } from './apartment.js';
import { attach } from './walls.js';
import { hotspot } from '../ctrl/hotspots.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* a box with a printed front face */
function labelBox(p, w, h, d, face, side, x, y, z, ry = 0) {
  const o = M(new THREE.BoxGeometry(w, h, d), [side, side, side, side, face, side]);
  o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o;
}

const CEREAL = [
  ['HONEY PUFFS', '#e8a93a', '#b8312b'], ['BRAN BITS', '#8a5a3b', '#e9d9b8'], ['OAT RINGS', '#d8453b', '#f2d24a'],
  ['CORN CRUNCH', '#2f6fc4', '#f2c94c'], ['RICE POPS', '#3a9a5a', '#f4f0e6'],
];
const cerealMats = CEREAL.map(([n, bg, fg]) => ({
  face: () => new THREE.MeshStandardMaterial({ map: TX.cerealLabel(n, bg, fg), roughness: .7 }),
  side: () => mat(new THREE.Color(bg).getHex(), .75),
}));

export function buildKitchen() {
  const counterTop = mat(0xc6c3ba, .6), cabLow = mat(0xa7a9ab, .8), cabNavy = MAT.navy;
  const PKit = P.Kit, PEast = P.East;

  /* ---------- fridge: the right-hand door opens ---------- */
  {const g = keep(new THREE.Group()), white = mat(0xf0efeb, .45), liner = mat(0xeef1f2, .5);
   box(g, .92, 1.75, .03, white, 0, .875, -.355);
   for (const s of [-1, 1]) box(g, .03, 1.75, .68, white, s * .445, .875, -.03);
   box(g, .92, .04, .68, white, 0, 1.73, -.03); box(g, .92, .08, .68, white, 0, .04, -.03);
   box(g, .03, 1.67, .68, white, -.01, .88, -.03);
   box(g, .42, 1.6, .02, liner, .22, .88, -.33);
   for (const y of [.52, .92, 1.3]) box(g, .42, .012, .6, mat(0xdfe8ea, .2), .22, y, -.03);
   /* what's inside */
   box(g, .08, .2, .08, MAT.white, .08, .62, .02); box(g, .08, .03, .08, mat(0x2a5aa8, .5), .08, .735, .02);
   box(g, .07, .18, .07, mat(0xe8862a, .6), .2, .61, -.08);
   for (const [x, c] of [[.32, 0x2a5a2a], [.38, 0x6b3a1e]]) { cyl(g, .03, .03, .2, mat(c, .3), x, 1.02, -.1); cyl(g, .012, .012, .06, mat(c, .3), x, 1.15, -.1); }
   box(g, .16, .07, .12, mat(0xf4f4f0, .4), .12, .96, .05);
   for (let i = 0; i < 3; i++) sph(g, .04, mat(0xc23227, .45), .1 + i * .08, 1.35, .05, 10, 8);
   box(g, .2, .1, .14, mat(0xe9c7a0, .7), .26, 1.36, -.12);
   const inner = new THREE.PointLight(0xfff4dc, 0, 1.8, 2); inner.position.set(.22, 1.5, .15); g.add(inner);
   /* freezer door (fixed) with the dispenser */
   const left = new THREE.Group(); g.add(left);
   box(left, .44, 1.73, .06, white, -.235, .875, .34);
   box(left, .2, .3, .02, mat(0x3c3c40, .6), -.24, 1.25, .375);
   box(left, .16, .06, .04, mat(0x55555a, .6), -.24, 1.13, .385);
   box(left, .025, .5, .03, mat(0xdeddd8, .5), -.07, 1.15, .385);
   /* fridge door on its hinge */
   const pivot = new THREE.Group(); pivot.position.set(.46, 0, .31); g.add(pivot);
   box(pivot, .45, 1.73, .06, white, -.225, .875, .03);
   box(pivot, .025, .5, .03, mat(0xdeddd8, .5), -.39, 1.15, .075);
   for (const y of [.55, .95, 1.35]) box(pivot, .36, .012, .08, liner, -.23, y, -.03);
   box(pivot, .06, .14, .06, mat(0xf2d24a, .5), -.12, .62, -.03); box(pivot, .06, .12, .06, mat(0xc8452e, .5), -.3, 1.0, -.03);
   const mags = [0xc8452e, 0x2a4d8f, 0xe0b53c, 0x3a7a3f, 0xc8452e, 0x8a3a5a, 0xf0f0ec];
   mags.forEach((c, i) => {
     const x = -.32 + (i % 3) * .22 + (i * 7 % 5) * .02, y = .55 + Math.floor(i / 3) * .32, rz = (i % 2 ? .2 : -.15);
     if (x < -.02) box(left, .055, .07, .012, mat(c, .8), x, y, .378, rz);
     else box(pivot, .055, .07, .012, mat(c, .8), x - .46, y, .068, rz);
   });
   box(pivot, .09, .11, .012, MAT.white, .26 - .46, 1.3, .068, .1);
   put(g, PKit.at(.78, .49), PKit.rotY, app.root);
   let t = 1, from = 0, to = 0;
   app.fridge = {
     isOpen: false, group: g,
     front: PKit.at(.78, 1.25), n: PKit.n,
     open() { if (this.isOpen) return; this.isOpen = true; from = pivot.rotation.y; to = 1.9; t = 0; app.emit('fridge', true); },
     close() { if (!this.isOpen) return; this.isOpen = false; from = pivot.rotation.y; to = 0; t = 0; app.emit('fridge', false); },
     toggle() { this.isOpen ? this.close() : this.open(); },
   };
   app.onUpdate(dt => {
     if (t < 1) { t = Math.min(1, t + dt / .55); pivot.rotation.y = from + (to - from) * easeInOut(t); }
     inner.intensity = 1.4 * Math.min(1, pivot.rotation.y / .6);
   });
   hotspot(g, { title: 'The fridge', text: () => app.fridge.isOpen ? 'Kramer helps himself to it all the time. Click to close it.' : 'Kramer helps himself to it all the time. Click to open it.',
     action: () => app.fridge.toggle() });

   /* open cereal cabinet above */
   const c = new THREE.Group();
   box(c, 1.0, .04, .5, cabNavy, 0, 0, 0); box(c, 1.0, .04, .5, cabNavy, 0, .6, 0);
   for (const s of [-1, 1]) box(c, .04, .6, .5, cabNavy, s * .48, .3, 0);
   box(c, 1.0, .6, .03, mat(0x2e3850, .9), 0, .3, -.23);
   const sizes = [[.16, .34], [.14, .3], [.15, .36], [.13, .28], [.12, .26]];
   let sx = -.38;
   sizes.forEach(([w, h], i) => {
     const cm = cerealMats[i];
     labelBox(c, w, h, .07, cm.face(), cm.side(), sx + w / 2, .04 + h / 2, -.1 + (i % 2) * .12, (i % 2 ? .12 : -.1));
     sx += w + .045;
   });
   put(c, PKit.at(.78, .31, 1.95), PKit.rotY, app.root); attach(W.kit, c);
   hotspot(c, { title: 'The cereal shelf', text: 'Jerry keeps his cereal boxes on display in the kitchen.' });}

  /* trash can */
  {const v = PKit.at(.18, .42);
   cyl(app.static, .2, .16, .58, mat(0x2b2b2e, .6), v.x, .29, v.z);
   cyl(app.static, .21, .21, .04, mat(0x3a3a3e, .5), v.x, .59, v.z);}

  /* back counters + uppers */
  const counterRun = (Pw, t0, t1, off) => {
    const len = t1 - t0, mid = (t0 + t1) / 2, g = new THREE.Group();
    box(g, len, .86, .6, cabLow, 0, .43, 0);
    box(g, len + .04, .05, .66, counterTop, 0, .885, .02);
    const n = Math.max(1, Math.round(len / .55));
    for (let i = 0; i < n; i++) box(g, len / n - .05, .62, .02, mat(0x9b9da0, .8), -len / 2 + len / n * (i + .5), .45, .31);
    put(g, Pw.at(mid, off + .3, 0), Pw.rotY);
  };
  counterRun(PKit, 1.38, 2.85, .11);
  counterRun(PEast, .12, 2.7, .15);

  const upperRun = (rec, Pw, t0, t1, off, openIdx = -1) => {
    const len = t1 - t0, mid = (t0 + t1) / 2, g = new THREE.Group();
    box(g, len, .78, .34, cabNavy, 0, 0, 0);
    const n = Math.max(1, Math.round(len / .5));
    for (let i = 0; i < n; i++) {
      const px = -len / 2 + len / n * (i + .5);
      if (i === openIdx) {
        box(g, len / n - .06, .66, .02, mat(0x2e3850, .95), px, 0, -.05);
        box(g, len / n - .08, .03, .26, cabNavy, px, -.05, 0);
        const cm = [cerealMats[2], cerealMats[0], cerealMats[4]];
        labelBox(g, .12, .26, .06, cm[0].face(), cm[0].side(), px - .08, -.22 + .13, .08, .1);
        labelBox(g, .11, .22, .06, cm[1].face(), cm[1].side(), px + .07, -.24 + .13, .06, -.12);
      } else {
        box(g, len / n - .07, .68, .02, mat(0x76839d, .5), px, 0, .18);
        box(g, len / n - .11, .02, .012, MAT.white, px, 0, .192);
        box(g, .02, .62, .012, MAT.white, px, 0, .192);
        cyl(g, .012, .012, .03, MAT.steel, px + len / n / 2 - .07, -.05, .19);
      }
    }
    put(g, Pw.at(mid, off + .17, 1.92), Pw.rotY, app.root); attach(rec, g);
  };
  upperRun(W.kit, PKit, 1.45, 2.85, .11, 1);
  upperRun(W.east, PEast, .12, 1.9, .15);

  /* microwave, toaster, coffee maker */
  {const g = new THREE.Group();
   rbox(g, .5, .3, .36, .015, MAT.white, 0, .15, 0);
   box(g, .3, .22, .02, mat(0x3c3c40, .5), -.06, .15, .185);
   box(g, .1, .22, .02, mat(0xe6e4de, .6), .17, .15, .185);
   put(g, PKit.at(1.85, .46, .91), PKit.rotY);}
  {const g = new THREE.Group();
   rbox(g, .26, .17, .15, .03, MAT.white, 0, .085, 0);
   box(g, .08, .012, .1, mat(0x3c3c40, .6), -.05, .175, 0);
   box(g, .08, .012, .1, mat(0x3c3c40, .6), .06, .175, 0);
   put(g, PKit.at(2.24, .45, .91), PKit.rotY);}
  {const v = PKit.at(2.58, .45, .91), g = new THREE.Group();
   box(g, .2, .32, .2, MAT.black, 0, .16, 0);
   cyl(g, .07, .06, .12, mat(0x3a2418, .3), 0, .12, .08);
   box(g, .16, .04, .16, MAT.black, 0, .34, 0);
   put(g, v, PKit.rotY);
   app.steamAnchor = v.clone().add(V(0, .42, 0));}
  /* wine rack */
  {const wr = new THREE.Group();
   for (const s of [-1, 1]) { const p = box(wr, .04, .46, .3, MAT.black, s * .15, .2, 0); p.rotation.z = s * .6; }
   box(wr, .36, .04, .3, MAT.black, 0, .02, 0);
   for (const [x, y] of [[0, .14], [-.075, .24], [.075, .24], [0, .33]]) {
     cyl(wr, .045, .045, .3, mat(0x2a4a2a, .4), x, y, 0).rotation.x = Math.PI / 2;
     cyl(wr, .016, .016, .07, mat(0x6b4a36, .6), x, y, .17).rotation.x = Math.PI / 2;
   }
   put(wr, PEast.at(2.35, .45, .91), PEast.rotY);}
  /* sink + faucet */
  {const g = new THREE.Group();
   box(g, .56, .03, .44, MAT.white, 0, .015, 0);
   box(g, .48, .05, .36, mat(0xd8d7d2, .4), 0, .01, 0);
   cyl(g, .02, .02, .24, MAT.steel, 0, .12, -.16);
   cyl(g, .018, .018, .2, MAT.steel, 0, .23, -.07).rotation.x = Math.PI / 2.4;
   box(g, .05, .12, .05, mat(0xe0b53c, .7), .2, .06, -.14);
   put(g, PEast.at(1.05, .42, .91), PEast.rotY);}

  /* ---------- island with cooktop, kettle, cereal, stools ---------- */
  const ISL = V(2.42, 0, .42), ISL_R = -.563;
  {const g = new THREE.Group(), L = 2.55, Wd = .95;
   box(g, L, .86, Wd, cabLow, 0, .43, 0);
   for (let i = 0; i < 4; i++) box(g, L / 4 - .06, .62, .02, mat(0x9b9da0, .8), -L / 2 + L / 4 * (i + .5), .45, Wd / 2 + .005);
   box(g, L + .1, .05, Wd + .18, counterTop, 0, .885, .04);
   const ck = new THREE.Group(); g.add(ck); ck.position.set(.5, .915, -.05);
   box(ck, .78, .015, .62, MAT.white, 0, 0, 0);
   for (const [bx, bz] of [[-.2, -.15], [.2, -.15], [-.2, .18], [.2, .18]]) {
     cyl(ck, .1, .1, .012, mat(0x2b2b2e, .6), bx, .012, bz, 18);
     for (const a of [0, Math.PI / 2]) box(ck, .2, .012, .018, mat(0x3a3a3e, .5), bx, .022, bz, a + Math.PI / 4);
     cyl(ck, .025, .025, .014, MAT.steel, bx, .02, bz);
   }
   for (let i = 0; i < 4; i++) cyl(ck, .022, .025, .03, MAT.white, -.3 + i * .2, .01, .34);
   /* red kettle */
   {const kt = sph(g, .11, mat(0xc23227, .35), .7, 1.01, .13, 16, 12); kt.scale.y = .75;
    const sp = cyl(g, .02, .034, .1, mat(0xc23227, .4), .83, 1.04, .13); sp.rotation.z = -.7;
    const kh = M(new THREE.TorusGeometry(.06, .011, 8, 16, Math.PI), MAT.black); kh.position.set(.7, 1.1, .13); g.add(kh);}
   const kb = box(g, .16, .26, .1, MAT.woodDark, -.45, 1.02, -.3, -.3); kb.rotation.z = -.18;
   for (let i = 0; i < 3; i++) box(g, .018, .1, .012, MAT.black, -.49 + i * .045, 1.18, -.3, -.3);
   cyl(g, .17, .08, .1, mat(0x2b3d8f, .5), -.05, .95, .12, 20);
   [[0xe07b2a, -.1, .02], [0xc83232, .0, .06], [0x7ab33c, .05, -.04], [0xe6c33c, -.03, -.08], [0xe07b2a, .08, .1]]
     .forEach(([c, fx, fz], i) => sph(g, .045, mat(c, .55), -.05 + fx, 1.0 + (i % 2) * .035, .12 + fz, 12, 10));
   box(g, .24, .018, .34, MAT.woodMid, -1.0, .92, .1, .25);
   box(g, .2, .012, .28, mat(0xd9b88a, .8), -1.0, .935, .1, .25);
   /* Jerry's breakfast corner: a cereal box and the milk */
   const cm = cerealMats[0];
   labelBox(g, .16, .3, .06, cm.face(), cm.side(), -.72, 1.06, .3, -.4);
   box(g, .08, .2, .08, MAT.white, -.52, 1.01, .34); box(g, .08, .03, .08, mat(0x2a5aa8, .5), -.52, 1.125, .34);
   put(g, ISL, ISL_R);}

  const stool = (tall = false) => {
    const s = new THREE.Group(), h = tall ? .66 : .6;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(s, .018, .022, h, MAT.royal, sx * .13, h / 2, sz * .13);
    for (const sz of [-1, 1]) box(s, .28, .025, .025, MAT.royal, 0, .2, sz * .13);
    for (const sx of [-1, 1]) box(s, .025, .025, .28, MAT.royal, sx * .13, .26, 0);
    rbox(s, .34, .05, .34, .02, MAT.royal, 0, h + .025, 0);
    return s;
  };
  const isl = new THREE.Object3D(); isl.position.copy(ISL); isl.rotation.y = ISL_R; isl.updateMatrixWorld(true);
  const lp = (x, z, ry, tall) => put(stool(tall), V(x, 0, z).applyMatrix4(isl.matrixWorld), ISL_R + ry);
  lp(.35, .85, 0, false);
  lp(1.0, .9, .3, false);
  lp(-1.55, .15, Math.PI / 2, true);
  app.island = { pos: ISL, rot: ISL_R, local: (x, z) => V(x, 0, z).applyMatrix4(isl.matrixWorld) };
}
