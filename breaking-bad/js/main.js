import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { app } from './app.js';
import { patchChunks, patchScene } from './lib/shading.js';
import { buildSky, sky } from './world/sky.js';
import { buildLighting, tod, setHour, markEnvDirty } from './world/lighting.js';
import { stops, openStop } from './world/stops.js';
import { buildPost, renderFrame, resizePost, post } from './fx/post.js';
import { initialTier, applyTier, watchFrames, shadowSizeFor, quality, mergeStatic } from './perf.js';
import { buildRV, rv, setDoor } from './rv/rv.js';
import { buildLab, lab, setCook } from './rv/lab.js';
import { updateCutaway, cutaway } from './rv/cutaway.js';
import { buildCast, cast, stage } from './cast/cast.js';
import { buildScenes, scenes } from './cast/scenes.js';
import { updateCamera, flyTo, jumpTo, resolve, readHash, writeHash, onResize, view, cancelFlight } from './ctrl/camera.js';
import { buildInteract } from './ctrl/interact.js';
import { buildWalk, walk } from './ctrl/walk.js';
import { buildDrive, drive } from './rv/drive.js';
import { buildCinema, cinema } from './ctrl/cinema.js';
import { buildShoot, setShoot, shoot } from './world/shoot.js';
import { updateBubbles } from './ui/bubbles.js';
import { buildUI, photo } from './ui/ui.js';
import { buildParticles, emit } from './fx/particles.js';
import { buildDust } from './fx/dust.js';
import { setSound, audio } from './audio.js';

/* ---------- renderer / scenes / cameras ---------- */
patchChunks();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: app.params.has('shot') });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = false;
document.getElementById('app').appendChild(renderer.domElement);
app.renderer = renderer;
app.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const tier = initialTier();
app.shadowSize = shadowSizeFor(tier);

const scene = new THREE.Scene(); app.scene = scene;
const farScene = new THREE.Scene(); app.farScene = farScene;
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .1, 6000); app.camera = camera;
app.farCamera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 150, 160000);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement); app.controls = controls;
controls.enableDamping = true; controls.dampingFactor = .06;
controls.autoRotateSpeed = -.3;
controls.minDistance = 1.5; controls.maxDistance = 900;
controls.maxPolarAngle = 1.54; controls.zoomSpeed = .9;
controls.addEventListener('start', () => { app.lastInput = app.time; cancelFlight(); view.moved = true; });
controls.addEventListener('end', () => { app.lastInput = app.time; writeHash(); });
renderer.domElement.addEventListener('wheel', () => { app.lastInput = app.time; }, { passive: true });

app.root = new THREE.Group(); scene.add(app.root);
app.noAO = [];

/* ---------- build ---------- */
buildSky(farScene);
buildLighting(farScene);
buildRV();
buildLab();
buildParticles();
buildDust();
buildCast();
buildScenes();
buildShoot();
/* groups that move or hide as one merge inside themselves: fewer draw calls */
{let n = 0; const mg = o => { if (o) n += mergeStatic(o).removed; };
 for (const w of Object.values(rv.walls)) { mg(w.stub); mg(w.upper); w.attach.forEach(mg); }
 mg(rv.roof.group); mg(rv.parts.front); mg(rv.parts.ladder); mg(rv.door.leaf);
 for (const m of Object.values(rv.parts.mirrors)) mg(m.group);
 for (const w of rv.wheels) mg(w.spin);
 rv.body.getObjectByName('lab').children.forEach(mg);
 mg(lab.gear.row);
 mg(rv.body);
 /* a figure's head and arms move and its apron comes and goes: only the torso merges */
 for (const p of Object.values(cast)) for (const r of Object.values(p.variants)) {
   mg(r.head);
   for (const o of [r.head, r.armL.sh, r.armR.sh, ...(r.apron ?? [])]) o.userData.keep = true;
   mg(r.torso?.parent);
 }
 app.merged = n;}
buildPost();
applyTier(tier);
buildInteract();
buildWalk();
buildDrive();
buildCinema();
buildUI();

/* ---------- loop ---------- */
let ready = false, last = performance.now();
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
  updateCutaway(dt);
  if (!draw) return;
  renderer.info.reset();
  renderFrame(dt);
  updateBubbles();
}
function frame(now = performance.now()) {
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max(now - last, 0) / 1000, .05); last = now;
  if (!app.place) return;
  tick(dt);
  watchFrames(dt);
  if (!ready) { ready = true; window.__aptReady = true; app.emit('ready'); }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); resizePost(); onResize();
});

/* ---------- where to start ---------- */
const start = readHash(), startStop = start.stop ?? app.params.get('stop');
const status = document.getElementById('loader-status');
openStop(['pilot', 'days', 'sunset'].includes(startStop) ? startStop : 'pilot', { instant: true, hour: start.t != null ? parseFloat(start.t) : null }).then(() => {
  app.materials = [...new Set([...app.materials, ...patchScene(scene), ...patchScene(farScene)])];
  if (start.shoot) setShoot(true);
  if (start.v) jumpTo(start.v);
  else {
    /* the opening: from high over the mesas, down to the RV */
    const r = resolve('overview');
    const from = r.pos.clone().sub(r.target).multiplyScalar(9).add(r.target); from.y += 140;
    camera.position.copy(from); controls.target.copy(r.target);
    if (app.reducedMotion || app.clean || app.params.has('still')) jumpTo('overview'); else flyTo('overview', 4.2);
  }
  controls.update();
  frame();
}).catch(e => { console.error(e); status.textContent = 'The desert did not load: ' + e.message; document.documentElement.classList.add('failed'); });

if (app.debug) {
  /* step(seconds) runs the world at 30 fps and draws the last frame: a background tab gets no animation frames */
  const step = (sec = 1, fps = 30) => { const n = Math.max(1, Math.round(sec * fps)); for (let i = 0; i < n; i++) tick(1 / fps, i === n - 1); return app.time; };
  window.apt = { app, THREE, tod, setHour, sky, post, quality, applyTier, step, openStop, stops, rv, setDoor, lab, setCook, cutaway, cast, stage, scenes,
    flyTo, jumpTo, resolve, walk, drive, cinema, setShoot, shoot, photo, setSound, audio, markEnvDirty,
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, tier: quality.tier }) };
}
