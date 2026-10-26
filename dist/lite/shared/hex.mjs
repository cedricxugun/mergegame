// Pointy-top axial hex math with the same 0.74 ground foreshortening as the
// main prototype, so the painted homeland plate lines up with the board.
export const TILT = 0.74;
export const SQ3 = Math.sqrt(3);
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export const key = (q, r) => `${q},${r}`;
export const parseKey = k => k.split(',').map(Number);
export const neighbors = (q, r) => DIRS.map(([dq, dr]) => [q + dq, r + dr]);
export const distance = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] + a[1] - b[0] - b[1])) / 2;

export function disk([cq, cr], radius) {
  const cells = [];
  for (let dq = -radius; dq <= radius; dq++)
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) cells.push([cq + dq, cr + dr]);
  return cells;
}
export const ring = (center, radius) => disk(center, radius).filter(c => distance(c, center) === radius);

// World units: one unit is one hex radius.
export const toWorld = (q, r) => [SQ3 * (q + r / 2), 1.5 * r * TILT];
export function fromWorld(x, y) {
  const py = y / TILT, q = SQ3 / 3 * x - py / 3, r = 2 * py / 3;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return [rq || 0, rr || 0];
}
export function corners(x, y, size) {
  return Array.from({length: 6}, (_, i) => {
    const a = (60 * i - 30) * Math.PI / 180;
    return [x + Math.cos(a) * size, y + Math.sin(a) * size * TILT];
  });
}

// Breadth-first order of cells reachable from `start` through `passable`,
// used to find the nearest free tile without teleporting across the map.
export function nearestFirst(start, isFree, inside, limit = 200) {
  const seen = new Set([key(...start)]), queue = [start], out = [];
  while (queue.length && out.length < limit) {
    const cell = queue.shift();
    for (const n of neighbors(...cell)) {
      const k = key(...n);
      if (seen.has(k) || !inside(n)) continue;
      seen.add(k); queue.push(n);
      if (isFree(n)) out.push(n);
    }
  }
  return out;
}
