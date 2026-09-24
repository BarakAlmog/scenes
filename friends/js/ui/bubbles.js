import * as THREE from 'three';
import { app } from '../app.js';

/* speech bubbles pinned above a figure's head */
const live = [];
const v = new THREE.Vector3();
let layer;

export function say(rig, text, dur = 2.6) {
  layer ??= document.getElementById('bubbles');
  for (const b of live.filter(b => b.rig === rig)) end(b);
  const el = document.createElement('div');
  el.className = 'bubble'; el.textContent = text;
  layer.appendChild(el);
  const b = { rig, el, until: app.time + dur };
  live.push(b); rig.talking = true;
  requestAnimationFrame(() => el.classList.add('in'));
  app.emit('say', { who: rig.name, text });
  return b;
}

function end(b) {
  b.rig.talking = false;
  b.el.classList.remove('in');
  setTimeout(() => b.el.remove(), 300);
  live.splice(live.indexOf(b), 1);
}

export function updateBubbles() {
  const cam = app.camera, w = innerWidth, h = innerHeight;
  for (const b of live.slice()) {
    if (app.time > b.until) { end(b); continue; }
    b.rig.headPos(v); v.y += .34;
    v.project(cam);
    const off = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
    b.el.style.opacity = off ? 0 : '';
    b.el.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%, -100%)`;
  }
}
