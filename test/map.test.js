import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blocked,SPAWNS} from '../public/world.js';
import {propBlocked,DECOR_PROPS,PROP_TYPES} from '../public/props.js';

test('every spawn remains connected through the house in both game modes',()=>{
  for(const hunt of [false,true]){
    const clear=(x,z)=>!blocked(x,z)&&(!hunt||!propBlocked(x,z));
    const spawns=SPAWNS.filter(([x,z])=>clear(x,z));
    const queue=[spawns[0]],seen=new Set([spawns[0].join(',')]);
    for(let i=0;i<queue.length;i++){
      const [x,z]=queue[i];
      for(const [dx,dz]of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
        const next=[x+dx,z+dz],key=next.join(',');
        if(!seen.has(key)&&clear(...next)){seen.add(key);queue.push(next);}
      }
    }
    for(const point of spawns)assert.ok(seen.has(point.join(',')),`Disconnected spawn: ${point}, hunt=${hunt}`);
  }
});
test('disguise props do not overlap solid house cover',()=>{
  for(const p of DECOR_PROPS){
    const type=PROP_TYPES[p.shape];
    for(const dx of [-type.width/2,0,type.width/2]){
      for(const dz of [-type.depth/2,0,type.depth/2])assert.equal(blocked(p.x+dx,p.z+dz),false,`${p.id} overlaps cover`);
    }
  }
});
