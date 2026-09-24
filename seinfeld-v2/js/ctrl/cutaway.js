import * as THREE from 'three';
import { app } from '../app.js';
import { walls } from '../world/walls.js';
import { ROOMS } from '../world/apartment.js';
import { inPoly } from '../lib/util.js';

/* Each wall faces one room. It drops to a stub while the camera sees its back, that is
   while it stands between the camera and its room, so the model opens toward the viewer
   like a dollhouse. s is the sine of the angle past edge-on: a wall drops at CUT and comes
   back at KEEP, so it never flickers near edge-on. Seen from straight above, every wall
   stands, as on a floor plan. */
const CUT = .1, KEEP = .03;
const fwd = new THREE.Vector3();
let plan = false;

export function insideModel(p) {
  for (const k in ROOMS) if (inPoly(p.x, p.z, ROOMS[k])) return p.y < 2.9;
  return false;
}

export function updateCutaway() {
  const c = app.camera.position, down = -app.camera.getWorldDirection(fwd).y;
  plan = down > (plan ? .9 : .93);
  const on = app.mode !== 'walk' && !plan && !insideModel(c) && app.cutaway !== false;
  for (const w of walls) {
    if (!on || !w.cuttable) { w.target = 0; continue; }
    const dx = c.x - (w.a[0] + w.b[0]) / 2, dy = c.y - w.H / 2, dz = c.z - (w.a[1] + w.b[1]) / 2;
    const s = (dx * w.n[0] + dz * w.n[1]) / Math.hypot(dx, dy, dz);
    if (s < -CUT) w.target = 1;
    else if (s > -KEEP) w.target = 0;
  }
}
