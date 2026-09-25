import * as THREE from 'three';
import { rbox, cyl, sph, mat, lerp, clamp } from '../lib/util.js';

/* A blocky figure in the style of the original two, now with hips, knees,
   shoulders and elbows. It faces +z. Standing and sitting are the two ends
   of one blend, so a figure can sit down and get up. */
export function makeFigure(o) {
  const sw = o.wide ?? 1, thigh = o.thigh ?? .42, shin = o.shin ?? .4, torsoH = o.torsoH ?? .5;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  root.userData.keep = true;
  rbox(body, .32 * sw, .16, .26, .06, o.briefs ?? o.pants, 0, .02, 0);
  const spine = new THREE.Group(); spine.position.y = .08; body.add(spine);
  const torso = rbox(spine, .4 * sw, torsoH, .27 * sw, .08, o.shirt, 0, torsoH / 2, 0);
  cyl(spine, .05, .055, .09, o.skin, 0, torsoH + .03, .02);
  const head = new THREE.Group(); head.position.set(0, torsoH + .17, .03); spine.add(head);
  rbox(head, .24, .28, .25, .09, o.skin, 0, 0, 0);
  o.hair?.(head);

  const arm = s => {
    const sh = new THREE.Group(); sh.position.set(s * .24 * sw, torsoH - .06, .02); spine.add(sh);
    rbox(sh, .1, .3, .11, .04, o.sleeve ?? o.shirt, 0, -.12, 0);
    const el = new THREE.Group(); el.position.set(0, -.27, 0); sh.add(el);
    rbox(el, .085, .26, .09, .035, o.forearm ?? o.skin, 0, -.1, 0);
    const hand = new THREE.Group(); hand.position.set(0, -.23, 0); el.add(hand);
    sph(hand, .05, o.skin, 0, 0, 0, 10, 8);
    return { sh, el, hand, s };
  };
  const leg = s => {
    const hip = new THREE.Group(); hip.position.set(s * .1 * sw, 0, 0); body.add(hip);
    rbox(hip, .14 * sw, thigh + .06, .15, .045, o.thighs ?? o.pants, 0, -thigh / 2, 0);
    if (o.briefs) rbox(hip, .15 * sw, .12, .16, .04, o.briefs, 0, -.03, 0);
    const knee = new THREE.Group(); knee.position.y = -thigh; hip.add(knee);
    rbox(knee, .12 * sw, shin + .02, .12, .045, o.shins ?? o.pants, 0, -shin / 2, 0);
    if (o.socks) rbox(knee, .125 * sw, .12, .125, .04, o.socks, 0, -shin + .06, 0);
    const foot = new THREE.Group(); foot.position.y = -shin; knee.add(foot);
    rbox(foot, .13 * sw, .06, .24, .02, o.shoes ?? mat(0x232325, .6), 0, -.03, .05);
    return { hip, knee, foot };
  };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);
  const standY = thigh + shin + .06;

  const rig = {
    name: o.name, root, body, spine, torso, head, armL, armR, legL, legR, standY, thigh, shin, torsoH,
    /* k: 0 standing .. 1 seated with the hip joint at height hy */
    setSit(k, hy) {
      const th = Math.asin(clamp((hy - shin - .06) / thigh, -.3, .95));
      const a = (Math.PI / 2 - th) * k;
      for (const L of [legL, legR]) { L.hip.rotation.set(-a, 0, 0); L.knee.rotation.set(a, 0, 0); L.foot.rotation.set(0, 0, 0); }
      body.position.y = lerp(standY, hy, k);
    },
    /* one stride per 2 pi of phase; amt fades the swing in and out */
    walk(phase, amt) {
      const s = Math.sin(phase), c = Math.cos(phase);
      legL.hip.rotation.x = -.5 * s * amt; legR.hip.rotation.x = .5 * s * amt;
      legL.knee.rotation.x = Math.max(0, c) * .9 * amt; legR.knee.rotation.x = Math.max(0, -c) * .9 * amt;
      armL.sh.rotation.set(.45 * s * amt, 0, -.08); armR.sh.rotation.set(-.45 * s * amt, 0, .08);
      armL.el.rotation.x = -.35 * amt; armR.el.rotation.x = -.35 * amt;
      body.position.y = standY - .02 * amt + .02 * Math.abs(c) * amt;
      spine.rotation.y = .06 * s * amt;
    },
    headPos(v = new THREE.Vector3()) { return head.getWorldPosition(v); },
  };
  return rig;
}

/* hair and face pieces */
export const hairMat = mat(0x241a12, .9);
export const glassesMat = mat(0x26262a, .4, .4);

export function roundGlasses(h, r = .042) {
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .007, 8, 16), glassesMat); ring.castShadow = true;
    ring.position.set(s * .06, 0, .128); h.add(ring);
    rbox(h, .008, .008, .11, .002, glassesMat, s * .105, .015, .07);
  }
  rbox(h, .032, .008, .008, .002, glassesMat, 0, .012, .13);
}
