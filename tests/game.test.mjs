import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,CHAINS,FOOTPRINT,openCells,cellsOf,materialValue,occupancy,previewMerge,getHint,isComplete,findPlacement,settlementPreview,validateState,migrateState,completedStages,workCapacity,workCells,landscapeCells,currentOrder,projectFor,hexBoundary,shapeFor} from '../dist/game.mjs';

function apply(state,action){const result=act(state,action);assert.equal(result.ok,true,`${action.type}: ${result.message}`);assert.equal(validateState(result.state),true,`Invalid state after ${action.type}`);if(['SETTLE','BUILD_BRIDGE'].includes(action.type)){assert.ok(workCapacity(result.state)>=workCapacity(state),'Construction shrank the workspace');const after=new Set(openCells(result.state).map(c=>c.join(',')));assert.ok(openCells(state).every(c=>after.has(c.join(','))),'Construction closed an existing tile');}return result.state;}
function totalValue(state){return state.items.reduce((sum,item)=>sum+materialValue(item.level),0)+state.chests.reduce((sum,chest)=>sum+chest.contents.reduce((value,[,level,count])=>value+materialValue(level)*count,0),0)+state.bridge+state.supplies;}
function advanceConstruction(initial){
  let state=initial;
  for(let steps=0;steps<150;steps++){
    const hint=getHint(state);
    if(hint.type==='merge')state=apply(state,{type:'MERGE',source:hint.source,target:hint.target});
    else if(hint.type==='settle')state=apply(state,{type:'SETTLE',id:hint.id});
    else if(hint.type==='bridge')state=apply(state,{type:'BUILD_BRIDGE'});
    else if(hint.type==='chest')state=apply(state,{type:'OPEN_CHEST'});
    else if(hint.type==='restore'){
      const item=state.items.find(item=>item.id===hint.id),position=findPlacement(state,item.level,CHAINS[item.chain].anchor,[item.id],item.rotation);
      assert.ok(position);state=apply(state,{type:'MOVE',id:item.id,...position});
    }else if(hint.type==='space'){
      const item=state.items.find(item=>!item.settled&&item.q!==null);assert.ok(item,hint.message);state=apply(state,{type:'STORE',id:item.id});
    }else return state;
  }
  assert.fail('Construction did not converge');
}
function completeRegion(){let state=newGame();const checkpoints=[];for(let win=1;win<=8;win++){state=apply(state,{type:'WIN'});state=advanceConstruction(state);checkpoints.push(structuredClone(state));}return {state,checkpoints};}

test('eight rewards complete the region, grow footprints and preserve every material unit',()=>{
  const {state,checkpoints}=completeRegion();
  assert.equal(checkpoints[0].items[0].level,3);
  assert.equal(checkpoints[1].items.find(i=>i.chain==='forest').level,4);
  assert.equal(cellsOf(checkpoints[1].items.find(i=>i.chain==='forest')).length,3);
  assert.deepEqual(checkpoints.map(s=>openCells(s).length),[8,16,17,26,28,33,33,37]);
  assert.deepEqual(checkpoints.map(completedStages),[1,2,4,6,8,9,9,10]);
  assert.deepEqual(checkpoints.map(workCapacity),[7,13,13,19,19,23,23,23]);
  assert.equal(checkpoints[4].bridge,4);assert.equal(checkpoints[5].bridge,8);
  assert.ok(isComplete(state));assert.equal(cellsOf(state.items.find(i=>i.chain==='camp'&&i.settled)).length,7);
  assert.equal(totalValue(state),67);assert.equal(occupancy(state).size+state.items.filter(i=>i.q===null).reduce((n,i)=>n+FOOTPRINT[i.level],0),17);
  assert.deepEqual(state.items.filter(i=>!i.settled).map(i=>[i.chain,i.level]).sort(),[['camp',1],['forest',1],['water',1]]);
});
test('banking all eight chests first remains playable with overflow in the backpack',()=>{
  let state=newGame();for(let i=0;i<8;i++)state=apply(state,{type:'WIN'});
  for(let i=0;i<8;i++)state=apply(state,{type:'OPEN_CHEST'});
  assert.ok(state.items.some(item=>item.q===null));assert.equal(totalValue(state),67);
  state=advanceConstruction(state);assert.ok(isComplete(state));assert.equal(settlementPreview(state).value,3);
});
test('a failed expansion does not consume either item or unlock land',()=>{
  const state=newGame();state.items=openCells(state).map(([q,r],index)=>({id:`item-${index+1}`,chain:index<2?'forest':'water',level:index<2?3:1,q,r,rotation:0,settled:false}));state.nextId=20;
  assert.ok(validateState(state));const before=JSON.stringify(state);
  const result=act(state,{type:'MERGE',source:'item-1',target:'item-2'});
  assert.equal(result.ok,false);assert.equal(JSON.stringify(result.state),before);assert.equal(result.state.forestOpened,false);
});
test('merge is restricted to two distinct matching items and reuses released source cells',()=>{
  let state=apply(newGame(),{type:'WIN'});state=apply(state,{type:'OPEN_CHEST'});
  const [a,b]=state.items;assert.equal(act(state,{type:'MERGE',source:a.id,target:a.id}).ok,false);
  const preview=previewMerge(state,a.id,b.id);assert.ok(preview.ok);
  const value=totalValue(state);state=apply(state,{type:'MERGE',source:a.id,target:b.id});assert.equal(totalValue(state),value);assert.equal(state.items.length,3);
  const higher=state.items.find(i=>i.level===2),lower=state.items.find(i=>i.level===1);assert.equal(act(state,{type:'MERGE',source:higher.id,target:lower.id}).ok,false);
});
test('storage, rotation and restoration preserve multi-cell objects',()=>{
  let state=newGame();state.forestOpened=true;state.items=[{id:'item-1',chain:'forest',level:4,q:-1,r:0,rotation:0,settled:false}];state.nextId=2;const item=state.items[0];const value=totalValue(state);assert.ok(validateState(state));
  state=apply(state,{type:'STORE',id:item.id});assert.equal(state.items.find(i=>i.id===item.id).q,null);
  state=apply(state,{type:'ROTATE',id:item.id});const rotated=state.items.find(i=>i.id===item.id);assert.equal(rotated.rotation,(item.rotation+1)%6);
  const position=findPlacement(state,rotated.level,[0,0],[item.id],rotated.rotation);assert.ok(position);
  state=apply(state,{type:'MOVE',id:item.id,...position});assert.equal(cellsOf(state.items.find(i=>i.id===item.id)).length,3);assert.equal(totalValue(state),value);
});
test('settling a landmark safely stashes blockers and protects completed scenery',()=>{
  let state=newGame();state.forestOpened=true;
  state.items=[{id:'item-1',chain:'forest',level:5,q:-1,r:0,rotation:0,settled:false},{id:'item-2',chain:'water',level:1,q:-2,r:0,rotation:0,settled:false}];state.nextId=3;
  assert.ok(validateState(state));state=apply(state,{type:'SETTLE',id:'item-1'});
  assert.equal(state.items.find(i=>i.id==='item-2').q,null);assert.ok(state.goals.forest);
  const landmark=projectFor(state,'forest');for(const type of ['STORE','ROTATE','MOVE'])assert.equal(act(state,{type,id:landmark.id,q:1,r:1}).ok,false);
});
test('bridge accepts upgraded or stored materials and refunds overpayment',()=>{
  const {checkpoints}=completeRegion();let state=structuredClone(checkpoints[4]);state.bridge=5;
  state.items.push({id:`item-${state.nextId++}`,chain:'forest',level:3,q:null,r:null,rotation:0,settled:false});
  const value=totalValue(state);state=apply(state,{type:'BUILD_BRIDGE'});
  assert.equal(state.bridge,8);assert.equal(state.supplies,1);assert.equal(totalValue(state),value);assert.equal(openCells(state).length,33);
  assert.ok(state.items.find(i=>i.chain==='forest'&&i.settled));
});
test('departure credits leftovers once, keeps scenery, and survives serialization',()=>{
  let {state}=completeRegion();assert.equal(settlementPreview(state).value,3);
  state=apply(state,{type:'DEPART',route:'river'});
  assert.equal(state.supplies,3);assert.equal(state.items.length,3);assert.equal(occupancy(state).size,14);assert.equal(totalValue(state),67);assert.equal(state.route,'river');
  assert.equal(act(state,{type:'DEPART',route:'river'}).ok,false);assert.equal(act(state,{type:'WIN'}).ok,false);
  assert.ok(validateState(JSON.parse(JSON.stringify(state))));
});
test('locked tiles, early departures, capped rewards and corrupt save versions are rejected',()=>{
  let state=apply(newGame(),{type:'WIN'});state=apply(state,{type:'OPEN_CHEST'});
  assert.equal(act(state,{type:'MOVE',id:state.items[0].id,q:3,r:0}).ok,false);
  assert.equal(act(state,{type:'DEPART',route:'mountain'}).ok,false);
  while(state.wins<8)state=apply(state,{type:'WIN'});assert.equal(act(state,{type:'WIN'}).ok,false);
  assert.equal(validateState({...state,version:0}),false);assert.equal(validateState(null),false);
});
test('the earlier 19-cell prototype save migrates without losing off-screen materials',()=>{
  const old={...newGame(),version:1,wins:1};old.items=[{id:'item-1',chain:'forest',level:1,q:2,r:0,rotation:0,settled:false}];old.nextId=2;
  const migrated=migrateState(old);assert.ok(validateState(migrated));assert.equal(migrated.wins,1);assert.equal(migrated.items[0].q,null);assert.equal(totalValue(migrated),1);
});
test('first-stage construction keeps seven working cells and upgrades the same planted tree',()=>{
  let state=newGame();state.items=[{id:'item-1',chain:'forest',level:3,q:-1,r:0,rotation:0,settled:false}];state.nextId=2;
  state=apply(state,{type:'SETTLE',id:'item-1'});const planted=projectFor(state,'forest');assert.equal(planted.level,3);assert.equal(state.goals.forest,false);assert.equal(workCells(state).length,7);assert.equal(landscapeCells(state).length,1);assert.equal(openCells(state).length,8);
  state.items.push({id:`item-${state.nextId++}`,chain:'forest',level:3,q:null,r:null,rotation:0,settled:false});const input=state.items.at(-1);state=apply(state,{type:'SETTLE',id:input.id});
  assert.equal(projectFor(state,'forest').id,planted.id);assert.equal(projectFor(state,'forest').level,4);assert.equal(completedStages(state),2);assert.equal(workCells(state).length,13);
});
test('higher-level delivery completes reachable same-chain stages without material loss',()=>{
  let state=newGame();state.items=[{id:'item-1',chain:'forest',level:5,q:null,r:null,rotation:0,settled:false}];state.nextId=2;
  state=apply(state,{type:'SETTLE',id:'item-1'});assert.equal(completedStages(state),3);assert.equal(projectFor(state,'forest').level,5);assert.equal(totalValue(state),16);assert.equal(currentOrder(state).chain,'water');
});
test('overdelivery refunds the same chain to the backpack for later construction',()=>{
  let state=newGame();state.items=[{id:'item-1',chain:'forest',level:3,q:-2,r:0,rotation:0,settled:true},{id:'item-2',chain:'forest',level:4,q:null,r:null,rotation:0,settled:false}];state.nextId=3;
  assert.ok(validateState(state));const value=totalValue(state);state=apply(state,{type:'SETTLE',id:'item-2'});
  assert.equal(projectFor(state,'forest').level,4);assert.equal(state.supplies,0);assert.equal(totalValue(state),value);
  const refund=state.items.find(i=>!i.settled);assert.equal(refund.chain,'forest');assert.equal(refund.level,3);assert.equal(refund.q,null);
});
test('permanent intermediate scenery is protected and cannot skip another chain order',()=>{
  let state=newGame();state.items=[{id:'item-1',chain:'forest',level:3,q:null,r:null,rotation:0,settled:false}];state.nextId=2;state=apply(state,{type:'SETTLE',id:'item-1'});
  const planted=projectFor(state,'forest');assert.equal(act(state,{type:'STORE',id:planted.id}).ok,false);
  state.items.push({id:`item-${state.nextId++}`,chain:'camp',level:3,q:null,r:null,rotation:0,settled:false});const snapshot=JSON.stringify(state);
  assert.equal(act(state,{type:'SETTLE',id:state.items.at(-1).id}).ok,false);assert.equal(JSON.stringify(state),snapshot);
});
test('one, three and seven cell pieces have continuous outer contours without internal edges',()=>{
  for(const [level,count]of [[1,6],[4,12],[6,18]])for(let rotation=0;rotation<6;rotation++){
    const cells=shapeFor(level,rotation).map(([q,r])=>[q+2,r-1]),loops=hexBoundary(cells);assert.equal(loops.length,1);assert.equal(loops[0].length,count);
  }
});
test('an already completed high-level camp can be delivered without losing the pending bridge goal',()=>{
  let state=newGame();state.forestOpened=true;state.goals={forest:true,water:true,camp:false};
  state.items=[{id:'item-1',chain:'forest',level:5,q:-2,r:0,rotation:0,settled:true},{id:'item-2',chain:'water',level:4,q:0,r:-2,rotation:0,settled:true},{id:'item-3',chain:'camp',level:6,q:null,r:null,rotation:0,settled:false}];state.nextId=4;
  assert.ok(validateState(state));const value=totalValue(state);state=apply(state,{type:'SETTLE',id:'item-3'});
  assert.equal(projectFor(state,'camp').level,6);assert.equal(currentOrder(state).chain,'bridge');assert.equal(completedStages(state),9);assert.equal(isComplete(state),false);assert.equal(workCapacity(state),19);assert.equal(totalValue(state),value);
});
