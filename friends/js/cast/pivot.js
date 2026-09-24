import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { mat, damp, dampAngle, smooth, clamp, lerp, easeInOut, easeOutCubic, keep } from '../lib/util.js';
import { sofa } from '../lib/props.js';
import { doors, heightAt, STAIR } from '../world/plan.js';
import { cast, SEATS } from './cast.js';
import { say } from '../ui/bubbles.js';
import { hotspot } from '../ctrl/hotspots.js';

/* PIVOT! Ross calls for help with his new sofa. Rachel and Chandler come out into the hall, the three
   carry it up the stairs, it sticks at the landing, Ross shouts PIVOT three times, Chandler tells him
   to shut up, and the sofa slides back down. Then everyone goes home and the sofa waits for next time. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HOME = V(.47, 0, -3.1), HOME_ROT = -Math.PI / 2;
const X = -.82, LEN = 1.0, SLOPE = Math.atan2(STAIR.rise, STAIR.run);
const st = { name: 'idle', t: 0, flags: new Set(), again: false };
let couch, carrier;

export const pivot = {
  get state() { return st.name; },
  get couch() { return couch; },
  trigger() { if (st.name === 'idle') go('call'); else st.again = true; },
};
const go = name => { st.name = name; st.t = 0; st.flags = new Set(); };
const once = k => !st.flags.has(k) && !!st.flags.add(k);

/* ---------- walkers: follow a path, feet on the stairs ---------- */
const walkers = {};
function walker(key) {
  const c = cast[key], r = c.rig;
  return walkers[key] = { key, c, r, path: null, seg: 0, speed: 1.4, phase: 0, amt: 0, heading: r.root.rotation.y, done: true, face: null,
    to(points, speed = 1.4) { this.path = [r.root.position.clone().setY(0), ...points.map(p => p.clone().setY(0))]; this.seg = 0; this.speed = speed; this.done = false; this.face = null; return this; },
    update(dt) {
      const pos = r.root.position;
      if (!this.done) {
        let remain = this.speed * dt;
        while (remain > 0 && this.seg < this.path.length - 1) {
          const b = this.path[this.seg + 1], dx = b.x - pos.x, dz = b.z - pos.z, d = Math.hypot(dx, dz);
          if (d > 1e-4) this.heading = Math.atan2(dx, dz);
          if (d <= remain) { pos.x = b.x; pos.z = b.z; remain -= d; this.seg++; } else { pos.x += dx / d * remain; pos.z += dz / d * remain; remain = 0; }
        }
        if (this.seg >= this.path.length - 1) this.done = true;
        const before = this.phase; this.phase += this.speed * dt / 1.25 * Math.PI * 2;
        if (Math.floor(before / Math.PI) !== Math.floor(this.phase / Math.PI)) app.emit('step', { pos, who: key });
      }
      this.amt = damp(this.amt, this.done ? 0 : 1, 8, dt);
      r.root.rotation.y = dampAngle(r.root.rotation.y, this.face ?? this.heading, 9, dt);
      pos.y = damp(pos.y, heightAt(pos.x, pos.z, true), 14, dt);
      r.setSit(0, 0); r.walk(this.phase, this.amt);
    },
  };
}

/* a figure's hands on the sofa: arms forward and up to the grip height */
function carryPose(r, lift = 1, reach = 1.25) {
  r.armL.sh.rotation.set(-reach * lift, 0, -.1); r.armL.el.rotation.set(-.25 * lift, 0, 0);
  r.armR.sh.rotation.set(-reach * lift, 0, .1); r.armR.el.rotation.set(-.25 * lift, 0, 0);
}

/* sit <-> stand: a figure rises from its seat onto the spot in front of it */
function rise(key, k, seat, front) {
  const c = cast[key], r = c.rig;
  r.root.position.lerpVectors(seat.pos, front, 1 - k);
  r.setSit(k, seat.hy); r.spine.rotation.set(0, 0, 0);
  r.armL.sh.rotation.set(-.3 * k, 0, 0); r.armR.sh.rotation.set(-.3 * k, 0, 0); r.armL.el.rotation.set(-.5 * k, 0, 0); r.armR.el.rotation.set(-.5 * k, 0, 0);
}

/* where the sofa's two ends are, for the carriers' hands */
function ends() {
  const cph = Math.cos(carrier.rotation.z), sph = Math.sin(carrier.rotation.z), yaw = carrier.rotation.y;
  const ax = Math.cos(yaw) * cph, az = -Math.sin(yaw) * cph;    /* the sofa's long axis in the world */
  const p = carrier.position;
  return { back: V(p.x + ax * LEN, p.y + sph * LEN, p.z + az * LEN), front: V(p.x - ax * LEN, p.y - sph * LEN, p.z - az * LEN) };
}

/* the sofa's centre while climbing: z from the foot (-3.6) to the stuck point (-5.7) */
function climbAt(z) {
  const k = smooth(clamp((-3.6 - z) / 1.9, 0, 1)), tilt = -SLOPE * k;
  const y = Math.max(.42, heightAt(X, z, true) + .5);
  return { y, tilt };
}

export function buildPivot() {
  carrier = keep(new THREE.Group()); app.root.add(carrier);
  carrier.rotation.order = 'YZX';
  couch = sofa({ w: 2.0, d: .9, cover: MAT.couchCream, cushion: mat(0xefe4cc, .95), legs: MAT.woodDark });
  couch.position.set(0, 0, 0); carrier.add(couch);
  couch.rotation.y = 0;
  const idle = () => { carrier.position.copy(HOME); carrier.rotation.set(0, HOME_ROT, 0, 'YZX'); };
  idle();
  /* the sofa's own frame: width along x, so the carrier's yaw turns x onto the hall's length */
  hotspot(carrier, { title: 'Ross’s new sofa', text: 'It needs to go up the stairs. Press PIVOT! (or V), or click it.', action: () => pivot.trigger() });
  for (const k of ['ross', 'rachel', 'chandler']) walker(k);
  app.on('pivot:go', () => pivot.trigger());
  app.onUpdate(dt => update(dt, idle), 18);
}

/* from the spot in front of each seat, around the furniture, out of the door into the hall */
const RACHEL_OUT = [V(6.56, 0, .75), V(6.52, 0, 2.05), V(4.9, 0, 2.1), V(2.9, 0, 1.9), V(1.7, 0, 1.05), V(.35, 0, .9)];
const CHANDLER_OUT = [V(-5.75, 0, -.52), V(-6.4, 0, -.3), V(-6.4, 0, 1.8), V(-4.7, 0, 1.95), V(-3.4, 0, 1.35), V(-1.7, 0, .9), V(-.35, 0, .9)];
const GRIP = { ross: V(.47, 0, -4.42), rachel: V(.47, 0, -1.78), chandler: V(-.2, 0, -3.1) };

function update(dt, idle) {
  st.t += dt;
  const t = st.t, R = walkers.ross, Ra = walkers.rachel, C = walkers.chandler;
  const drive = (...ws) => { for (const w of ws) w.update(dt); };
  switch (st.name) {
    case 'idle': break;

    case 'call': {
      if (once('start')) {
        for (const w of [R, Ra, C]) w.c.controlled = true;
        R.face = Math.atan2(0 - R.r.root.position.x, .9 - R.r.root.position.z);
        say(R.r, 'Guys! A little help?', 2.2);
        app.emit('pivot:call'); app.emit('pivot:start');
        doors.m20.open(.8); doors.g19.open(.8);
        if (app.recliners.chandler.target > .5) app.recliners.chandler.target = 0;
      }
      drive(R);
      /* Rachel and Chandler get up */
      const k = 1 - smooth(clamp((t - .5) / .7, 0, 1));
      rise('rachel', k, SEATS.rachel, RACHEL_OUT[0]);
      rise('chandler', k, SEATS.chandler, CHANDLER_OUT[0]);
      if (t > 1.25) {
        Ra.to([...RACHEL_OUT.slice(1), V(.35, 0, -1.2), GRIP.rachel], 2.2);
        C.to([...CHANDLER_OUT.slice(1), V(-.35, 0, -1.4), GRIP.chandler], 2.2);
        R.to([V(-.2, 0, -2.6), V(-.2, 0, -4.35), GRIP.ross], 1.3);
        go('gather');
      }
      break;
    }

    case 'gather':
      drive(R, Ra, C);
      if (R.done) R.face = 0;
      if (Ra.done) Ra.face = Math.PI;
      if (C.done) C.face = Math.PI / 2;
      if (R.done && Ra.done && C.done && t > .6) go('lift');
      break;

    case 'lift': {
      drive(R, Ra, C);
      const k = smooth(clamp(t / .8, 0, 1));
      for (const w of [R, Ra, C]) carryPose(w.r, k, 1.0);
      for (const w of [R, Ra, C]) w.r.spine.rotation.x = .35 * (1 - Math.abs(k * 2 - 1));
      carrier.position.y = .38 * k;
      if (t > .9) {
        /* sidle west to the foot of the stairs */
        R.to([V(X, 0, -4.9)], .9); Ra.to([V(-1.12, 0, -2.2)], .9); C.to([V(-.5, 0, -2.1)], .9);
        R.face = 0; Ra.face = Math.PI; C.face = Math.PI;
        st.from = carrier.position.clone(); go('toStairs');
      }
      break;
    }

    case 'toStairs': {
      drive(R, Ra, C);
      for (const w of [R, Ra, C]) carryPose(w.r, 1, 1.05);
      const k = easeInOut(clamp(t / 1.5, 0, 1));
      carrier.position.lerpVectors(st.from, V(X, .42, -3.6), k);
      if (t > 1.55) { st.z = -3.6; go('climb'); }
      break;
    }

    case 'climb': {
      st.z = Math.max(-5.7, st.z - dt * .85);
      const { y, tilt } = climbAt(st.z);
      carrier.position.set(X, y, st.z); carrier.rotation.set(0, HOME_ROT, tilt, 'YZX');
      const e = ends();
      /* Ross backs up the stairs ahead of the front end; the other two push from the bottom */
      const place = (w, x, z, face) => {
        const p = w.r.root.position; p.x = x; p.z = z; p.y = damp(p.y, heightAt(x, z, true), 14, dt);
        w.r.root.rotation.y = dampAngle(w.r.root.rotation.y, face, 9, dt);
        w.phase += dt * 5.5; w.r.setSit(0, 0); w.r.walk(w.phase, .7);
      };
      place(R, X, e.front.z - .38, 0); place(Ra, -1.12, e.back.z + .42, Math.PI); place(C, -.5, e.back.z + .55, Math.PI);
      carryPose(R.r, 1, 1.35); carryPose(Ra.r, 1, 1.5); carryPose(C.r, 1, 1.4);
      if (st.z <= -5.7) { app.emit('pivot:stuck'); app.emit('shake', .02); go('stuck'); }
      break;
    }

    case 'stuck': {
      /* three tries, each a twist that jams */
      const lines = [[.2, 'Pivot!', .5], [1.55, 'Pivot!', .7], [2.9, 'PIVOT!', 1.0]];
      for (const [at, text] of lines) if (t > at && once(text + at)) say(R.r, text, 1.0);
      if (t > 4.3 && once('shut')) say(C.r, 'Shut up! Shut up! Shut up!', 1.9);
      let twist = 0;
      for (const [at, , amp] of lines) { const u = clamp((t - at) / 1.1, 0, 1); if (u > 0 && u < 1) twist += Math.sin(u * Math.PI) * amp * (1 - .6 * u) * (at === 1.55 ? -1 : 1); }
      const { y, tilt } = climbAt(-5.7);
      carrier.position.set(X + twist * .12, y + Math.abs(twist) * .05, -5.7);
      carrier.rotation.set(twist * .08, HOME_ROT + twist * .45, tilt + Math.abs(twist) * .06, 'YZX');
      for (const w of [R, Ra, C]) { w.r.setSit(0, 0); w.r.walk(0, 0); }
      carryPose(R.r, 1, 1.35 + twist * .2); carryPose(Ra.r, 1, 1.5); carryPose(C.r, 1, 1.4);
      R.r.spine.rotation.set(0, -twist * .3, 0);
      for (const [at] of lines) { const u = t - at; if (u > .45 && u < .5 && once('bump' + at)) app.emit('shake', .025); }
      if (t > 6.4) { app.emit('pivot:fall'); st.from = carrier.position.clone(); go('fall'); }
      break;
    }

    case 'fall': {
      /* it slips: down the flight and onto the floor */
      const k = clamp(t / 1.05, 0, 1), e = k * k;
      const z = lerp(-5.7, -3.45, e);
      const { y, tilt } = climbAt(z);
      carrier.position.set(X, lerp(y, 0, smooth(clamp((k - .7) / .3, 0, 1))), z);
      carrier.rotation.set(0, HOME_ROT + .25 * k, tilt * (1 - smooth(clamp((k - .6) / .4, 0, 1))), 'YZX');
      /* Rachel and Chandler jump clear */
      if (once('clear')) { Ra.to([V(-1.3, 0, -1.2)], 3.2); C.to([V(.4, 0, -1.6)], 3.2); }
      drive(Ra, C);
      R.r.setSit(0, 0); carryPose(R.r, 1 - k, 1.2);
      if (k >= 1 && once('land')) { app.emit('shake', .06); app.emit('sofa:thud'); setTimeout(() => app.emit('applause'), 250); }
      if (t > 1.7) go('beat');
      break;
    }

    case 'beat':
      drive(Ra, C);
      R.r.walk(0, 0);
      if (once('line')) say(R.r, 'OK. I don’t think it’s gonna pivot any more.', 2.6);
      if (t > 2.5 && once('you')) say(C.r, 'You think?', 1.6);
      if (t > 3.6) {
        R.to([V(X, 0, -4.55), V(-.1, 0, -2.3)], 1.1);
        Ra.to([V(.35, 0, -.4), ...RACHEL_OUT.slice().reverse()], 1.8);
        C.to([V(-.35, 0, -.4), ...CHANDLER_OUT.slice().reverse()], 1.8);
        st.from = carrier.position.clone(); st.fromYaw = carrier.rotation.y;
        go('home');
      }
      break;

    case 'home': {
      drive(R, Ra, C);
      /* Ross drags the sofa back into place */
      if (R.done && !st.flags.has('drag')) { st.flags.add('drag'); st.dragT = t; }
      if (st.flags.has('drag')) {
        const k = easeInOut(clamp((t - st.dragT) / 1.4, 0, 1));
        carrier.position.lerpVectors(st.from, HOME, k); carrier.rotation.set(0, lerp(st.fromYaw, HOME_ROT, k), 0, 'YZX');
        carryPose(R.r, .6 * (1 - Math.abs(k * 2 - 1)) + .3, 1.0);
        if (k >= 1 && once('rossBack')) R.to([SEATS.ross.pos], 1.1);
      }
      /* the helpers sit back down */
      for (const [w, key, seat, front] of [[Ra, 'rachel', SEATS.rachel, RACHEL_OUT[0]], [C, 'chandler', SEATS.chandler, CHANDLER_OUT[0]]]) {
        if (w.done && !st.flags.has('sit' + key)) { st.flags.add('sit' + key); st['sitT' + key] = t; w.r.root.rotation.y = seat.rot; }
        if (st.flags.has('sit' + key)) {
          const k = smooth(clamp((t - st['sitT' + key]) / .8, 0, 1));
          w.r.root.rotation.y = dampAngle(w.r.root.rotation.y, seat.rot, 12, dt);
          rise(key, k, seat, front); w.r.root.position.y = 0;
          if (k >= 1) w.c.controlled = false;
        }
      }
      if (Ra.c.controlled === false && C.c.controlled === false && !st.flags.has('doors')) { st.flags.add('doors'); doors.m20.close(); doors.g19.close(); }
      if (st.flags.has('rossBack') && R.done && !Ra.c.controlled && !C.c.controlled) {
        R.c.controlled = false; R.r.root.rotation.y = SEATS.ross.rot; idle();
        go('idle');
        if (st.again) { st.again = false; setTimeout(() => pivot.trigger(), 600); }
      }
      break;
    }
  }
}
