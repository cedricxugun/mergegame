// Slices the original atlases into display-sized WebP sprites for the two
// lightweight prototypes. Source PNGs/SVGs are read only. Requires `sharp`,
// which resolves from the parent workspace's node_modules.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {ART_FRAMES} from '../dist/homecoming-art-frames.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dist', 'assets');
const out = path.join(src, 'lite');
await fs.mkdir(out, {recursive: true});

const atlases = {
  'craft-wood-atlas': [...Array(7)].map((_, i) => `mat-wood-${i + 1}`),
  'craft-water-atlas': [...Array(7)].map((_, i) => `mat-water-${i + 1}`),
  'craft-reed-atlas': [...Array(7)].map((_, i) => `mat-reed-${i + 1}`),
  'craft-dock-atlas': [...Array(7)].map((_, i) => `mat-dock-${i + 1}`),
  'craft-camp-scenes-v14': ['scene-roof', 'scene-fire', 'scene-path', 'scene-home'],
  'craft-river-scenes-v14': ['scene-spring', 'scene-stream', 'scene-reeds', 'scene-shore', 'scene-pier', 'scene-ferry'],
  'craft-ruins-atlas': ['ruin-shelter', 'ruin-hearth', 'ruin-path', 'ruin-spring', 'ruin-reeds', 'ruin-dock'],
  'craft-forest-props-v14': ['env-trees', 'env-flowers', 'env-rocks', 'env-log'],
  'craft-ground-contact-v16': ['ground-light', 'ground-dark', 'ground-chips', 'ground-mud', 'ground-roots', 'ground-gravel']
};
// The earlier (v11) scene atlases hold distinct designs that are not in the
// measured frame table; their alpha bounds were measured once (alpha > 40).
const EXTRA_FRAMES = {
  'craft-camp-scenes': {
    'v11-shelter': [90, 53, 606, 560], 'v11-cookfire': [720, 111, 1173, 556],
    'v11-fence': [72, 731, 579, 1155], 'v11-cabin': [668, 640, 1200, 1171]
  },
  'craft-river-scenes': {
    'v11-pond': [162, 188, 365, 357], 'v11-trough': [658, 175, 893, 368], 'v11-cattail': [1168, 168, 1341, 368],
    'v11-egret': [155, 645, 366, 858], 'v11-jetty': [672, 674, 867, 846], 'v11-boat': [1155, 651, 1400, 859]
  }
};
const maxSide = name => name.startsWith('mat-') ? 256 : name.startsWith('ground-') ? 320 : name.startsWith('v11-') && !/shelter|cookfire|fence|cabin/.test(name) ? 240 : 420;
const manifest = {};

async function write(name, pipeline, quality = 82) {
  const file = path.join(out, `${name}.webp`);
  const info = await pipeline.webp({quality, alphaQuality: 90, effort: 5}).toFile(file);
  manifest[name] = [info.width, info.height];
  return info.size;
}
const fit = (name, width, height) => { const side = maxSide(name), scale = Math.min(1, side / Math.max(width, height)); return [Math.round(width * scale), Math.round(height * scale)]; };

let bytes = 0;
for (const [atlas, names] of Object.entries(atlases)) {
  const frames = ART_FRAMES[atlas].frames;
  for (const [index, name] of names.entries()) {
    const [left, top, width, height] = frames[index];
    bytes += await write(name, sharp(path.join(src, `${atlas}.png`)).extract({left, top, width, height}).resize(...fit(name, width, height), {kernel: 'lanczos3'}));
  }
}
for (const [atlas, frames] of Object.entries(EXTRA_FRAMES)) {
  for (const [name, [x0, y0, x1, y1]] of Object.entries(frames)) {
    const left = Math.max(0, x0 - 8), top = Math.max(0, y0 - 8), width = x1 - x0 + 16, height = y1 - y0 + 16;
    bytes += await write(name, sharp(path.join(src, `${atlas}.png`)).extract({left, top, width, height}).resize(...fit(name, width, height), {kernel: 'lanczos3'}));
  }
}

// The two creek states share one measured crop, so they stay registered.
for (const state of ['dry', 'flow']) {
  bytes += await write(`creek-${state}`, sharp(path.join(src, `craft-creek-${state}-v15.png`))
    .extract({left: 5, top: 194, width: 2166, height: 339}).resize(1300));
}
bytes += await write('homeland', sharp(path.join(src, 'craft-homeland-v15b.png')), 80);
// Storm-gloom version of the same plate; repairs reveal the colour plate over it.
bytes += await write('homeland-gloom', sharp(path.join(src, 'craft-homeland-v15b.png'))
  .modulate({brightness: 0.8, saturation: 0.32})
  .composite([{input: {create: {width: 1536, height: 1024, channels: 4, background: {r: 64, g: 80, b: 104, alpha: 0.2}}}, blend: 'over'}]), 78);
bytes += await write('match-bg', sharp(path.join(src, 'match-garden-bg.png')).resize(720), 78);
for (const [name, file, side] of [
  ['portrait-mira', 'premium-mira', 300], ['portrait-lina', 'craft-lina', 300], ['portrait-rowan', 'craft-rowan', 300],
  ['chest', 'craft-supply-box', 256], ['crate', 'premium-crate', 160], ['rocket', 'premium-rocket', 176],
  ['tnt', 'premium-tnt', 176], ['propeller', 'premium-propeller', 176], ['orb', 'premium-orb', 176]
]) bytes += await write(name, sharp(path.join(src, `${file}.png`)).resize(side, side, {fit: 'inside'}));
// Themed match-three pieces from the original flat SVGs.
for (const name of ['leaf', 'drop', 'berry', 'sun', 'flower', 'mud'])
  bytes += await write(`piece-${name}`, sharp(path.join(src, `m3-${name}.svg`), {density: 300}).resize(160, 160, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}}), 88);

await fs.writeFile(path.join(root, 'dist', 'lite', 'sprite-sizes.mjs'),
  '// Generated by scripts/build-lite-assets.mjs: [width, height] of each WebP sprite.\n' +
  `export const SPRITE_SIZES=${JSON.stringify(manifest)};\n`);
console.log(`Wrote ${Object.keys(manifest).length} sprites, ${(bytes / 1048576).toFixed(2)} MB total.`);
