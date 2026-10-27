// Small DOM helpers shared by both prototypes.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const wait = ms => new Promise(r => setTimeout(r, ms));

// The offline build injects data URLs into LITE_SPRITES; online builds load files.
export const sprite = name => globalThis.LITE_SPRITES?.[name] || new URL(`../../assets/lite/${name}.webp`, import.meta.url).href;
export const svgAsset = name => globalThis.LITE_SPRITES?.['svg:' + name] || new URL(`../../assets/${name}.svg`, import.meta.url).href;

// One toast at a time, queued so quick messages don't overwrite each other.
const toastQueue = [];
let toastBusy = false;
export function toast(text, {tone = '', ms = 1800} = {}) {
  if (toastQueue.some(t => t.text === text)) return;
  toastQueue.push({text, tone, ms});
  if (!toastBusy) nextToast();
}
function nextToast() {
  const t = toastQueue.shift();
  if (!t) { toastBusy = false; return; }
  toastBusy = true;
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.append(el); }
  el.className = 'toast show ' + t.tone; el.textContent = t.text;
  setTimeout(() => { el.className = 'toast ' + t.tone; setTimeout(nextToast, 200); }, toastQueue.length ? Math.min(t.ms, 1200) : t.ms);
}

// Modal sheet. `actions` are [{label, kind, value}]; resolves with the value.
// The body scrolls on short screens so the actions always stay visible.
export function sheet({title = '', body = '', actions = [], dismissable = true, cls = '', onMount} = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'sheet-wrap ' + cls;
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g, ''))}">${dismissable ? '<button class="sheet-x" data-x aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button>' : ''}${title ? `<h2>${title}</h2>` : ''}<div class="sheet-body">${body}</div>${actions.length ? `<div class="sheet-actions">${actions.map((a, i) => `<button class="btn ${a.kind || 'primary'}" data-i="${i}" ${a.disabled ? 'disabled' : ''}>${a.label}</button>`).join('')}</div>` : ''}</div>`;
    document.body.append(wrap);
    // Two frames so the closed state paints before the transition starts.
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
    setTimeout(() => wrap.classList.add('open'), 60);
    const close = value => { wrap.classList.remove('open'); wrap.classList.add('closing'); setTimeout(() => wrap.remove(), 220); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = e => { if (e.key === 'Escape' && dismissable) close(null); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-i]'); if (b) { close(actions[+b.dataset.i].value); return; }
      const pick = e.target.closest('[data-pick]'); if (pick) { close(pick.dataset.pick); return; }
      if (e.target.closest('[data-x]') || dismissable && e.target === wrap) close(null);
    });
    onMount?.(wrap.querySelector('.sheet'), close);
    (wrap.querySelector('.sheet-actions .btn') || wrap.querySelector('button'))?.focus({preventScroll: true});
  });
}

// Speech bubble near a screen point. Characters talk on the map instead of
// stopping play; the bubble never blocks taps and only one shows at a time.
let currentSpeech = null;
export function speak(point, portrait, text, {ms = 3200, root = document.body, name = ''} = {}) {
  currentSpeech?.();
  const el = document.createElement('div'); el.className = 'speech'; el.setAttribute('role', 'status');
  el.innerHTML = `<img src="${portrait}" alt=""><div>${name ? `<b>${esc(name)}</b>` : ''}<p>${esc(text)}</p></div>`;
  root.append(el);
  const r = root.getBoundingClientRect(), w = Math.min(300, r.width - 24);
  el.style.width = `${w}px`;
  const left = Math.max(12, Math.min(r.width - w - 12, point[0] - r.left - w / 2));
  const room = point[1] - r.top, above = room > el.offsetHeight + 120;
  el.style.left = `${left}px`;
  el.style.top = `${Math.max(8, above ? room - el.offsetHeight - 20 : room + 24)}px`;
  el.classList.add(above ? 'above' : 'below');
  el.style.setProperty('--tail', `${Math.max(18, Math.min(w - 18, point[0] - r.left - left))}px`);
  requestAnimationFrame(() => el.classList.add('show')); setTimeout(() => el.classList.add('show'), 50);
  let closed = false;
  const done = () => { if (closed) return; closed = true; el.classList.remove('show'); setTimeout(() => el.remove(), 250); if (currentSpeech === done) currentSpeech = null; };
  currentSpeech = done;
  const timer = setTimeout(done, ms + text.length * 25);
  // A tap anywhere dismisses it early, but the tap still reaches the game.
  const early = () => { clearTimeout(timer); done(); document.removeEventListener('pointerdown', early, true); };
  setTimeout(() => document.addEventListener('pointerdown', early, true), 350);
  return done;
}
// Plays a short scripted conversation; resolves when it ends or is skipped.
export async function converse(lines, {at, portrait, names, root, gap = 2300}) {
  for (const [who, text] of lines) {
    let skip;
    const skipped = new Promise(r => { skip = r; });
    const tap = () => skip();
    speak(at(who), portrait[who], text, {root, name: names[who], ms: gap + 900});
    setTimeout(() => document.addEventListener('pointerdown', tap, {once: true, capture: true}), 300);
    await Promise.race([wait(gap + Math.min(1800, text.length * 45)), skipped]);
    document.removeEventListener('pointerdown', tap, {capture: true});
  }
}
