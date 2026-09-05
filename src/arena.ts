import * as T from 'three';
import { Game, TARGET } from './game';
export class Arena {
 private scene=new T.Scene(); private camera=new T.PerspectiveCamera(35,1,.1,100); private renderer:T.WebGLRenderer;
 private upper:T.Mesh; private fore:T.Mesh;private joints:T.Mesh[]=[];private claw=new T.Group();private fingers:T.Mesh[]=[];private cubes:T.Mesh[]=[];private cursor:T.Mesh;private guide:T.Line;private burst:T.Points;private burstLife=0;private particleVelocity:number[]=[];private ray=new T.Raycaster();
 constructor(private el:HTMLElement,private game:Game){
 this.renderer=new T.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;el.appendChild(this.renderer.domElement);
 this.camera.position.set(6,8.8,11.5);this.camera.lookAt(0,1,0);this.scene.fog=new T.FogExp2(0x0b141e,.022);
 this.scene.add(new T.HemisphereLight(0xc9f2ff,0x1c2834,2));const key=new T.DirectionalLight(0xe2f4ff,4);key.position.set(-4,9,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.normalBias=.04;this.scene.add(key);const rim=new T.PointLight(0x39ebce,28,16);rim.position.set(-4,3,-3);this.scene.add(rim);const warm=new T.PointLight(0xffb954,22,12);warm.position.set(4,2,2);this.scene.add(warm);
 const metal=new T.MeshStandardMaterial({color:0xc5d1d9,metalness:.72,roughness:.27});const dark=new T.MeshStandardMaterial({color:0x172c3b,metalness:.65,roughness:.3});const trim=new T.MeshStandardMaterial({color:0x5eedd1,emissive:0x26bfa7,emissiveIntensity:.5,metalness:.35,roughness:.25});
 const table=this.box(8.3,.3,5.6,new T.MeshStandardMaterial({color:0x182734,metalness:.45,roughness:.55}));table.position.y=-.2;table.receiveShadow=true;
 const lower=this.box(8.5,.12,5.8,dark);lower.position.y=-.42;
 for(const x of [-3.7,3.7])for(const z of [-2.3,2.3]){const foot=this.box(.3,.6,.3,dark);foot.position.set(x,-.75,z);}
 const grid=new T.GridHelper(8,20,0x345666,0x233a49);grid.position.y=-.035;grid.scale.z=.65;this.scene.add(grid);
 for(const z of [-2.64,2.64]){const line=this.box(7.9,.018,.023,trim);line.position.set(0,-.015,z);}
 const targetMaterial=new T.MeshStandardMaterial({color:0xffc36c,emissive:0xffa321,emissiveIntensity:1.1});
 const plate=this.box(1.7,.018,1.7,new T.MeshStandardMaterial({color:0x5f4c26,transparent:true,opacity:.6,metalness:.4,roughness:.5}));plate.position.set(TARGET.x,.015,TARGET.z);
 for(const offset of [-.85,.85]){const a=this.box(1.72,.04,.035,targetMaterial);a.position.set(TARGET.x,.035,TARGET.z+offset);const b=this.box(.035,.04,1.72,targetMaterial);b.position.set(TARGET.x+offset,.035,TARGET.z);}
 this.label('DROP ZONE',TARGET.x,.06,TARGET.z+1.15,'#ffd49a',1.6);
 this.label('AIR / LAB',-2.8,.02,2.28,'#688c9d',1.6);
 const base=new T.Mesh(new T.CylinderGeometry(.6,.75,.35,48),dark);base.position.set(0,.15,-2.25);base.castShadow=true;this.scene.add(base);const baseRing=new T.Mesh(new T.TorusGeometry(.57,.035,8,64),trim);baseRing.rotation.x=Math.PI/2;baseRing.position.set(0,.33,-2.25);this.scene.add(baseRing);
 this.upper=this.box(.43,1,.5,metal);this.fore=this.box(.34,1,.41,metal);
 for(let i=0;i<3;i++){const j=new T.Mesh(new T.SphereGeometry(i===1?.24:.21,24,16),dark);j.castShadow=true;this.joints.push(j);this.scene.add(j);const ring=new T.Mesh(new T.TorusGeometry(i===1?.245:.215,.025,8,32),trim);j.add(ring);}
 const housing=new T.Mesh(new T.CylinderGeometry(.22,.25,.26,24),dark);housing.castShadow=true;this.claw.add(housing);
 for(const side of [-1,1]){const finger=new T.Mesh(new T.BoxGeometry(.11,.42,.16),metal);finger.position.set(side*.3,-.25,0);finger.castShadow=true;this.claw.add(finger);this.fingers.push(finger);const pad=new T.Mesh(new T.BoxGeometry(.12,.12,.18),trim);pad.position.y=-.16;finger.add(pad);}this.scene.add(this.claw);
 for(const block of game.blocks){const cube=new T.Mesh(new T.BoxGeometry(.52,.52,.52),new T.MeshStandardMaterial({color:block.color,roughness:.26,metalness:.3}));cube.castShadow=true;cube.receiveShadow=true;const edges=new T.LineSegments(new T.EdgesGeometry(cube.geometry),new T.LineBasicMaterial({color:0xd9ffff,transparent:true,opacity:.35}));cube.add(edges);this.cubes.push(cube);this.scene.add(cube);}
 this.cursor=new T.Mesh(new T.RingGeometry(.34,.38,48),new T.MeshBasicMaterial({color:0x79ffe2,side:T.DoubleSide,transparent:true,opacity:.95}));this.cursor.rotation.x=-Math.PI/2;this.scene.add(this.cursor);
 this.guide=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineDashedMaterial({color:0x59d6ca,transparent:true,opacity:.45,dashSize:.12,gapSize:.08}));this.scene.add(this.guide);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(60*3),3));this.burst=new T.Points(geometry,new T.PointsMaterial({color:0xffca73,size:.08,transparent:true,opacity:1}));this.burst.visible=false;this.scene.add(this.burst);
 const observer=new ResizeObserver(()=>this.resize());observer.observe(el);this.resize();
 }
 private box(w:number,h:number,d:number,mat:T.Material){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.castShadow=true;this.scene.add(m);return m;}
 private label(text:string,x:number,y:number,z:number,color:string,width:number){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.font='500 36px monospace';ctx.textAlign='center';ctx.fillText(text,256,62);const tex=new T.CanvasTexture(c);const mesh=new T.Mesh(new T.PlaneGeometry(width,width*96/512),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);this.scene.add(mesh);}
 private resize(){const w=this.el.clientWidth,h=this.el.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.position.set(6,8.8,Math.max(11.5,11.5/this.camera.aspect));this.camera.lookAt(0,1,0);this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
 pointerToWorld(x:number,y:number){const r=this.el.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);return this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());}
 private link(mesh:T.Mesh,a:T.Vector3,b:T.Vector3){const delta=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=delta.length();mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());}
 celebrate(){this.burstLife=1;this.burst.visible=true;const p=this.burst.geometry.attributes.position as T.BufferAttribute;this.particleVelocity=[];for(let i=0;i<p.count;i++){p.setXYZ(i,TARGET.x,.4,TARGET.z);this.particleVelocity.push((Math.random()-.5)*3,2+Math.random()*2,(Math.random()-.5)*3);}p.needsUpdate=true;}
 render(dt:number,time:number){const p=this.game.position;const shoulder=new T.Vector3(0,.65,-2.25);const wrist=new T.Vector3(p.x,p.y+.16,p.z);const delta=wrist.clone().sub(shoulder);const d=delta.length();const mid=shoulder.clone().add(wrist).multiplyScalar(.5);const up=new T.Vector3(0,1,0).addScaledVector(delta,-delta.y/(d*d)).normalize();const length=3.25;const elbow=mid.addScaledVector(up,Math.sqrt(Math.max(.01,length*length-d*d/4)));this.link(this.upper,shoulder,elbow);this.link(this.fore,elbow,wrist);this.joints[0]!.position.copy(shoulder);this.joints[1]!.position.copy(elbow);this.joints[2]!.position.copy(wrist);this.claw.position.set(p.x,p.y,p.z);
 const closed=this.game.held!==null||this.game.phase==='down';this.fingers.forEach((f,i)=>{f.position.x+=( (i===0?-1:1)*(closed?.24:.4)-f.position.x)*Math.min(1,dt*12);});
 this.cubes.forEach((cube,i)=>{const b=this.game.blocks[i]!;cube.position.set(b.x,b.y,b.z);cube.visible=b.cooldown<=0;});
 this.cursor.position.set(p.x,.03,p.z);this.cursor.scale.setScalar(1+Math.sin(time*3)*.03);const points=this.guide.geometry.attributes.position as T.BufferAttribute;points.setXYZ(0,p.x,.05,p.z);points.setXYZ(1,p.x,p.y-.45,p.z);points.needsUpdate=true;this.guide.computeLineDistances();
 if(this.burstLife>0){this.burstLife-=dt;const pos=this.burst.geometry.attributes.position as T.BufferAttribute;for(let i=0;i<pos.count;i++){this.particleVelocity[i*3+1]!-=dt*5;pos.setXYZ(i,pos.getX(i)+this.particleVelocity[i*3]!*dt,pos.getY(i)+this.particleVelocity[i*3+1]!*dt,pos.getZ(i)+this.particleVelocity[i*3+2]!*dt);}pos.needsUpdate=true;(this.burst.material as T.PointsMaterial).opacity=Math.max(0,this.burstLife);this.burst.visible=this.burstLife>0;}
 this.renderer.render(this.scene,this.camera);
 }
}

