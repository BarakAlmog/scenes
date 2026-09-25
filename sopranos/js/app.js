/* shared state that every module reads and writes */
const params = new URLSearchParams(location.search);
const mq = q => typeof matchMedia === 'function' && matchMedia(q).matches;

export const app = {
  params,
  debug: params.has('debug'),
  clean: params.has('clean'),            /* no UI: used for preview images */
  reducedMotion: mq('(prefers-reduced-motion: reduce)'),
  touch: mq('(pointer: coarse)') || (params.has('debug') && params.has('touch')),   /* ?debug&touch tests the phone controls on a desktop */
  renderer: null, scene: null, camera: null, controls: null,
  farScene: null, farCamera: null,       /* the sky, the far rings and the skyline, drawn first with their own depth range */
  root: null,        /* the near world that is not the ground */
  place: null,       /* the open scene: its ground, its date, its things, its views */
  sceneId: null,
  terrain: null,     /* the open scene's ground: heightAt(x, z) */
  shadowFocus: null, /* where the sun's shadow box sits; the orbit target when null */
  maxAniso: 4, shadowSize: 4096,
  time: 0,           /* seconds since start */
  mode: 'orbit',     /* orbit | walk | game | scripted */
  walkLocked: false,
  lastInput: 0,
  tod: null, lights: null, materials: [], noAO: [], globalNoAO: [],
  exposureBase: 1, exposureK: 1, fadeK: 0, timeScale: 1, skipping: false,
  density: 1, reach: 1, merged: 0,
  vmSun: 1, vmAmbient: .35,
  _updaters: [],
  _bus: new EventTarget(),
  onUpdate(fn, order = 0) {
    this._updaters.push({ fn, order });
    this._updaters.sort((a, b) => a.order - b.order);
  },
  on(type, fn) { this._bus.addEventListener(type, e => fn(e.detail)); },
  emit(type, detail) { this._bus.dispatchEvent(new CustomEvent(type, { detail })); },
};
