import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { app } from '../app.js';

/* runs a function between passes, draws nothing */
class HookPass extends Pass {
  constructor(fn) { super(); this.fn = fn; this.needsSwap = false; }
  render(renderer) { this.fn(renderer); }
}

/* last pass, in display space: warmth, vignette, grain, and the 90s sitcom look */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uAspect: { value: 1 },
    uVignette: { value: .18 }, uGrain: { value: .022 }, uSitcom: { value: 0 }, uWarm: { value: .6 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uAspect, uVignette, uGrain, uSitcom, uWarm; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      if (uSitcom > .001) {
        float o = .0018 * uSitcom;
        vec3 sh = vec3(texture2D(tDiffuse, uv + vec2(o, 0.)).r, col.g, texture2D(tDiffuse, uv - vec2(o, 0.)).b);
        float l = dot(sh, vec3(.299, .587, .114));
        vec3 tv = mix(vec3(l), sh, .82) * .92 + .045;
        tv *= vec3(1.03, 1., .95) * (.95 + .05 * sin(uv.y * uRes.y * 1.5708));
        col = mix(col, tv, uSitcom);
      }
      col *= mix(vec3(1.), vec3(1.025, 1., .975), uWarm);
      vec2 d = (uv - .5) * vec2(uAspect, 1.);
      col *= mix(1., smoothstep(1.1, .22, length(d)), uVignette);
      col += (hash(uv * uRes + fract(uTime * 7.) * 100.) - .5) * uGrain * (1. + uSitcom);
      if (uSitcom > .001) {
        float ta = 4. / 3.;
        float m = uAspect > ta ? step(ta / uAspect, abs(uv.x - .5) * 2.) : step(uAspect / ta, abs(uv.y - .5) * 2.);
        col = mix(col, vec3(0.), m * uSitcom);
      }
      gl_FragColor = vec4(col, 1.);
    }`,
};

export const post = { composer: null, gtao: null, bloom: null, smaa: null, outline: null, grade: null };

/* objects that must be drawn in the beauty pass but kept out of AO and outline depth */
const hideForAO = on => { for (const o of app.noAO) o.visible = on; };

export function buildPost() {
  const r = app.renderer, size = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
  const w = size.x * pr, h = size.y * pr;
  const composer = new EffectComposer(r);
  /* three r160 draws the background quad with the AO pass's override material too; it has
     no normals, so it lands in the AO buffer as a NaN plane at the origin. The background
     is taken away for the AO pass and put back for the next frame. */
  const bg = app.scene.background;
  composer.addPass(new HookPass(renderer => { hideForAO(true); app.scene.background = bg; renderer.shadowMap.needsUpdate = true; }));
  composer.addPass(new RenderPass(app.scene, app.camera));
  composer.addPass(new HookPass(() => { hideForAO(false); app.scene.background = null; }));

  const gtao = new GTAOPass(app.scene, app.camera, w, h);
  gtao.updateGtaoMaterial({ radius: .3, distanceExponent: 1.3, thickness: 1.2, scale: 1.15, samples: 16, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
  gtao.blendIntensity = .95;
  composer.addPass(gtao);

  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), .5, .6, 4.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const outline = new OutlinePass(new THREE.Vector2(w, h), app.scene, app.camera);
  outline.edgeStrength = 4.5; outline.edgeThickness = 1.3; outline.edgeGlow = .6;
  outline.visibleEdgeColor.set(0xffd08a); outline.hiddenEdgeColor.set(0x6a5436);
  composer.addPass(outline);

  const smaa = new SMAAPass(w, h);
  composer.addPass(smaa);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  Object.assign(post, { composer, gtao, bloom, smaa, outline, grade });
  resizePost();
}

export function resizePost() {
  const r = app.renderer, pr = r.getPixelRatio();
  post.composer.setPixelRatio(pr);
  post.composer.setSize(innerWidth, innerHeight);
  post.grade.uniforms.uRes.value.set(innerWidth * pr, innerHeight * pr);
  post.grade.uniforms.uAspect.value = innerWidth / innerHeight;
}

export function renderFrame(dt) {
  post.grade.uniforms.uTime.value = app.time;
  post.composer.render(dt);
}
