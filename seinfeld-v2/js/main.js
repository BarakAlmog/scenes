import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { app } from './app.js';
import { initMaterials } from './lib/materials.js';
import { buildApartment, doors } from './world/apartment.js';
import { finalizeWalls, updateWalls } from './world/walls.js';
import { buildLiving } from './world/living.js';
import { buildKitchen } from './world/kitchen.js';
import { buildBackRooms } from './world/backrooms.js';
import { buildLighting, tod, setHour } from './world/lighting.js';
import { buildStage, setStage, studio } from './world/stage.js';
import { buildCast, cast } from './cast/cast.js';
import { buildKramer, kramer } from './cast/kramer.js';
import { buildParticles } from './fx/particles.js';
import { buildPost, renderFrame, resizePost, post } from './fx/post.js';
import { mergeStatic, initialTier, applyTier, watchFrames, shadowSizeFor, quality } from './perf.js';
import { updateCamera, flyTo, jumpTo, resolve, readHash, writeHash, onResize, view, cancelFlight } from './ctrl/camera.js';
import { updateCutaway } from './ctrl/cutaway.js';
import { buildWalk, walk } from './ctrl/walk.js';
import { buildInteract } from './ctrl/interact.js';
import { buildSitcom, sitcom } from './ctrl/sitcom.js';
import { hotspot } from './ctrl/hotspots.js';
import { updateBubbles } from './ui/bubbles.js';
import { buildUI, photo } from './ui/ui.js';
import { setSound } from './audio.js';

/* ---------- renderer / scene / camera ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
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
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 220); app.camera = camera;
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement); app.controls = controls;
controls.enableDamping = true; controls.dampingFactor = .06;
controls.autoRotateSpeed = -.45;
controls.minDistance = 1.2; controls.maxDistance = 46;
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
buildApartment();
buildLiving();
buildKitchen();
buildBackRooms();
finalizeWalls();
app.noAO.push(app.shadowProxy);
buildLighting();
buildStage();
buildCast();
buildKramer();
buildParticles();
app.doorCenter = doors.front.center.clone().setY(1.6);

hotspot(doors.front.pivot, { title: 'Apartment 5A', text: 'Kramer lives across the hall, in 5B. Click to let him in.', action: () => kramer.trigger() });
hotspot(app.intercom, { title: 'The buzzer', text: 'Jerry buzzes visitors in from the street.', action: () => app.emit('buzz') });
hotspot(app.windowGroup, { title: 'The window', text: 'Over West 81st Street. Slide the time of day to watch the street light up.' });

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
  const from = r.pos.clone().sub(r.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), .55).multiplyScalar(1.65).add(r.target);
  from.y += 3;
  camera.position.copy(from); controls.target.copy(r.target);
  if (app.reducedMotion || app.clean) jumpTo('overview'); else flyTo('overview', 2.8);
}
if (start.sitcom) sitcom.enter();
controls.update();

/* the opening gag: once the camera settles, Kramer comes through the door */
if (!app.reducedMotion && !app.clean && !app.params.has('seated')) setTimeout(() => { if (kramer.state === 'home') kramer.trigger(); }, 3300);

/* ---------- the door burst shakes the model ---------- */
let shake = 0;
app.on('door:burst', () => { if (!app.reducedMotion) shake = .05; });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); resizePost(); onResize();
});

/* ---------- loop ---------- */
let ready = false, last = performance.now();
function frame(now = performance.now()) {
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max(now - last, 0) / 1000, .05); last = now;
  app.time += dt;
  for (const u of app._updaters) u.fn(dt);
  updateCamera(dt);
  updateCutaway();
  updateWalls(dt);
  if (shake > .001) { app.root.position.set((Math.random() - .5) * shake, (Math.random() - .5) * shake * .6, 0); shake *= Math.exp(-9 * dt); }
  else if (app.root.position.lengthSq() > 0) app.root.position.set(0, 0, 0);
  renderFrame(dt);
  updateBubbles();
  watchFrames(dt);
  if (!ready) { ready = true; window.__aptReady = true; app.emit('ready'); }
}
frame();

if (app.debug) {
  window.apt = { app, THREE, kramer, cast, flyTo, jumpTo, setStage, sitcom, walk, tod, setHour, quality, applyTier, post, studio, photo, setSound, merged,
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, tier: quality.tier }) };
}
