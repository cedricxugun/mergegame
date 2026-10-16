import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshGame,demoRiver,act,nextStep,validState,NAMES,valueOf,distance} from '../dist/homecoming.mjs';
import {materialProgress,boardRegion,discoveredLevels,guidedStep} from '../dist/homecoming-view.mjs';
const apply=(s,a)=>{const r=act(s,a);assert.ok(r.ok,r.message);assert.ok(validState(r.state));return r.state;};

test('guidance distinguishes enough raw material from a completed delivery, including stored pieces',()=>{
  let s=freshGame();assert.equal(materialProgress(s).phase,'supply');
  s=apply(apply(s,{type:'WIN'}),{type:'OPEN'});assert.equal(materialProgress(s).ratio,1);assert.equal(materialProgress(s).ready,null);assert.equal(materialProgress(s).phase,'merge');
  for(let n=0;n<3;n++){const h=nextStep(s);s=apply(s,{type:'MERGE',a:h.a,b:h.b});}
  const id=materialProgress(s).ready.id;s=apply(s,{type:'STORE',id});assert.equal(materialProgress(s).ready.id,id);assert.equal(materialProgress(s).phase,'repair');
});
test('a selected material guides its own matching pair, with nearby matches preferred across the shared world',()=>{
  let s=demoRiver();for(let n=0;n<2;n++)s=apply(s,{type:'WIN'});for(let n=0;n<2;n++)s=apply(s,{type:'OPEN'});
  const grade3=s.items.filter(i=>i.chain==='water'&&i.level===3);s=apply(s,{type:'MOVE',id:grade3[2].id,q:2,r:-1});s=apply(s,{type:'MOVE',id:grade3[3].id,q:1,r:0});
  const step=guidedStep(s,grade3[2].id);assert.equal(step.type,'merge');assert.equal(step.a,grade3[2].id);assert.equal(step.b,grade3[3].id);assert.equal(boardRegion(s,s.items.find(i=>i.id===step.b)),'camp');
  s=apply(s,{type:'MERGE',a:step.a,b:step.b});assert.equal(guidedStep(s,s.items.find(i=>i.level===2).id).type,'build');
});
test('other chains cannot fill a task bar and cross-region location follows the actual tile',()=>{
  let s=demoRiver();assert.equal(materialProgress(s).owned,0);const wood=s.items[0];assert.equal(boardRegion(s,wood),'camp');
  s=apply(apply(s,{type:'WIN'}),{type:'OPEN'});const water=s.items.find(i=>i.chain==='water');assert.equal(boardRegion(s,water),'river');s=apply(s,{type:'MOVE',id:water.id,q:2,r:-1});assert.equal(boardRegion(s,s.items.find(i=>i.id===water.id)),'camp');s=apply(s,{type:'STORE',id:water.id});assert.equal(boardRegion(s,s.items.find(i=>i.id===water.id)),null);assert.equal(materialProgress(s).owned,8);
});
test('discovered levels survive consumption and saved discovery metadata is normalized',()=>{
  const s=demoRiver(),found=discoveredLevels(s);assert.equal(found.wood,7);assert.equal(s.items[0].level,1);assert.equal(found.water,0);
  assert.deepEqual(discoveredLevels(freshGame(),found),found);const normalized=discoveredLevels(freshGame(),{wood:-8,water:99,reed:'7'});assert.deepEqual(normalized,{wood:0,water:7,reed:0,dock:0});
});
test('new drops use the middle of the viewed region without changing reward value',()=>{
  let s=apply(apply(freshGame(),{type:'WIN'}),{type:'OPEN'});assert.ok(s.items.every(i=>distance([i.q,i.r],[0,1])<=1));assert.equal(s.items.reduce((n,i)=>n+valueOf(i),0),4);
  s=apply(apply(demoRiver(),{type:'WIN'}),{type:'OPEN',view:'camp'});assert.ok(s.items.filter(i=>i.chain==='water').every(i=>boardRegion(s,i)==='camp'));
});
test('every displayed chain level has a distinct local material sprite',()=>{
  const art=[];for(const[chain,names]of Object.entries(NAMES))for(let level=1;level<names.length;level++){const svg=fs.readFileSync(new URL(`../dist/assets/mat-${chain}-${level}.svg`,import.meta.url),'utf8');assert.match(svg,/viewBox="0 0 160 160"/);assert.doesNotMatch(svg,/<(?:script|image|text)\b/);art.push(svg);}assert.equal(art.length,28);assert.equal(new Set(art).size,28);
});
