import { app } from '../app.js';

/* The lines, at the bottom of the screen like subtitles: who says it, what, for how long. Notes are the narrator's
   plain text (what happened), in a smaller hand. At most three on screen; the oldest goes first. */
const live = [];
let layer;

export function caption(text, { who = '', dur = 3, note = false } = {}) {
  layer ??= document.getElementById('captions');
  if (app.skipping) return null;
  while (live.length >= 3) end(live[0]);
  const el = document.createElement('div');
  el.className = 'cap ' + (note ? 'note' : 'say');
  if (who) { const b = document.createElement('b'); b.textContent = who; el.appendChild(b); }
  el.appendChild(document.createTextNode(text));
  layer.appendChild(el);
  const c = { el, until: app.time + dur };
  live.push(c);
  requestAnimationFrame(() => el.classList.add('in'));
  app.emit('caption', { who, text });
  return c;
}
export const note = (text, dur = 3.4) => caption(text, { note: true, dur });

function end(c) {
  const i = live.indexOf(c); if (i < 0) return;
  live.splice(i, 1); c.el.classList.remove('in');
  setTimeout(() => c.el.remove(), 300);
}
export function clearCaptions() { for (const c of live.slice()) end(c); }

app.onUpdate(() => { for (const c of live.slice()) if (app.time > c.until) end(c); }, 95);
