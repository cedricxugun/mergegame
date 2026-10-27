// Prototype A · 三消 + 轻合成. Loop: pick boosters → play a match-3 level →
// a supply crate flies home → one tap opens it, low pairs auto-merge in a
// cascade → drag the finished component onto its site → the world changes.
import * as A from './rules.mjs';
import {createRun, mountMatch, pieceArt, PIECE_NAMES} from './match.mjs';
import {createWorld, plateOf, PLATE} from '../shared/world.mjs';
import {key, parseKey} from '../shared/hex.mjs';
import {CHAINS, nameOf, matName} from '../shared/art.mjs';
import {SPOTS, REGIONS, regionFrame} from '../shared/map.mjs';
import {CAST, INTRO, LETTER, DIARY, OUTRO} from '../shared/chapter.mjs';
import {renderScenery, creekLayer, renderLife} from '../shared/scenery.mjs';
import {sfx, unlock, setMuted} from '../shared/audio.mjs';
import {burst, ring, floatText, fly, squash, shake, haptic, centerOf, reducedMotion} from '../shared/fx.mjs';
import {createStore, createMetrics} from '../shared/store.mjs';
import {$, esc, wait, sprite, toast, sheet, speak, converse} from '../shared/ui.mjs';
import {icon} from '../shared/icons.mjs';

const PORTRAIT = {mira: sprite('portrait-mira'), lina: sprite('portrait-lina'), rowan: sprite('portrait-rowan')};
const NAMES = Object.fromEntries(Object.entries(CAST).map(([k, v]) => [k, v.name]));
const store = createStore('forest-camp.lite-a', A.VERSION);
const saved = store.load(() => null) || {};
let state = saved.state && A.validate(saved.state) ? saved.state : A.freshState();
const metrics = createMetrics(saved.metrics);
let muted = !!saved.muted; setMuted(muted);
let seenDiary = saved.seenDiary ?? 1;
let view = saved.view && REGIONS[saved.view] && A.regionOpen(state, saved.view) ? saved.view : 'camp';
let selected = null, busy = false, drag = null;

const app = $('#app');
app.innerHTML = `
  <div id="world"></div>
  <header class="hud">
    <div class="pill" id="stars"><span class="pill-icon">${icon.star}</span><span id="stars-n"></span></div>
    <div class="spacer"></div>
    <button class="icon-btn" id="diary" aria-label="外婆的手记">${icon.book}<b id="diary-dot" hidden></b></button>
    <button class="icon-btn" id="settings" aria-label="设置">${icon.gear}</button>
  </header>
  <nav class="regions" id="regions" aria-label="切换地区"></nav>
  <button class="goal" id="goal" aria-live="polite"></button>
  <footer class="dock"><button class="crate-btn" id="crate" hidden aria-label="打开物资箱"><img src="${sprite('chest')}" alt=""><b id="crate-n"></b></button><button class="btn play" id="play"></button></footer>
  <section id="match" class="match-screen screen" hidden aria-label="三消关卡"></section>`;

const world = createWorld($('#world'), {onPress: () => unlock(), onTap: handleTap, onDragStart: startDrag, onDragMove: moveDrag, onDragEnd: endDrag});
const creek = creekLayer($('#world'));
const match = mountMatch($('#match'), {
  onWin: game => finishLevel(game),
  onLose: () => { state.stats.losses++; state.stats.retries++; metrics.count('失败重试'); save(); startLevel(true); },
  onExit: () => { metrics.count('中途退出'); showMap(); },
  getSound: () => !muted, onToggleSound: () => { muted = !muted; setMuted(muted); save(); },
  regionLabel: () => REGIONS[A.homeRegion(state, nextRepair()?.chain || 'wood')].name
});
function save() { store.save({state, metrics: metrics.data, muted, view, seenDiary}); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { metrics.flush(); save(); } });

// ---------- camera ----------
const findItem = id => state.items.find(i => i.id === id);
const sameKind = (a, b) => { const x = findItem(a), y = findItem(b); return x && y && x.id !== y.id && x.chain === y.chain && x.level === y.level && x.level < 7; };
function insets() {
  const a = app.getBoundingClientRect();
  return {top: $('#goal').getBoundingClientRect().bottom - a.top + 6, bottom: a.bottom - $('.dock').getBoundingClientRect().top + 6};
}
function setView(region, animate = true) {
  if (!A.regionOpen(state, region)) return Promise.resolve();
  view = region; save(); renderRegions(); renderHud();
  return world.fit(regionFrame(region, A.BOARD[region]), {...insets(), pad: .1, animate, maxScale: 1.25, overscroll: true});
}

// ---------- rendering ----------
function renderTurf() {
  world.setCells(A.boardCells(state).map(c => ({cell: c, cls: 'free'})));
  world.fog('creek', A.done(state, 'path') ? null : [...A.BOARD.creek, ...A.BOARD.river]);
}
function renderSites() {
  const carrying = drag && findItem(drag.id), glow = new Set();
  if (carrying) for (const r of A.availableRepairs(state)) if (carrying.chain === r.chain && carrying.level >= r.level) glow.add(r.spot);
  renderScenery(world, state.done, {glow, dim: spot => !A.regionOpen(state, A.SPOT_REGION[spot])});
  creek.set(A.done(state, 'stream') ? 'flow' : 'dry');
  renderLife(world, state.done);
}
function renderItems() {
  const live = new Set(state.items.map(i => 'item-' + i.id));
  for (const id of world.spriteIds()) if (id.startsWith('item-') && !live.has(id)) world.removeSprite(id);
  const ready = new Set(A.readyRepairs(state).filter(x => x.item).map(x => x.item.id));
  for (const i of state.items) {
    if (drag?.id === i.id) continue;
    const match = selected && sameKind(selected, i.id);
    world.upsertSprite('item-' + i.id, {name: matName(i.chain, i.level), cell: i.cell, extent: PLATE.cell * (1.4 + i.level * .08),
      cls: `item ${selected === i.id ? 'selected' : ''} ${match ? 'match-target' : ''} ${ready.has(i.id) ? 'can-install' : ''} ${i.bonus ? 'bonus' : ''}`});
  }
}
function renderPins() {
  const repairs = A.availableRepairs(state);
  for (const r of A.REPAIRS) {
    const id = 'pin-' + r.id, [x, y] = plateOf(SPOTS[r.spot]);
    const first = repairs.find(o => o.spot === r.spot);
    if (first !== r || !A.regionOpen(state, A.SPOT_REGION[r.spot])) { world.removePin(id); continue; }
    const ready = state.items.some(i => i.chain === r.chain && i.level >= r.level), p = A.progressTo(state, r);
    world.upsertPin(id, {anchor: [x, y - PLATE.cell * 1.85], cls: 'clickable site ' + (ready ? 'ready' : ''), label: r.title,
      html: `<img src="${sprite(matName(r.chain, r.level))}" alt=""><span class="lvl">${ready ? '送去' : `${p.have}/${p.need}`}</span>${ready ? icon.check.replace('<svg', '<svg width="18" height="18"') : ''}`,
      onClick: () => ready ? installReady(r) : hintRepair(r)});
  }
  world.removePin('creek-lock');
  if (!A.done(state, 'path')) { const [x, y] = plateOf([7, -1]); world.upsertPin('creek-lock', {anchor: [x, y], cls: 'clickable locked', html: `${icon.lock.replace('<svg', '<svg width="18" height="18"')} 修好旧路后开放`, onClick: () => toast('先把营地东边的旧路修好（施工支架 L5）')}); }
}
function regionHasWork(region) {
  const here = state.items.filter(i => A.regionOfCell(i.cell) === region);
  if (A.readyRepairs(state).some(x => x.item && A.SPOT_REGION[x.repair.spot] === region)) return true;
  return here.some((a, n) => here.some((b, m) => m > n && a.chain === b.chain && a.level === b.level && a.level < 7));
}
function renderRegions() {
  $('#regions').hidden = !A.done(state, 'path');
  $('#regions').innerHTML = Object.entries(REGIONS).map(([id, r]) => `<button data-region="${id}" class="${id === view ? 'on' : ''} ${id !== view && regionHasWork(id) ? 'attention' : ''}">${r.short}</button>`).join('');
}
// The goal bar: what's ready, else the closest open repair in view.
function nextRepair() {
  const ready = A.readyRepairs(state), here = r => A.SPOT_REGION[r.spot] === view;
  return ready.find(x => x.item && here(x.repair))?.repair || ready.find(x => x.item)?.repair
    || ready.map(x => x.repair).sort((a, b) => Number(here(b)) - Number(here(a)) || (A.progressTo(state, b).have / A.progressTo(state, b).need) - (A.progressTo(state, a).have / A.progressTo(state, a).need))[0] || null;
}
function renderHud() {
  $('#stars-n').textContent = state.stars;
  $('#diary-dot').hidden = state.diary.length <= seenDiary;
  const r = nextRepair(), goal = $('#goal');
  if (!r) goal.innerHTML = `<span class="art"><img src="${sprite('v11-cookfire')}" alt=""></span><div class="copy"><strong>第一章完成了</strong><small>山坡上的信号灯，下一章见</small></div>`;
  else {
    const p = A.progressTo(state, r), ready = state.items.some(i => i.chain === r.chain && i.level >= r.level);
    goal.className = 'goal' + (ready ? ' ready' : '');
    goal.innerHTML = `<span class="art"><img src="${sprite(matName(r.chain, r.level))}" alt=""></span><div class="copy"><strong>${r.title}</strong><div class="bar"><i style="width:${Math.round(p.have / p.need * 100)}%"></i><b>${ready ? '点这里送去工地 →' : `${CHAINS[r.chain].label} L${r.level} · ${p.have}/${p.need}`}</b></div></div>`;
  }
  const crates = state.crates.length;
  $('#crate').hidden = !crates; $('#crate-n').textContent = crates;
  const def = A.levelFor(state.level);
  $('#play').innerHTML = crates ? `打开物资箱<small>材料会自动合到一起</small>` : `第 ${state.level} 关<small>${def.collect.length ? '收集' + def.collect.map(([c]) => PIECE_NAMES[c]).join('、') : '清理木箱'} · 带回材料</small>`;
  $('#play').className = 'btn play ' + (crates ? 'gold' : '');
}
function render() { renderTurf(); renderSites(); renderItems(); renderPins(); renderRegions(); renderHud(); save(); }

// ---------- map interactions ----------
function handleTap(cell, spriteId) {
  if (busy) return;
  const item = spriteId?.startsWith('item-') ? findItem(spriteId.slice(5)) : A.itemAt(state, cell);
  if (item) {
    if (selected && sameKind(selected, item.id)) { doMerge(selected, item.id); return; }
    selected = selected === item.id ? null : item.id; sfx.tap(); render(); return;
  }
  const spot = spriteId?.startsWith('site-') ? spriteId.slice(5) : null;
  if (spot) {
    const r = A.availableRepairs(state).find(x => x.spot === spot), it = selected && findItem(selected);
    if (r && it && it.chain === r.chain && it.level >= r.level) { doInstall(it.id, r.id); return; }
    if (r) hintRepair(r);
    return;
  }
  if (selected && A.isBoard(state, cell)) { const res = A.moveItem(state, selected, cell); if (res.ok) { state = res.state; sfx.drop(); selected = null; render(); } return; }
  if (selected) { selected = null; render(); }
}
function startDrag(cell, spriteId) {
  if (busy) return false;
  const id = spriteId?.startsWith('item-') ? spriteId.slice(5) : A.itemAt(state, cell)?.id;
  if (!id) return false;
  drag = {id}; selected = id; sfx.lift(); haptic(6);
  world.spriteEl('item-' + id)?.classList.add('lifted');
  renderSites();
  for (const i of state.items) world.spriteEl('item-' + i.id)?.classList.toggle('match-target', sameKind(id, i.id));
  return true;
}
function moveDrag(cell, foot) {
  if (!drag) return;
  world.moveSprite('item-' + drag.id, foot, {z: 9000});
  if (drag.k === key(...cell)) return;
  drag.k = key(...cell); world.clearMarks('drop-ok');
  const other = A.itemAt(state, cell), item = findItem(drag.id);
  const spot = Object.entries(SPOTS).find(([, c]) => key(...c) === key(...cell))?.[0];
  const repair = spot && A.availableRepairs(state).find(r => r.spot === spot && item.chain === r.chain && item.level >= r.level);
  drag.target = other && sameKind(drag.id, other.id) ? {type: 'merge', id: other.id} : repair ? {type: 'install', repair: repair.id} : A.isBoard(state, cell) ? {type: 'move', cell} : null;
  if (drag.target?.type === 'move') world.markCell(cell, 'drop-ok');
}
async function endDrag(cell) {
  const d = drag; drag = null; world.clearMarks('drop-ok');
  if (!d) return;
  world.spriteEl('item-' + d.id)?.classList.remove('lifted');
  if (d.target?.type === 'merge') return doMerge(d.id, d.target.id, true);
  if (d.target?.type === 'install') return doInstall(d.id, d.target.repair);
  if (d.target?.type === 'move' && cell) { const res = A.moveItem(state, d.id, d.target.cell); if (res.ok) { state = res.state; sfx.drop(); } }
  selected = null; render();
}

async function playMergeEvents(events, {manualFirst = false} = {}) {
  let depth = 0;
  for (const e of events) {
    if (e.type === 'discover') { await showDiscovery(e); continue; }
    if (e.type !== 'merge') continue;
    const from = world.cellToClient(e.from), to = world.cellToClient(e.at);
    if (!(manualFirst && depth === 0)) {
      world.spriteEl('item-' + e.gone)?.style.setProperty('opacity', '0');
      await fly(sprite(matName(e.chain, e.level - 1)), [from[0], from[1] - 18], [to[0], to[1] - 18], {size: 48, duration: Math.max(140, 230 - depth * 20), arc: -40});
    }
    world.removeSprite('item-' + e.gone);
    const el = world.upsertSprite('item-' + e.keep, {name: matName(e.chain, e.level), cell: e.at, extent: PLATE.cell * (1.4 + e.level * .08), cls: 'item'});
    squash(el, {from: .45, peak: 1.25, duration: 360});
    burst(to[0], to[1] - 18, {count: 8 + e.level * 2, colors: [CHAINS[e.chain].color, '#fff6c8', '#fff'], spread: 40 + e.level * 8, shape: e.chain === 'reed' ? 'leaf' : e.chain === 'water' ? 'dot' : 'chip'});
    ring(to[0], to[1] - 10, {size: 60 + e.level * 12});
    if (depth >= 2) floatText(to[0], to[1] - 50, `连合 ×${depth + 1}`, {size: 16 + Math.min(depth, 6) * 2, color: '#fff3a1'});
    sfx.merge(e.level, depth); haptic(8 + e.level * 2);
    depth++;
    await wait(Math.max(50, 150 - depth * 15));
  }
}
async function doMerge(aId, bId, dragged = false) {
  const res = A.merge(state, aId, bId);
  if (!res.ok) { toast(res.message, {tone: 'bad'}); sfx.error(); render(); return; }
  busy = true; selected = null; metrics.count('手动合成');
  state = res.state;
  await playMergeEvents(res.events, {manualFirst: dragged});
  busy = false; render();
  const ready = A.readyRepairs(state).find(x => x.item);
  if (ready) pointInstall(ready.item, ready.repair);
}

let discoverTimer;
async function showDiscovery(e) {
  if (e.level <= 1) return;
  let el = $('.discover');
  if (!el) { el = document.createElement('div'); el.className = 'discover'; app.append(el); }
  el.innerHTML = `<img src="${sprite(matName(e.chain, e.level))}" alt=""><div><small>新发现 · ${CHAINS[e.chain].label} L${e.level}</small><strong>${nameOf(e.chain, e.level)}</strong></div>`;
  el.classList.add('show'); sfx.chime(); clearTimeout(discoverTimer);
  discoverTimer = setTimeout(() => el.classList.remove('show'), 1500);
}

async function openCrate() {
  if (busy || !state.crates.length) return;
  busy = true; metrics.count('开箱');
  const crate = state.crates[0], regions = [...new Set(crate.items.map(i => A.homeRegion(state, i.chain)))];
  const main = regions.includes(view) ? view : regions[0];
  if (main !== view) await setView(main);
  const btn = $('#crate'), from = btn && !btn.hidden ? centerOf(btn) : [innerWidth / 2, innerHeight - 140];
  if (btn) { shake(btn, 6, 300); await wait(240); }
  const res = A.openCrate(state, crate.id);
  state = res.state;
  const drop = res.events.find(e => e.type === 'drop');
  sfx.whoosh(); burst(from[0], from[1], {count: 18, colors: ['#ffd25e', '#fff', '#c98a47'], spread: 70, shape: 'star'});
  renderHud(); renderPins();
  // Items fly out at their original level; the cascade plays afterwards.
  const visible = drop.items.filter(it => A.regionOfCell(it.cell) === view), elsewhere = drop.items.length - visible.length;
  await Promise.all(visible.map((it, n) => {
    const to = world.cellToClient(it.cell);
    return fly(sprite(matName(it.chain, it.level)), from, [to[0], to[1] - 18], {size: 46, duration: 400, delay: n * 60, arc: -140, spin: 180}).then(() => {
      world.upsertSprite('item-' + it.id, {name: matName(it.chain, it.level), cell: it.cell, extent: PLATE.cell * (1.4 + it.level * .08), cls: 'item auto' + (it.bonus ? ' bonus' : '')});
      sfx.spawn(it.level);
    });
  }));
  for (const it of drop.items) if (!world.spriteEl('item-' + it.id)) world.upsertSprite('item-' + it.id, {name: matName(it.chain, it.level), cell: it.cell, extent: PLATE.cell * (1.4 + it.level * .08), cls: 'item'});
  await wait(120);
  await playMergeEvents(res.events.filter(e => e.type !== 'drop' && (e.type !== 'merge' || A.regionOfCell(e.at) === view)));
  busy = false; render();
  if (elsewhere) toast(`另有 ${elsewhere} 件材料送到了${regions.filter(r => r !== view).map(r => REGIONS[r].short).join('、')}`, {ms: 2600});
  if (state.crates.length) toast('那边放满了，剩下的还在箱子里。先合成腾出地方。', {ms: 2800});
  const ready = A.readyRepairs(state).find(x => x.item);
  if (ready) pointInstall(ready.item, ready.repair);
}

// Where an item appears to come from: its sprite if on screen, else the tab of
// the region it sits in, else the goal bar.
function itemOrigin(item) {
  const p = world.spriteClient('item-' + item.id), box = world.container.getBoundingClientRect();
  if (p && p[0] > box.left && p[0] < box.right && p[1] > box.top && p[1] < box.bottom) return p;
  const tab = $(`#regions [data-region="${A.regionOfCell(item.cell)}"]`);
  return tab && !$('#regions').hidden ? centerOf(tab) : centerOf($('#goal'));
}
// Tapping a ready site (its pin or the goal bar) delivers from anywhere.
function installReady(r) {
  if (busy) return;
  const item = state.items.filter(i => i.chain === r.chain && i.level >= r.level).sort((a, b) => a.level - b.level)[0];
  if (item) { metrics.count('点按修复'); doInstall(item.id, r.id); }
}
async function doInstall(itemId, repairId) {
  const r = A.repairById(repairId), item = findItem(itemId), res = A.install(state, itemId, repairId);
  if (!res.ok) { toast(res.message, {tone: 'bad'}); sfx.error(); render(); return; }
  busy = true; selected = null; hideHand(); metrics.count('修复'); metrics.event('repair', {id: repairId, level: state.level});
  const site = SPOTS[r.spot], from = itemOrigin(item);
  world.removeSprite('item-' + itemId); world.removePin('pin-' + r.id);
  await world.fit([site], {...insets(), pad: 1.8, animate: true, maxScale: 1.3, duration: 450, overscroll: true});
  const to = world.cellToClient(site);
  await fly(sprite(matName(item.chain, item.level)), from || to, [to[0], to[1] - 20], {size: 64, duration: 460, arc: -120, spin: 20});
  sfx.build();
  shake(world.spriteEl('site-' + r.spot), 6, 300);
  for (let n = 0; n < 3; n++) { burst(to[0] + (n - 1) * 18, to[1] - 18, {count: 8, colors: ['#ffe9a6', '#fff', '#d7a35a'], spread: 40, shape: 'chip'}); await wait(110); }
  state = res.state;
  const revealDone = world.reveal(site, r.reveal, {duration: 1400});
  render();
  const fixed = world.spriteEl('site-' + r.spot);
  if (fixed) { fixed.classList.add('just-built'); setTimeout(() => fixed.classList.remove('just-built'), 900); }
  burst(to[0], to[1] - 30, {count: 26, colors: ['#ffd25e', '#fff3b0', '#fff', '#8fdc4e'], spread: 120, shape: 'star', duration: 900});
  ring(to[0], to[1], {size: 220, width: 5, duration: 700});
  floatText(to[0], to[1] - 70, r.unlocks, {cls: 'big', rise: 60, duration: 1800, size: 20});
  if (r.creek) { creek.fill(); world.reveal([4, -2], 3, {duration: 2200}); world.reveal([1, -1], 1.6, {duration: 2400}); }
  await revealDone;
  const opened = res.events.some(e => e.type === 'open');
  if (opened) { world.clearFog('creek'); world.reveal([5, -1], 1.2, {duration: 1500}); world.reveal([10, -2], 1.2, {duration: 1500}); }
  // Settle the camera before handing control back, so it never jumps mid-play.
  await setView(opened ? 'creek' : A.SPOT_REGION[r.spot]);
  if (opened) toast('旧溪谷和芦苇河湾开放了！', {tone: 'good', ms: 2400});
  busy = false;
  render();
  await converse(r.lines, {at: () => world.cellToClient(site), portrait: PORTRAIT, names: NAMES, root: app});
  for (const e of res.events) if (e.type === 'diary') diaryToast(e.page);
  if (res.events.some(e => e.type === 'letter')) await showLetter();
  if (res.events.some(e => e.type === 'finale')) await ending();
}
function diaryToast(page) {
  sfx.sparkle(.1);
  const el = document.createElement('button'); el.className = 'diary-toast'; el.innerHTML = `${icon.book}<span><small>找回一页外婆的手记</small>${esc(DIARY[page].slice(0, 16))}…</span>`;
  app.append(el); requestAnimationFrame(() => el.classList.add('show')); setTimeout(() => el.classList.add('show'), 50);
  el.addEventListener('click', () => { el.remove(); showDiary(page); });
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4200);
}
async function showDiary(focus = null) {
  metrics.count('看手记'); seenDiary = state.diary.length; save(); renderHud();
  const pages = DIARY.map((t, i) => state.diary.includes(i) ? `<li class="${i === focus ? 'new' : ''}"><b>${i + 1}</b><p>${esc(t)}</p></li>` : `<li class="lost"><b>${i + 1}</b><p>这一页还没找回来。</p></li>`).join('');
  await sheet({title: '外婆的手记', body: `<ol class="diary">${pages}</ol><p class="hint">每修好一处，就会找回散落的手记。</p>`, actions: [{label: '合上手记', value: 1}]});
}
async function showLetter() {
  sfx.chime(); metrics.event('letter');
  const el = document.createElement('div'); el.className = 'letter';
  el.innerHTML = `<div class="card"><h3>${LETTER.to}</h3><p>${LETTER.text}</p><div class="sign">——${LETTER.from}</div><button class="btn">把信收好</button></div>`;
  app.append(el); requestAnimationFrame(() => el.classList.add('show')); setTimeout(() => el.classList.add('show'), 50);
  await new Promise(r => el.querySelector('button').addEventListener('click', r, {once: true}));
  el.classList.remove('show'); await wait(250); el.remove();
}
async function ending() {
  metrics.event('complete'); metrics.flush(); sfx.fanfare();
  const s = state.stats, threeStars = Object.values(state.best).filter(v => v === 3).length;
  await sheet({cls: 'center', title: OUTRO.title, body: `<p>${OUTRO.text}</p><div class="end-stats"><div><b>${s.wins}</b><small>关三消</small></div><div><b>${threeStars}</b><small>关三星</small></div><div><b>${s.repairs}</b><small>处修复</small></div><div><b>${s.chainMerges}</b><small>次连锁合成</small></div></div><p class="next">${OUTRO.next}</p>`, actions: [{label: '好', value: 1}]});
}
async function hintRepair(r) {
  const region = A.SPOT_REGION[r.spot];
  if (region !== view) await setView(region);
  const item = state.items.find(i => i.chain === r.chain && i.level >= r.level);
  if (item) { pointInstall(item, r); return; }
  const p = A.progressTo(state, r), who = r.lines[0][0];
  speak(world.cellToClient(SPOTS[r.spot]), PORTRAIT[who], `${r.title}——需要 ${nameOf(r.chain, r.level)}（${CHAINS[r.chain].label} L${r.level}），还差 ${p.need - p.have} 份材料。`, {root: app, name: NAMES[who]});
}

// ---------- level flow ----------
async function prelevel() {
  if (busy) return;
  if (state.crates.length) { openCrate(); return; }
  const level = state.level, def = A.levelFor(level), r = nextRepair(), picks = new Set();
  const river = A.done(state, 'path'), goals = [...(def.layout.join('').match(/[C2]/g) ? [`<span><img src="${sprite('crate')}" alt="">木箱</span>`] : []), ...(def.layout.join('').includes('M') ? [`<span><img src="${sprite('piece-mud')}" alt="">淤泥</span>`] : []), ...def.collect.map(([c, n]) => `<span><img src="${pieceArt(c)}" alt="">${n}</span>`)].join('');
  const brings = [`<span><img src="${sprite(matName(river && !r?.chain?.includes('wood') ? 'dock' : 'wood', 1))}" alt="">木箱 → 木料</span>`, ...(river ? [`<span><img src="${pieceArt(3)}" alt="">→ <img src="${sprite(matName('water', 1))}" alt=""></span>`, `<span><img src="${pieceArt(0)}" alt="">→ <img src="${sprite(matName('reed', 1))}" alt=""></span>`] : [])].join('');
  const boosterHtml = () => Object.entries(A.BOOSTERS).map(([id, b]) => {
    const unlocked = A.boosterUnlocked(state, id), on = picks.has(id);
    return `<button class="booster ${on ? 'on' : ''}" data-booster="${id}" ${unlocked ? '' : 'disabled'}><img src="${sprite(b.art)}" alt=""><span>${b.name}</span><span class="cost">${icon.star}${b.cost}</span>${unlocked ? '' : `<span class="lock">${icon.lock}</span>`}</button>`;
  }).join('');
  const best = state.best[level] ? '★'.repeat(state.best[level]) : '';
  const body = `<div class="prelevel"><div class="level-no">第 ${level} 关 ${best ? `<em>${best}</em>` : ''}</div>
    ${def.hint ? `<p class="tip">${def.hint}</p>` : ''}
    <div class="row"><small>目标</small><div class="goal-row">${goals}</div></div>
    <div class="row"><small>带回</small><div class="goal-row brings">${brings}</div></div>
    <div class="row"><small>关前道具</small><div class="boosters" id="booster-row">${boosterHtml()}</div></div>
    ${A.freeRocket(state) ? '<p class="perk">菜园围栏：开局自带 1 个火箭</p>' : ''}${A.extraMoves(state) ? `<p class="perk">护岸：每关多 ${A.extraMoves(state)} 步</p>` : ''}</div>`;
  const choice = await sheet({title: '', body, actions: [{label: '开始', value: 'go'}], onMount: el => {
    el.querySelector('#booster-row').addEventListener('click', e => {
      const b = e.target.closest('[data-booster]'); if (!b || b.disabled) return;
      const id = b.dataset.booster, cost = [...picks].reduce((n, k) => n + A.BOOSTERS[k].cost, 0);
      if (picks.has(id)) picks.delete(id); else if (state.stars - cost >= A.BOOSTERS[id].cost) picks.add(id); else { toast(`星星不够（需要 ${A.BOOSTERS[id].cost}）`, {tone: 'bad'}); return; }
      sfx.tap(); el.querySelector('#booster-row').innerHTML = boosterHtml();
    });
  }});
  if (choice !== 'go') return;
  for (const id of picks) { const res = A.buyBooster(state, id); if (res.ok) { state = res.state; metrics.count('关前道具'); } }
  pending = [...picks, ...(A.freeRocket(state) ? ['rocket'] : [])];
  startLevel(false);
}
let pending = [];
function startLevel(retry) {
  if (!retry) metrics.count('开始关卡');
  const def = A.levelFor(state.level), r = nextRepair();
  const run = createRun(state.level, def, {seed: (Date.now() ^ (state.level * 2654435761)) >>> 0, boosters: retry ? (A.freeRocket(state) ? ['rocket'] : []) : pending, extraMoves: A.extraMoves(state)});
  pending = []; metrics.enter('三消');
  $('#match').hidden = false;
  match.show(run, r ? `为「${r.title.slice(0, 10)}」带回材料` : '收集星星');
}
function showMap() { metrics.enter('地图'); $('#match').hidden = true; match.hide(); render(); setView(view, false); }

async function finishLevel(game) {
  const before = state.level, total = game.moves + game.usedMoves;
  const res = A.awardWin(state, {cratesCleared: game.cratesCleared, collected: game.collected, movesLeft: game.moves, totalMoves: total});
  state = res.state; metrics.count('通关'); metrics.event('win', {level: before, movesLeft: game.moves});
  const ev = res.events[0], counts = {};
  for (const it of ev.crate.items) { const k = it.chain + (it.bonus ? '*' : ''); counts[k] = (counts[k] || 0) + 1; }
  showMap();
  sfx.fanfare();
  const gains = Object.entries(counts).map(([k, n]) => { const chain = k.replace('*', ''); return `<span class="${k.endsWith('*') ? 'bonus' : ''}"><img src="${sprite(matName(chain, 1))}" alt="">×${n}</span>`; }).join('') + `<span>${icon.star}×${ev.stars}</span>`;
  const starRow = [1, 2, 3].map(n => `<i class="${n <= ev.rating ? 'on' : ''}">★</i>`).join('');
  await sheet({cls: 'center', dismissable: false, title: `第 ${before} 关 · 通关！`, body: `<div class="win-sum"><div class="rating">${starRow}</div><img class="chest" src="${sprite('chest')}" alt=""><div class="gains">${gains}</div>${ev.bonus ? `<p>剩余 ${game.moves} 步 → 额外 ${ev.bonus} 份材料（金框）</p>` : '<p>剩余步数越多，带回的材料越多</p>'}</div>`, actions: [{label: '带回营地', kind: 'gold', value: 1}]});
  render();
  await wait(150);
  openCrate();
}

// ---------- guidance ----------
let hand = null, handTimer;
function hideHand() { if (hand) hand.hidden = true; }
async function pointInstall(item, r) {
  const region = A.SPOT_REGION[r.spot], itemRegion = A.regionOfCell(item.cell);
  if (itemRegion !== region) { if (region !== view) await setView(region); toast('材料备齐了，点工地上的「送去」就能修', {ms: 2600}); pointAtPin(world.cellToClient(SPOTS[r.spot])); return; }
  if (region !== view) await setView(region);
  const a = world.spriteClient('item-' + item.id), b = world.cellToClient(SPOTS[r.spot]);
  if (!a) return;
  if (!hand) { hand = document.createElement('div'); hand.className = 'hand'; hand.innerHTML = icon.hand; document.body.append(hand); }
  hand.getAnimations().forEach(x => x.cancel());
  hand.hidden = false; hand.style.left = `${a[0]}px`; hand.style.top = `${a[1]}px`;
  if (!reducedMotion()) hand.animate([{transform: 'translate(0,0)', opacity: 1}, {transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px)`, opacity: 1, offset: .7}, {transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px)`, opacity: 0}], {duration: 1300, iterations: 3});
  clearTimeout(handTimer); handTimer = setTimeout(hideHand, 4000);
}

function pointAtPin(p) {
  if (!hand) { hand = document.createElement('div'); hand.className = 'hand'; hand.innerHTML = icon.hand; document.body.append(hand); }
  hand.getAnimations().forEach(x => x.cancel());
  hand.hidden = false; hand.style.left = `${p[0]}px`; hand.style.top = `${p[1] - PLATE.cell * 1.6 * world.cam.scale}px`;
  if (!reducedMotion()) hand.animate([{transform: 'translate(0,0) scale(1)'}, {transform: 'translate(4px,8px) scale(.9)'}, {transform: 'translate(0,0) scale(1)'}], {duration: 900, iterations: 4});
  clearTimeout(handTimer); handTimer = setTimeout(hideHand, 4000);
}
// Region tabs.
app.addEventListener('click', e => {
  const task = e.target.closest('[data-region]');
  if (task && !busy) { sfx.tap(); setView(task.dataset.region); }
});
$('#play').addEventListener('click', () => { unlock(); prelevel(); });
$('#crate').addEventListener('click', () => { unlock(); openCrate(); });
$('#goal').addEventListener('click', () => { const r = nextRepair(); if (!r) return; if (state.items.some(i => i.chain === r.chain && i.level >= r.level)) installReady(r); else hintRepair(r); });
$('#diary').addEventListener('click', () => { if (!busy) showDiary(); });
$('#settings').addEventListener('click', async () => {
  const rows = Object.entries(metrics.summary()).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('');
  const choice = await sheet({title: '设置', body: `<p>试玩记录（只保存在本机）</p><table class="metrics">${rows || '<tr><td>还没有记录</td><td></td></tr>'}</table>`,
    actions: [{label: muted ? '打开声音' : '关闭声音', kind: 'secondary', value: 'sound'}, {label: '重新开始', kind: 'secondary', value: 'reset'}]});
  if (choice === 'sound') { muted = !muted; setMuted(muted); save(); toast(muted ? '声音已关闭' : '声音已打开'); }
  if (choice === 'reset') { const sure = await sheet({cls: 'center', title: '重新开始？', body: '<p>进度会清空，试玩记录也会清空。</p>', actions: [{label: '重新开始', kind: 'secondary', value: true}, {label: '取消', value: false}]}); if (sure) { store.reset(); location.reload(); } }
});

// ---------- boot ----------
window.__liteA = {get state() { return state; }, set state(v) { state = v; }, A, world, metrics, finishLevel, openCrate, render, setView, SPOTS, get busy() { return busy; }};
await world.ready;
world.reveal([0, 0], 1.25, {instant: true});
if (A.done(state, 'path')) { world.reveal([5, -1], 1.2, {instant: true}); world.reveal([10, -2], 1.2, {instant: true}); }
if (A.done(state, 'stream')) { world.reveal([4, -2], 3, {instant: true}); world.reveal([1, -1], 1.6, {instant: true}); }
for (const id of state.done) { const r = A.repairById(id); world.reveal(SPOTS[r.spot], r.reveal, {instant: true}); }
render();
await setView(view, false);
metrics.enter('地图');
if (!state.stats.wins && !state.crates.length) {
  await wait(400);
  await converse(INTRO, {at: who => world.cellToClient(who === 'lina' ? SPOTS.shelter : [0, 0]), portrait: PORTRAIT, names: NAMES, root: app, gap: 2000});
  speak(world.cellToClient(SPOTS.shelter), PORTRAIT.mira, '林子里有很多被风暴吹散的木箱。去把它们找回来，木料就有了。', {root: app, name: NAMES.mira});
}
