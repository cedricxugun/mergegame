// Thin adapter around the existing premium match-3 engine and UI. It keeps
// the Royal-Match-grade feel (swipe threshold, input buffering, power-up
// combos, flight effects) and swaps in themed pieces, the run summary and
// pre-level boosters.
import {m3Create, m3Move, M3_COLORS} from '../../match3-premium.mjs';
import {createMatch3UI} from '../../match3-premium-ui.mjs';
import {sprite, svgAsset} from '../shared/ui.mjs';

// Map engine colours to themed piece art. Engine order: leaf, book, crown, shield, gem.
const THEMED = ['piece-leaf', 'piece-berry', 'piece-sun', 'piece-drop', 'piece-flower'];
const POWER = {'premium-rocket': 'rocket', 'premium-tnt': 'tnt', 'premium-propeller': 'propeller', 'premium-orb': 'orb', 'premium-crate': 'crate', 'premium-mira': 'portrait-mira', 'craft-supply-box': 'chest', 'chest': 'chest', 'match-garden-bg': 'match-bg', 'm3-mud': 'piece-mud'};
export const PIECE_NAMES = ['叶子', '浆果', '星星', '水滴', '花朵'];
M3_COLORS.forEach((c, i) => { c.id = THEMED[i].replace('piece-', 'themed-'); c.name = PIECE_NAMES[i]; });
export function asset(name) {
  if (name.startsWith('premium-themed-')) return sprite('piece-' + name.slice(15));
  if (POWER[name]) return sprite(POWER[name]);
  if (name.startsWith('m3-')) return svgAsset(name);
  return sprite(name);
}

// Start a level with optional boosters already on the board.
export function createRun(level, {seed, boosters = [], extraMoves = 0} = {}) {
  let game = m3Create(level, {seed});
  game.moves += extraMoves;
  const powers = {rocket: 'row', bomb: 'bomb', orb: 'orb'};
  const spots = [24, 17, 31, 23, 25].filter(i => game.board[i] && !game.board[i].power);
  boosters.forEach((b, n) => { const i = spots[n]; if (i !== undefined) game.board[i] = {id: `boost${n}-${game.nextId++}`, color: null, power: powers[b]}; });
  // The engine validates moves + usedMoves against the level config, so keep
  // the extra moves out of the persisted config by tracking them here.
  return {version: 1, region: 'camp', winsBefore: 0, game, extraMoves};
}

export function mountMatch(root, {onWin, onExit, onLose, getSound, onToggleSound}) {
  let session = null;
  const ui = createMatch3UI({
    root, asset,
    onChange: s => { session = s; return true; },
    onExit: () => onExit(session),
    onClaim: s => onWin(s.game),
    onRetry: s => onLose(s.game),
    getSound, onToggleSound
  });
  return {
    show(run, context) { session = run; ui.show(run, context); },
    hide() { ui.hide(); },
    isBusy: () => ui.isBusy()
  };
}
export {m3Move};
