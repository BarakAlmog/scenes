import * as THREE from 'three';
import { mat } from './util.js';
import * as TX from './textures.js';

/* the palette; filled by initMaterials() once the renderer knows its anisotropy */
export const MAT = {};

/* flat wall colours, baked into vertex colours on one shared material (see walls.js) */
export const PAINT = {
  mBase: 0x7a6cab, mPurple: 0x8e84c4, mCrown: 0xe9dcb6, mTop: 0xefe3c1, pine: 0x2f5b47,
  mauve: 0xcf9fa5, rose: 0xd8aa9e,
  cBase: 0xf1eee4, cream: 0xe7dec7, cCrown: 0xf3efe5, blueGrey: 0xb9c3c6, tan: 0xd9c5a1,
  hBase: 0x2f261b, hRail: 0x463827, hPlaster: 0xe6d8a4,
  plain: 0xe6e2da, poche: 0x3b3631,
};

const std = o => new THREE.MeshStandardMaterial(o);

export function initMaterials() {
  const plaster = TX.plasterNormal(), fabric = TX.fabricNormal();
  const withNormal = (m, t, s) => { m.normalMap = t; m.normalScale.set(s, s); return m; };

  MAT.paint = withNormal(std({ vertexColors: true, roughness: .9 }), plaster, .35);
  MAT.wallSkin = withNormal(std({ color: 0xf7f6f2, roughness: .9 }), plaster, .35);   /* outer faces: plywood on the stage */
  MAT.slab = std({ color: 0xf7f6f2, roughness: .9 }); MAT.slab.userData.live = true;   /* turns dark on the stage */
  MAT.poche = std({ color: 0x3b3631, roughness: .8 });                                 /* cut tops of walls */
  MAT.glass = std({ color: 0xcfe4ef, roughness: .18, metalness: 0, transparent: true, opacity: .13, depthWrite: false });

  /* walls with texture */
  const brick = TX.brick(['#a4523b', '#93472f', '#b0624a', '#86412f', '#9d5a43', '#a95a3c'], '#cbbfae');
  MAT.brick = std({ map: brick.map, normalMap: brick.normal, roughness: .92 }); MAT.brick.normalScale.set(.8, .8);
  const brickO = TX.brick(['#7c4033', '#6c382d', '#86493a', '#744136'], '#9b9186');
  MAT.brickOut = std({ map: brickO.map, normalMap: brickO.normal, roughness: .95 }); MAT.brickOut.normalScale.set(.8, .8);
  const wt = TX.tiles('#f1f0ea', '#cfd0ca', 1 / .6);
  MAT.tileW = std({ map: wt.map, normalMap: wt.normal, roughness: .3 });
  MAT.wains = withNormal(mat(0x4b4030, .75), TX.panelNormal(), .8);

  /* woods, metals, paints */
  Object.assign(MAT, {
    white: mat(0xf3f2ee, .55), cream: mat(0xefe8d8, .75), black: mat(0x232325, .6),
    woodDark: mat(0x5a3f2a, .65), woodMid: mat(0x8f6a43, .6), woodHoney: mat(0xb9844a, .5), woodPale: mat(0xd7bb8d, .55),
    woodRustic: mat(0x8a6a4a, .85), oak: mat(0xc9a36e, .55),
    brass: mat(0xc49a4a, .32, .85), steel: mat(0xbcc0c4, .32, .75), chrome: mat(0xdfe3e6, .15, .95), iron: mat(0x1f1f21, .55, .5),
    porcelain: mat(0xf6f6f2, .22),
    teal: mat(0x3fa3a8, .55), tealD: mat(0x2f8589, .6), mYellow: mat(0xf2c83a, .45), purpleDoor: mat(0x8a80c2, .75),
    greenDoor: mat(0x1f5a44, .55), creamDoor: mat(0xe6dcc0, .7), pine: mat(0x2f5b47, .7),
    khaki: mat(0xbdb79a, .6), khakiD: mat(0xa9a386, .65),
    counterW: mat(0xf2efe6, .35), butcher: mat(0xb97d45, .5),
    leather: mat(0x5a3521, .5), leatherD: mat(0x3e2416, .55), mustard: mat(0xd9ad3c, .55),
    couchW: withNormal(mat(0xf2ede1, .95), fabric, .45), couchCream: withNormal(mat(0xe9dcc3, .95), fabric, .45),
    sheet: mat(0xf3f0e8, .9),
  });
  MAT.door = MAT.purpleDoor;

  /* floors */
  const hb = TX.herringbone();
  MAT.floorM = std({ map: hb.map, normalMap: hb.normal, roughness: .5 }); MAT.floorM.normalScale.set(.6, .6);
  const bw = TX.basketweave();
  MAT.floorG = std({ map: bw.map, normalMap: bw.normal, roughness: .55 }); MAT.floorG.normalScale.set(.6, .6);
  MAT.checker = std({ map: TX.checker(), roughness: .3 });
  const gt = TX.tiles('#f4f3ee', '#c9cac4', 1 / .3);
  MAT.floorBathG = std({ map: gt.map, normalMap: gt.normal, roughness: .35 });
  MAT.hallFloor = std({ map: TX.speckle('#8c8b88', ['#6f6e6b', '#a5a39e', '#7d7a74'], 1.5), roughness: .85 });
  MAT.carpetM = withNormal(std({ color: 0xe2d5bd, roughness: 1 }), TX.pileNormal(6), .6);
  MAT.carpetR = withNormal(std({ color: 0xd9c9b3, roughness: 1 }), TX.pileNormal(6), .6);
  MAT.carpetC = withNormal(std({ color: 0x9aa4a8, roughness: 1 }), TX.pileNormal(6), .6);
  MAT.carpetJ = withNormal(std({ color: 0x8f7a60, roughness: 1 }), TX.pileNormal(6), .6);
  MAT.tar = std({ map: TX.speckle('#4a4846', ['#3a3836', '#5d5a56'], 1), roughness: .95 });
  MAT.court = std({ color: 0x2a2826, roughness: 1 });

  const rf = TX.rugFloral(); MAT.rugM = std({ map: rf.map, normalMap: rf.normal, roughness: .98 });
  const rz = TX.rugZigzag(); MAT.rugG = std({ map: rz.map, normalMap: rz.normal, roughness: .98 });
  MAT.drapeM = std({ map: TX.floralDrape(), roughness: .92, side: THREE.DoubleSide });
  MAT.drapeG = std({ map: TX.plaid('#8d9a8c', '#5b6a5c', '#d8d4c4'), roughness: .92, side: THREE.DoubleSide });
  return MAT;
}
