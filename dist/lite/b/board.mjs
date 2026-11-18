import * as R from './rules.mjs';
import {createWorld, plateOf, PLATE} from '../shared/world.mjs';
import {renderScenery, renderLife, creekLayer} from '../shared/scenery.mjs';
import {key, neighbors, TILT} from '../shared/hex.mjs';
import {SPOTS, REGIONS, AREA, SPOT_REGION, regionFrame, regionOfCell} from '../shared/map.mjs';
import {hexBoundary} from '../../game.mjs';
import {matName, nameOf} from '../shared/art.mjs';
import {art, groundBox} from './art.mjs';
import {JOB_NAMES, WORKSHOPS} from './story.mjs';
import {icon} from '../shared/icons.mjs';

const workshopArt = (s,id) => id === 'logs' ? (R.generatorBetter(s,id) ? 'sawmill' : 'sawbuck') : R.GENERATORS[id].art;
const svgNS = 'http://www.w3.org/2000/svg';
const mid = (cells,project) => {
  const points = cells.map(project);
  return points.reduce(([x,y],[a,b]) => [x+a/points.length,y+b/points.length], [0,0]);
};
export function bayBoard(container, handlers) {
  const world=createWorld(container,{...handlers,liftPx:16},{asset:art,box:groundBox,plates:['world-storm','world'],extendEast:true});
  const creek = creekLayer(container,{bounds:{x:476,y:390,w:390,h:390/7},dry:art('bay-creek-dry'),flow:art('bay-creek-flow')});
  const rings = container.querySelector('.rings');
  const outlines = new Map();
  let terrainKey = '', landSceneKey = '', fogKey = '';
  function outline(id, shape, cls) {
    let el = outlines.get(id);
    if (!shape.length) { el?.remove(); outlines.delete(id); return; }
    const d = hexBoundary(shape).map(loop => loop.map(([x,y],i) => {
      return (i ? 'L' : 'M') + ((PLATE.origin[0]+x)*PLATE.cell).toFixed(1) + ' ' + ((PLATE.origin[1]+y*TILT)*PLATE.cell).toFixed(1);
    }).join(' ')+'Z').join(' ');
    if (!el) { el = document.createElementNS(svgNS,'path'); rings.append(el); outlines.set(id,el); }
    el.setAttribute('d',d); el.setAttribute('class',cls);
  }
  function showTerrain(s, selected) {
    const land = R.landCells(s), open = R.isOpen(s,'river');
    const signature = [open,s.healed.join('|'),selected?.id || '',s.stats.merges<1].join(':');
    if (signature === terrainKey) return;
    terrainKey = signature;
    const allowed = new Set(land.map(c => key(...c)));
    const entries = land.map(cell => ({cell,cls:'free'}));
    for (const tile of R.STORM.values()) {
      const id = key(...tile.cell);
      const show = R.isOpen(s,tile.region) && !s.healed.includes(id);
      const edge = show && neighbors(...tile.cell).some(n=>allowed.has(key(...n)));
      if (edge) entries.push({cell:tile.cell, cls:'storm edge'});
      const [q,r]=tile.cell, variant=Math.abs(q*37+r*13)%4;
      const material=['bay-drift','bay-kindling','bay-silt','bay-roots'][variant];
      world.decal('debris-'+id,edge?material:null,tile.cell,{cls:'debris',width:PLATE.cell*(.88+variant*.09),aspect:[146,124,129,122][variant]/256});
      const cached=R.salvageAt(tile);
      if (edge && cached) {
        const [x,y]=plateOf(tile.cell);
        world.upsertSprite('salvage-'+id,{name:matName(cached.chain,cached.level),foot:[x+1,y+1],extent:PLATE.cell*.72,lift:0,cls:'salvage'});
      } else world.removeSprite('salvage-'+id);
      const near = selected?.cell && neighbors(...selected.cell).some(c=>key(...c)===id);
      world.badge('debris-'+id,tile.cell,edge && (near || (!s.stats.merges && id==='-1,-1'))?'L'+tile.level:null);
    }
    world.setCells(entries);
    if (fogKey !== String(open)) {
      fogKey = String(open);
      world.fog('creek', open ? null : [...AREA.creek, ...AREA.river]);
    }
  }
  function showLandmarks(s) {
    const signature = [s.done.join('|'),s.trim,s.orderLog.includes('o1'),s.orderLog.includes('o2'),
      Object.entries(s.fittings || {}).map(([k,i])=>k+i.id).join('|')].join(':');
    if (landSceneKey === signature) return;
    landSceneKey = signature;
    renderScenery(world,s.done,{visible:spot=>R.isOpen(s,SPOT_REGION[spot])});
    for (const [id,g] of Object.entries(R.GENERATORS)) {
      const asset = workshopArt(s,id);
      if (asset && R.generatorOpen(s,id)) world.upsertSprite('gen-'+id,{name:asset,cell:SPOTS[g.spot],extent:PLATE.cell*(id==='logs'?1.88:2.1),lift:.10,cls:'gen'});
      else world.removeSprite('gen-'+id);
    }
    if (R.done(s,'roof')) {
      const [x,y]=plateOf(SPOTS.shelter);
      world.upsertSprite('porch-trim',{name:'trim-'+(s.trim==='chime'?'chime':'lantern'),foot:[x-PLATE.cell*.8,y+PLATE.cell*.33],lift:0,extent:PLATE.cell*.99,cls:'trim'});
    }
    if (s.orderLog.includes('o1')) {
      const [x,y]=plateOf(SPOTS.shelter);
      world.upsertSprite('bench-gift',{name:'bench',foot:[x+PLATE.cell*.79,y+PLATE.cell*.25],extent:PLATE.cell*.93,lift:0});
    }
    if (s.orderLog.includes('o2')) {
      const [x,y]=plateOf(SPOTS.logs);
      world.upsertSprite('toolbox-gift',{name:'toolbox',foot:[x+PLATE.cell*.58,y+PLATE.cell*.25],extent:PLATE.cell*.68,lift:0});
    }
    for (const r of R.REPAIRS) {
      const i = s.fittings?.[r.id], id='fit-'+r.id;
      if (!i) { world.removeSprite(id); continue; }
      const [x,y]=plateOf(SPOTS[r.spot]);
      world.upsertSprite(id,{name:matName(i.chain,i.level),foot:[x+14,y+8],lift:0,extent:PLATE.cell*1.15,cls:'fitting'});
    }
    creek.set(R.done(s,'stream')?'flow':s.fittings?.stream?'trial':'dry');
    renderLife(world,s.done,art);
  }
  function render(s,{region,job,selected=null,carried=null,onJob,onWorkshop}) {
    const picked = s.items.find(i=>i.id===selected);
    showTerrain(s,picked);showLandmarks(s);
    world.clearMarks('under-module');
    const live = new Set();
    for (const i of s.items) {
      const id = 'item-'+i.id, shape=R.occupiedCells(i);
      live.add(id);
      if (carried === i.id && world.spriteEl(id)) continue;
      const match = picked && picked.id!==i.id && i.chain===picked.chain && i.level===picked.level && i.level<7;
      const focus = !s.stats.merges && !s.done.length && i.chain==='wood';
      const cls = ['item',selected===i.id?'selected':'',match?'match-target':'',focus?'first-pair':'',carried===i.id?'lifted':''].join(' ');
      const extent=shape.length>1?2.55:1.10+i.level*.095;
      const el = world.upsertSprite(id,{name:matName(i.chain,i.level),cell:i.cell,foot:mid(shape,plateOf),lift:.10,
        extent:PLATE.cell*extent,cls});
      el.tabIndex = 0; el.setAttribute('role','button'); el.setAttribute('aria-label',nameOf(i.chain,i.level)+' L'+i.level);
      el.dataset.level = i.level;
      el.dataset.cells = shape.length;
      el.dataset.sizeLabel = 'L'+i.level+' · 3格';
      if(shape.length>1)for(const c of shape)world.markCell(c,'under-module');
      outline('shape-'+i.id,shape.length>1?shape:[],'wide-part');
    }
    for (const id of world.spriteIds()) if (id.startsWith('item-') && !live.has(id)) {
      world.removeSprite(id); outline('shape-'+id.slice(5),[],'');
    }
    for (const r of R.REPAIRS) {
      const id = 'job-'+r.id;
      if (job?.id!==r.id || SPOT_REGION[r.spot]!==region) { world.removePin(id); continue; }
      const [x,y] = plateOf(SPOTS[r.spot]), ready = !!R.progressFor(s,r).ready;
      world.upsertPin(id,{anchor:[x,y-PLATE.cell*1.36],cls:'clickable site waypoint'+(ready?' ready':''),label:'工地 · '+JOB_NAMES[r.id],
        html:ready ? icon.check+'<span>修复</span>' : icon.lamp+'<span>'+JOB_NAMES[r.id]+'</span>',onClick:()=>onJob(r)});
    }
    for (const [id,g] of Object.entries(R.GENERATORS)) {
      if (!R.generatorOpen(s,id) || g.region!==region) {world.removePin('shop-'+id);continue;}
      const [x,y] = plateOf(SPOTS[g.spot]);
      world.upsertPin('shop-'+id,{anchor:[x+PLATE.cell*.67,y+PLATE.cell*.47], cls:'clickable shop-pin',
        label:'采集 · '+WORKSHOPS[id],html:icon.energy,onClick:()=>onWorkshop(id)});
    }
  }
  function focus(s,region,animate=true) {
    const land = R.landCells(s).filter(c=>regionOfCell(c)===region),keys=new Set(land.map(c=>key(...c)));
    const rim = R.stormCells(s).filter(t=>t.region===region && neighbors(...t.cell).some(n=>keys.has(key(...n)))).map(t=>t.cell);
    const right=()=>container.clientWidth-document.querySelector('.field-book').offsetLeft+8;
    return world.fit(regionFrame(region,[...land,...rim]),{right,pad:.05,maxScale:1.82,top:44,bottom:44,overscroll:true,animate,duration:360});
  }
  return {world,render,focus,outline,creek};
}
