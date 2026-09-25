import { app } from '../app.js';
import { flyTo, view, writeHash } from '../ctrl/camera.js';
import { tod, setHour } from '../world/lighting.js';
import { stops, openStop, nextStop } from '../world/stops.js';
import { PLACES } from '../world/places.js';
import { cinema } from '../ctrl/cinema.js';
import { walk } from '../ctrl/walk.js';
import { drive } from '../rv/drive.js';
import { setShoot } from '../world/shoot.js';
import { scenes } from '../cast/scenes.js';
import { toggleSound, audio } from '../audio.js';
import { post, renderFrame } from '../fx/post.js';

const $ = s => document.querySelector(s);
const press = (el, on) => el.setAttribute('aria-pressed', on ? 'true' : 'false');
export const clockText = h => {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60), ap = hh < 12 ? 'AM' : 'PM', h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
};

function flash() { const f = document.createElement('div'); f.id = 'flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 500); }

/* a picture of the current view, framed like a film still */
export function photo() {
  const sel = post.outline.selectedObjects; post.outline.selectedObjects = [];
  renderFrame(0);
  const src = app.renderer.domElement, W = src.width, H = src.height;
  const pad = Math.round(Math.min(W, H) * .035), cap = Math.round(pad * 2.4);
  const c = document.createElement('canvas'); c.width = W + pad * 2; c.height = H + pad * 2 + cap;
  const g = c.getContext('2d');
  g.fillStyle = '#16140f'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, pad, pad);
  post.outline.selectedObjects = sel;
  g.textBaseline = 'middle';
  /* the element tile */
  const s = Math.round(cap * .62), x0 = pad, y0 = H + pad + (cap - s) / 2 + pad * .2;
  const gr = g.createLinearGradient(x0, y0, x0 + s, y0 + s); gr.addColorStop(0, '#3d8150'); gr.addColorStop(1, '#24583a');
  g.fillStyle = gr; g.fillRect(x0, y0, s, s); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(1, s * .03); g.strokeRect(x0, y0, s, s);
  g.fillStyle = '#f4efe2'; g.textAlign = 'center'; g.font = `700 ${Math.round(s * .46)}px Inter, Arial, sans-serif`; g.fillText('Kr', x0 + s / 2, y0 + s * .56);
  g.textAlign = 'left'; g.font = `600 ${Math.round(cap * .34)}px Fraunces, Georgia, serif`;
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(cap * .07)}px`;
  g.fillText('YSTAL SHIP', x0 + s + pad * .35, H + pad + cap / 2 + pad * .2);
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(cap * .04)}px`;
  const P = PLACES[stops.id];
  g.textAlign = 'right'; g.fillStyle = '#a89a86'; g.font = `500 ${Math.round(cap * .19)}px Inter, Arial, sans-serif`;
  g.fillText(`${P.ep} · ${P.title.toUpperCase()} · ${P.short.toUpperCase()} · ${clockText(tod.hour)}`, c.width - pad, H + pad + cap / 2 + pad * .2);
  c.toBlob(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'the-krystal-ship.png';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, 'image/png');
  flash();
  app.emit('photo');
}

export function buildUI() {
  if (app.clean) document.body.classList.add('clean');
  if (app.touch) document.body.classList.add('touch');
  const leaveModes = () => { if (app.mode === 'walk') walk.exit(); if (app.mode === 'drive') drive.exit(); if (app.mode === 'cinema') cinema.exit(); };

  /* views */
  const viewBtns = [...document.querySelectorAll('[data-view]')];
  viewBtns.forEach(b => b.addEventListener('click', () => { if (app.mode === 'scripted') return; leaveModes(); flyTo(b.dataset.view); }));
  const markView = () => viewBtns.forEach(b => press(b, !view.moved && view.name === b.dataset.view));
  app.on('view', markView);
  app.controls.addEventListener('start', () => { view.moved = true; markView(); });

  /* the stops */
  document.querySelectorAll('[data-stop]').forEach(b => b.addEventListener('click', () => { if (app.mode === 'scripted') return; leaveModes(); openStop(b.dataset.stop); }));

  /* time of day */
  const hour = $('#hour'), clock = $('#clock'), play = $('#b-play');
  const showHour = h => { hour.value = String(h); clock.value = clockText(h); clock.textContent = clockText(h); };
  hour.addEventListener('input', () => { tod.playing = false; press(play, false); setHour(parseFloat(hour.value)); });
  hour.addEventListener('change', () => writeHash());
  let lastShown = -1;
  app.on('hour', h => { if (Math.abs(h - lastShown) > .015) { lastShown = h; showHour(h); } });
  showHour(tod.hour);
  play.addEventListener('click', () => { tod.playing = !tod.playing; press(play, tod.playing); if (!tod.playing) writeHash(); });

  /* modes */
  const bShoot = $('#b-shoot'), bCin = $('#b-cinema'), bWalk = $('#b-walk'), bDrive = $('#b-drive'), bSound = $('#b-sound'), bHelp = $('#b-help'), bAct = $('#act');
  bShoot.addEventListener('click', () => { if (app.mode === 'scripted') return; setShoot(!app.shoot, { fly: true }); });
  bCin.addEventListener('click', () => { if (app.mode === 'walk') walk.exit(); if (app.mode === 'drive') drive.exit(); cinema.toggle(); });
  bWalk.addEventListener('click', () => { if (app.mode === 'scripted') return; if (app.mode === 'cinema') cinema.exit(); if (app.mode === 'drive') drive.exit(); app.mode === 'walk' ? walk.exit() : walk.enter(); });
  bDrive.addEventListener('click', () => { if (app.mode === 'scripted') return; if (app.mode === 'cinema') cinema.exit(); if (app.mode === 'walk') walk.exit(); app.mode === 'drive' ? drive.exit() : drive.enter(); });
  bSound.addEventListener('click', () => toggleSound());
  $('#b-photo').addEventListener('click', photo);
  bHelp.addEventListener('click', () => toggleHelp());
  $('#help .x').addEventListener('click', () => toggleHelp(false));
  bAct.addEventListener('click', () => scenes.act());
  app.on('shoot', on => press(bShoot, on));
  app.on('sound', on => press(bSound, on));
  app.on('cinema', on => { press(bCin, on); document.body.classList.toggle('cinema', on); $('#cinema-ui').hidden = !on; });
  app.on('shot', s => { $('#shotlabel').textContent = s; });
  $('#cinema-exit').addEventListener('click', () => cinema.exit());
  const actLabel = $('#act-label');
  const syncAct = () => { actLabel.textContent = scenes.label(); bAct.disabled = scenes.busy() && !scenes.canSkip(); bAct.classList.toggle('busy', scenes.busy()); bAct.title = scenes.title(); };
  app.on('act', syncAct); app.on('stop', syncAct); syncAct();
  app.on('scripted', on => document.body.classList.toggle('scripted', on));

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

  /* drive overlay */
  const dui = $('#drive-ui'), dhelp = $('.drive-help'), speed = $('#speed'), key = $('#key');
  app.on('drive', on => { press(bDrive, on); dui.hidden = !on; document.body.classList.toggle('driving', on); });
  app.on('drive:help', t => { dhelp.textContent = t; });
  app.on('drive:speed', v => { speed.textContent = String(Math.round(v)); });
  app.on('engine', st => { key.classList.toggle('cranking', st === 'cranking'); key.classList.toggle('running', st === 'running'); key.textContent = st === 'running' ? 'STOP' : 'KEY'; });
  key.addEventListener('pointerdown', e => { e.preventDefault(); drive.key(true); });
  addEventListener('pointerup', () => drive.key(false));
  $('#drive-exit').addEventListener('click', () => drive.exit());
  for (const [id, k] of [['gas', 'gas'], ['brake', 'brake']]) {
    const el = $('#' + id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('on'); drive.pedal(k, true); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { el.classList.remove('on'); drive.pedal(k, false); });
  }
  {const wheel = $('#wheel'), ball = $('#wheel span'); let id = null, x0 = 0;
   wheel.addEventListener('pointerdown', e => { id = e.pointerId; x0 = wheel.getBoundingClientRect().left + wheel.offsetWidth / 2; wheel.setPointerCapture(id); });
   wheel.addEventListener('pointermove', e => { if (e.pointerId !== id) return; const s = Math.max(-1, Math.min(1, (e.clientX - x0) / (wheel.offsetWidth / 2 - 18))); drive.steerTouch(s); ball.style.transform = `translateX(${s * (wheel.offsetWidth / 2 - 22)}px)`; });
   const end = () => { id = null; drive.steerTouch(0); ball.style.transform = ''; };
   wheel.addEventListener('pointerup', end); wheel.addEventListener('pointercancel', end);}

  /* card + tooltip */
  const card = $('#card'), tip = $('#tip');
  let cardTimer = 0;
  app.on('card', c => {
    clearTimeout(cardTimer);
    if (!c) { card.hidden = true; return; }
    card.querySelector('h2').textContent = c.title; card.querySelector('p').textContent = c.text;
    card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    cardTimer = setTimeout(() => { card.hidden = true; }, c.hold ?? 9000);
  });
  card.querySelector('.x').addEventListener('click', () => { card.hidden = true; });
  app.on('tip', t => {
    if (!t || app.touch) { tip.hidden = true; return; }
    tip.textContent = t.title; tip.hidden = false;
    const x = Math.min(t.x + 14, innerWidth - tip.offsetWidth - 8), y = Math.min(t.y + 16, innerHeight - 40);
    tip.style.transform = `translate(${x}px, ${y}px)`;
  });
  /* the goal line for 4 Days Out */
  const goal = $('#goal');
  app.on('goal', gl => { if (!gl) { goal.hidden = true; return; } goal.innerHTML = ''; const b = document.createElement('b'); b.textContent = gl.tag; goal.append(b, document.createTextNode(gl.text)); goal.hidden = false; });

  /* hint: says how to start, then gets out of the way */
  const hint = $('#hint');
  hint.textContent = app.touch ? 'Drag to orbit · pinch in close to look inside · tap things' : 'Drag to orbit · zoom in close to look inside · click things';
  const hideHint = () => setTimeout(() => hint.classList.add('gone'), 6000);
  app.controls.addEventListener('start', hideHint, { once: true });

  /* keyboard */
  const VIEW_KEYS = { Digit1: 'overview', Digit2: 'wide', Digit3: 'lab', Digit4: 'plan', Digit5: 'cab' };
  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    app.lastInput = app.time;
    if (e.code === 'Escape') {
      if (!$('#help').hidden) return toggleHelp(false);
      if (!card.hidden) { card.hidden = true; return; }
      if (app.mode === 'cinema') return cinema.exit();
      if (app.mode === 'drive') return drive.exit();
      if (app.mode === 'walk' && !app.walkLocked) return walk.exit();
      return;
    }
    if (app.mode === 'drive') {
      if (e.code === 'KeyR') drive.exit();
      return;                                      /* drive.js reads its own keys */
    }
    if (app.mode === 'walk' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) return;
    if (app.mode === 'scripted' && !['KeyM', 'KeyP', 'Space', 'KeyC'].includes(e.code) && e.key !== '?' && e.code !== 'KeyH') return;
    if (VIEW_KEYS[e.code]) { leaveModes(); flyTo(VIEW_KEYS[e.code]); }
    else if (e.code === 'BracketRight') { leaveModes(); nextStop(1); }
    else if (e.code === 'BracketLeft') { leaveModes(); nextStop(-1); }
    else if (e.code === 'Space') { e.preventDefault(); if (app.mode !== 'walk') scenes.act(); }
    else if (e.code === 'KeyT') play.click();
    else if (e.code === 'KeyS' && app.mode !== 'walk') bShoot.click();
    else if (e.code === 'KeyC') bCin.click();
    else if (e.code === 'KeyF') bWalk.click();
    else if (e.code === 'KeyR') bDrive.click();
    else if (e.code === 'KeyM') toggleSound();
    else if (e.code === 'KeyP') photo();
    else if (e.key === '?' || e.code === 'KeyH') toggleHelp();
  });

  app.on('ready', () => { document.body.classList.add('ready'); });
  press(bSound, audio.on);
}

function toggleHelp(on) {
  const h = document.getElementById('help'), b = document.getElementById('b-help');
  const show = on ?? h.hidden;
  h.hidden = !show; press(b, show);
}
