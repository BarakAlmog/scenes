import * as THREE from 'three';
import { app } from '../app.js';
import { M, box, cyl, rbox, mat, canvasTex, seeded } from '../lib/util.js';
import { bakeStatic } from '../lib/merge.js';
import { want, loop, stopLoops, slice, play } from '../audio.js';
import { hotspot } from '../ctrl/hotspots.js';
import { Forest } from '../world/trees.js';
import { cadillac } from '../world/cars.js';
import { hipRoof } from '../house/model.js';
import { roofTex } from '../house/textures.js';
import { buildDreamMoment } from './moment.js';

/* The Inn at the Oaks ("Join the Club", "Mayham"): the dream. A high hotel room in Costa Mesa with a beacon on the
   horizon; and the big Colonial house at night, after Eleven Oaks near Morristown: grey-blue clapboard, black
   shutters, arched dormers, a wide porch of white columns, string lights on the porch and the bushes and wound up
   the old trees, warm windows, a party inside. x east, z south, y up; the house faces south down its drive. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = h => new THREE.Color(h);
export const P = {
  date: [2006, 2, 26], lat: 40.79324, lon: -74.45161, grid: .67, tz: -5, dst: false, hour: 18.95,
  turbidity: 2.2, rayleigh: 1.6, mie: .0038, mieG: .8, haze: 1 / 3500, sunI: 3.0, exposure: .82, nightExposure: 3.2,
  groundAlbedo: C(0x2a3624), skyK: .24,
  clouds: { cover: .12, scale: .0006, soft: .16, alt: 2600, depth: .28, wind: [2, 1] },
};
import { HOTEL } from './layout.js';
export { HOTEL };

function clapTex(color = '#8f9dab') {
  const rnd = seeded(51);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const rows = 13;
    for (let r = 0; r < rows; r++) { const y = r * h / rows; g.fillStyle = 'rgba(30,40,50,.35)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y + 2, w, 2); }
    for (let i = 0; i < 800; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '20,30,40'},.04)`; g.fillRect(rnd() * w, rnd() * h, 3, 1); }
  });
}
function gravelTex() {
  const rnd = seeded(61);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7a7266'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 80 + rnd() * 110; g.fillStyle = `rgba(${v},${v - 6},${v - 14},.7)`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 2.5); }
  });
}
function lawnTex() {
  const rnd = seeded(71);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3c5a2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) { const v = rnd(); g.fillStyle = v < .5 ? 'rgba(20,40,12,.35)' : 'rgba(110,150,70,.25)'; g.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 3); }
  });
}
/* the city at night from high up: a grid of streets in sodium light, blocks with scattered windows */
function cityTex() {
  const rnd = seeded(81);
  const t = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#04050a'; g.fillRect(0, 0, w, h);
    /* the avenues in sodium orange, a few of them long and bent; the rest a scatter of lit windows and lamps */
    for (let i = 0; i < 22; i++) {
      g.strokeStyle = `rgba(255,${160 + rnd() * 50},${80 + rnd() * 40},${.25 + rnd() * .35})`; g.lineWidth = .6 + rnd() * 1.2;
      g.beginPath(); let x = rnd() * w, y = rnd() * h, a = rnd() * 6.28; g.moveTo(x, y);
      for (let k = 0; k < 30; k++) { a += (rnd() - .5) * .25; x += Math.cos(a) * 30; y += Math.sin(a) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 38000; i++) {
      const cx = rnd() * w, cy = rnd() * h, dens = .5 + .5 * Math.sin(cx * .011) * Math.sin(cy * .013);
      if (rnd() > dens) continue;
      const v = rnd(); g.fillStyle = v < .75 ? `rgba(255,${190 + rnd() * 50},${130 + rnd() * 70},${.25 + rnd() * .55})` : `rgba(190,215,255,${.25 + rnd() * .45})`;
      g.fillRect(cx, cy, 1, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function officeTex(seed) {
  const rnd = seeded(seed);
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#0a0d12'; g.fillRect(0, 0, w, h);
    /* floors of windows, whole floors lit or dark, a few offices on late */
    for (let y = 8, f = 0; y < h - 6; y += 10, f++) {
      const floorLit = rnd() < .35;
      for (let x = 5; x < w - 5; x += 8) { const on = floorLit ? rnd() < .8 : rnd() < .12; g.fillStyle = on ? (rnd() < .85 ? 'rgba(255,232,180,.85)' : 'rgba(205,225,255,.8)') : 'rgba(40,48,58,.9)'; g.fillRect(x, y, 5, 6); }
    }
  });
}
function glowTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(.12, 'rgba(255,240,210,.9)'); gr.addColorStop(.35, 'rgba(255,210,150,.25)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

/* ---------- the house ---------- */
function buildInn(group) {
  const g = new THREE.Group(); g.name = 'inn'; group.add(g);
  const clap = new THREE.MeshStandardMaterial({ map: clapTex(), roughness: .8 }), white = mat(0xf2efe8, .6), black = mat(0x14161a, .6);
  const lit = new THREE.MeshStandardMaterial({ color: 0x3a3226, emissive: 0xffc27a, emissiveIntensity: 1.6, roughness: .3 });
  const roofM = { roof: new THREE.MeshStandardMaterial({ map: roofTex(), roughness: .9, color: 0x9a9690 }), trim: white, soffit: mat(0xe8e4dc, .8) };
  const wallBox = (w, h, d, x, y, z) => { const m = clap.clone(); m.map = clap.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(w / 3, h / 3); return box(g, w, h, d, m, x, y, z); };
  /* the main block: two storeys, the gable ends east and west */
  wallBox(18, 6.4, 10, 0, 3.2, -7);
  for (const x of [-9, 9]) for (const z of [-2, -12]) box(g, .22, 6.5, .22, white, x, 3.25, z);
  /* the gable roof: two slopes and the triangular ends */
  const rise = 3.6, run = 5.4;
  for (const s of [-1, 1]) { const r = M(new THREE.PlaneGeometry(19.2, Math.hypot(rise, run)), roofM.roof); r.position.set(0, 6.4 + rise / 2, -7 + s * run / 2); r.rotation.x = s * (Math.PI / 2 - Math.atan2(rise, run)) * -1 - (s > 0 ? 0 : 0); r.rotation.x = -s * Math.atan2(run, rise) + (s > 0 ? 0 : 0); r.rotation.order = 'YXZ'; g.add(r); r.material.side = THREE.DoubleSide; }
  for (const x of [-9.02, 9.02]) { const tri = new THREE.Shape([new THREE.Vector2(-5.2, 0), new THREE.Vector2(5.2, 0), new THREE.Vector2(0, rise)]); const tg = new THREE.ShapeGeometry(tri); const t = M(tg, clap); t.rotation.y = Math.PI / 2; t.position.set(x, 6.4, -7); t.material = clap; g.add(t); t.material.side = THREE.DoubleSide; }
  box(g, 18.8, .22, .3, white, 0, 6.35, -1.8); box(g, 18.8, .22, .3, white, 0, 6.35, -12.2);
  /* the windows, warm, with black shutters */
  const win = (x, y, z, w = 1.05, h = 1.6, ry = 0, arch = false) => {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    box(f, w + .16, h + .16, .06, white, 0, 0, .02); box(f, w, h, .03, lit, 0, 0, .05);
    box(f, .03, h, .02, white, 0, 0, .07); for (const yy of [-h / 4, h / 4]) box(f, w, .03, .02, white, 0, yy, .07);
    if (arch) { const a = M(new THREE.CircleGeometry(w / 2, 16, 0, Math.PI), lit); a.position.set(0, h / 2, .05); f.add(a); }
    else for (const s of [-1, 1]) box(f, .38, h + .1, .04, black, s * (w / 2 + .3), 0, .04);
  };
  for (const x of [-7, -4.2, 4.2, 7]) { win(x, 1.95, -1.95); win(x, 4.8, -1.95); }
  win(0, 4.8, -1.95, 1.3, 1.6); win(-1.4, 4.8, -1.95, .8, 1.4); win(1.4, 4.8, -1.95, .8, 1.4);
  /* the front door, open, the light behind it */
  const doorway = new THREE.Group(); doorway.position.set(0, .6, -1.95); g.add(doorway);
  box(doorway, 1.8, 2.7, .08, white, 0, 1.35, 0);
  const inside = M(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x1a1612, emissive: 0xffd9a0, emissiveIntensity: 2.4 })); inside.position.set(0, 1.2, .05); doorway.add(inside);
  const doorL = new THREE.PointLight(0xffc98a, 6, 12, 1.6); doorL.position.set(0, 1.8, 1.2); doorway.add(doorL);
  /* three arched dormers on the front slope */
  for (const x of [-5, 0, 5]) {
    const d = new THREE.Group(); d.position.set(x, 6.4 + 1.2, -3.9); g.add(d);
    const dw = M(new THREE.BoxGeometry(1.6, 1.9, 1.8), clap); dw.position.set(0, .2, 0); d.add(dw);
    const dr = M(new THREE.ConeGeometry(1.3, 1, 4), roofM.roof); dr.position.set(0, 1.62, 0); dr.rotation.y = Math.PI / 4; dr.scale.set(1, 1, 1.4); d.add(dr);
    const w = new THREE.Group(); w.position.set(0, .15, .91); d.add(w); box(w, .9, 1.1, .05, white, 0, 0, 0); box(w, .74, .95, .03, lit, 0, 0, .03);
    const a = M(new THREE.CircleGeometry(.37, 14, 0, Math.PI), lit); a.position.set(0, .48, .035); w.add(a);
  }
  /* the wing on the east, arched windows below */
  const wm = clap.clone(); wm.map = clap.map.clone(); wm.map.needsUpdate = true; wm.map.repeat.set(2.3, 2);
  box(g, 7, 6.0, 8, wm, 12.5, 3.0, -7);
  hipRoof(g, roofM, [[9, -11], [16, -11], [16, -3], [9, -3]], 6.0, .7, .4, { soffit: false });
  for (const x of [11, 14]) { win(x, 1.9, -2.95, 1.1, 1.9, 0, true); win(x, 4.6, -2.95); }
  /* the porch: a floor up three steps, eight white columns, the balustrade, its own roof */
  const pf = .6;
  box(g, 17.4, pf, 3.4, mat(0x8a8078, .8), 0, pf / 2, -.2);
  box(g, 17.6, .06, 3.5, mat(0xd9d4ca, .7), 0, pf + .03, -.2);
  for (let i = 0; i < 3; i++) box(g, 2.8, pf / 3 * (3 - i), .36, mat(0xd9d4ca, .7), 0, pf / 3 * (3 - i) / 2, 1.5 + i * .36 + .18);
  const cols = [-8.4, -6, -3.6, -1.35, 1.35, 3.6, 6, 8.4];
  for (const x of cols) { cyl(g, .16, .18, 2.9, white, x, pf + 1.45, 1.25, 16); box(g, .42, .12, .42, white, x, pf + .06, 1.25); box(g, .44, .14, .44, white, x, pf + 2.93, 1.25); }
  const rail = (x0, x1) => {
    box(g, x1 - x0, .07, .1, white, (x0 + x1) / 2, pf + .9, 1.25); box(g, x1 - x0, .06, .08, white, (x0 + x1) / 2, pf + .1, 1.25);
    for (let x = x0 + .1; x < x1 - .05; x += .16) box(g, .04, .8, .04, white, x, pf + .5, 1.25);
  };
  for (let i = 0; i < cols.length - 1; i++) if (i !== 3) rail(cols[i] + .2, cols[i + 1] - .2);
  box(g, 17.8, .35, 3.9, white, 0, pf + 3.1, -.15);
  hipRoof(g, roofM, [[-8.9, -2], [8.9, -2], [8.9, 1.7], [-8.9, 1.7]], pf + 3.25, .28, .25, { soffit: true, fascia: true });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  inside.castShadow = false;
  return { g, doorway, porchY: pf, stepsZ: 2.6 };
}

/* the fairy lights: thousands of warm points, on the porch, the bushes and wound up the big trees */
function fairyLights(group, spots) {
  const geo = new THREE.SphereGeometry(.022, 6, 4), m = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });
  m.color.multiplyScalar(3.2);
  const im = new THREE.InstancedMesh(geo, m, spots.length); const m4 = new THREE.Matrix4();
  spots.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); });
  im.castShadow = false; im.receiveShadow = false; im.userData.keep = true; group.add(im);
  return im;
}

/* ---------- the hotel room over Costa Mesa ---------- */
function buildHotel(group) {
  const g = new THREE.Group(); g.name = 'hotel'; g.position.copy(HOTEL); group.add(g);
  const wall = mat(0xc8bca8, .85), carpet = mat(0x4a4038, .95), dark = mat(0x1c1a22, .9);
  const W = 5, D = 6, H = 2.7;
  box(g, W, .05, D, carpet, 0, 0, 0); box(g, W, .05, D, mat(0xe8e2d6, .9), 0, H, 0);
  box(g, .05, H, D, wall, -W / 2, H / 2, 0); box(g, .05, H, D, wall, W / 2, H / 2, 0); box(g, W, H, .05, wall, 0, H / 2, D / 2);
  /* the window wall toward the city: a wide pane, the sill, the dark curtains */
  box(g, W, .75, .1, wall, 0, .375, -D / 2); box(g, W, .35, .1, wall, 0, H - .175, -D / 2);
  const glass = M(new THREE.PlaneGeometry(W, H - 1.1), new THREE.MeshStandardMaterial({ color: 0x9ab0c0, transparent: true, opacity: .06, roughness: .02, depthWrite: false })); glass.position.set(0, .75 + (H - 1.1) / 2, -D / 2); glass.castShadow = false; g.add(glass);
  for (const x of [-W / 2 + .02, -.8, .8, W / 2 - .02]) box(g, .06, H - 1.1, .08, mat(0x5a5a5e, .4, .6), x, .75 + (H - 1.1) / 2, -D / 2);
  for (const s of [-1, 1]) { const c = box(g, .7, H - .1, .12, dark, s * (W / 2 - .45), H / 2, -D / 2 + .15); c.scale.z = 1; }
  box(g, W, .06, .35, mat(0xd8d0c0, .7), 0, .78, -D / 2 + .15);
  /* the bed, a desk with a lamp, a chair */
  box(g, 2.0, .55, 2.1, mat(0x4a3a2c, .8), -1.2, .275, 1.6); box(g, 1.95, .2, 2.05, mat(0xeeeae2, .9), -1.2, .65, 1.6); box(g, .6, .12, .4, mat(0xf4f2ec, .9), -1.6, .8, 2.4);
  box(g, 1.2, .05, .55, mat(0x5a4632, .6), 1.6, .74, 1.6); for (const [x, z] of [[1.05, 1.36], [2.15, 1.36], [1.05, 1.84], [2.15, 1.84]]) box(g, .05, .72, .05, mat(0x5a4632, .6), x, .36, z);
  const lamp = new THREE.PointLight(0xffc98a, 2.2, 7, 1.6); lamp.position.set(2, 1.3, 1.5); g.add(lamp);
  cyl(g, .14, .1, .22, mat(0xf2e6cc, .8), 2, 1.2, 1.5, 12);
  /* the city below: a plane of lights, a few office towers; the beacon on the horizon */
  const city = M(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshBasicMaterial({ map: cityTex(), color: 0xffffff })); city.material.map.repeat.set(9, 9);
  city.rotation.x = -Math.PI / 2; city.position.set(0, -HOTEL.y + .5, -14000); city.receiveShadow = false; city.castShadow = false; g.add(city);
  const rnd = seeded(91);
  for (let i = 0; i < 14; i++) {
    const x = (rnd() - .5) * 1600, z = -300 - rnd() * 1800, w = 30 + rnd() * 40, h = 40 + rnd() * 90;
    const m = new THREE.MeshBasicMaterial({ map: officeTex(100 + i) }); m.map.repeat.set(w / 30, h / 60);
    const b = M(new THREE.BoxGeometry(w, h, w * .8), m); b.position.set(x, -HOTEL.y + h / 2, z); b.castShadow = false; b.receiveShadow = false; g.add(b);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(260, -HOTEL.y + 60, -5200); glow.scale.set(520, 520, 1); g.add(glow);
  const beam = M(new THREE.PlaneGeometry(2600, 70), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xfff0d0, transparent: true, opacity: .0, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.copy(glow.position); g.add(beam);
  g.traverse(o => { if (o.isMesh && o !== city && !(o.material?.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, glow, beam, beacon: glow.getWorldPosition(V()).add(HOTEL.clone().multiplyScalar(0)), W, D, H, lamp };
}

/* ---------- the hospital ceiling, for the waking ---------- */
function buildHospital(group) {
  const g = new THREE.Group(); g.name = 'hospital'; g.position.set(-24000, 0, 0); group.add(g);
  box(g, 6, .05, 6, mat(0xdcdcd4, .8), 0, 0, 0); box(g, 6, .05, 6, mat(0xf2f2ee, .9), 0, 2.8, 0);
  for (const [x, z] of [[-1.4, 0], [1.4, 0], [0, -1.8], [0, 1.8]]) box(g, 1.2, .03, .6, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf0f6ff, emissiveIntensity: 2.2 }), x, 2.77, z);
  for (const s of [-1, 1]) box(g, .05, 2.8, 6, mat(0xd8dcd8, .8), s * 3, 1.4, 0);
  box(g, 6, 2.8, .05, mat(0xd8dcd8, .8), 0, 1.4, -3); box(g, 6, 2.8, .05, mat(0xd8dcd8, .8), 0, 1.4, 3);
  box(g, 1.1, .7, 2.2, mat(0xeeeeea, .9), 0, .35, 0);
  const L = new THREE.PointLight(0xf0f6ff, 6, 10, 1.4); L.position.set(0, 2.4, 0); g.add(L);
  return { g, bed: V(-24000, 1.05, .6) };
}

export async function load({ status } = {}) {
  status && (status.textContent = 'Following the beacon…');
  const near = new THREE.Group(), far = new THREE.Group();
  const T = { name: 'inn', heightAt: () => 0, rings: [], meshes: [], skyline: null };
  /* the ground: lawn round the house, the drive of gravel, the dark woods */
  const lawn = new THREE.MeshStandardMaterial({ map: lawnTex(), roughness: .95 }); lawn.map.repeat.set(120, 120);
  const ground = M(new THREE.PlaneGeometry(600, 600), lawn); ground.rotation.x = -Math.PI / 2; ground.castShadow = false; near.add(ground);
  const gravel = new THREE.MeshStandardMaterial({ map: gravelTex(), roughness: .95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); gravel.map.repeat.set(1, 1);
  const drivePts = [[-3, 90], [-6, 60], [-2, 34], [3, 18], [4, 8], [0, 5.2], [-4, 8]];
  {const pos = [], uv = [], idx = [], curve = new THREE.CatmullRomCurve3(drivePts.map(([x, z]) => V(x, 0, z))); const n = 120; let acc = 0, prev = null;
   for (let i = 0; i <= n; i++) { const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), nx = -t.z, nz = t.x, w = 2.3; if (prev) acc += p.distanceTo(prev); prev = p; for (const s of [-1, 1]) { pos.push(p.x + nx * w * s, .02, p.z + nz * w * s); uv.push(s < 0 ? 0 : 1.2, acc / 3.5); } if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
   const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); dg.setIndex(idx); dg.computeVertexNormals();
   if (dg.attributes.normal.getY(0) < 0) { const ix = dg.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } dg.computeVertexNormals(); }
   const d = M(dg, gravel); d.castShadow = false; near.add(d);
   near.userData.drive = curve;}
  const inn = buildInn(near);
  /* the bushes along the porch and the walk, lit */
  const bushM = new THREE.MeshStandardMaterial({ color: 0x2a4020, roughness: .95 });
  const bushes = [];
  for (const [x, z, w, h] of [[-6.5, 2.4, 3.6, 1.2], [6.5, 2.4, 3.6, 1.2], [-11.5, 1.8, 3, 1.4], [11.5, 1.8, 3, 1.4], [-3.2, 5.2, 1.6, .9], [3.2, 5.2, 1.6, .9], [14.5, -1.8, 2.4, 1.6]]) { const b = rbox(near, w, h, 1.3, .45, bushM, x, h / 2, z); bushes.push({ x, z, w, h }); void b; }
  /* the old trees: along the drive and round the lawn, the ones by the house wound with lights */
  const rnd = seeded(2006), trees = [];
  const put = (x, z, kind = 'oak', s = null) => trees.push({ x, z, y: 0, kind, v: Math.floor(rnd() * 4) % (kind === 'oak' ? 4 : 3), s: s ?? 1.1 + rnd() * .35, a: rnd() * 6.28, tint: .75 + rnd() * .2, thin: 0 });
  const litTrees = [[-15, 6], [-10.5, 13], [12.8, 8], [17, 1], [-19, -1], [8.5, 17]];
  for (const [x, z] of litTrees) put(x, z, 'oak', 1.3);
  for (let i = 0; i < 26; i++) { const t = 12 + i * 3.2, side = i % 2 ? 1 : -1, c = near.userData.drive.getPointAt(Math.min(1, Math.max(0, 1 - t / 95))); put(c.x + side * (7 + rnd() * 5), c.z + (rnd() - .5) * 2); }
  for (let i = 0; i < 520; i++) { const a = rnd() * 6.28, r = 32 + rnd() * 150, x = Math.cos(a) * r, z = Math.sin(a) * r - 10; if (Math.abs(x - near.userData.drive.getPointAt(.5).x) < 9 && z > 10 && z < 95) continue; put(x, z, rnd() < .15 ? 'pine' : rnd() < .5 ? 'oak' : 'maple', .9 + rnd() * .5); }
  const forest = new Forest(trees, { season: 'summer', snow: 0, near: 60, mid: 170, far: 420 });
  near.add(forest.group);
  /* the fairy lights */
  const spots = [];
  for (let x = -8.8; x <= 8.8; x += .18) spots.push(V(x, inn.porchY + 3.05, 1.72), V(x, inn.porchY + .96, 1.25));
  for (const b of bushes) for (let i = 0; i < b.w * 26; i++) { const u = (rnd() - .5) * b.w * .95, v = rnd() * b.h, z = b.z + (rnd() - .5) * 1.25 + .1; spots.push(V(b.x + u, v + .05, z + .62 * Math.sign(rnd() - .5) * .9)); }
  /* wound round and round the trunk and up into the first limbs: a column of lights */
  for (const [x, z] of litTrees) { for (let k = 0; k < 1100; k++) { const t = rnd(), y = .25 + t * 8.5, a = rnd() * 6.283, r = (.4 + rnd() * .06) * (1 - t * .35); spots.push(V(x + Math.cos(a) * r, y, z + Math.sin(a) * r)); } }
  const fairy = fairyLights(near, spots);
  /* the silver sedan where it stops; guests on the porch */
  const car = cadillac(0xb4b8bc); car.position.set(4.6, 0, 11); car.rotation.y = Math.PI * .98 + Math.PI / 2; car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); near.add(car);
  const carL = new THREE.SpotLight(0xfff4e0, 0, 40, .5, .5, 1.5); near.add(carL, carL.target); car.userData.lamp = carL;
  const hotel = buildHotel(near);
  const hospital = buildHospital(near);
  /* the light that the house gives the lawn */
  const warm = new THREE.PointLight(0xffc98a, 14, 30, 1.6); warm.position.set(0, 3, 5); near.add(warm);
  for (const [x, z] of [[-6, 3], [6, 3]]) { const L = new THREE.PointLight(0xffd9a0, 4, 12, 1.6); L.position.set(x, 1.6, z); near.add(L); }
  for (const c of near.children.slice()) if (c.isGroup && !c.userData.keep && c !== forest.group && c !== car && c.name !== 'hotel' && c.name !== 'hospital') bakeStatic(c);
  bakeStatic(inn.g);
  const place = {
    id: 'inn', P, T, groups: { near, far }, inn, hotel, hospital, forest, trees, car, fairy,
    views: {
      inn: { label: 'The Inn', icon: '<path d="M3 20V10l9-6 9 6v10"/><path d="M6 20v-6h12v6M9 13h1M14 13h1"/>', get: () => ({ pos: V(3.5, 1.7, 21), target: V(0, 3, -3), fov: 46 }) },
      porch: { label: 'The porch', icon: '<path d="M3 10h18M5 10v10M19 10v10M9 10v10M15 10v10M3 20h18"/>', get: () => ({ pos: V(-1.5, 1.6, 7.5), target: V(0, 2.2, -1), fov: 50 }) },
      trees: { label: 'The lit trees', icon: '<path d="M12 21V8M8 12l4-4 4 4M7 16l5-4 5 4"/>', get: () => ({ pos: V(-4, 1.6, 12), target: V(-15, 3.5, 6), fov: 50 }) },
      drive: { label: 'The drive', icon: '<path d="M9 21c0-6 6-9 6-18M15 21c0-4 3-7 4-9"/>', get: () => ({ pos: V(-3.5, 1.6, 34), target: V(0, 3, 0), fov: 44 }) },
      hotel: { label: 'The window', icon: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16M3 12h18"/>', get: () => { const p = HOTEL.clone().add(V(.2, 1.62, -1.2)); return { pos: p, target: p.clone().addScaledVector(hotel.glow.getWorldPosition(V()).sub(p).normalize(), 1.6), fov: 50 }; } },
    },
    viewOrder: ['inn', 'porch', 'trees', 'drive', 'hotel'], startView: 'inn',
    /* the Inn and its grounds; the hotel room, where you turn about at the window and stay inside the walls */
    orbit: [{ x: 0, z: 10, r: 90 }, { x: HOTEL.x, z: HOTEL.z - 2.5, r: 1.2, box: [HOTEL.x - 2.3, HOTEL.x + 2.3, HOTEL.y + .3, HOTEL.y + 2.5, HOTEL.z - 2.85, HOTEL.z + 2.8] }], fov: 46, minEye: .3, turntable: false,
    walkStart: { pos: V(3.6, 0, 9.2), yaw: .1 },
    solidsNear: (x, z, r) => { const out = []; for (const t of forest.near(x, z, r)) out.push({ x: t.x, z: t.z, r: t.r + .05 }); for (const b of bushes) if (Math.abs(b.x - x) < b.w + r && Math.abs(b.z - z) < 2 + r) for (let k = -1; k <= 1; k++) out.push({ x: b.x + k * b.w / 3, z: b.z, r: .7 }); return out; },
    boxes: [[-9.2, 16.3, -12.3, -2.0], [-8.9, 8.9, -2.0, 1.5], [3.4, 5.8, 8.6, 13.4]],
    floorAt: (x, z) => x > 12000 ? HOTEL.y + .025 : (x > -8.8 && x < 8.8 && z > -2 && z < 1.5) ? inn.porchY + .06 : (Math.abs(x) < 1.4 && z >= 1.5 && z < 2.6) ? inn.porchY * (1 - (z - 1.5) / 1.1) : 0,
    /* inside the hotel room, or round the Inn */
    bound: p => {
      if (p.x > 12000) { p.x = Math.max(HOTEL.x - 2.2, Math.min(HOTEL.x + 2.2, p.x)); p.z = Math.max(HOTEL.z - 2.7, Math.min(HOTEL.z + 2.7, p.z)); return; }
      const r = Math.hypot(p.x, p.z - 10); if (r > 80) { p.x = p.x / r * 80; p.z = 10 + (p.z - 10) / r * 80; }
    },
    surfaceAt: () => 1, noAO: [fairy],
    help: [['Space', 'Follow the beacon: the dream of the Inn at the Oaks.'], ['E', 'Look, go on']],
    walkHelp: (mode, locked) => mode === 'game' ? (app.touch ? 'Left thumb to move · right thumb to look · USE' : locked ? '' : 'Click to look with the mouse · WASD to move · E to go on') : null,
    enter() { forest.update(true); want(['amb-inn', 'party-in', 'gravel', 'cardoor', 'engine', 'room']); },
    sound() {
      const inHotel = app.camera.position.x > 12000, inHosp = app.camera.position.x < -12000;
      loop('room').set(inHotel || inHosp ? .5 : 0);
      loop('amb-inn').set(inHotel || inHosp ? 0 : .6);
      loop('party-in', { pos: V(0, 2, -5), ref: 5 }).set(inHotel || inHosp ? 0 : .7);
    },
    leave() { place.act?.stop?.(); stopLoops('amb-'); stopLoops('room'); stopLoops('party-in'); },
  };
  place.act = buildDreamMoment(place);
  hotspot(car, { title: 'The silver sedan', text: 'Kevin Finnerty’s car. In his briefcase, a flier for the Finnerty family reunion at the Inn at the Oaks.' });
  app.on('step', e => { if (app.place !== place) return; const you = e.who === 'you'; slice('gravel', 4, .5, { pos: you ? null : V(e.pos.x, .1, e.pos.z), ref: 3, gain: you ? .28 : .36 }); });
  void play;
  return place;
}
