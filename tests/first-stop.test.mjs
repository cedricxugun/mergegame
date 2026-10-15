import test from 'node:test';
import assert from 'node:assert/strict';
import {SAVE_KEY,SIZE,TASKS,key,cellsOf,boundary,freshGame,workCells,sceneCells,complete,occupancy,totalValue,currentTask,taskItem,previewMove,previewMerge,nextStep,settlement,act,validState} from '../dist/first-stop.mjs';
const apply=(state,action)=>{const result=act(state,action);assert.ok(result.ok,result.message);assert.ok(validState(result.state),JSON.stringify(result.state));return result.state;};
const opened=()=>apply(apply(freshGame(),{type:'WIN'}),{type:'OPEN'});
function finish(state){let steps=0;while(!complete(state)&&steps++<12){const hint=nextStep(state);if(hint.type==='merge')state=apply(state,{type:'MERGE',a:hint.a,b:hint.b});else if(hint.type==='build')state=apply(state,{type:'BUILD',id:hint.id});else assert.fail(`Unexpected hint ${hint.type}`);}assert.ok(complete(state));return state;}
test('one match-three win and one five-piece chest finish the first stop in two merges and two builds',()=>{
  let state=opened(),merges=0,builds=0;assert.equal(state.items.length,5);assert.equal(workCells(state).length,7);assert.equal(totalValue(state),13);
  while(!complete(state)){const h=nextStep(state);if(h.type==='merge'){state=apply(state,{type:'MERGE',a:h.a,b:h.b});merges++;}else{state=apply(state,{type:'BUILD',id:h.id});builds++;}}
  assert.equal(merges,2);assert.equal(builds,2);assert.equal(state.wins,1);assert.equal(state.growthSeen,true);assert.equal(workCells(state).length,9);assert.equal(sceneCells(state).length,6);assert.equal(state.pathConnected,true);assert.equal(settlement(state).value,1);
  state=apply(state,{type:'DEPART',route:'river'});assert.equal(state.supplies,1);assert.equal(state.items.length,0);assert.equal(totalValue(state),13);assert.ok(validState(JSON.parse(JSON.stringify(state))));assert.equal(act(state,{type:'DEPART',route:'river'}).ok,false);
});
test('three-cell growth preserves the original two trees value and moves whole blockers consistently with its preview',()=>{
  const state=opened(),trees=state.items.filter(i=>i.chain==='forest'&&i.level===3),before=JSON.stringify(state);const p=previewMerge(state,trees[0].id,trees[1].id);assert.ok(p.ok);assert.equal(p.cells.length,3);assert.equal(JSON.stringify(state),before);
  const next=apply(state,{type:'MERGE',a:trees[0].id,b:trees[1].id});assert.equal(occupancy(next).size,6);assert.equal(next.items.length,4);assert.equal(totalValue(next),13);for(const move of p.shifted){const item=next.items.find(i=>i.id===move.id);assert.deepEqual(cellsOf(item),move.cells);assert.notEqual(item.q,null);}
});
test('building preserves all seven work cells, opens two adjacent cells, and the final ground has one continuous boundary',()=>{
  let state=opened();const h=nextStep(state);state=apply(state,{type:'MERGE',a:h.a,b:h.b});const previous=new Set(workCells(state).map(key));state=apply(state,{type:'BUILD',id:taskItem(state).id});assert.ok(workCells(state).every(c=>!sceneCells(state).some(s=>key(s)===key(c))));assert.ok([...previous].every(k=>workCells(state).some(c=>key(c)===k)));assert.equal(workCells(state).length,9);
  state=finish(state);assert.equal(boundary([...workCells(state),...sceneCells(state)]).length,1);assert.equal(boundary(sceneCells(state)).length,1);
});
test('players can make the tent first but can only deliver the current map blueprint',()=>{
  let state=opened();const parts=state.items.filter(i=>i.chain==='camp');state=apply(state,{type:'MERGE',a:parts[0].id,b:parts[1].id});const tent=state.items.find(i=>i.chain==='camp'),before=JSON.stringify(state);assert.equal(currentTask(state).id,'forest');assert.equal(act(state,{type:'BUILD',id:tent.id}).ok,false);assert.equal(JSON.stringify(state),before);state=finish(state);assert.equal(settlement(state).value,1);
});
test('all materials can be kept temporarily and still merge and build without another reward',()=>{
  let state=opened();for(const item of [...state.items])state=apply(state,{type:'STORE',id:item.id});assert.equal(occupancy(state).size,0);state=finish(state);assert.equal(state.wins,1);assert.equal(settlement(state).value,1);
});
test('a single piece moves an entire three-cell item while scenery and invalid drops remain untouched',()=>{
  let state=opened(),h=nextStep(state);state=apply(state,{type:'MERGE',a:h.a,b:h.b});const grove=state.items.find(i=>i.level===4),seed=state.items.find(i=>i.level===1);const p=previewMove(state,seed.id,grove.q,grove.r);assert.ok(p.ok);assert.ok(p.shifted.some(i=>i.id===grove.id&&i.cells.length===3));state=apply(state,{type:'MOVE',id:seed.id,q:grove.q,r:grove.r});assert.equal(totalValue(state),13);assert.equal(state.items.some(i=>i.q===null),false);
  const before=JSON.stringify(state);assert.equal(act(state,{type:'MOVE',id:seed.id,q:TASKS[0].q,r:TASKS[0].r}).ok,false);assert.equal(JSON.stringify(state),before);state=apply(state,{type:'BUILD',id:grove.id});assert.equal(previewMove(state,seed.id,TASKS[0].q,TASKS[0].r).ok,false);
});
test('every legal one-step rearrangement of the opening chest still has a route to both map tasks',()=>{
  const start=opened();for(const item of start.items)for(const [q,r]of workCells(start)){const moved=act(start,{type:'MOVE',id:item.id,q,r});if(moved.ok){assert.ok(validState(moved.state));assert.ok(complete(finish(moved.state)));}}
});
test('the reward cannot be claimed twice and damaged saves cannot lose or create materials',()=>{
  let state=opened();assert.equal(act(state,{type:'WIN'}).ok,false);assert.equal(act(state,{type:'OPEN'}).ok,false);assert.equal(act(state,{type:'DEPART',route:'river'}).ok,false);assert.equal(validState({...state,items:state.items.slice(1)}),false);assert.equal(validState({...state,pathConnected:true}),false);assert.notEqual(SAVE_KEY,'forest-camp.hex.v1');assert.equal(validState({version:3}),false);
});
