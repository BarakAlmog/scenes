import * as THREE from 'three';
import { NOISE_GLSL } from '../lib/noise.js';
import { TU, terrainMaterials } from './terrain.js';

/* The ground as it is in each scene: fresh snow over rock and a frozen lake (Pine Barrens), a mown lawn (the ducks),
   a lawn under fallen leaves (the bear). It shares the terrain's sun, horizon shadows, sky light and haze.
   A mask texture in world space says where the forest is (R), the lake (G), and how far the nearest plowed road
   is (B, 0..16 m). Footprints come from the tracks map (fx/tracks.js). */
export const GU = {
  tTracks: { value: null }, uTracks: { value: new THREE.Vector4(0, 0, 32, 0) },   /* centre x, z, half size, on */
  uSparkle: { value: 1 },
};

const PARS = /* glsl */`
${NOISE_GLSL}
varying vec3 vBBW; varying vec3 vBBN;
uniform sampler2D tHorA, tHorB, tAO, tHaze, tMask, tTracks, tHole;
uniform vec4 uHole; uniform float uHoleOn;
uniform float uRingHalf, uHorOn, uHorT, uSunSoft, uHazeDensity, uDetail, uTime, uMaskHalf, uMaskOn, uSparkle, uMode;
uniform vec4 uMaskA, uMaskB, uTracks;
uniform vec3 uSunW, uTint;
float bbSunVis, bbAO, bbDet, bbTrack, bbBlood, bbGlint;
vec4 bbMask(vec2 xz) {
  if (uMaskOn < .5) return vec4(1., 0., 1., 0.);
  vec2 muv = (xz + uMaskHalf) / (2. * uMaskHalf);
  if (muv.x < 0. || muv.y < 0. || muv.x > 1. || muv.y > 1.) return vec4(1., 0., 1., 0.);
  return texture2D(tMask, muv);
}
`;

/* hole: { tex, rect: [x0, z0, x1, z1] } cuts the ground away where tex is white (the pool) */
export function groundMaterial({ ringHalf, horizon = null, mask = null, maskHalf = 1, mode = 'snow', far = false, detail = 1, tint = 0xffffff, hole = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: mode === 'snow' ? .78 : .95, metalness: 0, envMapIntensity: 1 });
  const u = {
    uRingHalf: { value: ringHalf }, uHorOn: { value: horizon ? 1 : 0 },
    tHorA: { value: horizon?.dirs[0] ?? null }, tHorB: { value: horizon?.dirs[0] ?? null }, tAO: { value: horizon?.ao ?? null },
    tMask: { value: mask }, uMaskHalf: { value: maskHalf }, uMaskOn: { value: mask ? 1 : 0 },
    uDetail: { value: detail }, uMode: { value: { snow: 0, lawn: 1, leaves: 2 }[mode] ?? 0 }, uTint: { value: new THREE.Color(tint) },
    tHole: { value: hole?.tex ?? null }, uHole: { value: new THREE.Vector4(...(hole?.rect ?? [0, 0, 1, 1])) }, uHoleOn: { value: hole ? 1 : 0 },
  };
  m.userData.u = u; m.userData.horizon = horizon;
  m.defines = { BB_SUN: '' };
  if (far) m.defines.BB_FAR = '';
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, TU, GU, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBBW; varying vec3 vBBN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBBW = (modelMatrix * vec4(transformed, 1.)).xyz; vBBN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PARS)
      .replace('#include <map_fragment>', /* glsl */`
        vec3 wN = normalize(vBBN);
        vec2 xz = vBBW.xz;
        if (uHoleOn > .5) { vec2 hq = (xz - uHole.xy) / (uHole.zw - uHole.xy); if (hq.x > 0. && hq.y > 0. && hq.x < 1. && hq.y < 1. && texture2D(tHole, hq).r > .5) discard; }
        float camD = distance(cameraPosition, vBBW);
        float slope = 1. - wN.y;
        vec4 mk = bbMask(xz);
        float forest = mk.r, lake = mk.g, road = mk.b * 16.;
        float n1 = bbFbm(xz * .045, 4), n2 = bbNoise(xz * .9 + 3.7);
        vec3 base;
        bbTrack = 0.; bbBlood = 0.; bbGlint = 0.;
        bbDet = uDetail * (1. - smoothstep(20., 90., camD));
        if (uMode < .5) {
          /* fresh snow, a touch of blue in the troughs of the wind ripples */
          vec3 snow = vec3(.94, .955, .985) * (.955 + .045 * n1);
          /* under the trees: fallen twigs and bark flecks in the snow, up close */
          float fleck = forest * smoothstep(.8, .86, bbNoise(xz * 7.3 + 1.3)) * smoothstep(.4, .7, bbNoise(xz * .6 - 2.)) * bbDet;
          snow = mix(snow, vec3(.46, .41, .35), fleck * .3);
          /* rock through the snow on steep ground; snow stays on the ledges */
          float rockK = smoothstep(.36, .52, slope + (n1 - .5) * .14);
          rockK *= 1. - .65 * smoothstep(.5, .66, bbNoise(xz * 1.3 + vBBW.y * 1.1));
          vec3 rock = vec3(.31, .30, .29) * (.78 + .44 * bbNoise(xz * .8 + vBBW.y * .7));
          base = mix(snow, rock, rockK);
          /* the frozen lake: wind-packed snow on the ice, swept grey-blue in patches */
          if (lake > .5) {
            float sw = smoothstep(.58, .78, bbFbm(xz * .018 + vec2(3.1, .7), 4));
            float streak = smoothstep(.6, .9, bbNoise(vec2(xz.x * .06, xz.y * .012 + xz.x * .02)));
            base = mix(vec3(.93, .95, .985), vec3(.63, .7, .77), clamp(sw * .6 + streak * .18, 0., .7));
          }
          /* along a plowed road: grey slush thrown up by the plow */
          float slush = (1. - smoothstep(.2, 2.6, road + (n2 - .5) * .9)) * (1. - lake);
          base = mix(base, vec3(.62, .62, .63) * (.9 + .15 * n2), slush * .55);
          #ifdef BB_FAR
          /* far hills: bare woods over snow read grey-brown, whiter on the flats and the frozen water */
          float wood = (1. - lake) * (.55 + .45 * forest) * (1. - smoothstep(.8, 1., 1. - slope) * .25);
          float speck = bbFbm(xz * .004 + 7., 4);
          base = mix(base, vec3(.36, .33, .31) * (.85 + .3 * speck), wood * (.62 + .2 * speck));
          #else
          /* the woods further off, before the trees thin into the far ring */
          /* seen from high up, the bare crowns read as a grey-brown mat over the snow */
          float high = smoothstep(30., 160., cameraPosition.y - vBBW.y);
          float woodK = forest * (1. - lake) * max(smoothstep(260., 900., camD), high * .9) * (.75 + .5 * bbFbm(xz * .03, 3));
          base = mix(base, vec3(.31, .285, .27), clamp(woodK, 0., 1.) * .8);
          #endif
          /* footprints and blood near the player */
          if (uTracks.w > .5) {
            vec2 tuv = (xz - uTracks.xy + uTracks.z) / (2. * uTracks.z);
            if (tuv.x > 0. && tuv.y > 0. && tuv.x < 1. && tuv.y < 1.) {
              vec4 tr = texture2D(tTracks, tuv);
              float edge = smoothstep(0., .08, min(min(tuv.x, tuv.y), min(1. - tuv.x, 1. - tuv.y)));
              bbTrack = tr.r * edge; bbBlood = tr.g * edge;
              base *= 1. - bbTrack * .16;
              base = mix(base, vec3(.42, .03, .03), bbBlood * .85);
            }
          }
        } else if (uMode < 1.5) {
          /* a mown lawn: two greens in mower stripes, darker in the clover; under the woods, last year's leaves
             with ivy and moss */
          float stripe = step(.5, fract(xz.x * .25 + xz.y * .03));
          vec3 lawn = mix(vec3(.19, .33, .11), vec3(.24, .39, .13), stripe * .6 + n1 * .4) * (.88 + .24 * n2);
          lawn = mix(lawn, vec3(.16, .27, .1), smoothstep(.6, .8, bbNoise(xz * .7)) * .5);
          vec3 litter = mix(vec3(.2, .16, .1), vec3(.29, .24, .15), n2) * (.8 + .35 * n1);
          litter = mix(litter, vec3(.12, .2, .07), smoothstep(.45, .75, bbFbm(xz * .21 + 4., 3)) * .75);
          base = mix(lawn, litter, smoothstep(.35, .7, forest));
          #ifdef BB_FAR
          /* far off: a wooded suburb, the crowns in summer green, a roof or a lawn here and there */
          float cn = bbFbm(xz * .006 + 3., 4), sp = bbNoise(xz * .08);
          base = mix(vec3(.1, .17, .07), vec3(.17, .25, .1), cn) * (.8 + .4 * sp);
          base = mix(base, vec3(.24, .36, .14), smoothstep(.72, .86, bbFbm(xz * .013 - 7., 3)) * .6);
          #else
          float high = smoothstep(40., 170., cameraPosition.y - vBBW.y);
          float woodK = forest * max(smoothstep(160., 520., camD), high * .85);
          base = mix(base, vec3(.11, .18, .07) * (.8 + .4 * bbFbm(xz * .05, 3)), clamp(woodK, 0., 1.) * .9);
          #endif
          base *= uTint;
        } else {
          /* late autumn: a tired lawn with fallen leaves drifted in, thick leaves under the bare woods */
          vec3 grass = mix(vec3(.2, .26, .12), vec3(.26, .3, .14), n1) * (.85 + .3 * n2);
          float lv = smoothstep(.45, .7, bbFbm(xz * .35 + 2.1, 4) + forest * .35);
          float hue = bbNoise(xz * 2.3);
          vec3 leaf = mix(vec3(.4, .24, .1), vec3(.55, .38, .15), hue) * (.75 + .3 * bbNoise(xz * 7.1));
          vec3 duff = mix(vec3(.3, .2, .11), vec3(.4, .28, .14), n2) * (.75 + .35 * bbNoise(xz * 5.3));
          base = mix(mix(grass, leaf, lv * .85), duff, smoothstep(.35, .7, forest));
          #ifdef BB_FAR
          /* far off: bare crowns over leaves read grey-brown, the evergreens dark */
          float cn = bbFbm(xz * .006 + 3., 4), sp = bbNoise(xz * .08);
          base = mix(vec3(.28, .25, .22), vec3(.36, .32, .27), cn) * (.85 + .3 * sp);
          base = mix(base, vec3(.1, .15, .1), smoothstep(.68, .84, bbFbm(xz * .02 + 9., 3)) * .7);
          #else
          float high = smoothstep(40., 170., cameraPosition.y - vBBW.y);
          float woodK = forest * max(smoothstep(160., 520., camD), high * .85);
          base = mix(base, vec3(.3, .27, .23) * (.85 + .3 * bbFbm(xz * .05, 3)), clamp(woodK, 0., 1.) * .8);
          #endif
          base *= uTint;
        }
        diffuseColor.rgb *= base;
      `)
      .replace('#include <normal_fragment_maps>', /* glsl */`
        #include <normal_fragment_maps>
        {
          vec3 nW = wN;
          #ifndef BB_FAR
          if (bbDet > 0.) {
            float e = .06;
            if (uMode < .5) {
              /* wind ripples and soft lumps */
              vec2 q = xz * vec2(1.3, .5); float h0 = bbFbm(q, 3), hx = bbFbm(q + vec2(e, 0.), 3), hz = bbFbm(q + vec2(0., e), 3);
              nW = normalize(nW + vec3(-(hx - h0), 0., -(hz - h0)) / e * .05 * bbDet);
              /* footprints are pressed in: the rim catches the light */
              if (uTracks.w > .5 && bbTrack > .01) {
                vec2 tuv = (xz - uTracks.xy + uTracks.z) / (2. * uTracks.z); float px = 1. / 512.;
                float a = texture2D(tTracks, tuv + vec2(px, 0.)).r - texture2D(tTracks, tuv - vec2(px, 0.)).r;
                float b = texture2D(tTracks, tuv + vec2(0., px)).r - texture2D(tTracks, tuv - vec2(0., px)).r;
                nW = normalize(nW + vec3(a, 0., b) * 1.6);
              }
            } else {
              vec2 q = xz * 5.1; float h0 = bbNoise(q), hx = bbNoise(q + vec2(e, 0.)), hz = bbNoise(q + vec2(0., e));
              nW = normalize(nW + vec3(-(hx - h0), 0., -(hz - h0)) / e * .012 * bbDet);
            }
          }
          #endif
          normal = normalize(mat3(viewMatrix) * nW);
        }
      `)
      .replace('#include <lights_fragment_begin>', /* glsl */`
        {
          float hor = -.5;
          if (uHorOn > .5) {
            vec2 huv = ((xz + uRingHalf) / (2. * uRingHalf) * 256. + .5) / 257.;
            float hA = dot(texture2D(tHorA, huv), uMaskA), hB = dot(texture2D(tHorB, huv), uMaskB);
            hor = mix(hA, hB, uHorT) * 1.5707963 - .5235988;
            bbAO = texture2D(tAO, huv).r;
          } else bbAO = 1.;
          float sunEl = asin(clamp(uSunW.y, -1., 1.));
          bbSunVis = smoothstep(hor - uSunSoft, hor + uSunSoft, sunEl);
          bbSunVis *= bbCloudShade(xz);
        }
        #include <lights_fragment_begin>
      `)
      .replace('#include <aomap_fragment>', /* glsl */`
        reflectedLight.indirectDiffuse *= mix(1., bbAO, .9);
        reflectedLight.indirectSpecular *= mix(1., bbAO, .9);
        #ifndef BB_FAR
        /* snow glitters: a few ice facets per square metre catch the sun toward the eye */
        if (uMode < .5 && uSparkle > 0.) {
          vec2 cell = floor(xz * 24.); float h = bbHash2(cell);
          vec3 fn = normalize(vec3(bbHash2(cell + 3.1) - .5, 1.2, bbHash2(cell + 7.7) - .5));
          vec3 Vw = normalize(cameraPosition - vBBW);
          float g = dot(reflect(-Vw, fn), uSunW);
          float sp = smoothstep(.9985, .9998, g) * step(.72, h) * (1. - smoothstep(6., 40., camD)) * bbSunVis;
          reflectedLight.directSpecular += vec3(1.) * sp * 26. * uSparkle * max(0., uSunW.y + .05);
        }
        #endif
      `)
      .replace('#include <fog_fragment>', /* glsl */`
        {
          vec3 V = vBBW - cameraPosition; float d = length(V); V /= max(d, 1e-3);
          vec2 sh = normalize(uSunW.xz + vec2(1e-5));
          float cs = dot(normalize(V.xz + vec2(1e-5)), sh);
          vec3 hz = texture2D(tHaze, vec2(cs * .5 + .5, .5)).rgb;
          float f = 1. - exp(-d * uHazeDensity);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, f);
        }
      `);
  };
  m.customProgramCacheKey = () => 'sopGround' + (far ? 'F' : '');
  terrainMaterials.add(m);
  return m;
}

/* the same haze on any material: objects far off fade into the sky like the ground does */
export function hazeMaterial(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = sh => {
    prev?.call(m, sh);
    Object.assign(sh.uniforms, { tHaze: TU.tHaze, uHazeDensity: TU.uHazeDensity, uSunW: TU.uSunW });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHzW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHzW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHzW; uniform sampler2D tHaze; uniform float uHazeDensity; uniform vec3 uSunW;')
      .replace('#include <fog_fragment>', `{
        vec3 V = vHzW - cameraPosition; float d = length(V); V /= max(d, 1e-3);
        float cs = dot(normalize(V.xz + vec2(1e-5)), normalize(uSunW.xz + vec2(1e-5)));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, texture2D(tHaze, vec2(cs * .5 + .5, .5)).rgb, 1. - exp(-d * uHazeDensity));
      }`);
  };
  return m;
}
