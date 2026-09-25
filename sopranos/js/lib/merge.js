import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* Many small static meshes under a group become one mesh per material: the house's walls, frames, sills and
   muntins draw in a handful of calls. Anything marked userData.keep (it moves, glows on its own, or is clicked)
   stays as it is. */
export function bakeStatic(root, { shadows = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map(), drop = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.keep) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    if (!byMat.has(key)) byMat.set(key, { m: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
    byMat.get(key).geos.push(g); drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  const out = [];
  for (const { m, cast, recv, geos } of byMat.values()) {
    const g = mergeGeometries(geos, false); geos.forEach(x => x.dispose());
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadows && cast; mesh.receiveShadow = recv;
    root.add(mesh); out.push(mesh);
  }
  /* empty groups left behind */
  const empties = []; root.traverse(o => { if (o !== root && o.isGroup && !o.children.length && !o.userData.keep) empties.push(o); });
  for (const e of empties) e.parent?.remove(e);
  return out;
}
