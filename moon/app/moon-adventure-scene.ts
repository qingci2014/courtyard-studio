import * as T from 'three';
import {groundHeight} from './moon-terrain';
import {rockSamples,signalPoint} from './moon-adventure';
export function buildAdventureObjects(){const root=new T.Group();root.name='Exploration quest props';const samples=new Map<string,T.Group>();
 const metal=new T.MeshStandardMaterial({color:0x8c969c,metalness:.72,roughness:.42}),black=new T.MeshStandardMaterial({color:0x18232b,roughness:.6});
 const mesh=(parent:T.Group,geo:T.BufferGeometry,material:T.Material,x:number,y:number,z:number)=>{const o=new T.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const probe=new T.Group();probe.position.set(signalPoint.x,groundHeight(signalPoint.x,signalPoint.z)-.04,signalPoint.z);root.add(probe);
 const body=mesh(probe,new T.CylinderGeometry(.48,.55,1.15,24),metal,0,.65,0);body.rotation.z=.3;
 mesh(probe,new T.BoxGeometry(1.8,.055,.72),black,0,.22,.6).rotation.z=-.12;
 for(let i=0;i<8;i++)mesh(probe,new T.BoxGeometry(.18,.012,.62),new T.MeshStandardMaterial({color:0x1a354a,metalness:.55,roughness:.32}),-.77+i*.22,.29,.6);
 mesh(probe,new T.CylinderGeometry(.025,.025,1.35,8),metal,.3,1.4,0).rotation.z=-.22;
 mesh(probe,new T.SphereGeometry(.07,12,8),new T.MeshStandardMaterial({color:0x91e1ed,emissive:0x62cfeb,emissiveIntensity:2}),.45,2.05,0);
 for(const r of rockSamples){const g=new T.Group();g.position.set(r.x,groundHeight(r.x,r.z),r.z);root.add(g);samples.set(r.id,g);const m=new T.MeshStandardMaterial({color:r.id==='basalt'?0x44474a:r.id==='breccia'?0x767577:0xb3b4b1,roughness:1});for(let i=0;i<5;i++){const o=mesh(g,new T.DodecahedronGeometry(.24+i*.035,1),m,Math.sin(i*2)*.38,.15+ i*.018,Math.cos(i*2)*.35);o.scale.set(1.3,.7,1);o.rotation.set(i*.4,i*.8,0);}mesh(g,new T.CylinderGeometry(.015,.015,.8,8),metal,.8,.4,0);mesh(g,new T.BoxGeometry(.25,.12,.02),new T.MeshBasicMaterial({color:0xb2d8de}),.8,.78,0);}
 return {root,samples};}
