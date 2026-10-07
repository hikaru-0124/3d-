import {PROP_TYPES} from './public/props.js';
export const HIDE_MS=20000,HUNT_MS=90000,RESULT_MS=8000;
export function canHuntMove(p,round){return p.hp>0&&(p.role==='hider'&&['hide','hunt'].includes(round.phase)||p.role==='hunter'&&round.phase==='hunt');}
export function transform(p,round,now){
  if(p.role!=='hider'||p.hp<=0||!['hide','hunt'].includes(round.phase)||now<(p.transformAt||0))return false;
  p.shape=(p.shape+1)%PROP_TYPES.length;p.transformAt=now+800;return true;
}
export class HuntRound {
  constructor(){this.phase='waiting';this.round=0;this.remaining=0;this.winner=null;this.hintIn=20000;this.hint=false;}
  start(members,spawn){
    this.round++;this.phase='hide';this.remaining=HIDE_MS;this.winner=null;this.hintIn=20000;
    const hunter=members[(this.round-1)%members.length];
    for(const p of members){
      spawn(p);Object.assign(p,{role:p===hunter?'hunter':'hider',shape:(this.round+members.indexOf(p))%PROP_TYPES.length,shieldMs:0,transformAt:0,lastShot:0,previous:null,escapeUntil:0});
    }
  }
  finish(winner,members){
    this.phase='result';this.remaining=RESULT_MS;this.winner=winner;
    for(const p of members){p.input={};if(p.role===winner)p.wins=(p.wins||0)+1;}
  }
  tick(members,elapsed,spawn){
    this.hint=false;
    if(members.length<2){this.phase='waiting';this.remaining=0;this.winner=null;for(const p of members){p.role='spectator';p.input={};}return;}
    if(this.phase==='waiting'){this.start(members,spawn);return;}
    this.remaining=Math.max(0,this.remaining-elapsed);
    if(this.phase==='result'){if(this.remaining===0)this.start(members,spawn);return;}
    if(!members.some(p=>p.role==='hider'&&p.hp>0)){this.finish('hunter',members);return;}
    if(!members.some(p=>p.role==='hunter'&&p.hp>0)){this.finish('hider',members);return;}
    if(this.phase==='hide'&&this.remaining===0){this.phase='hunt';this.remaining=HUNT_MS;return;}
    if(this.phase==='hunt'){
      if(this.remaining===0){this.finish('hider',members);return;}
      this.hintIn-=elapsed;if(this.hintIn<=0){this.hint=true;this.hintIn=20000;}
    }
  }
  snapshot(members){return {phase:this.phase,round:this.round,remaining:this.remaining,winner:this.winner,alive:members.filter(p=>p.role==='hider'&&p.hp>0).length,total:members.filter(p=>p.role==='hider').length,hintIn:this.hintIn};}
}
