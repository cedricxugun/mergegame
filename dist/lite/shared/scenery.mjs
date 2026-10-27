// Draws the chapter's landmarks on the world: ruins before a repair, the
// finished scene after, the creek running dry or full, and the living touches
// (smoke, egret, rowing boat, residents) that appear as repairs land.
import {PLATE, plateOf} from './world.mjs';
import {SPOTS, CREEK_ART} from './map.mjs';
import {REPAIRS, spotArt} from './chapter.mjs';
import {sprite} from './ui.mjs';

// Footprint size of each finished scene, in hex radii.
const EXTENT = {
  'scene-roof': 2.5, 'scene-home': 3.2, 'scene-fire': 2.1, 'v11-cookfire': 2.3, 'v11-fence': 2.4, 'scene-path': 2.3,
  'scene-spring': 2.4, 'v11-trough': 2.4, 'v11-cattail': 1.8, 'scene-reeds': 2.3, 'scene-shore': 2.8, 'env-flowers': 1.9,
  'scene-pier': 2.5, 'scene-ferry': 3.2, 'v11-jetty': 2.1, 'scene-stream': 2.9,
  'ruin-shelter': 2.4, 'ruin-hearth': 2.1, 'ruin-path': 2.2, 'ruin-spring': 2.1, 'ruin-reeds': 2.1, 'ruin-dock': 2.4
};
const RUIN_SPOTS = [...new Set(REPAIRS.map(r => r.spot))];

export function renderScenery(world, done, {visible = () => true, glow = new Set(), dim = () => false} = {}) {
  for (const spot of RUIN_SPOTS) {
    const id = 'site-' + spot, info = spotArt(done, spot);
    if (!info || !visible(spot)) { world.removeSprite(id); continue; }
    world.upsertSprite(id, {name: info.art, cell: SPOTS[spot], extent: PLATE.cell * (EXTENT[info.art] || 2.3), lift: .25,
      cls: `site ${info.done ? 'fixed' : 'ruin'} ${glow.has(spot) ? 'can-drop' : ''} ${dim(spot) ? 'dim' : ''}`});
  }
}

// The creek bed is part of the plate; the flowing version sits on top.
export function creekLayer(container) {
  let el = container.querySelector('.creek');
  if (!el) {
    el = document.createElement('div'); el.className = 'creek';
    const x = (CREEK_ART.x + PLATE.origin[0]) * PLATE.cell, y = (CREEK_ART.y + PLATE.origin[1]) * PLATE.cell, w = CREEK_ART.width * PLATE.cell;
    Object.assign(el.style, {left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${w * CREEK_ART.aspect}px`});
    el.innerHTML = `<img class="dry" src="${sprite('creek-dry')}" alt=""><img class="flow" src="${sprite('creek-flow')}" alt="">`;
    container.querySelector('.world-inner').insertBefore(el, container.querySelector('.turf'));
  }
  return {
    set(state) { el.dataset.state = state; },
    async fill() {
      el.dataset.state = 'filling';
      await new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2200));
      el.dataset.state = 'flow';
    }
  };
}

// Small living details, keyed by the repair that brings them.
const LIFE = [
  {after: 'fire', id: 'smoke', spot: 'hearth', html: '<i></i><i></i><i></i>', dx: 0, dy: -2.2},
  {after: 'shore', id: 'egret', spot: 'reeds', art: 'v11-egret', size: 1.5, dx: .8, dy: -.2},
  {after: 'home', id: 'lamp', spot: 'shelter', html: '<i></i>', dx: -1.1, dy: -.6}
];
export function renderLife(world, done) {
  const root = world.container.querySelector('.world-inner');
  for (const l of LIFE) {
    let el = root.querySelector(`[data-life="${l.id}"]`);
    if (!done.includes(l.after)) { el?.remove(); continue; }
    if (el) continue;
    el = document.createElement('div'); el.className = `life life-${l.id}`; el.dataset.life = l.id;
    const [x, y] = plateOf(SPOTS[l.spot]), px = x + l.dx * PLATE.cell, py = y + l.dy * PLATE.cell;
    if (l.art) { const s = l.size * PLATE.cell; el.innerHTML = `<img src="${sprite(l.art)}" alt="">`; Object.assign(el.style, {left: `${px - s / 2}px`, top: `${py - s}px`, width: `${s}px`, height: `${s}px`, zIndex: String(Math.round(py * 2))}); }
    else { el.innerHTML = l.html; Object.assign(el.style, {left: `${px}px`, top: `${py}px`, zIndex: '4000'}); }
    root.querySelector('.sprites').append(el);
  }
}
