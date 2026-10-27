// Prototype A · 三消 + 轻合成. Match-3 levels are the main loop; each win
// drops a supply crate that is tapped open on a small merge board. The merge
// layer keeps the fun parts (anticipation, chain merges, discoveries, tangible
// repairs) and drops the chores (energy, inventory, generators). Pure, no DOM.
import {key} from '../shared/hex.mjs';
import {MAX_LEVEL} from '../shared/art.mjs';
import {SPOTS, AREA, regionOfCell, SPOT_REGION} from '../shared/map.mjs';
import {REPAIRS as CHAPTER, DIARY} from '../shared/chapter.mjs';
import {levelFor, LEVEL_COUNT} from './levels.mjs';

export const VERSION = 2;

// What each repair unlocks in this prototype.
const UNLOCKS = {
  roof: '营地有了落脚的地方',
  fire: '关前道具解锁：火箭',
  fence: '每关开局多 1 个火箭',
  path: '溪谷和河湾开放：水滴、叶子会带回材料',
  spring: '关前道具解锁：炸弹',
  trough: '水滴带回的材料 +1',
  stream: '小溪流回营地',
  cattail: '叶子带回的材料 +1',
  reeds: '每关多 2 步',
  garden: '每关多得 1 颗星星',
  pier: '关前道具解锁：彩球',
  bridge: '木箱带回的材料 +1',
  shore: '每关再多 1 步',
  jetty: '每关再多得 1 颗星星',
  home: '营地变成了家',
  ferry: '渡口重开',
  feast: '第一章完成'
};
export const REPAIRS = CHAPTER.map(r => ({...r, unlocks: UNLOCKS[r.id]}));
export const repairById = id => REPAIRS.find(r => r.id === id);
export const done = (s, id) => s.done.includes(id);
export const repairAvailable = (s, r) => !done(s, r.id) && r.after.every(id => done(s, id));
export const availableRepairs = s => REPAIRS.filter(r => repairAvailable(s, r));
const DIARY_REPAIRS = {roof: 1, fire: 2, spring: 3, reeds: 4, pier: 5, home: 6, ferry: 7};

// Boosters unlocked by repairs; each one is a pre-level pick that costs stars.
export const BOOSTERS = {
  rocket: {name: '火箭', after: 'fire', cost: 5, art: 'rocket'},
  bomb: {name: '炸弹', after: 'spring', cost: 7, art: 'tnt'},
  orb: {name: '彩球', after: 'pier', cost: 10, art: 'orb'}
};
export const boosterUnlocked = (s, id) => done(s, BOOSTERS[id].after);
export const extraMoves = s => (done(s, 'reeds') ? 2 : 0) + (done(s, 'shore') ? 1 : 0);
export const freeRocket = s => done(s, 'fence');
export {levelFor, LEVEL_COUNT};

export function freshState(seed = 20261022) {
  return {version: VERSION, seed, level: 1, stars: 0, done: [], items: [], crates: [], nextId: 1, diary: [0],
    discovered: {wood: 0, water: 0, reed: 0, dock: 0}, best: {},
    stats: {wins: 0, losses: 0, retries: 0, merges: 0, crates: 0, opened: 0, repairs: 0, boosters: 0, chainMerges: 0, bonus: 0}};
}

// ---------- board ----------
// The merge board uses the same land as prototype B, without debris: the camp
// clearing, then the creek valley and river bend once the old path is fixed.
export const BOARD = {camp: AREA.camp.filter(c => Math.max(...[c[0], c[1], c[0] + c[1]].map(Math.abs)) <= 2), creek: AREA.creek, river: AREA.river.filter(c => Math.max(Math.abs(c[0] - 10), Math.abs(c[1] + 2), Math.abs(c[0] - 10 + c[1] + 2)) <= 2)};
export const regionOpen = (s, region) => region === 'camp' || done(s, 'path');
export const boardCells = s => Object.keys(BOARD).filter(r => regionOpen(s, r)).flatMap(r => BOARD[r]);
export const HOME = {wood: 'camp', water: 'creek', reed: 'river', dock: 'river'};
export const homeRegion = (s, chain) => regionOpen(s, HOME[chain]) ? HOME[chain] : 'camp';
const CENTER = {camp: [0, 0], creek: [5, -1], river: [10, -2]};
const dist = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] + a[1] - b[0] - b[1])) / 2;
function homeFree(s, chain) {
  const region = homeRegion(s, chain);
  return BOARD[region].filter(c => !itemAt(s, c)).sort((a, b) => dist(a, CENTER[region]) - dist(b, CENTER[region]));
}
export const itemAt = (s, cell) => s.items.find(i => key(...i.cell) === key(...cell)) || null;
export const isBoard = (s, cell) => boardCells(s).some(c => key(...c) === key(...cell));
export const freeCells = s => boardCells(s).filter(c => !itemAt(s, c));
export {regionOfCell, SPOT_REGION, SPOTS};

// ---------- crates ----------
// A win converts what the player cleared into one crate. Board crates are
// planks (wood, then dock planks too); drops and leaves become water and reed
// once the path is open; leftover moves become bonus material for the repair
// in progress; berries, stars and flowers pay stars.
// Material still needed for every unfinished repair of a chain, minus what the
// board and unopened crates already hold (in L1 units). Crates never drop a
// chain past this, so the board can't silt up with material nobody needs.
const units = i => 2 ** (i.level - 1);
export function deficit(s, chain, extra = []) {
  const need = REPAIRS.filter(r => !done(s, r.id) && r.chain === chain).reduce((n, r) => n + 2 ** (r.level - 1), 0);
  const have = [...s.items, ...s.crates.flatMap(c => c.items), ...extra].filter(i => i.chain === chain).reduce((n, i) => n + units(i), 0);
  return need - have;
}
export function crateFromRun(s, run) {
  const items = [], river = done(s, 'path');
  let spare = 0;
  const add = (chain, bonus = false) => { if (deficit(s, chain, items) > 0) items.push({chain, level: 1, ...(bonus ? {bonus} : {})}); else spare++; };
  // Board crates are planks: whichever of wood / dock planks is needed more.
  const planks = Math.min(5, 2 + (done(s, 'bridge') ? 1 : 0) + Math.floor((run.cratesCleared || 0) / 8));
  for (let i = 0; i < planks; i++) add(river && deficit(s, 'dock', items) > deficit(s, 'wood', items) ? 'dock' : 'wood');
  if (river) {
    // Engine colours: 0 leaf → reed, 3 drop → water.
    for (const [index, chain, perk] of [[0, 'reed', 'cattail'], [3, 'water', 'trough']]) {
      const n = Math.min(4, Math.floor((run.collected?.[index] || 0) / 14) + (done(s, perk) ? 1 : 0));
      for (let i = 0; i < n; i++) add(chain);
    }
  }
  // Leftover moves become bonus material for the most-needed open repair.
  const open = availableRepairs(s), pending = open.filter(r => r.chain !== 'wood' || !river || open.every(p => p.chain === 'wood'));
  const target = pending.sort((a, b) => deficit(s, b.chain, items) - deficit(s, a.chain, items))[0];
  const bonus = Math.min(3, Math.floor((run.movesLeft || 0) / 5));
  let given = 0;
  for (let i = 0; i < bonus; i++) { const before = items.length; add(target?.chain || 'wood', true); given += items.length - before; }
  // Berries, stars and flowers pay stars (booster currency); surplus material
  // converts at a lower rate so stars stay scarce enough to matter.
  const sparkle = (run.collected?.[1] || 0) + (run.collected?.[2] || 0) + (run.collected?.[4] || 0);
  const stars = Math.min(12, 1 + Math.floor(sparkle / 20) + Math.floor(spare / 3) + (done(s, 'garden') ? 1 : 0) + (done(s, 'jetty') ? 1 : 0));
  return {items, stars, bonus: given};
}
// Star rating for a win: leftover moves relative to the level's budget.
export const starsFor = (movesLeft, total) => movesLeft >= total * .3 ? 3 : movesLeft >= total * .12 ? 2 : 1;
export function awardWin(state, run) {
  const s = structuredClone(state), crate = crateFromRun(s, run), rating = starsFor(run.movesLeft || 0, run.totalMoves || 25);
  s.crates.push({id: `c${s.nextId++}`, items: crate.items, level: s.level});
  s.stars += crate.stars; s.stats.wins++; s.stats.crates++; s.stats.bonus += crate.bonus;
  s.best[s.level] = Math.max(s.best[s.level] || 0, rating);
  s.level++;
  return {ok: true, state: s, events: [{type: 'crate', crate: s.crates.at(-1), stars: crate.stars, bonus: crate.bonus, rating}]};
}

// Opening a crate drops all items at once; low pairs then auto-merge in a
// cascade. Each chain lands in its home region, so pairs stay together and
// next to the site that needs them. A full region keeps the rest in the crate.
export function openCrate(state, crateId) {
  const s = structuredClone(state), crate = s.crates.find(c => c.id === crateId);
  if (!crate) return {ok: false, state, message: '这个箱子已经开过了。', events: []};
  const events = [], placed = [], skipped = [];
  while (crate.items.length) {
    const it = crate.items.shift(), cell = homeFree(s, it.chain)[0];
    if (!cell) { skipped.push(it); continue; }
    const item = {id: `i${s.nextId++}`, chain: it.chain, level: it.level, cell, bonus: !!it.bonus};
    s.items.push(item); placed.push(item); discover(s, item.chain, item.level, events);
  }
  crate.items = skipped;
  events.unshift({type: 'drop', items: placed.map(i => ({...i}))});
  if (!crate.items.length) s.crates = s.crates.filter(c => c.id !== crateId);
  s.stats.opened++;
  autoMerge(s, events);
  return {ok: true, state: s, events};
}
function discover(s, chain, lv, events) { if (lv > s.discovered[chain]) { for (let l = s.discovered[chain] + 1; l <= lv; l++) events.push({type: 'discover', chain, level: l}); s.discovered[chain] = lv; } }

// Auto-merge: pairs below L3 fuse on their own in a cascade. L3 and above stay
// manual — those are the merges worth doing by hand.
export const AUTO_CAP = 3;
export function autoMerge(s, events = [], {cap = AUTO_CAP} = {}) {
  let n = 0, guard = 0;
  while (guard++ < 200) {
    const pair = lowestPair(s, cap);
    if (!pair) break;
    const [keep, gone] = pair, lv = keep.level + 1;
    s.items = s.items.filter(i => i.id !== gone.id);
    keep.level = lv; keep.bonus = false;
    events.push({type: 'merge', keep: keep.id, gone: gone.id, from: gone.cell, at: keep.cell, chain: keep.chain, level: lv, depth: n});
    discover(s, keep.chain, lv, events);
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
    const c = CENTER[regionOfCell(list[0].cell)] || [0, 0];
    list.sort((a, b) => dist(a.cell, c) - dist(b.cell, c));
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
  b.level++; b.bonus = false; s.stats.merges++;
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
  // Over-levelled items refund the difference in the same chain.
  let refund = 2 ** (it.level - 1) - 2 ** (r.level - 1);
  const free = homeFree(s, r.chain);
  for (let lv = MAX_LEVEL - 1; lv >= 1 && refund > 0; lv--) while (refund >= 2 ** (lv - 1) && free.length) { const item = {id: `i${s.nextId++}`, chain: r.chain, level: lv, cell: free.shift()}; s.items.push(item); refund -= 2 ** (lv - 1); events.push({type: 'refund', item: {...item}}); }
  const page = DIARY_REPAIRS[r.id];
  if (page !== undefined && !s.diary.includes(page)) { s.diary.push(page); events.push({type: 'diary', page}); }
  if (r.opens) events.push({type: 'open', regions: r.opens});
  if (r.letter) events.push({type: 'letter'});
  if (r.finale) events.push({type: 'finale'});
  return {ok: true, state: s, events};
}
export function readyRepairs(s) { return availableRepairs(s).map(r => ({repair: r, item: s.items.find(i => i.chain === r.chain && i.level >= r.level) || null})); }
// Progress toward a repair in L1 units, counting board items and unopened crates.
export function progressTo(s, r) {
  const need = 2 ** (r.level - 1), units = i => 2 ** (i.level - 1);
  const have = s.items.filter(i => i.chain === r.chain).reduce((n, i) => n + Math.min(units(i), need), 0) + s.crates.flatMap(c => c.items).filter(i => i.chain === r.chain).reduce((n, i) => n + units(i), 0);
  return {have: Math.min(need, have), need};
}
export function buyBooster(state, id) {
  const b = BOOSTERS[id];
  if (!b || !boosterUnlocked(state, id)) return {ok: false, state, message: '还没解锁。', events: []};
  if (state.stars < b.cost) return {ok: false, state, message: `需要 ${b.cost} 颗星星。`, events: []};
  const s = structuredClone(state); s.stars -= b.cost; s.stats.boosters++;
  return {ok: true, state: s, events: [{type: 'booster', id}]};
}
export const diaryText = page => DIARY[page];
export const validate = s => !!s && s.version === VERSION && Array.isArray(s.items) && Array.isArray(s.crates) && s.items.every(i => i.cell && i.level >= 1 && i.level <= MAX_LEVEL && isBoard(s, i.cell));
