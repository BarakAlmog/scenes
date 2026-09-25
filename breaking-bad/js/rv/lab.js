import * as THREE from 'three';
import { app } from '../app.js';
import { M, box, rbox, cyl, sph, tube, mat, keep, seeded } from '../lib/util.js';
import { hotspot, hitBox } from '../ctrl/hotspots.js';
import { RV, rv } from './rv.js';

/* Inside, front to back (Iñaki Aliste Lizarralde's plan and the stills): the cab with two captain's chairs and the
   engine cover; the stove and the sink on the driver's side; the lab along the driver's side: round flasks in
   steel heating mantles with glass condensers up to the ceiling; on the passenger side, behind the door, a counter
   of buckets, trays and jugs, the fridge and a pantry of cans; the bed at the back; blue barrels on the floor. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const lab = { flasks: [], glow: null, product: null, gear: {}, bubbles: [], heat: 0, cooking: false };

export function buildLab() {
  const body = rv.body, F = RV.floor, rnd = seeded(77);
  const g = keep(new THREE.Group()); g.name = 'lab'; body.add(g);
  const oak = mat(0xa9774a, .55), oakD = mat(0x7d5533, .6), counter = mat(0xd7c7a6, .45), vinyl = mat(0x5a3b26, .55), vinylL = mat(0x7a5236, .6);
  const steel = mat(0xc4c8cb, .28, .85), black = mat(0x1e1d1c, .6), white = mat(0xefece4, .5), carpet = mat(0x6a4c33, .95);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f2, roughness: .05, metalness: 0, transparent: true, opacity: .28, depthWrite: false, envMapIntensity: 1.8, side: THREE.DoubleSide });
  glass.userData.live = true;

  /* ---------- the cab ---------- */
  {const c = new THREE.Group(); g.add(c);
   box(c, .8, .4, .6, carpet, 3.95, .9, 0);                                   /* the engine cover */
   rbox(c, .34, .44, 2.26, .04, vinyl, 4.36, 1.3, 0);                          /* the dash */
   box(c, .2, .04, 2.2, vinylL, 4.48, 1.53, 0);
   for (const [z, r] of [[-.78, .055], [-.62, .07], [-.46, .055]]) { const d = cyl(c, r, r, .02, mat(0x0e0d0c, .3), 4.2, 1.42, z, 18); d.rotation.z = Math.PI / 2 - .35; }
   /* the steering wheel on its column */
   const wheel = new THREE.Group(); wheel.position.set(4.02, 1.34, -.62); wheel.rotation.z = -.55; c.add(wheel);
   const rim = M(new THREE.TorusGeometry(.22, .022, 8, 28), black); rim.rotation.y = Math.PI / 2; wheel.add(rim);
   for (let k = 0; k < 3; k++) { const sp = box(wheel, .02, .2, .03, black, 0, 0, 0); sp.rotation.x = k * Math.PI * 2 / 3; sp.position.set(0, Math.cos(k * 2.09) * .1, Math.sin(k * 2.09) * .1); }
   tube(c, V(4.02, 1.34, -.62), V(4.35, 1.05, -.62), .03, black);
   lab.gear.wheel = wheel;
   /* the keys, left in the ignition */
   const key = new THREE.Group(); key.position.set(4.16, 1.26, -.42); c.add(key); keep(key);
   box(key, .012, .05, .018, steel, 0, -.02, 0); sph(key, .012, mat(0xc9a44a, .3, .8), 0, -.05, 0, 8, 6);
   lab.gear.key = key;
   /* two captain's chairs */
   for (const s of [-1, 1]) {
     const ch = new THREE.Group(); ch.position.set(3.55, .7, s * .62); c.add(ch);
     cyl(ch, .06, .1, .3, black, 0, .15, 0, 10);
     rbox(ch, .56, .14, .54, .05, vinyl, 0, .36, 0);
     rbox(ch, .12, .66, .54, .05, vinyl, -.25, .72, 0);
     rbox(ch, .12, .16, .3, .05, vinylL, -.25, 1.12, 0);
     for (const t of [-1, 1]) rbox(ch, .34, .06, .06, .02, vinylL, -.02, .58, t * .27);
     if (s < 0) lab.gear.driverSeat = ch; else lab.gear.passengerSeat = ch;
   }
   hotspot(key, { title: 'The keys', text: () => app.place?.id === 'days' ? 'Jesse left them in the ignition. A lamp on the dash has drained the battery.' : 'In the ignition. Drive (R) and turn them (E): it does not always start.' });
   hitBox(key, .12, .12, .12, 0, -.03, 0);}

  /* ---------- driver's side: the stove, the sink, the lab counter ---------- */
  const zL = -RV.halfW + .06 + .3;          /* counter centre on the driver's side */
  {const k = new THREE.Group(); g.add(k);
   const base = (x0, x1, top = counter) => {
     box(k, x1 - x0, .86, .6, oak, (x0 + x1) / 2, F + .43, zL);
     for (let x = x0 + .02; x < x1 - .1; x += .45) { box(k, Math.min(.42, x1 - x - .03), .7, .01, oakD, x + Math.min(.42, x1 - x - .03) / 2, F + .42, zL + .305); box(k, .08, .02, .02, steel, x + .2, F + .72, zL + .315); }
     box(k, x1 - x0 + .02, .04, .64, top, (x0 + x1) / 2, F + .88, zL + .01);
   };
   base(1.45, 2.55); base(-.35, 1.45); base(-3.98, -.35, mat(0xb8b2a4, .35, .1));
   /* the stove: three burners and an oven door */
   for (const [x, z] of [[1.75, -.95], [2.2, -.95], [1.98, -.72]]) {
     cyl(k, .09, .09, .01, black, x, F + .905, z, 16).castShadow = false;
     const ring = M(new THREE.TorusGeometry(.07, .008, 6, 16), steel); ring.rotation.x = Math.PI / 2; ring.position.set(x, F + .915, z); k.add(ring);
   }
   box(k, .9, .5, .01, mat(0x2a2522, .4), 2.0, F + .45, zL + .306);
   /* the sink */
   for (const x of [.3, .78]) { box(k, .4, .02, .4, steel, x, F + .905, zL + .02); box(k, .36, .12, .36, mat(0x9ea2a4, .3, .7), x, F + .85, zL + .02); }
   tube(k, V(.54, F + .9, zL - .22), V(.54, F + 1.15, zL - .22), .012, steel); tube(k, V(.54, F + 1.15, zL - .22), V(.54, F + 1.12, zL - .05), .012, steel);
   /* overhead cabinets over the stove and the sink, on the wall */
   const over = new THREE.Group(); k.add(over); rv.walls.left.attach.push(keep(over));
   box(over, 2.9, .4, .33, oak, 1.1, 2.6, -RV.halfW + .06 + .165);
   for (let x = -.3; x < 2.5; x += .48) box(over, .44, .34, .01, oakD, x + .22, 2.6, -RV.halfW + .06 + .335);}

  /* ---------- the lab: flasks in heating mantles, condensers to the ceiling ---------- */
  {const L_ = new THREE.Group(); L_.name = 'lab-row'; g.add(L_);
   const top = F + .9, xs = [-3.6, -3.0, -2.4, -1.8, -1.2], z = zL + .02;
   const liquidMats = [0xd8c77a, 0xcfe0e3, 0xe4d58c, 0xbfd6dd, 0xd9c67c].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .2, transparent: true, opacity: .55, depthWrite: false }));
   xs.forEach((x, i) => {
     /* the mantle: a steel bowl on a box with a dial */
     cyl(L_, .23, .2, .16, steel, x, top + .08, z, 22);
     box(L_, .3, .12, .26, mat(0x3a4d63, .5, .2), x, top - .0, z + .2).castShadow = false;
     cyl(L_, .03, .03, .02, black, x + .06, top + .02, z + .33, 10).rotation.x = Math.PI / 2;
     /* the flask: a round bottom, a neck, liquid inside */
     const f = new THREE.Group(); f.position.set(x, top + .32, z); L_.add(f);
     const bulb = new THREE.Mesh(new THREE.SphereGeometry(.2, 22, 16), glass); bulb.renderOrder = 4; f.add(bulb);
     const liq = new THREE.Mesh(new THREE.SphereGeometry(.185, 20, 12, 0, Math.PI * 2, Math.PI * .45, Math.PI * .55), liquidMats[i]); liq.renderOrder = 3; f.add(liq);
     const surf = new THREE.Mesh(new THREE.CircleGeometry(.183, 20), liquidMats[i]); surf.rotation.x = -Math.PI / 2; surf.position.y = .029; surf.renderOrder = 3; f.add(surf);
     const neck = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .22, 14, 1, true), glass); neck.position.y = .28; neck.renderOrder = 4; f.add(neck);
     /* the condenser: a jacketed glass column up to the ceiling, with hoses */
     const c0 = V(x, top + .62, z), c1 = V(x, RV.ceil - .06, z);
     const col = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, c1.y - c0.y, 14, 1, true), glass); col.position.set(x, (c0.y + c1.y) / 2, z); col.renderOrder = 4; L_.add(col);
     const inner = tube(L_, c0, c1, .018, glass); inner.renderOrder = 4; inner.castShadow = false;
     tube(L_, V(x + .05, c0.y + .1, z), V(x + .18, c0.y - .05, z + .25), .01, mat(0x7a8a3a, .6));
     tube(L_, V(x + .05, c1.y - .1, z), V(x + .2, c1.y - .2, z + .3), .01, mat(0x7a8a3a, .6));
     /* the support rod and a clamp */
     tube(L_, V(x - .26, top, z - .18), V(x - .26, RV.ceil - .02, z - .18), .011, steel);
     tube(L_, V(x - .26, top + .72, z - .18), V(x - .04, top + .72, z), .009, steel);
     lab.flasks.push({ group: f, liquid: liq, x, y: top + .32, z });
   });
   /* a bench of glassware and the thermometer */
   for (let i = 0; i < 7; i++) { const x = -3.9 + i * .1 + rnd() * .03; const b = new THREE.Mesh(new THREE.CylinderGeometry(.035, .04, .12 + rnd() * .1, 12, 1, true), glass); b.position.set(x, top + .07, zL + .22); b.renderOrder = 4; L_.add(b); }
   lab.gear.row = L_;
   hotspot(L_, { title: 'The lab', text: () => lab.cooking ? 'Cooking. The mantles are hot and the condensers drip.' : 'Round flasks in heating mantles, condensers up to the ceiling. Click to start a cook.', action: () => app.emit('lab:cook') });
   hitBox(L_, 2.9, 1.2, .7, -2.4, top + .5, z);}

  /* ---------- passenger side: counter, fridge, pantry ---------- */
  const zR = RV.halfW - .06 - .3;
  {const p = new THREE.Group(); g.add(p);
   box(p, 2.58, .86, .6, oak, -.09, F + .43, zR); box(p, 2.6, .04, .64, counter, -.09, F + .88, zR - .01);
   for (let x = -1.36; x < 1.1; x += .45) { box(p, .42, .7, .01, oakD, x + .21, F + .42, zR - .305); box(p, .08, .02, .02, steel, x + .2, F + .72, zR - .315); }
   /* the fridge, where the vents are outside */
   box(p, .64, .9, .6, mat(0xd9ceb4, .45), -2.52, F + .45, zR); box(p, .02, .3, .03, steel, -2.22, F + .6, zR - .31);
   box(p, .66, .04, .64, counter, -2.52, F + .92, zR - .01);
   box(p, .76, .86, .6, oak, -1.79, F + .43, zR); box(p, .78, .04, .64, counter, -1.79, F + .88, zR - .01);
   /* the pantry: open shelves of cans on the wall, over the counter */
   const pantry = new THREE.Group(); p.add(pantry); rv.walls.right.attach.push(keep(pantry));
   const cans = [0xb8261c, 0xe8c63a, 0x3a7a3f, 0xd8d2c0, 0x2f5f9a, 0xc26a2a];
   for (const x of [-2.9, -1.4]) box(pantry, .02, .8, .3, oakD, x, 2.4, zR + .15);
   for (let sh = 0; sh < 3; sh++) {
     box(pantry, 1.5, .02, .3, oak, -2.15, 2.03 + sh * .27, zR + .15);
     for (let x = -2.84; x < -1.46; x += .082) if (rnd() > .18) cyl(pantry, .034, .034, .11, mat(cans[Math.floor(rnd() * cans.length)], .45, .3), x, 2.1 + sh * .27, zR + .15 + (rnd() - .5) * .08, 10);
   }
   /* on the counter: white buckets, jugs, a scale, beakers */
   for (const [x, zz] of [[.2, 0], [.62, .08]]) { cyl(p, .15, .13, .36, white, x, F + 1.08, zR + zz - .05, 16); cyl(p, .152, .152, .02, white, x, F + 1.27, zR + zz - .05, 16); }
   for (const x of [-.38, -.18]) { rbox(p, .16, .28, .16, .03, mat(0xe8e2d0, .35), x, F + 1.04, zR - .08); cyl(p, .025, .025, .05, mat(0x2d5b9a, .5), x, F + 1.2, zR - .08, 8); }
   box(p, .32, .06, .26, black, -.68, F + .93, zR - .05); box(p, .26, .01, .22, steel, -.68, F + .965, zR - .05);
   /* the tray of product */
   const tray = new THREE.Group(); tray.position.set(-1.12, F + .91, zR - .06); p.add(tray); keep(tray);
   box(tray, .5, .03, .36, steel, 0, 0, 0);
   const prodMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd0e8, roughness: .12, metalness: 0, transmission: 0, envMapIntensity: 2, emissive: 0x0a2230, emissiveIntensity: .6 });
   prodMat.userData.live = true;
   const shards = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.018, 0), prodMat, 140), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
   for (let i = 0; i < 140; i++) { e.set(rnd() * 6, rnd() * 6, rnd() * 6); q.setFromEuler(e); const sc = .6 + rnd() * .9; m4.compose(V((rnd() - .5) * .44, .025, (rnd() - .5) * .3), q, V(sc, sc * .5, sc)); shards.setMatrixAt(i, m4); }
   tray.add(shards); lab.product = { tray, mat: prodMat, shards };
   hotspot(tray, { title: 'The product', text: () => app.place?.id === 'pilot' ? 'Walt’s first batch. Jesse can hardly believe it: glass-grade, chemically pure.' : 'Blue sky, 99.1 percent pure. The blue is Walt’s signature.' });
   hitBox(tray, .56, .2, .42, 0, .08, 0);
   /* overhead cabinets at the back, over the bed, on the wall */
   const over = new THREE.Group(); p.add(over); rv.walls.right.attach.push(keep(over));
   box(over, 1.4, .4, .33, oak, -3.95, 2.6, RV.halfW - .06 - .165);}

  /* ---------- the back: the bed, a chest ---------- */
  {const b = new THREE.Group(); g.add(b);
   box(b, 1.8, .42, 1.0, oak, -3.76, F + .21, .66);
   rbox(b, 1.76, .18, .98, .06, mat(0xe7e1d2, .9), -3.76, F + .5, .66);
   rbox(b, 1.3, .06, 1.02, .03, mat(0x2e4f8a, .9), -3.53, F + .6, .66);
   rbox(b, .34, .12, .6, .05, mat(0xf1ede4, .9), -4.46, F + .64, .66);
   box(b, .6, .8, .55, oakD, -4.32, F + .4, -.85);}

  /* ---------- on the floor: blue barrels, buckets, boxes, a fire extinguisher ---------- */
  {const f = new THREE.Group(); g.add(f);
   const blue = mat(0x1f5aa8, .5);
   for (const [x, z] of [[-3.45, -.27], [-2.87, -.27]]) { cyl(f, .28, .28, .88, blue, x, F + .44, z, 20); cyl(f, .29, .29, .03, blue, x, F + .3, z, 20); cyl(f, .29, .29, .03, blue, x, F + .66, z, 20); }
   rbox(f, .5, .3, .38, .02, mat(0xb58a5a, .9), -.9, F + .15, -.1);
   rbox(f, .44, .26, .34, .02, mat(0xa87e50, .9), -.95, F + .43, -.12);
   cyl(f, .075, .075, .45, mat(0xb8201a, .4, .2), 1.15, F + .23, .5, 12);
   lab.gear.barrels = f;
   hotspot(f, { title: 'The barrels', text: 'Blue plastic drums: the chemicals for the next cook.' });}

  /* ---------- two gas masks on hooks by the door ---------- */
  {const m = new THREE.Group(); g.add(m); rv.walls.right.attach.push(keep(m));
   for (const x of [1.05, 1.2]) {
     const h = new THREE.Group(); h.position.set(x, 2.05, RV.halfW - .1); m.add(h);
     rbox(h, .12, .16, .08, .04, black, 0, 0, 0);
     for (const s of [-1, 1]) { const c = cyl(h, .035, .035, .05, mat(0x3a3a38, .5), s * .05, -.08, .03, 12); c.rotation.x = 1.2; }
     const lens = new THREE.Mesh(new THREE.CircleGeometry(.03, 12), mat(0x6a8a8a, .1, .3)); lens.position.set(0, .03, .042); h.add(lens);
   }
   hotspot(m, { title: 'Gas masks', text: 'For the cook. The fumes are poison; in the pilot, Walt and Jesse wear them as they flee.' });
   hitBox(m, .4, .3, .2, 1.12, 2.05, RV.halfW - .12);}

  /* ---------- lights: two dome lights in the ceiling, and a lantern ---------- */
  {const dome = new THREE.MeshStandardMaterial({ color: 0xf6f0e0, emissive: 0xffe2b0, emissiveIntensity: 0, roughness: .4 });
   dome.userData.live = true; lab.glow = dome;
   for (const x of [-2.6, .6]) { const d = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dome); d.rotation.x = Math.PI; d.position.set(x, RV.ceil - .01, 0); rv.roof.group.add(d); }}

  /* the mantles glow a little when hot */
  lab.mantleMat = new THREE.MeshStandardMaterial({ color: 0x3a1a0c, emissive: 0xff5a1a, emissiveIntensity: 0, roughness: .6 });
  lab.mantleMat.userData.live = true;
  for (const f of lab.flasks) { const r = new THREE.Mesh(new THREE.TorusGeometry(.2, .015, 6, 24), lab.mantleMat); r.rotation.x = Math.PI / 2; r.position.set(f.x, f.y - .16, f.z); g.add(r); }

  /* bubbles in the flasks while cooking */
  const bm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false });
  for (const f of lab.flasks) for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.012, 6, 4), bm); s.visible = false; s.userData.keep = true; f.group.add(s); lab.bubbles.push({ m: s, ph: Math.random(), sp: .6 + Math.random() * .8, r: Math.random() * .1, a: Math.random() * 6 }); }

  app.on('lab:cook', () => setCook(!lab.cooking));
  app.onUpdate(updateLab, 16);
  return lab;
}

export function setCook(on) { lab.cooking = on; app.emit('cook', on); }

function updateLab(dt) {
  lab.heat += ((lab.cooking ? 1 : 0) - lab.heat) * (1 - Math.exp(-dt / 2.5));
  const h = lab.heat;
  lab.mantleMat.emissiveIntensity = h * 2.2;
  for (const b of lab.bubbles) {
    b.m.visible = h > .3;
    if (!b.m.visible) continue;
    b.ph = (b.ph + dt * b.sp * h) % 1;
    b.m.position.set(Math.cos(b.a) * b.r, -.14 + b.ph * .24, Math.sin(b.a) * b.r);
    b.m.scale.setScalar(.6 + b.ph);
  }
  if (lab.product) lab.product.mat.emissiveIntensity = .35 + .25 * Math.sin(app.time * 2.1) * .5;
  /* after dark the lights inside are on: the two dome lights, and the lamp over the lab while it cooks */
  const t = app.tod, dark = t ? Math.min(1, Math.max(0, t.night * 1.25 + t.dim * .35 - .12)) : 0, k = dark * dark * (3 - 2 * dark);
  if (rv.lights.cabin) { rv.lights.cabin.intensity = k * 2.6; rv.lights.lab.intensity = k * 1.6 + h * 1.2; }
  if (lab.glow) lab.glow.emissiveIntensity = k * 2.4;
}
