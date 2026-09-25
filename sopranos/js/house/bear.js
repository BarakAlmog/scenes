import * as THREE from 'three';
import { app } from '../app.js';
import { loadHouseWorld } from './house.js';
import { want, loop, play, slice, stopLoops } from '../audio.js';
import { tod } from '../world/lighting.js';
import { hotspot } from '../ctrl/hotspots.js';
import { box, mat } from '../lib/util.js';
import { buildBearGame } from './bearGame.js';
import { ICON } from './ducks.js';

/* The bear ("Two Tonys", 2004): the same yard in late autumn, 2003. Bare trees, leaves on the lawn, the pool under
   its cover, the pavilion lit at night. A black bear comes out of the woods for the duck feed. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = h => new THREE.Color(h);
export const P = {
  date: [2003, 10, 20], lat: 40.86803, lon: -74.2454, grid: .494, tz: -5, dst: true, hour: 21.3,
  turbidity: 2.4, rayleigh: 1.4, mie: .0042, mieG: .8, haze: 1 / 9000, sunI: 3.0, exposure: .8, nightExposure: 3.4,
  groundAlbedo: C(0x4e453a), skyK: .24,
  clouds: { cover: .4, scale: .0006, soft: .16, alt: 2400, depth: .32, wind: [5, 2] },
};

export async function load({ status } = {}) {
  const W = await loadHouseWorld({ status, season: 'late' });
  const { T, groups, SPOTS } = W;
  const at = (x, z, h) => V(x, T.heightAt(x, z) + h, z);
  const vw = (label, icon, [x, z, h], [tx, tz, th], fov) => ({ label, icon, get: () => ({ pos: at(x, z, h), target: at(tx, tz, th), fov }) });
  /* the patio at night is wet and dark */
  const Y = W.yard; Y.patio.material.roughness = .45; Y.patio.material.color.setScalar(.82);

  /* floodlights under the eaves of the back wall, two heads each, off until you switch them on */
  const floods = [];
  const glowM = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xfff0d0, emissiveIntensity: 0, roughness: .3 });
  for (const [s, aim] of [[-12.2, V(-1, 0, 3)], [3.6, V(-3, 0, 10)]]) {
    const [x, z] = W.ST(s, -20.3), y = 5.25;
    const g = new THREE.Group(); g.position.set(x, y, z); g.lookAt(aim); groups.near.add(g); g.userData.keep = true;
    box(g, .2, .08, .08, mat(0x1c1c1e, .5, .4), 0, 0, 0);
    for (const k of [-1, 1]) { const h = box(g, .14, .12, .12, mat(0x222224, .5, .4), k * .12, -.04, .06); h.rotation.x = -.35; const l = box(g, .11, .09, .02, glowM, k * .12, -.07, .13); l.rotation.x = -.35; l.castShadow = false; }
    const L = new THREE.SpotLight(0xfff1d6, 0, 48, .62, .5, 1.5); L.position.set(x, y - .1, z); L.target.position.copy(aim); L.castShadow = false;
    groups.near.add(L, L.target); floods.push(L);
  }
  /* the lanterns on the back wall and by the doors throw a little light on the patio */
  const lamps = [];
  for (const l of W.house.lanterns) { const p = l.getWorldPosition(V()); const L = new THREE.PointLight(0xffc98a, 0, 9, 1.6); L.position.copy(p).add(V(0, -.1, 0)); groups.near.add(L); lamps.push(L); }
  app.onUpdate(() => { if (app.place?.world !== W) return; const k = Math.max(tod.night ?? 0, (tod.dim ?? 0) * .8); for (const L of lamps) L.intensity = k * 5; }, 31);
  const place = {
    id: 'bear', P, world: W, T, groups, SPOTS, maskAt: W.maskAt, forest: W.forest, trees: W.trees, mats: W.mats, floods, floodM: glowM,
    views: {
      watch: vw('Tony’s chair', ICON.yard, [W.yard.WATCH.x - .6, W.yard.WATCH.z - .9, 1.35], [2, 10, .6], 55),
      pavilion: vw('The pavilion', ICON.pav, [-8.5, -6.5, 1.7], [2.2, 11.4, 1.2], 50),
      house: vw('The house', ICON.pool, [6.5, 9.5, 1.65], [-15, -9, 1.4], 50),
      yard: vw('The yard', ICON.yard, [17, 7, 13], [-14, -6, 1.5]),
      above: vw('From above', ICON.above, [-6, 52, 160], [-16, -10, 0]),
    },
    viewOrder: ['watch', 'pavilion', 'house', 'yard', 'above'], startView: 'pavilion',
    orbit: { x: -20, z: -10, r: 140 }, fov: 40, minEye: .5,
    walkStart: { pos: V(W.yard.WATCH.x + .8, 0, W.yard.WATCH.z + .6), yaw: -2.45 }, /* by Tony’s chair, facing the pool and the pavilion */
    solidsNear: W.solidsNear, polys: W.polys, floorAt: W.floorAt, bound: W.bound,
    surfaceAt: () => 1,
    noAO: W.noAO,
    help: [['Space', 'The bear: Carmela and the pots, then the night on watch as Tony.'], ['F', 'Torch'], ['L', 'Floodlights'], ['B', 'Bang the pots'], ['Click', 'Fire the rifle: up in the air to scare the bear']],
    snowy: false,
    /* Carmela has the pots only; Tony on watch has the torch, the floodlights, the pots and the rifle */
    walkHelp: (mode, locked) => {
      if (mode !== 'game') return null;
      const carmela = place.act?.state?.phase === 'carmela';
      if (app.touch) return carmela ? 'Left thumb to move · right thumb to look · TAKE the pots, then BANG' : 'Left thumb to move · right thumb to look · the buttons: torch, lights, pots, rifle';
      if (locked) return '';
      return carmela ? 'Click to look with the mouse · WASD to move · E takes the pots · click or B bangs them' : 'Click to look with the mouse · F torch · L floodlights · B pots · click to fire';
    },
    enter() {
      W.forest.update(true);
      want(['amb-night', 'amb-wind', 'owl', 'crow', 'dog', 'rustle', 'stepleaves', 'slipper', 'growl', 'pots', 'lid', 'rifle', 'echo', 'zippo', 'puff', 'click', 'switch', 'thud']);
    },
    /* a late autumn night: wind in the bare branches, a dog far off, an owl; nothing else */
    sound() {
      const night = tod.night ?? 0;
      loop('amb-night').set(.35 + night * .45);
      loop('amb-wind').set(.25 + .2 * Math.sin(app.time * .05) ** 2);
      const dt = Math.min(.2, app.time - (place.sT ?? app.time)); place.sT = app.time;
      place.farT = (place.farT ?? 12) - dt;
      if (place.farT < 0) {
        place.farT = 16 + Math.random() * 30;
        const c = app.camera.position, a = Math.random() * 6.28, d = 90 + Math.random() * 160, p = V(c.x + Math.cos(a) * d, c.y + 4, c.z + Math.sin(a) * d);
        if (night > .5 && Math.random() < .45) play('owl', { pos: p, ref: d * .6, gain: .6 }); else play('dog', { pos: p, ref: d * .5, gain: .5, offset: Math.random() * 20, dur: 3 + Math.random() * 3 });
      }
    },
    leave() { place.act?.stop?.(); stopLoops('amb-'); },
  };
  place.act = buildBearGame(place);
  hotspot(W.yard.tub, { title: 'The duck-feed tub', text: 'A galvanized tub of duck feed by the pavilion. In season 4 Tony hid packets of cash in it; Carmela found them and took $40,000. Now the feed has gone mouldy, and a bear comes for it.' });
  hotspot(W.yard.watchChair, { title: 'Tony’s chair', text: 'At the end of the episode Tony sends Benny home and sits the watch himself: a lounge chair on the patio, a cigar, the rifle on his lap.' });
  hotspot(W.yard.pav, { title: 'The pavilion', text: 'Lit at night: the lanterns on its brick back wall and the lights in the soffit.' });
  /* steps in the leaves on the lawn, on the stone of the patio */
  app.on('step', e => {
    if (app.place !== place) return;
    const you = e.who === 'you', x = e.pos.x, z = e.pos.z;
    const hard = Math.hypot(x + 8, z) < 17 || W.levelled.some(L => L.kind === 'drive' && L.pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.6));
    const o = { pos: you ? null : V(x, (e.pos.y ?? 0) + .1, z), ref: e.who === 'bear' ? 7 : 3, gain: you ? .3 : e.who === 'bear' ? .75 : .45 };
    if (hard) slice('slipper', 4, .55, o); else slice('stepleaves', 5, .5, o);
  });
  return place;
}
