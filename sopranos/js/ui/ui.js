import { app } from '../app.js';
import { flyTo, view, writeHash } from '../ctrl/camera.js';
import { tod, setHour } from '../world/lighting.js';
import { SCENES, scenes, openScene, nextScene, byId } from '../scenes.js';
import { fps } from '../ctrl/fps.js';
import { seq, skip } from '../seq.js';
import { toggleSound } from '../audio.js';
import { post, renderFrame } from '../fx/post.js';

const $ = s => document.querySelector(s);
const press = (el, on) => el.setAttribute('aria-pressed', on ? 'true' : 'false');
export const clockText = h => {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60), ap = hh < 12 ? 'AM' : 'PM', h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
};

function flash() { const f = document.createElement('div'); f.id = 'flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 500); }

/* a picture of the current view, framed like a film still with the episode under it */
export function photo() {
  const sel = post.outline.selectedObjects; post.outline.selectedObjects = [];
  renderFrame(0);
  const src = app.renderer.domElement, W = src.width, H = src.height;
  const pad = Math.round(Math.min(W, H) * .035), cap = Math.round(pad * 2.4);
  const c = document.createElement('canvas'); c.width = W + pad * 2; c.height = H + pad * 2 + cap;
  const g = c.getContext('2d');
  g.fillStyle = '#141211'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, pad, pad);
  post.outline.selectedObjects = sel;
  g.textBaseline = 'middle';
  const y = H + pad + cap / 2 + pad * .2;
  g.textAlign = 'left'; g.fillStyle = '#f3ece0'; g.font = `700 ${Math.round(cap * .34)}px Fraunces, Georgia, serif`;
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(cap * .07)}px`;
  g.fillText('THE SOPRANOS', pad, y);
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(cap * .04)}px`;
  const d = byId[scenes.id];
  g.textAlign = 'right'; g.fillStyle = '#a99c8e'; g.font = `500 ${Math.round(cap * .19)}px Inter, Arial, sans-serif`;
  g.fillText(`${d.ep} · ${d.title.toUpperCase()} · ${d.where.toUpperCase()}${app.place?.outdoor !== false ? ' · ' + clockText(tod.hour) : ''}`, c.width - pad, y);
  c.toBlob(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `sopranos-${scenes.id}.png`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, 'image/png');
  flash();
  app.emit('photo');
}

/* the help, per scene: the scene adds its own lines */
const HELP = [
  ['Drag', 'Orbit. Right-drag or two fingers to pan.'],
  ['Scroll / pinch', 'Zoom in and out.'],
  ['Click a thing', 'People and things tell you about themselves.'],
  ['1 – 5', 'The views of this scene.'],
  ['[ ]', 'The scenes: Pine Barrens, the ducks, the bear, the bakery, the Inn.'],
  ['Space', 'Play the scene. In a cutscene, Space skips it.'],
  ['T', 'Play the day; the slider sets the hour. The sun, the moon and the stars are the real ones for the place and the date.'],
  ['F', 'Walk: WASD or arrows, Shift to hurry, Esc to stop.'],
  ['M · P', 'Sound on or off · save a picture.'],
];
function fillHelp() {
  const dl = $('#help-list'); dl.innerHTML = '';
  for (const [k, v] of [...(app.place?.help ?? []), ...HELP]) {
    const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd);
  }
}
function toggleHelp(on) {
  const h = $('#help'), show = on ?? h.hidden;
  if (show) fillHelp();
  h.hidden = !show; press($('#b-help'), show);
}

export function buildUI() {
  if (app.clean) document.body.classList.add('clean');
  if (app.touch) document.body.classList.add('touch');
  const busy = () => app.mode === 'scripted' || app.mode === 'game' || scenes.busy;

  /* the scenes */
  document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => { if (busy()) return; if (fps.on) fps.exit(true); openScene(b.dataset.scene); }));

  /* views: built for each scene */
  const vbox = $('#views .grp');
  const markView = () => vbox.querySelectorAll('button').forEach(b => press(b, !view.moved && view.name === b.dataset.view));
  app.on('scene', () => {
    vbox.innerHTML = '';
    const order = app.place.viewOrder ?? Object.keys(app.place.views);
    order.forEach((name, i) => {
      const v = app.place.views[name], b = document.createElement('button');
      b.type = 'button'; b.dataset.view = name; b.title = `${v.label} (${i + 1})`; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<svg viewBox="0 0 24 24">${v.icon ?? '<circle cx="12" cy="12" r="8"/>'}</svg><span></span>`;
      b.querySelector('span').textContent = v.label;
      b.addEventListener('click', () => { if (busy()) return; if (fps.on) fps.exit(true); flyTo(name); });
      vbox.appendChild(b);
    });
    markView();
    $('.grp.time').hidden = app.place.outdoor === false;
    syncAct(); fillHelp();
  });
  app.on('view', markView);
  app.controls.addEventListener('start', () => { view.moved = true; markView(); });

  /* time of day */
  const hour = $('#hour'), clock = $('#clock'), play = $('#b-play');
  const showHour = h => { hour.value = String(h); clock.value = clockText(h); clock.textContent = clockText(h); };
  hour.addEventListener('input', () => { tod.playing = false; press(play, false); setHour(parseFloat(hour.value)); });
  hour.addEventListener('change', () => writeHash());
  let lastShown = -1;
  app.on('hour', h => { if (Math.abs(h - lastShown) > .015) { lastShown = h; showHour(h); } });
  showHour(tod.hour);
  play.addEventListener('click', () => { if (busy()) return; tod.playing = !tod.playing; press(play, tod.playing); if (!tod.playing) writeHash(); });

  /* modes */
  const bWalk = $('#b-walk'), bSound = $('#b-sound'), bHelp = $('#b-help'), bAct = $('#act'), actLabel = $('#act-label');
  bWalk.addEventListener('click', () => { if (busy()) return; fps.on ? fps.exit() : fps.enter({ mode: 'walk' }); });
  bSound.addEventListener('click', () => toggleSound());
  $('#b-photo').addEventListener('click', photo);
  bHelp.addEventListener('click', () => toggleHelp());
  $('#help .x').addEventListener('click', () => toggleHelp(false));
  const act = () => {
    if (seq.running) { skip(); return; }
    const a = app.place?.act; if (!a) return;
    if (a.busy?.()) { a.stop?.(); return; }
    if (fps.on && app.mode === 'walk') fps.exit(true);
    a.run();
  };
  bAct.addEventListener('click', act);
  const syncAct = () => {
    const a = app.place?.act;
    actLabel.textContent = seq.running?.skippable ? 'SKIP' : a?.label?.() ?? byId[scenes.id]?.act ?? 'PLAY';
    bAct.classList.toggle('busy', !!seq.running || !!a?.busy?.());
    bAct.title = seq.running ? 'Skip (Space)' : (a?.title?.() ?? 'Play the scene (Space)');
  };
  for (const ev of ['act', 'scripted', 'game']) app.on(ev, syncAct);
  app.on('sound', on => press(bSound, on));
  app.on('scripted', on => document.body.classList.toggle('scripted', on));
  app.on('game', on => document.body.classList.toggle('game', !!on));

  /* first person overlay */
  const wui = $('#walk-ui'), whelp = $('.walk-help'), cross = $('#walk-ui .cross'), joyEl = $('#joy'), knob = $('#joy span'), fire = $('#fire'), use = $('#use');
  let noLock = false, mode = 'walk';
  const walkText = () => app.place?.walkHelp?.(mode, app.walkLocked, noLock) ?? (app.touch ? 'Left thumb to move · right thumb to look · tap things'
    : app.walkLocked ? 'WASD to move · Shift to hurry · click things · Esc to stop'
    : noLock ? 'Drag to look · WASD to move · Shift to hurry · Esc to stop' : 'Click to look around, or drag · WASD to move');
  app.on('fps', f => {
    mode = f.mode ?? 'walk';
    press(bWalk, f.on && mode === 'walk'); wui.hidden = !f.on; document.body.classList.toggle('walking', f.on && mode === 'walk');
    whelp.textContent = walkText(); fire.hidden = !(f.on && f.gun && app.touch);
    whelp.hidden = f.on && mode === 'game' && app.walkLocked;
  });
  app.on('walk:lock', () => { whelp.textContent = walkText(); whelp.hidden = mode === 'game'; });
  app.on('walk:unlock', () => { whelp.textContent = walkText(); whelp.hidden = false; });
  app.on('walk:nolock', () => { noLock = true; whelp.textContent = walkText(); });
  app.on('use', label => { use.hidden = !(label && app.touch); if (label) use.textContent = label; });
  app.renderer.domElement.addEventListener('click', () => { if (fps.on && !app.walkLocked && !fps.frozen) fps.lock(); });
  $('#walk-exit').addEventListener('click', () => { if (app.mode === 'game') app.place?.act?.stop?.(); else fps.exit(); });
  app.on('crosshair', on => cross.classList.toggle('on', on));
  app.on('joy', j => {
    joyEl.classList.toggle('on', j.on);
    if (j.x != null) { joyEl.style.left = j.x + 'px'; joyEl.style.top = j.y + 'px'; }
    if (j.dx != null) knob.style.transform = `translate(${j.dx * 34}px, ${j.dy * 34}px)`;
    if (!j.on) knob.style.transform = '';
  });

  /* the dock, a choice, the goal line and the gauges change height with the mode: the page keeps their heights in CSS,
     so the captions, the card and the touch buttons stand clear of them */
  const rootStyle = document.documentElement.style, hOf = el => Math.round(el.getBoundingClientRect().height);
  const measure = () => {
    rootStyle.setProperty('--dock-h', `${hOf($('#dock'))}px`);
    const c = hOf($('#choice')), g = hOf($('#goal')), h = hOf($('#hud'));
    rootStyle.setProperty('--choice-h', c ? `${c + 12}px` : '0px');
    rootStyle.setProperty('--goal-h', g ? `${g + 10}px` : '0px');
    rootStyle.setProperty('--hud-h', h ? `${h + 10}px` : '0px');
  };
  const sizes = new ResizeObserver(measure);
  for (const s of ['#dock', '#choice', '#goal', '#hud']) sizes.observe($(s));
  measure();

  /* the card and the tooltip */
  const card = $('#card'), tip = $('#tip');
  app.on('card', c => {
    if (!c) { card.hidden = true; return; }
    card.querySelector('h2').textContent = c.title; card.querySelector('p').textContent = c.text ?? '';
    card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  });
  card.querySelector('.x').addEventListener('click', () => { card.hidden = true; });
  app.on('tip', t => { if (!t) { tip.hidden = true; return; } tip.textContent = t.title; tip.hidden = false; tip.style.transform = `translate(${t.x + 14}px, ${t.y + 12}px)`; });

  /* the hint, once */
  const hint = $('#hint');
  hint.textContent = app.touch ? 'Drag to look around · tap things' : 'Drag to look around · click things · Space plays the scene';
  setTimeout(() => hint.classList.add('gone'), 9000);

  /* keys */
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' || k === 'Spacebar') { if (app.mode === 'game' && !seq.running) return; e.preventDefault(); act(); return; }
    if (k === 'Escape') { if (seq.running) { skip(); return; } if (!$('#help').hidden) { toggleHelp(false); return; } if (app.mode === 'game') { app.place?.act?.pause?.(); return; } if (fps.on) fps.exit(); return; }
    if (busy()) { if (k === 'm' || k === 'M') toggleSound(); return; }
    if (k >= '1' && k <= '9') { const order = app.place.viewOrder ?? Object.keys(app.place.views); const n = order[+k - 1]; if (n) { if (fps.on) fps.exit(true); flyTo(n); } return; }
    if (k === '[') { if (fps.on) fps.exit(true); nextScene(-1); return; }
    if (k === ']') { if (fps.on) fps.exit(true); nextScene(1); return; }
    if (k === 't' || k === 'T') { play.click(); return; }
    if (k === 'f' || k === 'F') { bWalk.click(); return; }
    if (k === 'm' || k === 'M') { toggleSound(); return; }
    if (k === 'p' || k === 'P') { photo(); return; }
    if (k === '?' || k === '/' || k === 'h' || k === 'H') { toggleHelp(); return; }
  });

  /* loading a scene the first time takes a moment */
  app.on('loading', d => { const t = $('#titlecard'); t.querySelector('b').textContent = d.ep.replace(' · ', '  ·  '); t.querySelector('span').textContent = d.title.toUpperCase(); t.querySelector('i').textContent = 'Loading…'; t.hidden = false; t.style.animation = 'none'; t.style.opacity = '1'; });
  app.on('loaded', () => { const t = $('#titlecard'); t.style.opacity = ''; t.querySelector('i').textContent = ''; });
}
export { toggleHelp, SCENES };
