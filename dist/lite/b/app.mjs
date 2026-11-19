// Merge directly in the homeland. Rules commit before presentation.
// A held drag uses its own draft until the player releases it on the map.
import * as R from './rules.mjs';
import {recoverHomeland} from './resume.mjs';
import * as V from './views.mjs';
import {bayBoard} from './board.mjs';
import {art, materialSound} from './art.mjs';
import {WORKSHOPS, CHAIN_SHOP, JOB_NAMES, BENEFITS, REGION_COPY} from './story.mjs';
import {REGIONS, SPOTS, SPOT_REGION, regionOfCell, spotAt} from '../shared/map.mjs';
import {matName, nameOf, CHAINS} from '../shared/art.mjs';
import {key, parseKey} from '../shared/hex.mjs';
import {CAST, DIARY, LETTER} from '../shared/chapter.mjs';
import {createStore,createMetrics} from '../shared/store.mjs';
import {$, sheet, esc, wait} from '../shared/ui.mjs';
import {sfx, setMuted, unlock} from '../shared/audio.mjs';
import {burst, ring, fly, floatText, squash, haptic, centerOf, reducedMotion} from '../shared/fx.mjs';
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
let selected = null, drag = null, busy = false, feedbackTimer = 0;
let muted = !!saved.muted, vibrations = saved.vibrations !== false;
const metrics = createMetrics(saved.metrics);
setMuted(muted);
const app = $('#app');
app.classList.add('bay-app');
document.body.classList.add('bay-body');
document.body.style.setProperty('--postcard', 'url("'+art('river-postcard')+'")');
document.body.style.setProperty('--homeland','url("'+art('world')+'")');
app.innerHTML=V.shell();
const field=$('.playfield'), board=bayBoard($('#world'),{onTap:tapTile,onPress:unlock,onDragStart:lift,onDragMove:carry,onDragEnd:drop});
const {world}=board;
const pulse = ms => { if(vibrations) haptic(ms); };
function save() {
  store.save({state, view:region, tracked, muted, vibrations, metrics:metrics.data});
}
const findItem = (id,s=state) => [...s.items,...s.bag].find(i=>i.id===id);
const matches = (a,b) => a&&b&&a.id!==b.id&&a.chain===b.chain&&a.level===b.level&&a.level<7;
function currentJob() {
  const available=R.availableRepairs(state);
  return available.find(r=>r.id===tracked) || available.find(r=>SPOT_REGION[r.spot]===region) || available[0];
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
  board.render(s,{region,job,selected:carried || selected,carried,showSource,onJob:showJob,onWorkshop:gather});
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
  $('#region-name').textContent=REGIONS[region].name+(practice?' · 练习':'');
  html($('#panel'),V.repairPanel(state,r,step));
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
  return regionOfCell(i.cell)===region ? world.spriteClient('item-'+i.id)||world.cellToClient(i.cell) : centerOf($('.location'));
}
function popAt(point,level=2,color='#ffcd70') {
  if(!point)return;
  burst(point[0],point[1],{count:7+Math.min(14,level*2),colors:[color,'#fff3cf','#ffdf85'],spread:24+level*5,duration:410});
  ring(point[0],point[1],{size:35+level*6,color,duration:330,width:3});
}
async function focus(next,{pick=true,animate=true}={}) {
  if(!R.isOpen(state,next))return;
  selected=null; region=next;
  if(pick && SPOT_REGION[currentJob()?.spot]!==next)tracked=R.availableRepairs(state).find(r=>SPOT_REGION[r.spot]===next)?.id;
  render();save();await board.focus(state,next,animate);
}
function revealMerge(events) {
  const joins=events.filter(e=>e.type==='merge'), latest=joins.at(-1), healed=events.filter(e=>e.type==='heal');
  for(const e of events) {
    if(e.type==='heal'||e.type==='bloom')world.reveal(e.cell,e.type==='heal'?.98:.6,{duration:430});
    if(e.type==='heal'){popAt(world.cellToClient(e.cell),1,'#a4eb85');metrics.count('清理残骸');}
  }
  if(!latest)return;
  const i=latest.item; squash(world.spriteEl('item-'+i.id),{from:.72,peak:1.17,duration:260});
  const at=placeAt(i);popAt(at,i.level,CHAINS[i.chain].color);sfx.merge(i.level,joins.length-1);pulse(10);
  metrics.count('合成',joins.length);
  const words=[];
  if(joins.length>1)words.push(joins.length+' 连合成');
  if(events.some(e=>e.type==='discover'&&e.level>=3))words.push('发现'+nameOf(i.chain,i.level));
  if(healed.length)words.push('新开 '+healed.length+' 格草地');
  if(i.wide)words.push('组件在相连的三格展开');
  const rescued=healed.find(e=>e.bonus?.item)?.bonus.item;
  if(rescued)words.push('找回'+nameOf(rescued.chain,rescued.level));
  if(words.length) message(words.join(' · '));
}
function gather(id) {
  if(busy||drag)return;
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
    el.style.visibility='hidden';
    fly(art(matName(e.item.chain,e.item.level)),from,dest,{size:39,duration:185,arc:-30,endScale:.94}).finally(()=>{
      el.style.visibility='';squash(el,{from:.80,peak:1.13,duration:200});
    });
  }
  materialSound(e.item.chain,muted);
  pulse(5);
  if(state.energy===0)message('体力用完了，草地上的材料仍可合成');
}
function performMerge(a,b) {
  const first=findItem(a), at=placeAt(first), target=findItem(b), to=placeAt(target);
  const r=R.merge(state,a,b); if(!commit(r))return;
  selected=null;render();fly(art(matName(first.chain,first.level)),at,to,{size:35,duration:140,arc:-16});
  revealMerge(r.events);
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
  if(tile&&!state.healed.includes(key(...cell))&&R.isOpen(state,tile.region))message('在旁边合出 L'+tile.level+'，这格就能摆材料');
  selected=null; render();
}
function lift(cell,id) {
  if(busy||drag)return false;
  const i=id?.startsWith('item-')?findItem(id.slice(5)):R.itemAt(state,cell);
  if(!i)return false;
  drag={id:i.id,draft:state,events:[],target:null,lastJoin:null}; selected=i.id;
  renderBagTarget(); $('#selection').hidden=true;
  renderWorld(state,i.id);
  world.spriteEl('item-'+i.id)?.classList.add('lifted');sfx.lift();pulse(5);
  return true;
}
function dragTarget(cell,client) {
  const [x,y]=client, bounds=field.getBoundingClientRect(), hit=document.elementFromPoint(x,y);
  if(hit?.closest('#bag'))return {type:'bag'};
  if(hit?.closest('.work-note,.selection,.map-hud,.map-tools'))return null;
  if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return null;
  const s=drag.draft, i=findItem(drag.id,s);
  const raw=world.cellAt(x,y);
  const under=world.itemUnder(x,y,'item-'+i.id);
  const other=(under && findItem(under.slice(5),s)) || R.itemAt(s,raw) || R.itemAt(s,cell);
  if(matches(i,other))return {type:'merge',other};
  const pin=hit?.closest('.waypoint');
  const spot=pin?currentJob()?.spot:spotAt(raw)||spotAt(cell);
  const r=R.availableRepairs(s).find(j=>j.spot===spot&&j.chain===i.chain);
  if(r&&r.level===i.level)return {type:'repair',r};
  if(r&&r.level>=5&&r.level-1===i.level)return {type:'stage',r};
  if(other?.id===i.id)return {type:'stay'};
  if(other)return {type:'move',cell:other.cell};
  if(R.isLand(s,cell))return {type:'move',cell};
  if(R.isLand(s,raw))return {type:'move',cell:raw};
  return {type:'stay'};
}
function joinDraft(other,client) {
  const r=R.merge(drag.draft,drag.id,other.id);
  if(!r.ok){message(r.message);return false;}
  drag.draft=r.state;drag.events.push(...r.events);
  drag.id=r.events.find(e=>e.type==='merge').item.id;drag.lastJoin=client;selected=drag.id;
  renderWorld(drag.draft,drag.id);
  world.spriteEl('item-'+drag.id)?.classList.add('lifted');
  popAt(client,2);sfx.merge(other.level+1,Math.min(3,drag.events.filter(e=>e.type==='merge').length-1));pulse(8);
  return true;
}
function carry(cell,foot,client) {
  if(!drag)return;
  const target=dragTarget(cell,client);
  const canChain=!drag.lastJoin||Math.hypot(client[0]-drag.lastJoin[0],client[1]-drag.lastJoin[1])>18;
  if(target?.type==='merge'&&canChain) {
    const [x,y]=placeAt(target.other);
    if(Math.hypot(client[0]-x,client[1]-y)<Math.max(13,world.cam.scale*24) && joinDraft(target.other,client)) {
      drag.target={type:'stay'};drag.markKey='';world.moveSprite('item-'+drag.id,foot,{z:8500});board.outline('drop',[],'');board.outline('shift',[],'');return;
    }
  }
  drag.target=target;
  $('#bag').classList.toggle('drop',target?.type==='bag');
  const markKey=JSON.stringify([drag.id,target?.type,target?.cell,target?.other?.id,target?.r?.id]);
  if (drag.markKey!==markKey) {
    drag.markKey=markKey;
    const part=findItem(drag.id,drag.draft);
    let shape=target?.cell?[target.cell]:target?.other?[target.other.cell]:target?.r?[SPOTS[target.r.spot]]:[];
    let shifts=[], style='drop-outline';
    if(target?.type==='move'){
      const plan=R.dropLayout(drag.draft,drag.id,target.cell);
      if(plan){shape=R.occupiedCells(Number.isInteger(plan.turn)?{...part,wide:true}:part,target.cell,plan.turn);shifts=plan.shifts.flatMap(to=>R.occupiedCells(findItem(to.id,drag.draft),to.cell,to.turn));}
      else style='blocked-outline';
    }
    board.outline('drop',shape,style);board.outline('shift',shifts,'shift-outline');
    board.previewLanding(drag.draft,part,target?.type==='merge'?target.other:null);
  }
  world.moveSprite('item-'+drag.id,foot,{z:8500});
}
function cancelDrag() {
  if(!drag)return;
  drag=null;selected=null;board.outline('drop',[],'');board.outline('shift',[],'');$('#bag').classList.remove('drop');render();
}
function drop(cell,foot,client) {
  if(!drag)return;
  if(!cell)return cancelDrag();
  const target=dragTarget(cell,client);
  if(!target)return cancelDrag();
  const d=drag;
  const oldCenters=new Map();
  if(target.type==='move' && !reducedMotion()){
    for(const part of d.draft.items)if(part.id!==d.id)oldCenters.set(part.id,{cell:part.cell,point:world.spriteClient('item-'+part.id)});
  }
  drag=null;selected=null;board.outline('drop',[],'');board.outline('shift',[],'');$('#bag').classList.remove('drop');
  let next={ok:true,state:d.draft,events:[]};
  if(target.type==='merge')next=R.merge(d.draft,d.id,target.other.id);
  if(target.type==='move')next=R.move(d.draft,d.id,target.cell);
  if(target.type==='bag')next=R.store(d.draft,d.id);
  if(!next.ok){message(next.message);render();return;}
  // Installation and fittings operate on the newly merged component.
  if(!commit(next))return;
  render();
  for(const part of state.items){
    const old=oldCenters.get(part.id);
    if(!old?.point || key(...old.cell)===key(...part.cell))continue;
    const el=world.spriteEl('item-'+part.id),to=world.spriteClient('item-'+part.id);
    if(!el||!to)continue;
    const dx=(old.point[0]-to[0])/world.cam.scale,dy=(old.point[1]-to[1])/world.cam.scale;
    el.animate([{translate:`${dx}px ${dy}px`},{translate:'0px 0px'}],{duration:230,easing:'cubic-bezier(.15,.75,.25,1)'});
  }
  const events=[...d.events,...next.events];
  if(events.some(e=>e.type==='merge'))revealMerge(events);
  if(target.type==='repair')return repair(target.r,findItem(d.id));
  if(target.type==='stage')return fitPart(target.r,findItem(d.id));
  if(target.type==='bag')message('已收入背包，点背包可以取回');
  sfx.drop();
}
async function fitPart(r,i) {
  if(!i)return;
  const from=placeAt(i),res=R.stagePart(state,r.id,i.id);
  if(res.ok)tracked=r.id;
  if(!commit(res))return;
  if(region!==SPOT_REGION[r.spot])await focus(SPOT_REGION[r.spot],{pick:false});
  selected=null;render();
  const to=world.cellToClient(SPOTS[r.spot]), closed=res.events[0].type==='assemble';
  fly(art(matName(i.chain,i.level)),from,to,{duration:270,arc:-45,size:42});
  popAt(to,3);sfx.merge(closed?r.level:i.level);pulse(12);
  message(closed?'两半合拢了，点「修复」落成':'已试装在工地，工作格已腾出');
}
async function repair(r,i) {
  if(busy||!i)return;
  const result=R.install(state,i.id,r.id);
  if(!result.ok){message(result.message);return;}
  const before=state;
  const site=SPOTS[r.spot];
  const staged=before.fittings?.[r.id]?.id===i.id;
  busy=true;selected=null;metrics.count('修复');metrics.event('repair',{id:r.id});
  commit(result);
  try {
    region=SPOT_REGION[r.spot];
    // Keep both the old site and the component visible until the flight starts.
    board.render(before,{region,job:r,onJob:showJob,onWorkshop:gather});
    const localPart=i.cell && regionOfCell(i.cell)===region;
    await world.fit(localPart?[i.cell,site]:[site],{maxScale:1.55,pad:1.3,top:76,bottom:42,animate:true,duration:240});
    const from=staged?world.spriteClient('fit-'+r.id)||world.cellToClient(site):placeAt(i);
    const to=world.cellToClient(site);
    world.removePin('job-'+r.id);world.removeSprite(staged?'fit-'+r.id:'item-'+i.id);
    await fly(art(matName(i.chain,i.level)),from,to,{size:54,arc:-58,duration:300});
    render();popAt(to,7);sfx.build();pulse([12,30,14]);
    squash(world.spriteEl('site-'+r.spot),{from:.73,peak:1.1,duration:400});
    if(r.creek)board.creek.fill();
    for(const e of result.events.filter(e=>e.type==='heal'))world.reveal(e.cell,.98,{instant:true});
    if(r.creek){world.reveal([4,-2],3,{duration:850});world.reveal([1,-1],1.6,{duration:950});}
    await world.reveal(site,r.reveal,{duration:500});
    message(JOB_NAMES[r.id]+' · '+BENEFITS[r.id]);
    if(r.letter)await sheet({title:'渡口捎来的信',body:V.img('ferry-letter','journal-cover')+'<p>'+esc(LETTER.text)+'</p>',actions:[{label:'收进手记',value:true}]});
    if(result.events.some(e=>e.type==='finale')){sfx.fanfare();await showEnd();}
    if(!reducedMotion())await wait(330);
  } finally {
    try {await focus(r.opens?'creek':region,{animate:false});} finally {busy=false;save();}
  }
  const returned=result.events.find(e=>e.type==='retrieve');
  if(returned)message('试装件已退回'+(returned.item.cell?'草地':'背包'));
  else {const [who,line]=r.lines.at(-1);message(line,3600,who);}
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
  const res=R.retrievePart(state,r.id);
  if(commit(res)){await focus(SPOT_REGION[r.spot],{pick:false});message(res.events[0].item.cell?'已取回到工地旁，可以继续合成':'已取回到背包');}
}
async function showJobs() {
  const choice=await sheet({title:'家园重建',body:V.jobsView(state,tracked)});
  if(choice){const r=R.repairById(choice);if(!r)return;tracked=r.id;
    await focus(SPOT_REGION[r.spot],{pick:false});await showJob(r);}
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
  const choices=Object.entries(REGIONS).map(([id,v])=>{
    const open=R.isOpen(state,id), completed=R.REPAIRS.filter(r=>SPOT_REGION[r.spot]===id&&state.done.includes(r.id)).length;
    return `<button class="map-stop ${id}" data-pick="${id}" ${open?'':'disabled'}><b>${v.name}</b><small>${REGION_COPY[id]} · ${open?'已修 '+completed+' 处':'接通旧路后开放'}</small><i>${open?(id===region?'当下':'前往 ›'):icon.lock}</i></button>`;}).join('');
  const actions=[];
  const result=await sheet({title:'故乡地图',body:'<div class="map-stops">'+choices+'</div>',actions});
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
  if(e.key==='Escape'&&!document.querySelector('.sheet-wrap')){if(drag)cancelDrag();else{selected=null;render();}}
});
let restarting=false;
function checkpoint(){
  if(restarting)return;
  if(drag)cancelDrag();
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
render();await board.focus(state,region,false);save();metrics.enter('play');
if(recovery.notice)message(recovery.notice,5000);
else if(!saved.state && !practice)message('外婆的毯子都湿了。我们先把棚顶补好吧。',3200,'lina');
