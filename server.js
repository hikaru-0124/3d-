import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {WebSocketServer,WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
import {BOXES,SPAWNS,chooseSpawn,move,rayBox,MAGAZINE,SPAWN_PROTECTION_MS,reload,updateWeapon} from './public/world.js';

import {HuntRound,canHuntMove,transform} from './hunt.js';
import {DECOR_PROPS,propBounds,PROP_TYPES,propBlocked} from './public/props.js';
const hunts=new Map();
const port=Number(process.env.PORT)||3000,players=new Map();
const routes={'/':'public/index.html','/style.css':'public/style.css','/game.js':'public/game.js','/world.js':'public/world.js','/map-visuals.js':'public/map-visuals.js','/props.js':'public/props.js','/prop-visuals.js':'public/prop-visuals.js','/three.js':'node_modules/three/build/three.module.js','/three.core.js':'node_modules/three/build/three.core.js'};
const server=http.createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,players:[...players.values()].filter(p=>!p.bot).length}));}
    if(!routes[path]){res.writeHead(404);return res.end('Not found');}
    const data=await readFile(new URL(routes[path],import.meta.url));
    res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache'});res.end(data);
  }catch{res.writeHead(500);res.end('Server error');}
});
const wss=new WebSocketServer({server,maxPayload:2048});
const send=(ws,data)=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<65536)ws.send(JSON.stringify(data));};
const broadcast=(room,data)=>{for(const p of players.values())if(p.room===room)send(p.ws,data);};
function spawn(p){
  const others=[...players.values()].filter(v=>v!==p&&v.room===p.room&&v.hp>0);
  const pos=chooseSpawn(others,p.lastSpawn,p.hunt?SPAWNS.filter(([x,z])=>!propBlocked(x,z)):SPAWNS);p.lastSpawn=pos;
  Object.assign(p,{x:pos[0],z:pos[1],yaw:Math.atan2(pos[0],pos[1]),pitch:0,hp:100,ammo:MAGAZINE,reloadUntil:0,shieldMs:SPAWN_PROTECTION_MS,respawnAt:0,input:{}});
}
function createPlayer(options){
  const p={id:randomUUID(),yaw:0,pitch:0,kills:0,deaths:0,lastShot:0,...options};spawn(p);players.set(p.id,p);return p;
}
// Practice sessions are private, server-owned rooms. Remove their bots on disconnect.
wss.on('connection',ws=>{
  let p,count=0;
  const rate=setInterval(()=>count=0,1000),joinTimeout=setTimeout(()=>{if(!p)ws.close(1008,'Join timeout');},10000);
  ws.on('message',raw=>{
    if(++count>100)return ws.close(1008,'Rate limit');
    let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m!=='object')return;
    if(m.type==='join'&&!p){
      const hunt=m.mode==='hunt'||m.mode==='hunt-practice';
      const practice=m.mode==='practice'||m.mode==='hunt-practice';
      const room=practice?`practice:${randomUUID()}`:String(m.room||'public').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,24)||'public';
      const roomKey=hunt?`hunt:${room}`:room;
      if([...players.values()].filter(v=>v.room===roomKey).length>=12){send(ws,{type:'error',message:'このルームは満員です。別のルームを選んでください。'});return;}
      p=createPlayer({ws,room:roomKey,practice,hunt,role:'spectator',wins:0,name:String(m.name||'Player').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,16)||'Player'});
      if(practice)for(let i=0;i<3;i++)createPlayer({room:roomKey,practice:true,hunt,role:'spectator',wins:0,bot:true,name:['ECHO','NOVA','FLUX'][i],phase:i*2.1});
      if(hunt&&!hunts.has(roomKey))hunts.set(roomKey,new HuntRound());
      clearTimeout(joinTimeout);send(ws,{type:'welcome',id:p.id,room,practice,hunt});broadcast(roomKey,{type:'notice',text:hunt?'変身かくれんぼへようこそ · 2人以上で自動開始':practice?'練習開始 · 3体のボットが相手です':`${p.name} が参加しました`});
    }
    if(!p)return;
    if(m.type==='input'){
      p.active=m.active===true;p.input={};for(const key of ['forward','back','left','right','fire','sprint'])p.input[key]=m[key]===true;
      if(Number.isFinite(m.yaw))p.yaw=m.yaw%(Math.PI*2);
      if(Number.isFinite(m.pitch))p.pitch=Math.max(-1.35,Math.min(1.35,m.pitch));
      if(m.transform===true&&p.hunt)transform(p,hunts.get(p.room),Date.now());
      if(m.reload===true&&(!p.hunt||p.role==='hunter'))reload(p,Date.now());p.lastInput=Date.now();
    }
  });
  ws.on('error',()=>{});
  ws.on('close',()=>{
    clearInterval(rate);clearTimeout(joinTimeout);
    if(p){players.delete(p.id);if(p.practice)for(const [id,q]of players)if(q.room===p.room)players.delete(id);if(![...players.values()].some(q=>q.room===p.room))hunts.delete(p.room);broadcast(p.room,{type:'notice',text:`${p.name} が退出しました`});}
  });
});
function obstruction(o,d,hunt=false){
  let dist=80;
  for(const [x,z,w,h,l]of BOXES)dist=Math.min(dist,rayBox(o,d,[x-w/2,0,z-l/2],[x+w/2,h,z+l/2]));
  if(hunt)for(const prop of DECOR_PROPS)dist=Math.min(dist,rayBox(o,d,...propBounds(prop)));
  // Clip tracers at the arena walls as well as cover.
  for(const axis of [0,2])if(Math.abs(d[axis])>1e-8)dist=Math.min(dist,((d[axis]>0?24.5:-24.5)-o[axis])/d[axis]);
  return dist;
}
function think(p,now){
  const target=[...players.values()].filter(q=>q.room===p.room&&q!==p&&q.hp>0&&q.shieldMs<=0).sort((a,b)=>Number(!!a.bot)-Number(!!b.bot)||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  if(!target){p.input={};return;}
  const dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz),angle=Math.atan2(-dx,-dz);
  const clear=obstruction([p.x,1.65,p.z],[-Math.sin(angle),0,-Math.cos(angle)])>=dist-.5;
  p.yaw=angle+Math.sin(now*.0017+p.phase)*.11;p.pitch=0;
  p.input={forward:dist>12,right:Math.sin(now*.0007+p.phase)>0,left:Math.sin(now*.0007+p.phase)<=0,fire:clear&&dist<42};
  // Alternate a sideways escape when direct pursuit runs into cover.
  if(p.previous&&Math.hypot(p.x-p.previous.x,p.z-p.previous.z)<.025){p.escapeUntil=now+900;p.escapeYaw=angle+Math.PI/2;}
  p.previous={x:p.x,z:p.z};
  if(now<p.escapeUntil){p.yaw=p.escapeYaw;p.input={forward:true};}
}
function shoot(p,now){
  p.lastShot=now;p.ammo--;
  const o=[p.x,1.65,p.z],d=[-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)];
  let dist=obstruction(o,d,p.hunt),target=null;
  for(const q of players.values()){
    if(q===p||q.room!==p.room||q.hp<=0||q.shieldMs>0||p.hunt&&q.role!=='hider')continue;
    const hit=p.hunt?rayBox(o,d,...propBounds(q)):rayBox(o,d,[q.x-.45,0,q.z-.45],[q.x+.45,2,q.z+.45]);
    if(hit<dist){dist=hit;target=q;}
  }
  if(target){
    target.hp=Math.max(0,target.hp-25);send(p.ws,{type:'hit',kill:target.hp===0,name:target.name});
    if(target.hp===0){p.kills++;target.deaths++;target.respawnAt=p.hunt?0:now+3000;target.input={};broadcast(p.room,{type:'notice',text:`${p.name} → ${target.name}`});}
  }
  if(p.hunt&&!target){p.hp=Math.max(0,p.hp-5);if(p.hp===0){p.deaths++;p.input={};broadcast(p.room,{type:'notice',text:`${p.name} は誤射が多すぎて脱落しました`});}}
  broadcast(p.room,{type:'shot',id:p.id,from:o,to:o.map((v,i)=>v+d[i]*dist)});
  if(p.ammo===0)reload(p,now);
}
function huntThink(p,round,now){
  p.input={};if(!canHuntMove(p,round))return;
  if(p.role==='hider'){
    // Hide near the scenery, then briefly relocate between periodic sound clues.
    if(round.phase==='hide'||Math.sin(now*.0003+p.phase)>.97){
      const spot=DECOR_PROPS[(Math.floor(p.phase*7)+round.round*3)%DECOR_PROPS.length];
      const tx=spot.x+(spot.x>0?-1.7:1.7),tz=spot.z;
      p.yaw=Math.atan2(-(tx-p.x),-(tz-p.z));p.input={forward:Math.hypot(tx-p.x,tz-p.z)>1};
    }
    return;
  }
  const target=[...players.values()].find(q=>q.room===p.room&&q.role==='hider'&&q.hp>0&&
    (Math.hypot(q.x-p.x,q.z-p.z)<3||q.input&&(q.input.forward||q.input.back||q.input.left||q.input.right)&&Math.hypot(q.x-p.x,q.z-p.z)<14||now<(q.revealedUntil||0)));
  const spot=target||DECOR_PROPS[(Math.floor(now/5500)+Math.floor(p.phase*4))%DECOR_PROPS.length];
  const dx=spot.x-p.x,dz=spot.z-p.z,dist=Math.hypot(dx,dz);
  p.yaw=Math.atan2(-dx,-dz);p.pitch=Math.atan2((target?PROP_TYPES[target.shape].height/2:.6)-1.65,dist);
  p.input={forward:dist>5,right:Math.sin(now*.001+p.phase)>.7,fire:!!target&&dist<22&&now-p.lastShot>1000};
}
let last=Date.now();setInterval(()=>{
  const now=Date.now(),elapsed=now-last,dt=Math.min(elapsed/1000,.05);last=now;
  const paused=new Set([...players.values()].filter(p=>p.practice&&!p.bot&&!(p.hunt&&hunts.get(p.room)?.phase==='result')&&(!p.active||now-(p.lastInput||0)>500||!p.hunt&&p.hp<=0)).map(p=>p.room));
  for(const [room,round] of hunts){
    const members=[...players.values()].filter(p=>p.room===room);
    if(!paused.has(room))round.tick(members,elapsed,spawn);
    if(round.hint&&!paused.has(room)){
      const clues=members.filter(p=>p.role==='hider'&&p.hp>0).map(p=>{p.revealedUntil=now+2500;return {x:p.x,z:p.z};});
      broadcast(room,{type:'clue',positions:clues});
    }
  }
  for(const p of players.values()){
    if(paused.has(p.room))continue;
    const round=hunts.get(p.room);
    if(p.hp<=0){if(!p.hunt&&now>=p.respawnAt)spawn(p);continue;}
    p.shieldMs=Math.max(0,p.shieldMs-elapsed);updateWeapon(p,now);
    if(p.bot){if(p.hunt)huntThink(p,round,now);else think(p,now);}else if(now-(p.lastInput||0)>500)p.input={};
    if(p.hunt&&!canHuntMove(p,round))continue;
    const before={x:p.x,z:p.z};move(p,p.input,dt);
    if(p.hunt&&propBlocked(p.x,p.z)){const nextZ=p.z;p.z=before.z;if(propBlocked(p.x,p.z)){p.x=before.x;p.z=propBlocked(before.x,nextZ)?before.z:nextZ;}}
    if(p.input.fire&&!p.input.sprint&&!p.reloadUntil&&p.ammo>0&&(!p.hunt||p.role==='hunter'&&round.phase==='hunt')&&now-p.lastShot>=(p.bot?650:180))shoot(p,now);
  }
  const rooms=new Map();
  for(const p of players.values()){
    if(!rooms.has(p.room))rooms.set(p.room,[]);
    rooms.get(p.room).push({id:p.id,name:p.name,bot:!!p.bot,x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,hp:p.hp,kills:p.kills,deaths:p.deaths,ammo:p.ammo,reload:Math.max(0,p.reloadUntil-now),respawn:Math.max(0,p.respawnAt-now),shield:p.shieldMs>0,shieldMs:p.shieldMs,role:p.role,shape:p.shape,wins:p.wins||0});
  }
  for(const[room,list]of rooms){
    const round=hunts.get(room);
    if(!round){broadcast(room,{type:'state',players:list});continue;}
    const match=round.snapshot(list);
    for(const p of players.values())if(p.room===room&&!p.bot){
      const blind=round.phase==='hide'&&p.role==='hunter';
      send(p.ws,{type:'state',match,players:list.map(q=>blind&&q.role==='hider'?{...q,x:null,z:null,hidden:true}:q)});
    }
  }
},1000/30);
server.listen(port,'0.0.0.0',()=>console.log(`NEON CROSSFIRE listening on 0.0.0.0:${port}`));
