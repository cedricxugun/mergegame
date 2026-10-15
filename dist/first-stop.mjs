export const SAVE_KEY='forest-camp.first-stop.v1';
export const SIZE={1:1,2:1,3:1,4:3};
export const NAMES={forest:['','树种','树苗','小树','树丛'],camp:['','材料包','帐篷组件','小帐篷']};
export const INITIAL_WORK=[[-1,1],[0,1],[0,0],[-1,0],[-2,1],[-2,2],[-1,2]];
export const EXTRA_WORK=[[1,0],[1,1]];
export const PATH_CELLS=[[0,-1],[1,-1]];
export const TASKS=[
  {id:'forest',title:'给营地留一片树荫',short:'种下树丛',need:'树丛',chain:'forest',level:4,q:-1,r:-2,description:'把两棵小树合成树丛，再种到这里。',reward:'树荫连成片 · 打开 2 格空地'},
  {id:'camp',title:'在树荫旁搭起帐篷',short:'搭起帐篷',need:'小帐篷',chain:'camp',level:3,q:1,r:-2,description:'合成一顶帐篷，让旅人有地方歇脚。',reward:'小路接通 · 旅人入住'}
];
export const key=cell=>cell.join(',');
export const nameOf=item=>NAMES[item.chain]?.[item.level]||'素材';
export const valueOf=item=>2**(item.level-1);
export const inTray=item=>item.q===null;
export const distance=(a,b)=>Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[0]+a[1]-b[0]-b[1]));
export function shape(level,rotation=0){let cells=SIZE[level]===3?[[0,0],[1,0],[0,1]]:[[0,0]];for(let i=0;i<rotation;i++)cells=cells.map(([q,r])=>[-r,q+r]);return cells;}
export function cellsOf(item){return inTray(item)?[]:shape(item.level,item.rotation||0).map(([q,r])=>[q+item.q,r+item.r]);}
export function boundary(cells){
  const edges=new Map(),vertices=new Map();const vk=p=>p.map(v=>Math.round(v*1e6)).join(',');
  for(const [q,r]of cells){const cx=Math.sqrt(3)*(q+r/2),cy=1.5*r,points=Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return [cx+Math.cos(a),cy+Math.sin(a)];});for(let i=0;i<6;i++){const a=points[i],b=points[(i+1)%6],ak=vk(a),bk=vk(b),k=[ak,bk].sort().join('|');vertices.set(ak,a);vertices.set(bk,b);if(edges.has(k))edges.delete(k);else edges.set(k,[ak,bk]);}}
  const outgoing=new Map([...edges.values()]),loops=[];while(outgoing.size){const start=outgoing.keys().next().value,loop=[];let current=start;do{loop.push(vertices.get(current));const next=outgoing.get(current);outgoing.delete(current);current=next;}while(current&&current!==start&&loop.length<200);if(current!==start)throw Error('Open hex boundary');loops.push(loop);}return loops;
}
export function freshGame(){return {version:1,wins:0,opened:false,nextId:1,items:[],built:{forest:false,camp:false},growthSeen:false,pathConnected:false,departed:false,route:null,supplies:0,settlement:null};}
export function workCells(state){return [...INITIAL_WORK,...(state.built.forest?EXTRA_WORK:[])].map(c=>[...c]);}
export function sceneCells(state){return TASKS.filter(t=>state.built[t.id]).flatMap(t=>cellsOf({...t,rotation:0})).concat(state.built.camp?PATH_CELLS:[]);}
export function currentTask(state){return TASKS.find(t=>!state.built[t.id])||null;}
export function taskItem(state,task=currentTask(state)){return task?state.items.find(item=>item.chain===task.chain&&item.level===task.level)||null:null;}
export const complete=state=>state.built.forest&&state.built.camp&&state.pathConnected;
export function occupancy(state,exclude=[]){const map=new Map();for(const item of state.items)if(!exclude.includes(item.id))for(const c of cellsOf(item))map.set(key(c),item.id);return map;}
export function totalValue(state){return state.items.reduce((n,i)=>n+valueOf(i),0)+(state.built.forest?8:0)+(state.built.camp?4:0)+state.supplies;}
export function placePlan(state,item,q,r,rotation=item.rotation,exclude=[item.id]){
  if(!Number.isInteger(q)||!Number.isInteger(r)||!Number.isInteger(rotation)||rotation<0||rotation>5)return {ok:false,message:'请放在六边形地格上。'};
  const cells=cellsOf({...item,q,r,rotation}),allowed=new Set(workCells(state).map(key));
  if(cells.some(c=>!allowed.has(key(c))))return {ok:false,cells,message:'这里是景观或雾区。请放到米色工作格，建造请拖到蓝图。'};
  const used=occupancy(state,exclude),ids=new Set(cells.map(c=>used.get(key(c))).filter(Boolean)),blockers=state.items.filter(i=>ids.has(i.id));
  const reserved=new Set([...occupancy(state,[...exclude,...ids]).keys(),...cells.map(key)]);
  const candidates=new Map();
  for(const blocker of blockers){const options=[],seen=new Set();const anchors=workCells(state).sort((a,b)=>distance(a,[blocker.q,blocker.r])-distance(b,[blocker.q,blocker.r]));for(let turn=0;turn<(SIZE[blocker.level]===3?6:1);turn++)for(const [x,y]of anchors){const rot=(blocker.rotation+turn)%6,cs=cellsOf({...blocker,q:x,r:y,rotation:rot}),keys=cs.map(key),signature=keys.slice().sort().join('|');if(keys.some(k=>!allowed.has(k)||reserved.has(k))||seen.has(signature))continue;seen.add(signature);options.push({id:blocker.id,q:x,r:y,rotation:rot,cells:cs,keys});}candidates.set(blocker.id,options);}
  let visits=0;
  function pack(remaining){if(!remaining.length)return [];if(++visits>4000)return null;let picked,options;for(const b of remaining){const free=candidates.get(b.id).filter(p=>p.keys.every(k=>!reserved.has(k)));if(!free.length)return null;if(!options||free.length<options.length){picked=b;options=free;}}for(const p of options){p.keys.forEach(k=>reserved.add(k));const tail=pack(remaining.filter(b=>b.id!==picked.id));if(tail)return [p,...tail];p.keys.forEach(k=>reserved.delete(k));}return null;}
  const shifted=pack(blockers);if(!shifted)return {ok:false,cells,message:'这里没有足够的连续空地，松手会回到原位。'};
  return {ok:true,q,r,rotation,cells,shifted:shifted.map(({keys,...p})=>p)};
}
export function previewMove(state,id,q,r,rotation){const item=state.items.find(i=>i.id===id);return item?placePlan(state,item,q,r,rotation??item.rotation):{ok:false,message:'已建景观会留在原地。'};}
export function previewMerge(state,aId,bId){
  const a=state.items.find(i=>i.id===aId),b=state.items.find(i=>i.id===bId);
  if(!a||!b||a.id===b.id||a.chain!==b.chain||a.level!==b.level)return {ok:false,message:'把两件相同种类、相同等级的素材合在一起。'};
  const cap=a.chain==='forest'?4:3;if(a.level>=cap)return {ok:false,message:'它已经可以建造了，看看地图上的蓝图。'};
  const newItem={chain:a.chain,level:a.level+1,rotation:b.rotation,id:'merging'},preferred=inTray(b)?(inTray(a)?[-1,1]:[a.q,a.r]):[b.q,b.r];
  const anchors=workCells(state).sort((x,y)=>distance(x,preferred)-distance(y,preferred));let best=null;
  for(const [q,r]of anchors)for(let rot=0;rot<(SIZE[newItem.level]===3?6:1);rot++){const plan=placePlan(state,newItem,q,r,rot,[a.id,b.id]);if(!plan.ok)continue;const score=distance([q,r],preferred)*2+plan.shifted.length*.3+rot*.03;if(!best||score<best.score)best={...plan,score};}
  return best?{...best,chain:a.chain,level:newItem.level,grown:SIZE[newItem.level]>SIZE[a.level]}:{ok:false,message:'展开需要连续三格。先移动素材腾出空间，两件素材都会保留。'};
}
export function nextStep(state){
  if(state.departed)return {type:'done'};
  if(complete(state))return {type:'settlement'};
  if(!state.wins)return {type:'win'};
  if(!state.opened)return {type:'open'};
  const task=currentTask(state),ready=taskItem(state,task);if(ready)return {type:'build',id:ready.id,task};
  const items=state.items.filter(i=>i.chain===task.chain);for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(items[i].level===items[j].level&&previewMerge(state,items[i].id,items[j].id).ok)return {type:'merge',a:items[i].id,b:items[j].id,task};
  return {type:'arrange',task};
}
export function settlement(state){const items=state.items.map(i=>({chain:i.chain,level:i.level,name:nameOf(i),value:valueOf(i)}));return {items,value:items.reduce((n,i)=>n+i.value,0)};}
const fail=(state,message)=>({ok:false,state,message,events:[]});
export function act(state,action){
  if(state.departed)return fail(state,'这一站已完成，可以回看景色或重新体验。');
  const next=structuredClone(state),events=[];let selected=null;
  if(action.type==='WIN'){
    if(next.wins)return fail(state,'这一箱就够建完营地，先把它带来的素材用起来。');next.wins=1;events.push({type:'win',title:'三消胜利！',message:'这一箱物资，就能建成你的第一站。'});
  }else if(action.type==='OPEN'){
    if(!next.wins||next.opened)return fail(state,'物资箱已经开启，素材都在地图上。');next.opened=true;
    const contents=[['forest',3,-2,1],['forest',3,-1,0],['camp',2,0,0],['camp',2,0,1],['forest',1,-2,2]];
    for(const [chain,level,q,r]of contents)next.items.push({id:`piece-${next.nextId++}`,chain,level,q,r,rotation:0});events.push({type:'open',title:'一箱，五件素材',message:'两棵小树合成树丛，底座会展开成三格。'});
  }else if(action.type==='MERGE'){
    const plan=previewMerge(state,action.a,action.b);if(!plan.ok)return fail(state,plan.message);
    next.items=next.items.filter(i=>i.id!==action.a&&i.id!==action.b);for(const move of plan.shifted)Object.assign(next.items.find(i=>i.id===move.id),{q:move.q,r:move.r,rotation:move.rotation});
    const item={id:`piece-${next.nextId++}`,chain:plan.chain,level:plan.level,q:plan.q,r:plan.r,rotation:plan.rotation};next.items.push(item);selected=item.id;if(plan.grown)next.growthSeen=true;
    events.push({type:plan.grown?'growth':'merge',itemId:item.id,title:plan.grown?'两棵小树，长成三格树丛':`合成了${nameOf(item)}`,message:plan.grown?'完整金色外框内的三格，是同一件素材。':'小帐篷准备好了，点地图蓝图看看位置。',shifted:plan.shifted});
  }else if(action.type==='MOVE'){
    const plan=previewMove(state,action.id,action.q,action.r,action.rotation);if(!plan.ok)return fail(state,plan.message);Object.assign(next.items.find(i=>i.id===action.id),{q:plan.q,r:plan.r,rotation:plan.rotation});for(const m of plan.shifted)Object.assign(next.items.find(i=>i.id===m.id),{q:m.q,r:m.r,rotation:m.rotation});selected=action.id;events.push({type:'move',shifted:plan.shifted,title:plan.shifted.length?`${plan.shifted.length} 件素材自动让位`:'已放到这里'});
  }else if(action.type==='ROTATE'){
    const item=next.items.find(i=>i.id===action.id);if(!item||SIZE[item.level]!==3)return fail(state,'选择三格树丛再旋转。');if(inTray(item))item.rotation=(item.rotation+1)%6;else{const plan=previewMove(state,item.id,item.q,item.r,(item.rotation+1)%6);if(!plan.ok)return fail(state,plan.message);item.rotation=plan.rotation;for(const m of plan.shifted)Object.assign(next.items.find(i=>i.id===m.id),{q:m.q,r:m.r,rotation:m.rotation});}selected=item.id;
  }else if(action.type==='STORE'){
    const item=next.items.find(i=>i.id===action.id);if(!item||inTray(item))return fail(state,'选择地图上的素材。');item.q=null;item.r=null;selected=item.id;events.push({type:'store',title:'放到暂放区了',message:'素材仍可合成、交付，也能随时放回。'});
  }else if(action.type==='RESTORE'){
    const item=next.items.find(i=>i.id===action.id);if(!item||!inTray(item))return fail(state,'这件素材已经在地图上。');let plan;for(const [q,r]of workCells(state)){plan=previewMove(state,item.id,q,r);if(plan.ok)break;}if(!plan?.ok)return fail(state,'先合成腾出位置。');Object.assign(item,{q:plan.q,r:plan.r,rotation:plan.rotation});for(const m of plan.shifted)Object.assign(next.items.find(i=>i.id===m.id),{q:m.q,r:m.r,rotation:m.rotation});selected=item.id;
  }else if(action.type==='BUILD'){
    const task=currentTask(state),item=state.items.find(i=>i.id===action.id);if(!task||!item||item.chain!==task.chain||item.level!==task.level)return fail(state,'先合出当前蓝图需要的素材。');next.items=next.items.filter(i=>i.id!==item.id);next.built[task.id]=true;if(task.id==='camp')next.pathConnected=true;
    events.push({type:'build',task:task.id,title:task.id==='forest'?'树荫长成了，空地也打开了':'小路接通，第一位旅人来了',message:task.reward,newCells:task.id==='forest'?EXTRA_WORK:[]});
  }else if(action.type==='DEPART'){
    if(!complete(state))return fail(state,'先把树丛与帐篷建好。');if(!['river','mountain'].includes(action.route))return fail(state,'选择河湾或山坡作为下一站。');next.settlement=settlement(state);next.supplies+=next.settlement.value;next.items=[];next.departed=true;next.route=action.route;events.push({type:'depart',title:'第一站已收入旅途相册',message:`剩余素材变为 ${next.settlement.value} 点旅行补给。`});
  }else return fail(state,'未知操作。');
  return {ok:true,state:next,selected,events};
}
export function validState(state){
  if(!state||state.version!==1||![0,1].includes(state.wins)||typeof state.opened!=='boolean'||!Array.isArray(state.items)||state.items.length>12||!state.built||!['forest','camp'].every(k=>typeof state.built[k]==='boolean')||!Number.isInteger(state.nextId)||state.nextId<1||!Number.isInteger(state.supplies)||state.supplies<0||typeof state.departed!=='boolean'||typeof state.pathConnected!=='boolean'||typeof state.growthSeen!=='boolean')return false;
  if(state.built.camp&&!state.built.forest||state.pathConnected!==state.built.camp||state.opened&&!state.wins||!state.opened&&(state.items.length||state.built.forest))return false;
  const allowed=new Set(workCells(state).map(key)),seen=new Set(),ids=new Set();for(const item of state.items){if(typeof item.id!=='string'||ids.has(item.id)||!NAMES[item.chain]?.[item.level]||!Number.isInteger(item.rotation)||item.rotation<0||item.rotation>5||(item.q===null)!==(item.r===null))return false;ids.add(item.id);if(!inTray(item)&&(!Number.isInteger(item.q)||!Number.isInteger(item.r)))return false;for(const c of cellsOf(item)){const k=key(c);if(!allowed.has(k)||seen.has(k))return false;seen.add(k);}}
  if(state.opened&&totalValue(state)!==13)return false;
  if(state.departed&&(!complete(state)||state.items.length||!['river','mountain'].includes(state.route)))return false;return true;
}
