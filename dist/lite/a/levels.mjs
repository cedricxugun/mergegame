// Thirty match-three levels for prototype A, written for this story: crates
// are storm debris (planks to bring home), mud is flood silt, and colour goals
// ask for the material the next repair needs (drops for the spring, leaves for
// the reeds). Engine colours: 0 leaf, 1 berry, 2 star, 3 drop, 4 flower.
// Layout legend: '.' piece, '#' hole, 'C' crate, '2' double crate, 'M' mud.
const L = (rows, moves, opts = {}) => ({layout: rows, moves, colors: opts.colors ?? 5, collect: opts.collect || [], hint: opts.hint || ''});

export const LEVELS = [
  // Camp: clearing storm debris
  L(['.......', '.......', '.......', '.......', '.......', '.......', 'CCCCCCC', '#CCCCC#'], 24, {colors: 4, hint: '在木箱旁边消除，木箱就会裂开'}),
  L(['#.....#', '.......', '.......', '.......', '..CCC..', '..CCC..', '.CC.CC.', '#CC.CC#'], 25, {colors: 4}),
  L(['.......', '.......', '.......', 'C.....C', 'C.....C', 'CC...CC', 'CC...CC', 'CCCCCCC'], 26, {colors: 4, hint: '四个连成一排，会变成火箭'}),
  L(['.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......'], 20, {colors: 4, collect: [[2, 18], [1, 18]], hint: '收集星星和浆果'}),
  L(['##...##', '#.....#', '.......', '.......', '..MMM..', '..MMM..', '.CCCCC.', '.CCCCC.'], 27, {hint: '在泥地上消除，冲掉淤泥'}),
  L(['.......', '.......', '.......', 'CC...CC', '.......', '..CCC..', 'CC...CC', 'CC...CC'], 27),
  L(['#.....#', '.......', '.......', '.......', 'C..C..C', 'C..C..C', 'C..C..C', 'CCCCCCC'], 27),
  L(['.......', '.......', '..MMM..', '..MMM..', '..MMM..', 'CC...CC', 'CC...CC', '.CCCCC.'], 28),
  L(['.......', '.......', '.......', '.......', 'C.....C', '2C...C2', '2CC.CC2', '222C222'], 32, {hint: '带横木的箱子要敲两下'}),
  L(['#.....#', '.......', '.......', '.......', 'MMMMMMM', 'CC...CC', 'CC...CC', 'CCCCCCC'], 28),
  // Creek valley: the spring and the trough want water
  L(['.......', '.......', '.......', '.......', '.......', '..CCC..', 'CC...CC', 'CCCCCCC'], 26, {collect: [[3, 22]], hint: '收集水滴，泉眼要用'}),
  L(['##...##', '#.....#', '.......', '.......', '.......', 'CC...CC', 'CC...CC', '2222222'], 30),
  L(['.......', '.......', 'MMMMMMM', 'M.....M', 'M.....M', 'CC...CC', 'CC...CC', 'CCCCCCC'], 29),
  L(['.......', '.......', '.......', '..CCC..', '.......', 'CC...CC', 'CC...CC', 'C2CCC2C'], 28, {collect: [[3, 20]]}),
  L(['#.....#', '.......', '.......', 'C.....C', 'C.....C', 'CM...MC', 'CCMMMCC', '222C222'], 30),
  L(['.......', '.......', '.......', '..CCC..', '..CCC..', 'C.....C', 'CC...CC', '2222222'], 31, {collect: [[3, 20]]}),
  // River bend: reeds want leaves, the pier wants planks
  L(['##...##', '#.....#', '.......', '.......', 'MMMMMMM', 'CC...CC', 'CC...CC', '22CCC22'], 31, {collect: [[0, 20]], hint: '收集叶子，河岸要种芦苇'}),
  L(['.......', '.......', 'C.....C', 'C.....C', 'CM...MC', 'CM...MC', 'CCMMMCC', '222C222'], 31),
  L(['.......', '.......', '.......', '.......', 'C..C..C', 'C..C..C', '2..2..2', '2CC2CC2'], 29, {collect: [[0, 22]]}),
  L(['#.....#', '.......', '.......', 'MMMMMMM', '..MMM..', 'C.....C', '2C...C2', '22CCC22'], 31),
  L(['.......', '.......', '.......', 'C.....C', 'CM...MC', 'CM...MC', 'CCMMMCC', '2222222'], 31, {collect: [[0, 18], [3, 18]]}),
  L(['##...##', '#.....#', '.......', '.......', 'MMCCCMM', 'CCMMMCC', '2C...C2', '2222222'], 32),
  L(['.......', '...#...', '.......', '.......', '#.....#', 'CC...CC', '2C...C2', '2222222'], 33, {collect: [[4, 16]]}),
  L(['#.....#', '##...##', '.......', 'MM...MM', 'MM...MM', 'C.....C', 'CC...CC', 'C22222C'], 31),
  L(['.......', '.......', '..2.2..', '.......', '.C.C.C.', 'C.C.C.C', '2C2C2C2', 'CCCCCCC'], 32),
  // Homecoming: the ferry and the feast
  L(['.......', '#.....#', '.......', 'MMMMMMM', 'MMMMMMM', 'C.....C', 'CC...CC', '2222222'], 32, {collect: [[1, 20]]}),
  L(['##...##', '.......', '.......', '.......', 'C.CCC.C', 'C.C2C.C', 'C.2.2.C', '2222222'], 35),
  L(['.......', '.......', '.......', '.M.M.M.', 'M.M.M.M', 'CMCMCMC', '2C2C2C2', '2222222'], 36, {collect: [[3, 18]]}),
  L(['#.....#', '.......', '.......', 'MMCCCMM', 'MC2C2CM', 'C2...2C', '22...22', '2222222'], 37),
  L(['.......', '.......', '.......', 'MM...MM', 'C2...2C', '2C2C2C2', 'C22222C', '2222222'], 38, {collect: [[0, 16], [3, 16]], hint: '最后一关：把剩下的风暴都清掉'})
];
export const LEVEL_COUNT = LEVELS.length;
// Beyond the authored levels, later layouts repeat with a few extra moves.
export function levelFor(n) {
  if (n <= LEVEL_COUNT) return LEVELS[n - 1];
  const base = LEVELS[15 + (n - LEVEL_COUNT - 1) % 15];
  return {...base, moves: base.moves + 2};
}
