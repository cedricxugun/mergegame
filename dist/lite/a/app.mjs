// Prototype A · 三消 + 轻合成. Loop: pick boosters → play a match-3 level →
// a supply crate flies home → one tap opens it, low pairs auto-merge in a
// cascade → drag the finished component onto the ruin → the world changes.
import * as A from './rules.mjs';
import {createRun, mountMatch, PIECE_NAMES} from './match.mjs';
import {createWorld, plateOf, PLATE} from '../shared/world.mjs';
import {key, parseKey} from '../shared/hex.mjs';
import {CHAINS, nameOf, matName} from '../shared/art.mjs';
import {sfx, unlock, setMuted} from '../shared/audio.mjs';
import {burst, ring, floatText, fly, squash, shake, haptic, centerOf, reducedMotion} from '../shared/fx.mjs';
import {createStore, createMetrics} from '../shared/store.mjs';
import {$, esc, wait, sprite, toast, sheet, speak} from '../shared/ui.mjs';
import {icon} from '../shared/icons.mjs';

const PORTRAIT = {mira: sprite('portrait-mira'), lina: sprite('portrait-lina'), rowan: sprite('portrait-rowan')};
const store = createStore('forest-camp.lite-a', A.VERSION);
const saved = store.load(() => null);
let state = saved?.state && A.validate(saved.state) ? saved.state : A.freshState();
const metrics = createMetrics(saved?.metrics);
let muted = !!saved?.muted; setMuted(muted);
let selected = null, busy = false, drag = null, screen = 'map', view = saved?.view === 'river' ? 'river' : 'camp';

const app = $('#app');
app.innerHTML = `
  <div id="world"></div>
  <header class="hud">
    <div class="pill" id="stars"><span class="pill-icon">${icon.star}</span><span id="stars-n"></span></div>
    <div class="pill"><small>第</small><span id="level-n"></span><small>关</small></div>
    <div class="spacer"></div>
    <div class="region-switch" id="regions" hidden><button data-region="camp">营地</button><button data-region="river">河湾</button></div>
    <button class="icon-btn" id="settings" aria-label="设置">${icon.gear}</button>
  </header>
  <button class="goal" id="goal" aria-live="polite"></button>
  <footer class="dock"><div class="crates" id="crates"></div><button class="btn play" id="play"></button></footer>
  <section id="match" class="match-screen screen" hidden aria-label="三消关卡"></section>`;

const world = createWorld($('#world'), {onPress: () => unlock(), onTap: handleTap, onDragStart: startDrag, onDragMove: moveDrag, onDragEnd: endDrag});
const match = mountMatch($('#match'), {
  onWin: game => finishLevel(game),
  onLose: () => { state.stats.losses++; state.stats.retries++; metrics.count('失败重试'); startLevel(true); },
  onExit: () => { metrics.count('中途退出'); showMap(); },
  getSound: () => !muted, onToggleSound: () => { muted = !muted; setMuted(muted); save(); }
});
function save() { store.save({state, metrics: metrics.data, muted, view}); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { metrics.flush(); save(); } });

// ---------- map rendering ----------
const regionOpen = () => A.done(state, 'path');
// One region at a time keeps pieces large on a phone; the switch appears once
// the river opens.
const RIVER_SITES = ['spring', 'reeds', 'dock'];
const regionOfCell = cell => A.BOARD.river.some(c => key(...c) === key(...cell)) || RIVER_SITES.some(id => key(...A.SITES[id]) === key(...cell)) ? 'river' : 'camp';
function viewCells() {
  if (!regionOpen()) view = 'camp';
  return view === 'river' ? [...A.BOARD.river, ...RIVER_SITES.map(id => A.SITES[id])] : [...A.BOARD.camp, A.SITES.shelter, A.SITES.hearth, A.SITES.path];
}
function setView(region, animate = true) {
  if (region === 'river' && !regionOpen()) return Promise.resolve();
  view = region; save();
  for (const b of $('#regions').children) b.classList.toggle('on', b.dataset.region === view);
  return frameMap(animate);
}
function frameMap(animate = false) {
  const top = $('#goal').getBoundingClientRect().bottom - app.getBoundingClientRect().top + 6;
  const bottom = app.getBoundingClientRect().bottom - $('.dock').getBoundingClientRect().top + 6;
  return world.fit(viewCells(), {top, bottom, pad: .05, animate, maxScale: 1.2, overscroll: true});
}
function renderTurf() {
  world.setCells(A.boardCells(state).map(c => ({cell: c, cls: 'free'})));
  world.fog('river', regionOpen() ? null : [...A.BOARD.river, ...Object.values(A.SITES).slice(3)].filter(([q]) => q >= 6));
}
const findItem = id => state.items.find(i => i.id === id);
const sameKind = (a, b) => { const x = findItem(a), y = findItem(b); return x && y && x.id !== y.id && x.chain === y.chain && x.level === y.level && x.level < 7; };
function renderSites() {
  const carrying = drag && findItem(drag.id);
  for (const r of A.REPAIRS) {
    const isDone = A.done(state, r.id);
    // Upgrades replace the earlier scene on the same site.
    if (r.id === 'roof' && A.done(state, 'home')) { world.removeSprite('site-roof'); continue; }
    if (r.id === 'spring' && A.done(state, 'stream')) { world.removeSprite('site-spring'); continue; }
    if (!r.ruin && !isDone) continue;
    const art = isDone ? r.art : r.ruin, fogged = !regionOpen() && plateOf(A.SITES[r.site])[0] > plateOf([5, -3])[0];
    const can = carrying && A.repairAvailable(state, r) && carrying.chain === r.chain && carrying.level >= r.level;
    world.upsertSprite('site-' + r.id, {name: art, cell: A.SITES[r.site], extent: PLATE.cell * (r.id === 'home' ? 3.3 : r.id === 'stream' ? 3.3 : r.id === 'path' ? 2.3 : 2.6), cls: `site ${isDone ? 'fixed' : 'ruin'} ${can ? 'can-drop' : ''} ${fogged ? 'dim' : ''}`, lift: .25});
  }
}
function renderItems() {
  const live = new Set(state.items.map(i => 'item-' + i.id));
  for (const id of world.spriteIds()) if (id.startsWith('item-') && !live.has(id)) world.removeSprite(id);
  const ready = new Set(A.readyRepairs(state).filter(x => x.item).map(x => x.item.id));
  for (const i of state.items) {
    if (drag?.id === i.id) continue;
    const match = selected && sameKind(selected, i.id);
    world.upsertSprite('item-' + i.id, {name: matName(i.chain, i.level), cell: i.cell, extent: PLATE.cell * (1.35 + i.level * .09),
      cls: `item ${selected === i.id ? 'selected' : ''} ${match ? 'match-target' : ''} ${ready.has(i.id) ? 'can-install' : ''}`});
  }
}
function renderPins() {
  for (const r of A.REPAIRS) {
    const id = 'pin-' + r.id;
    if (!A.repairAvailable(state, r) || (!regionOpen() && ['spring', 'reeds', 'dock'].includes(r.site))) { world.removePin(id); continue; }
    const ready = state.items.some(i => i.chain === r.chain && i.level >= r.level), [x, y] = plateOf(A.SITES[r.site]);
    world.upsertPin(id, {anchor: [x, y - PLATE.cell * 1.9], cls: 'clickable site ' + (ready ? 'ready' : ''), label: r.title,
      html: `<img src="${sprite(matName(r.chain, r.level))}" alt=""><span class="lvl">L${r.level}</span>${ready ? icon.check.replace('<svg', '<svg width="18" height="18"') : ''}`,
      onClick: () => hintRepair(r)});
  }
  world.removePin('river-lock');
  if (!regionOpen()) { const [x, y] = plateOf([8, -4]); world.upsertPin('river-lock', {anchor: [x, y], cls: 'clickable locked', html: `${icon.lock.replace('<svg', '<svg width="20" height="20"')} 修好旧路后开放`, onClick: () => toast('先修好旧路（施工支架 L5）')}); }
}
function regionHasWork(region) {
  const here = state.items.filter(i => regionOfCell(i.cell) === region);
  if (A.readyRepairs(state).some(x => x.item && regionOfCell(x.item.cell) === region)) return true;
  return here.some((a, n) => here.some((b, m) => m > n && a.chain === b.chain && a.level === b.level && a.level < 7));
}
// The goal bar shows what is ready, else the cheapest open repair in the
// region on screen (so it never points at a far-off cabin first).
function nextRepair() {
  const ready = A.readyRepairs(state), here = r => regionOfCell(A.SITES[r.site]) === view;
  return ready.find(x => x.item)?.repair || ready.map(x => x.repair).sort((a, b) =>
    Number(here(b)) - Number(here(a)) || a.level - b.level || A.progressTo(state, b).have - A.progressTo(state, a).have)[0] || null;
}
function renderHud() {
  $('#regions').hidden = !regionOpen();
  for (const b of $('#regions').children) {
    b.classList.toggle('on', b.dataset.region === view);
    // A dot tells the player the other region has a merge or repair waiting.
    b.classList.toggle('attention', b.dataset.region !== view && regionHasWork(b.dataset.region));
  }
  $('#stars-n').textContent = state.stars;
  $('#level-n').textContent = state.level;
  const r = nextRepair(), goal = $('#goal');
  if (!r) { goal.className = 'goal'; goal.innerHTML = `<span class="art"><img src="${sprite('scene-home')}" alt=""></span><div class="copy"><strong>这一片故乡修好了</strong><small>山坡的信号灯，留给下一段旅程</small></div>`; }
  else {
    const p = A.progressTo(state, r), ready = state.items.some(i => i.chain === r.chain && i.level >= r.level);
    goal.className = 'goal' + (ready ? ' ready' : '');
    goal.innerHTML = `<span class="art"><img src="${sprite(matName(r.chain, r.level))}" alt=""></span><div class="copy"><strong>${ready ? '拖到工地上：' : ''}${r.title}</strong><div class="bar"><i style="width:${Math.round(p.have / p.need * 100)}%"></i><b>${nameOf(r.chain, r.level)} L${r.level} · ${p.have}/${p.need}</b></div></div>`;
  }
  $('#crates').innerHTML = state.crates.length ? `<button class="crate-btn" id="crate" aria-label="打开物资箱"><img src="${sprite('chest')}" alt=""><b>${state.crates.length}</b></button>` : '';
  $('#play').innerHTML = state.crates.length ? `打开物资箱<small>点箱子，材料会自动合到一起</small>` : `第 ${state.level} 关<small>${r ? `为「${r.title.slice(0, 8)}」带回材料` : '继续收集星星'}</small>`;
  $('#play').className = 'btn play ' + (state.crates.length ? 'gold' : '');
}
function render() { renderTurf(); renderSites(); renderItems(); renderPins(); renderHud(); save(); }

// ---------- map interactions ----------
function handleTap(cell, spriteId) {
  if (busy) return;
  const item = spriteId?.startsWith('item-') ? findItem(spriteId.slice(5)) : A.itemAt(state, cell);
  if (item) {
    if (selected && sameKind(selected, item.id)) { doMerge(selected, item.id); return; }
    selected = selected === item.id ? null : item.id; sfx.tap(); render(); return;
  }
  if (spriteId?.startsWith('site-')) {
    const r = A.repairById(spriteId.slice(5)), it = selected && findItem(selected);
    if (r && it && A.repairAvailable(state, r) && it.chain === r.chain && it.level >= r.level) { doInstall(it.id, r.id); return; }
    if (r) hintRepair(r); return;
  }
  if (selected && A.isBoard(state, cell)) { const res = A.moveItem(state, selected, cell); if (res.ok) { state = res.state; sfx.drop(); render(); } return; }
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
  const site = Object.entries(A.SITES).find(([, c]) => key(...c) === key(...cell))?.[0];
  const repair = site && A.REPAIRS.find(r => r.site === site && A.repairAvailable(state, r) && item.chain === r.chain && item.level >= r.level);
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
  render();
}

async function playMergeEvents(events, {manualFirst = false} = {}) {
  let depth = 0;
  for (const e of events) {
    if (e.type !== 'merge') { if (e.type === 'discover') await showDiscovery(e); continue; }
    const from = world.cellToClient(e.from), to = world.cellToClient(e.at);
    if (!(manualFirst && depth === 0)) {
      world.spriteEl('item-' + e.gone)?.style.setProperty('opacity', '0');
      await fly(sprite(matName(e.chain, e.level - 1)), [from[0], from[1] - 18], [to[0], to[1] - 18], {size: 50, duration: Math.max(150, 240 - depth * 20), arc: -40});
    }
    world.removeSprite('item-' + e.gone);
    const el = world.upsertSprite('item-' + e.keep, {name: matName(e.chain, e.level), cell: e.at, extent: PLATE.cell * (1.35 + e.level * .09), cls: 'item'});
    squash(el, {from: .45, peak: 1.25, duration: 380});
    const c = CHAINS[e.chain].color;
    burst(to[0], to[1] - 18, {count: 8 + e.level * 2, colors: [c, '#fff6c8', '#fff'], spread: 40 + e.level * 8, shape: e.chain === 'reed' ? 'leaf' : e.chain === 'water' ? 'dot' : 'chip'});
    ring(to[0], to[1] - 10, {size: 60 + e.level * 12});
    if (depth >= 2) floatText(to[0], to[1] - 50, `连合 ×${depth + 1}`, {size: 16 + depth * 2, color: '#fff3a1'});
    sfx.merge(e.level, depth); haptic(8 + e.level * 2);
    depth++;
    await wait(Math.max(60, 160 - depth * 15));
  }
}
async function doMerge(aId, bId, dragged = false) {
  const res = A.merge(state, aId, bId);
  if (!res.ok) { toast(res.message, {tone: 'bad'}); sfx.error(); render(); return; }
  busy = true; selected = null; metrics.count('手动合成');
  state = res.state;
  await playMergeEvents(res.events, {manualFirst: dragged});
  busy = false; render();
}

let discoverTimer;
async function showDiscovery(e) {
  if (e.level <= 1) return;
  let el = $('.discover');
  if (!el) { el = document.createElement('div'); el.className = 'discover'; app.append(el); }
  el.innerHTML = `<img src="${sprite(matName(e.chain, e.level))}" alt=""><div><small>新发现 · ${CHAINS[e.chain].label} L${e.level}</small><strong>${nameOf(e.chain, e.level)}</strong></div>`;
  el.classList.add('show'); sfx.chime(); clearTimeout(discoverTimer);
  discoverTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

async function openCrate() {
  if (busy || !state.crates.length) return;
  busy = true; metrics.count('开箱');
  // Show the region where most of this crate lands (wood goes to camp).
  const riverShare = state.crates[0].items.filter(i => i.chain !== 'wood').length / state.crates[0].items.length;
  const landing = regionOpen() && riverShare >= 0.5 ? 'river' : 'camp';
  if (landing !== view) await setView(landing);
  const btn = $('#crate'), from = btn ? centerOf(btn) : [innerWidth / 2, innerHeight - 120];
  if (btn) { shake(btn, 6, 300); await wait(260); }
  const res = A.openCrate(state, state.crates[0].id);
  state = res.state;
  const drop = res.events.find(e => e.type === 'drop');
  sfx.whoosh(); burst(from[0], from[1], {count: 18, colors: ['#ffd25e', '#fff', '#c98a47'], spread: 70, shape: 'star'});
  // Items fly out first (pre-merge levels), then the cascade plays.
  const preLevels = new Map(drop.items.map(i => [i.id, i.level]));
  const flights = drop.items.map((it, n) => {
    const to = world.cellToClient(it.cell);
    return fly(sprite(matName(it.chain, preLevels.get(it.id))), from, [to[0], to[1] - 18], {size: 48, duration: 420, delay: n * 70, arc: -140, spin: 180}).then(() => {
      world.upsertSprite('item-' + it.id, {name: matName(it.chain, preLevels.get(it.id)), cell: it.cell, extent: PLATE.cell * (1.35 + preLevels.get(it.id) * .09), cls: 'item auto'});
      sfx.spawn(it.level);
    });
  });
  for (const id of world.spriteIds()) if (id.startsWith('item-') && preLevels.has(id.slice(5))) world.removeSprite(id);
  renderHud(); renderPins();
  await Promise.all(flights);
  if (drop.items.some(i => i.bonus)) floatText(innerWidth / 2, innerHeight * .4, '剩余步数 → 额外材料', {size: 18, color: '#fff3a1'});
  await wait(150);
  await playMergeEvents(res.events.filter(e => e.type !== 'drop'));
  if (state.crates.length) toast('这里放满了，剩下的还在箱子里', {ms: 2200});
  else { const other = view === 'camp' ? 'river' : 'camp'; if (regionOpen() && regionHasWork(other)) toast(`${other === 'camp' ? '营地' : '河湾'}那边也有能合的材料`, {ms: 2400}); }
  busy = false; render();
  const ready = A.readyRepairs(state).find(x => x.item);
  if (ready) pointInstall(ready.item, ready.repair);
}

const distTo = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] + a[1] - b[0] - b[1])) / 2;
async function doInstall(itemId, repairId) {
  const r = A.repairById(repairId), item = findItem(itemId), res = A.install(state, itemId, repairId);
  if (!res.ok) { toast(res.message, {tone: 'bad'}); sfx.error(); render(); return; }
  busy = true; selected = null; metrics.count('修复'); metrics.event('repair', {id: repairId, level: state.level});
  hideHand();
  const site = A.SITES[r.site], from = world.spriteClient('item-' + itemId);
  world.removeSprite('item-' + itemId); world.removePin('pin-' + r.id);
  await world.fit([site], {top: 140, bottom: 180, pad: 1.6, animate: true, maxScale: 1.25, duration: 450, overscroll: true});
  const to = world.cellToClient(site);
  await fly(sprite(matName(item.chain, item.level)), from || to, [to[0], to[1] - 20], {size: 64, duration: 480, arc: -120, spin: 20});
  sfx.build();
  shake(world.spriteEl('site-' + r.id), 6, 300);
  for (let n = 0; n < 3; n++) { burst(to[0] + (n - 1) * 18, to[1] - 18, {count: 8, colors: ['#ffe9a6', '#fff', '#d7a35a'], spread: 40, shape: 'chip'}); await wait(110); }
  state = res.state;
  const revealDone = world.reveal(site, r.reveal, {duration: 1400});
  if (r.creek) world.reveal([3, -2], 2.2, {duration: 1800});
  render();
  const fixed = world.spriteEl('site-' + r.id);
  if (fixed && !reducedMotion()) fixed.animate([{transform: 'translateY(-30px) scale(.7)', opacity: 0}, {transform: 'translateY(4px) scale(1.06)', opacity: 1, offset: .6}, {transform: 'none', opacity: 1}], {duration: 620, easing: 'cubic-bezier(.2,.9,.3,1.2)'});
  burst(to[0], to[1] - 30, {count: 26, colors: ['#ffd25e', '#fff3b0', '#fff', '#8fdc4e'], spread: 120, shape: 'star', duration: 900});
  ring(to[0], to[1], {size: 220, width: 5, duration: 700});
  floatText(to[0], to[1] - 70, r.unlocks, {cls: 'big', rise: 60, duration: 1700, size: 22});
  await revealDone;
  if (r.id === 'path') { world.clearFog('river'); world.reveal([8, -4], 1.1, {duration: 1600}); view = 'river'; }
  busy = false;
  for (const [who, text] of r.lines) await new Promise(res2 => { speak(world.cellToClient(site), PORTRAIT[who], text, {ms: 3000, root: app}); setTimeout(res2, 2100); });
  if (r.finale) await letter();
  await frameMap(true);
  render();
  if (!A.availableRepairs(state).length) ending();
}
async function letter() {
  sfx.chime();
  const el = document.createElement('div'); el.className = 'letter';
  el.innerHTML = `<div class="card"><h3>给米拉</h3>风暴那晚，山坡的信号灯熄了。<br>我在灯塔里留了一样东西——<br>等你把家修好，就上来找我。<div class="sign">——妈妈</div><button class="btn" style="width:100%;margin-top:16px">把信收好</button></div>`;
  app.append(el); requestAnimationFrame(() => el.classList.add('show'));
  metrics.event('letter');
  await new Promise(r => el.querySelector('button').addEventListener('click', r, {once: true}));
  el.remove();
}
async function ending() {
  metrics.event('complete'); metrics.flush();
  const s = state.stats;
  await sheet({cls: 'center', title: '这一片故乡修好了', body: `<div class="end-stats"><div><b>${s.wins}</b><small>关三消</small></div><div><b>${s.repairs}</b><small>处修复</small></div><div><b>${s.merges}</b><small>次合成</small></div><div><b>${s.chainMerges}</b><small>次连锁合成</small></div></div><p>山坡上的信号灯还没亮。下一段旅程，从那里开始。</p>`, actions: [{label: '好', value: 1}]});
}
async function hintRepair(r) {
  if (regionOfCell(A.SITES[r.site]) !== view) await setView(regionOfCell(A.SITES[r.site]));
  const p = world.cellToClient(A.SITES[r.site]), pr = A.progressTo(state, r), item = state.items.find(i => i.chain === r.chain && i.level >= r.level);
  if (item) { pointInstall(item, r); return; }
  speak(p, PORTRAIT[r.lines[0][0]], `${r.title}：需要 ${nameOf(r.chain, r.level)}（L${r.level}），还差 ${pr.need - pr.have} 份材料。`, {ms: 3000, root: app});
}

// ---------- level flow ----------
let pendingBoosters = [];
async function prelevel() {
  if (busy) return;
  if (state.crates.length) { openCrate(); return; }
  const level = state.level, r = nextRepair();
  const picks = new Set();
  const boosterHtml = () => Object.entries(A.BOOSTERS).map(([id, b]) => {
    const unlocked = A.boosterUnlocked(state, id), on = picks.has(id);
    return `<button class="booster ${on ? 'on' : ''}" data-booster="${id}" ${unlocked ? '' : 'disabled'}><img src="${sprite(b.art)}" alt=""><span>${b.name}</span><span class="cost">${icon.star}${b.cost}</span>${unlocked ? '' : `<span class="lock">修好${A.repairById(b.after).title.slice(0, 4)}…解锁</span>`}</button>`;
  }).join('');
  const river = A.done(state, 'path');
  const body = `<div class="prelevel"><div class="level-no">第 ${level} 关</div>
    <div class="reward-preview">通关奖励：<img src="${sprite('chest')}" alt="">物资箱 · 木箱=${river ? '栈桥木板' : '木料'}${river ? ' · 叶子=芦苇 · 水滴=水' : ''}</div>
    <div class="boosters" id="booster-row">${boosterHtml()}</div>
    <div class="reward-preview">剩余步数也会变成额外材料</div></div>`;
  const wrapPromise = sheet({title: '', body, actions: [{label: '开始', value: 'go'}, {label: '先看看地图', kind: 'ghost', value: null}]});
  const row = document.querySelector('#booster-row');
  row?.addEventListener('click', e => {
    const b = e.target.closest('[data-booster]'); if (!b || b.disabled) return;
    const id = b.dataset.booster, cost = [...picks].reduce((n, k) => n + A.BOOSTERS[k].cost, 0);
    if (picks.has(id)) picks.delete(id); else if (state.stars - cost >= A.BOOSTERS[id].cost) picks.add(id); else { toast(`星星不够（需要 ${A.BOOSTERS[id].cost}）`, {tone: 'bad'}); return; }
    sfx.tap(); row.innerHTML = boosterHtml();
  });
  const choice = await wrapPromise;
  if (choice !== 'go') return;
  for (const id of picks) { const res = A.buyBooster(state, id); if (res.ok) { state = res.state; metrics.count('关前道具'); } }
  pendingBoosters = [...picks];
  startLevel(false);
}
function startLevel(retry) {
  if (!retry) metrics.count('开始关卡');
  const r = nextRepair(), run = createRun(A.engineLevel(state.level), {seed: (Date.now() ^ (state.level * 2654435761)) >>> 0, boosters: retry ? [] : pendingBoosters, extraMoves: A.extraMoves(state)});
  pendingBoosters = [];
  screen = 'match'; metrics.enter('三消');
  $('#match').hidden = false;
  match.show(run, r ? `为「${r.title.slice(0, 10)}」带回材料` : '收集星星');
}
function showMap() { screen = 'map'; metrics.enter('地图'); $('#match').hidden = true; match.hide(); render(); frameMap(false); }

async function finishLevel(game) {
  const before = state;
  const res = A.awardWin(state, {cratesCleared: game.cratesCleared, collected: game.collected, movesLeft: game.moves});
  state = res.state; metrics.count('通关'); metrics.event('win', {level: before.level, movesLeft: game.moves});
  const ev = res.events[0], counts = {};
  for (const it of ev.crate.items) { const k = it.chain + (it.bonus ? '*' : ''); counts[k] = (counts[k] || 0) + 1; }
  showMap();
  sfx.fanfare();
  const gains = Object.entries(counts).map(([k, n]) => { const chain = k.replace('*', ''); return `<span class="${k.endsWith('*') ? 'bonus' : ''}"><img src="${sprite(matName(chain, 1))}" alt="">×${n}</span>`; }).join('') + `<span>${icon.star}×${ev.stars}</span>`;
  await sheet({cls: 'center', title: `第 ${before.level} 关 · 通关！`, body: `<div class="win-sum"><img class="chest" src="${sprite('chest')}" alt=""><div class="gains">${gains}</div>${ev.bonus ? `<p>剩余 ${game.moves} 步 → 额外 ${ev.bonus} 份材料（金框）</p>` : ''}</div>`, actions: [{label: '带回营地', kind: 'gold', value: 1}]});
  render();
  await wait(200);
  openCrate();
}

// ---------- guidance ----------
let hand = null;
function hideHand() { if (hand) hand.hidden = true; }
function pointInstall(item, r) {
  if (regionOfCell(item.cell) !== regionOfCell(A.SITES[r.site])) { toast(`${nameOf(item.chain, item.level)}在${regionOfCell(item.cell) === 'camp' ? '营地' : '河湾'}，点它再点工地也可以送过去`, {ms: 2600}); return; }
  if (regionOfCell(item.cell) !== view) { setView(regionOfCell(item.cell)).then(() => pointInstall(item, r)); return; }
  const a = world.spriteClient('item-' + item.id), b = world.cellToClient(A.SITES[r.site]);
  if (!a) return;
  if (!hand) { hand = document.createElement('div'); hand.className = 'hand'; hand.innerHTML = icon.hand; document.body.append(hand); }
  hand.hidden = false; hand.style.left = `${a[0]}px`; hand.style.top = `${a[1]}px`;
  if (!reducedMotion()) hand.animate([{transform: 'translate(0,0)', opacity: 1}, {transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px)`, opacity: 1, offset: .7}, {transform: `translate(${b[0] - a[0]}px,${b[1] - a[1]}px)`, opacity: 0}], {duration: 1300, iterations: 3});
  setTimeout(hideHand, 4000);
}

$('#play').addEventListener('click', () => { unlock(); prelevel(); });
$('#crates').addEventListener('click', e => { if (e.target.closest('#crate')) { unlock(); openCrate(); } });
$('#goal').addEventListener('click', () => { const r = nextRepair(); if (r) hintRepair(r); });
$('#regions').addEventListener('click', e => { const r = e.target.closest('[data-region]')?.dataset.region; if (r && !busy) setView(r); });
$('#settings').addEventListener('click', async () => {
  const rows = Object.entries(metrics.summary()).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('');
  const choice = await sheet({title: '设置', body: `<p style="margin:0 0 8px">试玩记录（只保存在本机）</p><table class="metrics">${rows || '<tr><td>还没有记录</td><td></td></tr>'}</table>`,
    actions: [{label: muted ? '打开声音' : '关闭声音', kind: 'secondary', value: 'sound'}, {label: '重新开始', kind: 'secondary', value: 'reset'}, {label: '关闭', value: null}]});
  if (choice === 'sound') { muted = !muted; setMuted(muted); save(); }
  if (choice === 'reset') { store.reset(); location.reload(); }
});

// ---------- boot ----------
window.__liteA = {get state() { return state; }, set state(v) { state = v; }, A, world, metrics, finishLevel, openCrate, render};
await world.ready;
world.reveal([0, 0], 1.25, {instant: true});
for (const id of state.done) { const r = A.repairById(id); world.reveal(A.SITES[r.site], r.reveal, {instant: true}); if (r.creek) world.reveal([3, -2], 2.2, {instant: true}); }
if (regionOpen()) world.reveal([8, -4], 1.1, {instant: true});
render();
await frameMap(false);
metrics.enter('地图');
if (!state.stats.wins) {
  await wait(400);
  await new Promise(res => { speak(world.cellToClient(A.SITES.shelter), PORTRAIT.lina, '妈妈，屋顶漏雨了……', {ms: 2400, root: app}); setTimeout(res, 1900); });
  await new Promise(res => { speak(world.cellToClient([0, 0]), PORTRAIT.mira, '去林子里找些木料。消掉木箱，木头就归我们了。', {ms: 3200, root: app}); setTimeout(res, 2400); });
}
