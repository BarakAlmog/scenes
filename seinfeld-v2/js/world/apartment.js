import * as THREE from 'three';
import { app } from '../app.js';
import { MAT } from '../lib/materials.js';
import { M, box, cyl, keep, WP, put, mat, easeOutBack, easeInOut } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { buildWall, attach } from './walls.js';
import { windowView, setViewFrame } from './outside.js';

/* ---------- floor plan ---------- */
export const MAIN_POLY = [[-6.1, -.7], [-3.1, -3.45], [.85, -3.45], [2.55, -3.1], [5.0, -1.55], [6.35, .9], [4.6, 3.45], [-1.9, 3.45], [-4.7, 1.95]];
export const ROOMS = {
  main: MAIN_POLY,
  alcove: [[-.65, -3.45], [.85, -3.45], [.85, -4.55], [-.65, -4.55]],
  hall: [[-2.7, -4.55], [.85, -4.55], [.85, -5.85], [-2.7, -5.85]],
  bedroom: [[-4.6, -3.45], [-.65, -3.45], [-.65, -4.55], [-2.7, -4.55], [-2.7, -5.85], [-.4, -5.85], [-.4, -7.8], [-4.6, -7.8]],
  bath: [[-.4, -5.85], [2.4, -5.85], [2.4, -7.8], [-.4, -7.8]],
  corridor: [[.85, -3.45], [2.55, -3.1], [5.0, -1.55], [5.0, -5.85], [.85, -5.85]],
};
export const P = {};   /* placement frames along walls */
export const W = {};   /* wall records by name */
export const doors = {};

const shapeOf = pts => {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]);
  s.closePath(); return s;
};
const slab = (pts, y = -.34, d = .34) => {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: d, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); const o = M(g, MAT.slab); o.position.y = y; app.static.add(o); return o;
};
const floorPoly = (pts, material, y = .012) => {
  const g = new THREE.ShapeGeometry(shapeOf(pts)); g.rotateX(-Math.PI / 2);
  const o = new THREE.Mesh(g, material); o.position.y = y; o.receiveShadow = true; app.static.add(o); return o;
};

/* a hinged door leaf; open() swings it, burst() slams it */
function makeDoor(pivot, openAngle) {
  const base = pivot.rotation.y;
  const d = { pivot, angle: 0, from: 0, to: 0, t: 1, dur: 1, ease: easeInOut, isOpen: false, wobble: 0, closing: false };
  const go = (to, dur, ease) => { d.from = d.angle; d.to = to; d.t = 0; d.dur = dur; d.ease = ease; };
  d.burst = () => { go(openAngle, .26, easeOutBack); d.isOpen = true; d.closing = false; d.wobble = 1; };
  d.open = () => { if (d.isOpen) return; go(openAngle * .9, .7, easeInOut); d.isOpen = true; d.closing = false; app.emit('door:open', d); };
  d.close = () => { if (!d.isOpen) return; go(0, .9, easeInOut); d.isOpen = false; d.closing = true; };
  d.update = dt => {
    if (d.t < 1) {
      d.t = Math.min(1, d.t + dt / d.dur); d.angle = d.from + (d.to - d.from) * d.ease(d.t);
      if (d.t === 1 && d.closing) { d.closing = false; app.emit('door:shut', d); }
    }
    d.wobble = Math.max(0, d.wobble - dt / 1.2);
    pivot.rotation.y = base + d.angle + (d.isOpen ? Math.sin(app.time * 14) * .014 * d.wobble : 0);
  };
  app.onUpdate(d.update);
  return d;
}

/* outside: the side (+1 / -1 local z) that faces the corridor and carries the number */
function doorLeaf(parent, dw, plate, outside) {
  const leaf = new THREE.Group(); parent.add(leaf);
  box(leaf, dw, 2.08, .055, MAT.door, -dw / 2 - .02, 1.04, 0);
  for (const s of [1, -1]) {
    box(leaf, dw - .3, .78, .02, MAT.doorPanel, -dw / 2 - .02, 1.62, .038 * s);
    box(leaf, dw - .3, .78, .02, MAT.doorPanel, -dw / 2 - .02, .62, .038 * s);
    cyl(leaf, .035, .035, .07, MAT.brass, -dw + .12, 1.02, .04 * s).rotation.x = Math.PI / 2;
    cyl(leaf, .012, .012, .02, MAT.brass, -dw / 2 - .02, 1.5, .045 * s).rotation.x = Math.PI / 2;
  }
  for (const y of [1.22, 1.38]) cyl(leaf, .025, .025, .05, MAT.brass, -dw + .12, y, -.04 * outside).rotation.x = Math.PI / 2;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(.2, .1), new THREE.MeshStandardMaterial({ map: TX.plateTex(plate), roughness: .35, metalness: .6 }));
  p.position.set(-dw / 2 - .02, 1.78, .05 * outside); if (outside < 0) p.rotation.y = Math.PI;
  leaf.add(p);
  return leaf;
}

export function buildApartment() {
  /* ---------- ground + base ---------- */
  MAT.ground = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: .95 });
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), MAT.ground);
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -.385; gnd.receiveShadow = true;
  keep(gnd); app.scene.add(gnd); app.ground = gnd;

  slab(MAIN_POLY);
  slab([[-4.8, -3.3], [5.2, -3.3], [5.2, -8.0], [-4.8, -8.0]]);

  floorPoly(MAIN_POLY, MAT.floorWood);
  floorPoly(ROOMS.alcove, MAT.tileTan);
  floorPoly(ROOMS.hall, MAT.tileTan);
  floorPoly(ROOMS.bedroom, MAT.floorWood);
  floorPoly(ROOMS.bath, MAT.tileBath);
  floorPoly(ROOMS.corridor, MAT.hallCarpet);

  /* ---------- wall network ---------- */
  const wWin = [[-6.1, -.7], [-3.1, -3.45]], wNA = [[-3.1, -3.45], [-.65, -3.45]], wNB = [[-.65, -3.45], [.85, -3.45]],
    wDoor = [[.85, -3.45], [2.55, -3.1]], wKit = [[2.55, -3.1], [5.0, -1.55]], wEast = [[5.0, -1.55], [6.35, .9]],
    wSE = [[6.35, .9], [4.6, 3.45]], wS = [[4.6, 3.45], [-1.9, 3.45]], wSW = [[-1.9, 3.45], [-4.7, 1.95]], wWest = [[-4.7, 1.95], [-6.1, -.7]];
  Object.assign(P, { Win: WP(...wWin), NA: WP(...wNA), NB: WP(...wNB), Door: WP(...wDoor), Kit: WP(...wKit),
    East: WP(...wEast), SE: WP(...wSE), S: WP(...wS), SW: WP(...wSW), West: WP(...wWest) });

  const WIN_T0 = .85, WIN_T1 = 3.25, WIN_Y0 = .95, WIN_Y1 = 2.42, DOOR_T0 = .34, DOOR_T1 = 1.34;
  W.win = buildWall({ name: 'window', a: wWin[0], b: wWin[1], t: .3, skin: true, openings: [{ from: WIN_T0, to: WIN_T1, y0: WIN_Y0, y1: WIN_Y1 }] });
  W.na = buildWall({ name: 'bookshelf', a: wNA[0], b: wNA[1], t: .3, skin: true });
  W.nb = buildWall({ name: 'alcove header', a: wNB[0], b: wNB[1], t: .3, openings: [{ from: 0, to: P.NB.L, y1: 2.12 }] });
  W.door = buildWall({ name: 'front door', a: wDoor[0], b: wDoor[1], t: .22, back: 'hall', openings: [{ from: DOOR_T0, to: DOOR_T1, y1: 2.12 }] });
  W.kit = buildWall({ name: 'kitchen', a: wKit[0], b: wKit[1], t: .22, back: 'hall' });
  W.east = buildWall({ name: 'sink', a: wEast[0], b: wEast[1], t: .3, skin: true });
  W.se = buildWall({ name: 'south-east', a: wSE[0], b: wSE[1], t: .3, skin: true });
  W.s = buildWall({ name: 'south', a: wS[0], b: wS[1], t: .3, skin: true, h: 1.14 });
  W.sw = buildWall({ name: 'south-west', a: wSW[0], b: wSW[1], t: .3, skin: true, h: 1.14 });
  W.west = buildWall({ name: 'west', a: wWest[0], b: wWest[1], t: .3, skin: true });

  /* entry alcove, back hall, bedroom, bath, public corridor */
  W.alcoveL = buildWall({ a: [-.65, -3.45], b: [-.65, -4.55], t: .16, back: 'plain' });
  W.alcoveR = buildWall({ a: [.85, -4.55], b: [.85, -3.45], t: .16, back: 'hall' });
  W.bike = buildWall({ a: [-.65, -4.55], b: [.85, -4.55], t: .16, back: 'plain', openings: [{ from: .02, to: .5, y1: 2.05 }] });
  W.hallS = buildWall({ a: [-.65, -4.55], b: [-2.7, -4.55], t: .16, style: 'plain' });
  W.hallW = buildWall({ a: [-2.7, -4.55], b: [-2.7, -5.85], t: .16, style: 'plain' });
  W.hallN = buildWall({ a: [-2.7, -5.85], b: [.85, -5.85], t: .16, style: 'plain',
    openings: [{ from: .75, to: 1.55, y1: 2.05 }, { from: 2.62, to: 3.32, y1: 2.05 }] });
  W.hallE = buildWall({ a: [.85, -4.55], b: [.85, -5.85], t: .16, style: 'hall', back: 'plain' });
  W.corN = buildWall({ a: [.85, -5.85], b: [5.0, -5.85], t: .16, style: 'hall', back: 'bath',
    openings: [{ from: 2.45, to: 3.35, y1: 2.08 }] });
  W.corE = buildWall({ a: [5.0, -5.85], b: [5.0, -1.55], t: .3, style: 'hall', skin: true });
  W.bedS = buildWall({ a: [-3.1, -3.45], b: [-4.6, -3.45], t: .3, style: 'plain', skin: true });
  W.bedW = buildWall({ a: [-4.6, -3.45], b: [-4.6, -7.8], t: .3, style: 'plain', skin: true,
    openings: [{ from: 2.85, to: 3.95, y0: .95, y1: 2.2 }] });
  W.north = buildWall({ a: [-4.6, -7.8], b: [2.4, -7.8], t: .3, style: 'plain', skin: true });
  W.bedBath = buildWall({ a: [-.4, -7.8], b: [-.4, -5.85], t: .16, style: 'plain', back: 'bath' });
  W.bathE = buildWall({ a: [2.4, -7.8], b: [2.4, -5.85], t: .3, style: 'bath', skin: true });

  /* the neighbour's unit behind 5B: a closed block */
  {const b = box(app.static, 2.6, 2.62, 2.02, MAT.wallSkin, 3.85, 1.31, -6.94);
   b.receiveShadow = true;
   box(app.static, 2.6, .06, 2.02, MAT.poche, 3.85, 2.65, -6.94);}

  /* ---------- window assembly ---------- */
  {const PWin = P.Win, g = new THREE.Group(); const mid = (WIN_T0 + WIN_T1) / 2, w = WIN_T1 - WIN_T0, h = WIN_Y1 - WIN_Y0;
   g.position.copy(PWin.at(mid, 0, (WIN_Y0 + WIN_Y1) / 2)); g.rotation.y = PWin.rotY;
   const fr = MAT.white;
   box(g, w + .16, .09, .2, fr, 0, h / 2 + .02, 0); box(g, w + .16, .12, .22, fr, 0, -h / 2 - .04, 0);
   box(g, .09, h + .1, .2, fr, -w / 2 - .03, 0, 0); box(g, .09, h + .1, .2, fr, w / 2 + .03, 0, 0);
   box(g, .07, h, .14, fr, 0, 0, 0);
   box(g, w, .06, .12, fr, 0, .02, 0);
   for (const k of [-1, 1]) box(g, .03, h, .08, fr, k * w / 4, 0, 0);
   const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.glass); gl.position.z = -.02; g.add(gl);
   /* blinds: the slats throw striped sunlight across the floor */
   for (let i = 0; i < 13; i++) box(g, w - .1, .016, .05, MAT.cream, 0, h / 2 - .1 - i * .062, .09);
   box(g, w - .08, .05, .06, MAT.cream, 0, h / 2 - .04, .09);
   cyl(g, .006, .006, .5, MAT.cream, w / 2 - .18, h / 2 - .32, .12);
   const view = windowView(w, h); view.position.z = -.08; g.add(view);
   attach(W.win, g); app.root.add(g);
   setViewFrame(view);
   app.windowGroup = g;}

  /* ---------- front door (5A) ---------- */
  {const PDoor = P.Door, trim = MAT.rail;
   const jamb = t => { const p = PDoor.at(t, 0, 1.06); return box(app.root, .09, 2.12, .26, trim, p.x, p.y, p.z, PDoor.rotY); };
   attach(W.door, jamb(DOOR_T0 - .03)); attach(W.door, jamb(DOOR_T1 + .03));
   const hp = PDoor.at((DOOR_T0 + DOOR_T1) / 2, 0, 2.12 + .045);
   attach(W.door, box(app.root, DOOR_T1 - DOOR_T0 + .22, .09, .26, trim, hp.x, hp.y, hp.z, PDoor.rotY));
   const pivot = keep(new THREE.Group());
   pivot.position.copy(PDoor.at(DOOR_T1, 0, 0)); pivot.rotation.y = PDoor.rotY;
   doorLeaf(pivot, DOOR_T1 - DOOR_T0 - .04, '5A', -1);
   app.root.add(pivot);
   doors.front = makeDoor(pivot, 1.8);
   doors.front.center = PDoor.at((DOOR_T0 + DOOR_T1) / 2, 0, 0);
   doors.front.n = PDoor.n;
   /* intercom right of the door */
   const ip = PDoor.at(1.56, .12, 1.45);
   const ic = keep(new THREE.Group()); ic.position.copy(ip); ic.rotation.y = PDoor.rotY;
   box(ic, .13, .2, .035, MAT.brass, 0, 0, 0);
   for (let i = 0; i < 3; i++) box(ic, .09, .008, .01, MAT.black, 0, .05 - i * .018, .02);
   box(ic, .03, .03, .015, mat(0xe8e2d0, .5), 0, -.055, .02);
   app.root.add(ic); attach(W.door, ic); app.intercom = ic;
   /* door mat in the corridor */
   const dm = PDoor.at((DOOR_T0 + DOOR_T1) / 2, -.5, .012);
   box(app.static, .82, .014, .5, mat(0x6b5a45, .95), dm.x, dm.y, dm.z, PDoor.rotY).castShadow = false;}

  /* ---------- sconces ---------- */
  const sconceMat = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: .5, emissive: 0xffe2a8, emissiveIntensity: 2.2, side: THREE.DoubleSide });
  MAT.sconce = sconceMat;
  const sconce = (rec, Pw, t, y = 2.02) => {
    const g = new THREE.Group(); g.position.copy(Pw.at(t, .1, y)); g.rotation.y = Pw.rotY;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.105, 16, 8, 0, Math.PI, Math.PI / 2, Math.PI / 2), sconceMat));
    box(g, .05, .16, .05, MAT.cream, 0, -.05, -.06);
    app.root.add(g); return attach(rec, g);
  };
  app.sconces = [sconce(W.na, P.NA, 2.34), sconce(W.win, P.Win, .45), sconce(W.west, P.West, 1.05), sconce(W.door, P.Door, .16, 2.05)];

  /* bedroom door on the north wall (closed) */
  {const t0 = .08, t1 = .92, mid = (t0 + t1) / 2, g = new THREE.Group(), PNA = P.NA;
   for (const tt of [t0, t1]) { const p = PNA.at(tt, .18, 1.03); box(g, .08, 2.06, .1, MAT.rail, p.x, p.y, p.z, PNA.rotY); }
   const hp = PNA.at(mid, .18, 2.1); box(g, t1 - t0 + .16, .08, .1, MAT.rail, hp.x, hp.y, hp.z, PNA.rotY);
   const lp = PNA.at(mid, .17, 1.01); box(g, t1 - t0 - .06, 1.98, .05, MAT.door, lp.x, lp.y, lp.z, PNA.rotY);
   for (const py of [1.45, .55]) { const pp = PNA.at(mid, .2, py); box(g, t1 - t0 - .36, .7, .015, MAT.doorPanel, pp.x, pp.y, pp.z, PNA.rotY); }
   const kp = PNA.at(t1 - .14, .21, 1.0); cyl(g, .03, .03, .05, MAT.brass, kp.x, kp.y, kp.z).rotation.x = Math.PI / 2;
   app.root.add(g); attach(W.na, g);}

  /* ---------- wall art ---------- */
  const makeArt = (w, h, kind, frame = MAT.black) => {
    const g = new THREE.Group();
    box(g, w + .05, h + .05, .035, frame, 0, 0, 0);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: TX.artTex(kind), roughness: .9 }));
    pic.position.z = .02; g.add(pic); return g;
  };
  const hangArt = (rec, Pw, t, y, w, h, kind, frame) => { const a = makeArt(w, h, kind, frame); put(a, Pw.at(t, .045, y), Pw.rotY, app.root); return attach(rec, a); };
  hangArt(W.west, P.West, 2.25, 1.78, .5, .66, 'cars');
  hangArt(W.west, P.West, .55, 1.72, .42, .56, 'poster');
  hangArt(W.win, P.Win, .42, 1.5, .38, .5, 'photo');
  hangArt(W.door, P.Door, .17, 1.66, .24, .3, 'photo');
  hangArt(W.se, P.SE, 1.35, 1.62, .6, .45, 'landscape', MAT.woodDark);

  /* ---------- 5B, across the hall ---------- */
  {const pivot = keep(new THREE.Group()); pivot.position.set(.85 + 3.35, 0, -5.85); pivot.rotation.y = 0;
   const tr = MAT.rail;
   for (const x of [.85 + 2.42, .85 + 3.38]) box(app.static, .08, 2.1, .22, tr, x, 1.05, -5.85);
   box(app.static, 1.04, .08, .22, tr, .85 + 2.9, 2.12, -5.85);
   doorLeaf(pivot, .86, '5B', 1);
   app.root.add(pivot);
   doors.b5 = makeDoor(pivot, 1.5);
   doors.b5.center = new THREE.Vector3(.85 + 2.9, 0, -5.85);}

  /* corridor lamp */
  {const g = new THREE.Group(); g.position.set(4.83, 1.95, -3.9); g.rotation.y = -Math.PI / 2;
   g.add(new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 8, 0, Math.PI, Math.PI / 2, Math.PI / 2), sconceMat));
   box(g, .05, .16, .05, MAT.cream, 0, -.05, -.06);
   app.root.add(g); attach(W.corE, g);}
}
