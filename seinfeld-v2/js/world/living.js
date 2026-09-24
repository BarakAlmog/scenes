import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, rbox, cyl, sph, tube, put, mat, seeded, easeOutCubic } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { P } from './apartment.js';
import { makeTVScreen, makePCScreen, tv, tvNext, pcNext, pc } from './screens.js';
import { hotspot, hitBox } from '../ctrl/hotspots.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* small one-shot animations on props */
const anims = [];
const play = (dur, fn) => anims.push({ t: 0, dur, fn });
function tickAnims(dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t = Math.min(1, a.t + dt / a.dur); a.fn(a.t);
    if (a.t >= 1) anims.splice(i, 1);
  }
}

export function buildCouch() {
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, .03, .025, .12, MAT.woodDark, sx * 1.0, .06, sz * .38);
  rbox(g, 1.86, .3, .92, .05, MAT.couch, 0, .32, 0);
  rbox(g, 1.86, .62, .24, .06, MAT.couch, 0, .74, -.36);
  for (const s of [-1, 1]) {
    rbox(g, .26, .62, .95, .08, MAT.couch, s * 1.05, .49, 0);
    rbox(g, .88, .2, .78, .06, MAT.couchD, s * .45, .55, .05);
    const bc = rbox(g, .86, .46, .18, .06, MAT.couchD, s * .45, .85, -.27); bc.rotation.x = -.13;
    const pw = rbox(g, .4, .4, .13, .05, MAT.couch, s * .78, .78, -.2); pw.rotation.set(-.2, 0, s * .35);
  }
  return g;
}

export function buildArmchair() {
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, .03, .025, .12, MAT.woodDark, sx * .42, .06, sz * .36);
  rbox(g, .78, .3, .9, .05, MAT.couch, 0, .32, 0);
  rbox(g, .95, .6, .24, .06, MAT.couch, 0, .73, -.34);
  for (const s of [-1, 1]) rbox(g, .24, .6, .92, .08, MAT.couch, s * .48, .48, 0);
  rbox(g, .72, .2, .74, .06, MAT.couchD, 0, .55, .05);
  const bc = rbox(g, .7, .44, .17, .06, MAT.couchD, 0, .84, -.25); bc.rotation.x = -.13;
  return g;
}

export function buildLiving() {
  /* rug */
  {const r = new THREE.Mesh(new THREE.BoxGeometry(3.0, .024, 2.1), MAT.rug);
   r.position.set(-1.9, .025, .85); r.receiveShadow = true; app.static.add(r);}

  put(buildCouch(), V(-1.95, 0, .55), 0);
  put(buildArmchair(), V(-3.62, 0, .78), 1.12);

  /* side table + lamp + cordless phone */
  {const g = new THREE.Group();
   box(g, .56, .05, .56, MAT.black, 0, .55, 0);
   box(g, .13, .5, .13, MAT.black, 0, .28, 0);
   box(g, .36, .05, .36, MAT.black, 0, .025, 0);
   box(g, .17, .045, .07, MAT.black, .17, .585, .14, .35);
   const lamp = new THREE.Group(); g.add(lamp);
   cyl(lamp, .09, .12, .025, MAT.black, 0, .59, 0);
   cyl(lamp, .014, .014, .42, MAT.black, 0, .8, 0);
   const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd9, roughness: .6, emissive: 0xffe6b0, emissiveIntensity: 2.4, side: THREE.DoubleSide });
   const shade = new THREE.Mesh(new THREE.CylinderGeometry(.105, .16, .27, 20, 1, true), shadeMat);
   shade.position.y = 1.07; shade.castShadow = true; lamp.add(shade);
   const light = new THREE.PointLight(0xffd9a0, 7, 5.5, 2); light.position.set(0, 1.2, 0); lamp.add(light);
   put(g, V(-3.3, 0, -.32), .5);
   app.lamp = { light, shadeMat, on: true };
   hotspot(lamp, { title: 'The lamp', text: () => app.lamp.on ? 'On. Click to switch it off.' : 'Off. Click to switch it on.',
     action: () => { app.lamp.on = !app.lamp.on; app.emit('lamp', app.lamp.on); } });}

  /* tv table + tv, facing the couch */
  {const g = new THREE.Group();
   box(g, 1.3, .05, .5, MAT.woodMid, 0, .5, 0);
   box(g, 1.3, .04, .46, MAT.woodMid, 0, .16, 0);
   for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, .06, .5, .06, MAT.woodDark, sx * .6, .25, sz * .2);
   box(g, .3, .04, .22, MAT.white, .35, .2, 0); box(g, .26, .05, .2, mat(0xb03a2a, .7), .42, .55, .02, .2);
   box(g, .36, .08, .26, MAT.black, -.3, .23, 0);
   const set = new THREE.Group(); g.add(set); set.position.set(-.22, .52, 0);
   box(set, .62, .5, .46, mat(0x2a2a2e, .5), 0, .25, 0);
   box(set, .56, .06, .4, mat(0x2a2a2e, .5), 0, .53, 0);
   const scr = makeTVScreen(.48, .36); scr.position.set(0, .27, -.235); scr.rotation.y = Math.PI; set.add(scr);
   tube(set, V(0, .56, 0), V(-.16, .88, .05), .005, MAT.steel);
   tube(set, V(0, .56, 0), V(.15, .9, -.04), .005, MAT.steel);
   const light = new THREE.PointLight(0x9fc4ff, 4, 5, 2); light.position.set(0, .6, -.5); set.add(light); tv.light = light;
   put(g, V(-1.5, 0, 2.28), 0);
   const names = { ballgame: 'the ball game', news: 'the news', cartoon: 'cartoons', bars: 'colour bars', static: 'static' };
   hotspot(set, { title: 'The TV', text: () => tv.channel.id === 'off' ? 'Off. Click to turn it back on.' : `On ${names[tv.channel.id]}. Click to change the channel.`,
     action: () => tvNext() });}

  /* dining table + chairs */
  const T = V(-.45, 0, -1.45);
  {const g = new THREE.Group();
   cyl(g, .62, .62, .05, MAT.woodMid, 0, .74, 0, 28);
   cyl(g, .56, .56, .04, MAT.woodMid, 0, .69, 0, 28);
   for (let i = 0; i < 4; i++) {
     const a = i * Math.PI / 2 + Math.PI / 4;
     const l = cyl(g, .028, .035, .72, MAT.woodDark, Math.cos(a) * .42, .36, Math.sin(a) * .42);
     l.rotation.z = Math.cos(a) * .1; l.rotation.x = -Math.sin(a) * .1;
   }
   put(g, T, 0);
   const chair = () => {
     const c = new THREE.Group();
     cyl(c, .2, .2, .035, MAT.black, 0, .46, 0, 18);
     for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; cyl(c, .016, .02, .46, MAT.black, Math.cos(a) * .16, .23, Math.sin(a) * .16); }
     const arc = M(new THREE.TorusGeometry(.18, .018, 8, 16, Math.PI), MAT.black); arc.position.set(0, .78, -.17); c.add(arc);
     for (const s of [-1, 1]) cyl(c, .015, .015, .34, MAT.black, s * .17, .62, -.17);
     return c;
   };
   for (const a of [Math.PI, Math.PI / 2, 0, Math.PI * 1.5]) {
     const px = T.x + Math.cos(a) * .82, pz = T.z + Math.sin(a) * .82;
     put(chair(), V(px, 0, pz), Math.atan2(-Math.cos(a), -Math.sin(a)));
   }}

  /* world-domination board, armies, dice, cup */
  {const bgame = new THREE.Group();
   const bd = new THREE.Mesh(new THREE.PlaneGeometry(.62, .44), new THREE.MeshStandardMaterial({ map: TX.riskBoard(), roughness: .85 }));
   bd.rotation.x = -Math.PI / 2; bd.rotation.z = .18; bd.position.y = .004; bd.receiveShadow = true; bgame.add(bd);
   const pcols = [0xc23227, 0x2a4d8f, 0x8a3ac9, 0xe6c33c], armies = [];
   for (let i = 0; i < 16; i++) {
     const a = i * 2.39, r = .06 + ((i * 37) % 19) / 100;
     armies.push(cyl(bgame, .011, .014, .03, mat(pcols[i % 4], .6), Math.cos(a) * r * 2.0, .02, Math.sin(a) * r));
   }
   cyl(bgame, .04, .034, .07, mat(0xc23227, .5), .34, .04, .1);
   box(bgame, .05, .004, .07, MAT.white, .27, .006, -.13, .3);
   box(bgame, .05, .004, .07, MAT.white, .22, .01, -.09, .1);
   const dice = [box(bgame, .022, .022, .022, MAT.white, .4, .015, 0, .4), box(bgame, .022, .022, .022, MAT.white, .44, .015, .05, .1)];
   bgame.position.set(-.45, .768, -1.45); app.root.add(bgame);
   hitBox(bgame, .7, .12, .55, 0, .04, 0);
   hotspot(bgame, { title: 'The Risk board', text: 'Kramer and Newman’s game of Risk, from “The Label Maker” (season 6).',
     action: () => {
       const seedY = armies.map(() => Math.random());
       play(.9, t => {
         armies.forEach((m, i) => { const k = Math.max(0, Math.min(1, t * 1.6 - seedY[i] * .6)); m.position.y = .02 + Math.sin(k * Math.PI) * .05; });
         dice.forEach((d, i) => { d.rotation.set(t * 9 + i, t * 7, t * 5); d.position.y = .015 + Math.sin(t * Math.PI) * .08; });
       });
     } });}

  /* bookshelf */
  {const g = new THREE.Group(), rnd = seeded(7);
   const Wd = 1.3, H = 2.15, D = .4;
   for (const s of [-1, 1]) box(g, .05, H, D, MAT.black, s * (Wd / 2 - .025), H / 2, 0);
   box(g, Wd, .05, D, MAT.black, 0, H - .02, 0);
   [.07, .55, 1.05, 1.52, 1.88].forEach(y => box(g, Wd - .08, .04, D - .04, MAT.black, 0, y, 0));
   box(g, Wd - .12, .34, .34, MAT.woodMid, 0, .76, 0);
   for (const s of [-1, 1]) {
     box(g, (Wd - .16) / 2 - .03, .26, .02, MAT.woodDark, s * (Wd - .12) / 4, .76, .18);
     cyl(g, .012, .012, .03, MAT.black, s * (Wd - .12) / 4, .76, .2).rotation.x = Math.PI / 2;
   }
   const cols = [0xb03a2a, 0x2a4d8f, 0x3a7a3f, 0xc8a23c, 0x6b4a36, 0x46506b, 0x8a3a5a];
   for (const y of [1.05, 1.52]) {
     let x = -Wd / 2 + .12;
     while (x < Wd / 2 - .3) {
       const bw = .035 + rnd() * .05, bh = .24 + rnd() * .12;
       box(g, bw, bh, .26, mat(cols[Math.floor(rnd() * cols.length)], .9), x + bw / 2, y + .02 + bh / 2, 0);
       x += bw + .012; if (rnd() < .2) x += .08;
     }
   }
   for (let i = 0; i < 3; i++) box(g, .3, .05, .22, mat(cols[i * 2], .9), -.3 + i * .05, .59 + i * .05, 0);
   box(g, .34, .1, .3, mat(0xb03a2a, .8), .35, 2.05, 0);
   box(g, .32, .08, .28, mat(0x6b3a8a, .8), .35, 2.14, 0, .1);
   box(g, .3, .09, .26, mat(0x2a4d8f, .8), -.32, 2.045, 0, -.08);
   box(g, .28, .08, .24, mat(0x3a7a3f, .8), -.32, 2.13, 0, .12);
   /* tiny caped-hero figure on the shelf */
   {const blu = mat(0x2a4dc8, .55), red = mat(0xc8241e, .55);
    const d = new THREE.Group();
    box(d, .05, .055, .028, blu, 0, .105, 0);
    box(d, .02, .05, .02, blu, -.014, .045, 0); box(d, .02, .05, .02, blu, .014, .045, 0);
    box(d, .022, .018, .024, red, -.014, .012, .004); box(d, .022, .018, .024, red, .014, .012, .004);
    box(d, .016, .05, .016, blu, -.038, .1, 0);
    const up = box(d, .016, .055, .016, blu, .042, .15, 0); up.rotation.z = -.5;
    sph(d, .018, mat(0xe6b28c, .7), 0, .15, 0, 10, 8);
    box(d, .022, .01, .022, mat(0x1c1410, .8), 0, .163, 0);
    const cape = box(d, .055, .09, .006, red, 0, .09, -.022); cape.rotation.x = .12;
    box(d, .06, .012, .03, red, 0, .137, -.012);
    d.position.set(.05, 1.9, .08); d.rotation.y = -.25; g.add(d);
    hitBox(d, .14, .22, .12, 0, .09, 0);
    hotspot(d, { title: 'The Superman figure', text: 'Jerry is a lifelong Superman fan. The figure lives on his shelf.',
      action: () => play(1.4, t => { const k = easeOutCubic(t); d.position.y = 1.9 + Math.sin(t * Math.PI) * .12; d.rotation.y = -.25 + k * Math.PI * 2; cape.rotation.x = .12 + Math.sin(t * Math.PI) * .9; }) });}
   put(g, V(-1.45, 0, -3.08), 0);}

  /* desk + computer + chair + pez */
  {const g = new THREE.Group();
   box(g, 1.3, .05, .62, MAT.woodDark, 0, .72, 0);
   for (const s of [-1, 1]) {
     const l1 = box(g, .06, .8, .06, MAT.woodDark, s * .52, .37, -.12); l1.rotation.x = .38;
     const l2 = box(g, .06, .8, .06, MAT.woodDark, s * .52, .37, .12); l2.rotation.x = -.38;
     box(g, .07, .04, .5, MAT.woodDark, s * .52, .04, 0);
   }
   box(g, 1.0, .05, .05, MAT.woodDark, 0, .3, 0);
   box(g, .22, .012, .3, MAT.white, .32, .755, .02, .3);
   box(g, .1, .025, .1, MAT.black, .45, .76, -.18);
   const comp = new THREE.Group(); g.add(comp);
   box(comp, .38, .3, .36, MAT.cream, -.18, .9, -.08);
   box(comp, .38, .05, .38, MAT.cream, -.18, .745, -.06);
   box(comp, .34, .025, .14, MAT.cream, -.16, .76, .18);
   const scr = makePCScreen(.28, .21); scr.position.set(-.18, .92, .105); comp.add(scr);
   const PWin = P.Win;
   put(g, PWin.at(3.28, .52), PWin.rotY);
   const texts = ['Notes, typing themselves.', 'Screen saver.', 'Off.'];
   hotspot(comp, { title: 'Jerry’s Mac', text: () => texts[pc.mode] + ' Click to switch.', action: () => pcNext() });
   /* pez dispenser */
   {const pz = new THREE.Group(); pz.position.set(.5, .745, .14); g.add(pz);
    box(pz, .022, .085, .012, mat(0x3a6ec8, .5), 0, .043, 0);
    const head = new THREE.Group(); head.position.set(0, .088, 0); pz.add(head);
    sph(head, .016, mat(0xf2c230, .5), 0, .012, 0, 10, 8);
    box(head, .01, .006, .012, mat(0xe07b2a, .5), 0, .01, .015);
    hitBox(pz, .1, .16, .1, 0, .06, 0);
    hotspot(pz, { title: 'The Pez dispenser', text: 'From “The Pez Dispenser” (season 3).',
      action: () => play(.8, t => { head.rotation.x = -Math.sin(t * Math.PI) * 1.1; }) });}
   const c = new THREE.Group();
   rbox(c, .44, .07, .42, .03, MAT.black, 0, .47, 0);
   const cb = rbox(c, .42, .46, .07, .03, MAT.black, 0, .76, -.22); cb.rotation.x = -.1;
   cyl(c, .025, .025, .3, MAT.steel, 0, .3, 0);
   cyl(c, .27, .3, .04, MAT.black, 0, .05, 0, 18);
   put(c, PWin.at(3.28, 1.18), PWin.rotY + Math.PI + .3);}

  /* radiators */
  const radiator = () => {
    const g = new THREE.Group(), m = mat(0xd3d3cc, .55, .35);
    for (let i = 0; i < 9; i++) box(g, .05, .5, .17, m, -.32 + i * .08, .36, 0);
    box(g, .76, .035, .19, m, 0, .63, 0);
    for (const s of [-1, 1]) { cyl(g, .016, .016, .12, m, s * .34, .06, 0); cyl(g, .014, .014, .3, m, s * .36, .2, .05); }
    return g;
  };
  put(radiator(), P.Win.at(1.32, .3), P.Win.rotY);
  put(radiator(), P.Win.at(2.22, .3), P.Win.rotY);

  /* console table on the west wall */
  {const g = new THREE.Group();
   box(g, 1.45, .05, .36, MAT.woodDark, 0, .84, 0);
   for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, .045, .82, .045, MAT.woodDark, sx * .66, .41, sz * .14);
   box(g, 1.32, .03, .3, MAT.woodDark, 0, .3, 0);
   box(g, .3, .07, .22, MAT.white, -.3, .35, 0, .1);
   box(g, .26, .05, .2, MAT.white, .25, .34, 0, -.15);
   box(g, .2, .06, .16, MAT.black, .4, .9, 0, .2);
   box(g, .18, .025, .05, MAT.black, .4, .94, 0, .2);
   put(g, P.West.at(1.5, .35), P.West.rotY);}

  /* low black magazine shelf on the south-west wall */
  {const g = new THREE.Group();
   box(g, 1.3, .04, .34, MAT.black, 0, .78, 0);
   box(g, 1.3, .04, .34, MAT.black, 0, .34, 0);
   for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, .04, .78, .04, MAT.black, sx * .6, .39, sz * .14);
   box(g, .34, .06, .26, MAT.white, -.25, .4, 0, .12);
   box(g, .3, .05, .24, MAT.white, .2, .395, 0, -.1);
   box(g, .28, .05, .2, MAT.white, .3, .83, 0, .15);
   put(g, P.SW.at(1.45, .34), P.SW.rotY);}

  /* navy ottoman, clear of the door swing and Kramer's line */
  {const v = P.Door.at(.2, .75);
   rbox(app.static, .55, .55, .55, .04, mat(0x2e3f63, .9), v.x, .275, v.z, .35);}

  app.onUpdate(tickAnims);
}

export { play };
