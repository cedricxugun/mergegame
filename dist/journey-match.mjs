import {progress,regionComplete,maxWins,act} from './homecoming-play.mjs';
import {m3Create,m3Valid,m3Won} from './match3-premium.mjs';

export function journeyMatchLevel(journey){return journey.region==='camp'?progress(journey).wins+1:8+progress(journey).wins+1;}
export function sameMatchCheckpoint(a,b){return a.region===b.region&&a.regions.camp.wins===b.regions.camp.wins&&(a.regions.river?.wins??null)===(b.regions.river?.wins??null);}
export function upgradeMatchSession(session){return session?.game.version===1&&session.game.turn===0?{...session,game:m3Create(session.game.level,{seed:session.game.seed,runId:session.game.runId})}:session;}
export function matchSessionFits(journey,session){return!!(session&&session.version===1&&session.region===journey.region&&session.winsBefore===progress(journey).wins&&!regionComplete(journey)&&progress(journey).wins<maxWins(journey)&&session.game?.level===journeyMatchLevel(journey)&&m3Valid(session.game));}
export function createJourneyMatch(journey,{seed,runId}={}){if(regionComplete(journey)||progress(journey).wins>=maxWins(journey))return null;return{version:1,region:journey.region,winsBefore:progress(journey).wins,game:m3Create(journeyMatchLevel(journey),{seed,runId})};}
export function claimMatchBox(journey,session){
  if(!matchSessionFits(journey,session))return{ok:false,state:journey,message:'这份通关奖励已经领取，或不属于当前关卡。'};
  if(session.game.status!=='won'||!m3Won(session.game))return{ok:false,state:journey,message:'完成全部三消目标后，才能带回素材箱。'};
  return act(journey,{type:'WIN'});
}
