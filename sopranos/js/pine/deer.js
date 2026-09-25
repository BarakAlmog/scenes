import * as THREE from 'three';
import { rbox, box, mat } from '../lib/util.js';

/* A white-tailed deer in its grey-brown winter coat: a body, a neck and head, ears, four legs that fold, the white
   flag of a tail. It stands, bolts in bounds, and falls. Faces +z. */
export function makeDeer() {
  const coat = mat(0x6e5d4c, .92), belly = mat(0xd8d0c4, .9), dark = mat(0x2a2420, .7), white = mat(0xf2efe8, .9);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = .92;
  rbox(body, .38, .42, 1.05, .14, coat, 0, 0, 0);
  rbox(body, .3, .1, .8, .05, belly, 0, -.19, 0);
  const neck = new THREE.Group(); neck.position.set(0, .12, .45); body.add(neck); neck.rotation.x = -.7;
  rbox(neck, .18, .2, .5, .08, coat, 0, 0, .2);
  const head = new THREE.Group(); head.position.set(0, .05, .44); neck.add(head); head.rotation.x = .9;
  rbox(head, .16, .16, .3, .06, coat, 0, 0, .06); rbox(head, .09, .08, .1, .03, dark, 0, -.02, .23);
  for (const s of [-1, 1]) { const e = rbox(head, .05, .14, .03, .015, coat, s * .09, .12, -.02); e.rotation.z = s * .5; box(head, .02, .02, .02, dark, s * .07, .04, .12); }
  const tail = new THREE.Group(); tail.position.set(0, .12, -.52); body.add(tail); rbox(tail, .1, .04, .16, .02, coat, 0, 0, -.06); rbox(tail, .09, .03, .15, .015, white, 0, -.03, -.06);
  const legs = [];
  for (const [x, z] of [[-.12, .38], [.12, .38], [-.12, -.36], [.12, -.36]]) {
    const hip = new THREE.Group(); hip.position.set(x, -.12, z); body.add(hip);
    rbox(hip, .09, .42, .11, .04, coat, 0, -.2, 0);
    const knee = new THREE.Group(); knee.position.y = -.4; hip.add(knee);
    rbox(knee, .05, .42, .05, .02, coat, 0, -.2, 0); box(knee, .06, .05, .07, dark, 0, -.42, .01);
    legs.push({ hip, knee, front: z > 0 });
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.userData.keep = true;
  const deer = { root, body, neck, head, tail, legs, phase: 0, state: 'stand', fall: 0,
    pose(dt, speed) {
      if (this.state === 'dead') {
        this.fall = Math.min(1, this.fall + dt * 2.2);
        body.rotation.z = this.fall * 1.45; body.position.y = .92 - .62 * this.fall;
        for (const L of legs) { L.hip.rotation.x = .3 * this.fall; L.knee.rotation.x = -.2; }
        neck.rotation.x = -.7 + .9 * this.fall; tail.rotation.x = 0; return;
      }
      if (speed > .5) {
        /* bounding: the legs gather and reach, the body rises and falls, the white tail up */
        this.phase += dt * speed * 1.25;
        const s = Math.sin(this.phase), c = Math.cos(this.phase);
        for (const L of legs) { const k = L.front ? s : -s; L.hip.rotation.x = k * .9; L.knee.rotation.x = Math.max(0, -k) * 1.2 - .1; }
        body.position.y = .95 + Math.abs(c) * .35; body.rotation.x = s * .12;
        neck.rotation.x = -.55 + c * .08; tail.rotation.x = -1.1;
      } else {
        for (const L of legs) { L.hip.rotation.x = 0; L.knee.rotation.x = 0; }
        body.position.y = .92; body.rotation.x = 0; tail.rotation.x = 0; neck.rotation.x = -.7 + Math.sin(this.phase += dt) * .05;
      }
    },
  };
  return deer;
}
