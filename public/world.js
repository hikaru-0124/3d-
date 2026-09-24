export const LIMIT=24;
export const BOXES=[[-8,0,3,4,9],[8,0,3,4,9],[0,-9,8,3,3],[0,9,8,3,3],[-16,-14,5,3,4],[16,14,5,3,4],[-15,13,4,2.8,4],[15,-13,4,2.8,4],[0,0,3,2.5,3]];
export const SPAWNS=[[-20,-20],[20,20],[-20,20],[20,-20],[0,-20],[0,20]];
export function blocked(x,z){return Math.abs(x)>LIMIT-.5||Math.abs(z)>LIMIT-.5||BOXES.some(([a,b,w,h,d])=>Math.abs(x-a)<w/2+.45&&Math.abs(z-b)<d/2+.45)}
export function move(p,input,dt){let x=Number(!!input.right)-Number(!!input.left),z=Number(!!input.back)-Number(!!input.forward);const n=Math.hypot(x,z)||1,s=7*dt; x/=n;z/=n;const dx=(x*Math.cos(p.yaw)+z*Math.sin(p.yaw))*s,dz=(-x*Math.sin(p.yaw)+z*Math.cos(p.yaw))*s;if(!blocked(p.x+dx,p.z))p.x+=dx;if(!blocked(p.x,p.z+dz))p.z+=dz;}
export function rayBox(o,d,min,max){let near=0,far=100;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-8){if(o[i]<min[i]||o[i]>max[i])return Infinity;}else{let a=(min[i]-o[i])/d[i],b=(max[i]-o[i])/d[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}}return near;}
