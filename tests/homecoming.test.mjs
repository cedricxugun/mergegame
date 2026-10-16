import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../dist/homecoming.mjs';

function apply(state,action){const result=g.act(state,action);assert.ok(result.ok,result.message);assert.ok(g.validState(result.state),`Invalid state after ${action.type}`);return result.state;}
function suggested(state){const h=g.nextStep(state);if(h.type==='win')return{type:'WIN'};if(h.type==='open')return{type:'OPEN'};if(h.type==='merge')return{type:'MERGE',a:h.a,b:h.b};if(h.type==='build')return{type:'BUILD',id:h.id};throw Error(`Unexpected step ${h.type}`);}
function play(state,{until=s=>g.regionComplete(s),onStep=()=>{}}={}){for(let n=0;n<250&&!until(state);n++){const action=suggested(state),before=state;state=apply(state,action);onStep(state,action,before);}assert.ok(until(state),'Journey failed to progress');return state;}
function readyHome(){return play(g.freshGame(),{until:s=>g.progress(s).stage===3&&!!g.taskItem(s)});}

test('first win yields exactly one small repair; camp takes eight wins with its first three-cell merge at the end',()=>{
  const builds=[],growth=[];
  const state=play(g.freshGame(),{onStep(s,a,old){if(a.type==='BUILD')builds.push({win:s.regions.camp.wins,stage:s.regions.camp.stage});if(a.type==='MERGE'&&s.items.some(i=>i.level===7)&&!old.items.some(i=>i.level===7))growth.push(s.regions.camp.wins);}});
  assert.deepEqual(builds,[{win:1,stage:1},{win:2,stage:2},{win:4,stage:3},{win:8,stage:4}]);assert.deepEqual(growth,[8]);assert.equal(g.settlement(state).value,1);assert.equal(g.workCells(state).length,24);
  for(let level=1;level<=6;level++)assert.equal(g.cellsOf({q:0,r:0,level}).length,1);assert.equal(g.cellsOf({q:0,r:0,level:7}).length,3);
});

test('river has twelve wins, six separate repairs and a conserved four-point remainder across both regions',()=>{
  let state=g.demoRiver();const builds=[],capacity=[],growth=[];
  state=play(state,{onStep(s,a,old){if(a.type==='BUILD'){builds.push(s.regions.river.wins);capacity.push([g.workCells(old).length,g.workCells(s).length]);}if(a.type==='MERGE'&&s.items.some(i=>i.level===7)&&!old.items.some(i=>i.level===7))growth.push(s.regions.river.wins);}});
  assert.deepEqual(builds,[1,5,6,8,9,12]);assert.deepEqual(growth,[5,12]);assert.ok(capacity.every(([old,now])=>now>=old));assert.equal(g.settlement(state).value,4);
  state=apply(state,{type:'FINISH',recycle:true});assert.equal(state.supplies,4);assert.equal(state.items.length,0);assert.ok(g.complete(state));assert.equal(g.act(state,{type:'FINISH',recycle:true}).ok,false);assert.equal(g.act(state,{type:'WIN'}).ok,false);
  assert.deepEqual(g.accounting(state).supplied,{wood:93,water:73,reed:41,dock:81});
});

test('opened grass and paths are the same shared legal grid before and after region completion',()=>{
  let state=g.demoRiver();state=apply(apply(state,{type:'WIN'}),{type:'OPEN'});const item=state.items.find(i=>i.chain==='water');
  state=apply(state,{type:'MOVE',id:item.id,q:2,r:-1});assert.equal(g.tileKind(state,[2,-1]),'ground');assert.equal(state.items.find(i=>i.id===item.id).q,2);
  state=apply(state,{type:'MOVE',id:item.id,q:6,r:0});assert.equal(state.items.find(i=>i.id===item.id).q,6);
  assert.ok(g.previewMove(state,item.id,-2,3).ok);assert.equal(g.previewMove(state,item.id,0,-2).ok,false);assert.equal(g.previewMove(state,item.id,2,-2).ok,false);
  state=play(state);state=apply(state,{type:'FINISH',recycle:false});const spare=state.items.find(i=>i.chain==='water');state=apply(state,{type:'MOVE',id:spare.id,q:2,r:-1});assert.ok(g.complete(state));assert.equal(g.tileKind(state,[2,-2]),'water');assert.equal(g.previewMove(state,spare.id,2,-2).ok,false);
});

test('every revealed ground tile can accept a material and every phase forms one connected landscape',()=>{
  let state=g.freshGame();const inspect=s=>{assert.equal(g.boundary(g.landCells(s)).length,1);const legal=new Set(g.workCells(s).map(g.key));for(const c of g.landCells(s)){const plan=g.placePlan({...s,items:[]},{id:'probe',chain:'wood',level:1,rotation:0},...c);assert.equal(plan.ok,legal.has(g.key(c)));assert.equal(g.tileKind(s,c)==='ground',legal.has(g.key(c)));}};
  inspect(state);state=play(state,{onStep(s,a){if(a.type==='BUILD')inspect(s);}});state=apply(state,{type:'FINISH',recycle:false});inspect(state);play(state,{onStep(s,a){if(a.type==='BUILD')inspect(s);}});
});

test('building an expanded footprint moves blockers before consuming material and adds usable land',()=>{
  let state=readyHome();const home=g.taskItem(state),spare=state.items.find(i=>i.level===1);state=apply(state,{type:'MOVE',id:spare.id,q:1,r:-2});const plan=g.previewBuild(state,home.id);assert.ok(plan.ok);assert.equal(plan.cells.length,3);assert.ok(plan.shifted.some(i=>i.id===spare.id));assert.equal(plan.capacityGain,2);const before=state.items.length;state=apply(state,{type:'BUILD',id:home.id});assert.equal(state.items.length,before-1);assert.equal(state.items.find(i=>i.id===spare.id).q===null,false);assert.equal(g.tileKind(state,[1,-2]),'site');assert.equal(g.settlement(state).value,1);
});

test('occupied drops relocate an entire three-cell piece and reject an impossible drop atomically',()=>{
  let state=readyHome();const large=g.taskItem(state),small=state.items.find(i=>i.level===1),plan=g.previewMove(state,small.id,large.q,large.r);assert.ok(plan.ok);assert.ok(plan.shifted.some(i=>i.id===large.id&&i.cells.length===3));state=apply(state,{type:'MOVE',id:small.id,q:large.q,r:large.r});assert.equal(g.cellsOf(state.items.find(i=>i.id===large.id)).length,3);
  const badBefore=JSON.stringify(state),bad=g.act(state,{type:'MOVE',id:large.id,q:99,r:99});assert.equal(bad.ok,false);assert.equal(JSON.stringify(state),badBefore);assert.equal(bad.state,state);
  const full={...g.freshGame(),items:g.workCells(g.freshGame()).map(([q,r],n)=>({id:`p${n}`,chain:'wood',level:1,q,r,rotation:0}))};full.items.push({id:'stored-large',chain:'wood',level:7,q:null,r:null,rotation:0});const snapshot=JSON.stringify(full);assert.equal(g.previewMove(full,'stored-large',0,0).ok,false);assert.equal(JSON.stringify(full),snapshot);
});

test('hoarding all boxes and overflowing storage never deadlocks either region',()=>{
  let state=g.freshGame();for(let n=0;n<8;n++)state=apply(state,{type:'WIN'});for(let n=0;n<8;n++)state=apply(state,{type:'OPEN'});assert.ok(state.items.some(g.inTray));assert.equal(g.act(state,{type:'WIN'}).ok,false);state=play(state);state=apply(state,{type:'FINISH',recycle:false});for(let n=0;n<12;n++)state=apply(state,{type:'WIN'});for(let n=0;n<12;n++)state=apply(state,{type:'OPEN'});assert.ok(state.items.some(g.inTray));state=play(state);assert.equal(g.settlement(state).value,4);
});

test('an overlevel delivery completes only the current repair and refunds exact same-chain value',()=>{
  let state=g.freshGame();for(let n=0;n<8;n++)state=apply(state,{type:'WIN'});for(let n=0;n<8;n++)state=apply(state,{type:'OPEN'});
  for(let n=0;n<100&&!state.items.some(i=>i.level===7);n++){let pair;for(let level=1;level<7;level++){const items=state.items.filter(i=>i.level===level);if(items.length>=2){pair=items.slice(0,2);break;}}assert.ok(pair);state=apply(state,{type:'MERGE',a:pair[0].id,b:pair[1].id});}
  const i=state.items.find(i=>i.level===7),plan=g.previewBuild(state,i.id);assert.equal(plan.refund,60);assert.equal(plan.cells.length,1);state=apply(state,{type:'BUILD',id:i.id});assert.equal(state.regions.camp.stage,1);assert.equal(state.items.reduce((n,i)=>n+g.valueOf(i),0),89);state=play(state);assert.equal(g.settlement(state).value,1);
});

test('storage supports merging and delivering, round-trip saves retain geography and invalid saves are rejected',()=>{
  let state=apply(apply(g.freshGame(),{type:'WIN'}),{type:'OPEN'});for(const i of state.items)state=apply(state,{type:'STORE',id:i.id});state=play(state,{until:s=>s.regions.camp.stage===1});assert.equal(state.items.length,0);state=play(state);state=apply(state,{type:'FINISH',recycle:false});const clone=JSON.parse(JSON.stringify(state));assert.ok(g.validState(clone));assert.deepEqual(g.workCells(clone),g.workCells(state));assert.equal(g.validState({...state,supplies:100}),false);assert.equal(g.validState({...state,items:[]}),false);assert.equal(g.validState({...state,items:[...state.items,{...state.items[0]}]}),false);
});

test('recycling camp material or retaining it are both complete paths; new play is independent of legacy saves',()=>{
  let state=play(g.freshGame());state=apply(state,{type:'FINISH',recycle:true});assert.equal(state.supplies,1);assert.equal(state.items.length,0);state=play(state);assert.equal(g.settlement(state).value,3);state=apply(state,{type:'FINISH',recycle:true});assert.equal(state.supplies,4);assert.notEqual(g.SAVE_KEY,'forest-camp.first-stop.v1');
});

test('river displacement prefers keeping whole components in the river and its restored water reaches the pier',()=>{
  const state=play(g.demoRiver(),{until:s=>s.regions.river.stage===5&&!!g.taskItem(s)}),large=g.taskItem(state),small=state.items.find(i=>i.chain==='water'),plan=g.previewMove(state,small.id,large.q,large.r),river=new Set(g.landCells(state,'river').map(g.key));
  assert.ok(plan.ok);const moved=plan.shifted.find(i=>i.id===large.id);assert.ok(moved);assert.ok(moved.cells.every(c=>river.has(g.key(c))));assert.equal(g.tileKind(state,[7,-1]),'water');assert.equal(g.distance([7,-1],g.SITES.dock),1);
});
