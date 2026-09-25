import { app } from './app.js';
import { setPlace, setHour, markEnvDirty, tod } from './world/lighting.js';
import { patchScene } from './lib/shading.js';
import { post } from './fx/post.js';
import { clearParticles } from './fx/particles.js';
import { jumpTo, flyTo, writeHash } from './ctrl/camera.js';

/* The five scenes. Each is a module that builds its place once (the ground, the sky and the date, what stands there,
   the views, its moment or game) and is kept after that. Switching fades to black, swaps the world, and opens on a
   title card. */
export const SCENES = [
  { id: 'pine', ep: 'S3 · E11', title: 'Pine Barrens', where: 'Harriman State Park, New York', act: 'CHASE HIM', mod: () => import('./pine/pine.js') },
  { id: 'ducks', ep: 'S1 · E1', title: 'The Ducks', where: '14 Aspen Drive, North Caldwell', act: 'FEED THE DUCKS', mod: () => import('./house/ducks.js') },
  { id: 'bear', ep: 'S5 · E1', title: 'The Bear', where: '14 Aspen Drive, North Caldwell', act: 'BEAR WATCH', mod: () => import('./house/bear.js') },
  { id: 'bakery', ep: 'S1 · E8', title: 'It Happens', where: 'Russo’s Bakery, North Arlington', act: 'TAKE A NUMBER', mod: () => import('./bakery/bakery.js') },
  { id: 'inn', ep: 'S6 · E3', title: 'The Inn at the Oaks', where: 'Kevin Finnerty’s dream', act: 'FOLLOW THE BEACON', mod: () => import('./dream/inn.js') },
];
export const byId = Object.fromEntries(SCENES.map(s => [s.id, s]));
export const scenes = { id: null, busy: false, cache: {} };

let fade = 0, fadeTo = 0, fadeSpeed = 9;
app.onUpdate(dt => {
  fade += (fadeTo - fade) * (1 - Math.exp(-dt * fadeSpeed));
  if (Math.abs(fade - fadeTo) < .002) fade = fadeTo;
  if (post.grade) post.grade.uniforms.uFade.value = Math.max(fade, app.fadeK ?? 0);
}, 90);
export const waitFade = (to, speed = 9) => new Promise(res => {
  fadeTo = to; fadeSpeed = speed; const t0 = performance.now();
  const tick = () => { if (Math.abs(fade - to) < .01 || performance.now() - t0 > 2600 || app.reducedMotion) { fade = to; res(); } else setTimeout(tick, 16); };
  tick();
});

export async function openScene(id, { instant = false, hour = null, view = null } = {}) {
  if (!byId[id] || scenes.busy || id === scenes.id) return;
  scenes.busy = true; app.emit('scene:leaving', scenes.id);
  const status = document.getElementById('loader-status');
  try {
    if (!instant && scenes.id) await waitFade(1);
    const prev = scenes.id ? scenes.cache[scenes.id] : null;
    if (!scenes.cache[id]) {
      if (!instant) app.emit('loading', byId[id]);
      const mod = await byId[id].mod();
      const place = await mod.load({ status });
      place.def = byId[id];
      app.materials = [...new Set([...app.materials, ...patchScene(place.groups.near), ...patchScene(place.groups.far)])];
      scenes.cache[id] = place;
      app.emit('loaded', byId[id]);
    }
    const place = scenes.cache[id];
    if (prev) {
      prev.leave?.();
      if (prev.groups.near !== place.groups.near) app.scene.remove(prev.groups.near);
      if (prev.groups.far !== place.groups.far) app.farScene.remove(prev.groups.far);
    }
    app.scene.add(place.groups.near); app.farScene.add(place.groups.far);
    clearParticles();
    app.noAO = [...(app.globalNoAO ?? []), ...(place.noAO ?? [])];
    app.place = place; app.terrain = place.T; app.sceneId = id; scenes.id = id;
    setPlace(place.P); setHour(hour ?? place.P.hour);
    app.mode = 'orbit'; app.controls.enabled = true;
    place.enter?.();
    markEnvDirty();
    const d = byId[id];
    /* the episode and the title, then the place; a phone shows the place only, the scene bar has the rest */
    const where = document.getElementById('where'), ep = document.createElement('span');
    ep.className = 'ep'; ep.textContent = `${d.ep.replace(' · ', ' ')} · ${d.title} · `;
    where.replaceChildren(ep, d.where);
    document.querySelectorAll('[data-scene]').forEach(b => b.setAttribute('aria-pressed', b.dataset.scene === id ? 'true' : 'false'));
    app.emit('scene', id);
    const v = view && place.views?.[view] ? view : place.startView;
    if (instant) jumpTo(v); else { jumpTo(v); titleCard(d); await waitFade(0); }
    writeHash();
  } finally { scenes.busy = false; }
}

export function titleCard(d, line = '') {
  const el = document.getElementById('titlecard');
  el.querySelector('b').textContent = d.ep.replace(' · ', '  ·  ');
  el.querySelector('span').textContent = d.title.toUpperCase();
  el.querySelector('i').textContent = line;
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(titleCard.t); titleCard.t = setTimeout(() => { el.hidden = true; }, 3300);
}

export function nextScene(dir = 1) {
  const i = SCENES.findIndex(s => s.id === scenes.id);
  openScene(SCENES[(i + dir + SCENES.length) % SCENES.length].id);
}
export { tod, flyTo };
