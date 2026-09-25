import { app } from '../app.js';
import { emit } from './particles.js';
import { stops } from '../world/stops.js';

/* dust behind moving wheels: red at the pilot site, pale on the grassland, grey in the yard */
const COL = { pilot: [.72, .5, .38], days: [.8, .7, .52], sunset: [.62, .56, .5] };
let acc = 0;
export function buildDust() {
  app.on('dust', d => {
    acc += Math.min(1, Math.abs(d.v) / 14);
    if (acc < 1) return; acc -= 1;
    const c = COL[stops.id] ?? COL.pilot, back = Math.sign(d.v) * -3.2;
    for (const side of [-1, 1]) {
      const x = d.x + Math.cos(d.yaw) * back + Math.sin(d.yaw) * side * 1.1, z = d.z - Math.sin(d.yaw) * back + Math.cos(d.yaw) * side * 1.1;
      const y = (d.y ?? app.terrain.heightAt(x, z)) + .25;
      emit('dust', { x, y, z, vx: (Math.random() - .5) * 1.2 - Math.cos(d.yaw) * d.v * .08, vy: .4 + Math.random() * .6, vz: (Math.random() - .5) * 1.2 + Math.sin(d.yaw) * d.v * .08,
        life: 2.5 + Math.random() * 2, s0: .7, s1: 3.8 + Math.abs(d.v) * .14, a: .6, c, drag: .9, buoy: .06 });
    }
  });
}
