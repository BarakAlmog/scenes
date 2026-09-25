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
  render(renderer, writeBuffer, readBuffer) { this.fn(renderer, readBuffer); }
}

/* The far world first, with its own near and far planes: the sky, the stars, the far ring and the skyline out to
   60 km. Then the depth is cleared and the near world is drawn over it with a tight depth range. */
class FarPass extends Pass {
  constructor() { super(); this.needsSwap = false; }
  render(renderer, writeBuffer, readBuffer) {
    const c = app.camera, f = app.farCamera;
    f.position.copy(c.position); f.quaternion.copy(c.quaternion);
    if (f.fov !== c.fov || f.aspect !== c.aspect) { f.fov = c.fov; f.aspect = c.aspect; f.updateProjectionMatrix(); }
    f.updateMatrixWorld();
    renderer.setRenderTarget(readBuffer);
    renderer.clear(true, true, true);
    renderer.render(app.farScene, f);
  }
}

/* last pass, in display space: warmth, vignette, grain, and cinema mode (2.39:1, a film grade) */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uAspect: { value: 1 },
    uVignette: { value: .2 }, uGrain: { value: .02 }, uCinema: { value: 0 }, uWarm: { value: .5 }, uBars: { value: 0 },
    uFade: { value: 0 }, uFlash: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uAspect, uVignette, uGrain, uCinema, uWarm, uBars, uFade, uFlash; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      col *= mix(vec3(1.), vec3(1.03, 1., .96), uWarm);
      if (uCinema > .001) {
        /* a film look: lifted blacks, warm highlights, teal in the shadows, a little more contrast */
        float l = dot(col, vec3(.2126, .7152, .0722));
        vec3 g = mix(col * vec3(.94, 1.0, 1.04), col * vec3(1.06, 1.0, .9), smoothstep(.15, .75, l));
        g = mix(vec3(l), g, 1.12);
        g = smoothstep(-.04, 1.02, g);
        g = g * .95 + .02;
        col = mix(col, g, uCinema);
      }
      vec2 d = (uv - .5) * vec2(uAspect, 1.);
      col *= mix(1., smoothstep(1.15, .2, length(d)), uVignette * (1. + .6 * uCinema));
      col += (hash(uv * uRes + fract(uTime * 7.) * 100.) - .5) * uGrain * (1. + 1.2 * uCinema);
      /* letterbox bars */
      if (uBars > .001) {
        float ta = 2.39;
        float m = uAspect < ta ? step(uAspect / ta, abs(uv.y - .5) * 2.) : step(ta / uAspect, abs(uv.x - .5) * 2.);
        col = mix(col, vec3(0.), m * uBars);
      }
      col = mix(col, vec3(0.), uFade);
      col = mix(col, vec3(1.), uFlash);
      gl_FragColor = vec4(col, 1.);
    }`,
};

export const post = { composer: null, gtao: null, bloom: null, smaa: null, outline: null, grade: null };

/* objects that must be drawn in the beauty pass but kept out of AO and outline depth */
const hideForAO = on => { for (const o of app.noAO) o.visible = on; };

export function buildPost() {
  const r = app.renderer, size = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
  const w = size.x * pr, h = size.y * pr;
  const type = THREE.HalfFloatType;
  const composer = new EffectComposer(r, new THREE.WebGLRenderTarget(w, h, { type }));
  composer.addPass(new FarPass());
  composer.addPass(new HookPass((renderer, readBuffer) => {
    hideForAO(true);
    renderer.setRenderTarget(readBuffer); renderer.clearDepth();
    renderer.shadowMap.needsUpdate = true;
  }));
  const main = new RenderPass(app.scene, app.camera); main.clear = false;
  composer.addPass(main);
  composer.addPass(new HookPass(() => hideForAO(false)));
  /* the sun's glints on chrome and glass can pass the half-float limit; clamp them before the blur passes */
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb = clamp(c.rgb, 0., 160.); if (any(isnan(c.rgb))) c.rgb = vec3(0.); gl_FragColor = vec4(c.rgb, 1.); }`,
  }));

  const gtao = new GTAOPass(app.scene, app.camera, w, h);
  gtao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.4, thickness: 1.4, scale: 1.1, samples: 16, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
  gtao.blendIntensity = .85;
  composer.addPass(gtao);

  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), .32, .55, 1.6);
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

  Object.assign(post, { composer, gtao, bloom, smaa, outline, grade, main });
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
