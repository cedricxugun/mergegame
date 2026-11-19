import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../dist/lite/b/rules.mjs';
import {firstCrossing,hoverAt} from '../dist/lite/b/handling.mjs';
import {REPAIR_CLEARINGS,WORK_POCKETS,freightOpen,routeChoices} from '../dist/lite/b/route.mjs';
import {isSpot,isCreek} from '../dist/lite/shared/map.mjs';
import {distance} from '../dist/lite/shared/hex.mjs';
import {repairPanel} from '../dist/lite/b/views.mjs';

const apply=r=>{assert.ok(r.ok,r.message);return r.state;};
const byId=(s,id)=>[...s.items,...s.bag].find(i=>i.id===id);
function stock(s,chain,level,cell=null) {
  const item={id:'i'+s.nextId++,chain,level,cell};
  (cell?s.items:s.bag).push(item);
  return item;
}
function fillLand(s,region=null) {
  for(const cell of B.landCells(s))if((!region||B.regionOf(cell)===region)&&B.isFree(s,cell))stock(s,'wood',1,cell);
}
test('sparse finger samples join the first compatible centre crossed, while grazing a rim just previews',()=>{
  const near={item:{id:'near'},x:24,y:20,rx:10,ry:10};
  const far={item:{id:'far'},x:64,y:20,rx:10,ry:10};
  const spots=[far,near];
  assert.equal(firstCrossing([0,20],[90,20],spots).target,near);
  assert.equal(firstCrossing([90,20],[0,20],spots).target,far);
  assert.equal(firstCrossing([0,20],[90,20],spots,t=>t!==near).target,far);
  assert.equal(firstCrossing([0,28],[90,28],spots),null);
  assert.equal(hoverAt([24,28],spots),near);
  assert.equal(hoverAt([35,20],spots,'near'),near);
  assert.equal(hoverAt([36,20],spots,'near'),null);
  assert.equal(firstCrossing([0,0],[0,0],spots),null);
});
test('each source fills its own workable pocket and refuses a full region without spending a roll or energy',()=>{
  for(const [id,generator] of Object.entries(B.GENERATORS)){
    const s=B.wharfPractice(0);s.items=[];
    const first=B.tapGenerator(s,id,0).events[0].item;
    assert.equal(first.chain,generator.chain);
    assert.ok(WORK_POCKETS[id].some(c=>distance(c,first.cell)===0));
    const lastFree=WORK_POCKETS[id].filter(c=>B.isLand(s,c)).at(-1);
    stock(s,generator.chain,first.level,lastFree);
    const next=B.tapGenerator(s,id,0).events[0].item;
    assert.equal(distance(lastFree,next.cell),1);
    fillLand(s,generator.region);
    const before=JSON.stringify(s),result=B.tapGenerator(s,id,0);
    assert.equal(result.noSpace,true);assert.equal(result.state,s);assert.equal(JSON.stringify(s),before);
  }
});
test('repairs grant their registered working land in old and new saves, without harvesting a cleared edge twice',()=>{
  const s=B.freshState(0);s.done=['roof','fire','path','spring'];
  for(const cell of REPAIR_CLEARINGS.spring)assert.ok(B.isLand(s,cell));
  const [found,rest]=REPAIR_CLEARINGS.trough;
  assert.equal(B.isLand(s,found),false);s.healed.push(found.join(','));
  const job=B.repairById('trough'),part=stock(s,job.chain,job.level);
  const result=B.install(s,part.id,job.id);
  assert.ok(result.ok);assert.deepEqual(result.events.find(e=>e.type==='clearing').cells,[rest]);
  assert.ok(!result.events.some(e=>e.type==='heal'));assert.equal(result.state.items.length,0);
  const loaded=JSON.parse(JSON.stringify(result.state));loaded.healed=[];
  for(const cell of REPAIR_CLEARINGS.trough)assert.ok(B.isFree(loaded,cell));
  const land=B.landCells(loaded);assert.equal(new Set(land.map(c=>c.join(','))).size,land.length);
  assert.ok(land.every(c=>!isSpot(c)&&!isCreek(c)));
  assert.ok(!B.stormCells(loaded).some(t=>REPAIR_CLEARINGS.trough.some(c=>distance(c,t.cell)===0)));
});
test('the bridge and ferry open one home delivery in either order and persist as a connected world',()=>{
  for(const order of [['bridge','ferry'],['ferry','bridge']]){
    let s=B.wharfPractice(0);s.done=s.done.filter(id=>!order.includes(id));
    let delivered=0;
    for(const [index,id] of order.entries()){
      const job=B.repairById(id),part=stock(s,job.chain,job.level),result=B.install(s,part.id,id);
      s=apply(result);const events=result.events.filter(e=>e.type==='home-delivery');
      assert.equal(events.length,index);delivered+=events.length;
      assert.ok(!B.install(s,part.id,id).ok);assert.equal(freightOpen(JSON.parse(JSON.stringify(s)).done),index===1);
    }
    assert.equal(delivered,1);
  }
  const s=B.freshState(0);s.done=['roof','fire'];
  assert.equal(routeChoices(B.availableRepairs(s),'camp','fire')[0].id,'path');
  s.done.push('path');
  const branches=routeChoices(B.availableRepairs(s),'camp','path').map(r=>r.id);
  assert.deepEqual(branches.slice(0,2),['spring','cattail']);
  s.done.push('cattail','reeds','pier','jetty','shore','ferry');
  assert.equal(routeChoices(B.availableRepairs(s),'river','ferry')[0].id,'spring');
});
test('drag preview and release use the same two cells for an occupied cross-region drop',()=>{
  const s=B.wharfPractice(0);s.items=[];
  const a=stock(s,'wood',1,[0,0]),b=stock(s,'water',2,[5,1]);
  const layout=B.dropLayout(s,a.id,b.cell),moved=apply(B.move(s,a.id,b.cell));
  assert.deepEqual(layout.shifts.map(x=>[x.id,x.cell]),[[b.id,a.cell]]);
  assert.deepEqual(byId(moved,b.id).cell,a.cell);assert.deepEqual(byId(moved,a.id).cell,b.cell);
  assert.ok(B.validate(moved));
});
test('the bridge ticket leads directly to its source across the map and names the return destination',()=>{
  const s=B.freshState(0);s.done=['roof','fire','path','spring','trough','stream'];
  const bridge=B.repairById('bridge'),show=region=>repairPanel(s,bridge,B.nextRepairStep(s,bridge,region),region);
  assert.match(show('creek'),/data-guide="true">去船台/);
  assert.doesNotMatch(show('river'),/data-guide/);
  stock(s,bridge.chain,bridge.level);
  assert.match(show('river'),/送到旧溪谷/);
  assert.match(show('river'),/>修复<\/button>/);
});
test('either direction of the opening merge creates playable land; a visible salvage is the item recovered',()=>{
  for(const reverse of [false,true]){
    const s=B.beginVoyage(0);
    const wood=s.items.filter(i=>i.chain==='wood');
    const [a,b]=reverse?wood.reverse():wood;
    const r=B.merge(s,a.id,b.id);
    const heal=r.events.find(e=>e.type==='heal');
    assert.ok(heal);assert.ok(B.isLand(r.state,heal.cell));
    const tile=B.STORM.get(heal.cell.join(','));
    if(B.salvageAt(tile))assert.equal(B.itemAt(r.state,tile.cell).chain,B.salvageAt(tile).chain);
    assert.equal(B.validate(r.state),true);
  }
});
test('trial fittings keep the actual piece off the working grid and never lose it when storage fills',()=>{
  let s=B.wharfPractice(0);const r=B.repairById('ferry'),half=s.items.find(i=>i.level===5);
  const initial=B.freeCount(s);
  s=apply(B.stagePart(s,r.id,half.id));assert.equal(B.freeCount(s),initial+1);
  assert.equal(s.fittings[r.id].id,half.id);assert.ok(!byId(s,half.id));assert.equal(B.progressFor(s,r).total,32);
  const packed=structuredClone(s);fillLand(packed);
  while(packed.bag.length<packed.bagSize)stock(packed,'wood',1);
  assert.ok(!B.retrievePart(packed,r.id).ok);assert.equal(packed.fittings[r.id].id,half.id);
  s=apply(B.retrievePart(JSON.parse(JSON.stringify(s)),r.id));
  assert.ok(byId(s,half.id));assert.equal(byId(s,half.id).level,5);assert.ok(B.validate(s));
});
test('two trial halves close on site, can be returned as one real three-cell part, or delivered once',()=>{
  let s=B.wharfPractice(0);const r=B.repairById('ferry');
  const part=s.items.find(i=>i.level===5);s=apply(B.stagePart(s,r.id,part.id));
  const first=s.items.filter(i=>i.level===3);
  s=apply(B.merge(s,first[0].id,first[1].id));
  const next=s.items.filter(i=>i.level===4);s=apply(B.merge(s,next[0].id,next[1].id));
  s=apply(B.stagePart(s,r.id,s.items.find(i=>i.level===5).id));
  const ready=B.progressFor(s,r).ready;
  assert.equal(ready.level,6);assert.ok(!byId(s,ready.id));assert.ok(B.validate(s));
  const returned=apply(B.retrievePart(s,r.id));assert.equal(B.occupiedCells(byId(returned,ready.id)).length,3);assert.ok(B.validate(returned));
  const built=apply(B.install(s,ready.id,r.id));assert.ok(!built.fittings[r.id]);
  assert.ok(!B.install(built,ready.id,r.id).ok);
});
test('L7 on the grass blocks all three cells, can be bagged and moved, failed expansion is atomic',()=>{
  let s=B.wharfPractice(0);const target=stock(s,'dock',6,[10,-3]);
  const a=stock(s,'dock',6);s=apply(B.merge(s,a.id,target.id));
  const part=s.items.find(i=>i.level===7);
  for(const c of B.occupiedCells(part))assert.equal(B.itemAt(s,c).id,part.id);
  const occupied=B.occupiedCells(part);
  assert.equal(occupied.length,3);s=apply(B.store(s,part.id));
  for(const c of occupied)assert.ok(B.isFree(s,c));
  s=apply(B.unbag(s,part.id,[10,-2]));assert.ok(B.validate(s));
  const before=JSON.stringify(s);assert.ok(!B.move(s,part.id,[50,50]).ok);assert.equal(JSON.stringify(s),before);
  const crowded=B.freshState(0);crowded.healed=[...B.STORM].filter(([,t])=>t.region==='camp').map(([k])=>k);fillLand(crowded);
  crowded.items[0].level=6;crowded.items[1].level=6;
  const fail=B.merge(crowded,crowded.items[0].id,crowded.items[1].id);
  assert.ok(!fail.ok);assert.equal(fail.state,crowded);
});
test('a previously saved v2 one-cell L7 and missing new fields remain playable',()=>{
  let s=B.freshState(0);delete s.fittings;delete s.trim;
  const old=stock(s,'wood',7,[0,0]);
  assert.ok(B.validate(JSON.parse(JSON.stringify(s))));assert.equal(B.occupiedCells(old).length,1);
  s=apply(B.tapGenerator(s,'logs',0));assert.equal(s.energy,B.ENERGY.start-1);assert.equal(B.itemAt(s,[0,0]).id,old.id);
});
test('a full component can finish a trial site while returning the original staged half exactly once',()=>{
  let s=B.wharfPractice(0);const half=s.items.find(i=>i.level===5),r='ferry';
  s=apply(B.stagePart(s,r,half.id));
  const whole=stock(s,'dock',6);
  assert.equal(B.progressFor(s,B.repairById(r)).ready.id,whole.id);
  s=apply(B.install(s,whole.id,r));
  assert.equal(byId(s,half.id).level,5);assert.ok(!s.fittings[r]);assert.ok(!byId(s,whole.id));
  assert.ok(B.validate(s));
});


test('an interrupted preview can resume the original four-chain homeland with its earned repairs and value',async()=>{
  const {recoverHomeland}=await import('../dist/lite/b/resume.mjs');
  const old=B.freshState(0);
  old.done=['roof'];old.orders=[{id:'tea-1'},{id:'o1'}];old.orderLog=['tea-2'];
  old.discovered.picnic=3;old.items=[{id:'i1',chain:'wood',level:3,cell:[0,0]},{id:'i2',chain:'picnic',level:3,cell:[0,1]}];old.nextId=3;
  const {state,backup}=recoverHomeland(old);
  assert.ok(backup);assert.ok(B.validate(state));assert.deepEqual(state.done,['roof']);
  assert.equal(state.items[0].id,'i1');assert.equal(state.coins,old.coins+B.sellPrice(3));
  assert.ok(!state.orders.some(o=>o.id.startsWith('tea-')));
  assert.equal(recoverHomeland(state).state.coins,state.coins);
});
test('map completion is reported on the final outstanding repair in either legal finishing order',()=>{
  const s=B.wharfPractice(0);
  const dock=stock(s,'dock',6),ferry=B.install(s,dock.id,'ferry');
  assert.ok(ferry.ok);assert.ok(!ferry.events.some(e=>e.type==='finale'));
  const soup=stock(ferry.state,'water',5);
  const party=B.install(ferry.state,soup.id,'feast');assert.ok(party.events.some(e=>e.type==='finale'));
  assert.equal(party.state.done.length,17);
});



test('the four generators and all original chapter recipes stay the same when components gain footprints',async()=>{
  const {REPAIRS}=await import('../dist/lite/shared/chapter.mjs');
  const recipes=rows=>rows.map(({id,spot,chain,level,after})=>[id,spot,chain,level,after]);
  assert.deepEqual(recipes(B.REPAIRS),recipes(REPAIRS));
  assert.deepEqual(Object.values(B.GENERATORS).map(g=>g.chain),['wood','water','reed','dock']);
  let s=B.freshState(0);const a=stock(s,'dock',5,[0,1]),b=stock(s,'dock',5,[0,0]);
  s=apply(B.merge(s,a.id,b.id));assert.equal(B.occupiedCells(s.items.find(i=>i.level===6)).length,1);
});

test('a drop preview and the committed three-cell displacement agree on every blocker without consuming items',()=>{
  let s=B.wharfPractice(0);
  const mergeLevel=lv=>{const matches=s.items.filter(i=>i.level===lv);s=apply(B.merge(s,matches[0].id,matches[1].id));};
  mergeLevel(3);mergeLevel(4);mergeLevel(5);
  const wide=s.items.find(i=>i.level===6);assert.equal(B.occupiedCells(wide).length,3);
  fillLand(s,'river');
  const options=B.landCells(s).filter(c=>B.regionOf(c)==='river' && B.itemAt(s,c)?.id!==wide.id);
  const dest=options.find(c=>B.dropLayout(s,wide.id,c)?.shifts.length>=2);
  assert.ok(dest);
  const plan=B.dropLayout(s,wide.id,dest),res=B.move(s,wide.id,dest);
  const moved=apply(res);
  assert.equal(moved.items.length,s.items.length);
  for(const to of plan.shifts)assert.deepEqual(byId(moved,to.id).cell,to.cell);
  assert.deepEqual(byId(moved,wide.id).cell,dest);assert.equal(byId(moved,wide.id).turn,plan.turn);
  assert.ok(B.validate(moved));
});

test('giving away a lower part can break a complete ferry recipe; an extra copy in the bag is spare',()=>{
  const s=B.wharfPractice(0), job=B.repairById('ferry'), order=s.orders.find(o=>o.id==='o15');
  const warning=B.orderImpact(s,order,job);
  assert.ok(warning.usesProject);
  assert.equal(warning.before.total,32); assert.equal(warning.after.total,24);
  const paid=apply(B.deliver(s,order.id));
  assert.equal(B.progressFor(paid,job).missing,warning.after.missing);
  stock(s,'dock',4);
  assert.equal(B.orderImpact(s,order,job).usesProject,false);
  assert.equal(B.progressFor(apply(B.deliver(s,order.id)),job).missing,0);
});

test('ready components and installed halves are accounted for even when raw material totals look sufficient',()=>{
  const s=B.freshState(0);s.done=['roof','fire'];
  const order={id:'o4'};s.orders=[order];
  stock(s,'wood',4,[0,0]);stock(s,'wood',3);stock(s,'wood',3);
  const clash=B.orderImpact(s,order,B.repairById('path'));
  assert.ok(clash.usesProject);
  const exact=B.orderImpact(s,order,B.repairById('fence'));
  assert.ok(exact.lostReady);assert.equal(exact.after.missing,0);
  s.done.push('path');
  const otherSite=B.orderImpact(s,order,B.repairById('spring'));
  assert.equal(otherSite.usesProject,true);assert.equal(otherSite.project.id,'fence');
  let river=B.wharfPractice(0);const ferry=B.repairById('ferry');
  const half=river.items.find(i=>i.level===5);
  river=apply(B.stagePart(river,ferry.id,half.id));
  const staged=B.orderImpact(river,{id:'o15'},ferry);
  assert.equal(staged.after.staged.id,half.id);assert.equal(staged.after.missing,8);
});

test('the actionable prompt guides the wharf chain to a real component and respects the cost of landing on an edge',()=>{
  let s=B.wharfPractice(0);const ferry=B.repairById('ferry');
  for(let lv=3;lv<=5;lv++){
    const step=B.nextRepairStep(s,ferry,'river');
    assert.equal(step.kind,'merge');assert.equal(step.from.level,lv);
    s=apply(B.merge(s,step.from.id,step.to.id));
  }
  const finish=B.nextRepairStep(s,ferry,'river');
  assert.equal(finish.kind,'install');assert.equal(B.occupiedCells(finish.item).length,3);
  const fresh=B.beginVoyage(0), cell=fresh.items.find(i=>i.cell[1]===-1);
  const preview=B.clearableBeside(fresh,cell.cell,2);
  assert.ok(preview.length);
  const res=B.merge(fresh,fresh.items.find(i=>i!==cell).id,cell.id);
  assert.deepEqual(res.events.filter(e=>e.type==='heal').map(e=>e.cell),preview);
  assert.equal(fresh.healed.length,0);
});

test('five optional letters unlock from repairs without filling or blocking an old save’s pending requests',()=>{
  let s=B.wharfPractice(0);
  s.orders=[{id:'o3'},{id:'o4'},{id:'o6'}];s.orderLog=[];s.diary=[0,1,3,5];
  B.refillOrders(s);
  const authored=['o1','o2','o5','o15','o18'];
  assert.deepEqual(s.orders.map(o=>o.id),['o3','o4','o6',...authored]);
  for(const id of authored){
    for(const [chain,level] of B.orderNeeds({id}))stock(s,chain,level);
    s=apply(B.deliver(s,id));
    assert.ok(!B.deliver(s,id).ok);
  }
  assert.deepEqual(s.orders.map(o=>o.id),['o3','o4','o6']);
  assert.ok([2,4,6].every(page=>s.diary.includes(page)));
  const old=s.orders[0], payout=B.orderById(old.id);
  for(const [chain,level] of payout.needs)stock(s,chain,level);
  const before=s.coins;
  s=apply(B.deliver(s,old.id));
  assert.equal(s.coins,before+payout.coins);
  assert.deepEqual(s.orders.map(o=>o.id),['o4','o6']);
  const fresh=B.wharfPractice(0);
  assert.ok(fresh.orders.every(o=>authored.includes(o.id)));
});
