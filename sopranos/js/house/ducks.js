import * as THREE from 'three';
import { app } from '../app.js';
import { loadHouseWorld } from './house.js';
import { want, loop, play, slice, stopLoops } from '../audio.js';
import { tod } from '../world/lighting.js';
import { hotspot } from '../ctrl/hotspots.js';
import { buildDucks } from './ducksMoment.js';

/* The ducks (the pilot, 1999): 14 Aspen Drive in June 1998. A summer morning; the paper at the bottom of the drive;
   a pair of mallards and their ducklings in the pool; weeks later, AJ's birthday party at the grill. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = h => new THREE.Color(h);
export const P = {
  date: [1998, 5, 15], lat: 40.86803, lon: -74.2454, grid: .494, tz: -5, dst: true, hour: 8.3,
  turbidity: 3.4, rayleigh: 1.45, mie: .0052, mieG: .82, haze: 1 / 7000, sunI: 3.2, exposure: .78, nightExposure: 3.0,
  groundAlbedo: C(0x626a4c), skyK: .26,
  clouds: { cover: .28, scale: .0006, soft: .16, alt: 2100, depth: .3, wind: [3, 1.2] },
};
export const ICON = {
  yard: '<path d="M3 20h18M5 20v-7l7-5 7 5v7"/><path d="M9 20v-4h6v4"/>',
  pool: '<path d="M3 14c3-2 6 2 9 0s6 2 9 0M3 18c3-2 6 2 9 0s6 2 9 0"/><path d="M8 11V5h1M16 11V5h-1M8 8h8"/>',
  pav: '<path d="M3 10l9-6 9 6z"/><path d="M6 10v9M18 10v9M12 10v9M4 19h16"/>',
  drive: '<path d="M9 21c0-6 6-9 6-18M15 21c0-4 3-7 4-9"/><path d="M5 21V9h2v12"/>',
  front: '<path d="M4 20V9l8-5 8 5v11z"/><path d="M10 20v-5h4v5M7 12h2M15 12h2"/>',
  above: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
};

export async function load({ status } = {}) {
  const W = await loadHouseWorld({ status, season: 'summer' });
  const { T, groups, SPOTS } = W;
  const at = (x, z, h) => V(x, T.heightAt(x, z) + h, z);
  const vw = (label, icon, [x, z, h], [tx, tz, th], fov) => ({ label, icon, get: () => ({ pos: at(x, z, h), target: at(tx, tz, th), fov }) });
  const [fx, fz] = SPOTS.frontDoor;
  const place = {
    id: 'ducks', P, world: W, T, groups, SPOTS, maskAt: W.maskAt, forest: W.forest, trees: W.trees, mats: W.mats,
    views: {
      yard: vw('The yard', ICON.yard, [17, 7, 13], [-14, -6, 1.5]),
      pool: vw('The pool', ICON.pool, [9.2, 2.4, 1.6], [-14, -7.6, 1.5], 50),
      pavilion: vw('From the pavilion', ICON.pav, [...W.yard.pavAt(.9, -1.35), 1.75], [-15, -9, 1.7], 50),
      drive: vw('The drive', ICON.drive, [-41.3, -15.2, 1.7], [-63, -31, 1.2], 50),
      front: vw('The front', ICON.front, [-56, -42, 2.8], [-30, -18, 2.4]),
      above: vw('From above', ICON.above, [-6, 52, 160], [-16, -10, 0]),
    },
    viewOrder: ['yard', 'pool', 'pavilion', 'drive', 'front', 'above'], startView: 'yard',
    orbit: { x: -20, z: -10, r: 140 }, fov: 40, minEye: .5,
    walkStart: { pos: V(fx, 0, fz), yaw: 1.03 },
    solidsNear: W.solidsNear, polys: W.polys, floorAt: W.floorAt, bound: W.bound,
    surfaceAt: () => 1,
    noAO: W.noAO,
    help: [['Space', 'The ducks: get the paper, feed the ducks in the pool, then the party.'], ['E', 'Pick up, throw, use']],
    snowy: false,
    walkHelp: (mode, locked) => mode === 'game' ? (app.touch ? 'Left thumb to move · right thumb to look · USE for the action' : locked ? '' : 'Click to look with the mouse · WASD to move · E to act') : null,
    enter() {
      W.forest.update(true);
      want(['amb-summer', 'birds', 'mower', 'quack', 'quackfly', 'peep', 'wings', 'flap2', 'wade', 'plop', 'toss', 'paper', 'slipper', 'stepgrass', 'party', 'kids', 'fluid', 'ignite', 'whoosh', 'fire', 'thud', 'heart', 'breath']);
    },
    /* a June morning in the suburbs: birds, a mower somewhere, now and then a car; the party when it is on */
    sound() {
      const night = tod.night ?? 0, party = place.act?.state?.phase === 'party';
      loop('amb-summer').set((1 - night) * .8);
      loop('birds').set((1 - night) * (party ? .35 : .7));
      loop('mower', { pos: V(-120, 2, 60), ref: 40 }).set(party ? 0 : (1 - night) * .5);
      loop('party', { pos: V(-12, 1.5, 2), ref: 6 }).set(party ? .8 : 0);
      loop('kids', { pos: V(-6, 1.2, 12), ref: 8 }).set(party ? .5 : 0);
    },
    leave() { place.act?.stop?.(); stopLoops('amb-'); stopLoops('birds'); stopLoops('mower'); stopLoops('party'); stopLoops('kids'); },
  };
  place.act = buildDucks(place);
  hotspot(W.yard.ramp, { title: 'The ducks’ ramp', text: 'Tony built the ducks a ramp of wooden slats from the edge of the pool into the water, so the ducklings could climb out.' });
  hotspot(W.yard.grill, { title: 'The grill', text: 'AJ’s birthday party. Tony is lighting the grill, a cigar in his mouth, when the ducks take off. He cannot breathe, and falls; the lighter fluid spills and the grill bursts into flame.' });
  hotspot(W.yard.paper, { title: 'The Star-Ledger', text: 'Every morning Tony walks down the drive in his robe for the paper. The walk comes back at the start of season after season.' });
  hotspot(W.yard.pav, { title: 'The pavilion', text: 'Eight white columns on brick piers, a brick wall on the side of the woods. In season 5 it is where Tony keeps watch for the bear.' });
  /* steps: slippers on the drive and the patio, bare grass on the lawn; now and then the ducklings peep */
  app.on('step', e => {
    if (app.place !== place) return;
    const you = e.who === 'you', x = e.pos.x, z = e.pos.z, [lawn] = W.maskAt(x, z);
    const hard = W.levelled.some(L => L.kind === 'drive' && L.pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.6)) || Math.hypot(x + 5, z) < 16;
    const o = { pos: you ? null : new THREE.Vector3(x, (e.pos.y ?? 0) + .1, z), ref: 3, gain: you ? .3 : .4 };
    if (W.floorAt(x, z) < -.3) return;
    if (hard) slice('slipper', 4, .55, o); else slice('stepgrass', 4, .5, o);
    void lawn;
  });
  app.onUpdate(dt => {
    if (app.place !== place || !place.flock?.group.visible) return;
    place.peepT = (place.peepT ?? 3) - dt;
    if (place.peepT < 0) { place.peepT = 2 + Math.random() * 5; const d = place.flock.ducks[2 + Math.floor(Math.random() * 6)]; if (d && !d.gone) play('peep', { pos: d.pos, ref: 3, gain: .35 }); }
  }, 40);
  return place;
}
