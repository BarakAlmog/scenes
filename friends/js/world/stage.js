import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, cyl, sph, tube, mat, seeded, smooth, clamp, damp, canvasTex } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { W } from './plan.js';
import { walls, attach } from './walls.js';
import { mergeStatic } from '../perf.js';

/* The reveal: the apartment is a set on a sound stage. A light grid comes down,
   bleachers full of audience rise, the four cameras roll in, the fourth wall goes. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const G = {};
export const studio = { on: false, k: 0, tally: -1, cams: [] };
let plywood, concrete, clapT = 9, signT = 9;

function fresnel(parent, pos, aim) {
  const g = new THREE.Group(); g.position.copy(pos); parent.add(g);
  const blk = MAT.black;
  const yoke = new THREE.Group(); g.add(yoke);
  box(yoke, .02, .02, .3, blk, 0, -.05, 0); box(yoke, .02, .22, .02, blk, 0, -.15, -.15); box(yoke, .02, .22, .02, blk, 0, -.15, .15);
  const head = new THREE.Group(); head.position.y = -.24; g.add(head);
  head.lookAt(head.getWorldPosition(V()).clone().add(aim.clone().sub(pos)));
  const body = M(new THREE.CylinderGeometry(.13, .13, .32, 14), blk); body.rotation.x = Math.PI / 2; head.add(body);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.11, 18), G.lensMat); lens.position.z = .165; head.add(lens);
  for (const [x, y, rz] of [[0, .14, 0], [0, -.14, 0], [.14, 0, Math.PI / 2], [-.14, 0, Math.PI / 2]]) {
    const d = box(head, .22, .006, .12, blk, x, y, .22); d.rotation.z = rz; d.rotation.x = y > 0 ? -.35 : y < 0 ? .35 : 0; d.rotation.y = x > 0 ? .35 : x < 0 ? -.35 : 0;
  }
  return head;
}

/* a soft additive cone from a lamp toward the set: stage haze */
function beam(from, to, r0, r1) {
  const len = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(r0, r1, len, 28, 1, true); geo.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(geo, G.beamMat);
  m.position.copy(from); m.quaternion.setFromUnitVectors(V(0, -1, 0), to.clone().sub(from).normalize());
  m.castShadow = false; m.receiveShadow = false; m.renderOrder = 5;
  return m;
}

export function buildStage() {
  const root = new THREE.Group(); root.visible = false; root.userData.keep = true; app.root.add(root); G.root = root;
  plywood = TX.plywood(); concrete = TX.concrete();
  G.lensMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffefc0, emissiveIntensity: 4 });
  G.beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color(0xffe6b8) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
      gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uK; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN, vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float along = smoothstep(0., .25, vUv.y) * (1. - smoothstep(.55, 1., 1. - vUv.y) * .6);
      gl_FragColor = vec4(uCol * edge * along * .09 * uK, 1.); }`,
  });

  /* ---------- light grid + fresnels + haze ---------- */
  {const grid = new THREE.Group(); root.add(grid); G.grid = grid; const pipe = mat(0x2a2a2d, .5, .6), Y = 5.6;
   for (let z = -9; z <= 6.01; z += 3) { const p = cyl(grid, .035, .035, 29, pipe, .7, Y, z, 10); p.rotation.z = Math.PI / 2; }
   for (const x of [-13, -7, -1.5, 3, 8.5, 14]) { const p = cyl(grid, .035, .035, 15.2, pipe, x, Y, -1.5, 10); p.rotation.x = Math.PI / 2; }
   for (const x of [-13, 14]) for (const z of [-9, 6]) cyl(grid, .008, .008, 4, mat(0x55555a, .4, .8), x, Y + 2, z, 6);
   const aims = [[-11, -8, -9.6, -1.4], [-7, -8, -6.4, -1.6], [-3, -8, -2.6, -1.2], [0, -8, -.2, -5.6], [3, -8, 3, -1.8], [7, -8, 7.2, -2.4], [11, -8, 11, -2.6],
     [-11, -3, -10, 1.4], [-7, -3, -5.8, .4], [-3, -3, -2.4, 1.2], [3, -3, 3.2, .6], [7, -3, 6.6, .2], [11, -3, 11.2, 1.2],
     [-8, 3, -5.4, .6], [-3.5, 3, -2.6, 1.6], [0, 3, 0, -1], [3.5, 3, 3.4, .4], [8, 3, 6.4, -.2]];
   G.beams = new THREE.Group(); root.add(G.beams);
   aims.forEach(([x, z, ax, az], i) => {
     const pos = V(x, Y - .02, z), aim = V(ax, .6, az);
     fresnel(grid, pos, aim);
     if (i % 3 === 1 || i >= 13) G.beams.add(beam(V(x, Y - .3, z), aim, .1, 1.1));
   });}

  G.spots = [];
  for (const [p, t, i] of [[V(-6, 5.4, 6.2), V(-4.8, .7, .2), 34], [V(6.6, 5.4, 6.4), V(5.4, .8, -.4), 34], [V(0, 5.4, 2.5), V(0, .9, -4.8), 20]]) {
    const s = new THREE.SpotLight(0xffe7c2, 0, 16, .52, .7, 2); s.position.copy(p); s.target.position.copy(t); s.userData.full = i;
    app.root.add(s, s.target); G.spots.push(s);
  }

  /* ---------- set jacks and stencils behind the flats ---------- */
  {const jacks = new THREE.Group(); root.add(jacks); const wood = mat(0xc9a96e, .8), bag = mat(0x4a4a3a, .95);
   for (const w of walls) {
     if (!w.g || w.len < 1 || w.H < 2 || ![W.gN2, W.cbN, W.cbW, W.jbW, W.mN3, W.mbdN, W.mbdE, W.rbdE, W.mcW3, W.sN, W.gbN1, W.mbN2].includes(w)) continue;
     const [ax, az] = w.a, ux = (w.b[0] - ax) / w.len, uz = (w.b[1] - az) / w.len, ox = -w.n[0], oz = -w.n[1];
     const jg = new THREE.Group(); jacks.add(jg);
     for (let t = .5; t < w.len - .3; t += 1.45) {
       const base = V(ax + ux * t + ox * .21, 0, az + uz * t + oz * .21), foot = base.clone().add(V(ox * 1.05, 0, oz * 1.05));
       tube(jg, base.clone().setY(2.2), foot.clone().setY(.04), .035, wood);
       tube(jg, base.clone().setY(.05), foot.clone().setY(.05), .035, wood);
       tube(jg, base.clone().setY(1.1), foot.clone().lerp(base, .5).setY(.05), .025, wood);
       const b = M(new THREE.CapsuleGeometry(.1, .22, 4, 8), bag); b.rotation.z = Math.PI / 2; b.position.copy(foot).setY(.08);
       b.rotation.y = Math.atan2(ux, uz); jg.add(b);
     }
     mergeStatic(jg); attach(w, jg);
   }
   const decal = (text, w, t, y) => {
     const [ax, az] = w.a, ux = (w.b[0] - ax) / w.len, uz = (w.b[1] - az) / w.len, ox = -w.n[0], oz = -w.n[1];
     const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .35), new THREE.MeshStandardMaterial({ map: TX.stencilTex(text), transparent: true, roughness: .9 }));
     p.position.set(ax + ux * t + ox * .205, y, az + uz * t + oz * .205); p.lookAt(p.position.clone().add(V(ox, 0, oz)));
     jacks.add(p); attach(w, p);
   };
   decal('MONICA APT · FLAT 4', W.mbdE, 2.1, 1.7);
   decal('J+C APT · FLAT 9', W.cbW, 1.8, 1.7);
   decal('HALL · STAIRS · FLAT 2', W.sN, 1.7, 1.25);
   G.jacks = jacks;}

  /* ---------- bleachers + audience ---------- */
  {const bl = new THREE.Group(); root.add(bl); G.bleachers = bl; const rnd = seeded(33);
   const rows = 6, z0 = 8.2, depth = 1.0, rise = .42, halfW = 14;
   for (let i = 0; i < rows; i++) box(bl, halfW * 2, rise * (i + 1), depth, mat(0x2a2a30, .9), .7, rise * (i + 1) / 2 - .385, z0 + i * depth + depth / 2);
   for (let i = 0; i < rows; i++) box(bl, halfW * 2, .03, .06, mat(0x8a8a8e, .5, .3), .7, rise * (i + 1) - .37, z0 + i * depth + .03);
   const seats = [], people = [];
   for (let i = 0; i < rows; i++) for (let x = -halfW + .45 + .7; x < halfW - .3 + .7; x += .62) {
     if (Math.abs(x - .7) < .75) continue;
     const y = rise * (i + 1) - .385, z = z0 + i * depth + .55;
     seats.push([x, y, z]); if (rnd() < .78) people.push([x, y, z, rnd(), rnd()]);
   }
   const seatG = new THREE.BoxGeometry(.5, .08, .45), backG = new THREE.BoxGeometry(.5, .45, .06);
   const seatM = new THREE.InstancedMesh(seatG, mat(0x7a1f22, .8), seats.length), backM = new THREE.InstancedMesh(backG, mat(0x7a1f22, .8), seats.length);
   const m4 = new THREE.Matrix4();
   seats.forEach(([x, y, z], i) => { seatM.setMatrixAt(i, m4.makeTranslation(x, y + .42, z)); backM.setMatrixAt(i, m4.makeTranslation(x, y + .64, z + .22)); });
   bl.add(seatM, backM);
   const bodyM = new THREE.InstancedMesh(new THREE.BoxGeometry(.38, .52, .26), new THREE.MeshStandardMaterial({ roughness: .9 }), people.length);
   const headM = new THREE.InstancedMesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ roughness: .8 }), people.length);
   const handM = new THREE.InstancedMesh(new THREE.BoxGeometry(.22, .08, .08), new THREE.MeshStandardMaterial({ roughness: .8 }), people.length);
   const shirts = [0x39485e, 0x7a3b36, 0xb7a58a, 0x3f5b45, 0x5b4a6b, 0x9a9a92, 0x2d2d31, 0xa66b3a], skins = [0xe6b28c, 0xc98f6a, 0x8a5a3b, 0xf0c7a4, 0xb07a52];
   const col = new THREE.Color();
   people.forEach(([x, y, z, a, b], i) => {
     bodyM.setMatrixAt(i, m4.makeTranslation(x, y + .72, z - .02)); bodyM.setColorAt(i, col.setHex(shirts[Math.floor(a * shirts.length)]));
     headM.setMatrixAt(i, m4.makeTranslation(x, y + 1.12, z - .02)); headM.setColorAt(i, col.setHex(skins[Math.floor(b * skins.length)]));
     handM.setMatrixAt(i, m4.makeTranslation(x, y + .72, z - .2)); handM.setColorAt(i, col.setHex(skins[Math.floor(b * skins.length)]));
   });
   for (const m of [seatM, backM, bodyM, headM, handM]) { m.castShadow = false; m.receiveShadow = true; bl.add(m); }
   G.people = people; G.handM = handM; G.headM = headM;}

  /* ---------- the four cameras ---------- */
  {const cams = new THREE.Group(); root.add(cams); G.cams = cams; const dark = mat(0x2b2c30, .5, .3), grey = mat(0x6b6d72, .5, .5);
   [[-7.2, 6.2], [-2.4, 6.8], [3.6, 6.8], [8.4, 6.2]].forEach(([x, z], i) => {
     const c = new THREE.Group(); c.position.set(x, -.385, z); cams.add(c);
     for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; cyl(c, .06, .06, .05, dark, Math.cos(a) * .42, .06, Math.sin(a) * .42).rotation.x = Math.PI / 2; box(c, .44, .05, .06, grey, Math.cos(a) * .21, .12, Math.sin(a) * .21, -a); }
     cyl(c, .09, .12, 1.25, grey, 0, .75, 0, 14);
     const head = new THREE.Group(); head.position.y = 1.5; c.add(head);
     box(head, .42, .36, .72, dark, 0, 0, 0);
     cyl(head, .1, .12, .34, mat(0x111114, .3), 0, 0, -.5, 18).rotation.x = Math.PI / 2;
     box(head, .3, .22, .18, dark, .05, .28, .22);
     const tally = new THREE.Mesh(new THREE.BoxGeometry(.08, .05, .02), new THREE.MeshStandardMaterial({ color: 0x3a0a0a, emissive: 0xff2a1a, emissiveIntensity: 0 }));
     tally.position.set(0, .23, -.36); tally.userData.keep = true; head.add(tally);
     const lbl = new THREE.Mesh(new THREE.PlaneGeometry(.2, .2), new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, g => { g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#111'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.fillText(String(i + 1), 32, 48); }), roughness: .8 }));
     lbl.position.set(.215, 0, 0); lbl.rotation.y = Math.PI / 2; head.add(lbl);
     for (const s of [-1, 1]) { const h = cyl(head, .012, .012, .7, grey, s * .3, -.2, .55); h.rotation.x = 1.1; }
     c.lookAt(x * .72, -.385, -1.6); c.rotateY(Math.PI);
     studio.cams.push({ group: c, tally });
   });}

  /* ---------- boom mic ---------- */
  {const b = new THREE.Group(); root.add(b); G.boom = b; const grey = mat(0x55575c, .45, .6);
   for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; tube(b, V(1.6, 1.2, 6.2), V(1.6 + Math.cos(a) * .5, -.38, 6.2 + Math.sin(a) * .5), .02, grey); }
   tube(b, V(1.6, -.38, 6.2), V(1.6, 2.7, 6.2), .03, grey);
   tube(b, V(1.9, 2.95, 6.9), V(.4, 3.05, 1.2), .022, grey);
   cyl(b, .035, .035, .3, MAT.black, .4, 2.85, 1.2);
   sph(b, .07, mat(0x8a8a8a, .95), .4, 2.68, 1.2, 12, 10).scale.set(1, 1.4, 1);}

  /* ---------- APPLAUSE sign ---------- */
  {const s = new THREE.Group(); root.add(s); G.sign = s; const t = TX.applauseTex();
   G.signMat = new THREE.MeshStandardMaterial({ map: t.map, emissive: 0xffffff, emissiveMap: t.emissive, emissiveIntensity: 0, roughness: .5 });
   const front = new THREE.Mesh(new THREE.PlaneGeometry(2.3, .55), G.signMat); front.position.z = .1; s.add(front);
   box(s, 2.44, .66, .18, MAT.black, 0, 0, 0);
   for (const x of [-1, 1]) cyl(s, .006, .006, 3, mat(0x77777a, .4, .8), x, 1.8, 0, 6);
   s.position.set(.7, 6.5, 7.6);}

  /* tape marks on the floor */
  {const marks = new THREE.Group(); root.add(marks);
   [[-5.2, 4.4, 0xe0c030], [-.3, 4.8, 0xd03a3a], [4.6, 4.3, 0x3a8ad0], [.4, 3.6, 0xe0c030], [7.8, 4.6, 0xd03a3a]].forEach(([x, z, c]) => {
     for (const r of [0, Math.PI / 2]) { const m = box(marks, .3, .006, .05, mat(c, .6), x, -.378, z, r); m.castShadow = false; }
   });}

  for (const g of [G.grid, G.cams, G.boom]) mergeStatic(g);
  app.noAO.push(G.beams);
  app.on('applause', () => { if (studio.on) { clapT = 0; signT = 0; } });
  app.onUpdate(updateStage, 25);
}

export function setStage(on) {
  studio.on = on; app.stage = on;
  for (const k of ['mS', 'rbdS', 'gS', 'jbS']) W[k].hidden = on;
  app.emit('stage', on);
}

function updateStage(dt) {
  const target = studio.on ? 1 : 0;
  if (studio.k !== target) studio.k = clamp(studio.k + (target - studio.k > 0 ? 1 : -1) * dt / 1.8, 0, 1);
  const k = smooth(studio.k); app.stageK = k;
  G.root.visible = k > .002;
  for (const s of G.spots) s.intensity = s.userData.full * k;
  if (!G.root.visible) { restoreSkins(false); return; }
  G.grid.position.y = (1 - k) * 7; G.beams.position.y = (1 - k) * 7; G.sign.position.y = 6.5 + (1 - k) * 6;
  G.beamMat.uniforms.uK.value = k * k;
  G.bleachers.position.y = -(1 - k) * 4.6;
  G.cams.position.z = (1 - k) * 6; G.boom.position.x = (1 - k) * 5;
  G.lensMat.emissiveIntensity = 12 * k;
  G.jacks.visible = k > .35;
  restoreSkins(k > .5);

  /* audience claps, the sign lights */
  clapT += dt; signT += dt;
  const clap = clapT < 3.2 ? 1 - clapT / 3.2 : 0;
  G.signMat.emissiveIntensity = signT < 3.4 ? 9 * (signT < 3 ? 1 : (3.4 - signT) / .4) : .0;
  if (clap > 0 || G.clapping) {
    G.clapping = clap > 0;
    const m4 = new THREE.Matrix4(), t = app.time;
    G.people.forEach(([x, y, z, a], i) => {
      const up = clap > 0 ? .18 + Math.abs(Math.sin(t * 17 + a * 20)) * .05 * clap : 0;
      m4.makeTranslation(x, y + .72 + up, z - .2 - up * .3); G.handM.setMatrixAt(i, m4);
    });
    G.handM.instanceMatrix.needsUpdate = true;
  }
  studio.cams.forEach((c, i) => { c.tally.material.emissiveIntensity = damp(c.tally.material.emissiveIntensity, i === studio.tally ? 9 : 0, 10, dt); });
}

let skinsOn = false;
function restoreSkins(on) {
  if (on === skinsOn) return; skinsOn = on;
  MAT.wallSkin.map = on ? plywood : null; MAT.wallSkin.color.setHex(on ? 0xffffff : 0xf7f6f2); MAT.wallSkin.normalMap = on ? null : MAT.paint.normalMap; MAT.wallSkin.needsUpdate = true;
  MAT.ground.map = on ? concrete : null; MAT.ground.needsUpdate = true;
  MAT.slab.color.setHex(on ? 0x2e2d30 : 0xf7f6f2);
}
