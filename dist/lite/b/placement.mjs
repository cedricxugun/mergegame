import {distance, key, neighbors} from '../shared/hex.mjs';
import {regionOfCell} from '../shared/map.mjs';

// Old single-cell pieces keep their saved footprint. A real turn is assigned
// only after the expanded component and its neighbors all have legal positions.
export function occupiedCells(item, anchor = item.cell, turn = item.turn) {
  if (!anchor) return [];
  if (!(item.wide || item.level===7) || !Number.isInteger(turn)) return [anchor];
  const around = neighbors(...anchor);
  return [anchor, around[turn], around[(turn + 1) % 6]];
}

const cellKey = cell => key(...cell);
function turns(item) {
  if (!(item.wide || item.level===7)) return [null];
  const first = item.turn ?? 0;
  return Array.from({length: 6}, (_, i) => (first + i) % 6);
}

// Prefer a free orientation, then relocate whole blocking objects to the nearest
// legal cells. Compute the entire layout first so a failed drop loses nothing.
export function layoutFor(items, land, item, cell, ignore = []) {
  const region = regionOfCell(cell);
  const tiles = land.filter(c => regionOfCell(c) === region);
  const legal = new Set(tiles.map(cellKey));
  const omitted = new Set([item.id, ...ignore]);
  const occupants = items.filter(i => !omitted.has(i.id));
  const byCell = new Map();
  for (const other of occupants) for (const c of occupiedCells(other)) byCell.set(cellKey(c), other);
  const candidates = [];
  for (const turn of turns(item)) {
    const shape = occupiedCells(item, cell, turn).map(cellKey);
    if (!shape.every(k => legal.has(k))) continue;
    const blockers = [...new Set(shape.map(k => byCell.get(k)).filter(Boolean))];
    candidates.push({turn, shape, blockers});
  }
  candidates.sort((a, b) => a.blockers.length - b.blockers.length);
  for (const {turn, shape, blockers} of candidates) {
    if (!blockers.length) return {cell, turn, shifts: []};
    const reserved = new Set([...byCell.keys()].filter(k => !blockers.includes(byCell.get(k))));
    shape.forEach(k => reserved.add(k));
    const shifts = [];
    const bigFirst = [...blockers].sort((a, b) => b.level - a.level);
    function relocate(index) {
      if (index === bigFirst.length) return true;
      const other = bigFirst[index];
      const options = [...tiles].sort((a, b) => distance(a, item.cell || other.cell) - distance(b, item.cell || other.cell));
      for (const anchor of options) {
        for (const facing of turns(other)) {
          const keys = occupiedCells(other, anchor, facing).map(cellKey);
          if (!keys.every(k => legal.has(k) && !reserved.has(k))) continue;
          keys.forEach(k => reserved.add(k));
          shifts.push({id: other.id, cell: anchor, turn: facing});
          if (relocate(index + 1)) return true;
          shifts.pop();
          keys.forEach(k => reserved.delete(k));
        }
      }
      return false;
    }
    if (relocate(0)) return {cell, turn, shifts};
  }
  return null;
}

export function applyLayout(items, item, plan) {
  const assign = (obj, to) => {
    obj.cell = to.cell;
    if (Number.isInteger(to.turn)) obj.turn = to.turn;
  };
  for (const shift of plan.shifts) assign(items.find(i => i.id === shift.id), shift);
  assign(item, plan);
}
