import * as R from './rules.mjs';
import {CHAINS, matName, nameOf} from '../shared/art.mjs';
import {REGIONS, SPOT_REGION} from '../shared/map.mjs';
import {CAST, DIARY, LETTER} from '../shared/chapter.mjs';
import {esc} from '../shared/ui.mjs';
import {icon} from '../shared/icons.mjs';
import {art} from './art.mjs';
import {BENEFITS, CHAIN_SHOP, JOB_NAMES, MOTIVES, WORKSHOPS, WORK_ART} from './story.mjs';

const coin = '<i class="gold-coin" aria-hidden="true">✦</i>';
export const img = (name,cls='',alt='') => `<img class="${cls}" src="${art(name)}" alt="${esc(alt)}" draggable="false">`;
export const portrait = who => img('portrait-'+who,'face',CAST[who].name);
export const piece = (chain,level) => `<span class="piece-pic">${img(matName(chain,level),'',nameOf(chain,level))}<b>${level}</b></span>`;
const reward = o => `<span class="pay">${coin}${o.coins} <i class="tiny-energy">${icon.energy}</i>${o.energy}</span>`;

export function shell() {
  return `<section class="playfield" aria-label="可拖合的家园地图"><div id="world"></div>
    <header class="map-hud"><button class="location" data-open="map" aria-label="切换地区">${icon.map}<span id="region-name"></span><i>⌄</i></button>
      <button class="journey-count" data-open="jobs" aria-label="查看区域修复进度">${icon.lamp}<span id="chapter-number"></span></button></header>
    <div class="map-tools"><button id="bag" class="map-tool" data-open="bag" aria-label="打开背包">${icon.bag}<span>背包</span><b id="bag-num"></b></button>
      <button class="map-tool icon-only" data-open="hint" aria-label="寻找合成搭档">${icon.hint}</button>
      <button class="map-tool icon-only" data-open="journal" aria-label="归乡手记">${icon.book}</button></div>
    <div class="field-message" id="field-message" role="status" aria-live="polite"></div></section>
    <aside class="field-book" aria-label="当前地区的物资和修复"><header class="book-top"><b>归乡手记</b>
      <button class="gear" data-open="settings" aria-label="设置">${icon.gear}</button></header>
      <div class="wallet"><button id="energy" data-open="energy" aria-label="体力补给">${icon.energy}<b id="en"></b><i>+</i></button>
      <div aria-label="金币">${coin}<b id="money"></b></div></div>
      <div id="panel"></div><section id="requests" aria-label="居民委托和故事"></section>
      <div class="field-supplies"><button class="gather" id="gather"></button><button class="shop-more" data-open="shops" aria-label="选择材料来源">⌄</button></div>
      <button class="album-link" data-open="album">${icon.book} 材料图鉴</button></aside>`;
}

export function ordersView(s,r,story) {
  if(story || !s.orders.length){
    const [who,line]=r?MOTIVES[r.id]:['lina','海湾里又有了灯火。'];
    const note=story || {who,text:line};
    return `<button class="map-story" data-open="journal">${img('cast-'+note.who,'story-person')}
      <span><b>${CAST[note.who].name}</b><small>${esc(note.text)}</small></span></button>`;
  }
  return `<div class="orders-heading">居民委托</div><div class="orders-list">${s.orders.map(o=>{
    const t=R.orderById(o.id),ready=!!R.pickForOrder(s,o);
    return `<button class="request-chip ${ready?'ready':''}" data-order="${t.id}" aria-label="${CAST[t.who].name}，${esc(t.text)}">${portrait(t.who)}<span>${t.needs.map(([c,l])=>piece(c,l)).join('')}</span>
      <small>${ready?'交付':coin+t.coins}</small></button>`;}).join('')}</div>`;
}
export function shortage(r,p) {
  if (p.ready) return '材料已齐';
  if (p.staged && p.half) return '另一半到了，可以合拢';
  if (p.staged) return '已试装一半 · 再做一件 L'+(r.level-1);
  if (!p.missing) return '材料够了，合成即可';
  if (!p.highest) return '先到'+WORKSHOPS[CHAIN_SHOP[r.chain]]+'采集材料';
  const step=Math.log2(p.missing);
  if(Number.isInteger(step))return '还差 1 件'+nameOf(r.chain,step+1);
  const next=nameOf(r.chain,p.nextLevel);
  if(!p.nextGap)return '现在可以合出'+next;
  return '再攒 '+p.nextGap+' 份基础料可合出'+next;
}
export function bar(progress) {
  return `<span class="meter"><i style="width:${Math.round(100*progress.total/progress.need)}%"></i></span>`;
}
export function repairPanel(s,r) {
  if(!r)return `<div class="epilogue">${img('scene-ferry')}<span><strong>家园重建完成</strong><small>已修好的空地仍可摆放和合成</small></span><button data-open="journal">看手记</button></div>`;
  const p=R.progressFor(s,r);
  const action=p.ready?'修复':p.staged&&p.half?'合拢':p.half&&r.level>=5&&!p.staged?'试装':'查看';
  return `<div class="repair-head"><b>${icon.lamp} 当前修复</b><button data-open="jobs">${R.availableRepairs(s).length>1?'换个目标':'重建进度'} ›</button></div>
    <div class="repair-main">${piece(r.chain,r.level)}<div class="repair-copy"><h2>${JOB_NAMES[r.id]}</h2>
    <div class="progress-line">${bar(p)}<small>${p.total}/${p.need}</small></div><p>${shortage(r,p)}</p></div>
    <button class="job-act ${p.ready?'bright':''}" data-job-act="${r.id}">${action}</button></div>
    <div class="benefit">${icon.lamp}<span>修好后</span>${BENEFITS[r.id]}${p.staged?`<button class="take-back" data-retrieve="${r.id}">取回试装件</button>`:''}</div>`;
}
export function itemPanel(s,i) {
  const source=CHAIN_SHOP[i.chain];
  const jobs=R.availableRepairs(s).filter(r=>r.chain===i.chain);
  const ready=jobs.find(r=>r.level===i.level);
  const trial=jobs.find(r=>r.level>=5 && r.level-1===i.level && !R.progressFor(s,r).ready);
  const job=ready||trial;
  const store=`<button class="job-act" data-store="${i.id}">入包</button>`;
  const action=ready?`<button class="job-act bright" data-item-repair="${ready.id}">送工地</button>`:
    trial?`<button class="job-act" data-item-fit="${trial.id}">试装</button>`:store;
  const use=job?REGIONS[SPOT_REGION[job.spot]].short+' · '+JOB_NAMES[job.id]:i.level===7?'最高级 · 可整件移动':'拖到同级素材上升级';
  return `<div class="repair-head"><b>${CHAINS[i.chain].label} · L${i.level}${R.occupiedCells(i).length>1?' · 三格组件':''}</b><button data-open="deselect" aria-label="取消选择">收起详情 ×</button></div>
    <div class="repair-main inspect">${piece(i.chain,i.level)}<div class="repair-copy"><h2>${nameOf(i.chain,i.level)}</h2>
    <button class="text-action" data-chain="${i.chain}">${WORKSHOPS[source]}产出 · 查看合成链 ›</button></div>
    ${action}</div>
    <div class="inspect-foot"><span>${use}</span>${job?`<button data-store="${i.id}">入包</button>`:''}<button data-sell="${i.id}">出售 ${coin}${R.sellPrice(i.level)}</button></div>`;
}
export function gatherView(s,id) {
  const g=R.GENERATORS[id], upgraded=R.generatorBetter(s,id);
  return `${img(id==='logs'&&upgraded?'sawmill':WORK_ART[id],'shop-pic')}
    <span><b>${WORKSHOPS[id]} · 取料</b><small>${CHAINS[g.chain].label}材料${upgraded?' · 已升级':''}</small></span><i>${icon.energy}1</i>`;
}
export function jobsView(s,tracked) {
  const list=R.availableRepairs(s);
  return `<p class="sheet-intro">已修复 ${s.done.length} / ${R.REPAIRS.length} 处</p>${list.map(r=>{
    const p=R.progressFor(s,r);
    return `<button class="choice" data-pick="${r.id}">${piece(r.chain,r.level)}<span><b>${JOB_NAMES[r.id]}${r.id===tracked?' · 追踪中':''}</b><small>${REGIONS[SPOT_REGION[r.spot]].short} · ${shortage(r,p)}</small><em>${BENEFITS[r.id]}</em></span><i>›</i></button>`;}).join('') || '<p>渡口和营地的灯都亮了。</p>'}`;
}
export function jobDetail(s,r) {
  const p=R.progressFor(s,r),[who,quote]=MOTIVES[r.id];
  return `<div class="note-person">${portrait(who)}<div><b>${CAST[who].name}</b><p>${quote}</p></div></div>
    <div class="detail-piece">${piece(r.chain,r.level)}<span><b>${nameOf(r.chain,r.level)} · L${r.level}</b><small>${shortage(r,p)}</small></span></div>
    ${bar(p)}<p class="reward-strip">修好后 · ${BENEFITS[r.id]}</p>
    ${r.level>=5?`<div class="fitting-slot">${img(matName(r.chain,r.level-1))}<div><b>${p.staged?'已在工地：'+nameOf(p.staged.chain,p.staged.level):'试装位'}</b><small>${p.staged?'可取回，或送来另一件合拢':'可先放一件 L'+(r.level-1)+'，腾出工作格'}</small></div></div>`:''}`;
}
export function orderDetail(s,o) {
  const t=R.orderById(o.id);
  return `<div class="note-person">${portrait(t.who)}<div><b>${CAST[t.who].name}</b><p>${esc(t.text)}</p></div></div>
    <div class="order-parts">${t.needs.map(([c,l])=>`<button data-pick="chain-${c}">${piece(c,l)}<small>${nameOf(c,l)} · L${l}</small></button>`).join('')}</div>
    <div class="reward-strip">交付可得 ${reward(t)} ${t.diary&&!s.diary.includes(t.diary)?' · 手记一页':''}</div>`;
}
export function journalView(s,tab) {
  const done=[...s.done].reverse().map(R.repairById).filter(Boolean);
  const tabs=`<div class="sheet-tabs"><button data-pick="story" class="${tab==='story'?'on':''}">归乡故事</button><button data-pick="pages" class="${tab==='pages'?'on':''}">外婆的手记 ${s.diary.length}/8</button></div>`;
  if(tab==='pages')return tabs+`<div class="diary-pages">${DIARY.map((v,n)=>s.diary.includes(n)?`<article><b>第 ${n+1} 页</b><p>${esc(v)}</p></article>`:`<div class="missing-page">${n+1} · 尚未找回</div>`).join('')}</div>`;
  const cover=s.done.includes('ferry')?'ferry-letter':s.done.includes('roof')?'camp-reunion':'river-postcard';
  return img(cover,'journal-cover','归乡相册')+tabs+
    (s.done.includes('ferry')?`<article class="letter-note"><b>${LETTER.to} · 妈妈的来信</b><p>${LETTER.text}</p></article>`:'')+
    done.map(r=>`<details class="memory"><summary>${JOB_NAMES[r.id]}</summary>${r.id==='roof'?img('camp-reunion','journal-cover'):r.id==='ferry'?img('ferry-letter','journal-cover'):''}${r.lines.map(([who,line])=>`<p><b>${CAST[who].name}</b>　${esc(line)}</p>`).join('')}</details>`).join('')+
    `<article class="letter-note"><b>回家的那天</b><p>风暴冲断了渡口。米拉和莉娜回到西岸，只找到外婆的旧灯。先修好屋顶，留一盏灯等她回来。</p></article>`;
}
export function chainView(s,c) {
  const source=CHAIN_SHOP[c];
  return `<div class="detail-piece">${img(WORK_ART[source])}<span><b>由${WORKSHOPS[source]}产出</b><small>${c==='dock'||c==='water'?'大修就绪时，L6 构件占三格':'相同两件合成下一级 · L7 占三格'}</small></span></div>
    <div class="chain-list">${CHAINS[c].names.map((name,n)=>{
      const known=n+1<=s.discovered[c];
      const count=[...s.bag,...s.items,...Object.values(s.fittings||{})].filter(i=>i.chain===c&&i.level===n+1).length;
      return `<div class="chain-row ${known?'':'undiscovered'}">${img(matName(c,n+1))}<b>L${n+1}</b><span>${known?name:'未发现'}</span><small>${count?'持有 '+count:''}</small></div>`;}).join('')}</div>`;
}
export function bagView(s) {
  return `<p class="sheet-intro">${s.bag.length} / ${s.bagSize} 格 · 点素材放回当前地区</p><div class="bag-grid">${Array.from({length:s.bagSize},(_,n)=>{
    const i=s.bag[n]; return i?`<button data-pick="${i.id}">${piece(i.chain,i.level)}<small>${nameOf(i.chain,i.level)}</small></button>`:'<span class="empty-slot">空格</span>';}).join('')}</div>`;
}
