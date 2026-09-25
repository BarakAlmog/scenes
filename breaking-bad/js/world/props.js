import * as THREE from 'three';
import { M, box, rbox, cyl, sph, tube, mat, keep } from '../lib/util.js';

/* Things that stand about: folding chairs, the generator, a gas can, water jugs, the battery tub, cables,
   Walt's clothes on the mirror, the khaki pants. Each faces +z and stands on y = 0. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function foldingChair(fabric = mat(0x2d5f8a, .85)) {
  const g = new THREE.Group(), alu = mat(0xb9bcbe, .35, .75);
  for (const s of [-1, 1]) {
    tube(g, V(s * .24, 0, .22), V(s * .24, .46, -.18), .012, alu);
    tube(g, V(s * .24, 0, -.22), V(s * .24, .46, .2), .012, alu);
    tube(g, V(s * .24, .46, -.2), V(s * .24, .9, -.3), .012, alu);
    tube(g, V(s * .24, .62, .16), V(s * .24, .62, -.2), .012, alu);
  }
  rbox(g, .46, .03, .38, .01, fabric, 0, .44, 0);
  const back = rbox(g, .46, .4, .03, .01, fabric, 0, .7, -.25); back.rotation.x = -.22;
  g.userData.seatY = .45;
  return g;
}

export function generator() {
  const g = new THREE.Group(), red = mat(0xb8281c, .45, .2), black = mat(0x1d1c1b, .6, .3), steel = mat(0xb4b8bb, .35, .7);
  for (const z of [-.2, .2]) { tube(g, V(-.32, .02, z), V(.32, .02, z), .018, black); for (const x of [-.32, .32]) tube(g, V(x, .02, z), V(x, .5, z), .018, black); tube(g, V(-.32, .5, z), V(.32, .5, z), .018, black); }
  rbox(g, .44, .22, .3, .04, red, .02, .56, 0);
  box(g, .34, .26, .26, black, -.02, .24, 0);
  cyl(g, .07, .07, .12, steel, .25, .24, .06, 12).rotation.z = Math.PI / 2;
  box(g, .1, .08, .02, steel, -.2, .3, .135);
  cyl(g, .04, .04, .03, black, .06, .69, 0, 10);
  return g;
}

export function gasCan() {
  const g = new THREE.Group(), red = mat(0xc0281c, .45);
  rbox(g, .3, .28, .14, .03, red, 0, .14, 0);
  tube(g, V(.1, .28, 0), V(.18, .36, 0), .014, mat(0x1d1c1b, .6));
  box(g, .12, .03, .03, red, -.06, .3, 0);
  return g;
}

export function waterJug(color = 0x3a78b8) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xdce9f0, roughness: .2, transparent: true, opacity: .55, depthWrite: false });
  rbox(g, .26, .36, .26, .05, m, 0, .18, 0);
  cyl(g, .045, .045, .05, mat(color, .5), 0, .38, 0, 12);
  return g;
}

/* the battery: a clear tub with a blue lid, cells inside, red jumper cables */
export function batteryTub() {
  const g = new THREE.Group();
  const clear = new THREE.MeshStandardMaterial({ color: 0xe6eef0, roughness: .25, transparent: true, opacity: .45, depthWrite: false });
  rbox(g, .7, .32, .45, .03, clear, 0, .16, 0);
  const lid = rbox(g, .74, .04, .49, .02, mat(0x2d6ab8, .5), .12, .02, .5); lid.rotation.y = .3; lid.position.set(.55, .02, .1);
  const cells = new THREE.Group(); g.add(cells); g.userData.cells = cells;
  const cellMat = mat(0x6a6a64, .6, .3), sponge = mat(0xd8b84a, .9);
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group(); c.position.set(-.27 + (i % 6) * .108, .06, i < 6 ? -.1 : .1); c.visible = false; cells.add(c);
    box(c, .08, .12, .12, cellMat, 0, .06, 0); box(c, .06, .02, .1, sponge, 0, .13, 0);
    box(c, .012, .03, .012, mat(0xb87333, .4, .7), .03, .15, 0);
  }
  return g;
}

/* a jumper cable from a to b, sagging */
export function cable(a, b, color = 0xb81c16) {
  const mid = a.clone().add(b).multiplyScalar(.5); mid.y = Math.min(a.y, b.y) - .25;
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);
  return M(new THREE.TubeGeometry(curve, 24, .012, 6), mat(color, .5));
}

/* Walt's clothes hung on the side mirror so the smell stays off them */
export function clothesOnMirror() {
  const g = new THREE.Group(), green = mat(0x5c7a3a, .9), khaki = mat(0xb8a47c, .9);
  const shirt = new THREE.Group(); g.add(shirt);
  rbox(shirt, .04, .5, .36, .02, green, .05, -.28, 0);
  for (const s of [-1, 1]) { const sl = rbox(shirt, .035, .36, .09, .02, green, .05, -.3, s * .22); sl.rotation.x = s * .25; }
  const pants = new THREE.Group(); g.add(pants);
  for (const s of [-1, 1]) rbox(pants, .035, .72, .13, .02, khaki, .09, -.5, s * .08);
  rbox(pants, .04, .08, .3, .02, khaki, .09, -.12, 0);
  g.userData.shirt = shirt; g.userData.pants = pants;
  return g;
}

/* the khaki pants of the opening shot: two legs that tumble in the wind */
export function flyingPants() {
  const g = new THREE.Group(), khaki = mat(0xb8a47c, .9);
  const waist = rbox(g, .36, .1, .12, .03, khaki, 0, 0, 0);
  const legs = [];
  for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * .09, -.03, 0); g.add(l); rbox(l, .15, .82, .1, .04, khaki, 0, -.4, 0); legs.push(l); }
  g.userData.legs = legs; waist.castShadow = true;
  return g;
}

/* a steel barrel for the fire and the like */
export function drum(color = 0x3a4a5a) {
  const g = new THREE.Group(), m = mat(color, .6, .4);
  cyl(g, .29, .29, .88, m, 0, .44, 0, 18);
  for (const y of [.3, .6]) cyl(g, .3, .3, .03, m, 0, y, 0, 18);
  return g;
}

export { keep, sph };
