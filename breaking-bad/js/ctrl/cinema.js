import * as THREE from 'three';
import { app } from '../app.js';
import { damp, clamp, easeInOut } from '../lib/util.js';
import { post } from '../fx/post.js';
import { rv, RV } from '../rv/rv.js';
import { lab } from '../rv/lab.js';
import { cast } from '../cast/cast.js';
import { tod, setHour } from '../world/lighting.js';
import { flyTo, cancelFlight, writeHash } from './camera.js';
import { clearView, restoreView } from '../world/flora.js';
import { julian, sunPosition, localToUTC } from '../lib/astro.js';

/* Cinema: 2.39:1, a film grade, grain, and a director who cuts the way the show does: the RV small in a wide shot,
   a low angle from the dirt, a point of view from inside the glassware, a shot from straight above, and
   time-lapse skies with the hours running and the shadows sweeping across the ground. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const st = { on: false, k: 0, shot: null, t: 0, i: 0, saved: null, lapse: false, list: null };
export const cinema = {
  get on() { return st.on; },
  enter() {
    if (st.on || app.mode === 'walk' || app.mode === 'drive' || app.mode === 'scripted') return;
    cancelFlight();
    st.on = true; app.mode = 'cinema'; app.controls.enabled = false;
    st.saved = { pos: app.camera.position.clone(), target: app.controls.target.clone(), fov: app.camera.fov, hour: tod.hour };
    st.list = playlist(); st.i = -1; next();
    app.emit('cinema', true); app.emit('clapper');
  },
  exit() {
    if (!st.on) return;
    st.on = false; app.mode = 'orbit'; app.controls.enabled = true; tod.speed = 1 / 3.2; if (st.lapse) { tod.playing = false; st.lapse = false; }
    /* the film is over: back to the hour it started at */
    setHour(st.saved.hour);
    const c = app.camera; c.fov = st.saved.fov; c.updateProjectionMatrix();
    app.controls.target.copy(st.saved.target); app.shadowFocus = null;
    restoreView(app.place);
    flyTo({ pos: st.saved.pos, target: st.saved.target }, .001);
    app.emit('cinema', false); app.emit('shot', ''); writeHash();
  },
  toggle() { st.on ? cinema.exit() : cinema.enter(); },
};

/* the RV's frame, for placing a camera */
const W = (x, y, z) => { rv.root.updateMatrixWorld(); return V(x, y, z).applyMatrix4(rv.root.matrixWorld); };
const ground = (p, h) => { p.y = app.terrain.heightAt(p.x, p.z) + h; return p; };
/* a camera on the ground must see the RV: no rise of the land in between, no tree against the lens */
function sees(p, look) {
  for (let i = 1; i < 24; i++) { const t = i / 24, x = p.x + (look.x - p.x) * t, z = p.z + (look.z - p.z) * t, y = p.y + (look.y - p.y) * t; if (app.terrain.heightAt(x, z) > y - .35) return false; }
  for (const b of app.place?.blockers ?? []) for (const tr of b.list) if (Math.hypot(tr.x - p.x, tr.z - p.z) < tr.r + 3) return false;
  return true;
}
/* try placements until one sees; the last try is kept if none does */
function pick(make, tries = 14) { let s; for (let i = 0; i < tries; i++) { s = make(); if (sees(s.from, s.look) && sees(s.to, s.look)) return s; } return s; }
const sunSide = () => { const s = app.tod.sunW; return V(-s.x, 0, -s.z).normalize(); };

/* each shot: from, to (a move), look, fov, time; built fresh for where the RV stands and where the sun is */
const SHOTS = {
  wide() {
    return pick(() => {
      const r = rv.root.position, a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 60;
      const p = ground(V(r.x + Math.cos(a) * d, 0, r.z + Math.sin(a) * d), 3 + Math.random() * 5);
      return { label: 'WIDE', from: p, to: ground(p.clone().add(V(Math.sin(a) * 6, 0, -Math.cos(a) * 6)), p.y - app.terrain.heightAt(p.x, p.z)), look: r.clone().add(V(0, 2.2, 0)), fov: 18, dur: 7 };
    });
  },
  low() {
    const s = Math.random() < .5 ? 1 : -1, p = ground(W(6.5, 0, s * 5.5), .32), q = ground(W(3.5, 0, s * 4.6), .3);
    return { label: 'LOW ANGLE', from: p, to: q, look: W(-1, 2.2, 0), fov: 48, dur: 6 };
  },
  pov() {
    /* from inside the glassware on the lab bench, up at whoever is cooking */
    const f = lab.flasks[2]; rv.body.updateMatrixWorld();
    const eye = V(f.x + .12, f.y + .05, f.z + .2).applyMatrix4(rv.body.matrixWorld);
    const who = cast.walt.visible && cast.walt.frame === 'rv' ? cast.walt.rig.headPos(V()) : V(f.x + .2, 2.1, f.z + .9).applyMatrix4(rv.body.matrixWorld);
    return { label: 'POV · THE FLASK', from: eye, to: eye.clone().add(V(0, .03, 0)), look: who, fov: 72, dur: 5.5, inside: true };
  },
  top() {
    const r = rv.root.position, h = 26 + Math.random() * 10;
    return { label: 'TOP SHOT', from: r.clone().add(V(.01, h, 0)), to: r.clone().add(V(.01, h - 6, 0)), look: r.clone(), fov: 40, dur: 6, roll: true };
  },
  lapse() {
    return pick(() => {
      const r = rv.root.position, s = sunSide(), a = Math.atan2(s.z, s.x) + (Math.random() - .5) * 1.4, d = 40 + Math.random() * 30;
      const p = ground(V(r.x + Math.cos(a) * d, 0, r.z + Math.sin(a) * d), 1.8);
      return { label: 'TIME-LAPSE', from: p, to: p, look: r.clone().add(V(0, 5, 0)), fov: 30, dur: 9, lapse: true };
    });
  },
  dolly() {
    const s = Math.random() < .5 ? 1 : -1;
    return { label: 'DOLLY', from: ground(W(-7, 0, s * 6.2), 1.4), to: ground(W(5, 0, s * 6.2), 1.4), look: W(0, 1.5, 0), fov: 36, dur: 7, follow: 'rv' };
  },
  silhouette() {
    /* into the sun, the two of them small against it */
    return pick(() => {
      const r = rv.root.position, s = app.tod.sunW, back = V(-s.x, 0, -s.z).normalize(), side = (Math.random() - .5) * 12;
      const p = ground(r.clone().addScaledVector(back, 24 + Math.random() * 8).add(V(back.z * side, 0, -back.x * side)), 1.1);
      return { label: 'AGAINST THE SUN', from: p, to: ground(p.clone().addScaledVector(back, -2), 1.1), look: r.clone().add(V(s.x * 8, 1.6, s.z * 8)), fov: 26, dur: 7 };
    });
  },
};
function playlist() {
  const id = app.stops?.id, low = (app.tod?.sunAlt ?? 30) < 12;
  const base = ['wide', 'low', 'dolly', 'top', 'wide', 'lapse'];
  if (id === 'pilot' || lab.cooking) base.splice(2, 0, 'pov');
  if (low || id === 'days') base.splice(4, 0, 'silhouette');
  return base;
}
/* the local hour the sun sets on the place's date */
function sunsetHour(P) {
  if (!P) return null;
  const [y, m, d] = P.date, alt = h => sunPosition(julian(localToUTC(y, m, d, h)), P.lat, P.lon).alt;
  let a = 12, b = 22; if (alt(a) < 0 || alt(b) > 0) return null;
  for (let i = 0; i < 24; i++) { const c = (a + b) / 2; if (alt(c) > 0) a = c; else b = c; }
  return (a + b) / 2;
}
function next() {
  const list = st.list ?? playlist(); st.i = (st.i + 1) % list.length;
  const name = list[st.i], s = SHOTS[name]();
  st.shot = s; st.t = 0;
  /* the time-lapse is its own moment: the last hours of light into dusk, then back to the story's hour */
  if (s.lapse) {
    st.lapse = true; st.lapseFrom = tod.hour;
    const ss = sunsetHour(app.place?.P); if (ss) setHour(ss - 1.9);
    tod.playing = true; tod.speed = .3;
  } else if (st.lapse) { st.lapse = false; tod.playing = false; tod.speed = 1 / 3.2; setHour(st.lapseFrom); }
  const P = app.stops?.id ? app.place?.P : null;
  app.emit('shot', `${P ? P.ep + '  ·  ' : ''}${s.label}`);
  app.emit('cut', name);
}

export function buildCinema() {
  app.on('cinema:exit', () => cinema.exit());
  app.onUpdate(update, 12);
}
const cp = V(), cl = V();
function update(dt) {
  st.k = damp(st.k, st.on ? 1 : 0, 5, dt);
  const g = post.grade.uniforms;
  g.uCinema.value = st.k < .002 ? 0 : st.k; g.uBars.value = st.k < .002 ? 0 : st.k;
  if (!st.on || !st.shot) return;
  const s = st.shot, c = app.camera;
  st.t += dt;
  if (st.t > s.dur) { next(); return; }
  const e = easeInOut(clamp(st.t / s.dur, 0, 1));
  cp.lerpVectors(s.from, s.to, e); cl.copy(s.look);
  if (s.follow === 'rv') cl.copy(rv.root.position).add(V(0, 1.5, 0));
  c.position.copy(cp); c.lookAt(cl);
  if (s.roll) c.rotateZ(st.t * .04);
  /* frame the 2.39:1 area whatever the screen shape */
  const a = c.aspect, want = s.fov;
  const fov = a >= 2.39 ? want : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(want / 2)) * Math.max(1, 2.39 / a) * (a < 1.2 ? .75 : 1)));
  if (Math.abs(c.fov - fov) > .01) { c.fov = fov; c.updateProjectionMatrix(); }
  app.controls.target.copy(cl);
  app.shadowFocus = s.inside ? rv.root.position : cl;
  if (!s.inside) clearView(app.place, c.position, cl);
}
export { RV };
