import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';
import {MAGAZINE,RELOAD_MS,reload,updateWeapon,move} from '../public/world.js';

test('reload only completes at its deadline and cannot be extended by repeated requests',()=>{
  const p={hp:100,ammo:4,reloadUntil:0};
  reload(p,100);assert.equal(p.reloadUntil,100+RELOAD_MS);
  reload(p,500);assert.equal(p.reloadUntil,100+RELOAD_MS);
  updateWeapon(p,100+RELOAD_MS-1);assert.equal(p.ammo,4);
  updateWeapon(p,100+RELOAD_MS);assert.equal(p.ammo,MAGAZINE);assert.equal(p.reloadUntil,0);
  reload(p,2000);assert.equal(p.reloadUntil,0);
  p.hp=0;p.ammo=0;reload(p,2000);assert.equal(p.reloadUntil,0);
});
test('sprint is faster, normalized on diagonals, and respects walls',()=>{
  const a={x:20,z:0,yaw:0},b={...a};move(a,{forward:true},.1);move(b,{forward:true,sprint:true},.1);
  assert.ok(Math.abs(a.z+.7)<1e-10);assert.equal(b.z,-1);
  const c={x:20,z:0,yaw:0};move(c,{forward:true,left:true,sprint:true},.1);assert.ok(Math.abs(Math.hypot(c.x-20,c.z)-1)<1e-10);
  const d={x:23.4,z:0,yaw:0};move(d,{right:true,sprint:true},.1);assert.equal(d.x,23.4);
});

test('practice isolation, pause, bot movement, ammunition, reload and cleanup',{timeout:24000},async()=>{
  const proc=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3102'},stdio:['ignore','pipe','pipe']});
  const sockets=[];let timer,practiceTimer;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function until(fn,ms=4000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('condition timed out');await wait(25);}}
  try{
    let errors='';proc.stderr.on('data',chunk=>errors+=chunk);
    await new Promise((resolve,reject)=>{proc.stdout.once('data',resolve);proc.once('error',reject);proc.once('exit',()=>reject(Error(errors||'server exited')));});
    async function connect(mode){
      const ws=new WebSocket('ws://localhost:3102');sockets.push(ws);const c={ws};
      ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome')Object.assign(c,m);if(m.type==='state')c.players=m.players;});
      await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'join',name:'Pilot',room:'public',mode}));
      await until(()=>c.players);return c;
    }
    const a=await connect('practice'),b=await connect('practice'),c=await connect('online');
    assert.equal(a.players.length,4);assert.equal(a.players.filter(p=>p.bot).length,3);assert.notEqual(a.room,b.room);assert.equal(c.players.length,1);
    const me=()=>c.players.find(p=>p.id===c.id);
    const initial=a.players.map(p=>[p.x,p.z]);const shield=a.players.find(p=>p.id===a.id).shieldMs;await wait(200);assert.deepEqual(a.players.map(p=>[p.x,p.z]),initial);assert.equal(a.players.find(p=>p.id===a.id).shieldMs,shield);
    let input={active:true,sprint:true,fire:true,yaw:0,pitch:1.3};
    practiceTimer=setInterval(()=>a.ws.send(JSON.stringify({type:'input',active:true})),30);
    timer=setInterval(()=>c.ws.send(JSON.stringify({type:'input',...input})),30);
    await wait(250);assert.equal(me().ammo,MAGAZINE);
    await until(()=>a.players.some((p,i)=>p.bot&&(p.x!==initial[i][0]||p.z!==initial[i][1])),6500);
    clearInterval(practiceTimer);
    a.ws.send(JSON.stringify({type:'input',active:false}));
    input={active:true,fire:true,yaw:0,pitch:1.3};await until(()=>me().ammo<=22);
    input={active:true,reload:true,yaw:0,pitch:1.3};await until(()=>me().reload>0);
    input={active:true,yaw:0,pitch:1.3};await until(()=>me().ammo===MAGAZINE&&me().reload===0);
    // Shoot upward to test a full magazine without eliminating a bot.
    input={active:true,fire:true,yaw:0,pitch:1.3};await until(()=>me().ammo===0&&me().reload>0,6000);
    input={active:true,yaw:0,pitch:1.3};await until(()=>me().ammo===MAGAZINE&&me().reload===0);
    clearInterval(timer);a.ws.close();b.ws.close();c.ws.close();
    await until(()=>sockets.every(ws=>ws.readyState===WebSocket.CLOSED));
    const health=await fetch('http://localhost:3102/health').then(r=>r.json());assert.equal(health.players,0);
  }finally{clearInterval(timer);clearInterval(practiceTimer);for(const ws of sockets)ws.close();proc.kill();}
});
