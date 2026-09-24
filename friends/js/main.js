import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { app } from './app.js';
import { initMaterials } from './lib/materials.js';
import { buildPlan, doors } from './world/plan.js';
import { finalizeWalls, updateWalls, walls, mergeDecor } from './world/walls.js';
import { buildHallway } from './world/hallway.js';
import { buildMonica } from './world/monica.js';
import { buildMonicaRooms } from './world/monicaRooms.js';
import { buildGuys } from './world/guys.js';
import { buildGuysRooms } from './world/guysRooms.js';
import { buildScreens } from './world/screens.js';
import { buildLighting, tod, setHour } from './world/lighting.js';
import { buildStage, setStage, studio } from './world/stage.js';
import { buildCast, cast } from './cast/cast.js';
import { buildPivot, pivot } from './cast/pivot.js';
import { buildPets } from './cast/pets.js';
import { buildParticles } from './fx/particles.js';
import { buildPost, renderFrame, resizePost, post } from './fx/post.js';
import { mergeStatic, initialTier, applyTier, watchFrames, shadowSizeFor, quality } from './perf.js';
import { updateCamera, flyTo, jumpTo, resolve, readHash, writeHash, onResize, view, cancelFlight } from './ctrl/camera.js';
import { updateCutaway } from './ctrl/cutaway.js';
import { buildWalk, walk } from './ctrl/walk.js';
import { buildInteract } from './ctrl/interact.js';
import { buildSitcom, sitcom } from './ctrl/sitcom.js';
import { updateBubbles } from './ui/bubbles.js';
import { buildUI, photo } from './ui/ui.js';
import { setSound } from './audio.js';

/* ---------- renderer / scene / camera ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: app.params.has('shot') });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);
app.renderer = renderer;
app.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const tier = initialTier();
app.shadowSize = shadowSizeFor(tier);

const scene = new THREE.Scene(); app.scene = scene;
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 260); app.camera = camera;
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement); app.controls = controls;
controls.enableDamping = true; controls.dampingFactor = .06;
controls.autoRotateSpeed = -.35;
controls.minDistance = 1.2; controls.maxDistance = 110;
controls.minPolarAngle = 0; controls.maxPolarAngle = 1.52;
controls.zoomSpeed = .9;
controls.addEventListener('start', () => { app.lastInput = app.time; cancelFlight(); view.moved = true; });
controls.addEventListener('end', () => { app.lastInput = app.time; writeHash(); });
renderer.domElement.addEventListener('wheel', () => { app.lastInput = app.time; }, { passive: true });

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

/* ---------- build the world ---------- */
app.root = new THREE.Group(); app.static = new THREE.Group();
app.root.add(app.static); scene.add(app.root);
app.noAO = [];

initMaterials();
buildPlan();
buildHallway();
buildMonica();
buildMonicaRooms();
buildGuys();
buildGuysRooms();
buildScreens();
finalizeWalls();
app.noAO.push(app.shadowProxy);
buildLighting();
buildStage();
buildCast();
buildPivot();
buildPets();
buildParticles();

/* groups that move or hide as one still merge inside themselves: fewer draw calls */
{let inner = 0;
 const m = o => { if (o) inner += mergeStatic(o).removed; };
 mergeDecor(m);
 for (const w of walls) for (const a of w.attach) if (!a.userData.merged) m(a);
 for (const d of Object.values(doors)) m(d.leaf);
 for (const f of Object.values(app.fridges)) { m(f.group); m(f.pivot.children[0]); }
 for (const r of Object.values(app.recliners)) { m(r.group); m(r.back); m(r.foot); }
 m(app.foosball.group); for (const r of app.foosball.rods) m(r);
 for (const c of Object.values(cast)) m(c.rig.head);
 m(cast.phoebe.guitar); m(pivot.couch); m(app.dog.group); m(app.dog.head);
 for (const l of app.lamps) m(l.group);
 for (const tv of Object.values(app.tvs)) m(tv.mesh.parent);
 app.innerMerged = inner;}
const merged = mergeStatic(app.static);

/* every standard material, so the time of day can dim their reflections */
{const seen = new Set();
 scene.traverse(o => { const m = o.material; for (const x of Array.isArray(m) ? m : m ? [m] : []) if (x.isMeshStandardMaterial) seen.add(x); });
 app.materials = [...seen];}

buildPost();
applyTier(tier);
buildWalk();
buildInteract();
buildSitcom();
buildUI();

/* ---------- where to start ---------- */
const start = readHash();
if (start.t != null && !Number.isNaN(parseFloat(start.t))) setHour(parseFloat(start.t));
else setHour(tod.hour);
if (start.stage) setStage(true);
if (start.c) { controls.target.copy(start.c.target); camera.position.copy(start.c.pos); view.moved = true; }
else if (start.v) { const r = resolve(start.v); camera.position.copy(r.pos); controls.target.copy(r.target); view.name = start.v; app.emit('view', start.v); }
else if (start.stage) jumpTo('studio');
else {
  const r = resolve('overview');
  const from = r.pos.clone().sub(r.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), .5).multiplyScalar(1.55).add(r.target);
  from.y += 3;
  camera.position.copy(from); controls.target.copy(r.target);
  if (app.reducedMotion || app.clean) jumpTo('overview'); else flyTo('overview', 2.8);
}
if (start.sitcom) sitcom.enter();
controls.update();

/* the opening gag: once the camera settles, Ross calls for help with his new sofa */
if (!app.reducedMotion && !app.clean && !app.params.has('still')) setTimeout(() => { if (pivot.state === 'idle') pivot.trigger(); }, 3600);

/* ---------- a thud on the stairs shakes the model ---------- */
let shake = 0;
app.on('shake', k => { if (!app.reducedMotion) shake = k ?? .04; });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); resizePost(); onResize();
});

/* ---------- loop ---------- */
let ready = false, last = performance.now();
/* one failing updater must not stop the frame; the error shows on the page (index.html) and in the console */
const failed = new Set();
function runUpdaters(dt) {
  for (const u of app._updaters) {
    try { u.fn(dt); }
    catch (e) { if (!failed.has(u)) { failed.add(u); console.error(e); dispatchEvent(new ErrorEvent('error', { message: e.message, error: e })); } }
  }
}
function tick(dt, draw = true) {
  app.time += dt;
  runUpdaters(dt);
  updateCamera(dt);
  updateCutaway();
  updateWalls(dt);
  if (shake > .001) { app.root.position.set((Math.random() - .5) * shake, (Math.random() - .5) * shake * .6, 0); shake *= Math.exp(-9 * dt); }
  else if (app.root.position.lengthSq() > 0) app.root.position.set(0, 0, 0);
  if (!draw) return;
  renderFrame(dt);
  updateBubbles();
}
function frame(now = performance.now()) {
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max(now - last, 0) / 1000, .05); last = now;
  tick(dt);
  watchFrames(dt);
  if (!ready) { ready = true; window.__aptReady = true; app.emit('ready'); }
}
frame();

if (app.debug) {
  /* step(seconds) runs the world at 30 fps and draws the last frame: a background tab gets no animation frames */
  const step = (sec = 1, fps = 30) => { const n = Math.max(1, Math.round(sec * fps)); for (let i = 0; i < n; i++) tick(1 / fps, i === n - 1); return app.time; };
  window.apt = { app, THREE, cast, pivot, doors, flyTo, jumpTo, setStage, sitcom, walk, tod, setHour, quality, applyTier, post, studio, photo, setSound, merged, step,
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, tier: quality.tier }) };
}
