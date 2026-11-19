import * as R from './rules.mjs';
import {createWorld, plateOf, PLATE} from '../shared/world.mjs';
import {renderScenery, renderLife, creekLayer} from '../shared/scenery.mjs';
import {key, neighbors, TILT} from '../shared/hex.mjs';
import {SPOTS, REGIONS, SPOT_REGION, regionOfCell} from '../shared/map.mjs';
import {hexBoundary} from '../../game.mjs';
import {matName, nameOf} from '../shared/art.mjs';
import {art, groundBox} from './art.mjs';
import {JOB_NAMES, WORKSHOPS} from './story.mjs';
import {WORK_POCKETS} from './route.mjs';
import {installSettlement} from './settlement.mjs';
import {icon} from '../shared/icons.mjs';

const workshopArt = (s,id) => id === 'logs' ? (R.generatorBetter(s,id) ? 'sawmill' : 'sawbuck') : R.GENERATORS[id].art;
const svgNS = 'http://www.w3.org/2000/svg';
const mid = (cells,project) => {
  const points = cells.map(project);
  return points.reduce(([x,y],[a,b]) => [x+a/points.length,y+b/points.length], [0,0]);
};
export function bayBoard(container, handlers) {
  const world=createWorld(container,{...handlers,liftPx:0},{asset:art,box:groundBox,plates:['world-storm','world'],extendEast:true,directDrag:true,tileSize:.994});
  const creek = creekLayer(container,{bounds:{x:476,y:390,w:390,h:390/7},dry:art('bay-creek-dry'),flow:art('bay-creek-flow')});
  const life=installSettlement(world);
  const rings = container.querySelector('.rings');
  const beds=document.createElementNS(svgNS,'g');beds.setAttribute('class','meadow-beds');
  const turf=container.querySelector('svg.turf');turf.insertBefore(beds,turf.querySelector('.decals'));
  const outlines = new Map();
  let hovered=null;
  function hoverBuddy(id) {
    if(hovered===id)return;
    if(hovered)world.spriteEl('item-'+hovered)?.classList.remove('catching');
    hovered=id;
    if(id)world.spriteEl('item-'+id)?.classList.add('catching');
  }
  function entrance(spot) {
    if(spot==='dock')return world.plateToClient([1271,417]);
    if(spot==='bridge')return world.plateToClient([597,450]);
    if(spot==='spring')return world.plateToClient([827.4,416.5]);
    return world.cellToClient(SPOTS[spot]);
  }
  function previousScene(spot) {
    const el=world.spriteEl('site-'+spot);
    if(!el || matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
    const ghost=el.cloneNode(true);
    ghost.removeAttribute('data-id');ghost.removeAttribute('tabindex');ghost.setAttribute('aria-hidden','true');
    ghost.className='spr old-landmark';
    return ghost;
  }
  function buildInPlace(spot,ghost) {
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const el=world.spriteEl('site-'+spot), img=el?.querySelector('img');
    if(!img || (ghost && ghost.querySelector('img').src===img.src))return;
    if(ghost){
      el.before(ghost);ghost.style.zIndex=el.style.zIndex;
      const fade=ghost.animate([{opacity:1},{opacity:0}],{duration:195,fill:'forwards'});
      fade.finished.catch(()=>{}).finally(()=>ghost.remove());setTimeout(()=>ghost.remove(),260);
    }
    img.animate([{clipPath:'inset(88% 0 0)',opacity:.32},{clipPath:'inset(24% 0 0)',opacity:1,offset:.46},
      {clipPath:'inset(0 0 0)',opacity:1}],{duration:335,easing:'cubic-bezier(.22,.66,.3,1)'});
  }
  function shapePath(shape) {
    return hexBoundary(shape).map(loop=>loop.map(([x,y],i)=>
      (i?'L':'M')+((PLATE.origin[0]+x)*PLATE.cell).toFixed(1)+' '+((PLATE.origin[1]+y*TILT)*PLATE.cell).toFixed(1)).join(' ')+'Z').join(' ');
  }
  function frameWithScenery(cells,sites) {
    const base=world.rectOfCells(cells);
    let left=base.x,top=base.y,right=left+base.width,bottom=top+base.height;
    for(const spot of sites){
      const el=world.spriteEl('site-'+spot);
      if(!el)continue;
      left=Math.min(left,el.offsetLeft);top=Math.min(top,el.offsetTop);
      right=Math.max(right,el.offsetLeft+el.offsetWidth);bottom=Math.max(bottom,el.offsetTop+el.offsetHeight);
    }
    return {x:left,y:top,width:right-left,height:bottom-top};
  }
  function freightView() {
    const spots=['shelter','bridge','dock'], rect=frameWithScenery(spots.map(spot=>SPOTS[spot]),spots);
    return world.frame(rect,{top:50,bottom:32,pad:.55,maxScale:1.36,overscroll:true,animate:true,duration:460});
  }
  function jobLabelAt(spot) {
    const [x,y]=plateOf(SPOTS[spot]);
    // The step between the door and the fire stays clear for returning supplies.
    return spot==='hearth'?[x-PLATE.cell*1.16,y-PLATE.cell*.96]:[x,y-PLATE.cell*1.36];
  }
  let terrainKey='',landSceneKey='';
  const fog=container.querySelector('svg.fog');
  const mist=document.createElementNS(svgNS,'linearGradient');mist.id='east-mist';mist.setAttribute('gradientUnits','userSpaceOnUse');mist.setAttribute('x1','570');mist.setAttribute('x2','1080');
  for(const [at,alpha] of [['0','0'],['.52','.26'],['1','.60']]){
    const stop=document.createElementNS(svgNS,'stop');stop.setAttribute('offset',at);stop.setAttribute('stop-color','#c8ddd9');stop.setAttribute('stop-opacity',alpha);mist.append(stop);
  }
  fog.querySelector('defs').append(mist);
  const veil=document.createElementNS(svgNS,'rect');veil.setAttribute('width','1536');veil.setAttribute('height','1024');veil.setAttribute('fill','url(#east-mist)');veil.setAttribute('class','valley-mist');fog.append(veil);
  function siteArt(s,spot,name) {
    if(spot==='spring'){
      const foot=[827.4,416.5];
      if(s.fittings?.stream)return {name:'water-fitting',foot,extent:PLATE.cell*3.034,lift:0,cls:'trial-scene'};
      if(name==='scene-spring')return {foot,extent:PLATE.cell*2.4,lift:0};
    }
    if(spot==='dock'){
      if(s.fittings?.ferry)return {name:'ferry-fitting',extent:PLATE.cell*3.95,lift:0,cls:'trial-scene'};
      if(name==='scene-ferry')return {extent:PLATE.cell*4.36,lift:0};
      if(name==='scene-pier')return {foot:[1285.4,401.3],extent:PLATE.cell*1.65,lift:0};
    }
    if(spot==='bridge' && name==='scene-stream')return {foot:[625,423.5],extent:PLATE.cell*2.10,lift:0};
    if(name==='scene-roof'||name==='scene-home')return {extent:PLATE.cell*(name==='scene-home'?3.4:2.78),lift:.13};
    return {};
  }
  function outline(id, shape, cls) {
    let el = outlines.get(id);
    if (!shape.length) { el?.remove(); outlines.delete(id); return; }
    const d=shapePath(shape);
    if (!el) { el = document.createElementNS(svgNS,'path'); rings.append(el); outlines.set(id,el); }
    el.setAttribute('d',d); el.setAttribute('class',cls);
  }
  function showTerrain(s,region) {
    const land = R.landCells(s), open = R.isOpen(s,'river');
    const signature = [region,s.done.join('|'),s.healed.join('|')].join(':');
    if (signature === terrainKey) return;
    terrainKey = signature;
    const allowed = new Set(land.map(c => key(...c)));
    const pocketKeys=new Set(Object.values(WORK_POCKETS).flat().map(c=>key(...c)));
    const entries=land.map(cell=>{
      const area=regionOfCell(cell);
      return {cell,cls:'free '+area+(area===region?' local':' distant')+(pocketKeys.has(key(...cell))?' yard':'')};
    });
    beds.replaceChildren();
    for(const [id,cells] of Object.entries(WORK_POCKETS)){
      const usable=cells.filter(c=>allowed.has(key(...c)));
      if(!usable.length)continue;
      const bed=document.createElementNS(svgNS,'path');bed.dataset.yard=id;
      bed.setAttribute('class',R.GENERATORS[id].region===region?'near-yard':'far-yard');
      bed.setAttribute('d',shapePath(usable));beds.append(bed);
    }
    for (const tile of R.STORM.values()) {
      const id = key(...tile.cell);
      const show = R.isOpen(s,tile.region) && !allowed.has(id);
      const edge = show && neighbors(...tile.cell).some(n=>allowed.has(key(...n)));
      if (edge) entries.push({cell:tile.cell, cls:'storm edge'+(tile.region===region?' local':' distant')});
      const [q,r]=tile.cell, variant=Math.abs(q*37+r*13)%4;
      const material=['bay-drift','bay-kindling','bay-silt','bay-roots'][variant];
      const nearby=tile.region===region;
      world.decal('debris-'+id,edge?material:null,tile.cell,{cls:nearby?'debris':'debris distant',width:PLATE.cell*(.88+variant*.09),aspect:[146,124,129,122][variant]/256});
      const cached=R.salvageAt(tile);
      if (edge && nearby && cached) {
        const [x,y]=plateOf(tile.cell);
        world.upsertSprite('salvage-'+id,{name:matName(cached.chain,cached.level),foot:[x+1,y+1],extent:PLATE.cell*.72,lift:0,cls:'salvage'});
      } else world.removeSprite('salvage-'+id);
    }
    world.setCells(entries);
    veil.style.opacity=open?'0':'1';
  }
  function previewLanding(s, piece, target) {
    world.clearMarks('will-open');
    world.clearMarks('could-open');
    if(!piece || !target || piece.level>=7)return;
    const partners=Array.isArray(target)?target:[target];
    for(const partner of partners) {
      if(!partner.cell || piece.id===partner.id || piece.chain!==partner.chain || piece.level!==partner.level)continue;
      const cells=R.clearableBeside(s,partner.cell,partner.level+1);
      if(cells.length && piece.level>=5 && !R.merge(s,piece.id,partner.id).ok)continue;
      for(const cell of cells)world.markCell(cell,partners.length>1?'could-open':'will-open');
    }
  }
  function showLandmarks(s) {
    const signature = [s.done.join('|'),s.trim,s.orderLog.includes('o1'),s.orderLog.includes('o2'),
      Object.entries(s.fittings || {}).map(([k,i])=>k+i.id).join('|')].join(':');
    if (landSceneKey === signature) return;
    landSceneKey = signature;
    renderScenery(world,s.done,{visible:spot=>R.isOpen(s,SPOT_REGION[spot]),appearance:(spot,info)=>siteArt(s,spot,info.art)});
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
      if (!i || r.id==='stream' || r.id==='ferry') { world.removeSprite(id); continue; }
      const [x,y]=plateOf(SPOTS[r.spot]);
      world.upsertSprite(id,{name:matName(i.chain,i.level),foot:[x+14,y+8],lift:0,extent:PLATE.cell*1.15,cls:'fitting'});
    }
    creek.set(R.done(s,'stream')?'flow':s.fittings?.stream?'trial':'dry');
    renderLife(world,s.done,art);
    life.sync(s);
  }
  function render(s,{region,job,selected=null,carried=null,showSource=null,onJob,onWorkshop,alternate=null,onChoose}) {
    const picked = s.items.find(i=>i.id===selected);
    showTerrain(s,region);showLandmarks(s);
    container.classList.toggle('handling',!!picked || !!carried);
    const partners=picked?s.items.filter(i=>i.id!==picked.id && i.chain===picked.chain && i.level===picked.level && regionOfCell(i.cell)===regionOfCell(picked.cell)):[];
    previewLanding(s,picked,partners);
    world.clearMarks('under-module');
    const live = new Set();
    for (const i of s.items) {
      const id = 'item-'+i.id, shape=R.occupiedCells(i);
      live.add(id);
      if (carried===i.id) {
        outline('shape-'+i.id,[],'');
        if(world.spriteEl(id))continue;
      }
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
      if(shape.length>1 && carried!==i.id)for(const c of shape)world.markCell(c,'under-module');
      outline('shape-'+i.id,shape.length>1 && carried!==i.id?shape:[],'wide-part');
    }
    for (const id of world.spriteIds()) if (id.startsWith('item-') && !live.has(id)) {
      world.removeSprite(id); outline('shape-'+id.slice(5),[],'');
    }
    for (const r of R.REPAIRS) {
      const id = 'job-'+r.id;
      if(alternate?.id===r.id && !carried && !selected && r.id!==job?.id && R.isOpen(s,SPOT_REGION[r.spot])){
        const pin=world.upsertPin(id,{anchor:jobLabelAt(r.spot),cls:'clickable site waypoint route-fork',label:'改去'+JOB_NAMES[r.id],
          html:icon.map+'<span>'+JOB_NAMES[r.id]+'</span>',onClick:()=>onChoose(r.id)});
        pin.dataset.site=r.spot;continue;
      }
      if (job?.id!==r.id || SPOT_REGION[r.spot]!==region) { world.removePin(id); continue; }
      const ready = !!R.progressFor(s,r).ready;
      const canFit=picked && picked.chain===r.chain && r.level>=5 && picked.level===r.level-1 && !ready;
      const pinText=ready?'送到这里':canFit?'可试装':JOB_NAMES[r.id];
      const pin=world.upsertPin(id,{anchor:jobLabelAt(r.spot),cls:'clickable site waypoint'+(ready?' ready':''),label:'工地 · '+JOB_NAMES[r.id],
        html:(ready?icon.check:icon.lamp)+'<span>'+pinText+'</span>',onClick:()=>onJob(r)});
      pin.dataset.site=r.spot;
    }
    for (const [id,g] of Object.entries(R.GENERATORS)) {
      if (!R.generatorOpen(s,id) || g.region!==region) {world.removePin('shop-'+id);continue;}
      const [x,y] = plateOf(SPOTS[g.spot]);
      const showVerb=showSource===id;
      world.upsertPin('shop-'+id,{anchor:[x+PLATE.cell*.67,y+PLATE.cell*.47],cls:'clickable shop-pin'+(showVerb?' named':''),
        label:'采集 · '+WORKSHOPS[id]+'，消耗 1 体力',html:showVerb?'<span>取料</span>'+icon.energy+'1':icon.energy,onClick:()=>onWorkshop(id)});
    }
  }
  function focus(s,region,animate=true,job=null) {
    const sources=Object.entries(R.GENERATORS).filter(([id,g])=>g.region===region && R.generatorOpen(s,id));
    const cells=[...sources.flatMap(([id,g])=>[SPOTS[g.spot],...WORK_POCKETS[id].filter(c=>R.isLand(s,c))]),
      ...s.items.filter(i=>regionOfCell(i.cell)===region).flatMap(i=>R.occupiedCells(i))];
    if(job && SPOT_REGION[job.spot]===region)cells.push(SPOTS[job.spot]);
    else cells.push(REGIONS[region].center);
    if(region==='camp')cells.push(SPOTS.shelter,SPOTS.hearth);
    if(region==='river')cells.push(SPOTS.dock);
    const tilePixels=Math.min(98, Math.max(56,container.clientHeight*.173));
    const landmarks=sources.map(([,g])=>g.spot);
    if(job && SPOT_REGION[job.spot]===region)landmarks.push(job.spot);
    if(region==='camp')landmarks.push('shelter');
    if(region==='river')landmarks.push('dock');
    return world.frame(frameWithScenery(cells,landmarks),{pad:.37,maxScale:tilePixels/(PLATE.cell*Math.sqrt(3)),top:50,bottom:38,overscroll:true,animate,duration:390});
  }
  return {world,render,focus,freightView,outline,creek,previewLanding,hoverBuddy,life,entrance,previousScene,buildInPlace};
}
