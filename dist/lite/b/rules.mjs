// Pure merge-2 rules for prototype B ("纯合成"). No DOM. Every action returns
// {ok, state, events} on a cloned state, so the UI can animate events and the
// tests can replay whole sessions deterministically.
import {key, parseKey, neighbors} from '../shared/hex.mjs';
import {MAX_LEVEL} from '../shared/art.mjs';
import {SPOTS, AREA, regionOfCell, SPOT_REGION, isSpot, isCreek} from '../shared/map.mjs';
import {REPAIRS as CHAPTER, DIARY} from '../shared/chapter.mjs';

export const VERSION = 2;
export const BAG_SIZE = 4;
// Demo pacing: regeneration is far faster than a live game would use, so a
// 20–30 minute session still meets the energy wall without long waits.
export const ENERGY = {start: 40, max: 40, regenMs: 30000, refillCost: 15, refillAmount: 25, freeRefill: 20, freeCooldownMs: 180000};

// Generators. Each sits on a landmark spot; a repair can upgrade its odds.
// art: null means the generator is the scenery already drawn on that spot.
export const GENERATORS = {
  logs: {spot: 'logs', chain: 'wood', name: '倒木堆', art: 'env-log', region: 'camp', odds: [[1, .8], [2, .2]], better: [[1, .5], [2, .38], [3, .12]], upgradeBy: 'fire'},
  spring: {spot: 'spring', chain: 'water', name: '石缝泉眼', art: null, region: 'creek', odds: [[1, .85], [2, .15]], better: [[1, .5], [2, .38], [3, .12]], upgradeBy: 'spring', opensWith: 'path'},
  reeds: {spot: 'reeds', chain: 'reed', name: '倒伏的芦苇岸', art: null, region: 'river', odds: [[1, .85], [2, .15]], better: [[1, .5], [2, .38], [3, .12]], upgradeBy: 'cattail', opensWith: 'path'},
  boat: {spot: 'boat', chain: 'dock', name: '搁浅的木船', art: 'v11-boat', region: 'river', odds: [[1, .85], [2, .15]], better: [[1, .5], [2, .38], [3, .12]], upgradeBy: 'pier', opensWith: 'path'}
};

// Rewards each repair grants in this prototype.
const REWARDS = {
  roof: {maxEnergy: 10, text: '体力上限 +10'},
  fire: {text: '倒木堆产出更好的木料'},
  fence: {bag: 1, text: '背包 +1 格'},
  path: {text: '旧溪谷和河湾开放'},
  spring: {text: '泉眼产出更多的水'},
  trough: {coins: 20, text: '+20 金币'},
  stream: {text: '小溪流回营地'},
  cattail: {text: '芦苇岸长得更快'},
  reeds: {maxEnergy: 10, text: '体力上限 +10'},
  garden: {coins: 30, text: '+30 金币'},
  pier: {text: '木船产出更好的木条'},
  bridge: {text: '溪谷的残骸被冲走了'},
  shore: {maxEnergy: 10, text: '体力上限 +10'},
  jetty: {coins: 30, text: '+30 金币'},
  home: {bag: 1, text: '背包再 +1 格'},
  ferry: {text: '渡口重开'},
  feast: {text: '第一章完成'}
};
export const REPAIRS = CHAPTER.map(r => ({...r, reward: REWARDS[r.id]}));
export const repairById = id => REPAIRS.find(r => r.id === id);
export const spotOfRepair = r => SPOTS[r.spot];
// Repairs that recover a page of the grandmother's diary.
const DIARY_REPAIRS = {fire: 1, spring: 3, shore: 5, ferry: 7};

// Orders: residents' requests. They pay coins and refund part of the energy
// spent, but compete with repairs for the same items — that is the decision.
export const ORDERS = [
  {id: 'o1', who: 'lina', needs: [['wood', 2]], energy: 1, coins: 4, text: '想给小屋做个板凳。', after: ['roof']},
  {id: 'o2', who: 'mira', needs: [['wood', 3]], energy: 2, coins: 6, text: '工具箱的盖子也漏了。', after: ['roof']},
  {id: 'o3', who: 'lina', needs: [['wood', 1], ['wood', 2]], energy: 1, coins: 5, text: '给灯做个挂钩！', after: ['roof']},
  {id: 'o4', who: 'mira', needs: [['wood', 4]], energy: 3, coins: 10, text: '晾衣架被吹断了。', after: ['fire']},
  {id: 'o5', who: 'lina', needs: [['wood', 3]], energy: 2, coins: 6, text: '小书架！放外婆的手记。', after: ['fire'], diary: 2},
  {id: 'o6', who: 'mira', needs: [['wood', 2], ['wood', 3]], energy: 3, coins: 9, text: '再做一张小桌子。', after: ['path']},
  {id: 'o7', who: 'lina', needs: [['water', 2]], energy: 1, coins: 4, text: '我渴了……', after: ['path']},
  {id: 'o8', who: 'mira', needs: [['reed', 2]], energy: 1, coins: 4, text: '编个篮子装种子。', after: ['path']},
  {id: 'o9', who: 'lina', needs: [['dock', 2]], energy: 1, coins: 4, text: '在岸边做个小跳板？', after: ['path']},
  {id: 'o10', who: 'mira', needs: [['water', 3]], energy: 2, coins: 6, text: '烧一锅热水洗洗。', after: ['spring']},
  {id: 'o11', who: 'lina', needs: [['reed', 3], ['water', 2]], energy: 3, coins: 10, text: '给外婆的花箱浇水。', after: ['spring']},
  {id: 'o12', who: 'mira', needs: [['wood', 4]], energy: 3, coins: 10, text: '补一补栅栏。', after: ['fence']},
  {id: 'o13', who: 'lina', needs: [['dock', 3]], energy: 2, coins: 6, text: '钓鱼竿的架子！', after: ['reeds']},
  {id: 'o14', who: 'mira', needs: [['water', 4]], energy: 3, coins: 10, text: '储一缸水，以防万一。', after: ['trough']},
  {id: 'o15', who: 'rowan', needs: [['dock', 4]], energy: 3, coins: 12, text: '船上的跳板坏了，帮个忙？', after: ['pier'], diary: 4},
  {id: 'o16', who: 'rowan', needs: [['reed', 4]], energy: 3, coins: 12, text: '给船补一块草垫。', after: ['pier']},
  {id: 'o17', who: 'lina', needs: [['wood', 5]], energy: 5, coins: 18, text: '给罗恩叔叔搭个小棚！', after: ['jetty']},
  {id: 'o18', who: 'mira', needs: [['water', 3], ['reed', 3]], energy: 4, coins: 14, text: '泡一壶芦根茶。', after: ['shore'], diary: 6},
  {id: 'o19', who: 'rowan', needs: [['dock', 5]], energy: 5, coins: 20, text: '渡口要一块新踏板。', after: ['shore']},
  {id: 'o20', who: 'lina', needs: [['wood', 4], ['dock', 3]], energy: 5, coins: 16, text: '给邻居们做一排长凳！', after: ['ferry']}
];
export const ACTIVE_ORDERS = 3;

// Land: each region starts with a small clearing and grows by clearing the
// storm debris around it. Debris further out needs higher-level merges.
const ring = (c, center) => Math.max(Math.abs(c[0] - center[0]), Math.abs(c[1] - center[1]), Math.abs(c[0] - center[0] + c[1] - center[1]));
const OPEN = {
  camp: c => ring(c, [0, 0]) <= 1 || ['2,-1', '2,0', '0,2', '-2,2'].includes(key(...c)),
  creek: c => ['4,0', '5,0', '6,0', '7,0', '4,-1'].includes(key(...c)),
  river: c => ring(c, [10, -2]) <= 1
};
const DEBRIS = {camp: c => ring(c, [0, 0]) <= 2 ? 2 : 3, creek: () => 3, river: c => ring(c, [10, -2]) <= 2 ? 3 : 4};
export const STORM = new Map(Object.entries(AREA).flatMap(([region, cells]) => cells.filter(c => !OPEN[region](c)).map(c => [key(...c), {cell: c, region, level: DEBRIS[region](c)}])));
export const BASE = Object.fromEntries(Object.entries(AREA).map(([region, cells]) => [region, cells.filter(c => OPEN[region](c))]));
export const REGION_GATE = {camp: null, creek: 'path', river: 'path'};
export const regionOf = regionOfCell;
const hash = (q, r) => ((q * 73856093) ^ (r * 19349663)) >>> 0;

// Deterministic RNG stored in state (mulberry32).
function rand(state) { let t = (state.seed += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function roll(state, odds) { let x = rand(state); for (const [lv, p] of odds) { if ((x -= p) < 0) return lv; } return odds.at(-1)[0]; }

export function freshState(now = Date.now(), seed = 20261022) {
  const s = {version: VERSION, seed, energy: ENERGY.start, maxEnergy: ENERGY.max, energyAt: now, coins: 10, nextId: 1, bagSize: BAG_SIZE,
    items: [], bag: [], healed: [], blooms: [], done: [], orders: [], orderLog: [], freeAt: 0, diary: [0],
    discovered: {wood: 0, water: 0, reed: 0, dock: 0},
    stats: {taps: 0, merges: 0, orders: 0, repairs: 0, sells: 0, stored: 0, heals: 0, outOfEnergy: 0, boughtEnergy: 0, freeEnergy: 0, blocked: 0}};
  refillOrders(s);
  return s;
}

// ---------- board queries ----------
export const done = (s, id) => s.done.includes(id);
export const isOpen = (s, region) => !REGION_GATE[region] || done(s, REGION_GATE[region]);
export function isLand(s, cell) {
  const k = key(...cell), region = regionOfCell(cell);
  if (!AREA[region] || !isOpen(s, region) || isSpot(cell) || isCreek(cell)) return false;
  return BASE[region].some(c => key(...c) === k) || s.healed.includes(k);
}
export const itemAt = (s, cell) => s.items.find(i => i.cell && key(...i.cell) === key(...cell)) || null;
export const isFree = (s, cell) => isLand(s, cell) && !itemAt(s, cell);
export const landCells = s => Object.keys(AREA).filter(r => isOpen(s, r)).flatMap(r => [...BASE[r], ...AREA[r].filter(c => s.healed.includes(key(...c)))]);
export const stormCells = s => [...STORM.values()].filter(t => !s.healed.includes(key(...t.cell)) && isOpen(s, t.region));
export const freeCount = (s, region) => landCells(s).filter(c => (!region || regionOfCell(c) === region) && !itemAt(s, c)).length;
export const generatorOpen = (s, id) => !GENERATORS[id].opensWith || done(s, GENERATORS[id].opensWith);
export const generatorBetter = (s, id) => done(s, GENERATORS[id].upgradeBy);
export const generatorAt = cell => Object.entries(GENERATORS).find(([, g]) => key(...SPOTS[g.spot]) === key(...cell))?.[0] || null;
export const repairAvailable = (s, r) => !done(s, r.id) && r.after.every(id => done(s, id));
export const availableRepairs = s => REPAIRS.filter(r => repairAvailable(s, r));
// Nearest free land cell to a point, preferring the point's own region so a
// generator never drops into a neighbouring region on screen elsewhere.
export function nearestFreeTo(s, origin, region = regionOfCell(origin)) {
  if (isFree(s, origin)) return origin;
  const free = landCells(s).filter(c => !itemAt(s, c)), d = c => (Math.abs(c[0] - origin[0]) + Math.abs(c[1] - origin[1]) + Math.abs(c[0] + c[1] - origin[0] - origin[1])) / 2;
  const local = free.filter(c => regionOfCell(c) === region);
  return (local.length ? local : free).sort((a, b) => d(a) - d(b))[0] || null;
}

// Energy regenerates while the game is closed too.
function regen(holder, max, period, now) {
  if (holder.value >= max) { holder.at = now; return; }
  const gained = Math.floor((now - holder.at) / period);
  if (gained > 0) { holder.value = Math.min(max, holder.value + gained); holder.at = holder.value >= max ? now : holder.at + gained * period; }
}
export function tick(s, now = Date.now()) {
  const e = {value: s.energy, at: s.energyAt}; regen(e, s.maxEnergy, ENERGY.regenMs, now); s.energy = Math.max(s.energy, e.value); s.energyAt = e.at;
  return s;
}
export const nextEnergyIn = (s, now = Date.now()) => s.energy >= s.maxEnergy ? 0 : Math.max(0, ENERGY.regenMs - (now - s.energyAt));

const clone = s => structuredClone(s);
const fail = (state, message, extra = {}) => ({ok: false, state, message, events: [], ...extra});
const ok = (state, events) => ({ok: true, state, events});

function discover(s, chain, lv, events) {
  if (lv > s.discovered[chain]) {
    for (let l = s.discovered[chain] + 1; l <= lv; l++) events.push({type: 'discover', chain, level: l});
    s.discovered[chain] = lv; s.coins += lv >= 4 ? 3 : 1;
  }
}
function newItem(s, chain, lv, cell) { const item = {id: `i${s.nextId++}`, chain, level: lv, cell}; s.items.push(item); return item; }

export function tapGenerator(state, id, now = Date.now()) {
  const g = GENERATORS[id];
  if (!g || !generatorOpen(state, id)) return fail(state, '这里还没开放。');
  if (state.energy < 1) return fail(state, '体力用完了。', {needEnergy: true});
  const cell = nearestFreeTo(state, SPOTS[g.spot], g.region);
  if (!cell || regionOfCell(cell) !== g.region) return fail(state, `${({camp: '营地', creek: '溪谷', river: '河湾'})[g.region]}的空地满了。先合成，或把素材收进背包。`, {noSpace: true});
  const s = clone(state), lv = roll(s, generatorBetter(s, id) ? g.better : g.odds);
  if (s.energy >= s.maxEnergy) s.energyAt = now;
  s.energy -= 1; s.stats.taps++;
  const item = newItem(s, g.chain, lv, cell), events = [{type: 'spawn', generator: id, item: {...item}}];
  discover(s, g.chain, lv, events);
  if (s.energy === 0) { s.stats.outOfEnergy++; events.push({type: 'empty'}); }
  return ok(s, events);
}

// Merging heals adjacent storm tiles whose debris level is at most the new
// item's level, and leaves a patch of colour where it happened.
export function merge(state, aId, bId) {
  if (aId === bId) return fail(state, '选另一件。');
  const a = state.items.find(i => i.id === aId) || state.bag.find(i => i.id === aId), b = state.items.find(i => i.id === bId);
  if (!a || !b || !b.cell) return fail(state, '找不到这件素材。');
  if (a.chain !== b.chain || a.level !== b.level) return fail(state, '相同的两件才能合成。');
  if (a.level >= MAX_LEVEL) return fail(state, '已经是最高级了。');
  const s = clone(state), cell = b.cell, lv = a.level + 1;
  s.items = s.items.filter(i => i.id !== aId && i.id !== bId); s.bag = s.bag.filter(i => i.id !== aId);
  const item = newItem(s, a.chain, lv, cell), events = [{type: 'merge', from: [aId, bId], fromCell: a.cell, item: {...item}}];
  s.stats.merges++;
  const k = key(...cell); if (!s.blooms.includes(k)) { s.blooms.push(k); events.push({type: 'bloom', cell}); }
  discover(s, a.chain, lv, events);
  for (const n of neighbors(...cell)) heal(s, n, lv, events);
  return ok(s, events);
}
function heal(s, n, lv, events) {
  const tile = STORM.get(key(...n));
  if (!tile || s.healed.includes(key(...n)) || !isOpen(s, tile.region) || lv < tile.level) return;
  s.healed.push(key(...n)); s.stats.heals++;
  const event = {type: 'heal', cell: n, level: tile.level}, h = hash(...n) % 6;
  if (h === 0) { event.bonus = {energy: 3}; s.energy += 3; }
  else if (h === 1) { const chain = tile.region === 'camp' ? 'wood' : ['water', 'reed', 'dock'][hash(n[1], n[0]) % 3]; const bonus = newItem(s, chain, 1 + hash(n[0] + 5, n[1]) % 2, n); event.bonus = {item: {...bonus}}; discover(s, chain, bonus.level, events); }
  else if (h === 2) { event.bonus = {coins: 5}; s.coins += 5; }
  events.push(event);
}

export function move(state, id, cell) {
  const s = clone(state), item = s.items.find(i => i.id === id) || s.bag.find(i => i.id === id);
  if (!item) return fail(state, '找不到这件素材。');
  if (!isLand(s, cell)) return fail(state, '这里不能放。');
  const other = itemAt(s, cell);
  if (other && other.id === id) return ok(s, []);
  if (other) {
    if (!item.cell) return fail(state, '那里已经有东西了。');
    other.cell = item.cell; item.cell = cell;
    return ok(s, [{type: 'swap', a: id, b: other.id}]);
  }
  const fromBag = !item.cell;
  if (fromBag) { s.bag = s.bag.filter(i => i.id !== id); item.cell = cell; s.items.push(item); }
  else item.cell = cell;
  return ok(s, [{type: fromBag ? 'unbag' : 'move', id}]);
}
export function store(state, id) {
  if (state.bag.length >= state.bagSize) return fail(state, `背包 ${state.bagSize} 格已满。`);
  const s = clone(state), item = s.items.find(i => i.id === id);
  if (!item) return fail(state, '找不到这件素材。');
  s.items = s.items.filter(i => i.id !== id); item.cell = null; s.bag.push(item); s.stats.stored++;
  return ok(s, [{type: 'store', id}]);
}
export function unbag(state, id, near) {
  const cell = nearestFreeTo(state, near);
  if (!cell) return fail(state, '地图上没有空地了。');
  return move(state, id, cell);
}
export const sellPrice = lv => lv <= 2 ? lv : 2 ** (lv - 2) + 1;
export function sell(state, id) {
  const s = clone(state), item = s.items.find(i => i.id === id) || s.bag.find(i => i.id === id);
  if (!item) return fail(state, '找不到这件素材。');
  s.items = s.items.filter(i => i.id !== id); s.bag = s.bag.filter(i => i.id !== id);
  s.coins += sellPrice(item.level); s.stats.sells++;
  return ok(s, [{type: 'sell', id, coins: sellPrice(item.level), cell: item.cell}]);
}

// Repairs take the exact component; the site's art and generators change.
export function install(state, id, repairId) {
  const repair = repairById(repairId);
  if (!repair || !repairAvailable(state, repair)) return fail(state, '这里还不能修。');
  const item = state.items.find(i => i.id === id) || state.bag.find(i => i.id === id);
  if (!item || item.chain !== repair.chain || item.level !== repair.level) return fail(state, `需要 L${repair.level} 的组件。`);
  const s = clone(state), events = [{type: 'install', repair: repair.id, item: {...item}}];
  s.items = s.items.filter(i => i.id !== id); s.bag = s.bag.filter(i => i.id !== id);
  s.done.push(repair.id); s.stats.repairs++;
  const r = repair.reward || {};
  if (r.maxEnergy) { s.maxEnergy += r.maxEnergy; s.energy += r.maxEnergy; }
  if (r.bag) s.bagSize += r.bag;
  if (r.coins) s.coins += r.coins;
  if (repair.opens) events.push({type: 'open', regions: repair.opens});
  // The bridge washes away the creek valley's remaining debris.
  if (repair.id === 'bridge') for (const [k, t] of STORM) if (t.region === 'creek' && !s.healed.includes(k)) { s.healed.push(k); events.push({type: 'heal', cell: t.cell, level: t.level, wash: true}); }
  const page = DIARY_REPAIRS[repair.id];
  if (page !== undefined && !s.diary.includes(page)) { s.diary.push(page); events.push({type: 'diary', page}); }
  if (repair.letter) events.push({type: 'letter'});
  if (repair.finale) events.push({type: 'finale'});
  refillOrders(s, events);
  return ok(s, events);
}

export const orderNeeds = order => ORDERS.find(o => o.id === order.id).needs;
// Picks concrete items for an order, preferring the bag, then the board.
export function pickForOrder(s, order) {
  const used = new Set(), picks = [];
  for (const [chain, lv] of orderNeeds(order)) {
    const pool = [...s.bag, ...s.items].filter(i => !used.has(i.id) && i.chain === chain && i.level === lv);
    if (!pool.length) return null;
    used.add(pool[0].id); picks.push(pool[0].id);
  }
  return picks;
}
export function deliver(state, orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return fail(state, '这个请求已经完成了。');
  const picks = pickForOrder(state, order);
  if (!picks) return fail(state, '还差一些素材。');
  const s = clone(state), template = ORDERS.find(o => o.id === orderId);
  const consumed = picks.map(id => ({...(s.items.find(i => i.id === id) || s.bag.find(i => i.id === id))}));
  s.items = s.items.filter(i => !picks.includes(i.id)); s.bag = s.bag.filter(i => !picks.includes(i.id));
  s.energy += template.energy; s.coins += template.coins; s.stats.orders++;
  s.orders = s.orders.filter(o => o.id !== orderId); s.orderLog.push(orderId);
  const events = [{type: 'deliver', order: orderId, consumed, energy: template.energy, coins: template.coins}];
  if (template.diary && !s.diary.includes(template.diary)) { s.diary.push(template.diary); events.push({type: 'diary', page: template.diary}); }
  refillOrders(s, events);
  return ok(s, events);
}
function refillOrders(s, events = []) {
  for (const t of ORDERS) {
    if (s.orders.length >= ACTIVE_ORDERS) break;
    if (s.orderLog.includes(t.id) || s.orders.some(o => o.id === t.id)) continue;
    if ((t.after || []).every(id => s.done.includes(id))) { s.orders.push({id: t.id}); events.push({type: 'order', order: t.id}); }
  }
}

// Coins buy energy. The free refill stands in for a rewarded ad and has a cooldown.
export const freeRefillIn = (s, now = Date.now()) => Math.max(0, (s.freeAt || 0) - now);
export function buyEnergy(state, {free = false, now = Date.now()} = {}) {
  if (free && freeRefillIn(state, now) > 0) return fail(state, '免费补给还在准备中。');
  if (!free && state.coins < ENERGY.refillCost) return fail(state, `需要 ${ENERGY.refillCost} 金币。`);
  const s = clone(state), amount = free ? ENERGY.freeRefill : ENERGY.refillAmount;
  if (free) { s.freeAt = now + ENERGY.freeCooldownMs; s.stats.freeEnergy++; } else { s.coins -= ENERGY.refillCost; s.stats.boughtEnergy++; }
  s.energy += amount;
  return ok(s, [{type: 'energy', amount, free}]);
}

// The board is stuck when nothing can merge, install or be delivered and no
// generator has space to drop into.
export function isStuck(s) {
  if (freeCount(s) > 0) return false;
  const pool = [...s.items, ...s.bag];
  if (pool.some((a, i) => pool.some((b, j) => j > i && a.chain === b.chain && a.level === b.level && a.level < MAX_LEVEL))) return false;
  if (availableRepairs(s).some(r => pool.some(i => i.chain === r.chain && i.level === r.level))) return false;
  return !s.orders.some(o => pickForOrder(s, o));
}

// What the player should do next — used for the hint button and the hand.
export function suggestion(s) {
  const repairs = availableRepairs(s);
  for (const r of repairs) { const it = [...s.items, ...s.bag].find(i => i.chain === r.chain && i.level === r.level); if (it) return {type: 'install', item: it.id, repair: r.id}; }
  for (const o of s.orders) if (pickForOrder(s, o)) return {type: 'deliver', order: o.id};
  const pool = [...s.items, ...s.bag].filter(i => i.level < MAX_LEVEL);
  const wanted = new Set([...repairs.map(r => r.chain), ...s.orders.flatMap(o => orderNeeds(o).map(n => n[0]))]);
  const pairs = [];
  for (let x = 0; x < pool.length; x++) for (let y = x + 1; y < pool.length; y++) {
    const a = pool[x], b = pool[y];
    if (a.chain === b.chain && a.level === b.level && (a.cell || b.cell)) pairs.push(b.cell ? [a, b] : [b, a]);
  }
  pairs.sort((p, q) => Number(wanted.has(q[0].chain)) - Number(wanted.has(p[0].chain)) || p[0].level - q[0].level);
  if (pairs.length) return {type: 'merge', a: pairs[0][0].id, b: pairs[0][1].id};
  if (freeCount(s) === 0) {
    const low = [...s.items].sort((a, b) => a.level - b.level)[0];
    if (low) return s.bag.length < s.bagSize ? {type: 'store', item: low.id} : {type: 'sell', item: low.id};
  }
  const gens = Object.keys(GENERATORS).filter(id => generatorOpen(s, id));
  const chains = [...repairs.map(r => r.chain), ...s.orders.flatMap(o => orderNeeds(o).map(n => n[0])), 'wood', 'water', 'reed', 'dock'];
  const gen = chains.map(c => gens.find(id => GENERATORS[id].chain === c)).find(Boolean);
  return gen ? {type: 'tap', generator: gen} : {type: 'wait'};
}

export function validate(s) {
  if (!s || s.version !== VERSION || !Array.isArray(s.items) || !Array.isArray(s.bag) || s.bag.length > s.bagSize) return false;
  const seen = new Set();
  for (const i of s.items) { if (!i.cell || !isLand(s, i.cell)) return false; const k = key(...i.cell); if (seen.has(k)) return false; seen.add(k); }
  return [...s.items, ...s.bag].every(i => i.level >= 1 && i.level <= MAX_LEVEL && i.chain in s.discovered);
}
export {parseKey, SPOT_REGION};
