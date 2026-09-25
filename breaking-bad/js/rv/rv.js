import * as THREE from 'three';
import { app } from '../app.js';
import { M, box, rbox, cyl, tube, mat, keep, canvasTex, easeInOut } from '../lib/util.js';
import * as TX from '../lib/textures.js';
import { hotspot, hitBox } from '../ctrl/hotspots.js';

/* The 1986 Fleetwood Bounder: 31 ft, cream ribbed siding, the stripe band, the entry door on the passenger side
   behind the front wheel, two roof air conditioners, the ladder at the back, dual rear wheels.
   The RV's own frame: x forward (front bumper at +4.78), y up from the ground, z to the passenger side.
   Layout after the Greenlight decoration guide, Iñaki Aliste Lizarralde's drawing and the stills. */
export const RV = {
  x0: -4.72, x1: 4.78, halfW: 1.22, floor: .86, ceil: 2.82, roof: 2.98, cut: 1.0,
  frontAxle: 3.3, rearAxle: -1.15, wheelR: .43,
  door: { x0: 1.30, x1: 1.98, y0: .50, y1: 2.42 },
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* windows: [x0, x1, y0, y1] on each side; the cab window follows the windshield */
const WIN = {
  right: [[2.25, 3.05, 1.55, 2.30], [-.35, .85, 1.55, 2.30], [-4.30, -3.00, 1.55, 2.30]],
  left: [[1.30, 2.60, 1.55, 2.30], [-.75, .60, 1.55, 2.30], [-2.20, -1.80, 1.78, 2.25], [-4.30, -2.95, 1.55, 2.30]],
};
const CAB = [[3.45, 1.52], [4.49, 1.52], [4.31, 2.30], [3.45, 2.30]];
/* the body's side outline, rear to front along the bottom (round the wheel wells), up the front, back along the roof */
function arcPts(cx, cy, r, from, to, n = 12) { const p = []; for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
const dR = Math.asin(.03 / .58), dF = Math.asin(.03 / .55);
const BOTTOM = [[-4.72, .46], [-1.73, .46], ...arcPts(-1.15, .43, .58, Math.PI - dR, dR), [2.75, .46], ...arcPts(3.30, .43, .55, Math.PI - dF, dF), [4.78, .46]];
const FRONT_LOW = [[4.78, .46], [4.78, .62], [4.74, .70], [4.728, 1.0]];
const FRONT_UP = [[4.728, 1.0], [4.72, 1.20], [4.64, 1.36], [4.60, 1.42], [4.36, 2.42], [4.38, 2.56], [4.30, 2.72], [4.15, 2.86], [3.95, 2.95], [3.70, 2.98]];
const TOP = [[3.70, 2.98], [-4.64, 2.98], [-4.70, 2.96], [-4.72, 2.90]];

function shapeOf(pts, holes = []) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}
const rect = ([x0, x1, y0, y1]) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0]];
/* extruded along +z by depth, uv: u = x in metres, v = the skin's height */
function extrude(shape, depth, yOff = 0, xOff = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + xOff + p.getZ(i), TX.skinV(p.getY(i) + yOff));
  return g;
}

/* a strip that spans the body's width along a profile: the front cap, the lower front */
function loft(pts, z0, z1, flip = false) {
  const pos = [], nor = [], uv = [], idx = [];
  let v = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    let nx = y1 - y0, ny = -(x1 - x0); const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    if (flip) { nx = -nx; ny = -ny; }
    for (const [x, y] of [[x0, y0], [x1, y1]]) for (const z of [z0, z1]) { pos.push(x, y, z); nor.push(nx, ny, 0); uv.push(z, TX.skinV(y)); }
    const b = v; v += 4;
    if (flip) idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); else idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export const rv = { root: null, body: null, walls: {}, door: null, wheels: [], mats: {}, lights: {}, parts: {}, state: {} };

export function buildRV() {
  const root = keep(new THREE.Group()); root.name = 'rv';
  const body = keep(new THREE.Group()); root.add(body);
  rv.root = root; rv.body = body;
  app.root.add(root); app.rv = rv;

  /* ---------- materials ---------- */
  const skin = TX.siding({ dirt: .55 });
  const M_ = rv.mats;
  M_.skin = new THREE.MeshStandardMaterial({ map: skin.map, normalMap: skin.normal, roughness: .62, metalness: 0 });
  M_.skin.normalScale.set(.55, .55);
  const pan = TX.paneling();
  M_.panel = new THREE.MeshStandardMaterial({ map: pan.map, normalMap: pan.normal, roughness: .7 });
  M_.ceiling = mat(0xe9e2d2, .9);
  M_.floor = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b89a72'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#a88a64' : '#c4a67c'; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    g.fillStyle = 'rgba(90,60,30,.15)'; for (let k = 0; k < 300; k++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }, 1 / .6, 1 / .6), roughness: .75 });
  M_.glass = new THREE.MeshPhysicalMaterial({ color: 0x9aa7a8, roughness: .08, metalness: 0, transmission: 0, transparent: true, opacity: .32, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide });
  M_.glassDark = new THREE.MeshStandardMaterial({ color: 0x2b3134, roughness: .15, metalness: .2, transparent: true, opacity: .62, depthWrite: false, envMapIntensity: 1.4, side: THREE.DoubleSide });
  M_.rubber = mat(0x1d1c1b, .88); M_.tire = mat(0x1f1e1d, .92);
  M_.chrome = mat(0xd7dbde, .24, .92); M_.alu = mat(0xb9bcbe, .35, .8); M_.dark = mat(0x2a2826, .7, .1);
  M_.chassis = mat(0x2d2a27, .8, .3); M_.cream = mat(0xe3d6ba, .6); M_.tan = mat(0xc9b38c, .6); M_.brownPaint = mat(0x6a4a33, .55);
  M_.amber = new THREE.MeshStandardMaterial({ color: 0xb8651a, emissive: 0xff8a1a, emissiveIntensity: .15, roughness: .3 });
  M_.red = new THREE.MeshStandardMaterial({ color: 0x8a1410, emissive: 0xff1f12, emissiveIntensity: .12, roughness: .3 });
  M_.head = new THREE.MeshStandardMaterial({ color: 0xe8ecef, emissive: 0xfff4dc, emissiveIntensity: 0, roughness: .12, metalness: .2 });
  for (const k of ['amber', 'red', 'head']) M_[k].userData.live = true;

  /* ---------- the shell: sides in two parts (stub and upper) so the near ones can drop ---------- */
  const W = RV.halfW, T = .03, CUT = RV.cut;
  const side = (s) => {
    const right = s > 0, door = right ? RV.door : null, wins = right ? WIN.right : WIN.left;
    const lowPts = [...BOTTOM, ...FRONT_LOW.slice(1)];
    const lower = door ? [...lowPts, [door.x1, CUT], [door.x1, door.y0], [door.x0, door.y0], [door.x0, CUT], [-4.72, CUT]] : [...lowPts, [-4.72, CUT]];
    const upperPts = door ? [[-4.72, CUT], [door.x0, CUT], [door.x0, door.y1], [door.x1, door.y1], [door.x1, CUT], ...FRONT_UP, ...TOP.slice(1)] : [[-4.72, CUT], ...FRONT_UP, ...TOP.slice(1)];
    const holes = [CAB, ...wins.map(rect)];
    const zOut = right ? W - T : -W;
    const stubG = extrude(shapeOf(lower), T); stubG.translate(0, 0, zOut);
    const upG = extrude(shapeOf(upperPts, holes), T); upG.translate(0, 0, zOut);
    /* inside: paneling from the floor to the ceiling, behind the cab */
    const ix0 = -4.66, ix1 = 3.3;
    /* the stub's paneling runs between the wheel humps and the door */
    const cuts = [[-1.78, -.52], [2.70, 3.9]].concat(door ? [[door.x0, door.x1]] : []).sort((a, b) => a[0] - b[0]);
    const runs = []; let at = ix0;
    for (const [a, b] of cuts) { if (a > at + .02) runs.push([at, Math.min(a, ix1)]); at = Math.max(at, b); }
    if (at < ix1 - .02) runs.push([at, ix1]);
    const inUp = door ? [[ix0, CUT], [door.x0, CUT], [door.x0, door.y1], [door.x1, door.y1], [door.x1, CUT], [ix1, CUT], [ix1, RV.ceil], [ix0, RV.ceil]] : [[ix0, CUT], [ix1, CUT], [ix1, RV.ceil], [ix0, RV.ceil]];
    const inHoles = wins.filter(w => w[1] < ix1 + .01 && w[0] > ix0 - .01).map(rect);
    const zIn = right ? W - T - .02 : -W + T;
    const inStub = runs.map(([a, b]) => extrude(shapeOf([[a, RV.floor], [b, RV.floor], [b, CUT], [a, CUT]]), .02));
    inStub.forEach(g => g.translate(0, 0, zIn));
    const inUpG = extrude(shapeOf(inUp, inHoles), .02); inUpG.translate(0, 0, zIn);
    const stub = new THREE.Group(), upper = new THREE.Group();
    stub.add(M(stubG, M_.skin)); for (const g of inStub) stub.add(M(g, M_.panel));
    upper.add(M(upG, M_.skin), M(inUpG, M_.panel));
    return { stub, upper, wins, s };
  };
  const wallRec = (name, parts, n, a) => {
    const g = keep(new THREE.Group()); g.name = 'wall-' + name;
    const pivot = keep(new THREE.Group()); pivot.position.y = CUT;
    parts.upper.position.y = -CUT; pivot.add(parts.upper);
    g.add(parts.stub, pivot); body.add(g);
    rv.walls[name] = { group: g, pivot, stub: parts.stub, upper: parts.upper, n, at: a, cut: 0, target: 0, attach: [] };
    return rv.walls[name];
  };
  const R = side(1), L = side(-1);
  wallRec('right', R, V(0, 0, 1), V(0, 1.8, W));
  wallRec('left', L, V(0, 0, -1), V(0, 1.8, -W));
  /* the back wall, with the wide rear window */
  {const rw = [-.85, .85, 1.70, 2.35];
   const mk = (pts, holes, depth) => { const g = extrude(shapeOf(pts, holes), depth); g.rotateY(Math.PI / 2); return g; };
   const stubG = mk([[-W, .46], [W, .46], [W, CUT], [-W, CUT]], [], T); stubG.translate(-4.72, 0, 0);
   const upG = mk([[-W, CUT], [W, CUT], [W, 2.90], [W - .06, 2.98], [-W + .06, 2.98], [-W, 2.90]], [rect(rw)], T); upG.translate(-4.72, 0, 0);
   const inStub = mk([[-W + .05, RV.floor], [W - .05, RV.floor], [W - .05, CUT], [-W + .05, CUT]], [], .02); inStub.translate(-4.69, 0, 0);
   const inUp = mk([[-W + .05, CUT], [W - .05, CUT], [W - .05, RV.ceil], [-W + .05, RV.ceil]], [rect(rw)], .02); inUp.translate(-4.69, 0, 0);
   const stub = new THREE.Group(), upper = new THREE.Group();
   stub.add(M(stubG, M_.skin), M(inStub, M_.panel)); upper.add(M(upG, M_.skin), M(inUp, M_.panel));
   wallRec('rear', { stub, upper }, V(-1, 0, 0), V(-4.72, 1.8, 0));
   rv.parts.rearWin = rw;}

  /* ---------- front: the lower panel, the windshield, the cap (the cap goes with the roof) ---------- */
  const front = keep(new THREE.Group()); body.add(front); rv.parts.front = front;
  front.add(M(loft(FRONT_LOW.concat([[4.72, 1.20], [4.64, 1.36], [4.60, 1.42]]), -W + T, W - T), M_.skin));
  {const [a, b] = [V(4.60, 1.42, 0), V(4.36, 2.42, 0)], dir = b.clone().sub(a), len = dir.length(), mid = a.clone().add(b).multiplyScalar(.5);
   const ang = Math.atan2(dir.y, dir.x);
   const dn = dir.clone().normalize(), nn = V(dn.y, -dn.x, 0);
   const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.3, len), M_.glass); glass.position.copy(mid);
   glass.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, -1), dn, nn));
   glass.renderOrder = 3; front.add(glass); rv.parts.windshield = glass;
   const post = box(front, .05, len, .06, M_.rubber, mid.x, mid.y, 0); post.rotation.z = ang - Math.PI / 2;
   for (const e of [a, b]) { const bar = box(front, .06, .05, 2.36, M_.rubber, e.x, e.y, 0); bar.rotation.z = ang - Math.PI / 2; }
   /* wipers resting at the bottom */
   for (const z of [-.55, .45]) { const w = box(front, .02, .02, .62, M_.dark, 4.63, 1.47, z); w.rotation.set(0, .12, ang - Math.PI / 2); }}
  /* grille, headlights, bumper, markers */
  {const G = front;
   for (const z of [-.33, .33]) { box(G, .03, .28, .56, M_.dark, 4.745, .88, z); for (let k = 0; k < 4; k++) box(G, .035, .02, .54, M_.alu, 4.75, .77 + k * .07, z); }
   for (const s of [-1, 1]) for (const y of [.81, .95]) {
     box(G, .04, .115, .2, M_.alu, 4.74, y, s * .82);
     box(G, .02, .095, .18, M_.head, 4.762, y, s * .82);
   }
   for (const s of [-1, 1]) box(G, .02, .05, .1, M_.amber, 4.80, .55, s * .95);
   box(G, .14, .18, 2.5, M_.tan, 4.79, .52, 0);
   box(G, .02, .05, .36, M_.dark, 4.865, .54, 0);
   rv.lights.headMat = M_.head;}

  /* ---------- the roof, the front cap, what stands on the roof ---------- */
  const roof = keep(new THREE.Group()); roof.name = 'roof'; body.add(roof); rv.roof = { group: roof, k: 0, target: 0 };
  roof.add(M(loft(FRONT_UP.slice(4), -W + T, W - T), M_.skin));
  box(roof, 8.36, .04, 2.42, M_.cream, -.47, 2.96, 0);
  for (const s of [-1, 1]) { const e = cyl(roof, .035, .035, 8.36, M_.cream, -.47, 2.945, s * 1.19, 10); e.rotation.z = Math.PI / 2; }
  {const e = cyl(roof, .035, .035, 2.38, M_.cream, -4.69, 2.945, 0, 10); e.rotation.x = Math.PI / 2;}
  box(roof, 7.9, .012, 2.3, M_.ceiling, -.66, RV.ceil + .006, 0).castShadow = false;
  /* markers on the cap, and on the back */
  for (let i = 0; i < 5; i++) box(roof, .05, .035, .09, M_.amber, 4.05, 2.93, -.5 + i * .25);
  /* two air conditioners, three vents (the middle one smokes during a cook) */
  const ac = (x) => {
    const g = new THREE.Group(); g.position.set(x, 2.98, 0); roof.add(g);
    rbox(g, .78, .26, .74, .08, mat(0xf0ece2, .5), 0, .13, 0);
    rbox(g, .6, .06, .66, .03, mat(0xdcd6ca, .55), 0, .28, 0);
    for (let k = 0; k < 6; k++) box(g, .01, .14, .6, M_.dark, -.3 + k * .12, .12, 0).castShadow = false;
    return g;
  };
  ac(1.75); ac(-3.25);
  rv.parts.vents = [];
  for (const [x, z] of [[.1, .35], [-1.6, -.4], [2.8, -.3]]) {
    const g = new THREE.Group(); g.position.set(x, 2.98, z); roof.add(g);
    box(g, .42, .04, .42, mat(0xe9e5dc, .5), 0, .02, 0);
    const lid = box(g, .36, .03, .36, new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: .4, transparent: true, opacity: .85 }), 0, .1, 0); lid.rotation.x = -.35;
    rv.parts.vents.push(g);
  }
  /* the rear roof rack and the ladder over the back */
  {const rail = M_.alu;
   for (const z of [.62, 1.12]) {
     tube(roof, V(-4.2, 3.12, z), V(-2.55, 3.12, z), .018, rail);
     for (const x of [-4.2, -3.4, -2.55]) tube(roof, V(x, 2.98, z), V(x, 3.12, z), .016, rail);
   }
   for (const x of [-4.2, -2.55]) tube(roof, V(x, 3.12, .62), V(x, 3.12, 1.12), .018, rail);
   const lad = keep(new THREE.Group()); body.add(lad); rv.parts.ladder = lad;
   for (const z of [.72, 1.1]) {
     tube(lad, V(-4.78, .7, z), V(-4.78, 2.98, z), .02, rail);
     tube(lad, V(-4.78, 2.98, z), V(-4.66, 3.14, z), .02, rail);
     tube(lad, V(-4.66, 3.14, z), V(-4.2, 3.14, z), .02, rail);
     tube(lad, V(-4.78, .9, z), V(-4.73, .9, z), .018, rail); tube(lad, V(-4.78, 2.5, z), V(-4.73, 2.5, z), .018, rail);
   }
   for (let y = .8; y < 2.95; y += .3) tube(lad, V(-4.78, y, .72), V(-4.78, y, 1.1), .014, rail);}

  /* ---------- floor, ceiling, wheel wells ---------- */
  box(body, 7.96, .04, 2.36, M_.floor, -.68, RV.floor - .02, 0).castShadow = false;
  box(body, 1.28, .04, 2.36, M_.dark, 3.92, .70, 0).castShadow = false;
  for (const [x0, x1] of [[-4.7, -1.76], [-.54, 2.72], [3.88, 4.72]]) box(body, x1 - x0, .03, 2.38, M_.chassis, (x0 + x1) / 2, .47, 0);
  /* the wheel humps inside, over the rear wells */
  for (const s of [-1, 1]) box(body, 1.26, .17, .3, M_.tan, RV.rearAxle, RV.floor + .07, s * 1.03);
  const well = mat(0x151413, .95); well.side = THREE.DoubleSide;
  for (const [x, r, span] of [[RV.rearAxle, .58, .62], [RV.frontAxle, .55, .42]]) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r - .01, r - .01, span, 20, 1, true, Math.PI / 2, Math.PI), well);
    w.rotation.x = Math.PI / 2; w.position.set(x, .43, s * (RV.halfW - .03 - span / 2)); body.add(w);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r - .01, 20, 0, Math.PI), well); cap.position.set(x, .43, s * (RV.halfW - .03 - span)); body.add(cap);
  }
  /* the footwell under the dash */
  box(body, .5, .4, 2.36, M_.dark, 4.46, .9, 0).castShadow = false;

  /* ---------- outside details on the sides ---------- */
  const R_ = rv.walls.right, L_ = rv.walls.left;
  const att = (w, o) => { w.attach.push(keep(o)); body.add(o); return o; };
  /* window frames, glass, and mini blinds half open */
  const blindMat = mat(0xe8dfc9, .7);
  const winDress = (w, [x0, x1, y0, y1], z, s) => {
    const g = new THREE.Group();
    const f = (a, b, c, d, x, y) => box(g, a, b, c, M_.alu, x, y, z + s * .005);
    f(x1 - x0 + .06, .035, .045, 0, (x0 + x1) / 2, y1 + .015); f(x1 - x0 + .06, .05, .06, 0, (x0 + x1) / 2, y0 - .02);
    f(.035, y1 - y0, .045, 0, x0 - .015, (y0 + y1) / 2); f(.035, y1 - y0, .045, 0, x1 + .015, (y0 + y1) / 2);
    if (x1 - x0 > .7) f(.03, y1 - y0, .04, 0, (x0 + x1) / 2, (y0 + y1) / 2);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), M_.glassDark); gl.position.set((x0 + x1) / 2, (y0 + y1) / 2, z - s * .012); gl.renderOrder = 3; g.add(gl);
    const n = Math.floor((y1 - y0) * .62 / .025);
    for (let i = 0; i < n; i++) { const sl = box(g, x1 - x0 - .02, .003, .024, blindMat, (x0 + x1) / 2, y1 - .03 - i * .025, z - s * .045); sl.rotation.x = s * .55; }
    box(g, x1 - x0, .025, .035, blindMat, (x0 + x1) / 2, y1 - .02 - n * .025, z - s * .045);
    return att(w, g);
  };
  WIN.right.forEach(r => winDress(R_, r, W, 1)); WIN.left.forEach(r => winDress(L_, r, -W, -1));
  for (const s of [-1, 1]) {
    const w = s > 0 ? R_ : L_, z = s * W;
    const g = new THREE.Group();
    const gl = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(CAB)), M_.glassDark); gl.position.z = z - s * .012; gl.renderOrder = 3; g.add(gl);
    for (let i = 0; i < CAB.length; i++) { const a = CAB[i], b = CAB[(i + 1) % CAB.length]; tube(g, V(a[0], a[1], z + s * .005), V(b[0], b[1], z + s * .005), .02, M_.rubber); }
    att(w, g);
  }
  {const rw = rv.parts.rearWin, rear = rv.walls.rear;
   const g = new THREE.Group();
   const gl = new THREE.Mesh(new THREE.PlaneGeometry(rw[1] - rw[0], rw[3] - rw[2]), M_.glassDark); gl.rotation.y = -Math.PI / 2; gl.position.set(-4.708, (rw[2] + rw[3]) / 2, 0); gl.renderOrder = 3; g.add(gl);
   for (const z of [-.28, .28]) box(g, .045, rw[3] - rw[2], .035, M_.alu, -4.73, (rw[2] + rw[3]) / 2, z);
   box(g, .05, .04, rw[1] - rw[0] + .06, M_.alu, -4.73, rw[3] + .02, 0); box(g, .06, .05, rw[1] - rw[0] + .06, M_.alu, -4.73, rw[2] - .02, 0);
   att(rear, g);}

  /* basement doors, vents, markers, the step */
  const panel = (x, y, len, h, z, s) => {
    const g = new THREE.Group();
    rbox(g, len, h, .025, .012, M_.cream, x, y, z + s * .012);
    box(g, .08, .03, .03, M_.chrome, x + len / 2 - .12, y, z + s * .03);
    body.add(g); return g;
  };
  for (const s of [-1, 1]) {
    const w = s > 0 ? R_ : L_, z = s * W;
    for (const [x, len] of [[-4.1, .8], [-3.1, .8], [.2, .9], [1.2, s > 0 ? 0 : .9], [2.2, .5]]) if (len) panel(x, .66, len, .3, z, s);
    const mk = new THREE.Group(); for (const x of [-4.55, -.35, 4.1]) box(mk, .06, .035, .02, M_.amber, x, 1.07, z + s * .012);
    att(w, mk);
  }
  /* the louvered vents on the door side (the fridge) */
  {const g = new THREE.Group();
   for (const [y, h] of [[1.55, .32], [2.45, .22]]) { box(g, .46, h, .02, mat(0xdcd2bc, .7), -2.52, y, W + .012); for (let k = 0; k < Math.round(h / .035); k++) box(g, .42, .008, .03, M_.dark, -2.52, y - h / 2 + .02 + k * .035, W + .02); }
   att(R_, g);}
  /* the awning, rolled up on the door side */
  {const g = new THREE.Group();
   const roll = cyl(g, .065, .065, 6.9, mat(0xe6dfcf, .55), -.55, 2.87, W + .1, 14); roll.rotation.z = Math.PI / 2;
   for (const x of [-3.95, 2.85]) { tube(g, V(x, 2.87, W + .1), V(x, 1.25, W + .03), .018, M_.alu); box(g, .05, .1, .05, M_.alu, x, 1.22, W + .02); }
   att(R_, g); rv.parts.awning = g;}
  /* side mirrors on arms at the front corners */
  rv.parts.mirrors = {};
  for (const s of [-1, 1]) {
    const g = keep(new THREE.Group()); body.add(g);
    tube(g, V(4.28, 1.9, s * 1.2), V(4.38, 1.95, s * 1.44), .016, M_.chrome);
    tube(g, V(4.28, 1.5, s * 1.2), V(4.38, 1.55, s * 1.44), .016, M_.chrome);
    tube(g, V(4.38, 1.5, s * 1.44), V(4.38, 2.0, s * 1.44), .016, M_.chrome);
    const head = new THREE.Group(); head.position.set(4.4, 1.76, s * 1.46); g.add(head);
    rbox(head, .06, .36, .24, .03, M_.cream, 0, 0, 0);
    box(head, .01, .32, .2, mat(0x9fb0b8, .05, .9), .031, 0, 0);
    rv.parts.mirrors[s > 0 ? 'right' : 'left'] = { group: g, head };
  }
  /* tail lights, the back markers, the plate */
  for (const s of [-1, 1]) { box(body, .03, .2, .14, M_.red, -4.735, .82, s * 1.08); box(body, .03, .1, .14, mat(0xf2f0ea, .2), -4.735, .66, s * 1.08); }
  for (const z of [-.2, 0, .2]) box(roof, .03, .035, .08, M_.red, -4.72, 2.88, z);
  rv.plateMat = new THREE.MeshStandardMaterial({ map: TX.plateTex('GRT 600'), roughness: .45, metalness: .3 });
  rv.plateFront = new THREE.Mesh(new THREE.PlaneGeometry(.31, .155), rv.plateMat); rv.plateFront.position.set(4.873, .52, -.6); rv.plateFront.rotation.y = Math.PI / 2; body.add(rv.plateFront);
  rv.plateBack = new THREE.Mesh(new THREE.PlaneGeometry(.31, .155), rv.plateMat); rv.plateBack.position.set(-4.745, .66, -.62); rv.plateBack.rotation.y = -Math.PI / 2; body.add(rv.plateBack);
  box(body, .16, .14, 2.46, M_.chassis, -4.8, .5, 0);
  /* the exhaust and the chassis under the skirt */
  {const e = cyl(body, .045, .045, .6, M_.alu, -4.6, .42, .6, 10); e.rotation.z = Math.PI / 2;
   for (const z of [-.46, .46]) box(body, 9.2, .18, .1, M_.chassis, -.05, .38, z);
   box(body, 1.1, .34, .7, M_.chassis, .9, .44, -.3);}

  /* ---------- the entry door ---------- */
  buildDoor(body);
  rv.walls.right.attach.push(rv.door.pivot);
  rv.walls.right.attach.push(rv.parts.mirrors.right.group); rv.walls.left.attach.push(rv.parts.mirrors.left.group);

  /* ---------- wheels ---------- */
  const wheel = (x, z, dual, steer) => {
    const g = keep(new THREE.Group()); g.position.set(x, RV.wheelR, z); body.add(g);
    const spin = keep(new THREE.Group()); g.add(spin);
    const s = Math.sign(z);
    const tire = (off) => {
      const t = M(new THREE.CylinderGeometry(RV.wheelR, RV.wheelR, .23, 28), M_.tire); t.rotation.x = Math.PI / 2; t.position.z = off; spin.add(t);
      const sw = M(new THREE.TorusGeometry(RV.wheelR - .06, .05, 8, 28), M_.tire); sw.position.z = off + s * .09; spin.add(sw);
    };
    tire(0); if (dual) tire(-s * .25);
    const rim = cyl(spin, .25, .25, .02, dual ? M_.chrome : M_.alu, 0, 0, s * .118, 24); rim.rotation.x = Math.PI / 2;
    const hub = cyl(spin, .1, .13, .08, M_.chrome, 0, 0, s * .15, 16); hub.rotation.x = Math.PI / 2;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const n = cyl(spin, .018, .018, .03, M_.chrome, Math.cos(a) * .17, Math.sin(a) * .17, s * .135, 6); n.rotation.x = Math.PI / 2; }
    const rec = { group: g, spin, steer, x, z }; rv.wheels.push(rec); return rec;
  };
  wheel(RV.frontAxle, 1.06, false, true); wheel(RV.frontAxle, -1.06, false, true);
  wheel(RV.rearAxle, 1.06, true, false); wheel(RV.rearAxle, -1.06, true, false);

  /* ---------- lights that can come on ---------- */
  rv.lights.cabin = new THREE.PointLight(0xffc98a, 0, 7, 2); rv.lights.cabin.position.set(-1.5, 2.55, 0); body.add(rv.lights.cabin);
  rv.lights.lab = new THREE.PointLight(0xfff0d8, 0, 5, 2); rv.lights.lab.position.set(-2.8, 2.5, -.4); body.add(rv.lights.lab);
  rv.lights.heads = [-1, 1].map(s => {
    const l = new THREE.SpotLight(0xfff1d6, 0, 70, .42, .5, 1.6); l.position.set(4.8, .9, s * .82); l.target.position.set(18, -.3, s * 1.2);
    body.add(l, l.target); return l;
  });

  hotspot(root, { title: 'The Krystal Ship', text: 'A 1986 Fleetwood Bounder, 31 feet. Jesse bought it with Walt’s savings; Walt turned it into a lab. Zoom in close to look inside.' });
  app.onUpdate(updateRV, 15);
  return rv;
}

/* ---------- the door: hinged at its front edge, opens outward; bullet holes, tape ---------- */
function buildDoor(body) {
  const d = RV.door, M_ = rv.mats, w = d.x1 - d.x0 - .02, h = d.y1 - d.y0 - .02;
  const pivot = keep(new THREE.Group()); pivot.position.set(d.x1 - .01, d.y0 + .01, RV.halfW - .005); body.add(pivot);
  const leaf = new THREE.Group(); pivot.add(leaf);
  const shape = shapeOf([[-w, 0], [0, 0], [0, h], [-w, h]], [rect([-w + .12, -.14, h - .52, h - .1])]);
  const g = extrude(shape, .045, d.y0 + .01, d.x1); g.translate(0, 0, -.045);
  leaf.add(M(g, M_.skin));
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - .26, .42), M_.glassDark); gl.position.set(-w / 2 - .01, h - .31, -.02); gl.renderOrder = 3; leaf.add(gl);
  box(leaf, .1, .04, .05, M_.chrome, -w + .09, h * .5, .025);
  cyl(leaf, .02, .02, .04, M_.chrome, -w + .07, h * .5 - .06, .03, 10).rotation.x = Math.PI / 2;
  /* bullet holes from the pilot, and the tape over them in season 3 */
  const holes = keep(new THREE.Group()), tape = keep(new THREE.Group()); leaf.add(holes, tape);   /* kept out of the merge: they show per stop */
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: .9 }), ringMat = mat(0x8a8274, .5, .5), tapeMat = mat(0x8c8e8f, .55, .1);
  [[-.2, 1.38], [-.34, 1.52], [-.46, 1.3], [-.28, 1.18], [-.52, 1.6]].forEach(([x, y], i) => {
    const r = new THREE.Mesh(new THREE.CircleGeometry(.018, 12), ringMat); r.position.set(x, y, .0015); holes.add(r);
    const c = new THREE.Mesh(new THREE.CircleGeometry(.011, 10), holeMat); c.position.set(x, y, .002); holes.add(c);
    const t = box(tape, .11, .07, .004, tapeMat, x + .005, y, .003); t.rotation.z = (i % 3 - 1) * .35;
  });
  holes.visible = false; tape.visible = false;
  rv.door = { pivot, leaf, holes, tape, angle: 0, target: 0, open: 0 };
  /* the step well inside, and the step that folds out */
  box(body, .66, .03, .34, M_.tan, (d.x0 + d.x1) / 2, .68, RV.halfW - .2);
  box(body, .66, .18, .02, M_.dark, (d.x0 + d.x1) / 2, .77, RV.halfW - .37);
  rv.door.step = box(body, .6, .04, .3, M_.alu, (d.x0 + d.x1) / 2, .34, RV.halfW + .12);
  hotspot(pivot, { title: 'The door', text: () => rv.door.target > .5 ? 'Open. Click to shut it.' : 'The only way in. Click to open it.', action: () => setDoor(rv.door.target < .5) });
  hitBox(pivot, .75, 1.95, .12, -.35, .95, 0);
}

export function setDoor(open) { rv.door.target = open ? 1 : 0; app.emit(open ? 'rv:door:open' : 'rv:door:shut'); }

/* ---------- per frame: the door, the wheels, the lights ---------- */
function updateRV(dt) {
  const D = rv.door;
  if (D) {
    const was = D.open;
    D.open = D.target > D.open ? Math.min(D.target, D.open + dt / .7) : Math.max(D.target, D.open - dt / .6);
    D.pivot.rotation.y = easeInOut(D.open) * 1.75;
    if (was > .02 && D.open <= .02 && D.target === 0) app.emit('rv:door:closed');
  }
}
