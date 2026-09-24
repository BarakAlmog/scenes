import * as THREE from 'three';
import { keep } from '../lib/util.js';

/* clickable things: { obj, title, text (string or fn), action?() } */
export const hotspots = [];

export function hotspot(obj, info) {
  keep(obj);
  info.obj = obj;
  obj.userData.hotspot = info;
  hotspots.push(info);
  return obj;
}

/* an invisible, larger target for small props */
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
export function hitBox(parent, w, h, d, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
  m.position.set(x, y, z); m.userData.hitOnly = true; parent.add(m);
  return m;
}
