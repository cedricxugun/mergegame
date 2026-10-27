// Thin adapter around the existing premium match-3 engine and UI. It keeps the
// Royal-Match-grade feel (swipe threshold, input buffering, power-up combos,
// flight effects) and swaps in themed pieces, this prototype's levels, the
// run summary and pre-level boosters.
import {m3Create, M3_COLORS} from '../../match3-premium.mjs';
import {createMatch3UI} from '../../match3-premium-ui.mjs';
import {sprite, svgAsset} from '../shared/ui.mjs';

// Map engine colours to themed piece art. Engine order: leaf, berry, star, drop, flower.
const THEMED = ['leaf', 'berry', 'sun', 'drop', 'flower'];
export const PIECE_NAMES = ['叶子', '浆果', '星星', '水滴', '花朵'];
M3_COLORS.forEach((c, i) => { c.id = 'themed-' + THEMED[i]; c.name = PIECE_NAMES[i]; });
const ASSET = {'premium-rocket': 'rocket', 'premium-tnt': 'tnt', 'premium-propeller': 'propeller', 'premium-orb': 'orb', 'premium-crate': 'crate', 'premium-mira': 'portrait-mira', 'craft-supply-box': 'chest', chest: 'chest', 'match-garden-bg': 'match-bg', 'm3-mud': 'piece-mud'};
export function asset(name) {
  if (name.startsWith('premium-themed-')) return sprite('piece-' + name.slice(15));
  if (ASSET[name]) return sprite(ASSET[name]);
  if (name.startsWith('m3-')) return svgAsset(name);
  return sprite(name);
}
export const pieceArt = color => sprite('piece-' + THEMED[color]);

// Start a level with optional boosters already on the board.
export function createRun(level, def, {seed, boosters = [], extraMoves = 0} = {}) {
  const custom = {layout: def.layout, moves: def.moves + extraMoves, colors: def.colors, collect: def.collect};
  const game = m3Create(level, {seed, custom});
  const powers = {rocket: 'row', bomb: 'bomb', orb: 'orb'};
  const spots = [24, 17, 31, 23, 25, 10].filter(i => game.board[i] && !game.board[i].power);
  boosters.forEach((b, n) => { const i = spots[n]; if (i !== undefined) game.board[i] = {id: `t${game.nextId++}`, color: null, power: powers[b]}; });
  return {version: 1, region: 'camp', winsBefore: 0, game};
}

export function mountMatch(root, {onWin, onExit, onLose, getSound, onToggleSound, regionLabel}) {
  let session = null;
  const ui = createMatch3UI({
    root, asset, regionLabel,
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
