// Names, ground pivots and sprite boxes for the lite prototypes. Pivots are
// the same visually calibrated contact points as homecoming-ground.mjs; the
// WebP sprites keep the original crops, so the fractions still apply.
import {SPRITE_SIZES} from '../sprite-sizes.mjs';

export const CHAINS = {
  wood: {label: '木工', color: '#c98a47', names: ['木片', '木料束', '防雨补片', '加固组件', '施工支架', '屋架模块', '营建组件']},
  water: {label: '引水', color: '#4aa8d8', names: ['水滴', '集水碗', '净水罐', '引水组件', '蓄水组件', '水渠模块', '溪流组件']},
  reed: {label: '护岸', color: '#79b84a', names: ['芦芽', '幼苗', '芦苇束', '护岸草垫', '根系簇', '护岸绿带', '湿地组件']},
  dock: {label: '栈桥', color: '#b98b52', names: ['木条', '木板', '栈道板组', '基础桩', '栈桥组件', '泊位框架', '渡口模块']}
};
export const MAX_LEVEL = 7;
export const nameOf = (chain, level) => CHAINS[chain]?.names[level - 1] || '素材';
export const value = level => 2 ** (level - 1);
export const matName = (chain, level) => `mat-${chain}-${level}`;

const MATERIAL_PIVOTS = {
  wood: [[.50, .73], [.50, .77], [.50, .67], [.55, .73], [.51, .84], [.50, .77], [.51, .82]],
  water: [[.50, .93], [.50, .89], [.51, .90], [.53, .82], [.50, .82], [.53, .70], [.56, .73]],
  reed: [[.50, .87], [.51, .87], [.43, .79], [.53, .76], [.51, .85], [.51, .78], [.50, .82]],
  dock: [[.50, .74], [.50, .73], [.50, .79], [.51, .74], [.51, .73], [.51, .74], [.51, .81]]
};
const SCENE_PIVOTS = {roof: [.50, .87], home: [.50, .87], fire: [.50, .83], path: [.50, .77], spring: [.50, .79], stream: [.50, .77], reeds: [.50, .82], shore: [.50, .80], pier: [.50, .80], ferry: [.51, .82], shelter: [.50, .85], hearth: [.50, .83], dock: [.50, .80], trees: [.5, .9], flowers: [.5, .86], rocks: [.5, .86], log: [.5, .8]};

export function pivotOf(name) {
  if (name.startsWith('mat-')) { const [, chain, level] = name.split('-'); return MATERIAL_PIVOTS[chain][+level - 1]; }
  const k = name.replace(/^(scene-|ruin-|env-)/, '');
  return SCENE_PIVOTS[k] || [.5, .82];
}
export const sizeOf = name => SPRITE_SIZES[name] || [256, 256];

// Box in plate pixels for a sprite whose larger side equals `extent`.
export function spriteBox(name, foot, extent) {
  const [w0, h0] = sizeOf(name), unit = extent / Math.max(w0, h0), w = w0 * unit, h = h0 * unit, [u, v] = pivotOf(name);
  return {left: foot[0] - u * w, top: foot[1] - v * h, width: w, height: h};
}
