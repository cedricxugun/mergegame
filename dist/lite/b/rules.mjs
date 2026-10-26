// Pure merge-2 rules for prototype B ("纯合成版"). No DOM. Every action
// returns {ok, state, events} on a cloned state, so the UI can animate
// events and tests can replay whole sessions deterministically.
import {key, parseKey, neighbors, disk, ring, distance, nearestFirst} from '../shared/hex.mjs';
import {nameOf, value, MAX_LEVEL} from '../shared/art.mjs';

export const VERSION = 1;
export const BAG_SIZE = 4;
// Demo pacing: regeneration is ~10x faster than a live game would use, so a
// 15–20 minute session still meets one energy wall and one board-space squeeze.
export const ENERGY = {start: 40, max: 40, regenMs: 30000, refillCost: 15, refillAmount: 25, freeRefill: 20, freeCooldownMs: 180000};

// Generators and repair sites occupy one hex each.
export const SITES = {
  shelter: [0, -2], hearth: [-1, 0], path: [3, -2], logs: [1, 1],
  spring: [6, -3], reeds: [8, -6], dock: [10, -4]
};
export const GENERATORS = {
  logs: {chain: 'wood', name: '倒木堆', art: 'env-log', odds: [[1, .8], [2, .2]], better: [[1, .55], [2, .35], [3, .1]], upgradeBy: 'fire'},
  spring: {chain: 'water', name: '石缝泉眼', art: 'ruin-spring', fixedArt: 'scene-spring', odds: [[1, .85], [2, .15]], better: [[1, .55], [2, .35], [3, .1]], upgradeBy: 'spring', opensWith: 'path'},
  reeds: {chain: 'reed', name: '倒伏的芦苇', art: 'ruin-reeds', fixedArt: 'scene-reeds', odds: [[1, .85], [2, .15]], better: [[1, .55], [2, .35], [3, .1]], upgradeBy: 'reeds', opensWith: 'path'},
  dock: {chain: 'dock', name: '断开的栈桥', art: 'ruin-dock', fixedArt: 'scene-pier', odds: [[1, .85], [2, .15]], better: [[1, .55], [2, .35], [3, .1]], upgradeBy: 'pier', opensWith: 'path'}
};
export const REPAIRS = [
  {id: 'roof', site: 'shelter', chain: 'wood', level: 3, title: '补好漏雨的棚顶', ruin: 'ruin-shelter', art: 'scene-roof', after: [], reveal: 2.6, reward: {maxEnergy: 10}, rewardText: '体力上限 +10',
    lines: [['lina', '雨都落在外面了！今晚可以好好睡一觉。'], ['mira', '屋檐挡住了雨。接下来生火，或者先清开去河湾的路。']]},
  {id: 'fire', site: 'hearth', chain: 'wood', level: 4, title: '搭起炉架，生一堆火', ruin: 'ruin-hearth', art: 'scene-fire', after: ['roof'], reveal: 2.6, reward: {upgrade: 'logs'}, rewardText: '倒木堆产出更好的木料',
    lines: [['mira', '火生起来了。湿木头烤干，劈出来的木料也更结实。'], ['lina', '我把灯朝着河的方向摆，罗恩叔叔也能看见。']]},
  {id: 'path', site: 'path', chain: 'wood', level: 5, title: '撑起倒木，接通旧路', ruin: 'ruin-path', art: 'scene-path', after: ['roof'], reveal: 3.2, reward: {open: 'river'}, rewardText: '去河湾的路通了',
    lines: [['lina', '路通了！河湾那边有水声。'], ['mira', '泉眼、芦苇和栈桥都被风暴弄坏了。我们一样一样修。']]},
  {id: 'spring', site: 'spring', chain: 'water', level: 4, title: '疏通石缝里的泉眼', ruin: 'ruin-spring', art: 'scene-spring', after: ['path'], reveal: 2.8, reward: {upgrade: 'spring'}, rewardText: '泉眼产出更多的水',
    lines: [['lina', '水冒出来了！冰冰凉凉的。'], ['mira', '有了干净的水，营地就真的能住人了。']]},
  {id: 'reeds', site: 'reeds', chain: 'reed', level: 4, title: '给松动的河岸种回芦苇', ruin: 'ruin-reeds', art: 'scene-reeds', after: ['path'], reveal: 2.8, reward: {upgrade: 'reeds'}, rewardText: '芦苇丛长得更快',
    lines: [['lina', '河岸不再往下塌了。看，有白鹭！'], ['mira', '根扎稳了，栈桥的桩子也就有地方立了。']]},
  {id: 'pier', site: 'dock', chain: 'dock', level: 5, title: '接上断开的栈桥', ruin: 'ruin-dock', art: 'scene-pier', after: ['reeds'], reveal: 3.2, reward: {upgrade: 'dock', finale: true}, rewardText: '罗恩的船能靠岸了',
    lines: [['rowan', '米拉！我看见营地的灯了。大家一直在等渡口修好。'], ['rowan', '船上有种子、工具，还有你母亲寄回来的信。'], ['mira', '……信上说，山坡的信号灯也坏了。']]},
  {id: 'home', site: 'shelter', chain: 'wood', level: 6, title: '把棚子修成木屋', ruin: null, art: 'scene-home', after: ['fire', 'path'], reveal: 3.4, reward: {maxEnergy: 10}, rewardText: '体力上限再 +10',
    lines: [['lina', '床、屋顶，还有门口的灯！这里可以叫作家了吗？'], ['mira', '可以。回来的邻居也有地方歇脚了。']]}
];
export const repairById = id => REPAIRS.find(r => r.id === id);

// Orders: residents' requests. They pay coins and refund part of the energy
// spent, but compete with repairs for the same items — that is the decision.
export const ORDERS = [
  {id: 'o1', who: 'lina', needs: [['wood', 2]], energy: 1, coins: 4, text: '想给小屋做个板凳。', after: ['roof']},
  {id: 'o2', who: 'mira', needs: [['wood', 3]], energy: 2, coins: 6, text: '工具箱的盖子也漏了。', after: ['roof']},
  {id: 'o3', who: 'lina', needs: [['wood', 1], ['wood', 2]], energy: 1, coins: 5, text: '给灯做个挂钩！', after: ['roof']},
  {id: 'o4', who: 'mira', needs: [['wood', 4]], energy: 3, coins: 10, text: '晾衣架被吹断了。', after: ['fire']},
  {id: 'o5', who: 'lina', needs: [['wood', 3]], energy: 2, coins: 6, text: '小书架！放外婆的手记。', after: ['fire']},
  {id: 'o6', who: 'mira', needs: [['wood', 2], ['wood', 3]], energy: 3, coins: 9, text: '再做一张小桌子。', after: ['path']},
  {id: 'o7', who: 'lina', needs: [['water', 2]], energy: 1, coins: 4, text: '我渴了……', after: ['path']},
  {id: 'o8', who: 'mira', needs: [['reed', 2]], energy: 1, coins: 4, text: '编个篮子装种子。', after: ['path']},
  {id: 'o9', who: 'lina', needs: [['dock', 2]], energy: 1, coins: 4, text: '在岸边做个小跳板？', after: ['path']},
  {id: 'o10', who: 'mira', needs: [['water', 3]], energy: 2, coins: 6, text: '烧一锅热水洗洗。', after: ['spring']},
  {id: 'o11', who: 'lina', needs: [['reed', 3], ['water', 2]], energy: 3, coins: 10, text: '给外婆的花箱浇水。', after: ['spring']},
  {id: 'o12', who: 'mira', needs: [['wood', 4]], energy: 3, coins: 10, text: '补一补栅栏。', after: ['spring']},
  {id: 'o13', who: 'lina', needs: [['dock', 3]], energy: 2, coins: 6, text: '钓鱼台！', after: ['reeds']},
  {id: 'o14', who: 'mira', needs: [['water', 4]], energy: 3, coins: 10, text: '储一缸水，以防万一。', after: ['reeds']},
  {id: 'o15', who: 'rowan', needs: [['dock', 4]], energy: 3, coins: 12, text: '船上的跳板坏了，帮个忙？', after: ['pier']},
  {id: 'o16', who: 'lina', needs: [['wood', 5]], energy: 5, coins: 20, text: '给罗恩叔叔搭个小棚！', after: ['pier']}
];
export const ACTIVE_ORDERS = 3;

// Land: the camp clearing, a ring of storm debris, the old road and the river bend.
const CAMP = disk([0, 0], 2);
// The clearing starts small: the centre, the inner ring and the cells by the
// log pile. Everything else is storm debris cleared by merging next to it.
const CAMP_OPEN = [...disk([0, 0], 1), [2, 0], [2, -1], [0, 2]];
const CAMP_INNER = CAMP.filter(c => !CAMP_OPEN.some(o => key(...o) === key(...c)));
const CAMP_STORM = ring([0, 0], 3).filter(c => key(...c) !== key(...SITES.path));
const CORRIDOR = [[4, -3], [5, -3]];
const RIVER = disk([8, -4], 2);
const RIVER_STORM = ring([8, -4], 3).filter(([q, r]) => r >= -7 && !(q >= 11 && r <= -5) && q <= 11);
const SITE_KEYS = new Set(Object.values(SITES).map(c => key(...c)));
const hash = (q, r) => ((q * 73856093) ^ (r * 19349663)) >>> 0;

export const STORM = new Map([
  ...CAMP_INNER.filter(c => !Object.values(SITES).some(t => key(...t) === key(...c))).map(c => [key(...c), {cell: c, region: 'camp', level: 2}]),
  ...CAMP_STORM.map(c => [key(...c), {cell: c, region: 'camp', level: 3}]),
  ...RIVER_STORM.map(c => [key(...c), {cell: c, region: 'river', level: 3 + hash(...c) % 2}])
]);
export const BASE = {camp: CAMP_OPEN.filter(c => !SITE_KEYS.has(key(...c))), river: [...RIVER.filter(c => !SITE_KEYS.has(key(...c))), ...CORRIDOR]};
export const REGION_CELLS = {camp: [...CAMP, ...CAMP_STORM, SITES.path], river: [...RIVER, ...RIVER_STORM, ...CORRIDOR]};
export const regionOf = cell => REGION_CELLS.river.some(c => key(...c) === key(...cell)) ? 'river' : 'camp';

// Deterministic RNG stored in state (mulberry32).
function rand(state) { let t = (state.seed += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function roll(state, odds) { let x = rand(state); for (const [level, p] of odds) { if ((x -= p) < 0) return level; } return odds.at(-1)[0]; }

export function freshState(now = Date.now(), seed = 20261022) {
  const s = {version: VERSION, seed, energy: ENERGY.start, maxEnergy: ENERGY.max, energyAt: now, coins: 10, nextId: 1,
    items: [], bag: [], healed: [], blooms: [], done: [], regions: ['camp'], orders: [], orderLog: [], freeAt: 0,
    discovered: {wood: 0, water: 0, reed: 0, dock: 0}, tutorial: 0,
    stats: {taps: 0, merges: 0, orders: 0, repairs: 0, sells: 0, stored: 0, heals: 0, outOfEnergy: 0, boughtEnergy: 0, freeEnergy: 0, blocked: 0}};
  refillOrders(s);
  return s;
}

// Board queries
export const done = (s, id) => s.done.includes(id);
export const isOpen = (s, region) => s.regions.includes(region);
export const isLand = (s, cell) => { const k = key(...cell); return BASE.camp.some(c => key(...c) === k) || isOpen(s, 'river') && BASE.river.some(c => key(...c) === k) || s.healed.includes(k); };
export const isSite = cell => SITE_KEYS.has(key(...cell));
export const siteAt = cell => Object.entries(SITES).find(([, c]) => key(...c) === key(...cell))?.[0] || null;
export const itemAt = (s, cell) => s.items.find(i => i.cell && key(...i.cell) === key(...cell)) || null;
export const isFree = (s, cell) => isLand(s, cell) && !itemAt(s, cell);
export function landCells(s) {
  const out = [...BASE.camp];
  if (isOpen(s, 'river')) out.push(...BASE.river);
  for (const k of s.healed) out.push(parseKey(k));
  return out;
}
export const stormCells = s => [...STORM.values()].filter(t => !s.healed.includes(key(...t.cell)) && isOpen(s, t.region));
export const fogged = (s, region) => !isOpen(s, region);
export const freeCount = s => landCells(s).filter(c => !itemAt(s, c)).length;
export function generatorOpen(s, id) { const g = GENERATORS[id]; return !g.opensWith || done(s, g.opensWith); }
export const generatorBetter = (s, id) => done(s, GENERATORS[id].upgradeBy);
export const generatorArt = (s, id) => (GENERATORS[id].fixedArt && generatorBetter(s, id)) ? GENERATORS[id].fixedArt : GENERATORS[id].art;
export const repairAvailable = (s, r) => !done(s, r.id) && r.after.every(id => done(s, id));
export const availableRepairs = s => REPAIRS.filter(r => repairAvailable(s, r));
export function nearestFreeTo(s, origin) {
  if (isFree(s, origin)) return origin;
  return nearestFirst(origin, c => isFree(s, c), c => isLand(s, c) || isSite(c), 1)[0] || null;
}

// Energy regenerates while the game is closed too.
export function tick(state, now = Date.now()) {
  const s = state;
  if (s.energy >= s.maxEnergy) { s.energyAt = now; return s; }
  const gained = Math.floor((now - s.energyAt) / ENERGY.regenMs);
  if (gained > 0) { s.energy = Math.min(s.maxEnergy, s.energy + gained); s.energyAt = s.energy >= s.maxEnergy ? now : s.energyAt + gained * ENERGY.regenMs; }
  return s;
}
export const nextEnergyIn = (s, now = Date.now()) => s.energy >= s.maxEnergy ? 0 : Math.max(0, ENERGY.regenMs - (now - s.energyAt));

const clone = s => structuredClone(s);
const fail = (state, message, extra = {}) => ({ok: false, state, message, events: [], ...extra});
const ok = (state, events) => ({ok: true, state, events});

function discover(s, chain, level, events) {
  if (level > s.discovered[chain]) {
    for (let l = s.discovered[chain] + 1; l <= level; l++) events.push({type: 'discover', chain, level: l});
    s.discovered[chain] = level; s.coins += 1;
  }
}
function newItem(s, chain, level, cell) { const item = {id: `i${s.nextId++}`, chain, level, cell}; s.items.push(item); return item; }

export function tapGenerator(state, id, now = Date.now()) {
  const g = GENERATORS[id];
  if (!g || !generatorOpen(state, id)) return fail(state, '这里还没开放。');
  if (state.energy < 1) return fail(state, '体力用完了。', {needEnergy: true});
  const cell = nearestFreeTo(state, SITES[id]);
  if (!cell) return fail(state, '周围没有空地了。先合成，或把素材放进背包。', {noSpace: true});
  const s = clone(state), level = roll(s, generatorBetter(s, id) ? g.better : g.odds);
  // Regeneration starts counting from the moment energy drops below the cap.
  if (s.energy >= s.maxEnergy) s.energyAt = now;
  s.energy -= 1; s.stats.taps++;
  const item = newItem(s, g.chain, level, cell), events = [{type: 'spawn', generator: id, item: {...item}}];
  discover(s, g.chain, level, events);
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
  const s = clone(state), cell = b.cell, level = a.level + 1;
  s.items = s.items.filter(i => i.id !== aId && i.id !== bId); s.bag = s.bag.filter(i => i.id !== aId);
  const item = newItem(s, a.chain, level, cell), events = [{type: 'merge', from: [aId, bId], item: {...item}}];
  s.stats.merges++;
  const k = key(...cell); if (!s.blooms.includes(k)) { s.blooms.push(k); events.push({type: 'bloom', cell}); }
  discover(s, a.chain, level, events);
  for (const n of neighbors(...cell)) {
    const tile = STORM.get(key(...n));
    if (!tile || s.healed.includes(key(...n)) || !isOpen(s, tile.region) || level < tile.level) continue;
    s.healed.push(key(...n)); s.stats.heals++;
    const event = {type: 'heal', cell: n, level: tile.level};
    const h = hash(...n) % 5;
    if (h === 0) { event.bonus = {energy: 3}; s.energy += 3; }
    else if (h === 1) { const chain = tile.region === 'camp' ? 'wood' : ['water', 'reed', 'dock'][hash(n[1], n[0]) % 3]; const bonus = newItem(s, chain, 1 + hash(n[0] + 5, n[1]) % 2, n); event.bonus = {item: {...bonus}}; discover(s, chain, bonus.level, events); }
    events.push(event);
  }
  return ok(s, events);
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
  if (state.bag.length >= BAG_SIZE) return fail(state, `背包 ${BAG_SIZE} 格已满。`);
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
export const sellPrice = level => level;
export function sell(state, id) {
  const s = clone(state), item = s.items.find(i => i.id === id) || s.bag.find(i => i.id === id);
  if (!item) return fail(state, '找不到这件素材。');
  s.items = s.items.filter(i => i.id !== id); s.bag = s.bag.filter(i => i.id !== id);
  s.coins += sellPrice(item.level); s.stats.sells++;
  return ok(s, [{type: 'sell', id, coins: sellPrice(item.level)}]);
}

// Repairs take the exact component; the site's art and generators change.
export function install(state, id, repairId) {
  const repair = repairById(repairId);
  if (!repair || !repairAvailable(state, repair)) return fail(state, '这里还不能修。');
  const item = state.items.find(i => i.id === id) || state.bag.find(i => i.id === id);
  if (!item || item.chain !== repair.chain || item.level !== repair.level) return fail(state, `需要 ${nameOf(repair.chain, repair.level)}（L${repair.level}）。`);
  const s = clone(state), events = [{type: 'install', repair: repair.id, item: {...item}}];
  s.items = s.items.filter(i => i.id !== id); s.bag = s.bag.filter(i => i.id !== id);
  s.done.push(repair.id); s.stats.repairs++;
  const r = repair.reward;
  if (r.maxEnergy) { s.maxEnergy += r.maxEnergy; s.energy += r.maxEnergy; }
  if (r.open && !s.regions.includes(r.open)) { s.regions.push(r.open); events.push({type: 'open', region: r.open}); }
  if (r.finale) events.push({type: 'finale'});
  refillOrders(s, events);
  return ok(s, events);
}

export const orderNeeds = order => ORDERS.find(o => o.id === order.id).needs;
// Picks concrete items for an order, preferring items in the bag, then the
// ones farthest from generators (least useful on the board).
export function pickForOrder(s, order) {
  const used = new Set(), picks = [];
  for (const [chain, level] of orderNeeds(order)) {
    const pool = [...s.bag, ...s.items].filter(i => !used.has(i.id) && i.chain === chain && i.level === level);
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

// What the player should do next — used for the hint button and hand.
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
  const gens = Object.keys(GENERATORS).filter(id => generatorOpen(s, id));
  const chain = repairs[0]?.chain || 'wood', gen = gens.find(id => GENERATORS[id].chain === chain) || gens[0];
  return {type: 'tap', generator: gen};
}

export function validate(s) {
  if (!s || s.version !== VERSION || !Array.isArray(s.items) || !Array.isArray(s.bag) || s.bag.length > BAG_SIZE) return false;
  const seen = new Set();
  for (const i of s.items) { if (!i.cell || !isLand(s, i.cell)) return false; const k = key(...i.cell); if (seen.has(k)) return false; seen.add(k); }
  return [...s.items, ...s.bag].every(i => i.level >= 1 && i.level <= MAX_LEVEL && i.chain in s.discovered);
}
export {value};
