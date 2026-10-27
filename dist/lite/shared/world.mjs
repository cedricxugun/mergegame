// Shared world renderer for both lite prototypes.
// Everything is placed in "plate pixels" (the 1536×1024 homeland painting).
// One camera transform maps plate → screen. Sprites are positioned once and
// only the element that changes is touched, so drags never rebuild the scene.
import {TILT, SQ3, key, fromWorld, corners} from './hex.mjs';
import {spriteBox} from './art.mjs';
import {sprite} from './ui.mjs';

export const PLATE = {width: 1536, height: 1024, cell: 1536 / 36, origin: [9, 12]};
export const plateOf = ([q, r]) => [(SQ3 * (q + r / 2) + PLATE.origin[0]) * PLATE.cell, (1.5 * r * TILT + PLATE.origin[1]) * PLATE.cell];
export const cellOfPlate = ([X, Y]) => fromWorld(X / PLATE.cell - PLATE.origin[0], Y / PLATE.cell - PLATE.origin[1]);
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Frame-driven tween with a timer backstop: if frames pause (background tab,
// throttled webview) the tween still lands on its final value and resolves.
function tween(duration, onStep) {
  return new Promise(resolve => {
    const start = performance.now(); let finished = false;
    const finish = () => { if (finished) return; finished = true; onStep(1); resolve(); };
    const step = now => { if (finished) return; const t = Math.min(1, Math.max(0, (now - start) / duration)); onStep(t); if (t < 1) requestAnimationFrame(step); else finish(); };
    requestAnimationFrame(step);
    setTimeout(finish, duration + 150);
  });
}
const settle = (anim, ms) => Promise.race([anim.finished.catch(() => {}), new Promise(r => setTimeout(r, ms + 150))]);
const loadImage = src => new Promise((resolve, reject) => { const i = new Image(); i.decoding = 'async'; i.onload = () => resolve(i); i.onerror = reject; i.src = src; });

export function createWorld(container, handlers = {}) {
  const {onTap = () => {}, onDragStart = () => false, onDragMove = () => {}, onDragEnd = () => {}, onPan = () => {}, liftPx = 30} = handlers;
  container.classList.add('world');
  container.innerHTML = '';
  const inner = document.createElement('div'); inner.className = 'world-inner';
  Object.assign(inner.style, {width: `${PLATE.width}px`, height: `${PLATE.height}px`});

  // Plate: storm-grey painting with colour revealed in soft circles.
  const canvas = document.createElement('canvas'); canvas.className = 'plate'; canvas.width = PLATE.width; canvas.height = PLATE.height;
  const ctx = canvas.getContext('2d'), mask = document.createElement('canvas'); mask.width = PLATE.width; mask.height = PLATE.height;
  const mctx = mask.getContext('2d');
  const turf = svgEl('svg', {class: 'turf', viewBox: `0 0 ${PLATE.width} ${PLATE.height}`, width: PLATE.width, height: PLATE.height});
  turf.innerHTML = '<g class="decals"></g><g class="cells"></g><g class="rings"></g>';
  const sprites = document.createElement('div'); sprites.className = 'sprites';
  const fogSvg = svgEl('svg', {class: 'turf fog', viewBox: `0 0 ${PLATE.width} ${PLATE.height}`, width: PLATE.width, height: PLATE.height});
  fogSvg.innerHTML = '<defs><radialGradient id="fog-soft"><stop offset="0" stop-color="#eef2ea" stop-opacity=".97"/><stop offset=".55" stop-color="#e3eadf" stop-opacity=".85"/><stop offset="1" stop-color="#e3eadf" stop-opacity="0"/></radialGradient></defs>';
  inner.append(canvas, turf, sprites, fogSvg);
  const pins = document.createElement('div'); pins.className = 'pins';
  container.append(inner, pins);
  const decals = turf.querySelector('.decals'), cellsG = turf.querySelector('.cells'), rings = turf.querySelector('.rings');

  const cam = {scale: 1, x: 0, y: 0};
  const spriteMap = new Map(), pinMap = new Map(), cellMap = new Map(), spots = [];
  let plates = null, focusRect = null, drawQueued = false;
  const ready = Promise.all([loadImage(sprite('homeland-gloom')), loadImage(sprite('homeland'))]).then(([gloom, color]) => { plates = {gloom, color}; draw(); });

  function draw() {
    drawQueued = false; if (!plates) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(plates.gloom, 0, 0, PLATE.width, PLATE.height);
    mctx.globalCompositeOperation = 'source-over';
    mctx.clearRect(0, 0, PLATE.width, PLATE.height);
    for (const s of spots) {
      if (s.r <= 1) continue;
      const g = mctx.createRadialGradient(s.x, s.y, s.r * 0.35, s.x, s.y, s.r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = g; mctx.save(); mctx.translate(s.x, s.y); mctx.scale(1, 0.8); mctx.translate(-s.x, -s.y);
      mctx.beginPath(); mctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); mctx.fill(); mctx.restore();
    }
    mctx.globalCompositeOperation = 'source-in';
    mctx.drawImage(plates.color, 0, 0, PLATE.width, PLATE.height);
    ctx.drawImage(mask, 0, 0);
  }
  const queueDraw = () => { if (!drawQueued) { drawQueued = true; requestAnimationFrame(draw); } };

  // Camera
  function applyCamera() {
    inner.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`;
    for (const p of pinMap.values()) placePin(p);
  }
  // `slack` lets the plate edge slide under the HUD bars instead of forcing
  // regions near the painting's edge off-centre.
  let slack = {top: 0, bottom: 0};
  function clamp() {
    const w = container.clientWidth, h = container.clientHeight, sw = PLATE.width * cam.scale, sh = PLATE.height * cam.scale;
    cam.x = sw <= w ? (w - sw) / 2 : Math.min(0, Math.max(w - sw, cam.x));
    cam.y = sh + slack.top + slack.bottom <= h ? (h - sh) / 2 : Math.min(slack.top, Math.max(h - sh - slack.bottom, cam.y));
  }
  function rectOfCells(cells) {
    const ps = cells.map(plateOf), xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
    const x = Math.min(...xs) - PLATE.cell, y = Math.min(...ys) - PLATE.cell * 1.6, x2 = Math.max(...xs) + PLATE.cell, y2 = Math.max(...ys) + PLATE.cell * 0.9;
    return {x, y, width: x2 - x, height: y2 - y};
  }
  function frame(rect, opts = {}) {
    const {pad = 0.3, top = 0, bottom = 0, animate = false, maxScale = 1.3, duration = 650, overscroll = false} = opts;
    slack = overscroll ? {top: top * 0.9, bottom: bottom * 0.6} : {top: 0, bottom: 0};
    focusRect = {rect, opts: {...opts, animate: false}};
    const w = container.clientWidth, h = Math.max(80, container.clientHeight - top - bottom), p = pad * PLATE.cell * 2;
    const scale = Math.min(maxScale, w / (rect.width + p), h / (rect.height + p));
    const target = {scale, x: w / 2 - (rect.x + rect.width / 2) * scale, y: top + h / 2 - (rect.y + rect.height / 2) * scale};
    const from = {...cam}; Object.assign(cam, target); clamp(); Object.assign(target, cam);
    if (!animate || reduced()) { applyCamera(); return Promise.resolve(); }
    Object.assign(cam, from);
    return tween(duration, t => {
      const e = 1 - (1 - t) ** 3;
      cam.scale = from.scale + (target.scale - from.scale) * e; cam.x = from.x + (target.x - from.x) * e; cam.y = from.y + (target.y - from.y) * e;
      applyCamera();
    });
  }
  const fit = (cells, opts) => frame(rectOfCells(cells), opts);
  new ResizeObserver(() => { if (focusRect) frame(focusRect.rect, focusRect.opts); }).observe(container);

  function clientToPlate(cx, cy) { const r = container.getBoundingClientRect(); return [(cx - r.left - cam.x) / cam.scale, (cy - r.top - cam.y) / cam.scale]; }
  function plateToClient([X, Y]) { const r = container.getBoundingClientRect(); return [r.left + cam.x + X * cam.scale, r.top + cam.y + Y * cam.scale]; }
  const cellAt = (cx, cy) => cellOfPlate(clientToPlate(cx, cy));
  const cellToClient = cell => plateToClient(plateOf(cell));

  // Turf polygons: created once per cell, then only their class changes.
  function setCells(entries) {
    const wanted = new Set(entries.map(e => key(...e.cell)));
    for (const [k, node] of cellMap) if (!wanted.has(k)) { node.remove(); cellMap.delete(k); }
    for (const e of entries) {
      const k = key(...e.cell); let node = cellMap.get(k);
      if (!node) {
        const [X, Y] = plateOf(e.cell);
        node = svgEl('polygon', {points: corners(X, Y, PLATE.cell * 0.97).map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')});
        cellsG.append(node); cellMap.set(k, node);
      }
      const tone = ((e.cell[0] - e.cell[1]) % 3 + 3) % 3;
      node.setAttribute('class', `cell t${tone} ${e.cls || ''}`);
    }
  }
  const markCell = (cell, cls, on = true) => cellMap.get(key(...cell))?.classList.toggle(cls, on);
  const clearMarks = cls => { for (const n of cellMap.values()) n.classList.remove(cls); };
  function ringCells(id, cells, cls = 'site-ring') {
    rings.querySelector(`[data-ring="${id}"]`)?.remove();
    if (!cells?.length) return;
    const g = svgEl('g', {'data-ring': id});
    for (const c of cells) { const [X, Y] = plateOf(c); g.append(svgEl('polygon', {class: cls, points: corners(X, Y, PLATE.cell * 0.9).map(p => p.join(',')).join(' ')})); }
    rings.append(g);
  }
  // Small level badge drawn on the ground (storm tiles show what clears them).
  function badge(id, cell, text) {
    rings.querySelector(`[data-badge="${id}"]`)?.remove();
    if (text == null) return;
    const [X, Y] = plateOf(cell), g = svgEl('g', {'data-badge': id, class: 'badge'});
    g.append(svgEl('ellipse', {cx: X, cy: Y, rx: 15, ry: 12}));
    const t = svgEl('text', {x: X, y: Y + 5, 'text-anchor': 'middle'}); t.textContent = text; g.append(t);
    rings.append(g);
  }
  function decal(id, name, cell, {width = PLATE.cell * SQ3 * 1.08, cls = '', opacity = 1} = {}) {
    const old = decals.querySelector(`[data-decal="${id}"]`);
    if (!name) { old?.remove(); return; }
    const [X, Y] = plateOf(cell), h = width * 0.5;
    const img = old || svgEl('image', {'data-decal': id, preserveAspectRatio: 'none'});
    Object.entries({href: sprite(name), x: X - width / 2, y: Y - h / 2, width, height: h, class: `decal ${cls}`, opacity}).forEach(([k, v]) => img.setAttribute(k, v));
    if (!old) decals.append(img);
  }
  function fadeDecal(id) {
    const img = decals.querySelector(`[data-decal="${id}"]`); if (!img) return Promise.resolve();
    if (reduced()) { img.remove(); return Promise.resolve(); }
    return settle(img.animate([{opacity: 1, transform: 'scale(1)'}, {opacity: 0, transform: 'scale(1.25)'}], {duration: 420, easing: 'ease-out'}), 420).then(() => img.remove());
  }

  // Sprites: items, generators, scenery. Placed by their ground foot point.
  function upsertSprite(id, {name, cell, foot, extent, cls = '', z = null, lift = 0.32}) {
    let s = spriteMap.get(id);
    if (!s) { const el = document.createElement('div'); el.innerHTML = '<img alt="" draggable="false">'; sprites.append(el); s = {el, name: null}; spriteMap.set(id, s); }
    const f = foot || plateOf(cell), box = spriteBox(name, [f[0], f[1] + PLATE.cell * lift], extent);
    if (s.name !== name) { s.el.querySelector('img').src = sprite(name); s.name = name; }
    s.el.className = `spr ${cls}`; s.el.dataset.id = id;
    Object.assign(s.el.style, {left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, zIndex: String(z ?? Math.round(f[1] * 2))});
    Object.assign(s, {foot: f, extent, cell, lift});
    return s.el;
  }
  // Moves an existing sprite's foot without touching anything else (drag path).
  function moveSprite(id, foot, {z = null} = {}) {
    const s = spriteMap.get(id); if (!s) return;
    const box = spriteBox(s.name, [foot[0], foot[1] + PLATE.cell * s.lift], s.extent);
    s.el.style.left = `${box.left}px`; s.el.style.top = `${box.top}px`; if (z !== null) s.el.style.zIndex = String(z);
  }
  function removeSprite(id) { const s = spriteMap.get(id); if (s) { s.el.remove(); spriteMap.delete(id); } }
  const spriteEl = id => spriteMap.get(id)?.el || null;
  const spriteIds = () => [...spriteMap.keys()];
  const spriteClient = id => { const s = spriteMap.get(id); if (!s) return null; const r = s.el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.55]; };

  // Screen-space pins keep labels readable at any zoom.
  function placePin(p) { const [x, y] = plateToClient(p.anchor), r = container.getBoundingClientRect(); p.el.style.transform = `translate(${(x - r.left).toFixed(1)}px, ${(y - r.top).toFixed(1)}px) translate(-50%, -100%)`; }
  function upsertPin(id, {anchor, html, cls = '', onClick, label = ''}) {
    let p = pinMap.get(id);
    if (!p) {
      const el = document.createElement('button'); el.type = 'button'; pins.append(el); p = {el}; pinMap.set(id, p);
      // A pin only claims taps on itself when nothing draggable is under it.
      el.addEventListener('pointerdown', e => { if (!itemUnder(e.clientX, e.clientY)) e.stopPropagation(); });
      el.addEventListener('click', e => { e.stopPropagation(); if (!itemUnder(e.clientX, e.clientY)) p.onClick?.(); });
    }
    if (p.html !== html) { p.el.innerHTML = html; p.html = html; }
    p.el.className = `pin ${cls}`; p.anchor = anchor; p.onClick = onClick; if (label) p.el.setAttribute('aria-label', label); placePin(p);
    return p.el;
  }
  function removePin(id) { const p = pinMap.get(id); if (p) { p.el.remove(); pinMap.delete(id); } }
  const pinEl = id => pinMap.get(id)?.el || null;

  // Colour returns around a cell. Spots persist, so reloads restore them.
  function reveal(cell, radiusCells, {duration = 900, instant = false} = {}) {
    const [x, y] = plateOf(cell), R = radiusCells * PLATE.cell * SQ3, spot = {x, y, r: 0};
    spots.push(spot);
    if (instant || reduced() || !plates) { spot.r = R; queueDraw(); return Promise.resolve(); }
    return tween(duration, t => { spot.r = R * (1 - (1 - t) ** 3); draw(); });
  }
  function fog(id, cells) {
    fogSvg.querySelector(`[data-fog="${id}"]`)?.remove();
    if (!cells?.length) return;
    const g = svgEl('g', {'data-fog': id});
    cells.forEach((c, n) => { const [X, Y] = plateOf(c), r = PLATE.cell * (1.55 + (n * 37 % 7) / 12); g.append(svgEl('ellipse', {cx: X + (n * 13 % 9 - 4), cy: Y - 10, rx: r, ry: r * 0.74, fill: 'url(#fog-soft)'})); });
    fogSvg.append(g);
  }
  function clearFog(id, duration = 1300) {
    const g = fogSvg.querySelector(`[data-fog="${id}"]`); if (!g) return Promise.resolve();
    if (reduced()) { g.remove(); return Promise.resolve(); }
    return settle(g.animate([{opacity: 1, transform: 'translate(0,0)'}, {opacity: 0, transform: 'translate(40px,-30px)'}], {duration, easing: 'ease-in'}), duration).then(() => g.remove());
  }

  // Tap targets: the topmost sprite under the finger, else any interactive
  // sprite whose box contains the point (sprites are small on a phone).
  function spriteAtPoint(x, y) {
    const item = itemUnder(x, y); if (item) return item;
    const hit = document.elementFromPoint(x, y)?.closest?.('.spr');
    if (hit && (hit.classList.contains('site') || hit.classList.contains('gen'))) return hit.dataset.id;
    let best = null, bestD = Infinity;
    for (const [id, s] of spriteMap) {
      if (!/\b(item|gen|site)\b/.test(s.el.className)) continue;
      const r = s.el.getBoundingClientRect(), pad = 10;
      if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) continue;
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height * .6));
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  function itemUnder(x, y) {
    for (const [id, sp] of spriteMap) {
      if (!sp.el.classList.contains('item')) continue;
      const r = sp.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }

  // Gestures: tap, drag (targets the game accepts) and pan (everything else).
  let gesture = null;
  const targetOf = e => spriteAtPoint(e.clientX, e.clientY);
  container.addEventListener('pointerdown', e => {
    if (gesture || e.button > 0 || e.isPrimary === false) return;
    if (e.target.closest?.('.pin') && !itemUnder(e.clientX, e.clientY)) return;
    const cell = cellAt(e.clientX, e.clientY), id = targetOf(e);
    gesture = {pointer: e.pointerId, start: [e.clientX, e.clientY], last: [e.clientX, e.clientY], cell, id, moved: false, dragging: false, panFrom: [cam.x, cam.y]};
    try { container.setPointerCapture(e.pointerId); } catch { /* synthetic pointers in tests */ }
    handlers.onPress?.(cell, id);
  });
  // Move/up are read from the window so a finger released over the HUD (or a
  // lost pointer capture) still ends the gesture instead of leaving it open.
  window.addEventListener('pointermove', e => {
    if (!gesture || gesture.pointer !== e.pointerId) return;
    const dx = e.clientX - gesture.start[0], dy = e.clientY - gesture.start[1];
    gesture.last = [e.clientX, e.clientY];
    if (!gesture.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      gesture.moved = true; gesture.dragging = onDragStart(gesture.cell, gesture.id, [e.clientX, e.clientY]) === true;
    }
    if (gesture.dragging) { const foot = clientToPlate(e.clientX, e.clientY - liftPx); onDragMove(cellOfPlate(foot), foot, [e.clientX, e.clientY]); }
    else { cam.x = gesture.panFrom[0] + dx; cam.y = gesture.panFrom[1] + dy; clamp(); applyCamera(); onPan(); }
  });
  function end(e, cancelled) {
    if (!gesture || gesture.pointer !== e.pointerId) return;
    const g = gesture; gesture = null;
    try { container.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (g.dragging) { const foot = clientToPlate(g.last[0], g.last[1] - liftPx); onDragEnd(cancelled ? null : cellOfPlate(foot), foot, g.last); return; }
    if (!g.moved && !cancelled) onTap(g.cell, g.id, [e.clientX, e.clientY]);
  }
  window.addEventListener('pointerup', e => end(e, false));
  window.addEventListener('pointercancel', e => end(e, true));

  return {
    container, inner, cam, ready, fit, frame, rectOfCells, clientToPlate, plateToClient, cellAt, cellToClient,
    setCells, markCell, clearMarks, ringCells, badge, decal, fadeDecal, upsertSprite, moveSprite, removeSprite, spriteEl, spriteIds, spriteClient,
    upsertPin, removePin, pinEl, reveal, fog, clearFog, spriteAtPoint, isGesturing: () => !!gesture
  };
}
