// Prototype B · 纯合成: tap generators, merge on the hex map, clear storm debris
// by merging beside it, fill residents' orders, install components to repair
// the camp, the creek valley and the river bend. Rules live in rules.mjs.
import * as R from './rules.mjs';
import {createWorld, plateOf, PLATE} from '../shared/world.mjs';
import {key, parseKey, neighbors} from '../shared/hex.mjs';
import {CHAINS, nameOf, matName} from '../shared/art.mjs';
import {SPOTS, REGIONS, regionOfCell, regionFrame, AREA} from '../shared/map.mjs';
import {CAST, INTRO, LETTER, DIARY, OUTRO} from '../shared/chapter.mjs';
import {renderScenery, creekLayer, renderLife} from '../shared/scenery.mjs';
import {sfx, unlock, setMuted} from '../shared/audio.mjs';
import {burst, ring, floatText, fly, squash, shake, haptic, centerOf, reducedMotion} from '../shared/fx.mjs';
import {createStore, createMetrics} from '../shared/store.mjs';
import {$, esc, wait, sprite, toast, sheet, speak, converse} from '../shared/ui.mjs';
import {icon} from '../shared/icons.mjs';

const PORTRAIT = {mira: sprite('portrait-mira'), lina: sprite('portrait-lina'), rowan: sprite('portrait-rowan')};
const NAMES = Object.fromEntries(Object.entries(CAST).map(([k, v]) => [k, v.name]));
const store = createStore('forest-camp.lite-b', R.VERSION);
const saved = store.load(() => null) || {};
let state = saved.state && R.validate(saved.state) ? saved.state : R.freshState();
const metrics = createMetrics(saved.metrics);
let muted = !!saved.muted; setMuted(muted);
let seenDiary = saved.seenDiary ?? 1;
let view = saved.view && REGIONS[saved.view] && R.isOpen(state, saved.view) ? saved.view : 'camp';
let selected = null, busy = false, drag = null;

const app = $('#app');
app.innerHTML = `
  <div id="world"></div>
  <header class="hud">
    <button class="pill energy" id="energy" aria-label="体力"><span class="pill-icon">${icon.energy}</span><span id="energy-n"></span><small id="energy-t"></small><span class="plus" aria-hidden="true">+</span></button>
    <div class="pill" id="coins"><span class="pill-icon">${icon.star}</span><span id="coins-n"></span></div>
    <div class="spacer"></div>
    <button class="icon-btn" id="diary" aria-label="外婆的手记">${icon.book}<b id="diary-dot" hidden></b></button>
    <button class="icon-btn" id="settings" aria-label="设置">${icon.gear}</button>
  </header>
  <nav class="regions" id="regions" aria-label="切换地区"></nav>
  <section class="orders" id="orders" aria-label="居民的请求"></section>
  <footer class="bottom">
    <div class="panel" id="panel" aria-live="polite"></div>
    <div class="bottom-row"><div class="bag" id="bag" aria-label="背包"></div><button class="icon-btn hint-btn" id="hint" aria-label="提示">${icon.hint}</button></div>
  </footer>`;

const world = createWorld($('#world'), {onPress: () => unlock(), onTap: handleTap, onDragStart: startDrag, onDragMove: moveDrag, onDragEnd: endDrag});
const creek = creekLayer($('#world'));

// ---------- persistence ----------
function save() { store.save({state, metrics: metrics.data, muted, view, seenDiary}); }
setInterval(() => { if (!busy) { R.tick(state); renderHud(); } }, 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden) { metrics.flush(); save(); } else { R.tick(state); render(); } });

// ---------- camera ----------
const findItem = id => state.items.find(i => i.id === id) || state.bag.find(i => i.id === id);
const sameKind = (a, b) => { const x = findItem(a), y = findItem(b); return x && y && x.id !== y.id && x.chain === y.chain && x.level === y.level && x.level < 7; };
// Frame the region's land plus the debris that touches it, so the camera
// widens as the clearing grows.
function frameCells(region) {
  if (!R.isOpen(state, region)) return regionFrame(region);
  const land = R.landCells(state).filter(c => regionOfCell(c) === region), keys = new Set(land.map(c => key(...c)));
  const edge = R.stormCells(state).filter(t => t.region === region && neighbors(...t.cell).some(n => keys.has(key(...n)))).map(t => t.cell);
  return regionFrame(region, [...land, ...edge]);
}
function insets() {
  const a = app.getBoundingClientRect();
  return {top: $('#orders').getBoundingClientRect().bottom - a.top + 6, bottom: a.bottom - $('.bottom').getBoundingClientRect().top + 4};
}
function focusRegion(region, animate = true) {
  view = region; save(); renderRegions();
  return world.fit(frameCells(region), {...insets(), pad: .05, animate, maxScale: 1.2, overscroll: true});
}

// ---------- rendering ----------
function renderTurf() {
  const entries = R.landCells(state).map(c => ({cell: c, cls: 'free'}));
  const items = state.items.filter(i => i.cell);
  for (const t of R.stormCells(state)) {
    const near = items.some(i => neighbors(...i.cell).some(n => key(...n) === key(...t.cell)) && i.level >= t.level);
    entries.push({cell: t.cell, cls: 'storm' + (near ? ' frontier' : '')});
  }
  world.setCells(entries);
  for (const [k, t] of R.STORM) {
    const show = !state.healed.includes(k) && R.isOpen(state, t.region);
    world.decal('storm-' + k, show ? (t.level >= 4 ? 'ground-gravel' : t.level >= 3 ? 'ground-roots' : 'ground-chips') : null, t.cell, {cls: 'debris'});
    const edge = show && neighbors(...t.cell).some(n => R.isLand(state, n));
    world.badge('storm-' + k, t.cell, edge ? `L${t.level}` : null);
  }
  world.fog('creek', R.isOpen(state, 'creek') ? null : [...AREA.creek, ...AREA.river]);
}
function renderSites() {
  const carrying = drag && findItem(drag.id), glow = new Set();
  if (carrying) for (const r of R.availableRepairs(state)) if (carrying.chain === r.chain && carrying.level === r.level) glow.add(r.spot);
  renderScenery(world, state.done, {glow, dim: spot => !R.isOpen(state, R.SPOT_REGION[spot])});
  for (const [id, g] of Object.entries(R.GENERATORS)) {
    if (!g.art) continue;
    world.upsertSprite('gen-' + id, {name: g.art, cell: SPOTS[g.spot], extent: PLATE.cell * 2, cls: 'gen' + (R.generatorOpen(state, id) ? '' : ' dim'), lift: .2});
  }
  creek.set(R.done(state, 'stream') ? 'flow' : 'dry');
  renderLife(world, state.done);
}
function renderItems() {
  const live = new Set(state.items.map(i => 'item-' + i.id));
  for (const id of world.spriteIds()) if (id.startsWith('item-') && !live.has(id)) world.removeSprite(id);
  const repairs = R.availableRepairs(state), wanted = new Set(state.orders.flatMap(o => R.orderNeeds(o).map(([c, l]) => c + l)));
  for (const i of state.items) {
    if (drag?.id === i.id) continue;
    const goal = repairs.some(r => r.chain === i.chain && r.level === i.level) || wanted.has(i.chain + i.level);
    const match = selected && sameKind(selected, i.id);
    world.upsertSprite('item-' + i.id, {name: matName(i.chain, i.level), cell: i.cell, extent: PLATE.cell * (1.4 + i.level * .08),
      cls: `item ${selected === i.id ? 'selected' : ''} ${match ? 'match-target' : ''} ${goal ? 'goal' : ''}`});
  }
}
function renderPins() {
  const repairs = R.availableRepairs(state), all = [...state.items, ...state.bag];
  for (const r of R.REPAIRS) {
    const id = 'pin-' + r.id, [x, y] = plateOf(SPOTS[r.spot]);
    // Only one pin per spot: the next repair there.
    if (!repairs.includes(r) || !R.isOpen(state, R.SPOT_REGION[r.spot]) || repairs.some(o => o.spot === r.spot && R.REPAIRS.indexOf(o) < R.REPAIRS.indexOf(r))) { world.removePin(id); continue; }
    const ready = all.some(i => i.chain === r.chain && i.level === r.level);
    world.upsertPin(id, {anchor: [x, y - PLATE.cell * 1.85], cls: 'clickable site ' + (ready ? 'ready' : ''), label: r.title,
      html: `<img src="${sprite(matName(r.chain, r.level))}" alt=""><span class="lvl">L${r.level}</span>${ready ? icon.check.replace('<svg', '<svg width="18" height="18"') : ''}`,
      onClick: () => showRepair(r)});
  }
  for (const [id, g] of Object.entries(R.GENERATORS)) {
    const pid = 'gen-' + id, [x, y] = plateOf(SPOTS[g.spot]);
    if (!R.generatorOpen(state, id)) { world.removePin(pid); continue; }
    world.upsertPin(pid, {anchor: [x - PLATE.cell * 1.2, y - PLATE.cell * .2], cls: 'clickable gen-pin', label: `${g.name}：点一下产出${CHAINS[g.chain].label}材料`,
      html: `${icon.energy.replace('<svg', '<svg width="13" height="13"')}${CHAINS[g.chain].label}`, onClick: () => tapGen(id)});
  }
  world.removePin('creek-lock');
  if (!R.isOpen(state, 'creek')) { const [x, y] = plateOf([7, -1]); world.upsertPin('creek-lock', {anchor: [x, y], cls: 'clickable locked', html: `${icon.lock.replace('<svg', '<svg width="18" height="18"')} 修好旧路后开放`, onClick: () => toast('先把营地东边的旧路修好（施工支架 L5）')}); }
}
function renderRegions() {
  $('#regions').innerHTML = Object.entries(REGIONS).map(([id, r]) => {
    const open = R.isOpen(state, id), work = open && id !== view && regionHasWork(id);
    return `<button data-region="${id}" class="${id === view ? 'on' : ''} ${work ? 'attention' : ''}" ${open ? '' : 'disabled'}>${open ? '' : icon.lock.replace('<svg', '<svg width="12" height="12"')}${r.short}</button>`;
  }).join('');
}
function regionHasWork(region) {
  const here = state.items.filter(i => regionOfCell(i.cell) === region);
  if (R.availableRepairs(state).some(r => R.SPOT_REGION[r.spot] === region && [...state.items, ...state.bag].some(i => i.chain === r.chain && i.level === r.level))) return true;
  return here.some((a, n) => here.some((b, m) => m > n && a.chain === b.chain && a.level === b.level && a.level < 7));
}
function renderHud() {
  R.tick(state);
  $('#energy-n').textContent = `${state.energy}/${state.maxEnergy}`;
  const next = R.nextEnergyIn(state);
  $('#energy-t').textContent = next ? `${Math.ceil(next / 1000)}s` : '';
  $('#energy').classList.toggle('low', state.energy < 5);
  $('#coins-n').textContent = state.coins;
  $('#diary-dot').hidden = state.diary.length <= seenDiary;
}
function renderOrders() {
  const all = [...state.items, ...state.bag];
  $('#orders').innerHTML = state.orders.map(o => {
    const t = R.ORDERS.find(x => x.id === o.id), picks = R.pickForOrder(state, o), used = new Set();
    const needs = t.needs.map(([chain, lv]) => {
      const have = all.find(i => !used.has(i.id) && i.chain === chain && i.level === lv); if (have) used.add(have.id);
      return `<span class="need ${have ? 'have' : ''}"><img src="${sprite(matName(chain, lv))}" alt="${nameOf(chain, lv)}"><b>${lv}</b></span>`;
    }).join('');
    return `<button class="order ${picks ? 'ready' : ''}" data-order="${o.id}" aria-label="${NAMES[t.who]}：${esc(t.text)}"><span class="who"><img src="${PORTRAIT[t.who]}" alt=""></span><span class="needs">${needs}</span><span class="reward">${picks ? '<em>交付</em>' : `<span>${icon.star}${t.coins}</span>`}</span>${t.diary && !state.diary.includes(t.diary) ? '<i class="page" title="会找回一页手记"></i>' : ''}</button>`;
  }).join('');
}
function renderBag() {
  const slots = Array.from({length: state.bagSize}, (_, n) => state.bag[n]);
  $('#bag').innerHTML = `<span class="bag-label">${icon.bag}</span>` + slots.map((i, n) => i
    ? `<button class="slot filled" data-bag="${i.id}" aria-label="背包：${nameOf(i.chain, i.level)} L${i.level}"><img src="${sprite(matName(i.chain, i.level))}" alt=""><b>${i.level}</b></button>`
    : `<span class="slot" data-slot="${n}"></span>`).join('');
}
function renderPanel() {
  const item = selected && findItem(selected), panel = $('#panel');
  if (item) {
    const c = CHAINS[item.chain], max = state.discovered[item.chain];
    const ladder = c.names.map((n, j) => `<span class="${j + 1 === item.level ? 'current' : ''} ${j + 1 > max ? 'unknown' : ''}"><img src="${sprite(matName(item.chain, j + 1))}" alt=""></span>`).join('');
    panel.innerHTML = `<div class="copy"><strong>${nameOf(item.chain, item.level)} <em>L${item.level}</em></strong><div class="ladder">${ladder}</div></div>
      <div class="acts">${item.cell ? `<button class="btn secondary" data-act="store">${icon.bag}收起</button>` : `<button class="btn secondary" data-act="place">放回</button>`}<button class="btn secondary" data-act="sell">${icon.star}${R.sellPrice(item.level)}</button></div>`;
    panel.className = 'panel item';
    return;
  }
  panel.className = 'panel goal';
  const repairs = R.availableRepairs(state);
  if (!repairs.length) { panel.className = 'panel goal finished'; panel.innerHTML = `<span class="art"><img src="${sprite('v11-cookfire')}" alt=""></span><div class="copy"><strong>第一章完成了</strong><small>山坡上的信号灯，下一章见</small></div>`; return; }
  const here = repairs.filter(r => R.SPOT_REGION[r.spot] === view), list = (here.length ? here : repairs).slice(0, 3), all = [...state.items, ...state.bag];
  panel.innerHTML = `<div class="tasks">${list.map(r => {
    const ready = all.some(i => i.chain === r.chain && i.level === r.level), best = Math.max(0, ...all.filter(i => i.chain === r.chain && i.level <= r.level).map(i => i.level));
    return `<button class="task ${ready ? 'ready' : ''}" data-task="${r.id}"><span class="art"><img src="${sprite(matName(r.chain, r.level))}" alt=""></span><span class="copy"><strong>${r.title}</strong><small>${ready ? '拖到工地上' : `${CHAINS[r.chain].label} L${r.level} · 现有最高 L${best}`}</small></span></button>`;
  }).join('')}</div>${repairs.length > list.length ? `<small class="more">还有 ${repairs.length - list.length} 处可修</small>` : ''}`;
}
function render() { renderTurf(); renderSites(); renderItems(); renderPins(); renderRegions(); renderHud(); renderOrders(); renderBag(); renderPanel(); save(); }

// ---------- interactions ----------
function handleTap(cell, spriteId) {
  if (busy) return;
  if (spriteId?.startsWith('gen-')) { tapGen(spriteId.slice(4)); return; }
  const item = spriteId?.startsWith('item-') ? findItem(spriteId.slice(5)) : R.itemAt(state, cell);
  if (item) {
    if (selected && sameKind(selected, item.id)) { doMerge(selected, item.id); return; }
    selected = selected === item.id ? null : item.id; sfx.tap(); render(); return;
  }
  const spot = spriteId?.startsWith('site-') ? spriteId.slice(5) : null;
  if (spot) {
    const gen = Object.entries(R.GENERATORS).find(([, g]) => g.spot === spot)?.[0];
    const repair = R.availableRepairs(state).find(r => r.spot === spot), it = selected && findItem(selected);
    if (repair && it && it.chain === repair.chain && it.level === repair.level) { doInstall(it.id, repair.id); return; }
    if (gen && R.generatorOpen(state, gen)) { tapGen(gen); return; }
    if (repair) showRepair(repair);
    return;
  }
  if (selected && R.isFree(state, cell)) { const res = R.move(state, selected, cell); if (res.ok) { state = res.state; sfx.drop(); selected = null; render(); } return; }
  const storm = R.STORM.get(key(...cell));
  if (storm && !state.healed.includes(key(...cell)) && R.isOpen(state, storm.region)) { toast(`在旁边合出 L${storm.level} 或更高的素材，就能清走这里的残骸`); return; }
  if (selected) { selected = null; render(); }
}

async function tapGen(id) {
  if (busy) return;
  const g = R.GENERATORS[id], res = R.tapGenerator(state, id);
  if (!res.ok) {
    if (res.needEnergy) { metrics.count('体力耗尽弹窗'); offerEnergy(); return; }
    if (res.noSpace) { metrics.count('空间不足'); sfx.error(); toast(res.message, {tone: 'bad'}); shake(genEl(id), 5); haptic(30); showHint(false); return; }
    toast(res.message); return;
  }
  state = res.state; metrics.count('点击生成器');
  const item = res.events.find(e => e.type === 'spawn').item;
  renderItems(); renderTurf();
  const el = world.spriteEl('item-' + item.id), src = genEl(id), from = src ? centerOf(src) : world.cellToClient(SPOTS[g.spot]);
  if (src) squash(src, {from: .85, peak: 1.1, duration: 240});
  if (el && !reducedMotion()) { el.style.opacity = '0'; await fly(sprite(matName(item.chain, item.level)), from, world.spriteClient('item-' + item.id), {size: 44, duration: 280, arc: -60}); el.style.opacity = ''; squash(el, {from: .6, peak: 1.15, duration: 280}); }
  sfx.spawn(item.level); haptic(6);
  await afterEvents(res.events);
}
const genEl = id => world.spriteEl('gen-' + id) || world.spriteEl('site-' + R.GENERATORS[id].spot);

function startDrag(cell, spriteId) {
  if (busy) return false;
  const id = spriteId?.startsWith('item-') ? spriteId.slice(5) : R.itemAt(state, cell)?.id;
  if (!id) return false;
  drag = {id, target: null}; selected = id; sfx.lift(); haptic(6);
  world.spriteEl('item-' + id)?.classList.add('lifted');
  renderSites(); renderPanel();
  for (const i of state.items) world.spriteEl('item-' + i.id)?.classList.toggle('match-target', sameKind(id, i.id));
  return true;
}
function moveDrag(cell, foot, client) {
  if (!drag) return;
  world.moveSprite('item-' + drag.id, foot, {z: 9000});
  const overBag = !!document.elementFromPoint(client[0], client[1])?.closest('#bag');
  $('#bag').classList.toggle('drop', overBag);
  if (overBag) { drag.target = {type: 'store'}; world.clearMarks('drop-ok'); drag.k = null; return; }
  if (drag.k === key(...cell)) return;
  drag.k = key(...cell); world.clearMarks('drop-ok');
  const other = R.itemAt(state, cell), item = findItem(drag.id);
  const spot = Object.entries(SPOTS).find(([, c]) => key(...c) === key(...cell))?.[0];
  const repair = spot && R.availableRepairs(state).find(r => r.spot === spot && item.chain === r.chain && item.level === r.level);
  if (other && sameKind(drag.id, other.id)) drag.target = {type: 'merge', id: other.id};
  else if (repair) drag.target = {type: 'install', repair: repair.id};
  else if (R.isLand(state, cell)) { drag.target = {type: 'move', cell}; world.markCell(cell, 'drop-ok'); }
  else drag.target = null;
}
async function endDrag(cell) {
  const d = drag; drag = null; world.clearMarks('drop-ok'); $('#bag').classList.remove('drop');
  if (!d) return;
  world.spriteEl('item-' + d.id)?.classList.remove('lifted');
  if (d.target?.type === 'store') { const res = R.store(state, d.id); if (res.ok) { state = res.state; selected = null; sfx.drop(); metrics.count('放入背包'); } else { toast(res.message, {tone: 'bad'}); sfx.error(); } render(); return; }
  if (!d.target || !cell) { sfx.drop(); render(); return; }
  if (d.target.type === 'merge') return doMerge(d.id, d.target.id, true);
  if (d.target.type === 'install') return doInstall(d.id, d.target.repair);
  if (d.target.type === 'move') { const res = R.move(state, d.id, d.target.cell); if (res.ok) { state = res.state; sfx.drop(); } selected = null; render(); }
}

async function doMerge(aId, bId, dragged = false) {
  const a = findItem(aId), res = R.merge(state, aId, bId);
  if (!res.ok) { toast(res.message, {tone: 'bad'}); sfx.error(); render(); return; }
  busy = true;
  const target = world.spriteClient('item-' + bId);
  if (!dragged && !reducedMotion()) {
    const from = a.cell ? world.spriteClient('item-' + aId) : centerOf($(`[data-bag="${aId}"]`) || $('#bag'));
    world.spriteEl('item-' + aId)?.style.setProperty('opacity', '0');
    await fly(sprite(matName(a.chain, a.level)), from, target, {size: 50, duration: 200, arc: -30});
  }
  state = res.state; selected = null; metrics.count('合成');
  const item = res.events.find(e => e.type === 'merge').item;
  render();
  const el = world.spriteEl('item-' + item.id), at = world.spriteClient('item-' + item.id) || target;
  squash(el, {from: .45, peak: 1.25, duration: 400});
  burst(at[0], at[1], {count: 10 + item.level * 2, colors: [CHAINS[item.chain].color, '#fff6c8', '#ffffff'], spread: 46 + item.level * 8, shape: item.chain === 'reed' ? 'leaf' : item.chain === 'water' ? 'dot' : 'chip'});
  ring(at[0], at[1], {size: 70 + item.level * 12});
  sfx.merge(item.level); haptic(10 + item.level * 2);
  busy = false;
  await afterEvents(res.events);
}

async function afterEvents(events) {
  let healed = 0;
  for (const e of events) {
    if (e.type === 'heal') {
      healed++;
      const p = world.cellToClient(e.cell);
      world.reveal(e.cell, 0.9, {duration: 700}); world.fadeDecal('storm-' + key(...e.cell));
      burst(p[0], p[1], {count: 12, colors: ['#a7e86a', '#fff3b0', '#6fbf4a'], spread: 46, shape: 'leaf'});
      if (e.bonus?.energy) { floatText(p[0], p[1] - 6, `+${e.bonus.energy}`, {size: 16, color: '#ffe36b'}); sfx.energy(); }
      else if (e.bonus?.coins) { floatText(p[0], p[1] - 6, `+${e.bonus.coins}★`, {size: 16, color: '#fff3a1'}); sfx.coin(); }
      else if (e.bonus?.item) floatText(p[0], p[1] - 6, '残骸里有东西！', {size: 14, color: '#ffe36b'});
      metrics.count('清理残骸');
    }
    if (e.type === 'bloom') world.reveal(e.cell, 0.45, {duration: 500});
    if (e.type === 'discover') await showDiscovery(e);
    if (e.type === 'diary') { metrics.count('手记'); await wait(300); diaryToast(e.page); }
    if (e.type === 'empty') { await wait(200); offerEnergy(); }
  }
  if (healed) sfx.sparkle();
  render();
  if (healed) await maybeGrowCamera();
  if (R.isStuck(state)) toast('没有可合成的了。把一件收进背包或卖掉，腾出空地。', {ms: 3200});
  maybeTutorial();
}
// When the clearing grows past the frame, widen the camera.
async function maybeGrowCamera() {
  const land = R.landCells(state).filter(c => regionOfCell(c) === view);
  const box = world.container.getBoundingClientRect(), {top, bottom} = insets();
  const outside = land.some(c => { const [x, y] = world.cellToClient(c); return x < box.left + 14 || x > box.right - 14 || y < box.top + top || y > box.bottom - bottom; });
  if (outside) await focusRegion(view, true);
}

let discoverTimer;
async function showDiscovery(e) {
  if (e.level <= 1) return;
  metrics.count('新发现');
  let el = $('.discover');
  if (!el) { el = document.createElement('div'); el.className = 'discover'; app.append(el); }
  el.innerHTML = `<img src="${sprite(matName(e.chain, e.level))}" alt=""><div><small>新发现 · ${CHAINS[e.chain].label} L${e.level}</small><strong>${nameOf(e.chain, e.level)}</strong></div>`;
  el.classList.add('show'); sfx.chime(); clearTimeout(discoverTimer);
  discoverTimer = setTimeout(() => el.classList.remove('show'), 1700);
}
function diaryToast(page) {
  sfx.sparkle(.1);
  const el = document.createElement('button'); el.className = 'diary-toast'; el.innerHTML = `${icon.book}<span><small>找回一页外婆的手记</small>${esc(DIARY[page].slice(0, 16))}…</span>`;
  app.append(el); requestAnimationFrame(() => el.classList.add('show'));
  el.addEventListener('click', () => { el.remove(); showDiary(page); });
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4200);
}

async function doInstall(itemId, repairId) {
  const r = R.repairById(repairId), item = findItem(itemId), res = R.install(state, itemId, repairId);
  if (!res.ok) { toast(res.message, {tone: 'bad'}); sfx.error(); render(); return; }
  busy = true; selected = null; hideHand(); metrics.count('修复'); metrics.event('repair', {id: repairId});
  const site = SPOTS[r.spot], from = item.cell ? world.spriteClient('item-' + itemId) : centerOf($('#bag'));
  world.removeSprite('item-' + itemId); world.removePin('pin-' + r.id);
  const region = R.SPOT_REGION[r.spot];
  await world.fit([site], {...insets(), pad: 1.8, animate: true, maxScale: 1.3, duration: 450, overscroll: true});
  const to = world.cellToClient(site);
  await fly(sprite(matName(item.chain, item.level)), from || to, [to[0], to[1] - 20], {size: 64, duration: 480, arc: -120, spin: 20});
  sfx.build();
  shake(world.spriteEl('site-' + r.spot), 6, 300);
  for (let n = 0; n < 3; n++) { burst(to[0] + (n - 1) * 18, to[1] - 18, {count: 8, colors: ['#ffe9a6', '#ffffff', '#d7a35a'], spread: 40, shape: 'chip'}); await wait(110); }
  state = res.state;
  const revealDone = world.reveal(site, r.reveal, {duration: 1400});
  render();
  const fixed = world.spriteEl('site-' + r.spot);
  if (fixed) { fixed.classList.add('just-built'); setTimeout(() => fixed.classList.remove('just-built'), 900); }
  burst(to[0], to[1] - 30, {count: 26, colors: ['#ffd25e', '#fff3b0', '#ffffff', '#8fdc4e'], spread: 120, shape: 'star', duration: 900});
  ring(to[0], to[1], {size: 220, width: 5, duration: 700});
  if (r.reward?.text) floatText(to[0], to[1] - 70, r.reward.text, {cls: 'big', rise: 60, duration: 1700, size: 22});
  if (r.creek) { creek.fill(); world.reveal([4, -2], 3, {duration: 2200}); world.reveal([1, -1], 1.6, {duration: 2400}); }
  await revealDone;
  for (const e of res.events) {
    if (e.type === 'open') { world.clearFog('creek'); world.reveal([5, -1], 1.2, {duration: 1500}); world.reveal([10, -2], 1.2, {duration: 1500}); }
    if (e.type === 'heal' && e.wash) { world.reveal(e.cell, .9, {duration: 900}); world.fadeDecal('storm-' + key(...e.cell)); }
  }
  // Settle the camera before handing control back, so it never jumps mid-play.
  const opened = res.events.some(e => e.type === 'open');
  await focusRegion(opened ? 'creek' : region);
  if (opened) toast('旧溪谷和芦苇河湾开放了！', {tone: 'good', ms: 2400});
  busy = false;
  render();
  await converse(r.lines, {at: () => world.cellToClient(site), portrait: PORTRAIT, names: NAMES, root: app});
  for (const e of res.events) if (e.type === 'diary') diaryToast(e.page);
  if (res.events.some(e => e.type === 'letter')) await showLetter();
  if (res.events.some(e => e.type === 'finale')) await ending();
}

async function showLetter() {
  sfx.chime(); metrics.event('letter');
  const el = document.createElement('div'); el.className = 'letter';
  el.innerHTML = `<div class="card"><h3>${LETTER.to}</h3><p>${LETTER.text}</p><div class="sign">——${LETTER.from}</div><button class="btn">把信收好</button></div>`;
  app.append(el); requestAnimationFrame(() => el.classList.add('show'));
  await new Promise(r => el.querySelector('button').addEventListener('click', r, {once: true}));
  el.classList.remove('show'); await wait(250); el.remove();
}
async function ending() {
  metrics.event('complete'); metrics.flush(); sfx.fanfare();
  const s = state.stats;
  await sheet({cls: 'center', title: OUTRO.title, body: `<p>${OUTRO.text}</p><div class="end-stats"><div><b>${s.merges}</b><small>次合成</small></div><div><b>${s.repairs}</b><small>处修复</small></div><div><b>${s.orders}</b><small>个请求</small></div><div><b>${s.heals}</b><small>块残骸清理</small></div></div><p class="next">${OUTRO.next}</p>`, actions: [{label: '继续在故乡合成', value: 'stay'}]});
}
function showRepair(r) {
  const p = world.cellToClient(SPOTS[r.spot]), it = [...state.items, ...state.bag].find(i => i.chain === r.chain && i.level === r.level);
  if (it) { pointInstall(it, r); return; }
  speak(p, PORTRAIT[r.lines[0][0]], `${r.title}——需要 ${nameOf(r.chain, r.level)}（${CHAINS[r.chain].label} L${r.level}）。`, {root: app, name: NAMES[r.lines[0][0]]});
}
async function showDiary(focus = null) {
  metrics.count('看手记'); seenDiary = state.diary.length; save(); renderHud();
  const pages = DIARY.map((t, i) => state.diary.includes(i) ? `<li class="${i === focus ? 'new' : ''}"><b>${i + 1}</b><p>${esc(t)}</p></li>` : `<li class="lost"><b>${i + 1}</b><p>这一页还没找回来。</p></li>`).join('');
  await sheet({title: '外婆的手记', body: `<ol class="diary">${pages}</ol><p class="hint">修好营地里的东西、帮邻居们的忙，会找回散落的手记。</p>`, actions: [{label: '合上手记', value: 1}]});
}
async function offerEnergy() {
  sfx.error();
  const freeIn = R.freeRefillIn(state), canFree = freeIn === 0, canBuy = state.coins >= R.ENERGY.refillCost;
  const choice = await sheet({title: '体力用完了', body: `<p>体力每 ${R.ENERGY.regenMs / 1000} 秒恢复 1 点（体验版加速）。也可以先合成、交付请求，请求会返还一点体力。</p>`,
    actions: [{label: canFree ? `免费领 ${R.ENERGY.freeRefill} 体力（模拟看广告）` : `免费补给 ${Math.ceil(freeIn / 1000)} 秒后可用`, kind: 'gold', value: 'free', disabled: !canFree},
      {label: `用 ${R.ENERGY.refillCost} 金币换 ${R.ENERGY.refillAmount} 体力`, kind: 'secondary', value: 'buy', disabled: !canBuy}, {label: '等一会儿', kind: 'ghost', value: 'wait'}]});
  if (choice === 'free' || choice === 'buy') {
    const res = R.buyEnergy(state, {free: choice === 'free'});
    if (!res.ok) { toast(res.message, {tone: 'bad'}); return; }
    state = res.state; metrics.count(choice === 'free' ? '免费体力' : '金币买体力'); sfx.energy();
    const p = centerOf($('#energy')); floatText(p[0] + 30, p[1] + 24, `+${res.events[0].amount}`, {color: '#ffe36b'}); render();
  } else metrics.count('选择等待');
}

// ---------- HUD buttons ----------
app.addEventListener('click', async e => {
  if (busy) return;
  const order = e.target.closest('[data-order]');
  if (order) {
    const t = R.ORDERS.find(o => o.id === order.dataset.order), res = R.deliver(state, order.dataset.order);
    if (!res.ok) {
      const missing = t.needs.map(([c, l]) => `${CHAINS[c].label} L${l}`).join('、');
      speak(centerOf(order), PORTRAIT[t.who], `${t.text}（需要 ${missing}）`, {root: app, name: NAMES[t.who]}); return;
    }
    const ev = res.events[0], dest = centerOf(order);
    busy = true;
    await Promise.all(ev.consumed.map((it, n) => { const from = it.cell ? world.spriteClient('item-' + it.id) : centerOf($('#bag')); world.removeSprite('item-' + it.id); return fly(sprite(matName(it.chain, it.level)), from || dest, dest, {size: 46, duration: 400, delay: n * 80, arc: -90}); }));
    state = res.state; metrics.count('完成请求');
    sfx.coin(); sfx.coin(.12);
    floatText(dest[0], dest[1] + 34, `+${ev.coins}★  +${ev.energy}⚡`, {size: 17, color: '#fff3a1'});
    burst(dest[0], dest[1], {count: 16, colors: ['#ffd25e', '#fff'], spread: 60, shape: 'star'});
    busy = false;
    speak(dest, PORTRAIT[t.who], ['谢谢！', '太好了！', '就是这个！', '帮大忙了！'][state.stats.orders % 4], {ms: 1200, root: app, name: NAMES[t.who]});
    render();
    for (const x of res.events) if (x.type === 'diary') diaryToast(x.page);
    maybeTutorial(); return;
  }
  const task = e.target.closest('[data-task]');
  if (task) { const r = R.repairById(task.dataset.task); const region = R.SPOT_REGION[r.spot]; if (region !== view) await focusRegion(region); showRepair(r); return; }
  const bagItem = e.target.closest('[data-bag]');
  if (bagItem) {
    const id = bagItem.dataset.bag;
    if (selected && selected !== id && sameKind(selected, id) && findItem(selected).cell) { await doMerge(id, selected); return; }
    const res = R.unbag(state, id, REGIONS[view].center); if (res.ok) { state = res.state; selected = id; sfx.drop(); render(); } else toast(res.message, {tone: 'bad'}); return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'store' && selected) { const res = R.store(state, selected); if (res.ok) { state = res.state; selected = null; sfx.drop(); metrics.count('放入背包'); render(); } else toast(res.message, {tone: 'bad'}); return; }
  if (act === 'place' && selected) { const res = R.unbag(state, selected, REGIONS[view].center); if (res.ok) { state = res.state; render(); } else toast(res.message, {tone: 'bad'}); return; }
  if (act === 'sell' && selected) {
    const item = findItem(selected);
    const useful = R.availableRepairs(state).some(r => r.chain === item.chain && r.level >= item.level) || state.orders.some(o => R.orderNeeds(o).some(([c, l]) => c === item.chain && l >= item.level));
    if (useful && item.level >= 3) { const ok = await sheet({cls: 'center', title: '确定卖掉？', body: `<p>${nameOf(item.chain, item.level)} 还能用在修复或请求上。</p>`, actions: [{label: `卖掉 +${R.sellPrice(item.level)}★`, kind: 'secondary', value: true}, {label: '留着', value: false}]}); if (!ok) return; }
    const p = world.spriteClient('item-' + selected) || centerOf($('#bag'));
    const res = R.sell(state, selected); state = res.state; selected = null; metrics.count('卖出');
    sfx.coin(); floatText(p[0], p[1], `+${res.events[0].coins}★`, {color: '#fff3a1'}); render();
  }
});
$('#energy').addEventListener('click', () => { if (!busy) offerEnergy(); });
$('#regions').addEventListener('click', e => { const r = e.target.closest('[data-region]')?.dataset.region; if (r && !busy && R.isOpen(state, r)) { sfx.tap(); focusRegion(r); } });
$('#hint').addEventListener('click', () => { metrics.count('提示'); showHint(true); });
$('#diary').addEventListener('click', () => { if (!busy) showDiary(); });
$('#settings').addEventListener('click', async () => {
  const rows = Object.entries(metrics.summary()).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('');
  const choice = await sheet({title: '设置', body: `<p>试玩记录（只保存在本机）</p><table class="metrics">${rows || '<tr><td>还没有记录</td><td></td></tr>'}</table>`,
    actions: [{label: muted ? '打开声音' : '关闭声音', kind: 'secondary', value: 'sound'}, {label: '重新开始', kind: 'secondary', value: 'reset'}]});
  if (choice === 'sound') { muted = !muted; setMuted(muted); save(); toast(muted ? '声音已关闭' : '声音已打开'); }
  if (choice === 'reset') { const sure = await sheet({cls: 'center', title: '重新开始？', body: '<p>进度会清空，试玩记录也会清空。</p>', actions: [{label: '重新开始', kind: 'secondary', value: true}, {label: '取消', value: false}]}); if (sure) { store.reset(); location.reload(); } }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && selected && !document.querySelector('.sheet-wrap')) { selected = null; render(); } });

// ---------- guidance ----------
let hand = null, handTimer;
function handEl() { if (!hand) { hand = document.createElement('div'); hand.className = 'hand'; hand.innerHTML = icon.hand; document.body.append(hand); } hand.getAnimations().forEach(a => a.cancel()); hand.hidden = false; clearTimeout(handTimer); handTimer = setTimeout(hideHand, 4200); return hand; }
function pointAt(p) { const h = handEl(); h.style.left = `${p[0]}px`; h.style.top = `${p[1]}px`; if (!reducedMotion()) h.animate([{transform: 'translate(0,0) scale(1)'}, {transform: 'translate(4px,8px) scale(.9)'}, {transform: 'translate(0,0) scale(1)'}], {duration: 900, iterations: 4}); }
function dragHint(a, b) { const h = handEl(); h.style.left = `${a[0]}px`; h.style.top = `${a[1]}px`; if (!reducedMotion()) h.animate([{transform: 'translate(0,0)', opacity: 1}, {transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px)`, opacity: 1, offset: .7}, {transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px)`, opacity: 0}], {duration: 1300, iterations: 3}); }
function hideHand() { if (hand) hand.hidden = true; }
async function pointInstall(item, r) {
  const region = R.SPOT_REGION[r.spot];
  if (item.cell && regionOfCell(item.cell) !== region) { toast(`${nameOf(item.chain, item.level)}在${REGIONS[regionOfCell(item.cell)].short}，先收进背包，再到${REGIONS[region].short}放出来`, {ms: 3000}); return; }
  if (region !== view) await focusRegion(region);
  const a = item.cell ? world.spriteClient('item-' + item.id) : centerOf($(`[data-bag="${item.id}"]`) || $('#bag')), b = world.cellToClient(SPOTS[r.spot]);
  if (a) dragHint(a, b);
}
async function showHint(explicit = false) {
  const s = R.suggestion(state);
  if (s.type === 'tap') {
    const g = R.GENERATORS[s.generator];
    if (g.region !== view) { if (!explicit) return; await focusRegion(g.region); }
    const el = genEl(s.generator); if (el) pointAt(centerOf(el));
    if (explicit) toast(state.energy ? `点「${g.name}」拿${CHAINS[g.chain].label}材料` : '体力不够了，先补充体力');
  }
  if (s.type === 'merge') {
    const a = findItem(s.a), b = findItem(s.b), region = regionOfCell(b.cell);
    if (region !== view) { if (!explicit) return; await focusRegion(region); }
    const pa = a.cell ? world.spriteClient('item-' + a.id) : centerOf($(`[data-bag="${a.id}"]`) || $('#bag')), pb = world.spriteClient('item-' + b.id);
    if (pa && pb) dragHint(pa, pb); if (explicit) toast('把两件相同的拖到一起');
  }
  if (s.type === 'install') { const r = R.repairById(s.repair); await pointInstall(findItem(s.item), r); if (explicit) toast(`拖到「${r.title}」`); }
  if (s.type === 'deliver') { const el = $(`[data-order="${s.order}"]`); if (el) pointAt(centerOf(el)); if (explicit) toast('点亮起来的请求就能交付'); }
  if (s.type === 'store' || s.type === 'sell') { const p = world.spriteClient('item-' + s.item); if (p) pointAt(p); if (explicit) toast('空地满了。点一件素材，收进背包或卖掉。'); }
  if (s.type === 'wait' && explicit) toast('先等体力恢复，或补充体力');
}
function maybeTutorial() {
  clearTimeout(maybeTutorial.timer);
  if (state.stats.repairs >= 3) return;
  maybeTutorial.timer = setTimeout(() => { if (!busy && !drag && !world.isGesturing() && !document.querySelector('.sheet-wrap')) showHint(false); }, state.stats.taps < 3 ? 1200 : 5000);
}

// ---------- boot ----------
window.__liteB = {get state() { return state; }, set state(v) { state = v; }, R, world, metrics, render, focusRegion, SPOTS, get busy() { return busy; }};
await world.ready;
world.reveal([0, 0], 1.25, {instant: true});
if (R.isOpen(state, 'creek')) { world.reveal([5, -1], 1.2, {instant: true}); world.reveal([10, -2], 1.2, {instant: true}); }
if (R.done(state, 'stream')) { world.reveal([4, -2], 3, {instant: true}); world.reveal([1, -1], 1.6, {instant: true}); }
for (const k of state.healed) world.reveal(parseKey(k), 0.9, {instant: true});
for (const k of state.blooms) world.reveal(parseKey(k), 0.45, {instant: true});
for (const id of state.done) { const r = R.repairById(id); world.reveal(SPOTS[r.spot], r.reveal, {instant: true}); }
render();
await focusRegion(view, false);
metrics.enter('play');
if (!state.stats.taps) {
  await wait(400);
  await converse(INTRO, {at: who => world.cellToClient(who === 'lina' ? SPOTS.shelter : [0, 0]), portrait: PORTRAIT, names: NAMES, root: app, gap: 2000});
  speak(world.cellToClient(SPOTS.logs), PORTRAIT.mira, '先从倒木堆里劈些木料。两块一样的，拼起来就是更好的一块。', {root: app, name: NAMES.mira});
}
maybeTutorial();
