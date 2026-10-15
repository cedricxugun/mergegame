import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'.preview');await fs.mkdir(out,{recursive:true});
const profile=path.join(out,`browser-${Date.now()}`);await fs.mkdir(profile);
const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,message,timeout=15000){const start=Date.now();let last;while(Date.now()-start<timeout){try{const value=await fn();if(value)return value;}catch(error){last=error;}await sleep(60);}throw Error(`${message}${last?`: ${last.message}`:''}`);}
let ws,seq=0;const pending=new Map(),errors=[],requests=[];
async function connect(){
  const port=await until(async()=>{const text=await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8');return Number(text.split('\n')[0]);},'Browser did not start');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();const page=targets.find(t=>t.type==='page');assert.ok(page);
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);if(message.error)item.reject(Error(message.error.message));else item.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    if(message.method==='Network.loadingFailed')requests.push(message.params.errorText);
  });
}
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function getState(){return evaluate('window.__forestCamp.getState()');}
async function clickAt(x,y){await call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await sleep(65);}
async function click(selector){
  const target=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:e.disabled};})()`);
  assert.ok(target,`Missing control ${selector}`);assert.ok(!target.disabled,`Disabled control ${selector}`);await clickAt(target.x,target.y);
}
async function clearSelection(){if(await evaluate('Boolean(document.querySelector("button[data-action=deselect]"))'))await click('button[data-action=deselect]');}
async function itemPoint(id){
  const result=await evaluate(`(()=>{const e=document.querySelector('[data-item-id="${id}"]');if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});const candidates=[];for(const n of e.querySelectorAll('circle,polygon,image')){const r=n.getBoundingClientRect();for(const dx of [.5,.25,.75])for(const dy of [.5,.25,.75])candidates.push({x:r.x+r.width*dx,y:r.y+r.height*dy});}for(const p of candidates){const hit=document.elementFromPoint(p.x,p.y)?.closest('[data-item-id]');if(hit?.dataset.itemId==='${id}')return p;}return {error:'No visible hit target'};})()`);
  return result&&!result.error?result:null;
}
async function clickItem(id){
  const state=await getState(),item=state.items.find(item=>item.id===id);assert.ok(item);
  if(item.q===null){if(await evaluate('document.querySelector("#bag-toggle").getAttribute("aria-expanded")==="false"'))await click('#bag-toggle');await click(`.bag-item[data-id="${id}"]`);}
  else{let p=await itemPoint(id);if(!p&&(await evaluate('window.__forestCamp.getCamera().zoom'))==='near'){await click('#zoom-button');p=await itemPoint(id);}assert.ok(p,`Item ${id} has no accessible hit target`);await clickAt(p.x,p.y);}
}
async function capture(name){await evaluate('window.scrollTo(0,0)');await sleep(300);const data=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(out,name),Buffer.from(data.data,'base64'));}
try{
  await connect();await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Page.navigate',{url:process.env.CAMP_URL||'http://127.0.0.1:4178/'});
  await until(()=>evaluate('Boolean(window.__forestCamp)'), 'Game did not initialize');
  assert.equal((await getState()).wins,0);await capture('initial-mobile.png');
  assert.equal(await evaluate('document.querySelectorAll(".hex-cell.open").length'),7);
  await click('#world-button');assert.equal(await evaluate('window.__forestCamp.getCamera().worldView'),true);await capture('world-mobile.png');
  await click('.world-region[data-region=river]');assert.match(await evaluate('document.querySelector("#modal-body").innerText'),/芦苇河湾/);await capture('river-preview-mobile.png');await click('button[data-action=return-camp]');
  const panBefore=await evaluate('window.__forestCamp.getCamera()');
  const panStart=await evaluate('(()=>{const r=document.querySelector("#board").getBoundingClientRect();return {x:r.left+80,y:r.top+110};})()');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...panStart,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:panStart.x+40,y:panStart.y+25,button:'left',buttons:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:panStart.x+40,y:panStart.y+25,button:'left',clickCount:1});
  assert.notEqual((await evaluate('window.__forestCamp.getCamera()')).q,panBefore.q);assert.equal((await getState()).wins,0);await click('#world-button');await click('#win-button');
  console.log('PASS: seven-cell iPhone opening, world regions, region preview, camera pan');
  await click('#win-button');await click('#chest-button');let state=await getState();assert.equal(state.items.length,4);
  const original=state.items[0];const start=await itemPoint(original.id);
  const end=await evaluate(`(()=>{const l=window.__forestCamp.getLayout(),r=document.querySelector('#board').getBoundingClientRect();const p=([q,s])=>[r.left+(l.origin[0]+Math.sqrt(3)*l.size*(q+s/2))*r.width/l.width,r.top+(l.origin[1]+1.5*l.size*s)*r.height/l.height];const a=p([${original.q},${original.r}]),b=p([0,0]);return {x:b[0]+${start.x}-a[0],y:b[1]+${start.y}-a[1]};})()`);
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',...start});await call('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});
  for(let i=1;i<=6;i++){await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x+(end.x-start.x)*i/6,y:start.y+(end.y-start.y)*i/6,button:'left',buttons:1});await sleep(30);}
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1});await sleep(100);
  state=await getState();assert.equal(state.items.find(i=>i.id===original.id).q,0);assert.equal(state.items.find(i=>i.id===original.id).r,0);
  await click('#undo-button');state=await getState();assert.equal(state.items.find(i=>i.id===original.id).q,original.q);
  console.log('PASS: native pointer drag, move, undo');
  let capturedGrowth=false,rotated=false,actions=0;
  while(actions++<180){
    state=await getState();const hint=await evaluate('window.__forestCamp.getHint()');
    if(state.wins===2&&state.forestOpened&&!capturedGrowth&&hint.type==='win'){
      await capture('first-expansion-mobile.png');capturedGrowth=true;
      console.log('PASS: permanent three-cell scenery and compensated workspace');
    }
    const movableThree=state.items.find(item=>!item.settled&&item.level===4&&item.q!==null);
    if(movableThree&&!rotated){
      const tree=movableThree;await clearSelection();await clickItem(tree.id);
      await click('button[data-action=store]');assert.equal((await getState()).items.find(i=>i.id===tree.id).q,null);
      await click('button[data-action=rotate]');assert.equal((await getState()).items.find(i=>i.id===tree.id).rotation,(tree.rotation+1)%6);
      await click('button[data-action=restore]');assert.notEqual((await getState()).items.find(i=>i.id===tree.id).q,null);rotated=true;
      console.log('PASS: three-cell growth, rotation, backpack restore');
    }
    if(hint.type==='depart')break;
    if(hint.type==='win')await click('#win-button');
    else if(hint.type==='chest')await click('#chest-button');
    else if(hint.type==='merge'){
      const before=(await getState()).merges;await clearSelection();await clickItem(hint.source);await clickItem(hint.target);
      assert.equal((await getState()).merges,before+1,`Click merge failed for ${hint.source}, ${hint.target}`);
    }else if(hint.type==='settle'){
      await clearSelection();await clickItem(hint.id);await click('button[data-action=settle]');
    }else if(hint.type==='bridge'){
      await click('button[data-action=bridge]');await click('button[data-action=build-bridge]');
    }else if(hint.type==='restore'){
      await clearSelection();await clickItem(hint.id);await click('button[data-action=restore]');
    }else if(hint.type==='space'){
      const item=(await getState()).items.find(i=>!i.settled&&i.q!==null);assert.ok(item);await clearSelection();await clickItem(item.id);await click('button[data-action=store]');
    }else assert.fail(`Unexpected hint ${hint.type}`);
  }
  assert.ok(actions<180);assert.ok(capturedGrowth&&rotated);state=await getState();assert.equal(state.wins,8);assert.equal(state.bridge,8);assert.ok(Object.values(state.goals).every(Boolean));
  await capture('built-mobile.png');console.log('PASS: eight victories, all landmarks, seven-cell camp, bridge unlock');
  await click('#win-button');await capture('settlement-mobile.png');
  const summary=await evaluate('document.querySelector("#modal-body").innerText');assert.match(summary,/3 补给/);
  await click('button[data-route=river]');state=await getState();assert.equal(state.departed,true);assert.equal(state.supplies,3);assert.equal(state.items.length,3);assert.equal(state.chests.length,0);
  await click('button[data-action=close-modal]');await capture('finished-mobile.png');
  await call('Page.reload');await until(()=>evaluate('Boolean(window.__forestCamp)'), 'Reload failed');state=await getState();assert.equal(state.departed,true);assert.equal(state.supplies,3);console.log('PASS: settlement, permanent scene and save/reload');
  await click('#settings-button');await click('button[data-action=reset-prompt]');await click('button[data-action=reset-confirm]');assert.equal((await getState()).wins,0);
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await capture('initial-desktop.png');
  const overflow=await evaluate('document.documentElement.scrollWidth>window.innerWidth');assert.equal(overflow,false);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify({passed:true,actions,drag:true,rotation:true,storage:true,completed:true,settlement:3,persistence:true,errors,requests},null,2));
  console.log(`PASS: UI flow (${actions} decisions), no browser errors, screenshots in ${out}`);
}catch(error){
  try{await capture('failure.png');await fs.writeFile(path.join(out,'failure-state.json'),JSON.stringify({state:await getState(),errors},null,2));}catch{}
  console.error(error.stack);process.exitCode=1;
}finally{
  if(ws?.readyState===WebSocket.OPEN){try{await call('Browser.close');}catch{}ws.close();}
  browser.kill();
}
