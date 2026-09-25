import * as THREE from 'three';
import { app } from '../app.js';
import { M, box, rbox, cyl, tube, mat, keep, seeded, clamp, lerp, easeInOut, easeOutBack, dampAngle, canvasTex } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { makeFigure } from '../cast/rig.js';
import { rv } from '../rv/rv.js';
import { hotspot } from '../ctrl/hotspots.js';
import { fx } from '../fx/particles.js';
import { mergeStatic } from '../perf.js';
import { say } from '../ui/bubbles.js';
import { flyTo, writeHash } from '../ctrl/camera.js';

/* The shoot. Breaking Bad used two RVs, a working one for the road and an interior set, and a behind-the-scenes
   photo from the desert shows the rear wall off and a camera on a dolly looking in. Press S and the crew is there:
   the wall comes off and is stood aside, the dolly waits on its track, a boom hangs over the opening, lamps stand
   outside the windows, and at video village the monitors show what the two cameras see. Then they shoot takes:
   the slate, action, the push in, cut, back to one. Everything is placed in the RV's frame and stood on the
   ground wherever the RV is. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const T_ON = 3;
const BOOM = { op: V(-6.6, 0, 2.15), mic: V(-4.35, 2.62, .35) };
const crew = {};
const tk = { ph: 'wait', t: 0, n: 1, rec: false, u: 0, said: 0 };
export const shoot = { on: false, t: 0, group: null, items: [], told: false, tk, crew, feeds: null, vantage: () => vantage(), monitorView: () => monitorView() };
const SCENE = { pilot: '101', days: '209', sunset: '306' };

export function setShoot(on, o = {}) {
  if (on === shoot.on || !G) return;
  if (on && (app.mode === 'scripted' || app.mode === 'drive')) return;
  if (on && (rv.crush ?? 0) > 0) { app.emit('card', { title: 'The shoot', text: 'The RV is crushed. Restore it first.' }); return; }
  shoot.on = on; app.shoot = on;
  rv.walls.rear.off = on;
  if (on) {
    place(); resetTakes();
    if (o.fly && app.mode === 'orbit') flyTo(vantage(), 2.6);
    if (!shoot.told) { shoot.told = true; app.emit('card', { title: 'The shoot', text: 'Breaking Bad used two RVs: a working one for the road and a set for the interior. A behind-the-scenes photo from the desert shows this one with its rear wall off and a camera on a dolly looking in.', hold: 11000 }); }
  }
  app.emit('shoot', on); writeHash();
}

/* ---------- materials and small builders ---------- */
const C = {
  black: mat(0x1c1c1f, .6, .15), case: mat(0x232326, .5, .1), grey: mat(0x5c5f63, .45, .55), alu: mat(0xb6babd, .32, .75),
  white: mat(0xeceae4, .6), cloth: mat(0x2b3542, .85), wood: mat(0x6b4a2c, .75), apple: mat(0xc8a26c, .8), bag: mat(0x5a5540, .95),
  tyre: mat(0x1a1a1a, .9), glass: mat(0x20262c, .15, .3), red: mat(0xb8312a, .5), blue: mat(0x2a5fa8, .5), orange: mat(0xd8732a, .5),
};
const standOf = (g, h, spread = .5) => {
  for (let k = 0; k < 3; k++) { const a = k * 2.094 + .3; tube(g, V(0, .55, 0), V(Math.cos(a) * spread, .02, Math.sin(a) * spread), .013, C.alu); }
  tube(g, V(0, .5, 0), V(0, h, 0), .02, C.alu);
  const b = M(new THREE.CapsuleGeometry(.09, .28, 3, 8), C.bag); b.rotation.z = Math.PI / 2; b.position.set(spread * .75, .09, .12); g.add(b);
  return g;
};
/* a daylight lamp; its head is aimed at a point in the RV's frame when it is placed */
function hmi(h, big) {
  const g = standOf(new THREE.Group(), h, big ? .7 : .55);
  const head = keep(new THREE.Group()); head.position.y = h + .05; g.add(head);
  const s = big ? 1.25 : 1;
  rbox(head, .56 * s, .5 * s, .5 * s, .05, C.grey, 0, 0, -.05);
  cyl(head, .23 * s, .25 * s, .1, C.black, 0, 0, .23 * s, 20).rotation.x = Math.PI / 2;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.21 * s, 24), new THREE.MeshStandardMaterial({ color: 0xfff7e6, emissive: 0xfff1d6, emissiveIntensity: 2.2, roughness: .3 }));
  lens.position.z = .29 * s; head.add(lens);
  for (const [x, y] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const d = box(head, (y ? .5 : .012) * s, (y ? .012 : .5) * s, .26 * s, C.black, x * .3 * s, y * .3 * s, .42 * s);
    d.rotation.set(-y * .35, x * .35, 0);
  }
  tube(g, V(-.34 * s, h + .05, 0), V(-.34 * s, h - .3, 0), .02, C.alu); tube(g, V(.34 * s, h + .05, 0), V(.34 * s, h - .3, 0), .02, C.alu);
  mergeStatic(head); mergeStatic(g);
  g.userData.head = head;
  return g;
}
function bounce() {
  const g = standOf(new THREE.Group(), 1.35);
  const f = keep(new THREE.Group()); f.position.y = 1.5; g.add(f);
  for (const [w, h, x, y] of [[1.22, .03, 0, .6], [1.22, .03, 0, -.6], [.03, 1.22, .6, 0], [.03, 1.22, -.6, 0]]) box(f, w, h, .03, C.alu, x, y, 0);
  f.add(M(new THREE.PlaneGeometry(1.18, 1.18), mat(0xf4f2ec, .9)));
  const back = M(new THREE.PlaneGeometry(1.18, 1.18), mat(0xd9d6ce, .9)); back.rotation.y = Math.PI; back.position.z = -.004; f.add(back);
  mergeStatic(f); mergeStatic(g);
  g.userData.head = f;
  return g;
}
function cstand(h, fw, fh) {
  const g = standOf(new THREE.Group(), h, .45);
  const f = keep(new THREE.Group()); f.position.set(0, h, 0); g.add(f);
  tube(f, V(0, 0, 0), V(0, 0, .9), .012, C.grey);
  box(f, fw, fh, .01, C.black, 0, 0, .95);
  mergeStatic(f); mergeStatic(g);
  g.userData.head = f;
  return g;
}
/* the print on a director's chair */
const chairTex = text => canvasTex(256, 96, (g, w, h) => {
  g.fillStyle = '#18181b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e9e3d6'; g.font = 'bold 34px Arial Narrow, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
}, 1, 1);
let chairMat = null;
/* the sitter faces +z; the back is at -z */
function directorsChair() {
  const c = new THREE.Group(), wood = C.wood;
  for (const s of [-1, 1]) {
    tube(c, V(s * .25, 0, .22), V(s * .25, .68, -.2), .016, wood); tube(c, V(s * .25, 0, -.22), V(s * .25, .68, .2), .016, wood);
    tube(c, V(s * .25, .68, -.22), V(s * .25, 1.2, -.22), .016, wood); tube(c, V(s * .25, .9, -.22), V(s * .25, .9, .2), .016, wood);
  }
  tube(c, V(-.25, .3, .19), V(.25, .3, .19), .014, wood);
  box(c, .5, .025, .42, C.black, 0, .69, 0);
  chairMat ??= new THREE.MeshStandardMaterial({ map: chairTex('BREAKING BAD'), roughness: .9, side: THREE.DoubleSide });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(.5, .2), chairMat); back.position.set(0, 1.08, -.225); back.rotation.y = Math.PI; back.castShadow = true; c.add(back);
  return c;
}

/* crew: blocky like the cast, in crew clothes */
const SKIN = [0xe8b896, 0xc68a64, 0x8d5a3b, 0xf1c9a6, 0xb07650, 0x6b4430];
function crewman(o) {
  const f = makeFigure({
    name: o.name, skin: mat(SKIN[o.skin ?? 0], .72), shirt: mat(o.shirt, .9), pants: mat(o.pants ?? 0x3b3b40, .9), shoes: mat(0x2a2624, .7),
    hair: h => {
      if (o.cap != null) { const c = mat(o.cap, .85); rbox(h, .262, .1, .272, .045, c, 0, .115, -.005); box(h, .2, .014, .13, c, 0, .075, .185); }
      else if (o.hat != null) { const c = mat(o.hat, .9); cyl(h, .21, .21, .012, c, 0, .105, 0, 20); cyl(h, .12, .13, .1, c, 0, .16, 0, 16); }
      else rbox(h, .252, .075, .262, .035, mat(o.hair ?? 0x2a2018, .9), 0, .135, -.005);
      if (o.phones) {
        const pm = mat(0x19191b, .5), band = M(new THREE.TorusGeometry(.142, .012, 6, 18, Math.PI), pm);
        band.position.y = .02; h.add(band);
        for (const s of [-1, 1]) cyl(h, .055, .055, .045, pm, s * .135, 0, 0, 14).rotation.z = Math.PI / 2;
      }
      if (o.shades) box(h, .2, .045, .02, mat(0x0c0c0e, .15, .3), 0, .025, .13);
    },
  });
  f.root.name = o.name;
  if (o.info) hotspot(f.root, { title: o.name, text: o.info });
  return f;
}
const pose = (r, { sh = [0, 0], el = [-.15, -.15], spread = .1 } = {}) => {
  r.armL.sh.rotation.set(sh[0], 0, spread); r.armR.sh.rotation.set(sh[1], 0, -spread);
  r.armL.el.rotation.x = el[0]; r.armR.el.rotation.x = el[1];
};

/* ---------- build ---------- */
let G = null, mover, dolly, head, track, village, bcam, slate, clap, cables, genItem;
const feeds = [];
shoot.feeds = feeds;
const rnd = seeded(8);

export function buildShoot() {
  G = keep(new THREE.Group()); G.name = 'shoot'; G.visible = false; app.root.add(G); shoot.group = G;
  const items = shoot.items;
  /* at(obj, x, z, yaw, delay, o): x, z, yaw in the RV's frame; o.foot [a, b] tilts it to the ground, o.solid are
     circles the walker cannot pass */
  const at = (obj, x, z, yaw, d, o = {}) => { obj.userData.pl = { x, z, yaw, d, ...o }; G.add(obj); items.push(obj); return obj; };

  /* the rear wall comes off: it moves on a pivot at its bottom edge, and the ladder goes with it */
  {const g = rv.walls.rear.group;
   mover = keep(new THREE.Group()); mover.name = 'rear-mover'; mover.position.set(-4.72, .46, 0); rv.body.add(mover);
   g.parent.remove(g); mover.add(g); g.position.set(4.72, -.46, 0);
   /* the window frame and glass on the wall, and the ladder, go with it (all are in the body's frame) */
   for (const o of [...rv.walls.rear.attach, rv.parts.ladder]) if (o && o.parent === rv.body) { rv.body.remove(o); g.add(o); }
   mover.userData.p3 = V(-6.9, 0, -3.5);}

  /* the dolly on its track behind the RV, looking in */
  {track = new THREE.Group();
   for (const z of [-.31, .31]) { const r = cyl(track, .028, .028, 6.6, C.alu, 0, .075, z, 8); r.rotation.z = Math.PI / 2; }
   for (let x = -3.2; x <= 3.21; x += .4) box(track, .1, .045, .9, mat(0x5a4a36, .9), x, .025, 0, (rnd() - .5) * .04);
   for (const x of [-3.3, 3.3]) box(track, .06, .1, .75, C.black, x, .06, 0);
   mergeStatic(track);
   dolly = keep(new THREE.Group()); dolly.position.set(D0, .1, 0); track.add(dolly);
   rbox(dolly, 1.15, .16, .7, .03, C.grey, 0, .14, 0);
   for (const x of [-.45, .45]) for (const z of [-.31, .31]) { const w = cyl(dolly, .06, .06, .05, C.black, x, 0, z, 14); w.rotation.x = Math.PI / 2; }
   box(dolly, .55, .035, .3, C.alu, .12, .2, .5);
   for (const z of [-.3, .3]) tube(dolly, V(-.62, .2, z), V(-.62, 1.02, z), .02, C.alu);
   tube(dolly, V(-.62, 1.02, -.3), V(-.62, 1.02, .3), .022, C.alu);
   cyl(dolly, .085, .11, 1.02, C.grey, .12, .72, 0, 14);
   tube(dolly, V(-.42, .22, -.42), V(-.42, .74, -.42), .025, C.alu); cyl(dolly, .15, .15, .06, C.black, -.42, .77, -.42, 16);
   mergeStatic(dolly);
   head = keep(new THREE.Group()); head.position.set(.12, 1.33, 0); dolly.add(head);
   rbox(head, .2, .1, .2, .02, C.black, 0, -.07, 0);
   rbox(head, .21, .25, .46, .03, C.black, 0, .1, -.03);
   const lens = cyl(head, .075, .088, .36, mat(0x0e0e10, .3, .4), 0, .09, .38, 18); lens.rotation.x = Math.PI / 2;
   rbox(head, .27, .21, .08, .012, C.black, 0, .09, .6);
   box(head, .05, .05, .17, C.black, .14, .17, -.22);
   const mon = box(head, .15, .1, .012, C.black, -.17, .23, .02); mon.rotation.y = .6;
   mergeStatic(head);
   const tally = new THREE.MeshStandardMaterial({ color: 0x401010, emissive: 0xff2a1e, emissiveIntensity: 0, roughness: .4 }); tally.userData.live = true;
   box(head, .03, .02, .02, tally, 0, .235, .2); head.userData.tally = tally;
   hotspot(head, { title: 'A camera', text: 'On a dolly on a short track. With the rear wall off it looks down the length of the lab, and pushes in during the take.' });
   at(track, -8.6, 0, 0, .55, { foot: [3.3, .45], solid: [[-3, 0, .5], [-2, 0, .5], [-1, 0, .7], [0, 0, .7], [1, 0, .7], [2, 0, .5], [3, 0, .5]] });}

  /* the boom: a pole from the operator's raised hands to a microphone just inside the opening, above the frame */
  {const b = new THREE.Group(), fwd = V(BOOM.mic.x - BOOM.op.x, 0, BOOM.mic.z - BOOM.op.z).normalize();
   const hands = V(BOOM.op.x, 1.84, BOOM.op.z).addScaledVector(fwd, .26), d = BOOM.mic.clone().sub(hands).normalize();
   const rel = v => v.clone().sub(V(BOOM.op.x, 0, BOOM.op.z));
   tube(b, rel(hands.clone().addScaledVector(d, -.9)), rel(BOOM.mic), .019, C.alu);
   const z = M(new THREE.CapsuleGeometry(.065, .26, 4, 10), mat(0x6a6a66, .98)); z.position.copy(rel(BOOM.mic).addScaledVector(d, .12)); z.quaternion.setFromUnitVectors(V(0, 1, 0), d); b.add(z);
   mergeStatic(b);
   at(b, BOOM.op.x, BOOM.op.z, 0, 1.1);}

  /* lamps outside the windows, bounce boards and flags by the opening, a silk overhead */
  const lamp = (x, z, h, aim, big, d) => { const l = hmi(h, big); l.userData.aim = aim; hotspot(l, { title: 'HMI', text: 'A daylight lamp. Aimed through the windows, it keeps the light inside steady when a cloud crosses the sun.' }); return at(l, x, z, 0, d, { solid: [[0, 0, .45]] }); };
  lamp(-.1, -5.2, 2.8, V(-.08, 1.95, -1.22), true, .9);
  lamp(-3.8, -5.0, 2.7, V(-3.62, 1.95, -1.22), false, 1.0);
  lamp(-7.7, 4.9, 3.1, V(-3.6, 1.95, 1.22), true, 1.2);
  for (const z of [-2.4, 2.4]) { const b = bounce(); b.userData.aim = V(-3.6, 1.6, 0); at(b, -5.5, z, 0, .8, { solid: [[0, 0, .35]] }); }
  for (const [x, z, h] of [[-5.0, 3.5, 2.55], [-4.9, -3.5, 2.35]]) { const c = cstand(h, .6, .75); c.userData.aim = V(-4.6, h, Math.sign(z) * 2.2); at(c, x, z, 0, 1.0, { solid: [[0, 0, .3]] }); }
  {const s = new THREE.Group(), H = 3.55;
   for (const z of [-2.0, 2.0]) { const st = standOf(new THREE.Group(), H, .6); st.position.z = z; s.add(st); }
   for (const x of [-1.8, 1.8]) tube(s, V(x, H, -1.8), V(x, H, 1.8), .02, C.alu);
   for (const z of [-1.8, 1.8]) tube(s, V(-1.8, H, z), V(1.8, H, z), .02, C.alu);
   for (const z of [-2.0, 2.0]) tube(s, V(0, H, z), V(0, H, z * .9), .02, C.alu);
   const silk = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: .95, transparent: true, opacity: .78, side: THREE.DoubleSide, depthWrite: false }));
   silk.rotation.x = -Math.PI / 2; silk.position.y = H; silk.castShadow = true; s.add(silk);
   mergeStatic(s);
   hotspot(silk, { title: 'Silk', text: 'A frame of white silk over the camera and the opening. It turns the hard desert sun into soft light.' });
   at(s, -7.3, 0, 0, 1.3, { solid: [[0, -2, .25], [0, 2, .25]] });}

  /* video village: a canopy, the chairs, the monitor cart */
  {const vv = new THREE.Group(); village = vv;
   for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) tube(vv, V(x, 0, z), V(x, 2.3, z), .026, C.alu);
   const roof = M(new THREE.ConeGeometry(2.14, .55, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x252c36, roughness: .9, side: THREE.DoubleSide }));
   roof.rotation.y = Math.PI / 4; roof.position.y = 2.575; vv.add(roof);
   for (const [x, z, ry] of [[0, -1.5, 0], [0, 1.5, 0], [-1.5, 0, Math.PI / 2], [1.5, 0, Math.PI / 2]]) box(vv, 3.02, .22, .01, C.cloth, x, 2.2, z, ry);
   for (const x of [-.55, .15, .85]) { const c = directorsChair(); c.position.set(x, 0, .45); c.rotation.y = Math.PI; vv.add(c); }
   const cart = new THREE.Group(); cart.position.set(.15, 0, -.55); vv.add(cart);
   box(cart, 1.3, .05, .6, C.grey, 0, .82, 0); box(cart, 1.3, .04, .6, C.grey, 0, .25, 0);
   for (const x of [-.6, .6]) for (const z of [-.26, .26]) { tube(cart, V(x, .06, z), V(x, .84, z), .016, C.alu); cyl(cart, .05, .05, .04, C.black, x, .05, z, 10).rotation.x = Math.PI / 2; }
   box(cart, .4, .22, .35, C.case, -.3, .38, 0);
   for (const [x, label] of [[-.32, 'A CAM'], [.32, 'B CAM']]) {
     const m = keep(new THREE.Group()); m.position.set(x, 1.12, 0); cart.add(m);
     rbox(m, .6, .38, .07, .015, C.black, 0, 0, 0); tube(m, V(0, -.19, 0), V(0, -.29, 0), .02, C.black);
     box(m, .62, .012, .16, C.black, 0, .2, .1); box(m, .012, .4, .16, C.black, .31, 0, .1); box(m, .012, .4, .16, C.black, -.31, 0, .1);
     mergeStatic(m);
     const rt = new THREE.WebGLRenderTarget(320, 180, { type: THREE.HalfFloatType, samples: app.touch ? 0 : 4 });
     const scr = new THREE.Mesh(new THREE.PlaneGeometry(.54, .304), screenMaterial(rt.texture)); scr.position.z = .037; m.add(scr);
     const ov = overlay(label), om = new THREE.Mesh(new THREE.PlaneGeometry(.54, .304), new THREE.MeshBasicMaterial({ map: ov.tex, transparent: true, depthWrite: false, toneMapped: false }));
     om.position.z = .039; m.add(om);
     feeds.push({ label, rt, scr, om, ov, cam: new THREE.PerspectiveCamera(label === 'A CAM' ? 34 : 62, 16 / 9, .05, 6000) });
   }
   mergeStatic(vv);
   hotspot(cart, { action: () => flyTo(monitorView(), 1.6), title: 'Video village', text: 'The director and the script supervisor watch here. Left: the A camera on the dolly. Right: the B camera, fixed in the cab, looking back down the lab and out of the open rear.' });
   at(vv, -12.4, 7.3, -.69, 1.5, { foot: [1.5, 1.5], solid: [[.15, -.55, .7], [-.55, .45, .32], [.15, .45, .32], [.85, .45, .32]] });}

  /* the B camera: a small body on a mount under the cab ceiling, looking back */
  {bcam = keep(new THREE.Group()); bcam.name = 'b-cam'; bcam.visible = false; rv.body.add(bcam);
   bcam.position.set(2.95, 2.5, .42);
   const d = V(-4.7, 1.75, 0).sub(bcam.position);
   bcam.rotation.set(-Math.atan2(d.y, Math.hypot(d.x, d.z)), Math.atan2(d.x, d.z), 0, 'YXZ');
   rbox(bcam, .17, .15, .28, .02, C.black, 0, 0, -.04);
   const l = cyl(bcam, .05, .055, .16, mat(0x0e0e10, .3, .4), 0, 0, .17, 14); l.rotation.x = Math.PI / 2;
   tube(bcam, V(0, .075, -.05), V(0, .3, -.05), .02, C.alu);
   mergeStatic(bcam);
   hotspot(bcam, { title: 'B camera', text: 'Fixed under the cab ceiling, looking back down the lab and out through the missing wall at the crew.' });}

  /* the grip truck, the generator, cases, apple boxes, crafty */
  {const t = new THREE.Group();
   rbox(t, 6.2, 2.7, 2.45, .06, C.white, -.6, 1.95, 0);
   box(t, .05, 2.4, 2.2, mat(0x0d0d0f, .95), -3.71, 1.95, 0);
   for (let i = 0; i < 3; i++) box(t, .6, .5, .5, C.case, -3.2, 1.0 + i * .52, (i - 1) * .7);
   rbox(t, 1.9, 2.0, 2.35, .12, C.white, 3.45, 1.5, 0); box(t, .05, .75, 2.1, C.glass, 4.42, 2.0, 0);
   box(t, 1.6, .6, .05, C.glass, 3.5, 2.05, 1.18); box(t, 1.6, .6, .05, C.glass, 3.5, 2.05, -1.18);
   box(t, 8.3, .3, 1.2, C.black, -.2, .55, 0); box(t, .25, .3, 2.4, mat(0x9a9ca0, .4, .6), 4.45, .75, 0);
   for (const x of [-2.4, -1.4, 3.3]) for (const z of [-1.08, 1.08]) cyl(t, .5, .5, .3, C.tyre, x, .5, z, 18).rotation.x = Math.PI / 2;
   mergeStatic(t);
   hotspot(t, { title: 'Grip truck', text: 'Stands, flags, frames, sandbags, cable: everything the grips set up comes off this truck.' });
   at(t, -27.5, 2.2, Math.PI - .12, 1.9, { opt: true, foot: [3.8, 1.2], solid: [[-3, 0, 1.3], [-1, 0, 1.3], [1, 0, 1.3], [3, 0, 1.3]] });
   const gen = new THREE.Group();
   rbox(gen, 3.0, 1.45, 1.5, .06, mat(0xd9d4c4, .55), 0, 1.1, 0);
   for (let i = 0; i < 6; i++) box(gen, .04, .8, 1.3, C.black, -1.1 + i * .35, 1.1, 0);
   for (const z of [-.8, .8]) cyl(gen, .38, .38, .22, C.tyre, 0, .38, z, 16).rotation.x = Math.PI / 2;
   tube(gen, V(1.5, .45, 0), V(2.5, .35, 0), .04, C.grey);
   mergeStatic(gen);
   hotspot(gen, { title: 'Generator', text: 'Power for the lamps, parked far off so its noise stays out of the sound.' });
   genItem = gen; at(gen, -27.5, -10.5, .5, 2.0, { opt: true, foot: [1.5, .75], solid: [[-.8, 0, 1], [.8, 0, 1]] });
   const distro = new THREE.Group(); box(distro, .6, .45, .45, mat(0x3a3a3a, .6, .3), 0, .23, 0); mergeStatic(distro);
   at(distro, -9.6, -4.6, .2, 1.4);
   const cs = new THREE.Group();
   for (let i = 0; i < 7; i++) { const w = i < 3 ? .85 : .6, c = rbox(cs, w, .5, .52, .03, C.case, (i % 3) * .9 - .9, .25 + Math.floor(i / 3) * .5, 0, (rnd() - .5) * .1); if (i === 6) c.position.set(0, 1.25, 0); }
   for (let i = 0; i < 3; i++) for (const y of [.02, .48]) box(cs, .87, .03, .54, C.alu, i * .9 - .9, y, 0);
   mergeStatic(cs);
   const lbl = new THREE.Mesh(new THREE.PlaneGeometry(.75, .19), new THREE.MeshStandardMaterial({ map: TX.stencilTex('A CAM', '#e9e3d6'), transparent: true, roughness: .9 }));
   lbl.position.set(-.9, .3, .265); cs.add(lbl);
   at(cs, -10.8, -3.2, .15, 1.6, { solid: [[-.9, 0, .5], [0, 0, .5], [.9, 0, .5]] });
   const ab = new THREE.Group(); for (let i = 0; i < 5; i++) box(ab, .5, .2, .3, C.apple, i < 3 ? 0 : .55, .1 + (i < 3 ? i : i - 3) * .2, 0, (rnd() - .5) * .3); mergeStatic(ab);
   at(ab, -11.6, 1.5, .4, 1.1, { solid: [[.2, 0, .4]] });
   const cr = new THREE.Group();
   box(cr, 1.8, .04, .75, mat(0xd8d6d0, .7), 0, .74, 0);
   for (const x of [-.8, .8]) for (const z of [-.3, .3]) tube(cr, V(x, 0, z), V(x, .73, z), .014, C.grey);
   rbox(cr, .6, .38, .38, .04, C.red, -.45, .95, 0); box(cr, .62, .06, .4, C.white, -.45, 1.15, 0);
   rbox(cr, .5, .34, .34, .04, C.blue, .2, .93, 0); box(cr, .52, .06, .36, C.white, .2, 1.11, 0);
   cyl(cr, .15, .15, .4, C.orange, .7, .96, 0, 16); cyl(cr, .15, .15, .05, C.white, .7, 1.18, 0, 16);
   for (let i = 0; i < 5; i++) cyl(cr, .035, .035, .22, mat(0x9fc6e0, .2), -.1 + i * .08, .87, .25, 8);
   mergeStatic(cr);
   hotspot(cr, { title: 'Craft services', text: 'Water, ice and food. In the desert the water matters most.' });
   at(cr, -15.3, 2.8, 1.2, 1.7, { opt: true, solid: [[-.5, 0, .5], [.5, 0, .5]] });}

  /* the crew; the ones that walk keep their joints, the rest are merged into a few meshes */
  const add = (key, o, parent, [x, y, z], yaw, d, set) => {
    const f = crewman(o); crew[key] = f;
    f.root.position.set(x, y, z); f.root.rotation.y = yaw;
    f.setSit(0, 0); set?.(f);
    if (!o.moves) mergeStatic(f.root);
    if (parent) { parent.add(f.root); f.root.userData.pl = { d, child: true }; items.push(f.root); }
    else at(f.root, x, z, yaw, d, { solid: [[0, 0, .28]] });
    return f;
  };
  add('op', { name: 'Camera operator', shirt: 0x1d1d20, cap: 0x1d1d20, skin: 0, info: 'Frames the shot, riding on the dolly.' }, dolly, [-.42, .0, -.42], Math.PI / 2, 1.9, f => { f.setSit(1, .8); pose(f, { sh: [-1.2, -1.15], el: [-.55, -.6] }); });
  add('ac1', { name: 'First AC', shirt: 0x34414f, skin: 1, shades: true, info: 'The first camera assistant keeps the picture in focus as the camera moves.' }, dolly, [.22, .22, .52], Math.PI, 2.0, f => pose(f, { sh: [-.95, -.2], el: [-.5, -.2] }));
  add('grip', { name: 'Dolly grip', shirt: 0x4b3b2b, cap: 0x6a5a3a, skin: 2, moves: true, info: 'Pushes the dolly along the track, at the same speed every take.' }, track, [D0 - 1.18, 0, 0], Math.PI / 2, 2.1);
  add('ac2', { name: 'Second AC', shirt: 0x2a3a2a, skin: 3, hair: 0x7a4a2a, moves: true, info: 'Marks every take with the slate, so that picture and sound can be matched later.' }, track, [D0 + .95, 0, 1.35], 0, 2.2);
  add('boom', { name: 'Boom operator', shirt: 0x55554c, skin: 4, phones: true, cap: 0x2a2a2a, info: 'Holds the microphone on a pole, just above the top of the frame.' }, null, [BOOM.op.x, 0, BOOM.op.z], Math.atan2(BOOM.mic.x - BOOM.op.x, BOOM.mic.z - BOOM.op.z), 2.0, f => pose(f, { sh: [-2.5, -2.5], el: [-.15, -.15], spread: .02 }));
  add('director', { name: 'Director', shirt: 0xcfc6b0, hat: 0x7a6a4a, skin: 0, phones: true, info: 'Watches the take on the monitors at video village, and calls action and cut.' }, village, [.15, 0, .55], Math.PI, 2.3, f => { f.setSit(1, .7); pose(f, { sh: [-.55, -.5], el: [-.9, -.95] }); });
  add('script', { name: 'Script supervisor', shirt: 0x7a3a3a, skin: 5, hair: 0x1a1210, info: 'Logs every take and keeps continuity from shot to shot.' }, village, [.85, 0, .55], Math.PI, 2.35, f => { f.setSit(1, .7); pose(f, { sh: [-.7, -.4], el: [-1.1, -.9] }); });
  add('gaffer', { name: 'Gaffer', shirt: 0x1d1d20, cap: 0x3a4a6a, skin: 1, shades: true, info: 'Head of the lighting crew. The lamps outside the windows are theirs.' }, null, [-2.0, 0, -5.9], .15, 2.4, f => pose(f, { sh: [.05, -.4], el: [-.2, -1.6] }));
  add('pa', { name: 'Production assistant', shirt: 0x8a8a84, skin: 3, cap: 0xa83a2a, info: 'Keeps people out of the shot, and the water coming.' }, null, [-14.5, 0, 3.9], -2.2, 2.45, f => pose(f, { sh: [.05, -1.9], el: [-.1, -1.5] }));

  /* the slate in the second AC's hands */
  {slate = new THREE.Group();
   const sm = new THREE.MeshStandardMaterial({ map: TX.slateTex(SCENE.pilot, '1'), roughness: .6 });
   const face = M(new THREE.BoxGeometry(.3, .23, .015), [C.black, C.black, C.black, C.black, sm, C.black]); face.position.y = -.02; slate.add(face);
   clap = new THREE.Group(); clap.position.set(-.15, .1, 0); slate.add(clap);
   const bar = M(new THREE.BoxGeometry(.3, .035, .016), new THREE.MeshStandardMaterial({ map: stripes(), roughness: .6 })); bar.position.x = .15; clap.add(bar);
   slate.userData.mat = sm; crew.ac2.spine.add(slate);}

  /* cable on the ground, laid out per place */
  cables = new THREE.Group(); G.add(cables);

  app.onUpdate(update, 26);
  app.on('stop', () => { if (shoot.on) { place(); resetTakes(); } });
  app.on('rv:parked', () => { if (shoot.on) place(); });
  app.on('scripted', on => { if (on && shoot.on) setShoot(false); });
  app.on('drive', on => { if (on && shoot.on) setShoot(false); });
}

const stripes = () => canvasTex(128, 16, (g, _w, h) => { for (let i = -1; i < 9; i++) { g.fillStyle = i % 2 ? '#ece8de' : '#18181a'; g.beginPath(); g.moveTo(i * 16, h); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 + 24, 0); g.lineTo(i * 16 + 16, h); g.fill(); } }, 1, 1);

/* the monitor: the camera's linear picture, tone-mapped the way the main view is, shown as a lit screen */
function screenMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { tMap: { value: tex }, uOn: { value: 0 }, uExp: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform sampler2D tMap; uniform float uOn, uExp; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
      void main(){
        vec3 c = texture2D(tMap, vUv).rgb; if (any(isnan(c))) c = vec3(0.);
        c = aces(min(c, vec3(60.)) * uExp);
        c = pow(c, vec3(1.15)) * 1.6;
        gl_FragColor = vec4(mix(vec3(.004, .006, .012), c, uOn), 1.);
      }`,
  });
}
/* frame lines, the camera's name, REC, timecode, the take */
function overlay(label) {
  const W = 384, H = 216, st = { rec: false, tc: '', take: 1 };
  const tex = canvasTex(W, H, () => {}, 1, 1); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const g = tex.image.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, W, H);
    const fh = W / 2.39, y0 = (H - fh) / 2;
    g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(0, 0, W, y0); g.fillRect(0, y0 + fh, W, H - y0 - fh);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
    for (const [x, y, dx, dy] of [[6, y0, 1, 1], [W - 6, y0, -1, 1], [6, y0 + fh, 1, -1], [W - 6, y0 + fh, -1, -1]]) { g.beginPath(); g.moveTo(x, y + dy * 16); g.lineTo(x, y); g.lineTo(x + dx * 16, y); g.stroke(); }
    g.beginPath(); g.moveTo(W / 2 - 8, H / 2); g.lineTo(W / 2 + 8, H / 2); g.moveTo(W / 2, H / 2 - 8); g.lineTo(W / 2, H / 2 + 8); g.stroke();
    g.font = 'bold 15px Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,.9)'; g.textBaseline = 'middle';
    g.fillText(label, 10, y0 / 2);
    if (st.rec) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(W - 58, y0 / 2, 6, 0, Math.PI * 2); g.fill(); g.fillText('REC', W - 46, y0 / 2); }
    else { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('STBY', W - 52, y0 / 2); }
    g.font = '14px Courier New, monospace'; g.fillStyle = 'rgba(255,255,255,.9)';
    g.fillText(st.tc, 10, H - y0 / 2); g.fillText('TK ' + st.take, W - 58, H - y0 / 2);
    tex.needsUpdate = true;
  };
  return { tex, st, draw };
}

/* ---------- placing it all where the RV is ---------- */
const toW = (x, y, z) => V(x, y, z).applyMatrix4(rv.root.matrixWorld);
const hAt = (x, z) => app.terrain.heightAt(x, z);
function place() {
  if (!rv.root) return;
  rv.root.updateMatrixWorld(true);
  const yaw = rv.root.rotation.y, solids = [];
  /* what is already standing there: trees, junk cars */
  const taken = [...(app.place?.blockers ?? []).flatMap(b => b.list).filter(t => t.r > .8), ...(app.place?.obstacles ?? [])];
  for (const o of shoot.items) {
    const pl = o.userData.pl; if (pl.child) continue;
    const p = toW(pl.x, 0, pl.z), ry = yaw + pl.yaw;
    if (pl.foot) {
      const [a, b] = pl.foot, c = Math.cos(ry), s = Math.sin(ry);
      const h = (lx, lz) => hAt(p.x + lx * c + lz * s, p.z - lx * s + lz * c);
      const f = (h(a, -b) + h(a, b)) / 2, k = (h(-a, -b) + h(-a, b)) / 2, r = (h(-a, b) + h(a, b)) / 2, l = (h(-a, -b) + h(a, -b)) / 2;
      o.position.set(p.x, (f + k) / 2, p.z); o.rotation.set(-Math.atan2(r - l, 2 * b), ry, Math.atan2(f - k, 2 * a), 'YZX');
    } else { o.position.set(p.x, hAt(p.x, p.z), p.z); o.rotation.set(0, ry, 0); }
    const mine = (pl.solid ?? []).map(([sx, sz, sr]) => { const w = V(sx, 0, sz).applyAxisAngle(V(0, 1, 0), ry).add(p); return { x: w.x, z: w.z, r: sr }; });
    /* the trucks and the tables stay away if something is in their spot */
    o.userData.gone = !!pl.opt && mine.some(m => taken.some(t => Math.hypot(t.x - m.x, t.z - m.z) < t.r + m.r));
    if (!o.userData.gone) solids.push(...mine);
    /* aim a lamp, a board or a flag at its point in the RV */
    const hd = o.userData.head, aim = o.userData.aim;
    if (hd && aim) { o.updateMatrixWorld(true); hd.lookAt(toW(aim.x, aim.y, aim.z)); }
  }
  /* the wall stands on the ground on the RV's left, behind */
  {const p = toW(-6.9, 0, -3.5); p.y = hAt(p.x, p.z); rv.body.updateMatrixWorld(true); mover.userData.p3.set(-6.9, rv.body.worldToLocal(p).y, -3.5);}
  for (const [x, z, r] of [[-7.9, -3.4, .35], [-6.9, -3.5, .35], [-5.9, -3.6, .35]]) { const w = toW(x, 0, z); solids.push({ x: w.x, z: w.z, r }); }
  app.shootSolids = solids;
  layCables();
}

/* cable on the ground: generator to distro box, distro to each lamp and to village */
function layCables() {
  for (const m of cables.children) m.geometry.dispose();
  cables.clear();
  const pts = (a, b, n, wig) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, e = Math.sin(t * Math.PI) * wig, x = lerp(a.x, b.x, t) + Math.sin(t * 9 + a.x) * e, z = lerp(a.z, b.z, t) + Math.cos(t * 7 + a.z) * e; out.push(V(x, hAt(x, z) + .025, z)); } return out; };
  const P = (x, z) => toW(x, 0, z);
  const runs = [[P(-26.2, -9.8), P(-9.9, -4.5), .9], [P(-9.4, -4.8), P(-.4, -5.0), .4], [P(-9.4, -4.8), P(-3.9, -4.8), .3], [P(-9.6, -4.4), P(-7.6, 4.6), .5], [P(-9.8, -4.4), P(-12.2, 6.6), .6]];
  if (genItem?.userData.gone) runs.shift();
  const m = mat(0x151517, .6);
  for (const [a, b, w] of runs) {
    const n = Math.max(8, Math.round(a.distanceTo(b) * 1.2));
    const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts(a, b, n, w)), n * 3, .018, 5), m);
    c.receiveShadow = true; cables.add(c);
  }
}

/* where the reveal flies to: behind and to the right of the set, high enough to see into the opening, at the
   angle with the fewest trees in the way */
function vantage() {
  rv.root.updateMatrixWorld(true);
  const base = rv.root.position.y, t = toW(-6.8, 0, 1.4); t.y = base + 1.4;
  const trees = [...(app.place?.blockers ?? []).flatMap(b => b.list), ...(app.place?.obstacles ?? []), ...(app.place?.solids ?? [])].filter(tr => Math.hypot(tr.x - t.x, tr.z - t.z) < 60);
  let best = null;
  for (let i = -4; i <= 4; i++) {
    const a = 2.4 + i * .11, p = toW(-6.8 + Math.cos(a) * 18.5, 0, 1.4 + Math.sin(a) * 18.5);
    p.y = Math.max(hAt(p.x, p.z) + 2.5, base + 7.2);
    const dx = t.x - p.x, dz = t.z - p.z, L2 = dx * dx + dz * dz;
    let score = Math.abs(i) * .2;
    for (const tr of trees) {
      const u = clamp(((tr.x - p.x) * dx + (tr.z - p.z) * dz) / L2, 0, 1), d = Math.hypot(p.x + dx * u - tr.x, p.z + dz * u - tr.z);
      if (d < tr.r + 1.5 && u < .8) score += 2;
      if (Math.hypot(tr.x - p.x, tr.z - p.z) < tr.r + 6) score += 3;
    }
    if (!best || score < best.score) best = { score, p };
  }
  return { pos: best.p, target: t };
}

/* over the director's shoulder, at the monitors */
function monitorView() {
  const a = feeds[0].scr.getWorldPosition(V()), b = feeds[1].scr.getWorldPosition(V()), mid = a.add(b).multiplyScalar(.5);
  const q = feeds[0].scr.getWorldQuaternion(new THREE.Quaternion()), n = V(0, 0, 1).applyQuaternion(q), side = V(1, 0, 0).applyQuaternion(q);
  /* from above the empty chair, so the director's hat is not in the way */
  return { pos: mid.clone().addScaledVector(n, 1.0).addScaledVector(side, -.6).add(V(0, .5, 0)), target: mid.clone().add(V(0, -.02, 0)) };
}

/* ---------- takes ---------- */
function resetTakes() {
  tk.ph = 'wait'; tk.t = 2.2; tk.rec = false; tk.u = 0; tk.said = 0;
  setSlate();
}
function setSlate() {
  const m = slate?.userData.mat; if (!m) return;
  m.map?.dispose(); m.map = TX.slateTex(SCENE[app.stops?.id] ?? '101', String(tk.n)); m.needsUpdate = true;
  for (const f of feeds) f.ov.st.take = tk.n;
}
const nextPh = ph => { tk.ph = ph; tk.t = 0; tk.said = 0; };
function runTake(dt) {
  tk.t += dt;
  const t = tk.t, sc = SCENE[app.stops?.id] ?? '101';
  switch (tk.ph) {
    case 'wait': if (t > 4.5) nextPh('in'); break;
    case 'in': if (t > 1.4) nextPh('mark'); break;
    case 'mark':
      if (!tk.said && t > .35) { tk.said = 1; say(crew.ac2, `${sc}, take ${tk.n}. Marker.`, 1.7); }
      if (tk.said === 1 && t > 1.45) { tk.said = 2; app.emit('clapper'); }
      if (t > 1.9) nextPh('out');
      break;
    case 'out':
      if (!tk.said && t > .6) { tk.said = 1; say(crew.director, 'And… action!', 1.6); }
      if (t > 1.3) { nextPh('roll'); tk.rec = true; }
      break;
    case 'roll':
      tk.u = easeInOut(clamp(t / 9, 0, 1));
      if (t > 9.6) { tk.rec = false; say(crew.director, 'Cut!', 1.2); nextPh('reset'); }
      break;
    case 'reset':
      tk.u = 1 - easeInOut(clamp((t - .8) / 3.4, 0, 1));
      if (!tk.said && t > 1.4) { tk.said = 1; say(crew.director, 'Back to one.', 1.6); }
      if (t > 4.4) { tk.n++; setSlate(); nextPh('wait'); }
      break;
  }
}

/* ---------- per frame ---------- */
const D0 = -1.7, D1 = 1.35;            /* the dolly's run on the track */
let feedT = 0, feedI = 0, farCam = null, ovT = 0, gripPh = 0, acPh = 0, lastU = 0;
const rest = V(), mark = V(), acAt = V(), wp = V();
const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sphere = new THREE.Sphere();
function update(dt) {
  if (!G) return;
  const was = shoot.t;
  if (shoot.on && shoot.t < T_ON) shoot.t = Math.min(T_ON, shoot.t + dt);
  else if (!shoot.on && shoot.t > 0) shoot.t = Math.max(0, shoot.t - dt * 1.8);
  const t = shoot.t; app.shootK = t / T_ON;
  if (t !== was) moveWall(t);
  G.visible = bcam.visible = t > 0;
  if (!G.visible) return;
  cables.visible = t > 1.25;
  for (const o of shoot.items) {
    const s = easeOutBack(clamp((t - o.userData.pl.d) / .42, 0, 1));
    o.visible = s > .002 && !o.userData.gone; o.scale.setScalar(Math.max(.002, s));
  }
  bcam.scale.setScalar(Math.max(.002, easeOutBack(clamp((t - 1.2) / .42, 0, 1))));
  if (t >= T_ON) runTake(dt);

  /* the dolly, and the grip walking behind it */
  const u = tk.u, dx = lerp(D0, D1, u), speed = (u - lastU) * (D1 - D0) / Math.max(dt, 1e-4); lastU = u;
  dolly.position.x = dx;
  const g = crew.grip;
  g.root.position.set(dx - 1.18, 0, 0);
  gripPh += speed / 1.4 * Math.PI * 2 * dt;
  g.walk(gripPh, clamp(Math.abs(speed) * 2.5, 0, 1));
  pose(g, { sh: [-1.3, -1.3], el: [-.35, -.35], spread: .02 });
  g.spine.rotation.x = .12;
  /* the second AC walks in front of the lens with the slate, and out again */
  const ac = crew.ac2;
  rest.set(D0 + .95, 0, 1.35); mark.set(D0 + 1.55, 0, 0);
  let k = 0, amt = 0, face = -.4;
  if (tk.ph === 'in') { const e = easeInOut(clamp(tk.t / 1.4, 0, 1)); acAt.lerpVectors(rest, mark, e); amt = e < .97 ? 1 : 0; face = e < .8 ? Math.atan2(mark.x - rest.x, mark.z - rest.z) : -Math.PI / 2; k = clamp((tk.t - 1.0) / .4, 0, 1); }
  else if (tk.ph === 'mark') { acAt.copy(mark); k = 1; face = -Math.PI / 2; }
  else if (tk.ph === 'out') { const e = easeInOut(clamp(tk.t / 1.3, 0, 1)); acAt.lerpVectors(mark, rest, e); amt = e > .02 && e < .97 ? 1 : 0; face = e < .9 ? Math.atan2(rest.x - mark.x, rest.z - mark.z) : -.4; k = 1 - clamp(tk.t / .35, 0, 1); }
  else acAt.copy(rest);
  ac.root.position.copy(acAt);
  ac.root.rotation.y = dampAngle(ac.root.rotation.y, face, 8, dt);
  acPh += amt * dt * 7.5;
  ac.walk(acPh, amt);
  const sw = amt ? .3 * Math.sin(acPh) : 0;
  pose(ac, { sh: [lerp(sw, -1.45, k), lerp(-sw, -1.45, k)], el: [lerp(-.3, -.15, k), lerp(-.3, -.15, k)], spread: lerp(.08, -.12, k) });
  slate.position.set(lerp(.3, 0, k), lerp(.05, .5, k), lerp(.12, .5, k));
  slate.rotation.set(lerp(1.2, 0, k), 0, lerp(.25, 0, k));
  clap.rotation.z = tk.ph === 'mark' ? (tk.t < 1.3 ? .5 : Math.max(0, .5 - (tk.t - 1.3) * 12)) : .5;
  head.userData.tally.emissiveIntensity = tk.rec ? 3 : 0;

  /* the camera head keeps the lab in frame */
  head.lookAt(toW(-1.2, 2.05, -.25));

  /* the monitors, when someone could see them: near enough, and in the picture */
  feeds[0].scr.getWorldPosition(wp);
  frustum.setFromProjectionMatrix(pm.multiplyMatrices(app.camera.projectionMatrix, app.camera.matrixWorldInverse));
  const near = app.camera.position.distanceTo(wp) < 45 && frustum.intersectsSphere(sphere.set(wp, 1.2));
  for (const f of feeds) f.scr.material.uniforms.uOn.value = t >= T_ON - .3 ? 1 : 0;
  ovT -= dt;
  if (ovT <= 0 && near) {
    ovT = .25;
    const s = Math.floor(app.time), fr = Math.floor((app.time % 1) * 24);
    const tc = `14:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
    for (const f of feeds) { f.ov.st.rec = tk.rec; f.ov.st.tc = tc; f.ov.draw(); }
  }
  feedT -= dt;
  if (feedT <= 0 && near && t >= T_ON - .3) { feedT = app.touch ? .3 : .15; renderFeed(feeds[feedI]); feedI = (feedI + 1) % feeds.length; }
}

/* the rear wall: lift, back, round to the left side, down onto the ground */
const P0 = V(-4.72, .46, 0), P1 = V(-5.6, .72, 0), P2 = V(-6.9, .72, -3.3), P2b = V();
function moveWall(t) {
  const u = clamp(t / 1.5, 0, 1), P3 = mover.userData.p3;
  P2b.set(P2.x, Math.max(P2.y, P3.y + .26), P2.z);
  let yaw = 0;
  if (u < .25) mover.position.lerpVectors(P0, P1, easeInOut(u / .25));
  else if (u < .75) { const e = easeInOut((u - .25) / .5); mover.position.lerpVectors(P1, P2b, e); yaw = -1.42 * e; }
  else { mover.position.lerpVectors(P2b, P3, easeInOut((u - .75) / .25)); yaw = -1.42; }
  mover.rotation.set(0, yaw, 0);
}

/* render one camera's picture into its monitor */
function renderFeed(f) {
  const r = app.renderer, cam = f.cam;
  const src = f.label === 'A CAM' ? head : bcam, off = f.label === 'A CAM' ? .68 : .27, y = f.label === 'A CAM' ? .09 : 0;
  src.updateMatrixWorld(true);
  cam.position.copy(src.localToWorld(V(0, y, off)));
  cam.lookAt(src.localToWorld(V(0, y, 5)));
  cam.updateMatrixWorld();
  farCam ??= new THREE.PerspectiveCamera(40, 16 / 9, app.farCamera.near, app.farCamera.far);
  if (farCam.fov !== cam.fov) { farCam.fov = cam.fov; farCam.updateProjectionMatrix(); }
  farCam.position.copy(cam.position); farCam.quaternion.copy(cam.quaternion); farCam.updateMatrixWorld();
  const prev = r.getRenderTarget(), auto = r.autoClear;
  for (const x of feeds) x.scr.visible = x.om.visible = false;
  for (const o of app.noAO) o.visible = true;
  const us = [fx.soft, fx.glow].filter(Boolean).map(p => p.pts.material.uniforms.uScale), old = us.map(u => u.value);
  for (const u of us) u.value = f.rt.height * .9;
  r.autoClear = false; r.setRenderTarget(f.rt); r.clear(true, true, true);
  r.render(app.farScene, farCam); r.clearDepth(); r.render(app.scene, cam);
  r.setRenderTarget(prev); r.autoClear = auto;
  us.forEach((u, i) => { u.value = old[i]; });
  for (const o of app.noAO) o.visible = false;
  for (const x of feeds) x.scr.visible = x.om.visible = true;
  /* the B camera is inside, and exposed for it */
  f.scr.material.uniforms.uExp.value = (app.exposureBase ?? r.toneMappingExposure) * (f.label === 'B CAM' ? 1.7 : 1);
}
