import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { box, rbox, cyl, sph, keep, mat, easeInOut } from '../lib/util.js';
import { hotspot } from '../ctrl/hotspots.js';

/* A fridge whose door opens on its right-hand hinge; one shared light glows inside whichever is open. */
let inner = null;
export function makeFridge(name, { at, rotY = 0, w = .7, h = 1.72, d = .64, rounded = false, parent = app.root, title, text, body = mat(0xf2f0ea, .38) }) {
  const g = keep(new THREE.Group()), liner = mat(0xeef1f2, .5), handle = MAT.chrome;
  const shell = (bw, bh, bd, x, y, z) => rounded ? rbox(g, bw, bh, bd, .05, body, x, y, z) : box(g, bw, bh, bd, body, x, y, z);
  shell(w, h - .04, .04, 0, h / 2, -d / 2 + .02);
  for (const s of [-1, 1]) box(g, .04, h - .04, d - .06, body, s * (w / 2 - .02), h / 2, -.03);
  shell(w, .08, d - .06, 0, h - .04, -.03); box(g, w, .08, d - .06, mat(0x2a2a2c, .7), 0, .04, -.03);
  box(g, w - .08, h - .2, .02, liner, 0, h / 2, -d / 2 + .05);
  for (const y of [.5, .88, 1.24]) box(g, w - .1, .012, d - .14, mat(0xdfe8ea, .2), 0, y, -.04);
  /* what's inside */
  box(g, .09, .22, .09, MAT.white, -.18, .62, -.05); box(g, .09, .03, .09, mat(0x2a5aa8, .5), -.18, .745, -.05);
  box(g, .08, .2, .08, mat(0xe8862a, .6), -.04, .61, -.12);
  for (const [x, c] of [[.12, 0x2a5a2a], [.2, 0x6b3a1e]]) { cyl(g, .032, .032, .22, mat(c, .3), x, 1.0, -.12, 10); cyl(g, .012, .012, .06, mat(c, .3), x, 1.14, -.12, 8); }
  box(g, .26, .09, .2, mat(0xe9c7a0, .7), -.08, .94, -.04);
  for (let i = 0; i < 3; i++) sph(g, .045, mat(0xc23227, .45), -.15 + i * .09, 1.3, -.02, 10, 8);
  box(g, .22, .1, .16, mat(0xf4f4f0, .4), .12, 1.3, -.1);
  /* the door, hinged on the right */
  const pivot = keep(new THREE.Group()); pivot.position.set(w / 2, 0, d / 2 - .01); g.add(pivot);
  const door = new THREE.Group(); pivot.add(door);
  if (rounded) rbox(door, w, h - .02, .07, .04, body, -w / 2, h / 2, .03); else box(door, w, h - .02, .06, body, -w / 2, h / 2, .03);
  box(door, .03, .5, .04, handle, -w + .08, h * .66, .08);
  if (!rounded) { box(door, w - .02, .012, .012, mat(0xd8d6cf, .5), -w / 2, h * .72, .066); box(door, .03, .3, .04, handle, -w + .08, h * .86, .08); }
  else box(door, .2, .05, .02, handle, -w / 2, h - .2, .07);
  for (const y of [.5, .9, 1.3]) box(door, w - .14, .012, .08, liner, -w / 2, y, -.04);
  box(door, .07, .16, .07, mat(0xf2d24a, .5), -.2, .56, -.04); box(door, .07, .13, .07, mat(0xc8452e, .5), -.42, .96, -.04);
  const mags = [0xc8452e, 0x2a4d8f, 0xe0b53c, 0x3a7a3f, 0x8a3a5a, 0xf0f0ec, 0x2a4d8f, 0xc8452e];
  mags.forEach((c, i) => box(door, .06 + (i % 3) * .02, .07 + (i % 2) * .03, .012, mat(c, .8), -.14 - (i % 3) * .2, .75 + Math.floor(i / 3) * .28, .07, (i % 2 ? .18 : -.12)));
  g.position.copy(at); g.rotation.y = rotY; parent.add(g); g.updateMatrixWorld(true);
  if (!inner) {
    inner = new THREE.PointLight(0xfff4dc, 0, 1.9, 2); app.root.add(inner);
    app.onUpdate(() => {
      let best = null, k = 0;
      for (const f of Object.values(app.fridges)) { const a = Math.min(1, f.pivot.rotation.y / .6); if (a > k) { k = a; best = f; } }
      inner.intensity = 1.5 * k;
      if (best) inner.position.copy(best.lightAt);
    });
  }
  let t = 1, from = 0, to = 0;
  const f = app.fridges[name] = {
    name, isOpen: false, group: g, pivot,
    front: g.localToWorld(new THREE.Vector3(0, 0, d / 2 + .5)).setY(0),
    lightAt: g.localToWorld(new THREE.Vector3(0, 1.4, 0)),
    n: [Math.sin(rotY), Math.cos(rotY)],
    open() { if (f.isOpen) return; f.isOpen = true; from = pivot.rotation.y; to = 1.95; t = 0; app.emit('fridge', { name, open: true }); },
    close() { if (!f.isOpen) return; f.isOpen = false; from = pivot.rotation.y; to = 0; t = 0; app.emit('fridge', { name, open: false }); },
    toggle() { f.isOpen ? f.close() : f.open(); },
  };
  app.onUpdate(dt => { if (t < 1) { t = Math.min(1, t + dt / .55); pivot.rotation.y = from + (to - from) * easeInOut(t); } });
  hotspot(g, { title, text: () => text(f.isOpen), action: () => f.toggle() });
  return f;
}
