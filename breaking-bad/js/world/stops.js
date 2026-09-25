import * as THREE from 'three';
import { app } from '../app.js';
import { LOADERS, PLACES, ORDER } from './places.js';
import { setPlace, setHour, markEnvDirty, tod } from './lighting.js';
import { patchScene } from '../lib/shading.js';
import { rv } from '../rv/rv.js';
import { lab } from '../rv/lab.js';
import { post } from '../fx/post.js';
import * as TX from '../lib/textures.js';
import { setRVPose } from '../rv/drive.js';
import { clearParticles } from '../fx/particles.js';
import { floraDensity } from './flora.js';

/* The timeline: Pilot, 4 Days Out, Sunset. A stop is a place (the ground, the sky, the date), the RV as it was
   then (plates, bullet holes, tape, the colour of the product), and what else stands there. Switching fades to
   black, swaps the world, and opens on a title card. */
export const stops = { id: null, busy: false, cache: {}, hooks: [], home: {} };
export const HOME = {
  pilot: { x: 0, z: 0, yaw: -1.768 },
  days: { x: 0, z: 0, yaw: -1.97 },
  sunset: { x: 0, z: 0, yaw: -2.124 },
};

/* a module that owns things per stop registers here: build(place) once, enter(id) and leave(id) each switch */
export function onStop(hook) { stops.hooks.push(hook); }

let fade = 0, fadeTo = 0;
app.onUpdate(dt => {
  fade += (fadeTo - fade) * (1 - Math.exp(-dt * 9));
  if (Math.abs(fade - fadeTo) < .002) fade = fadeTo;
  post.grade && (post.grade.uniforms.uFade.value = fade);
}, 90);
const waitFade = to => new Promise(res => { fadeTo = to; const t0 = performance.now(); const tick = () => { if (Math.abs(fade - to) < .01 || performance.now() - t0 > 1400 || app.reducedMotion) { fade = to; res(); } else setTimeout(tick, 16); }; tick(); });

export async function openStop(id, { instant = false, hour = null } = {}) {
  if (!PLACES[id] || stops.busy || id === stops.id) return;
  stops.busy = true; app.emit('stop:leaving', stops.id);
  try {
    if (!instant && stops.id) await waitFade(1);
    const prev = stops.id ? stops.cache[stops.id] : null;
    if (!stops.cache[id]) {
      const place = await LOADERS[id]();
      for (const h of stops.hooks) h.build?.(place);
      app.materials = [...new Set([...app.materials, ...patchScene(place.groups.near), ...patchScene(place.groups.far)])];
      stops.cache[id] = place;
    }
    const place = stops.cache[id];
    if (prev) { app.scene.remove(prev.groups.near); app.farScene.remove(prev.groups.far); for (const h of stops.hooks) h.leave?.(stops.id, prev); }
    app.scene.add(place.groups.near); app.farScene.add(place.groups.far);
    clearParticles();
    app.noAO = app.noAO.filter(o => !prev?.noAO?.includes(o)).concat(place.noAO ?? []);
    app.place = place; app.terrain = place.T; stops.id = id; app.stops = stops;
    floraDensity(place.flora, app.density ?? 1);
    setPlace(place.P); setHour(hour ?? place.P.hour);
    placeRV(id);
    rvVariant(id);
    for (const h of stops.hooks) h.enter?.(id, place);
    markEnvDirty();
    document.getElementById('where').textContent = `${PLACES[id].ep.replace(' · ', ' ')} · ${PLACES[id].title} · ${PLACES[id].where}`;
    document.querySelectorAll('[data-stop]').forEach(b => b.setAttribute('aria-pressed', b.dataset.stop === id ? 'true' : 'false'));
    app.emit('stop', id);
    if (!instant) { titleCard(id); await waitFade(0); }
  } finally { stops.busy = false; }
}

export function placeRV(id = stops.id) {
  const h = HOME[id];
  rv.body.position.set(0, 0, 0);
  setRVPose(h.x, h.z, h.yaw, true);
  app.emit('rv:placed', id);
}

/* the RV as it was at each point in the story */
const plates = {};
function rvVariant(id) {
  plates.pilot ??= new THREE.MeshStandardMaterial({ map: TX.plateTex('7963', true), roughness: .5, metalness: .2 });
  const m = id === 'pilot' ? plates.pilot : rv.plateMat;
  rv.plateFront.material = m; rv.plateBack.material = m;
  rv.door.holes.visible = id === 'days';
  rv.door.tape.visible = id === 'sunset';
  if (lab.product) {
    const blue = id !== 'pilot';
    lab.product.mat.color.setHex(blue ? 0x8fcbe8 : 0xeef3f2); lab.product.mat.emissive.setHex(blue ? 0x0a2230 : 0x151a1a);
  }
  const dirt = { pilot: .45, days: .7, sunset: .9 }[id];
  rv.mats.skin.color.setScalar(1 - .12 * dirt);
}

function titleCard(id) {
  const P = PLACES[id], el = document.getElementById('titlecard');
  el.querySelector('b').textContent = P.ep.replace(' · ', '  ·  ');
  el.querySelector('span').textContent = P.title.toUpperCase();
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(titleCard.t); titleCard.t = setTimeout(() => { el.hidden = true; }, 3300);
}

export function nextStop(dir = 1) {
  const i = ORDER.indexOf(stops.id);
  openStop(ORDER[(i + dir + ORDER.length) % ORDER.length]);
}
export { tod, ORDER };
