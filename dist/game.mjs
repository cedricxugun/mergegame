export const SAVE_VERSION = 3;
export const STORAGE_KEY = 'forest-camp.hex.v1';
export const FOOTPRINT = [0, 1, 1, 1, 3, 3, 7];
export const CHAINS = {
  forest: { name: '树林', short: '林', target: 5, anchor: [-2, 0], color: '#4d945a', names: ['', '树种', '树苗', '小树', '树丛', '林荫小径'], description: '让树木长成一条通向营地的小径。' },
  water: { name: '溪流', short: '水', target: 4, anchor: [0, -2], color: '#3b9fa4', names: ['', '水滴', '浅水洼', '小池塘', '清澈溪湾'], description: '汇聚清水，恢复溪岸的生机。' },
  camp: { name: '营地', short: '营', target: 6, anchor: [1, 0], color: '#d68c4f', names: ['', '营地材料包', '帐篷组件', '小帐篷', '双帐篷营位', '篝火营位', '完整林间营地'], description: '搭起帐篷，为每位旅人留一处暖意。' }
};
export const CONSTRUCTION_STAGES = [
  {id:'forest-3',chain:'forest',level:3,title:'栽下第一棵树',description:'先让一棵小树在营地边扎根。'},
  {id:'forest-4',chain:'forest',level:4,title:'让树丛长起来',description:'再栽一棵小树，把林缘扩成三格树丛。'},
  {id:'forest-5',chain:'forest',level:5,title:'铺出林荫小径',description:'补齐树丛，让旅人有一条阴凉的小路。'},
  {id:'water-3',chain:'water',level:3,title:'找到一处水源',description:'先汇成小池塘，给营地留住清水。'},
  {id:'water-4',chain:'water',level:4,title:'接通清澈溪湾',description:'把水源扩成溪湾，打开新的溪岸。'},
  {id:'camp-3',chain:'camp',level:3,title:'搭起第一顶帐篷',description:'先为旅人准备一处落脚点。'},
  {id:'camp-4',chain:'camp',level:4,title:'增加一处营位',description:'再搭一顶帐篷，把小营位扩成三格。'},
  {id:'camp-5',chain:'camp',level:5,title:'点亮营地篝火',description:'补齐营位，让大家围着篝火坐下来。'},
  {id:'bridge',chain:'bridge',level:0,title:'修通林间木桥',description:'用额外树林素材修桥，连通前方的道路。'},
  {id:'camp-6',chain:'camp',level:6,title:'迎接更多旅人',description:'扩成七格大营地，完成这一站的建设。'}
];
export function projectFor(state,chain){return state.items.find(item=>item.chain===chain&&item.settled)||null;}
export function stageComplete(state,stage){return stage.chain==='bridge'?state.bridge>=8:(projectFor(state,stage.chain)?.level||0)>=stage.level;}
export function completedStages(state){return CONSTRUCTION_STAGES.filter(stage=>stageComplete(state,stage)).length;}
export function currentOrder(state){
  const index=CONSTRUCTION_STAGES.findIndex(stage=>!stageComplete(state,stage));if(index<0)return null;
  const stage=CONSTRUCTION_STAGES[index];
  if(stage.chain==='bridge')return {...stage,index,requiredValue:8-state.bridge,requiredLevel:null};
  const existing=projectFor(state,stage.chain),requiredValue=materialValue(stage.level)-(existing?materialValue(existing.level):0);
  return {...stage,index,requiredValue,requiredLevel:Math.ceil(Math.log2(requiredValue))+1,oldLevel:existing?.level||0};
}
export function canContribute(state,item){const order=currentOrder(state);return !!(order&&order.chain!=='bridge'&&item&&!item.settled&&item.chain===order.chain&&materialValue(item.level)>=order.requiredValue);}
export function orderItem(state){return state.items.filter(item=>canContribute(state,item)).sort((a,b)=>a.level-b.level||Number(inBag(a))-Number(inBag(b)))[0]||null;}
export function previewConstruction(state,id){
  const item=state.items.find(value=>value.id===id),order=currentOrder(state);
  if(!canContribute(state,item))return {ok:false,message:'这件素材还不能用于当前目标。'};
  const existing=projectFor(state,item.chain),previousValue=existing?materialValue(existing.level):0,budget=previousValue+materialValue(item.level);
  const achieved=CONSTRUCTION_STAGES.filter(stage=>stage.chain===item.chain&&materialValue(stage.level)<=budget).at(-1);
  const requiredValue=materialValue(achieved.level)-previousValue,[q,r]=CHAINS[item.chain].anchor;
  return {ok:true,itemId:id,chain:item.chain,level:achieved.level,title:achieved.title,name:CHAINS[item.chain].names[achieved.level],q,r,rotation:0,oldLevel:existing?.level||0,requiredValue,refund:materialValue(item.level)-requiredValue,stagesBuilt:CONSTRUCTION_STAGES.filter(stage=>stage.chain===item.chain&&stage.level>(existing?.level||0)&&stage.level<=achieved.level).length,cells:shapeFor(achieved.level).map(([dq,dr])=>[q+dq,r+dr])};
}
export const REWARDS = [
  [['forest',1,4]],
  [['forest',1,4]],
  [['forest',2,4],['water',1,5]],
  [['water',1,4],['camp',2,2]],
  [['camp',3,3],['forest',2,2]],
  [['camp',3,2],['forest',2,2],['forest',1,1]],
  [['camp',2,2],['camp',1,1]],
  [['camp',3,1]]
];
export const INITIAL_CELLS = [[-1,0],[0,0],[0,-1],[-1,-1],[-2,0],[-2,1],[-1,1]];
export const WAVES = [
  [[-2,2],[-1,2],[0,-2],[0,1],[0,2],[1,-2],[1,-1],[1,0],[1,1],[2,-2],[2,-1],[2,0]],
  [[-2,3],[-3,3],[-3,2],[-3,1],[-3,0],[-2,-1],[-1,-2],[0,-3],[1,-3],[2,-3],[3,-3],[3,-2]],
  [[3,-1],[3,0],[2,1],[1,2],[0,3],[-1,3]]
];
export const BRIDGE_CELL = [3,-1];
export const BOARD = [];
for (let q=-3;q<=3;q++) for (let r=-3;r<=3;r++) if (Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=3) BOARD.push([q,r]);
const SHAPES = {1:[[0,0]],3:[[0,0],[1,0],[0,1]],7:[[0,0],[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]};
export const keyOf = ([q,r]) => `${q},${r}`;
export const materialValue = level => 2 ** (level-1);
export const itemName = item => CHAINS[item.chain]?.names[item.level] || '素材';
export const inBag = item => item.q === null;
export const hexDistance = (a,b) => Math.max(Math.abs(a[0]-b[0]), Math.abs(a[1]-b[1]), Math.abs(a[0]+a[1]-b[0]-b[1]));
export function shapeFor(level, rotation=0) {
  let cells = SHAPES[FOOTPRINT[level]].map(cell=>[...cell]);
  for (let i=0;i<((rotation%6)+6)%6;i++) cells=cells.map(([q,r])=>[-r,q+r]);
  return cells;
}
export function cellsOf(item) {
  if (inBag(item)) return [];
  return shapeFor(item.level,item.rotation).map(([q,r])=>[q+item.q,r+item.r]);
}
export function hexBoundary(cells){
  const edges=new Map(),vertices=new Map();
  const vertexKey=point=>point.map(number=>Math.round(number*1e6)).join(',');
  for(const [q,r]of cells){
    const center=[Math.sqrt(3)*(q+r/2),1.5*r];
    const points=Array.from({length:6},(_,i)=>{const angle=(60*i-30)*Math.PI/180;return [center[0]+Math.cos(angle),center[1]+Math.sin(angle)];});
    for(let i=0;i<6;i++){const a=points[i],b=points[(i+1)%6],ak=vertexKey(a),bk=vertexKey(b),key=[ak,bk].sort().join('|');vertices.set(ak,a);vertices.set(bk,b);if(edges.has(key))edges.delete(key);else edges.set(key,[ak,bk]);}
  }
  const outgoing=new Map([...edges.values()].map(([a,b])=>[a,b]));const loops=[];
  while(outgoing.size){const start=outgoing.keys().next().value;let current=start;const loop=[];do{loop.push(vertices.get(current));const next=outgoing.get(current);outgoing.delete(current);current=next;}while(current&&current!==start&&loop.length<1000);if(current!==start)throw Error('Invalid hex boundary');loops.push(loop);}
  return loops;
}
export function newGame() {
  return {version:SAVE_VERSION,wins:0,nextId:1,items:[],chests:[],forestOpened:false,goals:{forest:false,water:false,camp:false},bridge:0,supplies:0,departed:false,route:null,settlement:null,merges:0};
}
export function landscapeCells(state){const cells=state.items.filter(item=>item.settled).flatMap(cellsOf);if(state.bridge>=8)cells.push([...BRIDGE_CELL]);return cells;}
export function workCapacity(state){return state.bridge>=8?23:state.goals.water?19:(state.forestOpened||(projectFor(state,'forest')?.level||0)>=4)?13:7;}
export function workCells(state){const landscape=new Set(landscapeCells(state).map(keyOf));return [...INITIAL_CELLS,...WAVES.flat()].filter(cell=>!landscape.has(keyOf(cell))).slice(0,workCapacity(state)).map(cell=>[...cell]);}
export function openCells(state){return [...workCells(state),...landscapeCells(state)];}
export function spaceSummary(state){const capacity=workCapacity(state),used=state.items.filter(item=>!item.settled).reduce((sum,item)=>sum+cellsOf(item).length,0);return {capacity,used,free:capacity-used,landscape:landscapeCells(state).length};}
export function occupancy(state, exclude=[]) {
  const skip=new Set(exclude);const result=new Map();
  for(const item of state.items)if(!skip.has(item.id))for(const cell of cellsOf(item))result.set(keyOf(cell),item.id);
  if(state.bridge>=8)result.set(keyOf(BRIDGE_CELL),'bridge');
  return result;
}
export function canPlace(state,level,q,r,rotation=0,exclude=[]) {
  if(!Number.isInteger(q)||!Number.isInteger(r))return false;
  const open=new Set(openCells(state).map(keyOf));const used=occupancy(state,exclude);
  return shapeFor(level,rotation).every(([dq,dr])=>open.has(`${q+dq},${r+dr}`)&&!used.has(`${q+dq},${r+dr}`));
}
export function findPlacement(state,level,preferred=[0,0],exclude=[],rotation=0) {
  const anchors=openCells(state).sort((a,b)=>hexDistance(a,preferred)-hexDistance(b,preferred)||a[1]-b[1]||a[0]-b[0]);
  for(const [q,r] of anchors)for(let i=0;i<(FOOTPRINT[level]===3?6:1);i++){
    const rot=(rotation+i)%6;
    if(canPlace(state,level,q,r,rot,exclude))return {q,r,rotation:rot};
  }
  return null;
}
function planRelocations(state,items,reserved=[],extraExclude=[]){
  if(!items.length)return [];
  const workspace=workCells(state),workKeys=new Set(workspace.map(keyOf));
  const ignored=[...extraExclude,...items.map(item=>item.id)],occupied=new Set([...occupancy(state,ignored).keys(),...reserved.map(keyOf)]);
  if(workspace.filter(cell=>!occupied.has(keyOf(cell))).length<items.reduce((sum,item)=>sum+FOOTPRINT[item.level],0))return null;
  const candidates=new Map();
  for(const item of items){
    const anchors=workspace.slice().sort((a,b)=>hexDistance(a,[item.q,item.r])-hexDistance(b,[item.q,item.r])||a[1]-b[1]||a[0]-b[0]);
    const options=[],seen=new Set();
    for(let turn=0;turn<(FOOTPRINT[item.level]===3?6:1);turn++)for(const [q,r]of anchors){
      const rotation=(item.rotation+turn)%6,cells=shapeFor(item.level,rotation).map(([dq,dr])=>[q+dq,r+dr]),keys=cells.map(keyOf),signature=keys.slice().sort().join('|');
      if(seen.has(signature)||keys.some(key=>!workKeys.has(key)||occupied.has(key)))continue;
      seen.add(signature);options.push({id:item.id,q,r,rotation,cells,keys,from:{q:item.q,r:item.r,rotation:item.rotation}});
    }
    if(!options.length)return null;candidates.set(item.id,options);
  }
  let nodes=0;
  function search(remaining){
    if(!remaining.length)return [];
    if(++nodes>6000)return null;
    let chosen=null,choices=null;
    for(const item of remaining){const legal=candidates.get(item.id).filter(option=>option.keys.every(key=>!occupied.has(key)));if(!legal.length)return null;if(!choices||legal.length<choices.length){chosen=item;choices=legal;}}
    for(const option of choices){option.keys.forEach(key=>occupied.add(key));const rest=search(remaining.filter(item=>item.id!==chosen.id));if(rest)return [option,...rest];option.keys.forEach(key=>occupied.delete(key));}
    return null;
  }
  return search(items);
}
export function previewMove(state,id,q,r,rotation){
  const item=state.items.find(value=>value.id===id);
  if(!item||item.settled)return {ok:false,message:'绿色景观会留在原地，不能被挤走。'};
  rotation??=item.rotation;
  if(!Number.isInteger(q)||!Number.isInteger(r)||!Number.isInteger(rotation)||rotation<0||rotation>5)return {ok:false,message:'请放到六角地格上。'};
  const cells=shapeFor(item.level,rotation).map(([dq,dr])=>[q+dq,r+dr]),work=new Set(workCells(state).map(keyOf)),scenery=new Set(landscapeCells(state).map(keyOf));
  if(cells.some(cell=>scenery.has(keyOf(cell))))return {ok:false,cells,message:'这里是已建景观，请放到米色工作地格。'};
  if(cells.some(cell=>!work.has(keyOf(cell))))return {ok:false,cells,message:`这件素材需要 ${FOOTPRINT[item.level]} 格连续的工作地格。`};
  const used=occupancy(state,[id]),blockedIds=new Set(cells.map(cell=>used.get(keyOf(cell))).filter(Boolean));
  const blockers=state.items.filter(other=>blockedIds.has(other.id));
  const shifted=planRelocations(state,blockers,cells,[id]);
  if(!shifted)return {ok:false,cells,message:'没有能完整安置挡位素材的空地。先合成腾出空间，原位置不会改变。'};
  return {ok:true,id,q,r,rotation,cells,shifted:shifted.map(({keys,...rest})=>rest)};
}
export function previewMerge(state,sourceId,targetId) {
  const a=state.items.find(item=>item.id===sourceId),b=state.items.find(item=>item.id===targetId);
  if(!a||!b||a.id===b.id)return {ok:false,message:'选另一件相同素材。'};
  if(a.settled||b.settled)return {ok:false,message:'已落成的景物会永久保留。'};
  if(a.chain!==b.chain||a.level!==b.level)return {ok:false,message:'相同种类、相同等级才能合成。'};
  if(a.level>=CHAINS[a.chain].target)return {ok:false,message:'这件景物已经可以落成了。'};
  if(inBag(a)&&inBag(b))return {ok:false,message:'先把其中一件放回地图，再合成。'};
  const destination=inBag(b)?a:b;
  const placement=findPlacement(state,a.level+1,[destination.q,destination.r],[a.id,b.id],destination.rotation);
  if(!placement)return {ok:false,message:`升级需要连续 ${FOOTPRINT[a.level+1]} 格。先把其他素材暂存到暂放区吧。`};
  return {ok:true,placement,level:a.level+1,chain:a.chain,size:FOOTPRINT[a.level+1],cells:shapeFor(a.level+1,placement.rotation).map(([q,r])=>[q+placement.q,r+placement.r])};
}
export function isComplete(state){return Object.values(state.goals).every(Boolean)&&state.bridge>=8;}
export function bridgeReady(state){return currentOrder(state)?.chain==='bridge'&&!state.departed&&state.bridge<8;}
export function bridgeAvailable(state){return state.items.filter(item=>item.chain==='forest'&&!item.settled).reduce((sum,item)=>sum+materialValue(item.level),0);}
export function settlementPreview(state) {
  const counts=new Map();let value=0;
  const add=(chain,level,count)=>{const id=`${chain}:${level}`;counts.set(id,{chain,level,count:(counts.get(id)?.count||0)+count});value+=materialValue(level)*count;};
  for(const item of state.items)if(!item.settled)add(item.chain,item.level,1);
  for(const chest of state.chests)for(const [chain,level,count]of chest.contents)add(chain,level,count);
  return {items:[...counts.values()],value,total:state.supplies+value,retained:3};
}
function fail(state,message){return {state,ok:false,message,events:[]};}
export function act(current,action) {
  if(current.departed)return fail(current,'本次营地之旅已完成，可以回看营地或重新体验。');
  const state=structuredClone(current);const events=[];let selected=null;
  const get=id=>state.items.find(item=>item.id===id);
  if(action.type==='WIN') {
    if(state.wins>=8)return fail(current,'本区物资已全部送达，完成剩余建设就能出发。');
    state.wins++;
    state.chests.push({id:`chest-${state.wins}`,index:state.wins,contents:structuredClone(REWARDS[state.wins-1])});
    events.push({type:'reward',title:'三消胜利！',message:`第 ${state.wins} 箱营地物资已送达。`});
  } else if(action.type==='OPEN_CHEST') {
    if(!state.chests.length)return fail(current,'先模拟一次三消胜利，领取素材箱。');
    const chest=state.chests.shift();let count=0,stored=0;
    for(const [chain,level,amount]of chest.contents)for(let i=0;i<amount;i++){
      const position=findPlacement(state,level,CHAINS[chain].anchor);
      const item={id:`item-${state.nextId++}`,chain,level,q:position?.q??null,r:position?.r??null,rotation:position?.rotation??0,settled:false};
      state.items.push(item);count++;if(!position)stored++;
    }
    events.push({type:'chest',title:'打开物资箱',message:`收到 ${count} 件素材${stored?`，其中 ${stored} 件已放入暂放区`:''}。`,contents:chest.contents});
  } else if(action.type==='MERGE') {
    const preview=previewMerge(current,action.source,action.target);
    if(!preview.ok)return fail(current,preview.message);
    state.items=state.items.filter(item=>item.id!==action.source&&item.id!==action.target);
    const item={id:`item-${state.nextId++}`,chain:preview.chain,level:preview.level,...preview.placement,settled:false};
    state.items.push(item);state.merges++;selected=item.id;
    const grown=FOOTPRINT[item.level]>FOOTPRINT[item.level-1];
    events.push({type:grown?'growth':'merge',title:itemName(item),message:grown?`景物展开，占地变为 ${FOOTPRINT[item.level]} 格！`:`合成成功 · L${item.level}`,itemId:item.id});
  } else if(action.type==='MOVE') {
    const item=get(action.id);
    const plan=previewMove(current,action.id,action.q,action.r,action.rotation);
    if(!plan.ok)return fail(current,plan.message);
    for(const shift of plan.shifted)Object.assign(get(shift.id),{q:shift.q,r:shift.r,rotation:shift.rotation});
    Object.assign(item,{q:plan.q,r:plan.r,rotation:plan.rotation});selected=item.id;
    if(plan.shifted.length)events.push({type:'move',title:'已自动让出位置',message:`${plan.shifted.length} 件挡位素材已整体移到可用空地。`,shifted:plan.shifted});
  } else if(action.type==='ROTATE') {
    const item=get(action.id);
    if(!item||item.settled||FOOTPRINT[item.level]!==3)return fail(current,'三格景物可以旋转方向。');
    const rotation=(item.rotation+1)%6;
    if(!inBag(item)&&!canPlace(state,item.level,item.q,item.r,rotation,[item.id]))return fail(current,'这个方向被挡住了，可以先暂存再摆放。');
    item.rotation=rotation;selected=item.id;
  } else if(action.type==='STORE') {
    const item=get(action.id);
    if(!item||item.settled||inBag(item))return fail(current,'选择一件尚未落成的地图素材。');
    item.q=null;item.r=null;selected=item.id;
    events.push({type:'store',title:'放到下方暂放区了',message:'素材没有消失；点下方缩略图，再点「放回」即可。',storedIds:[item.id]});
  } else if(action.type==='SETTLE') {
    const item=get(action.id);
    const order=currentOrder(state);
    if(!canContribute(state,item))return fail(current,order&&order.chain!=='bridge'?`当前建设需要 ${CHAINS[order.chain].names[order.requiredLevel]} L${order.requiredLevel}，更高等级也可交付。`:order?'先完成当前的修桥目标。':'当前区域的建设已经完成。');
    const previousOpen=new Set(openCells(state).map(keyOf)),previousCapacity=workCapacity(state);
    let landmark=projectFor(state,item.chain);const previousLevel=landmark?.level||0,previousValue=landmark?materialValue(landmark.level):0,previousSize=landmark?FOOTPRINT[landmark.level]:0;
    const budget=previousValue+materialValue(item.level);
    const achieved=CONSTRUCTION_STAGES.filter(stage=>stage.chain===item.chain&&materialValue(stage.level)<=budget).at(-1);
    const achievedLevel=achieved.level,requiredValue=materialValue(achievedLevel)-previousValue;
    const [q,r]=CHAINS[item.chain].anchor;const targetCells=shapeFor(achievedLevel).map(([dq,dr])=>`${q+dq},${r+dr}`);
    const blocked=state.items.some(other=>other.settled&&other.id!==landmark?.id&&cellsOf(other).some(cell=>targetCells.includes(keyOf(cell))));
    if(blocked)return fail(current,'这处景观地块暂时不可用。');
    state.items=state.items.filter(other=>other.id!==item.id);
    if(landmark)Object.assign(landmark,{level:achievedLevel,q,r,rotation:0});
    else{landmark={id:`item-${state.nextId++}`,chain:item.chain,level:achievedLevel,q,r,rotation:0,settled:true};state.items.push(landmark);}
    if(item.chain==='forest'&&achievedLevel>=4)state.forestOpened=true;
    state.goals[item.chain]=achievedLevel>=CHAINS[item.chain].target;
    const blockers=state.items.filter(other=>!other.settled&&cellsOf(other).some(cell=>targetCells.includes(keyOf(cell))));
    const relocations=planRelocations(state,blockers);let stored=0;
    if(relocations){for(const move of relocations)Object.assign(get(move.id),{q:move.q,r:move.r,rotation:move.rotation});}
    else{const old=blockers.map(other=>({...other}));for(const other of blockers){other.q=null;other.r=null;}for(const previous of old.sort((a,b)=>FOOTPRINT[b.level]-FOOTPRINT[a.level])){const other=get(previous.id),place=findPlacement(state,other.level,[previous.q,previous.r],[other.id],other.rotation);if(place)Object.assign(other,place);else stored++;}}
    let refund=materialValue(item.level)-requiredValue;
    const refundValue=refund;
    for(let level=CHAINS[item.chain].target;level>=1;level--)while(refund>=materialValue(level)){
      state.items.push({id:`item-${state.nextId++}`,chain:item.chain,level,q:null,r:null,rotation:0,settled:false});refund-=materialValue(level);
    }
    selected=landmark.id;
    const added=FOOTPRINT[achievedLevel]-previousSize,newCells=openCells(state).filter(cell=>!previousOpen.has(keyOf(cell)));
    const expanded=workCapacity(state)>previousCapacity;
    const note=expanded?`工作区拓展到 ${workCapacity(state)} 格。`:`工作区仍有 ${workCapacity(state)} 格，新景观占地已补回。`;
    const stagesBuilt=CONSTRUCTION_STAGES.filter(stage=>stage.chain===item.chain&&stage.level>previousLevel&&stage.level<=achievedLevel).length;
    events.push({type:previousSize&&added>0?'growth':'settle',title:`${itemName(landmark)}建在这里了`,message:`${stagesBuilt>1?`连续完成 ${stagesBuilt} 个阶段，`:''}区域建设 ${completedStages(state)} / ${CONSTRUCTION_STAGES.length}。${note}${refundValue?` 多余 ${refundValue} 份素材已退回下方暂放区。`:''}${stored?` ${stored} 件挡位素材已放入暂放区。`:''}`,itemId:landmark.id,cells:newCells,construction:true,shifted:relocations||[]});
  } else if(action.type==='BUILD_BRIDGE') {
    if(!bridgeReady(state))return fail(current,state.bridge>=8?'木桥已经修好了。':'先完成当前的建设阶段，篝火营位建好后就能修桥。');
    const previousOpen=new Set(openCells(state).map(keyOf));
    let available=state.items.filter(item=>item.chain==='forest'&&!item.settled);
    if(!available.length)return fail(current,'把额外的树林素材带来，就能推进修桥。');
    const chosen=action.id?available.find(item=>item.id===action.id):null;
    if(action.id&&!chosen)return fail(current,'修桥需要尚未落成的树林素材。');
    let contributed=0,refund=0;
    while(available.length&&state.bridge<8){
      const remaining=8-state.bridge;
      const candidate=chosen||available.filter(item=>materialValue(item.level)<=remaining).sort((a,b)=>b.level-a.level)[0]||available.sort((a,b)=>a.level-b.level)[0];
      const amount=materialValue(candidate.level),used=Math.min(amount,remaining);
      state.items=state.items.filter(item=>item.id!==candidate.id);
      state.bridge+=used;state.supplies+=amount-used;contributed+=used;refund+=amount-used;
      available=available.filter(item=>item.id!==candidate.id);
      if(chosen)break;
    }
    if(state.bridge>=8){
      const blockers=state.items.filter(item=>!item.settled&&cellsOf(item).some(cell=>keyOf(cell)===keyOf(BRIDGE_CELL)));
      for(const item of blockers){item.q=null;item.r=null;}
      events.push({type:'unlock',title:'木桥修好了',message:`第 9 / 10 步完成，工作区拓展到 23 格。${refund?`多余材料返还 ${refund} 点旅行补给。`:''}`,cells:openCells(state).filter(cell=>!previousOpen.has(keyOf(cell)))});
    }else events.push({type:'bridge',title:`修桥 ${state.bridge} / 8`,message:`投入 ${contributed} 点建设值，木桥正在一点点恢复。`});
  } else if(action.type==='DEPART') {
    if(!isComplete(state))return fail(current,'先完成三处景物和木桥，再开始下一段旅程。');
    if(!['river','mountain'].includes(action.route))return fail(current,'选择河湾或山坡作为下一站。');
    const preview=settlementPreview(state);
    state.supplies=preview.total;state.settlement={...preview,route:action.route};
    state.items=state.items.filter(item=>item.settled);state.chests=[];state.departed=true;state.route=action.route;
    events.push({type:'depart',title:'营地的灯火亮起来了',message:`${preview.value} 点剩余物资已变成旅行补给，下一站：${action.route==='river'?'河湾':'山坡'}。`});
  } else return fail(current,'未知操作。');
  return {state,ok:true,message:events.at(-1)?.message||'',events,selected};
}
export function getHint(state) {
  if(state.departed)return {type:'done',message:'营地已永久保留。你可以回看景色，或重新体验。'};
  if(isComplete(state))return {type:'depart',message:'营地建好了！结算剩余素材，选择下一站。'};
  const deliverable=orderItem(state),order=currentOrder(state);
  if(deliverable)return {type:'settle',id:deliverable.id,message:`交付${itemName(deliverable)}，完成「${order.title}」。已建内容会保留并升级。`};
  if(bridgeReady(state)&&bridgeAvailable(state)>0)return {type:'bridge',message:`有 ${bridgeAvailable(state)} 点树林材料可修桥，点右侧的小桥。`};
  const desiredChain=order?.chain==='bridge'?'forest':order?.chain;
  const loose=state.items.filter(item=>!item.settled&&item.chain===desiredChain).sort((a,b)=>a.level-b.level||Number(inBag(a))-Number(inBag(b)));
  let blockedPair=null;
  for(let i=0;i<loose.length;i++)for(let j=i+1;j<loose.length;j++){
    const a=loose[i],b=loose[j];
    if(a.chain!==b.chain||a.level!==b.level||a.level>=CHAINS[a.chain].target)continue;
    const preview=previewMerge(state,a.id,b.id);
    if(preview.ok)return {type:'merge',source:a.id,target:b.id,message:`把两件${itemName(a)}合在一起${preview.size>FOOTPRINT[a.level]?`，底座将扩成 ${preview.size} 格`:''}。`};
    blockedPair={type:'space',source:a.id,target:b.id,message:preview.message};
  }
  if(blockedPair){
    const stored=loose.find(item=>inBag(item)&&findPlacement(state,item.level,CHAINS[item.chain].anchor));
    if(stored)return {type:'restore',id:stored.id,message:'先把暂放区里的一件素材放到地图空地，再继续合成。'};
    return blockedPair;
  }
  if(state.chests.length)return {type:'chest',message:`物资箱已送达，打开 ${state.chests[0].index} 号箱，看看里面有什么。`};
  if(state.wins<8)return {type:'win',message:state.wins===0?'先模拟一次三消胜利，领取第一箱树种。':'再赢一局三消，为营地带来新的素材。'};
  const stored=loose.find(inBag);
  if(stored)return {type:'restore',id:stored.id,message:'暂放区里还有素材，选中后放回地图继续合成。'};
  return {type:'space',message:'查看当前建设需求，或用暂存和撤销调整摆放。'};
}
export function validateState(state) {
  if(!state||state.version!==SAVE_VERSION||!Number.isInteger(state.wins)||state.wins<0||state.wins>8||!Array.isArray(state.items)||!Array.isArray(state.chests)||!state.goals) return false;
  if(!Number.isInteger(state.nextId)||state.nextId<1||!Number.isInteger(state.bridge)||state.bridge<0||state.bridge>8||!Number.isInteger(state.supplies)||state.supplies<0)return false;
  if(state.items.length>200||state.chests.length>8)return false;
  const ids=new Set(),occupied=new Set();const open=new Set(openCells(state).map(keyOf)),boardKeys=new Set(BOARD.map(keyOf));
  for(const item of state.items){
    if(typeof item.id!=='string'||ids.has(item.id)||!CHAINS[item.chain]||!Number.isInteger(item.level)||item.level<1||item.level>CHAINS[item.chain].target||!Number.isInteger(item.rotation)||item.rotation<0||item.rotation>5)return false;
    ids.add(item.id);
    if((item.q===null)!==(item.r===null)||(!inBag(item)&&(!Number.isInteger(item.q)||!Number.isInteger(item.r))))return false;
    if(item.settled&&(inBag(item)||!CONSTRUCTION_STAGES.some(stage=>stage.chain===item.chain&&stage.level===item.level)||item.rotation!==0||item.q!==CHAINS[item.chain].anchor[0]||item.r!==CHAINS[item.chain].anchor[1]))return false;
    for(const cell of cellsOf(item)){const key=keyOf(cell);if(!boardKeys.has(key)||!open.has(key)||occupied.has(key))return false;occupied.add(key);}
  }
  if(state.bridge>=8&&occupied.has(keyOf(BRIDGE_CELL)))return false;
  for(const chain of Object.keys(CHAINS)){if(state.items.filter(item=>item.chain===chain&&item.settled).length>1)return false;if(Boolean(state.goals[chain])!==state.items.some(item=>item.chain===chain&&item.settled&&item.level===CHAINS[chain].target))return false;}
  for(const chest of state.chests){if(!Array.isArray(chest.contents)||!Number.isInteger(chest.index)||chest.index<1||chest.index>8)return false;for(const entry of chest.contents){if(!Array.isArray(entry)||entry.length!==3||!CHAINS[entry[0]]||!Number.isInteger(entry[1])||entry[1]<1||entry[1]>CHAINS[entry[0]].target||!Number.isInteger(entry[2])||entry[2]<1||entry[2]>20)return false;}}
  return !state.departed||(isComplete(state)&&['river','mountain'].includes(state.route)&&state.items.every(item=>item.settled)&&state.chests.length===0);
}
export function migrateState(input) {
  if(!input||![1,2,SAVE_VERSION].includes(input.version))return input;
  if(input.version===SAVE_VERSION)return input;
  const state=structuredClone(input);state.version=SAVE_VERSION;
  const open=new Set(openCells(state).map(keyOf));
  for(const item of state.items||[])if(!item.settled&&cellsOf(item).some(cell=>!open.has(keyOf(cell)))){item.q=null;item.r=null;}
  return state;
}
