// Prototype A · 三消驱动的轻合成. Match-3 levels are the main loop; each
// win drops a supply crate that is tapped open on a small merge board. The
// merge layer keeps the fun parts (anticipation, chain merges, discoveries,
// tangible repairs) and drops the chores (energy, inventory, generators).
// Pure functions, no DOM.
import {key, neighbors, disk} from '../shared/hex.mjs';
import {nameOf, MAX_LEVEL} from '../shared/art.mjs';

export const VERSION = 1;
export const MATCH_LEVELS = 20;

// Board pieces are thematic: what each colour sends home to the camp.
export const PIECES = [
  {id: 'leaf', name: '叶子', chain: 'reed', color: '#5cc24a'},
  {id: 'drop', name: '水滴', chain: 'water', color: '#45a8e6'},
  {id: 'berry', name: '浆果', chain: null, color: '#e8504a'},
  {id: 'sun', name: '星星', chain: null, color: '#f6c33a'},
  {id: 'flower', name: '花朵', chain: 'dock', color: '#a96ee0'}
];
// The "wood" chain is fed by crates: every crate cleared on the board is a
// plank sent home. Colours map to the other chains; berries and stars pay
// stars (the meta currency).

// One small board: the camp clearing, plus the river bend once the path is done.
export const SITES = {shelter: [0, -2], hearth: [-1, 0], path: [3, -2], spring: [6, -3], reeds: [8, -6], dock: [10, -5]};
const CAMP = disk([0, 0], 2).filter(c => !Object.values(SITES).some(s => key(...s) === key(...c)));
const RIVER = [...disk([8, -4], 2), [4, -3], [5, -3]].filter(c => !Object.values(SITES).some(s => key(...s) === key(...c)));
export const BOARD = {camp: CAMP, river: RIVER};

// Repairs map to match-3 level gates: the level after a repair shows the new
// thing. Each target is reachable from ~2 levels of crate drops.
export const REPAIRS = [
  {id: 'roof', site: 'shelter', chain: 'wood', level: 3, title: '补好漏雨的棚顶', ruin: 'ruin-shelter', art: 'scene-roof', after: [], reveal: 2.6, unlocks: '营地有了落脚的地方',
    lines: [['lina', '雨都落在外面了！'], ['mira', '今晚能睡个好觉。明天去把炉子生起来。']]},
  {id: 'fire', site: 'hearth', chain: 'wood', level: 4, title: '搭起炉架，生一堆火', ruin: 'ruin-hearth', art: 'scene-fire', after: ['roof'], reveal: 2.6, unlocks: '解锁关前道具：火箭',
    lines: [['mira', '火生起来了。'], ['lina', '我把灯朝着河的方向摆，罗恩叔叔也能看见。']]},
  {id: 'path', site: 'path', chain: 'wood', level: 5, title: '撑起倒木，接通旧路', ruin: 'ruin-path', art: 'scene-path', after: ['fire'], reveal: 3.2, unlocks: '河湾开放：叶子和水滴也会带回材料',
    lines: [['lina', '路通了！河湾那边有水声。'], ['mira', '泉眼、芦苇和栈桥……我们一样一样修。']]},
  {id: 'spring', site: 'spring', chain: 'water', level: 4, title: '疏通石缝里的泉眼', ruin: 'ruin-spring', art: 'scene-spring', after: ['path'], reveal: 2.8, unlocks: '解锁关前道具：炸弹',
    lines: [['lina', '水冒出来了！冰冰凉凉的。'], ['mira', '有了干净的水，营地就能住人了。']]},
  {id: 'reeds', site: 'reeds', chain: 'reed', level: 4, title: '给河岸种回芦苇', ruin: 'ruin-reeds', art: 'scene-reeds', after: ['path'], reveal: 2.8, unlocks: '每关多 2 步',
    lines: [['lina', '看，有白鹭！'], ['mira', '根扎稳了，栈桥的桩子也有地方立了。']]},
  {id: 'stream', site: 'spring', chain: 'water', level: 5, title: '让小溪流回营地', ruin: null, art: 'scene-stream', after: ['spring'], reveal: 3.6, unlocks: '营地边的小溪活过来了', creek: true,
    lines: [['lina', '我刚跑回去看了！花箱旁边也能听见水声。'], ['mira', '这条水路把两处连起来了。']]},
  {id: 'pier', site: 'dock', chain: 'dock', level: 5, title: '接上断开的栈桥', ruin: 'ruin-dock', art: 'scene-pier', after: ['reeds'], reveal: 3.2, unlocks: '解锁关前道具：彩球', finale: true,
    lines: [['rowan', '米拉！我看见营地的灯了。'], ['rowan', '船上有你母亲寄回来的信。'], ['mira', '……山坡的信号灯，也坏了。']]},
  {id: 'home', site: 'shelter', chain: 'wood', level: 6, title: '把棚子修成木屋', ruin: null, art: 'scene-home', after: ['fire', 'path'], reveal: 3.4, unlocks: '营地变成了家',
    lines: [['lina', '床、屋顶，还有门口的灯！'], ['mira', '回来的邻居也有地方歇脚了。']]}
];
export const repairById = id => REPAIRS.find(r => r.id === id);
export const done = (s, id) => s.done.includes(id);
export const repairAvailable = (s, r) => !done(s, r.id) && r.after.every(id => done(s, id));
export const availableRepairs = s => REPAIRS.filter(r => repairAvailable(s, r));

// Boosters unlocked by repairs; each one is a pre-level pick that costs stars.
export const BOOSTERS = {
  rocket: {name: '火箭', after: 'fire', cost: 6, art: 'rocket'},
  bomb: {name: '炸弹', after: 'spring', cost: 8, art: 'tnt'},
  orb: {name: '彩球', after: 'pier', cost: 12, art: 'orb'}
};
export const boosterUnlocked = (s, id) => done(s, BOOSTERS[id].after);
export const extraMoves = s => done(s, 'reeds') ? 2 : 0;

export function freshState(seed = 20261022) {
  return {version: VERSION, seed, level: 1, stars: 0, done: [], items: [], crates: [], nextId: 1, discovered: {wood: 0, water: 0, reed: 0, dock: 0},
    match: null, stats: {wins: 0, losses: 0, retries: 0, merges: 0, crates: 0, opened: 0, repairs: 0, boosters: 0, chainMerges: 0}};
}

// ---------- crates ----------
// A win converts what the player cleared into one crate of materials.
// Pieces cleared are counted per colour; crates cleared count as wood.
export function crateFromRun(s, run) {
  const items = [], river = done(s, 'path');
  const pending = availableRepairs(s), wants = chain => pending.some(r => r.chain === chain);
  // Crates on the board are planks: camp wood first, river dock planks once
  // the path is open (wood still drops while the cabin is unfinished).
  const planks = Math.min(4, 2 + Math.floor((run.cratesCleared || 0) / 8));
  for (let i = 0; i < planks; i++) items.push({chain: river && (!wants('wood') || i % 2) ? 'dock' : 'wood', level: 1});
  if (river) {
    // Engine colours: 0 leaf → reed, 3 drop → water.
    for (const [index, chain] of [[0, 'reed'], [3, 'water']]) {
      const n = Math.min(3, Math.floor((run.collected?.[index] || 0) / 16));
      for (let i = 0; i < n; i++) items.push({chain, level: 1});
    }
  }
  // Leftover moves become bonus materials for whatever the next repair needs.
  const target = pending.find(r => river ? r.chain !== 'wood' : true) || pending[0];
  const bonus = Math.min(3, Math.floor((run.movesLeft || 0) / 5));
  for (let i = 0; i < bonus; i++) items.push({chain: target?.chain || 'wood', level: 1, bonus: true});
  // Berries, stars and flowers pay stars, the booster currency.
  const sparkle = (run.collected?.[1] || 0) + (run.collected?.[2] || 0) + (run.collected?.[4] || 0);
  const stars = Math.min(20, 2 + Math.floor(sparkle / 10));
  return {items, stars, bonus};
}
export function awardWin(state, run) {
  const s = structuredClone(state), crate = crateFromRun(s, run);
  s.crates.push({id: `c${s.nextId++}`, items: crate.items, level: s.level});
  s.stars += crate.stars; s.stats.wins++; s.stats.crates++; s.level++; s.match = null;
  return {ok: true, state: s, events: [{type: 'crate', crate: s.crates.at(-1), stars: crate.stars, bonus: crate.bonus}]};
}

export const boardCells = s => [...BOARD.camp, ...(done(s, 'path') ? BOARD.river : [])];
export const homeRegion = (s, chain) => chain === 'wood' || !done(s, 'path') ? 'camp' : 'river';
function homeFree(s, chain) {
  const region = homeRegion(s, chain), centre = region === 'camp' ? [0, 0] : [8, -4];
  return BOARD[region].filter(c => !itemAt(s, c)).sort((a, b) => dist(a, centre) - dist(b, centre));
}
// Levels past the authored 20 replay the later layouts.
export const engineLevel = level => level <= MATCH_LEVELS ? level : 11 + (level - MATCH_LEVELS - 1) % 10;
export const itemAt = (s, cell) => s.items.find(i => key(...i.cell) === key(...cell)) || null;
export const isBoard = (s, cell) => boardCells(s).some(c => key(...c) === key(...cell));
export const freeCells = s => boardCells(s).filter(c => !itemAt(s, c));

// Opening a crate drops all items at once. Matching pairs merge automatically
// in a chain, so one tap often produces a cascade — the "pop" moment.
// If the board is full, the remainder stays in the crate.
export function openCrate(state, crateId) {
  const s = structuredClone(state), crate = s.crates.find(c => c.id === crateId);
  if (!crate) return {ok: false, state, message: '这个箱子已经开过了。', events: []};
  const events = [], placed = [];
  // Each chain lands only in its home region (wood in the camp, the rest in
  // the river bend), so pairs stay together and next to the site that needs
  // them. A full region keeps the rest in the crate.
  const pick = chain => homeFree(s, chain)[0];
  while (crate.items.length) {
    const cell = pick(crate.items[0].chain); if (!cell) break;
    const it = crate.items.shift();
    const item = {id: `i${s.nextId++}`, chain: it.chain, level: it.level, cell, bonus: !!it.bonus};
    s.items.push(item); placed.push(item); discover(s, item.chain, item.level, events);
  }
  events.unshift({type: 'drop', items: placed.map(i => ({...i}))});
  if (!crate.items.length) s.crates = s.crates.filter(c => c.id !== crateId);
  s.stats.opened++;
  autoMerge(s, events);
  return {ok: true, state: s, events};
}
const dist = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] + a[1] - b[0] - b[1])) / 2;
function discover(s, chain, level, events) { if (level > s.discovered[chain]) { for (let l = s.discovered[chain] + 1; l <= level; l++) events.push({type: 'discover', chain, level: l}); s.discovered[chain] = level; } }

// Auto-merge: when a crate opens, pairs below L3 fuse on their own in a
// cascade. L3 and above stay manual — those are the merges worth doing by hand.
export const AUTO_CAP = 3;
export function autoMerge(s, events = [], {cap = AUTO_CAP} = {}) {
  let n = 0, guard = 0;
  while (guard++ < 200) {
    const pair = lowestPair(s, cap);
    if (!pair) break;
    const [keep, gone] = pair, level = keep.level + 1;
    s.items = s.items.filter(i => i.id !== gone.id);
    keep.level = level; keep.bonus = false;
    events.push({type: 'merge', keep: keep.id, gone: gone.id, from: gone.cell, at: keep.cell, chain: keep.chain, level, depth: n});
    discover(s, keep.chain, level, events);
    s.stats.merges++; n++;
  }
  if (n > 1) s.stats.chainMerges++;
  return n;
}
function lowestPair(s, cap) {
  const groups = new Map();
  for (const i of s.items) { if (i.level >= cap || i.level >= MAX_LEVEL) continue; const k = i.chain + i.level; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
  let best = null;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.level - b.level || dist(a.cell, [0, 0]) - dist(b.cell, [0, 0]));
    if (!best || list[0].level < best[0].level) best = [list[0], list[1]];
  }
  return best;
}

// Manual merge: drag one onto another of the same kind.
export function merge(state, aId, bId) {
  const s = structuredClone(state), a = s.items.find(i => i.id === aId), b = s.items.find(i => i.id === bId);
  if (!a || !b || a === b || a.chain !== b.chain || a.level !== b.level) return {ok: false, state, message: '相同的两件才能合成。', events: []};
  if (a.level >= MAX_LEVEL) return {ok: false, state, message: '已经是最高级了。', events: []};
  const events = [];
  s.items = s.items.filter(i => i.id !== aId);
  b.level++; s.stats.merges++;
  events.push({type: 'merge', keep: b.id, gone: a.id, from: a.cell, at: b.cell, chain: b.chain, level: b.level, depth: 0, manual: true});
  discover(s, b.chain, b.level, events);
  return {ok: true, state: s, events};
}
export function moveItem(state, id, cell) {
  if (!isBoard(state, cell)) return {ok: false, state, message: '这里不能放。', events: []};
  const s = structuredClone(state), it = s.items.find(i => i.id === id), other = itemAt(s, cell);
  if (!it) return {ok: false, state, events: []};
  if (other && other.id !== id) other.cell = it.cell;
  it.cell = cell;
  return {ok: true, state: s, events: [{type: 'move', id}]};
}

export function install(state, itemId, repairId) {
  const r = repairById(repairId), s = structuredClone(state), it = s.items.find(i => i.id === itemId);
  if (!r || !repairAvailable(s, r) || !it || it.chain !== r.chain || it.level < r.level) return {ok: false, state, message: '材料还不够。', events: []};
  s.items = s.items.filter(i => i.id !== itemId);
  s.done.push(r.id); s.stats.repairs++;
  const events = [{type: 'install', repair: r.id, item: {...it}}];
  // Over-levelled items refund the difference as level-1 pieces of the chain.
  let refund = 2 ** (it.level - 1) - 2 ** (r.level - 1);
  const free = homeFree(s, r.chain);
  for (let lv = MAX_LEVEL - 1; lv >= 1 && refund > 0; lv--) while (refund >= 2 ** (lv - 1) && free.length) { const item = {id: `i${s.nextId++}`, chain: r.chain, level: lv, cell: free.shift()}; s.items.push(item); refund -= 2 ** (lv - 1); events.push({type: 'refund', item: {...item}}); }
  return {ok: true, state: s, events};
}
// Ready-to-install items per available repair.
export function readyRepairs(s) { return availableRepairs(s).map(r => ({repair: r, item: s.items.find(i => i.chain === r.chain && i.level >= r.level) || null})); }
// How close the next repair is, for the "x / y" progress meter.
export function progressTo(s, r) {
  const need = 2 ** (r.level - 1), have = s.items.filter(i => i.chain === r.chain && i.level <= r.level).reduce((n, i) => n + 2 ** (i.level - 1), 0)
    + s.crates.flatMap(c => c.items).filter(i => i.chain === r.chain).reduce((n, i) => n + 2 ** (i.level - 1), 0);
  return {have: Math.min(need, have), need};
}
export function buyBooster(state, id) {
  const b = BOOSTERS[id];
  if (!b || !boosterUnlocked(state, id)) return {ok: false, state, message: '还没解锁。', events: []};
  if (state.stars < b.cost) return {ok: false, state, message: `需要 ${b.cost} 颗星星。`, events: []};
  const s = structuredClone(state); s.stars -= b.cost; s.stats.boosters++;
  return {ok: true, state: s, events: [{type: 'booster', id}]};
}
export const validate = s => !!s && s.version === VERSION && Array.isArray(s.items) && Array.isArray(s.crates) && s.items.every(i => i.cell && i.level >= 1 && i.level <= MAX_LEVEL);
export {nameOf};
