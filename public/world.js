export const LIMIT=24;
export const MAGAZINE=24;
export const RELOAD_MS=1600;
export const SPAWN_PROTECTION_MS=5000;
export function reload(p,now){if(p.hp>0&&p.ammo<MAGAZINE&&!p.reloadUntil)p.reloadUntil=now+RELOAD_MS;}
export function updateWeapon(p,now){if(p.reloadUntil&&now>=p.reloadUntil){p.ammo=MAGAZINE;p.reloadUntil=0;}}
// Interior walls and furniture share their dimensions with the renderer.
export const WALLS=[];
for(const x of [-6,6])for(const [z,d]of [[-20,8],[-7.5,9],[7.5,9],[20,8]])WALLS.push([x,z,.4,6,d]);
for(const z of [-5,5])for(const x of [-20.5,-9.5,9.5,20.5])WALLS.push([x,z,7,6,.4]);
export const FURNITURE=[
  {kind:'shelf',bounds:[-8,0,3,4,9]},
  {kind:'shelf',bounds:[8,0,3,4,9]},
  {kind:'cabinet',bounds:[0,-9,8,2.4,3]},
  {kind:'cabinet',bounds:[0,9,8,2.4,3]},
  {kind:'sofa',bounds:[-16,-14,5,1.6,3]},
  {kind:'desk',bounds:[16,14,5,1.4,4]},
  {kind:'bed',bounds:[-15,13,4,1.1,6]},
  {kind:'island',bounds:[15,-13,4,1.4,4]},
  {kind:'clock',bounds:[0,0,3,2.5,3]},
  {kind:'cabinet',bounds:[-22.5,-11,1.5,2.4,5]},
  {kind:'fridge',bounds:[21,-14,2,3.5,3]},
  {kind:'wardrobe',bounds:[-21,15,2,4,5]},
  {kind:'cabinet',bounds:[22.5,14,1.5,3,5]},
];
export const BOXES=[...WALLS,...FURNITURE.map(item=>item.bounds)];
export const SPAWNS=[[-20,-20],[20,20],[-20,20],[20,-20],[0,-20],[0,20],[-20,-14],[-16,-18],[-12,-14],[20,14],[16,18],[12,14],[-19,13],[-15,17],[-11,13],[19,-13],[15,-17],[11,-13],[-12,0],[12,0],[0,-13],[0,13]];
export function visibleFrom(x,z,enemy){
  const dx=x-enemy.x,dz=z-enemy.z,distance=Math.hypot(dx,dz);
  if(distance<.01)return true;
  const origin=[enemy.x,1.65,enemy.z],direction=[dx/distance,0,dz/distance];
  return !BOXES.some(([a,b,w,h,d])=>rayBox(origin,direction,[a-w/2,0,b-d/2],[a+w/2,h,b+d/2])<distance);
}
export function chooseSpawn(enemies,previous,candidates=SPAWNS){
  const alive=enemies.filter(p=>p.hp>0);
  const ranked=candidates.filter(([x,z])=>!blocked(x,z)).map(pos=>{
    const [x,z]=pos,distances=alive.map(p=>Math.hypot(p.x-x,p.z-z));
    const nearest=Math.min(60,...distances);
    const exposure=alive.reduce((score,p,i)=>score+(visibleFrom(x,z,p)?1-distances[i]/100:0),0);
    const repeat=previous&&Math.hypot(x-previous[0],z-previous[1])<6?12:0;
    return {pos,nearest,score:Math.min(nearest,40)-exposure*24-repeat};
  });
  // Keep at least eight metres clear whenever possible; otherwise use the farthest spot.
  const safe=ranked.filter(p=>p.nearest>=8);
  return (safe.length?safe.sort((a,b)=>b.score-a.score):ranked.sort((a,b)=>b.nearest-a.nearest))[0].pos;
}
export function blocked(x,z){return Math.abs(x)>LIMIT-.5||Math.abs(z)>LIMIT-.5||BOXES.some(([a,b,w,h,d])=>Math.abs(x-a)<w/2+.45&&Math.abs(z-b)<d/2+.45)}
export function move(p,input,dt){let x=Number(!!input.right)-Number(!!input.left),z=Number(!!input.back)-Number(!!input.forward);const n=Math.hypot(x,z)||1,s=(input.sprint?10:7)*dt; x/=n;z/=n;const dx=(x*Math.cos(p.yaw)+z*Math.sin(p.yaw))*s,dz=(-x*Math.sin(p.yaw)+z*Math.cos(p.yaw))*s;if(!blocked(p.x+dx,p.z))p.x+=dx;if(!blocked(p.x,p.z+dz))p.z+=dz;}
export function rayBox(o,d,min,max){let near=0,far=100;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-8){if(o[i]<min[i]||o[i]>max[i])return Infinity;}else{let a=(min[i]-o[i])/d[i],b=(max[i]-o[i])/d[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}}return near;}
