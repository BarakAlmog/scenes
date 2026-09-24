import * as THREE from 'three';
import { app } from '../app.js';
import { doors } from '../world/apartment.js';
import { cast, SEATS } from './cast.js';
import { damp, dampAngle, easeOutCubic, smooth, lerp, clamp } from '../lib/util.js';

/* Kramer's day: out of 5B, across the hall, through Jerry's door at speed,
   a slide, the fridge, then the Risk game. Press the button again and he
   leaves the way he came, and comes straight back. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = {};
const st = { name: 'home', flags: new Set(), t: 0, path: null, seg: 0, heading: 0, phase: 0, walkAmt: 0, sit: 0, back: false, seatedAt: 0, lastStep: 0 };
let K, rig, tableApple;

export const kramer = {
  get state() { return st.name; },
  trigger() {
    app.lastKramer = app.time;
    if (st.name === 'home') go('cross');
    else if (st.name === 'seated') { st.back = true; go('stand'); }
    else st.back = true;
  },
};

function go(name) { st.name = name; st.t = 0; st.flags = new Set(); }
const once = k => !st.flags.has(k) && !!st.flags.add(k);

function walkTo(points, next, speed = 1.35) {
  st.path = [rig.root.position.clone(), ...points]; st.seg = 0; st.speed = speed; st.after = next;
  const b = st.path[1]; st.heading = Math.atan2(b.x - rig.root.position.x, b.z - rig.root.position.z);
  go('walk');
}

function follow(dt) {
  const p = st.path, pos = rig.root.position;
  let remain = st.speed * dt;
  while (remain > 0 && st.seg < p.length - 1) {
    const b = p[st.seg + 1], dx = b.x - pos.x, dz = b.z - pos.z, d = Math.hypot(dx, dz);
    if (d > 1e-4) st.heading = Math.atan2(dx, dz);
    if (d <= remain) { pos.set(b.x, 0, b.z); remain -= d; st.seg++; }
    else { pos.x += dx / d * remain; pos.z += dz / d * remain; remain = 0; }
  }
  rig.root.rotation.y = dampAngle(rig.root.rotation.y, st.heading, 9, dt);
  const before = st.phase;
  st.phase += st.speed * dt / 1.3 * Math.PI * 2;
  if (Math.floor(before / Math.PI) !== Math.floor(st.phase / Math.PI)) app.emit('step', { pos, who: 'kramer' });
  return st.seg >= p.length - 1;
}

export function buildKramer() {
  K = cast.kramer; rig = K.rig;
  const D = doors.front, c = D.center, n = D.n;
  P.out = V(c.x - n[0] * .75, 0, c.z - n[1] * .75);
  P.doorway = V(c.x + n[0] * .2, 0, c.z + n[1] * .2);
  P.in = V(c.x + n[0] * 1.5, 0, c.z + n[1] * 1.5);
  P.fridge = app.fridge.front.clone().setY(0);
  P.approach = V(.45, 0, -.85);
  P.seat = SEATS.kramer.pos.clone();
  P.b5out = V(doors.b5.center.x, 0, doors.b5.center.z + .75);
  P.b5in = V(doors.b5.center.x, 0, doors.b5.center.z - .55);
  P.faceIn = Math.atan2(n[0], n[1]);

  tableApple = rig.apple.clone(); tableApple.visible = false;
  tableApple.position.set(.13, .81, -1.2); app.root.add(tableApple);

  if (app.reducedMotion || app.params.has('seated')) seatNow();
  else { K.visible = false; rig.root.visible = false; rig.root.position.copy(P.b5in); }
  app.onUpdate(update, 15);
}

function seatNow() {
  rig.root.position.copy(P.seat); rig.root.rotation.y = SEATS.kramer.rot;
  st.sit = 1; rig.cards.visible = true; K.visible = true; rig.root.visible = true; K.seated = true;
  st.seatedAt = app.time; go('seated');
}

/* ---------- poses ---------- */
function standPose(dt) {
  st.walkAmt = damp(st.walkAmt, st.name === 'walk' ? 1 : 0, 8, dt);
  rig.setSit(0, 0);
  rig.walk(st.phase, st.walkAmt);
  rig.spine.rotation.x = damp(rig.spine.rotation.x, 0, 6, dt);
  rig.hair.scale.y = damp(rig.hair.scale.y, 1, 8, dt);
}

function seatedPose(dt) {
  const t = app.time, calm = app.reducedMotion ? .3 : 1;
  rig.setSit(st.sit, SEATS.kramer.hy);
  rig.spine.rotation.set(-.08 * st.sit, 0, 0);
  rig.armL.sh.rotation.set(lerp(-.2, -1.35, st.sit), 0, lerp(-.08, .12, st.sit)); rig.armL.el.rotation.set(lerp(-.3, -.85, st.sit), 0, 0);
  rig.armR.sh.rotation.set(lerp(-.2, -.6 + .3 * Math.sin(t * .8) * calm, st.sit), 0, lerp(.08, -.12, st.sit));
  rig.armR.el.rotation.set(lerp(-.3, -.5 + .25 * Math.sin(t * .8 + .9) * calm, st.sit), 0, 0);
  rig.head.rotation.set(0, .12 * Math.sin(t * .45) * calm, .06 * Math.sin(t * .7 + 1) * calm);
}

function update(dt) {
  st.t += dt;
  const t = st.t, D = doors.front;
  switch (st.name) {
    case 'home': break;

    case 'cross':
      if (once('start')) doors.b5.open();
      if (t > .3) {
        K.visible = true; rig.root.visible = true; K.seated = false; rig.cards.visible = false;
        rig.root.position.copy(P.b5in);
        walkTo([P.b5out, P.out], 'burst', 2.3);
        st.closeB5 = true;
      }
      break;

    case 'walk': {
      const done = follow(dt);
      standPose(dt);
      if (st.closeB5 && rig.root.position.distanceTo(P.b5out) < .2) { doors.b5.close(); st.closeB5 = false; }
      if (st.openFront && rig.root.position.distanceTo(P.doorway) < 1.25) { D.open(); st.openFront = false; st.closeFront = true; }
      if (st.closeFront && rig.root.position.distanceTo(P.out) < .15) { D.close(); st.closeFront = false; }
      if (st.openB5 && rig.root.position.distanceTo(P.b5out) < .5) { doors.b5.open(); st.openB5 = false; }
      if (done) go(st.after);
      break;
    }

    case 'burst': {
      if (once('start')) { rig.root.position.copy(P.out); rig.root.rotation.y = P.faceIn; D.burst(); app.emit('door:burst'); }
      if (t > .08 && !st.entered) { st.entered = true; app.emit('kramer:enter'); }
      const k = clamp((t - .06) / .62, 0, 1), e = easeOutCubic(k);
      rig.root.position.lerpVectors(P.out, P.in, e);
      rig.root.rotation.y = P.faceIn;
      rig.setSit(0, 0);
      /* the slide: legs split, leaning back, arms flung up */
      const s = k < 1 ? Math.sin(Math.min(1, k * 1.4) * Math.PI * .5) : 0;
      const rec = clamp((t - .68) / .5, 0, 1), wob = Math.sin(rec * Math.PI * 3) * (1 - rec);
      const pose = k < 1 ? s : 0;
      rig.legL.hip.rotation.x = -.62 * pose; rig.legR.hip.rotation.x = .45 * pose;
      rig.legL.knee.rotation.x = .15 * pose; rig.legR.knee.rotation.x = .35 * pose;
      rig.spine.rotation.x = -.3 * pose + .22 * wob;
      rig.armL.sh.rotation.set(-.35 * pose, 0, -1.9 * pose - .5 * wob); rig.armL.el.rotation.set(-.4 * pose, 0, 0);
      rig.armR.sh.rotation.set(-.35 * pose, 0, 1.9 * pose + .5 * wob); rig.armR.el.rotation.set(-.4 * pose, 0, 0);
      rig.body.position.y = rig.standY - .06 * pose;
      rig.hair.scale.y = 1 + .25 * Math.sin(t * 22) * Math.max(0, 1 - t);
      if (t > .7 && !st.skid) { st.skid = true; app.emit('kramer:skid'); }
      if (t > .85 && !st.clap) { st.clap = true; app.emit('applause'); }
      if (t > 1.5) { D.close(); st.entered = st.skid = st.clap = false; st.back = false; walkTo([P.fridge], 'turnFridge'); }
      break;
    }

    case 'turnFridge': {
      const want = Math.atan2(-app.fridge.n[0], -app.fridge.n[1]);
      rig.root.rotation.y = dampAngle(rig.root.rotation.y, want, 8, dt); standPose(dt);
      if (t > .35) go('fridge');
      break;
    }

    case 'fridge': {
      if (once('start')) app.fridge.open();
      standPose(dt);
      const lean = smooth(clamp((t - .35) / .4, 0, 1)) * (1 - smooth(clamp((t - 1.7) / .35, 0, 1)));
      rig.spine.rotation.x = .42 * lean;
      rig.armR.sh.rotation.set(-1.25 * lean, 0, .08); rig.armR.el.rotation.set(-.25 * lean, 0, 0);
      if (t > 1.25) rig.apple.visible = true;
      if (t > 1.8) { rig.armR.sh.rotation.x = -.55; rig.armR.el.rotation.x = -1.3; }
      if (t > 2.0 && app.fridge.isOpen) app.fridge.close();
      if (t > 2.3) walkTo([P.approach], 'turnSeat');
      break;
    }

    case 'turnSeat':
      rig.root.rotation.y = dampAngle(rig.root.rotation.y, SEATS.kramer.rot, 8, dt); standPose(dt);
      if (t > .35) go('sit');
      break;

    case 'sit': {
      const k = smooth(clamp(t / .8, 0, 1));
      st.sit = k;
      rig.root.position.lerpVectors(P.approach, P.seat, k);
      rig.root.rotation.y = SEATS.kramer.rot;
      seatedPose(dt);
      if (t > .5) rig.cards.visible = true;
      if (t > .8) {
        rig.apple.visible = false; tableApple.visible = true;
        K.seated = true; st.seatedAt = app.time; app.emit('kramer:seated'); go('seated');
      }
      break;
    }

    case 'seated': {
      st.sit = 1; seatedPose(dt);
      const idle = app.time - (app.lastInput || 0) > 25 && app.time - st.seatedAt > 70;
      if (st.back || (idle && !app.reducedMotion && app.mode !== 'walk')) { st.back = true; go('stand'); }
      break;
    }

    case 'stand': {
      const k = 1 - smooth(clamp(t / .7, 0, 1));
      st.sit = k; K.seated = false;
      rig.root.position.lerpVectors(P.approach, P.seat, k);
      seatedPose(dt);
      if (t > .2) rig.cards.visible = false;
      if (t > .7) {
        st.openFront = true;
        walkTo([P.in, P.doorway, P.out, P.b5out, P.b5in], 'gone');
        st.openB5 = true;
      }
      break;
    }

    case 'gone':
      if (once('start')) { K.visible = false; rig.root.visible = false; doors.b5.close(); tableApple.visible = false; }
      if (t > .9) {
        if (st.back) { st.back = false; go('cross'); }
        else go('home');
      }
      break;
  }
}
