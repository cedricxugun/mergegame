import {STORAGE_KEY,CHAINS,FOOTPRINT,BOARD,BRIDGE_CELL,WAVES,CONSTRUCTION_STAGES,newGame,act,openCells,occupancy,cellsOf,shapeFor,keyOf,inBag,itemName,findPlacement,canPlace,previewMerge,previewMove,previewConstruction,getHint,isComplete,bridgeReady,bridgeAvailable,settlementPreview,validateState,migrateState,projectFor,stageComplete,completedStages,currentOrder,canContribute,orderItem,landscapeCells,spaceSummary,hexBoundary} from './game.mjs';

const $=selector=>document.querySelector(selector);
const board=$('#board'),modal=$('#modal');
const qaMode=new URLSearchParams(location.search).has('qa');
const saveKey=qaMode?`${STORAGE_KEY}.qa-v4`:STORAGE_KEY;
let saveStorage;try{saveStorage=qaMode?sessionStorage:localStorage;}catch{/* Storage can be disabled independently of gameplay. */}
const icons={
  undo:'<path d="M3 7v5h5M3 12a8 8 0 1 1 2 7"/>',
  hint:'<path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 .8-1 2-1 2H9s0-1.2-1-2Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01"/>',
  settings:'<path d="m9 3-.6 2.2L6.5 6 4.3 5.5 2 9.5l1.6 1.6v2L2 14.5l2.3 4 2.2-.5 1.9.8L9 21h6l.6-2.2 1.9-.8 2.2.5 2.3-4-1.6-1.6v-2L22 9.5l-2.3-4-2.2.5-1.9-.8L15 3Z"/><circle cx="12" cy="12" r="3"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 4-6 5H2v6h3l6 5ZM16 9l5 6M21 9l-5 6"/>',
  bag:'<path d="M7 7V5a5 5 0 0 1 10 0v2M5 7h14l2 14H3ZM9 11v2M15 11v2"/>',
  rotate:'<path d="M20 7v5h-5M20 12a8 8 0 1 0-2 7"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  world:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16"/>',
  zoom:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M6 10h8"/>'
};
const icon=(name,size=20)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.help}</svg>`;
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const art=item=>`./assets/${item.chain==='bridge'?'bridge':`${item.chain}-${item.level}`}.svg`;
let state=newGame(),history=[],sound=false,selected=null,bagOpen=false,hintTarget=null,toastTimer=0,growthTimer=0,drag=null,saveFailed=false;
let camera={q:-1,r:0,zoom:'near'},worldView=false,worldPan={x:0,y:0};
let buildPreview=null,buildBusy=false,landedId=null,landingTimer=0;
const REGIONS={
  mountain:{name:'风语山坡',direction:'北方',subtitle:'松林、山风与观测站',description:'山间雾气还没有散开，一座旧观测站正在等待新的访客。',offset:[0,-130],playableNext:true},
  river:{name:'芦苇河湾',direction:'东方',subtitle:'清澈河流与旧渡口',description:'沿着营地的小溪往下走，芦苇深处藏着一座安静的渡口。',offset:[154,0],playableNext:true},
  village:{name:'晴光村庄',direction:'南方',subtitle:'花园、小屋与热闹集市',description:'炊烟升起的地方，是另一段关于邻里与节庆的故事。',offset:[0,130],playableNext:false},
  forest:{name:'萤火密林',direction:'西方',subtitle:'古树、萤火与林间小径',description:'更深的森林藏在薄雾后，夜色里偶尔亮起点点萤火。',offset:[-154,0],playableNext:false}
};
let layout={width:440,height:350,size:25,origin:[220,174]};
try{
  const saved=JSON.parse(saveStorage?.getItem(saveKey)||'null');
  const migrated=saved&&migrateState(saved.state);
  if(migrated&&validateState(migrated)){state=migrated;history=(Array.isArray(saved.history)?saved.history:[]).map(migrateState).filter(validateState).slice(-30);sound=saved.sound===true;if(saved.camera&&Number.isFinite(saved.camera.q)&&Number.isFinite(saved.camera.r)&&Math.abs(saved.camera.q)<=4&&Math.abs(saved.camera.r)<=4)camera={q:saved.camera.q,r:saved.camera.r,zoom:saved.camera.zoom==='wide'?'wide':'near'};}
}catch{/* A damaged or unavailable local save does not block a new game. */}
function persist(){
  try{if(!saveStorage)throw Error('Storage unavailable');saveStorage.setItem(saveKey,JSON.stringify({state,history:history.slice(-30),sound,camera}));saveFailed=false;}
  catch{saveFailed=true;}
  $('#save-status').innerHTML=saveFailed?'本轮进度暂未保存':'<i></i>进度自动保存';
}
let audioContext;
function chime(kind){
  if(!sound)return;
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const notes=kind==='growth'||kind==='unlock'||kind==='settle'?[523,659,784]:kind==='chest'?[392,523]:[440,554];
    notes.forEach((frequency,index)=>{
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime+index*.07;
      oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.055,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+.22);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+.24);
    });
  }catch{/* Sound is optional on browsers without Web Audio. */}
}
function toast(title,message='',error=false){
  clearTimeout(toastTimer);const node=$('#toast');node.className=`toast visible${error?' error':''}`;node.innerHTML=`<strong>${esc(title)}</strong>${message?`<span>${esc(message)}</span>`:''}`;
  toastTimer=setTimeout(()=>node.classList.remove('visible'),error?3600:2900);
}
function perform(action,options={}){
  if(buildBusy)return false;
  const previous=state;
  const result=act(state,action);
  if(!result.ok){toast('再调整一下',result.message,true);return false;}
  history.push(structuredClone(state));history=history.slice(-30);state=result.state;
  selected=result.selected??(state.items.some(item=>item.id===selected)?selected:null);hintTarget=null;buildPreview=null;
  if(result.events.some(event=>event.type==='store')||state.items.filter(inBag).length>previous.items.filter(inBag).length)bagOpen=true;
  if(!options.keepCamera&&result.events.some(event=>['growth','settle'].includes(event.type))&&selected)focusItem(selected,false);
  if(action.type==='OPEN_CHEST'&&camera.zoom==='near'){const added=state.items.filter(item=>!inBag(item)&&!previous.items.some(old=>old.id===item.id));const chain=added[0]?.chain;if(chain){const center=chain==='forest'?[-1,0]:chain==='water'?[.5,-1.4]:[.8,.4];camera.q=center[0];camera.r=center[1];}}
  const construction=result.events.find(event=>event.construction);
  if(construction){landedId=construction.itemId;clearTimeout(landingTimer);landingTimer=setTimeout(()=>{landedId=null;if(!drag)renderBoard();},3200);}
  persist();render(result.events);animateRelocations(previous,state,action.type==='MOVE'?action.id:null);
  const event=result.events.at(-1);
  if(event){if(construction){clearTimeout(toastTimer);$('#toast').classList.remove('visible');}else toast(event.title,event.message);chime(event.type);}
  const growth=result.events.find(event=>event.type==='growth');
  if(growth){clearTimeout(growthTimer);const label=$('#growth-label');label.classList.remove('visible');label.textContent=`✦ 展开为 ${FOOTPRINT[state.items.find(item=>item.id===growth.itemId)?.level]||3} 格`;void label.offsetWidth;label.classList.add('visible');growthTimer=setTimeout(()=>label.classList.remove('visible'),1900);}
  if(action.type==='DEPART')showCompletion();
  return true;
}
function undo(){
  if(!history.length||buildBusy)return;
  state=history.pop();selected=null;hintTarget=null;buildPreview=null;persist();render();toast('已撤销','回到了上一步，素材已恢复。');
}
function reset(){state=newGame();history=[];selected=null;hintTarget=null;bagOpen=false;buildPreview=null;landedId=null;camera={q:-1,r:0,zoom:'near'};worldView=false;worldPan={x:0,y:0};persist();closeModal();render();toast('新的林间旅程','先从这七格小林地开始，领取你的第一箱树种。');}
function focusItem(id,redraw=true){const item=state.items.find(value=>value.id===id);if(!item||inBag(item))return;const cells=cellsOf(item);camera.q=cells.reduce((sum,c)=>sum+c[0],0)/cells.length;camera.r=cells.reduce((sum,c)=>sum+c[1],0)/cells.length;worldView=false;if(redraw)render();}
function focusPair(aId,bId){const cells=[aId,bId].flatMap(id=>{const item=state.items.find(value=>value.id===id);return item?cellsOf(item):[];});if(!cells.length)return;camera.q=cells.reduce((sum,c)=>sum+c[0],0)/cells.length;camera.r=cells.reduce((sum,c)=>sum+c[1],0)/cells.length;worldView=false;}
function showWorld(){if(buildBusy)return;buildPreview=null;worldView=!worldView;worldPan={x:0,y:0};selected=null;hintTarget=null;render();}
function returnToCamp(){worldView=false;camera={q:state.goals.camp?0.6:-1,r:state.goals.camp?0.1:0,zoom:'near'};render();}
function point([q,r]){return [layout.origin[0]+Math.sqrt(3)*layout.size*(q+r/2),layout.origin[1]+1.5*layout.size*r];}
function corners(x,y,r){return Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return [x+r*Math.cos(a),y+r*Math.sin(a)];});}
const polygon=points=>points.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' ');
function clientPoint(event){const rect=board.getBoundingClientRect();return [(event.clientX-rect.left)*layout.width/rect.width,(event.clientY-rect.top)*layout.height/rect.height];}
function cellAt(pixel){
  const x=pixel[0]-layout.origin[0],y=pixel[1]-layout.origin[1],q=(Math.sqrt(3)/3*x-y/3)/layout.size,r=2*y/3/layout.size;
  let rx=Math.round(q),rz=Math.round(r),ry=Math.round(-q-r);const dx=Math.abs(rx-q),dz=Math.abs(rz-r),dy=Math.abs(ry+q+r);
  if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;
  return [rx,rz];
}
function centroid(cells){return cells.map(point).reduce((sum,p)=>[sum[0]+p[0]/cells.length,sum[1]+p[1]/cells.length],[0,0]);}
function outlinePath(cells){return hexBoundary(cells).map(loop=>loop.map(([x,y],index)=>`${index?'L':'M'}${(layout.origin[0]+x*layout.size).toFixed(2)},${(layout.origin[1]+y*layout.size).toFixed(2)}`).join(' ')+'Z').join(' ');}
function screenPoint(pixel){const rect=board.getBoundingClientRect();return {x:rect.left+pixel[0]*rect.width/layout.width,y:rect.top+pixel[1]*rect.height/layout.height};}
function animateRelocations(before,after,skipId){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(const item of after.items){const old=before.items.find(value=>value.id===item.id);if(!old||item.id===skipId||inBag(old)||inBag(item)||(old.q===item.q&&old.r===item.r&&old.rotation===item.rotation))continue;const element=board.querySelector(`[data-item-id="${item.id}"]`);if(!element)continue;const from=centroid(cellsOf(old)),to=centroid(cellsOf(item));element.animate([{transform:`translate(${from[0]-to[0]}px,${from[1]-to[1]}px)`},{transform:'translate(0,0)'}],{duration:340,easing:'cubic-bezier(.2,.8,.2,1)'}).finished.catch(()=>{});}
}
function beginConstruction(id){
  if(buildBusy)return;const preview=previewConstruction(state,id);if(!preview.ok){toast('还差一点材料',preview.message,true);return;}
  buildPreview=preview;selected=id;hintTarget=null;worldView=false;
  const item=state.items.find(value=>value.id===id);if(inBag(item))bagOpen=true;
  const cells=[...preview.cells,...cellsOf(item)];const coordinates=cells.map(([q,r])=>[Math.sqrt(3)*(q+r/2),1.5*r]);
  const minX=Math.min(...coordinates.map(p=>p[0])),maxX=Math.max(...coordinates.map(p=>p[0])),minY=Math.min(...coordinates.map(p=>p[1])),maxY=Math.max(...coordinates.map(p=>p[1]));
  camera.r=(minY+maxY)/3;camera.q=(minX+maxX)/(2*Math.sqrt(3))-camera.r/2;
  const near=Math.min(55,(board.clientWidth-55)/(3*Math.sqrt(3)),(board.clientHeight-100)/5);
  camera.zoom=(maxX-minX+1.75)*near>board.clientWidth-35||(maxY-minY+3)*near>board.clientHeight-70?'wide':'near';
  clearTimeout(toastTimer);$('#toast').classList.remove('visible');render();
}
async function confirmConstruction(){
  if(!buildPreview||buildBusy)return;
  const preview=previewConstruction(state,buildPreview.itemId);if(!preview.ok){buildPreview=null;render();return;}
  const source=state.items.find(item=>item.id===preview.itemId);const original=board.querySelector(`[data-item-id="${source.id}"]`);
  const sourceImage=inBag(source)?document.querySelector(`.bag-item[data-id="${source.id}"] img`):original?.querySelector('image');
  const sourceRect=(sourceImage||$('#bag-toggle')).getBoundingClientRect();
  const from={x:sourceRect.left+sourceRect.width/2,y:sourceRect.top+sourceRect.height/2};
  const [cx,cy]=centroid(preview.cells),w=layout.size*(preview.cells.length===1?2.25:preview.cells.length===3?3.95:5.45),to=screenPoint([cx,cy+layout.size*.1-w*.3125]);
  buildBusy=true;$('#app').classList.add('building');$('#win-button').disabled=true;$('#win-label').textContent='正在建造…';
  let token;
  try{
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      token=document.createElement('img');token.className='building-token';token.src=art(source);token.alt='';const width=Math.max(60,Math.min(150,sourceRect.width));Object.assign(token.style,{width:`${width}px`,height:`${width}px`,left:`${from.x-width/2}px`,top:`${from.y-width/2}px`});document.body.appendChild(token);original?.classList.add('building-source');
      const dx=to.x-from.x,dy=to.y-from.y;
      await token.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.5}px,${dy*.5-30}px) scale(.93)`,offset:.5,opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.82)`,opacity:1}],{duration:650,easing:'ease-in-out',fill:'forwards'}).finished.catch(()=>{});
    }
  }finally{token?.remove();original?.classList.remove('building-source');buildBusy=false;$('#app').classList.remove('building');}
  buildPreview=null;perform({type:'SETTLE',id:preview.itemId},{keepCamera:true});
}
function cancelConstruction(){if(buildBusy)return;buildPreview=null;render();}
function drawConstructionBlueprint(){
  if(!buildPreview)return '';const preview=buildPreview,[cx,cy]=centroid(preview.cells),source=state.items.find(item=>item.id===preview.itemId);
  const width=layout.size*(preview.cells.length===1?2.25:preview.cells.length===3?3.95:5.45),from=source&&!inBag(source)?centroid(cellsOf(source)):[layout.width/2,layout.height-30];
  const labelX=Math.max(70,Math.min(layout.width-70,cx)),labelY=Math.max(58,Math.min(layout.height-65,cy+layout.size*.85));
  return `<g class="construction-blueprint" data-special="construction" role="button" tabindex="0" aria-label="在蓝图位置确认建造${preview.name}"><path d="M${from[0]},${from[1]} Q${(from[0]+cx)/2},${Math.min(from[1],cy)-45} ${cx},${cy}" class="delivery-arrow" fill="none"/><path d="${outlinePath(preview.cells)}" class="blueprint-base"/><image href="${art({chain:preview.chain,level:preview.level})}" x="${cx-width/2}" y="${cy+layout.size*.1-width*.8125}" width="${width}" height="${width}" opacity=".3" pointer-events="none"/><path d="${outlinePath(preview.cells)}" class="blueprint-outline"/><rect x="${labelX-68}" y="${labelY-12}" width="136" height="24" rx="12" fill="#386f69"/><text x="${labelX}" y="${labelY+1}" text-anchor="middle" dominant-baseline="central" fill="#f6fff0" font-size="11">${preview.oldLevel?'在这里升级':'建在这里'} · ${FOOTPRINT[preview.level]} 格</text></g>`;
}
function drawPiece(item,eventTypes=new Map()){
  const isBridge=item.chain==='bridge';const cells=isBridge?[BRIDGE_CELL]:cellsOf(item);if(!cells.length)return '';
  const [cx,cy]=centroid(cells),size=layout.size,count=cells.length;
  const spriteWidth=count===1?size*2.25:count===3?size*3.95:size*5.45;
  const x=cx-spriteWidth/2,y=cy+size*.1-spriteWidth*.8125;
  const current=state.items.find(other=>other.id===selected);
  const match=current&&!item.settled&&current.id!==item.id&&current.chain===item.chain&&current.level===item.level&&item.level<CHAINS[item.chain]?.target;
  const event=eventTypes.get(item.id);
  const classes=['piece',item.settled?'settled landscape':'movable',item.id===selected?'selected':'',match?'match':'',item.id===hintTarget?'hint-target':'',event==='growth'?'grow':event?'pop':''].filter(Boolean).join(' ');
  const label=isBridge?'木桥，已修复，景观区':`${itemName(item)}，${item.level}级，${item.settled?'景观区':'可移动素材'}，占${count}格`;
  const outline=outlinePath(cells),badgeWidth=item.settled?58:(count>1?69:57),badgeY=cy+size*.58;
  const tint=item.settled?(isBridge?'#bec798':'#a5c886'):'#fff0c8';
  return `<g class="${classes}" data-item-id="${esc(item.id)}" role="button" tabindex="0" aria-label="${esc(label)}" data-cx="${cx}" data-cy="${cy}" style="--cx:${cx}px;--cy:${cy}px">
    <path class="piece-base" d="${outline}" transform="translate(0,${item.settled?2:6})" fill="${item.settled?'#779761':'#b99858'}" pointer-events="none"/>
    <path class="footprint" d="${outline}" fill="${tint}" stroke-linejoin="round"/>
    ${item.settled?`<path class="scene-edge" d="${outline}" fill="none" stroke="#e3d4a3" stroke-width="4" stroke-dasharray="4 5" stroke-linecap="round" pointer-events="none"/>`:''}
    ${item.id===selected&&!item.settled?cells.map(cell=>{const [px,py]=point(cell);return `<circle cx="${px}" cy="${py}" r="3" fill="#c3a15f" opacity=".55" pointer-events="none"/>`;}).join(''):''}
    <image class="piece-image" href="${art(item)}" x="${x}" y="${y}" width="${spriteWidth}" height="${spriteWidth}"/>
    ${item.id===selected&&!item.settled?`<path class="selection-footprint" d="${outline}" fill="none" stroke="#d99d27" stroke-width="3.5" stroke-linejoin="round" pointer-events="none"/>`:''}
    <g pointer-events="none"><rect x="${cx-badgeWidth/2}" y="${badgeY-9}" width="${badgeWidth}" height="18" rx="8" fill="${item.settled?'#527747':'#fff6df'}" stroke="${item.settled?'#d8e5bc':'#b99d61'}" stroke-width="1.2"/><text class="${item.settled?'item-check':'item-grade'}" x="${cx}" y="${badgeY+.3}" text-anchor="middle" dominant-baseline="central">${item.settled?'景观 · '+count+'格':'L'+item.level+' · '+count+'格'}</text></g>
  </g>`;
}
function renderWorld(width,height){
  const scale=Math.min(1,width/390),origin=[width/2+worldPan.x,height/2+worldPan.y];
  layout={width,height,size:20,origin};board.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const center=origin;
  let markup='<defs><filter id="world-shadow"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#526b40" flood-opacity=".13"/></filter></defs>';
  for(const region of Object.values(REGIONS)){const x=center[0]+region.offset[0]*scale,y=center[1]+region.offset[1]*scale;markup+=`<path d="M${center} Q${(center[0]+x)/2+22} ${(center[1]+y)/2-15} ${x} ${y}" fill="none" stroke="#bdcaa6" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/>`;}
  for(const [id,region]of Object.entries(REGIONS)){
    const x=center[0]+region.offset[0]*scale,y=center[1]+region.offset[1]*scale,w=143*scale;
    markup+=`<g class="world-region" data-region="${id}" role="button" tabindex="0" aria-label="${region.direction}的${region.name}"><image href="./assets/region-${id}.svg" x="${x-w/2}" y="${y-w*.51}" width="${w}" height="${w*.75}" filter="url(#world-shadow)"/><rect x="${x-48}" y="${y+30*scale}" width="96" height="25" rx="12" fill="#f7f5e6" stroke="#d9dfc7"/><text x="${x}" y="${y+43*scale}" text-anchor="middle" dominant-baseline="central" fill="#6b8058" font-size="12" font-weight="600">${region.name}</text></g>`;
  }
  const campArt=projectFor(state,'camp')?`camp-${projectFor(state,'camp').level}`:projectFor(state,'forest')?`forest-${projectFor(state,'forest').level}`:'forest-3';
  markup+=`<g class="world-region current-region" data-region="camp" role="button" tabindex="0" aria-label="返回林间营地建设"><ellipse cx="${center[0]}" cy="${center[1]+13}" rx="72" ry="44" fill="#c3d7a0" stroke="#edf1d9" stroke-width="3"/><image href="./assets/${campArt}.svg" x="${center[0]-69}" y="${center[1]-92}" width="138" height="138" filter="url(#world-shadow)"/><rect x="${center[0]-55}" y="${center[1]+31}" width="110" height="28" rx="13" fill="#688a4f" stroke="#ecf0d5" stroke-width="2"/><text x="${center[0]}" y="${center[1]+46}" text-anchor="middle" dominant-baseline="central" fill="#fff9dd" font-size="13" font-weight="700">林间营地</text><text x="${center[0]}" y="${center[1]+74}" text-anchor="middle" fill="#84956d" font-size="10">${state.departed?'已完成 · 永久保留':`区域建设 · ${completedStages(state)} / 10 阶段`}</text></g>`;
  board.innerHTML=markup;
}
function renderBoard(events=[]){
  const width=board.clientWidth||440,height=board.clientHeight||350;
  if(worldView){renderWorld(width,height);return;}
  const size=camera.zoom==='wide'?Math.min((width-28)/(7*Math.sqrt(3)),(height-75)/11):Math.min(55,(width-55)/(3*Math.sqrt(3)),(height-100)/5);
  const center=camera.zoom==='wide'?[0,0]:[camera.q,camera.r];
  layout={width,height,size,origin:[width/2-Math.sqrt(3)*size*(center[0]+center[1]/2),height/2+8-1.5*size*center[1]]};board.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const open=new Set(openCells(state).map(keyOf)),occupied=occupancy(state),scenery=new Set(landscapeCells(state).map(keyOf));
  const revealed=new Set(events.flatMap(event=>event.cells||[]).map(keyOf));
  const eventTypes=new Map(events.filter(event=>event.itemId).map(event=>[event.itemId,event.type]));
  const tiles=BOARD.slice().sort((a,b)=>point(a)[1]-point(b)[1]||a[0]-b[0]);
  let markup=`<defs><filter id="land-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#527348" flood-opacity=".17"/></filter><linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3d998"/><stop offset="1" stop-color="#b1cd83"/></linearGradient><linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e9d9"/><stop offset="1" stop-color="#d5deca"/></linearGradient></defs>`;
  markup+='<g filter="url(#land-shadow)">';
  for(const [index,cell]of tiles.entries()){
    const [x,y]=point(cell),key=keyOf(cell),available=open.has(key),empty=!occupied.has(key);
    if(x< -size*2||x>width+size*2||y< -size*2||y>height+size*2)continue;
    if(scenery.has(key))continue;
    const base=corners(x,y,size-1),side=base.map(([px,py])=>[px,py+5]);
    if(!available&&camera.zoom==='near'){markup+=`<g class="fog-bank" data-q="${cell[0]}" data-r="${cell[1]}" opacity=".6"><ellipse cx="${x}" cy="${y+4}" rx="${size*.92}" ry="${size*.55}" fill="#e4ead6"/><ellipse cx="${x-size*.18}" cy="${y-6}" rx="${size*.63}" ry="${size*.4}" fill="#ecf0df"/></g>`;continue;}
    markup+=`<g class="hex-cell ${available?'open work-cell':'locked'}${empty?' empty':''}${revealed.has(key)?' revealed':''}" data-q="${cell[0]}" data-r="${cell[1]}" style="--delay:${(index%5)*40}ms"><polygon points="${polygon(side)}" fill="${available?(state.departed?'#8ea96c':'#b4a778'):'#b7c5aa'}"/><polygon class="hex-top" points="${polygon(base)}" fill="${available?(state.departed?(index%3===0?'#b8d48f':'url(#ground)'):(index%3===0?'#e3d9b4':'#eaddba')):'url(#fog)'}"/>`;
    if(!available){markup+=`<g pointer-events="none" opacity=".75"><ellipse cx="${x-3}" cy="${y+1}" rx="${size*.57}" ry="${size*.27}" fill="#f2f3e8"/><circle cx="${x-5}" cy="${y-3}" r="${size*.29}" fill="#f2f3e8"/><circle cx="${x+5}" cy="${y-2}" r="${size*.25}" fill="#f2f3e8"/></g>`;}
    else if(empty){const a=index%3;if(state.departed)markup+=`<path d="M${x-6+a} ${y+8}q-1-4-4-5m4 5q2-6 5-6" stroke="#82a960" stroke-width="1.4" fill="none" opacity=".42" stroke-linecap="round" pointer-events="none"/>`;else markup+=`<path d="M${x-4} ${y}h8m-4-4v8" stroke="#ab9c6c" stroke-width="1.3" opacity=".35" stroke-linecap="round" pointer-events="none"/>`;if(state.departed&&index%2===0)markup+=`<circle cx="${x+8}" cy="${y+1}" r="1.6" fill="#f7efb7"/><circle cx="${x+11}" cy="${y-2}" r="1.3" fill="#f8ebca"/>`;}
    markup+='</g>';
  }
  markup+='</g>';
  if(state.departed&&state.goals.forest){const a=point([-1.3,.4]),b=point([1,0]),c=point([3,-1]);markup+=`<path d="M${a} Q${point([-.4,1.2])} ${b}${state.bridge>=8?` Q${point([2,.4])} ${c}`:''}" stroke="#daca94" stroke-width="${size*.35}" fill="none" stroke-linecap="round" opacity=".9" pointer-events="none"/>`;}
  if(state.departed&&state.goals.water){const a=point([.5,-2]),b=point([3,-1]);markup+=`<path d="M${a} Q${point([2.5,-2.7])} ${b}" stroke="#78b7b0" stroke-width="${size*.28}" fill="none" stroke-linecap="round" pointer-events="none"/><path d="M${a} Q${point([2.5,-2.7])} ${b}" stroke="#b4e0cc" stroke-width="${size*.09}" fill="none" stroke-linecap="round" pointer-events="none"/>`;}
  if(state.bridge<8&&state.wins>=4){const [x,y]=point(BRIDGE_CELL);markup+=`<g data-special="bridge" role="button" tabindex="0" aria-label="修复木桥"><image href="./assets/bridge.svg" x="${x-size*1.2}" y="${y-size*1.5}" width="${size*2.4}" height="${size*2.4}" opacity=".65"/><rect x="${x-19}" y="${y+size*.4}" width="38" height="17" rx="8" fill="#f6edcf" stroke="#d8c28f"/><text x="${x}" y="${y+size*.4+9}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#947747">${state.bridge}/8</text></g>`;}
  const pieces=state.items.filter(item=>!inBag(item)).map(item=>({...item}));
  if(state.bridge>=8)pieces.push({id:'bridge',chain:'bridge',level:1,q:3,r:-1,rotation:0,settled:true});
  pieces.sort((a,b)=>centroid(a.chain==='bridge'?[BRIDGE_CELL]:cellsOf(a))[1]-centroid(b.chain==='bridge'?[BRIDGE_CELL]:cellsOf(b))[1]);
  for(const item of pieces)markup+=drawPiece(item,eventTypes);
  if(landedId&&!buildPreview){const item=pieces.find(item=>item.id===landedId);if(item){const [x,y]=centroid(cellsOf(item)),labelY=Math.max(80,y-layout.size*1.3);markup+=`<g class="landing-marker" pointer-events="none"><path class="landing-ring" d="${outlinePath(cellsOf(item))}"/><rect x="${x-65}" y="${labelY-14}" width="130" height="27" rx="13" fill="#426e45"/><text x="${x}" y="${labelY}" dominant-baseline="central" text-anchor="middle" fill="#fff9dd" font-size="11">✓ ${itemName(item)}建好了</text></g>`;}}
  markup+=drawConstructionBlueprint();
  markup+='<g id="preview-layer" pointer-events="none"></g>';
  board.innerHTML=markup;
}
function renderGoals(){
  const order=currentOrder(state),done=completedStages(state),available=orderItem(state),ready=order?.chain==='bridge'?bridgeAvailable(state)>0:!!available;
  const item=available||(order?(order.chain==='bridge'?{chain:'bridge',level:1}:{chain:order.chain,level:order.requiredLevel}):{chain:'camp',level:6});
  const preview=available?previewConstruction(state,available.id):null;
  const need=!order?'营地建设已全部完成':order.chain==='bridge'?`修桥材料 ${state.bridge} / 8`:available?`已备齐：${itemName(available)} · 可完成 ${preview.stagesBuilt} 阶段`:`需要 ${CHAINS[order.chain].names[order.requiredLevel]} L${order.requiredLevel} ×1`;
  $('#goals').className='goals phase-goals';$('#goals').style.gridTemplateColumns='1fr';
  $('#goals').innerHTML=`<div class="phase-card${ready?' ready':''}"><button class="phase-main" data-action="${order?.chain==='bridge'?'bridge':'order'}" aria-label="当前建设目标：${order?.title||'营地已建成'}"><img src="${art(item)}" alt=""><span><strong>${buildPreview?'蓝图预览 · '+buildPreview.name:order?.title||'这里已经有了家的模样'}</strong><small>${need}</small></span><b>${ready?'看位置 →':`${done}/10`}</b></button><div class="phase-footer"><span>${done} / 10 个建设阶段</span><button data-action="timeline">查看进度 ${icon('chevron',12)}</button></div><div class="phase-track" aria-hidden="true">${CONSTRUCTION_STAGES.map(stage=>`<i class="${stageComplete(state,stage)?'done':stage.id===order?.id?'current':''}"></i>`).join('')}</div></div>`;
}
function renderInspector(){
  if(worldView){$('#inspector').innerHTML=`<div class="guide-avatar">${icon('world',25)}</div><div class="guide-copy"><div class="guide-title">从营地，走向更远的地方</div><p>拖动世界地图，点一个区域看看。林间营地是当前的建设区域。</p></div>`;return;}
  const item=state.items.find(item=>item.id===selected),hint=getHint(state);
  if(buildPreview){$('#inspector').innerHTML=`<img class="inspector-art" src="${art(item)}" alt=""><div class="guide-copy"><div class="guide-title">交付${itemName(item)} · 建成${buildPreview.name}</div><p>确认后移到蓝图处，成为固定景观。${buildPreview.stagesBuilt>1?`一次完成 ${buildPreview.stagesBuilt} 阶段。`:'现在建造，就能推进目标。'}${buildPreview.refund?'多余素材会退到暂放区。':''}</p></div>`;return;}
  if(!item){
    $('#inspector').innerHTML=`<div class="guide-avatar"><img src="./assets/${state.departed?'camp-6':'forest-2'}.svg" alt=""></div><div class="guide-copy"><div class="guide-title">${state.departed?'灯火已亮，旅途继续':isComplete(state)?'这里已经有了家的模样':'向导的小提示'}</div><p>${esc(hint.message)}</p></div>`;return;
  }
  const order=currentOrder(state),contributes=canContribute(state,item);
  let detail=item.settled?`固定景观 · 后续素材让它原位升级`:`可移动 · L${item.level} · 占 ${FOOTPRINT[item.level]} 格${inBag(item)?' · 暂放中':''}`;
  if(contributes)detail+=` · 可完成当前建设`;
  else if(!item.settled&&item.level<CHAINS[item.chain].target)detail+=` → ${FOOTPRINT[item.level+1]} 格`;
  let actions='';
  if(!item.settled){
    if(contributes)actions+=`<button class="small-button gold" data-action="settle" data-id="${item.id}" aria-label="预览${itemName(item)}的建造位置">看蓝图</button>`;
    else if(inBag(item)){actions+=`<button class="small-button" data-action="restore" data-id="${item.id}" aria-label="将${itemName(item)}放回地图">放回</button>`;if(FOOTPRINT[item.level]===3)actions+=`<button class="small-button" data-action="rotate" data-id="${item.id}" aria-label="旋转暂放区中的景物">${icon('rotate')}</button>`;}
    else if(FOOTPRINT[item.level]===3)actions+=`<button class="small-button" data-action="rotate" data-id="${item.id}" aria-label="旋转景物">${icon('rotate')}</button>`;
    if(!inBag(item))actions+=`<button class="small-button" data-action="store" data-id="${item.id}" aria-label="暂存${itemName(item)}">${icon('bag')}</button>`;
  }
  actions+=`<button class="small-button" data-action="deselect" aria-label="取消选中">${icon('close',14)}</button>`;
  $('#inspector').innerHTML=`<img class="inspector-art" src="${art(item)}" alt=""><div class="item-info"><strong>${esc(itemName(item))}</strong><small>${esc(detail)}</small></div><div class="inspector-actions">${actions}</div>`;
}
function renderBag(){
  const stored=state.items.filter(inBag);$('.bag-section').hidden=!stored.length||state.departed||worldView;$('#bag-count').textContent=stored.length;$('#bag-toggle').setAttribute('aria-expanded',String(bagOpen));$('#bag-items').hidden=!bagOpen;
  $('#bag-items').innerHTML=stored.map(item=>`<button class="bag-item${selected===item.id?' selected':''}" data-action="select" data-id="${item.id}" aria-label="暂放区中的${itemName(item)}，${item.level}级"><img src="${art(item)}" alt=""><span>${itemName(item)}</span><small>L${item.level}</small></button>`).join('');
  $('#bag-chevron').innerHTML=icon('chevron',14);$('#bag-chevron').style.transform=bagOpen?'rotate(180deg)':'';
}
function render(events=[]){
  $('#app').classList.toggle('departed',state.departed);
  $('#app').classList.toggle('world-mode',worldView);
  $('#app').classList.toggle('zoomed-in',camera.zoom==='near'&&!worldView);
  $('#app').classList.toggle('has-tray',state.items.some(inBag)&&bagOpen&&!worldView&&!state.departed);
  $('#app').classList.toggle('previewing-build',!!buildPreview);
  $('#region-edges').hidden=worldView||!!buildPreview;
  const space=spaceSummary(state);
  $('#land-counter').innerHTML=worldView?'世界地图':state.departed?'营地已永久保留':`<i class="work-key"></i>工作空位 ${space.free}/${space.capacity} <i class="scene-key"></i>景观 ${space.landscape} 格`;
  $('#chapter-status').textContent=worldView?'四个方向，不同的风景':buildPreview?'蓝色虚线 = 建造位置':state.departed?'灯火温暖，营地长存':'拖动素材 · 空地平移';
  renderGoals();renderBoard(events);renderInspector();renderBag();
  $('#chest-count').textContent=state.chests.length;$('#chest-caption').textContent=state.chests.length?`${state.chests.length} 箱等待开启`:'胜利后获得';$('#chest-button').classList.toggle('available',state.chests.length>0);$('#chest-button').disabled=!state.chests.length||state.departed;
  renderNextAction();
  $('#zoom-button').innerHTML=`${icon('zoom',14)}${camera.zoom==='near'?'全景':'近景'}`;$('#zoom-button').disabled=worldView;
  $('#world-button').innerHTML=`${icon('world',14)}${worldView?'返回营地':'世界'}`;
  $('#undo-button').disabled=!history.length||state.departed;
  $('#supplies-counter').textContent=`旅行补给 ${state.supplies}`;
  $('#sound-button').innerHTML=icon(sound?'sound':'mute');$('#sound-button').setAttribute('aria-label',sound?'关闭音效':'开启音效');$('#sound-button').setAttribute('aria-pressed',String(sound));
  $('#save-status').innerHTML=saveFailed?'本轮进度暂未保存':'<i></i>进度自动保存';
}
function renderNextAction(){
  const hint=getHint(state);let label='',detail='';
  if(worldView){label='回到林间营地';detail='继续这一站的建设';}
  else if(state.departed){label='回看旅程结算';detail=`下一站 · ${state.route==='river'?'河湾':'山坡'}`;}
  else if(buildPreview){label='确认建造 · '+buildPreview.name;detail='素材移到蓝图位置，工作格会补开';}
  else if(hint.type==='depart'){label='结算剩余物资 · 出发';detail='营地已完成，选择你的下一站';}
  else if(hint.type==='settle'){label='可以建造了 · 看蓝图';detail=`使用${itemName(state.items.find(item=>item.id===hint.id))}，推进当前目标`;}
  else if(hint.type==='merge'){const item=state.items.find(item=>item.id===hint.source);label=`合成${itemName(item)} → ${CHAINS[item.chain].names[item.level+1]}`;detail='消耗同级素材 ×2 · 也可以直接拖拽合成';}
  else if(hint.type==='chest'){label='打开素材箱';detail=`第 ${state.chests[0].index} 箱 · 领取合成材料`;}
  else if(hint.type==='bridge'){label='修建木桥';detail=`已有 ${bridgeAvailable(state)} 点树林材料可投入`;}
  else if(hint.type==='restore'){label='从暂放区取回素材';detail='放回空格，继续合成';}
  else if(hint.type==='space'){label='查看需要调整的位置';detail='合成结果需要连在一起的空格';}
  else {label='模拟三消胜利';detail=`第 ${state.wins+1} / 8 局 · 获得一箱素材`;}
  $('#win-button').disabled=buildBusy;$('#win-button').classList.toggle('finish',!!buildPreview||hint.type==='settle'||hint.type==='depart');
  $('#win-label').textContent=label;$('#win-counter').textContent=detail;
  $('#chest-button').hidden=!state.chests.length||hint.type==='chest'||!!buildPreview||worldView||state.departed;
  $('#sim-win-button').hidden=state.wins>=8||hint.type==='win'||!!buildPreview||worldView||state.departed;
  $('#sim-win-button').innerHTML=`继续模拟三消 <span>第 ${state.wins+1}/8 局 ＋</span>`;
  $('#cancel-build-button').hidden=!buildPreview;
  $('.secondary-actions').hidden=[...$('.secondary-actions').children].every(child=>child.hidden);
}
function restoreItem(id){const item=state.items.find(item=>item.id===id),position=item&&findPlacement(state,item.level,CHAINS[item.chain].anchor,[id],item.rotation);if(position){perform({type:'MOVE',id,...position});focusItem(id);}else toast('需要腾一点位置','先合成地图上的素材，或把一件素材放到暂放区。',true);}
function nextAction(){
  if(buildBusy)return;if(worldView){returnToCamp();return;}if(state.departed){showCompletion();return;}if(buildPreview){confirmConstruction();return;}
  const hint=getHint(state);
  if(hint.type==='settle')beginConstruction(hint.id);
  else if(hint.type==='merge'){focusPair(hint.source,hint.target);perform({type:'MERGE',source:hint.source,target:hint.target});}
  else if(hint.type==='chest')perform({type:'OPEN_CHEST'});
  else if(hint.type==='bridge')showBridge();
  else if(hint.type==='depart')showSettlement();
  else if(hint.type==='restore')restoreItem(hint.id);
  else if(hint.type==='space')showHint();
  else perform({type:'WIN'});
}
function selectItem(id){if(buildBusy)return;buildPreview=null;selected=selected===id?null:id;hintTarget=null;render();}
function tapItem(id){
  if(id==='bridge'){showBridge();return;}
  const item=state.items.find(value=>value.id===id);if(!item)return;
  if(state.departed){toast(itemName(item),'这是你亲手建成的景色。');return;}
  if(selected&&selected!==id){
    const source=state.items.find(value=>value.id===selected);
    if(source&&!source.settled&&!item.settled&&source.chain===item.chain&&source.level===item.level){perform({type:'MERGE',source:selected,target:id});return;}
  }
  selectItem(id);
}
function tapCell(cell){
  if(state.departed)return;
  const id=occupancy(state).get(keyOf(cell));if(id){tapItem(id);return;}
  if(!openCells(state).some(value=>keyOf(value)===keyOf(cell))){toast('这片林地还在等待','完成树丛、溪湾和木桥，会逐步打开周围土地。');return;}
  if(selected){const item=state.items.find(value=>value.id===selected);if(item&&!item.settled){perform({type:'MOVE',id:selected,q:cell[0],r:cell[1]});return;}}
  selected=null;hintTarget=null;renderInspector();renderBoard();
}
function showHint(){
  if(buildBusy)return;if(buildPreview){toast('蓝图已标出','点下方确认建造，素材就会移到蓝图处。');return;}
  const hint=getHint(state);
  if(hint.type==='merge'){selected=hint.source;hintTarget=hint.target;focusPair(hint.source,hint.target);render();const preview=previewMerge(state,hint.source,hint.target);drawPreview(preview.cells,true);}
  else if(hint.type==='settle'){beginConstruction(hint.id);return;}
  else if(hint.id){selected=hint.id;bagOpen=true;focusItem(hint.id,false);render();}
  else if(hint.type==='space'&&hint.source){selected=hint.source;hintTarget=hint.target;focusPair(hint.source,hint.target);render();}
  else if(hint.type==='depart'){showSettlement();return;}
  else if(hint.type==='bridge'){showBridge();return;}
  toast('下一步',hint.message);
}
function drawPreview(cells,valid=true,ghost=null,shifted=[]){
  const layer=$('#preview-layer');if(!layer)return;
  layer.innerHTML=cells?.length?`<path class="preview-cell${valid?'':' invalid'}" d="${outlinePath(cells)}" stroke-linejoin="round"/>${cells.map(cell=>{const [x,y]=point(cell);return `<circle cx="${x}" cy="${y}" r="3" fill="${valid?'#ba8f32':'#b2694f'}"/>`;}).join('')}`:'';
  if(ghost&&cells?.length){const [cx,cy]=centroid(cells),w=layout.size*(cells.length===1?2.25:cells.length===3?3.95:5.45);layer.innerHTML+=`<image href="${art(ghost)}" x="${cx-w/2}" y="${cy+layout.size*.1-w*.8125}" width="${w}" height="${w}" opacity=".82"/><path d="${outlinePath(cells)}" fill="none" stroke="${valid?'#bb8824':'#b2694f'}" stroke-width="3" stroke-linejoin="round"/>`;}
  for(const moved of shifted){const item=state.items.find(value=>value.id===moved.id),from=centroid(cellsOf(item)),to=centroid(moved.cells);layer.innerHTML+=`<path class="shift-path" d="M${from} L${to}"/><path class="shift-footprint" d="${outlinePath(moved.cells)}"/><circle cx="${to[0]}" cy="${to[1]}" r="10" fill="#43867d"/><text x="${to[0]}" y="${to[1]+1}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="11">↗</text>`;}
}
function hitAt(event){
  const element=document.elementFromPoint(event.clientX,event.clientY);
  if(!element||!board.contains(element))return null;
  const region=element.closest('[data-region]');if(region)return {region:region.dataset.region};
  const special=element.closest('[data-special]');if(special)return {special:special.dataset.special};
  const item=element.closest('[data-item-id]');if(item)return {id:item.dataset.itemId};
  const cell=element.closest('[data-q]');if(cell)return {cell:[Number(cell.dataset.q),Number(cell.dataset.r)]};
  return {cell:cellAt(clientPoint(event))};
}
board.addEventListener('pointerdown',event=>{
  if(event.button!==0||buildBusy)return;
  const hit=hitAt(event);if(!hit)return;
  const item=hit.id?state.items.find(value=>value.id===hit.id):null;
  const pixel=clientPoint(event),anchor=item&&!inBag(item)?point([item.q,item.r]):pixel;
  drag={pointer:event.pointerId,hit,id:item?.id,start:[event.clientX,event.clientY],offset:[pixel[0]-anchor[0],pixel[1]-anchor[1]],moved:false,anchor:null,target:null,panMode:worldView||!item||item.settled,cameraStart:{...camera},worldStart:{...worldPan}};
  board.setPointerCapture(event.pointerId);
});
board.addEventListener('pointermove',event=>{
  if(!drag||drag.pointer!==event.pointerId)return;
  if(drag.panMode){
    const dx=event.clientX-drag.start[0],dy=event.clientY-drag.start[1];
    if(!drag.moved&&Math.hypot(dx,dy)<7)return;drag.moved=true;
    if(worldView){worldPan={x:Math.max(-180,Math.min(180,drag.worldStart.x+dx)),y:Math.max(-170,Math.min(170,drag.worldStart.y+dy))};}
    else if(camera.zoom==='near'){camera.q=Math.max(-3.5,Math.min(3.5,drag.cameraStart.q-(Math.sqrt(3)/3*dx-dy/3)/layout.size));camera.r=Math.max(-3.5,Math.min(3.5,drag.cameraStart.r-2*dy/(3*layout.size)));}
    renderBoard();return;
  }
  if(!drag.id||state.departed)return;
  const item=state.items.find(value=>value.id===drag.id);if(!item||item.settled)return;
  if(!drag.moved&&Math.hypot(event.clientX-drag.start[0],event.clientY-drag.start[1])<7)return;
  if(!drag.moved){drag.moved=true;buildPreview=null;selected=item.id;hintTarget=null;clearTimeout(toastTimer);$('#toast').classList.remove('visible');render();board.querySelector(`[data-item-id="${item.id}"]`)?.classList.add('dragging');}
  const hit=hitAt(event);let preview=null;
  if(hit?.id&&hit.id!==item.id&&hit.id!=='bridge'){
    const target=state.items.find(value=>value.id===hit.id);
    if(target?.chain===item.chain&&target.level===item.level&&!target.settled&&item.level<CHAINS[item.chain].target){drag.target=target.id;preview=previewMerge(state,item.id,target.id);}
  }
  if(preview){drag.anchor=null;drawPreview(preview.cells||cellsOf(state.items.find(value=>value.id===drag.target)),preview.ok,preview.ok?{chain:preview.chain,level:preview.level}:null);$('#drag-note').textContent=preview.ok?`松手合成 · ${CHAINS[item.chain].names[item.level+1]}`:preview.message;}
  else{drag.target=null;const pixel=clientPoint(event);const cell=cellAt([pixel[0]-drag.offset[0],pixel[1]-drag.offset[1]]);drag.anchor=cell;preview=previewMove(state,item.id,cell[0],cell[1],item.rotation);const cells=shapeFor(item.level,item.rotation).map(([q,r])=>[q+cell[0],r+cell[1]]);drawPreview(cells,preview.ok,item,preview.shifted||[]);$('#drag-note').textContent=preview.ok?(preview.shifted.length?`松手放置 · ${preview.shifted.length} 件素材自动让位`:'松手放到这里'):(preview.message||'这里放不下，松手将回到原位');}
  $('#drag-note').className=`drag-note visible${preview.ok?'':' invalid'}`;
});
board.addEventListener('pointerup',event=>{
  if(!drag||drag.pointer!==event.pointerId)return;
  const finished=drag;drag=null;
  $('#drag-note').className='drag-note';$('#drag-note').textContent='';
  if(board.hasPointerCapture(event.pointerId))board.releasePointerCapture(event.pointerId);
  if(finished.panMode&&finished.moved){persist();renderBoard();return;}
  if(finished.moved){
    const rect=board.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom){renderBoard();return;}
    let applied=false;
    if(finished.target)applied=perform({type:'MERGE',source:finished.id,target:finished.target});
    else if(finished.anchor)applied=perform({type:'MOVE',id:finished.id,q:finished.anchor[0],r:finished.anchor[1]});
    if(!applied)renderBoard();
  }else if(finished.hit.region)finished.hit.region==='camp'?returnToCamp():showRegion(finished.hit.region);
  else if(finished.hit.special==='bridge')showBridge();
  else if(finished.hit.special==='construction')confirmConstruction();
  else if(finished.hit.id)tapItem(finished.hit.id);
  else if(finished.hit.cell)tapCell(finished.hit.cell);
});
board.addEventListener('pointercancel',()=>{drag=null;$('#drag-note').className='drag-note';$('#drag-note').textContent='';renderBoard();});
board.addEventListener('keydown',event=>{if(buildBusy||!['Enter',' '].includes(event.key))return;const item=event.target.closest('[data-item-id]'),special=event.target.closest('[data-special]'),region=event.target.closest('[data-region]');if(item){event.preventDefault();tapItem(item.dataset.itemId);}else if(special){event.preventDefault();special.dataset.special==='construction'?confirmConstruction():showBridge();}else if(region){event.preventDefault();region.dataset.region==='camp'?returnToCamp():showRegion(region.dataset.region);}});
function openModal(content){$('#modal-body').innerHTML=content;if(!modal.open)modal.showModal();}
function closeModal(){if(modal.open)modal.close();}
const modalHead=(eyebrow,title)=>`<div class="modal-topline"><div><div class="modal-eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}</h2></div><button class="modal-close" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>`;
function showHelp(){openModal(`<div class="modal-content">${modalHead('FOREST CAMP','一步一步建成营地')}
  <div class="help-step"><span class="help-number">1</span><div><strong>工作区是米色六角格</strong><p>可移动素材有凸起的完整底座，并标明等级与占地。相同种类、相同等级可以合成。</p></div></div>
  <div class="help-step"><span class="help-number">2</span><div><strong>按钮会提示下一步该做什么</strong><p>材料足够时会显示「可以建造了」。先看蓝图位置，确认后素材才会移过去，变成固定景观。之后在同一处继续升级。</p></div></div>
  <div class="help-step"><span class="help-number">3</span><div><strong>景观区有绿色地面和石边</strong><p>景观不再作为合成素材。它每新增一格占地，就补开一格工作地；关键阶段还会扩大工作区。</p></div></div>
  <div class="help-step"><span class="help-number">4</span><div><strong>拖到有素材的位置，也能自动让位</strong><p>相同素材会合成，其他素材会整体挪到空格。放不下就回到原位。暂放区只在有素材时出现，里面的素材可取回或直接交付。</p></div></div>
  <button class="modal-button" data-action="close-modal">回到我的营地</button></div>`);}
function showOrder(){
  const order=currentOrder(state);if(!order){showSettlement();return;}
  if(order.chain==='bridge'){showBridge();return;}
  const item=orderItem(state);
  if(item)beginConstruction(item.id);
  else toast(order.title,`${order.description} 需要 ${CHAINS[order.chain].names[order.requiredLevel]} L${order.requiredLevel} ×1。`);
}
function showTimeline(){
  const current=currentOrder(state);
  openModal(`<div class="modal-content">${modalHead('林间营地 · 建设手记',`已经完成 ${completedStages(state)} / 10 步`)}<p>同一处景观会逐步升级。每新增一格景观，都会补开一格工作地。</p><div class="construction-list">${CONSTRUCTION_STAGES.map((stage,index)=>{const done=stageComplete(state,stage),active=stage.id===current?.id;return `<div class="construction-step${done?' done':''}${active?' current':''}"><span class="construction-number">${done?'✓':index+1}</span><img src="${art(stage.chain==='bridge'?{chain:'bridge',level:1}:{chain:stage.chain,level:stage.level})}" alt=""><span><strong>${stage.title}</strong><small>${done?'已完成':active?'当前目标':'后续建设'}</small></span></div>`;}).join('')}</div><button class="modal-button" data-action="close-modal">继续建设</button></div>`);
}
function showSettings(){openModal(`<div class="modal-content">${modalHead('营地手记','旅途设置')}<button class="setting-row" data-action="toggle-sound"><span>轻柔音效<small>合成、开箱和景物生长时的提示音</small></span><strong>${sound?'已开启':'已关闭'}</strong></button><button class="setting-row" data-action="help"><span>玩法帮助<small>合成、旋转、暂存与地块解锁</small></span>${icon('arrow')}</button><button class="setting-row" data-action="reset-prompt"><span>重新开始<small>清除本次营地进度，从第一箱物资开始</small></span>${icon('undo')}</button><p>进度保存在当前浏览器。林间营地是本次试玩的完整区域。</p></div>`);}
function showReset(){openModal(`<div class="modal-content">${modalHead('重新启程','从第一箱物资开始？')}<p>当前营地、暂放区和旅行补给会被重置。你可以重新体验全部八次胜利与合成过程。</p><button class="modal-button danger" data-action="reset-confirm">确认重新开始</button><button class="modal-button secondary" data-action="close-modal">继续现在的营地</button></div>`);}
function showRegion(id){
  const region=REGIONS[id];if(!region)return;
  openModal(`<div class="modal-content">${modalHead(`${region.direction} · ${region.playableNext?'下一段旅程':'远方的故事'}`,region.name)}<img class="region-preview-art" src="./assets/region-${id}.svg" alt="${region.name}的景色"><p>${region.description}</p><div class="region-description">${region.subtitle}</div><p>${region.playableNext?'完成林间营地后，可以把这里选为下一站。':'这里是之后旅程中的区域，目前可以先看看风景。'} 本次试玩的可建设区域是林间营地。</p><button class="modal-button" data-action="world-focus" data-region="${id}">在世界地图上看看</button><button class="modal-button secondary" data-action="return-camp">回到营地继续建设</button></div>`);
}
function showBridge(){
  const ready=bridgeReady(state),available=bridgeAvailable(state);
  openModal(`<div class="modal-content">${modalHead('第 9 阶段 · 连接下一段旅程',state.bridge>=8?'木桥已经修好了':'让木桥重新通行')}<img class="completion-art" src="./assets/bridge.svg" alt="木桥"><p>${state.bridge>=8?'溪流两岸又连在了一起。完成营地后，就能沿着小路继续探索。':ready?'投入任意等级的额外树林素材。树种值 1 点、树苗 2 点、小树 4 点、树丛 8 点。多交的部分返还旅行补给。':'先按当前目标建好篝火营位，再来修桥。已建景观会永久保留。'}</p><div class="settlement-total"><span>修桥进度</span><strong>${state.bridge} / 8</strong></div>${ready?`<p>暂放区和地图上共有 ${available} 点可用树林材料。</p><button class="modal-button" data-action="build-bridge" ${available?'':'disabled'}>投入材料修桥</button>`:`<button class="modal-button secondary" data-action="close-modal">回到营地</button>`}</div>`);
}
function showSettlement(){
  if(state.departed){showCompletion();return;}
  if(!isComplete(state)){showHint();return;}
  const preview=settlementPreview(state);
  openModal(`<div class="modal-content">${modalHead('第一站 · 建设完成','收好行囊，继续出发')}<p>三处景物与木桥留在这里。地图、暂放区和箱子里的剩余素材，一起变为旅行补给。</p><div class="material-list">${preview.items.length?preview.items.map(item=>`<div class="material-card"><img src="${art(item)}" alt=""><strong>${esc(itemName(item))}</strong><span>× ${item.count}</span></div>`).join(''):'<p>所有素材都已用于建设。</p>'}</div><div class="settlement-total"><span>本次结算增加</span><strong>+ ${preview.value} 补给</strong></div><p>带上 ${preview.total} 点旅行补给，记下你的下一站。后续地区将在之后的版本中展开。</p><div class="route-picker"><button class="route-button" data-action="depart" data-route="river"><strong>沿溪去河湾 →</strong><span>渡口、芦苇与新朋友</span></button><button class="route-button" data-action="depart" data-route="mountain"><strong>登上山坡 ↗</strong><span>松林、山风与观测站</span></button></div><button class="modal-button secondary" data-action="close-modal">再看看我的营地</button></div>`);
}
function showCompletion(){
  openModal(`<div class="modal-content completion">${modalHead('第一站已完成','营地的灯火亮起来了')}<img class="completion-art" src="./assets/camp-6.svg" alt="已建成的林间营地"><div class="stamp-wrap"><span class="complete-stamp">${icon('check',12)}三处景物与木桥 · 永久保留</span></div><p>下一站：${state.route==='river'?'河湾':'山坡'}。<br>你带上了 ${state.supplies} 点旅行补给。<br>本次试玩到这里，欢迎回来看看这片营地。</p><button class="modal-button" data-action="close-modal">回看我的营地</button><button class="modal-button secondary" data-action="reset-prompt">再体验一次</button></div>`);
}
document.addEventListener('click',event=>{
  if(buildBusy)return;
  const button=event.target.closest('button[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='select')tapItem(id);
  else if(action==='deselect'){selected=null;hintTarget=null;buildPreview=null;render();}
  else if(action==='store')perform({type:'STORE',id});
  else if(action==='rotate')perform({type:'ROTATE',id});
  else if(action==='settle')beginConstruction(id);
  else if(action==='order')showOrder();
  else if(action==='timeline')showTimeline();
  else if(action==='restore')restoreItem(id);
  else if(action==='goal'){const chain=button.dataset.chain;const item=state.items.find(item=>item.chain===chain&&item.level===CHAINS[chain].target);if(item){selected=item.id;focusItem(item.id,false);render();if(!item.settled)toast('景物准备好了','点下方的「落成」，让它成为营地的一部分。');}else toast(CHAINS[chain].names[CHAINS[chain].target],`${CHAINS[chain].description} 合成到 L${CHAINS[chain].target} 即可落成。`);}
  else if(action==='bridge')showBridge();
  else if(action==='build-bridge'){closeModal();perform({type:'BUILD_BRIDGE'});}
  else if(action==='close-modal')closeModal();
  else if(action==='help')showHelp();
  else if(action==='toggle-sound'){sound=!sound;persist();render();showSettings();if(sound)chime('merge');}
  else if(action==='reset-prompt')showReset();
  else if(action==='reset-confirm')reset();
  else if(action==='depart'){closeModal();perform({type:'DEPART',route:button.dataset.route});}
  else if(action==='region-peek')showRegion(button.dataset.region);
  else if(action==='world-focus'){const region=REGIONS[button.dataset.region];closeModal();worldView=true;worldPan={x:-region.offset[0]*.65,y:-region.offset[1]*.65};selected=null;render();}
  else if(action==='return-camp'){closeModal();returnToCamp();}
});
$('#win-button').addEventListener('click',nextAction);
$('#sim-win-button').addEventListener('click',()=>perform({type:'WIN'}));
$('#cancel-build-button').addEventListener('click',cancelConstruction);
$('#chest-button').addEventListener('click',()=>perform({type:'OPEN_CHEST'}));
$('#undo-button').innerHTML=`${icon('undo')}撤销`;$('#undo-button').addEventListener('click',undo);
$('#hint-button').innerHTML=`${icon('hint')}提示`;$('#hint-button').addEventListener('click',showHint);
$('#zoom-button').addEventListener('click',()=>{if(buildBusy)return;camera.zoom=camera.zoom==='near'?'wide':'near';persist();render();});
$('#world-button').addEventListener('click',showWorld);
$('#settings-button').innerHTML=icon('settings');$('#settings-button').addEventListener('click',showSettings);
$('#sound-button').addEventListener('click',()=>{sound=!sound;persist();render();if(sound)chime('merge');});
$('#bag-icon').innerHTML=icon('bag');$('#bag-toggle').addEventListener('click',()=>{if(buildBusy)return;bagOpen=!bagOpen;render();});
modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.open&&!buildBusy){selected=null;hintTarget=null;buildPreview=null;render();}});
new ResizeObserver(()=>{if(!drag)renderBoard();}).observe(board);
window.__forestCamp={getState:()=>structuredClone(state),getHint:()=>getHint(state),getLayout:()=>structuredClone(layout),getCamera:()=>({...camera,worldView,worldPan:{...worldPan}})};
render();
