import * as THREE from 'three';
import { mat } from './util.js';
import * as TX from './textures.js';

/* the palette; filled by initMaterials() once the renderer knows its anisotropy */
export const MAT = {};

const std = o => new THREE.MeshStandardMaterial(o);

export function initMaterials() {
  Object.assign(MAT, {
    base: mat(0x8b8177, .9), wains: mat(0xa49b90, .88), rail: mat(0xcdc6ba, .85), upper: mat(0xf4f2ec, .92),
    plain: mat(0xe6e2da, .92), skin: mat(0xf7f6f2, .9),
    woodDark: mat(0x5a432f, .7), woodMid: mat(0x8a653f, .7), black: mat(0x232325, .6),
    couch: mat(0x7d99b8, .95), couchD: mat(0x7090ab, .95),
    white: mat(0xf3f2ee, .6), cream: mat(0xefe9da, .8),
    brass: mat(0xb08c44, .35, .8), steel: mat(0xb9bcc0, .4, .7),
    navy: mat(0x46506b, .85), royal: mat(0x3b59a3, .8), green: mat(0x4fc24a, .5, .15),
    hallLow: mat(0x5f3a38, .85), hallUp: mat(0xe9dfc9, .9),
    duvet: mat(0x8fa3b8, .95), sheet: mat(0xf1efe8, .9), porcelain: mat(0xf6f6f2, .25),
  });
  MAT.glass = std({ color: 0xcfe4ef, roughness: .1, metalness: 0, transparent: true, opacity: .32 });
  MAT.wallSkin = std({ color: 0xf7f6f2, roughness: .9 });   /* outer faces of walls: plywood in stage mode */
  MAT.slab = std({ color: 0xf7f6f2, roughness: .9 });
  MAT.poche = std({ color: 0x3b3631, roughness: .8 });      /* cut tops of walls */
  MAT.door = mat(0x9a9189, .8); MAT.doorPanel = mat(0x8f877f, .85);

  const plaster = TX.plasterNormal(), fabric = TX.fabricNormal();
  const withNormal = (m, t, s) => { m.normalMap = t; m.normalScale.set(s, s); };
  withNormal(MAT.wains, TX.panelNormal(), .7);
  for (const m of [MAT.upper, MAT.plain, MAT.wallSkin, MAT.hallUp, MAT.hallLow]) withNormal(m, plaster, .35);
  for (const m of [MAT.couch, MAT.couchD, MAT.duvet]) withNormal(m, fabric, .45);

  const wood = TX.woodFloor();
  MAT.floorWood = std({ map: wood.map, normalMap: wood.normal, roughness: .62, color: 0xffffff });
  MAT.floorWood.normalScale.set(.5, .5);
  const tile = (base, grout) => { const t = TX.tiles(base, grout); return std({ map: t.map, normalMap: t.normal, roughness: .55 }); };
  MAT.tileTan = tile('#d9c7a5', '#c2ad87');
  MAT.tileBath = tile('#cfd4cd', '#b5bcb6');
  const bw = TX.tiles('#e9ece6', '#c9cec8', 1 / .6);
  MAT.bathTile = std({ map: bw.map, normalMap: bw.normal, roughness: .35 });
  const rug = TX.rug();
  MAT.rug = std({ map: rug.map, normalMap: rug.normal, roughness: .95 });
  const hc = TX.hallCarpet();
  MAT.hallCarpet = std({ map: hc.map, normalMap: hc.normal, roughness: .95 });
  return MAT;
}
