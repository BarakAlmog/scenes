import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { app } from '../app.js';
import { M, box, rbox, cyl, tube, mat, keep, seeded, damp, smooth, canvasTex } from '../lib/util.js';
import { cast, stage, speak, walkTo } from './cast.js';
import { RV, rv, setDoor } from '../rv/rv.js';
import { lab } from '../rv/lab.js';
import { onStop, placeRV } from '../world/stops.js';
import { emit } from '../fx/particles.js';
import { buildYardWeeds } from '../world/flora.js';
import { hotspot } from '../ctrl/hotspots.js';
import { flyTo } from '../ctrl/camera.js';
import { cutaway } from '../rv/cutaway.js';

/* Sunset: Old Joe's salvage yard. Hank at the door with a lug wrench, a fake call about Marie, his SUV gone out of
   the gate; then Old Joe's front loader comes down on the roof until the Krystal Ship is scrap, while Walt and
   Jesse watch. Rows and stacks of junked cars, tyres, the fence, the office trailer, power poles on the road. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const crush = { done: false, k: 0, yard: null, loader: null, suv: null, play: null, finish: null, restore: null };

/* ---------- junk ---------- */
/* a junked car in one piece: body, a cabin with dark glass, tyres; colour in the vertices, paint per instance */
function carGeo(kind) {
  const parts = [];
  const add = (g, x, y, z, shade = 1) => {
    g = g.index ? g.toNonIndexed() : g; g.translate(x, y, z);
    const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(shade); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(a)) g.deleteAttribute(a);
    parts.push(g);
  };
  /* a cabin: a box whose top is narrower than its bottom */
  const cabin = (len, h, w, taper) => { const g = new THREE.BoxGeometry(len, h, w); const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * taper); p.setZ(i, p.getZ(i) * .92); } g.computeVertexNormals(); return g; };
  const tyre = () => { const t = new THREE.CylinderGeometry(.33, .33, .22, 12); t.rotateX(Math.PI / 2); return t; };
  if (kind === 0) {
    add(new THREE.BoxGeometry(4.5, .55, 1.75), 0, .58, 0); add(cabin(2.3, .55, 1.62, .78), -.2, 1.12, 0);
    add(cabin(2.34, .42, 1.64, .76), -.2, 1.13, 0, .08);
  } else if (kind === 1) {
    add(new THREE.BoxGeometry(5.2, .62, 1.9), 0, .64, 0); add(cabin(1.8, .72, 1.82, .82), 1.05, 1.3, 0);
    add(cabin(1.84, .44, 1.84, .8), 1.05, 1.36, 0, .08); add(new THREE.BoxGeometry(2.6, .45, .08), -1.25, 1.14, .88); add(new THREE.BoxGeometry(2.6, .45, .08), -1.25, 1.14, -.88);
  } else {
    add(cabin(4.8, 1.55, 1.9, .98), 0, 1.02, 0); add(new THREE.BoxGeometry(4.3, .45, 1.93), -.1, 1.35, 0, .08);
  }
  const L = kind === 1 ? 1.7 : 1.45;
  for (const x of [L, -L]) for (const z of [-.8, .8]) if (Math.random() < .8) add(tyre(), x, .33, z, .06);
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}
function wheelGeo() { const g = new THREE.CylinderGeometry(.34, .34, .22, 14); g.rotateX(Math.PI / 2); return g; }

function buildYard(place) {
  const g = new THREE.Group(); g.name = 'yard'; place.groups.near.add(g);
  const T = place.T, rnd = seeded(66), up = V(0, 1, 0);
  const obstacles = []; place.obstacles = obstacles;
  /* the cars: rows on the ground, stacks of two and three */
  const colors = [0x7a2a24, 0x2d4a6a, 0x8a8a84, 0x3a5a3a, 0xb8a47a, 0x5a3a28, 0x1f2426, 0xc9c2b0, 0x6a1f1f, 0x3a4a5a, 0x9a6a3a, 0x4a4a52];
  const lists = [[], [], []];
  const addCar = (x, z, y, yaw, kind, crushed = 1) => lists[kind].push({ x, z, y, yaw, k: rnd(), c: colors[Math.floor(rnd() * colors.length)], s: crushed });
  for (let row = 0; row < 5; row++) for (let i = 0; i < 9; i++) {
    const x = -46 + i * 5.6 + rnd() * .8, z = -40 + row * 7.5 + rnd() * .6;
    if (Math.abs(x) < 16 && Math.abs(z) < 12) continue;
    const kind = rnd() < .6 ? 0 : rnd() < .6 ? 1 : 2, y = T.heightAt(x, z);
    addCar(x, z, y, Math.PI / 2 + (rnd() - .5) * .15, kind, rnd() < .25 ? .45 : 1);
    if (rnd() < .45) addCar(x + (rnd() - .5) * .4, z, y + (kind === 2 ? 2.0 : 1.4), Math.PI / 2 + (rnd() - .5) * .3, 0, rnd() < .5 ? .5 : .85);
    obstacles.push({ x, z, r: 2.6 });
  }
  for (let i = 0; i < 12; i++) { const x = 20 + rnd() * 24, z = 16 + rnd() * 20, kind = Math.floor(rnd() * 3); addCar(x, z, T.heightAt(x, z), rnd() * 6.28, kind, .35 + rnd() * .3); obstacles.push({ x, z, r: 2.4 }); }
  const carMats = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .65, metalness: .3, vertexColors: true }));
  lists.forEach((list, kind) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(carGeo(kind), carMats[kind], list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    list.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler((it.k - .5) * .06, it.yaw, (rnd() - .5) * .08));
      m4.compose(V(it.x, it.y + (it.s < 1 ? -.1 : 0), it.z), q, V(1, it.s, 1)); im.setMatrixAt(i, m4);
      c.setHex(it.c).multiplyScalar(.55 + it.k * .3); im.setColorAt(i, c);
    });
    im.castShadow = true; im.receiveShadow = true; im.userData.keep = true; g.add(im);
  });
  /* wheels lying about and tyre stacks */
  const tires = [];
  for (let i = 0; i < 40; i++) { const x = -50 + rnd() * 100, z = 36 + rnd() * 10; for (let k = 0; k < 1 + Math.floor(rnd() * 5); k++) tires.push({ x, z, y: T.heightAt(x, z) + .12 + k * .23, k: rnd() }); }
  {const im = new THREE.InstancedMesh((() => { const t = new THREE.TorusGeometry(.3, .12, 8, 16); t.rotateX(Math.PI / 2); return t; })(), mat(0x1d1c1b, .9), tires.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
   tires.forEach((t, i) => { q.setFromAxisAngle(up, t.k * 6); m4.compose(V(t.x, t.y, t.z), q, V(1, 1, 1)); im.setMatrixAt(i, m4); });
   im.castShadow = true; im.receiveShadow = true; im.userData.keep = true; g.add(im);}
  /* the chain-link fence, with the gate open to the east */
  {const link = canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(170,172,170,1)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w / 2, 0); c.lineTo(w, h / 2); c.lineTo(w / 2, h); c.closePath(); c.stroke(); });
   const fm = new THREE.MeshStandardMaterial({ map: link, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .5, metalness: .6, depthWrite: true });
   const post = mat(0x8a8c8a, .45, .6), H = 2.2, E = 56;
   const run = (x0, z0, x1, z1) => {
     const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 3);
     for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; cyl(g, .035, .035, H, post, x, T.heightAt(x, z) + H / 2, z, 8); }
     const pg = new THREE.PlaneGeometry(len, H), uv = pg.attributes.uv;
     for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / .12, uv.getY(i) * H / .12);
     const pl = new THREE.Mesh(pg, fm);
     pl.position.set((x0 + x1) / 2, T.heightAt((x0 + x1) / 2, (z0 + z1) / 2) + H / 2, (z0 + z1) / 2); pl.rotation.y = -Math.atan2(z1 - z0, x1 - x0); g.add(pl);
     tube(g, V(x0, T.heightAt(x0, z0) + H, z0), V(x1, T.heightAt(x1, z1) + H, z1), .02, post);
   };
   link.repeat.set(1, 1);
   run(-E, -E, E, -E); run(-E, E, E, E); run(-E, -E, -E, E); run(E, -E, E, -8); run(E, 8, E, E);}
  /* the office: a trailer on blocks with a hand-painted sign */
  {const o = new THREE.Group(); o.position.set(34, T.heightAt(34, -30), -30); o.rotation.y = -.3; g.add(o);
   rbox(o, 9, 2.6, 3, .08, mat(0xd9d2c0, .7), 0, 1.7, 0);
   box(o, 9.2, .12, 3.2, mat(0x8a8478, .6), 0, 3.05, 0);
   for (const x of [-2.5, 1, 3.5]) box(o, .9, .8, .05, mat(0x2a3034, .2, .3), x, 2.0, 1.52);
   box(o, 1, 2.1, .06, mat(0x7a6a58, .6), -3.6, 1.45, 1.52);
   const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, .8), new THREE.MeshStandardMaterial({ roughness: .8, map: canvasTex(512, 102, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a2a1c'; c.font = 'bold 58px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SALVAGE · PARTS', w / 2, h / 2 + 3); }) }));
   sign.position.set(.5, 3.6, 1.2); o.add(sign); box(o, .08, 1, .08, mat(0x5a4a3a, .8), -1, 3.3, 1.2); box(o, .08, 1, .08, mat(0x5a4a3a, .8), 2, 3.3, 1.2);
   for (const x of [-4, -1.5, 1.5, 4]) box(o, .4, .5, .4, mat(0x9a9a94, .9), x, .25, 0);
   obstacles.push({ x: 34, z: -30, r: 5 });}
  /* power poles along the road past the gate */
  for (let i = 0; i < 8; i++) {
    const x = 64, z = -90 + i * 28, y = T.heightAt(x, z);
    cyl(g, .13, .16, 11, mat(0x5a4636, .9), x, y + 5.5, z, 8); box(g, .12, .12, 2.4, mat(0x5a4636, .9), x, y + 10.2, z);
    if (i) tube(g, V(x, y + 10.25, z - 28 + 1.1), V(x, y + 10.25, z + 1.1), .012, mat(0x222, .6));
  }
  buildYardWeeds(place, [[-56, -56, 56, -50, 500], [-56, 50, 56, 56, 500], [-56, -56, -50, 56, 400], [50, -56, 56, 56, 400], [-20, -12, 20, 12, 90]]).children.forEach(c => g.add(c));
  return g;
}

/* ---------- Old Joe's front loader ---------- */
function buildLoader() {
  const L = keep(new THREE.Group()), yel = mat(0xe0a51c, .5, .2), dark = mat(0x222224, .6, .3), steel = mat(0x6a6c6e, .45, .6);
  const body = new THREE.Group(); L.add(body);
  rbox(body, 3.4, 1.4, 2.3, .12, yel, -.6, 1.55, 0);
  rbox(body, 1.5, 1.6, 1.9, .08, yel, .35, 2.95, 0);
  box(body, 1.4, 1.2, 1.7, mat(0x2a3438, .1, .3), .38, 3.05, 0);
  box(body, 1.1, .1, 2.2, dark, -1.7, 2.3, 0);
  cyl(body, .1, .1, 1.1, dark, -1.2, 3.0, .6, 10);
  const wheels = [];
  for (const [x, z] of [[1.0, 1.25], [1.0, -1.25], [-1.6, 1.25], [-1.6, -1.25]]) { const w = new THREE.Group(); w.position.set(x, .78, z); body.add(w); const t = M(new THREE.CylinderGeometry(.78, .78, .6, 22), mat(0x1c1b1a, .9)); t.rotation.x = Math.PI / 2; w.add(t); cyl(w, .4, .4, .62, yel, 0, 0, 0, 16).rotation.x = Math.PI / 2; wheels.push(w); }
  /* the lift arms pivot at the front of the body; the bucket at their ends */
  const arm = new THREE.Group(); arm.position.set(.9, 2.1, 0); body.add(arm);
  for (const z of [-.8, .8]) { const a = box(arm, 2.8, .32, .22, yel, 1.3, 0, z); a.rotation.z = -.12; }
  const bucket = new THREE.Group(); bucket.position.set(2.75, -.3, 0); arm.add(bucket);
  box(bucket, .12, 1.1, 2.6, steel, .6, 0, 0); box(bucket, 1.1, .12, 2.6, steel, .1, -.55, 0); box(bucket, .9, .1, 2.6, steel, .05, .55, 0);
  for (const s of [-1, 1]) box(bucket, 1.1, 1.1, .1, steel, .1, 0, s * 1.3);
  for (let i = 0; i < 6; i++) box(bucket, .22, .08, .1, steel, .72, -.58, -1.1 + i * .44);
  L.userData = { body, arm, bucket, wheels };
  return L;
}

/* ---------- Hank's black SUV ---------- */
function buildSUV() {
  const S = keep(new THREE.Group()), black = mat(0x121315, .3, .4), glass = mat(0x1a2024, .1, .5), chrome = mat(0xc8cccf, .2, .9);
  rbox(S, 4.6, .9, 1.9, .12, black, 0, .85, 0);
  rbox(S, 3.0, .75, 1.8, .1, black, -.35, 1.62, 0);
  for (const s of [-1, 1]) box(S, 2.7, .5, .02, glass, -.35, 1.66, s * .91);
  box(S, .02, .5, 1.6, glass, 1.14, 1.64, 0); box(S, .02, .5, 1.6, glass, -1.84, 1.66, 0);
  box(S, .06, .3, 1.5, chrome, 2.31, .82, 0);
  for (const [x, z] of [[1.45, .92], [1.45, -.92], [-1.45, .92], [-1.45, -.92]]) { const t = M(new THREE.CylinderGeometry(.38, .38, .26, 18), mat(0x1c1b1a, .9)); t.rotation.x = Math.PI / 2; t.position.set(x, .38, z); S.add(t); }
  return S;
}

export function buildCrush(ctx) {
  const { wait, waitUntil, shot, toWorld, yawOut } = ctx;
  let place = null;
  onStop({
    build(pl) {
      if (pl.id !== 'sunset') return;
      place = pl; crush.yard = buildYard(pl);
      crush.loader = buildLoader(); crush.suv = buildSUV();
      pl.groups.near.add(crush.loader, crush.suv);
      hotspot(crush.loader, { title: 'The loader', text: 'Old Joe’s. It crumples the RV and loads it into the crusher.' });
      hotspot(crush.suv, { title: 'Hank’s SUV', text: 'Hank waits here for a warrant.' });
    },
    enter(id) { if (id === 'sunset') { crush.done = false; crush.k = 0; applyCrush(0); home(); } else if (crush.k > 0) { crush.k = 0; applyCrush(0); } },
    leave(id) { if (id === 'sunset') { crush.k = 0; applyCrush(0); crush.done = false; } },
  });
  const T = () => app.terrain;
  function home() {
    const L = crush.loader, S = crush.suv;
    L.position.set(24, T().heightAt(24, 14), 14); L.rotation.y = Math.PI * .85; L.userData.arm.rotation.z = -.35; L.userData.bucket.rotation.z = .5;
    S.position.set(18, T().heightAt(18, -8), -8); S.rotation.y = -.2;
    stage('joe', { look: 'sunset', pos: V(19, 0, 11), rot: -2.2, pose: 'stand', focus: () => cast.hank.rig?.headPos(V()) });
  }
  crush.play = async () => {
    const S = crush.suv, L = crush.loader, rvp = rv.root.position.clone();
    /* 1. the call about Marie, and Hank drives away */
    shot(toWorld(4.5, 1.7, 7), toWorld(1.6, 1.7, 2.2), { dur: 4.5, fov: 36, to: toWorld(3.8, 1.6, 6) });
    app.emit('phone'); await wait(1.2);
    cast.hank.pose = 'record'; speak('hank', 'Schrader.', 1.4); await wait(1.6);
    app.emit('card', { title: 'A call', text: 'A police officer says Marie has been in a car accident and is being airlifted to hospital. It is Saul’s secretary.' });
    speak('hank', 'Marie?', 1.4); await wait(1.4);
    cast.hank.pose = 'stand';
    walkTo('hank', [S.position.clone().add(V(-.5, 0, 1.4))], 3.2);
    shot(V(8, 2.6, -16), S.position.clone().add(V(0, 1, 0)), { dur: 6, fov: 40, follow: (p, l) => l.copy(cast.hank.visible ? cast.hank.rig.root.position : S.position).add(V(0, 1.1, 0)) });
    await waitUntil(() => !cast.hank.walker, 6);
    stage('hank', { look: 'sunset', visible: false, pos: V() });
    app.emit('car:start');
    const p0 = S.position.clone(), gate = V(58, 0, 0), road = V(70, 0, 30);
    const route = new THREE.CatmullRomCurve3([p0, V(34, 0, -4), gate, V(64, 0, 8), road]);
    let u = 0;
    ctx.seq.frame = dt => { u = Math.min(1, u + dt * .12); const p = route.getPointAt(u), t = route.getTangentAt(u); S.position.set(p.x, T().heightAt(p.x, p.z), p.z); S.rotation.y = Math.atan2(-t.z, t.x); if (u > .02 && u < .9) app.emit('dust', { x: p.x, z: p.z, yaw: S.rotation.y, v: 8, y: S.position.y }); };
    shot(V(40, 3, -10), S.position.clone().add(V(0, 1, 0)), { dur: 4, fov: 36, follow: (p, l) => l.copy(S.position).add(V(0, 1, 0)) });
    await wait(4);
    ctx.seq.frame = null; S.visible = false;
    /* 2. Walt and Jesse come out; Old Joe climbs into the loader */
    setDoor(true); await wait(.6);
    stage('walt', { look: 'sunset', pos: toWorld(2, 0, 3), rot: yawOut(.5), pose: 'stand' });
    stage('jesse', { look: 'sunset', pos: toWorld(1.2, 0, 2.6), rot: yawOut(.3), pose: 'stand' });
    const watchW = V(10.5, 0, -9.5), watchJ = V(11.8, 0, -8.6);
    walkTo('walt', [watchW], 1.2, () => { cast.walt.pose = 'stand'; cast.walt.focus = () => rv.root.position.clone().add(V(0, 1.5, 0)); }, rvp);
    walkTo('jesse', [watchJ], 1.1, () => { cast.jesse.pose = 'hips'; cast.jesse.focus = () => rv.root.position.clone().add(V(0, 1.5, 0)); }, rvp);
    setDoor(false);
    walkTo('joe', [L.position.clone().add(V(-1.5, 0, 1.5))], 1.1);
    shot(V(19, 2.4, -17), rvp.clone().add(V(0, 1.4, 0)), { dur: 7, fov: 34, to: V(17, 2.2, -15) });
    await wait(5);
    stage('joe', { look: 'sunset', visible: false, pos: V() });
    /* 3. the loader comes on */
    app.emit('loader:start');
    const side = toWorld(-.6, 0, 4.7), approach = new THREE.CatmullRomCurve3([L.position.clone(), L.position.clone().lerp(side, .5).add(V(3, 0, 0)), side]);
    u = 0;
    const faceRV = () => Math.atan2(-(rvp.z - L.position.z), rvp.x - L.position.x);
    ctx.seq.frame = dt => {
      u = Math.min(1, u + dt * .16); const p = approach.getPointAt(u), t = approach.getTangentAt(u);
      L.position.set(p.x, T().heightAt(p.x, p.z), p.z);
      L.rotation.y = u < .85 ? Math.atan2(-t.z, t.x) : damp(L.rotation.y, faceRV(), 3, dt);
      L.userData.wheels.forEach(w => { w.children[0].rotation.y += dt * 3; });
      if (u < 1) app.emit('dust', { x: p.x, z: p.z, yaw: L.rotation.y, v: 5, y: L.position.y });
    };
    shot(V(18, 5, 6), rvp.clone().add(V(0, 1.6, 0)), { dur: 7, fov: 38, to: V(15, 6, 3), follow: (p, l) => l.lerpVectors(rvp.clone().add(V(0, 1.6, 0)), L.position.clone().add(V(0, 2, 0)), .4) });
    await wait(6.5);
    L.rotation.y = faceRV();
    /* 4. three blows on the roof, seen from above and against the sun */
    const A = L.userData.arm, B = L.userData.bucket;
    const above = rvp.clone().add(V(-6, 16, 9));
    shot(above, rvp.clone().add(V(0, 1, 0)), { dur: 16, fov: 40, to: rvp.clone().add(V(-3, 11, 12)) });
    for (let hit = 0; hit < 3; hit++) {
      /* raise */
      for (let t = 0; t < 1; t += 1 / 36) { A.rotation.z = -.35 + .95 * smooth(t); B.rotation.z = .5 - .6 * t; await wait(1 / 30); }
      /* down on the roof */
      const k0 = crush.k, k1 = [.38, .7, 1][hit];
      for (let t = 0; t < 1; t += 1 / 14) { A.rotation.z = .6 - 1.05 * t * t; crush.k = k0 + (k1 - k0) * t * t; applyCrush(crush.k); await wait(1 / 30); }
      app.emit('crunch', hit); app.emit('shake', .12 + hit * .04);
      for (let i = 0; i < 30; i++) emit('dust', { x: rvp.x + (Math.random() - .5) * 8, y: rvp.y + .5, z: rvp.z + (Math.random() - .5) * 3, vx: (Math.random() - .5) * 4, vy: .8 + Math.random() * 1.5, vz: (Math.random() - .5) * 4, life: 3, s0: .6, s1: 4, a: .45, c: [.58, .5, .44], drag: .8, buoy: .05 });
      if (hit === 0) { app.emit('glass'); for (let i = 0; i < 40; i++) { const g = toWorld(-1 + Math.random() * 5, 1.9, (Math.random() < .5 ? -1 : 1) * 1.25); emit('spark', { x: g.x, y: g.y, z: g.z, vx: (Math.random() - .5) * 3, vy: Math.random() * 2, vz: (Math.random() - .5) * 3, life: .9, s0: .05, s1: .03, a: .7, c: [.8, .9, .95], drag: .6, grav: 9 }); } rv.parts.windshield.visible = false; }
      if (hit === 1) speak('jesse', 'Yeah… bye.', 1.6);
      await wait(.5);
    }
    A.rotation.z = -.2; await wait(1);
    ctx.seq.frame = null;
    /* 5. what is left, against the sun, past the two of them */
    shot(V(15.5, 1.55, -12.5), V(0, .9, 0), { dur: 6, fov: 30, to: V(14, 1.5, -11.2) });
    speak('walt', '…', 1.2);
    await wait(5.5);
  };
  crush.finish = () => {
    crush.k = 1; applyCrush(1); crush.done = true;
    if (crush.suv) crush.suv.visible = false;
    for (const k of ['hank', 'joe']) stage(k, { look: 'sunset', visible: false, pos: V() });
    const rvp = rv.root.position;
    const w = V(10.5, 0, -9.5), j = V(11.8, 0, -8.6);
    stage('walt', { look: 'sunset', pos: w, rot: Math.atan2(rvp.x - w.x, rvp.z - w.z), pose: 'stand', focus: () => rv.root.position.clone().add(V(0, 1.2, 0)) });
    stage('jesse', { look: 'sunset', pos: j, rot: Math.atan2(rvp.x - j.x, rvp.z - j.z), pose: 'hips', focus: () => rv.root.position.clone().add(V(0, 1.2, 0)) });
    crush.loader.userData.arm.rotation.z = -.2;
    app.emit('act');
  };
  crush.restore = () => {
    crush.done = false; crush.k = 0; applyCrush(0); rv.parts.windshield.visible = true;
    crush.suv.visible = true; home(); placeRV('sunset'); ctx.stageStop('sunset');
    flyTo('overview', 1.4); app.emit('act');
  };
}

/* squash everything above the floor toward it, with a little crumple */
export function applyCrush(k) {
  if (!rv.walls?.left) return;
  rv.crush = k;
  for (const w of Object.values(rv.walls)) { w.pivot.rotation.x = k * .05 * (w.n.z || .5); w.pivot.rotation.z = k * .03 * (w.n.x || 1); }
  rv.roof.group.rotation.z = k * .04; rv.roof.group.rotation.x = -k * .03;
  const labG = rv.body.getObjectByName('lab'); if (labG) { labG.scale.y = 1 - .55 * k; labG.position.y = RV.floor * .55 * k; }
  if (rv.parts.front) { rv.parts.front.scale.y = 1 - .35 * k; }
  for (const m of Object.values(rv.parts.mirrors)) m.group.visible = k < .5;
  rv.parts.awning.visible = k < .3;
  if (rv.parts.ladder) rv.parts.ladder.scale.y = 1 - .55 * k;
  const row = rv.body.getObjectByName('lab-row'); if (row) row.visible = k < .45;
  cutaway.enabled = k === 0;
  crush.k = k;
}
export { crush as default };
