import * as THREE from '/three.js';
import {BOXES,RELOAD_MS,rayBox} from '/world.js';
import {DECOR_PROPS,PROP_TYPES,propBounds} from '/props.js';
import {makeProp} from '/prop-visuals.js';
import {createMap} from '/map-visuals.js';
const $=id=>document.getElementById(id),canvas=$('game');
let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch{$('status').textContent='WebGLに対応したブラウザで開いてください。';throw new Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#b9b4a8');scene.fog=new THREE.FogExp2('#b9b4a8',.004);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.08,130);camera.rotation.order='YXZ';
scene.add(new THREE.HemisphereLight(0xfff1d8,0x8b7156,2));const sun=new THREE.DirectionalLight(0xd7e6ff,2.5);sun.position.set(12,25,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30});scene.add(sun);
const mat=(color,roughness=.7)=>new THREE.MeshStandardMaterial({color,roughness});
const animateMap=createMap(scene);
const neon=new THREE.MeshBasicMaterial({color:'#d7ff57'}),cyan=new THREE.MeshBasicMaterial({color:'#40d9ee'});
const gun=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.15,.17,.52),mat('#26333c'));gun.add(body);const barrel=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.34),mat('#11181e'));barrel.position.z=-.38;gun.add(barrel);const stripe=new THREE.Mesh(new THREE.BoxGeometry(.16,.025,.32),neon);stripe.position.y=.09;gun.add(stripe);gun.position.set(.28,-.25,-.48);camera.add(gun);scene.add(camera);gun.visible=false;
const muzzle=new THREE.PointLight(0xd7ff57,0,3);muzzle.position.set(0,0,-.6);gun.add(muzzle);
const flash=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),neon);flash.position.set(0,0,-.6);flash.scale.set(1,1,2);flash.visible=false;gun.add(flash);
let ws,id,self,joined=false,yaw=0,pitch=0,oldHp=100,hitUntil=0,recoil=0,audio,dead=false,shotUntil=0,killUntil=0,damageUntil=0,sensitivity=1,soundEnabled=true;
let scoreSignature='',lastReload=false,practice=false,hunt=false,match=null,roundSeen=0,ownProp=null,ownShape=-1;
const scenery=DECOR_PROPS.map(p=>{const mesh=makeProp(p.shape);mesh.position.set(p.x,0,p.z);scene.add(mesh);return mesh;});
const clueRings=[];

const keys={forward:false,back:false,left:false,right:false,fire:false,sprint:false,reload:false,transform:false},avatars=new Map(),tracers=[];
const params=new URLSearchParams(location.search);$('room').value=(params.get('room')||'public').replace(/[^a-zA-Z0-9-]/g,'').slice(0,24)||'public';try{$('name').value=localStorage.getItem('callsign')||`Pilot${Math.floor(Math.random()*900+100)}`;}catch{$('name').value='Pilot';}
const mode=()=>{const choice=document.querySelector('input[name="mode"]:checked').value;return $('gameType').value==='hunt'?(choice==='practice'?'hunt-practice':'hunt'):choice;};
function updateMode(){const practice=mode().endsWith('practice');for(const mesh of scenery)mesh.visible=$('gameType').value==='hunt';$('room').disabled=practice;$('roomField').classList.toggle('disabled',practice);$('enter').innerHTML=`${practice?'練習を開始':'アリーナに参加'} <span>↗</span>`;$('status').textContent=$('gameType').value==='hunt'?(practice?'ひとりで練習 · ボット3体と役割を交代':'2〜12人 · 20秒で隠れる → 90秒で探す'):(practice?'3体のボットと対戦 · ひとりですぐに遊べます':'同じROOM IDの仲間と対戦できます · 最大12人');}
if(params.get('game')==='arena')$('gameType').value='arena';
$('gameType').onchange=updateMode;
if(params.has('room'))document.querySelector('input[value="online"]').checked=true;
for(const option of document.querySelectorAll('input[name="mode"]'))option.addEventListener('change',updateMode);updateMode();
try{sensitivity=Math.max(.3,Math.min(2.5,Number(localStorage.getItem('sensitivity'))||1));soundEnabled=localStorage.getItem('sound')!=='off';}catch{}
$('sensitivity').value=sensitivity;$('sensitivityValue').value=sensitivity.toFixed(1);$('sound').checked=soundEnabled;
$('sensitivity').oninput=()=>{sensitivity=Number($('sensitivity').value);$('sensitivityValue').value=sensitivity.toFixed(1);try{localStorage.setItem('sensitivity',sensitivity);}catch{}};
$('sound').onchange=()=>{soundEnabled=$('sound').checked;try{localStorage.setItem('sound',soundEnabled?'on':'off');}catch{}};
function resetKeys(){for(const k in keys)keys[k]=false;}
function notice(text){const node=document.createElement('div');node.textContent=text;$('feed').prepend(node);while($('feed').children.length>5)$('feed').lastChild.remove();setTimeout(()=>node.remove(),5000);}
function sound(freq,duration=.06){if(!soundEnabled)return;try{audio??=new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.35,audio.currentTime+duration);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
$('join').onsubmit=e=>{e.preventDefault();if(ws&&ws.readyState<2)return;$('enter').disabled=true;$('status').textContent='サーバーに接続中…';try{localStorage.setItem('callsign',$('name').value);}catch{}ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);ws.onopen=()=>ws.send(JSON.stringify({type:'join',name:$('name').value,room:$('room').value,mode:mode()}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='error'){$('status').textContent=m.message;ws.close();return;}if(m.type==='welcome'){id=m.id;practice=m.practice;hunt=!!m.hunt;document.body.classList.toggle('hunting',hunt);for(const mesh of scenery)mesh.visible=hunt;joined=true;$('lobby').hidden=true;$('hud').hidden=false;$('pause').hidden=false;document.body.classList.add('playing');$('roomLabel').textContent=m.practice?'TRAINING / 3 BOTS':`ROOM / ${m.room.toUpperCase()}`;$('share').hidden=m.practice;$('connection').textContent='CONNECTED / LIVE';const url=new URL(location.href);url.searchParams.set('game',hunt?'hunt':'arena');if(m.practice)url.searchParams.delete('room');else url.searchParams.set('room',m.room);history.replaceState({},'',url);}
if(m.type==='clue'){for(const p of m.positions){const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.04,6,32),new THREE.MeshBasicMaterial({color:0x40d9ee,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.12,p.z);scene.add(ring);clueRings.push({ring,until:performance.now()+2500});}notice('♪ 物音がした！ 青い輪のあたりを探そう');sound(620,.2);}
if(m.type==='notice')notice(m.text);if(m.type==='hit'){hitUntil=performance.now()+(m.kill?300:160);$('hitmarker').classList.toggle('kill',m.kill);sound(m.kill?800:450,.1);if(m.kill){killUntil=performance.now()+1800;$('killConfirm').textContent=`ELIMINATED / ${m.name}`;}}if(m.type==='shot'){const geom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...m.from),new THREE.Vector3(...m.to)]);const line=new THREE.Line(geom,new THREE.LineBasicMaterial({color:m.id===id?0xd7ff57:0xff6d5c}));scene.add(line);tracers.push({line,until:performance.now()+65});if(m.id===id){recoil=.07;shotUntil=performance.now()+65;sound(140);}}
if(m.type==='state'){const firstState=!self;const newRound=m.match&&m.match.round!==roundSeen;match=m.match||null;if(newRound){roundSeen=match.round;resetKeys();}self=m.players.find(p=>p.id===id);if(!self)return;if(firstState||newRound||(oldHp<=0&&self.hp>0)){yaw=self.yaw;pitch=hunt&&self.role==='hider'?-.4:self.pitch;camera.position.set(self.x,1.65,self.z);}const seen=new Set();for(const p of m.players){if(p.id===id||p.hidden)continue;seen.add(p.id);let a=avatars.get(p.id);const kind=hunt&&p.role==='hider'?`prop-${p.shape}`:'hunter';if(a&&a.userData.kind!==kind){disposeObject(a);avatars.delete(p.id);a=null;}if(!a){a=new THREE.Group();const suit=new THREE.Mesh(new THREE.BoxGeometry(.65,1.15,.4),mat('#ee7967'));suit.position.y=.9;a.add(suit);const head=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42),mat('#a7c4ca'));head.position.y=1.69;a.add(head);const visor=new THREE.Mesh(new THREE.BoxGeometry(.38,.14,.03),cyan);visor.position.set(0,1.73,-.225);a.add(visor);for(const side of[-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.23,.55,.28),mat('#263d4c'));leg.position.set(side*.19,.28,0);a.add(leg);}if(hunt&&p.role==='hider'){disposeObject(a);a=makeProp(p.shape);}a.userData.kind=kind;scene.add(a);avatars.set(p.id,a);a.position.set(p.x,0,p.z);}a.userData.target=p;a.visible=p.hp>0&&(!hunt||p.role!=='spectator');}
for(const[pid,a]of avatars)if(!seen.has(pid)){scene.remove(a);a.traverse(o=>{o.geometry?.dispose();if(o.material&&o.material!==cyan)o.material.dispose();});avatars.delete(pid);}
if(self.hp<oldHp){damageUntil=performance.now()+180;sound(75,.13);}if(oldHp<=0&&self.hp>0)camera.position.set(self.x,1.65,self.z);oldHp=self.hp;$('health').textContent=self.hp;$('healthBar').style.width=`${self.hp}%`;dead=self.hp<=0;gun.visible=!dead;
document.body.classList.toggle('low-health',self.hp>0&&self.hp<=25);
$('ammo').textContent=String(self.ammo).padStart(2,'0');
const reloading=self.reload>0;document.querySelector('.weapon').classList.toggle('reloading',reloading);
$('reloadBar').style.width=`${reloading?(1-self.reload/RELOAD_MS)*100:self.ammo/24*100}%`;
$('weaponStatus').textContent=reloading?`リロード中 · ${(self.reload/1000).toFixed(1)}s`:self.ammo<=6?'残弾わずか · R でリロード':'R リロード · SHIFT ダッシュ';
$('protection').textContent=self.shield&&!dead?`◇ 無敵 ${Math.ceil(self.shieldMs/1000)}秒`:'';
if(reloading&&!lastReload)sound(230,.16);lastReload=reloading;
if(dead&&!hunt){if(document.pointerLockElement)document.exitPointerLock?.();$('pause').hidden=false;$('pauseTitle').textContent='ELIMINATED';$('pauseText').textContent=`${Math.ceil(self.respawn/1000)}秒後にリスポーン`;$('resume').hidden=true;}else if(!document.pointerLockElement){$('pause').hidden=false;$('pauseTitle').textContent='READY TO FIGHT?';$('pauseText').textContent=self.shield?`復帰保護 ${Math.ceil(self.shieldMs/1000)}秒 · 射撃しても無敵は継続します`:(practice?'クリックして復帰 · 練習は一時停止中です':'クリックして復帰 · メニュー表示中も対戦は進行します');$('resume').hidden=false;}
$('online').textContent=`${m.players.length} PLAYERS`;
if(hunt)updateHuntUI();
const signature=JSON.stringify(m.players.map(p=>[p.id,p.name,p.kills,p.deaths,p.role,p.hp,p.wins]));
if(signature!==scoreSignature){scoreSignature=signature;$('scores').replaceChildren();for(const p of [...m.players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths)){const row=document.createElement('div');row.className=`score ${p.id===id?'me':''}`;const name=document.createElement('span'),score=document.createElement('span');name.textContent=`${p.bot?'◇ ':''}${p.name}${p.id===id?' (YOU)':''}`;score.textContent=hunt?`${p.hp<=0?'脱落':p.role==='hunter'?'探す':p.role==='hider'?'隠れる':'待機'} / ${p.wins}勝`:`${p.kills} K / ${p.deaths} D`;row.append(name,score);$('scores').append(row);}}}};ws.onclose=()=>{joined=false;resetKeys();document.exitPointerLock?.();$('connection').textContent='DISCONNECTED';$('enter').disabled=false;if(id){$('pause').hidden=false;$('pauseTitle').textContent='CONNECTION LOST';$('pauseText').textContent='サーバーとの接続が切れました。再接続してください。';$('resume').hidden=false;$('resume').textContent='再接続 ↗';$('resume').onclick=()=>location.reload();}else if($('status').textContent==='サーバーに接続中…')$('status').textContent='接続できませんでした。サーバーを確認してください。';};ws.onerror=()=>{$('status').textContent='接続エラー。サーバーとポートの公開設定を確認してください。';};};
$('resume').onclick=async()=>{if(dead&&!hunt)return;try{await canvas.requestPointerLock();audio??=new AudioContext();await audio.resume();}catch{$('pauseText').textContent='マウス操作を許可して、もう一度クリックしてください。';}};
document.addEventListener('pointerlockchange',()=>{resetKeys();document.body.classList.toggle('fighting',document.pointerLockElement===canvas);if(joined&&(!dead||hunt)){$('pause').hidden=document.pointerLockElement===canvas;if(hunt)updateHuntUI();}});
const mapping={KeyW:'forward',KeyS:'back',KeyA:'left',KeyD:'right',ArrowUp:'forward',ArrowDown:'back',ArrowLeft:'left',ArrowRight:'right',ShiftLeft:'sprint',ShiftRight:'sprint',KeyR:'reload',KeyE:'transform'};
addEventListener('keydown',e=>{if(document.pointerLockElement===canvas&&mapping[e.code]){if(!e.repeat||!['KeyE','KeyR'].includes(e.code))keys[mapping[e.code]]=true;e.preventDefault();}});addEventListener('keyup',e=>{if(['KeyR','KeyE'].includes(e.code))return;if(mapping[e.code])keys[mapping[e.code]]=false;});addEventListener('blur',resetKeys);document.addEventListener('visibilitychange',resetKeys);addEventListener('mousedown',e=>{if(e.button===0&&document.pointerLockElement===canvas)keys.fire=true;});addEventListener('mouseup',()=>keys.fire=false);addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;yaw-=e.movementX*.002*sensitivity;pitch=Math.max(-1.35,Math.min(1.35,pitch-e.movementY*.002*sensitivity));});
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('share').textContent='コピーしました ✓';setTimeout(()=>$('share').textContent='招待リンクをコピー ↗',2000);}catch{notice('アドレスバーのURLをコピーして共有してください');}};
setInterval(()=>{if(joined&&ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'input',...keys,yaw,pitch,active:document.pointerLockElement===canvas}));keys.reload=false;keys.transform=false;},1000/30);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});renderer.setSize(innerWidth,innerHeight);
let previous=performance.now();function frame(t){requestAnimationFrame(frame);animateMap(t,joined);const dt=Math.min((t-previous)/1000,.1);previous=t;if(joined&&self){const target=new THREE.Vector3(self.x,1.65,self.z);if(camera.position.distanceTo(target)>5)camera.position.copy(target);else camera.position.lerp(target,1-Math.exp(-25*dt));camera.rotation.set(pitch,yaw,0);recoil*=Math.exp(-18*dt);gun.position.z=-.48+recoil;
const reloadPhase=self.reload>0?Math.sin(Math.PI*(1-self.reload/RELOAD_MS)):0;
gun.rotation.x=-reloadPhase*.65;gun.rotation.z=-reloadPhase*.35;
gun.position.y=-.25-reloadPhase*.16-(keys.sprint ? .08 : 0)+((keys.forward||keys.back||keys.left||keys.right)?Math.sin(t*.012)*.012:0);}else{camera.position.set(29*Math.cos(t*.000025),23,29*Math.sin(t*.000025));camera.lookAt(0,0,0);}for(const a of avatars.values()){const p=a.userData.target;a.position.lerp(new THREE.Vector3(p.x,0,p.z),1-Math.exp(-18*dt));a.rotation.y=hunt&&p.role==='hider'?0:p.yaw;if(!hunt||p.role!=='hider')a.children[0].material.color.set(p.shield?'#d7ff57':'#ee7967');}for(let i=tracers.length-1;i>=0;i--)if(t>tracers[i].until){const {line}=tracers[i];scene.remove(line);line.geometry.dispose();line.material.dispose();tracers.splice(i,1);}if(hunt&&self){updatePropCamera(dt);for(let i=clueRings.length-1;i>=0;i--){const c=clueRings[i],life=(c.until-t)/2500;c.ring.scale.setScalar(1+(1-life)*2);c.ring.material.opacity=Math.max(0,life);if(life<=0){disposeObject(c.ring);clueRings.splice(i,1);}}}
const firing=document.pointerLockElement===canvas&&!dead&&joined&&(!hunt||self.role==='hunter'&&match?.phase==='hunt');
flash.visible=firing&&t<shotUntil;muzzle.intensity=flash.visible?3:0;
$('damage').style.opacity=t<damageUntil?'.7':'0';
$('hitmarker').style.opacity=firing&&t<hitUntil?'1':'0';
$('killConfirm').style.opacity=t<killUntil?'1':'0';
$('crosshair').style.setProperty('--gap',`${7+recoil*100+(keys.sprint?7:0)}px`);
const targetFov=keys.sprint&&firing?82:75;camera.fov+=(targetFov-camera.fov)*(1-Math.exp(-8*dt));camera.updateProjectionMatrix();
if(!(hunt&&match?.phase==='hide'&&self?.role==='hunter'))renderer.render(scene,camera);}requestAnimationFrame(frame);

function disposeObject(object){
  scene.remove(object);const materials=new Set();
  object.traverse(o=>{o.geometry?.dispose();if(o.material&&o.material!==cyan&&o.material!==neon)materials.add(o.material);});
  for(const material of materials)material.dispose();
}
function updateHuntUI(){
  if(!match||!self)return;
  const hider=self.role==='hider',hunter=self.role==='hunter',spectator=self.role==='spectator'||dead;
  document.body.classList.toggle('hider',hider);$('matchHud').hidden=false;$('roleHint').hidden=false;
  $('roundLabel').textContent=`ROUND ${String(match.round).padStart(2,'0')} / ${hider?'HIDER':hunter?'HUNTER':'WAITING'}`;
  $('phaseLabel').textContent={waiting:'2人以上でスタート',hide:'隠れる時間',hunt:'ハント開始',result:match.winner==='hunter'?'ハンターの勝利！':'隠れる側の勝利！'}[match.phase];
  const seconds=Math.ceil(match.remaining/1000);$('matchTimer').textContent=match.phase==='waiting'?'--:--':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('remainingProps').textContent=`残り ${match.alive} / ${match.total}`;
  $('blindfold').hidden=!(hunter&&match.phase==='hide');$('blindText').textContent=`あと ${seconds} 秒で目隠し解除。準備しよう。`;
  $('roleHint').textContent=match.phase==='waiting'?'招待リンクを友達に送ろう。同じルームに2人集まると開始！':match.phase==='result'?`8秒後に役割を交代して次のラウンドへ`:spectator?'次のラウンドから参加できます':hider?'E で変身 · モノに紛れて時間まで生き残ろう':match.phase==='hide'?'あなたはハンター。隠れる時間が終わるまで待とう':'怪しいモノを狙おう · 誤射は HP −5 · 20秒ごとに物音のヒント';
  $('propPicker').hidden=!hider||dead||match.phase==='result';
  for(const button of document.querySelectorAll('[data-shape]'))button.classList.toggle('selected',Number(button.dataset.shape)===self.shape);
  $('weaponLabel').textContent=hider?'YOUR DISGUISE / E TO SHIFT':'HUNTER / PULSE RIFLE';
  if(hider){$('ammo').textContent=PROP_TYPES[self.shape]?.name||'段ボール';$('weaponStatus').textContent='視点を回してもモノの向きは変わりません';}
  $('protection').textContent=spectator?'次のラウンドまで待機':hider?`次の物音まで ${Math.ceil(match.hintIn/1000)}秒`:'';
  $('scoreLegend').textContent='役割 / 勝利数 · ラウンドごとに交代';
  gun.visible=hunter&&!dead&&match.phase==='hunt';
  if(match.phase==='result'){
    if(document.pointerLockElement)document.exitPointerLock();
    $('pause').hidden=false;$('pauseTitle').textContent=match.winner==='hunter'?'ハンターの勝利！':'逃げ切り成功！';
    $('pauseText').textContent=`${seconds}秒後、役割を交代して再開`;$('resume').hidden=true;
  }else if(!document.pointerLockElement){
    $('pause').hidden=false;$('resume').hidden=false;$('resume').textContent=spectator?'アリーナを見る ↗':'プレイを開始 ↗';
    $('pauseTitle').textContent=spectator?'次のラウンドを待とう':hider?'あなたは隠れる側':'あなたはハンター';
    $('pauseText').textContent=spectator?'倒されても次のラウンドで復帰します':hider?'Eで変身。三人称視点で周囲を確認できます。':'小道具に紛れたプレイヤーを見つけて撃とう。';
    if(practice)$('pauseText').textContent+=' メニュー表示中は一時停止。';
  }else $('pause').hidden=true;
}
function updatePropCamera(dt){
  if(self.role!=='hider'||dead){if(ownProp)ownProp.visible=false;return;}
  if(ownShape!==self.shape){if(ownProp)disposeObject(ownProp);ownProp=makeProp(self.shape);ownShape=self.shape;scene.add(ownProp);}
  const origin=[self.x,.85,self.z],direction=[Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  let distance=3.8;
  for(const [x,z,w,h,d]of BOXES)distance=Math.min(distance,rayBox(origin,direction,[x-w/2,0,z-d/2],[x+w/2,h,z+d/2])-.15);
  for(const prop of DECOR_PROPS)distance=Math.min(distance,rayBox(origin,direction,...propBounds(prop))-.15);
  for(const axis of [0,2])if(Math.abs(direction[axis])>1e-8)distance=Math.min(distance,((direction[axis]>0?24:-24)-origin[axis])/direction[axis]-.2);
  if(direction[1]<0)distance=Math.min(distance,(origin[1]-.15)/-direction[1]);
  if(direction[1]>0)distance=Math.min(distance,(5.7-origin[1])/direction[1]);
  distance=Math.max(.1,distance);camera.position.set(...origin.map((v,i)=>v+direction[i]*distance));
  ownProp.position.set(self.x,0,self.z);ownProp.visible=distance>1.5;
}
