import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {HuntRound,HIDE_MS,HUNT_MS,RESULT_MS,canHuntMove,transform} from '../hunt.js';
import {SPAWNS,blocked,rayBox} from '../public/world.js';
import {DECOR_PROPS,propBounds,propBlocked} from '../public/props.js';
const reset=p=>Object.assign(p,{hp:100,input:{}});
function setup(){const match=new HuntRound(),members=Array.from({length:4},(_,id)=>({id,hp:100,wins:0}));match.tick(members,0,reset);return {match,members};}
test('rounds wait for players, restrict hunters during hiding, and swap roles',()=>{
  const solo=[{id:0,hp:100}],waiting=new HuntRound();waiting.tick(solo,999999,reset);assert.equal(waiting.phase,'waiting');
  const {match,members}=setup();assert.equal(match.phase,'hide');assert.equal(match.remaining,HIDE_MS);
  assert.equal(members[0].role,'hunter');assert.equal(canHuntMove(members[0],match),false);assert.equal(canHuntMove(members[1],match),true);
  match.tick(members,HIDE_MS,reset);assert.equal(match.phase,'hunt');assert.equal(canHuntMove(members[0],match),true);
  match.tick(members,HUNT_MS,reset);assert.equal(match.phase,'result');assert.equal(match.winner,'hider');assert.equal(members[1].wins,1);assert.equal(members[0].wins,0);
  match.tick(members,RESULT_MS,reset);assert.equal(match.round,2);assert.equal(members[1].role,'hunter');assert.equal(members[0].role,'hider');
});
test('elimination, hunter disconnect, and empty team resolve the round',()=>{
  const {match,members}=setup();match.tick(members,HIDE_MS,reset);
  for(const p of members.slice(1))p.hp=0;
  match.tick(members,1,reset);assert.equal(match.winner,'hunter');assert.equal(members[0].wins,1);
  match.tick(members,1,reset);assert.equal(members[0].wins,1);
  const other=setup();other.match.tick(other.members.slice(1),1,reset);assert.equal(other.match.winner,'hider');
  other.match.tick(other.members.slice(0,1),1,reset);assert.equal(other.match.phase,'waiting');
});
test('only living hiders can transform, with a cooldown and three shapes',()=>{
  const {match,members}=setup(),p=members[1];const original=p.shape;
  assert.equal(transform(members[0],match,1000),false);
  assert.equal(transform(p,match,1000),true);assert.equal(p.shape,(original+1)%3);
  assert.equal(transform(p,match,1100),false);assert.equal(transform(p,match,1800),true);
  transform(p,match,2600);assert.equal(p.shape,original);
  p.hp=0;assert.equal(transform(p,match,3400),false);assert.equal(canHuntMove(p,match),false);
});
test('clues recur every 20 seconds during hunt and not during hiding',()=>{
  const {match,members}=setup();match.tick(members,HIDE_MS-1,reset);assert.equal(match.hint,false);
  match.tick(members,1,reset);match.tick(members,19999,reset);assert.equal(match.hint,false);
  match.tick(members,1,reset);assert.equal(match.hint,true);match.tick(members,1,reset);assert.equal(match.hint,false);
});
test('props have shootable dimensions, clear positions, and viable spawn locations',()=>{
  for(const p of DECOR_PROPS){assert.equal(blocked(p.x,p.z),false);assert.equal(propBlocked(p.x,p.z),true);assert.ok(Number.isFinite(rayBox([p.x,.5,p.z+3],[0,0,-1],...propBounds(p))));}
  assert.ok(SPAWNS.filter(([x,z])=>!propBlocked(x,z)).length>=12);
});
test('hunt rooms isolate modes, hide positions, block premature shots, and accept transformation',{timeout:10000},async()=>{
  const proc=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3103'},stdio:['ignore','pipe','pipe']});const sockets=[];
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function until(fn){const end=Date.now()+4000;while(!fn()){if(Date.now()>end)throw Error('timed out');await wait(25);}}
  try{
    let error='';proc.stderr.on('data',d=>error+=d);await new Promise((resolve,reject)=>{proc.stdout.once('data',resolve);proc.once('error',reject);proc.once('exit',()=>reject(Error(error)));});
    async function join(mode){const ws=new WebSocket('ws://localhost:3103');sockets.push(ws);const c={ws};ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome')c.id=m.id;if(m.type==='state')c.state=m;});await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'join',mode,room:'same',name:'Test'}));await until(()=>c.state);return c;}
    const a=await join('hunt');assert.equal(a.state.match.phase,'waiting');
    const arena=await join('online');assert.equal(arena.state.players.length,1);assert.equal(arena.state.match,undefined);
    const b=await join('hunt');await until(()=>a.state.match.phase==='hide');
    const me=c=>c.state.players.find(p=>p.id===c.id);
    assert.equal(me(a).role,'hunter');assert.equal(me(b).role,'hider');assert.equal(a.state.players.find(p=>p.id===b.id).x,null);
    const start={x:me(a).x,z:me(a).z};a.ws.send(JSON.stringify({type:'input',forward:true,fire:true,transform:true}));await wait(200);
    assert.equal(me(a).ammo,24);assert.equal(me(a).x,start.x);assert.equal(me(a).z,start.z);
    const shape=me(b).shape;b.ws.send(JSON.stringify({type:'input',transform:true,fire:true}));await until(()=>me(b).shape!==shape);assert.equal(me(b).ammo,24);
    const late=await join('hunt');assert.equal(me(late).role,'spectator');assert.equal(late.state.match.phase,'hide');
    a.ws.close();await until(()=>b.state.match.phase==='result');assert.equal(b.state.match.winner,'hider');
    const practice=await join('hunt-practice');assert.equal(practice.state.players.length,4);assert.equal(practice.state.match.phase,'waiting');
    practice.ws.send(JSON.stringify({type:'input',active:true}));await until(()=>practice.state.match.phase==='hide');
    practice.ws.send(JSON.stringify({type:'input',active:false}));await wait(100);const time=practice.state.match.remaining;await wait(200);assert.equal(practice.state.match.remaining,time);
  }finally{for(const ws of sockets)ws.close();proc.kill();}
});
