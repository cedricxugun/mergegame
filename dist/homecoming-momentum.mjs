import {NAMES,CAPS,REWARDS,currentTask,progress,valueOf,nameOf,canBuild} from './homecoming-play.mjs';

export const CHAIN_LABELS={wood:'木工材料',water:'引水材料',reed:'护岸材料',dock:'栈桥材料'};
const material=(chain,level)=>({chain,level});
// Forecasts use earned inventory (including the box) and the actual remaining
// packs. They never count another chain or assume a win has already happened.
export function mergeMilestone(state,task=currentTask(state)){
  if(!task||state.version!==8)return null;
  const chain=task.chain,items=state.items.filter(i=>i.chain===chain),pending=state.pending.filter(i=>i.chain===chain),p=progress(state);
  const owned=items.reduce((n,i)=>n+valueOf(i),0),boxed=pending.reduce((n,i)=>n+valueOf(i),0),total=owned+boxed;
  const packs=REWARDS[state.region].filter((pack,index)=>!p.openedPacks.includes(index)&&pack[0].chain===chain),nextValue=packs[0]?.reduce((n,i)=>n+valueOf(i),0)||0;
  const highest=Math.max(0,...items.map(i=>i.level)),possible=total?Math.floor(Math.log2(total))+1:0;
  const level=Math.min(task.level,Math.max(2,highest+1,possible,total?0:nextValue?Math.floor(Math.log2(nextValue))+1:2));
  const target=material(chain,level),half=material(chain,level-1),needed=valueOf(target),halfValue=valueOf(half),missing=Math.max(0,needed-total);
  function packsFor(value){let sum=total;if(sum>=value)return 0;for(let n=0;n<packs.length;n++){sum+=packs[n].reduce((v,i)=>v+valueOf(i),0);if(sum>=value)return n+1;}return null;}
  const packsNeeded=packsFor(needed),taskPacks=packsFor(valueOf(task)),tickets=p.wins-p.opened;
  return{task,target,half,level,highest,owned,boxed,total,needed,missing,nextValue,tickets,packsNeeded,taskPacks,winsNeeded:packsNeeded===null?null:Math.max(0,packsNeeded-tickets),ready:items.find(i=>canBuild(state,i,task))||null,halves:[Math.min(1,total/halfValue),Math.max(0,Math.min(1,(total-halfValue)/halfValue))],afterBoxLevel:nextValue?Math.min(CAPS[chain],Math.floor(Math.log2(total+nextValue))+1):possible};
}
export function milestoneCopy(m){
  if(!m)return null;
  const target=nameOf(m.target),half=nameOf(m.half),label=CHAIN_LABELS[m.task.chain];
  let headline=m.total===0?`先合出两份${half}`:m.missing===0?`${target}的材料齐了`:m.halves[0]<1?`先备齐第一份${half}`:m.halves[1]===0?`再备一份${half}`:`另一份${half}已备齐 ${Math.floor(m.halves[1]*100)}%`;
  let forecast;
  if(m.ready)forecast='组件已经合好，可以送去修复。';
  else if(m.missing===0&&m.level===7)forecast=m.boxed?'领取箱中材料，留出连续三格再合成。':'原料齐了，留出连续三格，合出完整组件。';
  else if(m.missing===0)forecast=m.boxed?'箱中还有材料，一键领取后继续合成。':'把同级素材合起来，就能得到这件组件。';
  else if(m.packsNeeded===1)forecast=`${m.tickets?'现有箱子选':'下一箱选'}${label}，就能凑齐${target}。`;
  else if(m.nextValue&&m.afterBoxLevel>m.highest)forecast=`下一箱${label}可备齐${nameOf(material(m.task.chain,m.afterBoxLevel))}。`;
  else if(m.nextValue)forecast=`下一箱补齐另一份${half}的 ${Math.max(0,Math.min(100,Math.floor((m.total+m.nextValue-m.needed/2)/(m.needed/2)*100)))}% 原料。`;
  else forecast='这条链的物资已领完，看看箱中和暂存里的材料。';
  if(m.ready)headline=`${nameOf(m.ready)}合好了`;
  const badge=m.ready?'可以修复':m.missing===0?'现在就能合':m.packsNeeded===1?(m.winsNeeded===0?'已有箱子够了':'再赢 1 局'):m.taskPacks===1?'离修复只差 1 箱':`下一件 · L${m.level}`;
  return{headline,forecast,badge,goalName:target};
}
