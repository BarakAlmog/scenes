import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { rbox, box, sph, cyl, mat, clamp, damp, wrapAngle, lerp, smooth } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { makeFigure, hairMat, roundGlasses } from './rig.js';
import { hotspot } from '../ctrl/hotspots.js';
import { say } from '../ui/bubbles.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const cast = {};
export const SEATS = {
  newman: { pos: V(-1.38, 0, -1.45), rot: Math.PI / 2, hy: .54 },
  kramer: { pos: V(.45, 0, -1.45), rot: -Math.PI / 2, hy: .54 },
  elaine: { pos: V(-1.5, 0, .45), rot: 0, hy: .62 },
  george: { pos: V(-3.69, 0, .745), rot: 1.12, hy: .62 },
};
export const BOARD = V(-.45, .8, -1.45);
const TV = V(-1.72, .8, 2.28);

const tmp = V(), tgt = V();

/* heads turn toward a focus point; idle offsets ride on top */
function look(ch, dt) {
  const r = ch.rig;
  let yaw = 0, pitch = 0;
  const f = app.time < ch.reactUntil && cast.kramer?.visible ? cast.kramer.rig.headPos(tgt) : ch.focus?.();
  if (f) {
    r.head.getWorldPosition(tmp);
    const dx = f.x - tmp.x, dz = f.z - tmp.z, dy = f.y - tmp.y;
    yaw = clamp(wrapAngle(Math.atan2(dx, dz) - r.root.rotation.y - r.spine.rotation.y), -1.25, 1.25);
    pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -.45, .45);
  }
  ch.yaw = damp(ch.yaw, yaw, ch.turn ?? 5, dt); ch.pitch = damp(ch.pitch, pitch, ch.turn ?? 5, dt);
  r.head.rotation.set(ch.pitch + ch.idlePitch + (r.talking ? Math.sin(app.time * 11) * .05 : 0), ch.yaw + ch.idleYaw, ch.idleRoll);
}

/* every few seconds a figure picks something new to look at */
function focusCycle(options) {
  let cur = 0, next = 0;
  return () => {
    if (app.time > next) { cur = Math.floor(Math.random() * options.length); next = app.time + 3 + Math.random() * 4; }
    return options[cur]();
  };
}

const person = (rig, extra = {}) => ({ rig, yaw: 0, pitch: 0, idleYaw: 0, idlePitch: 0, idleRoll: 0, reactUntil: 0, ...extra });

export function buildCast() {
  const hairD = hairMat, skinK = mat(0xe6b28c, .75), skinN = mat(0xdfa884, .75),
    skinJ = mat(0xe8b48f, .75), skinG = mat(0xe2ab86, .75), skinE = mat(0xe9b894, .75);
  const plaidMat = new THREE.MeshStandardMaterial({ map: TX.plaid(), roughness: .92 });
  const dress = new THREE.MeshStandardMaterial({ map: TX.floral('#3a3552', '#e8c9d8', '#6d8a5a'), roughness: .9 });

  /* ---------- Kramer: lanky, blue shirt, the hair ---------- */
  const kram = makeFigure({ name: 'Kramer', wide: 1.0, thigh: .47, shin: .45, torsoH: .52, skin: skinK,
    shirt: mat(0x3454a4, .85), pants: mat(0x46413a, .85),
    hair: h => {
      const g = new THREE.Group(); h.add(g); kram_hair = g;
      rbox(g, .26, .1, .27, .03, hairD, 0, .18, -.01);
      rbox(g, .12, .13, .12, .03, hairD, -.08, .25, -.03, .3);
      rbox(g, .11, .15, .11, .03, hairD, .02, .27, .01, -.2);
      rbox(g, .1, .12, .1, .03, hairD, .09, .24, -.04, .5);
      rbox(g, .05, .1, .2, .02, hairD, 0, .1, -.13);
    } });
  const cards = new THREE.Group(); kram.armL.el.add(cards);
  for (let i = 0; i < 3; i++) box(cards, .055, .075, .004, MAT.white, -.01 + i * .018, -.27, .06, (i - 1) * .3);
  const apple = sph(kram.armR.hand, .045, mat(0xc23227, .45), 0, -.03, .03, 12, 10); apple.visible = false;
  kram.hair = kram_hair; kram.cards = cards; kram.apple = apple;
  app.root.add(kram.root);
  cast.kramer = { rig: kram, visible: true };

  /* ---------- Newman: heavy, plaid, glasses ---------- */
  const newm = makeFigure({ name: 'Newman', wide: 1.6, thigh: .4, shin: .38, skin: skinN, shirt: plaidMat, pants: mat(0x3a3a40, .85),
    hair: h => {
      rbox(h, .27, .09, .27, .03, hairD, 0, .17, -.01);
      rbox(h, .27, .13, .09, .03, hairD, 0, .07, -.13);
      rbox(h, .05, .06, .22, .02, hairD, -.12, .08, 0);
      rbox(h, .05, .06, .22, .02, hairD, .12, .08, 0);
      roundGlasses(h);
    } });
  rbox(newm.spine, .52, .36, .36, .1, plaidMat, 0, -.02, .12);
  app.root.add(newm.root);
  const S = SEATS.newman; newm.root.position.copy(S.pos); newm.root.rotation.y = S.rot;
  cast.newman = person(newm, {
    focus: focusCycle([() => BOARD, () => BOARD, () => cast.kramer.seated ? cast.kramer.rig.headPos(V()) : app.doorCenter]),
  });

  /* ---------- Jerry: at the island with his cereal ---------- */
  const jer = makeFigure({ name: 'Jerry', wide: 1.0, thigh: .42, shin: .4, skin: skinJ,
    shirt: mat(0xe4e8ef, .85), pants: mat(0x3d5a86, .85), shoes: mat(0xf1f1ec, .6),
    hair: h => {
      rbox(h, .26, .08, .27, .03, hairD, 0, .17, -.01);
      rbox(h, .2, .07, .12, .03, hairD, 0, .205, .06);
      rbox(h, .25, .14, .06, .03, hairD, 0, .08, -.12);
      for (const s of [-1, 1]) rbox(h, .035, .1, .2, .015, hairD, s * .125, .09, -.02);
    } });
  {const bowl = new THREE.Group(); jer.armL.hand.add(bowl); bowl.position.set(.02, .02, .05);
   cyl(bowl, .075, .05, .055, MAT.white, 0, .02, 0, 18);
   cyl(bowl, .068, .068, .005, mat(0xf5efe0, .5), 0, .045, 0, 18);
   for (let i = 0; i < 6; i++) sph(bowl, .012, mat(0xd99a3a, .7), Math.cos(i) * .035, .05, Math.sin(i * 1.7) * .035, 6, 5);
   const spoon = new THREE.Group(); jer.armR.hand.add(spoon); spoon.position.set(0, -.03, .03);
   box(spoon, .012, .005, .13, MAT.steel, 0, 0, .05); sph(spoon, .016, MAT.steel, 0, 0, .12, 8, 6).scale.y = .4;}
  const jp = app.island.local(-.3, .72);
  jer.root.position.copy(jp); jer.root.rotation.y = app.island.rot;
  app.root.add(jer.root);
  cast.jerry = person(jer, {
    focus: focusCycle([() => cast.elaine.rig.headPos(V()), () => cast.george.rig.headPos(V()), () => TV, () => BOARD]),
  });

  /* ---------- George: short, stocky, the armchair ---------- */
  const geo = makeFigure({ name: 'George', wide: 1.25, thigh: .36, shin: .34, torsoH: .46, skin: skinG,
    shirt: mat(0x8d9aa6, .9), pants: mat(0xb9a47e, .85), shoes: mat(0x4a3526, .6),
    hair: h => {
      rbox(h, .25, .12, .06, .025, hairD, 0, .03, -.11);
      for (const s of [-1, 1]) rbox(h, .03, .1, .17, .015, hairD, s * .12, .04, -.02);
      roundGlasses(h, .046);
    } });
  app.root.add(geo.root);
  const SG = SEATS.george; geo.root.position.copy(SG.pos); geo.root.rotation.y = SG.rot;
  cast.george = person(geo, {
    focus: focusCycle([() => cast.elaine.rig.headPos(V()), () => cast.elaine.rig.headPos(V()), () => cast.jerry.rig.headPos(V()), () => TV]),
  });

  /* ---------- Elaine: the couch, the hair ---------- */
  const ela = makeFigure({ name: 'Elaine', wide: .95, thigh: .4, shin: .38, torsoH: .48, skin: skinE,
    shirt: dress, pants: dress, shins: mat(0x2a2426, .7), shoes: mat(0x1c1a1a, .5),
    hair: h => {
      const hm = mat(0x3a2418, .9), g = new THREE.Group(); h.add(g); ela_hair = g;
      for (const [x, y, z, r] of [[0, .16, -.02, .13], [-.1, .12, -.06, .1], [.1, .12, -.06, .1], [-.13, .02, -.06, .09], [.13, .02, -.06, .09],
        [0, .08, -.13, .12], [-.09, -.06, -.1, .09], [.09, -.06, -.1, .09], [0, -.09, -.14, .1], [-.06, .17, .07, .07], [.06, .17, .07, .07],
        [-.14, -.1, -.02, .07], [.14, -.1, -.02, .07]]) sph(g, r, hm, x, y, z, 10, 8);
    } });
  rbox(ela.body, .36, .16, .46, .06, dress, 0, -.01, .19);
  rbox(ela.body, .35, .26, .05, .02, dress, 0, -.15, .42);
  ela.hair = ela_hair;
  app.root.add(ela.root);
  const SE = SEATS.elaine; ela.root.position.copy(SE.pos); ela.root.rotation.y = SE.rot;
  cast.elaine = person(ela, {
    focus: focusCycle([() => cast.george.rig.headPos(V()), () => cast.george.rig.headPos(V()), () => TV, () => cast.jerry.rig.headPos(V())]),
    shove: 1,
  });

  /* ---------- clicks ---------- */
  hotspot(jer.root, { title: 'Jerry', text: 'A stand-up comic. This is his apartment.',
    action: () => { say(jer, 'Hello, Newman.'); setTimeout(() => say(newm, 'Hello, Jerry.'), 1400); } });
  hotspot(newm.root, { title: 'Newman', text: 'A mail carrier, and Jerry’s nemesis.',
    action: () => { say(newm, 'Hello, Jerry.'); setTimeout(() => say(jer, 'Hello, Newman.'), 1400); } });
  hotspot(geo.root, { title: 'George', text: 'Jerry’s oldest friend.',
    action: () => say(geo, 'It’s not a lie if you believe it.', 3.2) });
  hotspot(ela.root, { title: 'Elaine', text: 'Jerry’s ex, and now his friend.',
    action: () => { say(ela, 'Get out!'); cast.elaine.shove = 0; } });
  hotspot(kram.root, { title: 'Kramer', text: 'He lives across the hall, in 5B.',
    action: () => say(kram, 'Giddyup!') });

  app.on('kramer:enter', () => { for (const k of ['jerry', 'newman', 'george', 'elaine']) cast[k].reactUntil = app.time + 3.4; });
  app.onUpdate(updateCast, 20);
}
let kram_hair = null, ela_hair = null;

/* ---------- per-frame idle life ---------- */
function updateCast(dt) {
  const t = app.time, calm = app.reducedMotion ? .3 : 1;

  /* Newman hunched over the board */
  {const c = cast.newman, r = c.rig;
   r.setSit(1, SEATS.newman.hy);
   r.spine.rotation.x = .13;
   r.armL.sh.rotation.set(-.9, 0, .12); r.armL.el.rotation.set(-.95, 0, 0);
   r.armR.sh.rotation.set(-.95, 0, -.12); r.armR.el.rotation.set(-.9, 0, 0);
   c.idleYaw = .14 * Math.sin(t * .55 + 2) * calm; c.idlePitch = .05 * Math.sin(t * 1.05) * calm; c.idleRoll = 0;
   look(c, dt);}

  /* Jerry eats, leaning on the island */
  {const c = cast.jerry, r = c.rig;
   r.setSit(0, 0);
   r.body.rotation.x = -.05;
   const sway = Math.sin(t * .5) * calm;
   r.legL.hip.rotation.z = .03 * sway; r.legR.hip.rotation.z = .03 * sway; r.body.position.x = .015 * sway;
   const ph = (t % 6.5) / 6.5, k = ph < .18 ? smooth(ph / .18) : ph < .3 ? 1 : ph < .46 ? 1 - smooth((ph - .3) / .16) : 0;
   r.armL.sh.rotation.set(-.62, 0, .3); r.armL.el.rotation.set(-1.45, 0, 0);
   r.armR.sh.rotation.set(-.5 - .55 * k * calm, 0, -.34 - .08 * k); r.armR.el.rotation.set(-1.25 - 1.0 * k * calm, 0, 0);
   c.idlePitch = .18 * (1 - k); c.idleYaw = 0; c.idleRoll = 0;
   look(c, dt);}

  /* George talks with his hands */
  {const c = cast.george, r = c.rig;
   r.setSit(1, SEATS.george.hy);
   r.spine.rotation.x = -.08;
   r.armL.sh.rotation.set(-.45, 0, -.18); r.armL.el.rotation.set(-.75, 0, 0);
   const g1 = Math.sin(t * 1.3) * calm, g2 = Math.sin(t * 2.1 + 1) * calm;
   r.armR.sh.rotation.set(-.75 + .22 * g1, 0, .12); r.armR.el.rotation.set(-1.1 + .45 * g2, 0, 0);
   c.idleYaw = .08 * g1; c.idlePitch = .03 * g2; c.idleRoll = .04 * Math.sin(t * .9);
   look(c, dt);}

  /* Elaine; a click makes her shove */
  {const c = cast.elaine, r = c.rig;
   c.shove = Math.min(1, c.shove + dt / .9);
   const s = c.shove < .16 ? smooth(c.shove / .16) : c.shove < .3 ? 1 : 1 - smooth((c.shove - .3) / .7);
   r.setSit(1, SEATS.elaine.hy);
   r.spine.rotation.set(-.05 + .22 * s, -.45 * s, 0);
   r.armL.sh.rotation.set(lerp(-.55, -1.45, s), 0, lerp(.16, .05, s)); r.armL.el.rotation.set(lerp(-.95, -.12, s), 0, 0);
   r.armR.sh.rotation.set(lerp(-.55, -1.45, s), 0, lerp(-.16, -.05, s)); r.armR.el.rotation.set(lerp(-.95, -.12, s), 0, 0);
   r.hair.rotation.x = .04 * Math.sin(t * 1.7) * calm; r.hair.position.y = .006 * Math.sin(t * 3.4) * calm;
   c.idleYaw = 0; c.idlePitch = .02 * Math.sin(t * .8); c.idleRoll = .05 * Math.sin(t * .6) * calm;
   look(c, dt);}
}
