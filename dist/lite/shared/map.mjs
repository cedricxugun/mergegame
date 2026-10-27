// Shared homeland geography for both lite prototypes. Cells are axial hex
// coordinates on the 1536×1024 painted plate: the camp clearing sits in the
// western meadow, the old creek bed crosses the middle, and the river bend
// opens onto the eastern lake shore. Both prototypes anchor their sites,
// land and debris to these cells, so the world reads the same in both.
import {key, disk, ring} from './hex.mjs';

export const REGIONS = {
  camp: {name: '林间营地', short: '营地', center: [0, 0]},
  creek: {name: '旧溪谷', short: '溪谷', center: [5, -1]},
  river: {name: '芦苇河湾', short: '河湾', center: [10, -2]}
};

// Landmark cells: every repair, generator and decoration anchors to one.
export const SPOTS = {
  shelter: [0, -2], hearth: [-1, 0], logs: [1, 1], fence: [-2, 2], garden: [1, -2],
  path: [3, 0], bridge: [4, -2], trough: [5, -3], spring: [7, -2],
  cattail: [9, -4], reeds: [12, -5], dock: [13, -2], jetty: [11, 0], boat: [12, 1]
};
export const CREEK_CELLS = [[2, -2], [3, -2], [4, -2], [5, -2], [6, -2]];
export const ROAD_CELLS = [[4, 0], [5, 0], [6, 0], [7, 0]];
// Placement of the measured creek art in world units (matches homecoming-world.mjs).
export const CREEK_ART = {x: 1.4, y: -2.78, width: 8.1, aspect: 339 / 2166};

const spotKeys = new Set(Object.values(SPOTS).map(c => key(...c)));
const creekKeys = new Set(CREEK_CELLS.map(c => key(...c)));
const roadKeys = new Set(ROAD_CELLS.map(c => key(...c)));
const blocked = c => spotKeys.has(key(...c)) || creekKeys.has(key(...c));

// Every cell a region can ever use, before debris and unlocks.
export const AREA = {
  camp: [...disk([0, 0], 2), ...ring([0, 0], 3)].filter(c => !blocked(c)),
  creek: [...ROAD_CELLS, [4, -1], [5, -1], [6, -1], [6, -3], [4, -3]].filter(c => !blocked(c)),
  river: [...disk([10, -2], 2), ...ring([10, -2], 3)].filter(c => !blocked(c) && !roadKeys.has(key(...c)))
};
const areaOf = new Map(Object.entries(AREA).flatMap(([region, cells]) => cells.map(c => [key(...c), region])));
export function regionOfCell(cell) {
  const k = key(...cell);
  if (areaOf.has(k)) return areaOf.get(k);
  if (creekKeys.has(k)) return 'creek';
  const spot = Object.entries(SPOTS).find(([, c]) => key(...c) === k)?.[0];
  if (spot) return SPOT_REGION[spot];
  return cell[0] <= 2 ? 'camp' : cell[0] >= 8 ? 'river' : 'creek';
}
// The old path is the gate between camp and creek, so it belongs to the camp.
export const SPOT_REGION = {shelter: 'camp', hearth: 'camp', logs: 'camp', fence: 'camp', garden: 'camp', path: 'camp', bridge: 'creek', trough: 'creek', spring: 'creek', cattail: 'river', reeds: 'river', dock: 'river', jetty: 'river', boat: 'river'};
export const ring1 = center => disk(center, 1);
export const isSpot = cell => spotKeys.has(key(...cell));
export const isCreek = cell => creekKeys.has(key(...cell));
export const spotAt = cell => Object.entries(SPOTS).find(([, c]) => key(...c) === key(...cell))?.[0] || null;
// Cells used to frame the camera on one region.
export function regionFrame(region, cells = AREA[region]) {
  const spots = Object.entries(SPOTS).filter(([id]) => SPOT_REGION[id] === region).map(([, c]) => c);
  return [...cells, ...spots, ...(region === 'creek' ? CREEK_CELLS : [])];
}
