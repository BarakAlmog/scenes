import * as THREE from 'three';
import { rbox, box, mat, canvasTex, seeded, damp } from '../lib/util.js';

/* An American black bear, as in "Two Tonys": big, glossy black fur, a tan muzzle, small round ears. It walks on
   all fours with a slow roll, stands and sniffs, rears up on its hind legs, runs, and puts its head in the tub.
   The body pivots at the hips, so it can rear. Faces +z. Eyes shine back in a torch beam. */
function furTex() {
  const rnd = seeded(83);
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#1c1816'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const x = rnd() * w, y = rnd() * h, l = 3 + rnd() * 7, v = rnd();
      g.strokeStyle = v < .6 ? 'rgba(70,58,50,.6)' : 'rgba(0,0,0,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 2, y + l); g.stroke();
    }
  });
  return t;
}
export function makeBear() {
  const fur = new THREE.MeshStandardMaterial({ map: furTex(), roughness: .48, metalness: 0, color: 0xffffff });
  const muzzle = mat(0x8a6a4a, .8), dark = mat(0x060606, .35), claw = mat(0x2a2622, .5);
  const root = new THREE.Group(); root.name = 'bear'; root.userData.keep = true;
  /* the body hangs from the hips */
  const hips = new THREE.Group(); hips.position.set(0, .8, -.45); root.add(hips);
  rbox(hips, .62, .6, .5, .2, fur, 0, 0, 0);
  rbox(hips, .66, .64, .75, .24, fur, 0, .02, .55);
  const chest = new THREE.Group(); chest.position.set(0, .04, .95); hips.add(chest);
  rbox(chest, .62, .62, .5, .22, fur, 0, 0, 0);
  rbox(chest, .5, .28, .42, .12, fur, 0, .3, -.02);          /* the shoulder hump */
  /* the head, low and forward */
  const neck = new THREE.Group(); neck.position.set(0, .05, .24); chest.add(neck);
  rbox(neck, .36, .34, .3, .12, fur, 0, 0, .1);
  const head = new THREE.Group(); head.position.set(0, -.02, .3); neck.add(head);
  rbox(head, .4, .34, .36, .14, fur, 0, 0, 0);
  rbox(head, .2, .17, .24, .07, muzzle, 0, -.05, .24);
  rbox(head, .1, .07, .06, .03, dark, 0, -.02, .36);
  for (const s of [-1, 1]) { rbox(head, .1, .1, .06, .04, fur, s * .15, .19, -.06); box(head, .03, .02, .02, dark, s * .1, .05, .17); }
  /* eyeshine: two points that light only in the torch beam */
  const shine = new THREE.Group(); head.add(shine);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0 })); e.position.set(s * .1, .055, .185); shine.add(e); }
  /* the legs: hip or shoulder, knee or elbow, paw */
  const legs = [];
  const leg = (parent, x, y, z, front) => {
    const top = new THREE.Group(); top.position.set(x, y, z); parent.add(top);
    rbox(top, .22, .44, .26, .09, fur, 0, -.18, 0);
    const knee = new THREE.Group(); knee.position.y = -.38; top.add(knee);
    rbox(knee, .19, .36, .21, .08, fur, 0, -.16, 0);
    const paw = rbox(knee, .21, .08, .27, .03, fur, 0, -.36, .04);
    for (let i = -1; i <= 1; i++) box(knee, .03, .02, .05, claw, i * .06, -.38, .18);
    legs.push({ top, knee, paw, front });
  };
  leg(hips, -.2, -.1, 0, false); leg(hips, .2, -.1, 0, false);
  leg(chest, -.2, -.14, 0, true); leg(chest, .2, -.14, 0, true);
  rbox(hips, .12, .1, .1, .04, fur, 0, .12, -.28);
  root.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });

  const bear = {
    root, hips, chest, neck, head, legs, shine, phase: 0, rear: 0, eat: 0, sniff: 0, lookY: 0, t: 0,
    /* speed m/s; state: walk, stand, sniff, rear, run, eat */
    pose(dt, speed, state) {
      const running = speed > 2.2; this.t += dt;
      this.rear = damp(this.rear, state === 'rear' ? 1 : 0, 4, dt);
      this.eat = damp(this.eat, state === 'eat' ? 1 : 0, 5, dt);
      this.sniff = damp(this.sniff, state === 'sniff' ? 1 : 0, 3, dt);
      if (speed > .05) this.phase += dt * speed * (running ? 2.2 : 3.4);
      const s = Math.sin(this.phase), c = Math.cos(this.phase), mv = Math.min(1, speed / .6);
      /* walking: the diagonal pairs; running: the front pair and the back pair together */
      legs.forEach((L, i) => {
        const pairA = (i === 0 || i === 3), k = running ? (L.front ? s : -s) : (pairA ? s : -s);
        L.top.rotation.x = k * (running ? .75 : .45) * mv;
        L.knee.rotation.x = Math.max(0, -k) * (running ? .9 : .55) * mv;
      });
      hips.position.y = .8 + Math.abs(c) * .03 * mv + (running ? Math.abs(s) * .12 : 0);
      hips.rotation.z = s * .05 * mv;
      /* rearing up on the hind legs: the body swings up about the hips, the front legs hang */
      hips.rotation.x = -1.15 * this.rear + (running ? s * .06 : 0);
      if (this.rear > .05) for (const L of legs) if (L.front) { L.top.rotation.x = .9 * this.rear + Math.sin(this.phase * .5) * .1; L.knee.rotation.x = -.5 * this.rear; }
      for (const L of legs) if (!L.front && this.rear > .05) L.top.rotation.x = L.top.rotation.x * (1 - this.rear) + 1.1 * this.rear;
      neck.rotation.x = .25 + .75 * this.eat + .2 * this.sniff - .9 * this.rear + Math.sin(this.phase * .7) * .04;
      neck.rotation.y = this.lookY * (1 - this.eat);
      head.rotation.x = Math.sin(this.t * 9) * .08 * this.sniff + Math.sin(this.t * 14) * .06 * this.eat - .15 * this.rear;
    },
  };
  return bear;
}
