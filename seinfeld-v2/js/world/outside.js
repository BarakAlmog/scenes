import * as THREE from 'three';
import * as TX from '../lib/textures.js';

/* The view out of the window: a plane in the opening whose shader traces each pixel
   to a facade across the street, so the parallax is right from any angle and
   nothing needs to exist outside the model. */
const uniforms = {
  tFacade: { value: null }, tLights: { value: null },
  uP0: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3() }, uR: { value: new THREE.Vector3() },
  uDist: { value: 19 }, uSize: { value: new THREE.Vector2(60, 30) }, uFloorY: { value: -14.5 },
  uSkyTop: { value: new THREE.Color(0x9ec5ec) }, uSkyHor: { value: new THREE.Color(0xe9eef0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) }, uDay: { value: 1.2 }, uNight: { value: 0 },
};

const vertexShader = /* glsl */`
varying vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
}`;

const fragmentShader = /* glsl */`
uniform sampler2D tFacade, tLights;
uniform vec3 uP0, uN, uR, uSkyTop, uSkyHor, uSunCol;
uniform vec2 uSize;
uniform float uDist, uFloorY, uDay, uNight;
varying vec3 vWorld;
void main() {
  vec3 V = normalize(vWorld - cameraPosition);
  vec3 sky = mix(uSkyHor, uSkyTop, clamp(V.y * 1.6 + .15, 0., 1.));
  vec3 col = sky;
  float dn = dot(V, uN);
  if (dn > .02) {
    float t = (uDist - dot(vWorld - uP0, uN)) / dn;
    vec3 hit = vWorld + V * t;
    vec2 uv = vec2(dot(hit - uP0, uR) / uSize.x + .5, (hit.y - uFloorY) / uSize.y);
    if (uv.x > 0. && uv.x < 1. && uv.y > 0. && uv.y < 1.) {
      vec4 f = texture2D(tFacade, uv);
      vec3 b = mix(f.rgb * uSunCol * uDay, uSkyHor * .85, .14) + texture2D(tLights, uv).rgb * uNight * 7.;
      col = mix(sky, b, f.a);
    }
  }
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function windowView(w, h) {
  const fac = TX.facade();
  uniforms.tFacade.value = fac.map; uniforms.tLights.value = fac.lights;
  uniforms.uSize.value.set(...fac.size);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader }));
  mesh.userData.keep = true;
  return mesh;
}

/* call once the plane sits in its final place */
export function setViewFrame(mesh) {
  mesh.updateWorldMatrix(true, false);
  const q = mesh.getWorldQuaternion(new THREE.Quaternion());
  uniforms.uP0.value.setFromMatrixPosition(mesh.matrixWorld);
  uniforms.uN.value.set(0, 0, -1).applyQuaternion(q);
  uniforms.uR.value.set(1, 0, 0).applyQuaternion(q);
}

export function setSky({ top, hor, sun, day, night }) {
  uniforms.uSkyTop.value.copy(top); uniforms.uSkyHor.value.copy(hor);
  uniforms.uSunCol.value.copy(sun); uniforms.uDay.value = day; uniforms.uNight.value = night;
}
