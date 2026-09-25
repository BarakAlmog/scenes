import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { app } from './app.js';
import { patchChunks, patchScene } from './lib/shading.js';
import { buildSky, sky } from './world/sky.js';
import { buildLighting, tod, setHour, markEnvDirty } from './world/lighting.js';
import { SCENES, scenes, openScene } from './scenes.js';
import { buildPost, renderFrame, resizePost, post } from './fx/post.js';
import { initialTier, applyTier, watchFrames, shadowSizeFor, quality } from './perf.js';
import { updateCamera, flyTo, jumpTo, resolve, readHash, writeHash, onResize, view, cancelFlight } from './ctrl/camera.js';
import { buildInteract } from './ctrl/interact.js';
import { buildFPS, fps } from './ctrl/fps.js';
import { updateBubbles } from './ui/bubbles.js';
import { buildUI, photo } from './ui/ui.js';
import { buildParticles, emit } from './fx/particles.js';
import { seq, run, skip } from './seq.js';
import { buildTracks, tracks } from './fx/tracks.js';
import { buildSnow, snowfall } from './fx/snow.js';
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
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .08, 6000); app.camera = camera;
app.farCamera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 150, 200000);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement); app.controls = controls;
controls.enableDamping = true; controls.dampingFactor = .06;
controls.autoRotateSpeed = -.3;
controls.minDistance = 1.2; controls.maxDistance = 900;
controls.maxPolarAngle = 1.54; controls.zoomSpeed = .9;
controls.addEventListener('start', () => { app.lastInput = app.time; cancelFlight(); view.moved = true; });
controls.addEventListener('end', () => { app.lastInput = app.time; writeHash(); });
renderer.domElement.addEventListener('wheel', () => { app.lastInput = app.time; }, { passive: true });

app.root = new THREE.Group(); scene.add(app.root);
app.noAO = [];

/* ---------- build ---------- */
buildSky(farScene);
buildLighting(farScene);
buildParticles();
buildTracks();
buildSnow();
app.globalNoAO = app.noAO.slice();
buildPost();
applyTier(tier);
buildInteract();
buildFPS();
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
  /* a skipped cutscene runs many small steps a frame, on the same clock */
  const n = app.timeScale > 1 ? Math.round(app.timeScale) : 1, h = n > 1 ? 1 / 30 : dt;
  for (let i = 0; i < n; i++) { app.time += h; runUpdaters(h); }
  updateCamera(dt);
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
  if (!ready) { ready = true; window.__aptReady = true; document.body.classList.add('ready'); app.emit('ready'); }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); resizePost(); onResize();
});

/* ---------- where to start ---------- */
const start = readHash(), startScene = start.s ?? app.params.get('s');
const status = document.getElementById('loader-status');
openScene(SCENES.some(s => s.id === startScene) ? startScene : 'pine', { instant: true, hour: start.t != null ? parseFloat(start.t) : null, view: start.v }).then(() => {
  app.materials = [...new Set([...app.materials, ...patchScene(scene), ...patchScene(farScene)])];
  controls.update();
  frame();
}).catch(e => { console.error(e); status.textContent = 'The scene did not load: ' + e.message; document.documentElement.classList.add('failed'); });

if (app.debug) {
  /* step(seconds) runs the world at 30 fps and draws the last frame: a background tab gets no animation frames */
  const step = (sec = 1, fps = 30) => { const n = Math.max(1, Math.round(sec * fps)); for (let i = 0; i < n; i++) tick(1 / fps, i === n - 1); return app.time; };
  window.apt = { app, THREE, tod, setHour, sky, post, quality, applyTier, step, openScene, scenes, SCENES, flyTo, jumpTo, resolve, fps, seq, run, skip,
    photo, setSound, audio, markEnvDirty, emit, tracks, snowfall,
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, tier: quality.tier }) };
}
