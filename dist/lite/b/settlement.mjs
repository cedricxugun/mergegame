import {PLATE,plateOf} from '../shared/world.mjs';
import {SPOTS} from '../shared/map.mjs';
import {HAUL_PATH,freightOpen} from './route.mjs';
import {reducedMotion} from '../shared/fx.mjs';

const NS='http://www.w3.org/2000/svg';
const pointText=p=>p.map(v=>v.toFixed(1)).join(' ');
function lane(first,last){
  let d='M'+pointText(HAUL_PATH[first]);
  for(let i=first;i<last;i++) {
    const a=HAUL_PATH[i],b=HAUL_PATH[i+1],before=HAUL_PATH[Math.max(0,i-1)],after=HAUL_PATH[Math.min(HAUL_PATH.length-1,i+2)];
    const c1=a.map((v,k)=>v+(b[k]-before[k])/6),c2=b.map((v,k)=>v-(after[k]-a[k])/6);
    d+=' C'+pointText(c1)+' '+pointText(c2)+' '+pointText(b);
  }
  return d;
}
const last=HAUL_PATH.length-1;
const tracks=[
  {id:'roof',d:'M316 428 Q324 451 352 468',width:13},
  {id:'path',d:'M350 468 C417 482 454 519 509 515 S574 508 606 512 Q658 518 700 495',width:18},
  {id:'spring',d:'M700 495 Q751 494 794 467 Q819 449 832 434',width:12},
  {id:'pier',d:lane(0,2),width:17},
  {id:'bridge',d:lane(9,last),width:17},
  {id:'freight',d:lane(2,9),width:16}
];
const cargoFoot=HAUL_PATH[last];

// Sample the route's actual curve to produce a tapered, uneven grassy verge.
// Both the physical track and the wheels follow the same control points.
function wearTrack(group,track,seed) {
  const guide=document.createElementNS(NS,'path');guide.setAttribute('d',track.d);guide.setAttribute('fill','none');group.append(guide);
  const length=guide.getTotalLength(),count=Math.max(3,Math.ceil(length/7));
  const left=[],right=[];
  for(let i=0;i<=count;i++){
    const d=length*i/count,p=guide.getPointAtLength(d),a=guide.getPointAtLength(Math.max(0,d-1)),b=guide.getPointAtLength(Math.min(length,d+1));
    const norm=Math.hypot(b.x-a.x,b.y-a.y)||1, nx=-(b.y-a.y)/norm,ny=(b.x-a.x)/norm;
    const taper=.34+.66*Math.min(1,d/20,(length-d)/20);
    const width=(track.width*.5 + 1.8*Math.sin(d*.084+seed)+1.5*Math.cos(d*.047))*taper;
    left.push([p.x+nx*width,p.y+ny*width]);right.push([p.x-nx*width,p.y-ny*width]);
  }
  const ground=document.createElementNS(NS,'path');
  ground.setAttribute('d','M'+[...left,...right.reverse()].map(pointText).join(' L')+'Z');
  ground.setAttribute('class','track-surface');group.append(ground);
  const flecks=document.createElementNS(NS,'path');let d='';
  for(let at=21+seed;at<length-12;at+=24+13*(1+Math.sin(at*.17))){
    const a=guide.getPointAtLength(at),b=guide.getPointAtLength(at+4);
    const side=Math.sin(at*.24)*track.width*.32;
    d+='M'+pointText([a.x,a.y+side])+'L'+pointText([b.x,b.y+side])+' ';
  }
  flecks.setAttribute('d',d.trim());flecks.setAttribute('class','track-grain');group.append(flecks);guide.remove();
}
export function installSettlement(world) {
  const paths=document.createElementNS(NS,'svg');
  paths.setAttribute('viewBox','0 0 1536 1024');paths.setAttribute('aria-hidden','true');paths.classList.add('homeland-tracks');
  world.inner.insertBefore(paths,world.inner.querySelector('.creek')||world.inner.querySelector('.turf'));
  for(const [index,track] of tracks.entries()){
    const group=document.createElementNS(NS,'g');group.dataset.track=track.id;paths.append(group);
    wearTrack(group,track,index*11);
  }
  const haul=document.createElementNS(NS,'path');haul.setAttribute('d',lane(0,last));haul.setAttribute('fill','none');haul.setAttribute('stroke','none');paths.append(haul);
  const distance=haul.getTotalLength();
  let signature='',inTransit=false,showCargo=false,bankWaterArriving=false;
  function creekBank(alive) {
    return world.upsertSprite('camp-bank',{name:alive?'creek-bank-alive':'creek-bank-dry',foot:[512,425],extent:65,lift:0,cls:'creek-bank'});
  }
  function cargo(on) {
    if(on)world.upsertSprite('camp-delivery',{name:'camp-delivery',foot:cargoFoot,extent:PLATE.cell*.93,lift:0,cls:'resident cargo'});
    else world.removeSprite('camp-delivery');
  }
  function sync(s) {
    showCargo=freightOpen(s.done);
    const k=s.done.join('|');
    if(signature===k)return;
    signature=k;
    for(const group of paths.querySelectorAll('[data-track]'))group.classList.toggle('established',group.dataset.track==='freight'?showCargo:s.done.includes(group.dataset.track));
    const [fx,fy]=plateOf(SPOTS.hearth),[hx,hy]=plateOf(SPOTS.shelter);
    if(s.done.includes('fire'))world.upsertSprite('resident-lina',{name:'lina-rest',foot:[fx-PLATE.cell*.60,fy+12],lift:0,extent:PLATE.cell*1.02,cls:'resident by-fire'});
    else world.removeSprite('resident-lina');
    if(s.done.includes('home'))world.upsertSprite('resident-mira',{name:'mira-work',foot:[hx-PLATE.cell*.52,hy+12],lift:0,extent:PLATE.cell*1.16,cls:'resident by-door'});
    else world.removeSprite('resident-mira');
    if(s.done.includes('path'))creekBank(s.done.includes('stream')&&!bankWaterArriving);
    cargo(showCargo&&!inTransit);
  }

  // Move by distance along the actual quay, bridge and camp path. Long frames
  // advance to the correct point rather than playing a backlog of steps.
  function travel(doneSignal) {
    if(reducedMotion()||doneSignal.aborted){inTransit=false;cargo(showCargo);return Promise.resolve();}
    inTransit=true;cargo(false);
    const duration=7100,start=performance.now();
    return new Promise(resolve=>{
      let frame=0,finished=false,gait='';
      const finish=()=>{
        if(finished)return;finished=true;inTransit=false;cancelAnimationFrame(frame);clearTimeout(timer);
        doneSignal.removeEventListener('abort',finish);world.removeSprite('supply-run');cargo(showCargo);resolve();
      };
      const timer=setTimeout(finish,duration+120);
      function step(now) {
        if(finished)return;
        const t=Math.min(1,Math.max(0,(now-start)/duration)), position=haul.getPointAtLength(distance*t);
        const name=Math.floor((now-start)/155)%2?'porter-a':'porter-b', foot=[position.x,position.y];
        if(gait!==name){
          world.upsertSprite('supply-run',{name,foot,lift:0,extent:PLATE.cell*1.6,cls:'resident porter'});
          gait=name;
        }else world.moveSprite('supply-run',foot,{z:Math.round(foot[1]*2)});
        if(t<1)frame=requestAnimationFrame(step);else finish();
      }
      doneSignal.addEventListener('abort',finish,{once:true});step(start);
    });
  }
  return {sync,travel,prepareTravel(){inTransit=true;cargo(false);},
    startWater(){bankWaterArriving=true;},
    finishWater(){bankWaterArriving=false;const bank=creekBank(true);if(!reducedMotion())bank.animate([{opacity:.55},{opacity:1}],{duration:360});}
  };
}
