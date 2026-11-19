import {spriteBox} from '../shared/art.mjs';
import {MATERIAL_METRICS} from './material-metrics.mjs';
import {LANDMARK_METRICS} from './landmark-metrics.mjs';
import {RIVER_METRICS} from './river-metrics.mjs';
import {SCENIC_METRICS} from './scenic-metrics.mjs';
import {LIFE_METRICS} from './life-metrics.mjs';
import {FITTING_METRICS} from './fitting-metrics.mjs';

const metrics = {
  ...MATERIAL_METRICS, ...LANDMARK_METRICS, ...RIVER_METRICS, ...SCENIC_METRICS, ...LIFE_METRICS, ...FITTING_METRICS,
  sawbuck: {size:[320,320], pivot:[.48,.76]},
  sawmill: {size:[320,299], pivot:[.51,.79]},
  bench: {size:[256,184], pivot:[.50,.788]},
  toolbox: {size:[256,200], pivot:[.52,.79]},
  'trim-lantern': {size:[256,256], pivot:[98/256,228/256]},
  'creek-bank-dry': {size:[288,80], pivot:[.5,69/80]},
  'creek-bank-alive': {size:[288,80], pivot:[.5,69/80]},
  'trim-chime': {size:[256,256], pivot:[98/256,228/256]}
};

export function bayFile(file) {
  return globalThis.BAY_ASSETS?.[file] || new URL('../../assets/bay/' + file, import.meta.url).href;
}
export const art = name => bayFile(name + '.webp');
export function groundBox(name, foot, extent) {
  const spec = metrics[name];
  if (!spec) return spriteBox(name, foot, extent);
  const [w,h] = spec.size, scale = extent / Math.max(w,h);
  return {left:foot[0] - w*scale*spec.pivot[0], top:foot[1] - h*scale*spec.pivot[1], width:w*scale, height:h*scale};
}

const clips = new Map();
export function materialSound(chain, muted) {
  if (muted) return;
  let pool = clips.get(chain);
  if (!pool) {
    pool = Array.from({length: 3}, () => new Audio(bayFile(chain + '.wav')));
    clips.set(chain, pool);
  }
  const clip = pool.find(a => a.paused || a.ended) || pool[0];
  clip.currentTime = 0;
  clip.volume = .64;
  clip.play().catch(() => {});
}
