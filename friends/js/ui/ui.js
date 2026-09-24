import { app } from '../app.js';
import { flyTo, view } from '../ctrl/camera.js';
import { pivot } from '../cast/pivot.js';
import { tod, setHour } from '../world/lighting.js';
import { setStage, studio } from '../world/stage.js';
import { sitcom } from '../ctrl/sitcom.js';
import { walk } from '../ctrl/walk.js';
import { toggleSound, audio } from '../audio.js';
import { post, renderFrame } from '../fx/post.js';

const $ = s => document.querySelector(s);
const press = (el, on) => el.setAttribute('aria-pressed', on ? 'true' : 'false');
const clockText = h => {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60), ap = hh < 12 ? 'AM' : 'PM', h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
};

function flash() { const f = document.createElement('div'); f.id = 'flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 500); }

/* a picture of the current view, framed like a postcard */
export function photo() {
  const sel = post.outline.selectedObjects; post.outline.selectedObjects = [];
  renderFrame(0);
  const src = app.renderer.domElement, W = src.width, H = src.height;
  const pad = Math.round(Math.min(W, H) * .035), cap = Math.round(pad * 2.4);
  const c = document.createElement('canvas'); c.width = W + pad * 2; c.height = H + pad * 2 + cap;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, pad, pad);
  post.outline.selectedObjects = sel;
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(cap * .08)}px`;
  g.fillStyle = '#3c362e'; g.font = `600 ${Math.round(cap * .38)}px Fraunces, Georgia, serif`;
  g.fillText('ACROSS THE HALL', pad, H + pad + cap / 2 + pad * .2);
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(cap * .04)}px`;
  g.textAlign = 'right'; g.fillStyle = '#8a8174'; g.font = `500 ${Math.round(cap * .2)}px Inter, Arial, sans-serif`;
  g.fillText(`APTS 19 & 20 · GROVE STREET · ${clockText(tod.hour)}`, c.width - pad, H + pad + cap / 2 + pad * .2);
  c.toBlob(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'across-the-hall.png';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, 'image/png');
  flash();
  app.emit('photo');
}

export function buildUI() {
  if (app.clean) document.body.classList.add('clean');

  /* views */
  const viewBtns = [...document.querySelectorAll('[data-view]')];
  viewBtns.forEach(b => b.addEventListener('click', () => { if (app.mode === 'walk') walk.exit(); if (app.mode === 'sitcom') sitcom.exit(); flyTo(b.dataset.view); }));
  const markView = () => viewBtns.forEach(b => press(b, !view.moved && view.name === b.dataset.view));
  app.on('view', markView);
  app.renderer.domElement.addEventListener('pointerdown', () => setTimeout(markView, 80));
  app.controls.addEventListener('start', () => { view.moved = true; markView(); });

  /* time of day */
  const hour = $('#hour'), clock = $('#clock'), play = $('#b-play');
  const showHour = h => { hour.value = String(h); clock.value = clockText(h); clock.textContent = clockText(h); };
  hour.addEventListener('input', () => { tod.playing = false; press(play, false); setHour(parseFloat(hour.value)); });
  hour.addEventListener('change', () => app.emit('hour:set'));
  let lastShown = -1;
  app.on('hour', h => { if (Math.abs(h - lastShown) > .02) { lastShown = h; showHour(h); } });
  showHour(tod.hour);
  play.addEventListener('click', () => { tod.playing = !tod.playing; press(play, tod.playing); });

  /* modes */
  const bStage = $('#b-stage'), bSit = $('#b-sitcom'), bWalk = $('#b-walk'), bSound = $('#b-sound'), bHelp = $('#b-help');
  bStage.addEventListener('click', () => toggleStage());
  bSit.addEventListener('click', () => { if (app.mode === 'walk') walk.exit(); sitcom.toggle(); });
  bWalk.addEventListener('click', () => { if (app.mode === 'sitcom') sitcom.exit(); app.mode === 'walk' ? walk.exit() : walk.enter(); });
  bSound.addEventListener('click', () => toggleSound());
  $('#b-photo').addEventListener('click', photo);
  bHelp.addEventListener('click', () => toggleHelp());
  $('#help .x').addEventListener('click', () => toggleHelp(false));
  app.on('stage', on => press(bStage, on));
  app.on('sound', on => press(bSound, on));
  app.on('sitcom', on => { press(bSit, on); document.body.classList.toggle('sitcom', on); $('#sitcom-ui').hidden = !on; });
  app.on('cut', () => { $('#camlabel').textContent = `CAM ${studio.tally + 1}`; });
  $('#sitcom-exit').addEventListener('click', () => sitcom.exit());

  /* walk overlay */
  const wui = $('#walk-ui'), whelp = $('.walk-help'), cross = $('#walk-ui .cross'), joyEl = $('#joy'), knob = $('#joy span');
  let noLock = false;
  const walkText = () => app.touch ? 'Left thumb to move · right thumb to look · tap things'
    : app.walkLocked ? 'WASD to move · Shift to hurry · click things · Esc to stop'
    : noLock ? 'Drag to look · WASD to move · Shift to hurry · Esc to stop' : 'Click to look around, or drag · WASD to move';
  app.on('walk', on => { press(bWalk, on); wui.hidden = !on; document.body.classList.toggle('walking', on); whelp.textContent = walkText(); });
  app.on('walk:lock', () => { app.walkLocked = true; whelp.textContent = walkText(); });
  app.on('walk:unlock', () => { app.walkLocked = false; whelp.textContent = walkText(); });
  app.on('walk:nolock', () => { noLock = true; whelp.textContent = walkText(); });
  app.renderer.domElement.addEventListener('click', () => { if (app.mode === 'walk' && !app.walkLocked) walk.lock(); });
  $('#walk-exit').addEventListener('click', () => walk.exit());
  app.on('crosshair', on => cross.classList.toggle('on', on));
  app.on('joy', j => {
    joyEl.classList.toggle('on', j.on);
    if (j.x != null) { joyEl.style.left = j.x + 'px'; joyEl.style.top = j.y + 'px'; }
    if (j.dx != null) knob.style.transform = `translate(${j.dx * 34}px, ${j.dy * 34}px)`;
    if (!j.on) knob.style.transform = '';
  });

  /* Ross and the sofa */
  $('#pivot').addEventListener('click', () => pivot.trigger());

  /* card + tooltip */
  const card = $('#card'), tip = $('#tip');
  let cardTimer = 0;
  app.on('card', c => {
    clearTimeout(cardTimer);
    if (!c) { card.hidden = true; return; }
    card.querySelector('h2').textContent = c.title; card.querySelector('p').textContent = c.text;
    card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    cardTimer = setTimeout(() => { card.hidden = true; }, 9000);
  });
  card.querySelector('.x').addEventListener('click', () => { card.hidden = true; });
  app.on('tip', t => {
    if (!t || app.touch) { tip.hidden = true; return; }
    tip.textContent = t.title; tip.hidden = false;
    const x = Math.min(t.x + 14, innerWidth - tip.offsetWidth - 8), y = Math.min(t.y + 16, innerHeight - 40);
    tip.style.transform = `translate(${x}px, ${y}px)`;
  });

  /* hint: says how to start, then gets out of the way */
  const hint = $('#hint');
  hint.textContent = app.touch ? 'Drag to orbit · pinch to zoom · tap things' : 'Drag to orbit · scroll to zoom · click things';
  const hideHint = () => setTimeout(() => hint.classList.add('gone'), 5000);
  app.controls.addEventListener('start', hideHint, { once: true });

  /* keyboard */
  const VIEW_KEYS = { Digit1: 'overview', Digit2: 'audience', Digit3: 'plan', Digit4: 'monica', Digit5: 'guys', Digit6: 'hall' };
  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    app.lastInput = app.time;
    if (e.code === 'Escape') {
      if (!$('#help').hidden) return toggleHelp(false);
      if (!card.hidden) { card.hidden = true; return; }
      if (app.mode === 'sitcom') return sitcom.exit();
      if (app.mode === 'walk' && !app.walkLocked) return walk.exit();
      return;
    }
    if (app.mode === 'walk' && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return;
    if (VIEW_KEYS[e.code]) { if (app.mode === 'walk') walk.exit(); if (app.mode === 'sitcom') sitcom.exit(); flyTo(VIEW_KEYS[e.code]); }
    else if (e.code === 'KeyV') pivot.trigger();
    else if (e.code === 'KeyT') play.click();
    else if (e.code === 'KeyS' && app.mode !== 'walk') toggleStage();
    else if (e.code === 'KeyC') bSit.click();
    else if (e.code === 'KeyF') bWalk.click();
    else if (e.code === 'KeyM') toggleSound();
    else if (e.code === 'KeyP') photo();
    else if (e.key === '?' || e.code === 'KeyH') toggleHelp();
  });

  app.on('ready', () => { document.body.classList.add('ready'); });
  press(bSound, audio.on);
}

export function toggleStage(on = !app.stage) {
  setStage(on);
  if (app.mode === 'orbit') flyTo(on ? 'studio' : 'overview', 2.4);
}

function toggleHelp(on) {
  const h = document.getElementById('help'), b = document.getElementById('b-help');
  const show = on ?? h.hidden;
  h.hidden = !show; press(b, show);
}
