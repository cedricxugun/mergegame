// Gesture targets are measured in client pixels. Stationary targets can be reused
// throughout a carry; a partner still landing follows its visible rectangle.
export function hitEllipse(item,rect,pitch) {
  const x=rect.left+rect.width*.5, y=rect.top+rect.height*.55;
  const rx=Math.min(pitch*.51,Math.max(pitch*.37,rect.width*.5));
  const ry=Math.min(pitch*.42,Math.max(pitch*.26,rect.height*.47));
  return {item,x,y,rx,ry};
}

export function hoverAt(point, spots, previous=null) {
  const distance=t=>Math.hypot((point[0]-t.x)/t.rx,(point[1]-t.y)/t.ry);
  const keep=previous && spots.find(t=>t.item.id===previous);
  if(keep && distance(keep)<=1.12)return keep;
  let hit=null,best=1;
  for(const t of spots){const d=distance(t);if(d<=best){hit=t;best=d;}}
  return hit;
}

// Earliest entry into a compatible piece's inner ellipse, in travel order.
// A peripheral pass only previews a match. Dropping there remains intentional.
export function firstCrossing(a,b,spots,accept=()=>true) {
  let hit=null;
  for(const target of spots){
    if(!accept(target))continue;
    const rx=target.rx*.66,ry=target.ry*.66;
    const x=(a[0]-target.x)/rx,y=(a[1]-target.y)/ry;
    const dx=(b[0]-a[0])/rx,dy=(b[1]-a[1])/ry;
    const length=dx*dx+dy*dy, c=x*x+y*y-1;
    let t=0;
    if(c>0){
      if(length<1e-7)continue;
      const dot=x*dx+y*dy, discriminant=dot*dot-length*c;
      if(discriminant<0)continue;
      t=(-dot-Math.sqrt(discriminant))/length;
      if(t<0 || t>1)continue;
    }
    if(!hit || t<hit.t)hit={target,t,point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]};
  }
  return hit;
}

export function softLanding(el,from,to,scale,reduced) {
  if(!el||!from||!to||reduced)return;
  const dx=(from[0]-to[0])/scale,dy=(from[1]-to[1])/scale;
  if(Math.hypot(dx,dy)<.7)return;
  el.animate([{translate:`${dx}px ${dy}px`},{translate:'0px 0px'}],
    {duration:Math.min(235,145+Math.hypot(dx,dy)*.35),easing:'cubic-bezier(.16,.82,.24,1)'});
}

export function pulsePiece(el,level,reduced,delay=0) {
  const sprite=el?.querySelector('img');
  if(!sprite||reduced)return;
  const peak=level>=5?1.13:1.09;
  sprite.animate([{scale:'.80 .86'},{scale:`${peak} ${peak-.09}`,offset:.43},
    {scale:'.98 1.03',offset:.76},{scale:'1'}],
    {duration:level>=5?270:205,delay,easing:'ease-out'});
}
