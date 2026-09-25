import { app } from '../app.js';

/* The game's gauges: rounds left, the cold, the phone's bars, the cash in the duck feed, the clock; and one goal
   line at the top. A game shows the rows it uses. */
const $ = s => document.querySelector(s);
export const hud = {
  show(rows) {
    $('#hud').hidden = !rows.length;
    for (const r of ['ammo', 'cold', 'phone', 'cash', 'clock']) $('#hud-' + r).hidden = !rows.includes(r);
  },
  hide() { $('#hud').hidden = true; this.goal(null); },
  ammo(n, spare = null) { $('#hud-ammo .val').textContent = spare == null ? String(n) : `${n} · ${spare}`; },
  cold(k) {
    const bar = $('#hud-cold .bar');
    bar.querySelector('i').style.width = `${Math.round(Math.min(1, Math.max(0, k)) * 100)}%`;
    bar.classList.toggle('warn', k > .7);
  },
  phone(n) { document.querySelectorAll('#hud-phone .bars i').forEach((b, i) => b.classList.toggle('on', i < n)); },
  cash(v) { $('#hud-cash .val').textContent = '$' + Math.round(v).toLocaleString('en-US'); },
  clock(text) { $('#hud-clock .val').textContent = text; },
  goal(text, tag = '') {
    const g = $('#goal');
    if (!text) { g.hidden = true; return; }
    g.innerHTML = ''; if (tag) { const b = document.createElement('b'); b.textContent = tag; g.appendChild(b); }
    g.appendChild(document.createTextNode(text)); g.hidden = false;
  },
};

/* a choice between buttons; resolves with the key of the one taken */
export function choose(options) {
  const box = $('#choice');
  box.innerHTML = '';
  return new Promise(res => {
    for (const o of options) {
      const b = document.createElement('button'); b.type = 'button';
      b.textContent = o.label;
      if (o.sub) { const s = document.createElement('small'); s.textContent = o.sub; b.appendChild(s); }
      b.addEventListener('click', () => { box.hidden = true; box.innerHTML = ''; res(o.key); });
      box.appendChild(b);
    }
    box.hidden = false;
    app.emit('choice', options.map(o => o.key));
  });
}
export function clearChoice() { const box = $('#choice'); box.hidden = true; box.innerHTML = ''; }
