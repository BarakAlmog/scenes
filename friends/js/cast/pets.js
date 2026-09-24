import * as THREE from 'three';
import { app } from '../app.js';
import { box, sph, cyl, mat, keep, damp, dampAngle } from '../lib/util.js';
import { hotspot } from '../ctrl/hotspots.js';
import { mergeStatic } from '../perf.js';

/* The chick and the duck, loose in Joey and Chandler's living room. They waddle between free spots,
   stop, peck, and cheep or quack when clicked. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SPOTS = [[-6.7, -1.3], [-6.8, -.2], [-6.9, 1.0], [-6.7, 2.3], [-5.7, 2.55], [-4.6, 2.55], [-3.9, 1.3], [-4.2, .35], [-6.2, 1.9], [-7.2, 2.7]];
const LINKS = [[1, 8], [0, 2, 8], [1, 3, 8], [2, 4, 9, 8], [3, 5, 8], [4, 6], [5, 7], [6], [1, 2, 3, 4], [3]];
export const pets = {};

function bird({ body, head, bill, size, name }) {
  const g = keep(new THREE.Group()), b = new THREE.Group(); g.add(b);
  const torso = sph(b, .1 * size, body, 0, .14 * size, 0, 14, 10); torso.scale.set(.85, .8, 1.15);
  const tail = sph(b, .05 * size, body, 0, .17 * size, -.1 * size, 10, 8); tail.scale.set(.8, .6, 1.2);
  const hd = new THREE.Group(); hd.position.set(0, .26 * size, .07 * size); b.add(hd);
  sph(hd, .06 * size, head, 0, 0, 0, 12, 10);
  const bk = box(hd, .05 * size, .02 * size, .06 * size, bill, 0, -.01 * size, .06 * size);
  for (const s of [-1, 1]) sph(hd, .011 * size, mat(0x111111, .4), s * .035 * size, .015 * size, .035 * size, 6, 5);
  const feet = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(s * .04 * size, .07 * size, 0); b.add(f);
    cyl(f, .008 * size, .008 * size, .07 * size, bill, 0, -.035 * size, 0, 6);
    box(f, .05 * size, .01 * size, .06 * size, bill, 0, -.07 * size, .02 * size);
    feet.push(f);
  }
  for (const s of [-1, 1]) { const w = sph(b, .06 * size, body, s * .08 * size, .15 * size, -.01 * size, 10, 8); w.scale.set(.35, .7, 1.1); }
  keep(hd); feet.forEach(keep); mergeStatic(b); mergeStatic(hd);
  return { g, b, hd, bk, feet, name, size };
}

function wanderer(p, start, speed) {
  const w = { ...p, at: start, target: start, pos: V(SPOTS[start][0], 0, SPOTS[start][1]), heading: 0, rest: 1 + Math.random() * 3, phase: Math.random() * 9, hop: 0, peck: 0 };
  w.g.position.copy(w.pos); app.root.add(w.g);
  w.update = dt => {
    const t = app.time;
    if (w.rest > 0) {
      w.rest -= dt;
      w.peck = Math.max(0, Math.sin(t * 5 + w.phase)) * (Math.sin(t * .7 + w.phase) > .3 ? 1 : 0);
      if (w.rest <= 0) { const nb = LINKS[w.at]; w.target = nb[Math.floor(Math.random() * nb.length)]; }
    } else {
      const [tx, tz] = SPOTS[w.target], dx = tx - w.pos.x, dz = tz - w.pos.z, d = Math.hypot(dx, dz);
      if (d < .05) { w.at = w.target; w.rest = 1.5 + Math.random() * 4; }
      else { const s = Math.min(d, speed * dt); w.pos.x += dx / d * s; w.pos.z += dz / d * s; w.heading = Math.atan2(dx, dz); }
      w.peck = 0;
    }
    const moving = w.rest <= 0;
    w.g.position.set(w.pos.x, Math.abs(Math.sin(w.hop * Math.PI)) * .18, w.pos.z);
    w.hop = Math.max(0, w.hop - dt * 2.2);
    w.g.rotation.y = dampAngle(w.g.rotation.y, w.heading, 6, dt);
    const wd = moving ? Math.sin(t * 14 + w.phase) : 0;
    w.b.rotation.z = .12 * wd; w.feet[0].rotation.x = .5 * wd; w.feet[1].rotation.x = -.5 * wd;
    w.hd.rotation.x = damp(w.hd.rotation.x, .9 * w.peck, 12, dt);
  };
  app.onUpdate(w.update);
  return w;
}

export function buildPets() {
  const duck = bird({ body: mat(0xf6f5f0, .7), head: mat(0xf6f5f0, .7), bill: mat(0xe8902a, .5), size: 1.5, name: 'duck' });
  const chick = bird({ body: mat(0xf5d24a, .8), head: mat(0xf5d24a, .8), bill: mat(0xe8902a, .5), size: .85, name: 'chick' });
  pets.duck = wanderer(duck, 3, .35);
  pets.chick = wanderer(chick, 6, .45);
  hotspot(duck.g, { title: 'The duck', text: 'Joey and Chandler’s duck. Click it.', action: () => { pets.duck.hop = 1; app.emit('quack', pets.duck.g.position); } });
  hotspot(chick.g, { title: 'The chick', text: 'Joey and Chandler’s chick. Click it.', action: () => { pets.chick.hop = 1; app.emit('cheep', pets.chick.g.position); } });
}
