// A single authored landscape uses the same world coordinates as the hex board.
// Neither region cameras nor repair stages resize/recenter the environment art.
export const WORLD_PLATE={asset:'craft-homeland-v15b',pixels:[1536,1024],x:-9,y:-12,width:36,height:24};

export function worldPlateRect({origin,size}){
  return{x:origin[0]+WORLD_PLATE.x*size,y:origin[1]+WORLD_PLATE.y*size,width:WORLD_PLATE.width*size,height:WORLD_PLATE.height*size};
}

export function boundedWorldOrigin(origin,size,width,height){
  return origin.map((value,axis)=>{
    const start=axis?WORLD_PLATE.y:WORLD_PLATE.x,extent=axis?WORLD_PLATE.height:WORLD_PLATE.width,viewport=axis?height:width;
    if(extent*size<=viewport)return viewport/2-(start+extent/2)*size;
    return Math.max(viewport-(start+extent)*size,Math.min(-start*size,value));
  });
}

export function cameraDelta(previous,next){
  const scale=previous.size/next.size;
  return{scale,x:previous.origin[0]-next.origin[0]*scale,y:previous.origin[1]-next.origin[1]*scale};
}

// Widths in world cell radii. A fire is human-scale; a house is the landmark.
// All of them share the same ground contact instead of region-specific scaling.
const SCENERY_WIDTHS={roof:2.55,home:3.65,fire:1.48,path:1.8,spring:2.12,stream:3.3,reeds:1.65,shore:2.65,pier:2.3,ferry:3.65,'ruin-shelter':2.35,'ruin-hearth':1.36,'ruin-path':1.9,'ruin-spring':1.78,'ruin-reeds':1.6,'ruin-dock':2.15};
export const sceneryWidth=name=>SCENERY_WIDTHS[name.replace('scene-','')]||2.1;

export function landscapeMarkup(layout,asset){
  const r=worldPlateRect(layout);
  return`<defs>
    <linearGradient id="landscape-edge" x1="0" y1="0" x2="0" y2="1"><stop stop-color="black"/><stop offset=".065" stop-color="white"/><stop offset=".93" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
    <mask id="landscape-fade"><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="url(#landscape-edge)"/></mask>
    <radialGradient id="settled-ground"><stop stop-color="#ebe6aa" stop-opacity=".16"/><stop offset="1" stop-color="#ebe6aa" stop-opacity="0"/></radialGradient>
    <linearGradient id="brook-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#78c0bb"/><stop offset="1" stop-color="#559caa"/></linearGradient>
  </defs><rect class="world-matte" x="${r.x}" y="${Math.min(0,r.y)}" width="${r.width}" height="${Math.max(layout.height,r.height)}"/><image class="world-ambient" href="${asset(WORLD_PLATE.asset)}" x="0" y="0" width="${layout.width}" height="${layout.height}" preserveAspectRatio="xMidYMid slice" pointer-events="none"/><image class="world-landscape" href="${asset(WORLD_PLATE.asset)}" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" preserveAspectRatio="xMidYMid meet" mask="url(#landscape-fade)" pointer-events="none"/>`;
}

// Shared measured source rectangle: PNG pixels are left intact. Dry and wet
// banks keep their world footprint; a trial reveals only the upstream half.
export const CREEK_ART={pixels:[2172,724],crop:[5,194,2166,339],x:1.4,y:-2.78,width:8.1};
export function creekMarkup({origin,size},asset,{wet=false,trial=false,fresh=false}={}){
  const c=CREEK_ART,[sx,sy,sw,sh]=c.crop,x=origin[0]+c.x*size,y=origin[1]+c.y*size,w=c.width*size,h=w*sh/sw;
  const image=(name,extra='')=>`<image href="${asset(name)}" width="${c.pixels[0]}" height="${c.pixels[1]}" ${extra}/>`;
  let html=image('craft-creek-'+(wet?'flow':'dry')+'-v15');
  if(trial&&!wet)html+=`<defs><linearGradient id="trial-reach"><stop offset=".43" stop-color="black"/><stop offset=".56" stop-color="white"/></linearGradient><mask id="trial-stream"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#trial-reach)"/></mask></defs>${image('craft-creek-flow-v15','mask="url(#trial-stream)"')}`;
  return`<svg class="world-creek${fresh?' creek-reveal':''}" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${c.crop.join(' ')}" overflow="hidden" pointer-events="none">${html}</svg>`;
}

export function footpath(point,river,pier){
  let d=`M${point([-.9,1])} Q${point([-.2,.22])} ${point([1.05,.15])} Q${point([2.05,.05])} ${point([3,.2])}`;
  if(river)d+=`Q${point([4,.37])} ${point([5.15,.16])} Q${point([5.7,-.03])} ${point([6,.12])}`;
  if(pier)d+=`Q${point([6.6,.17])} ${point([7,0])}`;
  return d;
}
