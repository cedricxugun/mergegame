import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../dist/lite/b/rules.mjs';
import * as A from '../dist/lite/a/rules.mjs';
import {m3Create, m3Move, m3AvailableMoves} from '../dist/match3-premium.mjs';

// ---------- Prototype B: pure merge ----------
function playB(seed, {steps = 3000} = {}) {
  let s = B.freshState(0, seed), t = 0;
  const step = r => { assert.ok(r.ok, r.message); s = r.state; };
  for (let n = 0; n < steps && s.done.length < B.REPAIRS.length; n++) {
    t += 1000; B.tick(s, t);
    const hint = B.suggestion(s);
    if (hint.type === 'install') { step(B.install(s, hint.item, hint.repair)); continue; }
    if (hint.type === 'deliver') { step(B.deliver(s, hint.order)); continue; }
    if (hint.type === 'merge') {
      const a = [...s.items, ...s.bag].find(i => i.id === hint.a);
      if (!a.cell) { step(B.unbag(s, a.id, [0, 0])); continue; }
      step(B.merge(s, hint.a, hint.b)); continue;
    }
    if (s.energy < 1) { s = B.buyEnergy(s, {free: true, now: t + B.ENERGY.freeCooldownMs * n}).state; continue; }
    const r = B.tapGenerator(s, hint.generator, t);
    if (r.noSpace) { const low = [...s.items].sort((x, y) => x.level - y.level)[0]; step(B.sell(s, low.id)); continue; }
    step(r);
  }
  return s;
}

test('B: a hint-following player finishes all seven repairs across seeds', () => {
  for (const seed of [1, 7, 42, 2026]) {
    const s = playB(seed);
    assert.deepEqual(new Set(s.done), new Set(B.REPAIRS.map(r => r.id)), `seed ${seed}`);
    assert.ok(B.validate(s));
    assert.ok(s.stats.heals >= 6, 'merging beside debris clears storm tiles');
    assert.ok(s.stats.orders >= 5, 'orders are part of the loop');
  }
});

test('B: generators cost energy and refuse when the board around them is full', () => {
  let s = B.freshState(0, 3);
  const start = s.energy;
  s = B.tapGenerator(s, 'logs', 0).state;
  assert.equal(s.energy, start - 1);
  assert.equal(s.items.length, 1);
  // Fill every free cell, then the next tap must be refused without spending energy.
  for (const c of B.landCells(s)) if (!B.itemAt(s, c)) s.items.push({id: `x${c}`, chain: 'dock', level: 1, cell: c});
  const before = s.energy, r = B.tapGenerator(s, 'logs', 0);
  assert.equal(r.ok, false); assert.ok(r.noSpace); assert.equal(r.state.energy, before);
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
  let s = B.freshState(0, 9);
  const touches = (c, t) => [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].some(([dq, dr]) => c[0] + dq === t[0] && c[1] + dr === t[1]);
  const storm = [...B.STORM.values()].find(t => t.region === 'camp' && t.level === 2 && B.landCells(s).some(c => touches(c, t.cell)));
  assert.ok(storm, 'an L2 debris tile borders the opening clearing');
  const land = B.landCells(s).find(c => touches(c, storm.cell));
  const free = B.landCells(s).filter(c => c.join() !== land.join());
  s.items.push({id: 'a', chain: 'wood', level: 1, cell: free[0]}, {id: 'b', chain: 'wood', level: 1, cell: land});
  const r = B.merge(s, 'a', 'b');
  assert.ok(r.ok);
  assert.ok(r.state.healed.includes(storm.cell.join(',')), 'L2 result clears an L2 tile');
  assert.ok(B.isLand(r.state, storm.cell), 'the cleared tile becomes usable land');
});

test('B: orders refund less energy than the taps that fed them', () => {
  for (const o of B.ORDERS) {
    const taps = o.needs.reduce((n, [, level]) => n + 2 ** (level - 1), 0);
    assert.ok(o.energy < taps, `${o.id} must not be an energy fountain`);
  }
});

test('B: install needs the exact component and changes generators and land', () => {
  let s = B.freshState(0, 5);
  s.items.push({id: 'w2', chain: 'wood', level: 2, cell: [0, 0]});
  assert.equal(B.install(s, 'w2', 'roof').ok, false);
  s.items = [{id: 'w3', chain: 'wood', level: 3, cell: [0, 0]}];
  const r = B.install(s, 'w3', 'roof');
  assert.ok(r.ok); assert.ok(r.state.maxEnergy > s.maxEnergy);
  s = r.state; s.done.push('fire'); s.items = [{id: 'w5', chain: 'wood', level: 5, cell: [0, 0]}];
  s = B.install(s, 'w5', 'path').state;
  assert.ok(B.isOpen(s, 'river')); assert.ok(B.generatorOpen(s, 'spring'));
});

// ---------- Prototype A: match-3 + light merge ----------
let x = 7;
const rand = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
function botLevel(level, extra, seed) {
  let g = m3Create(level, {seed}); g.moves += extra; let n = 0;
  while (g.status === 'playing' && n++ < 200) { const ms = m3AvailableMoves(g); if (!ms.length) break; g = m3Move(g, ms[Math.floor(rand() * Math.min(3, ms.length))]).state; }
  return g;
}
function playA(seed) {
  let s = A.freshState(seed), played = 0;
  while (s.done.length < A.REPAIRS.length && played < 40) {
    const g = botLevel(s.level, A.extraMoves(s), seed * 100 + played++);
    if (g.status !== 'won') continue;
    s = A.awardWin(s, {cratesCleared: g.cratesCleared, collected: g.collected, movesLeft: g.moves}).state;
    while (s.crates.length && A.freeCells(s).length) s = A.openCrate(s, s.crates[0].id).state;
    for (let guard = 0; guard < 60; guard++) {
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

test('A: the chapter completes in roughly 15–25 match-3 levels', () => {
  for (const seed of [1, 2, 3, 4]) {
    const {s, played} = playA(seed);
    assert.equal(s.done.length, A.REPAIRS.length, `seed ${seed}`);
    assert.ok(played >= 12 && played <= 28, `seed ${seed} took ${played} levels`);
    assert.ok(A.validate(s));
  }
});

test('A: opening a crate cascades low pairs automatically but never past L3', () => {
  let s = A.freshState(1);
  s.crates.push({id: 'c', items: Array.from({length: 8}, () => ({chain: 'wood', level: 1}))});
  const r = A.openCrate(s, 'c');
  assert.ok(r.ok);
  assert.deepEqual(r.state.items.map(i => i.level).sort(), [3, 3]);
  assert.ok(r.events.filter(e => e.type === 'merge').length >= 6, 'one tap triggers a chain');
  // L3 + L3 is a manual decision.
  const [a, b] = r.state.items;
  const m = A.merge(r.state, a.id, b.id);
  assert.ok(m.ok); assert.equal(m.state.items[0].level, 4);
});

test('A: leftover moves turn into bonus materials for the next repair', () => {
  const s = A.freshState(1);
  const none = A.crateFromRun(s, {cratesCleared: 12, collected: [0, 0, 0, 0, 0], movesLeft: 0});
  const many = A.crateFromRun(s, {cratesCleared: 12, collected: [0, 0, 0, 0, 0], movesLeft: 15});
  assert.equal(many.items.length - none.items.length, 3);
  assert.ok(many.items.filter(i => i.bonus).every(i => i.chain === 'wood'));
});

test('A: repairs unlock boosters and boosters cost stars', () => {
  let s = A.freshState(1);
  assert.equal(A.boosterUnlocked(s, 'rocket'), false);
  s.done.push('roof', 'fire'); s.stars = 5;
  assert.equal(A.buyBooster(s, 'rocket').ok, false, 'not enough stars');
  s.stars = 20;
  const r = A.buyBooster(s, 'rocket');
  assert.ok(r.ok); assert.equal(r.state.stars, 20 - A.BOOSTERS.rocket.cost);
});

test('A: river materials only drop after the old path is repaired', () => {
  const run = {cratesCleared: 12, collected: [40, 10, 10, 40, 10], movesLeft: 0};
  const camp = A.crateFromRun(A.freshState(1), run);
  assert.ok(camp.items.every(i => i.chain === 'wood'));
  const s = A.freshState(1); s.done.push('roof', 'fire', 'path');
  const river = A.crateFromRun(s, run);
  assert.ok(river.items.some(i => i.chain === 'water') && river.items.some(i => i.chain === 'reed'));
});
