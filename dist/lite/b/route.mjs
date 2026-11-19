import {AREA} from '../shared/map.mjs';

// The south bank becomes a second row of work land once the trough is in use.
export const WORK_AREA = {...AREA, creek:[...AREA.creek,[5,1],[6,1]]};
export const REPAIR_CLEARINGS = {
  roof:[[-1,-1],[-2,0]], path:[[3,-1]],
  spring:[[5,-1],[6,-1]], trough:[[5,1],[6,1]],
  reeds:[[9,-3],[10,-4]], pier:[[11,-1],[12,-1],[12,-2]]
};

export const WORK_POCKETS = {
  logs:[[0,0],[1,0],[0,1],[1,-1],[-1,1]],
  spring:[[6,-1],[5,-1],[6,0],[5,0],[5,1],[6,1]],
  reeds:[[10,-3],[11,-3],[9,-2],[9,-3],[10,-4]],
  boat:[[11,-2],[10,-1],[11,-1],[12,-1],[12,-2],[10,-2]]
};

export const ROUTES = [
  {region:'camp',title:'在林间安家',stops:['roof','fire','path','fence','garden','home','feast']},
  {region:'creek',title:'把溪水引回家',stops:['spring','trough','stream','bridge']},
  {region:'river',title:'让渡船靠岸',stops:['cattail','reeds','pier','jetty','shore','ferry']}
];

// These are handoffs between existing projects, not new prerequisites. A
// player-selected open job wins; routes are free to meet in either order.
const AFTER = {
  roof:['fire','path'], fire:['path','fence'], path:['spring','cattail'],
  spring:['trough'], trough:['stream'], stream:['bridge','garden'],
  bridge:['ferry','cattail','reeds','pier','garden'], fence:['garden','home'],
  cattail:['reeds'], reeds:['pier','shore'], pier:['jetty','shore'],
  jetty:['shore','ferry'], shore:['ferry','pier'], ferry:['bridge','spring','trough','stream','home','feast'],
  home:['feast','garden'], garden:['home','feast']
};

export function routeChoices(available, region, previous=null) {
  const jobs=new Map(available.map(r=>[r.id,r]));
  const local=ROUTES.find(row=>row.region===region);
  const order=[...(AFTER[previous]||[]),...(local?.stops||[]),...ROUTES.flatMap(row=>row.stops)];
  return [...new Set(order)].map(id=>jobs.get(id)).filter(Boolean);
}
export const freightOpen = done => done.includes('bridge') && done.includes('ferry');
export function secondWay(available, last, next) {
  if(!['roof','fire','path','stream','reeds'].includes(last))return null;
  return (AFTER[last]||[]).map(id=>available.find(r=>r.id===id)).find(r=>r && r.id!==next?.id) || null;
}
const opensByRepair=new Map(Object.entries(REPAIR_CLEARINGS).flatMap(([id,tiles])=>tiles.map(c=>[c.join(','),id])));
export const yardFor = (done,cell) => done.includes(opensByRepair.get(cell.join(',')));

// Actual plate pixels. The cart crosses the two bridge abutments at (653,397) and (597,450).
export const HAUL_PATH = [[1284,439],[1237,456],[1148,473],[1050,462],[955,432],
  [906,392],[839,363],[744,348],[681,374],[653,397],[625,423.5],[597,450],
  [522,478],[439,487],[366,476],[328,449]];
