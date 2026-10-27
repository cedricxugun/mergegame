import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../dist/lite/b/rules.mjs';
import * as A from '../dist/lite/a/rules.mjs';
import {REPAIRS, DIARY, spotArt} from '../dist/lite/shared/chapter.mjs';
import {SPOTS, AREA, regionOfCell, SPOT_REGION} from '../dist/lite/shared/map.mjs';
import {key} from '../dist/lite/shared/hex.mjs';
import {m3Create, m3Move, m3AvailableMoves, m3Valid} from '../dist/match3-premium.mjs';
import {LEVELS, levelFor} from '../dist/lite/a/levels.mjs';

// ---------- shared chapter ----------
test('chapter: every repair is reachable, every spot belongs to a region', () => {
  const ids = new Set(REPAIRS.map(r => r.id));
  for (const r of REPAIRS) {
    assert.ok(SPOTS[r.spot], `${r.id} has a spot`);
    assert.ok(SPOT_REGION[r.spot], `${r.spot} has a region`);
    for (const dep of r.after) assert.ok(ids.has(dep), `${r.id} depends on known ${dep}`);
  }
  const doneIds = new Set();
  for (let pass = 0; pass < REPAIRS.length; pass++) for (const r of REPAIRS) if (r.after.every(d => doneIds.has(d))) doneIds.add(r.id);
  assert.equal(doneIds.size, REPAIRS.length, 'no dependency cycles');
  assert.equal(REPAIRS.filter(r => r.finale).length, 1);
  assert.ok(DIARY.length >= 8);
});

test('chapter: a spot shows its newest finished scene, else its ruin', () => {
  assert.equal(spotArt([], 'shelter').art, 'ruin-shelter');
  assert.equal(spotArt(['roof'], 'shelter').art, 'scene-roof');
  assert.equal(spotArt(['roof', 'fire', 'fence', 'path', 'home'], 'shelter').art, 'scene-home');
  assert.equal(spotArt([], 'fence'), null, 'empty ground before the fence is built');
});

test('map: regions do not overlap and spots never sit on buildable land', () => {
  const seen = new Map();
  for (const [region, cells] of Object.entries(AREA)) for (const c of cells) {
    assert.ok(!seen.has(key(...c)), `${c} is in ${seen.get(key(...c))} and ${region}`);
    seen.set(key(...c), region);
    assert.equal(regionOfCell(c), region);
  }
  for (const c of Object.values(SPOTS)) assert.ok(!seen.has(key(...c)), `spot ${c} overlaps land`);
});

// ---------- Prototype B: pure merge ----------
function playB(seed) {
  let s = B.freshState(0, seed), t = 0;
  const step = r => { assert.ok(r.ok, r.message); s = r.state; };
  for (let n = 0; n < 8000 && s.done.length < B.REPAIRS.length; n++) {
    t += 1000; B.tick(s, t);
    const hint = B.suggestion(s);
    if (hint.type === 'install') { const it = [...s.items, ...s.bag].find(i => i.id === hint.item); if (!it.cell) step(B.unbag(s, it.id, [0, 0])); else step(B.install(s, hint.item, hint.repair)); continue; }
    if (hint.type === 'deliver') { step(B.deliver(s, hint.order)); continue; }
    if (hint.type === 'merge') {
      const a = [...s.items, ...s.bag].find(i => i.id === hint.a);
      if (!a.cell) { const r = B.unbag(s, a.id, [0, 0]); if (r.ok) s = r.state; else step(B.sell(s, a.id)); continue; }
      step(B.merge(s, hint.a, hint.b)); continue;
    }
    if (hint.type === 'store') { step(B.store(s, hint.item)); continue; }
    if (hint.type === 'sell') { step(B.sell(s, hint.item)); continue; }
    if (hint.type === 'wait' || s.energy < 1) { t += B.ENERGY.regenMs; continue; }
    const r = B.tapGenerator(s, hint.generator, t);
    if (r.noSpace) { const low = [...s.items].sort((x, y) => x.level - y.level)[0]; step(B.sell(s, low.id)); continue; }
    step(r);
  }
  return s;
}

test('B: a hint-following player finishes all seventeen repairs across seeds', () => {
  for (const seed of [1, 7, 42, 2026]) {
    const s = playB(seed);
    assert.equal(s.done.length, B.REPAIRS.length, `seed ${seed}: ${s.done.join(',')}`);
    assert.ok(B.validate(s));
    assert.ok(s.stats.heals >= 15, 'merging beside debris clears storm tiles');
    assert.ok(s.stats.orders >= 8, 'orders are part of the loop');
    assert.ok(s.diary.length >= 6, 'diary pages are found along the way');
  }
});

test('B: generators cost energy, drop into their own region, and refuse when it is full', () => {
  let s = B.freshState(0, 3);
  const start = s.energy;
  s = B.tapGenerator(s, 'logs', 0).state;
  assert.equal(s.energy, start - 1);
  assert.equal(regionOfCell(s.items[0].cell), 'camp');
  for (const c of B.landCells(s)) if (!B.itemAt(s, c)) s.items.push({id: `x${c}`, chain: 'dock', level: 1, cell: c});
  const before = s.energy, r = B.tapGenerator(s, 'logs', 0);
  assert.equal(r.ok, false); assert.ok(r.noSpace); assert.equal(r.state.energy, before);
});

test('B: river generators open with the old path', () => {
  let s = B.freshState(0, 3);
  assert.equal(B.tapGenerator(s, 'spring', 0).ok, false);
  s.done.push('roof', 'path');
  const r = B.tapGenerator(s, 'boat', 0);
  assert.ok(r.ok, r.message);
  assert.equal(regionOfCell(r.state.items[0].cell), 'river');
});

test('B: energy regenerates over time and stops at the cap', () => {
  let s = B.freshState(0, 3);
  for (let i = 0; i < 5; i++) s = B.tapGenerator(s, 'logs', 0).state;
  assert.equal(s.energy, B.ENERGY.start - 5);
  B.tick(s, B.ENERGY.regenMs * 3 + 10);
  assert.equal(s.energy, B.ENERGY.start - 2);
  B.tick(s, B.ENERGY.regenMs * 100);
  assert.equal(s.energy, s.maxEnergy);
});

test('B: merging next to debris heals tiles at or below the new level only', () => {
  const s = B.freshState(0, 9);
  const touches = (c, t) => [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].some(([dq, dr]) => c[0] + dq === t[0] && c[1] + dr === t[1]);
  const storm = [...B.STORM.values()].find(t => t.region === 'camp' && t.level === 2 && B.landCells(s).some(c => touches(c, t.cell)));
  assert.ok(storm, 'an L2 debris tile borders the opening clearing');
  const land = B.landCells(s).find(c => touches(c, storm.cell)), free = B.landCells(s).filter(c => key(...c) !== key(...land));
  s.items.push({id: 'a', chain: 'wood', level: 1, cell: free[0]}, {id: 'b', chain: 'wood', level: 1, cell: land});
  const r = B.merge(s, 'a', 'b');
  assert.ok(r.ok);
  assert.ok(r.state.healed.includes(key(...storm.cell)), 'L2 result clears an L2 tile');
  assert.ok(B.isLand(r.state, storm.cell), 'the cleared tile becomes usable land');
  const far = [...B.STORM.values()].find(t => t.region === 'camp' && t.level === 3);
  assert.ok(!r.state.healed.includes(key(...far.cell)), 'L3 debris needs an L3 merge');
});

test('B: orders refund less energy than the taps that fed them', () => {
  for (const o of B.ORDERS) {
    const taps = o.needs.reduce((n, [, lv]) => n + 2 ** (lv - 1), 0);
    assert.ok(o.energy < taps, `${o.id} must not be an energy fountain`);
  }
});

test('B: install needs the exact component and applies its reward', () => {
  let s = B.freshState(0, 5);
  s.items.push({id: 'w2', chain: 'wood', level: 2, cell: [0, 0]});
  assert.equal(B.install(s, 'w2', 'roof').ok, false);
  s.items = [{id: 'w3', chain: 'wood', level: 3, cell: [0, 0]}];
  const r = B.install(s, 'w3', 'roof');
  assert.ok(r.ok); assert.ok(r.state.maxEnergy > s.maxEnergy);
  s = r.state; s.done.push('fire'); s.items = [{id: 'w4', chain: 'wood', level: 4, cell: [0, 0]}];
  const fence = B.install(s, 'w4', 'fence');
  assert.ok(fence.ok); assert.ok(fence.state.bagSize > s.bagSize, 'the fence enlarges the bag');
  s = fence.state; s.items = [{id: 'w5', chain: 'wood', level: 5, cell: [0, 0]}];
  s = B.install(s, 'w5', 'path').state;
  assert.ok(B.isOpen(s, 'river') && B.isOpen(s, 'creek'));
});

test('B: the board reports when nothing can move', () => {
  const s = B.freshState(0, 5);
  let n = 0;
  // Every item unique (chain, level), none matching an open repair or order.
  for (const c of B.landCells(s)) { s.items.push({id: `x${n}`, chain: ['water', 'reed', 'dock'][n % 3], level: 1 + Math.floor(n / 3) % 7, cell: c}); n++; }
  s.items = s.items.filter((i, k, all) => all.findIndex(j => j.chain === i.chain && j.level === i.level) === k);
  // Fill the rest with max-level wood, which cannot merge any further.
  for (const c of B.landCells(s)) if (!B.itemAt(s, c)) s.items.push({id: `y${n++}`, chain: 'wood', level: 7, cell: c});
  s.orders = [];
  assert.ok(B.isStuck(s));
  assert.ok(['store', 'sell'].includes(B.suggestion(s).type), 'the hint offers a way out');
});

// ---------- Prototype A: match-3 + light merge ----------
let x = 7;
const rand = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
function botLevel(level, extra, seed) {
  const def = levelFor(level);
  let g = m3Create(level, {seed, custom: {layout: def.layout, moves: def.moves + extra, colors: def.colors, collect: def.collect}}), n = 0;
  while (g.status === 'playing' && n++ < 200) { const ms = m3AvailableMoves(g); if (!ms.length) break; g = m3Move(g, ms[Math.floor(rand() * Math.min(3, ms.length))]).state; }
  return g;
}
function playA(seed) {
  let s = A.freshState(seed), played = 0;
  while (s.done.length < A.REPAIRS.length && played < 70) {
    const g = botLevel(s.level, A.extraMoves(s), seed * 100 + played++);
    if (g.status !== 'won') continue;
    s = A.awardWin(s, {cratesCleared: g.cratesCleared, collected: g.collected, movesLeft: g.moves, totalMoves: g.moves + g.usedMoves}).state;
    for (let guard = 0; s.crates.length && guard < 4; guard++) s = A.openCrate(s, s.crates[0].id).state;
    for (let guard = 0; guard < 80; guard++) {
      const ready = A.readyRepairs(s).find(r => r.item);
      if (ready) { s = A.install(s, ready.item.id, ready.repair.id).state; continue; }
      let pair = null;
      for (const r of A.availableRepairs(s)) {
        const pool = s.items.filter(i => i.chain === r.chain && i.level < r.level).sort((a, b) => a.level - b.level);
        for (let i = 0; i + 1 < pool.length && !pair; i++) if (pool[i].level === pool[i + 1].level) pair = [pool[i], pool[i + 1]];
      }
      if (!pair) break;
      s = A.merge(s, pair[0].id, pair[1].id).state;
    }
  }
  return {s, played};
}

test('A: the chapter completes in roughly 25–45 match-3 levels', () => {
  for (const seed of [1, 2, 3]) {
    const {s, played} = playA(seed);
    assert.equal(s.done.length, A.REPAIRS.length, `seed ${seed}: ${s.done.join(',')}`);
    assert.ok(played >= 20 && played <= 55, `seed ${seed} took ${played} levels`);
    assert.ok(A.validate(s));
  }
});

test('A: all thirty levels start valid and are winnable', () => {
  for (let n = 1; n <= LEVELS.length; n++) {
    const def = LEVELS[n - 1], custom = {layout: def.layout, moves: def.moves, colors: def.colors, collect: def.collect};
    const g = m3Create(n, {seed: n * 31, custom});
    assert.ok(m3Valid(g), `level ${n} starts valid`);
    let won = false;
    for (let seed = 1; seed <= 6 && !won; seed++) won = botLevel(n, 4, seed * 97 + n).status === 'won';
    assert.ok(won, `level ${n} can be won`);
  }
});

test('A: opening a crate cascades low pairs automatically but never past L3', () => {
  const s = A.freshState(1);
  s.crates.push({id: 'c', items: Array.from({length: 8}, () => ({chain: 'wood', level: 1}))});
  const r = A.openCrate(s, 'c');
  assert.ok(r.ok);
  assert.deepEqual(r.state.items.map(i => i.level).sort(), [3, 3]);
  assert.ok(r.events.filter(e => e.type === 'merge').length >= 6, 'one tap triggers a chain');
  const [a, b] = r.state.items;
  const m = A.merge(r.state, a.id, b.id);
  assert.ok(m.ok); assert.equal(m.state.items[0].level, 4);
});

test('A: materials land in their home region', () => {
  const s = A.freshState(1); s.done.push('roof', 'fire', 'path');
  s.crates.push({id: 'c', items: [{chain: 'wood', level: 1}, {chain: 'water', level: 1}, {chain: 'reed', level: 1}, {chain: 'dock', level: 1}]});
  const r = A.openCrate(s, 'c');
  const regionOf = chain => regionOfCell(r.state.items.find(i => i.chain === chain).cell);
  assert.equal(regionOf('wood'), 'camp'); assert.equal(regionOf('water'), 'creek');
  assert.equal(regionOf('reed'), 'river'); assert.equal(regionOf('dock'), 'river');
});

test('A: leftover moves turn into bonus materials for the next repair', () => {
  const s = A.freshState(1);
  const none = A.crateFromRun(s, {cratesCleared: 12, collected: [0, 0, 0, 0, 0], movesLeft: 0});
  const many = A.crateFromRun(s, {cratesCleared: 12, collected: [0, 0, 0, 0, 0], movesLeft: 15});
  assert.equal(many.items.length - none.items.length, 3);
  assert.ok(many.items.filter(i => i.bonus).every(i => i.chain === 'wood'));
  assert.equal(A.starsFor(15, 25), 3); assert.equal(A.starsFor(4, 25), 2); assert.equal(A.starsFor(0, 25), 1);
});

test('A: repairs unlock boosters and perks', () => {
  let s = A.freshState(1);
  assert.equal(A.boosterUnlocked(s, 'rocket'), false);
  s.done.push('roof', 'fire'); s.stars = A.BOOSTERS.rocket.cost - 1;
  assert.equal(A.buyBooster(s, 'rocket').ok, false, 'not enough stars');
  s.stars = 20;
  const r = A.buyBooster(s, 'rocket');
  assert.ok(r.ok); assert.equal(r.state.stars, 20 - A.BOOSTERS.rocket.cost);
  s.done.push('fence', 'reeds', 'shore');
  assert.ok(A.freeRocket(s)); assert.equal(A.extraMoves(s), 3);
});

test('A: river materials only drop after the old path is repaired', () => {
  const run = {cratesCleared: 12, collected: [40, 10, 10, 40, 10], movesLeft: 0};
  const camp = A.crateFromRun(A.freshState(1), run);
  assert.ok(camp.items.every(i => i.chain === 'wood'));
  const s = A.freshState(1); s.done.push('roof', 'fire', 'path');
  const river = A.crateFromRun(s, run);
  assert.ok(river.items.some(i => i.chain === 'water') && river.items.some(i => i.chain === 'reed'));
});
