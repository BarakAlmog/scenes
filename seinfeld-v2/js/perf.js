import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { app } from './app.js';
import { post, resizePost } from './fx/post.js';

/* Merge every mesh under root that is not marked keep into one mesh per material.
   Hundreds of draw calls become a few dozen. */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4();
  const groups = new Map(), remove = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent || o.userData.hitOnly) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.keep) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.clearGroups();
    geo.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
    groups.get(key).geos.push(geo);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const { mat, cast, recv, geos } of groups.values()) {
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    geos.forEach(g => g.dispose());
    merged.castShadow = cast; merged.receiveShadow = recv; merged.matrixAutoUpdate = false;
    root.add(merged);
  }
  return { removed: remove.length, meshes: groups.size };
}

/* ---------- quality tiers, stepped down when frames run slow ---------- */
const TIERS = [
  { name: 'low', pr: 1, gtao: false, bloom: false, smaa: true, shadow: 2048 },
  { name: 'medium', pr: 1.25, gtao: false, bloom: true, smaa: true, shadow: 2048 },
  { name: 'high', pr: 1.5, gtao: true, bloom: true, smaa: true, shadow: 4096 },
  { name: 'ultra', pr: 2, gtao: true, bloom: true, smaa: true, shadow: 4096 },
];
export const quality = { tier: 2, locked: false, up: 0 };
let acc = 0, frames = 0, warm = 0;

export function initialTier() {
  const q = app.params.get('q'), i = TIERS.findIndex(t => t.name === q);
  if (i >= 0) { quality.locked = true; return i; }
  return app.touch || Math.min(innerWidth, innerHeight) < 600 ? 1 : 2;
}
export const shadowSizeFor = i => TIERS[i].shadow;

export function applyTier(i) {
  quality.tier = i;
  const t = TIERS[i], r = app.renderer;
  r.setPixelRatio(Math.min(devicePixelRatio, t.pr));
  r.setSize(innerWidth, innerHeight);
  post.gtao.enabled = t.gtao; post.bloom.enabled = t.bloom; post.smaa.enabled = t.smaa;
  const sun = app.lights?.sun;
  if (sun && sun.shadow.mapSize.x !== t.shadow) {
    sun.shadow.mapSize.set(t.shadow, t.shadow);
    sun.shadow.map?.dispose(); sun.shadow.map = null;
  }
  resizePost();
  document.documentElement.dataset.quality = t.name;
}

export function watchFrames(dt) {
  if (quality.locked || document.hidden) return;
  warm += dt; if (warm < 4) return;
  acc += dt; frames++;
  if (acc < 2.5) return;
  const avg = acc / frames; acc = 0; frames = 0;
  if (avg > 1 / 32 && quality.tier > 0) applyTier(quality.tier - 1);
  else if (avg < 1 / 57 && quality.tier < TIERS.length - 1 && quality.up < 1) { quality.up++; applyTier(quality.tier + 1); }
}
