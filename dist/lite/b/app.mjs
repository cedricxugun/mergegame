// Merge directly in the homeland. Rules commit before presentation.
// A held drag uses its own draft until the player releases it on the map.
import * as R from './rules.mjs';
import {recoverHomeland} from './resume.mjs';
import * as V from './views.mjs';
import {bayBoard} from './board.mjs';
import {plateOf,cellOfPlate,PLATE} from '../shared/world.mjs';
import {hitEllipse,hoverAt,firstCrossing,softLanding,pulsePiece} from './handling.mjs';
import {routeChoices,secondWay,freightOpen,REPAIR_CLEARINGS} from './route.mjs';
import {art, materialSound} from './art.mjs';
import {WORKSHOPS, CHAIN_SHOP, JOB_NAMES, BENEFITS} from './story.mjs';
import {REGIONS, SPOTS, SPOT_REGION, regionOfCell, spotAt} from '../shared/map.mjs';
import {matName, nameOf, CHAINS} from '../shared/art.mjs';
import {key,parseKey,distance} from '../shared/hex.mjs';
import {CAST, DIARY, LETTER} from '../shared/chapter.mjs';
import {createStore,createMetrics} from '../shared/store.mjs';
import {$, sheet, esc} from '../shared/ui.mjs';
import {sfx, setMuted, unlock} from '../shared/audio.mjs';
import {burst, ring, fly, squash, haptic, centerOf, reducedMotion} from '../shared/fx.mjs';
import {icon} from '../shared/icons.mjs';

const launchUrl=new URL(location.href);
const practice = launchUrl.searchParams.get('visit') === 'wharf';
const store = createStore('forest-camp.lite-b' + (practice ? '.ferry-practice' : ''), R.VERSION);
if(launchUrl.searchParams.has('fresh')) {
  const clean=new URL(location.href);clean.searchParams.delete('fresh');
  try {history.replaceState(null,'',clean.href);} catch { /* Some file viewers disable history writes. */ }
}
const saved = store.load(()=>null) || {};
const recovery=recoverHomeland(saved.state);
if(recovery.backup) {
  try { const key='forest-camp.lite-b.counter-backup';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(saved)); } catch { /* The active save can still be used. */ }
}
let state=recovery.state || (practice ? R.wharfPractice() : R.beginVoyage());
R.refillOrders(state);
let region = REGIONS[saved.view] && R.isOpen(state,saved.view) ? saved.view : practice ? 'river' : 'camp';
let tracked = saved.tracked;
let selected=null,drag=null,busy=false,feedbackTimer=0,tour=null,alternate=null,forkTimer=0;
let muted = !!saved.muted, vibrations = saved.vibrations !== false;
const metrics = createMetrics(saved.metrics);
setMuted(muted);
const app = $('#app');
app.classList.add('bay-app');
document.body.classList.add('bay-body');
document.body.style.setProperty('--postcard', 'url("'+art('river-postcard')+'")');
document.body.style.setProperty('--homeland','url("'+art('world')+'")');
app.innerHTML=V.shell();
const field=$('.playfield'), board=bayBoard($('#world'),{canPress:()=>!busy,onTap:tapTile,onPress:unlock,onDragStart:lift,onDragMove:carry,onDragEnd:drop,onPanEnd:syncPannedRegion});
const {world}=board;
const pulse = ms => { if(vibrations) haptic(ms); };
function save() {
  store.save({state, view:region, tracked, muted, vibrations, metrics:metrics.data});
}
const findItem = (id,s=state) => [...s.items,...s.bag].find(i=>i.id===id);
const matches = (a,b) => a&&b&&a.id!==b.id&&a.chain===b.chain&&a.level===b.level&&a.level<7;
function currentJob() {
  const available=R.availableRepairs(state);
  return available.find(r=>r.id===tracked) || routeChoices(available,region)[0];
}
function html(el,markup) {
  if(el._view!==markup){el._view=markup;el.innerHTML=markup;}
}
function renderWallet() {
  $('#energy').hidden=state.energy>4;
  $('#en').textContent=state.energy;
}
function renderWorld(s=state,carried=null,job=currentJob(),step=null) {
  const showSource=!carried && !selected && step?.kind==='gather' ? CHAIN_SHOP[job.chain] : null;
  board.render(s,{region,job,selected:carried || selected,carried,showSource,onJob:showJob,onWorkshop:gather,
    alternate:!selected&&!busy&&!drag?alternate:null,onChoose:chooseRoute});
}
function clearFork(){clearTimeout(forkTimer);alternate=null;}
function offerFork(jobs,last,next) {
  clearFork();alternate=secondWay(jobs,last,next);
  if(alternate)forkTimer=setTimeout(()=>{alternate=null;if(!drag&&!busy)render();},7200);
}
async function chooseRoute(id) {
  const job=R.availableRepairs(state).find(r=>r.id===id);
  if(!job || busy || drag)return;
  clearFork();tracked=id;
  await focus(SPOT_REGION[job.spot],{pick:false});
  message(JOB_NAMES[id]+' · '+BENEFITS[id]);
}
function message(text='',duration=2000,who=null) {
  clearTimeout(feedbackTimer);
  const el=$('#field-message');
  if(who)el.innerHTML=V.portrait(who)+'<span>'+esc(text)+'</span>';
  else el.textContent=text;
  el.classList.toggle('show',!!text);
  feedbackTimer=text ? setTimeout(()=>message(),duration) : 0;
}
function renderBagTarget() {
  $('#bag').hidden=!(selected || drag || state.bag.length);
  $('#bag-num').textContent=state.bag.length || '';
}
function render() {
  const r=currentJob(), current=!drag && findItem(selected);
  const step=r && R.nextRepairStep(state,r,region);
  tracked=r?.id||null;
  renderWorld(drag?.draft || state,drag?.id,r,step); renderWallet(); renderBagTarget();
  drawLocation();
  html($('#panel'),V.repairPanel(state,r,step,region));
  const inspector=$('#selection');
  inspector.hidden=!current;
  html(inspector,current?V.itemPanel(state,current,r):'');
}
function commit(res) {
  if(!res.ok){message(res.message,2800);sfx.error();return false;}
  state=res.state;
  save();
  return true;
}
function placeAt(i) {
  if(!i)return centerOf($('#notebook'));
  if(!i.cell)return centerOf($('#bag'));
  const p=world.spriteClient('item-'+i.id)||world.cellToClient(i.cell);
  return withinMap(p) ? p : centerOf($('.location'));
}
function withinMap([x,y],margin=0) {
  const r=field.getBoundingClientRect(),over=document.elementFromPoint(x,y);
  return x>=r.left+margin && x<=r.right-margin && y>=r.top+margin && y<=r.bottom-margin &&
    !over?.closest('.work-note,.map-tools,.map-hud,.selection');
}
function popAt(point,level=2,color='#ffcd70') {
  if(!point)return;
  burst(point[0],point[1],{count:7+Math.min(14,level*2),colors:[color,'#fff3cf','#ffdf85'],spread:24+level*5,duration:410});
  ring(point[0],point[1],{size:35+level*6,color,duration:330,width:3});
}
async function focus(next,{pick=true,animate=true}={}) {
  if(!R.isOpen(state,next))return;
  selected=null; region=next;
  if(pick && SPOT_REGION[currentJob()?.spot]!==next)tracked=routeChoices(R.availableRepairs(state),next)[0]?.id;
  render();save();await board.focus(state,next,animate,currentJob());
}
function syncPannedRegion() {
  const rect=field.getBoundingClientRect(),middle=world.cellAt(rect.x+rect.width*.5,rect.y+rect.height*.5);
  const open=Object.keys(REGIONS).filter(id=>R.isOpen(state,id));
  const near=open.sort((a,b)=>distance(middle,REGIONS[a].center)-distance(middle,REGIONS[b].center))[0];
  if(!near || near===region || distance(middle,REGIONS[region].center)-distance(middle,REGIONS[near].center)<2)return;
  region=near;selected=null;tracked=routeChoices(R.availableRepairs(state),near)[0]?.id;render();save();
}
function revealMerge(events,heard=0) {
  const joins=events.filter(e=>e.type==='merge'), latest=joins.at(-1), healed=events.filter(e=>e.type==='heal');
  for(const e of events) {
    if(e.type==='heal'||e.type==='bloom')world.reveal(e.cell,e.type==='heal'?.98:.6,{duration:430});
    if(e.type==='heal'){popAt(world.cellToClient(e.cell),1,'#a4eb85');metrics.count('清理残骸');}
  }
  if(!latest)return;
  const i=latest.item;
  if(heard<joins.length)feedbackJoin(i,placeAt(i),joins.length);
  metrics.count('合成',joins.length);
  const words=[];
  if(joins.length>1)words.push(joins.length+' 连合成');
  if(i.wide)words.push(nameOf(i.chain,i.level)+'展开三格');
  else if(healed.length)words.push('清出 '+healed.length+' 格草地');
  else if(events.some(e=>e.type==='discover'&&e.level>=3))words.push('发现'+nameOf(i.chain,i.level));
  const rescued=healed.find(e=>e.bonus?.item)?.bonus.item;
  if(rescued)words.push('找回'+nameOf(rescued.chain,rescued.level));
  if(words.length) message(words.join(' · '));
}
function feedbackJoin(i,at,depth) {
  pulsePiece(world.spriteEl('item-'+i.id),i.level,reducedMotion());
  ring(at[0],at[1],{size:37+i.level*4,color:CHAINS[i.chain].color,duration:225,width:2.5});
  burst(at[0],at[1],{count:i.level>=4?8:4,spread:20+i.level*3,duration:290,size:4,gravity:12,colors:[CHAINS[i.chain].color,'#ffe399','#fff2ce']});
  sfx.merge(i.level,Math.min(3,depth-1));pulse(i.level>=4?14:7);
}
function gather(id) {
  if(busy||drag)return;
  clearFork();
  unlock();
  const res=R.tapGenerator(state,id);
  if(!res.ok){if(res.needEnergy){showEnergy();return;}message(res.message,2800);sfx.error();return;}
  const e=res.events[0];selected=null;
  if(!commit(res))return;
  metrics.count('采集'); render();
  const dest=placeAt(e.item), source=world.spriteEl('gen-'+id)||world.spriteEl('site-'+R.GENERATORS[id].spot);
  const from=source?centerOf(source):world.cellToClient(SPOTS[R.GENERATORS[id].spot]);
  const el=world.spriteEl('item-'+e.item.id);
  if(el&&!reducedMotion()){
    const dx=(from[0]-dest[0])/world.cam.scale,dy=(from[1]-dest[1])/world.cam.scale;
    const timing={duration:190,easing:'ease-out'};
    el.animate([{translate:`${dx}px ${dy}px`},{translate:`${dx*.27}px ${dy*.27-11}px`,offset:.50},
      {translate:'0px 0px',offset:.84},{translate:'0px 0px'}],timing);
    el.querySelector('img').animate([{scale:'.4',opacity:.62},{scale:'.94',opacity:1,offset:.50},
      {scale:'1.05 .97',offset:.84},{scale:'1'}],timing);
  }
  materialSound(e.item.chain,muted);
  pulse(5);
  if(state.energy===0)message('体力用完了，草地上的材料仍可合成');
}
function performMerge(a,b) {
  const first=findItem(a), at=placeAt(first), target=findItem(b), to=placeAt(target);
  const r=R.merge(state,a,b); if(!commit(r))return;
  selected=null;render();
  const joined=r.events[0].item;
  fly(art(matName(first.chain,first.level)),at,to,{size:36,duration:115,arc:-12,endScale:.62});
  revealMerge(r.events,1);
  // The paid result is live immediately; the contact beat lands with the incoming piece.
  if(reducedMotion())feedbackJoin(joined,to,1);
  else setTimeout(()=>{if(findItem(joined.id))feedbackJoin(joined,placeAt(joined),1);},90);
}
function tapTile(cell,id) {
  if(busy||drag)return;
  if(id?.startsWith('gen-'))return gather(id.slice(4));
  const i=id?.startsWith('item-')?findItem(id.slice(5)):R.itemAt(state,cell);
  if(i) {
    if(matches(findItem(selected),i))return performMerge(selected,i.id);
    selected=selected===i.id?null:i.id; sfx.tap(); render();return;
  }
  const spot=id?.startsWith('site-')?id.slice(5):spotAt(cell);
  if(spot) {
    const r=R.availableRepairs(state).find(j=>j.spot===spot), part=findItem(selected);
    if(r&&part&&part.chain===r.chain) {
      if(part.level===r.level)return repair(r,part);
      if(r.level>=5&&part.level===r.level-1)return fitPart(r,part);
    }
    if(r && state.fittings?.[r.id])return showJob(r);
    if(spot==='dock' && R.done(state,'ferry'))return readLetter();
    const id=Object.keys(R.GENERATORS).find(k=>R.GENERATORS[k].spot===spot && R.generatorOpen(state,k));
    if(r&&currentJob()?.id===r.id&&!id)return showJob(r);
    if(id)return gather(id);
    if(r)return showJob(r);
    if(R.REPAIRS.some(r=>r.spot===spot&&R.done(state,r.id))){message('这处已经修好，旁边的草地可以继续摆材料');return;}
  }
  if(selected && R.isFree(state,cell)){
    if(commit(R.move(state,selected,cell))){selected=null;sfx.drop();render();}return;
  }
  const tile=R.STORM.get(key(...cell));
  if(tile&&!R.isLand(state,cell)&&R.isOpen(state,tile.region))message('在旁边合出 L'+tile.level+'，这格就能摆材料');
  selected=null; render();
}
function lift(cell,id,_client,pressed) {
  if(busy || drag)return false;
  const item=id?.startsWith('item-')?findItem(id.slice(5)):R.itemAt(state,cell);
  if(!item)return false;
  const el=world.spriteEl('item-'+item.id), box=el.getBoundingClientRect();
  const grip=[(pressed[0]-box.left)/box.width,(pressed[1]-box.top)/box.height];
  drag={id:item.id,draft:state,events:[],heard:0,last:pressed,grip,snap:null,hover:null,mark:null,refused:null};
  selected=item.id;
  el.getAnimations().forEach(anim=>anim.cancel());
  el.querySelector('img').getAnimations().forEach(anim=>anim.cancel());
  renderBagTarget();$('#selection').hidden=true;renderWorld(state,item.id);
  el.classList.add('lifted');registerGrip(item);
  sfx.lift();pulse(5);return true;
}
function registerGrip(item) {
  const id='item-'+item.id,rect=world.spriteEl(id).getBoundingClientRect(),base=world.spriteFoot(id);
  const press=world.clientToPlate(rect.left+drag.grip[0]*rect.width,rect.top+drag.grip[1]*rect.height);
  const anchor=plateOf(item.cell);
  drag.offset=[base[0]-press[0],base[1]-press[1]];
  drag.anchorOffset=[anchor[0]-base[0],anchor[1]-base[1]];
  drag.pitch=PLATE.cell*Math.sqrt(3)*world.cam.scale;
  drag.movingTargets=[];
  drag.spots=drag.draft.items.filter(i=>i.id!==item.id).map(i=>{
    const el=world.spriteEl('item-'+i.id),spot=hitEllipse(i,el.getBoundingClientRect(),drag.pitch);
    if(el.getAnimations().some(a=>a.playState==='running'))drag.movingTargets.push({el,spot});
    return spot;
  });
}
function heldGeometry(client) {
  const p=world.clientToPlate(...client), foot=[p[0]+drag.offset[0],p[1]+drag.offset[1]];
  return {foot,cell:cellOfPlate([foot[0]+drag.anchorOffset[0],foot[1]+drag.anchorOffset[1]])};
}
function surfaceAt(client){
  const hit=document.elementFromPoint(...client);
  if(hit?.closest('#bag'))return 'bag';
  return hit && field.contains(hit) && !hit.closest('.work-note,.selection,.map-hud,.map-tools,.skip-scene')?'map':null;
}
function dragTarget(client,cell) {
  const surface=surfaceAt(client);
  if(surface!=='map')return surface==='bag'?{type:'bag'}:null;
  const s=drag.draft,part=findItem(drag.id,s),hit=document.elementFromPoint(...client);
  const marked=hit?.closest('[data-site]')?.dataset.site;
  const painted=hit?.closest('.spr.site')?.dataset.id?.replace(/^site-/,'');
  const spot=marked||painted||spotAt(world.cellAt(...client))||spotAt(cell);
  const job=spot&&R.availableRepairs(s).find(r=>r.spot===spot && r.chain===part.chain);
  if(job?.level===part.level)return {type:'repair',r:job};
  if(job && job.level>=5 && job.level-1===part.level && !R.progressFor(s,job).ready)return {type:'stage',r:job};
  const hovering=hoverAt(client,drag.spots,drag.hover);
  drag.hover=hovering?.item.id??null;
  if(hovering && matches(part,hovering.item))return {type:'merge',other:hovering.item};
  if(drag.snap && Math.hypot(client[0]-drag.snap[0],client[1]-drag.snap[1])<drag.pitch*.32)return {type:'stay'};
  const occupant=hovering?.item || R.itemAt(s,cell);
  if(occupant?.id===part.id)return {type:'stay'};
  if(occupant)return matches(part,occupant)?{type:'merge',other:occupant}:{type:'move',cell:occupant.cell};
  if(R.isLand(s,cell))return {type:'move',cell};
  return {type:'blocked',cell};
}
function shiftedSprites(before,after,except) {
  if(reducedMotion())return [];
  const shifted=[];
  for(const item of after.items) {
    if(item.id===except)continue;
    const old=before.items.find(i=>i.id===item.id);
    if(old?.cell && (key(...old.cell)!==key(...item.cell)||old.turn!==item.turn))
      shifted.push([item.id,world.spriteClient('item-'+item.id)]);
  }
  return shifted;
}
function settleShifts(shifts){
  for(const [id,from] of shifts){
    const name='item-'+id;
    softLanding(world.spriteEl(name),from,world.spriteClient(name),world.cam.scale,reducedMotion());
  }
}
function joinDraft(target,contact) {
  const d=drag, result=R.merge(d.draft,d.id,target.item.id);
  if(!result.ok){if(d.refused!==target.item.id)message(result.message);d.refused=target.item.id;return false;}
  const item=result.events[0].item,shifted=shiftedSprites(d.draft,result.state,item.id);
  d.draft=result.state;d.id=item.id;d.heard++;d.events.push(...result.events);
  d.hover=null;d.mark=null;d.refused=null;d.snap=[target.x,target.y];selected=item.id;
  // Keep the same point on the growing material attached to the finger.
  renderWorld(d.draft,item.id);
  registerGrip(item);settleShifts(shifted);
  world.moveSprite('item-'+item.id,heldGeometry(contact).foot,{z:8500});
  feedbackJoin(item,[target.x,target.y],d.heard);
  return true;
}
function sweepTo(client) {
  let start=drag.last;
  if(surfaceAt(client)!=='map' || Math.hypot(client[0]-start[0],client[1]-start[1])<.5)return;
  while(drag.heard<6){
    const part=findItem(drag.id,drag.draft);
    const crossing=firstCrossing(start,client,drag.spots,t=>matches(part,t.item));
    if(!crossing || surfaceAt(crossing.point)!=='map')break;
    const {target,point}=crossing;
    if(drag.snap && Math.hypot(target.x-drag.snap[0],target.y-drag.snap[1])<drag.pitch*.30)break;
    if(!joinDraft(target,point))break;
    start=point;
    if(crossing.t>=.999)break;
  }
}
function drawDrop(target) {
  $('#bag').classList.toggle('drop',target?.type==='bag');
  const marker=JSON.stringify([drag.id,target?.type,target?.cell,target?.other?.id,target?.r?.id]);
  if(drag.mark===marker)return;
  drag.mark=marker;
  const part=findItem(drag.id,drag.draft);
  let shape=target?.cell?[target.cell]:target?.other?[target.other.cell]:target?.r?[SPOTS[target.r.spot]]:[];
  let shifts=[],style=target?.type==='blocked'?'blocked-outline':'drop-outline';
  if(target?.type==='move'){
    const plan=R.dropLayout(drag.draft,drag.id,target.cell);
    if(plan){
      shape=R.occupiedCells(Number.isInteger(plan.turn)?{...part,wide:true}:part,target.cell,plan.turn);
      shifts=plan.shifts.flatMap(to=>R.occupiedCells(findItem(to.id,drag.draft),to.cell,to.turn));
    }else style='blocked-outline';
  }
  if(target?.type==='stay')shape=R.occupiedCells(part);
  if(target?.type==='merge'){
    style='join-outline';
    if(part.level>=5) {
      const merged=R.merge(drag.draft,part.id,target.other.id);
      if(merged.ok){
        shape=R.occupiedCells(merged.events[0].item);
        shifts=merged.state.items.flatMap(i=>{
          const old=findItem(i.id,drag.draft);
          return old?.cell && (key(...old.cell)!==key(...i.cell)||old.turn!==i.turn)?R.occupiedCells(i):[];
        });
      }else style='blocked-outline';
    }
  }
  board.outline('drop',shape,style);board.outline('shift',shifts,'shift-outline');
  board.previewLanding(drag.draft,part,target?.type==='merge'?target.other:null);
  board.hoverBuddy(target?.other?.id||null);
}
function carry(_cell,_foot,client,samples=[]) {
  if(!drag)return;
  // A newly gathered or displaced partner can be moving while the finger approaches.
  drag.movingTargets=drag.movingTargets.filter(({el,spot})=>{
    Object.assign(spot,hitEllipse(spot.item,el.getBoundingClientRect(),drag.pitch));
    return el.getAnimations().some(a=>a.playState==='running');
  });
  for(const sample of samples){sweepTo(sample);drag.last=sample;}
  sweepTo(client);
  const {foot,cell}=heldGeometry(client);
  drag.last=client;drawDrop(dragTarget(client,cell));
  world.moveSprite('item-'+drag.id,foot,{z:8500});
}
function clearCarry() {
  drag=null;selected=null;
  board.outline('drop',[],'');board.outline('shift',[],'');board.hoverBuddy(null);
  $('#bag').classList.remove('drop');
}
function cancelDrag() {
  if(!drag)return;
  const id=drag.id,from=world.spriteClient('item-'+id);
  clearCarry();render();
  softLanding(world.spriteEl('item-'+id),from,world.spriteClient('item-'+id),world.cam.scale,reducedMotion());
}
function drop(cell,_foot,client) {
  if(!drag)return;
  if(!cell)return cancelDrag();
  const d=drag, geometry=heldGeometry(client),target=dragTarget(client,geometry.cell);
  if(!target)return cancelDrag();
  const from=world.spriteClient('item-'+d.id);
  let result={ok:true,state:d.draft,events:[]},landed=d.id;
  if(target.type==='merge'){result=R.merge(d.draft,d.id,target.other.id);if(result.ok)landed=result.events[0].item.id;}
  else if(target.type==='move')result=R.move(d.draft,d.id,target.cell);
  else if(target.type==='bag')result=R.store(d.draft,d.id);
  if(!result.ok){cancelDrag();message(result.message);return;}
  const shifted=shiftedSprites(d.draft,result.state,landed);
  clearCarry();commit(result);render();settleShifts(shifted);
  const events=[...d.events,...result.events];
  if(events.some(e=>e.type==='merge'))revealMerge(events,d.heard);
  if(target.type==='repair')return repair(target.r,findItem(d.id),from);
  if(target.type==='stage')return fitPart(target.r,findItem(d.id),from);
  if(target.type==='bag'){
    if(from)fly(art(matName(findItem(landed).chain,findItem(landed).level)),from,centerOf($('#bag')),{size:36,duration:170,arc:-20});
    message('已收入背包');return;
  }
  const end=world.spriteClient('item-'+landed);
  softLanding(world.spriteEl('item-'+landed),from,end,world.cam.scale,reducedMotion());
  if(!events.some(e=>e.type==='merge'))sfx.drop();
}
async function fitPart(r,i,releasePoint=null) {
  if(!i || busy)return;
  const from=releasePoint||placeAt(i),before=state,result=R.stagePart(before,r.id,i.id);
  if(!result.ok){message(result.message);return;}
  tracked=r.id;busy=true;selected=null;commit(result);
  try{
    const destination=SPOT_REGION[r.spot];
    if(region!==destination || !withinMap(board.entrance(r.spot),28)){
      region=destination;board.render(before,{region,job:r,onJob:showJob,onWorkshop:gather});
      await board.focus(before,region,true,r);
    }
    const to=board.entrance(r.spot);
    world.removeSprite('item-'+i.id);
    await fly(art(matName(i.chain,i.level)),from,to,{duration:190,arc:-24,size:43});
    const old=board.previousScene(r.spot);
    render();board.buildInPlace(r.spot,old);popAt(to,3);
    const assembled=result.events[0].type==='assemble';
    sfx.merge(assembled?r.level:i.level);pulse(10);
    message(assembled?'两半已经合拢，可以修复':r.id==='stream'?'接头装好了，一股细水流进溪床':r.id==='ferry'?'框架搭上了，还差另一半':'半件已试装，工作格空出来了');
  }finally{busy=false;}
}

function drawLocation() {
  $('#region-name').textContent=app.classList.contains('following-cart')?'物资回营地':REGIONS[region].name+(practice?' · 练习':'');
}
function followCart(on) {
  app.classList.toggle('following-cart',on);drawLocation();
}
function interruptTour() {
  if(tour?.following){tour.following=false;world.stopFraming();followCart(false);}
}
document.addEventListener('pointerdown',interruptTour,true);
document.addEventListener('keydown',interruptTour,true);

async function homeDelivery(returnRegion,finale=false) {
  tour?.control.abort();
  const run={control:new AbortController(),following:true};tour=run;
  message('桥和渡口接通了，第一车物资出发了。',2800,'rowan');
  if(!reducedMotion()){followCart(true);board.freightView();}
  await board.life.travel(run.control.signal);
  const watching=()=>tour===run && !run.control.signal.aborted && !document.hidden && run.following && !busy && !drag && !document.querySelector('.sheet-wrap');
  try {
    if(!watching())return;
    followCart(false);
    await focus(returnRegion,{pick:false,animate:true});
    if(!watching())return;
    message('第一车物资到了，青布包已经卸在棚门口。',3300,'mira');
    if(finale)await showEnd();
  } finally {if(tour===run){tour=null;followCart(false);}}
}

async function readLetter() {
  if(!R.done(state,'ferry'))return;
  await sheet({title:'渡口捎来的信',body:V.img('ferry-letter','journal-cover')+'<p>'+esc(LETTER.text)+'</p>',actions:[{label:'收进手记',value:true}]});
}
async function repair(r,i,releasePoint=null) {
  if(busy||!i)return;
  clearFork();
  const before=state,result=R.install(state,i.id,r.id);
  if(!result.ok){message(result.message);return;}
  const site=SPOTS[r.spot], destination=SPOT_REGION[r.spot], oldRegion=region;
  const staged=before.fittings?.[r.id]?.id===i.id;
  const available=R.availableRepairs(result.state);
  const next=available.find(j=>j.id===tracked) || routeChoices(available,destination,r.id)[0];
  const nextRegion=next?SPOT_REGION[next.spot]:destination;
  const delivery=result.events.some(e=>e.type==='home-delivery');
  const finale=result.events.some(e=>e.type==='finale');
  busy=true;selected=null;metrics.count('修复');metrics.event('repair',{id:r.id});
  commit(result);app.classList.add('building');
  try{
    region=destination;
    board.render(before,{region,job:r,onJob:showJob,onWorkshop:gather});
    const local=i.cell&&regionOfCell(i.cell)===region;
    const reframe=r.creek || oldRegion!==region || !withinMap(board.entrance(r.spot),32) || (local&&!withinMap(placeAt(i),8));
    if(reframe){
      const frame=r.creek?[SPOTS.spring,SPOTS.bridge,SPOTS.shelter]:[site];
      if(local)frame.push(i.cell);
      await world.fit(frame,{maxScale:1.47,pad:.85,top:56,bottom:38,animate:true,duration:280,overscroll:true});
    }
    const to=board.entrance(r.spot);
    const from=releasePoint&&!reframe?releasePoint:staged?world.spriteClient('fit-'+r.id)||to:placeAt(i);
    world.removePin('job-'+r.id);
    if(!staged)world.removeSprite('item-'+i.id);
    const length=Math.hypot(from[0]-to[0],from[1]-to[1]);
    await fly(art(matName(i.chain,i.level)),from,to,{size:49,arc:-Math.min(48,length*.24),duration:Math.min(330,110+length*.56)});
    const ghost=board.previousScene(r.spot);
    if(delivery)board.life.prepareTravel();
    if(r.creek)board.life.startWater();
    tracked=next?.id||null;
    render();board.buildInPlace(r.spot,ghost);
    burst(to[0],to[1],{count:11,colors:['#ffe7a9','#c69c64','#f1d6ad'],shape:'chip',spread:35,size:5,gravity:15,duration:350});
    sfx.build();pulse([10,25,12]);
    const scenes=[world.reveal(site,r.reveal,{duration:365})];
    if(r.creek){
      scenes.push(board.creek.fill(1250,before.fittings?.stream?67:100).then(()=>board.life.finishWater()));
      world.reveal([4,-2],3,{duration:830});world.reveal([1,-1],1.6,{duration:1180});
    }
    for(const e of result.events){
      const cells=e.type==='clearing'?e.cells:e.type==='heal'?[e.cell]:[];
      for(const c of cells){world.reveal(c,.83,{duration:340});world.markCell(c,'fresh-land');}
    }
    await Promise.all(scenes);
    save();
  }finally{busy=false;app.classList.remove('building');}
  if(delivery){
    void homeDelivery(nextRegion,finale);
    return;
  }
  offerFork(available,r.id,next);render();
  if(nextRegion!==region){await focus(nextRegion,{pick:false,animate:true});}
  else if(r.creek){await board.focus(state,region,true,next);}
  const returned=result.events.find(e=>e.type==='retrieve');
  if(returned)message('试装件已退回'+(returned.item.cell?'草地':'背包'));
  else if(r.letter)message('船已经靠岸。点渡船，可以读妈妈的信。',3200,'rowan');
  else if(r.opens)message('旧路通了。顺着溪床就能找到泉眼。',3000,'lina');
  else {const [who,line]=r.lines.at(-1);message(line,3000,who);}
  if(finale)await showEnd();
}
async function deliver(order) {
  if(busy)return;
  const t=R.orderById(order.id), result=R.deliver(state,order.id);
  if(!result.ok){message(result.message);return;}
  const dest=centerOf($('#notebook'));
  const flights=result.events[0].consumed.map(i=>({i,at:placeAt(i)}));
  busy=true;selected=null;commit(result);render();
  try {
    await Promise.all(flights.map(({i,at})=>fly(art(matName(i.chain,i.level)),at,dest,{size:38,duration:240,arc:-50})));
  } finally {busy=false;}
  materialSound('stamp',muted);sfx.coin();pulse(12);popAt(dest,2);
  metrics.count('完成请求');
  const arrival=t.id==='o1'?'板凳已经放在棚门旁':t.id==='o2'?'工具箱已经放回倒木堆旁':CAST[t.who].name+'收到了';
  if(result.events.some(e=>e.type==='diary'))message('这是我找到的那一页，收进手记吧。',3200,t.who);
  else message(arrival+' · 金币 +'+t.coins+' · 体力 +'+t.energy);
}

async function showJob(r) {
  if(!r || busy || drag)return;
  const step=R.nextRepairStep(state,r,region), p=R.progressFor(state,r), actions=[];
  if(p.ready)actions.push({label:'送去修复',value:'install'});
  else {
    if(step.kind==='merge'||step.kind==='move')actions.push({label:'找这对材料',value:'guide'});
    if(r.level>=5 && p.half)actions.push({label:p.staged?'把另一半合拢':'先试装一半',value:'stage'});
    if(step.kind==='gather' || step.kind==='stage'){
      const id=CHAIN_SHOP[r.chain], local=R.GENERATORS[id].region===region;
      actions.push({label:local?WORKSHOPS[id]+'取料 · 1 体力':'去'+WORKSHOPS[id]+'取料',value:'source'});
    }
  }
  if(p.staged)actions.push({label:'取回试装件',kind:'secondary',value:'retrieve'});
  if(R.availableRepairs(state).length>1)actions.push({label:'换个工地',value:'jobs',kind:'secondary'});
  const choice=await sheet({title:JOB_NAMES[r.id],body:V.jobDetail(state,r),actions});
  if(!choice)return;
  if(choice==='jobs')return showJobs();
  tracked=r.id;selected=null;save();render();
  const latest=R.progressFor(state,r);
  if(choice==='install' && latest.ready)return repair(r,latest.ready);
  if(choice==='stage' && latest.half)return fitPart(r,latest.half);
  if(choice==='retrieve')return retrieve(r);
  if(choice==='guide')return hint();
  if(choice==='source'){
    const id=CHAIN_SHOP[r.chain], next=R.GENERATORS[id].region;
    if(next===region)gather(id);
    else {await focus(next,{pick:false});message('点'+WORKSHOPS[id]+'取料');}
  }
}
async function retrieve(r) {
  if(busy||drag)return;
  const res=R.retrievePart(state,r.id);
  if(!res.ok){message(res.message);return;}
  const item=res.events[0].item, destination=SPOT_REGION[r.spot];
  busy=true;
  try {
    if(region!==destination || !withinMap(board.entrance(r.spot),16))await focus(destination,{pick:false});
    const from=world.spriteClient('fit-'+r.id)||board.entrance(r.spot), old=board.previousScene(r.spot);
    selected=null;tracked=r.id;commit(res);render();board.buildInPlace(r.spot,old);
    const el=world.spriteEl('item-'+item.id);
    if(el){
      softLanding(el,from,world.spriteClient('item-'+item.id),world.cam.scale,reducedMotion());
      pulsePiece(el,item.level,reducedMotion(),135);
    }else await fly(art(matName(item.chain,item.level)),from,centerOf($('#bag')),{size:42,duration:195,arc:-22});
    sfx.drop();message(item.cell?'组件放回工地旁，可以继续合成':'组件已放回背包');
  } finally {busy=false;}
}
async function showJobs() {
  const choice=await sheet({title:'修复路线',body:V.jobsView(state,tracked,region)});
  if(choice){const r=R.repairById(choice);if(!r)return;tracked=r.id;
    await focus(SPOT_REGION[r.spot],{pick:false});world.pinEl('job-'+r.id)?.classList.add('landmark-focus');message(JOB_NAMES[r.id]+' · '+BENEFITS[r.id]);}
}
async function showOrders() {
  const pick=await sheet({title:'居民来信',body:V.ordersView(state,currentJob())});
  if(pick?.startsWith('recall-')){
    const id=pick.slice(7), t=R.orderById(id);
    if(!state.orderLog.includes(id) || !t)return;
    if(t.diary) {
      await sheet({title:'外婆的手记 · 第 '+(t.diary+1)+' 页',body:'<p>'+esc(DIARY[t.diary])+'</p>'});
    } else if(t.keepsake) {
      await focus('camp',{pick:false});
      const gift=world.spriteEl(id==='o1'?'bench-gift':'toolbox-gift');
      if(gift){popAt(centerOf(gift),2);squash(gift);}
      message(t.keepsake);
    }
    return;
  }
  const o=state.orders.find(order=>order.id===pick);
  if(o)await showOrder(o);
}
async function showOrder(o) {
  const job=currentJob(), impact=R.orderImpact(state,o,job), t=R.orderById(o.id);
  const send={label:'交给'+CAST[t.who].name,value:'deliver'};
  let actions=[];
  if(impact.available){
    actions=impact.usesProject
      ? [{label:'留给工地',value:'keep'},{...send,kind:'secondary'}]
      : [send];
  }
  const choice=await sheet({title:CAST[t.who].name+'的来信',body:V.orderDetail(state,o,job,impact),actions});
  if(choice==='deliver')return deliver(o);
  if(choice?.startsWith('chain-'))return showChain(choice.slice(6));
}
async function showNotebook() {
  const pick=await sheet({title:'归乡手记',body:V.notebookView(state)});
  const open={jobs:showJobs,story:()=>showJournal(),bag:showBag,orders:showOrders,energy:showEnergy,settings:showSettings};
  if(pick)await open[pick]?.();
}
async function showMap() {
  const actions=[{label:'修复路线',kind:'secondary',value:'route'}];
  if(freightOpen(state.done))actions.push({label:'沿桥送货',kind:'secondary',value:'delivery'});
  const result=await sheet({title:'故乡地图',body:V.regionMap(state,region),actions});
  if(result==='route')return showJobs();
  if(result==='delivery'){void homeDelivery(region);return;}
  if(result&&REGIONS[result]){await focus(result);message(REGIONS[result].name);}
}
async function showBag() {
  const picked=findItem(selected);
  const pick=await sheet({title:'随身背包',body:V.bagView(state,picked),actions:[{label:'材料图鉴',kind:'secondary',value:'album'}]});
  if(!pick)return;
  if(pick==='album')return showAlbum();
  if(picked?.cell && matches(findItem(pick),picked))return performMerge(pick,picked.id);
  const res=R.unbag(state,pick,REGIONS[region].center);
  if(commit(res)){selected=pick;render();message('已放回'+REGIONS[region].name);sfx.drop();}
}
async function showItemInfo(id) {
  const item=findItem(id);
  if(!item)return;
  const actions=[];
  for(const job of R.availableRepairs(state).filter(j=>j.chain===item.chain)){
    if(job.level===item.level)actions.push({label:'送去'+JOB_NAMES[job.id],value:'install:'+job.id});
    else if(job.level>=5 && job.level-1===item.level && !R.progressFor(state,job).ready){
      const fitting=state.fittings?.[job.id];
      actions.push({label:JOB_NAMES[job.id]+(fitting?' · 合拢':' · 试装'),value:'fit:'+job.id});
    }
  }
  if(item.cell)actions.push({label:'收入背包',value:'store'});
  actions.push({label:'查看合成链',kind:'secondary',value:'chain'},
               {label:'出售 · '+R.sellPrice(item.level)+' 金币',kind:'secondary',value:'sell'});
  const choice=await sheet({title:nameOf(item.chain,item.level),body:`<div class="detail-piece">${V.piece(item.chain,item.level)}<span><b>${CHAINS[item.chain].label} · L${item.level}</b><small>${WORKSHOPS[CHAIN_SHOP[item.chain]]}产出</small></span></div>`,actions});
  if(choice?.startsWith('install:'))return repair(R.repairById(choice.slice(8)),findItem(id));
  if(choice?.startsWith('fit:'))return fitPart(R.repairById(choice.slice(4)),findItem(id));
  if(choice==='chain')return showChain(item.chain);
  if(choice==='store' && commit(R.store(state,id))){selected=null;render();sfx.drop();message('已收入背包');}
  if(choice==='sell'){
    if(item.level>=3) {
      const yes=await sheet({title:'出售'+nameOf(item.chain,item.level)+'？',body:'<p>出售可得 '+R.sellPrice(item.level)+' 金币。</p>',actions:[{label:'留下',value:false},{label:'出售',kind:'secondary',value:true}]});
      if(!yes)return;
    }
    if(commit(R.sell(state,id))){selected=null;render();sfx.coin();message('金币 +'+R.sellPrice(item.level));}
  }
}
async function showChain(chain) {
  const id=CHAIN_SHOP[chain];
  const where=R.GENERATORS[id].region, local=region===where;
  const actions=R.generatorOpen(state,id)?[local?{label:WORKSHOPS[id]+'取料 · 1 体力',value:'take'}:{label:'前往'+WORKSHOPS[id],value:'go'}]:[];
  const pick=await sheet({title:CHAINS[chain].label+'合成链',body:V.chainView(state,chain),actions});
  if(pick==='take')gather(id);
  if(pick==='go'){await focus(where,{pick:false});message('点'+WORKSHOPS[id]+'可采集');}
}
async function showAlbum() {
  const body=Object.entries(CHAINS).map(([c,meta])=>`<button class="choice" data-pick="${c}">${V.img(matName(c,Math.max(1,state.discovered[c])))}<span><b>${meta.label}</b><small>已发现 ${state.discovered[c]} / 7</small></span><i>›</i></button>`).join('');
  const c=await sheet({title:'材料图鉴',body});if(c&&CHAINS[c])await showChain(c);
}
async function showJournal(tab='story') {
  metrics.count('翻阅手记');
  while(true) {
    const pick=await sheet({title:'归乡手记',body:V.journalView(state,tab),actions:[]});
    if(pick==='story'||pick==='pages'){tab=pick;continue;}break;
  }
}
async function showEnergy() {
  R.tick(state);
  const cooldown=R.freeRefillIn(state);
  const extra=Math.max(0,state.energy-state.maxEnergy);
  const text=extra?'其中 '+extra+' 点为委托或物资奖励的额外储备。':state.energy>=state.maxEnergy?'体力已充足。':'自然恢复每 30 秒增加 1 点。';
  const choice=await sheet({title:'码头补给',body:`<div class="supply-count">${icon.energy}<b>${state.energy} / ${state.maxEnergy}</b></div><p>${text}居民委托也会送回体力。</p>`,
    actions:[{label:cooldown?'免费补给还需 '+Math.ceil(cooldown/1000)+' 秒':'免费补给 · +20 体力（模拟广告）',value:'free',disabled:!!cooldown},
      {label:'15 金币换 25 体力',value:'buy',kind:'secondary',disabled:state.coins<R.ENERGY.refillCost}]});
  if(!choice)return;
  const res=R.buyEnergy(state,{free:choice==='free'});
  if(commit(res)){render();sfx.energy();message('体力 +'+res.events[0].amount);}
}
function visitMode(sandbox) {
  const url=new URL(location.href);
  url.searchParams.delete('fresh');
  if(sandbox)url.searchParams.set('visit','wharf');else url.searchParams.delete('visit');
  location.assign(url.href);
}
async function showSettings() {
  const vals=metrics.summary();
  const body=`<div class="settings-list"><button data-pick="sound">游戏声音 <b>${muted?'关':'开'}</b></button><button data-pick="vibration">触感反馈 <b>${vibrations?'开':'关'}</b></button>
    <button data-pick="hint">找一对可合成的材料 <small>提示 ›</small></button><button data-pick="practice">${practice?'回到我的故乡':'试玩码头大件'} <small>${practice?'返回旅程':'独立练习进度'} ›</small></button><button data-pick="restart">重新开始本进度 <small>›</small></button></div>
    <details class="memory"><summary>本机游玩记录</summary><p>采集 ${state.stats.taps} 次，合成 ${state.stats.merges} 次，修复 ${state.done.length} 处，完成 ${state.stats.orders} 张委托。</p><small>已开启手记 ${vals['翻阅手记']||0} 次</small></details>`;
  const choice=await sheet({title:'设置',body});
  if(choice==='sound'){muted=!muted;setMuted(muted);save();return showSettings();}
  if(choice==='vibration'){vibrations=!vibrations;save();return showSettings();}
  if(choice==='hint')return hint();
  if(choice==='practice'){save();visitMode(!practice);}
  if(choice==='restart'){
    const yes=await sheet({title:'重新开始这段旅程？',body:'<p>本机此进度的材料、委托和修复记录都会清空。</p>',actions:[{label:'保留进度',value:false},{label:'重新开始',kind:'secondary',value:true}]});
    if(yes){restarting=true;store.reset();location.reload();}
  }
}
async function showEnd() {
  await sheet({title:'第一章 · 归乡',body:V.img('river-postcard','journal-cover')+`<p>营地有了屋顶和炉火，小溪流回营地，渡口接回了邻居。莉娜收好外婆的信，明天她们要去山坡寻找那盏灯。</p><p class="reward-strip">${state.done.length} 处修复 · ${state.stats.orders} 张委托 · ${state.healed.length} 格复苏</p>`,
    actions:[{label:'回到家园',value:true}]});
}
async function hint() {
  const r=currentJob();
  if(!r || busy || drag)return;
  const step=R.nextRepairStep(state,r,region);
  if(step.kind==='install'){message('材料已做好，拖到'+JOB_NAMES[r.id]+'的工地');return;}
  if(step.kind==='assemble'||step.kind==='stage'){message(step.kind==='assemble'?'另一半已做好，可以合拢':'把半件拖到工地可先试装');return;}
  if(step.kind==='merge'){
    await focus(step.where,{pick:false});
    selected=step.from.cell?step.from.id:step.to.id;render();
    if(!step.from.cell){message('背包里有搭档，点背包可以合成');return;}
    world.spriteEl('item-'+step.to.id)?.classList.add('hint');
    message(step.opening.length?'拖到发亮的搭档上，旁边能开地':'把两件发亮的材料合起来');return;
  }
  if(step.kind==='move'){
    if(!step.item.cell){await showBag();return;}
    await focus(regionOfCell(step.item.cell),{pick:false});selected=step.item.id;render();
    message(step.mate.cell&&regionOfCell(step.mate.cell)!==region
      ? '把这件带到'+REGIONS[regionOfCell(step.mate.cell)].name+'，那里有搭档'
      : '挪到开阔处再合成，或先在工地试装');
    return;
  }
  const id=CHAIN_SHOP[r.chain];
  await focus(R.GENERATORS[id].region,{pick:false});
  const full=!R.freeCount(state,region);
  message(full?'空地满了，选一件放进背包':'点地图上的'+WORKSHOPS[id]+'取料');
}

const screens={jobs:showJobs,notebook:showNotebook,journal:showJournal,energy:showEnergy,settings:showSettings,map:showMap,
  bag:showBag,deselect:()=>{selected=null;render();}};
app.addEventListener('click',async e=>{
  const button=e.target.closest('button');
  if(!button || !app.contains(button) || busy || drag)return;
  unlock();
  const d=button.dataset;
  if(d.open)return screens[d.open]?.();
  if(d.itemInfo)return showItemInfo(d.itemInfo);
  if(d.retrieve)return retrieve(R.repairById(d.retrieve));
  if(d.jobInfo)return showJob(R.repairById(d.jobInfo));
  if(d.jobAct){
    const r=R.repairById(d.jobAct),step=R.nextRepairStep(state,r,region);
    if(d.guide)return hint();
    if(step.kind==='install')return repair(r,step.item);
    if(step.kind==='stage'||step.kind==='assemble')return fitPart(r,step.item);
    return showJob(r);
  }
});
app.addEventListener('keydown',e=>{
  const spr=e.target.closest('.spr.item');
  if(spr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const i=findItem(spr.dataset.id.slice(5));if(i)tapTile(i.cell,spr.dataset.id);}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!document.querySelector('.sheet-wrap')){if(drag)world.cancelGesture();else{selected=null;render();}}
});
let restarting=false;
function checkpoint(){
  if(restarting)return;
  if(drag)world.cancelGesture();
  tour?.control.abort();
  metrics.flush();save();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)checkpoint();else{R.tick(state);renderWallet();}});
window.addEventListener('pagehide',checkpoint);
setInterval(()=>{if(!drag){R.tick(state);renderWallet();}},1000);
await world.ready;
world.reveal([0,0],1.85,{instant:true});
for(const k of state.healed)world.reveal(parseKey(k),.98,{instant:true});
for(const k of state.blooms)world.reveal(parseKey(k),.6,{instant:true});
for(const id of state.done){const r=R.repairById(id);if(r)world.reveal(SPOTS[r.spot],r.reveal,{instant:true});}
if(R.done(state,'stream')){world.reveal([4,-2],3,{instant:true});world.reveal([1,-1],1.6,{instant:true});}
for(const id of state.done)for(const cell of REPAIR_CLEARINGS[id]||[])world.reveal(cell,.8,{instant:true});
render();await board.focus(state,region,false,currentJob());save();metrics.enter('play');
if(recovery.notice)message(recovery.notice,5000);
else if(!saved.state && !practice)message('外婆的毯子都湿了。我们先把棚顶补好吧。',3200,'lina');
