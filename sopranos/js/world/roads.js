import * as THREE from 'three';
import { canvasTex, seeded } from '../lib/util.js';
import { editRing } from './terrain.js';

/* Roads on the ground: the terrain is levelled under each road and its shoulders, and the road is a ribbon a hair
   above it with its own asphalt, lines and, in winter, the plow's banks of snow along both edges. */

/* a ground-hugging mesh must face up: flip its triangles if most of them face down */
export function upright(g) {
  g.computeVertexNormals();
  const n = g.attributes.normal; let sum = 0; for (let i = 0; i < n.count; i++) sum += n.getY(i);
  if (sum < 0) {
    const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.index.needsUpdate = true; g.computeVertexNormals();
  }
  return g;
}

/* points every `step` metres along a polyline */
export function resample(pts, step = 2) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}
function smoothHeights(hs, k = 4) {
  const out = hs.slice();
  for (let i = 0; i < hs.length; i++) { let s = 0, n = 0; for (let j = -k; j <= k; j++) { const v = hs[i + j]; if (v !== undefined) { s += v; n++; } } out[i] = s / n; }
  return out;
}

/* level the ground under the roads: the road's own profile across its width, blended out over the shoulders */
export function levelRoads(T, roads, rings = [0, 1], shoulder = 4) {
  const lines = roads.map(r => {
    const pts = resample(r.pts, 2), hs = smoothHeights(pts.map(([x, z]) => T.heightAt(x, z)), 5);
    return { ...r, pts, hs };
  });
  for (const k of rings) {
    const R = T.rings[k], pad = shoulder + 8;
    for (const L of lines) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const [x, z] of L.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      if (x1 < -R.half || x0 > R.half || z1 < -R.half || z0 > R.half) continue;
      editRing(T, k, x0 - pad, z0 - pad, x1 + pad, z1 + pad, (x, z, h) => {
        let best = 1e9, hb = h;
        for (let i = 0; i < L.pts.length - 1; i++) {
          const [ax, az] = L.pts[i], [bx, bz] = L.pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
          if (d < best) { best = d; hb = L.hs[i] + (L.hs[i + 1] - L.hs[i]) * t; }
        }
        const inner = L.w / 2 + 1, outer = inner + shoulder;
        if (best > outer) return h;
        const f = best <= inner ? 1 : 1 - (best - inner) / (outer - inner), s = f * f * (3 - 2 * f);
        return h + (hb - .05 - h) * s;
      });
    }
  }
  return lines;
}

/* asphalt: grey with grit, white edge lines, a double yellow in the middle of the wider roads; in winter, salt
   stains and slush toward the edges */
export function asphaltTex({ center = true, winter = false, edges = true, tone = null } = {}) {
  const rnd = seeded(12);
  return canvasTex(256, 1024, (g, w, h) => {
    g.fillStyle = tone ?? (winter ? '#4b4b4d' : '#3d3d3f'); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 40 + rnd() * 50; g.fillStyle = `rgba(${v},${v},${v + 2},.5)`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    /* the tyre tracks are a little darker and smoother */
    for (const u of [.28, .72]) { const gr = g.createLinearGradient((u - .1) * w, 0, (u + .1) * w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(10,10,12,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    if (edges) { g.fillStyle = '#d9d6cc'; g.fillRect(w * .035, 0, w * .02, h); g.fillRect(w * .945, 0, w * .02, h); }
    if (center) { g.fillStyle = '#d8b13a'; g.fillRect(w * .475, 0, w * .016, h); g.fillRect(w * .509, 0, w * .016, h); }
    if (winter) {
      /* salt: pale streaks; slush and packed snow along the edges */
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(215,215,210,${.05 + rnd() * .1})`; const x = rnd() * w; g.fillRect(x, rnd() * h, 2 + rnd() * 8, 20 + rnd() * 120); }
      for (const side of [0, 1]) for (let i = 0; i < 400; i++) {
        const x = side ? w - rnd() * rnd() * w * .16 : rnd() * rnd() * w * .16;
        g.fillStyle = `rgba(232,236,240,${.35 + rnd() * .5})`; g.beginPath(); g.ellipse(x, rnd() * h, 3 + rnd() * 9, 6 + rnd() * 22, 0, 0, 7); g.fill();
      }
    }
  });
}

/* a plowed lot: grey asphalt under a thin packed crust, the plow's passes and tyre tracks, patches of snow */
export function lotTex() {
  const rnd = seeded(77);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#56575a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) { const v = 60 + rnd() * 50; g.fillStyle = `rgba(${v},${v},${v + 3},.45)`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(228,232,236,${.25 + rnd() * .5})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 40, 4 + rnd() * 22, rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 16; i++) { g.strokeStyle = `rgba(40,40,44,${.15 + rnd() * .2})`; g.lineWidth = 6 + rnd() * 6; g.beginPath(); const y = rnd() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + (rnd() - .5) * 120, w * .7, y + (rnd() - .5) * 120, w, y + (rnd() - .5) * 60); g.stroke(); }
  });
}

/* a ribbon along a road: u across, v along in metres/8 */
export function roadRibbon(T, line, material, { lift = .03, edge = 0 } = {}) {
  const pts = line.pts, pos = [], uv = [], idx = [];
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i], [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
    let dx = nx - px, dz = nz - pz; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const ox = -dz, oz = dx, hw = line.w / 2 + edge;
    if (i > 0) dist += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    for (const s of [-1, 1]) {
      const X = x + ox * hw * s, Z = z + oz * hw * s;
      pos.push(X, T.heightAt(X, Z) + lift, Z); uv.push(s < 0 ? 0 : 1, dist / 8);
    }
    if (i > 0) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); upright(g);
  const m = new THREE.Mesh(g, material); m.receiveShadow = true; m.userData.keep = true;
  return m;
}

/* the plow's banks: a soft ridge of snow along each edge, broken where another road or a drive joins */
export function snowBanks(T, line, material, { gaps = [], height = .75, width = 2.4 } = {}) {
  const pts = line.pts, group = new THREE.Group();
  const prof = [[0, .02], [.35, .45], [.9, 1], [1.5, .75], [2.4, 0]];
  const cols = prof.length;
  const gapAt = (x, z) => gaps.some(([gx, gz, r]) => Math.hypot(x - gx, z - gz) < r);
  for (const s of [-1, 1]) {
    const pos = [], idx = [], base = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
      let dx = nx - px, dz = nz - pz; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const ox = -dz * s, oz = dx * s, e = line.w / 2;
      /* the bank wanders: higher where the plow piled it, lower at the gaps */
      const wob = .75 + .5 * Math.sin(i * .37 + s) * Math.sin(i * .11 + 2);
      const k = gapAt(x, z) ? .08 : 1;
      for (const [d, hh] of prof) {
        const X = x + ox * (e + d * width / 2.4), Z = z + oz * (e + d * width / 2.4);
        pos.push(X, T.heightAt(X, Z) + hh * height * wob * k, Z);
      }
      if (i > 0) for (let c = 0; c < cols - 1; c++) {
        const a = base + (i - 1) * cols + c, b = a + cols;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); upright(g);
    const m = new THREE.Mesh(g, material); m.receiveShadow = true; m.castShadow = true; m.userData.keep = true;
    group.add(m);
  }
  group.userData.keep = true;
  return group;
}

/* a flat area (a parking lot) from a polygon, draped on the ground */
export function patch(T, poly, material, { lift = .03, uvScale = .1 } = {}) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ShapeGeometry(shape, 1);
  /* subdivide by re-triangulating on a grid would be finer; the lot is nearly flat, so the polygon is enough */
  const p = g.attributes.position, uv = g.attributes.uv;
  const verts = [];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getY(i); verts.push(x, T.heightAt(x, z) + lift, z); uv.setXY(i, x * uvScale, z * uvScale); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setAttribute('uv', uv);
  out.setIndex([...g.index.array]);
  upright(out);
  const m = new THREE.Mesh(out, material); m.receiveShadow = true; m.userData.keep = true;
  return m;
}
