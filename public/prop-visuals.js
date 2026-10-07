import * as THREE from '/three.js';
import {PROP_TYPES} from '/props.js';
export function makeProp(shape){
  const type=PROP_TYPES[shape]||PROP_TYPES[0],group=new THREE.Group();
  const material=new THREE.MeshStandardMaterial({color:type.color,roughness:.85});
  const dark=new THREE.MeshStandardMaterial({color:'#47544c',roughness:.7});
  const light=new THREE.MeshStandardMaterial({color:'#e3c897',roughness:.8});
  function part(geometry,mat,x,y,z){const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  if(type.key==='crate'){
    part(new THREE.BoxGeometry(1,1,1),material,0,.5,0);
    part(new THREE.BoxGeometry(.18,.012,1),light,0,1,0);
    part(new THREE.BoxGeometry(.18,1,.012),light,0,.5,.5);
    part(new THREE.BoxGeometry(.3,.2,.015),light,.25,.65,.5);
  }else if(type.key==='bin'){
    part(new THREE.CylinderGeometry(.43,.34,1.18,16),material,0,.59,0);
    part(new THREE.CylinderGeometry(.45,.45,.08,16),dark,0,1.22,0);
    part(new THREE.BoxGeometry(.22,.04,.12),dark,0,1.28,0);
    part(new THREE.BoxGeometry(.22,.08,.12),dark,0,.12,.34);
  }else{
    part(new THREE.CylinderGeometry(.28,.2,.42,16),material,0,.21,0);
    part(new THREE.CylinderGeometry(.29,.29,.06,16),material,0,.41,0);
    part(new THREE.CylinderGeometry(.25,.25,.025,16),dark,0,.445,0);
    part(new THREE.CylinderGeometry(.025,.025,.5,8),dark,0,.68,0);
    const leaves=new THREE.MeshStandardMaterial({color:'#639462',roughness:1});
    for(let i=0;i<5;i++){
      const angle=i*Math.PI*2/5;
      part(new THREE.IcosahedronGeometry(.22,0),leaves,Math.cos(angle)*.17,.7+(i%2)*.14,Math.sin(angle)*.17);
    }
    part(new THREE.IcosahedronGeometry(.2,0),leaves,0,.95,0);
  }
  return group;
}
