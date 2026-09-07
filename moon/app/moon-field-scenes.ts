import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {fieldRoutes,fieldSites} from './moon-exploration';
import {groundHeight} from './moon-terrain';
export function buildFieldSites(){
 const root=new T.Group();root.name='Lunar field exploration';
 const colliders:{id:string;x:number;z:number;hx:number;hz:number}[]=[];
 const white=new T.MeshStandardMaterial({color:0xc4c9ce,metalness:.45,roughness:.48}),dark=new T.MeshStandardMaterial({color:0x29343e,metalness:.65,roughness:.5}),gold=new T.MeshStandardMaterial({color:0x9b8658,metalness:.8,roughness:.6}),blue=new T.MeshStandardMaterial({color:0x233e61,metalness:.55,roughness:.35}),lamp=new T.MeshStandardMaterial({color:0xb4e3f4,emissive:0x7fb5db,emissiveIntensity:1.4});
 const box=(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.07,h/6,w/6)),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const cylinder=(parent:T.Object3D,x:number,y:number,z:number,r:number,h:number,mat:T.Material)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,h,16),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 for(const site of fieldSites){const group=new T.Group();group.name=site.name;group.position.set(site.x,groundHeight(site.x,site.z)-.05,site.z);root.add(group);
 // All field sites have a small exterior data terminal, south of the machinery.
 box(group,0,.75,3.4,.7,1.5,.55,dark);box(group,0,1.25,3.7,.5,.32,.045,blue);box(group,0,1.48,3.69,.4,.035,.05,lamp);
 colliders.push({id:'field-terminal',x:site.x,z:site.z+3.4,hx:.4,hz:.3});
 if(site.kind==='station'){
  box(group,0,.2,0,6,.35,5,dark);box(group,0,1.75,0,5.4,2.8,3.8,white);box(group,0,3.25,0,5.65,.25,4.05,white);
  for(const x of [-1.8,-.6,.6,1.8]){box(group,x,2.1,1.93,.9,.65,.06,blue);box(group,x,1.05,1.96,.7,.06,.035,dark);}
  for(const x of [-2.3,2.3])for(const z of [-1.8,1.8])box(group,x,.48,z,.18,.5,.18,gold);
  for(const x of [-4.5,4.5]){cylinder(group,x,.65,0,.1,1.3,dark);const panel=box(group,x,1.5,0,2.4,.12,3.5,blue);panel.rotation.z=x<0?.18:-.18;colliders.push({id:'field-solar',x:site.x+x,z:site.z,hx:1.3,hz:1.9});}
  cylinder(group,-2,4.3,-1.3,.035,2.2,dark);box(group,-2,5.4,-1.3,.6,.12,.15,lamp);
  colliders.push({id:'field-habitat',x:site.x,z:site.z,hx:2.9,hz:2.3});
 }else if(site.kind==='lander'){
  const craft=new T.Group();craft.rotation.z=.14;craft.position.y=.5;group.add(craft);
  const body=new T.Mesh(new T.CylinderGeometry(1.25,2.1,2.4,8),white);body.position.y=2;body.castShadow=true;craft.add(body);
  cylinder(craft,0,.7,0,1.8,.45,gold);cylinder(craft,0,3.35,0,.65,.25,dark);
  for(const x of [-1,1]){box(craft,x*1.9,.5,0,.15,1,.18,dark);box(craft,x*2.15,.03,0,1.2,.12,1,white);const p=box(craft,x*3.3,1.1,0,2.5,.09,2.1,blue);p.rotation.z=x*.2;}
  box(craft,0,2.2,1.55,1.1,.7,.1,dark);cylinder(craft,.4,4,0,.035,1.4,dark);
  for(let i=0;i<5;i++){const b=box(group,3+Math.sin(i*4)*1.5,.08,-2+i*.5,.5,.12,.4,i%2?white:gold);b.rotation.y=i;}
  colliders.push({id:'abandoned-lander',x:site.x,z:site.z,hx:4.8,hz:2.1});
 }else{
  box(group,0,.15,0,4,.3,3,dark);for(const x of [-1.6,1.6]){cylinder(group,x,1.2,-1,.06,2.1,white);box(group,x,2.25,-1,.2,.15,.2,lamp);}
  cylinder(group,0,1,0,.16,1.8,white);const sensor=new T.Mesh(new T.CylinderGeometry(.45,.3,1.2,24),white);sensor.position.set(0,2,0);sensor.rotation.x=.7;sensor.castShadow=true;group.add(sensor);
  box(group,1.3,.55,.4,.5,.8,.65,gold);colliders.push({id:'crater-instrument',x:site.x,z:site.z,hx:2,hz:1.6});
 }
 }
 // Sparse route stakes establish scale and keep the graded corridors visible without paved roads.
 for(const route of fieldRoutes)for(let i=1;i<route.length;i++){const a=new T.Vector2(...route[i-1]),b=new T.Vector2(...route[i]),distance=a.distanceTo(b),steps=Math.floor(distance/18);for(let j=1;j<=steps;j++){const p=a.clone().lerp(b,j/(steps+1)),side=b.clone().sub(a).normalize();const x=p.x+side.y*5.5,z=p.y-side.x*5.5,y=groundHeight(x,z);cylinder(root,x,y+.43,z,.055,.9,dark);cylinder(root,x,y+.91,z,.09,.1,lamp);}}
 return {root,colliders};
}
