import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { app } from '../app.js';
import { rbox, box, cyl, tube, mat, clamp, damp, dampAngle, wrapAngle, smooth } from '../lib/util.js';
import { plaidTex, camoTex } from '../lib/textures.js';
import { canvasTex, seeded } from '../lib/util.js';
import { makeFigure } from './rig.js';
import { hotspot } from '../ctrl/hotspots.js';

/* The people of the five scenes, blocky in the collection's style. Each person has looks (one figure per look),
   a place, a pose, a head that turns toward what matters, and props in the hands. A look is built only when a scene
   asks for it. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const cast = {};
const skin = c => mat(c, .72);
const hairMat = c => mat(c, .9);

/* ---------- heads ---------- */
/* a cap fitted to the blocky head, like hair or a knit hat: the head's rounded box grown by t, everything below y0
   and above y1 pressed flat, everything in front of z1 pressed back (a hairline); lift raises the crown */
function cap(h, m, t, { y0 = -1, y1 = 1, z1 = 1, lift = 0, back = -1 } = {}) {
  const g = new RoundedBoxGeometry(.24 + 2 * t, .28 + 2 * t, .25 + 2 * t, 3, .09 + t), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i); y = Math.min(y1, Math.max(y0, y)); if (y > .05) y += (y - .05) * lift;
    p.setY(i, y); if (p.getZ(i) > z1) p.setZ(i, z1); if (p.getZ(i) < back) p.setZ(i, back);
  }
  const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; h.add(o); return o;
}
/* hair only round the sides and the back: a bald crown */
function horseshoe(h, m, t = .01, top = .02) {
  const o = cap(h, m, t, { y1: top, z1: .02 });
  return o;
}
const HEADS = {
  /* black hair combed straight back, and the white wings over the ears */
  paulie(h) {
    cap(h, hairMat(0x141312), .012, { y0: .02, z1: .08, lift: .35 });
    for (const s of [-1, 1]) rbox(h, .03, .085, .15, .02, hairMat(0xdedad2), s * .126, .045, -.02);
    rbox(h, .08, .012, .02, .005, hairMat(0x2a2522), 0, .025, .126);
  },
  paulieMess(h) {
    cap(h, hairMat(0x141312), .016, { y0: .02, z1: .09, lift: .5 });
    for (const s of [-1, 1]) { const w = rbox(h, .035, .1, .16, .02, hairMat(0xe4e0d8), s * .13, .06, -.02); w.rotation.z = s * .35; }
  },
  chris(h, cut = false) {
    cap(h, hairMat(0x1b1511), .014, { y0: .0, z1: .1, lift: .3 });
    rbox(h, .09, .02, .02, .008, hairMat(0x241c16), 0, -.1, .124);
    if (cut) rbox(h, .05, .03, .01, .005, new THREE.MeshStandardMaterial({ color: 0x8a1410, roughness: .4 }), .05, .075, .128);
  },
  valery(h) {
    cap(h, hairMat(0x6b5d4e), .02, { y0: -.06, z1: .09, lift: .2 });
    rbox(h, .1, .02, .02, .008, hairMat(0x7a6a58), 0, -.1, .124);
  },
  tony01(h) { horseshoe(h, hairMat(0x1d1917), .01, .04); rbox(h, .09, .012, .02, .005, hairMat(0x2a2522), 0, .025, .126); },
  /* 1998: more of the dark hair on top, going back at the temples */
  tony98(h) { cap(h, hairMat(0x1d1917), .01, { y0: -.02, z1: .04, lift: .08 }); rbox(h, .09, .012, .02, .005, hairMat(0x2a2522), 0, .025, .126); },
  /* strawberry blonde to the shoulders, a fringe swept to the side */
  carmela98(h) { cap(h, hairMat(0xc9905a), .03, { y0: -.2, z1: .085, lift: .3 }); rbox(h, .2, .04, .05, .02, hairMat(0xd39c63), .02, .12, .115).rotation.z = -.15; },
  /* the dark bowl cut */
  aj98(h) { cap(h, hairMat(0x1c1511), .02, { y0: -.04, z1: .13, lift: .15 }); },
  /* long dark hair down the back */
  meadow98(h) { cap(h, hairMat(0x1a1310), .025, { y0: -.34, z1: .07, lift: .22 }); },
  phil(h) { cap(h, hairMat(0x2a211b), .012, { y0: -.02, z1: .09, lift: .2 }); },
  guestM(h) { cap(h, hairMat(0x3a2c22), .012, { y0: -.01, z1: .09, lift: .15 }); },
  guestW(h) { cap(h, hairMat(0x2b1d16), .03, { y0: -.24, z1: .075, lift: .5 }); },
  kid(h) { cap(h, hairMat(0x5a3f28), .02, { y0: -.06, z1: .11, lift: .2 }); },
  /* 2003: Carmela's blonde bob to the chin; AJ at seventeen, the dark hair short and messy */
  carmela03(h) { cap(h, hairMat(0xd7b37c), .03, { y0: -.13, z1: .09, lift: .35 }); rbox(h, .22, .05, .05, .02, hairMat(0xe0bd86), -.01, .12, .115).rotation.z = .12; },
  aj03(h) { cap(h, hairMat(0x1c1511), .018, { y0: -.01, z1: .1, lift: .28 }); },
  /* the bakery: Doug's blond flat-top, Gino's dark hair going back, the older man's grey */
  doug(h) { cap(h, hairMat(0xd9bf7a), .01, { y0: .0, z1: .1, lift: .02, y1: .15 }); rbox(h, .235, .03, .235, .01, hairMat(0xe0c886), 0, .145, -.005); },
  gino(h) { horseshoe(h, hairMat(0x1d1917), .012, .06); cap(h, hairMat(0x1d1917), .006, { y0: .08, z1: -.02 }); },
  oldman(h) { cap(h, hairMat(0xb8b6b0), .01, { y0: -.02, z1: .07, lift: .1 }); },
  lady(h) { cap(h, hairMat(0x6b4a2e), .03, { y0: -.1, z1: .08, lift: .45 }); },
  /* the dream: the man in the tuxedo, grey-brown hair combed back; the woman in the doorway */
  tonyb(h) { cap(h, hairMat(0x6e5e4c), .016, { y0: -.07, z1: .1, lift: .18 }); },
  livia(h) { cap(h, hairMat(0x3a3430), .028, { y0: -.02, z1: .07, lift: .5 }); },
  bobby(h) {
    cap(h, hairMat(0x1f1a17), .012, { y0: -.02, z1: .08 });
    /* the camouflage cap with its bill */
    const c = cap(h, new THREE.MeshStandardMaterial({ map: camoTex(), roughness: .9 }), .024, { y0: .06, lift: .12 });
    const bill = rbox(h, .2, .018, .1, .008, c.material, 0, .075, .165); bill.rotation.x = .12;
  },
};

/* ---------- cloth ---------- */
/* the hair on Tony's chest, over his skin */
function chestTex() {
  const rnd = seeded(29);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d9a888'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = w * (.18 + .64 * rnd()), y = h * (.05 + .8 * Math.pow(rnd(), .8)), c = Math.abs(x - w / 2) / (w * .32);
      if (rnd() > (1 - c * .7) * (y < h * .55 ? 1 : .6)) continue;
      g.strokeStyle = `rgba(35,25,20,${.35 + rnd() * .3})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 4, y + 2 + rnd() * 3); g.stroke();
    }
  });
}
/* Carmela's dark blouse with a cream fan pattern */
function fanTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#23202a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(232,222,196,.75)'; g.lineWidth = 2;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const cx = x * 44 + (y % 2) * 22, cy = y * 44 + 30;
      for (let k = 0; k < 5; k++) { const a = Math.PI + k * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18); g.stroke(); }
      g.beginPath(); g.arc(cx, cy, 18, Math.PI, 2 * Math.PI); g.stroke();
    }
  });
}
/* Gino's short-sleeve shirt: light blue with a small pattern */
function dotTex(base, dot) {
  return canvasTex(64, 64, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = dot; for (let y = 4; y < h; y += 10) for (let x = (y / 10 % 2) * 5 + 3; x < w; x += 10) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } });
}
/* a band of stripes round a sleeve */
function stripeTex(base, cols, n = 3) {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(0, h * (.1 + i * .8 / n), w, h * .35 / n); }
  });
}

/* ---------- outfits ---------- */
const LOOKS = {
  'paulie:pine': () => ({ name: 'Paulie', skin: skin(0xd6a584), shirt: mat(0xb89f7c, .78), sleeve: mat(0xb89f7c, .78), forearm: mat(0xb89f7c, .78), pants: mat(0x151516, .7), shoes: mat(0x0f0f10, .35), head: HEADS.paulie, wide: .98 }),
  'paulie:mess': () => ({ ...LOOKS['paulie:pine'](), head: HEADS.paulieMess, shoesL: mat(0x7a7064, .95) }),
  'chris:pine': () => ({ name: 'Christopher', skin: skin(0xd7a47f), shirt: mat(0x151414, .42), sleeve: mat(0x151414, .42), forearm: mat(0x151414, .42), pants: mat(0x161618, .8), shoes: mat(0x121212, .4), head: h => HEADS.chris(h), collar: mat(0x7c1a1c, .8), wide: .95 }),
  'chris:cut': () => ({ ...LOOKS['chris:pine'](), head: h => HEADS.chris(h, true) }),
  'valery:pine': () => {
    const tee = mat(0x4b5a36, .9);
    return { name: 'Valery', skin: skin(0xe8c2a4), shirt: tee, sleeve: tee, forearm: skin(0xe8c2a4), pants: new THREE.MeshStandardMaterial({ map: plaidTex('#1f3326', [['#15201a', .9, .1, .18], ['#3c5a44', .8, .55, .08], ['#262d3c', .7, .78, .12]], 2), roughness: .9 }), shoes: mat(0x3a3530, .9), head: HEADS.valery, wide: .97 };
  },
  'tony:pine': () => ({ name: 'Tony', skin: skin(0xd9a888), shirt: mat(0x121214, .88), sleeve: mat(0x121214, .88), forearm: mat(0x121214, .88), pants: mat(0x141416, .85), shoes: mat(0x0e0e0f, .4), head: HEADS.tony01, wide: 1.28, torsoH: .54, coat: mat(0x121214, .88) }),
  /* the pilot, June 1998: the cream satin robe open over the bare chest, white boxers, slippers */
  'tony:robe': () => {
    const chest = new THREE.MeshStandardMaterial({ roughness: .75, map: chestTex() }), satin = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: .38, metalness: .05 });
    return { name: 'Tony', skin: skin(0xd9a888), shirt: chest, sleeve: satin, forearm: satin, pants: mat(0xf2f0ea, .8), thighs: mat(0xf2f0ea, .8), shins: skin(0xd9a888), shoes: mat(0x5a4632, .8), head: HEADS.tony98, wide: 1.28, torsoH: .54, robe: satin };
  },
  /* at the grill: the maroon polo, dark trousers, the gold watch, a cigar */
  'tony:polo': () => ({ name: 'Tony', skin: skin(0xd9a888), shirt: mat(0x7a1c2a, .8), sleeve: mat(0x7a1c2a, .8), forearm: skin(0xd9a888), pants: mat(0x1c1f2a, .8), shoes: mat(0x151515, .4), head: HEADS.tony98, wide: 1.28, torsoH: .54, watch: true, cigar: true }),
  'carmela:party': () => ({ name: 'Carmela', skin: skin(0xecc2a4), shirt: mat(0x8fb8dc, .8), sleeve: skin(0xecc2a4), forearm: skin(0xecc2a4), pants: mat(0x1d2644, .8), thighs: mat(0x1d2644, .8), shins: skin(0xecc2a4), shoes: mat(0xc49a6a, .7), head: HEADS.carmela98, wide: .9, torsoH: .47 }),
  'aj:party': () => {
    const tee = new THREE.MeshStandardMaterial({ roughness: .85, map: stripeTex('#1f2a52', ['#c8202c', '#f4f2ee']) });
    return { name: 'AJ', skin: skin(0xe6bb9c), shirt: mat(0x1f2a52, .85), sleeve: tee, forearm: skin(0xe6bb9c), pants: mat(0x55708e, .9), thighs: mat(0x55708e, .9), shins: skin(0xe6bb9c), shoes: mat(0xe8e8e8, .6), head: HEADS.aj98, wide: 1.18, torsoH: .46, scale: .8 };
  },
  'meadow:party': () => {
    const tee = new THREE.MeshStandardMaterial({ roughness: .85, map: stripeTex('#c9b89c', ['#9a2a24', '#e8dcc6'], 10) });
    return { name: 'Meadow', skin: skin(0xe8c0a0), shirt: tee, sleeve: mat(0xa8302a, .8), forearm: skin(0xe8c0a0), pants: mat(0xc4ab82, .9), shoes: mat(0x3a2e26, .6), head: HEADS.meadow98, wide: .88, torsoH: .46, scale: .95 };
  },
  'phil:party': () => ({ name: 'Father Phil', skin: skin(0xe3b596), shirt: mat(0x141416, .7), sleeve: mat(0x141416, .7), forearm: mat(0x141416, .7), pants: mat(0x141416, .75), shoes: mat(0x0f0f10, .35), head: HEADS.phil, wide: .96, tab: true }),
  'chris:party': () => ({ name: 'Christopher', skin: skin(0xd7a47f), shirt: mat(0x1a1a1c, .6), sleeve: mat(0x1a1a1c, .6), forearm: skin(0xd7a47f), pants: mat(0x2a2a2e, .8), shoes: mat(0x121212, .4), head: h => HEADS.chris(h), wide: .95 }),
  'guest1:party': () => ({ name: 'A guest', skin: skin(0xdcae8e), shirt: mat(0xf0eee8, .8), sleeve: mat(0xf0eee8, .8), forearm: skin(0xdcae8e), pants: mat(0xb8a482, .9), shoes: mat(0x4a3a2c, .6), head: HEADS.guestM, wide: 1.05 }),
  'guest2:party': () => ({ name: 'A guest', skin: skin(0xe8c0a0), shirt: mat(0xd98aa8, .85), sleeve: skin(0xe8c0a0), forearm: skin(0xe8c0a0), pants: mat(0xf2efe6, .85), shoes: mat(0xd2b48c, .7), head: HEADS.guestW, wide: .9, torsoH: .47 }),
  'guest3:party': () => ({ name: 'A guest', skin: skin(0xd6a584), shirt: mat(0x3b5f8a, .85), sleeve: mat(0x3b5f8a, .85), forearm: skin(0xd6a584), pants: mat(0x2a2a30, .85), shoes: mat(0x151515, .4), head: HEADS.guestM, wide: 1.12 }),
  'kid1:party': () => ({ name: 'A kid', skin: skin(0xe8c0a0), shirt: mat(0xe8c43a, .85), sleeve: mat(0xe8c43a, .85), forearm: skin(0xe8c0a0), pants: mat(0x3a5a8a, .9), thighs: mat(0x3a5a8a, .9), shins: skin(0xe8c0a0), shoes: mat(0xf0f0f0, .6), head: HEADS.kid, wide: .9, torsoH: .44, scale: .68 }),
  'kid2:party': () => ({ name: 'A kid', skin: skin(0xdcae8e), shirt: mat(0x3a9a5a, .85), sleeve: mat(0x3a9a5a, .85), forearm: skin(0xdcae8e), pants: mat(0x6a5a4a, .9), thighs: mat(0x6a5a4a, .9), shins: skin(0xdcae8e), shoes: mat(0x2a2a2a, .6), head: HEADS.kid, wide: .92, torsoH: .44, scale: .62 }),
  /* "Two Tonys", 2003: the black leather jacket, brown trousers, a cigar */
  'tony:leather': () => { const lea = new THREE.MeshStandardMaterial({ color: 0x151313, roughness: .38, metalness: .05 }); return { name: 'Tony', skin: skin(0xd9a888), shirt: lea, sleeve: lea, forearm: lea, pants: mat(0x4e3a2a, .85), shoes: mat(0x121212, .4), head: HEADS.tony01, wide: 1.3, torsoH: .54, cigar: true, collar: mat(0x151313, .38) }; },
  'carmela:2003': () => { const bl = new THREE.MeshStandardMaterial({ roughness: .7, map: fanTex() }); return { name: 'Carmela', skin: skin(0xecc2a4), shirt: bl, sleeve: bl, forearm: bl, pants: mat(0x1c1c22, .8), shoes: mat(0x2a2424, .5), head: HEADS.carmela03, wide: .9, torsoH: .47 }; },
  'aj:2003': () => ({ name: 'AJ', skin: skin(0xe6bb9c), shirt: mat(0x85888c, .95), sleeve: mat(0x85888c, .95), forearm: mat(0x85888c, .95), pants: mat(0x28303e, .9), shoes: mat(0xe8e8e8, .6), head: HEADS.aj03, wide: 1.06, torsoH: .5, scale: .97, hood: mat(0x7c7f83, .95) }),
  /* "The Legend of Tennessee Moltisanti": Christopher in the black leather jacket over a black patterned shirt, brown trousers */
  'chris:bakery': () => { const lea = new THREE.MeshStandardMaterial({ color: 0x131212, roughness: .4, metalness: .05 }); return { name: 'Christopher', skin: skin(0xd7a47f), shirt: lea, sleeve: lea, forearm: lea, pants: mat(0x5a4230, .85), shoes: mat(0x121212, .4), head: h => HEADS.chris(h), wide: .96, collar: mat(0x1a1a1e, .7) }; },
  'doug:bakery': () => ({ name: 'Doug', skin: skin(0xefc6a6), shirt: mat(0x1e2a44, .85), sleeve: skin(0xefc6a6), forearm: skin(0xefc6a6), pants: mat(0x3a3a40, .85), shoes: mat(0x2a2a2a, .6), head: HEADS.doug, wide: .98, apron: mat(0xf4f3ef, .85), choker: true, tattoo: true }),
  'gino:bakery': () => { const sh = new THREE.MeshStandardMaterial({ roughness: .8, map: dotTex('#9fc2e0', '#e8f0f6') }); return { name: 'Gino', skin: skin(0xd9aa88), shirt: sh, sleeve: sh, forearm: skin(0xd9aa88), pants: mat(0x2a2c34, .85), shoes: mat(0x151515, .5), head: HEADS.gino, wide: 1.42, torsoH: .56 }; },
  'oldman:bakery': () => ({ name: 'A customer', skin: skin(0xe3b89a), shirt: mat(0xf2f0ea, .8), sleeve: mat(0xf2f0ea, .8), forearm: mat(0xf2f0ea, .8), pants: mat(0x22242a, .85), shoes: mat(0x151515, .4), head: HEADS.oldman, wide: .95 }),
  'lady:bakery': () => ({ name: 'A customer', skin: skin(0xecc2a4), shirt: mat(0xb24a5a, .85), sleeve: mat(0xb24a5a, .85), forearm: skin(0xecc2a4), pants: mat(0x2e3a52, .85), shoes: mat(0x3a2a22, .6), head: HEADS.lady, wide: .88, torsoH: .47 }),
  /* "Join the Club" and "Mayham": Tony as Kevin Finnerty, a dark suit, a light blue shirt, a navy tie with small dots */
  'tony:finnerty': () => { const suit = mat(0x1f2330, .7); return { name: 'Tony', skin: skin(0xd9a888), shirt: suit, sleeve: suit, forearm: suit, pants: suit, shoes: mat(0x111111, .35), head: HEADS.tony01, wide: 1.28, torsoH: .54, collar: mat(0xa9c4e0, .7), tie: new THREE.MeshStandardMaterial({ roughness: .6, map: dotTex('#1c2a4a', '#8fa6c8') }) }; },
  'tonyb:inn': () => { const tux = mat(0x0e0e10, .55); return { name: 'Tony Blundetto', skin: skin(0xe6bea0), shirt: tux, sleeve: tux, forearm: tux, pants: tux, shoes: mat(0x0a0a0a, .25), head: HEADS.tonyb, wide: .92, collar: mat(0xf6f4ee, .6), bow: true, front: mat(0xf6f4ee, .6) }; },
  'livia:inn': () => ({ name: 'A woman in the doorway', skin: skin(0xe3c0a6), shirt: mat(0x1a1818, .9), sleeve: mat(0x1a1818, .9), forearm: mat(0x1a1818, .9), pants: mat(0x1a1818, .9), shoes: mat(0x111111, .5), head: HEADS.livia, wide: .95, torsoH: .47, coat: mat(0x1a1818, .9) }),
  'guest1:inn': () => ({ name: 'A guest', skin: skin(0xdcae8e), shirt: mat(0x16161a, .6), sleeve: mat(0x16161a, .6), forearm: mat(0x16161a, .6), pants: mat(0x16161a, .6), shoes: mat(0x0a0a0a, .3), head: HEADS.guestM, wide: 1.02, collar: mat(0xf2f0ea, .6) }),
  'guest2:inn': () => ({ name: 'A guest', skin: skin(0xe8c0a0), shirt: mat(0x5a1c2a, .6), sleeve: skin(0xe8c0a0), forearm: skin(0xe8c0a0), pants: mat(0x5a1c2a, .6), shoes: mat(0x1a1a1a, .4), head: HEADS.guestW, wide: .88, torsoH: .47, coat: mat(0x5a1c2a, .6) }),
  'bobby:pine': () => {
    const camo = new THREE.MeshStandardMaterial({ map: camoTex(), roughness: .9 });
    return { name: 'Bobby', skin: skin(0xdcad8c), shirt: camo, sleeve: camo, forearm: camo, pants: mat(0x5a5a40, .9), shoes: mat(0x3b2f24, .8), head: HEADS.bobby, wide: 1.42, torsoH: .54, vest: mat(0xf05a14, .75) };
  },
};

function build(key, look) {
  const L = LOOKS[`${key}:${look}`]();
  const r = makeFigure({ ...L, thigh: .43, shin: .42, torsoH: L.torsoH ?? .5, hair: L.head });
  r.key = key; r.look = look;
  if (L.collar) rbox(r.spine, .22, .05, .2, .015, L.collar, 0, r.torsoH + .005, .02);
  if (L.coat) {
    /* a long coat: the skirt from the waist to the knees, split at the back */
    for (const s of [-1, 1]) rbox(r.body, .22 * (L.wide ?? 1), .5, .3 * (L.wide ?? 1), .04, L.coat, s * .11 * (L.wide ?? 1), -.2, 0);
    rbox(r.spine, .44 * (L.wide ?? 1), .1, .3 * (L.wide ?? 1), .04, L.coat, 0, r.torsoH - .02, 0);
  }
  if (L.vest) { rbox(r.spine, .43 * (L.wide ?? 1), .42, .29 * (L.wide ?? 1), .06, L.vest, 0, .23, 0).scale.set(1.02, 1, 1.04); }
  if (L.shoesL) { r.legL.foot.children[0].material = L.shoesL; }
  if (L.scale) r.root.scale.setScalar(L.scale);
  /* the robe: open over the chest, the back and sides covered, the skirt to the knees in two panels that can float */
  if (L.robe) {
    const w = L.wide ?? 1, th = r.torsoH;
    rbox(r.spine, .42 * w, th + .04, .06, .03, L.robe, 0, th / 2, -.13 * w);
    for (const s of [-1, 1]) {
      rbox(r.spine, .06, th + .04, .28 * w, .03, L.robe, s * .21 * w, th / 2, 0);
      const lap = rbox(r.spine, .09, th + .02, .03, .012, L.robe, s * .15 * w, th / 2, .135 * w); lap.rotation.z = s * .08;
    }
    rbox(r.spine, .44 * w, .07, .3 * w, .03, L.robe, 0, th + .01, -.01);
    r.robe = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(s * .11 * w, .06, 0); r.body.add(pivot);
      rbox(pivot, .22 * w, .62, .3 * w, .04, L.robe, 0, -.3, -.01); r.robe.push(pivot);
    }
    const belt = rbox(r.body, .03, .5, .03, .01, L.robe, .24 * w, -.12, .1); belt.rotation.z = .2;
  }
  if (L.tab) rbox(r.spine, .05, .03, .01, .005, mat(0xf4f4f0, .6), 0, r.torsoH - .02, .14);
  /* a tie down the shirt front; a tuxedo's white front and bow tie */
  if (L.tie) { rbox(r.spine, .1, r.torsoH * .75, .012, .005, L.collar, 0, r.torsoH * .6, .137 * (L.wide ?? 1)); rbox(r.spine, .05, r.torsoH * .6, .014, .005, L.tie, 0, r.torsoH * .55, .145 * (L.wide ?? 1)); }
  if (L.front) { rbox(r.spine, .12, r.torsoH * .7, .012, .005, L.front, 0, r.torsoH * .62, .137 * (L.wide ?? 1)); }
  if (L.bow) { for (const sx of [-1, 1]) { const b = rbox(r.spine, .05, .035, .02, .01, mat(0x080808, .4), sx * .028, r.torsoH - .03, .15); b.rotation.z = sx * .3; } }
  if (L.hood) { rbox(r.spine, .34, .14, .12, .05, L.hood, 0, r.torsoH + .02, -.15); }
  /* Doug's white bib apron, his bead choker, the tattoo on his arm */
  if (L.apron) {
    rbox(r.spine, .34 * (L.wide ?? 1), r.torsoH * .82, .02, .01, L.apron, 0, r.torsoH * .45, .141 * (L.wide ?? 1));
    const sk = rbox(r.body, .38 * (L.wide ?? 1), .5, .02, .01, L.apron, 0, -.2, .15); void sk;
    for (const sx of [-1, 1]) { const st = box(r.spine, .02, .3, .01, L.apron, sx * .1, r.torsoH + .02, .06); st.rotation.x = -.3; }
  }
  if (L.choker) { const c = new THREE.Mesh(new THREE.TorusGeometry(.058, .008, 6, 16), mat(0x0c0c0c, .3)); c.rotation.x = Math.PI / 2; c.position.set(0, r.torsoH + .05, .02); r.spine.add(c); }
  if (L.tattoo) box(r.armL.sh, .105, .06, .06, mat(0x2a3440, .8), 0, -.14, .032);
  if (L.watch) rbox(r.armL.el, .1, .035, .1, .01, mat(0xd9b24a, .25, 1), 0, -.2, 0);
  /* things a hand can hold, hidden until a scene needs them */
  r.props = {};
  const hold = (name, fn, hand = r.armR.hand) => { const g = new THREE.Group(); g.visible = false; g.userData.keep = true; hand.add(g); fn(g); r.props[name] = g; return g; };
  const gunMat = mat(0x1d1d1f, .35, .6);
  if (key === 'paulie' || key === 'chris' || key === 'tony') hold('gun', g => { box(g, .03, .05, .17, gunMat, 0, -.02, .07); box(g, .028, .09, .035, gunMat, 0, -.06, 0); });
  if (key === 'paulie') hold('phone', g => { rbox(g, .045, .1, .02, .008, mat(0x2a2c30, .4, .3), 0, .03, .03); box(g, .006, .05, .006, mat(0x111, .5), .012, .1, .02); }, r.armL.hand);
  if (key === 'valery') hold('shovel', g => {
    tube(g, V(0, -.15, 0), V(0, .9, 0), .018, mat(0x8a6a44, .8));
    const b = rbox(g, .22, .28, .02, .01, mat(0x6f7478, .45, .7), 0, -.3, .02); b.rotation.x = .2;
    tube(g, V(-.07, .9, 0), V(.07, .9, 0), .015, mat(0x2a2a2a, .6));
  });
  if (key === 'tony') {
    /* a cigar in the mouth, the bread, the paper, the lighter fluid */
    const c = new THREE.Group(); c.visible = !!L.cigar; c.userData.keep = true; r.head.add(c); r.props.cigar = c;
    const cg = cyl(c, .011, .012, .14, mat(0x5a3a22, .8), .02, -.07, .19, 8); cg.rotation.x = Math.PI / 2 - .2; cg.rotation.z = .15;
    hold('bread', g => { box(g, .1, .1, .014, mat(0xe8d6ae, .95), 0, -.02, .05); box(g, .104, .104, .01, mat(0xa06a3a, .9), 0, -.02, .044); });
    hold('paper', g => { const p = cyl(g, .05, .05, .3, mat(0xefe9da, .8), 0, -.02, .05, 12); p.rotation.x = Math.PI / 2; }, r.armL.hand);
    hold('fluid', g => { cyl(g, .045, .045, .24, mat(0x2c6fb0, .5), 0, .05, .04, 10); });
    /* the rifle, held upright: the Norinco AK with its wooden stock and handguard, the curved magazine */
    hold('ak', g => {
      const wood = mat(0x7a4a26, .6), steel = mat(0x1a1a1c, .35, .6);
      box(g, .05, .07, .3, steel, 0, 0, .05); box(g, .045, .06, .22, wood, 0, -.005, .3); tube(g, V(0, .01, .4), V(0, .01, .72), .011, steel);
      box(g, .04, .1, .3, wood, 0, -.03, -.27); const mg = box(g, .03, .2, .07, steel, 0, -.12, .12); mg.rotation.x = .35;
      g.rotation.x = -1.3;
    });
  }
  if (key === 'chris') {
    hold('pistol', g => { box(g, .025, .04, .13, mat(0xc4c8cc, .25, 1), 0, -.02, .06); box(g, .024, .075, .03, mat(0x2a2a2c, .5, .3), 0, -.06, 0); });
    hold('box', g => { box(g, .34, .12, .26, mat(0xf6f4ee, .8), 0, -.06, .12); });
  }
  if (key === 'doug') { hold('bag', g => { box(g, .2, .26, .12, mat(0xf2ede0, .85), 0, -.16, .02); }); hold('tray', g => { box(g, .36, .02, .24, mat(0xc8ccd0, .3, .8), 0, .02, .14); }); }
  if (key === 'oldman' || key === 'lady') hold('bag', g => { box(g, .2, .26, .12, mat(0xf2ede0, .85), 0, -.16, .02); });
  if (key === 'gino') hold('bread', g => { const l = cyl(g, .045, .045, .42, mat(0xc9924e, .8), 0, -.02, .1, 10); l.rotation.x = Math.PI / 2; });
  if (key === 'tony') hold('briefcase', g => { box(g, .44, .32, .1, mat(0x2a1a12, .5), 0, -.22, 0); box(g, .12, .03, .03, mat(0x111, .4), 0, -.04, 0); });
  if (key === 'tonyb') hold('briefcase', g => { box(g, .44, .32, .1, mat(0x2a1a12, .5), 0, -.22, 0); box(g, .12, .03, .03, mat(0x111, .4), 0, -.04, 0); });
  if (key === 'bobby') hold('rifle', g => { tube(g, V(0, -.05, -.25), V(0, .02, .75), .02, mat(0x2a2522, .5, .4)); box(g, .05, .1, .32, mat(0x5a3a22, .7), 0, -.06, -.3); });
  return r;
}

/* ---------- people ---------- */
export function person(key, looks, card) {
  const p = cast[key] ?? (cast[key] = { key, variants: {}, rig: null, look: null, pose: 'stand', yaw: 0, pitch: 0, idleYaw: 0, idlePitch: 0, idleRoll: 0,
    react: null, reactUntil: 0, focus: null, controlled: false, pos: V(), rot: 0, hy: .45, walker: null, visible: false, card: null });
  for (const l of looks) if (!p.variants[l]) {
    const r = build(key, l); r.root.visible = false; p.variants[l] = r;
    if (card) hotspot(r.root, { title: () => card(l)[0], text: () => card(l)[1], action: () => app.emit('cast:click', key) });
  }
  return p;
}

/* where a person is, in the world or in a parent's frame, and what they are doing */
export function stage(key, { look, pos, rot = 0, pose = 'stand', hy, focus = null, visible = true, parent = null }) {
  const p = cast[key]; if (!p) return;
  for (const [l, r] of Object.entries(p.variants)) r.root.visible = visible && l === look;
  p.look = look; p.rig = p.variants[look]; p.visible = visible;
  if (!p.rig) return;
  const par = parent ?? app.place?.people ?? app.root;
  if (p.rig.root.parent !== par) par.add(p.rig.root);
  p.parent = parent; p.pos.copy(pos); p.rot = rot; p.pose = pose; p.hy = hy ?? (pose === 'sit' ? .46 : .45); p.focus = focus;
  p.rig.root.position.copy(pos);
  if (!parent && app.terrain) p.rig.root.position.y = (app.place?.floorAt?.(pos.x, pos.z) ?? app.terrain.heightAt(pos.x, pos.z));
  p.rig.root.rotation.set(0, rot, 0);
  for (const g of Object.values(p.rig.props)) g.visible = false;
  p.controlled = false; p.walker = null;
}
export function hide(key) { const p = cast[key]; if (!p) return; for (const r of Object.values(p.variants)) r.root.visible = false; p.visible = false; p.walker = null; }
export function react(key, target, secs = 2.5) { const p = cast[key]; if (p) { p.react = target; p.reactUntil = app.time + secs; } }

/* ---------- poses ---------- */
const tmp = V(), q0 = new THREE.Quaternion(), e0 = new THREE.Euler();
function look(p, dt) {
  const r = p.rig; let yaw = 0, pitch = 0;
  const f = app.time < p.reactUntil ? p.react : (typeof p.focus === 'function' ? p.focus() : p.focus);
  if (f) {
    r.head.getWorldPosition(tmp);
    const dx = f.x - tmp.x, dz = f.z - tmp.z, dy = f.y - tmp.y;
    r.root.getWorldQuaternion(q0); e0.setFromQuaternion(q0, 'YXZ');
    yaw = clamp(wrapAngle(Math.atan2(dx, dz) - e0.y - r.spine.rotation.y), -1.2, 1.2);
    pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -.6, .6);
  }
  p.yaw = damp(p.yaw, yaw, 5, dt); p.pitch = damp(p.pitch, pitch, 5, dt);
  r.head.rotation.set(p.pitch + p.idlePitch + (r.talking ? Math.sin(app.time * 11) * .05 : 0), p.yaw + p.idleYaw, p.idleRoll);
}
export const POSES = {
  stand(p, t, calm) {
    const r = p.rig; r.setSit(0, 0); r.walk(0, 0);
    const b = Math.sin(t * 1.3 + p.key.length) * calm;
    r.armL.sh.rotation.set(.05 * b, 0, .1); r.armR.sh.rotation.set(-.05 * b, 0, -.1);
    r.armL.el.rotation.set(-.2, 0, 0); r.armR.el.rotation.set(-.2, 0, 0);
    r.spine.rotation.set(.01 * b, 0, 0); p.idlePitch = 0; p.idleRoll = .02 * b; p.idleYaw = 0;
  },
  /* cold: arms wrapped round, shoulders up, a shiver */
  cold(p, t, calm) {
    const r = p.rig; r.setSit(0, 0); r.walk(0, 0);
    const sh = Math.sin(t * 31) * .012 * calm;
    r.armL.sh.rotation.set(-.55, 0, .35); r.armL.el.rotation.set(-1.9, 0, -.4);
    r.armR.sh.rotation.set(-.55, 0, -.35); r.armR.el.rotation.set(-1.9, 0, .4);
    r.spine.rotation.set(.12 + sh, 0, sh); p.idlePitch = .12; p.idleRoll = sh; p.idleYaw = 0;
  },
  aim(p, t, calm) {
    const r = p.rig; POSES.stand(p, t, calm);
    r.armR.sh.rotation.set(-1.5, 0, 0); r.armR.el.rotation.set(0, 0, 0);
    r.armL.sh.rotation.set(-1.38, 0, .42); r.armL.el.rotation.set(-.3, 0, 0);
  },
  point(p, t, calm) { const r = p.rig; POSES.stand(p, t, calm); r.armR.sh.rotation.set(-1.45, 0, -.1); r.armR.el.rotation.set(-.1, 0, 0); r.armR.hand.rotation.set(0, 0, 0); },
  phone(p, t, calm) { const r = p.rig; POSES.stand(p, t, calm); r.armL.sh.rotation.set(-.35, 0, .55); r.armL.el.rotation.set(-2.3, 0, -.5); p.idlePitch = .08; },
  dig(p, t, calm) {
    const r = p.rig; r.setSit(0, 0); r.walk(0, 0);
    const ph = (t * .9) % 1, k = Math.sin(ph * Math.PI * 2);
    r.spine.rotation.set(.35 + .2 * k, 0, 0);
    r.armR.sh.rotation.set(-.9 - .5 * k, 0, -.1); r.armR.el.rotation.set(-.6, 0, 0);
    r.armL.sh.rotation.set(-1.1 - .4 * k, 0, .2); r.armL.el.rotation.set(-.4, 0, 0);
    p.idlePitch = .3;
  },
  hands(p, t, calm) { const r = p.rig; POSES.stand(p, t, calm); r.armL.sh.rotation.set(.35, 0, .05); r.armR.sh.rotation.set(.35, 0, -.05); r.armL.el.rotation.set(-.1, 0, 0); r.armR.el.rotation.set(-.1, 0, 0); },
  sit(p, t, calm) {
    const r = p.rig; r.setSit(1, p.hy);
    const b = Math.sin(t * .9 + p.key.length) * calm;
    r.spine.rotation.set(-.12, 0, 0);
    r.armL.sh.rotation.set(-.45, 0, .18); r.armL.el.rotation.set(-.8, 0, 0);
    r.armR.sh.rotation.set(-.45, 0, -.18); r.armR.el.rotation.set(-.8 + .05 * b, 0, 0);
    p.idlePitch = -.05; p.idleYaw = .06 * b; p.idleRoll = .02 * b;
  },
  /* waist-deep in the pool, the robe spread on the water, bread held out */
  wade(p, t, calm) {
    const r = p.rig; POSES.stand(p, t, calm);
    r.armR.sh.rotation.set(-1.05, 0, -.15); r.armR.el.rotation.set(-.35, 0, 0);
    r.armL.sh.rotation.set(-.55 + Math.sin(t * .8) * .05, 0, .5); r.armL.el.rotation.set(-.4, 0, 0);
    if (r.robe) r.robe.forEach((pv, i) => { pv.rotation.set(-1.25 + Math.sin(t * .9 + i) * .08, 0, (i ? -1 : 1) * -.55); });
    r.spine.rotation.x = .12; p.idlePitch = .3;
  },
  /* at the grill: a hand out over it */
  grill(p, t, calm) { const r = p.rig; POSES.stand(p, t, calm); r.armR.sh.rotation.set(-.9, 0, -.1); r.armR.el.rotation.set(-.5, 0, 0); r.spine.rotation.x = .1; p.idlePitch = .35; },
  chat(p, t, calm) {
    const r = p.rig; POSES.stand(p, t, calm);
    const k = Math.sin(t * 1.9 + p.key.length * 1.7) * calm;
    r.armR.sh.rotation.set(-.5 - .25 * Math.max(0, k), 0, -.12); r.armR.el.rotation.set(-1.2 - .3 * k, 0, 0);
    r.armL.sh.rotation.set(-.2, 0, .12); r.armL.el.rotation.set(-1.0, 0, 0);
  },
  /* on watch: sitting on the lounge chair, the rifle upright on his lap */
  watch(p, t, calm) {
    const r = p.rig; r.setSit(1, p.hy);
    const b = Math.sin(t * .6) * calm;
    r.spine.rotation.set(-.05, 0, 0);
    r.armR.sh.rotation.set(-.55, 0, -.1); r.armR.el.rotation.set(-1.1, 0, 0);
    r.armL.sh.rotation.set(-.7, 0, .15); r.armL.el.rotation.set(-1.25, 0, 0);
    p.idlePitch = .02; p.idleYaw = .08 * b;
  },
  hands_up(p, t, calm) { const r = p.rig; POSES.stand(p, t, calm); const sh = Math.sin(t * 25) * .02 * calm; r.armL.sh.rotation.set(-2.6 + sh, 0, .35); r.armR.sh.rotation.set(-2.6 - sh, 0, -.35); r.armL.el.rotation.set(-.4, 0, 0); r.armR.el.rotation.set(-.4, 0, 0); p.idlePitch = -.05; },
  /* on one foot, holding the other */
  hop(p, t, calm) {
    const r = p.rig; r.setSit(0, 0); r.walk(0, 0);
    const k = Math.abs(Math.sin(t * 7)) * calm;
    r.body.position.y = r.standY + .06 * k; r.legL.hip.rotation.x = -.9; r.legL.knee.rotation.x = 1.5;
    r.armL.sh.rotation.set(.35, 0, .2); r.armL.el.rotation.set(-1.4, 0, 0); r.armR.sh.rotation.set(-.4, 0, -.9); r.spine.rotation.x = .35; p.idlePitch = .4;
  },
  serve(p, t, calm) { const r = p.rig; POSES.stand(p, t, calm); r.armR.sh.rotation.set(-1.25, 0, -.08); r.armR.el.rotation.set(-.35, 0, 0); r.armL.sh.rotation.set(-1.1, 0, .1); r.armL.el.rotation.set(-.45, 0, 0); r.spine.rotation.x = .12; },
  run(p, t, calm) { const r = p.rig; r.setSit(0, 0); r.walk(t * 9, 1.3); r.spine.rotation.x = .2; },
  fallen(p) {
    const r = p.rig; r.setSit(0, 0); r.walk(0, 0);
    r.body.position.y = .16; r.spine.rotation.set(-1.45, 0, .1);
    for (const L of [r.legL, r.legR]) L.hip.rotation.set(-1.5, 0, 0);
    r.armL.sh.rotation.set(-2.6, 0, .5); r.armR.sh.rotation.set(-2.4, 0, -.6);
    p.idlePitch = 0;
  },
};

/* ---------- walking and running along a path ---------- */
export function walkTo(key, points, speed = 1.3, done, face = null) {
  const p = cast[key]; if (!p?.rig) return;
  const start = p.rig.root.position.clone(); start.y = 0;
  p.walker = { path: [start, ...points.map(q => q.clone().setY(0))], seg: 0, speed, phase: 0, amt: 0, heading: p.rig.root.rotation.y, done: false, cb: done, face };
}
function stepWalker(p, dt) {
  const w = p.walker, r = p.rig, pos = r.root.position;
  let remain = w.speed * dt;
  while (remain > 0 && w.seg < w.path.length - 1) {
    const b = w.path[w.seg + 1], dx = b.x - pos.x, dz = b.z - pos.z, d = Math.hypot(dx, dz);
    if (d > 1e-4) w.heading = Math.atan2(dx, dz);
    if (d <= remain) { pos.x = b.x; pos.z = b.z; remain -= d; w.seg++; } else { pos.x += dx / d * remain; pos.z += dz / d * remain; remain = 0; }
  }
  if (w.seg >= w.path.length - 1 && !w.done) {
    w.done = true;
    if (w.face != null) w.heading = typeof w.face === 'number' ? w.face : Math.atan2(w.face.x - pos.x, w.face.z - pos.z);
    w.cb?.();
  }
  const stride = w.speed > 2.5 ? 1.9 : 1.25;
  const before = w.phase; w.phase += w.speed * dt / stride * Math.PI * 2;
  if (!w.done && Math.floor(before / Math.PI) !== Math.floor(w.phase / Math.PI)) app.emit('step', { pos, who: p.key, run: w.speed > 2.5 });
  w.amt = damp(w.amt, w.done ? 0 : 1, 8, dt);
  r.root.rotation.y = dampAngle(r.root.rotation.y, w.heading, 9, dt);
  if (!p.parent && app.terrain) pos.y = damp(pos.y, app.place?.floorAt?.(pos.x, pos.z) ?? app.terrain.heightAt(pos.x, pos.z), 14, dt);
  r.setSit(0, 0); r.walk(w.phase, w.amt * (w.speed > 2.5 ? 1.35 : 1));
  if (w.speed > 2.5) { r.spine.rotation.x = .18 * w.amt; r.armL.el.rotation.x = -1.1 * w.amt; r.armR.el.rotation.x = -1.1 * w.amt; }
  if (w.done && w.amt < .02) p.walker = null;
}

function updateCast(dt) {
  const t = app.time, calm = app.reducedMotion ? .3 : 1;
  for (const p of Object.values(cast)) {
    if (!p.rig || !p.visible) continue;
    if (p.walker) { stepWalker(p, dt); look(p, dt); continue; }
    if (p.controlled) { look(p, dt); continue; }
    (POSES[p.pose] ?? POSES.stand)(p, t, calm);
    look(p, dt);
  }
}
app.onUpdate(updateCast, 20);
export { V };
