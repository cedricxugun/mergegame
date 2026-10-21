import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUND_TILT,gardenBasis,gardenCell,materialScale} from '../dist/homecoming-projection.mjs';
import {boundary,shape} from '../dist/homecoming-play.mjs';
import {WORLD_PLATE,worldPlateRect,boundedWorldOrigin,cameraDelta} from '../dist/homecoming-world.mjs';

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

test('region and overview camera transforms keep the landscape registered to the playable world',()=>{
  const cameras=[{size:36,origin:[140,230]},{size:36,origin:[-240,225]},{size:15,origin:[60,280]}];
  for(const previous of cameras)for(const next of cameras){
    const d=cameraDelta(previous,next),a=worldPlateRect(previous),b=worldPlateRect(next);
    assert.ok(Math.abs(b.x*d.scale+d.x-a.x)<1e-9);assert.ok(Math.abs(b.y*d.scale+d.y-a.y)<1e-9);
    assert.ok(Math.abs(b.width*d.scale-a.width)<1e-9);
    assert.equal(b.width/b.height,WORLD_PLATE.pixels[0]/WORLD_PLATE.pixels[1]);
    for(const cell of [[0,-2],[6,-2],[5,1],[7,0],[9,2]]){
      const p=gardenBasis(cell),oldPoint=p.map((v,i)=>previous.origin[i]+v*previous.size),newPoint=p.map((v,i)=>next.origin[i]+v*next.size);
      assert.ok(Math.abs(newPoint[0]*d.scale+d.x-oldPoint[0])<1e-9);assert.ok(Math.abs(newPoint[1]*d.scale+d.y-oldPoint[1])<1e-9);
      assert.deepEqual(gardenCell(newPoint,next.origin,next.size),cell);
    }
  }
});

test('camera bounds prevent panning past the finite illustration and center the overview matte',()=>{
  for(const [width,height]of [[320,360],[390,472],[430,600]])for(const size of [12,18,30,36])for(const origin of [[-5000,-5000],[5000,5000],[195,220]]){
    const bounded=boundedWorldOrigin(origin,size,width,height),r=worldPlateRect({origin:bounded,size});
    for(const [start,extent,viewport]of [[r.x,r.width,width],[r.y,r.height,height]]){
      if(extent>=viewport){assert.ok(start<=1e-8);assert.ok(start+extent>=viewport-1e-8);}
      else assert.ok(Math.abs(start-(viewport-extent)/2)<1e-8);
    }
  }
});
