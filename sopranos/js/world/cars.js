import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, M, box, cyl, rbox, canvasTex } from '../lib/util.js';

/* Cars from a side profile: the body is the profile extruded across the width and rounded at the edges, the glass
   sits in the window openings, then wheels, lights, bumpers and the grille. x forward, y up, z to the right side.
   The origin is on the ground under the middle of the car. */

function extrude(profile, width, bevel = .06) {
  const s = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}
function wheel(p, x, z, r, w, rim = mat(0xb9bcc0, .3, .9)) {
  const g = new THREE.Group(); g.position.set(x, r, z); p.add(g);
  const tire = M(new THREE.CylinderGeometry(r, r, w, 20), mat(0x1d1d1f, .92)); tire.rotation.x = Math.PI / 2; g.add(tire);
  const hub = M(new THREE.CylinderGeometry(r * .62, r * .62, w + .02, 16), rim); hub.rotation.x = Math.PI / 2; g.add(hub);
  const cap = M(new THREE.CylinderGeometry(r * .22, r * .22, w + .04, 12), mat(0xd8dbe0, .25, 1)); cap.rotation.x = Math.PI / 2; g.add(cap);
  return g;
}
const glass = () => new THREE.MeshStandardMaterial({ color: 0x1b2229, roughness: .08, metalness: .2, envMapIntensity: 1.4, side: THREE.DoubleSide });

/* a plate */
function plate(text, bg = '#f2efe6', fg = '#233a6b', top = '') {
  return new THREE.MeshStandardMaterial({ roughness: .5, metalness: .2, map: canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = 'center';
    g.font = 'bold 14px Arial'; g.fillText(top, w / 2, 20);
    g.font = 'bold 56px Arial'; g.fillText(text, w / 2, 90);
  }) });
}

/* 1990s Cadillac DeVille: long, low, formal roof, a chrome waterfall grille */
export function cadillac(color = 0xcdbf9f) {
  const g = new THREE.Group(), L = 5.33, W = 1.94;
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: .32, metalness: .55, clearcoat: 1, clearcoatRoughness: .08 });
  const prof = [[-2.66, .36], [2.66, .36], [2.7, .52], [2.66, .74], [1.4, .84], [.72, 1.36], [-.95, 1.4], [-1.62, .96], [-2.66, .9], [-2.72, .62]];
  const body = M(extrude(prof, W, .09), paint); g.add(body);
  /* glass: windscreen, side windows, rear glass */
  const gm = glass();
  const side = new THREE.Shape([[.66, .9], [-.9, .92], [-1.52, .96], [-.93, 1.33], [.72, 1.31], [.95, 1.0]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const s of [-1, 1]) { const w = M(new THREE.ShapeGeometry(side), gm); w.position.z = s * (W / 2 + .004); if (s < 0) w.rotation.y = Math.PI, w.scale.x = -1; g.add(w); }
  const ws = M(new THREE.PlaneGeometry(W * .88, .72), gm); ws.position.set(1.07, 1.1, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-.88); g.add(ws);
  const rg = M(new THREE.PlaneGeometry(W * .86, .62), gm); rg.position.set(-1.29, 1.17, 0); rg.rotation.set(0, -Math.PI / 2, 0); rg.rotateX(-.95); g.add(rg);
  /* chrome: grille, bumpers, the belt line */
  const chrome = mat(0xe6e8ec, .18, 1);
  box(g, .06, .3, 1.02, chrome, 2.71, .58, 0);
  for (let i = 0; i < 9; i++) box(g, .03, .26, .012, mat(0x9a9ca0, .3, 1), 2.735, .58, -.44 + i * .11);
  box(g, .12, .16, W * .98, chrome, 2.73, .36, 0); box(g, .12, .16, W * .98, chrome, -2.73, .4, 0);
  for (const s of [-1, 1]) box(g, 4.9, .025, .02, chrome, 0, .84, s * (W / 2 + .01));
  /* headlights, the tail lamps down the fins */
  for (const s of [-1, 1]) {
    box(g, .04, .14, .42, new THREE.MeshStandardMaterial({ color: 0xf4f6f2, emissive: 0x222222, roughness: .2 }), 2.72, .62, s * .67);
    box(g, .05, .34, .09, new THREE.MeshStandardMaterial({ color: 0x8c0f0f, emissive: 0x220000, roughness: .3 }), -2.74, .7, s * .86);
  }
  const pl = plate('RL1 6W2', '#f3e6b8', '#1c2d5c', 'NEW JERSEY'); box(g, .01, .15, .31, pl, -2.8, .55, 0).rotation.y = Math.PI;
  for (const [x, s] of [[1.62, 1], [1.62, -1], [-1.56, 1], [-1.56, -1]]) wheel(g, x, s * (W / 2 - .12), .34, .22);
  /* the trunk lid is its own piece, so it can open */
  const lid = new THREE.Group(); lid.position.set(-1.62, .96, 0); g.add(lid);
  const lidMesh = rbox(lid, 1.05, .05, W * .9, .02, paint, -.52, .0, 0); lidMesh.visible = false;
  g.userData = { L, W, H: 1.42, paint, lid, lidMesh, keep: true };
  return g;
}

/* a 1980s Ford Econoline: a tall box, short nose, the plumber's lettering on the side */
export function econoline(color = 0x1c2536, lettering = ['PLUMBING & SEPTIC SPECIALISTS', 'COMMERCIAL / INDUSTRIAL']) {
  const g = new THREE.Group(), L = 5.4, W = 2.0;
  const paint = new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .3 });
  const prof = [[-2.7, .42], [2.7, .42], [2.72, .62], [2.62, 1.04], [1.9, 1.16], [1.25, 1.98], [-2.64, 2.06], [-2.72, 1.9]];
  g.add(M(extrude(prof, W, .08), paint));
  const gm = glass();
  const cab = new THREE.Shape([[1.22, 1.18], [.5, 1.18], [.5, 1.86], [1.2, 1.86], [1.8, 1.2]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const s of [-1, 1]) { const w = M(new THREE.ShapeGeometry(cab), gm); w.position.z = s * (W / 2 + .004); g.add(w); }
  const ws = M(new THREE.PlaneGeometry(W * .86, .8), gm); ws.position.set(1.55, 1.56, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-.62); g.add(ws);
  for (const s of [-1, 1]) { const rw = M(new THREE.PlaneGeometry(.7, .55), gm); rw.position.set(-2.73, 1.55, s * .45); rw.rotation.y = -Math.PI / 2; g.add(rw); }
  /* the lettering: faded red with a cream outline, a pipe for a logo */
  const sign = new THREE.MeshStandardMaterial({ transparent: true, roughness: .7, map: canvasTex(1024, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.textAlign = 'left'; c.lineJoin = 'round';
    c.font = 'bold italic 92px Georgia, serif'; c.lineWidth = 10; c.strokeStyle = 'rgba(214,196,160,.8)'; c.strokeText('J. Sassano', 170, 100); c.fillStyle = 'rgba(160,48,36,.85)'; c.fillText('J. Sassano', 170, 100);
    c.font = 'bold 40px Arial'; c.lineWidth = 6; c.strokeText(lettering[0], 170, 160); c.fillText(lettering[0], 170, 160);
    c.font = '34px Arial'; c.fillStyle = 'rgba(222,214,196,.8)'; c.fillText(lettering[1], 290, 222);
    c.strokeStyle = 'rgba(214,196,160,.7)'; c.lineWidth = 14; c.beginPath(); c.moveTo(40, 60); c.lineTo(120, 60); c.lineTo(120, 170); c.stroke();
    /* rust and grime */
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${90 + Math.random() * 40},${45 + Math.random() * 20},25,${Math.random() * .25})`; c.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 14, 2 + Math.random() * 6); }
  }) });
  for (const s of [-1, 1]) { const p = M(new THREE.PlaneGeometry(3.4, .85), sign); p.position.set(-.75, 1.35, s * (W / 2 + .012)); if (s < 0) p.rotation.y = Math.PI; g.add(p); }
  box(g, .1, .14, W * .98, mat(0x8e9094, .4, .8), 2.73, .5, 0); box(g, .1, .14, W * .98, mat(0x8e9094, .4, .8), -2.73, .5, 0);
  for (const s of [-1, 1]) box(g, .04, .18, .3, new THREE.MeshStandardMaterial({ color: 0xeaeae0, roughness: .3 }), 2.72, .82, s * .72);
  for (const [x, s] of [[1.86, 1], [1.86, -1], [-1.6, 1], [-1.6, -1]]) wheel(g, x, s * (W / 2 - .12), .37, .24, mat(0x6d6f72, .5, .6));
  /* the sliding door on the right side */
  const door = new THREE.Group(); door.position.set(-.2, 0, W / 2 + .01); g.add(door);
  g.userData = { L, W, H: 2.06, paint, door, keep: true };
  return g;
}

/* a late 1990s Chevrolet Suburban: long and square */
export function suburban(color = 0x1e2a26) {
  const g = new THREE.Group(), L = 5.57, W = 1.96;
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: .35, metalness: .5, clearcoat: .8, clearcoatRoughness: .12 });
  const prof = [[-2.78, .46], [2.78, .46], [2.8, .7], [2.72, 1.12], [1.48, 1.2], [.92, 1.84], [-2.72, 1.86], [-2.8, 1.5]];
  g.add(M(extrude(prof, W, .07), paint));
  const gm = glass();
  const win = new THREE.Shape([[.86, 1.22], [-2.62, 1.24], [-2.64, 1.74], [.84, 1.76], [1.3, 1.24]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const s of [-1, 1]) { const w = M(new THREE.ShapeGeometry(win), gm); w.position.z = s * (W / 2 + .004); g.add(w); }
  const ws = M(new THREE.PlaneGeometry(W * .86, .74), gm); ws.position.set(1.2, 1.52, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-.72); g.add(ws);
  box(g, .06, .32, 1.5, mat(0x2a2a2c, .5, .3), 2.8, .9, 0);
  box(g, .12, .2, W, mat(0x3a3a3c, .5, .3), 2.82, .52, 0); box(g, .12, .2, W, mat(0x3a3a3c, .5, .3), -2.82, .56, 0);
  for (const s of [-1, 1]) {
    box(g, .04, .18, .34, new THREE.MeshStandardMaterial({ color: 0xf4f4ea, emissive: 0x000000, roughness: .2 }), 2.82, .96, s * .66).userData.head = true;
    box(g, .04, .1, .16, new THREE.MeshStandardMaterial({ color: 0xf1e7b0, roughness: .2 }), 2.84, .62, s * .6).userData.fog = true;
    box(g, .05, .5, .1, new THREE.MeshStandardMaterial({ color: 0x8c0f0f, emissive: 0x200000, roughness: .3 }), -2.82, 1.1, s * .9);
  }
  for (const [x, s] of [[1.75, 1], [1.75, -1], [-1.72, 1], [-1.72, -1]]) wheel(g, x, s * (W / 2 - .13), .4, .26, mat(0xa8abb0, .35, .8));
  g.userData = { L, W, H: 1.86, paint, keep: true };
  return g;
}
