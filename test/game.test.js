import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {move,blocked,rayBox} from '../public/world.js';
test('movement respects obstacles, boundaries and normalized diagonal speed',()=>{assert.equal(blocked(0,0),true);assert.equal(blocked(24,0),true);const p={x:20,z:0,yaw:0};move(p,{forward:true,right:true},1);assert.ok(Math.hypot(p.x-20,p.z)<=7.001);assert.equal(rayBox([0,1,5],[0,0,-1],[-1,0,-1],[1,2,1]),4);assert.equal(rayBox([5,1,5],[0,0,-1],[-1,0,-1],[1,2,1]),Infinity);});
test('multiplayer room isolation, damage, scoring, respawn and disconnect',{timeout:15000},async()=>{const proc=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3101'},stdio:['ignore','pipe','pipe']});const sockets=[];try{await new Promise((resolve,reject)=>{proc.stdout.once('data',resolve);proc.once('error',reject);proc.once('exit',()=>reject(Error('server exited')));});const health=await fetch('http://localhost:3101/health');assert.equal(health.status,200);
async function connect(room){const ws=new WebSocket('ws://localhost:3101');sockets.push(ws);const c={ws,state:null,id:null};ws.on('message',data=>{const m=JSON.parse(data);if(m.type==='welcome')c.id=m.id;if(m.type==='state')c.state=m.players;});await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'join',name:'Test',room}));return c;}
async function until(fn,ms=5000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('condition timed out');await new Promise(r=>setTimeout(r,30));}}
const a=await connect('battle'),b=await connect('battle'),c=await connect('other');await until(()=>a.state?.length===2&&b.state?.length===2&&c.state?.length===1);assert.equal(c.state[0].id,c.id);
// Travel around the perimeter to establish a clear shot down the east lane.
let timer=setInterval(()=>{a.ws.send(JSON.stringify({type:'input',right:true,yaw:0,pitch:0}));},33);await until(()=>a.state.find(p=>p.id===a.id).x>=19.7,7000);clearInterval(timer);
timer=setInterval(()=>{const p=a.state.find(p=>p.id===a.id),q=a.state.find(p=>p.id===b.id);a.ws.send(JSON.stringify({type:'input',fire:true,yaw:Math.atan2(-(q.x-p.x),-(q.z-p.z)),pitch:0}));},33);
await until(()=>a.state.find(p=>p.id===a.id).kills===1);clearInterval(timer);a.ws.send(JSON.stringify({type:'input',fire:false,yaw:0,pitch:0}));assert.equal(a.state.find(p=>p.id===b.id).deaths,1);await until(()=>a.state.find(p=>p.id===b.id).hp===100);b.ws.close();await until(()=>a.state.length===1);
}finally{for(const ws of sockets)ws.close();proc.kill();}});
