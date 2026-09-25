import * as THREE from 'three';
import { app } from '../app.js';
import { hotspots } from './hotspots.js';
import { rv } from '../rv/rv.js';
import { post } from '../fx/post.js';

/* Hover to outline, click to act. Walls in front of a prop block the click. */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hovered = null, down = null, pending = null, lastMove = 0;

const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

function pick(x, y) {
  if (x == null) ndc.set(0, 0);
  else ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, app.camera);
  const hits = ray.intersectObjects(hotspots.map(h => h.obj), true);
  for (const h of hits) {
    const o = h.object;
    if (!(o.userData.hitOnly ? shown(o.parent) : shown(o))) continue;
    let r = o; while (r && !r.userData.hotspot) r = r.parent;
    if (!r) continue;
    const occ = ray.intersectObjects(Object.values(rv.walls).flatMap(w => [w.upper, w.stub]).filter(shown), true);
    if (occ.length && occ[0].distance < h.distance - .05) return null;
    return r.userData.hotspot;
  }
  return null;
}

function setHover(info, x, y) {
  if (info !== hovered) {
    hovered = info;
    post.outline.selectedObjects = info ? [info.obj] : [];
    app.renderer.domElement.style.cursor = info ? 'pointer' : '';
  }
  app.emit('tip', info && x != null ? { title: typeof info.title === 'function' ? info.title() : info.title, x, y } : null);
}

export function activate(info) {
  info.action?.();
  const text = typeof info.text === 'function' ? info.text() : info.text;
  const title = typeof info.title === 'function' ? info.title() : info.title;
  app.emit('card', { title, text });
  app.emit('hotspot', title);
}

export function buildInteract() {
  const el = app.renderer.domElement;
  el.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || app.mode === 'cinema' || app.mode === 'drive') return;
    if (app.mode === 'walk' && app.walkLocked) return;
    pending = [e.clientX, e.clientY];
  });
  el.addEventListener('pointerleave', () => { pending = null; setHover(null); });
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  el.addEventListener('pointerup', e => {
    if (!down || app.mode === 'cinema' || app.mode === 'drive') return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 7 || !quick) return;
    const locked = app.mode === 'walk' && app.walkLocked;
    const info = locked ? pick() : pick(e.clientX, e.clientY);
    if (info) {
      if (e.pointerType !== 'mouse') { post.outline.selectedObjects = [info.obj]; hovered = info; setTimeout(() => { if (hovered === info) setHover(null); }, 900); }
      activate(info);
    } else app.emit('card', null);
  });
  app.onUpdate(() => {
    if (app.mode === 'walk' && app.walkLocked) {
      if (app.time - lastMove > .1) { lastMove = app.time; const info = pick(); if (info !== hovered) { hovered = info; post.outline.selectedObjects = info ? [info.obj] : []; } app.emit('crosshair', !!info); }
      return;
    }
    if (!pending || app.time - lastMove < .06) return;
    lastMove = app.time;
    const [x, y] = pending; pending = null;
    setHover(pick(x, y), x, y);
  }, 40);
}
