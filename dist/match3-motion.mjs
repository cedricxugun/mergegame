// Presentation timing is separate from deterministic rules and saved state.
const motionRow=i=>Math.floor(i/7),motionCol=i=>i%7;
const motionDistance=(a,b)=>Math.hypot(motionRow(a)-motionRow(b),motionCol(a)-motionCol(b));
export function motionColumns(before,frames){
  const columns=new Set();let previous=before;
  for(const frame of frames){if(frame.type==='shuffle')return new Set([0,1,2,3,4,5,6]);for(let i=0;i<56;i++)if(previous.board[i]?.id!==frame.board[i]?.id||previous.crates?.[i]!==frame.crates?.[i]||previous.mud[i]!==frame.mud[i])columns.add(i%7);for(const i of frame.indices||[])columns.add(i%7);for(const h of frame.hits||[])columns.add(h.index%7);if(frame.type==='swap'){columns.add(frame.a%7);columns.add(frame.b%7);}previous=frame;}
  return columns;
}
export function motionInputFits(visual,committed,move,reserved=new Set()){
  if(committed.version!==2||committed.status!=='playing'||!['SWAP','ACTIVATE'].includes(move.type))return false;
  const indices=move.type==='SWAP'?[move.a,move.b]:[move.index];
  return indices.every(i=>Number.isInteger(i)&&i>=0&&i<56&&!reserved.has(i%7)&&visual.board[i]?.id&&visual.board[i]?.id===committed.board[i]?.id);
}
export function motionPlan(frame){
  const powers=frame.activated||[],flights=frame.flights||[],conversions=frame.conversions||[],combo=!!frame.combo;
  const powerTime=new Map(),visiting=new Set(),convertTime=i=>130+motionDistance(powers.find(p=>p.power==='orb')?.index??i,i)*15;
  const flightTiming=n=>{const f=flights[n],start=activationTime(f.from)+75;return{...f,start,duration:330+motionDistance(f.from,f.to)*18};};
  const travel=(power,from,to)=>power==='row'||power==='col'?40+motionDistance(from,to)*21:power==='bomb'?80+Math.max(Math.abs(motionRow(from)-motionRow(to)),Math.abs(motionCol(from)-motionCol(to)))*17:power==='orb'?100+motionDistance(from,to)*18:50;
  function causeTime(cause,index){if(!cause)return combo?125:0;if(cause.kind==='conversion')return convertTime(index)+90;if(cause.kind==='flight'){const f=flightTiming(cause.flight);return f.start+f.duration+(f.payload&&index!==f.to?travel(f.payload,f.to,index):0);}return activationTime(cause.index)+travel(cause.power,cause.index,index);}
  function activationTime(index){if(powerTime.has(index))return powerTime.get(index);if(visiting.has(index))return combo?125:25;visiting.add(index);const p=powers.find(p=>p.index===index),flightIndex=flights.findIndex(f=>f.to===index&&f.payload===p?.power);let time;if(p?.delivered&&flightIndex>=0){const f=flightTiming(flightIndex);time=f.start+f.duration;}else time=causeTime(frame.causes?.[index],index)+(combo?0:35);visiting.delete(index);powerTime.set(index,time);return time;}
  const timing=powers.map(p=>({...p,start:activationTime(p.index)}));
  function hitTime(index){const cause=frame.causes?.[index];if(cause)return causeTime(cause,index);if(!powers.length)return 0;const own=timing.find(p=>p.index===index);if(own)return own.start+60;let times=timing.filter(p=>p.power==='row'&&motionRow(index)===motionRow(p.index)||p.power==='col'&&motionCol(index)===motionCol(p.index)||p.power==='bomb'&&Math.max(Math.abs(motionRow(index)-motionRow(p.index)),Math.abs(motionCol(index)-motionCol(p.index)))<=(p.radius||2)).map(p=>p.start+travel(p.power,p.index,index));if(times.length)return Math.min(...times);return combo?125:0;}
  const hits=(frame.indices||[]).map(index=>({index,at:hitTime(index)})),crateHits=(frame.hits||[]).map(h=>({...h,at:frame.hitCauses?.[h.index]?causeTime(frame.hitCauses[h.index],h.index):hitTime(h.index)}));
  const flightPlans=flights.map((_,n)=>flightTiming(n));
  return{powers:timing,flights:flightPlans,conversions:conversions.map(p=>({...p,at:convertTime(p.index)})),hits,crateHits,impactEnd:Math.max(0,...hits.map(h=>h.at),...crateHits.map(h=>h.at),...flightPlans.map(f=>f.start+f.duration))+100};
}
