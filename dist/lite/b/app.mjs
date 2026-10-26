// Prototype B · 纯合成版: tap generators, merge on the hex map, clear storm
// debris by merging beside it, fill residents' orders, install components to
// repair the camp and river. Rules live in rules.mjs; this file is view only.
import * as R from './rules.mjs';
import {createWorld, plateOf, PLATE} from '../shared/world.mjs';
import {key, parseKey} from '../shared/hex.mjs';
import {CHAINS, nameOf, matName} from '../shared/art.mjs';
import {sfx, unlock, setMuted, isMuted} from '../shared/audio.mjs';
import {burst, ring, floatText, fly, squash, shake, haptic, centerOf, reducedMotion} from '../shared/fx.mjs';
import {createStore, createMetrics} from '../shared/store.mjs';
import {$, esc, wait, sprite, toast, sheet, speak} from '../shared/ui.mjs';
import {icon} from '../shared/icons.mjs';

const PORTRAIT = {mira: sprite('portrait-mira'), lina: sprite('portrait-lina'), rowan: sprite('portrait-rowan')};
const NAMES = {mira: '米拉', lina: '莉娜', rowan: '罗恩'};
const store = createStore('forest-camp.lite-b', R.VERSION);
let saved = store.load(() => null);
let state = saved?.state && R.validate(saved.state) ? saved.state : R.freshState();
const metrics = createMetrics(saved?.metrics);
let muted = !!saved?.muted; setMuted(muted);
let view = saved?.view === 'river' && R.isOpen(state, 'river') ? 'river' : 'camp';
let selected = null, busy = false, drag = null, lastHint = 0;

const app = $('#app');
app.innerHTML = `
  <div id="world"></div>
  <header class="hud">
    <div class="pill energy" id="energy"><span class="pill-icon">${icon.energy}</span><span id="energy-n"></span><small id="energy-t"></small><button class="plus" id="energy-plus" aria-label="补充体力">+</button></div>
    <div class="pill" id="coins"><span class="pill-icon">${icon.star}</span><span id="coins-n"></span></div>
    <div class="spacer"></div>
    <div class="region-switch" id="regions"><button data-region="camp">营地</button><button data-region="river">河湾</button></div>
    <button class="icon-btn" id="settings" aria-label="设置">${icon.gear}</button>
  </header>
  <section class="orders" id="orders" aria-label="居民的请求"></section>
  <footer class="bottom">
    <div class="panel" id="panel" aria-live="polite"></div>
    <div class="bottom-row"><div class="bag" id="bag" aria-label="背包"></div><div class="spacer"></div><button class="icon-btn hint-btn" id="hint" aria-label="提示">${icon.hint}</button></div>
  </footer>`;

const world = createWorld($('#world'), {
  onPress: () => unlock(),
  onTap: handleTap,
  onDragStart: startDrag,
  onDragMove: moveDrag,
  onDragEnd: endDrag
});

// ---------- persistence ----------
function save() { store.save({state, metrics: metrics.data, muted, view}); }
setInterval(() => { R.tick(state); renderHud(); }, 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden) { metrics.flush(); save(); } });

// ---------- world rendering ----------
const isRiverCell = cell => R.regionOf(cell) === 'river';
function regionCells(region) {
  const land = R.landCells(state).filter(c => R.regionOf(c) === region), storm = R.stormCells(state).filter(t => t.region === region).map(t => t.cell);
  const sites = Object.entries(R.SITES).filter(([id, c]) => R.regionOf(c) === region && (region === 'camp' || R.isOpen(state, 'river'))).map(([, c]) => c);
  return [...land, ...storm, ...sites];
}
// Frame the playable land plus the debris ring around it, so the camera
// widens as the clearing grows.
function playableCells(region) {
  const land = R.landCells(state).filter(c => R.regionOf(c) === region), landKeys = new Set(land.map(c => key(...c)));
  const edge = R.stormCells(state).filter(t => t.region === region && neighborsOf(t.cell).some(n => landKeys.has(key(...n)))).map(t => t.cell);
  const sites = Object.values(R.SITES).filter(c => R.regionOf(c) === region);
  return [...land, ...edge, ...sites];
}
const neighborsOf = ([q, r]) => [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map(([a, b]) => [q + a, r + b]);
function focusRegion(region, animate = true) {
  view = region;
  const cells = region === 'river' && !R.isOpen(state, 'river') ? R.REGION_CELLS.river : playableCells(region);
  const top = $('.orders').getBoundingClientRect().bottom - app.getBoundingClientRect().top + 4;
  const bottom = app.getBoundingClientRect().bottom - $('.bottom').getBoundingClientRect().top + 4;
  for (const b of $('#regions').children) b.classList.toggle('on', b.dataset.region === region);
  return world.fit(cells, {top, bottom, pad: .1, animate, maxScale: 1.15, overscroll: true});
}

function renderTurf() {
  const healedSet = new Set(state.healed), entries = [];
  for (const c of R.landCells(state)) entries.push({cell: c, cls: 'free'});
  for (const t of R.stormCells(state)) {
    const frontier = [...state.items].some(i => i.cell && Math.abs(i.cell[0] - t.cell[0]) + Math.abs(i.cell[1] - t.cell[1]) + Math.abs(i.cell[0] + i.cell[1] - t.cell[0] - t.cell[1]) === 2);
    entries.push({cell: t.cell, cls: 'storm' + (frontier ? ' frontier' : '')});
  }
  world.setCells(entries);
  // Debris decals sit on uncleared storm tiles.
  for (const [k, t] of R.STORM) {
    const show = !healedSet.has(k) && R.isOpen(state, t.region);
    world.decal('storm-' + k, show ? (t.level >= 3 ? 'ground-roots' : 'ground-chips') : null, t.cell, {cls: 'debris'});
    const edge = show && neighborsOf(t.cell).some(n => R.isLand(state, n));
    world.badge('storm-' + k, t.cell, edge ? `L${t.level}` : null);
  }
  world.fog('river', R.isOpen(state, 'river') ? null : R.REGION_CELLS.river.filter(([q]) => q >= 6));
}

function renderSites() {
  const repairs = R.availableRepairs(state), carrying = drag && [...state.items, ...state.bag].find(i => i.id === drag.id);
  for (const r of R.REPAIRS) {
    const site = R.SITES[r.site], isDone = R.done(state, r.id), shelterUpgrade = r.site === 'shelter';
    if (shelterUpgrade && r.id === 'home' && !isDone) continue;
    if (r.id === 'roof' && R.done(state, 'home')) { world.removeSprite('site-roof'); continue; }
    const fogged = R.regionOf(site) === 'river' && !R.isOpen(state, 'river');
    const art = isDone ? r.art : r.ruin, extent = PLATE.cell * (isDone ? (r.id === 'home' ? 3.3 : r.id === 'path' ? 2.3 : 2.6) : 2.3);
    if (!art) continue;
    const canDrop = carrying && !isDone && repairs.includes(r) && carrying.chain === r.chain && carrying.level === r.level;
    world.upsertSprite('site-' + r.id, {name: art, cell: site, extent, cls: `site ${isDone ? 'fixed' : 'ruin'} ${canDrop ? 'can-drop' : ''} ${fogged ? 'dim' : ''}`, lift: .25});
  }
  if (!R.done(state, 'home') && R.done(state, 'roof')) world.removeSprite('site-home');
  // Generators. Some share a site with a repair (spring/reeds/dock).
  for (const [id, g] of Object.entries(R.GENERATORS)) {
    if (id !== 'logs') continue;
    world.upsertSprite('gen-' + id, {name: g.art, cell: R.SITES[id], extent: PLATE.cell * 2.1, cls: 'gen', lift: .2});
  }
}

function renderItems(events = []) {
  const live = new Set(state.items.map(i => 'item-' + i.id));
  for (const id of world.spriteIds()) if (id.startsWith('item-') && !live.has(id)) world.removeSprite(id);
  const repairs = R.availableRepairs(state), needs = new Set(state.orders.flatMap(o => R.orderNeeds(o).map(([c, l]) => c + l)));
  for (const i of state.items) {
    if (drag?.id === i.id) continue;
    const goal = repairs.some(r => r.chain === i.chain && r.level === i.level) || needs.has(i.chain + i.level);
    const match = selected && selected !== i.id && sameKind(selected, i.id);
    world.upsertSprite('item-' + i.id, {name: matName(i.chain, i.level), cell: i.cell, extent: PLATE.cell * (1.35 + i.level * .09), cls: `item ${selected === i.id ? 'selected' : ''} ${match ? 'match-target' : ''} ${goal ? 'goal' : ''}`});
  }
}
const findItem = id => state.items.find(i => i.id === id) || state.bag.find(i => i.id === id);
const sameKind = (a, b) => { const x = findItem(a), y = findItem(b); return x && y && x.chain === y.chain && x.level === y.level && x.level < 7; };

function renderPins() {
  const repairs = R.availableRepairs(state), all = [...state.items, ...state.bag];
  for (const r of R.REPAIRS) {
    const id = 'pin-' + r.id, site = R.SITES[r.site];
    if (!repairs.includes(r) || R.regionOf(site) === 'river' && !R.isOpen(state, 'river')) { world.removePin(id); continue; }
    const ready = all.some(i => i.chain === r.chain && i.level === r.level);
    const [x, y] = plateOf(site);
    world.upsertPin(id, {anchor: [x, y - PLATE.cell * 1.9], cls: 'clickable site ' + (ready ? 'ready' : ''), label: r.title,
      html: `<img src="${sprite(matName(r.chain, r.level))}" alt=""><span class="lvl">L${r.level}</span>${ready ? icon.check.replace('<svg', '<svg width="18" height="18"') : ''}`,
      onClick: () => showRepair(r)});
  }
  for (const id of ['spring', 'reeds', 'dock']) {
    const pid = 'gen-' + id, g = R.GENERATORS[id];
    if (!R.generatorOpen(state, id)) { world.removePin(pid); continue; }
    const [x, y] = plateOf(R.SITES[id]);
    world.upsertPin(pid, {anchor: [x, y + PLATE.cell * .62], cls: 'gen-pin', label: `${g.name}，点一下产出${CHAINS[g.chain].label}材料`, html: `${icon.energy.replace('<svg', '<svg width="14" height="14"')}${CHAINS[g.chain].label}`, onClick: () => tapGen(id)});
  }
  world.removePin('river-lock');
  if (!R.isOpen(state, 'river')) {
    const [x, y] = plateOf([8, -4]);
    world.upsertPin('river-lock', {anchor: [x, y], cls: 'clickable locked', html: `${icon.lock.replace('<svg', '<svg width="20" height="20"')} 修好旧路后开放`, onClick: () => toast('先在营地把旧路修好（需要 施工支架 L5）')});
  }
}

function renderHud() {
  R.tick(state);
  $('#energy-n').textContent = `${state.energy}/${state.maxEnergy}`;
  const next = R.nextEnergyIn(state);
  $('#energy-t').textContent = next ? `${Math.ceil(next / 1000)}s` : '';
  $('#energy').classList.toggle('low', state.energy < 5);
  $('#coins-n').textContent = state.coins;
  $('#regions [data-region="river"]').disabled = !R.isOpen(state, 'river');
}

function renderOrders() {
  const all = [...state.items, ...state.bag];
  $('#orders').innerHTML = state.orders.map(o => {
    const t = R.ORDERS.find(x => x.id === o.id), picks = R.pickForOrder(state, o);
    const used = new Set();
    const needs = t.needs.map(([chain, level]) => {
      const have = all.find(i => !used.has(i.id) && i.chain === chain && i.level === level); if (have) used.add(have.id);
      return `<span class="need"><img src="${sprite(matName(chain, level))}" alt="${nameOf(chain, level)}"><b>L${level}</b>${have ? `<span class="tick">${icon.check}</span>` : ''}</span>`;
    }).join('');
    return `<button class="order ${picks ? 'ready' : ''}" data-order="${o.id}" aria-label="${NAMES[t.who]}：${esc(t.text)}"><span class="who"><img src="${PORTRAIT[t.who]}" alt=""></span><span class="needs">${needs}</span><span class="reward"><span>${icon.star}${t.coins}</span><span>${icon.energy}${t.energy}</span></span><span class="go">交付</span></button>`;
  }).join('');
}

function renderBag() {
  const slots = Array.from({length: R.BAG_SIZE}, (_, n) => state.bag[n]);
  $('#bag').innerHTML = `<span class="bag-label">${icon.bag}</span>` + slots.map((i, n) => i
    ? `<button class="slot filled" data-bag="${i.id}" aria-label="背包：${nameOf(i.chain, i.level)} L${i.level}"><img src="${sprite(matName(i.chain, i.level))}" alt=""></button>`
    : `<span class="slot" data-slot="${n}"></span>`).join('');
}

function renderPanel() {
  const item = selected && findItem(selected), panel = $('#panel');
  if (item) {
    const c = CHAINS[item.chain], max = state.discovered[item.chain];
    const ladder = c.names.map((n, j) => `<span class="${j + 1 === item.level ? 'current' : ''} ${j + 1 > max ? 'unknown' : ''}"><img src="${sprite(matName(item.chain, j + 1))}" alt=""></span>`).join('');
    panel.innerHTML = `<span class="art"><img src="${sprite(matName(item.chain, item.level))}" alt=""></span><div class="copy"><strong>${nameOf(item.chain, item.level)} · L${item.level}</strong><div class="ladder">${ladder}</div></div>
      <div class="acts">${item.cell ? `<button class="btn secondary" data-act="store">收起</button>` : `<button class="btn secondary" data-act="place">放回</button>`}<button class="btn secondary" data-act="sell">卖 ${icon.star.replace('<svg', '<svg width="14" height="14"')}${R.sellPrice(item.level)}</button></div>`;
    return;
  }
  const r = R.availableRepairs(state)[0];
  if (!r) { panel.innerHTML = `<span class="art"><img src="${sprite('scene-home')}" alt=""></span><div class="copy"><strong>这一片故乡修好了</strong><small>山坡的信号灯……留给下一段旅程。</small></div>`; return; }
  const all = R.availableRepairs(state);
  panel.innerHTML = `<span class="art"><img src="${sprite(matName(r.chain, r.level))}" alt=""></span><div class="copy"><strong>${r.title}</strong><small>需要 ${nameOf(r.chain, r.level)} L${r.level}${all.length > 1 ? ` · 还有 ${all.length - 1} 处可修` : ''}</small></div>`;
}

function render(events = []) { renderTurf(); renderSites(); renderItems(events); renderPins(); renderHud(); renderOrders(); renderBag(); renderPanel(); save(); }

// ---------- interactions ----------
function handleTap(cell, spriteId, point) {
  if (busy) return;
  if (spriteId?.startsWith('gen-')) { tapGen(spriteId.slice(4)); return; }
  const site = R.siteAt(cell);
  if (site && R.GENERATORS[site] && R.generatorOpen(state, site)) { tapGen(site); return; }
  const item = spriteId?.startsWith('item-') ? findItem(spriteId.slice(5)) : R.itemAt(state, cell);
  if (item) {
    if (selected && selected !== item.id && sameKind(selected, item.id)) { doMerge(selected, item.id); return; }
    selected = selected === item.id ? null : item.id; sfx.tap(); render(); return;
  }
  if (spriteId?.startsWith('site-')) {
    const r = R.repairById(spriteId.slice(5)); if (!r) return;
    const it = selected && findItem(selected);
    if (it && it.chain === r.chain && it.level === r.level && R.repairAvailable(state, r)) { doInstall(it.id, r.id); return; }
    // River ruins double as generators: tapping them produces material.
    const gen = Object.keys(R.GENERATORS).find(g => key(...R.SITES[g]) === key(...R.SITES[r.site]));
    if (gen && R.generatorOpen(state, gen)) { tapGen(gen); return; }
    showRepair(r); return;
  }
  if (selected && R.isFree(state, cell)) { const res = R.move(state, selected, cell); if (res.ok) { state = res.state; sfx.drop(); render(); } return; }
  const storm = R.STORM.get(key(...cell));
  if (storm && !state.healed.includes(key(...cell))) { toast(`在旁边合出 L${storm.level} 或更高的素材，就能清走这里的残骸`); return; }
  if (selected) { selected = null; render(); }
}

async function tapGen(id) {
  if (busy) return;
  const res = R.tapGenerator(state, id);
  if (!res.ok) {
    if (res.needEnergy) { metrics.count('体力耗尽弹窗'); offerEnergy(); return; }
    if (res.noSpace) { metrics.count('空间不足'); state.stats.blocked++; sfx.error(); toast(res.message, {tone: 'bad'}); shake(world.spriteEl('gen-' + id) || world.pinEl('gen-' + id)); haptic(30); return; }
    toast(res.message); return;
  }
  state = res.state; metrics.count('点击生成器');
  const ev = res.events.find(e => e.type === 'spawn'), item = ev.item;
  renderItems(); renderTurf();
  const el = world.spriteEl('item-' + item.id), genEl = world.spriteEl('gen-' + id), from = genEl ? centerOf(genEl) : world.cellToClient(R.SITES[id]);
  if (genEl) squash(genEl, {from: .8, peak: 1.12, duration: 260});
  if (el && !reducedMotion()) { el.style.opacity = '0'; await fly(sprite(matName(item.chain, item.level)), from, world.spriteClient('item-' + item.id), {size: 46, duration: 300, arc: -60}); el.style.opacity = ''; squash(el, {from: .6, peak: 1.15, duration: 300}); }
  sfx.spawn(item.level); haptic(8);
  afterEvents(res.events);
  render();
}

function startDrag(cell, spriteId) {
  if (busy) return false;
  const id = spriteId?.startsWith('item-') ? spriteId.slice(5) : R.itemAt(state, cell)?.id;
  if (!id) return false;
  drag = {id, origin: findItem(id).cell, target: null};
  selected = id; sfx.lift(); haptic(6);
  world.spriteEl('item-' + id)?.classList.add('lifted');
  renderSites(); renderPanel();
  for (const i of state.items) if (i.id !== id) world.spriteEl('item-' + i.id)?.classList.toggle('match-target', sameKind(id, i.id));
  return true;
}
function moveDrag(cell, foot, client) {
  if (!drag) return;
  world.moveSprite('item-' + drag.id, foot, {z: 9000});
  if (drag.cellKey === key(...cell)) return;
  drag.cellKey = key(...cell); world.clearMarks('drop-ok');
  const other = R.itemAt(state, cell), site = R.siteAt(cell), repair = site && R.availableRepairs(state).find(r => r.site === site);
  const item = findItem(drag.id);
  drag.target = null;
  if (other && other.id !== drag.id && sameKind(drag.id, other.id)) drag.target = {type: 'merge', id: other.id};
  else if (repair && item.chain === repair.chain && item.level === repair.level) drag.target = {type: 'install', repair: repair.id};
  else if (R.isLand(state, cell)) { drag.target = {type: 'move', cell}; world.markCell(cell, 'drop-ok'); }
  // Bag hover
  const slot = document.elementFromPoint(client[0], client[1])?.closest('#bag');
  $('#bag').classList.toggle('drop', !!slot);
  if (slot) drag.target = {type: 'store'};
}
async function endDrag(cell, foot, client) {
  const d = drag; drag = null; world.clearMarks('drop-ok'); $('#bag').classList.remove('drop');
  if (!d) return;
  world.spriteEl('item-' + d.id)?.classList.remove('lifted');
  const overBag = client && document.elementFromPoint(client[0], client[1])?.closest('#bag');
  if (overBag) { const res = R.store(state, d.id); if (res.ok) { state = res.state; selected = null; sfx.drop(); metrics.count('放入背包'); } else toast(res.message, {tone: 'bad'}); render(); return; }
  if (!d.target || !cell) { render(); return; }
  if (d.target.type === 'merge') { await doMerge(d.id, d.target.id, true); return; }
  if (d.target.type === 'install') { await doInstall(d.id, d.target.repair); return; }
  if (d.target.type === 'move') { const res = R.move(state, d.id, d.target.cell); if (res.ok) { state = res.state; sfx.drop(); } render(); return; }
  render();
}

async function doMerge(aId, bId, dragged = false) {
  const a = findItem(aId), b = findItem(bId), res = R.merge(state, aId, bId);
  if (!res.ok) { toast(res.message, {tone: 'bad'}); sfx.error(); render(); return; }
  busy = true;
  const target = world.spriteClient('item-' + bId);
  if (!dragged && a?.cell && !reducedMotion()) { const from = world.spriteClient('item-' + aId); world.spriteEl('item-' + aId).style.opacity = '0'; await fly(sprite(matName(a.chain, a.level)), from, target, {size: 52, duration: 220, arc: -30}); }
  state = res.state; selected = null; metrics.count('合成');
  const ev = res.events.find(e => e.type === 'merge'), item = ev.item;
  render(res.events);
  const el = world.spriteEl('item-' + item.id), at = world.spriteClient('item-' + item.id) || target;
  squash(el, {from: .45, peak: 1.25, duration: 420});
  const c = CHAINS[item.chain].color;
  burst(at[0], at[1], {count: 10 + item.level * 2, colors: [c, '#fff6c8', '#ffffff'], spread: 46 + item.level * 8, shape: item.chain === 'reed' ? 'leaf' : item.chain === 'water' ? 'dot' : 'chip'});
  ring(at[0], at[1], {size: 70 + item.level * 12});
  sfx.merge(item.level); haptic(10 + item.level * 2);
  busy = false;
  await afterEvents(res.events);
}

async function afterEvents(events) {
  for (const e of events) {
    if (e.type === 'heal') {
      const p = world.cellToClient(e.cell);
      world.reveal(e.cell, 0.9, {duration: 700});
      burst(p[0], p[1], {count: 14, colors: ['#a7e86a', '#fff3b0', '#6fbf4a'], spread: 50, shape: 'leaf'});
      floatText(p[0], p[1] - 10, '清出空地', {size: 15, color: '#f6ffde'});
      sfx.sparkle(); metrics.count('清理残骸');
      if (e.bonus?.energy) { floatText(p[0], p[1] + 16, `+${e.bonus.energy} 体力`, {size: 14, color: '#ffe36b'}); sfx.energy(); }
      if (e.bonus?.item) { floatText(p[0], p[1] + 16, '残骸里有东西！', {size: 14, color: '#ffe36b'}); }
    }
    if (e.type === 'bloom') world.reveal(e.cell, 0.45, {duration: 500});
    if (e.type === 'discover') await showDiscovery(e);
    if (e.type === 'empty') { await wait(200); offerEnergy(); }
  }
  render();
  maybeTutorial();
}

let discoverTimer;
async function showDiscovery(e) {
  if (e.level <= 1) return;
  metrics.count('新发现');
  let el = $('.discover');
  if (!el) { el = document.createElement('div'); el.className = 'discover'; app.append(el); }
  el.innerHTML = `<img src="${sprite(matName(e.chain, e.level))}" alt=""><div><small>新发现 · ${CHAINS[e.chain].label} L${e.level}</small><strong>${nameOf(e.chain, e.level)}</strong></div>`;
  el.classList.add('show'); sfx.chime(); clearTimeout(discoverTimer);
  discoverTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

async function doInstall(itemId, repairId) {
  const r = R.repairById(repairId), item = findItem(itemId), res = R.install(state, itemId, repairId);
  if (!res.ok) { toast(res.message, {tone: 'bad'}); sfx.error(); render(); return; }
  busy = true; metrics.count('修复'); metrics.event('repair', {id: repairId});
  const site = R.SITES[r.site], from = item.cell ? world.spriteClient('item-' + itemId) : centerOf($('#bag'));
  world.removeSprite('item-' + itemId); world.removePin('pin-' + r.id);
  await world.fit([site, ...regionCells(R.regionOf(site)).slice(0, 1)], {top: 120, bottom: 160, pad: 1.4, animate: true, maxScale: 1.2, duration: 500});
  const to = world.cellToClient(site);
  await fly(sprite(matName(item.chain, item.level)), from, [to[0], to[1] - 20], {size: 64, duration: 520, arc: -120, spin: 20});
  sfx.build();
  // Ruin shakes, sparks fly, colour spreads, the finished scene drops in.
  const ruin = world.spriteEl('site-' + r.id) || world.spriteEl('site-roof');
  shake(ruin, 6, 300);
  for (let n = 0; n < 3; n++) { burst(to[0] + (n - 1) * 18, to[1] - 18, {count: 8, colors: ['#ffe9a6', '#ffffff', '#d7a35a'], spread: 40, shape: 'chip'}); await wait(110); }
  state = res.state; selected = null;
  const revealDone = world.reveal(site, r.reveal, {duration: 1400});
  render(res.events);
  const fixed = world.spriteEl('site-' + r.id);
  if (fixed && !reducedMotion()) fixed.animate([{transform: 'translateY(-30px) scale(.7)', opacity: 0}, {transform: 'translateY(4px) scale(1.06)', opacity: 1, offset: .6}, {transform: 'none', opacity: 1}], {duration: 620, easing: 'cubic-bezier(.2,.9,.3,1.2)'});
  burst(to[0], to[1] - 30, {count: 26, colors: ['#ffd25e', '#fff3b0', '#ffffff', '#8fdc4e'], spread: 120, shape: 'star', duration: 900});
  ring(to[0], to[1], {size: 220, width: 5, duration: 700});
  floatText(to[0], to[1] - 70, r.rewardText, {cls: 'big', rise: 60, duration: 1600});
  await revealDone;
  for (const e of res.events) {
    if (e.type === 'open') { world.clearFog('river'); world.reveal([8, -4], 1.1, {duration: 1600}); toast('去河湾的路通了！', {tone: 'good', ms: 2600}); }
  }
  busy = false;
  // Characters talk on the map; no modal.
  for (const [who, text] of r.lines) { await new Promise(res2 => { const close = speak(world.cellToClient(site), PORTRAIT[who], text, {ms: 3200, root: app}); setTimeout(res2, 2200); }); }
  if (res.events.some(e => e.type === 'finale')) await finale();
  await focusRegion(repairId === 'path' ? 'river' : R.regionOf(site));
  render();
  if (R.availableRepairs(state).length === 0) await ending();
}

async function finale() {
  sfx.chime();
  const letter = document.createElement('div'); letter.className = 'letter';
  letter.innerHTML = `<div class="card"><h3>给米拉</h3>风暴那晚，山坡的信号灯熄了。<br>我在灯塔里留了一样东西——<br>等你把家修好，就上来找我。<div class="sign">——妈妈</div><button class="btn" style="width:100%;margin-top:16px">把信收好</button></div>`;
  app.append(letter); requestAnimationFrame(() => letter.classList.add('show'));
  metrics.event('letter');
  await new Promise(r => letter.querySelector('button').addEventListener('click', r, {once: true}));
  letter.remove();
}

async function ending() {
  metrics.event('complete'); metrics.flush();
  const s = state.stats;
  await sheet({cls: 'center', title: '这一片故乡修好了', body: `<div class="end-stats"><div><b>${s.merges}</b><small>次合成</small></div><div><b>${s.repairs}</b><small>处修复</small></div><div><b>${s.orders}</b><small>个请求</small></div><div><b>${s.heals}</b><small>块残骸清理</small></div></div><p>山坡上的信号灯还没亮。下一段旅程，从那里开始。</p>`, actions: [{label: '继续在这里合成', value: 'stay'}]});
}

function showRepair(r) {
  const site = R.SITES[r.site], p = world.cellToClient(site);
  speak(p, PORTRAIT[r.lines[0][0]], `${r.title}：需要 ${nameOf(r.chain, r.level)}（L${r.level}）。把它拖到这里。`, {ms: 3000, root: app});
}

async function offerEnergy() {
  sfx.error();
  const freeIn = R.freeRefillIn(state), canFree = freeIn === 0;
  const choice = await sheet({title: '体力用完了', body: `<p>每 ${R.ENERGY.regenMs / 1000} 秒恢复 1 点体力（正式版会更慢）。也可以先合成、交付请求换体力。</p>`,
    actions: [{label: canFree ? `免费领 ${R.ENERGY.freeRefill} 体力（模拟看广告）` : `免费补给 ${Math.ceil(freeIn / 1000)} 秒后可用`, kind: canFree ? 'gold' : 'secondary', value: canFree ? 'free' : null},
      {label: `用 ${R.ENERGY.refillCost} 金币换 ${R.ENERGY.refillAmount} 体力`, kind: 'secondary', value: 'buy'}, {label: '等一会儿', kind: 'ghost', value: 'wait'}]});
  if (choice === 'free' || choice === 'buy') {
    const res = R.buyEnergy(state, {free: choice === 'free'});
    if (!res.ok) { toast(res.message, {tone: 'bad'}); return; }
    state = res.state; metrics.count(choice === 'free' ? '免费体力' : '金币买体力'); sfx.energy();
    const p = centerOf($('#energy')); floatText(p[0] + 30, p[1] + 20, `+${res.events[0].amount}`, {color: '#ffe36b'}); render();
  } else metrics.count('选择等待');
}

// Bag, orders and panel buttons.
app.addEventListener('click', async e => {
  if (busy) return;
  const order = e.target.closest('[data-order]');
  if (order) {
    const t = R.ORDERS.find(o => o.id === order.dataset.order), res = R.deliver(state, order.dataset.order);
    if (!res.ok) { speak(centerOf(order), PORTRAIT[t.who], t.text, {ms: 2600, root: app}); return; }
    const ev = res.events[0], dest = centerOf(order);
    busy = true;
    await Promise.all(ev.consumed.map((it, n) => { const from = it.cell ? world.spriteClient('item-' + it.id) : centerOf($('#bag')); world.removeSprite('item-' + it.id); return fly(sprite(matName(it.chain, it.level)), from || dest, dest, {size: 48, duration: 420, delay: n * 80, arc: -90}); }));
    state = res.state; metrics.count('完成请求');
    sfx.coin(); sfx.coin(.12);
    floatText(dest[0], dest[1] + 30, `+${ev.coins}★  +${ev.energy}⚡`, {size: 17, color: '#fff3a1'});
    burst(dest[0], dest[1], {count: 16, colors: ['#ffd25e', '#fff'], spread: 60, shape: 'star'});
    busy = false;
    speak(dest, PORTRAIT[t.who], ['谢谢！', '太好了！', '就是这个！'][state.stats.orders % 3], {ms: 1400, root: app});
    render(); maybeTutorial(); return;
  }
  const bagItem = e.target.closest('[data-bag]');
  if (bagItem) {
    const id = bagItem.dataset.bag;
    if (selected && selected !== id && sameKind(selected, id)) { const other = findItem(selected); if (other.cell) { await doMerge(id, selected); return; } }
    const near = view === 'river' && R.isOpen(state, 'river') ? [8, -4] : [0, 0];
    const res = R.unbag(state, id, near); if (res.ok) { state = res.state; selected = id; sfx.drop(); render(); } else toast(res.message, {tone: 'bad'}); return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'store' && selected) { const res = R.store(state, selected); if (res.ok) { state = res.state; selected = null; sfx.drop(); metrics.count('放入背包'); render(); } else toast(res.message, {tone: 'bad'}); return; }
  if (act === 'place' && selected) { const res = R.unbag(state, selected, view === 'river' ? [8, -4] : [0, 0]); if (res.ok) { state = res.state; render(); } else toast(res.message, {tone: 'bad'}); return; }
  if (act === 'sell' && selected) {
    const item = findItem(selected);
    const useful = R.availableRepairs(state).some(r => r.chain === item.chain && r.level >= item.level) || state.orders.some(o => R.orderNeeds(o).some(([c, l]) => c === item.chain && l >= item.level));
    if (useful && item.level >= 3) { const ok = await sheet({title: '确定卖掉？', body: `<p>${nameOf(item.chain, item.level)} 还能用在修复或请求上。</p>`, actions: [{label: `卖掉 +${R.sellPrice(item.level)}★`, kind: 'secondary', value: true}, {label: '留着', value: false}]}); if (!ok) return; }
    const el = world.spriteEl('item-' + selected), p = el ? world.spriteClient('item-' + selected) : centerOf($('#bag'));
    const res = R.sell(state, selected); state = res.state; selected = null; metrics.count('卖出');
    sfx.coin(); floatText(p[0], p[1], `+${res.events[0].coins}★`, {color: '#fff3a1'}); render(); return;
  }
});
$('#energy-plus').addEventListener('click', () => offerEnergy());
$('#regions').addEventListener('click', e => { const r = e.target.closest('[data-region]')?.dataset.region; if (r && R.isOpen(state, r)) { focusRegion(r); save(); } });
$('#hint').addEventListener('click', () => { metrics.count('提示'); showHint(true); });
$('#settings').addEventListener('click', async () => {
  const rows = Object.entries(metrics.summary()).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('');
  const choice = await sheet({title: '设置', body: `<p style="margin:0 0 8px">试玩记录（只保存在本机）</p><table class="metrics">${rows || '<tr><td>还没有记录</td><td></td></tr>'}</table>`,
    actions: [{label: muted ? '打开声音' : '关闭声音', kind: 'secondary', value: 'sound'}, {label: '重新开始', kind: 'secondary', value: 'reset'}, {label: '关闭', value: null}]});
  if (choice === 'sound') { muted = !muted; setMuted(muted); save(); toast(muted ? '声音已关闭' : '声音已打开'); }
  if (choice === 'reset') { store.reset(); location.reload(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && selected) { selected = null; render(); } });

// ---------- guidance ----------
let hand = null;
function pointAt(point) {
  if (!hand) { hand = document.createElement('div'); hand.className = 'hand'; hand.innerHTML = icon.hand; document.body.append(hand); }
  hand.style.left = `${point[0]}px`; hand.style.top = `${point[1]}px`; hand.hidden = false;
  if (!reducedMotion()) hand.animate([{transform: 'translate(0,0) scale(1)'}, {transform: 'translate(4px,8px) scale(.9)'}, {transform: 'translate(0,0) scale(1)'}], {duration: 900, iterations: 3});
}
function dragHint(a, b) {
  if (!hand) pointAt(a);
  hand.hidden = false; hand.style.left = `${a[0]}px`; hand.style.top = `${a[1]}px`;
  if (!reducedMotion()) hand.animate([{transform: 'translate(0,0)', opacity: 1}, {transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px)`, opacity: 1, offset: .7}, {transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px)`, opacity: 0}], {duration: 1300, iterations: 3});
}
const hideHand = () => { if (hand) hand.hidden = true; };
function showHint(explicit = false) {
  hideHand();
  for (const id of world.spriteIds()) world.spriteEl(id)?.classList.remove('hint');
  const s = R.suggestion(state);
  if (s.type === 'tap') { const id = s.generator, el = world.spriteEl('gen-' + id) || world.pinEl('gen-' + id); if (el) { el.classList.add('hint'); pointAt(centerOf(el)); } if (explicit) toast(state.energy ? `点「${R.GENERATORS[id].name}」拿${CHAINS[R.GENERATORS[id].chain].label}材料` : '体力不够了，先补充体力'); }
  if (s.type === 'merge') { const a = world.spriteClient('item-' + s.a) || centerOf($('#bag')), b = world.spriteClient('item-' + s.b); if (b) dragHint(a, b); if (explicit) toast('把两件相同的拖到一起'); }
  if (s.type === 'install') { const r = R.repairById(s.repair), a = world.spriteClient('item-' + s.item) || centerOf($('#bag')), b = world.cellToClient(R.SITES[r.site]); dragHint(a, b); if (explicit) toast(`把它拖到「${r.title}」`); }
  if (s.type === 'deliver') { const el = $(`[data-order="${s.order}"]`); if (el) pointAt(centerOf(el)); if (explicit) toast('点亮起来的请求就能交付'); }
  setTimeout(hideHand, 3600);
}
function maybeTutorial() {
  // First minutes: point at the next action after a short idle.
  clearTimeout(maybeTutorial.timer);
  if (state.stats.repairs >= 2) return;
  maybeTutorial.timer = setTimeout(() => { if (!busy && !drag && !world.isGesturing()) showHint(false); }, state.stats.taps < 3 ? 900 : 4500);
}

// ---------- boot ----------
window.__liteB = {get state() { return state; }, R, world, metrics};
await world.ready;
// The camp centre keeps a little colour from the start — the lamp Lina keeps lit.
world.reveal([0, 0], 1.25, {instant: true});
if (R.isOpen(state, 'river')) world.reveal([8, -4], 1.1, {instant: true});
for (const k of state.healed) world.reveal(parseKey(k), 0.9, {instant: true});
for (const k of state.blooms) world.reveal(parseKey(k), 0.45, {instant: true});
for (const id of state.done) { const r = R.repairById(id); world.reveal(R.SITES[r.site], r.reveal, {instant: true}); }
render();
await focusRegion(view, false);
metrics.enter('play');
if (!state.stats.taps) {
  await wait(500);
  await new Promise(res => { speak(world.cellToClient(R.SITES.shelter), PORTRAIT.lina, '妈妈，屋顶漏雨了……我们能修好吗？', {ms: 2600, root: app}); setTimeout(res, 2200); });
  await new Promise(res => { speak(world.cellToClient(R.SITES.logs), PORTRAIT.mira, '能。先从倒木堆里劈些木料出来，两块一样的就能拼成更好的。', {ms: 3400, root: app}); setTimeout(res, 2600); });
}
maybeTutorial();
