import {TASKS,completedTasks} from './homecoming-play.mjs';
export const STORY_CAST={mira:{name:'米拉',role:'带着女儿回乡的木工'},lina:{name:'莉娜',role:'记得每一盏灯的小探险家'},rowan:{name:'罗恩',role:'熟悉这条河的船匠'}};
const line=(who,text)=>({who,text});
export const STORY_SCENES={
  intro:{chapter:'第一章 · 风暴后的第一晚',title:'把回家的灯点起来',lines:[line('mira','风暴把渡口冲断了。邻居们都在河对岸，外婆的守林小屋也漏雨了。'),line('lina','我们把小屋修好，他们就有地方回来了吗？'),line('mira','对。先补住棚顶，再慢慢清路、点火。今晚，我们就从这里开始。')]},
  roof:{chapter:'第一章 · 第一个落脚处',title:'屋檐下不再漏雨',lines:[line('lina','雨都落在外面了！我把外婆的手记放在床边，这回不会淋湿了。'),line('mira','棚顶挡住雨了。接下来，先让炉火暖起来，或先清开通往河湾的路，都由你决定。')]},
  fire:{chapter:'第一章 · 第一盏暖光',title:'锅里有了热汤',lines:[line('mira','听，锅里的汤开了。明天我们就沿旧路去看看水渠。'),line('lina','我把灯朝着河的方向摆。这样，罗恩叔叔也能看见。')]},
  path:{chapter:'第一章 · 熟悉的旧路',title:'倒木后面的线索',lines:[line('mira','这段倒木撑住了，旧路也清出来了。可是雨下了这么久，水渠还是干的。'),line('lina','手记上画着上游的石泉！先把小屋修结实，我们就去找它。')]},
  home:{chapter:'第一章 · 留一盏灯',title:'有了能回来的家',lines:[line('lina','床、屋顶，还有门口的灯！我们可以把这里叫作家了吗？'),line('mira','可以。空地也清出来了，回来的邻居能在这里歇脚、整理物资。'),line('lina','那现在去找水吧。外婆的花箱也在等喝水呢。')]},
  arrival:{chapter:'第二章 · 芦苇河湾',title:'顺着旧渠找水声',lines:[line('mira','旧渠一直通到这片河湾。先疏通石泉，再一段段把水送回营地。'),line('lina','我来听声音！石头下面，好像真的有水。')]},
  spring:{chapter:'第二章 · 第一股清泉',title:'石缝里的回应',lines:[line('lina','水出来了！可它还只流到这个小槽里。'),line('mira','有水源就有希望。接下来，可以继续接水渠，也可以先种护岸草。物资按你的计划来选。')]},
  stream:{chapter:'第二章 · 水路重连',title:'家门前又有水声',lines:[line('lina','我刚跑回去看了！花箱旁边也能听见水声。'),line('mira','这条水路把两处连起来了。以后，营地也能听见这里的水声。')]},
  reeds:{chapter:'第二章 · 给河岸扎根',title:'第一片新绿',lines:[line('mira','把草垫压稳，根就有时间长进泥土。先留住这片河岸，大家才有地方落脚。'),line('lina','我把小石头摆在外圈，提醒大家别踩到刚种下的芦苇。')]},
  shore:{chapter:'第二章 · 归来的访客',title:'白鹭先回来了',lines:[line('lina','白鹭回来了！它站在新芦苇旁边，一点也不着急。'),line('mira','这段河岸终于安稳了。白鹭又找到了落脚的地方。')]},
  pier:{chapter:'第二章 · 对岸的老朋友',title:'把船引到岸边',lines:[line('rowan','米拉！我看见营地的灯了。大家一直在等渡口恢复。'),line('mira','栈桥的第一段已经稳了。再补好泊位和绳桩，你的小船就能靠岸。'),line('rowan','船上有种子、工具，还有你母亲寄回来的信。我都替你收好了。')]},
  ferry:{chapter:'第二章 · 第一艘归乡船',title:'让等候变成重逢',lines:[line('rowan','缆绳系好了。第一船物资到了，邻居们下一趟就来。'),line('lina','我们留的那盏灯，真的把大家带回来了！'),line('mira','这封信上说，山坡的信号灯也坏了。先把这里收拾好，再给更多归来的人照亮路。')]},
  ending:{chapter:'归乡手记 · 两站相连',title:'故乡开始有人生活',lines:[line('mira','小屋能住人，清泉能取水，渡口也重新开了。这次，我们把家连回了这条河。'),line('rowan','山坡上的旧信号灯，留给下一段旅程。今晚，让大家先吃一顿热饭。')]}
};
export function availableStoryKeys(state){const keys=['intro',...completedTasks(state,'camp').map(t=>t.id)];if(state.regions.river)keys.push('arrival',...completedTasks(state,'river').map(t=>t.id));if(state.regions.river?.settled)keys.push('ending');return keys;}
export function restoreStory(state,saved,loaded){const available=availableStoryKeys(state),seen=Array.isArray(saved?.seen)?saved.seen.filter(k=>available.includes(k)):loaded?[...available]:[];const cursor=saved?.cursor&&available.includes(saved.cursor.key)?{key:saved.cursor.key,index:Math.max(0,Math.min(STORY_SCENES[saved.cursor.key].lines.length-1,Number.isInteger(saved.cursor.index)?saved.cursor.index:0))}:!loaded?{key:state.region==='river'?'arrival':'intro',index:0}:null;return{seen:[...new Set(seen)],cursor};}
export function storySummary(state){const region=state.region,finished=completedTasks(state,region),key=finished.length?finished.at(-1).id:region==='river'?'arrival':'intro',scene=STORY_SCENES[key],last=scene.lines.at(-1);return{speaker:STORY_CAST[last.who].name,portrait:last.who,line:last.text};}
export function createStoryUI({asset,portrait,onProgress,onFinish}){
  const dialog=document.createElement('dialog');dialog.className='home-story';dialog.setAttribute('aria-label','归乡故事');document.body.append(dialog);let current=null,index=0,replay=false,timer=null,typing=false;
  function finish(){clearInterval(timer);typing=false;const key=current;dialog.close();current=null;onFinish?.(key,replay);}
  function completeLine(){clearInterval(timer);typing=false;dialog.querySelector('.story-dialogue').textContent=STORY_SCENES[current].lines[index].text;}
  function draw(){const scene=STORY_SCENES[current],item=scene.lines[index],cast=STORY_CAST[item.who];dialog.innerHTML=`<div class="story-scene"><div class="story-scene-top"><span>${scene.chapter}</span><button data-story="skip">稍后再看</button></div><div class="story-sheet"><img class="story-actor" src="${asset(portrait(item.who))}" alt="${cast.name}"><div class="story-title"><small>${cast.name}</small><h2>${scene.title}</h2></div><p class="story-dialogue" aria-hidden="true"></p><p class="story-accessible">${item.text}</p><div class="story-controls"><span>${scene.lines.map((_,i)=>`<i class="${i===index?'active':''}"></i>`).join('')}</span><button data-story="next">${index===scene.lines.length-1?'回到地图':'继续'} <b>›</b></button></div></div></div>`;clearInterval(timer);const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;typing=!reduced;let length=0;if(reduced)completeLine();else timer=setInterval(()=>{length+=2;dialog.querySelector('.story-dialogue').textContent=item.text.slice(0,length);if(length>=item.text.length){clearInterval(timer);typing=false;}},30);dialog.querySelector('[data-story="next"]').focus({preventScroll:true});}
  function next(){if(typing){completeLine();return;}if(index<STORY_SCENES[current].lines.length-1){index++;onProgress?.({key:current,index},replay);draw();}else finish();}
  dialog.addEventListener('click',event=>{const action=event.target.closest('[data-story]')?.dataset.story;if(action==='skip')finish();if(action==='next')next();});dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});dialog.addEventListener('keydown',e=>{if(e.key===' '&&e.target.tagName!=='BUTTON'){e.preventDefault();next();}});
  return{show(key,start=0,isReplay=false){if(!STORY_SCENES[key])return;current=key;index=start;replay=isReplay;draw();if(!dialog.open)dialog.showModal();dialog.querySelector('[data-story="next"]').focus({preventScroll:true});},isOpen:()=>dialog.open,close(){if(dialog.open)finish();}};
}
