import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as m from '../dist/match3-premium.mjs';
import {motionPlan,motionColumns,motionInputFits} from '../dist/match3-motion.mjs';
import {ART_FRAMES} from '../dist/homecoming-art-frames.mjs';
import {WORLD_PLATE,CREEK_ART} from '../dist/homecoming-world.mjs';
import {CRAFT_ATLASES,craftFrame,craftSvg,portraitAsset} from '../dist/homecoming-art.mjs';
import {STORY_SCENES,availableStoryKeys,restoreStory,storySummary} from '../dist/homecoming-story.mjs';
import {freshGame,demoRiver,TASKS} from '../dist/homecoming.mjs';

test('measured crop rectangles match the actual PNG dimensions and never include another frame',()=>{
  for(const[name,source]of Object.entries(ART_FRAMES)){
    const bytes=fs.readFileSync(new URL('../dist/assets/'+name+'.png',import.meta.url));assert.equal(bytes.readUInt32BE(16),source.width);assert.equal(bytes.readUInt32BE(20),source.height);
    for(const [i,box]of source.frames.entries()){const[x,y,w,h]=box;assert.ok(w>0&&h>0&&x>=0&&y>=0&&x+w<=source.width&&y+h<=source.height);for(const other of source.frames.slice(i+1)){const[ox,oy,ow,oh]=other;assert.ok(x+w<=ox||ox+ow<=x||y+h<=oy||oy+oh<=y,`${name}: overlapping crop rectangles`);}}
  }
});

test('landscape and both watercourse states share their declared source geometry',()=>{
  for(const [name,expected]of [[WORLD_PLATE.asset,WORLD_PLATE.pixels],['craft-creek-dry-v15',CREEK_ART.pixels],['craft-creek-flow-v15',CREEK_ART.pixels]]){
    const bytes=fs.readFileSync(new URL('../dist/assets/'+name+'.png',import.meta.url));
    assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],expected);
  }
  const[x,y,w,h]=CREEK_ART.crop;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=CREEK_ART.pixels[0]&&y+h<=CREEK_ART.pixels[1]);
});

test('the buffered and parallel input gate rejects stale pieces and reserved columns',()=>{const before=m.m3Move(m.m3Create(1,{seed:20261017}),{type:'SWAP',a:10,b:17}).state,first=m.m3Move(before,{type:'SWAP',a:32,b:39}),columns=motionColumns(before,first.frames),second={type:'SWAP',a:8,b:15};assert.ok(motionInputFits(before,first.state,second,columns));const follow=m.m3Move(first.state,second),other=motionColumns(first.state,follow.frames);assert.equal([...other].some(c=>columns.has(c)),false);assert.equal(follow.state.moves,before.moves-2);assert.ok(m.m3Valid(follow.state));assert.equal(motionInputFits(before,first.state,{type:'SWAP',a:32,b:39},columns),false);const stale=structuredClone(before);stale.board[8].id='old-piece';assert.equal(motionInputFits(stale,first.state,second,columns),false);assert.equal(motionInputFits(before,first.state,{type:'HAMMER',index:8},columns),false);});
test('carried rocket hits are timed after landing and propagate across the delivered row',()=>{let s=m.m3Move(m.m3Create(1,{seed:41}),{type:'SWAP',a:10,b:17}).state;const r=m.m3Move(s,{type:'SWAP',a:17,b:18}),f=r.frames.find(f=>f.type==='clear'),p=motionPlan(f),flight=p.flights[0],landing=flight.start+flight.duration;assert.ok(landing>300);assert.ok(p.powers.some(x=>x.delivered&&x.start===landing));for(const h of p.hits.filter(h=>f.causes[h.index]?.kind==='flight'))assert.ok(h.at>=landing);assert.ok(new Set(p.hits.filter(h=>f.causes[h.index]?.kind==='flight').map(h=>h.at)).size>1);assert.ok(p.impactEnd>landing);});
test('sampled cascades and power chains have finite timelines without changing results',()=>{for(let level=1;level<=20;level++){let state=m.m3Create(level,{seed:20261016+level});while(state.status==='playing'){const r=m.m3Move(state,m.m3Hint(state)),serialized=JSON.stringify(r);for(const f of r.frames.filter(f=>f.type==='clear')){const p=motionPlan(f);assert.ok(p.impactEnd>=100&&p.impactEnd<10000);assert.ok(p.hits.every(h=>Number.isFinite(h.at)&&h.at>=0));}assert.equal(JSON.stringify(r),serialized);state=r.state;}}});
test('every material and scene has a bounded local raster frame with no atlas bleed',()=>{for(const[chain,atlas]of Object.entries(CRAFT_ATLASES)){assert.ok(fs.existsSync(new URL('../dist/assets/'+atlas.file+'.png',import.meta.url)));assert.ok(atlas.count<=atlas.cols*atlas.rows);if(['wood','water','reed','dock'].includes(chain))for(let level=1;level<=7;level++){const frame=craftFrame(`mat-${chain}-${level}`);assert.equal(frame.index,level-1);assert.ok(frame.index<frame.count);}}for(const t of [...TASKS.camp,...TASKS.river]){assert.ok(craftFrame('scene-'+t.id));assert.ok(STORY_SCENES[t.id]);}const icon=craftSvg('mat-wood-7',name=>'./assets/'+name+'.png');const f=craftFrame('mat-wood-7'),source=ART_FRAMES[f.file],rect=source.frames[f.index];assert.ok(rect[0]+rect[2]<=source.width&&rect[1]+rect[3]<=source.height);assert.ok(icon.includes('viewBox="'+rect.join(' ')+'"'));assert.match(icon,/clip-path=/);assert.match(icon,/overflow="hidden"/);});
test('stories reveal only completed repairs; old saves do not replay the opening',()=>{const fresh=freshGame();assert.deepEqual(availableStoryKeys(fresh),['intro']);assert.equal(restoreStory(fresh,null,false).cursor.key,'intro');const river=demoRiver(),restored=restoreStory(river,null,true);assert.equal(restored.cursor,null);assert.deepEqual(restored.seen,availableStoryKeys(river));assert.ok(!availableStoryKeys(river).includes('ferry'));assert.equal(storySummary(river).portrait,'lina');});
test('pending dialogue resumes safely and invalid future scenes or offsets are normalized',()=>{const state=freshGame();state.regions.camp.stage=1;const restored=restoreStory(state,{seen:['intro','ferry','made-up'],cursor:{key:'roof',index:99}},true);assert.deepEqual(restored.seen,['intro']);assert.equal(restored.cursor.key,'roof');assert.equal(restored.cursor.index,STORY_SCENES.roof.lines.length-1);assert.equal(restoreStory(state,{seen:[],cursor:{key:'ferry',index:0}},true).cursor,null);for(const who of['mira','lina','rowan'])assert.ok(fs.existsSync(new URL('../dist/assets/'+portraitAsset(who)+'.png',import.meta.url)));});
