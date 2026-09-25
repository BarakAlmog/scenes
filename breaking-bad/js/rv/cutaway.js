import * as THREE from 'three';
import { app } from '../app.js';
import { RV, rv } from './rv.js';
import { smooth, lerp, damp } from '../lib/util.js';
import { objects } from '../world/lighting.js';

/* Zoom in close and the RV opens like the dollhouses in the other scenes: the roof lifts away and the walls between
   the camera and the lab drop to a stub. Far away it is whole. From straight above, the roof is off and every wall
   stands, as on a plan. A wall drops at CUT and comes back at KEEP, so it never flickers near edge-on. */
const CUT = .12, KEEP = .04, OPEN_R = 19, CLOSE_R = 23;
export const cutaway = { open: false, force: false, plan: false, enabled: true };
const local = new THREE.Vector3(), fwd = new THREE.Vector3(), wp = new THREE.Vector3(), inv = new THREE.Matrix4();

export function insideRV(p = app.camera.position) {
  if (!rv.body) return false;
  inv.copy(rv.body.matrixWorld).invert(); local.copy(p).applyMatrix4(inv);
  return local.x > RV.x0 - .05 && local.x < RV.x1 && Math.abs(local.z) < RV.halfW + .02 && local.y > .2 && local.y < RV.roof + .05;
}

export function updateCutaway(dt) {
  if (!rv.body) return;
  const cam = app.camera.position;
  rv.body.updateMatrixWorld();
  const inside = insideRV(cam);
  const d = cam.distanceTo(rv.root.getWorldPosition(wp));
  const down = -app.camera.getWorldDirection(fwd).y;
  cutaway.plan = down > (cutaway.plan ? .9 : .93);
  const allowed = cutaway.enabled && !inside && (app.mode === 'orbit' || app.mode === 'cinema' || app.mode === 'scripted');
  /* it opens when you look down on it from close by, not when you stand beside it */
  const h = cam.y - wp.y - 1.6, elev = Math.atan2(h, Math.max(.1, Math.hypot(cam.x - wp.x, cam.z - wp.z)));
  const above = cutaway.open ? elev > .14 : elev > .22;
  cutaway.open = allowed && (cutaway.force || (above && (cutaway.open ? d < CLOSE_R : d < OPEN_R)));
  rv.roof.target = cutaway.open ? 1 : 0;
  inv.copy(rv.body.matrixWorld).invert(); local.copy(cam).applyMatrix4(inv);
  for (const w of Object.values(rv.walls)) {
    if (!cutaway.open || cutaway.plan || w.off) { w.target = 0; continue; }
    const dx = local.x - w.at.x, dy = local.y - w.at.y, dz = local.z - w.at.z;
    const s = (dx * w.n.x + dz * w.n.z) / Math.hypot(dx, dy, dz);
    if (s > CUT) w.target = 1; else if (s < KEEP) w.target = 0;
  }
  /* animate: walls sink toward the cut line, the roof lifts and shrinks away */
  for (const w of Object.values(rv.walls)) {
    const tgt = w.hidden ? 1 : w.target;
    if (w.cut !== tgt) w.cut = tgt > w.cut ? Math.min(tgt, w.cut + dt / .35) : Math.max(tgt, w.cut - dt / .35);
    const k = smooth(w.cut), squash = 1 - .62 * (rv.crush ?? 0);
    w.pivot.visible = w.cut < 1; w.pivot.scale.y = Math.max(.001, (1 - k) * squash);
    const show = w.cut === 0 && tgt === 0;
    for (const a of w.attach) a.visible = show;
  }
  const R = rv.roof;
  if (R.k !== R.target) R.k = R.target > R.k ? Math.min(1, R.k + dt / .45) : Math.max(0, R.k - dt / .45);
  const k = smooth(R.k);
  R.group.visible = R.k < 1;
  R.group.position.y = k * 2.2 - (RV.roof - RV.cut) * .62 * (rv.crush ?? 0); R.group.scale.setScalar(1 - .25 * k);
  if (rv.parts.ladder) rv.parts.ladder.visible = R.k < .5 || !rv.walls.rear.target;
  /* how much sky reaches in: the roof off opens it, the rear wall off lets some in; and the eye adapts inside */
  objects.rvInv.value.copy(rv.body.matrixWorld).invert();
  objects.inside.value.set(lerp(.42, 1, Math.max(k, .4 * (app.shootK ?? 0))), .75 * (1 - k));
  app.insideK = damp(app.insideK ?? 0, inside ? 1 : 0, 2.5, dt);
}
