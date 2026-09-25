import * as THREE from 'three';
import { app } from '../app.js';
import { M, mat, canvasTex, seeded, damp, dampAngle, clamp, inPoly } from '../lib/util.js';

/* The mallards in the pool: the hen, the drake in his summer (eclipse) feathers, brown like her, as the ducks in
   the pilot's pool are all brown; and their young. Each duck swims, dabbles, pecks at bread, flaps, flies, and
   waddles up the ramp. A little flock steers itself: after bread, after the hen, round Tony, off the walls. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function featherTex(base, dark, light, seed, { head = null } = {}) {
  const rnd = seeded(seed);
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 5;
      g.fillStyle = rnd() < .55 ? dark : light; g.globalAlpha = .35 + rnd() * .4;
      g.beginPath(); g.ellipse(x, y, r, r * .55, rnd() * .6 - .3, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    if (head) { g.fillStyle = head; g.fillRect(0, 0, w, h * .18); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const MATS = {};
function mats() {
  if (MATS.hen) return MATS;
  MATS.hen = new THREE.MeshStandardMaterial({ map: featherTex('#8a6a48', '#4e3a26', '#b8976c', 3), roughness: .85 });
  MATS.drake = new THREE.MeshStandardMaterial({ map: featherTex('#7b6147', '#43321f', '#a88a64', 7), roughness: .85 });
  MATS.duckling = new THREE.MeshStandardMaterial({ map: featherTex('#7a6040', '#3e2e1c', '#d9c27a', 11), roughness: .95 });
  MATS.headHen = new THREE.MeshStandardMaterial({ map: featherTex('#7f6244', '#3e2c1c', '#a6875e', 5), roughness: .85 });
  MATS.headDrake = new THREE.MeshStandardMaterial({ map: featherTex('#5b4936', '#2a2118', '#7a6446', 9), roughness: .8 });
  MATS.face = mat(0xd8c07a, .9);
  MATS.billHen = mat(0xc07a3a, .6); MATS.billDrake = mat(0xc9b243, .55); MATS.billYoung = mat(0x3a3028, .6);
  MATS.eye = mat(0x0c0a08, .2);
  MATS.foot = mat(0xe07a2a, .7);
  MATS.speculum = mat(0x3a4fb0, .35, .3);
  return MATS;
}

/* one duck; size 1 is an adult hen, about 55 cm from bill to tail */
export function makeDuck(kind = 'hen', size = 1) {
  const m = mats(), young = kind === 'duckling';
  const root = new THREE.Group(); root.name = 'duck-' + kind; root.userData.keep = true;
  const body = new THREE.Group(); root.add(body);
  const bm = young ? m.duckling : kind === 'drake' ? m.drake : m.hen;
  const b = M(new THREE.SphereGeometry(.14, 16, 12), bm); b.scale.set(1, .72, 1.75); b.position.set(0, .07, 0); body.add(b);
  /* the tail, turned up */
  const tail = M(new THREE.ConeGeometry(.07, .16, 10), bm); tail.rotation.x = -Math.PI / 2 - .5; tail.position.set(0, .12, -.25); body.add(tail);
  /* the wings, folded along the back; they open to flap */
  /* the wings: hinged at the shoulder; folded they lie along the flank, open they reach out to flap */
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * .07, .15, .06); body.add(w);
    const span = young ? .2 : .32;
    const wm = M(new THREE.BoxGeometry(span, .018, .26), bm); wm.position.set(s * span / 2, 0, -.1); w.add(wm);
    if (!young) { const sp = M(new THREE.BoxGeometry(.09, .02, .05), m.speculum); sp.position.set(s * span * .45, .002, -.14); w.add(sp); }
    w.userData.s = s; w.rotation.z = -s * 1.25; wings.push(w);
  }
  /* neck and head */
  const neck = new THREE.Group(); neck.position.set(0, .13, .19); body.add(neck);
  const nk = M(new THREE.CylinderGeometry(.045, .06, .14, 10), young ? m.duckling : kind === 'drake' ? m.headDrake : m.headHen); nk.position.y = .05; nk.rotation.x = .3; neck.add(nk);
  const head = new THREE.Group(); head.position.set(0, .12, .03); neck.add(head);
  const hd = M(new THREE.SphereGeometry(young ? .07 : .062, 14, 10), young ? m.duckling : kind === 'drake' ? m.headDrake : m.headHen); hd.scale.set(.9, .92, 1.15); head.add(hd);
  if (young) { const f = M(new THREE.SphereGeometry(.05, 10, 8), m.face); f.position.set(0, -.012, .035); f.scale.set(1.05, .8, .9); head.add(f); }
  const bill = M(new THREE.BoxGeometry(.05, .02, .085), young ? m.billYoung : kind === 'drake' ? m.billDrake : m.billHen); bill.position.set(0, -.012, .09); bill.rotation.x = .12; head.add(bill);
  for (const s of [-1, 1]) { const e = M(new THREE.SphereGeometry(.009, 6, 5), m.eye); e.position.set(s * .045, .014, .03); head.add(e); }
  /* feet, seen when it walks or flies */
  const feet = [];
  for (const s of [-1, 1]) { const f = M(new THREE.BoxGeometry(.05, .01, .07), m.foot); f.position.set(s * .05, -.02, .02); body.add(f); feet.push(f); }
  root.scale.setScalar(size);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const d = {
    root, body, neck, head, wings, feet, kind, size,
    pos: root.position, heading: 0, speed: 0, want: 0, state: 'swim', t: Math.random() * 10, target: null, bite: 0, flap: 0, dabble: 0, peck: 0,
    y: 0, water: 0, fly: null, onRamp: 0,
  };
  return d;
}

/* ---------- a flock ---------- */
export class Flock {
  /* pool: the outline (world x, z); water: the surface height */
  constructor(pool, water) {
    this.pool = pool; this.water = water; this.ducks = []; this.bread = []; this.group = new THREE.Group(); this.group.name = 'ducks';
    this.avoid = null; this.mode = 'swim'; this.flight = null;
    app.onUpdate(dt => { if (this.group.parent?.parent && this.group.visible) this.step(dt); }, 25);
  }
  add(kind, size, x, z) { const d = makeDuck(kind, size); d.pos.set(x, this.water, z); d.heading = Math.random() * 6.28; this.group.add(d.root); this.ducks.push(d); return d; }
  clear() { for (const d of this.ducks) d.root.removeFromParent(); this.ducks = []; this.bread = []; }
  inside(x, z, m = .45) {
    if (!inPoly(x, z, this.pool)) return false;
    for (let i = 0; i < this.pool.length; i++) {
      const a = this.pool[i], b = this.pool[(i + 1) % this.pool.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1); if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < m) return false;
    }
    return true;
  }
  /* a piece of bread lands on the water at (x, z) */
  toss(x, z, mesh) { const b = { x, z, t: 0, mesh, eaten: false }; this.bread.push(b); return b; }
  step(dt) {
    const hen = this.ducks.find(d => d.kind === 'hen');
    for (const d of this.ducks) {
      d.t += dt;
      if (d.state === 'fly') { this.stepFly(d, dt); continue; }
      /* where it wants to go: the nearest bread, the hen (the young), a slow wander */
      let tx = null, tz = null, urgency = .25;
      const bread = this.bread.filter(b => !b.eaten);
      if (bread.length) {
        let best = null, bd = 1e9; for (const b of bread) { const dd = Math.hypot(b.x - d.pos.x, b.z - d.pos.z) * (d.kind === 'duckling' ? .8 : 1) + b.t * .1; if (dd < bd) { bd = dd; best = b; } }
        if (best && bd < 14) { tx = best.x; tz = best.z; urgency = 1; d.target = best; }
      }
      if (tx === null) {
        d.target = null;
        if (d.kind === 'duckling' && hen && d !== hen) {
          const i = this.ducks.indexOf(d), off = .35 + (i % 6) * .22, a = hen.heading + Math.PI + Math.sin(d.t * .4 + i) * .5;
          tx = hen.pos.x + Math.sin(a) * off; tz = hen.pos.z + Math.cos(a) * off; urgency = .5;
        } else {
          d.wander = d.wander ?? [d.pos.x, d.pos.z];
          if (Math.hypot(d.wander[0] - d.pos.x, d.wander[1] - d.pos.z) < .4 || d.t % 9 < dt) { for (let k = 0; k < 12; k++) { const x = d.pos.x + (Math.random() - .5) * 6, z = d.pos.z + (Math.random() - .5) * 6; if (this.inside(x, z, .8)) { d.wander = [x, z]; break; } } }
          [tx, tz] = d.wander;
        }
      }
      /* round Tony when he is in the water, unless he holds out bread */
      if (this.avoid) {
        const a = this.avoid, dx = d.pos.x - a.x, dz = d.pos.z - a.z, dd = Math.hypot(dx, dz), keep = a.hand ? .55 : 1.3;
        if (dd < keep && dd > .01) { tx = d.pos.x + dx / dd * 1.2; tz = d.pos.z + dz / dd * 1.2; urgency = Math.max(urgency, .7); }
        if (a.hand && dd < 3 && !bread.length) { tx = a.x + a.hx; tz = a.z + a.hz; urgency = .8; }
      }
      /* the others */
      for (const o of this.ducks) if (o !== d && o.state !== 'fly') { const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z, dd = Math.hypot(dx, dz), r = (d.size + o.size) * .2; if (dd < r && dd > 1e-4) { d.pos.x += dx / dd * (r - dd) * .5; d.pos.z += dz / dd * (r - dd) * .5; } }
      const dx = tx - d.pos.x, dz = tz - d.pos.z, dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      d.heading = dampAngle(d.heading, want, 2.2 + urgency * 2, dt);
      const sp = dist < .25 ? 0 : Math.min(.35 + urgency * .45, dist * 1.2) * (d.kind === 'duckling' ? 1.15 : 1);
      d.speed = damp(d.speed, d.state === 'swim' ? sp : 0, 3, dt);
      const nx = d.pos.x + Math.sin(d.heading) * d.speed * dt, nz = d.pos.z + Math.cos(d.heading) * d.speed * dt;
      if (this.inside(nx, nz, .3 * d.size)) { d.pos.x = nx; d.pos.z = nz; } else d.heading += dt * 2.4;
      /* eat what it reached */
      if (d.target && Math.hypot(d.target.x - d.pos.x, d.target.z - d.pos.z) < .22 * d.size + .05) {
        d.peck = 1.2; const b = d.target; b.bites = (b.bites ?? 0) + 1;
        if (b.bites > 3) { b.eaten = true; b.mesh?.removeFromParent(); app.emit('duck:eat', d); }
      }
      /* now and then it dabbles, tail up */
      if (d.state === 'swim' && !d.target && d.speed < .2 && Math.random() < dt * .05) d.dabble = 1.6;
      this.pose(d, dt);
    }
    for (const b of this.bread) { b.t += dt; if (b.mesh) { b.mesh.position.set(b.x, this.water + .01 + Math.sin(b.t * 2) * .004, b.z); } }
    this.bread = this.bread.filter(b => !b.eaten);
  }
  pose(d, dt) {
    const t = d.t, r = d.root;
    d.dabble = Math.max(0, d.dabble - dt); d.peck = Math.max(0, d.peck - dt); d.flap = Math.max(0, d.flap - dt);
    const dab = d.dabble > 0 ? Math.sin(Math.min(1, (1.6 - d.dabble) / .3) * Math.PI / 2) * Math.min(1, d.dabble / .3) : 0;
    r.position.y = this.water - .035 * d.size + Math.sin(t * 2.1) * .006 + (d.flap > 0 ? .06 * d.size : 0);
    r.rotation.set(dab * 1.35, d.heading, Math.sin(t * 1.7) * .03);
    d.neck.rotation.x = d.peck > 0 ? .7 + Math.sin(t * 18) * .35 : -.1 + Math.sin(t * 3.2 + d.size) * .06 * (d.speed > .1 ? 2 : 1);
    d.head.rotation.y = d.peck > 0 ? 0 : Math.sin(t * .7 + d.size * 3) * .5;
    const fl = d.flap > 0 ? Math.sin(t * 34) : 0;
    for (const w of d.wings) w.rotation.z = d.flap > 0 ? w.userData.s * (.35 + fl * 1.05) : -w.userData.s * 1.25;
    for (const f of d.feet) f.visible = d.state !== 'swim';
  }
  /* all of them up and away: a run on the water flapping, up over the pool, a turn, off over the trees */
  takeOff(path) {
    this.flight = path;
    this.ducks.forEach((d, i) => { d.state = 'fly'; d.fly = { t: -i * .35 - Math.random() * .2, seg: 0, off: V((Math.random() - .5) * 2.2, (Math.random() - .5) * 1.2, (Math.random() - .5) * 2.2), from: d.pos.clone() }; });
  }
  stepFly(d, dt) {
    const F = d.fly; F.t += dt;
    const flapK = F.t < 0 ? 0 : 1;
    for (const w of d.wings) w.rotation.z = flapK ? w.userData.s * (.25 + Math.sin(d.t * 26) * 1.0) : -w.userData.s * 1.25;
    if (F.t < 0) { this.pose(d, dt); return; }
    /* the path: from the water, climbing, along the curve */
    const pts = this.flight, speed = 7.5, s = F.t * speed;
    let acc = 0, p = d.pos, a = F.from, done = true;
    const all = [F.from, ...pts];
    for (let i = 0; i < all.length - 1; i++) {
      const A = all[i], B = all[i + 1], L = A.distanceTo(B);
      if (acc + L >= s) { const k = (s - acc) / L; p.lerpVectors(A, B, k); a = B; done = false; break; }
      acc += L;
    }
    if (done) { d.root.visible = false; d.gone = true; return; }
    const lift = Math.min(1, F.t / 1.2);
    p.addScaledVector(d.fly.off, lift);
    const dir = V().subVectors(a, p); d.heading = dampAngle(d.heading, Math.atan2(dir.x, dir.z), 4, dt);
    d.root.position.copy(p); d.root.rotation.set(-.15 * lift, d.heading, 0);
    d.neck.rotation.x = -.5 * lift; for (const f of d.feet) f.visible = false;
  }
}
