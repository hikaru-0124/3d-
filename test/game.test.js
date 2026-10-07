import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {move,blocked,rayBox} from '../public/world.js';
test('movement respects obstacles, boundaries and normalized diagonal speed',()=>{assert.equal(blocked(0,0),true);assert.equal(blocked(24,0),true);const p={x:20,z:0,yaw:0};move(p,{forward:true,right:true},1);assert.ok(Math.hypot(p.x-20,p.z)<=7.001);assert.equal(rayBox([0,1,5],[0,0,-1],[-1,0,-1],[1,2,1]),4);assert.equal(rayBox([5,1,5],[0,0,-1],[-1,0,-1],[1,2,1]),Infinity);});
test('multiplayer room isolation, damage, scoring, respawn and disconnect',{timeout:35000},async()=>{const proc=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3101'},stdio:['ignore','pipe','pipe']});const sockets=[];let timer;try{await new Promise((resolve,reject)=>{proc.stdout.once('data',resolve);proc.once('error',reject);proc.once('exit',()=>reject(Error('server exited')));});const health=await fetch('http://localhost:3101/health');assert.equal(health.status,200);
async function connect(room){const ws=new WebSocket('ws://localhost:3101');sockets.push(ws);const c={ws,state:null,id:null,shots:0};ws.on('message',data=>{const m=JSON.parse(data);if(m.type==='shot'&&m.id===c.id)c.shots++;if(m.type==='welcome')c.id=m.id;if(m.type==='state')c.state=m.players;});await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'join',name:'Test',room}));return c;}
async function until(fn,ms=5000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('condition timed out');await new Promise(r=>setTimeout(r,30));}}
const a=await connect('battle'),b=await connect('battle'),c=await connect('other');await until(()=>a.state?.length===2&&b.state?.length===2&&c.state?.length===1);assert.equal(c.state[0].id,c.id);
// Shooting must not cancel protection, even while players are in different rooms.
b.ws.send(JSON.stringify({type:'input',fire:true,yaw:0,pitch:1.3}));
await until(()=>b.state.find(p=>p.id===b.id).ammo<24);assert.equal(b.state.find(p=>p.id===b.id).shield,true);
b.ws.send(JSON.stringify({type:'input',fire:false}));
a.ws.send(JSON.stringify({type:'input',fire:true,yaw:0,pitch:1.3}));
await until(()=>a.shots>=2);
a.ws.send(JSON.stringify({type:'input',fire:false}));
assert.equal(a.state.find(p=>p.id===b.id).shield,true);assert.equal(a.state.find(p=>p.id===b.id).hp,100);
// Navigate real doorways rather than assuming an unobstructed outdoor lane.
const start=a.state.find(p=>p.id===a.id),opponent=a.state.find(p=>p.id===b.id);
const goal=[Math.round(opponent.x),Math.round(opponent.z)-4],queue=[[Math.round(start.x),Math.round(start.z)]],parents=new Map([[queue[0].join(','),null]]);
for(let i=0;i<queue.length&&!parents.has(goal.join(','));i++){
  const [x,z]=queue[i];
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const next=[x+dx,z+dz],key=next.join(',');
    if(!parents.has(key)&&!blocked(...next)){parents.set(key,[x,z]);queue.push(next);}
  }
}
assert.ok(parents.has(goal.join(',')),'opponent room is reachable');
const path=[];for(let point=goal;point;point=parents.get(point.join(',')))path.unshift(point);
let waypoint=1;
timer=setInterval(()=>{
  const p=a.state.find(p=>p.id===a.id);
  while(waypoint<path.length&&Math.hypot(p.x-path[waypoint][0],p.z-path[waypoint][1])<.35)waypoint++;
  if(waypoint===path.length){a.ws.send(JSON.stringify({type:'input',forward:false}));return;}
  const [x,z]=path[waypoint];a.ws.send(JSON.stringify({type:'input',forward:true,yaw:Math.atan2(p.x-x,p.z-z),pitch:0}));
},33);
await until(()=>waypoint===path.length,22000);clearInterval(timer);
timer=setInterval(()=>{const p=a.state.find(p=>p.id===a.id),q=a.state.find(p=>p.id===b.id);a.ws.send(JSON.stringify({type:'input',fire:true,yaw:Math.atan2(-(q.x-p.x),-(q.z-p.z)),pitch:0}));},33);
await until(()=>a.state.find(p=>p.id===a.id).kills===1);clearInterval(timer);a.ws.send(JSON.stringify({type:'input',fire:false,yaw:0,pitch:0}));assert.equal(a.state.find(p=>p.id===b.id).deaths,1);await until(()=>a.state.find(p=>p.id===b.id).hp===100);const respawned=a.state.find(p=>p.id===b.id);assert.equal(respawned.shield,true);assert.ok(respawned.shieldMs>4800);assert.ok(Math.hypot(respawned.x-a.state.find(p=>p.id===a.id).x,respawned.z-a.state.find(p=>p.id===a.id).z)>=8);b.ws.close();await until(()=>a.state.length===1);
}finally{clearInterval(timer);for(const ws of sockets)ws.close();proc.kill();}});
