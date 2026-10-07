// Visual dimensions and hitboxes are shared by the server and renderer.
export const PROP_TYPES=[
  {name:'段ボール',key:'crate',width:1,height:1,depth:1,color:'#b58a50'},
  {name:'ごみ箱',key:'bin',width:.9,height:1.3,depth:.9,color:'#839a91'},
  {name:'鉢植え',key:'plant',width:.85,height:1.15,depth:.85,color:'#b87955'},
];
export const DECOR_PROPS=[[-21,-17],[-18,-20],[-12,-20],[-4,-19],[4,-20],[13,-20],[20,-17],[22,-9],[-21,-7],[-18,-3],[-14,-6],[-4,-4],[4,-5],[14,-5],[18,0],[21,7],[-21,7],[-19,11],[-10,11],[-4,5],[4,5],[12,8],[20,12],[20,18],[-22,20],[-13,20],[-8,18],[0,18],[8,20],[12,20],[-3,-14],[5,14]].map(([x,z],i)=>({id:`decor-${i}`,x,z,shape:i%PROP_TYPES.length}));
export function propBounds(p){const t=PROP_TYPES[p.shape]||PROP_TYPES[0];return [[p.x-t.width/2,0,p.z-t.depth/2],[p.x+t.width/2,t.height,p.z+t.depth/2]];}

export function propBlocked(x,z){return DECOR_PROPS.some(p=>{const t=PROP_TYPES[p.shape];return Math.abs(x-p.x)<t.width/2+.5&&Math.abs(z-p.z)<t.depth/2+.5;});}
