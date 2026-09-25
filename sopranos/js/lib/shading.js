import * as THREE from 'three';
import { objects } from '../world/lighting.js';

/* One more factor on the sun for every object: the shadow of the hills and of the clouds where you stand.
   The ground computes its own per pixel; everything else reads objects.sunVis. Only the first directional
   light (the sun, or the moon at night) takes it. */
export function patchChunks() {
  const key = 'getDirectionalLightInfo( directionalLight, directLight );';
  const src = THREE.ShaderChunk.lights_fragment_begin;
  if (src.includes('bbSunVis')) return;
  if (!src.includes(key)) throw new Error('three.js lights chunk changed: the sun patch did not apply');
  THREE.ShaderChunk.lights_fragment_begin = src.replace(key, key + `
		#ifdef BB_SUN
		if ( UNROLLED_LOOP_INDEX == 0 ) directLight.color *= bbSunVis;
		#endif`);
}

/* a plain material (no onBeforeCompile of its own) gets the shared factor */
export function patchObject(m) {
  if (m.userData.bbPatched || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return m;
  if (!(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return m;
  m.userData.bbPatched = true;
  m.defines = { ...(m.defines || {}), BB_SUN: '' };
  m.onBeforeCompile = sh => {
    sh.uniforms.bbSunVis = objects.sunVis;
    sh.fragmentShader = 'uniform float bbSunVis;\n' + sh.fragmentShader;
  };
  m.customProgramCacheKey = () => 'bbObj';
  m.needsUpdate = true;
  return m;
}

export function patchScene(root) {
  const seen = new Set();
  root.traverse(o => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) if (!seen.has(m)) { seen.add(m); patchObject(m); }
  });
  return seen;
}
