import * as T from 'three';
import { Game, TARGET } from './game';
import { Robot } from './robot';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
export class Arena {
 private scene=new T.Scene(); private camera=new T.PerspectiveCamera(35,1,.1,100); private renderer:T.WebGLRenderer;
 private robot:Robot;readonly ready:Promise<void>;private cubes:T.Mesh[]=[];private cursor:T.Mesh;private guide:T.Line;private burst:T.Points;private burstLife=0;private particleVelocity:number[]=[];private ray=new T.Raycaster();
 constructor(private el:HTMLElement,private game:Game){
 this.renderer=new T.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;el.appendChild(this.renderer.domElement);
 this.camera.position.set(6,8.8,11.5);this.camera.lookAt(0,1,0);this.scene.fog=new T.FogExp2(0x0b141e,.022);
 this.scene.background=new T.Color(0x0d1117);
 const environment=new RoomEnvironment();const pmrem=new T.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromScene(environment,.035).texture;this.scene.environmentIntensity=.65;environment.dispose();pmrem.dispose();
 this.scene.add(new T.HemisphereLight(0xe5f0ff,0x080a0d,.3));
 const key=new T.DirectionalLight(0xf3f7ff,1.8);key.position.set(-3,8,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.normalBias=.035;this.scene.add(key);
 const rim=new T.DirectionalLight(0x84d6ff,1.4);rim.position.set(4,4,-5);this.scene.add(rim);
 const fill=new T.DirectionalLight(0xf4f6fc,.6);fill.position.set(5,2,4);this.scene.add(fill);
 const dark=new T.MeshStandardMaterial({color:0x0e141b,metalness:.8,roughness:.32});
 const trim=new T.MeshStandardMaterial({color:0x67ddff,emissive:0x13afdc,emissiveIntensity:2});
 const table=this.box(8.3,.3,5.6,new T.MeshStandardMaterial({color:0x182029,metalness:.76,roughness:.38}));table.position.y=-.2;table.receiveShadow=true;
 const lower=this.box(8.5,.12,5.8,dark);lower.position.y=-.42;
 for(const x of [-3.7,3.7])for(const z of [-2.3,2.3]){const foot=this.box(.3,.6,.3,dark);foot.position.set(x,-.75,z);}
 const grid=new T.GridHelper(8,20,0x34404d,0x222c36);grid.position.y=-.035;grid.scale.z=.65;this.scene.add(grid);
 for(const z of [-2.64,2.64]){const line=this.box(7.9,.018,.014,trim);line.position.set(0,-.015,z);}
 const targetMaterial=new T.MeshStandardMaterial({color:0xffc36c,emissive:0xffa321,emissiveIntensity:1.1});
 const plate=this.box(1.7,.018,1.7,new T.MeshStandardMaterial({color:0x5f4c26,transparent:true,opacity:.6,metalness:.4,roughness:.5}));plate.position.set(TARGET.x,.015,TARGET.z);
 for(const offset of [-.85,.85]){const a=this.box(1.72,.04,.035,targetMaterial);a.position.set(TARGET.x,.035,TARGET.z+offset);const b=this.box(.035,.04,1.72,targetMaterial);b.position.set(TARGET.x+offset,.035,TARGET.z);}
 this.label('DROP ZONE',TARGET.x,.06,TARGET.z+1.15,'#ffd49a',1.6);
 this.label('AIR / LAB',-2.8,.02,2.28,'#688c9d',1.6);
 this.robot=new Robot();this.ready=this.robot.ready;this.scene.add(this.robot.root);
 // Machined platform edges and inset fasteners.
 for(const x of [-3.95,3.95])for(const z of [-2.42,2.42]){const bolt=new T.Mesh(new T.CylinderGeometry(.06,.06,.035,6),new T.MeshStandardMaterial({color:0x83909c,metalness:1,roughness:.25}));bolt.position.set(x,-.025,z);this.scene.add(bolt);}
 for(let i=0;i<12;i++){const slit=this.box(.18,.035,.055,dark);slit.position.set(-1.55+i*.28,-.18,2.805);}
 const underglow=this.box(7.8,.025,5.1,trim);underglow.position.y=-.38;
 for(const block of game.blocks){const cube=new T.Mesh(new RoundedBoxGeometry(.52,.52,.52,2,.04),new T.MeshStandardMaterial({color:block.color,roughness:.26,metalness:.3}));cube.castShadow=true;cube.receiveShadow=true;const edges=new T.LineSegments(new T.EdgesGeometry(cube.geometry),new T.LineBasicMaterial({color:0xd9ffff,transparent:true,opacity:.35}));cube.add(edges);this.cubes.push(cube);this.scene.add(cube);}
 this.cursor=new T.Mesh(new T.RingGeometry(.34,.38,48),new T.MeshBasicMaterial({color:0x7eeaff,side:T.DoubleSide,transparent:true,opacity:.95}));this.cursor.rotation.x=-Math.PI/2;this.scene.add(this.cursor);
 this.guide=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineDashedMaterial({color:0x5bcdf6,transparent:true,opacity:.45,dashSize:.12,gapSize:.08}));this.scene.add(this.guide);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(60*3),3));this.burst=new T.Points(geometry,new T.PointsMaterial({color:0xffca73,size:.08,transparent:true,opacity:1}));this.burst.visible=false;this.scene.add(this.burst);

 const observer=new ResizeObserver(()=>this.resize());observer.observe(el);this.resize();
 }
 private box(w:number,h:number,d:number,mat:T.Material){const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.06,w/4,h/4,d/4)),mat);m.castShadow=true;this.scene.add(m);return m;}
 private label(text:string,x:number,y:number,z:number,color:string,width:number){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.font='500 36px monospace';ctx.textAlign='center';ctx.fillText(text,256,62);const tex=new T.CanvasTexture(c);const mesh=new T.Mesh(new T.PlaneGeometry(width,width*96/512),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);this.scene.add(mesh);}
 private resize(){const w=this.el.clientWidth,h=this.el.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.position.set(6,8.8,Math.max(11.5,11.5/this.camera.aspect));this.camera.lookAt(0,1,0);this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
 pointerToWorld(x:number,y:number){const r=this.el.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);return this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());}
 celebrate(){this.burstLife=1;this.burst.visible=true;const p=this.burst.geometry.attributes.position as T.BufferAttribute;this.particleVelocity=[];for(let i=0;i<p.count;i++){p.setXYZ(i,TARGET.x,.4,TARGET.z);this.particleVelocity.push((Math.random()-.5)*3,2+Math.random()*2,(Math.random()-.5)*3);}p.needsUpdate=true;}
 render(dt:number,time:number){const p=this.game.position;this.robot.update(p,this.game.held!==null||this.game.phase==='down',dt,time);
 this.cubes.forEach((cube,i)=>{const b=this.game.blocks[i]!;cube.position.set(b.x,b.y,b.z);cube.visible=b.cooldown<=0;});
 this.cursor.position.set(p.x,.03,p.z);this.cursor.scale.setScalar(1+Math.sin(time*3)*.03);const points=this.guide.geometry.attributes.position as T.BufferAttribute;points.setXYZ(0,p.x,.05,p.z);points.setXYZ(1,p.x,p.y-.45,p.z);points.needsUpdate=true;this.guide.computeLineDistances();
 if(this.burstLife>0){this.burstLife-=dt;const pos=this.burst.geometry.attributes.position as T.BufferAttribute;for(let i=0;i<pos.count;i++){this.particleVelocity[i*3+1]!-=dt*5;pos.setXYZ(i,pos.getX(i)+this.particleVelocity[i*3]!*dt,pos.getY(i)+this.particleVelocity[i*3+1]!*dt,pos.getZ(i)+this.particleVelocity[i*3+2]!*dt);}pos.needsUpdate=true;(this.burst.material as T.PointsMaterial).opacity=Math.max(0,this.burstLife);this.burst.visible=this.burstLife>0;}
 this.renderer.render(this.scene,this.camera);
 }
}
