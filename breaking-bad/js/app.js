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
  farScene: null, farCamera: null,       /* the sky, the far ring and the skyline, drawn first with their own depth range */
  root: null,        /* everything near that is not the ground */
  place: null,       /* the open stop: its ground, its date, its things */
  terrain: null,     /* the open stop's ground: heightAt(x, z) */
  rv: null, stops: null, stand: null,
  shadowFocus: null, /* where the sun's shadow box sits; the orbit target when null */
  maxAniso: 4, shadowSize: 4096,
  time: 0,           /* seconds since start */
  mode: 'orbit',     /* orbit | walk | drive | cinema | scripted */
  shoot: false, shootK: 0,
  walkLocked: false,
  lastInput: 0,
  tod: null, lights: null, materials: [], noAO: [],
  _updaters: [],
  _bus: new EventTarget(),
  onUpdate(fn, order = 0) {
    this._updaters.push({ fn, order });
    this._updaters.sort((a, b) => a.order - b.order);
  },
  on(type, fn) { this._bus.addEventListener(type, e => fn(e.detail)); },
  emit(type, detail) { this._bus.dispatchEvent(new CustomEvent(type, { detail })); },
};
