// Screen-space juice: particle bursts, arcs, floating numbers and squash.
// Everything lives in one fixed overlay and only animates transform/opacity.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let layer = null;
function fxLayer() {
  if (!layer) { layer = document.createElement('div'); layer.className = 'fx-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.append(layer); }
  return layer;
}
export const reducedMotion = () => reduced.matches;
// Vibration only after a real tap (browsers reject it before user activation).
export function haptic(ms = 12) { try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms); } catch { /* optional */ } }
// Resolves when a Web Animation ends, or after its duration if frames pause.
export const settle = (anim, ms) => Promise.race([anim.finished.catch(() => {}), new Promise(r => setTimeout(r, ms + 150))]);

export function burst(x, y, {count = 12, colors = ['#fff3b0', '#ffd25e', '#ffffff'], spread = 70, size = 7, duration = 620, gravity = 60, shape = 'dot'} = {}) {
  if (reduced.matches) return;
  const root = fxLayer();
  for (let i = 0; i < count; i++) {
    const e = document.createElement('i');
    e.className = 'fx-p fx-' + shape;
    const s = size * (0.6 + Math.random() * 0.8);
    Object.assign(e.style, {left: `${x}px`, top: `${y}px`, width: `${s}px`, height: `${s}px`, background: colors[i % colors.length]});
    root.append(e);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5, dist = spread * (0.55 + Math.random() * 0.6);
    const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist * 0.8;
    e.animate([
      {transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1},
      {transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7 - 10}px)) scale(1) rotate(160deg)`, opacity: 1, offset: 0.55},
      {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + gravity}px)) scale(.2) rotate(280deg)`, opacity: 0}
    ], {duration: duration * (0.8 + Math.random() * 0.4), easing: 'cubic-bezier(.15,.6,.35,1)'}).finished.catch(() => {}).finally(() => e.remove());
    setTimeout(() => e.remove(), duration * 1.3 + 200);
  }
}
export function ring(x, y, {size = 90, color = '#fff6c8', duration = 420, width = 4} = {}) {
  if (reduced.matches) return;
  const e = document.createElement('i'); e.className = 'fx-ring';
  Object.assign(e.style, {left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size * 0.74}px`, borderColor: color, borderWidth: `${width}px`});
  fxLayer().append(e);
  e.animate([{transform: 'translate(-50%,-50%) scale(.2)', opacity: 1}, {transform: 'translate(-50%,-50%) scale(1)', opacity: 0}], {duration, easing: 'cubic-bezier(.2,.7,.3,1)'}).finished.catch(() => {}).finally(() => e.remove());
  setTimeout(() => e.remove(), duration + 200);
}
export function floatText(x, y, text, {color = '#fff', size = 18, rise = 46, duration = 900, cls = ''} = {}) {
  const e = document.createElement('b'); e.className = 'fx-text ' + cls; e.textContent = text;
  Object.assign(e.style, {left: `${x}px`, top: `${y}px`, color, fontSize: `${size}px`});
  fxLayer().append(e);
  const frames = reduced.matches ? [{opacity: 1}, {opacity: 0}] : [
    {transform: 'translate(-50%,-50%) scale(.6)', opacity: 0},
    {transform: 'translate(-50%,-60%) scale(1.12)', opacity: 1, offset: 0.2},
    {transform: `translate(-50%,calc(-50% - ${rise}px)) scale(1)`, opacity: 0}
  ];
  return settle(e.animate(frames, {duration, easing: 'ease-out'}), duration).finally(() => e.remove());
}
// Flies an image along a quadratic arc. Resolves when it lands.
export function fly(src, from, to, {size = 56, duration = 520, arc = -80, spin = 0, endScale = 0.7, delay = 0} = {}) {
  if (reduced.matches) return Promise.resolve();
  const e = document.createElement('img'); e.className = 'fx-fly'; e.src = src; e.alt = '';
  Object.assign(e.style, {left: `${from[0]}px`, top: `${from[1]}px`, width: `${size}px`, height: `${size}px`});
  fxLayer().append(e);
  const mid = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) + arc], frames = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, u = 1 - t;
    const x = u * u * from[0] + 2 * u * t * mid[0] + t * t * to[0] - from[0], y = u * u * from[1] + 2 * u * t * mid[1] + t * t * to[1] - from[1];
    const s = 1 + Math.sin(t * Math.PI) * 0.25 - t * (1 - endScale);
    frames.push({transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s}) rotate(${spin * t}deg)`, offset: t});
  }
  return settle(e.animate(frames, {duration, delay, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'backwards'}), duration + delay).finally(() => e.remove());
}
export function squash(el, {from = 0.55, peak = 1.22, duration = 380} = {}) {
  if (!el || reduced.matches) return Promise.resolve();
  return settle(el.animate([
    {transform: `scale(${from})`, filter: 'brightness(1.9)'},
    {transform: `scale(${peak}, ${peak * 0.88})`, filter: 'brightness(1.25)', offset: 0.38},
    {transform: 'scale(.94, 1.06)', filter: 'brightness(1)', offset: 0.66},
    {transform: 'scale(1)', filter: 'brightness(1)'}
  ], {duration, easing: 'ease-out', composite: 'add'}), duration);
}
export function shake(el, amount = 5, duration = 260) {
  if (!el || reduced.matches) return;
  el.animate([0, 1, -1, 0.6, -0.4, 0].map(v => ({transform: `translate(${v * amount}px, ${v * amount * -0.4}px)`})), {duration, composite: 'add'});
}
export const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
