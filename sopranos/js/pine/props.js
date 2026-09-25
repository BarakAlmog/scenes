import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, box, cyl, mat, seeded, canvasTex } from '../lib/util.js';
import { snowy } from '../lib/snowy.js';
import { cadillac, econoline, suburban } from '../world/cars.js';
import { labelTex } from '../lib/textures.js';

/* What stands in the Pine Barrens besides the trees: boulders and fallen logs under snow, the pull-off with its
   two yellow posts, a chain and a sign across the trail, picnic tables by the lake, Paulie's Cadillac, and the
   abandoned plumber's van down in the hollow. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function rockGeo(seed, detail = 2) {
  const r = seeded(seed);
  const g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('uv');
  const p = g.attributes.position, m = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!m.has(k)) m.set(k, .78 + r() * .4);
    const s = m.get(k); p.setXYZ(i, p.getX(i) * s * 1.2, Math.max(-.25, p.getY(i) * s * .72), p.getZ(i) * s);
  }
  const out = mergeVertices(g); out.computeVertexNormals(); return out;
}
function logGeo() {
  const g = new THREE.CylinderGeometry(1, 1.05, 1, 9, 3); g.rotateZ(Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 3.1) * .06);
  g.computeVertexNormals(); return g;
}

export function buildProps({ T, rocks, logs, SPOTS, lines }) {
  const group = new THREE.Group(); group.name = 'props';
  const solids = [];
  /* boulders: three shapes, instanced, snow on their tops */
  const rockMat = snowy(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92 }), { edge: .5, soft: .3, lift: .05 });
  const rg = [rockGeo(11), rockGeo(23), rockGeo(37)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(), p = V(), c = new THREE.Color();
  rg.forEach((geo, k) => {
    const list = rocks.filter((_, i) => i % 3 === k);
    const im = new THREE.InstancedMesh(geo, rockMat, Math.max(1, list.length));
    list.forEach((r, i) => {
      q.setFromEuler(new THREE.Euler(r.k * .3, r.k * 40, r.k * .2)); s.set(r.s * (1 + r.k * .4), r.s * (.6 + r.k * .5), r.s);
      p.set(r.x, r.y - r.s * .12, r.z); m4.compose(p, q, s); im.setMatrixAt(i, m4);
      const g = .34 + r.k * .12; c.setRGB(g, g * .98, g * .95); im.setColorAt(i, c);
      if (r.s > .55) solids.push({ x: r.x, z: r.z, r: r.s * 1.05 });
    });
    im.castShadow = true; im.receiveShadow = true; im.userData.keep = true; group.add(im);
  });
  /* fallen logs: grey trunks half buried, snow along the top */
  const logMat = snowy(new THREE.MeshStandardMaterial({ color: 0x6d6258, roughness: .95 }), { edge: .45, soft: .2, lift: .03 });
  const lg = logGeo(), lim = new THREE.InstancedMesh(lg, logMat, Math.max(1, logs.length));
  logs.forEach((l, i) => {
    const e = new THREE.Euler(0, l.a, 0);
    const x1 = l.x + Math.cos(l.a) * l.l / 2, z1 = l.z - Math.sin(l.a) * l.l / 2, x0 = l.x - Math.cos(l.a) * l.l / 2, z0 = l.z + Math.sin(l.a) * l.l / 2;
    const tilt = Math.atan2(T.heightAt(x1, z1) - T.heightAt(x0, z0), l.l);
    q.setFromEuler(new THREE.Euler(0, l.a, tilt, 'YXZ')); s.set(l.l, l.r, l.r);
    p.set(l.x, l.y + l.r * .35, l.z); m4.compose(p, q, s); lim.setMatrixAt(i, m4);
    for (let k = -2; k <= 2; k++) solids.push({ x: l.x + Math.cos(l.a) * l.l * k / 5, z: l.z - Math.sin(l.a) * l.l * k / 5, r: l.r + .1 });
    void e;
  });
  lim.castShadow = true; lim.receiveShadow = true; lim.userData.keep = true; group.add(lim);

  /* the pull-off: two yellow posts and a chain across the trail, a sign on the chain */
  const post = snowy(new THREE.MeshStandardMaterial({ color: 0xd99a22, roughness: .6 }), { edge: .7, soft: .1 });
  const ch = SPOTS.chain, pa = V(ch.x - 2.1, 0, ch.z + .6), pb = V(ch.x + 2.1, 0, ch.z - .6);
  for (const pt of [pa, pb]) { const o = cyl(group, .09, .1, 1.3, post, pt.x, T.heightAt(pt.x, pt.z) + .5, pt.z, 10); o.castShadow = true; solids.push({ x: pt.x, z: pt.z, r: .15 }); }
  const chainMat = mat(0x5c5f63, .5, .8), links = 18;
  for (let i = 0; i < links; i++) {
    const t = (i + .5) / links, x = pa.x + (pb.x - pa.x) * t, z = pa.z + (pb.z - pa.z) * t;
    const sag = Math.sin(t * Math.PI) * .38, y = T.heightAt(pa.x, pa.z) + 1.05 - sag;
    const l = M(new THREE.TorusGeometry(.06, .012, 5, 8), chainMat); l.position.set(x, y, z); l.rotation.set(i % 2 ? Math.PI / 2 : 0, Math.atan2(pb.x - pa.x, pb.z - pa.z) + Math.PI / 2, 0); group.add(l);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(.46, .3), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .6, map: labelTex([['NO MOTOR', 34, 44], ['VEHICLES', 34, 86]], '#f2efe6', '#b01e18', 256, 150) }));
  sign.position.set(ch.x, T.heightAt(ch.x, ch.z) + .55, ch.z); sign.rotation.set(-.08, Math.atan2(pb.x - pa.x, pb.z - pa.z) + Math.PI / 2, .12); sign.castShadow = true; group.add(sign);

  /* picnic tables by the lake, and two at the pull-off, as in the episode */
  const wood = snowy(new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: .88 }), { edge: .6, soft: .1, lift: .02 });
  const table = (x, z, a) => {
    const g = new THREE.Group(); g.position.set(x, T.heightAt(x, z), z); g.rotation.y = a; group.add(g);
    box(g, 1.85, .05, .78, wood, 0, .76, 0);
    for (const sz of [-.62, .62]) box(g, 1.85, .045, .26, wood, 0, .45, sz);
    for (const sx of [-.7, .7]) for (const sz of [-1, 1]) { const l = box(g, .07, .95, .08, wood, sx, .38, sz * .36); l.rotation.x = sz * .5; }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    solids.push({ x, z, r: 1.1 });
    return g;
  };
  table(SPOTS.chain.x - 6, SPOTS.chain.z + 3, .4); table(SPOTS.chain.x + 7, SPOTS.chain.z + 4, -.3);
  const tables = [[40, 150, .6], [58, 128, .2], [22, 176, 1.1], [80, 110, -.4], [96, 92, .9]];
  for (const [x, z, a] of tables) table(x, z, a);

  /* Paulie's Cadillac, nose to the chain */
  const car = cadillac(0xcbbf9e);
  snowy(car.userData.paint, { amount: .85, edge: .72, soft: .12 });
  car.position.set(SPOTS.car.x, T.heightAt(SPOTS.car.x, SPOTS.car.z), SPOTS.car.z); car.rotation.y = SPOTS.car.yaw + Math.PI / 2;
  car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  car.userData.keep = true; group.add(car);
  /* the van in the hollow: dark, dented, snow heavy on its roof */
  const van = econoline(0x1b2433);
  snowy(van.userData.paint, { amount: 1, edge: .55, soft: .2, lift: .06 });
  const vx = SPOTS.van.x, vz = SPOTS.van.z;
  van.position.set(vx, T.heightAt(vx, vz) - .12, vz); van.rotation.set(0, .7, .03);
  van.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  van.userData.keep = true; group.add(van);
  /* the boxes the car and the van take on the ground, for walking */
  const carBox = (o, L, W) => { const a = o.rotation.y, cx = Math.cos(a), sz = Math.sin(a); for (let k = -2; k <= 2; k++) solids.push({ x: o.position.x + cx * L * k / 5, z: o.position.z - sz * L * k / 5, r: W / 2 + .05 }); };
  carBox(car, car.userData.L, car.userData.W); carBox(van, van.userData.L, van.userData.W);

  /* a grid of the solid things, for quick lookups */
  const cell = 16, grid = new Map();
  for (const o of solids) { const k = `${Math.floor(o.x / cell)},${Math.floor(o.z / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(o); }
  const solidsNear = (x, z, r) => {
    const out = [];
    for (let i = Math.floor((x - r - 4) / cell); i <= Math.floor((x + r + 4) / cell); i++) for (let j = Math.floor((z - r - 4) / cell); j <= Math.floor((z + r + 4) / cell); j++) for (const o of grid.get(`${i},${j}`) ?? []) out.push(o);
    return out;
  };
  return { group, car, van, sign, solids, solidsNear, suburban };
}
