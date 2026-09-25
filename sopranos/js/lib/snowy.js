import * as THREE from 'three';
import { NOISE_GLSL } from './noise.js';
import { objects } from '../world/lighting.js';

/* Snow that settled on a thing: every face that looks up turns white, a little lumpy at the edge. amount 0..1,
   depth pushes the upper faces up (a cap of snow on a rock). Works on plain and instanced standard materials. */
export function snowy(m, { amount = 1, edge = .55, soft = .25, lift = 0, tint = 0xeef2f7 } = {}) {
  const prev = m.onBeforeCompile;
  const u = { uSnowAmt: { value: amount }, uSnowTint: { value: new THREE.Color(tint) } };
  m.userData.snow = u;
  const own = !prev || prev === THREE.Material.prototype.onBeforeCompile;
  if (own) m.defines = { ...(m.defines || {}), BB_SUN: '' };
  m.onBeforeCompile = (sh, r) => {
    if (!own) prev.call(m, sh, r);
    else { sh.uniforms.bbSunVis = objects.sunVis; sh.fragmentShader = 'uniform float bbSunVis;\n' + sh.fragmentShader; }
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnN; varying vec3 vSnW;')
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        #ifdef USE_INSTANCING
        vSnN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
        vSnN = normalize(mat3(modelMatrix) * objectNormal);
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${lift > 0 ? `transformed += objectNormal * max(0., objectNormal.y) * ${lift.toFixed(3)};` : ''}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
        vSnW = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;
        #else
        vSnW = (modelMatrix * vec4(transformed, 1.)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE_GLSL + '\nvarying vec3 vSnN; varying vec3 vSnW; uniform float uSnowAmt; uniform vec3 uSnowTint;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float n = bbNoise(vSnW.xz * 5.3 + vSnW.y * 2.1) * .3 + bbNoise(vSnW.xz * 19.) * .12;
          float k = smoothstep(${edge.toFixed(3)} - ${soft.toFixed(3)}, ${edge.toFixed(3)} + ${soft.toFixed(3)} * .5, normalize(vSnN).y + n - .2) * uSnowAmt;
          diffuseColor.rgb = mix(diffuseColor.rgb, uSnowTint, k); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, .8, smoothstep(${edge.toFixed(3)}, 1., normalize(vSnN).y) * uSnowAmt);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0., smoothstep(${edge.toFixed(3)}, 1., normalize(vSnN).y) * uSnowAmt);`);
  };
  const key = own ? null : m.customProgramCacheKey?.bind(m);
  /* edge, soft and lift are written into the shader, so each set is its own program */
  m.customProgramCacheKey = () => (key ? key() : 'bbObj') + `snow${edge}/${soft}/${lift}`;
  m.userData.bbPatched = true;
  m.needsUpdate = true;
  return m;
}
