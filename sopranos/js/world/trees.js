import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { app } from '../app.js';
import { seeded, canvasTex, clamp } from '../lib/util.js';
import { NOISE_GLSL } from '../lib/noise.js';
import { barkTex } from '../lib/textures.js';
import { TU } from './terrain.js';
import { horizonHooks } from './lighting.js';

/* Trees grown at load from a seed: a trunk and branches as tapered tubes, fine twigs or leaves as cards at the tips,
   conifers as whorls of needle sprays. Each kind comes in a few variants, drawn in three levels: the full tree up
   close, trunk and limbs with big twig cards further out, and a picture of the tree (an impostor) far away.
   The forest keeps every tree in a grid and sorts them into the three levels as you move.
   Season: 'winter' (bare, snow on the limbs, the beech keeps its dry leaves), 'summer' (full crowns), 'autumn'. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/* ---------- textures made on a canvas ---------- */
/* fine twigs: branching strokes on transparent, four variants in a 2 x 2 atlas */
function twigAtlas(color = '#5a5047') {
  const rnd = seeded(71);
  const t = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = color; g.lineCap = 'round';
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * 256, oy = Math.floor(q / 2) * 256;
      const br = (x, y, a, len, wd, d) => {
        const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
        g.lineWidth = wd; g.beginPath(); g.moveTo(ox + x, oy + y);
        g.quadraticCurveTo(ox + (x + x2) / 2 + (rnd() - .5) * len * .25, oy + (y + y2) / 2, ox + x2, oy + y2); g.stroke();
        if (d > 0) {
          const n = 2 + Math.floor(rnd() * 2);
          for (let i = 0; i < n; i++) { const tt = .35 + rnd() * .6; br(x + (x2 - x) * tt, y + (y2 - y) * tt, a + (rnd() - .5) * 1.7, len * (.45 + rnd() * .3), wd * .62, d - 1); }
        }
      };
      br(128, 250, (rnd() - .5) * .3, 120, 5, 4);
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
/* a cluster of leaves: dry tan beech leaves in winter, green in summer, yellow and rust in autumn */
function leafAtlas(season) {
  const rnd = seeded(19);
  const pal = season === 'winter' || season === 'late' ? ['#c7a06a', '#b98b52', '#d4b07a', '#a87a45', '#c29863']
    : season === 'autumn' ? ['#d99a2b', '#c4731f', '#e2b240', '#a8521c', '#b98a2e', '#7c8a3a']
    : ['#4c6b2a', '#5d7d32', '#3f5a24', '#6c8a3a', '#557430'];
  const t = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * 256 + 128, oy = Math.floor(q / 2) * 256 + 128;
      /* stems */
      g.strokeStyle = '#4a3a2a'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(ox, oy + 90); g.lineTo(ox + (rnd() - .5) * 150, oy + (rnd() - .5) * 150); g.stroke(); }
      const dry = season === 'winter' || season === 'late', n = dry ? 38 : 70;
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(rnd()) * 100, a = rnd() * Math.PI * 2, x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r * .9;
        const L = dry ? 16 + rnd() * 10 : 14 + rnd() * 12, W = L * (dry ? .38 : .55);
        g.save(); g.translate(x, y); g.rotate(rnd() * Math.PI * 2);
        g.fillStyle = pal[Math.floor(rnd() * pal.length)];
        g.beginPath(); g.ellipse(0, 0, W, L, 0, 0, Math.PI * 2); g.fill();
        /* a curl and a crease on the dry ones */
        g.strokeStyle = 'rgba(60,40,20,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -L); g.lineTo(0, L); g.stroke();
        g.restore();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
/* a spray of pine or hemlock needles */
function needleAtlas() {
  const rnd = seeded(33);
  const t = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * 128 + 64, oy = Math.floor(q / 2) * 128 + 64;
      g.strokeStyle = '#2a2016'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(ox - 58, oy); g.lineTo(ox + 58, oy); g.stroke();
      for (let i = 0; i < 150; i++) {
        const x = ox - 56 + rnd() * 112, a = (rnd() < .5 ? -1 : 1) * (.4 + rnd() * .9), L = 14 + rnd() * 16 * (1 - Math.abs(x - ox) / 90);
        g.strokeStyle = ['#23391f', '#2c4527', '#1b2e18', '#35502d'][Math.floor(rnd() * 4)]; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(x, oy); g.lineTo(x + Math.cos(a) * L * .4, oy + Math.sin(a) * L); g.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ---------- growing a skeleton ---------- */
/* spec: { h, r, crown (0..1 where the crown starts), prim, spread (radians from vertical), droop, depth, gnarl, twig, leaves, lean } */
function grow(spec, rnd) {
  const segs = [], tips = [];
  const H = spec.h, R = spec.r;
  /* the trunk: a few segments, a slow bend and a lean */
  const n = 6, lean = V((rnd() - .5) * spec.lean, 1, (rnd() - .5) * spec.lean).normalize();
  let p = V(0, -.3, 0), dir = lean.clone(), r = R * 1.25;
  const trunk = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n, len = H / n * (spec.broken && i === n - 1 ? .4 : 1);
    dir.add(V((rnd() - .5) * spec.gnarl, 0, (rnd() - .5) * spec.gnarl)).normalize();
    const q = p.clone().addScaledVector(dir, len), r1 = R * Math.pow(1 - t * .82, 1.1) + .01;
    segs.push({ a: p.clone(), b: q.clone(), r0: r, r1, depth: 0 }); trunk.push({ a: p.clone(), b: q.clone(), r0: r, r1 });
    p = q; r = r1;
    if (spec.broken && i === n - 1) break;
  }
  const top = p.clone();
  /* limbs from the crown up, turning round the trunk by the golden angle */
  const branch = (a, d, len, rad, depth) => {
    const steps = depth === 1 ? 3 : depth === 2 ? 2 : 1;
    let q = a.clone(), dd = d.clone(), rr = rad;
    for (let s = 0; s < steps; s++) {
      /* limbs bend up toward the light, or droop at the ends */
      dd.addScaledVector(UP, spec.droop * (depth === 1 ? -.08 : -.16) + .09 * (spec.upturn ?? 1));
      dd.add(V((rnd() - .5) * spec.gnarl * 1.6, (rnd() - .5) * spec.gnarl, (rnd() - .5) * spec.gnarl * 1.6)).normalize();
      const q2 = q.clone().addScaledVector(dd, len / steps), r2 = rr * .72;
      segs.push({ a: q.clone(), b: q2.clone(), r0: rr, r1: r2, depth });
      /* children along this piece */
      if (depth < spec.depth) {
        const kids = depth === 1 ? 2 : 2;
        for (let k = 0; k < kids; k++) {
          const t = .3 + rnd() * .65, at = q.clone().lerp(q2, t);
          const side = V(rnd() - .5, (rnd() - .3) * .6, rnd() - .5).normalize();
          const cd = dd.clone().multiplyScalar(.55).add(side).normalize();
          branch(at, cd, len * (.42 + rnd() * .22), rr * .5, depth + 1);
        }
      } else if (s === steps - 1 || rnd() < .45) tips.push({ p: q2.clone(), d: dd.clone(), s: spec.twig * (.7 + rnd() * .6), depth });
      q = q2; rr = r2;
    }
    if (depth >= spec.depth) tips.push({ p: q.clone(), d: dd.clone(), s: spec.twig * (.8 + rnd() * .5), depth });
  };
  const y0 = H * spec.crown, count = spec.prim;
  let ang = rnd() * 6.28;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1), y = y0 + (top.y - y0) * (spec.broken ? t * .8 : Math.pow(t, .8));
    /* find the trunk point at this height */
    let at = top.clone(), rad = .05;
    for (const s of trunk) if (s.b.y >= y) { const k = (y - s.a.y) / Math.max(.01, s.b.y - s.a.y); at = s.a.clone().lerp(s.b, clamp(k, 0, 1)); rad = s.r0 + (s.r1 - s.r0) * k; break; }
    ang += 2.39996;
    const el = spec.spread * (1 - .45 * t) + (rnd() - .5) * .25;
    const d = V(Math.sin(ang) * Math.sin(el), Math.cos(el), Math.cos(ang) * Math.sin(el)).normalize();
    const len = H * spec.limb * (1 - .55 * t) * (.75 + rnd() * .5) * (spec.shape?.(t) ?? 1);
    branch(at, d, len, Math.max(.02, rad * (.45 + .2 * (1 - t))), 1);
  }
  /* a leader at the top */
  if (!spec.broken && spec.depth > 1) branch(top, dir.clone(), H * .14, Math.max(.02, r * .8), 2);
  return { segs, tips, h: top.y };
}

/* ---------- geometry from a skeleton ---------- */
function tubeGeo(segs, maxDepth, radial = [7, 5, 4, 3]) {
  const parts = [];
  for (const s of segs) {
    if (s.depth > maxDepth) continue;
    const L = s.a.distanceTo(s.b); if (L < .02) continue;
    const rs = radial[Math.min(radial.length - 1, s.depth)];
    const g = new THREE.CylinderGeometry(Math.max(.004, s.r1), Math.max(.005, s.r0), L, rs, 1, true);
    /* bark: u around, v along in metres */
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(s.r0 * 8)), uv.getY(i) * L / 1.4);
    g.translate(0, L / 2, 0);
    const dir = s.b.clone().sub(s.a).normalize();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
    g.translate(s.a.x, s.a.y, s.a.z);
    parts.push(g);
  }
  if (!parts.length) return null;
  const m = mergeGeometries(parts, false); parts.forEach(p => p.dispose());
  return m;
}
/* crossed cards at the tips: two quads along the twig, rolled at random; atlas cell per card */
function cardGeo(tips, rnd, { scale = 1, cross = 2, up = 0 } = {}) {
  const pos = [], nor = [], uv = [], idx = [];
  const q = new THREE.Quaternion(), x = V(), y = V(), n = V(), c = V();
  for (const t of tips) {
    const s = t.s * scale;
    const cell = Math.floor(rnd() * 4), u0 = (cell % 2) * .5, v0 = Math.floor(cell / 2) * .5;
    y.copy(t.d).addScaledVector(UP, up).normalize();
    for (let k = 0; k < cross; k++) {
      const roll = rnd() * Math.PI + k * Math.PI / cross;
      x.set(1, 0, 0); if (Math.abs(y.x) > .9) x.set(0, 0, 1);
      x.crossVectors(y, x).normalize(); q.setFromAxisAngle(y, roll); x.applyQuaternion(q);
      n.crossVectors(x, y).normalize();
      /* the card starts a little back along the twig and reaches past the tip */
      c.copy(t.p).addScaledVector(y, s * .35);
      const b = pos.length / 3;
      for (const [sx, sy] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]]) {
        pos.push(c.x + x.x * sx * s + y.x * sy * s, c.y + x.y * sx * s + y.y * sy * s, c.z + x.z * sx * s + y.z * sy * s);
        /* normals lean up and out, so a crown shades like a crown and not like a pile of cards */
        const nn = n.clone().multiplyScalar(.4).add(UP.clone().multiplyScalar(.6)).normalize();
        nor.push(nn.x, nn.y, nn.z);
        uv.push(u0 + (sx + .5) * .5, v0 + (1 - (sy + .5)) * .5);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
/* a conifer: whorls of needle sprays up a straight trunk, shorter toward the top */
function coniferGeo(spec, rnd, lod) {
  const H = spec.h, parts = [];
  const trunk = new THREE.CylinderGeometry(spec.r * .15, spec.r, H, lod ? 5 : 7, 1, true); trunk.translate(0, H / 2 - .3, 0);
  const uv = trunk.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * H / 1.4);
  const sprays = [];
  const whorls = lod ? 7 : 14, y0 = H * spec.crown;
  for (let i = 0; i < whorls; i++) {
    const t = i / (whorls - 1), y = y0 + (H - y0) * t, reach = spec.w * (1 - t * .85) * (.75 + rnd() * .5) * (spec.shape?.(t) ?? 1);
    const k = lod ? 4 : 7, a0 = rnd() * 6.28;
    for (let j = 0; j < k; j++) {
      const a = a0 + j / k * 6.28 + (rnd() - .5) * .5;
      const d = V(Math.sin(a), -.12 - rnd() * .15 + t * .15, Math.cos(a)).normalize();
      sprays.push({ p: V(0, y, 0).addScaledVector(d, reach * .45), d, s: reach * (lod ? 1.3 : 1.0), depth: 3 });
    }
  }
  const cards = cardGeo(sprays, rnd, { scale: 1, cross: lod ? 1 : 2, up: -.1 });
  /* the sprays lie flat: turn their normals up for the snow on top */
  return { bark: trunk, cards };
}

/* ---------- the materials ---------- */
/* every tree part: instanced, lit by the sun where the hills let it (horizon map at its foot), snow on its upper
   faces in winter, tinted per instance */
function treeMaterial(base, { snow = 0, cards = false, impostor = false, ground = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial(base);
  m.defines = { BB_SUN: '' }; if (cards) m.defines.TREE_CARD = ''; if (impostor) m.defines.TREE_IMP = '';
  const u = { tHA: { value: null }, tHB: { value: null }, tAO: { value: null }, uHalf: { value: 1 }, uHasHor: { value: 0 }, uSnow: { value: snow }, uWind: { value: .3 }, uGround: { value: ground } };
  m.userData.u = u;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, TU, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tHA, tHB, tAO; uniform float uHalf, uHasHor, uHorT, uSunSoft, uTime, uWind; uniform vec4 uMaskA, uMaskB; uniform vec3 uSunW;
        varying float vVis; varying float vAO; varying vec3 vNW; varying float vH; varying vec3 vTrW;
        #ifdef TREE_IMP
        attribute vec4 aRect;
        varying vec2 vImpUv; varying float vSteep;
        #endif`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec3 bbFoot = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        #ifdef TREE_IMP
        { vec3 tc = cameraPosition - bbFoot; tc.y = 0.; objectNormal = normalize(normalize(tc + vec3(1e-4)) + vec3(0., .45, 0.)); }
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vH = position.y;
        #ifdef TREE_IMP
        /* a picture of the tree that turns about its trunk to face you */
        {
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec3 toCam = cameraPosition - bbFoot; toCam.y = 0.; toCam = normalize(toCam + vec3(1e-4));
          vec3 side = normalize(cross(vec3(0., 1., 0.), toCam));
          transformed = side * position.x * sc.x + vec3(0., position.y * sc.y, 0.);
          vImpUv = aRect.xy + uv * aRect.zw;
          vec3 dv = cameraPosition - bbFoot; vSteep = smoothstep(.5, .8, dv.y / max(1., length(dv)));
        }
        #endif
        #ifdef TREE_CARD
        /* the crowns move a little in the wind */
        { float hh = max(0., position.y - 2.);
          float w = sin(uTime * 1.3 + bbFoot.x * .3 + position.y * .4) * .5 + sin(uTime * 2.3 + bbFoot.z * .5) * .3;
          transformed.x += w * hh * .006 * (.4 + uWind); transformed.z += w * hh * .004 * (.4 + uWind); }
        #endif
        vVis = 1.; vAO = 1.;
        if (uHasHor > .5) {
          vec2 huv = ((bbFoot.xz + uHalf) / (2. * uHalf) * 256. + .5) / 257.;
          float hor = mix(dot(texture2D(tHA, huv), uMaskA), dot(texture2D(tHB, huv), uMaskB), uHorT) * 1.5707963 - .5235988;
          vVis = smoothstep(hor - uSunSoft, hor + uSunSoft, asin(clamp(uSunW.y, -1., 1.)));
          vAO = texture2D(tAO, huv).r;
        }`)
      .replace('#include <defaultnormal_vertex>', `
        #ifdef TREE_IMP
        vec3 transformedNormal = normalize(mat3(viewMatrix) * objectNormal);
        vNW = objectNormal;
        #else
        #include <defaultnormal_vertex>
        vNW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #endif`)
      .replace('#include <project_vertex>', `
        #ifdef TREE_IMP
        vec4 mvPosition = viewMatrix * vec4(bbFoot + transformed, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #else
        #include <project_vertex>
        #endif`)
      .replace('#include <worldpos_vertex>', `
        #ifdef TREE_IMP
        vec4 worldPosition = vec4(bbFoot + transformed, 1.);
        #else
        #include <worldpos_vertex>
        #endif
        #ifdef TREE_IMP
        vTrW = worldPosition.xyz;
        #else
        vTrW = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        ${NOISE_GLSL}
        varying float vVis; varying float vAO; varying vec3 vNW; varying float vH; varying vec3 vTrW; float bbSunVis; uniform float uSnow;
        uniform sampler2D tHaze; uniform float uHazeDensity; uniform vec3 uSunW;
        #ifdef TREE_IMP
        varying vec2 vImpUv; varying float vSteep; uniform float uGround;
        #endif`)
      .replace('#include <map_fragment>', `
        #ifdef TREE_IMP
        vec4 sampledDiffuseColor = texture2D(map, vImpUv);
        sampledDiffuseColor.rgb /= max(sampledDiffuseColor.a, .02);
        /* see-through crowns: a steady 4 x 4 dither against the picture's coverage */
        { vec2 bp = mod(floor(gl_FragCoord.xy), 4.);
          float bayer = (mod(bp.x + bp.y * 4. + bp.y * 2., 16.) + .5) / 16.;
          bayer = fract(bayer * 7.13 + bp.y * .37);
          if (sampledDiffuseColor.a * 1.25 < bayer || bayer < vSteep) discard; }
        diffuseColor *= sampledDiffuseColor;
        #else
        #include <map_fragment>
        #endif
        /* snow lies on what faces up */
        if (uSnow > 0.) {
          float up = normalize(vNW).y;
          #ifdef TREE_CARD
          float k = smoothstep(.55, .9, up) * .55 * uSnow;
          #else
          float k = smoothstep(.62, .92, up) * uSnow * .85;
          #endif
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93, .95, .98), k);
        }`)
      .replace('#include <alphatest_fragment>', `
        #ifndef TREE_IMP
        #include <alphatest_fragment>
        #endif`)
      .replace('#include <lights_fragment_begin>', 'bbSunVis = vVis;\n#include <lights_fragment_begin>')
      .replace('#include <fog_fragment>', `{
        vec3 Vv = vTrW - cameraPosition; float dd = length(Vv); Vv /= max(dd, 1e-3);
        float cs = dot(normalize(Vv.xz + vec2(1e-5)), normalize(uSunW.xz + vec2(1e-5)));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, texture2D(tHaze, vec2(cs * .5 + .5, .5)).rgb, 1. - exp(-dd * uHazeDensity));
      }`)
      .replace('#include <aomap_fragment>', `reflectedLight.indirectDiffuse *= mix(1., vAO, .8); reflectedLight.indirectSpecular *= mix(1., vAO, .8);
        #ifdef TREE_IMP
        /* the far trees darken toward their feet, where the crowns of the others shade them; snow on the ground
           lights bare trunks from below, so a winter wood darkens less */
        reflectedLight.indirectDiffuse *= mix(.55 + .45 * smoothstep(0., .7, vH), 1., uGround * .7);
        #endif`);
  };
  m.customProgramCacheKey = () => 'tree' + (cards ? 'C' : '') + (impostor ? 'I' : '');
  return m;
}

/* ---------- the kinds ---------- */
/* winter woods at Harriman: tall oaks and tulip trees, maples, beech saplings with their dry leaves, white pine and
   hemlock, young trees, dead snags, mountain laurel */
export function kindsFor(season) {
  const bare = season === 'winter' || season === 'late';
  return {
    oak: { spec: { h: 22, r: .3, crown: .5, prim: 7, spread: .72, limb: .3, droop: 0, depth: 3, gnarl: .18, twig: bare ? 1.1 : 2.6, lean: .08, leaves: !bare }, bark: 'oak', variants: 4, size: [.8, 1.25], hide: 1 },
    maple: { spec: { h: 15, r: .19, crown: .38, prim: 6, spread: .82, limb: .38, droop: .2, depth: 3, gnarl: .24, twig: bare ? 1.0 : 2.3, lean: .14, leaves: !bare }, bark: 'oak', variants: 3, size: [.75, 1.2] },
    beech: { spec: { h: 6.5, r: .07, crown: .25, prim: 7, spread: 1.25, limb: .42, droop: .7, depth: 2, gnarl: .3, twig: .62, lean: .2, leaves: true, upturn: .4 }, bark: 'beech', variants: 3, size: [.55, 1.3], leafSeason: season },
    sapling: { spec: { h: 4, r: .04, crown: .3, prim: 4, spread: .7, limb: .4, droop: .1, depth: 2, gnarl: .35, twig: .8, lean: .25, leaves: !bare }, bark: 'oak', variants: 3, size: [.5, 1.4] },
    snag: { spec: { h: 12, r: .22, crown: .55, prim: 3, spread: .9, limb: .16, droop: .1, depth: 1, gnarl: .25, twig: .5, lean: .12, broken: true }, bark: 'snag', variants: 2, size: [.7, 1.2], noCards: true },
    pine: { conifer: { h: 20, r: .3, crown: .45, w: 3.6 }, bark: 'pine', variants: 3, size: [.75, 1.2] },
    hemlock: { conifer: { h: 15, r: .24, crown: .18, w: 3.2, shape: t => 1 - t * .1 }, bark: 'pine', variants: 2, size: [.7, 1.2] },
    laurel: { shrub: true, bark: 'oak', variants: 3, size: [.6, 1.3] },
  };
}

/* ---------- a forest ---------- */
export class Forest {
  /* trees: [{ x, z, y, kind, v (variant), s (scale), a (turn) }]; opts: { season, snow, rings (horizon maps), near, mid, far } */
  constructor(trees, opts) {
    this.opts = { season: 'winter', snow: 0, near: 38, mid: 120, far: 460, ...opts };
    this.trees = trees; this.group = new THREE.Group(); this.group.name = 'forest';
    this.kinds = kindsFor(this.opts.season);
    this.built = {}; this.meshes = [];
    this.last = V(1e9, 0, 1e9); this.lastFar = V(1e9, 0, 1e9);
    this.#build();
    this.#index();
    app.onUpdate(() => this.update(), 12);
    horizonHooks.add((i0, i1) => this.#sector(i0, i1));
    app.on('tier', () => { this.last.set(1e9, 0, 1e9); this.lastFar.set(1e9, 0, 1e9); });
  }

  #mats() {
    const s = this.opts.snow, season = this.opts.season;
    const bark = {};
    for (const k of ['oak', 'beech', 'pine', 'snag']) {
      const map = barkTex(k === 'snag' ? 'oak' : k, { oak: 3, beech: 5, pine: 7 }[k] ?? 9);
      map.repeat.set(1, 1);
      bark[k] = treeMaterial({ color: k === 'snag' ? 0x8a8078 : 0xffffff, map, roughness: .95 }, { snow: s });
    }
    this.mats = {
      bark,
      twig: treeMaterial({ color: 0xffffff, map: twigAtlas(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, alphaTest: .02 }, { snow: s * .6, cards: true }),
      leaf: treeMaterial({ color: 0xffffff, map: leafAtlas(season), alphaTest: .45, side: THREE.DoubleSide, roughness: .9 }, { snow: s * .5, cards: true }),
      beechLeaf: treeMaterial({ color: 0xffffff, map: leafAtlas('winter'), alphaTest: .45, side: THREE.DoubleSide, roughness: .9 }, { snow: s * .3, cards: true }),
      needle: treeMaterial({ color: 0xffffff, map: needleAtlas(), alphaTest: .42, side: THREE.DoubleSide, roughness: .9 }, { snow: s * .38, cards: true }),
    };
    this.mats.all = [...Object.values(this.mats.bark), this.mats.twig, this.mats.leaf, this.mats.beechLeaf, this.mats.needle];
  }

  #build() {
    this.#mats();
    const rnd = seeded(907);
    for (const [name, K] of Object.entries(this.kinds)) {
      const vs = [];
      for (let v = 0; v < K.variants; v++) {
        const r = seeded(1000 + name.length * 97 + v * 13);
        let lod0 = [], lod1 = [];
        if (K.conifer) {
          const hi = coniferGeo(K.conifer, r, false), lo = coniferGeo(K.conifer, seeded(2000 + v), true);
          lod0 = [[hi.bark, this.mats.bark.pine, true], [hi.cards, this.mats.needle, true]];
          lod1 = [[lo.bark, this.mats.bark.pine, false], [lo.cards, this.mats.needle, false]];
          vs.push({ lod0, lod1, h: K.conifer.h, w: K.conifer.w * 2.2 });
        } else if (K.shrub) {
          /* laurel: a low mound of leathery leaf sprays on a few stems */
          const tips = [];
          for (let i = 0; i < 26; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * .9, y = .35 + r() * .9; tips.push({ p: V(Math.cos(a) * rr, y, Math.sin(a) * rr), d: V(Math.cos(a) * .6, .7, Math.sin(a) * .6).normalize(), s: .6 + r() * .35, depth: 3 }); }
          const stems = []; for (let i = 0; i < 5; i++) { const a = r() * 6.28; stems.push({ a: V(0, -.1, 0), b: V(Math.cos(a) * .6, 1 + r() * .4, Math.sin(a) * .6), r0: .03, r1: .012, depth: 1 }); }
          const cards = cardGeo(tips, r, { cross: 2, up: .2 });
          lod0 = [[tubeGeo(stems, 1, [4]), this.mats.bark.oak, false], [cards, this.mats.needle, true]];
          lod1 = [[cards, this.mats.needle, false]];
          vs.push({ lod0, lod1, h: 1.6, w: 2.2 });
        } else {
          const sk = grow(K.spec, r);
          const tube0 = tubeGeo(sk.segs, 9), tube1 = tubeGeo(sk.segs, 1, [6, 4]);
          const bm = this.mats.bark[K.bark] ?? this.mats.bark.oak;
          lod0.push([tube0, bm, true]); lod1.push([tube1, bm, false]);
          if (!K.noCards) {
            const leafy = K.spec.leaves;
            const dry = this.opts.season === 'winter' || this.opts.season === 'late';
            const cm = name === 'beech' && dry ? this.mats.beechLeaf : leafy ? this.mats.leaf : this.mats.twig;
            const tipsUsed = name === 'beech' && dry ? sk.tips.filter((_, i) => i % 2 === 0) : sk.tips;
            const small = cardGeo(tipsUsed, seeded(5 + v), { scale: 1, cross: 2 });
            /* further off: fewer, bigger cards on the limbs' ends */
            const big = cardGeo(tipsUsed.filter((_, i) => i % 3 === 0), seeded(9 + v), { scale: 2.1, cross: 1 });
            if (small) lod0.push([small, cm, leafy && name !== 'beech']);
            if (big) lod1.push([big, cm, false]);
            /* a winter tree also gets the fine twigs over its leaves' spots */
          }
          vs.push({ lod0, lod1, h: sk.h, w: K.spec.h * K.spec.limb * 1.6 + 1 });
        }
      }
      this.built[name] = vs;
    }
    this.#impostors();
    /* instanced meshes per kind, variant, level and part */
    this.inst = {};
    const cap0 = 900, cap1 = 3200;
    for (const [name, vs] of Object.entries(this.built)) vs.forEach((v, vi) => {
      for (const [lod, cap] of [['lod0', cap0], ['lod1', cap1]]) v[lod].forEach(([geo, mat, cast], pi) => {
        if (!geo) return;
        const im = new THREE.InstancedMesh(geo, mat, cap);
        im.count = 0; im.frustumCulled = false; im.castShadow = cast && !(mat.transparent); im.receiveShadow = true; im.userData.keep = true;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (im.castShadow && mat.alphaTest > .1) im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: mat.alphaTest, side: THREE.DoubleSide });
        this.group.add(im); this.meshes.push(im);
        im.userData.lod = lod;
        (this.inst[`${name}|${vi}|${lod}`] ??= []).push(im);
      });
    });
    /* the far pictures: one mesh for all of them */
    const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, .5, 0);
    this.impMesh = new THREE.InstancedMesh(quad, this.impMat, Math.max(1, this.trees.length));
    this.impMesh.count = 0; this.impMesh.frustumCulled = false; this.impMesh.userData.keep = true;
    this.impRect = new THREE.InstancedBufferAttribute(new Float32Array(this.trees.length * 4 + 4), 4); this.impRect.setUsage(THREE.DynamicDrawUsage);
    quad.setAttribute('aRect', this.impRect);
    this.group.add(this.impMesh);
  }

  /* draw every variant from the side into one atlas: the pictures far trees use */
  #impostors() {
    const list = []; for (const [name, vs] of Object.entries(this.built)) vs.forEach((v, vi) => list.push({ name, vi, v }));
    const cols = 8, rows = Math.ceil(list.length / cols), cw = 128, ch = 256;
    const rt = new THREE.WebGLRenderTarget(cols * cw, rows * ch, { samples: 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xe4ecf6, 0xb0a89c, 2.6));
    const dl = new THREE.DirectionalLight(0xfff4e6, 2.4); dl.position.set(.4, 1, .8); sc.add(dl);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    const r = app.renderer, prevT = r.getRenderTarget(), prevC = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha(), prevTM = r.toneMapping;
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear();
    r.toneMapping = THREE.NoToneMapping;
    list.forEach((it, i) => {
      const cx = i % cols, cy = Math.floor(i / cols);
      const g = new THREE.Group(); sc.add(g);
      for (const [geo, mat] of it.v.lod0) if (geo) { const plain = new THREE.MeshLambertMaterial({ map: mat.map, color: mat.color, transparent: mat.transparent, alphaTest: mat.alphaTest || 0, side: THREE.DoubleSide, depthWrite: !mat.transparent }); g.add(new THREE.Mesh(geo, plain)); }
      const h = it.v.h * 1.08, w = h * cw / ch;
      cam.left = -w / 2; cam.right = w / 2; cam.top = h; cam.bottom = 0; cam.updateProjectionMatrix();
      rt.viewport.set(cx * cw, (rows - 1 - cy) * ch, cw, ch); rt.scissor.set(cx * cw, (rows - 1 - cy) * ch, cw, ch); rt.scissorTest = true;
      r.setRenderTarget(rt);
      r.render(sc, cam);
      g.traverse(o => o.material?.dispose?.()); sc.remove(g);
      it.v.rect = [cx / cols, (rows - 1 - cy) / rows, 1 / cols, 1 / rows]; it.v.impW = w; it.v.impH = h;
    });
    rt.scissorTest = false; rt.viewport.set(0, 0, cols * cw, rows * ch);
    r.setRenderTarget(prevT); r.setClearColor(prevC, prevA); r.toneMapping = prevTM;
    this.impRT = rt;
    this.impMat = treeMaterial({ color: 0xffffff, map: rt.texture, roughness: 1, side: THREE.DoubleSide, transparent: false }, { snow: 0, impostor: true, ground: this.opts.snow });
    this.mats.all.push(this.impMat);
  }

  #index() {
    this.cell = 24; this.grid = new Map();
    for (const t of this.trees) {
      const k = `${Math.floor(t.x / this.cell)},${Math.floor(t.z / this.cell)}`;
      (this.grid.get(k) ?? this.grid.set(k, []).get(k)).push(t);
      const K = this.kinds[t.kind]; const vv = this.built[t.kind][t.v];
      t.r = (K.conifer?.r ?? K.spec?.r ?? .05) * t.s;
    }
  }
  /* trunks near a point, for walking and for bullets */
  near(x, z, rad) {
    const out = [], c = this.cell, i0 = Math.floor((x - rad) / c), i1 = Math.floor((x + rad) / c), j0 = Math.floor((z - rad) / c), j1 = Math.floor((z + rad) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const t of this.grid.get(`${i},${j}`) ?? []) if (Math.abs(t.x - x) < rad + t.r && Math.abs(t.z - z) < rad + t.r) out.push(t);
    return out;
  }
  #sector(i0, i1) {
    const r = this.opts.rings?.[0]; if (!r) return;
    for (const m of this.mats.all) { const u = m.userData.u; u.tHA.value = r.dirs[i0 >> 2]; u.tHB.value = r.dirs[i1 >> 2]; u.tAO.value = r.ao; u.uHalf.value = r.half; u.uHasHor.value = 1; }
  }

  /* sort the trees into the levels around the camera */
  update(force = false) {
    if (!this.group.parent) return;
    const c = app.camera.position, reach = app.reach ?? 1;
    const moved = Math.hypot(c.x - this.last.x, c.z - this.last.z);
    if (!force && moved < 2.5) return;
    this.last.copy(c);
    const d0 = this.opts.near * reach, d1 = this.opts.mid * reach, d2 = this.opts.far * reach, dens = app.density ?? 1;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(), p = V(), col = new THREE.Color();
    for (const arr of Object.values(this.inst)) for (const im of arr) im.count = 0;
    let ni = 0;
    const put = (key, t) => {
      const arr = this.inst[key]; if (!arr) return;
      q.setFromAxisAngle(UP, t.a); s.setScalar(t.s); p.set(t.x, t.y, t.z); m4.compose(p, q, s);
      for (const im of arr) { if (im.count >= im.instanceMatrix.count) continue; im.setMatrixAt(im.count, m4); if (im.instanceColor || true) { col.setRGB(t.tint, t.tint, t.tint); im.setColorAt(im.count, col); } im.count++; }
    };
    const rect = this.impRect.array;
    for (const t of this.trees) {
      if (t.thin > dens) continue;
      const dx = t.x - c.x, dz = t.z - c.z, d = Math.hypot(dx, dz);
      if (d < d0) put(`${t.kind}|${t.v}|lod0`, t);
      else if (d < d1 && !(t.kind === 'sapling' || t.kind === 'laurel') ) put(`${t.kind}|${t.v}|lod1`, t);
      else if (d < d1 && t.kind === 'laurel' && d < d1 * .5) put(`${t.kind}|${t.v}|lod1`, t);
      else if (d < d2 && t.kind !== 'laurel' && !((t.kind === 'sapling' || t.kind === 'beech') && d > d1 * 1.3)) {
        const vv = this.built[t.kind][t.v];
        q.identity(); s.set(vv.impW * t.s, vv.impH * t.s, 1); p.set(t.x, t.y - .2, t.z); m4.compose(p, q, s);
        this.impMesh.setMatrixAt(ni, m4); col.setRGB(t.tint, t.tint, t.tint); this.impMesh.setColorAt(ni, col);
        rect.set(vv.rect, ni * 4); ni++;
      }
    }
    this.impMesh.count = ni;
    this.impMesh.instanceMatrix.needsUpdate = true; if (this.impMesh.instanceColor) this.impMesh.instanceColor.needsUpdate = true; this.impRect.needsUpdate = true;
    for (const arr of Object.values(this.inst)) for (const im of arr) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    this.counts = { imp: ni };
  }
}
