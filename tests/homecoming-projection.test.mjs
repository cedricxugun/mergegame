import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUND_TILT,gardenBasis,gardenCell,materialScale} from '../dist/homecoming-projection.mjs';
import {boundary,shape} from '../dist/homecoming-play.mjs';
import {WORLD_PLATE,worldPlateRect,boundedWorldOrigin,cameraDelta} from '../dist/homecoming-world.mjs';
import {artGroundPose,groundPivot,turfTone,contactProfile} from '../dist/homecoming-ground.mjs';
import {craftFrame} from '../dist/homecoming-art.mjs';
import {ART_FRAMES} from '../dist/homecoming-art-frames.mjs';

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

test('every original material and repair keeps its true foot on the target across camera scales',()=>{
  const names=['roof','fire','path','home','spring','stream','reeds','shore','pier','ferry'].map(n=>'scene-'+n);
  for(const chain of ['wood','water','reed','dock'])for(let level=1;level<=7;level++)names.push(`mat-${chain}-${level}`);
  for(const name of names)for(const extent of [28,42,100])for(const foot of [[195,250],[-72,315],[380,81]]){
    const p=artGroundPose(name,foot,extent),pivot=groundPivot(name),f=craftFrame(name),c=ART_FRAMES[f.file].frames[f.index];
    assert.ok(Math.abs(p.x+p.width*pivot[0]-foot[0])<1e-9);assert.ok(Math.abs(p.y+p.height*pivot[1]-foot[1])<1e-9);
    assert.ok(Math.abs(p.width/p.height-c[2]/c[3])<1e-9);assert.ok(Math.abs(Math.max(p.width,p.height)-extent)<1e-9);
    assert.ok(pivot[0]>.2&&pivot[0]<.8&&pivot[1]>.6&&pivot[1]<1);
    assert.ok(p.y+p.height>foot[1],'front soil/roots must be allowed in front of the foot anchor');
  }
});

test('resting hex turf has different tones on every shared edge, including negative coordinates',()=>{
  const neighbors=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  for(let q=-8;q<=12;q++)for(let r=-7;r<=7;r++)for(const[dq,dr]of neighbors){
    const tone=turfTone([q,r]);assert.ok([0,1,2].includes(tone));assert.notEqual(tone,turfTone([q+dq,r+dr]));
  }
});

test('contact footprints follow real bottom diameters and individual feet without a generic soil pad',()=>{
  for(const chain of ['wood','water','reed','dock'])for(let level=1;level<=7;level++){
    const p=contactProfile(`mat-${chain}-${level}`);
    for(const[u,v,rx,ry,angle]of p.shadow){assert.ok(u>=0&&u<=1&&v>=0&&v<=1);assert.ok(rx>0&&rx<=.45&&ry>0&&ry<=.2);assert.ok(Number.isFinite(angle));}
    if(p.apron){assert.ok(p.apron.width<=.7&&p.apron.height<=.2);assert.ok(chain==='reed'||chain==='water'&&level===1);}
    if(['wood','dock'].includes(chain)||chain==='water'&&level>1)assert.equal(p.apron,undefined);
  }
  for(const name of ['mat-wood-4','mat-wood-5','mat-wood-6','mat-water-4','mat-water-5','mat-dock-4','mat-dock-5','mat-dock-6'])assert.ok(contactProfile(name).shadow.length>=2);
  assert.ok(contactProfile('mat-water-2').shadow[0][2]<.3,'a bowl bears on its base, not the wide rim');
});
