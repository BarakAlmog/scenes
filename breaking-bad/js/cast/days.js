import * as THREE from 'three';
import { app } from '../app.js';
import { damp } from '../lib/util.js';
import { cast, stage, speak, walkTo } from './cast.js';
import { RV, rv } from '../rv/rv.js';
import { onStop, stops } from '../world/stops.js';
import { emit } from '../fx/particles.js';
import { drive, car } from '../rv/drive.js';
import * as P from '../world/props.js';
import { hotspot } from '../ctrl/hotspots.js';

/* 4 Days Out, as a goal: the keys stayed in the ignition and the battery is dead. The generator is out of gas;
   Walt siphons some from the RV, Jesse spills it, a spark sets it on fire, Jesse puts it out with their last water.
   Walt builds a mercury battery: mercuric oxide and graphite from the brake pads, zinc from coins and galvanized
   bolts, a potassium hydroxide electrolyte, copper wire. The cables go on, a spark, the key, several anxious seconds. */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const days = { step: 0, label: () => STEPS[days.step]?.label ?? 'DRIVE HOME', next: () => {}, props: null };
const STEPS = [
  { label: 'TURN THE KEY', goal: 'Tuesday, 42 pounds cooked. Time to go home. The key is in the ignition.' },
  { label: 'THE GENERATOR', goal: 'The battery is dead. The generator could charge it, but it is out of gas.' },
  { label: 'PUT IT OUT', goal: 'Fire! The only water is the drinking water.' },
  { label: 'BUILD A BATTERY', goal: 'No water, no signal, no help. Walt has an idea.' },
  { label: 'CONNECT IT', goal: 'Twelve cells in the tub. Now the cables to the RV’s battery.' },
  { label: 'START IT', goal: 'Turn the key. Come on…' },
  { label: 'DRIVE HOME', goal: 'It runs. Drive home: press R.' },
];
const goal = () => app.emit('goal', stops.id === 'days' ? { tag: `4 DAYS OUT · ${Math.min(days.step + 1, 7)}/7`, text: STEPS[days.step].goal } : null);

let fire = 0, fireLight = null;
export function buildDaysQuest(ctx) {
  const { wait, waitUntil, shot, runSeq, stageStop, toWorld, yawOut } = ctx;
  let place = null, pr = {};
  onStop({
    build(pl) {
      if (pl.id !== 'days') return;
      place = pl;
      const g = new THREE.Group(); g.name = 'days-props'; pl.groups.near.add(g);
      pr = { chairs: [P.foldingChair(), P.foldingChair(new THREE.MeshStandardMaterial({ color: 0x3f6a3a, roughness: .85 }))], gen: P.generator(), can: P.gasCan(), jug: P.waterJug(), tub: P.batteryTub(), g };
      g.add(...pr.chairs, pr.gen, pr.can, pr.jug, pr.tub);
      pr.tub.visible = false;
      fireLight = new THREE.PointLight(0xff7a2a, 0, 14, 2); g.add(fireLight);
      days.props = pr;
      hotspot(pr.gen, { title: 'The generator', text: () => days.step < 2 ? 'Out of gas. It powers the lab, and it could charge the battery.' : 'Burnt out.' });
      hotspot(pr.jug, { title: 'Water', text: () => days.step < 3 ? 'The last of their drinking water.' : 'Empty. Jesse used it on the fire.' });
      hotspot(pr.tub, { title: 'The battery', text: 'A galvanic cell: mercuric oxide and graphite from the brake pads for the cathode, zinc from coins and galvanized bolts for the anode, sponges soaked in potassium hydroxide between them, copper wire. Twelve cells in a tub.' });
    },
    enter(id) {
      if (id !== 'days') { app.emit('goal', null); return; }
      layout(); goal();
    },
    leave(id) { if (id === 'days') { fire = 0; app.emit('goal', null); } },
  });
  /* where the props stand, in the RV's frame */
  function layout() {
    const put = (o, lx, lz, ly = 0, r = 0) => { const p = toWorld(lx, 0, lz); o.position.set(p.x, app.terrain.heightAt(p.x, p.z) + ly, p.z); o.rotation.set(0, yawOut(r), 0); };
    put(pr.chairs[0], -.4, 3.8, 0, 0); put(pr.chairs[1], .9, 3.9, 0, -.15);
    put(pr.gen, 2.9, 2.6, 0, .6); put(pr.can, 2.2, 2.2, 0, 1.2); put(pr.jug, -1.8, 2.3, 0, 0); put(pr.tub, 3.6, 1.9, 0, .2);
    const gp = pr.gen.position; fireLight.position.set(gp.x, gp.y + .8, gp.z);
    pr.tub.visible = days.step >= 4; pr.tub.userData.cells.children.forEach(c => { c.visible = days.step >= 4; });
    pr.jug.visible = days.step < 3;
    if (pr.cable) pr.cable.visible = days.step >= 5;
    app.batteryOK = days.step >= 6;
  }
  /* fire on the generator, while it burns */
  app.onUpdate(dt => {
    if (stops.id !== 'days' || !pr.gen) return;
    fireLight.intensity = damp(fireLight.intensity, fire * (18 + 8 * Math.sin(app.time * 23) + 6 * Math.sin(app.time * 37)), 12, dt);
    if (fire <= .02) return;
    const p = pr.gen.position;
    for (let i = 0; i < 3; i++) emit('fire', { x: p.x + (Math.random() - .5) * .5, y: p.y + .55 + Math.random() * .2, z: p.z + (Math.random() - .5) * .4, vx: (Math.random() - .5) * .4, vy: 1.4 + Math.random() * 1.6, vz: (Math.random() - .5) * .4, life: .5 + Math.random() * .5, s0: .5 * fire, s1: .12, a: .9 * fire, c: [1, .45 + Math.random() * .25, .12], drag: 1.5, buoy: .5 });
    if (Math.random() < .5) emit('smoke', { x: p.x, y: p.y + 1.1, z: p.z, vx: .3, vy: 1.3, vz: .1, life: 4, s0: .5, s1: 3, a: .4 * fire, c: [.14, .13, .12], drag: .4, buoy: .2 });
  }, 62);

  const step = async (i, fn, finish) => { runSeq('days' + i, async () => { await fn(); days.step = i + 1; }, () => { finish?.(); layout(); goal(); app.emit('act'); }); };
  days.next = () => {
    const i = days.step, s = STEPS[i]; if (!s) return;
    const dirOut = t => toWorld(...t);
    if (i === 0) step(0, async () => {
      /* the key: a click, and nothing */
      stage('walt', { look: 'days', frame: 'rv', pos: V(3.55, .72, -.62), rot: Math.PI / 2, pose: 'drive', hy: .47 });
      shot(dirOut([2.5, 1.95, .3]), dirOut([4.3, 1.3, -.45]), { dur: 3.2, fov: 46, inside: true });
      await wait(1.2); app.emit('crank', { dead: true });
      await wait(.9); app.emit('crank', { dead: true });
      await wait(.8); speak('walt', 'Nothing.', 1.6);
      app.emit('card', { title: 'Dead', text: 'Jesse tossed the keys on the lab bench; Walt told him to put them somewhere else. He put them in the ignition, and a lamp on the dash burned all night.' });
      await wait(2.2);
    }, () => stageStop('days'));
    if (i === 1) step(1, async () => {
      /* siphon, spill, spark */
      const tankP = dirOut([-.4, 0, 1.6]), genP = pr.gen.position.clone();
      stage('walt', { look: 'days', pos: tankP, rot: yawOut(Math.PI), pose: 'crouch' });
      stage('jesse', { look: 'days', pos: dirOut([1.9, 0, 2.0]), rot: yawOut(.9), pose: 'stand' });
      shot(dirOut([6, 2.6, 7.5]), genP.clone().add(V(0, .6, 0)), { dur: 7, fov: 38, to: dirOut([4.5, 2.2, 6]) });
      speak('walt', 'Siphon some gas from the tank.', 2.4);
      await wait(2.6);
      walkTo('jesse', [genP.clone().add(V(-.7, 0, .3))], 1.2);
      await waitUntil(() => !cast.jesse.walker, 4);
      cast.jesse.pose = 'push';
      for (let k = 0; k < 18; k++) emit('smoke', { x: genP.x, y: genP.y + .7, z: genP.z, vx: (Math.random() - .5) * .4, vy: -.5, vz: (Math.random() - .5) * .4, life: .8, s0: .06, s1: .12, a: .8, c: [.8, .7, .3], drag: .5, grav: 6 });
      await wait(1.2);
      /* the spark: seen from straight above, like the show */
      shot(genP.clone().add(V(.01, 16, 0)), genP.clone(), { to: genP.clone().add(V(.01, 9, 0)), dur: 5, fov: 40 });
      await wait(.6);
      for (let k = 0; k < 40; k++) emit('spark', { x: genP.x, y: genP.y + .6, z: genP.z, vx: (Math.random() - .5) * 5, vy: Math.random() * 4, vz: (Math.random() - .5) * 5, life: .5, s0: .06, s1: .02, a: 1, c: [1, .8, .4], drag: 1, grav: 9 });
      app.emit('fire', true); fire = 1;
      react('jesse', genP.clone().add(V(0, 1, 0)), 3); cast.jesse.pose = 'stand';
      speak('jesse', 'Whoa! Whoa!', 1.8);
      await wait(3.2);
    }, () => { stageStop('days'); fire = Math.max(fire, 1); });
    if (i === 2) step(2, async () => {
      /* the last of the water */
      const genP = pr.gen.position.clone(), jugP = pr.jug.position.clone();
      stage('jesse', { look: 'days', pos: jugP.clone().add(V(.5, 0, .2)), rot: 0, pose: 'stand' });
      stage('walt', { look: 'days', pos: dirOut([.5, 0, 5.2]), rot: yawOut(Math.PI * .8), pose: 'stand', focus: () => genP.clone().add(V(0, .8, 0)) });
      shot(genP.clone().add(V(.01, 13, 0)), genP.clone(), { dur: 6, fov: 42 });
      pr.jug.visible = false; cast.jesse.rig.props.bucket.visible = true;
      walkTo('jesse', [genP.clone().add(V(-.9, 0, .4))], 2.4);
      await waitUntil(() => !cast.jesse.walker, 5);
      cast.jesse.pose = 'push';
      for (let k = 0; k < 90; k++) {
        emit('smoke', { x: genP.x - .5, y: genP.y + 1.1, z: genP.z + .2, vx: 1.6 + Math.random(), vy: -.5 + Math.random(), vz: (Math.random() - .5) * .8, life: .9, s0: .08, s1: .2, a: .7, c: [.75, .85, .95], drag: .4, grav: 9 });
        if (k % 3 === 0) await wait(.02);
      }
      fire = 0; app.emit('fire', false); app.emit('splash');
      for (let k = 0; k < 30; k++) emit('smoke', { x: genP.x, y: genP.y + .6, z: genP.z, vx: (Math.random() - .5), vy: 1 + Math.random(), vz: (Math.random() - .5), life: 3, s0: .4, s1: 2.5, a: .45, c: [.8, .8, .78], drag: .5, buoy: .3 });
      await wait(.6);
      speak('walt', 'That was our water.', 2.2); await wait(2.3);
      speak('jesse', 'Excuse me for thinking on my feet.', 2.8); await wait(2.8);
      app.emit('card', { title: 'Stranded', text: 'No phone signal. They crank the generator by hand for hours; the engine fires once and dies. Walt is coughing blood.' });
      await wait(1.5);
    }, () => { fire = 0; cast.jesse.variants.days.props.bucket.visible = false; stageStop('days'); });
    if (i === 3) step(3, async () => {
      /* the battery, cell by cell */
      const tubP = pr.tub.position.clone();
      pr.tub.visible = true; pr.tub.userData.cells.children.forEach(c => { c.visible = false; });
      stage('walt', { look: 'days', pos: tubP.clone().add(V(0, 0, -.55).applyAxisAngle(V(0, 1, 0), pr.tub.rotation.y)), rot: pr.tub.rotation.y, pose: 'crouch', focus: () => tubP });
      stage('jesse', { look: 'days', pos: tubP.clone().add(V(0, 0, .6).applyAxisAngle(V(0, 1, 0), pr.tub.rotation.y)), rot: pr.tub.rotation.y + Math.PI, pose: 'crouch', focus: () => tubP });
      speak('jesse', 'Make some kind of robot… or a new battery…', 3);
      shot(toWorld(1.4, 2.6, 5.6), tubP.clone().add(V(0, .15, 0)), { to: toWorld(2.2, 2.2, 4.8), dur: 9, fov: 34 });
      await wait(3.2);
      speak('walt', 'A battery is a galvanic cell.', 2.6);
      const cells = pr.tub.userData.cells.children;
      for (let k = 0; k < cells.length; k++) { cells[k].visible = true; app.emit('clink'); await wait(.42); }
      speak('walt', 'What shall we use to conduct this beautiful current?', 3); await wait(3.1);
      speak('jesse', 'Wire!', 1.2); await wait(1.2);
      speak('walt', 'Copper.', 1.4); await wait(1.4);
    }, () => { pr.tub.visible = true; pr.tub.userData.cells.children.forEach(c => { c.visible = true; }); stageStop('days'); });
    if (i === 4) step(4, async () => {
      /* cables to the RV's battery at the front */
      const tubP = pr.tub.position.clone(), batt = toWorld(4.55, .75, .7);
      if (!pr.cable) { pr.cable = new THREE.Group(); pr.g.add(pr.cable); }
      pr.cable.clear();
      pr.cable.add(P.cable(tubP.clone().add(V(.2, .32, 0)), batt, 0xb81c16), P.cable(tubP.clone().add(V(-.2, .32, 0)), batt.clone().add(V(0, 0, -.2)), 0x1c1c1e));
      pr.cable.visible = true;
      stage('walt', { look: 'days', pos: toWorld(5.4, 0, 1.2), rot: yawOut(-Math.PI / 2), pose: 'push', focus: () => batt });
      shot(toWorld(7.5, 1.6, 4.5), batt.clone(), { dur: 4, fov: 36 });
      await wait(1.6);
      for (let k = 0; k < 60; k++) emit('spark', { x: batt.x, y: batt.y, z: batt.z, vx: (Math.random() - .5) * 6, vy: Math.random() * 5, vz: (Math.random() - .5) * 6, life: .6, s0: .08, s1: .02, a: 1, c: [1, .85, .5], drag: 1, grav: 9 });
      app.emit('spark'); app.emit('shake', .03);
      speak('jesse', 'Whoa!', 1.2);
      await wait(2);
    }, () => { if (pr.cable) pr.cable.visible = true; stageStop('days'); });
    if (i === 5) step(5, async () => {
      /* the key again: several anxious seconds */
      stage('walt', { look: 'days', frame: 'rv', pos: V(3.55, .72, -.62), rot: Math.PI / 2, pose: 'drive', hy: .47 });
      stage('jesse', { look: 'days', pos: toWorld(3.2, 0, 2.2), rot: yawOut(-1.2), pose: 'stand', focus: () => toWorld(4.4, 1.6, -.6) });
      shot(toWorld(9, 1.7, 2.5), toWorld(3.8, 1.8, -.3), { dur: 7, fov: 32, to: toWorld(7.5, 1.7, 2) });
      await wait(1); app.emit('crank', { dead: false, long: true });
      await wait(3.4);
      app.emit('engine:start'); app.emit('shake', .02);
      rv.lights.headMat.emissiveIntensity = 3;
      await wait(.8);
      speak('jesse', 'Yeah, science!', 2.4);
      await wait(2.6);
    }, () => { app.batteryOK = true; stageStop('days'); rv.lights.headMat.emissiveIntensity = 0; });
    if (i === 6) {
      /* drive home */
      if (!drive.active) { drive.enter(); car.engine = 'running'; app.emit('engine', 'running'); app.emit('engine:start'); }
    }
  };
}
const react = (k, target, secs) => { const p = cast[k]; if (p) { p.react = target; p.reactUntil = app.time + secs; } };
export { STEPS };
