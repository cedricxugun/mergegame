import * as R from './rules.mjs';

// Keep the original v2 board, purchases and repairs when upgrading in place.
// Recover work put into the short-lived counter preview if that save is present.
export function recoverHomeland(raw) {
  if(!raw || raw.version!==R.VERSION || !Array.isArray(raw.items) || !Array.isArray(raw.bag))return {state:null};
  if(!Array.isArray(raw.done)||!Array.isArray(raw.orders)||!Array.isArray(raw.orderLog)||!raw.discovered||!raw.stats)return {state:null};
  const preview=Object.hasOwn(raw.discovered,'picnic') || raw.done.includes('harbor-light') || raw.workshop!=null;
  if(!preview&&R.validate(raw))return {state:raw};
  const s=structuredClone(raw);
  let coins=0;
  function keep(i) {
    if(i?.chain!=='picnic')return true;
    coins+=R.sellPrice(i.level);return false;
  }
  s.items=s.items.filter(keep);s.bag=s.bag.filter(keep);
  s.done=s.done.filter(id=>R.repairById(id));
  s.orderLog=s.orderLog.filter(id=>R.orderById(id));
  s.orders=s.orders.filter(o=>R.orderById(o.id));
  delete s.discovered.picnic;
  s.fittings??={};
  for(const [id,part] of Object.entries(s.fittings)) {
    const r=R.repairById(id);
    if(r&&R.repairAvailable(s,r)&&part.chain===r.chain&&[r.level-1,r.level].includes(part.level))continue;
    delete s.fittings[id];
    if(keep(part)){s.bag.push({...part,cell:null});s.bagSize=Math.max(s.bagSize,s.bag.length);}
  }
  s.coins+=coins;
  s.stats.repairs=s.done.length;s.stats.orders=s.orderLog.length;
  delete s.workshop;delete s.parcelsClaimed;delete s.bagBought;
  R.refillOrders(s);
  return R.validate(s)?{state:s,backup:preview,notice:coins?'原家园进度已接续，旧茶点折回 '+coins+' 金币。':''}:{state:null};
}
