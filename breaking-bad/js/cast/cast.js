import * as THREE from 'three';
import { app } from '../app.js';
import { rbox, box, cyl, tube, mat, clamp, damp, dampAngle, wrapAngle, smooth } from '../lib/util.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeFigure } from './rig.js';
import { hotspot } from '../ctrl/hotspots.js';
import { say } from '../ui/bubbles.js';
import { rv, RV } from '../rv/rv.js';

/* Walt, Jesse, and in Sunset Hank and Old Joe. Blocky figures in the collection's style; Walt and Jesse change
   with the story: in the pilot Walt has hair and a mustache and cooks in a green apron and his underwear; by
   season 2 he is bald with a goatee. Each person has a place, a pose, a head that looks at things, lines. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const cast = {};
const skin = c => mat(c, .72);

/* ---------- heads ---------- */
const hairMat = c => mat(c, .9);
/* a cap that fits the blocky head like hair or a knit hat: the head's own rounded box grown by t, with everything
   below y0 and above y1 pressed flat, and everything in front of z1 pressed back (a hairline). The pressed parts
   end up inside the head. lift raises the crown a little. */
function cap(h, m, t, { y0 = -1, y1 = 1, z1 = 1, lift = 0 } = {}) {
  const g = new RoundedBoxGeometry(.24 + 2 * t, .28 + 2 * t, .25 + 2 * t, 3, .09 + t), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i); y = Math.min(y1, Math.max(y0, y)); if (y > .05) y += (y - .05) * lift;
    p.setY(i, y); if (p.getZ(i) > z1) p.setZ(i, z1);
  }
  const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; h.add(o); return o;
}
function glasses(h, frame = mat(0x6e6a64, .35, .6)) {
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * .058, .01, .128); h.add(g);
    box(g, .075, .008, .006, frame, 0, .024, 0); box(g, .075, .006, .006, frame, 0, -.024, 0);
    box(g, .006, .05, .006, frame, -.036, 0, 0); box(g, .006, .05, .006, frame, .036, 0, 0);
    box(h, .006, .006, .11, frame, s * .1, .03, .07);
  }
  box(h, .03, .006, .006, frame, 0, .02, .128);
}
const HEADS = {
  waltPilot(h) {
    const m = hairMat(0x6a5a48), mu = hairMat(0x5a4a3a);
    /* short hair with a high hairline: down to the ears, and back from the forehead */
    cap(h, m, .008, { y0: -.02, z1: .055 });
    rbox(h, .1, .025, .03, .01, mu, 0, -.05, .128);                           /* the mustache */
    glasses(h);
  },
  /* shaved bald from season 1 on, with the goatee */
  waltBald(h) {
    const g = hairMat(0x6d5f50);
    rbox(h, .1, .02, .03, .008, g, 0, -.05, .128);                            /* the goatee */
    rbox(h, .07, .06, .035, .012, g, 0, -.1, .122);
    glasses(h);
  },
  jesse(h, beanie = mat(0x2a2a2c, .95)) {
    /* the knit beanie, pulled down to the brow: the crown a little loose on top, the folded cuff around it */
    cap(h, beanie, .012, { y0: .03, lift: .18 });
    cap(h, mat(new THREE.Color(beanie.color).multiplyScalar(1.12).getHex(), .95), .02, { y0: .025, y1: .075 });
    rbox(h, .08, .025, .025, .01, hairMat(0x8a6a48), 0, -.1, .124);            /* stubble */
  },
  hank(h) { rbox(h, .09, .018, .03, .008, hairMat(0x4a3a2c), 0, -.05, .128); },
  joe(h) {
    const m = hairMat(0xb9b2a6);
    rbox(h, .27, .08, .27, .03, m, 0, .13, -.01);
    for (const s of [-1, 1]) rbox(h, .035, .12, .2, .015, m, s * .125, .04, -.03);
    rbox(h, .2, .09, .06, .02, hairMat(0xc8c2b8), 0, -.09, .105);
    glasses(h, mat(0x3a332c, .5));
  },
};

/* ---------- outfits: one figure per look ---------- */
function build(key, look) {
  const W = skin(0xe6b596), J = skin(0xecc4a2), H = skin(0xd9a07c), O = skin(0xe2b08e);
  const khaki = mat(0x8a7a5c, .85), jeans = mat(0x3f5572, .88), dark = mat(0x2c2c30, .85), sneaker = mat(0xe8e6e0, .7);
  const L = {
    'walt:pilot': { name: 'Walt', skin: W, shirt: W, sleeve: W, forearm: W, pants: W, briefs: mat(0xf1efe8, .8), thighs: W, shins: W, socks: mat(0x2a2622, .9), shoes: mat(0x4a3526, .6),
      head: HEADS.waltPilot, apron: mat(0x3f7a4c, .7) },
    'walt:days': { name: 'Walt', skin: W, shirt: mat(0xeeece6, .85), sleeve: mat(0xeeece6, .85), forearm: W, pants: dark, shoes: mat(0x1e1d1c, .6), head: HEADS.waltBald },
    'walt:sunset': { name: 'Walt', skin: W, shirt: mat(0x2c4f9e, .8), sleeve: mat(0x2c4f9e, .8), forearm: mat(0x2c4f9e, .8), pants: mat(0x2a2a2e, .85), shoes: mat(0x1e1d1c, .6), head: HEADS.waltBald },
    'jesse:pilot': { name: 'Jesse', skin: J, shirt: mat(0x55575a, .95), sleeve: mat(0x55575a, .95), forearm: mat(0x55575a, .95), pants: jeans, shoes: sneaker, head: h => HEADS.jesse(h), wide: .96 },
    'jesse:days': { name: 'Jesse', skin: J, shirt: mat(0xa3282a, .9), sleeve: mat(0xa3282a, .9), forearm: mat(0xa3282a, .9), pants: jeans, shoes: sneaker, head: h => HEADS.jesse(h, mat(0x3a3a3c, .95)), wide: .96 },
    'jesse:sunset': { name: 'Jesse', skin: J, shirt: mat(0x2e3034, .95), sleeve: mat(0x2e3034, .95), forearm: mat(0x2e3034, .95), pants: jeans, shoes: sneaker, head: h => HEADS.jesse(h), wide: .96 },
    'hank:sunset': { name: 'Hank', skin: H, shirt: mat(0x1c1c1e, .8), sleeve: mat(0x1c1c1e, .8), forearm: H, pants: mat(0x2b2b30, .85), shoes: mat(0x151414, .5), head: HEADS.hank, wide: 1.2, torsoH: .54 },
    'joe:sunset': { name: 'Old Joe', skin: O, shirt: mat(0x6b4a30, .9), sleeve: mat(0x6b4a30, .9), forearm: mat(0x6b4a30, .9), pants: mat(0x4a5a74, .9), shoes: mat(0x3a2a1e, .7), head: HEADS.joe, wide: .9 },
  }[`${key}:${look}`];
  const r = makeFigure({ ...L, thigh: key === 'jesse' ? .41 : .43, shin: key === 'jesse' ? .4 : .42, torsoH: L.torsoH ?? .5, hair: L.head });
  if (L.apron) {
    r.apron = [rbox(r.spine, .34, .4, .025, .01, L.apron, 0, .22, .145), rbox(r.body, .36, .42, .025, .01, L.apron, 0, -.2, .15)];
    for (const s of [-1, 1]) r.apron.push(box(r.spine, .02, .2, .02, L.apron, s * .1, .52, .1));
    /* the ties across the back */
    r.apron.push(box(r.spine, .42, .03, .02, L.apron, 0, .06, -.138), box(r.spine, .26, .025, .02, L.apron, 0, .5, -.12));
  }
  /* things a hand can hold, hidden until a scene needs them */
  r.props = {};
  const hold = (name, fn, hand = r.armR.hand) => { const g = new THREE.Group(); g.visible = false; g.userData.keep = true; hand.add(g); fn(g); r.props[name] = g; return g; };
  if (key === 'walt') {
    hold('gun', g => { box(g, .03, .05, .16, mat(0x2a2a2c, .35, .6), 0, -.02, .06); box(g, .028, .09, .035, mat(0x1c1c1e, .6), 0, -.06, 0); });
    hold('camcorder', g => { rbox(g, .09, .09, .16, .015, mat(0x2a2a2c, .5), 0, .02, .04); cyl(g, .03, .03, .06, mat(0x111, .3), 0, .02, .14, 12).rotation.x = Math.PI / 2; box(g, .012, .05, .07, mat(0x3a3a3c, .5), .052, .03, .02); }, r.armL.hand);
    /* in the record pose the hand is turned up by 2 radians; this points the lens back at his face */
    r.props.camcorder.rotation.x = -1.24;
    hold('mask', g => { rbox(g, .14, .15, .1, .04, mat(0x1c1c1e, .6), 0, -.02, .02); for (const s of [-1, 1]) cyl(g, .04, .04, .05, mat(0x3a3a38, .5), s * .06, -.07, .05, 12).rotation.x = 1.2; }, r.head);
    r.props.mask.position.set(0, -.02, .11);
    /* the green shirt from the mirror, worn open over his bare chest: a back, two front panels, the sleeves */
    {const sm = mat(0x5c7a3a, .9), part = parent => { const g = new THREE.Group(); g.visible = false; g.userData.keep = true; parent.add(g); return g; };
     const body = part(r.spine), sl = part(r.armL.sh), sr = part(r.armR.sh), fl = part(r.armL.el), fr = part(r.armR.el);
     rbox(body, .43, .52, .16, .05, sm, 0, .25, -.065); for (const x of [-.14, .14]) rbox(body, .15, .52, .03, .012, sm, x, .25, .135);
     rbox(body, .44, .06, .3, .02, sm, 0, .5, 0);
     for (const g of [sl, sr]) rbox(g, .12, .31, .13, .04, sm, 0, -.12, 0);
     for (const g of [fl, fr]) rbox(g, .1, .2, .105, .035, sm, 0, -.07, 0);
     const parts = [body, sl, sr, fl, fr];
     r.props.shirt = { parts, get visible() { return body.visible; }, set visible(v) { for (const q of parts) q.visible = v; } };}
  }
  if (key === 'jesse') {
    hold('bucket', g => { cyl(g, .13, .11, .3, mat(0xf0eee6, .5), 0, -.14, .05, 14); tube(g, V(-.12, 0, .05), V(.12, 0, .05), .008, mat(0x888, .4, .6)); });
    hold('mask', g => { rbox(g, .14, .15, .1, .04, mat(0x1c1c1e, .6), 0, -.02, .02); }, r.head);
    r.props.mask.position.set(0, -.02, .11);
  }
  return r;
}

/* ---------- people ---------- */
const person = (key, looks) => {
  const variants = {};
  for (const l of looks) { const r = build(key, l); r.root.visible = false; variants[l] = r; app.root.add(r.root); }
  const p = { key, variants, rig: null, look: null, pose: 'stand', yaw: 0, pitch: 0, idleYaw: 0, idlePitch: 0, idleRoll: 0, react: null, reactUntil: 0,
    focus: null, lines: {}, line: 0, controlled: false, frame: 'world', local: V(), rot: 0, hy: .45, walker: null, visible: true };
  cast[key] = p;
  return p;
};

/* where each person is, in the RV's frame or the world's, and what they are doing */
export function stage(key, { look, frame = 'world', pos, rot = 0, pose = 'stand', hy, focus = null, visible = true }) {
  const p = cast[key]; if (!p) return;
  for (const [l, r] of Object.entries(p.variants)) r.root.visible = visible && l === look;
  p.look = look; p.rig = p.variants[look]; p.visible = visible;
  if (!p.rig) return;
  const parent = frame === 'rv' ? rv.body : app.root;
  if (p.rig.root.parent !== parent) parent.add(p.rig.root);
  p.frame = frame; p.local.copy(pos); p.rot = rot; p.pose = pose; p.hy = hy ?? (pose === 'sit' ? .46 : .45); p.focus = focus;
  p.rig.root.position.copy(pos);
  if (frame === 'world' && app.terrain) p.rig.root.position.y = app.terrain.heightAt(pos.x, pos.z);
  p.rig.root.rotation.set(0, rot, 0);
  for (const g of Object.values(p.rig.props)) g.visible = false;
  p.controlled = false; p.walker = null;
}

export function speak(key, text, dur = 2.8) { const p = cast[key]; if (p?.rig && p.visible) say(p.rig, text, dur); }
export function react(key, target, secs = 2.5) { const p = cast[key]; if (p) { p.react = target; p.reactUntil = app.time + secs; } }

export function buildCast() {
  person('walt', ['pilot', 'days', 'sunset']);
  person('jesse', ['pilot', 'days', 'sunset']);
  person('hank', ['sunset']);
  person('joe', ['sunset']);
  const LINES = {
    walt: { pilot: [['You know the business, and I know the chemistry.', 3.4], ['Chemistry is the study of change.', 3], ['I am awake.', 2.2]],
      days: [['A battery is a galvanic cell.', 3], ['You brought a meth lab to the airport.', 3.2], ['I am the one who knocks.', 2.8]],
      sunset: [['Say my name.', 2.2], ['Get rid of it. All of it.', 2.8]] },
    jesse: { pilot: [['This ain’t chemistry. This is art.', 3], ['Chili P is my signature!', 2.6], ['Yo, Mr. White.', 2.2]],
      days: [['Excuse me for thinking on my feet.', 3], ['…a robot?', 2], ['Yeah, science!', 2.2]],
      sunset: [['This is my own private domicile, and I will not be harassed… bitch!', 4.2], ['Yeah, Mr. White!', 2.2]] },
    hank: { sunset: [['Open up. DEA.', 2.4], ['They’re minerals, Marie.', 2.6]] },
    joe: { sunset: [['You got a warrant for that?', 2.8], ['Parked, it’s a domicile.', 2.6]] },
  };
  const CARDS = {
    walt: { pilot: ['Walter White', 'A chemistry teacher, fifty today three weeks ago. He cooks in his underwear and a green apron so the smell stays off his clothes.'],
      days: ['Walter White', 'Bald now, with the goatee. Stranded four days out with a dead battery and a lab full of chemicals.'],
      sunset: ['Walter White', 'Cooking in Gus Fring’s superlab now. The RV is evidence, and it has to go.'] },
    jesse: { pilot: ['Jesse Pinkman', 'Walt’s former student, now his partner. He bought the RV.'],
      days: ['Jesse Pinkman', 'He left the keys in the ignition.'],
      sunset: ['Jesse Pinkman', 'He had the RV fixed up to cook on his own. Walt is having it crushed.'] },
    hank: { sunset: ['Hank Schrader', 'Walt’s brother-in-law, DEA. He tracked the RV here and wants in.'] },
    joe: { sunset: ['Old Joe', 'Runs the salvage yard. He knows the law on search and seizure better than most lawyers.'] },
  };
  for (const [key, p] of Object.entries(cast)) {
    p.lines = LINES[key];
    for (const [look, r] of Object.entries(p.variants)) {
      hotspot(r.root, { title: () => CARDS[key][look][0], text: () => CARDS[key][look][1], action: () => { const ls = p.lines[look]; if (ls?.length) { const [t, d] = ls[p.line++ % ls.length]; speak(key, t, d); } app.emit('cast:click', key); } });
    }
  }
  app.onUpdate(updateCast, 20);
}

/* ---------- poses ---------- */
const tmp = V(), tgt = V();
function look(p, dt) {
  const r = p.rig; let yaw = 0, pitch = 0;
  const f = app.time < p.reactUntil ? p.react : (typeof p.focus === 'function' ? p.focus() : p.focus);
  if (f) {
    r.head.getWorldPosition(tmp);
    const dx = f.x - tmp.x, dz = f.z - tmp.z, dy = f.y - tmp.y;
    r.root.getWorldQuaternion(q0); e0.setFromQuaternion(q0, 'YXZ');
    yaw = clamp(wrapAngle(Math.atan2(dx, dz) - e0.y - r.spine.rotation.y), -1.2, 1.2);
    pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -.6, .6);
  }
  p.yaw = damp(p.yaw, yaw, 5, dt); p.pitch = damp(p.pitch, pitch, 5, dt);
  r.head.rotation.set(p.pitch + p.idlePitch + (r.talking ? Math.sin(app.time * 11) * .05 : 0), p.yaw + p.idleYaw, p.idleRoll);
}
const q0 = new THREE.Quaternion(), e0 = new THREE.Euler();

export const POSES = {
  stand(p, t, calm) {
    const r = p.rig; r.setSit(0, 0); r.walk(0, 0);
    const b = Math.sin(t * 1.3 + p.key.length) * calm;
    r.armL.sh.rotation.set(.05 * b, 0, .1); r.armR.sh.rotation.set(-.05 * b, 0, -.1);
    r.armL.el.rotation.set(-.2, 0, 0); r.armR.el.rotation.set(-.2, 0, 0);
    r.spine.rotation.set(.01 * b, 0, 0); p.idlePitch = 0; p.idleRoll = .02 * b; p.idleYaw = 0;
  },
  cook(p, t, calm) {
    const r = p.rig; r.setSit(0, 0); r.walk(0, 0);
    const a = t * 1.6, w = Math.sin(a) * calm, v = Math.sin(a * .5 + 1) * calm;
    r.spine.rotation.set(.18, .08 * v, 0);
    r.armR.sh.rotation.set(-1.0 + .12 * w, 0, -.12); r.armR.el.rotation.set(-.7 + .1 * v, 0, 0);
    r.armL.sh.rotation.set(-.85 - .1 * v, 0, .15); r.armL.el.rotation.set(-.9, 0, 0);
    p.idlePitch = .35; p.idleYaw = .12 * v; p.idleRoll = 0;
  },
  sit(p, t, calm) {
    const r = p.rig; r.setSit(1, p.hy);
    const b = Math.sin(t * .9 + p.key.length) * calm;
    r.spine.rotation.set(-.12, 0, 0);
    r.armL.sh.rotation.set(-.45, 0, .18); r.armL.el.rotation.set(-.8, 0, 0);
    r.armR.sh.rotation.set(-.45, 0, -.18); r.armR.el.rotation.set(-.8 + .05 * b, 0, 0);
    p.idlePitch = -.05; p.idleYaw = .06 * b; p.idleRoll = .02 * b;
  },
  smoke(p, t, calm) {
    const r = p.rig; POSES.stand(p, t, calm);
    const ph = (t % 8) / 8, k = ph < .1 ? smooth(ph / .1) : ph < .25 ? 1 : ph < .35 ? 1 - smooth((ph - .25) / .1) : 0;
    r.armR.sh.rotation.set(-.5 - .9 * k, 0, -.3 - .2 * k); r.armR.el.rotation.set(-1.4 - .6 * k, 0, 0);
    r.armL.sh.rotation.set(0, 0, .2); r.armL.el.rotation.set(-.3, 0, 0);
    p.idlePitch = -.05 * k;
  },
  hips(p, t, calm) {
    const r = p.rig; POSES.stand(p, t, calm);
    /* elbows out, forearms back in to the hips */
    for (const [a, s] of [[r.armL, 1], [r.armR, -1]]) { a.sh.rotation.set(.12, 0, -s * .62); a.el.rotation.set(-.25, 0, s * 1.7); }
  },
  drive(p, t, calm) {
    const r = p.rig; r.setSit(1, p.hy);
    r.spine.rotation.set(-.08, 0, 0);
    const s = (app.rv?.steer ?? 0) * .5;
    r.armL.sh.rotation.set(-1.15, 0, .15 + s * .3); r.armL.el.rotation.set(-.5, 0, 0);
    r.armR.sh.rotation.set(-1.15, 0, -.15 + s * .3); r.armR.el.rotation.set(-.5, 0, 0);
    p.idlePitch = .05; p.idleYaw = 0; p.idleRoll = 0;
  },
  slump(p, t) {
    const r = p.rig; r.setSit(1, p.hy);
    r.spine.rotation.set(.1, 0, .35);
    r.armL.sh.rotation.set(-.1, 0, .1); r.armL.el.rotation.set(-.2, 0, 0); r.armR.sh.rotation.set(-.2, 0, -.05); r.armR.el.rotation.set(-.3, 0, 0);
    p.idlePitch = .5; p.idleRoll = .4 + .03 * Math.sin(t * .7); p.idleYaw = 0;
  },
  crouch(p, t, calm) {
    const r = p.rig; r.setSit(.85, .32);
    for (const L of [r.legL, r.legR]) { L.hip.rotation.x = -1.9; L.knee.rotation.x = 2.1; }
    r.body.position.y = .42; r.spine.rotation.set(.45, 0, 0);
    const w = Math.sin(t * 2.2) * calm;
    r.armR.sh.rotation.set(-1.1 + .15 * w, 0, -.1); r.armR.el.rotation.set(-.5, 0, 0);
    r.armL.sh.rotation.set(-1.0, 0, .1); r.armL.el.rotation.set(-.6 + .1 * w, 0, 0);
    p.idlePitch = .45;
  },
  push(p, t, calm) {
    const r = p.rig; POSES.stand(p, t, calm);
    r.spine.rotation.set(.1, 0, 0);
    for (const a of [r.armL, r.armR]) { a.sh.rotation.set(-1.45, 0, 0); a.el.rotation.set(-.15, 0, 0); }
  },
  aim(p, t, calm) {
    const r = p.rig; POSES.stand(p, t, calm);
    r.armR.sh.rotation.set(-1.5, 0, 0); r.armR.el.rotation.set(0, 0, 0);
    r.armL.sh.rotation.set(-1.38, 0, .42); r.armL.el.rotation.set(-.3, 0, 0);
  },
  record(p, t, calm) {
    const r = p.rig; POSES.stand(p, t, calm);
    /* the camcorder held out at arm's length in front of his face, turned on himself */
    r.armL.sh.rotation.set(-1.6, 0, .3); r.armL.el.rotation.set(-.5, 0, 0);
    r.armR.sh.rotation.set(-.2, 0, -.1); r.armR.el.rotation.set(-.4, 0, 0);
  },
};

/* ---------- walking along a path on the ground (world frame) ---------- */
/* walk a path on the ground; face, if given, is where they turn on arrival: an angle, or a point to look at */
export function walkTo(key, points, speed = 1.3, done, face = null) {
  const p = cast[key]; if (!p?.rig) return;
  const start = p.rig.root.position.clone(); start.y = 0;
  p.walker = { path: [start, ...points.map(q => q.clone().setY(0))], seg: 0, speed, phase: 0, amt: 0, heading: p.rig.root.rotation.y, done: false, cb: done, face };
}
function stepWalker(p, dt) {
  const w = p.walker, r = p.rig, pos = r.root.position;
  let remain = w.speed * dt;
  while (remain > 0 && w.seg < w.path.length - 1) {
    const b = w.path[w.seg + 1], dx = b.x - pos.x, dz = b.z - pos.z, d = Math.hypot(dx, dz);
    if (d > 1e-4) w.heading = Math.atan2(dx, dz);
    if (d <= remain) { pos.x = b.x; pos.z = b.z; remain -= d; w.seg++; } else { pos.x += dx / d * remain; pos.z += dz / d * remain; remain = 0; }
  }
  if (w.seg >= w.path.length - 1 && !w.done) {
    w.done = true;
    if (w.face != null) w.heading = typeof w.face === 'number' ? w.face : Math.atan2(w.face.x - pos.x, w.face.z - pos.z);
    w.cb?.();
  }
  const before = w.phase; w.phase += w.speed * dt / 1.25 * Math.PI * 2;
  if (!w.done && Math.floor(before / Math.PI) !== Math.floor(w.phase / Math.PI)) app.emit('step', { pos, who: p.key });
  w.amt = damp(w.amt, w.done ? 0 : 1, 8, dt);
  r.root.rotation.y = dampAngle(r.root.rotation.y, w.heading, 9, dt);
  if (p.frame === 'world' && app.terrain) pos.y = damp(pos.y, app.terrain.heightAt(pos.x, pos.z), 14, dt);
  r.setSit(0, 0); r.walk(w.phase, w.amt);
  if (w.done && w.amt < .02) p.walker = null;
}

function updateCast(dt) {
  const t = app.time, calm = app.reducedMotion ? .3 : 1;
  for (const p of Object.values(cast)) {
    if (!p.rig || !p.visible) continue;
    if (p.walker) { stepWalker(p, dt); look(p, dt); continue; }
    if (p.controlled) { look(p, dt); continue; }
    (POSES[p.pose] ?? POSES.stand)(p, t, calm);
    look(p, dt);
  }
}

export { RV };
