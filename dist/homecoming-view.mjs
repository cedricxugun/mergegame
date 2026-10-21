import {NAMES,CAPS,TASKS,key,inTray,valueOf,landCells,progress,currentTask,taskItem,nextStep,previewMerge,completedTasks,isTrial} from './homecoming-play.mjs';

// Presentation uses the same inventory and geography as the game rules.
export function boardRegion(state,item){
  if(isTrial(item))return 'river';
  if(!item||inTray(item))return null;
  return landCells(state,'camp').some(c=>key(c)===key([item.q,item.r]))?'camp':'river';
}
export function materialProgress(state){
  const task=currentTask(state);
  if(!task)return{phase:'done',ratio:1,highest:0,ready:null,owned:0,needed:0};
  const items=state.items.filter(i=>i.chain===task.chain),owned=items.reduce((n,i)=>n+valueOf(i),0),needed=valueOf(task),ready=taskItem(state);
  return{phase:ready?'repair':owned>=needed?'merge':'supply',ratio:Math.min(1,owned/needed),highest:Math.max(0,...items.map(i=>i.level)),ready,owned,needed};
}
export function discoveredLevels(state,previous={}){
  const found=Object.fromEntries(Object.keys(NAMES).map(chain=>[chain,Number.isInteger(previous[chain])?Math.max(0,Math.min(CAPS[chain],previous[chain])):0]));
  for(const i of state.items)found[i.chain]=Math.max(found[i.chain],i.level);
  for(const region of ['camp','river'])for(const t of completedTasks(state,region))found[t.chain]=Math.max(found[t.chain],t.level);
  return found;
}
export function guidedStep(state,selectedId,base=nextStep(state)){
  if(['build','finish','done'].includes(base.type))return base;
  const chosen=state.items.find(i=>i.id===selectedId);
  if(!chosen||chosen.level>=CAPS[chosen.chain])return base;
  const others=state.items.filter(i=>i.id!==chosen.id&&i.chain===chosen.chain&&i.level===chosen.level)
    .sort((a,b)=>Number(boardRegion(state,b)===boardRegion(state,chosen))-Number(boardRegion(state,a)===boardRegion(state,chosen)));
  for(const other of others)if(previewMerge(state,chosen.id,other.id).ok)return{type:'merge',a:chosen.id,b:other.id,task:currentTask(state)};
  return base;
}
