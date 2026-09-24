import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { rbox, box, sph, cyl, tube, mat, clamp, damp, wrapAngle, lerp, smooth } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { makeFigure } from './rig.js';
import { hotspot } from '../ctrl/hotspots.js';
import { say } from '../ui/bubbles.js';

/* The six, and Ross in the hall with his new sofa. Blocky figures in the style of the Seinfeld set;
   each has a place, an idle loop, and a line or two when clicked. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const cast = {};
export const SEATS = {
  rachel: { pos: V(5.92, 0, .72), rot: Math.PI / 2, hy: .52 },
  chandler: { pos: V(-5.17, 0, -.52), rot: -Math.PI / 2, hy: .47 },
  joey: { pos: V(-5.17, 0, .98), rot: -Math.PI / 2, hy: .47 },
  phoebe: { hy: .55 },
  monica: { pos: V(3.02, 0, -1.47), rot: Math.PI },
  ross: { pos: V(-.35, 0, -1.75), rot: .45 },
};
const TVM = V(9.3, 1.1, -.15), TVG = V(-7.5, 1.16, .22), HALL = V(0, 1.5, -1), POT = V(2.81, 1.0, -2.03);
const tmp = V(), tgt = V();

/* heads turn toward a focus point; idle offsets ride on top */
function look(ch, dt) {
  const r = ch.rig;
  let yaw = 0, pitch = 0;
  const f = app.time < ch.reactUntil ? ch.react : ch.focus?.();
  if (f) {
    r.head.getWorldPosition(tmp);
    const dx = f.x - tmp.x, dz = f.z - tmp.z, dy = f.y - tmp.y;
    yaw = clamp(wrapAngle(Math.atan2(dx, dz) - r.root.rotation.y - r.spine.rotation.y), -1.3, 1.3);
    pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -.5, .5);
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
const head = k => () => cast[k].rig.headPos(V());
const person = (rig, extra = {}) => ({ rig, yaw: 0, pitch: 0, idleYaw: 0, idlePitch: 0, idleRoll: 0, reactUntil: 0, react: null, controlled: false, lines: [], line: 0, ...extra });

/* lines rotate on each click; the audience laughs after (bubbles.js emits 'say') */
function speak(k) {
  const c = cast[k]; if (!c.lines.length) return;
  const [text, dur] = c.lines[c.line % c.lines.length]; c.line++;
  say(c.rig, text, dur ?? 2.6);
}

/* ---------- hair ---------- */
const hair = {
  monica(h, m) {
    rbox(h, .27, .1, .28, .04, m, 0, .15, -.005);
    for (const s of [-1, 1]) { rbox(h, .05, .22, .22, .02, m, s * .13, 0, -.02); sph(h, .05, m, s * .12, -.1, .01, 10, 8); }
    rbox(h, .26, .24, .07, .03, m, 0, .02, -.12);
    rbox(h, .23, .07, .05, .02, m, 0, .1, .115);
  },
  rachel(h, m, hi) {
    rbox(h, .27, .1, .28, .04, m, 0, .15, -.005);
    for (const s of [-1, 1]) { rbox(h, .06, .3, .2, .02, s < 0 ? m : hi, s * .13, -.05, -.02); sph(h, .055, hi, s * .15, -.2, .02, 10, 8); }
    rbox(h, .27, .34, .08, .03, m, 0, -.04, -.12);
    const b = rbox(h, .15, .06, .05, .02, hi, -.05, .11, .115); b.rotation.z = .3;
    rbox(h, .1, .06, .05, .02, m, .07, .1, .115);
  },
  phoebe(h, m, hi) {
    rbox(h, .27, .09, .28, .04, m, 0, .155, -.005);
    for (const s of [-1, 1]) rbox(h, .05, .42, .18, .02, m, s * .13, -.1, -.03);
    rbox(h, .26, .54, .07, .03, m, 0, -.15, -.12);
    box(h, .05, .025, .03, hi, -.09, .12, .11);
  },
  joey(h, m) {
    rbox(h, .26, .09, .27, .03, m, 0, .165, -.01);
    const f = rbox(h, .2, .06, .1, .02, m, 0, .2, .07); f.rotation.x = -.3;
    for (const s of [-1, 1]) rbox(h, .03, .08, .16, .01, m, s * .125, .07, -.03);
    rbox(h, .25, .12, .05, .02, m, 0, .07, -.12);
  },
  chandler(h, m) {
    rbox(h, .26, .08, .27, .03, m, 0, .165, -.01);
    rbox(h, .22, .05, .08, .02, m, 0, .19, .08);
    for (const s of [-1, 1]) rbox(h, .03, .09, .18, .01, m, s * .125, .06, -.02);
    rbox(h, .25, .14, .05, .02, m, 0, .06, -.12);
  },
  ross(h, m) {
    rbox(h, .26, .09, .27, .03, m, 0, .16, -.01);
    for (const [x, z] of [[-.08, .06], [0, .08], [.08, .05], [-.06, -.04], [.05, -.05], [0, .01]]) sph(h, .045, m, x, .2, z, 8, 6);
    for (const s of [-1, 1]) rbox(h, .03, .1, .18, .01, m, s * .125, .06, -.02);
    rbox(h, .25, .15, .05, .02, m, 0, .05, -.12);
  },
};

export function buildCast() {
  const skin = c => mat(c, .75);
  const plaid = (a, b, c) => new THREE.MeshStandardMaterial({ map: TX.plaid(a, b, c), roughness: .92 });

  /* ---------- Monica: black top, an apron, at the range ---------- */
  {const hm = mat(0x17110e, .85), apron = mat(0xf1e9d6, .9);
   const r = makeFigure({ name: 'Monica', wide: .9, thigh: .4, shin: .38, torsoH: .47, skin: skin(0xf0c8a6),
     shirt: mat(0x1f1d22, .8), pants: mat(0x2e3a52, .85), shoes: mat(0x1c1a1a, .5), hair: h => hair.monica(h, hm) });
   rbox(r.spine, .3, .36, .03, .01, apron, 0, .16, .145);
   rbox(r.body, .34, .36, .03, .01, apron, 0, -.12, .15);
   const spoon = new THREE.Group(); r.armR.hand.add(spoon); spoon.position.set(0, -.02, .02);
   box(spoon, .018, .3, .018, MAT.woodHoney, 0, -.1, 0); sph(spoon, .03, MAT.woodHoney, 0, -.26, 0, 8, 6).scale.set(1, .5, 1);
   app.root.add(r.root); r.root.position.copy(SEATS.monica.pos); r.root.rotation.y = SEATS.monica.rot;
   cast.monica = person(r, { focus: focusCycle([() => POT, () => POT, head('rachel'), head('phoebe')]),
     lines: [['I KNOW!'], ['Welcome to the real world. It sucks.', 3.2]] });}

  /* ---------- Rachel: the haircut, a mini skirt and boots, on the sofa with a coffee ---------- */
  {const hm = mat(0x9a6a3a, .85), hi = mat(0xc9a064, .85), skirt = plaid('#2f3a2a', '#1a1a1a', '#8a7a5a');
   const r = makeFigure({ name: 'Rachel', wide: .88, thigh: .41, shin: .39, torsoH: .47, skin: skin(0xefc3a0),
     shirt: mat(0xf3ede2, .85), pants: skin(0xefc3a0), shins: mat(0x3a2418, .6), shoes: mat(0x2a1a12, .5), hair: h => hair.rachel(h, hm, hi) });
   rbox(r.body, .35, .2, .3, .05, skirt, 0, -.02, 0);
   const mug = new THREE.Group(); r.armR.hand.add(mug); mug.position.set(0, -.02, .05);
   cyl(mug, .045, .04, .1, mat(0xf4f1ea, .3), 0, 0, 0, 14); cyl(mug, .04, .04, .005, mat(0x5a3a22, .5), 0, .046, 0, 14);
   app.root.add(r.root); const S = SEATS.rachel; r.root.position.copy(S.pos); r.root.rotation.y = S.rot;
   cast.rachel = person(r, { mug, focus: focusCycle([head('phoebe'), head('phoebe'), head('monica'), () => TVM]),
     lines: [['No uterus, no opinion.'], ['Noooo!']] });}

  /* ---------- Phoebe: long hair, a floral dress, her guitar ---------- */
  {const hm = mat(0xe0c27a, .8), hi = mat(0xd84a8a, .5), dress = new THREE.MeshStandardMaterial({ map: TX.floral('#e8dcc8', '#6a6ab8', '#7a9a6a', 5), roughness: .9 });
   const r = makeFigure({ name: 'Phoebe', wide: .88, thigh: .42, shin: .41, torsoH: .48, skin: skin(0xf2d0ae),
     shirt: dress, sleeve: mat(0x9ab89a, .9), forearm: mat(0x9ab89a, .9), pants: dress, shins: dress, shoes: mat(0x6a4a2a, .7), hair: h => hair.phoebe(h, hm, hi) });
   rbox(r.body, .36, .16, .48, .06, dress, 0, -.01, .19);
   rbox(r.body, .35, .3, .05, .02, dress, 0, -.17, .43);
   /* the guitar across her lap */
   const g = new THREE.Group(), wood = mat(0xc88a4a, .45), dark = mat(0x3a2418, .5);
   cyl(g, .17, .17, .09, wood, 0, 0, 0, 24).rotation.x = Math.PI / 2;
   cyl(g, .13, .13, .09, wood, .2, 0, 0, 22).rotation.x = Math.PI / 2;
   cyl(g, .045, .045, .092, dark, .07, 0, .001, 16).rotation.x = Math.PI / 2;
   box(g, .46, .05, .03, dark, -.38, .0, .03); box(g, .12, .07, .03, dark, -.64, 0, .03);
   for (let i = 0; i < 4; i++) box(g, .7, .002, .002, MAT.steel, -.22, -.012 + i * .008, .05);
   r.body.add(g); g.position.set(.02, .18, .22); g.rotation.set(-.15, .35, .5);
   app.root.add(r.root); const C = app.armchair.monica;
   const back = V(Math.sin(C.rot), 0, Math.cos(C.rot)).multiplyScalar(-.06);
   r.root.position.copy(C.pos).add(back); r.root.rotation.y = C.rot;
   cast.phoebe = person(r, { guitar: g, focus: focusCycle([head('rachel'), head('rachel'), head('monica'), () => V(6.3, .6, .5)]),
     lines: [['This one’s called “Smelly Cat.”', 3], ['Oh, I wish I could, but I don’t want to.', 3.2]] });}

  /* ---------- Joey: a flannel shirt, reclined, with a sandwich ---------- */
  {const hm = mat(0x1c1510, .85), flannel = plaid('#8a2a28', '#2a1414', '#d8b8a0');
   const r = makeFigure({ name: 'Joey', wide: 1.12, thigh: .43, shin: .41, torsoH: .5, skin: skin(0xe0ad86),
     shirt: flannel, pants: mat(0x3a5078, .85), shoes: mat(0x2a2220, .6), hair: h => hair.joey(h, hm) });
   const sub = new THREE.Group(); r.armR.hand.add(sub); sub.position.set(0, -.03, .06);
   const bun = rbox(sub, .08, .07, .26, .03, mat(0xd8a868, .7), 0, 0, 0); bun.rotation.x = .2;
   box(sub, .085, .02, .24, mat(0xa8301e, .7), 0, .01, 0).rotation.x = .2;
   app.root.add(r.root); const S = SEATS.joey; r.root.position.copy(S.pos); r.root.rotation.y = S.rot;
   cast.joey = person(r, { sub, focus: focusCycle([() => TVG, () => TVG, () => TVG, head('chandler')]),
     lines: [['How you doin’?'], ['Joey doesn’t share food!']] });}

  /* ---------- Chandler: a sweater vest, the other recliner ---------- */
  {const hm = mat(0x4a3222, .85);
   const r = makeFigure({ name: 'Chandler', wide: .96, thigh: .43, shin: .41, torsoH: .5, skin: skin(0xefc6a2),
     shirt: mat(0x55624f, .9), sleeve: mat(0xf2efe8, .8), forearm: mat(0xf2efe8, .8), pants: mat(0xc2b08a, .85), shoes: mat(0x3a2a20, .6), hair: h => hair.chandler(h, hm) });
   rbox(r.spine, .16, .07, .08, .02, mat(0xf2efe8, .8), 0, .47, .1);
   app.root.add(r.root); const S = SEATS.chandler; r.root.position.copy(S.pos); r.root.rotation.y = S.rot;
   cast.chandler = person(r, { focus: focusCycle([head('joey'), () => TVG, () => TVG, head('joey')]),
     lines: [['Could this chair BE any more comfortable?', 3], ['Can I interest you in a sarcastic comment?', 3.2]] });}

  /* ---------- Ross: in the hall by the new sofa ---------- */
  {const hm = mat(0x2a1c14, .85), flannel = plaid('#2f4a3a', '#141c18', '#7a8a6a');
   const r = makeFigure({ name: 'Ross', wide: 1.02, thigh: .45, shin: .43, torsoH: .51, skin: skin(0xe6b690),
     shirt: flannel, pants: mat(0x3a3a3e, .85), shoes: mat(0x2a2220, .6), hair: h => hair.ross(h, hm) });
   app.root.add(r.root); const S = SEATS.ross; r.root.position.copy(S.pos); r.root.rotation.y = S.rot;
   cast.ross = person(r, { focus: focusCycle([() => V(1.05, 1.5, .9), () => V(-1.05, 1.5, .9), () => V(.8, .6, -2.6), () => V(0, 1.5, 4)]),
     lines: [['We were on a break!'], ['Hi.'], ['Unagi.']] });}

  /* ---------- clicks ---------- */
  const card = { monica: ['Monica', 'A chef, and the tidiest person in the building. This is her grandmother’s apartment.'],
    rachel: ['Rachel', 'Monica’s roommate since the day she left Barry at the altar.'],
    phoebe: ['Phoebe', 'Plays her guitar at Central Perk, and here.'],
    joey: ['Joey', 'An actor. Dr. Drake Ramoray on Days of Our Lives.'],
    chandler: ['Chandler', 'Something in statistical analysis and data reconfiguration.'],
    ross: ['Ross', 'Monica’s brother, a paleontologist, with a new sofa to get upstairs. Press PIVOT!'] };
  for (const k in card) hotspot(cast[k].rig.root, { title: card[k][0], text: card[k][1], action: () => { speak(k); app.emit('cast:click', k); } });

  /* everyone turns toward the hall when Ross calls */
  app.on('pivot:call', () => { for (const k of ['monica', 'phoebe', 'joey']) { cast[k].reactUntil = app.time + 3.5; cast[k].react = HALL; } });
  app.on('pivot:fall', () => { for (const k of ['monica', 'phoebe', 'joey']) { cast[k].reactUntil = app.time + 2.5; cast[k].react = V(0, 1, -4); } });
  app.onUpdate(updateCast, 20);
}

/* ---------- per-frame idle life ---------- */
export function seatedPose(c, hy, k = 1) { c.rig.setSit(k, hy); }

function updateCast(dt) {
  const t = app.time, calm = app.reducedMotion ? .3 : 1;

  /* Monica stirs the pot */
  {const c = cast.monica, r = c.rig;
   if (!c.controlled) {
     r.setSit(0, 0); r.body.rotation.x = -.02;
     const a = t * 3.1;
     r.armR.sh.rotation.set(-.95 + .12 * Math.sin(a) * calm, 0, -.2 + .12 * Math.cos(a) * calm); r.armR.el.rotation.set(-.55, 0, 0);
     r.armL.sh.rotation.set(-.35, 0, .12); r.armL.el.rotation.set(-.6, 0, 0);
     r.spine.rotation.x = .1;
     c.idleYaw = 0; c.idlePitch = .12; c.idleRoll = .03 * Math.sin(t * .8) * calm;
     look(c, dt);
   }}

  /* Rachel sips her coffee */
  {const c = cast.rachel, r = c.rig;
   if (!c.controlled) {
     r.setSit(1, SEATS.rachel.hy);
     r.spine.rotation.set(-.08, 0, 0);
     const ph = (t % 7.5) / 7.5, k = ph < .12 ? smooth(ph / .12) : ph < .3 ? 1 : ph < .42 ? 1 - smooth((ph - .3) / .12) : 0;
     r.armR.sh.rotation.set(-.6 - .55 * k * calm, 0, -.15); r.armR.el.rotation.set(-1.2 - .7 * k * calm, 0, 0);
     r.armL.sh.rotation.set(-.4, 0, .2); r.armL.el.rotation.set(-.9, 0, 0);
     r.legL.hip.rotation.y = .15; r.legR.hip.rotation.y = .15;
     c.idlePitch = -.12 * k; c.idleYaw = 0; c.idleRoll = .04 * Math.sin(t * .6) * calm;
     look(c, dt);
   }}

  /* Phoebe plays */
  {const c = cast.phoebe, r = c.rig;
   if (!c.controlled) {
     r.setSit(1, SEATS.phoebe.hy);
     r.spine.rotation.set(-.04 + .03 * Math.sin(t * 2) * calm, 0, 0);
     const strum = Math.sin(t * 8.5) * calm;
     r.armR.sh.rotation.set(-.75, 0, -.18); r.armR.el.rotation.set(-1.0 + .22 * strum, 0, .3);
     r.armL.sh.rotation.set(-1.0, .3, .5); r.armL.el.rotation.set(-1.2, 0, 0);
     c.idleYaw = .15 * Math.sin(t * .9) * calm; c.idlePitch = .06 + .05 * Math.sin(t * 2.1) * calm; c.idleRoll = .1 * Math.sin(t * 1.05) * calm;
     look(c, dt);
   }}

  /* Joey, reclined, eats */
  {const c = cast.joey, r = c.rig, rc = app.recliners.joey;
   if (!c.controlled) {
     const k = rc.k;
     r.setSit(1, SEATS.joey.hy);
     for (const L of [r.legL, r.legR]) { L.hip.rotation.x = lerp(L.hip.rotation.x, -1.45, k); L.knee.rotation.x = lerp(L.knee.rotation.x, .25, k); }
     r.spine.rotation.set(-.62 * k - .05, 0, 0);
     r.body.position.y = SEATS.joey.hy + .03 * k;
     const ph = (t % 5.5) / 5.5, e = ph < .16 ? smooth(ph / .16) : ph < .32 ? 1 : ph < .46 ? 1 - smooth((ph - .32) / .14) : 0;
     r.armR.sh.rotation.set(-.55 - .6 * e * calm, 0, -.1); r.armR.el.rotation.set(-.9 - .9 * e * calm, 0, 0);
     r.armL.sh.rotation.set(-.3, 0, .1); r.armL.el.rotation.set(-.4, 0, 0);
     c.idlePitch = .62 * k * .6 - .1 * e; c.idleYaw = 0; c.idleRoll = 0;
     look(c, dt);
   }}

  /* Chandler talks with his hands */
  {const c = cast.chandler, r = c.rig, rc = app.recliners.chandler;
   if (!c.controlled) {
     const k = rc.k;
     r.setSit(1, SEATS.chandler.hy);
     for (const L of [r.legL, r.legR]) { L.hip.rotation.x = lerp(L.hip.rotation.x, -1.45, k); L.knee.rotation.x = lerp(L.knee.rotation.x, .25, k); }
     r.spine.rotation.set(-.62 * k - .02, 0, 0);
     const g1 = Math.sin(t * 1.4) * calm, g2 = Math.sin(t * 2.3 + 1) * calm;
     r.armR.sh.rotation.set(-.7 + .25 * g1, 0, .1); r.armR.el.rotation.set(-1.0 + .4 * g2, 0, 0);
     r.armL.sh.rotation.set(-.4, 0, -.1); r.armL.el.rotation.set(-.8, 0, 0);
     c.idleYaw = .08 * g1; c.idlePitch = .62 * k * .6 + .03 * g2; c.idleRoll = .05 * Math.sin(t * .9);
     look(c, dt);
   }}

  /* Ross waits by the sofa, checks his watch */
  {const c = cast.ross, r = c.rig;
   if (!c.controlled) {
     r.setSit(0, 0);
     const ph = (t % 9) / 9, w = ph > .6 && ph < .75 ? smooth(Math.min(1, (ph - .6) / .04) * Math.min(1, (.75 - ph) / .04)) : 0;
     r.armL.sh.rotation.set(-.2 - 1.0 * w, 0, .12 + .3 * w); r.armL.el.rotation.set(-.3 - 1.2 * w, 0, 0);
     r.armR.sh.rotation.set(-.15, 0, -.1); r.armR.el.rotation.set(-.35, 0, 0);
     const sway = Math.sin(t * .6) * calm; r.body.position.x = .015 * sway; r.legL.hip.rotation.z = .03 * sway; r.legR.hip.rotation.z = .03 * sway;
     c.idlePitch = w ? .5 * w : 0; c.idleYaw = 0; c.idleRoll = 0;
     if (w > .5) { r.head.rotation.set(.5, -.3, 0); } else look(c, dt);
   }}
}

export { look };
