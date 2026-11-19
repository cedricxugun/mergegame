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
const reward = o => `<span class="pay">${coin}${o.coins} 金币　<i class="tiny-energy">${icon.energy}</i>${o.energy} 体力</span>`;
const countedNames={wood:['块木片','捆木料','块防雨补片'],dock:['根木条','块木板','组栈道板','根基础桩'],water:['滴水','只集水碗','个净水罐'],reed:['株芦芽','株幼苗','束芦苇']};
const quantity=(chain,level,count)=>count+(countedNames[chain]?.[level-1]||('件'+nameOf(chain,level)));

export function shell() {
  return `<section class="playfield" aria-label="可拖合的家园地图">
    <div id="world"></div>
    <header class="map-hud">
      <button class="location" data-open="map" aria-label="切换地区">${icon.map}<span id="region-name"></span></button>
      <button class="low-energy" id="energy" data-open="energy" aria-label="体力补给" hidden>${icon.energy}<b id="en"></b></button>
    </header>
    <aside class="work-note" id="panel" aria-label="当前工地"></aside>
    <nav class="map-tools" aria-label="随身物品">
      <button class="map-tool" id="notebook" data-open="notebook">${icon.book}<span>手记</span></button>
      <button class="map-tool" id="bag" data-open="bag" aria-label="打开背包" hidden>${icon.bag}<span>背包</span><b id="bag-num"></b></button>
    </nav>
    <aside class="selection" id="selection" aria-label="所选材料" hidden></aside>
    <div class="field-message" id="field-message" role="status" aria-live="polite"></div>
  </section>`;
}

export function notebookView(s) {
  const entry=(key,mark,label,note='')=>`<button data-pick="${key}">${mark}<span>${label}</span><small>${note}</small></button>`;
  return `<div class="book-index">
    ${entry('jobs',icon.lamp,'修复计划',s.done.length+' / '+R.REPAIRS.length)}
    ${entry('story',icon.book,'归乡故事','手记 '+s.diary.length+' / '+DIARY.length)}
    ${entry('bag',icon.bag,'背包',s.bag.length+' / '+s.bagSize)}
    ${s.orders.length||s.orderLog.length?entry('orders',icon.lamp,'居民来信','选做'):''}
  </div><div class="book-footer"><button data-pick="energy" aria-label="查看体力和金币">${icon.energy} ${s.energy}/${s.maxEnergy}　${coin} ${s.coins}</button>
    <button data-pick="settings">${icon.gear} 设置</button></div>`;
}

export function orderResult(s,t) {
  return t.keepsake || (t.diary && !s.diary.includes(t.diary) ? '找回一页外婆的手记' : '');
}
export function ordersView(s,repair) {
  const entries=s.orders.map(o=>({o,t:R.orderById(o.id),impact:R.orderImpact(s,o,repair)}));
  const rank=e=>!e.impact.available?2:e.impact.usesProject?1:0;
  const row=({o,t,impact})=>{
    const status=!impact.available?'材料未齐':impact.usesProject?'工地也要用':'余料可交';
    return `<button data-pick="${o.id}" class="neighbor-letter">${portrait(t.who)}
      <span><strong>${CAST[t.who].name}</strong><small>${esc(t.text)}</small></span><b>${status}</b></button>`;
  };
  entries.sort((a,b)=>rank(a)-rank(b));
  const main=entries.filter(e=>e.t.keepsake || e.t.diary);
  const prior=entries.filter(e=>!e.t.keepsake && !e.t.diary);
  const list=rows=>'<div class="letter-list">'+rows.map(row).join('')+'</div>';
  const answered=R.STORY_LETTERS.filter(t=>s.orderLog.includes(t.id));
  const receipts=answered.map(t=>`<button class="neighbor-letter" data-pick="recall-${t.id}">${portrait(t.who)}
    <span><strong>${CAST[t.who].name}</strong><small>${t.keepsake || '找回了外婆的手记 · 第 '+(t.diary+1)+' 页'}</small></span><b>${t.keepsake?'去看看':'读这页'}</b></button>`);
  return (main.length?list(main):'<p>目前没有新的故事来信。</p>')+
    (prior.length?`<details class="memory"><summary>以前收到的请求（${prior.length}）</summary>${list(prior)}</details>`:'')+
    (answered.length?`<details class="memory" ${main.length?'':'open'}><summary>已回的信（${answered.length}）</summary><div class="letter-list">${receipts.join('')}</div></details>`:'');
}
export function shortage(r,p) {
  if (p.ready) return '材料已齐';
  if (p.staged && p.half) return '另一半到了，可以合拢';
  if (p.staged) return '已试装一半 · 还需'+quantity(r.chain,r.level-1,'一');
  if (!p.missing) return '材料够了，合成即可';
  if (!p.highest) return '先到'+WORKSHOPS[CHAIN_SHOP[r.chain]]+'采集材料';
  const step=Math.log2(p.missing);
  if(Number.isInteger(step))return '还差'+quantity(r.chain,step+1,'一');
  const next=nameOf(r.chain,p.nextLevel);
  if(!p.nextGap)return '现在可以合出'+next;
  return '再攒 '+p.nextGap+' 份基础料可合出'+next;
}
export function bar(progress) {
  return `<span class="meter"><i style="width:${Math.round(100*progress.total/progress.need)}%"></i></span>`;
}
export function repairPanel(s,r,step) {
  if (!r) return `<button class="work-summary" data-open="journal">${img('scene-ferry')}<span><strong>家园修复完成</strong><small>回看归乡故事</small></span></button>`;
  const p=R.progressFor(s,r);
  let line=shortage(r,p), action='';
  switch(step.kind) {
    case 'install': line=nameOf(r.chain,r.level)+'已做好'; action='修复'; break;
    case 'assemble': line='另一半已做好'; action='合拢'; break;
    case 'stage': line='第一件'+nameOf(r.chain,r.level-1)+'已做好'; action='试装'; break;
    case 'merge':
      line=step.remote?REGIONS[step.where].name+'有一对搭档':!step.from.cell?'背包里有一件搭档':
        `把${quantity(r.chain,step.to.level,'两')}拖到一起`;
      if(p.staged)line='已装一半 · '+line;
      break;
    case 'move': line=step.reason==='split'?'把分在两地的搭档放到一起':step.reason==='bag'?'先从背包取出'+nameOf(r.chain,step.item.level):'把组件移到开阔处再合成'; break;
    case 'gather': if(!p.highest && !p.staged)line='去'+WORKSHOPS[CHAIN_SHOP[r.chain]]+'取料'; break;
  }
  return `<div class="site-ticket">
    <button class="work-summary" data-job-info="${r.id}" aria-label="工地详情 · ${JOB_NAMES[r.id]}">
      ${piece(r.chain,r.level)}<span><strong>${JOB_NAMES[r.id]}</strong><small>${esc(line)}</small></span></button>
    ${action?`<button class="job-act ${p.ready?'bright':''}" data-job-act="${r.id}">${action}</button>`:''}
    ${p.staged?`<button class="take-back" data-retrieve="${r.id}" aria-label="取回试装件">取回</button>`:''}
    </div>`;
}
export function itemPanel(s,i,r) {
  const canDeliver=r && i.chain===r.chain && i.level===r.level;
  const canFit=r && r.level>=5 && i.chain===r.chain && i.level===r.level-1 && !R.progressFor(s,r).ready;
  const note=canDeliver?'可拖到工地修复':canFit?'可拖到工地试装':i.level===7?'最高级':'';
  return `<button class="selected-token" data-item-info="${i.id}" aria-label="材料详情 · ${nameOf(i.chain,i.level)}">
    ${piece(i.chain,i.level)}<span><strong>${nameOf(i.chain,i.level)}</strong>${note?`<small>${note}</small>`:''}</span></button>
    <button class="clear-selection" data-open="deselect" aria-label="取消选择">${icon.close}</button>`;
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
export function orderDetail(s,o,job,impact) {
  const t=R.orderById(o.id);
  let allocation='';
  const project=impact.project || job;
  if(project && impact.available) {
    const title=JOB_NAMES[project.id];
    if(!impact.usesProject)allocation='这份余料可以交，'+title+'的备料进度不变。';
    else if(impact.after.missing>impact.before.missing){
      const missing=impact.after.missing, level=Math.log2(missing)+1;
      const gap=Number.isInteger(level)?quantity(project.chain,level,'一'):missing+' 份基础料';
      allocation=impact.before.missing===0
        ? '交出后，'+title+'还差'+gap+'。'
        : title+'的基础料缺口会从 '+impact.before.missing+' 份变成 '+missing+' 份。';
    } else if(impact.lostReady)allocation='会用到给'+title+'做好的成品。余料够，但需要重新合成。';
    else allocation='会用到给'+title+'准备的半件，需要再合一件。';
  }
  const outcome=orderResult(s,t);
  return `<div class="note-person">${portrait(t.who)}<div><b>${CAST[t.who].name}</b><p>${esc(t.text)}</p></div></div>
    <div class="order-parts">${t.needs.map(([c,l])=>`<button data-pick="chain-${c}">${piece(c,l)}<small>${nameOf(c,l)} · L${l}</small></button>`).join('')}</div>
    <div class="reward-strip">${reward(t)} ${outcome?' · '+outcome:''}</div>
    ${allocation?`<p class="allocation ${impact.usesProject?'uses-stock':''}">${allocation}</p>`:''}`;
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
export function bagView(s,selected) {
  const canPair=i=>i && selected?.cell && selected.level<7 && i.chain===selected.chain && i.level===selected.level;
  const help=s.bag.some(canPair)?'点标有「合成」的搭档，可以直接合到草地上':'点素材放回当前地区';
  return `<p class="sheet-intro">${s.bag.length} / ${s.bagSize} 格 · ${help}</p><div class="bag-grid">${Array.from({length:s.bagSize},(_,n)=>{
    const i=s.bag[n]; return i?`<button data-pick="${i.id}">${piece(i.chain,i.level)}<small>${canPair(i)?'合成':nameOf(i.chain,i.level)}</small></button>`:'<span class="empty-slot">空格</span>';}).join('')}</div>`;
}
