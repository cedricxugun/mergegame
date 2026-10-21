import * as Classic from './homecoming.mjs';
// V8 adds branching repairs and controlled supply release. The frozen v7 engine
// remains the validator/dispatcher for old checkpoints until upgradeJourney runs.
// Scenery and movable materials still use one persistent axial grid.
export const SAVE_KEY='forest-camp.homecoming.v1';
export const REGION_NAMES={camp:'林间营地',river:'芦苇河湾'};
export const OFFSETS={camp:[0,0],river:[6,0]};
export const NAMES={wood:['','木片','木料束','防雨补片','加固组件','施工支架','屋架模块','营建组件'],water:['','水滴','集水碗','净水罐','引水组件','蓄水组件','水渠模块','溪流组件'],reed:['','芦芽','幼苗','芦苇束','护岸草垫','根系簇','护岸绿带','湿地组件'],dock:['','木条','木板','栈道板组','基础桩','栈桥组件','泊位框架','渡口模块']};
export const CAPS={wood:7,water:7,reed:7,dock:7};
export const SIZE={1:1,2:1,3:1,4:1,5:1,6:1,7:3};
export const key=c=>c.join(',');
export const unique=cells=>[...new Map(cells.map(c=>[key(c),c])).values()];
export const distance=(a,b)=>Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[0]+a[1]-b[0]-b[1]));
export const isTrial=i=>typeof i?.trialSocket==='string';
export const inTray=i=>i.q===null&&!isTrial(i);
export const nameOf=i=>NAMES[i.chain]?.[i.level]||'素材';
export const valueOf=i=>2**(i.level-1);
export function shape(level,rotation=0){let cells=SIZE[level]===3?[[0,0],[1,0],[0,1]]:[[0,0]];for(let i=0;i<rotation;i++)cells=cells.map(([q,r])=>[-r,q+r]);return cells;}
export const cellsOf=i=>inTray(i)||isTrial(i)?[]:shape(i.level,i.rotation||0).map(([q,r])=>[q+i.q,r+i.r]);
export function boundary(cells){
  const edges=new Map(),vertices=new Map(),vk=p=>p.map(v=>Math.round(v*1e6)).join(',');
  for(const[q,r]of unique(cells)){const x=Math.sqrt(3)*(q+r/2),y=1.5*r,ps=Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return[x+Math.cos(a),y+Math.sin(a)];});for(let i=0;i<6;i++){const a=ps[i],b=ps[(i+1)%6],ak=vk(a),bk=vk(b),k=[ak,bk].sort().join('|');vertices.set(ak,a);vertices.set(bk,b);if(edges.has(k))edges.delete(k);else edges.set(k,[ak,bk]);}}
  const outgoing=new Map([...edges.values()]),loops=[];while(outgoing.size){const start=outgoing.keys().next().value,loop=[];let current=start;do{loop.push(vertices.get(current));const next=outgoing.get(current);outgoing.delete(current);current=next;}while(current&&current!==start&&loop.length<1000);if(current!==start)throw Error('Open hex boundary');loops.push(loop);}return loops;
}
const disk=(q,r)=>{const cells=[];for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)if(distance([x,y],[0,0])<=2)cells.push([q+x,r+y]);return cells;};
export const BASE_LAND={camp:disk(0,0),river:[...disk(6,0),[4,-2],[5,-2],[4,-1]]};
export const EXPANSIONS={camp:[ [[-2,3],[-1,3]], [[0,3],[1,2]], [[3,-1],[3,-2],[2,1]], [[3,0],[3,1],[2,2],[1,3]] ],river:[ [[4,3],[5,3]], [[6,3],[7,2],[8,1],[9,0],[9,-1]], [], [[5,4],[6,4],[7,3],[8,2]], [], [[9,1],[9,2],[8,3],[7,4]] ]};
export const STREAM_CELLS=[[2,-2],[3,-2],[4,-2],[5,-2],[6,-2],[7,-2],[6,-1],[7,-1]];
export const SITES={shelter:[0,-2],hearth:[-1,0],path:[2,-1],spring:[6,-2],reeds:[5,1],dock:[7,0]};
export const TASKS={camp:[
  {id:'roof',site:'shelter',chain:'wood',level:3,title:'先补好漏雨的棚顶',short:'补好棚顶',problem:'棚顶被风掀开了。先让莉娜有个避雨的地方。',result:'雨水被挡在外面了',speaker:"米拉",portrait:"mira",line:"棚顶挡住雨了。接下来，先让炉火暖起来，或先清开通往河湾的路，都由你决定。",reward:'清出 2 格空地'},
  {id:'fire',site:'hearth',chain:'wood',level:4,title:'搭起炉架，生一堆火',short:'搭起炉架',problem:'衣服还是湿的。加固炉架，让大家暖和起来。',result:'第一盏暖光亮起来了',speaker:"莉娜",portrait:"lina",line:"我把灯朝着河的方向摆。这样，罗恩叔叔也能看见。",reward:'再清出 2 格空地'},
  {id:'path',site:'path',chain:'wood',level:5,title:'撑起倒木，接通旧路',short:'清出旧路',problem:'倒木压住了通往河湾的路，需要更结实的施工支架。',result:'通往河湾的旧路露出来了',speaker:"莉娜",portrait:"lina",line:"手记上画着上游的石泉！先把小屋修结实，我们就去找它。",reward:'旧路可放素材 · 清出新的空地'},
  {id:'home',site:'shelter',chain:'wood',level:7,title:'把临时棚修成安稳的家',short:'修好营地木屋',problem:'临时棚挡得住小雨，还需要完整的营建组件才能住得安心。',result:'我们有一个能回来的家了',speaker:"莉娜",portrait:"lina",line:"那现在去找水吧。外婆的花箱也在等喝水呢。",reward:'主体扩成 3 格 · 新开 4 格，空地净增 2 格'}
],river:[
  {id:'spring',site:'spring',chain:'water',level:4,title:'找回石缝里的泉眼',short:'疏通泉眼',problem:'泉眼被碎石堵住了，先接起一段引水装置。',result:'石缝里有水声了',speaker:"米拉",portrait:"mira",line:"没关系，先把这一段接稳。等水渠组件齐了，我们就把每段连起来。",reward:'清出 2 格河边空地'},
  {id:'stream',site:'spring',chain:'water',level:7,title:'让小溪流回营地',short:'接通整段水渠',problem:'泉水还困在上游。慢慢合出完整溪流组件，接通这段旧渠。',result:'小溪终于流回了营地',speaker:"米拉",portrait:"mira",line:"这条水路把两处连起来了。以后，营地也能听见这里的水声。",reward:'水路连到渡口与营地 · 新开 5 格，空地净增 2 格'},
  {id:'reeds',site:'reeds',chain:'reed',level:4,title:'给松动的河岸种上芦苇',short:'种下护岸草垫',problem:'暴风雨冲松了河岸。先种下一小片护岸草，让泥土留在原处。',result:'第一片芦苇在水边站稳了',speaker:"莉娜",portrait:"lina",line:"我把小石头摆在外圈，提醒大家别踩到刚种下的芦苇。",reward:'河岸开始恢复生机'},
  {id:'shore',site:'reeds',chain:'reed',level:6,title:'让根系连成护岸绿带',short:'修复整片河岸',problem:'继续培育芦苇，让根系覆盖这片松散的岸边。',result:'白鹭回到河湾了',speaker:"米拉",portrait:"mira",line:"这段河岸终于安稳了。白鹭又找到了落脚的地方。",reward:'河岸扩成 3 格 · 新开 4 格，空地净增 2 格'},
  {id:'pier',site:'dock',chain:'dock',level:5,title:'接上断开的第一段栈桥',short:'铺好第一段栈桥',problem:'河对岸有人在招手。先修好能靠近岸边的栈桥。',result:'我们听到了对岸的回应',speaker:"罗恩",portrait:"rowan",line:"船上有种子、工具，还有你母亲寄回来的信。我都替你收好了。",reward:'旧路从营地一直延伸到栈桥'},
  {id:'ferry',site:'dock',chain:'dock',level:7,title:'让旧渡口重新迎接归人',short:'修好归乡渡口',problem:'完整的渡口模块就快备齐了，让小船重新靠岸。',result:'第一艘归乡的小船靠岸了',speaker:"米拉",portrait:"mira",line:"这封信上说，山坡的信号灯也坏了。先把这里收拾好，再给更多归来的人照亮路。",reward:'渡口扩成 3 格 · 新开 4 格，空地净增 2 格'}
]};
const box=(chain,level,count=4,extra=[])=>[...Array.from({length:count},()=>({chain,level})),...extra];
export const REWARDS={camp:[box('wood',1),box('wood',2),box('wood',2),box('wood',2),box('wood',3),box('wood',3),box('wood',3),box('wood',3,4,[{chain:'wood',level:1}])],river:[box('water',2),box('water',3),box('water',3),box('water',3),box('water',3,4,[{chain:'water',level:1}]),box('reed',2),box('reed',3),box('reed',3,4,[{chain:'reed',level:1}]),box('dock',3),box('dock',3),box('dock',3),box('dock',4,4,[{chain:'dock',level:1}])]};
const freshRegion=()=>({wins:0,opened:0,stage:0,settled:false,settlement:null,doneIds:[],openedPacks:[],focusId:null});
export const freshGame=()=>({version:8,region:'camp',regions:{camp:freshRegion(),river:null},items:[],pending:[],explored:[],storeLimit:6,nextId:1,supplies:0});
export const progress=(state,region=state.region)=>state.regions[region];
export const regionComplete=(state,region=state.region)=>progress(state,region)?.stage===TASKS[region].length;
export const complete=state=>!!state.regions.river?.settled;
export const DEPENDENCIES={roof:[],fire:['roof'],path:['roof'],home:['fire','path'],spring:[],stream:['spring'],reeds:['spring'],shore:['reeds'],pier:['reeds'],ferry:['stream','shore','pier']};
export const completedTasks=(state,region=state.region)=>{const p=progress(state,region);if(!p)return[];const ids=Array.isArray(p.doneIds)?p.doneIds:state.version===7?TASKS[region].slice(0,p.stage).map(t=>t.id):[];return ids.map(id=>TASKS[region].find(t=>t.id===id)).filter(Boolean);};
export const taskDone=(state,id)=>['camp','river'].some(r=>completedTasks(state,r).some(t=>t.id===id));
export const availableTasks=(state,region=state.region)=>!progress(state,region)?[]:state.version===7?TASKS[region].slice(progress(state,region).stage,progress(state,region).stage+1):TASKS[region].filter(t=>!taskDone(state,t.id)&&DEPENDENCIES[t.id].every(id=>taskDone(state,id)));
export const currentTask=state=>availableTasks(state).find(t=>t.id===progress(state).focusId)||availableTasks(state)[0]||null;
export const TRIAL_SOCKETS={
  canal:{chain:'water',minLevel:5,cell:[5,-2],after:'spring',until:'stream',title:'旧渠试水位',verb:'试水',effect:'一小段干渠流起了细水'},
  bank:{chain:'reed',minLevel:4,cell:[5,1],after:'spring',until:'shore',title:'护岸试种位',verb:'试种',effect:'草垫旁长出一片新绿'},
  landing:{chain:'dock',minLevel:5,cell:[7,0],after:'reeds',until:'ferry',title:'栈桥试铺位',verb:'试铺',effect:'断口暂时架上了踏板'}
};
export const trialSockets=state=>state.regions.river?Object.entries(TRIAL_SOCKETS).filter(([,s])=>taskDone(state,s.after)&&!taskDone(state,s.until)).map(([id,s])=>({id,...s})):[];
export function previewTrial(state,id,socketId){
  const item=state.items.find(i=>i.id===id),socket=trialSockets(state).find(s=>s.id===socketId);
  if(!item||!socket)return{ok:false,message:'这里暂时不能试装。'};
  if(isTrial(item))return{ok:false,message:'它已经在试装位上，可以先取回。'};
  if(item.chain!==socket.chain||item.level<socket.minLevel||item.level>6)return{ok:false,message:`这里需要 ${NAMES[socket.chain][socket.minLevel]} L${socket.minLevel} 至 L6 的组件。`};
  if(state.items.some(i=>i.trialSocket===socketId))return{ok:false,message:'试装位已经有组件了，先取回原来那件。'};
  return{ok:true,socket,cells:[socket.cell],shifted:[]};
}
export const trialFor= (state,item)=>item&&!isTrial(item)?trialSockets(state).find(s=>previewTrial(state,item.id,s.id).ok)||null:null;
export const FRONTIERS=[
  {id:'camp-fern',region:'camp',cell:[-3,1],level:3,after:['roof'],title:'蕨丛空地'},
  {id:'camp-stump',region:'camp',cell:[-1,-2],level:4,after:['fire','path'],title:'旧树桩旁'},
  {id:'river-bend',region:'river',cell:[3,2],level:4,after:['spring'],title:'两岸交界'},
  {id:'river-willow',region:'river',cell:[9,-2],level:5,after:['stream','reeds'],title:'柳树下的空地'}
];
export const frontiers=state=>state.version===7?[]:FRONTIERS.filter(f=>state.regions[f.region]&&f.after.some(id=>taskDone(state,id))).map(f=>({...f,unlocked:state.explored.includes(f.id)}));
const discoveriesFor=(state,item)=>frontiers(state).filter(f=>!f.unlocked&&item.level>=f.level&&cellsOf(item).some(c=>distance(c,f.cell)===1));
function discover(state,item){const found=discoveriesFor(state,item);state.explored.push(...found.map(f=>f.id));return found;}
export function supplyPieces(region,index){const pieces=structuredClone(REWARDS[region][index]);if(index>0&&pieces[0].level>1){const first=pieces.shift();pieces.unshift({chain:first.chain,level:first.level-1},{chain:first.chain,level:first.level-1});}return pieces;}
export function supplyChoices(state){const p=progress(state),chains=[...new Set(availableTasks(state).map(t=>t.chain))];return chains.map(chain=>{const indices=REWARDS[state.region].map((pack,i)=>({pack,i})).filter(({pack,i})=>pack[0].chain===chain&&!p.openedPacks.includes(i));const index=indices[0]?.i;return{chain,index,remaining:indices.length,pieces:index===undefined?[]:supplyPieces(state.region,index)};}).filter(c=>c.remaining);}
export function upgradeJourney(old){if(old?.version===8)return validState(old)?structuredClone(old):null;if(!Classic.validState(old))return null;const state=structuredClone(old);state.version=8;state.pending=[];state.explored=[];state.storeLimit=Math.max(6,state.items.filter(inTray).length);for(const r of ['camp','river'])if(state.regions[r]){const p=state.regions[r];p.doneIds=TASKS[r].slice(0,p.stage).map(t=>t.id);p.openedPacks=Array.from({length:p.opened},(_,i)=>i);p.focusId=null;}return validState(state)?state:null;}
export const maxWins=(state,region=state.region)=>REWARDS[region].length;
export const landCells=(state,region)=>unique((region?[region]:['camp','river']).filter(r=>state.regions[r]).flatMap(r=>[...BASE_LAND[r],...TASKS[r].flatMap((t,i)=>taskDone(state,t.id)?EXPANSIONS[r][i]:[]),...FRONTIERS.filter(f=>f.region===r&&state.explored?.includes(f.id)).map(f=>f.cell)]));
export const siteCells=(site,large=false)=>shape(large?7:1).map(([q,r])=>[q+SITES[site][0],r+SITES[site][1]]);
export function blockedCells(state){
  const done=id=>taskDone(state,id);
  const fixed=[...siteCells('shelter',done('home')),...siteCells('hearth'),...(!done('path')?siteCells('path'):[]),[2,-2],...(done('path')?[[3,-2]]:[])];
  if(state.regions.river)fixed.push([4,-2],[5,-2],...siteCells('spring',done('stream')),...(done('stream')?[[7,-1]]:[]),...siteCells('reeds',done('shore')),...siteCells('dock',done('ferry')));
  return unique(fixed);
}
export function workCells(state,region){const fixed=new Set(blockedCells(state).map(key));return landCells(state,region).filter(c=>!fixed.has(key(c)));}
export function repairSpaceGain(state,task){const future=structuredClone(state);progress(future).stage++;if(future.version===8)progress(future).doneIds.push(task.id);return workCells(future).length-workCells(state).length;}
export function tileKind(state,cell){const k=key(cell);if(!landCells(state).some(c=>key(c)===k))return'locked';if(STREAM_CELLS.some(c=>key(c)===k)&&blockedCells(state).some(c=>key(c)===k))return taskDone(state,'stream')?'water':'dry';return blockedCells(state).some(c=>key(c)===k)?'site':'ground';}
export function occupancy(state,exclude=[]){const used=new Map();for(const i of state.items)if(!exclude.includes(i.id))for(const c of cellsOf(i))used.set(key(c),i.id);return used;}
export const freeCount=(state,region)=>workCells(state,region).filter(c=>!occupancy(state).has(key(c))).length;
export function canBuild(state,item,task=currentTask(state)){return!!(task&&item&&item.chain===task.chain&&item.level>=task.level);}
export function taskItem(state){return state.items.filter(i=>canBuild(state,i)).sort((a,b)=>a.level-b.level||Number(inTray(a))-Number(inTray(b)))[0]||null;}
// Backtracking relocates complete pieces. Failure is atomic: nothing is sent to storage.
function relocate(state,blockers,allowedCells,reservedKeys){
  const allowed=new Set(allowedCells.map(key)),reserved=new Set(reservedKeys),candidates=new Map();let visits=0;
  for(const piece of blockers){const options=[],seen=new Set(),home=landCells(state,'camp').some(c=>key(c)===key([piece.q,piece.r]))?'camp':'river',nearby=new Set(landCells(state,home).map(key)),anchors=allowedCells.slice().sort((a,b)=>distance(a,[piece.q,piece.r])-distance(b,[piece.q,piece.r]));for(const[q,r]of anchors)for(let turn=0;turn<(SIZE[piece.level]===3?6:1);turn++){const rotation=(piece.rotation+turn)%6,cells=cellsOf({...piece,q,r,rotation}),keys=cells.map(key),signature=keys.slice().sort().join('|');if(keys.some(k=>!allowed.has(k)||reserved.has(k))||seen.has(signature))continue;seen.add(signature);options.push({id:piece.id,q,r,rotation,cells,keys,nearby:keys.every(k=>nearby.has(k))});}options.sort((a,b)=>Number(b.nearby)-Number(a.nearby));candidates.set(piece.id,options);}
  function pack(left){if(!left.length)return[];if(++visits>6000)return null;let picked,options;for(const p of left){const free=candidates.get(p.id).filter(o=>o.keys.every(k=>!reserved.has(k)));if(!free.length)return null;if(!options||free.length<options.length){picked=p;options=free;}}for(const option of options){option.keys.forEach(k=>reserved.add(k));const rest=pack(left.filter(p=>p.id!==picked.id));if(rest)return[option,...rest];option.keys.forEach(k=>reserved.delete(k));}return null;}
  const result=pack(blockers);return result?.map(({keys,nearby,...p})=>p)||null;
}
export function placePlan(state,item,q,r,rotation=item.rotation||0,exclude=[item.id]){
  if(!Number.isInteger(q)||!Number.isInteger(r)||!Number.isInteger(rotation)||rotation<0||rotation>5)return{ok:false,message:'请放到六边形空地上。'};
  const cells=cellsOf({...item,q,r,rotation}),allowed=workCells(state),allowedKeys=new Set(allowed.map(key));if(cells.some(c=>!allowedKeys.has(key(c))))return{ok:false,cells,message:'水面、遗址和建筑不能摆放。带浅色格线的草地与道路都可以。'};
  const used=occupancy(state,exclude),ids=new Set(cells.map(c=>used.get(key(c))).filter(Boolean)),blockers=state.items.filter(i=>ids.has(i.id)),reserved=[...occupancy(state,[...exclude,...ids]).keys(),...cells.map(key)],shifted=relocate(state,blockers,allowed,reserved);
  return shifted?{ok:true,q,r,rotation,cells,shifted}:{ok:false,cells,message:'没有足够的连续空地，素材会留在原位。可以先合成，或放到暂放区。'};
}
export function previewMove(state,id,q,r,rotation){const i=state.items.find(i=>i.id===id);if(!i)return{ok:false,message:'这件素材已经用掉了。'};if(isTrial(i))return{ok:false,message:'先从试装位取回，再移动或合成。'};const plan=placePlan(state,i,q,r,rotation??i.rotation);return plan.ok?{...plan,discoveries:discoveriesFor(state,{...i,q:plan.q,r:plan.r,rotation:plan.rotation})}:plan;}
function mergePlan(state,aId,bId){
  if(state.items.some(i=>[aId,bId].includes(i.id)&&isTrial(i)))return{ok:false,message:'先取回试装中的组件，就能继续合成。'};
  const a=state.items.find(i=>i.id===aId),b=state.items.find(i=>i.id===bId);if(!a||!b||a.id===b.id||a.chain!==b.chain||a.level!==b.level)return{ok:false,message:'相同种类、相同等级的两件素材才能合成。'};if(a.level>=CAPS[a.chain])return{ok:false,message:'这是本章的最高等级，可以交付当前修复任务。'};
  const level=a.level+1,preferred=inTray(b)?inTray(a)?OFFSETS[state.region]:[a.q,a.r]:[b.q,b.r],item={id:'merging',chain:a.chain,level,rotation:0};let best=null;
  for(const[q,r]of workCells(state).sort((x,y)=>distance(x,preferred)-distance(y,preferred)))for(let rotation=0;rotation<(SIZE[level]===3?6:1);rotation++){const plan=placePlan(state,item,q,r,rotation,[a.id,b.id]);if(!plan.ok)continue;const score=distance([q,r],preferred)*2+plan.shifted.length*.4+rotation*.02;if(!best||score<best.score)best={...plan,score};if(score===0)return{...best,chain:a.chain,level,grown:SIZE[level]>SIZE[a.level]};}
  return best?{...best,chain:a.chain,level,grown:SIZE[level]>SIZE[a.level]}:{ok:false,message:'组件要展开成三格，需要一块连续空地。两件素材都会保留。'};
}
export function previewMerge(state,aId,bId){const plan=mergePlan(state,aId,bId);return plan.ok?{...plan,discoveries:discoveriesFor(state,{chain:plan.chain,level:plan.level,q:plan.q,r:plan.r,rotation:plan.rotation})}:plan;}
export function previewBuild(state,id,taskId){
  const item=state.items.find(i=>i.id===id),task=taskId?availableTasks(state).find(t=>t.id===taskId):currentTask(state);if(!canBuild(state,item,task))return{ok:false,message:'先合出这次修复需要的材料。'};
  const future=structuredClone(state);progress(future).stage++;if(future.version===8)progress(future).doneIds.push(task.id);future.items=future.items.filter(i=>i.id!==id);const allowed=workCells(future),allowedKeys=new Set(allowed.map(key)),blockers=future.items.filter(i=>cellsOf(i).some(c=>!allowedKeys.has(key(c)))),ids=blockers.map(i=>i.id),shifted=relocate(future,blockers,allowed,[...occupancy(future,ids).keys()]);
  if(!shifted)return{ok:false,message:'扩建处的素材暂时没有地方挪，请先整理出一些空地。'};
  const oldKeys=new Set(workCells(state).map(key)),large=['home','stream','shore','ferry'].includes(task.id),cells=unique([...siteCells(task.site,large),...(task.id==='stream'?[[7,-1]]:[])]);
  return{ok:true,task,cells,shifted,refund:valueOf(item)-valueOf(task),newCells:allowed.filter(c=>!oldKeys.has(key(c))),capacityGain:allowed.length-workCells(state).length};
}
export function nextStep(state){
  if(state.version===7)return Classic.nextStep(state);
  if(regionComplete(state))return{type:progress(state).settled?'done':'finish'};
  const task=currentTask(state),ready=taskItem(state);if(ready)return{type:'build',id:ready.id,task};
  const waiting=state.items.find(i=>isTrial(i)&&state.items.some(j=>!isTrial(j)&&j.chain===i.chain&&j.level===i.level));if(waiting)return{type:'retrieve',id:waiting.id,task};
  const items=state.items.filter(i=>!isTrial(i)).sort((a,b)=>Number(b.chain===task.chain)-Number(a.chain===task.chain)||a.level-b.level);
  let obstructed=false;for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(items[i].chain===items[j].chain&&items[i].level===items[j].level&&items[i].level<CAPS[items[i].chain]){const plan=previewMerge(state,items[i].id,items[j].id);if(plan.ok)return{type:'merge',a:items[i].id,b:items[j].id,task};obstructed=true;}
  if(state.pending.length&&freeCount(state)>0)return{type:'draw',task};
  const other=availableTasks(state).find(t=>t.id!==task.id&&state.items.some(i=>canBuild(state,i,t)));
  if(other)return{type:'focus',task:other};
  if(state.pending.length)return{type:'arrange',task,obstructed:true};
  if(progress(state).opened<progress(state).wins)return{type:'open',task};
  if(progress(state).wins<maxWins(state))return{type:'win',task};
  return{type:'arrange',task,obstructed};
}
export const settlement=state=>({items:[...state.items,...(state.pending||[]).map((i,n)=>({...i,id:'pending-'+n,pending:true}))].map(i=>({id:i.id,chain:i.chain,level:i.level,name:nameOf(i),value:valueOf(i),pending:!!i.pending})),value:[...state.items,...(state.pending||[])].reduce((n,i)=>n+valueOf(i),0)});
const shift=(state,moves)=>{for(const m of moves)Object.assign(state.items.find(i=>i.id===m.id),{q:m.q,r:m.r,rotation:m.rotation});};
function addItem(state,chain,level,region=state.region){const used=occupancy(state),target=[OFFSETS[region][0],OFFSETS[region][1]+1],nearby=workCells(state,region).sort((a,b)=>distance(a,target)-distance(b,target)),localKeys=new Set(nearby.map(key)),available=nearby.concat(workCells(state).filter(c=>!localKeys.has(key(c)))),pos=available.find(c=>!used.has(key(c)));if(!pos)return null;const item={id:`h-${state.nextId++}`,chain,level,q:pos?.[0]??null,r:pos?.[1]??null,rotation:0};state.items.push(item);return item;}
function changeBack(state,chain,value){for(let level=6;level>=1;level--)while(value>=2**(level-1)){if(!addItem(state,chain,level))state.pending.push({chain,level});value-=2**(level-1);}}
const fail=(state,message)=>({ok:false,state,message,events:[]});
export function act(state,action){
  if(state.version===7)return Classic.act(state,action);
  if(action.type==='COLLECT')return collectBox(state,action);
  if(action.type==='TRY'||action.type==='RETRIEVE')return trialAction(state,action);
  const next=structuredClone(state),p=progress(next),events=[];let selected=null;
  if(action.type==='FOCUS'){
    const task=availableTasks(state).find(t=>t.id===action.id);if(!task)return fail(state,'先完成前面的修复，才能开始这里。');p.focusId=task.id;
  }else if(action.type==='EXPLORE'){
    const frontier=frontiers(state).find(f=>f.id===action.id&&!f.unlocked);if(!frontier)return fail(state,'这里已经清理过了。');
    const helper=state.items.find(i=>i.level>=frontier.level&&cellsOf(i).some(c=>distance(c,frontier.cell)===1));
    if(!helper&&!regionComplete(state,frontier.region))return fail(state,`把 L${frontier.level} 或更高的组件移到旁边，就能清出这格空地。组件会保留。`);
    next.explored.push(frontier.id);events.push({type:'explore',title:'清出 1 格空地',message:'素材保留，可以继续合成和交付。',newCells:[frontier.cell]});
  }else if(action.type==='WIN'){
    if(regionComplete(state)||p.wins>=maxWins(state))return fail(state,'本区域的物资已经足够，先完成眼前的修复。');p.wins++;events.push({type:'win',title:`三消胜利 · 第 ${p.wins} 箱物资`,message:'打开物资箱，素材会放到可用空地。'});
  }else if(action.type==='OPEN'){
    if(p.opened>=p.wins)return fail(state,'先完成一局三消，领取下一箱物资。');
    if(next.pending.length)return fail(state,'箱子里还有素材。先领取，或者合成腾出位置。');
    const choices=supplyChoices(state),choice=choices.find(c=>c.chain===action.chain)||(!action.chain?(choices.find(c=>c.chain===currentTask(state)?.chain)||choices[0]):null);
    if(!choice)return fail(state,'这条链的物资已领完，看看其他修复目标。');
    p.opened++;p.openedPacks.push(choice.index);next.pending.push(...choice.pieces);
    events.push({type:'open',title:'物资箱已打开',message:`${choice.pieces.length} 件素材留在箱中。点箱子逐件取出，空地满时先合成。`});
  }else if(action.type==='DRAW'){
    if(!next.pending.length)return fail(state,'箱子已经领空了。');
    const reward=next.pending[0],view=['camp','river'].includes(action.view)&&next.regions[action.view]?action.view:next.region;
    const item=addItem(next,reward.chain,reward.level,view);if(!item)return fail(state,'空地满了。先合成、修复，或把一件素材放入暂存。箱中素材不会丢失。');next.pending.shift();
    const destination=landCells(next,'camp').some(c=>key(c)===key([item.q,item.r]))?'camp':'river',away=destination!==view;if(away)selected=item.id;
    events.push({type:'draw',itemId:item.id,away,title:away?`素材放到${REGION_NAMES[destination]}了`:`收到${nameOf(item)}`,message:away?`${REGION_NAMES[view]}空地已满，已带你找到另一边的空地。`:next.pending.length?`箱中还有 ${next.pending.length} 件，可以继续领取。`:'这一箱领完了。把两件相同素材合在一起。'});
  }else if(action.type==='MERGE'){
    const plan=previewMerge(state,action.a,action.b);if(!plan.ok)return fail(state,plan.message);next.items=next.items.filter(i=>i.id!==action.a&&i.id!==action.b);shift(next,plan.shifted);const i={id:`h-${next.nextId++}`,chain:plan.chain,level:plan.level,q:plan.q,r:plan.r,rotation:plan.rotation};next.items.push(i);const discoveries=discover(next,i);selected=i.id;events.push({discoveries,newCells:discoveries.map(f=>f.cell),type:plan.grown?'growth':'merge',itemId:i.id,title:plan.grown?'组件终于展开成三格':`${nameOf(i)} · L${i.level}`,message:plan.grown?'金色外框内是同一件组件，可以整体拖动和旋转。':canBuild(next,i)?'材料够了，点「查看修复位置」把它送过去。':'底座仍是一格，继续与相同等级素材合成。',shifted:plan.shifted});
  }else if(action.type==='MOVE'||action.type==='ROTATE'||action.type==='RESTORE'){
    const item=next.items.find(i=>i.id===action.id);if(!item)return fail(state,'请选择一件素材。');let plan;
    if(action.type==='ROTATE'){if(SIZE[item.level]!==3)return fail(state,'三格组件才需要旋转。');if(inTray(item)){item.rotation=(item.rotation+1)%6;return{ok:true,state:next,selected:item.id,events:[]};}plan=previewMove(state,item.id,item.q,item.r,(item.rotation+1)%6);}
    else if(action.type==='RESTORE'){if(!inTray(item))return fail(state,'它已经在地图上。');const allowed=workCells(state,action.view&&state.regions[action.view]?action.view:state.region).concat(workCells(state));for(const[q,r]of allowed){for(let rot=0;rot<(SIZE[item.level]===3?6:1);rot++){const candidate=previewMove(state,item.id,q,r,rot);if(candidate.ok){plan=candidate;break;}}if(plan?.ok)break;}}
    else plan=previewMove(state,item.id,action.q,action.r,action.rotation);
    if(!plan?.ok)return fail(state,plan?.message||'暂时放不下，先合成或腾出连续空地。');Object.assign(item,{q:plan.q,r:plan.r,rotation:plan.rotation});shift(next,plan.shifted);const discoveries=discover(next,item);selected=item.id;events.push({discoveries,newCells:discoveries.map(f=>f.cell),type:'move',title:plan.shifted.length?`${plan.shifted.length} 件素材整体让位`:'已放在空地上',message:'营地与河湾的空地共用，切换区域也不会丢失素材。',shifted:plan.shifted});
  }else if(action.type==='STORE'){
    const item=next.items.find(i=>i.id===action.id);if(!item||inTray(item)||isTrial(item))return fail(state,'请选择地图上的素材；试装组件需要先取回。');if(next.items.filter(inTray).length>=next.storeLimit)return fail(state,`暂存 ${next.storeLimit} 格已满。先合成、修复或取回一件素材。`);item.q=null;item.r=null;selected=item.id;events.push({type:'store',title:'素材放进了下方暂放区',message:'点它可以取回，也能直接与地图素材合成或交付。'});
  }else if(action.type==='BUILD'){
    const plan=previewBuild(state,action.id,action.taskId);if(!plan.ok)return fail(state,plan.message);next.items=next.items.filter(i=>i.id!==action.id);p.stage++;p.doneIds.push(plan.task.id);p.focusId=null;shift(next,plan.shifted);if(plan.refund)changeBack(next,plan.task.chain,plan.refund);events.push({type:'build',task:plan.task.id,title:plan.task.result,message:plan.task.reward,newCells:plan.newCells,shifted:plan.shifted,refund:plan.refund});
  }else if(action.type==='FINISH'){
    if(!regionComplete(state)||p.settled)return fail(state,'完成本区域的所有修复后再整理余料。');const report=settlement(state),converted=action.recycle===true?report.items:[];p.settled=true;p.settlement={converted,retainedValue:action.recycle===true?0:report.value};next.supplies+=converted.reduce((n,i)=>n+i.value,0);if(action.recycle===true){next.items=[];next.pending=[];}
    if(next.region==='camp'){next.regions.river=freshRegion();next.region='river';}events.push({type:'finish',title:state.region==='camp'?'沿着旧路，去找水源':'第一段归乡手记完成',message:action.recycle===true?`余料换成 ${report.value} 点旅途补给。空地仍然可以使用。`:`${report.items.length} 件余料留在原位。空地与素材继续共用。`});
  }else return fail(state,'未知操作。');
  return{ok:true,state:next,selected,events};
}
// One user action opens at most one earned box and puts a batch in one region.
// A partial batch keeps the remainder pending; no overflow is hidden in storage.
export function trialAction(state,action){
  const next=structuredClone(state),item=next.items.find(i=>i.id===action.id);
  if(!item)return fail(state,'这件组件已经不在这里了。');
  if(action.type==='TRY'){
    const plan=previewTrial(state,item.id,action.socket);if(!plan.ok)return fail(state,plan.message);
    item.trialOrigin=inTray(item)?null:{q:item.q,r:item.r,rotation:item.rotation};item.trialSocket=plan.socket.id;item.q=null;item.r=null;
    return{ok:true,state:next,selected:item.id,events:[{type:'try',itemId:item.id,socket:plan.socket.id,title:plan.socket.effect,message:'组件保留在蓝色试装位。点它取回，等级不变，不占工作格。'}]};
  }
  if(!isTrial(item))return fail(state,'这件组件没有在试装。');
  const socket=item.trialSocket,original=item.trialOrigin,near=original?[original.q,original.r]:TRIAL_SOCKETS[socket].cell,used=occupancy(next),pos=workCells(next).sort((a,b)=>distance(a,near)-distance(b,near)).find(c=>!used.has(key(c)));
  delete item.trialSocket;delete item.trialOrigin;
  let pending=false;
  if(pos){item.q=pos[0];item.r=pos[1];}
  else if(next.items.filter(i=>i.id!==item.id&&inTray(i)).length>=next.storeLimit){next.items=next.items.filter(i=>i.id!==item.id);next.pending.push({chain:item.chain,level:item.level});pending=true;}
  return{ok:true,state:next,selected:pending?null:item.id,events:[{type:'retrieve',itemId:pending?null:item.id,socket,pending,title:`${nameOf(item)}已取回`,message:pending?'地图和暂存都满了，组件已完整放回物资箱，腾出空地后可领取。':pos?'回到空地上了，等级不变，可以继续合成。':'已放到暂存中，等级不变，可以直接与地图上的素材合成。'}]};
}
export function collectBox(state,{chain,view=state.region}={}){
  if(!state.regions[view])view=state.region;
  const destination=freeCount(state,view)>0?view:['camp','river'].find(r=>state.regions[r]&&freeCount(state,r)>0);
  if(!destination)return fail(state,'空地满了。先合成或暂存一件，箱中的材料会保留。');
  let next=structuredClone(state);
  if(!next.pending.length){const opened=act(next,{type:'OPEN',chain});if(!opened.ok)return fail(state,opened.message);next=opened.state;}
  const total=next.pending.length,limit=Math.min(total,freeCount(next,destination)),ids=[];
  for(let n=0;n<limit;n++){const piece=next.pending.shift(),item=addItem(next,piece.chain,piece.level,destination);ids.push(item.id);}
  const away=destination!==view,remaining=next.pending.length;
  return{ok:true,state:next,selected:away?ids[0]:null,events:[{type:'collect',itemIds:ids,away,destination,remaining,title:remaining?`已取出 ${ids.length} 件，箱中留 ${remaining} 件`:`${ids.length} 件素材已到齐`,message:away?`已放到${REGION_NAMES[destination]}的空地，带你过去看看。`:remaining?'这里的空地放满了。先合成，剩下的材料随时再取。':'把相同素材合起来，看看这箱能合出什么。'}]};
}
export function accounting(state){const supplied={},spent={},converted={};for(const region of ['camp','river']){const p=state.regions[region];if(!p)continue;for(const i of (p.openedPacks?p.openedPacks.map(i=>REWARDS[region][i]):REWARDS[region].slice(0,p.opened)).flat())supplied[i.chain]=(supplied[i.chain]||0)+valueOf(i);for(const t of completedTasks(state,region))spent[t.chain]=(spent[t.chain]||0)+valueOf(t);for(const i of p.settlement?.converted||[])converted[i.chain]=(converted[i.chain]||0)+i.value;}const inventory={};for(const i of [...state.items,...(state.pending||[])])inventory[i.chain]=(inventory[i.chain]||0)+valueOf(i);return{supplied,spent,converted,inventory};}
export function validState(state){
  if(state?.version===7)return Classic.validState(state);
  if(!state||state.version!==8||!['camp','river'].includes(state.region)||!state.regions?.camp||!Array.isArray(state.items)||state.items.length>300||state.items.some(i=>!i||typeof i!=='object')||!Number.isInteger(state.nextId)||state.nextId<1||!Number.isInteger(state.supplies)||state.supplies<0)return false;
  if(!Array.isArray(state.pending)||state.pending.length>300||state.pending.some(i=>!i||!Number.isInteger(i.level)||!NAMES[i.chain]?.[i.level]||i.level>6)||!Array.isArray(state.explored)||new Set(state.explored).size!==state.explored.length||state.explored.some(id=>!FRONTIERS.some(f=>f.id===id))||!Number.isInteger(state.storeLimit)||state.storeLimit<6||state.storeLimit>300||state.items.filter(inTray).length>state.storeLimit)return false;
  for(const region of ['camp','river']){const p=state.regions[region];if(!p){if(region==='camp'||state.region==='river')return false;continue;}if(!Number.isInteger(p.wins)||p.wins<0||p.wins>REWARDS[region].length||!Number.isInteger(p.opened)||p.opened<0||p.opened>p.wins||!Number.isInteger(p.stage)||p.stage<0||p.stage>TASKS[region].length||typeof p.settled!=='boolean'||p.settled&&p.stage!==TASKS[region].length)return false;if(!Array.isArray(p.doneIds)||p.doneIds.length!==p.stage||new Set(p.doneIds).size!==p.doneIds.length||p.doneIds.some((id,n)=>!TASKS[region].some(t=>t.id===id)||!DEPENDENCIES[id].every(dep=>p.doneIds.slice(0,n).includes(dep)))||!Array.isArray(p.openedPacks)||p.openedPacks.length!==p.opened||new Set(p.openedPacks).size!==p.openedPacks.length||p.openedPacks.some(i=>!Number.isInteger(i)||i<0||i>=REWARDS[region].length)||p.focusId!==null&&!availableTasks(state,region).some(t=>t.id===p.focusId))return false;
    if(p.settled){if(!p.settlement||!Array.isArray(p.settlement.converted)||!Number.isInteger(p.settlement.retainedValue)||p.settlement.retainedValue<0||p.settlement.converted.some(i=>!i||!NAMES[i.chain]?.[i.level]||i.value!==valueOf(i)))return false;}else if(p.settlement!==null)return false;}
  if(!!state.regions.river!==state.regions.camp.settled||state.region==='camp'&&state.regions.river)return false;
  if(state.explored.some(id=>{const f=FRONTIERS.find(f=>f.id===id);return !state.regions[f.region]||!f.after.some(t=>taskDone(state,t));}))return false;
  const mounted=new Set();for(const item of state.items){if(isTrial(item)){const socket=trialSockets(state).find(s=>s.id===item.trialSocket),origin=item.trialOrigin;if(!socket||mounted.has(socket.id)||item.q!==null||item.r!==null||item.chain!==socket.chain||item.level<socket.minLevel||item.level>6||origin!==null&&(!origin||!Number.isInteger(origin.q)||!Number.isInteger(origin.r)||!Number.isInteger(origin.rotation)||origin.rotation<0||origin.rotation>5))return false;mounted.add(socket.id);}else if(item.trialSocket!==undefined||item.trialOrigin!==undefined)return false;}
  const allowed=new Set(workCells(state).map(key)),seen=new Set(),ids=new Set();for(const i of state.items){if(typeof i.id!=='string'||!/^h-\d+$/.test(i.id)||Number(i.id.slice(2))>=state.nextId||ids.has(i.id)||!NAMES[i.chain]?.[i.level]||!Number.isInteger(i.level)||!Number.isInteger(i.rotation)||i.rotation<0||i.rotation>5||(i.q===null)!==(i.r===null)||!inTray(i)&&!isTrial(i)&&(!Number.isInteger(i.q)||!Number.isInteger(i.r)))return false;ids.add(i.id);for(const c of cellsOf(i)){const k=key(c);if(!allowed.has(k)||seen.has(k))return false;seen.add(k);}}
  const a=accounting(state);for(const chain of Object.keys(NAMES))if((a.supplied[chain]||0)!==(a.spent[chain]||0)+(a.inventory[chain]||0)+(a.converted[chain]||0))return false;return state.supplies===Object.values(a.converted).reduce((x,y)=>x+y,0);
}
export function demoRiver(){let s=freshGame();for(let n=0;n<200&&!regionComplete(s);n++){const h=nextStep(s);const a=h.type==='win'?{type:'WIN'}:h.type==='open'?{type:'OPEN'}:h.type==='draw'?{type:'DRAW'}:h.type==='focus'?{type:'FOCUS',id:h.task.id}:h.type==='merge'?{type:'MERGE',a:h.a,b:h.b}:{type:'BUILD',id:h.id};const result=act(s,a);if(!result.ok)throw Error(result.message);s=result.state;}return act(s,{type:'FINISH',recycle:false}).state;}
export function demoRiverHandsOn(){
  let s=demoRiver();const step=a=>{const r=act(s,a);if(!r.ok)throw Error(r.message);s=r.state;};
  if(s.pending.length)step({type:'COLLECT',view:'camp'});step({type:'WIN'});step({type:'COLLECT',chain:'water'});
  while(!taskItem(s)){const h=nextStep(s);if(h.type!=='merge')throw Error('Invalid practice recipe');step({type:'MERGE',a:h.a,b:h.b});}
  step({type:'BUILD',id:taskItem(s).id});step({type:'WIN'});step({type:'COLLECT',chain:'water'});
  const thirds=s.items.filter(i=>i.chain==='water'&&i.level===3);step({type:'MERGE',a:thirds[0].id,b:thirds[1].id});
  const pieces=s.items.filter(i=>i.chain==='water').sort((a,b)=>a.level-b.level),positions=[[4,1],[5,0],[6,0],[7,-1]];
  pieces.forEach((piece,i)=>step({type:'MOVE',id:piece.id,q:positions[i][0],r:positions[i][1]}));return s;
}
