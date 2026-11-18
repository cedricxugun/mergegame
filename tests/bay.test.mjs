import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../dist/lite/b/rules.mjs';

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
