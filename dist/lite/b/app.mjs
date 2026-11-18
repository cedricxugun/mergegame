// Merge directly in the homeland. Rules commit before presentation.
// A held drag uses its own draft until the player releases it on the map.
import * as R from './rules.mjs';
import {recoverHomeland} from './resume.mjs';
import * as V from './views.mjs';
import {bayBoard} from './board.mjs';
import {art, materialSound} from './art.mjs';
import {WORKSHOPS, WORK_ART, CHAIN_SHOP, JOB_NAMES, BENEFITS, REGION_COPY} from './story.mjs';
import {REGIONS, SPOTS, SPOT_REGION, regionOfCell, spotAt} from '../shared/map.mjs';
import {matName, nameOf, CHAINS} from '../shared/art.mjs';
import {key, parseKey} from '../shared/hex.mjs';
import {CAST, LETTER} from '../shared/chapter.mjs';
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
let shop = saved.shop;
let selected = null, drag = null, busy = false, story = null, feedbackTimer = 0;
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
  store.save({state, view:region, tracked, shop, muted, vibrations, metrics:metrics.data});
}
const findItem = (id,s=state) => [...s.items,...s.bag].find(i=>i.id===id);
const matches = (a,b) => a&&b&&a.id!==b.id&&a.chain===b.chain&&a.level===b.level&&a.level<7;
function currentJob() {
  const available=R.availableRepairs(state);
  return available.find(r=>r.id===tracked) || available.find(r=>SPOT_REGION[r.spot]===region) || available[0];
}
function currentShop() {
  const available=Object.keys(R.GENERATORS).filter(id=>R.generatorOpen(state,id) && R.GENERATORS[id].region===region);
  const preferred=CHAIN_SHOP[currentJob()?.chain];
  return available.includes(shop)?shop:available.includes(preferred)?preferred:available[0] || 'logs';
}
function html(el,markup) { if(el._view!==markup){el._view=markup;el.innerHTML=markup;} }
function renderWallet() {
  $('#en').textContent=state.energy>state.maxEnergy?state.energy:state.energy+'/'+state.maxEnergy;
  $('#money').textContent=state.coins;
  $('#energy').classList.toggle('low',state.energy<=4);
}
function renderWorld(s=state,carried=null) {
  board.render(s,{region,job:currentJob(),selected:carried || selected,carried,onJob:showJob,onWorkshop:gather});
}
function coach() {
  if(state.done.length || selected) return '';
  if(!state.stats.merges && state.items.length>=2) return '将两件相同的材料拖到一起';
  if(R.progressFor(state,R.repairById('roof')).ready) return '补片已做好，点「修复」送去棚顶';
  const pair=state.items.some((a,n)=>state.items.slice(n+1).some(b=>matches(a,b)));
  return pair ? '两件相同的材料可以再合一级' : '点倒木堆，再取一些木料';
}
function message(text='',duration=2000) {
  clearTimeout(feedbackTimer);
  const el=$('#field-message');
  el.textContent=text || coach(); el.classList.toggle('show',!!el.textContent);
  if(text) feedbackTimer=setTimeout(()=>{feedbackTimer=0;message();},duration);
  else feedbackTimer=0;
}
function render() {
  const r=currentJob(), current=findItem(selected);
  tracked=r?.id||null; shop=currentShop();
  renderWorld(drag?.draft || state,drag?.id); renderWallet();
  $('#chapter-number').textContent=state.done.length+'/'+R.REPAIRS.length;
  $('#region-name').textContent=REGIONS[region].name+(practice?' · 练习':'');
  const requestEl=$('#requests'), scroll=requestEl.querySelector('.orders-list')?.scrollLeft||0;
  html(requestEl,V.ordersView(state,r,story)); if(scroll && requestEl.querySelector('.orders-list'))requestEl.querySelector('.orders-list').scrollLeft=scroll;
  $('#bag-num').textContent=state.bag.length+'/'+state.bagSize;
  html($('#panel'),current?V.itemPanel(state,current):V.repairPanel(state,r));
  const gatherEl=$('#gather'); html(gatherEl,V.gatherView(state,shop)); gatherEl.dataset.shop=shop;
  if(!feedbackTimer)message();
}
function commit(res) {
  if(!res.ok){message(res.message,2800);sfx.error();return false;}
  state=res.state;
  save();
  return true;
}
function placeAt(i) {
  if(!i)return centerOf($('#gather'));
  if(!i.cell)return centerOf($('#bag'));
  return regionOfCell(i.cell)===region ? world.spriteClient('item-'+i.id)||world.cellToClient(i.cell) : centerOf($('.location'));
}
function popAt(point,level=2,color='#ffcd70') {
  if(!point)return;
  burst(point[0],point[1],{count:7+Math.min(14,level*2),colors:[color,'#fff3cf','#ffdf85'],spread:24+level*5,duration:410});
  ring(point[0],point[1],{size:35+level*6,color,duration:330,width:3});
}
let storyClock=0;
function sendLine(who,text,ms=5000) {
  clearTimeout(storyClock); story={who,text};
  render();
  storyClock=setTimeout(()=>{story=null;if(!busy&&!drag)render();},ms);
}
async function focus(next,{pick=true,animate=true}={}) {
  if(!R.isOpen(state,next))return;
  selected=null; region=next;
  if(pick && SPOT_REGION[currentJob()?.spot]!==next)tracked=R.availableRepairs(state).find(r=>SPOT_REGION[r.spot]===next)?.id;
  shop=currentShop();render();save();await board.focus(state,next,animate);
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
  const e=res.events[0];selected=null;shop=id;
  if(!commit(res))return;
  metrics.count('采集'); render();
  const dest=placeAt(e.item), source=world.spriteEl('gen-'+id)||world.spriteEl('site-'+R.GENERATORS[id].spot);
  const from=source?centerOf(source):centerOf($('#gather'));
  const el=world.spriteEl('item-'+e.item.id);
  if(el&&!reducedMotion()){
    el.style.visibility='hidden';
    fly(art(matName(e.item.chain,e.item.level)),from,dest,{size:39,duration:185,arc:-30,endScale:.94}).finally(()=>{
      el.style.visibility='';squash(el,{from:.80,peak:1.13,duration:200});
    });
  }
  materialSound(e.item.chain,muted);
  pulse(5);
  if(state.energy===0)message('体力已用完，还可以合成或交付委托');
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
  renderWorld(state,i.id);
  world.spriteEl('item-'+i.id)?.classList.add('lifted');sfx.lift();pulse(5);
  return true;
}
function dragTarget(cell,client) {
  const [x,y]=client, bounds=field.getBoundingClientRect(), hit=document.elementFromPoint(x,y);
  if(hit?.closest('#bag'))return {type:'bag'};
  if(hit?.closest('.field-book,.map-hud,.map-tools'))return null;
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
  if(target.type==='repair')return repair(target.r,findItem(d.id));
  if(target.type==='stage')return fitPart(target.r,findItem(d.id));
  const events=[...d.events,...next.events];
  if(events.some(e=>e.type==='merge'))revealMerge(events);
  else if(target.type==='bag')message('已收入背包，点背包可以取回');
  sfx.drop();
}
async function fitPart(r,i) {
  if(!i)return;
  const from=placeAt(i),res=R.stagePart(state,r.id,i.id);
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
    const right=field.clientWidth-$('.field-book').offsetLeft+8;
    const localPart=i.cell && regionOfCell(i.cell)===region;
    await world.fit(localPart?[i.cell,site]:[site],{right,maxScale:1.55,pad:1.3,top:36,bottom:30,animate:true,duration:240});
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
  const [who,line]=r.lines.at(-1);sendLine(who,line,3000);
  const returned=result.events.find(e=>e.type==='retrieve');
  message(JOB_NAMES[r.id]+' · '+BENEFITS[r.id]+(returned?' · 试装件已退回'+(returned.item.cell?'草地':'背包'):''),3000);
}
async function deliver(id) {
  const order=state.orders.find(o=>o.id===id);
  if(!order||busy)return;
  const picks=R.pickForOrder(state,order);
  if(!picks)return showOrder(order);
  const job=currentJob(), progress=job&&R.progressFor(state,job);
  const wouldUseOnlyReady=progress?.ready && picks.includes(progress.ready.id) && ![...state.bag,...state.items].some(i=>!picks.includes(i.id)&&i.chain===job.chain&&i.level===job.level);
  if(wouldUseOnlyReady){
    const choice=await sheet({title:'这件材料也能修复',body:'<p>交给居民后，「'+JOB_NAMES[job.id]+'」需要再做一件。</p>'+V.orderDetail(state,order),actions:[{label:'交给居民',value:'send'},{label:'留给工地',kind:'secondary',value:'keep'}]});
    if(choice!=='send')return;
  }
  const current=state.orders.find(o=>o.id===id); if(!current)return;
  const t=R.orderById(id), res=R.deliver(state,id);
  if(!res.ok){message(res.message);return;}
  const dest=centerOf($('[data-order="'+id+'"]')||$('#requests'));
  const flights=res.events[0].consumed.map(i=>({i,at:placeAt(i)}));
  busy=true;selected=null;commit(res);render();
  try{await Promise.all(flights.map(({i,at})=>fly(art(matName(i.chain,i.level)),at,dest,{size:38,duration:240,arc:-50})));}finally{busy=false;}
  materialSound('stamp',muted);sfx.coin();pulse(12);popAt(dest,2);
  metrics.count('完成请求');
  const arrival=id==='o1'?'莉娜把板凳放到了棚门旁':id==='o2'?'米拉把工具箱放回了倒木堆旁':CAST[t.who].name+'收到了';
  message(arrival+' · 金币 +'+t.coins+' · 体力 +'+t.energy);
  if(t.diary)sendLine(t.who,'看，我找到了一页外婆的手记。',2400);
}


async function showJob(r) {
  if(!r || busy || drag)return;
  const p=R.progressFor(state,r), buttons=[];
  if(p.ready)buttons.push({label:'送去修复 · '+JOB_NAMES[r.id],value:'install'});
  if(p.half && r.level>=5 && !p.ready)buttons.push({label:p.staged?'送上另一半，现场合拢':'先将一半放到试装位',value:'stage'});
  if(p.staged)buttons.push({label:'取回试装件',kind:'secondary',value:'retrieve'});
  if(!p.ready)buttons.push({label:'去'+WORKSHOPS[CHAIN_SHOP[r.chain]]+'备料',kind:buttons.length?'secondary':'primary',value:'track'});
  const action=await sheet({title:JOB_NAMES[r.id],body:V.jobDetail(state,r),actions:buttons});
  if(!action)return;
  tracked=r.id; selected=null; save();
  const latest=R.progressFor(state,r);
  if(action==='install'&&latest.ready)return repair(r,latest.ready);
  if(action==='stage'&&latest.half) {
    if(region!==SPOT_REGION[r.spot])await focus(SPOT_REGION[r.spot],{pick:false});
    return fitPart(r,latest.half);
  }
  if(action==='retrieve') {
    return retrieve(r);
  }
  if(action==='track') {shop=CHAIN_SHOP[r.chain];await focus(R.GENERATORS[shop].region,{pick:false});message('已追踪'+JOB_NAMES[r.id]+' · '+V.shortage(r,latest));}
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
async function showOrder(o) {
  const ready=!!R.pickForOrder(state,o);
  const choice=await sheet({title:'居民委托',body:V.orderDetail(state,o),actions:ready?[{label:'交付委托',value:'deliver'}]:[]});
  if(choice==='deliver')return deliver(o.id);
  if(choice?.startsWith('chain-'))return showChain(choice.slice(6));
}
async function showMap() {
  const choices=Object.entries(REGIONS).map(([id,v])=>{
    const open=R.isOpen(state,id), completed=R.REPAIRS.filter(r=>SPOT_REGION[r.spot]===id&&state.done.includes(r.id)).length;
    return `<button class="map-stop ${id}" data-pick="${id}" ${open?'':'disabled'}><b>${v.name}</b><small>${REGION_COPY[id]} · ${open?'已修 '+completed+' 处':'接通旧路后开放'}</small><i>${open?(id===region?'当下':'前往 ›'):icon.lock}</i></button>`;}).join('');
  const actions=[];
  const result=await sheet({title:'故乡地图',body:'<div class="map-stops">'+choices+'</div>',actions});
  if(result&&REGIONS[result]){await focus(result);message(REGIONS[result].name);}
}
async function showShops() {
  const body=Object.entries(R.GENERATORS).map(([id,g])=>`<button class="choice" data-pick="${id}" ${R.generatorOpen(state,id)?'':'disabled'}>
    ${V.img(id==='logs'&&R.generatorBetter(state,id)?'sawmill':WORK_ART[id])}<span><b>${WORKSHOPS[id]}</b>
    <small>${R.generatorOpen(state,id)?REGIONS[g.region].name+(R.generatorBetter(state,id)?' · 已升级':' · 已开放'):'修好旧路开放'}</small></span><i>›</i></button>`).join('');
  const pick=await sheet({title:'选择材料来源',body});
  if(pick&&R.generatorOpen(state,pick)){shop=pick;await focus(R.GENERATORS[pick].region);message('已选'+WORKSHOPS[pick]);}
}
async function showBag() {
  const id=await sheet({title:'随身背包',body:V.bagView(state)});if(!id)return;
  const res=R.unbag(state,id,REGIONS[region].center);
  if(commit(res)){selected=id;render();message('已放回'+REGIONS[region].name);sfx.drop();}
}
async function showChain(chain) {
  const id=CHAIN_SHOP[chain];
  const pick=await sheet({title:CHAINS[chain].label+'合成链',body:V.chainView(state,chain),actions:R.generatorOpen(state,id)?[{label:'前往'+WORKSHOPS[id],value:'go'}]:[]});
  if(pick){shop=id;await focus(R.GENERATORS[id].region);message('点'+WORKSHOPS[id]+'可采集');}
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
  const r=currentJob(),p=r&&R.progressFor(state,r);
  if(p?.ready){message(JOB_NAMES[r.id]+'的材料齐了，点「修复」');return;}
  if(p?.staged&&p.half){message('另一半已经做好，去工地合拢');return;}
  const chain=r?.chain||R.GENERATORS[shop].chain;
  const items=state.items.filter(i=>i.chain===chain && (!r||i.level<r.level));
  const pair=items.find((a,n)=>items.slice(n+1).some(b=>matches(a,b)));
  if(pair) {
    const other=items.find(b=>matches(pair,b));
    await focus(regionOfCell(other.cell),{pick:false});selected=pair.id;render();
    const el=world.spriteEl('item-'+other.id);el?.classList.add('hint');
    message('把发亮的两件'+nameOf(pair.chain,pair.level)+'合起来');return;
  }
  shop=CHAIN_SHOP[chain];await focus(R.GENERATORS[shop].region,{pick:false});
  message(R.freeCount(state,region)?'去'+WORKSHOPS[shop]+'采集'+CHAINS[chain].label+'材料':'空地满了，点一件材料放进背包');
}

const screens={jobs:showJobs,journal:showJournal,energy:showEnergy,settings:showSettings,map:showMap,hint,
  bag:showBag,shops:showShops,album:showAlbum,deselect:()=>{selected=null;render();}};
app.addEventListener('click', async e=>{
  const b=e.target.closest('button');
  if(!b||!app.contains(b)||busy||drag)return;
  unlock();
  if(b.dataset.open)return screens[b.dataset.open]?.();
  if(b.dataset.shop)return gather(b.dataset.shop);
  if(b.dataset.order){
    const o=state.orders.find(o=>o.id===b.dataset.order);
    if(o)return R.pickForOrder(state,o)?deliver(o.id):showOrder(o);
  }
  if(b.dataset.jobAct){
    const r=R.repairById(b.dataset.jobAct),p=R.progressFor(state,r);
    if(p.ready)return repair(r,p.ready);
    if(p.half&&r.level>=5)return fitPart(r,p.half);
    return showJob(r);
  }
  if(b.dataset.chain)return showChain(b.dataset.chain);
  if(b.dataset.itemRepair)return repair(R.repairById(b.dataset.itemRepair),findItem(selected));
  if(b.dataset.itemFit)return fitPart(R.repairById(b.dataset.itemFit),findItem(selected));
  if(b.dataset.retrieve)return retrieve(R.repairById(b.dataset.retrieve));
  if(b.dataset.store){
    if(commit(R.store(state,b.dataset.store))){selected=null;render();sfx.drop();message('已收入背包');}return;
  }
  if(b.dataset.sell){
    const i=findItem(b.dataset.sell);if(!i)return;
    if(i.level>=3){const yes=await sheet({title:'出售'+nameOf(i.chain,i.level)+'？',body:'<p>这件素材将换成 '+R.sellPrice(i.level)+' 金币。</p>',actions:[{label:'留在棋盘',value:false},{label:'出售',value:true,kind:'secondary'}]});if(!yes)return;}
    if(commit(R.sell(state,i.id))){selected=null;render();sfx.coin();message('已出售 · 金币 +'+R.sellPrice(i.level));}
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
if(practice && !state.stats.merges && !state.fittings?.ferry && !state.done.includes('ferry'))message('从 L3 连合到 L6，或先试装一半',5200);
