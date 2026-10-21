import {ART_FRAMES} from './homecoming-art-frames.mjs';
import {craftFrame,craftGroundSvg} from './homecoming-art.mjs';
import {GROUND_TILT} from './homecoming-projection.mjs';

// Original-art contact pivots, visually calibrated in cropped frames from top.
// These describe the middle of the bearing surface, not the front-most pixel.
const MATERIAL_PIVOTS={
  wood:[[.50,.73],[.50,.77],[.50,.67],[.55,.73],[.51,.84],[.50,.77],[.51,.82]],
  water:[[.50,.93],[.50,.89],[.51,.90],[.53,.82],[.50,.82],[.53,.70],[.56,.73]],
  reed:[[.50,.87],[.51,.87],[.43,.79],[.53,.76],[.51,.85],[.51,.78],[.50,.82]],
  dock:[[.50,.74],[.50,.73],[.50,.79],[.51,.74],[.51,.73],[.51,.74],[.51,.81]]
};
const SCENE_PIVOTS={roof:[.50,.87],home:[.50,.87],fire:[.50,.83],path:[.50,.77],spring:[.50,.79],stream:[.50,.77],reeds:[.50,.82],shore:[.50,.80],pier:[.50,.80],ferry:[.51,.82],shelter:[.50,.85],hearth:[.50,.83],dock:[.50,.80]};

// Shadow [source u, source v, rx/width, ry/width, angle]. Upright furniture
// bears on individual feet; flat bundles bear on a narrow angled surface.
const CONTACT_PROFILES={
  wood:[
    {shadow:[[.50,.73,.43,.10,-31]]},
    {shadow:[[.50,.77,.39,.14,-24]]},
    {shadow:[[.50,.67,.43,.17,-27]]},
    {shadow:[[.25,.96,.10,.035,0],[.86,.50,.08,.03,0]]},
    {shadow:[[.10,.94,.095,.035,0],[.89,.79,.09,.035,0]]},
    {shadow:[[.07,.74,.075,.03,0],[.47,.96,.085,.035,0],[.94,.69,.07,.03,0]]},
    {shadow:[[.48,.87,.38,.12,-8]]}
  ],
  water:[
    {shadow:[[.50,.93,.27,.08,0]],apron:{chain:'water',width:.63,height:.18}},
    {shadow:[[.50,.89,.27,.075,0]]},
    {shadow:[[.51,.90,.24,.075,0]]},
    {shadow:[[.28,.94,.095,.035,0],[.84,.69,.08,.03,0]]},
    {shadow:[[.17,.82,.07,.03,0],[.51,.96,.08,.035,0],[.85,.80,.07,.03,0]]},
    {shadow:[[.14,.74,.10,.04,0],[.55,.94,.11,.045,0],[.90,.63,.09,.035,0]]},
    {shadow:[[.28,.88,.13,.055,-18],[.69,.82,.11,.045,0],[.88,.59,.10,.04,0]]}
  ],
  reed:[
    {shadow:[[.50,.87,.24,.08,0]],apron:{chain:'reed',width:.57,height:.18}},
    {shadow:[[.51,.87,.25,.08,0]],apron:{chain:'reed',width:.59,height:.18}},
    {shadow:[[.43,.79,.34,.10,-48]]},
    {shadow:[[.53,.76,.42,.17,-18]]},
    {shadow:[[.51,.85,.30,.09,0]],apron:{chain:'reed',width:.68,height:.19}},
    {shadow:[[.51,.78,.38,.15,-29]]},
    {shadow:[[.51,.85,.35,.11,-9]]}
  ],
  dock:[
    {shadow:[[.50,.74,.42,.09,-30]]},
    {shadow:[[.50,.73,.42,.10,-30]]},
    {shadow:[[.50,.79,.37,.13,-21]]},
    {shadow:[[.15,.70,.075,.03,0],[.51,.96,.08,.035,0],[.90,.71,.075,.03,0]]},
    {shadow:[[.10,.78,.075,.03,0],[.39,.95,.075,.035,0],[.93,.64,.07,.03,0]]},
    {shadow:[[.11,.72,.075,.03,0],[.49,.95,.08,.035,0],[.93,.69,.075,.03,0]]},
    {shadow:[[.49,.87,.38,.12,-8]]}
  ]
};

export function groundPivot(name){
  if(name.startsWith('mat-')){const[,chain,level]=name.split('-');return MATERIAL_PIVOTS[chain][+level-1];}
  return SCENE_PIVOTS[name.replace(/^(scene-|ruin-)/,'')]||[.5,.83];
}

export function artGroundPose(name,foot,extent){
  const f=craftFrame(name),crop=ART_FRAMES[f.file].frames[f.index],pivot=groundPivot(name),unit=extent/Math.max(crop[2],crop[3]),width=crop[2]*unit,height=crop[3]*unit;
  return{x:foot[0]-pivot[0]*width,y:foot[1]-pivot[1]*height,width,height,foot:[...foot],pivot:[...pivot]};
}

export function contactProfile(name){
  if(name.startsWith('mat-')){const[,chain,level]=name.split('-');return CONTACT_PROFILES[chain][+level-1];}
  const pivot=groundPivot(name);return{shadow:[[...pivot,.31,.095,0]]};
}

export function contactShadow(name,pose,{lifted=false}={}){
  const ellipses=contactProfile(name).shadow.map(([u,v,rw,rh,angle])=>{
    const x=pose.x+u*pose.width,y=pose.y+v*pose.height,rx=rw*pose.width,ry=rh*pose.width;
    return`<g transform="rotate(${angle} ${x} ${y})"><ellipse class="contact-soft" cx="${x}" cy="${y}" rx="${rx*1.08}" ry="${ry*1.12}" fill="url(#contact-soft)"/><ellipse class="contact-core" cx="${x}" cy="${y}" rx="${rx*.83}" ry="${ry*.58}" fill="url(#contact-core)"/></g>`;
  }).join('');
  return`<g class="ground-contact${lifted?' lifted-contact':''}" pointer-events="none">${ellipses}</g>`;
}

export function contactApron(name,asset,pose){
  const apron=contactProfile(name).apron;if(!apron)return'';
  const width=pose.width*apron.width,height=pose.width*apron.height;
  return`<g class="contact-apron contact-${apron.chain}" pointer-events="none">${craftGroundSvg('ground-'+apron.chain,asset,{x:pose.foot[0]-width/2,y:pose.foot[1]-height*.48,width,height,className:'contact-paint',imageRef:'terrain-atlas'})}</g>`;
}

export function groundedSprite(name,asset,{foot,extent,className,lifted=false}){
  const pose=artGroundPose(name,foot,extent);
  if(lifted)pose.y-=extent*.12;
  return(lifted?'':contactApron(name,asset,pose)+contactShadow(name,pose))+craftGroundSvg(name,asset,{...pose,className});
}

// A hex lattice needs three tones for every shared edge to separate naturally.
export const turfTone=([q,r])=>((q-r)%3+3)%3;
let turfSequence=0;
export function turfCell(cell,asset,{point,outline,size,interactive=true,occupied=false,revealed=false}){
  const[x,y]=point(cell),d=outline([cell]),tone=turfTone(cell),cid=`turf-clip-${++turfSequence}`,pid=cid+'-paint';
  const f=craftFrame('ground-'+(tone===1?'dark':'light')),source=ART_FRAMES[f.file],crop=source.frames[f.index],w=Math.sqrt(3)*size,h=2*GROUND_TILT*size;
  return`<g class="ground-cell turf-tone-${tone}${interactive?'':' scenery-ground'}${occupied?' occupied':''}${revealed?' revealed':''}" ${interactive?`data-cell="${cell.join(',')}" role="button" tabindex="0" aria-label="可放素材的空地 ${cell.join(',')}"`:''}><defs><clipPath id="${cid}" clipPathUnits="userSpaceOnUse"><path d="${d}"/></clipPath><pattern id="${pid}" width="${crop[2]}" height="${crop[3]}" patternUnits="userSpaceOnUse" viewBox="${crop.join(' ')}" preserveAspectRatio="none"><use href="#terrain-atlas"/></pattern></defs><path class="turf-underpaint" d="${d}"/><g clip-path="url(#${cid})" pointer-events="none"><svg class="turf-paint" x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" viewBox="0 0 ${crop[2]} ${crop[3]}" preserveAspectRatio="none" overflow="hidden"><rect width="${crop[2]}" height="${crop[3]}" fill="url(#${pid})"/></svg></g><path class="turf-seam" d="${d}"/><path class="ground-top" d="${d}"/></g>`;
}

export function groundDefinitions(asset){const source=ART_FRAMES['craft-ground-contact-v16'];return`<defs><image id="terrain-atlas" href="${asset('craft-ground-contact-v16')}" width="${source.width}" height="${source.height}"/><radialGradient id="contact-soft"><stop stop-color="#344022" stop-opacity=".36"/><stop offset=".42" stop-color="#344022" stop-opacity=".23"/><stop offset="1" stop-color="#344022" stop-opacity="0"/></radialGradient><radialGradient id="contact-core"><stop stop-color="#29331d" stop-opacity=".46"/><stop offset=".65" stop-color="#29331d" stop-opacity=".32"/><stop offset="1" stop-color="#29331d" stop-opacity="0"/></radialGradient></defs>`;}
