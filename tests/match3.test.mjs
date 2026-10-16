import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../dist/match3.mjs';
import * as j from '../dist/journey-match.mjs';
import * as g from '../dist/homecoming.mjs';
const at=(r,c)=>r*m.M3_WIDTH+c;
const apply=(s,a)=>{const result=m.m3Move(s,a);assert.ok(result.ok,result.message);assert.ok(m.m3Valid(result.state));return result;};
function fixture(){const s=m.m3Create(4,{seed:812});s.board=s.board.map((p,i)=>({...p,color:(Math.floor(i/7)*2+i%7)%5,power:null}));return s;}
function color(s,r,c,v){s.board[at(r,c)]={...s.board[at(r,c)],color:v,power:null};}
function power(s,r,c,p){s.board[at(r,c)]={...s.board[at(r,c)],color:null,power:p};}
function win(session){let game=session.game;for(let n=0;n<45&&game.status==='playing';n++)game=apply(game,m.m3Hint(game)).state;return{...session,game};}

test('all twenty levels start settled, have legal moves, and restore exactly from a serialized save',()=>{
  for(let level=1;level<=20;level++)for(const seed of [0,41,20261016+level]){const s=m.m3Create(level,{seed});assert.equal(s.board.length,56);assert.equal(m.m3FindMatches(s.board).length,0);assert.ok(m.m3AvailableMoves(s).length);assert.ok(m.m3Valid(s));assert.deepEqual(m.m3Create(level,{seed}),s);assert.deepEqual(JSON.parse(JSON.stringify(s)),s);}
});
test('a failed swap or non-adjacent exchange changes neither moves, RNG, score, nor goals',()=>{
  const s=m.m3Create(1,{seed:25}),before=JSON.stringify(s),legal=new Set(m.m3AvailableMoves(s).filter(a=>a.type==='SWAP').map(a=>`${a.a},${a.b}`));let bad;
  for(let i=0;i<56&&!bad;i++)for(const k of [i+1,i+7])if(m.m3Adjacent(i,k)&&!legal.has(`${i},${k}`)){bad={type:'SWAP',a:i,b:k};break;}
  assert.ok(bad);assert.equal(m.m3Move(s,bad).ok,false);assert.equal(m.m3Move(s,{type:'SWAP',a:6,b:7}).ok,false);assert.equal(m.m3Move(s,{type:'SWAP',a:0,b:55}).ok,false);assert.equal(JSON.stringify(s),before);
});
test('a successful move pays one step for every cascade and preserves a stable playable board',()=>{
  const s=m.m3Create(1,{seed:20261017}),r=apply(s,m.m3Hint(s));assert.equal(r.state.moves,s.moves-1);assert.equal(r.state.usedMoves,1);assert.equal(r.state.turn,1);assert.ok(r.frames.some(f=>f.type==='clear'));assert.ok(r.frames.some(f=>f.type==='drop'));assert.equal(m.m3FindMatches(r.state.board).length,0);assert.ok(r.state.score>0);assert.equal(s.usedMoves,0);
});
test('horizontal four makes a row rocket at the destination and five makes a color orb',()=>{
  for(const length of [4,5]){const s=fixture();for(let c=1;c<=length;c++)color(s,3,c,c===3?1:0);color(s,2,3,0);assert.equal(m.m3FindMatches(s.board).length,0);const r=apply(s,{type:'SWAP',a:at(2,3),b:at(3,3)}),first=r.frames.find(f=>f.type==='clear');assert.ok(first.made.some(p=>p.index===at(3,3)&&p.power===(length===4?'row':'orb')));assert.ok(r.state.collected[0]>=length);}
});
test('vertical four makes a column rocket and a connected T shape makes one bomb',()=>{
  let s=fixture();for(const r of [1,2,4])color(s,r,3,0);color(s,3,3,1);color(s,3,2,0);assert.equal(m.m3FindMatches(s.board).length,0);let result=apply(s,{type:'SWAP',a:at(3,2),b:at(3,3)});assert.ok(result.frames.find(f=>f.type==='clear').made.some(p=>p.power==='col'));
  s=fixture();for(const[r,c]of[[3,2],[3,4],[4,3],[5,3],[2,3]])color(s,r,c,0);color(s,3,3,1);color(s,6,3,2);assert.equal(m.m3FindMatches(s.board).length,0);result=apply(s,{type:'SWAP',a:at(2,3),b:at(3,3)});const made=result.frames.find(f=>f.type==='clear').made;assert.equal(made.length,1);assert.equal(made[0].power,'bomb');
});
test('rocket blasts chain into another special exactly once and a bomb clears a 3 by 3 area',()=>{
  let s=fixture();power(s,3,3,'row');power(s,3,5,'col');let r=apply(s,{type:'ACTIVATE',index:at(3,3)}),first=r.frames.find(f=>f.type==='clear');assert.equal(first.indices.length,14);assert.equal(first.activated.length,2);assert.equal(new Set(first.indices).size,first.indices.length);
  s=fixture();power(s,3,3,'bomb');r=apply(s,{type:'ACTIVATE',index:at(3,3)});assert.equal(r.frames.find(f=>f.type==='clear').indices.length,9);
});
test('swapping a rocket with an ordinary tile leaves that tile intact outside the blast line',()=>{
  const s=fixture();power(s,3,3,'row');const r=apply(s,{type:'SWAP',a:at(3,3),b:at(4,3)}),first=r.frames.find(f=>f.type==='clear');assert.equal(first.indices.length,7);assert.equal(first.indices.includes(at(3,3)),false);
});
test('an orb swap collects exactly the swapped color before any fall cascades',()=>{
  const s=fixture();power(s,3,3,'orb');const target=s.board[at(3,4)].color,expected=s.board.filter(p=>p.color===target).length;const r=apply(s,{type:'SWAP',a:at(3,3),b:at(3,4)}),first=r.frames.find(f=>f.type==='clear');assert.equal(first.collected[target],expected);assert.equal(first.indices.length,expected+1);
});
test('special combinations clear cross, 5 by 5, three lines, and the full board',()=>{
  for(const [a,b,minimum,text]of[['row','col',14,'双火箭'],['bomb','bomb',25,'双炸弹'],['bomb','row',36,'火箭与炸弹'],['orb','orb',56,'双彩球']]){const s=fixture();power(s,3,2,a);power(s,3,3,b);const r=apply(s,{type:'SWAP',a:at(3,2),b:at(3,3)}),frame=r.frames.find(f=>f.type==='clear');assert.ok(frame.indices.length>=minimum);assert.ok(frame.combo.includes(text));}
});
test('mud is a fixed ground layer and each covered cell counts only once',()=>{
  const s=fixture();power(s,4,3,'bomb');const old=s.mud.reduce((a,b)=>a+b,0),r=apply(s,{type:'ACTIVATE',index:at(4,3)});assert.ok(r.state.mudCleared>0);assert.equal(r.state.mud.reduce((a,b)=>a+b,0)+r.state.mudCleared,old);assert.ok(r.state.mud.every((v,i)=>v<=s.mud[i]));
});
test('the once-per-level hammer costs no move and cannot be used twice',()=>{
  const s=m.m3Create(20,{seed:999}),r=apply(s,{type:'HAMMER',index:0});assert.equal(r.state.moves,s.moves);assert.equal(r.state.hammer,0);assert.equal(r.state.turn,1);assert.equal(m.m3Move(r.state,{type:'HAMMER',index:1}).ok,false);
});
test('a dead board reshuffles for free and grants no collection beyond the actual clear',()=>{
  const s=fixture();assert.equal(m.m3FindMatches(s.board).length,0);assert.equal(m.m3AvailableMoves(s).length,0);const r=apply(s,{type:'HAMMER',index:0});assert.ok(r.frames.some(f=>f.type==='shuffle'));assert.equal(r.state.moves,s.moves);assert.equal(r.state.collected.reduce((a,b)=>a+b,0),1);assert.equal(r.state.mudCleared,0);assert.ok(m.m3AvailableMoves(r.state).length);
});
test('finishing the target on the last move wins; unfinished targets on zero moves lose',()=>{
  let s=m.m3Create(1,{seed:41});s.moves=1;s.usedMoves=17;s.turn=17;s.collected=[9,0,10,0,0];power(s,3,3,'row');color(s,3,2,0);const won=apply(s,{type:'ACTIVATE',index:at(3,3)}).state;assert.equal(won.moves,0);assert.equal(won.status,'won');assert.equal(m.m3Move(won,{type:'HAMMER',index:0}).ok,false);
  s=m.m3Create(20,{seed:77});s.moves=1;s.usedMoves=29;s.turn=29;const lost=apply(s,m.m3Hint(s)).state;assert.equal(lost.status,'lost');assert.equal(lost.moves,0);assert.ok(m.m3Goals(lost).some(g=>g.remaining));
});
test('hint inspection is read-only and malformed saved boards are rejected',()=>{
  const s=m.m3Create(1,{seed:10}),raw=JSON.stringify(s);assert.ok(m.m3Hint(s));assert.equal(JSON.stringify(s),raw);assert.equal(m.m3Valid({...s,status:'won'}),false);assert.equal(m.m3Valid({...s,moves:100}),false);assert.equal(m.m3Valid({...s,board:s.board.slice(1)}),false);assert.equal(m.m3Valid({...s,board:s.board.map((p,i)=>i===1?s.board[0]:p)}),false);assert.equal(m.m3Valid({...s,mudCleared:4}),false);
});
test('only a real won session for the next region slot can award one chest',()=>{
  const journey=g.freshGame(),session=j.createJourneyMatch(journey,{seed:20261017,runId:'first-run'});assert.ok(j.matchSessionFits(journey,session));assert.equal(j.claimMatchBox(journey,session).ok,false);const completed=win(session);assert.equal(completed.game.status,'won');const award=j.claimMatchBox(journey,completed);assert.ok(award.ok);assert.equal(award.state.regions.camp.wins,1);assert.equal(award.state.regions.camp.opened,0);assert.equal(award.state.items.length,0);assert.equal(j.claimMatchBox(award.state,completed).ok,false);assert.equal(j.matchSessionFits(award.state,completed),false);assert.equal(j.sameMatchCheckpoint(journey,award.state),false);assert.equal(j.claimMatchBox(journey,{...completed,region:'river'}).ok,false);
});
test('saving a pending victory, returning midgame, and retrying do not mint rewards',()=>{
  const journey=g.freshGame(),session=j.createJourneyMatch(journey,{seed:20261017,runId:'saved-run'}),played={...session,game:apply(session.game,m.m3Hint(session.game)).state};const save=JSON.parse(JSON.stringify({state:journey,matchSession:played}));assert.ok(j.matchSessionFits(save.state,save.matchSession));assert.equal(save.state.regions.camp.wins,0);const completed=win(played),pending=JSON.parse(JSON.stringify(completed));assert.ok(j.matchSessionFits(journey,pending));assert.ok(j.claimMatchBox(journey,pending).ok);const retried=j.createJourneyMatch(journey,{seed:200,runId:'retry'});assert.equal(retried.game.level,1);assert.equal(j.claimMatchBox(journey,retried).ok,false);
});
test('the whole twenty-level match-three, chest, merge, and repair loop preserves material accounting',()=>{
  let state=g.freshGame(),wins=0,failures=0;
  for(let n=0;n<400&&!g.complete(state);n++){const h=g.nextStep(state);let result;
    if(h.type==='win'){let success=false;for(let attempt=0;attempt<8&&!success;attempt++){const level=j.journeyMatchLevel(state),session=win(j.createJourneyMatch(state,{seed:20261016+level+attempt*113414,runId:`journey-${level}-${attempt}`}));if(session.game.status==='won'){result=j.claimMatchBox(state,session);wins++;success=true;}else{assert.equal(j.claimMatchBox(state,session).ok,false);failures++;}}assert.ok(success,'A tested retry must be playable');}
    else if(h.type==='open')result=g.act(state,{type:'OPEN'});else if(h.type==='merge')result=g.act(state,{type:'MERGE',a:h.a,b:h.b});else if(h.type==='build')result=g.act(state,{type:'BUILD',id:h.id});else if(h.type==='finish')result=g.act(state,{type:'FINISH',recycle:true});else assert.fail(h.type);
    assert.ok(result.ok,result.message);state=result.state;assert.ok(g.validState(state));
  }
  assert.ok(g.complete(state));assert.equal(wins,20);assert.equal(state.supplies,4);assert.equal(j.createJourneyMatch(state),null);assert.ok(failures>=0);
});
