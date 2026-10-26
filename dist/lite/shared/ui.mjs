// Tiny DOM helpers shared by both prototypes.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const wait = ms => new Promise(r => setTimeout(r, ms));

// The offline build injects data URLs into LITE_SPRITES; online builds load files.
export const sprite = name => globalThis.LITE_SPRITES?.[name] || new URL(`../../assets/lite/${name}.webp`, import.meta.url).href;
export const svgAsset = name => globalThis.LITE_SPRITES?.['svg:' + name] || new URL(`../../assets/${name}.svg`, import.meta.url).href;

let toastTimer;
export function toast(text, {tone = '', ms = 1800} = {}) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.append(el); }
  el.className = 'toast show ' + tone; el.textContent = text;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast ' + tone; }, ms);
}

// Bottom sheet. `actions` are [{label, kind, value}]; resolves with the value.
export function sheet({title = '', body = '', actions = [], dismissable = true, cls = ''} = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'sheet-wrap ' + cls;
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">${title ? `<h2>${title}</h2>` : ''}<div class="sheet-body">${body}</div><div class="sheet-actions">${actions.map((a, i) => `<button class="btn ${a.kind || 'primary'}" data-i="${i}">${a.label}</button>`).join('')}</div></div>`;
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    const close = value => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 220); resolve(value); };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-i]'); if (b) { close(actions[+b.dataset.i].value); return; }
      const pick = e.target.closest('[data-pick]'); if (pick) { close(pick.dataset.pick); return; }
      if (dismissable && e.target === wrap) close(null);
    });
    wrap.querySelector('button')?.focus({preventScroll: true});
  });
}

// Speech bubble near a screen point; characters talk on the map instead of
// stopping play with a modal.
export function speak(point, portrait, text, {ms = 3600, side = 'auto', root = document.body} = {}) {
  const el = document.createElement('div'); el.className = 'speech'; el.setAttribute('role', 'status');
  el.innerHTML = `<img src="${portrait}" alt=""><p>${esc(text)}</p>`;
  root.append(el);
  const r = root.getBoundingClientRect(), w = Math.min(280, r.width - 24);
  el.style.width = `${w}px`;
  const left = Math.max(12, Math.min(r.width - w - 12, point[0] - r.left - w / 2));
  const above = side === 'below' ? false : point[1] - r.top > 150;
  el.style.left = `${left}px`;
  if (above) el.style.top = `${point[1] - r.top - el.offsetHeight - 18}px`; else el.style.top = `${point[1] - r.top + 22}px`;
  el.classList.add(above ? 'above' : 'below');
  el.style.setProperty('--tail', `${Math.max(18, Math.min(w - 18, point[0] - r.left - left))}px`);
  requestAnimationFrame(() => el.classList.add('show'));
  const done = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  const timer = setTimeout(done, ms);
  el.addEventListener('pointerdown', () => { clearTimeout(timer); done(); });
  return done;
}
