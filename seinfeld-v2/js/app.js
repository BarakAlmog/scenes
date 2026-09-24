/* shared state that every module reads and writes */
const params = new URLSearchParams(location.search);
const mq = q => typeof matchMedia === 'function' && matchMedia(q).matches;

export const app = {
  params,
  debug: params.has('debug'),
  clean: params.has('clean'),            /* no UI: used for preview images */
  reducedMotion: mq('(prefers-reduced-motion: reduce)'),
  touch: mq('(pointer: coarse)'),
  renderer: null, scene: null, camera: null, controls: null,
  root: null,        /* the whole model; the door burst shakes it */
  static: null,      /* furniture that never moves; merged into a few meshes after build */
  ground: null, shadowProxy: null,
  maxAniso: 4, shadowSize: 4096,
  time: 0,           /* seconds since start */
  mode: 'orbit',     /* orbit | walk | sitcom */
  stage: false, stageK: 0, cutaway: true,
  walkLocked: false,
  lastInput: 0, lastKramer: 0,
  tod: null, lights: null, materials: [], noAO: [],
  /* props other modules reach for */
  fridge: null, lamp: null, island: null, intercom: null, windowGroup: null,
  bedBlinds: null, steamAnchor: null, doorCenter: null, sconces: null,
  _updaters: [],
  _bus: new EventTarget(),
  onUpdate(fn, order = 0) {
    this._updaters.push({ fn, order });
    this._updaters.sort((a, b) => a.order - b.order);
  },
  on(type, fn) { this._bus.addEventListener(type, e => fn(e.detail)); },
  emit(type, detail) { this._bus.dispatchEvent(new CustomEvent(type, { detail })); },
};
