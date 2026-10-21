import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../dist/homecoming-play.mjs';
import {mergeMilestone,milestoneCopy} from '../dist/homecoming-momentum.mjs';

function apply(s,a){const r=G.act(s,a);assert.ok(r.ok,r.message);assert.ok(G.validState(r.state));return r.state;}
function compress(s,chain){for(let n=0;n<100;n++){const list=s.items.filter(i=>i.chain===chain);let pair;for(const a of list)for(const b of list)if(a.id!==b.id&&G.previewMerge(s,a.id,b.id).ok)pair=[a.id,b.id];if(!pair)return s;s=apply(s,{type:'MERGE',a:pair[0],b:pair[1]});}throw Error('merge limit');}
function batch(s,chain){s=apply(s,{type:'WIN'});return apply(s,{type:'COLLECT',chain});}
function spring(){let s=G.demoRiver();if(s.pending.length)s=apply(s,{type:'COLLECT'});s=compress(batch(s,'water'),'water');s=apply(s,{type:'BUILD',id:G.taskItem(s).id});return s;}

test('one tap opens exactly one box and places its materials, without merging or spending another ticket',()=>{
  let s=apply(apply(G.freshGame(),{type:'WIN'}),{type:'WIN'}),before=structuredClone(s);const r=G.act(s,{type:'COLLECT',chain:'wood'});assert.ok(r.ok);s=r.state;assert.ok(G.validState(s));assert.equal(s.regions.camp.opened,1);assert.equal(s.regions.camp.wins,2);assert.equal(s.items.length,4);assert.ok(s.items.every(i=>i.level===1));assert.equal(s.pending.length,0);assert.equal(r.events[0].itemIds.length,4);assert.deepEqual(before.items,[]);
});
test('a partial batch retains every unplaced item and a full board does not open another box',()=>{
  let s=G.freshGame();for(let n=0;n<4;n++)s=apply(s,{type:'WIN'});for(let n=0;n<4;n++)s=apply(s,{type:'COLLECT'});
  assert.equal(G.freeCount(s),0);assert.equal(s.pending.length,4);assert.equal(s.items.filter(G.inTray).length,0);assert.equal(G.settlement(s).value,28);
  const before=structuredClone(s),r=G.act(s,{type:'COLLECT'});assert.equal(r.ok,false);assert.deepEqual(r.state,before);
  s=apply(s,{type:'STORE',id:s.items[0].id});s=apply(s,{type:'COLLECT'});assert.equal(s.pending.length,3);assert.equal(G.settlement(s).value,28);
});
test('batch collection stays in one region; only a subsequent tap moves to the other region',()=>{
  let s=G.demoRiver();s=apply(s,{type:'COLLECT',view:'river'});let partial=null;
  for(let n=0;n<5;n++){s=apply(s,{type:'WIN'});const r=G.act(s,{type:'COLLECT',chain:'water',view:'river'});assert.ok(r.ok);s=r.state;if(s.pending.length){partial=r;break;}}
  assert.ok(partial);assert.equal(partial.events[0].destination,'river');assert.equal(partial.selected,null);const r=G.act(s,{type:'COLLECT',view:'river'});assert.ok(r.ok);assert.equal(r.events[0].destination,'camp');assert.equal(r.events[0].away,true);assert.ok(r.selected);assert.ok(G.validState(r.state));
});
test('single extraction and whole-box extraction can be mixed across save/restore without duplication',()=>{
  let s=apply(apply(G.freshGame(),{type:'WIN'}),{type:'OPEN'});s=apply(s,{type:'DRAW'});s=G.upgradeJourney(JSON.parse(JSON.stringify(s)));s=apply(s,{type:'COLLECT'});assert.equal(s.items.length,4);assert.equal(s.pending.length,0);assert.equal(G.act(s,{type:'COLLECT'}).ok,false);assert.equal(G.accounting(s).inventory.wood,4);
});
test('water milestones provide real intermediate goals and only promise a repair when the last box is enough',()=>{
  let s=spring();let m=mergeMilestone(s);assert.equal(m.target.level,5);assert.equal(m.packsNeeded,1);assert.equal(m.taskPacks,4);assert.match(milestoneCopy(m).forecast,/蓄水组件/);
  s=compress(batch(s,'water'),'water');m=mergeMilestone(s);assert.equal(m.highest,5);assert.equal(m.level,6);assert.equal(m.winsNeeded,1);assert.equal(m.taskPacks,3);assert.deepEqual(m.halves,[1,0]);
  s=compress(batch(s,'water'),'water');m=mergeMilestone(s);assert.equal(m.highest,6);assert.equal(m.level,7);assert.equal(m.packsNeeded,2);assert.equal(m.taskPacks,2);assert.notEqual(milestoneCopy(m).badge,'再赢 1 局');assert.match(milestoneCopy(m).forecast,/50%/);
  s=compress(batch(s,'water'),'water');m=mergeMilestone(s);assert.equal(m.level,7);assert.deepEqual(m.halves,[1,.5]);assert.equal(m.packsNeeded,1);assert.equal(m.taskPacks,1);assert.equal(m.winsNeeded,1);assert.match(milestoneCopy(m).forecast,/凑齐溪流组件/);
  s=compress(batch(s,'water'),'water');m=mergeMilestone(s);assert.ok(m.ready);assert.equal(m.winsNeeded,0);assert.equal(G.SIZE[m.ready.level],3);
});
test('earned boxes and pending materials reduce the forecast instead of asking for unnecessary wins',()=>{
  let s=spring();s=apply(s,{type:'WIN'});let m=mergeMilestone(s);assert.equal(m.winsNeeded,0);assert.match(milestoneCopy(m).forecast,/现有箱子/);
  s=apply(s,{type:'OPEN',chain:'water'});m=mergeMilestone(s);assert.equal(m.boxed,16);assert.equal(m.missing,0);assert.equal(m.packsNeeded,0);assert.equal(milestoneCopy(m).badge,'现在就能合');assert.match(milestoneCopy(m).forecast,/箱中/);
});
test('another chain cannot inflate a goal; both supply previews describe the actual box value',()=>{
  let s=spring();s=apply(s,{type:'FOCUS',id:'reeds'});s=batch(s,'water');const reed=mergeMilestone(s),water=mergeMilestone(s,G.TASKS.river.find(t=>t.id==='stream'));assert.equal(reed.total,0);assert.equal(reed.taskPacks,1);assert.equal(reed.afterBoxLevel,4);assert.equal(water.total,16);assert.equal(water.afterBoxLevel,6);
  s=apply(s,{type:'FOCUS',id:'stream'});assert.equal(mergeMilestone(s).total,16);assert.equal(s.regions.river.focusId,'stream');
});
test('all one-box milestone promises are backed by sufficient actual inventory plus that exact next pack',()=>{
  let s=G.freshGame();for(let n=0;n<500&&!G.complete(s);n++){
    for(const t of G.availableTasks(s)){const m=mergeMilestone(s,t);if(m.packsNeeded===1){assert.ok(m.total<m.needed);assert.ok(m.total+m.nextValue>=m.needed);}if(m.taskPacks===1)assert.ok(m.total+m.nextValue>=G.valueOf(t));}
    const h=G.nextStep(s);s=apply(s,h.type==='win'?{type:'WIN'}:['draw','open'].includes(h.type)?{type:'COLLECT'}:h.type==='merge'?{type:'MERGE',a:h.a,b:h.b}:h.type==='focus'?{type:'FOCUS',id:h.task.id}:h.type==='finish'?{type:'FINISH',recycle:true}:{type:'BUILD',id:h.id});
  }assert.ok(G.complete(s));assert.equal(s.supplies,4);
});
