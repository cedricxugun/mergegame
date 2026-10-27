import * as M3Legacy from './match3.mjs';

export const M3_WIDTH=7, M3_HEIGHT=8, M3_COUNT=56;
export const M3_COLORS=[{id:'leaf',name:'绿叶'},{id:'book',name:'红书'},{id:'crown',name:'皇冠'},{id:'shield',name:'盾牌'},{id:'gem',name:'紫晶'}];
export const M3_POWERS=['row','col','bomb','propeller','orb'];
const row=i=>Math.floor(i/7),col=i=>i%7,inside=i=>Number.isInteger(i)&&i>=0&&i<56;
export const m3Adjacent=(a,b)=>inside(a)&&inside(b)&&Math.abs(row(a)-row(b))+Math.abs(col(a)-col(b))===1;
const neighbors=i=>[i-7,i+7,i-1,i+1].filter(j=>m3Adjacent(i,j));
const fullRow=i=>Array.from({length:7},(_,c)=>row(i)*7+c);
const fullCol=i=>Array.from({length:8},(_,r)=>r*7+col(i));
const area=(i,radius)=>Array.from({length:56},(_,j)=>j).filter(j=>Math.abs(row(j)-row(i))<=radius&&Math.abs(col(j)-col(i))<=radius);
const layouts=[
  ['.......','.......','.......','.......','.......','.......','CCCCCCC','#CCCCC#'],
  ['#.....#','.......','.......','.......','..CCC..','..CCC..','.CC.CC.','#CC.CC#'],
  ['.......','.......','.......','C.....C','C.....C','CC...CC','CC...CC','CCCCCCC'],
  ['##...##','#.....#','.......','.......','..MMM..','..MMM..','.CCCCC.','.CCCCC.'],
  ['.......','.......','.......','CC...CC','.......','..CCC..','CC...CC','CC...CC'],
  ['#.....#','.......','.......','.......','C..C..C','C..C..C','C..C..C','CCCCCCC'],
  ['.......','.......','..MMM..','..MMM..','..MMM..','CC...CC','CC...CC','.CCCCC.'],
  ['.......','.......','.......','.......','C.....C','2C...C2','2CC.CC2','222C222'],
  ['#.....#','.......','.......','.......','MMMMMMM','CC...CC','CC...CC','CCCCCCC'],
  ['##...##','#.....#','.......','.......','.......','CC...CC','CC...CC','2222222'],
  ['.......','.......','.......','..CCC..','.......','CC...CC','CC...CC','C2CCC2C'],
  ['.......','.......','MMMMMMM','M.....M','M.....M','CC...CC','CC...CC','CCCCCCC'],
  ['#.....#','.......','.......','C.....C','C.....C','CM...MC','CCMMMCC','222C222'],
  ['.......','.......','.......','..CCC..','..CCC..','C.....C','CC...CC','2222222'],
  ['##...##','#.....#','.......','.......','MMMMMMM','CC...CC','CC...CC','22CCC22'],
  ['.......','.......','C.....C','C.....C','CM...MC','CM...MC','CCMMMCC','222C222'],
  ['.......','.......','.......','.......','C..C..C','C..C..C','2..2..2','2CC2CC2'],
  ['#.....#','.......','.......','MMMMMMM','..MMM..','C.....C','2C...C2','22CCC22'],
  ['.......','.......','.......','C.....C','CM...MC','CM...MC','CCMMMCC','2222222'],
  ['##...##','#.....#','.......','.......','MMCCCMM','CCMMMCC','2C...C2','2222222']
];
// `custom` lets another game supply its own layout, move count, colour count
// and colour-collection goals; the authored campaign passes nothing.
export function m3LevelConfig(level,custom=null){
  const layout=custom?.layout||layouts[level-1];if(!layout)throw Error('Unknown match-three level');
  const cells=layout.join('').split(''),crates=cells.map(c=>c==='2'?2:c==='C'?1:0),mud=cells.map(c=>c==='M'?1:0),crateCount=crates.filter(Boolean).length;
  const goals=crateCount||!custom?[{kind:'crate',target:crateCount}]:[];
  if(mud.some(Boolean))goals.push({kind:'mud',target:mud.reduce((a,b)=>a+b,0)});
  for(const[color,target]of custom?.collect||[])goals.push({kind:'color',color,target});
  return{level,colors:custom?.colors??(level<=3?4:5),moves:custom?.moves??(level===1?24:26+Math.floor(level/4)),mask:cells.map(c=>c==='#'?0:1),crates,mud,goals};
}
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
const piece=(s,color,power=null)=>({id:`t${s.nextId++}`,color,power});
const free=(s,i)=>inside(i)&&s.mask[i]&&!s.crates[i];
function fillStable(s){
  const board=Array(56).fill(null);
  for(let i=0;i<56;i++){if(!free(s,i))continue;const choices=Array.from({length:s.colors},(_,c)=>c).filter(c=>!(col(i)>1&&board[i-1]?.color===c&&board[i-2]?.color===c)&&!(row(i)>1&&board[i-7]?.color===c&&board[i-14]?.color===c)&&!(row(i)>0&&col(i)>0&&[i-1,i-7,i-8].every(j=>board[j]?.color===c)));board[i]=piece(s,choices[Math.floor(random(s)*choices.length)]);}
  return board;
}
export function m3FindMatches(board){
  const lines=[];
  for(const axis of ['row','col']){const outer=axis==='row'?8:7,inner=axis==='row'?7:8;for(let o=0;o<outer;o++){let start=0;const at=k=>axis==='row'?o*7+k:k*7+o;while(start<inner){const color=board[at(start)]?.color;let end=start+1;if(Number.isInteger(color))while(end<inner&&board[at(end)]?.color===color)end++;if(Number.isInteger(color)&&end-start>=3)lines.push({axis,color,cells:Array.from({length:end-start},(_,n)=>at(start+n))});start=end;}}}
  for(let r=0;r<7;r++)for(let c=0;c<6;c++){const i=r*7+c,color=board[i]?.color,cells=[i,i+1,i+7,i+8];if(Number.isInteger(color)&&cells.every(j=>board[j]?.color===color))lines.push({axis:'square',color,cells});}
  const groups=[];
  for(const line of lines){const overlaps=groups.filter(g=>g.color===line.color&&line.cells.some(i=>g.cells.includes(i)));if(!overlaps.length){groups.push({color:line.color,cells:[...line.cells],lines:[line]});continue;}const first=overlaps[0];first.cells=[...new Set([...first.cells,...line.cells,...overlaps.slice(1).flatMap(g=>g.cells)])];first.lines.push(line,...overlaps.slice(1).flatMap(g=>g.lines));for(const other of overlaps.slice(1))groups.splice(groups.indexOf(other),1);}
  return groups;
}
function powerFor(g){if(g.lines.some(l=>l.axis!=='square'&&l.cells.length>=5))return'orb';if(g.lines.some(l=>l.axis==='row')&&g.lines.some(l=>l.axis==='col'))return'bomb';const four=g.lines.find(l=>l.axis!=='square'&&l.cells.length>=4);if(four)return four.axis;if(g.lines.some(l=>l.axis==='square'))return'propeller';return null;}
export function m3Goals(s){if(s.version===1)return M3Legacy.m3Goals(s);return s.goals.map(g=>{const collected=g.kind==='crate'?s.cratesCleared:g.kind==='mud'?s.mudCleared:s.collected[g.color];return{...g,collected,remaining:Math.max(0,g.target-collected),done:collected>=g.target};});}
export const m3Won=s=>m3Goals(s).every(g=>g.done);
const mostColor=board=>{const counts=Array(5).fill(0);for(const p of board)if(Number.isInteger(p?.color))counts[p.color]++;return counts.indexOf(Math.max(...counts));};
function targetScore(s,indices){let n=0;for(const i of new Set(indices)){if(!s.mask[i])continue;n+=s.crates[i]?12:s.mud[i]?9:.2;}return n;}
function target(s,excluded=new Set(),payload=null){const candidates=s.mask.flatMap((v,i)=>v&&!excluded.has(i)?[i]:[]);candidates.sort((a,b)=>{const value=i=>(s.crates[i]?100:s.mud[i]?70:0)+targetScore(s,payload==='row'?fullRow(i):payload==='col'?fullCol(i):payload==='bomb'?area(i,2):[i]);return value(b)-value(a)||b-a;});return candidates[0]??s.mask.findIndex(Boolean);}
function footprint(s,i,p,color){if(p==='row')return fullRow(i);if(p==='col')return fullCol(i);if(p==='bomb')return area(i,2);if(p==='propeller')return[i,...neighbors(i),target(s,new Set([i,...neighbors(i)]))];return s.board.flatMap((p,j)=>p?.color===(color??mostColor(s.board))?[j]:[]).concat(i);}
export function m3AvailableMoves(s){
  if(s.version===1)return M3Legacy.m3AvailableMoves(s);const moves=[];
  for(let i=0;i<56;i++){const p=s.board[i];if(!p)continue;if(p.power)moves.push({type:'ACTIVATE',index:i,score:targetScore(s,footprint(s,i,p.power))+3});
    for(const j of[i+1,i+7]){if(!m3Adjacent(i,j)||!s.board[j])continue;const q=s.board[j];if(p.power||q.power){let score=p.power&&q.power?35:2;if(p.power&&q.power&&(p.power==='orb'||q.power==='orb'))score=140;else if(p.power&&q.power&&(p.power==='propeller'||q.power==='propeller'))score=80;else if(p.power&&q.power&&p.power==='bomb')score=70;moves.push({type:'SWAP',a:i,b:j,score});continue;}const b=s.board.slice();[b[i],b[j]]=[b[j],b[i]];const groups=m3FindMatches(b);if(groups.length){const cells=groups.flatMap(g=>g.cells);moves.push({type:'SWAP',a:i,b:j,score:targetScore(s,[...cells,...cells.flatMap(neighbors)])+groups.reduce((n,g)=>n+(powerFor(g)?20:0),0)});}}
  }return moves.sort((a,b)=>b.score-a.score);
}
export function m3Hint(s){return s.status==='playing'?m3AvailableMoves(s)[0]||null:null;}
function remix(s){
  const positions=s.board.flatMap((p,i)=>p?[i]:[]),original=positions.map(i=>s.board[i]);
  for(let attempt=0;attempt<100;attempt++){const tokens=original.slice();for(let i=tokens.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[tokens[i],tokens[j]]=[tokens[j],tokens[i]];}positions.forEach((p,i)=>s.board[p]=tokens[i]);if(!m3FindMatches(s.board).length&&m3AvailableMoves(s).length){s.shuffles++;return;}}
  const powers=original.filter(p=>p.power);do{s.board=fillStable(s);powers.forEach((p,n)=>s.board[positions[n]]=p);}while(!m3AvailableMoves(s).length);s.shuffles++;
}
export function m3Create(level,{seed=1,runId=`level-${level}-${seed}`,custom=null}={}){
  const c=m3LevelConfig(level,custom),s={version:2,level,...(custom?{custom}:{}),runId,seed:seed>>>0,rng:seed>>>0,nextId:1,colors:c.colors,moves:c.moves,usedMoves:0,turn:0,board:[],mask:c.mask,crates:c.crates,mud:c.mud,goals:c.goals,collected:Array(5).fill(0),cratesCleared:0,mudCleared:0,score:0,tools:{hammer:1,row:1,col:1,shuffle:1},hammer:1,shuffles:0,status:'playing'};
  // The first authored move creates a rocket. The starter propeller drops beside it.
  const tutorial=level===1&&!custom?.layout;for(let attempt=0;attempt<3000;attempt++){s.board=fillStable(s);if(tutorial){for(const i of[15,16,18,10])s.board[i].color=1;s.board[17].color=2;s.board[11]=piece(s,null,'propeller');}if(m3FindMatches(s.board).length||!m3AvailableMoves(s).length)continue;if(tutorial){const first=m3Move(s,{type:'SWAP',a:10,b:17});if(first.waves!==1||first.state.board[17]?.power!=='row'||first.state.board[18]?.power!=='propeller')continue;}return s;}
  throw Error('Could not create a stable match board');
}
function snapshot(s){return{board:structuredClone(s.board),mask:[...s.mask],crates:[...s.crates],mud:[...s.mud],collected:[...s.collected],cratesCleared:s.cratesCleared,mudCleared:s.mudCleared,score:s.score,moves:s.moves,hammer:s.hammer,tools:{...s.tools}};}
function clearWave(s,seeds,groups,preferred,wave,frames,options={}){
  const clear=new Set(seeds.filter(i=>s.mask[i])),pending=[...clear],triggered=new Set(options.skip||[]),activated=[...(options.activated||[])],flights=[],made=[],conversions=[],causes={};
  const add=(indices,cause)=>{for(const i of indices)if(s.mask[i]&&!clear.has(i)){clear.add(i);pending.push(i);if(cause)causes[i]=cause;}};
  const fly=(from,payload,count=1)=>{const used=new Set(clear);for(let n=0;n<count;n++){const to=target(s,used,payload);used.add(to);const flight=flights.length;flights.push({from,to,payload});add(payload?footprint(s,to,payload):[to],{kind:'flight',flight});if(payload)activated.push({index:to,power:payload,delivered:true});}};
  if(options.convert){const color=mostColor(s.board);s.board.forEach((p,i)=>{if(p?.color!==color)return;const power=options.convert==='row'||options.convert==='col'?(random(s)<.5?'row':'col'):options.convert;s.collected[color]++;s.board[i]=piece(s,null,power);conversions.push({index:i,power});add([i],{kind:'conversion'});});}
  if(options.flight)fly(options.flight.from,options.flight.payload,options.flight.count);
  for(const g of groups){const power=powerFor(g);if(power)made.push({index:preferred.find(i=>g.cells.includes(i))??g.cells[Math.floor(g.cells.length/2)],power});}
  for(let n=0;n<pending.length;n++){const i=pending[n],p=s.board[i];if(!p?.power||triggered.has(i))continue;triggered.add(i);activated.push({index:i,power:p.power});if(p.power==='propeller'){add([i,...neighbors(i)],{kind:'power',index:i,power:p.power});fly(i,null);}else add(footprint(s,i,p.power,options.orbColor),{kind:'power',index:i,power:p.power});}
  const damage=new Set([...clear,...groups.flatMap(g=>g.cells.flatMap(neighbors))]),hits=[];
  for(const i of damage){if(!s.crates[i])continue;s.crates[i]--;hits.push({index:i,remaining:s.crates[i]});if(!s.crates[i])s.cratesCleared++;}
  for(const i of clear){const p=s.board[i];if(Number.isInteger(p?.color))s.collected[p.color]++;if(s.mud[i]){s.mud[i]=0;s.mudCleared++;}s.board[i]=null;}
  for(const p of made)s.board[p.index]=piece(s,null,p.power);
  s.score+=clear.size*50*wave+made.length*150+hits.length*100;
  const hitCauses={};for(const h of hits){if(causes[h.index])hitCauses[h.index]=causes[h.index];else{const source=groups.flatMap(g=>g.cells).find(i=>neighbors(i).includes(h.index));if(source!==undefined)hitCauses[h.index]=causes[source]||null;}}
  frames.push({type:'clear',indices:[...clear],activated,flights,conversions,hits,made,wave,causes,hitCauses,consumed:options.skip||[],combo:options.combo||null,...snapshot(s)});
}
function drop(s,frames){
  const falls=[];
  for(let c=0;c<7;c++){let end=7;while(end>=0){if(!free(s,end*7+c)){end--;continue;}let top=end;while(top>0&&free(s,(top-1)*7+c))top--;let dest=end;for(let r=end;r>=top;r--){const from=r*7+c,p=s.board[from];if(!p)continue;const to=dest*7+c;s.board[to]=p;if(to!==from)s.board[from]=null;falls.push({id:p.id,from,to});dest--;}
      for(let r=dest;r>=top;r--){const to=r*7+c,p=piece(s,Math.floor(random(s)*s.colors));s.board[to]=p;falls.push({id:p.id,from:(top-1-(dest-r))*7+c,to,spawn:true});}end=top-1;}}
  frames.push({type:'drop',falls,...snapshot(s)});
}
const fail=(state,message,frames=[])=>({ok:false,state,message,frames});
export function m3Move(state,action){
  if(state.version===1)return M3Legacy.m3Move(state,action);
  if(state.status!=='playing')return fail(state,'这一局已经结束了。');
  const s=structuredClone(state),frames=[];let groups=[],seeds=[],options={},preferred=[];
  if(action.type==='SWAP'){
    const{a,b}=action;if(!m3Adjacent(a,b)||!s.board[a]||!s.board[b])return fail(state,'交换相邻棋子；木箱要从旁边消除。');const pa=s.board[a],pb=s.board[b];[s.board[a],s.board[b]]=[pb,pa];preferred=[b,a];frames.push({type:'swap',a,b,...snapshot(s)});
    if(pa.power||pb.power){seeds=pa.power&&pb.power?[a,b]:[pa.power?b:a];
      if(pa.power&&pb.power){const powers=[pa.power,pb.power];options.skip=[a,b];options.activated=[{index:b,power:pa.power},{index:a,power:pb.power}];
        if(powers.every(p=>p==='orb')){seeds=s.mask.flatMap((v,i)=>v?[i]:[]);options.combo='双彩球 · 全屏闪耀';}
        else if(powers.includes('orb')){options.activated=options.activated.filter(p=>p.power==='orb');options.convert=powers.find(p=>p!=='orb');options.combo='彩球组合 · 全场变身';}
        else if(powers.includes('propeller')){options.activated=[{index:b,power:'propeller'}];seeds.push(...neighbors(b));options.flight={from:b,payload:powers.find(p=>p!=='propeller')||null,count:powers.every(p=>p==='propeller')?3:1};options.combo=powers.every(p=>p==='propeller')?'三架螺旋桨 · 精准出发':'螺旋桨组合 · 飞向目标';}
        else if(powers.every(p=>p==='bomb')){options.activated=[{index:b,power:'bomb',radius:4}];seeds.push(...area(b,4));options.combo='双炸弹 · 超大爆破';}
        else if(powers.includes('bomb')){options.activated=[...[-7,0,7].filter(d=>inside(b+d)).map(d=>({index:b+d,power:'row'})),...[-1,0,1].filter(d=>d===0||m3Adjacent(b,b+d)).map(d=>({index:b+d,power:'col'}))];for(const i of area(b,1))seeds.push(...fullRow(i),...fullCol(i));options.combo='火箭炸弹 · 三行三列';}
        else{options.activated=[{index:b,power:'row'},{index:b,power:'col'}];seeds.push(...fullRow(b),...fullCol(b));options.combo='双火箭 · 十字齐发';}
      }else if(pa.power==='orb'||pb.power==='orb')options.orbColor=pa.power==='orb'?pb.color:pa.color;
    }else{groups=m3FindMatches(s.board);if(!groups.length)return fail(state,'没有形成消除，不扣步数。',frames);seeds=groups.flatMap(g=>g.cells);}
    s.moves--;s.usedMoves++;
  }else if(action.type==='ACTIVATE'){
    if(!s.board[action.index]?.power)return fail(state,'点道具可直接触发。');seeds=[action.index];s.moves--;s.usedMoves++;
  }else if(['HAMMER','ROW','COL','SHUFFLE'].includes(action.type)){
    const tool=action.type.toLowerCase();if(!s.tools[tool])return fail(state,'本局这个道具已用完。');if(tool!=='shuffle'&&(!inside(action.index)||!s.mask[action.index]))return fail(state,'请选择棋盘内的一格。');s.tools[tool]--;s.hammer=s.tools.hammer;
    if(tool==='shuffle'){remix(s);frames.push({type:'shuffle',...snapshot(s)});}else{seeds=tool==='hammer'?[action.index]:tool==='row'?fullRow(action.index):fullCol(action.index);options.activated=tool==='hammer'?[]:[{index:action.index,power:tool}];}
  }else return fail(state,'未知操作。');
  s.turn++;let wave=0;
  while(seeds.length){wave++;clearWave(s,seeds,groups,preferred,wave,frames,options);drop(s,frames);groups=m3FindMatches(s.board);seeds=groups.flatMap(g=>g.cells);preferred=[];options={};if(wave>=60&&seeds.length){remix(s);frames.push({type:'shuffle',...snapshot(s)});break;}}
  s.status=m3Won(s)?'won':s.moves===0?'lost':'playing';if(s.status==='playing'&&!m3AvailableMoves(s).length){remix(s);frames.push({type:'shuffle',...snapshot(s)});}
  return{ok:true,state:s,frames,waves:wave};
}
export function m3Valid(s){
  if(s?.version===1)return M3Legacy.m3Valid(s);
  if(!s||s.version!==2||!Number.isInteger(s.level)||s.level<1||!s.custom&&s.level>20||typeof s.runId!=='string'||!s.runId||s.runId.length>140)return false;
  const c=m3LevelConfig(s.level,s.custom||null),uint=n=>Number.isInteger(n)&&n>=0&&n<=4294967295;
  if(s.colors!==c.colors||JSON.stringify(s.mask)!==JSON.stringify(c.mask)||JSON.stringify(s.goals)!==JSON.stringify(c.goals)||!uint(s.seed)||!uint(s.rng)||!uint(s.score)||!uint(s.nextId)||s.nextId<1||!uint(s.shuffles)||!uint(s.moves)||!uint(s.usedMoves)||s.moves+s.usedMoves!==c.moves||!s.tools||Object.keys(s.tools).length!==4||['hammer','row','col','shuffle'].some(t=>![0,1].includes(s.tools[t]))||s.hammer!==s.tools.hammer||s.turn!==s.usedMoves+Object.values(s.tools).filter(n=>n===0).length)return false;
  if(!Array.isArray(s.board)||s.board.length!==56||!Array.isArray(s.crates)||s.crates.length!==56||s.crates.some((hp,i)=>!Number.isInteger(hp)||hp<0||hp>c.crates[i])||!Array.isArray(s.mud)||s.mud.length!==56||s.mud.some((v,i)=>!Number.isInteger(v)||v<0||v>c.mud[i])||!Array.isArray(s.collected)||s.collected.length!==5||s.collected.some(n=>!uint(n)))return false;
  if(s.cratesCleared!==c.crates.filter(Boolean).length-s.crates.filter(Boolean).length||s.mudCleared!==c.mud.reduce((a,b)=>a+b,0)-s.mud.reduce((a,b)=>a+b,0))return false;
  const ids=new Set();for(let i=0;i<56;i++){const p=s.board[i];if(!free(s,i)){if(p!==null)return false;continue;}if(!p||!/^t\d+$/.test(p.id)||Number(p.id.slice(1))>=s.nextId||ids.has(p.id)||!(p.power===null||M3_POWERS.includes(p.power))||p.power&&p.color!==null||!p.power&&(!Number.isInteger(p.color)||p.color<0||p.color>=s.colors))return false;ids.add(p.id);}
  if(m3FindMatches(s.board).length)return false;const status=m3Won(s)?'won':s.moves===0?'lost':'playing';return s.status===status&&(status!=='playing'||m3AvailableMoves(s).length>0);
}
