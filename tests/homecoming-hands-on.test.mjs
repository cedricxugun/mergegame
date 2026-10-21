import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../dist/homecoming-play.mjs';
import {beginMergeGesture,extendMergeGesture,finishMergeGesture,cancelMergeGesture} from '../dist/homecoming-gesture.mjs';
function apply(s,a){const r=G.act(s,a);assert.ok(r.ok,r.message);assert.ok(G.validState(r.state));return r.state;}
function ready(){let s=G.demoRiverHandsOn();for(let n=0;n<3;n++){const h=G.nextStep(s);s=apply(s,{type:'MERGE',a:h.a,b:h.b});}return s;}

test('the practice fixture has a real conserved recipe for three successive held merges',()=>{
  const state=G.demoRiverHandsOn(),snapshot=structuredClone(state),parts=state.items.filter(i=>i.chain==='water').sort((a,b)=>a.level-b.level);assert.deepEqual(parts.map(i=>i.level),[2,2,3,4]);assert.ok(G.validState(state));
  let g=beginMergeGesture(state,parts[0].id);for(const p of parts.slice(1)){const r=extendMergeGesture(g,p.id);assert.ok(r.ok,r.message);g=r.gesture;assert.ok(G.validState(g.draft));}
  const result=finishMergeGesture(g);assert.equal(g.steps,3);assert.equal(result.state.items.find(i=>i.id===result.selected).level,5);assert.deepEqual(G.accounting(result.state),G.accounting(state));assert.deepEqual(state,snapshot);assert.deepEqual(cancelMergeGesture(g),snapshot);
});
test('wrong targets and interrupted drafts never lose materials or mutate the saved starting state',()=>{
  const state=G.demoRiverHandsOn(),parts=state.items.filter(i=>i.chain==='water').sort((a,b)=>a.level-b.level);let g=beginMergeGesture(state,parts[0].id);
  const wrong=extendMergeGesture(g,parts[3].id);assert.equal(wrong.ok,false);assert.deepEqual(wrong.gesture,g);g=extendMergeGesture(g,parts[1].id).gesture;
  const stale=extendMergeGesture(g,parts[1].id);assert.equal(stale.ok,false);assert.deepEqual(cancelMergeGesture(g),state);
  const failed=finishMergeGesture(g,{type:'MOVE',q:50,r:50});assert.equal(failed.ok,false);assert.ok(G.validState(failed.state));assert.equal(G.settlement(failed.state).value,G.settlement(state).value);
});
test('trial installation frees the original cell without changing work capacity, material value or repair progress',()=>{
  const state=ready(),item=state.items.find(i=>i.chain==='water'),capacity=G.workCells(state).length,free=G.freeCount(state),placed=apply(state,{type:'TRY',id:item.id,socket:'canal'}),mounted=placed.items.find(i=>i.id===item.id);
  assert.ok(G.isTrial(mounted));assert.equal(G.inTray(mounted),false);assert.deepEqual(G.cellsOf(mounted),[]);assert.equal(G.workCells(placed).length,capacity);assert.equal(G.freeCount(placed),free+1);assert.deepEqual(G.accounting(placed),G.accounting(state));assert.deepEqual(placed.regions,state.regions);
  const restored=apply(JSON.parse(JSON.stringify(placed)),{type:'RETRIEVE',id:item.id});assert.deepEqual(restored.items.find(i=>i.id===item.id),item);assert.deepEqual(restored.regions,state.regions);assert.deepEqual(G.accounting(restored),G.accounting(state));
});
test('trial slots reject wrong chains, early stages, incompatible grades and duplicate placement atomically',()=>{
  const state=G.demoRiverHandsOn(),low=state.items.find(i=>i.chain==='water'&&i.level===2);assert.equal(G.act(state,{type:'TRY',id:low.id,socket:'canal'}).ok,false);
  let s=ready(),item=s.items.find(i=>i.chain==='water');assert.equal(G.act(s,{type:'TRY',id:item.id,socket:'bank'}).ok,false);s=apply(s,{type:'TRY',id:item.id,socket:'canal'});
  for(const type of ['STORE','MOVE','MERGE']){const r=G.act(s,{type,id:item.id,q:6,r:0,a:item.id,b:s.items[0].id});assert.equal(r.ok,false);assert.deepEqual(r.state,s);}
  assert.equal(G.act(s,{type:'TRY',id:item.id,socket:'canal'}).ok,false);const corrupt=structuredClone(s);corrupt.items.find(i=>i.id===item.id).q=6;assert.equal(G.validState(corrupt),false);
});
test('a retrieved component can continue to the next merge level, with guidance pointing to retrieval',()=>{
  let s=ready(),item=s.items.find(i=>i.chain==='water');s=apply(s,{type:'TRY',id:item.id,socket:'canal'});s=apply(s,{type:'WIN'});s=apply(s,{type:'COLLECT',chain:'water'});
  for(let n=0;n<5;n++){const h=G.nextStep(s);if(h.type==='retrieve')break;assert.equal(h.type,'merge');s=apply(s,{type:'MERGE',a:h.a,b:h.b});}
  assert.equal(G.nextStep(s).type,'retrieve');s=apply(s,{type:'RETRIEVE',id:item.id});const h=G.nextStep(s);assert.equal(h.type,'merge');s=apply(s,{type:'MERGE',a:h.a,b:h.b});assert.ok(s.items.some(i=>i.chain==='water'&&i.level===6));
});
test('placing a gesture result into a trial socket is part of the same reversible draft',()=>{
  const s=G.demoRiverHandsOn(),parts=s.items.filter(i=>i.chain==='water').sort((a,b)=>a.level-b.level);let g=beginMergeGesture(s,parts[0].id);for(const p of parts.slice(1))g=extendMergeGesture(g,p.id).gesture;const result=finishMergeGesture(g,{type:'TRY',socket:'canal'});assert.ok(result.ok);assert.ok(G.validState(result.state));assert.ok(G.isTrial(result.state.items.find(i=>i.id===result.selected)));assert.deepEqual(cancelMergeGesture(g),s);
});
function mergeChain(s,chain){for(let n=0;n<100;n++){const items=s.items.filter(i=>i.chain===chain&&!G.isTrial(i)).sort((a,b)=>a.level-b.level);let pair=null;for(let i=0;i<items.length-1;i++)if(items[i].level===items[i+1].level){pair=[items[i],items[i+1]];break;}if(!pair)return s;s=apply(s,{type:'MERGE',a:pair[0].id,b:pair[1].id});}throw Error('merge limit');}
test('an installed reed component can be deliberately delivered without consuming or blocking any extra work cell',()=>{
  let s=ready();s=apply(s,{type:'FOCUS',id:'reeds'});s=apply(s,{type:'WIN'});s=apply(s,{type:'COLLECT',chain:'reed'});s=mergeChain(s,'reed');const item=s.items.find(i=>i.chain==='reed'),count=G.workCells(s).length;
  s=apply(s,{type:'TRY',id:item.id,socket:'bank'});assert.ok(G.previewBuild(s,item.id,'reeds').ok);s=apply(s,{type:'BUILD',id:item.id,taskId:'reeds'});assert.ok(G.taskDone(s,'reeds'));assert.equal(s.items.some(i=>i.id===item.id),false);assert.equal(s.items.some(i=>i.trialSocket==='bank'),false);assert.equal(G.workCells(s).length,count);
  s=apply(s,{type:'WIN'});s=apply(s,{type:'COLLECT',chain:'dock'});s=mergeChain(s,'dock');const dock=s.items.find(i=>i.chain==='dock');s=apply(s,{type:'TRY',id:dock.id,socket:'landing'});assert.ok(G.isTrial(s.items.find(i=>i.id===dock.id)));s=apply(s,{type:'RETRIEVE',id:dock.id});assert.equal(s.items.find(i=>i.id===dock.id).level,dock.level);
});
test('retrieval remains lossless when every work cell and all six storage places have been filled',()=>{
  let s=ready(),water=s.items.find(i=>i.chain==='water');s=apply(s,{type:'TRY',id:water.id,socket:'canal'});
  s=apply(s,{type:'WIN'});s=apply(s,{type:'COLLECT',chain:'reed'});s=mergeChain(s,'reed');s=apply(s,{type:'BUILD',id:s.items.find(i=>i.chain==='reed').id,taskId:'reeds'});
  for(let n=0;n<100&&(s.pending.length||G.progress(s).opened<G.maxWins(s));n++){
    if(G.freeCount(s)===0){const item=s.items.find(i=>!G.inTray(i)&&!G.isTrial(i));s=apply(s,{type:'STORE',id:item.id});}
    if(s.pending.length){s=apply(s,{type:'COLLECT'});continue;}
    const choice=G.supplyChoices(s)[0];assert.ok(choice);s=apply(s,{type:'WIN'});s=apply(s,{type:'COLLECT',chain:choice.chain});
  }
  assert.equal(G.freeCount(s),0);assert.equal(s.items.filter(G.inTray).length,6);const value=G.settlement(s).value,r=G.act(s,{type:'RETRIEVE',id:water.id});assert.ok(r.ok);assert.ok(G.validState(r.state));assert.equal(r.events[0].pending,true);assert.equal(r.state.pending[0].level,5);assert.equal(r.state.items.some(G.isTrial),false);assert.equal(G.settlement(r.state).value,value);
});
test('a held gesture can grow into three cells and cancellation restores the original positions',()=>{
  let s=ready();for(let n=0;n<3;n++){s=apply(s,{type:'WIN'});s=apply(s,{type:'COLLECT',chain:'water'});}
  const desired={1:1,4:2,5:1,6:1};for(let n=0;n<100;n++){let pair=null;for(let level=1;level<7;level++){const xs=s.items.filter(i=>i.chain==='water'&&i.level===level);if(xs.length>=(desired[level]||0)+2){pair=xs.slice(0,2);break;}}if(!pair)break;s=apply(s,{type:'MERGE',a:pair[0].id,b:pair[1].id});}
  const parts=s.items.filter(i=>i.chain==='water'&&i.level>=4).sort((a,b)=>a.level-b.level);assert.deepEqual(parts.map(i=>i.level),[4,4,5,6]);let g=beginMergeGesture(s,parts[0].id);for(const p of parts.slice(1)){const result=extendMergeGesture(g,p.id);assert.ok(result.ok);g=result.gesture;}const last=g.draft.items.find(i=>i.id===g.id);assert.equal(G.cellsOf(last).length,3);assert.ok(G.validState(g.draft));assert.deepEqual(G.accounting(g.draft),G.accounting(s));assert.deepEqual(cancelMergeGesture(g),s);
});
