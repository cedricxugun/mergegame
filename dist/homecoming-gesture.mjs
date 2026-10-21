import {act,isTrial} from './homecoming-play.mjs';

// A held gesture works on a draft. Only releasing commits it to the journey;
// cancellation restores the starting snapshot, including discoveries and moves.
export function beginMergeGesture(state,id){
  const item=state.items.find(i=>i.id===id);if(!item||isTrial(item))return null;
  return{base:state,draft:structuredClone(state),id,steps:0,events:[]};
}
export function extendMergeGesture(gesture,targetId){
  if(!gesture||gesture.id===targetId)return{ok:false,gesture,message:'请选择另一件同级素材。'};
  const result=act(gesture.draft,{type:'MERGE',a:gesture.id,b:targetId});
  return result.ok?{ok:true,gesture:{...gesture,draft:result.state,id:result.selected,steps:gesture.steps+1,events:[...gesture.events,...result.events]}}:{ok:false,gesture,message:result.message};
}
export function finishMergeGesture(gesture,action){
  if(!gesture)return null;let draft=gesture.draft,events=gesture.events,selected=gesture.id;
  if(action){const result=act(draft,{...action,id:gesture.id});if(!result.ok)return{ok:false,state:draft,selected,events,message:result.message};draft=result.state;selected=result.selected;events=[...events,...result.events];}
  return{ok:true,state:draft,selected,events};
}
export const cancelMergeGesture=gesture=>gesture?.base;
