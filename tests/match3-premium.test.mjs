import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../dist/match3-premium.mjs';
import * as old from '../dist/match3.mjs';
import * as j from '../dist/journey-match.mjs';
import {freshGame} from '../dist/homecoming.mjs';
const apply=(s,a)=>{const r=m.m3Move(s,a);assert.ok(r.ok,r.message);assert.ok(m.m3Valid(r.state),'result must be a restorable, settled board');return r;};
function fixture(level=5){const s=m.m3Create(level,{seed:81});s.board=s.board.map((p,i)=>p?{...p,color:(Math.floor(i/7)*2+i%7)%5,power:null}:null);return s;}
const power=(s,i,p)=>s.board[i]={id:s.board[i].id,color:null,power:p};
const color=(s,i,c)=>s.board[i]={...s.board[i],color:c,power:null};
const clear=r=>r.frames.find(f=>f.type==='clear');

test('twenty authored layouts are deterministic, stable, playable, and serializable',()=>{
  const layouts=new Set();for(let level=1;level<=20;level++)for(const seed of[0,41,20261016+level]){const s=m.m3Create(level,{seed});assert.ok(m.m3Valid(s));assert.deepEqual(s,m.m3Create(level,{seed}));assert.ok(m.m3Valid(JSON.parse(JSON.stringify(s))));assert.equal(m.m3FindMatches(s.board).length,0);assert.ok(m.m3AvailableMoves(s).length);layouts.add(JSON.stringify([s.mask,s.crates,s.mud]));}assert.equal(layouts.size,20);
});
test('the first lesson always creates a rocket beside a propeller, then delivers it to a crate row',()=>{
  for(const seed of[0,1,41,20261017,4294967295]){const s=m.m3Create(1,{seed}),r=apply(s,{type:'SWAP',a:10,b:17});assert.equal(r.waves,1);assert.equal(r.state.board[17].power,'row');assert.equal(r.state.board[18].power,'propeller');assert.equal(r.state.cratesCleared,0);const combo=apply(r.state,{type:'SWAP',a:17,b:18}),f=clear(combo);assert.equal(f.flights.length,1);assert.equal(f.flights[0].payload,'row');assert.ok(f.hits.length>=7);assert.ok(combo.state.cratesCleared<12);assert.equal(combo.state.moves,s.moves-2);}
});
test('four in a 2 by 2 square makes a propeller, with no pre-existing match',()=>{
  const s=fixture();for(const i of[8,9,15,17])color(s,i,0);color(s,10,3);color(s,16,1);assert.equal(m.m3FindMatches(s.board).length,0);const r=apply(s,{type:'SWAP',a:17,b:16});assert.ok(clear(r).made.some(p=>p.index===16&&p.power==='propeller'));
});
test('a bomb covers 5 by 5, while two bombs cover the full 9 by 9 footprint clipped to the board',()=>{
  let s=fixture();power(s,17,'bomb');let f=clear(apply(s,{type:'ACTIVATE',index:17}));assert.equal(f.indices.length,25);assert.ok(f.hits.length>0);
  s=fixture();power(s,17,'bomb');power(s,18,'bomb');f=clear(apply(s,{type:'SWAP',a:17,b:18}));assert.equal(f.indices.length,49);assert.match(f.combo,/超大/);
});
test('two propellers fly to three distinct remaining objectives',()=>{
  const s=fixture();power(s,10,'propeller');power(s,11,'propeller');const f=clear(apply(s,{type:'SWAP',a:10,b:11}));assert.equal(f.flights.length,3);assert.equal(new Set(f.flights.map(p=>p.to)).size,3);for(const p of f.flights)assert.ok(s.crates[p.to]>0);
});
test('a single propeller clears its takeoff neighbors and one useful target',()=>{
  const s=fixture();power(s,10,'propeller');const f=clear(apply(s,{type:'ACTIVATE',index:10}));for(const i of[3,9,10,11,17])assert.ok(f.indices.includes(i));assert.equal(f.flights.length,1);assert.ok(s.crates[f.flights[0].to]>0);
});
test('light ball combinations turn the most common color into powers and activate every conversion',()=>{
  for(const p of['row','bomb','propeller']){const s=fixture();power(s,10,'orb');power(s,11,p);const counts=Array(5).fill(0);s.board.forEach(t=>{if(Number.isInteger(t?.color))counts[t.color]++;});const f=clear(apply(s,{type:'SWAP',a:10,b:11}));assert.equal(f.conversions.length,Math.max(...counts));for(const t of f.conversions){assert.ok(f.activated.some(a=>a.index===t.index&&a.power===t.power));assert.ok(p==='row'?['row','col'].includes(t.power):t.power===p);}if(p==='propeller')assert.ok(f.flights.length>=f.conversions.length);}
});
test('double light ball hits every live cell once and removes only one layer from armored crates',()=>{
  const s=fixture(8);power(s,10,'orb');power(s,11,'orb');const f=clear(apply(s,{type:'SWAP',a:10,b:11}));assert.equal(f.indices.length,s.mask.filter(Boolean).length);for(let i=0;i<56;i++)if(s.crates[i])assert.equal(f.crates[i],s.crates[i]-1);
});
test('crate hits are counted once per wave and newly cleared ground receives falling pieces',()=>{
  const s=fixture(8),index=s.crates.findIndex(v=>v===2);const r=apply(s,{type:'HAMMER',index});assert.equal(clear(r).crates[index],1);assert.equal(clear(r).cratesCleared,0);assert.equal(r.state.board[index],null);const next=apply(r.state,{type:'ROW',index});assert.equal(clear(next).crates[index],0);assert.ok(next.state.board[index]);assert.equal(next.state.moves,s.moves);
});
test('holes and crates are not swappable, failed swaps are atomic, and blockers split gravity',()=>{
  const s=m.m3Create(1,{seed:41}),before=structuredClone(s);for(const a of[{type:'SWAP',a:41,b:48},{type:'SWAP',a:48,b:55},{type:'SWAP',a:6,b:7}])assert.equal(m.m3Move(s,a).ok,false);assert.deepEqual(s,before);const r=apply(s,{type:'HAMMER',index:35});for(const f of r.frames.filter(f=>f.type==='drop'))for(const fall of f.falls){assert.ok(f.mask[fall.to]);assert.equal(f.crates[fall.to],0);}assert.equal(r.state.board[49],null);assert.equal(r.state.board[55],null);
});
test('four boosters cost no moves, are single-use, and shuffle keeps targets untouched',()=>{
  let s=m.m3Create(20,{seed:24});for(const type of['HAMMER','ROW','COL','SHUFFLE']){if(s.status!=='playing')break;const before=s,r=apply(s,{type,index:2});assert.equal(r.state.moves,before.moves);assert.equal(r.state.tools[type.toLowerCase()],0);assert.equal(m.m3Move(r.state,{type,index:2}).ok,false);if(type==='SHUFFLE'){assert.deepEqual(r.state.crates,before.crates);assert.deepEqual(r.state.mud,before.mud);assert.equal(r.state.score,before.score);}s=r.state;}
});
test('played legacy saves finish unchanged; untouched old rounds upgrade without touching world progress',()=>{
  const world=freshGame(),before=structuredClone(world),base={version:1,region:'camp',winsBefore:0,game:old.m3Create(1,{seed:41})};assert.ok(j.matchSessionFits(world,base));const upgraded=j.upgradeMatchSession(base);assert.equal(upgraded.game.version,2);assert.equal(upgraded.game.runId,base.game.runId);assert.deepEqual(world,before);const played={...base,game:old.m3Move(base.game,old.m3Hint(base.game)).state};assert.strictEqual(j.upgradeMatchSession(played),played);assert.ok(j.matchSessionFits(world,played));assert.ok(m.m3Valid(played.game));
});
test('tampered obstacles, tools, masks, status, and missing pieces cannot restore or claim a reward',()=>{
  const s=m.m3Create(1,{seed:41});for(const mutate of[s=>s.mask[49]=1,s=>s.crates[42]=3,s=>s.cratesCleared=12,s=>s.tools.row=9,s=>s.status='won',s=>s.board[0]=null,s=>s.board[1].id=s.board[0].id]){const bad=structuredClone(s);mutate(bad);assert.equal(m.m3Valid(bad),false);assert.equal(j.claimMatchBox(freshGame(),{version:1,region:'camp',winsBefore:0,game:bad}).ok,false);}
});
test('all levels resolve through legal cascades, and a player can finish every authored layout',()=>{
  for(let level=1;level<=20;level++){let won=false;for(let attempt=0;attempt<4&&!won;attempt++){let s=m.m3Create(level,{seed:20261016+level+attempt*541});while(s.status==='playing'){s=apply(s,m.m3Hint(s)).state;}won=s.status==='won';}assert.ok(won,`level ${level} must be finishable`);}
});
test('winning on the final move beats the loss condition, while an unfinished last move gives no chest',()=>{
  const base=m.m3Create(1,{seed:41});base.moves=1;base.usedMoves=23;base.turn=23;
  const loss=apply(base,{type:'SWAP',a:10,b:17}).state;assert.equal(loss.status,'lost');assert.equal(loss.moves,0);assert.equal(j.claimMatchBox(freshGame(),{version:1,region:'camp',winsBefore:0,game:loss}).ok,false);
  const s=structuredClone(base);power(s,10,'orb');power(s,11,'orb');const won=apply(s,{type:'SWAP',a:10,b:11}).state;assert.equal(won.status,'won');assert.equal(won.moves,0);const session={version:1,region:'camp',winsBefore:0,game:won},claim=j.claimMatchBox(freshGame(),session);assert.ok(claim.ok);assert.equal(j.claimMatchBox(claim.state,session).ok,false);
});
