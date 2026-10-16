export const M3_WIDTH=7;
export const M3_HEIGHT=8;
export const M3_COUNT=M3_WIDTH*M3_HEIGHT;
export const M3_COLORS=[{id:'leaf',name:'绿叶'},{id:'berry',name:'红莓'},{id:'sun',name:'星星'},{id:'drop',name:'水滴'},{id:'flower',name:'紫花'}];
export const M3_POWERS=['row','col','bomb','orb'];
const m3ColorGoal=(color,target)=>({kind:'color',color,target});
const m3MudGoal=target=>({kind:'mud',target});
const M3_LEVELS=[
  [18,4,[m3ColorGoal(0,10),m3ColorGoal(2,10)]],
  [20,4,[m3ColorGoal(1,14),m3ColorGoal(3,12)]],
  [20,4,[m3ColorGoal(0,16),m3ColorGoal(1,14)]],
  [22,5,[m3MudGoal(12),m3ColorGoal(2,12)]],
  [24,5,[m3MudGoal(16),m3ColorGoal(3,14)]],
  [24,5,[m3ColorGoal(4,16),m3ColorGoal(0,18)]],
  [26,5,[m3MudGoal(20),m3ColorGoal(1,16)]],
  [28,5,[m3MudGoal(24),m3ColorGoal(3,18)]],
  [24,5,[m3MudGoal(12),m3ColorGoal(3,18)]],
  [24,5,[m3ColorGoal(0,18),m3ColorGoal(4,18)]],
  [26,5,[m3MudGoal(16),m3ColorGoal(2,18)]],
  [26,5,[m3MudGoal(20),m3ColorGoal(3,18)]],
  [28,5,[m3MudGoal(24),m3ColorGoal(3,22)]],
  [26,5,[m3ColorGoal(0,22),m3ColorGoal(4,20)]],
  [28,5,[m3MudGoal(20),m3ColorGoal(0,20)]],
  [29,5,[m3MudGoal(26),m3ColorGoal(0,22)]],
  [27,5,[m3ColorGoal(1,22),m3ColorGoal(2,22)]],
  [28,5,[m3MudGoal(22),m3ColorGoal(1,22)]],
  [30,5,[m3MudGoal(26),m3ColorGoal(3,24)]],
  [30,5,[m3MudGoal(30),m3ColorGoal(4,24)]]
];
export function m3LevelConfig(level){const entry=M3_LEVELS[level-1];if(!entry)throw Error('Unknown match-three level');return{level,moves:entry[0],colors:entry[1],goals:structuredClone(entry[2])};}
const m3Row=i=>Math.floor(i/M3_WIDTH),m3Col=i=>i%M3_WIDTH;
const m3IndexOK=i=>Number.isInteger(i)&&i>=0&&i<M3_COUNT;
export const m3Adjacent=(a,b)=>m3IndexOK(a)&&m3IndexOK(b)&&Math.abs(m3Row(a)-m3Row(b))+Math.abs(m3Col(a)-m3Col(b))===1;
function m3Random(state){state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;}
const m3Piece=(state,color,power=null)=>({id:`t${state.nextId++}`,color,power});
function m3NormalBoard(state){const board=[];for(let i=0;i<M3_COUNT;i++){const choices=Array.from({length:state.colors},(_,c)=>c).filter(c=>!(m3Col(i)>1&&board[i-1].color===c&&board[i-2].color===c)&&!(m3Row(i)>1&&board[i-M3_WIDTH].color===c&&board[i-2*M3_WIDTH].color===c));board.push(m3Piece(state,choices[Math.floor(m3Random(state)*choices.length)]));}return board;}
export function m3FindMatches(board){
  const lines=[];
  for(const axis of ['row','col']){const outer=axis==='row'?M3_HEIGHT:M3_WIDTH,inner=axis==='row'?M3_WIDTH:M3_HEIGHT;for(let o=0;o<outer;o++){let start=0;while(start<inner){const at=k=>axis==='row'?o*M3_WIDTH+k:k*M3_WIDTH+o,index=at(start),color=board[index]?.color;let end=start+1;if(color!==null&&color!==undefined)while(end<inner&&board[at(end)]?.color===color)end++;if(color!==null&&color!==undefined&&end-start>=3)lines.push({axis,color,cells:Array.from({length:end-start},(_,n)=>at(start+n))});start=end;}}}
  const groups=[];
  for(const line of lines){const overlaps=groups.filter(g=>g.color===line.color&&line.cells.some(i=>g.cells.includes(i)));if(!overlaps.length){groups.push({color:line.color,cells:[...line.cells],lines:[line]});continue;}const first=overlaps[0];first.cells=[...new Set([...first.cells,...line.cells,...overlaps.slice(1).flatMap(g=>g.cells)])];first.lines.push(line,...overlaps.slice(1).flatMap(g=>g.lines));for(const other of overlaps.slice(1))groups.splice(groups.indexOf(other),1);}
  return groups;
}
export function m3Goals(state){return state.goals.map(g=>{const collected=g.kind==='mud'?state.mudCleared:state.collected[g.color];return{...g,collected,remaining:Math.max(0,g.target-collected),done:collected>=g.target};});}
export const m3Won=state=>m3Goals(state).every(g=>g.done);
function m3PowerFor(group){if(group.lines.some(l=>l.cells.length>=5))return'orb';if(group.lines.some(l=>l.axis==='row')&&group.lines.some(l=>l.axis==='col'))return'bomb';const four=group.lines.find(l=>l.cells.length===4);return four?.axis||null;}
const m3FullRow=i=>Array.from({length:M3_WIDTH},(_,c)=>m3Row(i)*M3_WIDTH+c);
const m3FullCol=i=>Array.from({length:M3_HEIGHT},(_,r)=>r*M3_WIDTH+m3Col(i));
function m3Area(i,radius){const out=[];for(let r=Math.max(0,m3Row(i)-radius);r<=Math.min(M3_HEIGHT-1,m3Row(i)+radius);r++)for(let c=Math.max(0,m3Col(i)-radius);c<=Math.min(M3_WIDTH-1,m3Col(i)+radius);c++)out.push(r*M3_WIDTH+c);return out;}
function m3MostColor(board){const counts=Array(M3_COLORS.length).fill(0);for(const p of board)if(p?.color!==null&&p?.color!==undefined)counts[p.color]++;return counts.indexOf(Math.max(...counts));}
function m3PowerCells(board,index,power,color){if(power==='row')return m3FullRow(index);if(power==='col')return m3FullCol(index);if(power==='bomb')return m3Area(index,1);const target=color??m3MostColor(board);return board.flatMap((p,i)=>p?.color===target?[i]:[]).concat(index);}
function m3TargetScore(state,indices){let score=0;for(const i of new Set(indices)){if(state.mud[i])score+=3;const color=state.board[i]?.color;if(color!==null&&state.goals.some(g=>g.kind==='color'&&g.color===color&&state.collected[color]<g.target))score+=2;score+=.35;}return score;}
export function m3AvailableMoves(state){
  const moves=[];
  for(let i=0;i<M3_COUNT;i++){
    const p=state.board[i];if(p?.power)moves.push({type:'ACTIVATE',index:i,score:m3TargetScore(state,m3PowerCells(state.board,i,p.power))+2});
    for(const j of [i+1,i+M3_WIDTH]){if(!m3Adjacent(i,j))continue;const q=state.board[j];if(p?.power||q?.power){moves.push({type:'SWAP',a:i,b:j,score:p?.power&&q?.power?30:3});continue;}const board=state.board.slice();[board[i],board[j]]=[board[j],board[i]];const groups=m3FindMatches(board);if(!groups.length)continue;const score=m3TargetScore({...state,board},groups.flatMap(g=>g.cells))+groups.reduce((n,g)=>n+(m3PowerFor(g)?5:0),0);moves.push({type:'SWAP',a:i,b:j,score});}
  }
  return moves.sort((a,b)=>b.score-a.score);
}
export function m3Hint(state){return state.status==='playing'?m3AvailableMoves(state)[0]||null:null;}
function m3Remix(state){
  const original=state.board.slice();
  for(let attempt=0;attempt<100;attempt++){const board=original.slice();for(let i=board.length-1;i>0;i--){const j=Math.floor(m3Random(state)*(i+1));[board[i],board[j]]=[board[j],board[i]];}state.board=board;if(!m3FindMatches(board).length&&m3AvailableMoves(state).length){state.shuffles++;return;}}
  do{state.board=m3NormalBoard(state);}while(!m3AvailableMoves(state).length);state.shuffles++;
}
export function m3Create(level,{seed=1,runId=`level-${level}-${seed}`}={}){
  const config=m3LevelConfig(level),mudCount=config.goals.find(g=>g.kind==='mud')?.target||0;
  const state={version:1,level,runId,seed:seed>>>0,rng:seed>>>0,nextId:1,colors:config.colors,moves:config.moves,usedMoves:0,turn:0,board:[],mud:Array(M3_COUNT).fill(0),goals:config.goals,collected:Array(M3_COLORS.length).fill(0),mudCleared:0,score:0,hammer:1,shuffles:0,status:'playing'};
  const muddy=Array.from({length:M3_COUNT},(_,i)=>i).sort((a,b)=>(Math.abs(m3Row(a)-4)+Math.abs(m3Col(a)-3))-(Math.abs(m3Row(b)-4)+Math.abs(m3Col(b)-3)));
  muddy.slice(0,mudCount).forEach(i=>state.mud[i]=1);state.board=m3NormalBoard(state);if(!m3AvailableMoves(state).length)m3Remix(state);return state;
}
function m3Snapshot(state){return{board:structuredClone(state.board),mud:[...state.mud],collected:[...state.collected],mudCleared:state.mudCleared,score:state.score,moves:state.moves,hammer:state.hammer};}
function m3Clear(state,initial,groups,preferred,wave,frames,options={}){
  const pending=[...new Set(initial)],clear=new Set(pending),triggered=new Set(options.skipPowers||[]),activated=[],made=[];
  for(const group of groups){const power=m3PowerFor(group);if(!power)continue;const index=preferred.find(i=>group.cells.includes(i))??group.cells[Math.floor(group.cells.length/2)];made.push({index,power});}
  for(let n=0;n<pending.length;n++){const index=pending[n],p=state.board[index];if(!p?.power||triggered.has(index))continue;triggered.add(index);activated.push({index,power:p.power});const blast=m3PowerCells(state.board,index,p.power,options.orbColor);for(const i of blast)if(!clear.has(i)){clear.add(i);pending.push(i);}}
  for(const index of clear){const p=state.board[index];if(p?.color!==null&&p?.color!==undefined)state.collected[p.color]++;if(state.mud[index]){state.mud[index]=0;state.mudCleared++;}state.board[index]=null;}
  for(const {index,power}of made)state.board[index]=m3Piece(state,null,power);
  state.score+=clear.size*50*wave+made.length*150;frames.push({type:'clear',indices:[...clear],activated,made,wave,combo:options.combo||null,...m3Snapshot(state)});
}
function m3Drop(state,frames){const falls=[];for(let col=0;col<M3_WIDTH;col++){let dest=M3_HEIGHT-1;for(let row=M3_HEIGHT-1;row>=0;row--){const from=row*M3_WIDTH+col,piece=state.board[from];if(!piece)continue;const to=dest*M3_WIDTH+col;state.board[to]=piece;if(to!==from)state.board[from]=null;falls.push({id:piece.id,from,to});dest--;}for(let row=dest;row>=0;row--){const to=row*M3_WIDTH+col,piece=m3Piece(state,Math.floor(m3Random(state)*state.colors));state.board[to]=piece;falls.push({id:piece.id,from:(row-dest-2)*M3_WIDTH+col,to});}}frames.push({type:'drop',falls,...m3Snapshot(state)});}
const m3Fail=(state,message,frames=[])=>({ok:false,state,message,frames});
export function m3Move(state,action){
  if(state.status!=='playing')return m3Fail(state,'这一局已经结束了。');
  const next=structuredClone(state),frames=[];let groups=[],seeds=[],options={},preferred=[];
  if(action.type==='SWAP'){
    const{a,b}=action;if(!m3Adjacent(a,b))return m3Fail(state,'只能交换上下左右相邻的棋子。');const pa=state.board[a],pb=state.board[b];[next.board[a],next.board[b]]=[next.board[b],next.board[a]];preferred=[b,a];
    frames.push({type:'swap',a,b,...m3Snapshot(next)});
    if(pa.power||pb.power){seeds=pa.power&&pb.power?[a,b]:[pa.power?b:a];
      if(pa.power==='orb'&&pb.power==='orb'){seeds=Array.from({length:M3_COUNT},(_,i)=>i);options={skipPowers:[a,b],combo:'双彩球 · 全屏消除'};}
      else if(pa.power==='orb'||pb.power==='orb'){options.orbColor=pa.power==='orb'?pb.color:pa.color;}
      else if(pa.power&&pb.power){options.skipPowers=[a,b];if(pa.power==='bomb'&&pb.power==='bomb'){seeds.push(...m3Area(b,2));options.combo='双炸弹 · 大范围消除';}else if(pa.power==='bomb'||pb.power==='bomb'){for(const c of m3Area(b,1))seeds.push(...m3FullRow(c),...m3FullCol(c));options.combo='火箭与炸弹 · 三行三列';}else{seeds.push(...m3FullRow(b),...m3FullCol(b));options.combo='双火箭 · 十字消除';}}
    }else{groups=m3FindMatches(next.board);if(!groups.length)return m3Fail(state,'没有连成三个，交换已撤回，不扣步数。',frames);seeds=groups.flatMap(g=>g.cells);}
    next.moves--;next.usedMoves++;
  }else if(action.type==='ACTIVATE'){
    if(!m3IndexOK(action.index)||!next.board[action.index]?.power)return m3Fail(state,'点击火箭、炸弹或彩球来触发。');seeds=[action.index];next.moves--;next.usedMoves++;
  }else if(action.type==='HAMMER'){
    if(!next.hammer||!m3IndexOK(action.index))return m3Fail(state,'本局的小锤已经用完了。');next.hammer--;seeds=[action.index];
  }else return m3Fail(state,'未知操作。');
  next.turn++;let wave=0;
  while(seeds.length){wave++;m3Clear(next,seeds,groups,preferred,wave,frames,options);m3Drop(next,frames);groups=m3FindMatches(next.board);seeds=groups.flatMap(g=>g.cells);preferred=[];options={};if(wave>=40&&seeds.length){next.board=m3NormalBoard(next);if(!m3AvailableMoves(next).length)m3Remix(next);frames.push({type:'shuffle',...m3Snapshot(next)});break;}}
  next.status=m3Won(next)?'won':next.moves===0?'lost':'playing';
  if(next.status==='playing'&&!m3AvailableMoves(next).length){m3Remix(next);frames.push({type:'shuffle',...m3Snapshot(next)});}
  return{ok:true,state:next,frames,waves:wave};
}
export function m3Valid(state){
  if(!state||state.version!==1||!Number.isInteger(state.level)||state.level<1||state.level>20||typeof state.runId!=='string'||!state.runId||state.runId.length>140)return false;
  const config=m3LevelConfig(state.level);if(state.colors!==config.colors||JSON.stringify(state.goals)!==JSON.stringify(config.goals)||!Number.isInteger(state.moves)||state.moves<0||state.moves>config.moves||!Number.isInteger(state.usedMoves)||state.moves+state.usedMoves!==config.moves||![0,1].includes(state.hammer)||state.turn!==state.usedMoves+(1-state.hammer)||!Array.isArray(state.board)||state.board.length!==M3_COUNT||!Array.isArray(state.mud)||state.mud.length!==M3_COUNT||state.mud.some(n=>n!==0&&n!==1)||!Array.isArray(state.collected)||state.collected.length!==5||state.collected.some(n=>!Number.isInteger(n)||n<0)||!Number.isInteger(state.nextId)||!Number.isInteger(state.rng)||state.rng<0||state.rng>4294967295||!Number.isInteger(state.seed)||state.seed<0||state.seed>4294967295||!Number.isInteger(state.mudCleared)||state.mudCleared<0||!Number.isInteger(state.score)||state.score<0||!Number.isInteger(state.shuffles)||state.shuffles<0)return false;
  if(state.mud.reduce((a,b)=>a+b,0)+state.mudCleared!==(config.goals.find(g=>g.kind==='mud')?.target||0))return false;
  const ids=new Set();for(const p of state.board){if(!p||typeof p.id!=='string'||!/^t\d+$/.test(p.id)||Number(p.id.slice(1))>=state.nextId||ids.has(p.id)||!(p.power===null||M3_POWERS.includes(p.power))||p.power&&p.color!==null||!p.power&&(!Number.isInteger(p.color)||p.color<0||p.color>=state.colors))return false;ids.add(p.id);}
  if(m3FindMatches(state.board).length)return false;
  const status=m3Won(state)?'won':state.moves===0?'lost':'playing';if(state.status!==status)return false;return status!=='playing'||m3AvailableMoves(state).length>0;
}
