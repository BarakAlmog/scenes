/* The sky over New Mexico: the sun and the moon for a place and a moment (NOAA and Meeus low-precision
   formulas, a fraction of a degree), and the local sidereal time that turns the stars.
   Azimuths are from true north, clockwise; the world's x is east and z is south. */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sin = d => Math.sin(d * D2R), cos = d => Math.cos(d * D2R);
const norm = d => ((d % 360) + 360) % 360;

/* Julian day for a UTC time in milliseconds */
export const julian = ms => ms / 86400000 + 2440587.5;

function obliquity(T) { return 23.439291 - .0130042 * T + .00256 * cos(125.04 - 1934.136 * T); }

/* degrees: local sidereal time */
export function sidereal(jd, lon) {
  const d = jd - 2451545, T = d / 36525;
  return norm(280.46061837 + 360.98564736629 * d + .000387933 * T * T + lon);
}

function horizontal(ra, dec, jd, lat, lon) {
  const H = sidereal(jd, lon) - ra;
  const alt = Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) * R2D;
  const az = norm(Math.atan2(-sin(H), cos(lat) * Math.tan(dec * D2R) - sin(lat) * cos(H)) * R2D);
  return { alt, az, ra, dec };
}

export function sunPosition(jd, lat, lon) {
  const T = (jd - 2451545) / 36525;
  const L0 = norm(280.46646 + 36000.76983 * T), M = 357.52911 + 35999.05029 * T;
  const C = (1.914602 - .004817 * T) * sin(M) + (.019993 - .000101 * T) * sin(2 * M) + .000289 * sin(3 * M);
  const lam = L0 + C - .00569 - .00478 * sin(125.04 - 1934.136 * T), eps = obliquity(T);
  const ra = norm(Math.atan2(cos(eps) * sin(lam), cos(lam)) * R2D), dec = Math.asin(sin(eps) * sin(lam)) * R2D;
  const p = horizontal(ra, dec, jd, lat, lon);
  /* refraction lifts the sun near the horizon */
  if (p.alt > -2) p.alt += 1.02 / Math.tan((p.alt + 10.3 / (p.alt + 5.11)) * D2R) / 60;
  return p;
}

export function moonPosition(jd, lat, lon) {
  const d = jd - 2451545, T = d / 36525;
  const Lp = norm(218.3164477 + 481267.88123421 * T), D = norm(297.8501921 + 445267.1114034 * T);
  const M = norm(357.5291092 + 35999.0502909 * T), Mp = norm(134.9633964 + 477198.8675055 * T), F = norm(93.272095 + 483202.0175233 * T);
  const lam = Lp + 6.289 * sin(Mp) - 1.274 * sin(Mp - 2 * D) + .658 * sin(2 * D) + .214 * sin(2 * Mp) - .186 * sin(M) - .114 * sin(2 * F)
    - .059 * sin(2 * Mp - 2 * D) - .057 * sin(Mp - 2 * D + M) + .053 * sin(Mp + 2 * D) + .046 * sin(2 * D - M) + .041 * sin(Mp - M);
  const beta = 5.128 * sin(F) + .281 * sin(Mp + F) + .278 * sin(Mp - F) + .173 * sin(2 * D - F);
  const eps = obliquity(T);
  const ra = norm(Math.atan2(sin(lam) * cos(eps) - Math.tan(beta * D2R) * sin(eps), cos(lam)) * R2D);
  const dec = Math.asin(sin(beta) * cos(eps) + cos(beta) * sin(eps) * sin(lam)) * R2D;
  const p = horizontal(ra, dec, jd, lat, lon);
  p.alt -= .95 * cos(p.alt);   /* parallax: seen from the ground, not the earth's centre */
  return p;
}

/* a direction in world space (x east, y up, z south) from altitude and azimuth in degrees; the map grid
   is `grid` degrees clockwise of true north */
export function toWorld(alt, az, grid = 0, out = { x: 0, y: 0, z: 0 }) {
  const a = (az - grid) * D2R, e = alt * D2R;
  out.x = Math.sin(a) * Math.cos(e); out.y = Math.sin(e); out.z = -Math.cos(a) * Math.cos(e);
  return out;
}

/* Mountain Time for the date: daylight time from the second Sunday of March to the first Sunday of November */
export function utcOffset(y, m, d) {
  const nth = (month, n) => { const first = new Date(Date.UTC(y, month, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + 7 * (n - 1); };
  const t = m * 100 + d, on = 2 * 100 + nth(2, 2), off = 10 * 100 + nth(10, 1);
  return t >= on && t < off ? -6 : -7;
}

/* UTC milliseconds for a local clock hour (0..24) on a date */
export function localToUTC(y, m, d, hour) {
  return Date.UTC(y, m, d) + (hour - utcOffset(y, m, d)) * 3600000;
}
