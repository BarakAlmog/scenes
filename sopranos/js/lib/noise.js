/* Value noise that gives the same numbers in JavaScript and in GLSL, so a cloud shadow computed on the
   CPU for the RV matches the one the ground shader draws. */
const fract = x => x - Math.floor(x);
export function hash2(x, y) {
  let px = fract(x * .1031), py = fract(y * .1031), pz = fract(x * .1031);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d; py += d; pz += d;
  return fract((px + py) * pz);
}
export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}
export function fbm(x, y, oct = 5) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); n += a; a *= .5; f *= 2.03; }
  return s / n;
}

export const NOISE_GLSL = /* glsl */`
float bbHash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float bbNoise(vec2 p) {
  vec2 i = floor(p), f = p - i, u = f * f * (3. - 2. * f);
  float a = bbHash2(i), b = bbHash2(i + vec2(1, 0)), c = bbHash2(i + vec2(0, 1)), d = bbHash2(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float bbFbm(vec2 p, int oct) {
  float s = 0., a = .5, n = 0., f = 1.;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * bbNoise(p * f); n += a; a *= .5; f *= 2.03; }
  return s / n;
}
/* cloud cover seen from the ground: 1 in the sun, down to 1 - depth under a cloud */
uniform vec4 bbCloud;      /* x cover 0..1, y scale (1/m), z depth, w softness */
uniform vec2 bbCloudOff;
float bbCloudShade(vec2 xz) {
  if (bbCloud.x <= 0.) return 1.;
  float n = bbFbm((xz + bbCloudOff) * bbCloud.y, 5);
  float c = smoothstep(1. - bbCloud.x - bbCloud.w, 1. - bbCloud.x + bbCloud.w, n);
  return 1. - c * bbCloud.z;
}
`;

/* the same cloud shade on the CPU */
export function cloudShade(x, z, cloud, off) {
  if (cloud.x <= 0) return 1;
  const n = fbm((x + off.x) * cloud.y, (z + off.y) * cloud.y, 5);
  const e0 = 1 - cloud.x - cloud.w, e1 = 1 - cloud.x + cloud.w;
  const t = Math.min(1, Math.max(0, (n - e0) / (e1 - e0)));
  return 1 - t * t * (3 - 2 * t) * cloud.z;
}
