import * as THREE from 'three';
import { app } from '../app.js';
import { M, box, cyl, rbox, sph, tube, mat, canvasTex, seeded } from '../lib/util.js';
import { labelTex } from '../lib/textures.js';
import { bakeStatic } from '../lib/merge.js';
import { want, loop, stopLoops, slice } from '../audio.js';
import { tod } from '../world/lighting.js';
import { hotspot } from '../ctrl/hotspots.js';
import { Forest } from '../world/trees.js';
import { cadillac, suburban, econoline } from '../world/cars.js';
import { buildBakeryMoment } from './moment.js';

/* "It happens" (S1 E8): a bakery in North Arlington, a summer afternoon. Inside: the glass front with the door and
   its OPEN / CLOSED sign, the ledge under the window where Christopher sits, the red gumball machine on its stand,
   the counter with the ticket machine and the white dial scale, the cabinets and racks of pastry and bread behind.
   Outside: a wide avenue, the crosswalk, brick shop buildings across the street, parked cars, traffic, wires.
   x east, z south (the street), y up, metres; the glass front is at z = 0. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = h => new THREE.Color(h);
export const P = {
  date: [1998, 6, 15], lat: 40.7884, lon: -74.133, grid: .56, tz: -5, dst: true, hour: 14.5,
  turbidity: 3.6, rayleigh: 1.5, mie: .0055, mieG: .82, haze: 1 / 5000, sunI: 3.2, exposure: .78, nightExposure: 3,
  groundAlbedo: C(0x7a746a), skyK: .26,
  clouds: { cover: .2, scale: .0006, soft: .16, alt: 2200, depth: .3, wind: [3, 1] },
};
import { SHOP } from './layout.js';
export { SHOP };

/* ---------- textures ---------- */
function tileTex() {
  const rnd = seeded(14);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b9ae9c'; g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = .92 + rnd() * .12; g.fillStyle = `rgb(${[222, 211, 190].map(v => Math.round(v * k)).join(',')})`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); for (let q = 0; q < 40; q++) { g.fillStyle = `rgba(150,130,100,${rnd() * .12})`; g.fillRect(i * s + rnd() * s, j * s + rnd() * s, 2, 2); } }
  });
}
function brickFacade(base = [150, 72, 52], seed = 3) {
  const rnd = seeded(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9a8f82'; g.fillRect(0, 0, w, h);
    const bw = 256 / 4.6, bh = 256 / 14.5;
    for (let r = 0; r < 15; r++) for (let c = -1; c < 6; c++) { const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh, k = .8 + rnd() * .32; g.fillStyle = `rgb(${base.map(v => Math.round(Math.min(255, v * k))).join(',')})`; g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3); }
  });
}
function concreteTex() {
  const rnd = seeded(27);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b8b4ac'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { const v = 150 + rnd() * 60; g.fillStyle = `rgba(${v},${v},${v - 4},.3)`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    g.fillStyle = 'rgba(90,86,80,.55)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  });
}
function asphaltStreet() {
  const rnd = seeded(33);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#48484a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16000; i++) { const v = 45 + rnd() * 45; g.fillStyle = `rgba(${v},${v},${v + 2},.45)`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(20,20,22,${.1 + rnd() * .15})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 60; y += (rnd() - .5) * 60; g.lineTo(x, y); } g.stroke(); }
  });
}
/* a shop window seen from the street: dark glass with a hint of shelves and people */
function shopWindowTex(seed, tint = '#3a4046') {
  const rnd = seeded(seed);
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(${150 + rnd() * 100},${140 + rnd() * 90},${120 + rnd() * 90},.25)`; g.fillRect(rnd() * w, h * (.3 + rnd() * .5), 6 + rnd() * 30, 8 + rnd() * 30); }
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

/* ---------- pastries ---------- */
const pastryMats = {};
function pmat() {
  if (pastryMats.crust) return pastryMats;
  pastryMats.crust = mat(0xc98a44, .75); pastryMats.gold = mat(0xd9a45a, .7); pastryMats.cream = mat(0xf3ead6, .7); pastryMats.choc = mat(0x3a2418, .7);
  pastryMats.pink = mat(0xe9a0b4, .7); pastryMats.white = mat(0xf2eee6, .75); pastryMats.green = mat(0x6aa35a, .75); pastryMats.red = mat(0xb8303a, .7);
  pastryMats.bread = mat(0xc08a4c, .8); pastryMats.dark = mat(0x9a6634, .8); pastryMats.sugar = mat(0xf4f0e6, .9); pastryMats.tray = mat(0xc4c8cc, .3, .8);
  return pastryMats;
}
/* a sfogliatella: the ridged shell */
function sfogliatella(g, x, y, z, a = 0) {
  const m = pmat(), s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = a; g.add(s);
  for (let i = 0; i < 6; i++) { const r = .035 - i * .004, l = M(new THREE.CylinderGeometry(r, r, .07 - i * .006, 10, 1, false, 0, Math.PI), i % 2 ? m.crust : m.gold); l.rotation.z = Math.PI / 2; l.position.set(0, .012, -.012 + i * .006); l.scale.set(1, 1, .9); s.add(l); }
  return s;
}
function cannolo(g, x, y, z, a = 0) {
  const m = pmat(), c = new THREE.Group(); c.position.set(x, y, z); c.rotation.y = a; g.add(c);
  const t = M(new THREE.CylinderGeometry(.018, .018, .1, 10), m.gold); t.rotation.z = Math.PI / 2; c.add(t);
  for (const s of [-1, 1]) { const e = sph(c, .017, m.cream, s * .052, 0, 0, 8, 6); e.scale.x = .6; sph(c, .004, m.choc, s * .062, .006, .005, 4, 3); }
  return c;
}
function cookie(g, x, y, z, k) { const m = pmat(), mats = [m.white, m.pink, m.gold, m.choc, m.green]; const c = cyl(g, .028, .028, .012, mats[k % mats.length], x, y, z, 10); return c; }
function rainbow(g, x, y, z) { const m = pmat(); for (const [i, mm] of [[0, m.green], [1, m.white], [2, m.red]]) box(g, .05, .01, .03, mm, x, y + i * .01, z); box(g, .05, .004, .03, m.choc, x, y + .032, z); }
function roll(g, x, y, z) { const r = sph(g, .045, pmat().bread, x, y, z, 10, 7); r.scale.set(1.1, .7, 1); return r; }
function loaf(g, x, y, z, a = 0) { const l = sph(g, .07, pmat().dark, x, y, z, 12, 8); l.scale.set(3.2, .75, 1); l.rotation.y = a; return l; }
function cake(g, x, y, z, top = 'white') { const m = pmat(); cyl(g, .12, .12, .09, m.gold, x, y + .045, z, 20); cyl(g, .125, .125, .02, m[top] ?? m.white, x, y + .1, z, 20); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; sph(g, .012, m.red, x + Math.cos(a) * .09, y + .115, z + Math.sin(a) * .09, 5, 4); } }

/* ---------- the shop ---------- */
function buildShop(group) {
  const S = SHOP, ins = new THREE.Group(); ins.name = 'shop'; group.add(ins);
  const white = mat(0xe9e3d6, .85), frame = mat(0xb8bcc0, .35, .85), steel = mat(0xc9cdd1, .28, .9);
  const floorM = new THREE.MeshStandardMaterial({ map: tileTex(), roughness: .4 }); floorM.map.repeat.set((S.x1 - S.x0) / 1.2, (S.z1 - S.z0) / 1.2);
  const fl = M(new THREE.PlaneGeometry(S.x1 - S.x0, S.z1 - S.z0), floorM); fl.rotation.x = -Math.PI / 2; fl.position.set(0, .002, (S.z0 + S.z1) / 2); ins.add(fl);
  /* walls and ceiling, a baseboard */
  const wall = (w, h, x, y, z, ry) => { const o = M(new THREE.PlaneGeometry(w, h), white); o.position.set(x, y, z); o.rotation.y = ry; ins.add(o); return o; };
  wall(S.z1 - S.z0, S.h, S.x0, S.h / 2, (S.z0 + S.z1) / 2, Math.PI / 2); wall(S.z1 - S.z0, S.h, S.x1, S.h / 2, (S.z0 + S.z1) / 2, -Math.PI / 2); wall(S.x1 - S.x0, S.h, 0, S.h / 2, S.z0, 0);
  const ceil = M(new THREE.PlaneGeometry(S.x1 - S.x0, S.z1 - S.z0), mat(0xf4f3ee, .9)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, S.h, (S.z0 + S.z1) / 2); ins.add(ceil);
  for (const [x, z, w, d] of [[S.x0 + .01, -4.2, .02, 8.4], [S.x1 - .01, -4.2, .02, 8.4], [0, S.z0 + .01, 6.6, .02]]) box(ins, w, .12, d, mat(0x6a5a4a, .7), x, .06, z);
  /* the lights in the ceiling: long fluorescent panels */
  const glowM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2e0, emissiveIntensity: 1.1 });
  for (const z of [-1.6, -4.1, -6.6]) box(ins, .5, .04, 1.3, glowM, 0, S.h - .03, z).castShadow = false;
  for (const z of [-2.2, -6.4]) { const L = new THREE.PointLight(0xfff0dc, 3, 9, 1.4); L.position.set(0, S.h - .35, z); ins.add(L); }

  /* the glass front: aluminium frames, two big panes, the door with its sign, the transom */
  const glassM = new THREE.MeshStandardMaterial({ color: 0xcfe0e4, roughness: .02, metalness: .05, transparent: true, opacity: .14, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide });
  const pane = (x0, x1, y0, y1) => { const g = M(new THREE.PlaneGeometry(x1 - x0, y1 - y0), glassM); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, -.02); g.castShadow = false; g.receiveShadow = false; g.userData.keep = true; g.renderOrder = 3; ins.add(g); return g; };
  pane(S.x0, -.62, .55, 2.55); pane(.62, S.x1, .55, 2.55); pane(S.x0, -.62, 2.6, 3.1); pane(.62, S.x1, 2.6, 3.1); pane(-.62, .62, 2.3, 3.1);
  for (const x of [S.x0 + .03, -.62, .62, S.x1 - .03]) box(ins, .07, 3.12, .09, frame, x, 1.56, -.03);
  for (const [y, x0, x1] of [[.55, S.x0, -.62], [.55, .62, S.x1], [2.57, S.x0, S.x1], [3.12, S.x0, S.x1], [2.28, -.62, .62]]) box(ins, x1 - x0, .06, .09, frame, (x0 + x1) / 2, y, -.03);
  /* the door: hinged on its left, a push bar, the sign on a string */
  const door = new THREE.Group(); door.name = 'door'; door.position.set(-.58, 0, -.03); ins.add(door); door.userData.keep = true;
  box(door, 1.16, .07, .06, frame, .58, .04, 0); box(door, 1.16, .07, .06, frame, .58, 2.22, 0); box(door, .07, 2.25, .06, frame, .04, 1.12, 0); box(door, .07, 2.25, .06, frame, 1.12, 1.12, 0);
  const dg = M(new THREE.PlaneGeometry(1.06, 2.12), glassM); dg.position.set(.58, 1.13, 0); dg.castShadow = false; dg.renderOrder = 3; door.add(dg);
  box(door, .8, .04, .05, steel, .58, 1.02, -.07); box(door, .8, .04, .05, steel, .58, 1.02, .07);
  const sign = new THREE.Group(); sign.name = 'sign'; sign.position.set(.58, 1.62, -.06); door.add(sign);
  tube(sign, V(-.14, .19, 0), V(0, .3, 0), .003, mat(0x333, .6)); tube(sign, V(.14, .19, 0), V(0, .3, 0), .003, mat(0x333, .6));
  const open = new THREE.MeshStandardMaterial({ roughness: .6, map: labelTex([["WE'RE", 34, 42, 'bold', '#c81c1c'], ['OPEN', 58, 92, 'bold', '#c81c1c']], '#f6f3ec', '#c81c1c', 256, 128) });
  const closed = new THREE.MeshStandardMaterial({ roughness: .6, map: labelTex([['CLOSED', 56, 60, 'bold', '#141414'], ['BUSINESS HOURS', 16, 102, 'bold', '#141414']], '#f6f3ec', '#141414', 256, 128) });
  /* open for business: the street reads WE'RE OPEN and the shop reads CLOSED; turned over, the other way round */
  const sf = M(new THREE.PlaneGeometry(.34, .18), open); sf.position.z = .004; sign.add(sf);
  const sb = M(new THREE.PlaneGeometry(.34, .18), closed); sb.rotation.y = Math.PI; sb.position.z = -.004; sign.add(sb);
  sign.userData.front = sf; sign.userData.back = sb;
  /* the ledge under the windows inside: a wide white sill; the radiator cabinet under the right one */
  box(ins, S.x1 - .62, .5, .42, white, (S.x1 + .62) / 2, .25, -.24); box(ins, S.x1 - .62 + .04, .05, .5, mat(0xf4f2ec, .6), (S.x1 + .62) / 2, .52, -.26);
  const rad = new THREE.MeshStandardMaterial({ roughness: .6, map: canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#eceae4'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(80,80,80,.45)'; for (let x = 6; x < w - 4; x += 6) g.fillRect(x, 10, 2, h - 20); }) });
  box(ins, -.62 - S.x0, .5, .42, rad, (S.x0 - .62) / 2, .25, -.24); box(ins, -.62 - S.x0 + .04, .05, .5, mat(0xf4f2ec, .6), (S.x0 - .62) / 2, .52, -.26);
  /* cookies on trays along the right ledge */
  const trays = new THREE.Group(); ins.add(trays);
  for (const x of [-1.2, -1.9, -2.6]) { box(trays, .5, .02, .34, pmat().tray, x, .56, -.26); for (let i = 0; i < 12; i++) cookie(trays, x - .2 + (i % 4) * .13, .575, -.36 + Math.floor(i / 4) * .1, i); }
  /* the mat inside the door */
  box(ins, 1.35, .012, .85, mat(0x5e605e, .95), 0, .006, -.62).castShadow = false;
  /* the red double gumball machine on its pole by the door */
  const gum = new THREE.Group(); gum.name = 'gumball'; gum.position.set(.98, 0, -.52); gum.userData.keep = true; ins.add(gum);
  cyl(gum, .18, .2, .03, mat(0x151515, .5, .3), 0, .015, 0, 16); cyl(gum, .025, .025, 1.05, mat(0x151515, .5, .3), 0, .53, 0, 8);
  const red = mat(0xc2141c, .35, .1); box(gum, .36, .2, .2, red, 0, 1.12, 0);
  for (const x of [-.09, .09]) { const gl = sph(gum, .085, new THREE.MeshStandardMaterial({ color: 0xe8f4f0, transparent: true, opacity: .35, roughness: .05 }), x, 1.3, 0, 12, 10); gl.castShadow = false; for (let i = 0; i < 14; i++) sph(gum, .016, mat(0x3aa04a, .4), x + (Math.random() - .5) * .1, 1.26 + Math.random() * .06, (Math.random() - .5) * .1, 5, 4); box(gum, .07, .05, .04, mat(0xd9d9d9, .3, .9), x, 1.09, .11); }
  box(gum, .38, .04, .22, red, 0, 1.4, 0);

  /* the counter: a glass case of pastry, the top, the ticket machine, the scale, the register, boxes */
  const cz = S.counterZ, cx0 = -2.1, cx1 = 2.95, cw = cx1 - cx0;
  const cnt = new THREE.Group(); cnt.name = 'counter'; ins.add(cnt);
  box(cnt, cw, .3, .72, mat(0x8a6a4a, .7), (cx0 + cx1) / 2, .15, cz);                      /* the wooden base */
  box(cnt, cw, .06, .74, steel, (cx0 + cx1) / 2, 1.0, cz);                                   /* the top */
  const caseG = M(new THREE.PlaneGeometry(cw, .66), glassM); caseG.position.set((cx0 + cx1) / 2, .64, cz + .36); caseG.castShadow = false; caseG.renderOrder = 3; cnt.add(caseG);
  for (const x of [cx0, cx1]) box(cnt, .05, 1.0, .74, mat(0x8a6a4a, .7), x, .5, cz);
  for (const y of [.42, .7]) box(cnt, cw - .1, .02, .6, mat(0xf2f2ee, .5), (cx0 + cx1) / 2, y, cz);
  box(cnt, cw, .05, .05, steel, (cx0 + cx1) / 2, .32, cz + .35);
  /* the pastry in the case: sfogliatelle, cannoli, cookies, the tricolour cookies */
  const inCase = new THREE.Group(); inCase.name = 'case'; cnt.add(inCase);
  const slots = {};
  const tray = (x, y, kind) => {
    box(inCase, .55, .015, .4, pmat().tray, x, y + .01, cz);
    /* three rows of four; a pick takes a row, so each row is one merged piece */
    const g = new THREE.Group(); g.name = kind; g.userData.keep = true; inCase.add(g);
    const base = kind.replace(/[0-9]$/, '');
    for (let row = 0; row < 3; row++) {
      const r = new THREE.Group(); g.add(r);
      for (let c = 0; c < 4; c++) {
        const i = row * 4 + c, px = x - .21 + c * .14, pz = cz - .13 + row * .13, py = y + .025;
        if (base === 'sfogliatelle') sfogliatella(r, px, py, pz, .3); else if (base === 'cannoli') cannolo(r, px, py + .015, pz, .1); else if (base === 'cookies') cookie(r, px, py, pz, i); else rainbow(r, px, py, pz);
      }
      r.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      bakeStatic(r); r.userData.keep = true;
    }
    slots[kind] = { at: V(x, y + .05, cz), g };
  };
  tray(2.4, .44, 'sfogliatelle'); tray(1.7, .44, 'cannoli'); tray(1.0, .44, 'cookies'); tray(.3, .44, 'rainbow');
  tray(2.4, .72, 'cannoli2'); tray(1.7, .72, 'sfogliatelle2'); tray(-.4, .44, 'cookies2'); tray(-1.1, .44, 'sfogliatelle3');
  /* the ticket machine: cream, a red slot; the white dial scale; the tape; the register; boxes */
  const tk = new THREE.Group(); tk.name = 'tickets'; tk.position.set(2.55, 1.03, cz + .22); cnt.add(tk);
  rbox(tk, .16, .22, .14, .03, mat(0xe8e0c8, .6), 0, .11, 0); box(tk, .07, .02, .02, mat(0xc01818, .4), 0, .15, .072); box(tk, .05, .06, .005, mat(0xf4efe0, .8), 0, .07, .073);
  const sc = new THREE.Group(); sc.name = 'scale'; sc.position.set(1.9, 1.03, cz - .05); cnt.add(sc);
  box(sc, .34, .06, .3, white, 0, .03, 0); cyl(sc, .03, .04, .22, white, 0, .17, -.08, 10);
  const dial = new THREE.MeshStandardMaterial({ roughness: .5, map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f7f6f2'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28; g.beginPath(); g.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); g.lineTo(64 + Math.cos(a) * (i % 5 ? 56 : 60), 64 + Math.sin(a) * (i % 5 ? 56 : 60)); g.stroke(); } g.lineWidth = 3; g.strokeStyle = '#b01010'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 20); g.stroke(); }) });
  const face = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .06, 28), [white, white, dial]); face.rotation.x = Math.PI / 2; face.position.set(0, .38, -.08); sc.add(face); face.castShadow = true;
  box(sc, .36, .02, .32, steel, 0, .075, .02);
  box(cnt, .12, .1, .08, mat(0x2a58b8, .5), 1.35, 1.08, cz - .15);                           /* the blue tape dispenser */
  const reg = new THREE.Group(); reg.position.set(-.95, 1.03, cz - .1); cnt.add(reg);
  box(reg, .36, .14, .34, mat(0xd8d2c0, .6), 0, .07, 0); const rt = box(reg, .3, .12, .16, mat(0x3a3a3c, .5), 0, .2, -.06); rt.rotation.x = -.5; box(reg, .12, .06, .02, mat(0x1a3a1a, .3), 0, .3, -.12);
  for (let i = 0; i < 5; i++) box(cnt, .36, .08, .28, mat(0xf6f4ee, .8), -1.65, 1.07 + i * .08, cz - .12);   /* white boxes, folded flat and stacked */
  /* a half door into the back, at the right end of the counter */
  box(ins, .06, 1.0, .06, mat(0x8a6a4a, .7), cx0 - .03, .5, cz);

  /* behind the counter: the wooden cabinets with glass fronts, cakes and pastry on the shelves; racks of bread */
  const back = new THREE.Group(); back.name = 'back'; ins.add(back);
  const wood = mat(0x7a5536, .6), shelf = mat(0xefeae0, .6);
  const cabX0 = -1.9, cabX1 = 3.15;
  box(back, cabX1 - cabX0, 2.3, .03, wood, (cabX0 + cabX1) / 2, 1.15, S.z0 + .03); for (const x of [cabX0, cabX1]) box(back, .04, 2.3, .52, wood, x, 1.15, S.z0 + .27);
  box(back, cabX1 - cabX0, .08, .52, wood, (cabX0 + cabX1) / 2, 2.34, S.z0 + .27); box(back, cabX1 - cabX0, .3, .52, wood, (cabX0 + cabX1) / 2, .15, S.z0 + .27);
  for (const y of [.55, 1.05, 1.55, 2.0]) box(back, cabX1 - cabX0 - .1, .02, .44, shelf, (cabX0 + cabX1) / 2, y, S.z0 + .3);
  const cg = M(new THREE.PlaneGeometry(cabX1 - cabX0 - .1, 2.0), glassM); cg.position.set((cabX0 + cabX1) / 2, 1.3, S.z0 + .53); cg.castShadow = false; cg.renderOrder = 3; back.add(cg);
  for (let i = 0; i <= 5; i++) box(back, .04, 2.2, .04, wood, cabX0 + .05 + i * (cabX1 - cabX0 - .1) / 5, 1.15, S.z0 + .52);
  const shelves = new THREE.Group(); shelves.name = 'shelves'; back.add(shelves);
  for (let i = 0; i < 5; i++) {
    const x = cabX0 + .55 + i * 1.02;
    cake(shelves, x - .15, 1.56, S.z0 + .3, i % 2 ? 'pink' : 'white'); cake(shelves, x + .18, 2.01, S.z0 + .3, i % 2 ? 'white' : 'choc');
    for (let k = 0; k < 6; k++) (k % 2 ? cannolo : sfogliatella)(shelves, x - .3 + k * .12, 1.08, S.z0 + .3, 0);
    for (let k = 0; k < 5; k++) roll(shelves, x - .28 + k * .14, .6, S.z0 + .28);
  }
  /* photos pinned to the cabinet frames, a calendar, a round clock high on the wall */
  const photo = seeded(8);
  for (let i = 0; i < 9; i++) { const pm = mat([0xc8b8a0, 0x9aa8b8, 0xd8c8b0, 0xb0a090][i % 4], .7); const p = box(back, .1, .14, .005, pm, cabX0 + .2 + photo() * 4.6, .6 + photo() * 1.6, S.z0 + .56); p.rotation.z = (photo() - .5) * .3; }
  box(back, .36, .48, .01, new THREE.MeshStandardMaterial({ roughness: .8, map: labelTex([['1998', 30, 20], ['JULY', 22, 50]], '#f4f0e6', '#a0181c', 128, 160) }), -2.5, 1.9, S.z0 + .02);
  const clk = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .04, 28), [white, white, dial]); clk.rotation.x = Math.PI / 2; clk.position.set(1.2, 2.72, S.z0 + .03); back.add(clk);
  /* stainless racks of bread and rolls at the right; open shelves of loaves on the left wall */
  for (const x of [-2.45, -3.0]) {
    for (const [px, pz] of [[-.24, -.2], [.24, -.2], [-.24, .2], [.24, .2]]) cyl(back, .012, .012, 1.9, steel, x + px * .9, .95, -6.9 + pz * 1.6, 6);
    for (let k = 0; k < 7; k++) { const y = .25 + k * .24; box(back, .5, .015, .7, steel, x, y, -6.9); for (let i = 0; i < 6; i++) roll(back, x - .18 + (i % 3) * .18, y + .04, -7.1 + Math.floor(i / 3) * .35); }
  }
  for (let k = 0; k < 4; k++) { const y = .6 + k * .45; box(back, .4, .02, 2.2, shelf, S.x1 - .21, y, -6.4); for (let i = 0; i < 4; i++) loaf(back, S.x1 - .2, y + .06, -7.2 + i * .52, Math.PI / 2); }
  ins.traverse(o => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; if (o.isMesh) o.receiveShadow = true; });
  return { ins, door, sign, slots, glassM, tickets: tk, gum, trays, counter: cnt, shelves, open, closed };
}

/* ---------- the street ---------- */
function buildStreet(group) {
  const g = new THREE.Group(); g.name = 'street'; group.add(g);
  const Z0 = 4.5, Z1 = 19.5, L = 320;
  const asp = new THREE.MeshStandardMaterial({ map: asphaltStreet(), roughness: .85 }); asp.map.repeat.set(L / 12, (Z1 - Z0) / 12);
  const road = M(new THREE.PlaneGeometry(L, Z1 - Z0), asp); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, (Z0 + Z1) / 2); road.castShadow = false; g.add(road);
  const paint = mat(0xe8e6de, .6), yellow = mat(0xd8b23a, .6);
  box(g, L, .003, .12, yellow, 0, .004, 11.93).castShadow = false; box(g, L, .003, .12, yellow, 0, .004, 12.13).castShadow = false;
  for (let x = -L / 2; x < L / 2; x += 9) for (const z of [8.3, 15.8]) box(g, 3, .003, .12, paint, x, .004, z).castShadow = false;
  /* the crosswalk just outside the door */
  for (let z = Z0 + .5; z < Z1 - .4; z += .9) box(g, 3.2, .004, .45, paint, 1.2, .005, z).castShadow = false;
  for (const x of [-.5, 2.9]) box(g, .25, .004, Z1 - Z0 - .6, paint, x, .005, (Z0 + Z1) / 2).castShadow = false;
  /* sidewalks and curbs */
  const conc = new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: .9 }); conc.map.repeat.set(L / 1.5, 4.5 / 1.5);
  for (const [za, zb] of [[0, Z0], [Z1, Z1 + 4.5]]) { const s = M(new THREE.BoxGeometry(L, .15, zb - za), conc); s.position.set(0, .075, (za + zb) / 2); s.castShadow = false; g.add(s); }
  const curb = mat(0x9a9894, .8); box(g, L, .16, .15, curb, 0, .08, Z0 - .07); box(g, L, .16, .15, curb, 0, .08, Z1 + .07);
  /* the ground past the buildings */
  const far = M(new THREE.PlaneGeometry(2000, 2000), mat(0x5a5a52, .95)); far.rotation.x = -Math.PI / 2; far.position.y = -.05; far.receiveShadow = false; far.castShadow = false; g.add(far);
  return { g, Z0, Z1 };
}
/* a row of three-storey brick shop buildings along one side of the avenue; the bakery sits in the near row */
function shopRow(group, { z, facing, x0, x1, skip = null, shops, seed }) {
  const g = new THREE.Group(); group.add(g);
  const rnd = seeded(seed);
  let x = x0;
  const winM = new THREE.MeshStandardMaterial({ color: 0x2c3438, roughness: .08, metalness: .3, envMapIntensity: 1.4 });
  let k = 0;
  while (x < x1) {
    const w = 7 + Math.floor(rnd() * 4) * 1.5, h = 9.5 + rnd() * 3.5, xc = x + w / 2;
    if (skip && xc > skip[0] - w / 2 && xc < skip[1] + w / 2) { x = skip[1]; continue; }
    const bm = new THREE.MeshStandardMaterial({ map: brickFacade([[150, 72, 52], [170, 110, 80], [120, 60, 48], [185, 150, 120]][k % 4], seed + k), roughness: .9 }); bm.map.repeat.set(w / 2, h / 2);
    const b = new THREE.Group(); b.position.set(xc, 0, z); b.rotation.y = facing; g.add(b);
    box(b, w, h, 12, bm, 0, h / 2, -6);
    /* the shopfront at street level: dark glass, a door, an awning or a sign band */
    const sh = shops[k % shops.length];
    box(b, w - .6, 2.6, .1, new THREE.MeshStandardMaterial({ map: shopWindowTex(seed * 7 + k), roughness: .12, metalness: .2 }), 0, 1.5, .05);
    if (sh.awning) {
      const aw = new THREE.MeshStandardMaterial({ roughness: .8, color: 0xffffff, side: THREE.DoubleSide, map: labelTex([[sh.name, 44, 64, 'bold', sh.text ?? '#f6f2ea']], sh.awning, sh.text ?? '#f6f2ea', 512, 128) });
      const a = M(new THREE.PlaneGeometry(w - .8, 1.3), aw); a.position.set(0, 3.25, .55); a.rotation.x = -.95; b.add(a);
    } else box(b, w - .6, .7, .12, new THREE.MeshStandardMaterial({ roughness: .6, map: labelTex([[sh.name, 58, 64, 'bold', sh.text ?? '#1a1a1a']], sh.band ?? '#f0ece2', sh.text ?? '#1a1a1a', 512, 128) }), 0, 3.25, .07);
    /* the windows of the flats above */
    const cols = Math.max(2, Math.floor(w / 2.3));
    for (let fl = 1; fl < 3; fl++) for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + (c + .5) * w / cols, wy = 3.4 + fl * 2.7 - 1.2;
      box(b, 1.0, 1.5, .08, winM, wx, wy, .03); box(b, 1.14, .08, .16, mat(0xe8e2d4, .7), wx, wy - .8, .06); box(b, 1.1, .12, .1, mat(0xd8d0c0, .7), wx, wy + .8, .05);
    }
    box(b, w + .02, .35, .3, mat(0xd8d0c0, .8), 0, h - .15, .05);
    x += w; k++;
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export async function load({ status } = {}) {
  status && (status.textContent = 'Parking on Ridge Road…');
  const near = new THREE.Group(), far = new THREE.Group();
  const T = { name: 'bakery', heightAt: () => 0, rings: [], meshes: [], skyline: null };
  const shop = buildShop(near);
  const street = buildStreet(near);
  /* the bakery's own building: brick above the glass, a sign band, the flats' windows */
  {const b = new THREE.Group(); near.add(b);
   const bm = new THREE.MeshStandardMaterial({ map: brickFacade([176, 116, 84], 41), roughness: .9 }); bm.map.repeat.set(4, 4);
   box(b, 7.4, 6.8, .3, bm, 0, 3.3 + 3.4, -.1);
   box(b, .35, 3.3, .3, bm, SHOP.x0 - .17, 1.65, -.1); box(b, .35, 3.3, .3, bm, SHOP.x1 + .17, 1.65, -.1);
   box(b, 7.0, .72, .14, new THREE.MeshStandardMaterial({ roughness: .6, map: labelTex([['BAKERY', 64, 64, 'bold', '#f4efe2']], '#6b1d1d', '#f4efe2', 512, 128) }), 0, 3.62, .08);
   const winM = new THREE.MeshStandardMaterial({ color: 0x2c3438, roughness: .08, metalness: .3, envMapIntensity: 1.4 });
   for (const fl of [0, 1]) for (const x of [-2.2, 0, 2.2]) { box(b, 1.0, 1.45, .06, winM, x, 5.2 + fl * 2.7, .06); box(b, 1.14, .08, .16, mat(0xe8e2d4, .7), x, 5.2 + fl * 2.7 - .78, .1); }
   /* the building's sides and the roof, so the shop is a closed box from inside */
   box(b, .3, 10.1, 9, bm, SHOP.x0 - .35, 5.05, -4.3); box(b, .3, 10.1, 9, bm, SHOP.x1 + .35, 5.05, -4.3); box(b, 7.4, .3, 9, mat(0x55504a, .9), 0, 10.1, -4.3); box(b, 7.4, 10.1, .3, bm, 0, 5.05, -8.7);
   box(b, 7.4, .3, 9, mat(0xf4f3ee, .9), 0, 3.35, -4.3);
   b.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });}
  /* the avenue: the near row round the bakery, the row across with the nail salon's purple awning */
  const shopsNear = [{ name: 'DELI', band: '#eae4d4' }, { name: 'BARBER', band: '#1e3a6a', text: '#f4f0e6' }, { name: 'SHOE REPAIR', band: '#eae4d4' }, { name: 'LIQUORS', band: '#2a2a2a', text: '#e8c860' }, { name: 'TAILOR', band: '#eae4d4' }];
  const shopsFar = [{ name: 'NAILS', awning: '#6a2a8a' }, { name: 'PHOTO', band: '#f0ece2', text: '#c81c1c' }, { name: 'PIZZA', awning: '#1f6a3a' }, { name: 'CLEANERS', band: '#eae4d4' }, { name: 'PHARMACY', awning: '#1f5a3a' }, { name: 'BAGELS', band: '#eae4d4' }];
  shopRow(near, { z: -.05, facing: 0, x0: -80, x1: 80, skip: [SHOP.x0 - .6, SHOP.x1 + .6], shops: shopsNear, seed: 5 });
  shopRow(near, { z: street.Z1 + 4.55, facing: Math.PI, x0: -80, x1: 80, shops: shopsFar, seed: 11 });
  /* poles and wires along the far curb, street trees in pits */
  const pole = mat(0x5a4a3a, .9), wire = mat(0x1a1a1a, .6), wires = new THREE.Group(); near.add(wires);
  const poles = []; for (let x = -75; x <= 75; x += 30) { cyl(wires, .13, .16, 10, pole, x, 5, street.Z1 + 1.2, 8); box(wires, 1.8, .12, .12, pole, x, 9.3, street.Z1 + 1.2); poles.push(x); }
  for (let i = 0; i < poles.length - 1; i++) for (const dz of [-.8, 0, .8]) { const a = V(poles[i], 9.35, street.Z1 + 1.2 + dz * .9), b = V(poles[i + 1], 9.35, street.Z1 + 1.2 + dz * .9), m = a.clone().lerp(b, .5); m.y -= .6; tube(wires, a, m, .012, wire); tube(wires, m, b, .012, wire); }
  const trees = [];
  for (let x = -70; x <= 70; x += 11) { if (Math.abs(x - 1) < 6) continue; trees.push({ x, z: 3.4, y: .15, kind: 'maple', v: Math.abs(x) % 3, s: .55 + ((x * 7) % 5) * .04, a: x, tint: .95, thin: 0 }); trees.push({ x: x + 5, z: street.Z1 + 1.2 + 2.2, y: .15, kind: 'oak', v: Math.abs(x) % 4, s: .45 + ((x * 3) % 5) * .04, a: x * 2, tint: .95, thin: 0 }); }
  const forest = new Forest(trees, { season: 'summer', snow: 0, near: 60, mid: 180, far: 400 });
  near.add(forest.group);
  /* parked cars along both curbs; traffic that passes */
  const parked = [];
  const put = (car, x, z, ry) => { car.position.set(x, 0, z); car.rotation.y = ry; car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); near.add(car); parked.push(car); return car; };
  put(cadillac(0x7a1c1c), -9, 5.6, Math.PI / 2); put(suburban(0x1e2a3a), 8.5, 5.7, Math.PI / 2); put(cadillac(0xd8d4cc), 15, 5.6, Math.PI / 2);
  put(econoline(0xf0f0ec), -14, 18.4, -Math.PI / 2); put(cadillac(0x2a4a6a), 6, 18.4, -Math.PI / 2); put(suburban(0x6a6a6a), 22, 18.4, -Math.PI / 2);
  const traffic = [];
  const colors = [0xe8e6e0, 0x2a3a5a, 0x8a2a24, 0x3a3a3c, 0xc9b890, 0x5a6a4a];
  for (let i = 0; i < 6; i++) { const c = (i % 2 ? suburban : cadillac)(colors[i]); c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); near.add(c); traffic.push({ car: c, lane: i % 2 ? 1 : 0, x: -150 + i * 55, speed: 9 + (i % 3) * 1.5 }); }
  app.onUpdate(dt => {
    if (app.place?.id !== 'bakery') return;
    for (const t of traffic) {
      t.x += t.speed * dt * (t.lane ? -1 : 1); if (t.x > 160) t.x = -160; if (t.x < -160) t.x = 160;
      /* they stop for someone in the crosswalk */
      t.car.position.set(t.x, 0, t.lane ? 10.2 : 13.9); t.car.rotation.y = t.lane ? -Math.PI / 2 : Math.PI / 2;
    }
  }, 22);
  const groups = { near, far };
  bakeStatic(shop.ins);
  /* the street, the rows of buildings, the poles: one mesh per material */
  for (const c of near.children.slice()) if (c !== shop.ins && !c.userData.keep && !parked.includes(c) && !traffic.some(t => t.car === c) && c !== forest.group && c.isGroup) bakeStatic(c);
  /* each car in one piece, parked or driving */
  for (const c of [...parked, ...traffic.map(t => t.car)]) { c.userData.keep = false; bakeStatic(c); c.userData.keep = true; }
  const place = {
    id: 'bakery', P, T, groups, shop, street, forest, trees,
    views: {
      counter: { label: 'The counter', icon: '<path d="M3 14h18v6H3zM5 14V9h14v5"/><path d="M8 9V6h8v3"/>', get: () => ({ pos: V(.6, 1.62, -1.1), target: V(1.2, 1.2, -5.2), fov: 60 }) },
      window: { label: 'The window', icon: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16M3 12h18"/>', get: () => ({ pos: V(-.9, 1.6, -4.0), target: V(.4, 1.1, .2), fov: 60 }) },
      ledge: { label: 'The ledge', icon: '<path d="M3 16h18M5 16v4M19 16v4M7 12h10"/>', get: () => ({ pos: V(2.4, 1.05, -.35), target: V(-.6, 1.1, -5), fov: 60 }) },
      street: { label: 'The street', icon: '<path d="M4 20l4-16M20 20l-4-16M12 6v2M12 12v2M12 18v2"/>', get: () => ({ pos: V(9, 1.7, 19), target: V(0, 2.2, 0), fov: 45 }) },
      above: { label: 'From above', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>', get: () => ({ pos: V(14, 28, 30), target: V(0, 1, 6), fov: 40 }) },
    },
    viewOrder: ['counter', 'window', 'ledge', 'street', 'above'], startView: 'counter',
    orbit: { x: 0, z: 4, r: 60 }, fov: 50, minEye: .3, turntable: false,
    walkStart: { pos: V(.2, 0, -1.2), yaw: 0 },
    solidsNear: () => [],
    boxes: [[-2.15, 3.0, SHOP.counterZ - .38, SHOP.counterZ + .38], [SHOP.x0 - 1, SHOP.x0 + .45, -8.4, 0], [SHOP.x1 - .45, SHOP.x1 + 1, -8.4, 0], [SHOP.x0, -.62, -.46, .5], [.62, SHOP.x1, -.46, .5], [.76, 1.2, -.74, -.3],
      [-80, SHOP.x0 - .5, -12.2, .1], [SHOP.x1 + .5, 80, -12.2, .1], [-80, 80, 24.0, 36.2]],
    floorAt: () => 0,
    bound: p => { p.x = Math.max(-40, Math.min(40, p.x)); p.z = Math.max(-8.1, Math.min(22, p.z)); },
    surfaceAt: () => 1, noAO: [],
    help: [['Space', 'It happens: take a number, and wait.'], ['E', 'Take, sit, turn the sign, point at pastry']],
    walkHelp: (mode, locked) => mode === 'game' ? (app.touch ? 'Left thumb to move · right thumb to look · USE and FIRE' : locked ? '' : 'Click to look with the mouse · WASD to move · E to use · click to shoot') : null,
    enter() {
      forest.update(true);
      want(['amb-street', 'shop', 'bell', 'ticket', 'bag', 'boxfold', 'register', 'pistol', 'glass', 'tray', 'door', 'slipper']);
    },
    sound() {
      const inside = app.camera.position.z < 0 && app.camera.position.z > SHOP.z0;
      loop('amb-street').set(inside ? .35 : .85);
      loop('shop', { pos: V(0, 1.5, -5), ref: 4 }).set(inside ? .45 : .1);
    },
    leave() { place.act?.stop?.(); stopLoops('amb-'); stopLoops('shop'); },
  };
  place.act = buildBakeryMoment(place);
  hotspot(shop.gum, { title: 'The gumball machine', text: 'Red, two globes of green gum, on a pole by the door. Christopher waits on the ledge next to it.' });
  hotspot(shop.sign, { title: 'The sign on the door', text: 'WE’RE OPEN on one side, CLOSED on the other. Christopher walks Gino out and turns it.' });
  app.on('step', e => { if (app.place !== place) return; const you = e.who === 'you'; slice('slipper', 4, .55, { pos: you ? null : V(e.pos.x, .1, e.pos.z), ref: 3, gain: you ? .25 : .35 }); });
  void tod;
  return place;
}
