import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUND_TILT,gardenBasis,gardenCell,materialScale} from '../dist/homecoming-projection.mjs';
import {boundary,shape} from '../dist/homecoming-play.mjs';

test('garden perspective preserves axial hit testing at all cells, viewport scales and pans',()=>{
  for(const size of [23,30,36,44])for(const origin of [[195,250],[160,310],[-130,55]])for(let q=-5;q<=12;q++)for(let r=-5;r<=6;r++){
    const[x,y]=gardenBasis([q,r]),center=[origin[0]+x*size,origin[1]+y*size];assert.deepEqual(gardenCell(center,origin,size),[q,r]);
    for(const[dx,dy]of[[.22,.1],[-.2,-.15],[0,.28]])assert.deepEqual(gardenCell([center[0]+dx*size,center[1]+dy*size*GROUND_TILT],origin,size),[q,r]);
  }
});
test('three-cell contours remain closed under ground projection and materials grow within their footprint',()=>{
  for(let rotation=0;rotation<6;rotation++){const loops=boundary(shape(7,rotation));assert.equal(loops.length,1);const projected=loops[0].map(([x,y])=>[x,y*GROUND_TILT]);assert.ok(projected.every(p=>p.every(Number.isFinite)));assert.equal(projected.length,12);}
  for(let level=1;level<7;level++)assert.ok(materialScale(level+1)>materialScale(level));assert.ok(materialScale(7)<1);
});
