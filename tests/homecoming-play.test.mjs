import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../dist/homecoming-play.mjs';
import * as Legacy from '../dist/homecoming.mjs';
import {availableStoryKeys,storySummary} from '../dist/homecoming-story.mjs';
import {createJourneyMatch,matchSessionFits,claimMatchBox,journeyMatchLevel} from '../dist/journey-match.mjs';
import {m3Hint,m3Move,m3Valid} from '../dist/match3-premium.mjs';

function apply(s,a){const r=G.act(s,a);assert.ok(r.ok,`${JSON.stringify(a)}: ${r.message}`);assert.ok(G.validState(r.state),`Invalid after ${JSON.stringify(a)}`);return r.state;}
function mergePair(s,chain){const items=s.items.filter(i=>!chain||i.chain===chain);for(const a of items)for(const b of items)if(a.id!==b.id&&G.previewMerge(s,a.id,b.id).ok)return{type:'MERGE',a:a.id,b:b.id};return null;}
function earn(s,chain){s=apply(s,{type:'WIN'});s=apply(s,{type:'OPEN',chain});while(s.pending.length)s=apply(s,{type:'DRAW'});return s;}
function buildTask(s,id){assert.ok(G.availableTasks(s).some(t=>t.id===id),id);s=apply(s,{type:'FOCUS',id});for(let n=0;n<250;n++){const item=G.taskItem(s);if(item)return apply(s,{type:'BUILD',id:item.id});const pair=mergePair(s,G.currentTask(s).chain);if(pair)s=apply(s,pair);else if(s.pending.length)s=apply(s,{type:'DRAW'});else{if(G.progress(s).wins===G.progress(s).opened)s=apply(s,{type:'WIN'});s=apply(s,{type:'OPEN',chain:G.currentTask(s).chain});}}throw Error('No progress '+id);}
function roof(){return buildTask(G.freshGame(),'roof');}
function river(){let s=roof();for(const id of ['fire','path','home'])s=buildTask(s,id);return apply(s,{type:'FINISH',recycle:false});}

test('first win finishes only the small roof repair and then unlocks two real goals',()=>{
  const s=roof();assert.equal(s.regions.camp.wins,1);assert.deepEqual(s.regions.camp.doneIds,['roof']);assert.deepEqual(G.availableTasks(s).map(t=>t.id),['fire','path']);assert.equal(s.items.length,0);assert.equal(s.pending.length,0);
});
test('focus survives opening, drawing, merging, moving and save restoration',()=>{
  let s=apply(roof(),{type:'FOCUS',id:'path'});s=earn(s,'wood');s=apply(s,mergePair(s,'wood'));s=apply(s,{type:'STORE',id:s.items[0].id});assert.equal(G.currentTask(s).id,'path');s=G.upgradeJourney(JSON.parse(JSON.stringify(s)));assert.equal(G.currentTask(s).id,'path');assert.equal(G.act(s,{type:'FOCUS',id:'home'}).ok,false);
});
test('camp routes have different land and story midway, both conserve the exact eight-box budget',()=>{
  for(const order of [['fire','path'],['path','fire']]){let s=buildTask(roof(),order[0]);assert.equal(G.taskDone(s,'fire'),order[0]==='fire');assert.equal(G.taskDone(s,'path'),order[0]==='path');assert.equal(G.workCells(s).some(c=>G.key(c)==='2,-1'),order[0]==='path');assert.deepEqual(availableStoryKeys(s),['intro','roof',order[0]]);assert.equal(storySummary(s).line.includes('灯'),order[0]==='fire');s=buildTask(s,order[1]);s=buildTask(s,'home');assert.equal(s.regions.camp.wins,8);assert.equal(G.settlement(s).value,1);}
});
test('river can restore banks and pier before the stream without inventing flowing water',()=>{
  let s=river();s=buildTask(s,'spring');assert.deepEqual(G.supplyChoices(s).map(c=>c.chain),['water','reed']);s=buildTask(s,'reeds');assert.equal(G.tileKind(s,[4,-2]),'dry');assert.equal(G.taskDone(s,'stream'),false);assert.deepEqual(G.availableTasks(s).map(t=>t.id),['stream','shore','pier']);
  for(const id of ['pier','shore','stream','ferry'])s=buildTask(s,id);
  assert.deepEqual(s.regions.river.doneIds,['spring','reeds','pier','shore','stream','ferry']);assert.equal(s.regions.river.wins,12);assert.equal(G.tileKind(s,[4,-2]),'water');assert.equal(G.settlement(s).value,4);assert.equal(new Set(s.regions.river.openedPacks).size,12);
});
test('all legal river task orders finish with the same supply budget and valid geometry',()=>{
  const initial=buildTask(river(),'spring');
  let paths=0;
  function visit(s){if(G.regionComplete(s)){paths++;assert.equal(s.regions.river.wins,12);assert.equal(G.settlement(s).value,4);return;}for(const t of G.availableTasks(s))visit(buildTask(s,t.id));}
  visit(initial);assert.equal(paths,8);
});
test('box pieces dispense individually and unopened queue cannot be replaced or double-counted',()=>{
  let s=apply(apply(G.freshGame(),{type:'WIN'}),{type:'WIN'});s=apply(s,{type:'OPEN',chain:'wood'});assert.equal(s.items.length,0);assert.equal(s.pending.length,4);assert.equal(G.accounting(s).inventory.wood,4);assert.equal(G.act(s,{type:'OPEN'}).ok,false);s=apply(s,{type:'DRAW'});assert.equal(s.items.length,1);assert.equal(s.pending.length,3);assert.equal(G.settlement(s).value,4);assert.deepEqual(G.act(s,{type:'OPEN',chain:'reed'}).state,s);
});
test('supplies can be selected in the opposite chain order, with no phantom pack or lost change',()=>{
  let s=buildTask(river(),'spring');s=apply(s,{type:'WIN'});s=apply(s,{type:'OPEN',chain:'reed'});assert.equal(s.pending[0].chain,'reed');assert.ok(s.regions.river.openedPacks.includes(5));assert.equal(G.accounting(s).supplied.reed,8);assert.equal(G.act(s,{type:'OPEN',chain:'dock'}).ok,false);
  while(s.pending.length)s=apply(s,{type:'DRAW'});s=buildTask(s,'reeds');assert.ok(G.supplyChoices(s).some(c=>c.chain==='dock'));assert.equal(G.validState({...s,regions:{...s.regions,river:{...s.regions.river,openedPacks:[0,0]}}}),false);
});
test('edge merges and moving existing components open a usable tile without consuming material',()=>{
  let s=earn(roof(),'wood');while(!s.items.some(i=>i.level===3))s=apply(s,mergePair(s,'wood'));const i=s.items.find(i=>i.level===3),before=G.settlement(s).value,oldCount=G.workCells(s).length;
  s=apply(s,{type:'MOVE',id:i.id,q:-2,r:1});assert.ok(s.explored.includes('camp-fern'));assert.equal(G.workCells(s).length,oldCount+1);assert.equal(G.settlement(s).value,before);assert.equal(G.tileKind(s,[-3,1]),'ground');assert.equal(G.act(s,{type:'EXPLORE',id:'camp-fern'}).ok,false);
  const other=s.items.find(x=>x.id!==i.id);s=apply(s,{type:'MOVE',id:other.id,q:-3,r:1});assert.equal(s.items.find(x=>x.id===other.id).q,-3);
  let t=earn(roof(),'wood');const pair=t.items.filter(i=>i.level===2).slice(0,2);t=apply(t,{type:'MOVE',id:pair[1].id,q:-2,r:1});const p=G.previewMerge(t,pair[0].id,pair[1].id);assert.equal(p.discoveries[0].id,'camp-fern');const result=G.act(t,{type:'MERGE',a:pair[0].id,b:pair[1].id});assert.ok(G.validState(result.state));assert.equal(result.events[0].discoveries[0].id,'camp-fern');
});
test('after the region is complete, missed optional land remains recoverable',()=>{
  let s=river();assert.equal(G.regionComplete(s,'camp'),true);for(const f of G.frontiers(s).filter(f=>f.region==='camp'&&!f.unlocked))s=apply(s,{type:'EXPLORE',id:f.id});assert.equal(s.explored.filter(id=>id.startsWith('camp')).length,2);
});
test('full board stops dispensing without loss and explicit storage has a fixed capacity',()=>{
  let s=G.freshGame();for(let b=0;b<4;b++){s=apply(s,{type:'WIN'});s=apply(s,{type:'OPEN'});while(s.pending.length&&G.freeCount(s)>0)s=apply(s,{type:'DRAW'});if(s.pending.length)break;}
  assert.ok(s.pending.length);assert.equal(G.freeCount(s),0);const before=structuredClone(s);assert.equal(G.act(s,{type:'DRAW'}).ok,false);assert.deepEqual(s,before);
  for(const i of s.items.slice(0,6))s=apply(s,{type:'STORE',id:i.id});assert.equal(s.items.filter(G.inTray).length,6);assert.equal(G.act(s,{type:'STORE',id:s.items.find(i=>!G.inTray(i)).id}).ok,false);s=apply(s,{type:'DRAW'});assert.equal(G.validState(s),true);
});
test('a draw into the other region selects its new piece so the camera can show where it went',()=>{
  let s=river(),moved=false;
  for(let turn=0;turn<45&&!moved;turn++){
    if(!s.pending.length){s=apply(s,{type:'WIN'});s=apply(s,{type:'OPEN',chain:'water'});}
    const r=G.act(s,{type:'DRAW',view:'river'});assert.ok(r.ok);assert.ok(G.validState(r.state));s=r.state;
    if(r.events[0].away){moved=true;assert.equal(r.selected,r.events[0].itemId);const item=s.items.find(i=>i.id===r.selected);assert.ok(G.landCells(s,'camp').some(c=>G.key(c)===G.key([item.q,item.r])));assert.match(r.events[0].title,/林间营地/);}
  }
  assert.equal(moved,true);
});
test('migration preserves every legacy piece, pending match, supply balance and long storage',()=>{
  let old=Legacy.freshGame();for(let i=0;i<5;i++){old=Legacy.act(old,{type:'WIN'}).state;old=Legacy.act(old,{type:'OPEN'}).state;}for(const i of old.items)old=Legacy.act(old,{type:'STORE',id:i.id}).state;
  const session=createJourneyMatch(old,{seed:12,runId:'migrate'}),s=G.upgradeJourney(old);assert.ok(s);assert.deepEqual(s.items,old.items);assert.equal(s.storeLimit,20);assert.deepEqual(G.accounting(s),Legacy.accounting(old));assert.equal(matchSessionFits(s,session),true);assert.equal(G.validState(G.upgradeJourney(s)),true);
  const bad=structuredClone(old);bad.items[0].level=7;assert.equal(G.upgradeJourney(bad),null);
});
test('malformed branching saves are rejected without throwing or accepting impossible task order',()=>{
  const base=river();const corruptions=[
    s=>s.items.push(null),s=>s.pending.push(null),s=>s.regions.river.doneIds={bad:true},
    s=>{s.regions.camp.doneIds=['roof','home','fire','path'];},
    s=>s.regions.camp.settlement.converted.push(null),
    s=>s.regions.river.focusId='ferry',
    s=>s.explored.push('river-willow')
  ];
  for(const mutate of corruptions){const s=structuredClone(base);mutate(s);assert.equal(G.validState(s),false);assert.equal(G.upgradeJourney(s),null);}
});
test('settlement includes unclaimed last scraps and recycle converts them exactly once',()=>{
  let s=G.freshGame();for(const id of ['roof','fire','path','home'])s=buildTask(s,id);assert.ok(s.pending.length===1&&s.pending[0].level===1);assert.equal(G.settlement(s).items[0].pending,true);
  const kept=apply(s,{type:'FINISH',recycle:false});assert.equal(kept.pending.length,1);assert.equal(G.nextStep(kept).type,'draw');
  const recycled=apply(s,{type:'FINISH',recycle:true});assert.equal(recycled.pending.length,0);assert.equal(recycled.supplies,1);assert.equal(G.act(recycled,{type:'FINISH',recycle:true}).ok,false);
});
test('over-level delivery returns the exact difference, including when the chosen task is smaller',()=>{
  let s=apply(roof(),{type:'FOCUS',id:'path'});s=earn(s,'wood');s=earn(s,'wood');while(!s.items.some(i=>i.level===5))s=apply(s,mergePair(s,'wood'));
  const item=s.items.find(i=>i.level===5),before=G.settlement(s).value;s=apply(s,{type:'BUILD',id:item.id,taskId:'fire'});assert.equal(G.taskDone(s,'fire'),true);assert.equal(G.taskDone(s,'path'),false);assert.equal(G.settlement(s).value,before-8);
});
test('the v8 twenty-level match, dispense, manual merge, build and settlement loop finishes without extra rewards',()=>{
  let s=G.freshGame(),wins=0;
  for(let turn=0;turn<500&&!G.complete(s);turn++){
    const h=G.nextStep(s);
    if(h.type==='win'){
      const level=journeyMatchLevel(s);let won=null;
      for(let attempt=0;attempt<4&&!won;attempt++){
        const session=createJourneyMatch(s,{seed:20261016+level+attempt*541,runId:`v8-${level}-${attempt}`});
        while(session.game.status==='playing'){const result=m3Move(session.game,m3Hint(session.game));assert.ok(result.ok);session.game=result.state;}
        assert.ok(m3Valid(session.game));
        if(session.game.status==='won')won=session;else assert.equal(claimMatchBox(s,session).ok,false);
      }
      assert.ok(won,`Level ${level}`);const result=claimMatchBox(s,won);assert.ok(result.ok);s=result.state;assert.equal(claimMatchBox(s,won).ok,false);wins++;
    }else{
      const action=h.type==='merge'?{type:'MERGE',a:h.a,b:h.b}:h.type==='build'?{type:'BUILD',id:h.id}:h.type==='focus'?{type:'FOCUS',id:h.task.id}:h.type==='finish'?{type:'FINISH',recycle:true}:{type:h.type.toUpperCase()};
      s=apply(s,action);
    }
    assert.ok(G.validState(s));
  }
  assert.ok(G.complete(s));assert.equal(wins,20);assert.equal(s.supplies,4);assert.equal(s.pending.length,0);assert.equal(createJourneyMatch(s),null);
});
