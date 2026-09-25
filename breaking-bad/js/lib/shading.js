import * as THREE from 'three';
import { objects } from '../world/lighting.js';

/* One more factor on the sun for every object: the shadow of the mesas and of the clouds where the RV stands.
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
  /* Inside the RV's shell the sky and the ground light reach in only through the windows: a fragment inside the
     box of the interior gets objects.inside of the indirect light. With the roof lifted it is open again. */
  const C = THREE.ShaderChunk;
  C.common += `
#ifdef BB_IN
varying vec3 vBBIn;
#endif
`;
  C.worldpos_vertex += `
#ifdef BB_IN
	{ vec4 bbw = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
		bbw = instanceMatrix * bbw;
	#endif
		vBBIn = ( modelMatrix * bbw ).xyz; }
#endif
`;
  C.lights_fragment_end = `
#if defined( BB_IN ) && defined( RE_IndirectDiffuse )
	{ vec3 bbL = ( bbRV * vec4( vBBIn, 1.0 ) ).xyz;
	  vec3 bbQ = abs( bbL - vec3( -.15, 1.83, 0.0 ) ) - vec3( 4.545, 1.03, 1.175 );
	  float bbIn = step( max( max( bbQ.x, bbQ.y ), bbQ.z ), 0.0 ), bbK = mix( 1.0, bbInside.x, bbIn );
	  /* what reaches in has bounced off the paneling and the floor, not the red desert: less colour */
	  float bbD = bbInside.y * bbIn;
	  irradiance = mix( irradiance, vec3( dot( irradiance, vec3( .3, .59, .11 ) ) ) * vec3( 1.04, 1.0, .93 ), bbD ) * bbK;
	  iblIrradiance = mix( iblIrradiance, vec3( dot( iblIrradiance, vec3( .3, .59, .11 ) ) ) * vec3( 1.04, 1.0, .93 ), bbD ) * bbK;
	#if defined( RE_IndirectSpecular )
	  radiance *= bbK;
	#endif
	}
#endif
` + C.lights_fragment_end;
}

/* a plain material (no onBeforeCompile of its own) gets the shared factor */
export function patchObject(m) {
  if (m.userData.bbPatched || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return m;
  if (!(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return m;
  m.userData.bbPatched = true;
  m.defines = { ...(m.defines || {}), BB_SUN: '', BB_IN: '' };
  m.onBeforeCompile = sh => {
    sh.uniforms.bbSunVis = objects.sunVis; sh.uniforms.bbRV = objects.rvInv; sh.uniforms.bbInside = objects.inside;
    sh.fragmentShader = 'uniform float bbSunVis;\nuniform vec2 bbInside;\nuniform mat4 bbRV;\n' + sh.fragmentShader;
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
