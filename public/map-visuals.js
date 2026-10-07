import * as THREE from '/three.js';
import {WALLS,FURNITURE} from '/world.js';

export function createMap(scene) {
  const materials=new Map();
  function material(color,glow=false) {
    const key=`${color}:${glow}`;
    if(!materials.has(key))materials.set(key,glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,roughness:.85}));
    return materials.get(key);
  }
  function mesh(geometry,color,x,y,z,glow=false) {
    const m=new THREE.Mesh(geometry,material(color,glow));m.position.set(x,y,z);
    m.castShadow=!glow;m.receiveShadow=!glow;scene.add(m);return m;
  }
  const box=(w,h,d,x,y,z,c,g=false)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,g);
  function label(text,x,y,z,color='#765747',width=3,rotation=0) {
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f6e8cc';ctx.fillRect(0,0,768,192);
    ctx.strokeStyle=color;ctx.lineWidth=12;ctx.strokeRect(8,8,752,176);
    ctx.font='bold 65px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,384,100);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
    m.position.set(x,y,z);m.rotation.y=rotation;scene.add(m);return m;
  }
  box(49,.3,49,0,-.2,0,'#b88b62');
  // Wooden planks, tiled kitchen and rugs give each room its own character.
  for(let z=-23.5;z<24;z+=1){
    box(48,.015,.025,0,-.035,z,'#8b674d');
    for(let x=-22;x<24;x+=6)box(.025,.015,1,x+(Math.round(z)%2)*2,-.034,z+.5,'#8b674d');
  }
  for(let x=7;x<24;x+=2)for(let z=-23;z<-5;z+=2)box(1.96,.03,1.96,x,-.015,z,((x+z)/2)%2?'#ece5d4':'#a7bbb1');
  function rug(x,z,w,d,color){
    box(w,.035,d,x,.01,z,'#f2dab1');box(w-.35,.04,d-.35,x,.02,z,color);
    for(const side of [-1,1])box(w-.8,.045,.08,x,.026,z+side*(d/2-.5),'#e9cda8');
  }
  rug(-15,-14,12,10,'#a75e4f');rug(-15,14,12,12,'#739b94');rug(15,14,12,12,'#657c9c');
  rug(0,0,7,45,'#9e7658');
  const walls=[...WALLS,[-24.25,0,.5,6,48],[24.25,0,.5,6,48],[0,-24.25,49,6,.5],[0,24.25,49,6,.5]];
  for(const [x,z,w,h,d]of walls){
    box(w,h,d,x,h/2,z,'#e5d6bb');
    box(w+.03,.18,d+.03,x,.09,z,'#785f4d');box(w+.03,.14,d+.03,x,4.7,z,'#fff0d8');
  }
  // Open doorways have overhead lintels; the floor opening is fully walkable.
  for(const x of [-6,6])for(const z of [-14,0,14]){
    box(.44,1.4,z===0?6:4,x,5.3,z,'#d9c5a5');
    for(const side of [-1,1])box(.48,4.6,.1,x,2.3,z+side*(z===0?3:2),'#997459');
  }
  for(const z of [-5,5])for(const x of [-15,15]){
    box(4,1.4,.44,x,5.3,z,'#d9c5a5');
    for(const side of [-1,1])box(.1,4.6,.48,x+side*2,2.3,z,'#997459');
  }
  for(const [x,z,title]of [[-15,-5,'LIVING ROOM'],[15,-5,'KITCHEN'],[-15,5,'BEDROOM'],[15,5,'STUDY']]){
    label(title,x,4.95,z+(z<0?.24:-.24),'#775e4a',3.4,z<0?0:Math.PI);
  }
  for(const {kind,bounds:[x,z,w,h,d]}of FURNITURE){
    const color={sofa:'#668c7b',bed:'#d1a36d',island:'#72958a',fridge:'#d9e1dc',clock:'#805641'}[kind]||'#9a7150';
    box(w,h,d,x,h/2,z,color);
    if(kind==='sofa'){
      box(w,.75,.45,x,h-.3,z-d/2+.23,'#497361');
      for(const side of [-1,1])box(.45,.6,d,x+side*(w/2-.23),h-.2,z,'#497361');
      for(let i=-1;i<=1;i++)box(1.25,.17,2.1,x+i*1.4,1.08,z+.15,'#9eb9a0');
      for(const side of [-1,1])box(.7,.6,.3,x+side*1.4,1.5,z-.85,'#f2cb87');
    }else if(kind==='bed'){
      box(w-.15,.3,d-.2,x,h+.1,z,'#f2dfbd');box(w-.2,.12,d*.64,x,h+.3,z+d*.16,'#6f9da2');
      for(const side of [-1,1])box(1.5,.2,1.1,x+side*.95,h+.34,z-d*.32,'#fff3df');
    }else if(kind==='shelf'){
      // Painted recessed panels and books stay within the solid bookcase silhouette.
      for(const side of [-1,1]){
        box(.03,h-.25,d-.2,x+side*(w/2+.02),h/2,z,'#493d35');
        for(let y=.5;y<h;y+=.85){
          box(.08,.09,d,x+side*(w/2+.055),y-.1,z,'#d1a474');
          for(let i=0;i<13;i++)box(.06,.45+(i%3)*.09,.33,x+side*(w/2+.05),y+.22,z-d/2+.4+i*.65,['#ae6c58','#7d9a85','#d2b477','#738fa5'][i%4]);
        }
      }
    }else if(kind==='clock'){
      const face=mesh(new THREE.CylinderGeometry(.9,.9,.04,32),'#f4e4bd',x,1.45,z+d/2+.03);face.rotation.x=Math.PI/2;
      box(.06,.6,.05,x,1.65,z+d/2+.07,'#513d32');box(.5,.06,.05,x+.2,1.45,z+d/2+.07,'#513d32');
      label('HIDEAWAY HOUSE',x,2.2,z+d/2+.04,'#75513e',2.7);
    }else{
      box(w+.04,.12,d+.04,x,h+.03,z,kind==='island'?'#f4ead3':'#be956c');
      for(let i=0;i<Math.max(1,Math.floor(w));i++){
        const px=x-w/2+.5+i;box(.025,h-.2,.03,px,h/2,z+d/2+.02,'#624b3c');
        box(.22,.07,.05,px+.15,h*.65,z+d/2+.05,'#e1cb9e');
      }
      if(kind==='island'){
        box(1.5,.04,1.5,x+.7,h+.12,z,'#343e3c');
        for(const dz of [-.4,.4])for(const dx of [-.4,.4]){
          const ring=mesh(new THREE.TorusGeometry(.22,.035,6,20),'#a9b4ae',x+.7+dx,h+.16,z+dz);ring.rotation.x=Math.PI/2;
        }
      }
      if(kind==='desk'){
        box(2,.1,1,x,h+.12,z,'#efe5d1');box(1.5,.1,1.1,x+1.4,h+.17,z-.5,'#9d5549');
      }
    }
  }
  // Framed windows and artwork sit on walls, never in walking routes.
  for(const x of [-16,16])for(const z of [-23.96,23.96]){
    box(5.5,3,.08,x,3,z,'#8b674f');box(5.1,2.6,.09,x,3,z+(z<0?.05:-.05),'#afcbd0',true);
    box(.12,2.7,.12,x,3,z+(z<0?.1:-.1),'#fff0d6');box(5.2,.12,.12,x,3,z+(z<0?.1:-.1),'#fff0d6');
    for(const side of [-1,1])box(.8,3.5,.2,x+side*2.9,2.9,z+(z<0?.18:-.18),'#ad795d');
  }
  for(const z of [-18,18]){
    const art=label(z<0?'HOME SWEET HOME':'MAKE YOURSELF AT HOME',-23.96,3.1,z,'#6e8e75',4,Math.PI/2);
    art.userData.art=true;
  }
  for(const [x,z]of [[-15,-14],[15,-14],[-15,14],[15,14],[0,-17],[0,17],[0,0]]){
    box(.05,.7,.05,x,5.6,z,'#6f5943');
    mesh(new THREE.CylinderGeometry(.55,.9,.45,16),'#fff0cb',x,5.15,z,true);
    const light=new THREE.PointLight('#ffe5b5',14,24,2);light.position.set(x,4.7,z);scene.add(light);
  }
  // Show a dollhouse overview in the lobby; close the ceiling during play.
  const ceiling=box(49,.2,49,0,6.1,0,'#f4e9d6');ceiling.castShadow=false;
  const batches=new Map();
  for(const object of scene.children){
    if(object===ceiling||object.geometry?.type!=='BoxGeometry')continue;
    const key=JSON.stringify([object.geometry.parameters,object.material.uuid]);
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(object);
  }
  for(const objects of batches.values()){
    if(objects.length<2)continue;
    const first=objects[0],batch=new THREE.InstancedMesh(first.geometry,first.material,objects.length);
    batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
    objects.forEach((object,i)=>{object.updateMatrix();batch.setMatrixAt(i,object.matrix);scene.remove(object);if(i>0)object.geometry.dispose();});
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();scene.add(batch);
  }
  return (t,playing=false)=>{ceiling.visible=playing;};
}
