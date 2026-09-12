import * as T from 'three';
import { ProductionView } from './production-view';
import type { TaskSnapshot } from './production-task';
import { DeviceHighlight } from './device-highlight';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export type Device={id:string;title:string;kind:string;position:[number,number,number]};
type Collider={id:string;x:number;z:number;hx:number;hz:number};
type Hooks={select:(d:Device|null)=>void;mode:(m:string)=>void;lock:(v:boolean)=>void;task:(snapshot:TaskSnapshot)=>void};
export class Workshop{
 readonly ready:Promise<Device[]>;
 private scene=new T.Scene();private camera=new T.PerspectiveCamera(43,1,.08,240);private renderer:T.WebGLRenderer;private orbit:OrbitControls;
 private model:T.Group|null=null;private devices:Device[]=[];private obstacles:Collider[]=[];private objects=new Map<string,T.Object3D>();private roof?:T.Object3D;
 private bounds={x:17.4,z:11.4};private spawn:[number,number,number]=[16.3,1.68,3];
 private mode='overview';private selected:string|null=null;private keys=new Set<string>();private yaw=0;private pitch=0;private frame=0;private last=performance.now();private stopped=false;private resizeObserver:ResizeObserver;
 private goal:{eye:T.Vector3;target:T.Vector3}|null=null;private ring:T.Mesh;private pmrem:T.PMREMGenerator;private env:T.WebGLRenderTarget;private lifecycle=new AbortController();
 private followTarget='AGV-03';private production?:ProductionView;private taskUiTime=0;private rideTarget:string|null=null;private followedPosition:T.Vector3|null=null;
 private highlight=new DeviceHighlight();
 private down={x:0,y:0};private dragging=false;
 constructor(private host:HTMLDivElement,private hooks:Hooks){
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;
  this.scene.background=new T.Color('#cbd2ce');this.scene.fog=new T.Fog('#cbd2ce',110,200);
  this.host.appendChild(this.renderer.domElement);this.renderer.domElement.tabIndex=0;
  this.pmrem=new T.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.env=this.pmrem.fromScene(room,.04);room.dispose();this.scene.environment=this.env.texture;this.scene.environmentIntensity=.65;
  this.scene.add(new T.HemisphereLight(0xe9ede6,0x8b9893,1.65));const sun=new T.DirectionalLight(0xfff4de,3);sun.position.set(2,28,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-27,right:27,top:23,bottom:-23,near:.5,far:90});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;this.scene.add(sun);
  const fill=new T.DirectionalLight(0xc7d5d2,1.1);fill.position.set(-15,8,-8);this.scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xcbd2ce,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.47;ground.receiveShadow=true;this.scene.add(ground);
  this.camera.position.set(39,35,44);this.orbit=new OrbitControls(this.camera,this.renderer.domElement);this.orbit.target.set(1,0,0);this.orbit.enableDamping=true;this.orbit.dampingFactor=.08;this.orbit.minDistance=2;this.orbit.maxDistance=100;this.orbit.maxPolarAngle=Math.PI/2-.035;this.orbit.addEventListener('start',()=>{this.goal=null;if(this.mode==='follow')this.setMode('focus');});this.orbit.update();
  this.ring=new T.Mesh(new T.RingGeometry(1.03,1.07,64),new T.MeshBasicMaterial({color:0xe6a13b,side:T.DoubleSide,transparent:true,opacity:.75}));this.ring.rotation.x=-Math.PI/2;this.ring.visible=false;this.scene.add(this.ring);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  const canvas=this.renderer.domElement,signal=this.lifecycle.signal;
  canvas.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY};this.dragging=true;if(this.mode==='walk'&&!document.pointerLockElement)this.lockPointer();},{signal});
  canvas.addEventListener('pointerup',e=>{this.dragging=false;if(this.mode==='walk'||this.mode==='ride'||Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>5)return;const bounds=canvas.getBoundingClientRect();const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-bounds.left)/bounds.width*2-1,1-(e.clientY-bounds.top)/bounds.height*2),this.camera);const hits=ray.intersectObjects([...this.objects.values()],true);for(const hit of hits){let ob:T.Object3D|null=hit.object;while(ob){const id=ob.userData.deviceId;if(this.devices.some(d=>d.id===id)){this.focus(id);return;}ob=ob.parent;}}},{signal});
  document.addEventListener('mousemove',e=>{if(this.mode!=='walk'&&this.mode!=='ride')return;if(document.pointerLockElement!==canvas&&!this.dragging)return;this.yaw-=e.movementX*.0025;this.pitch=T.MathUtils.clamp(this.pitch-e.movementY*.0025,-1.3,1.3);this.look();},{signal});
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;this.hooks.lock(locked);this.keys.clear();if(locked)canvas.focus({preventScroll:true});},{signal});
  document.addEventListener('keydown',e=>{if(this.mode==='walk'&&!['INPUT','TEXTAREA','BUTTON'].includes((e.target as HTMLElement)?.tagName)){if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();this.key(e.code,true);}}},{signal});
  document.addEventListener('keyup',e=>this.key(e.code,false),{signal});window.addEventListener('blur',()=>{this.keys.clear();this.highlight.clear();},{signal});
  this.ready=this.load();this.frame=requestAnimationFrame(this.animate);
 }
 private async load(){
  const [gltf,response]=await Promise.all([new GLTFLoader().loadAsync('/factory/models/workshop.glb'),fetch('/factory/models/layout.json')]);if(!response.ok)throw Error('Layout unavailable');const layout=await response.json() as {devices:Device[];colliders:Collider[];bounds:{x:number;z:number};spawn:[number,number,number]};if(this.stopped){this.release(gltf.scene);return [];}
  this.bounds=layout.bounds;this.spawn=layout.spawn;this.devices=layout.devices;this.obstacles=layout.colliders;this.model=gltf.scene;
  this.model.traverse(ob=>{if(ob.userData.deviceId==='ROOF'){this.roof=ob;ob.visible=false;}if(ob.userData.deviceId&&this.devices.some(d=>d.id===ob.userData.deviceId))this.objects.set(ob.userData.deviceId,ob);if(ob instanceof T.Mesh){ob.castShadow=true;ob.receiveShadow=true;}});
  if(this.objects.size!==this.devices.length)throw Error('Device identities missing');this.scene.add(this.model);this.production=new ProductionView(this.scene,this.objects,this.obstacles);this.hooks.task(this.production.task.snapshot());this.registerTools();return this.devices;
 }
 private registerTools(){
  type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
  const ctx=(document as Document & {modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!ctx?.registerTool)return;
  const tools:Tool[]=[{name:'list_workshop_devices',description:'List the devices available for inspection in this 3D workshop.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({devices:this.devices,view:this.mode,selected:this.selected,task:this.production?.task.snapshot()})},{name:'focus_workshop_device',description:'Select a workshop device and start a smooth camera transition toward it. Does not operate the equipment.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input!=='object'||!('id' in input)||typeof input.id!=='string')throw Error('A device id is required');this.focus(input.id);return {selected:this.selected,camera:'transitioning'};}}];
  tools.push({name:'control_production_task',description:'Start, pause, resume or reset the W-001 assembly demonstration. Reset returns the workpiece and vehicle to their initial positions.',inputSchema:{type:'object',properties:{action:{enum:['start','pause','resume','reset']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input!=='object'||!('action' in input)||!['start','pause','resume','reset'].includes(String(input.action)))throw Error('Invalid task action');this.controlTask(input.action as 'start'|'pause'|'resume'|'reset');return this.production?.task.snapshot();}});
  for(const tool of tools){try{void Promise.resolve(ctx.registerTool(tool,{signal:this.lifecycle.signal})).catch(()=>{});}catch{/* Browser support is optional. */}}
 }
 private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 controlTask(action:'start'|'pause'|'resume'|'reset'){if(!this.production)return;if(action==='reset')this.production.reset();else this.production.task[action]();this.production.sync();this.hooks.task(this.production.task.snapshot());}
 context(){if(!this.production)throw Error('车间尚未就绪');return {task:this.production.task.snapshot(),devices:this.devices};}
 followVehicle(id='AGV-03'){if(!this.devices.some(d=>d.id===id&&d.kind==='agv'))throw Error('请选择搬运车');this.focus(id);this.setMode('follow');this.followTarget=id;const p=this.objects.get(id)!.position.clone();this.goal={eye:p.clone().add(new T.Vector3(4,3.5,5)),target:p.clone().add(new T.Vector3(0,.7,0))};this.followedPosition=p;}
 hoverDevice(id:string|null){this.highlight.set(id?this.objects.get(id)??null:null,this.mode==='overview');}
 private setMode(mode:string){this.highlight.clear();this.mode=mode;this.hooks.mode(mode);this.keys.clear();this.dragging=false;this.goal=null;this.orbit.enabled=mode==='overview'||mode==='focus'||mode==='follow';this.followedPosition=null;if(this.roof)this.roof.visible=mode==='walk'||mode==='ride';if(mode!=='walk'&&document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();}
 overview(){this.setMode('overview');this.clearSelection();this.goal={eye:new T.Vector3(39,35,44),target:new T.Vector3(1,0,0)};}
 focus(id:string){const d=this.devices.find(d=>d.id===id),ob=this.objects.get(id);if(!d||!ob)throw Error('Unknown device');this.setMode('focus');this.selected=id;this.hooks.select(d);const pos=new T.Vector3();ob.getWorldPosition(pos);this.ring.position.set(pos.x,.055,pos.z);this.ring.visible=true;const height=d.kind==='agv'?.55:1.3;this.goal={eye:pos.clone().add(new T.Vector3(4,3.5,5)),target:pos.clone().add(new T.Vector3(0,height,0))};}
 clearSelection(){this.selected=null;this.hooks.select(null);this.ring.visible=false;}
 walk(){this.setMode('walk');this.clearSelection();this.camera.position.fromArray(this.spawn);this.yaw=.7;this.pitch=0;this.look();this.lockPointer();}
 ride(id:string){const ob=this.objects.get(id);if(!ob||!id.startsWith('AGV'))return;this.setMode('ride');this.rideTarget=id;const pos=new T.Vector3();ob.getWorldPosition(pos);this.camera.position.copy(pos).add(new T.Vector3(0,1.65,0));this.yaw=-Math.PI/2;this.pitch=-.1;this.look();}
 lockPointer(){if(this.mode!=='walk')return;this.renderer.domElement.focus({preventScroll:true});try{const promise=this.renderer.domElement.requestPointerLock();if(promise)void promise.catch(()=>this.hooks.lock(false));}catch{this.hooks.lock(false);}}
 key(code:string,down:boolean){if(down)this.keys.add(code);else this.keys.delete(code);}
 private look(){this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');}
 private canStand(x:number,z:number){if(Math.abs(x)>this.bounds.x||Math.abs(z)>this.bounds.z)return false;return !this.obstacles.some(b=>{const moving=b.id==='AGV-03'?this.objects.get(b.id):undefined;const bx=moving?.position.x??b.x,bz=moving?.position.z??b.z;const angle=moving?.rotation.y??0,hx=Math.abs(Math.cos(angle))*b.hx+Math.abs(Math.sin(angle))*b.hz,hz=Math.abs(Math.sin(angle))*b.hx+Math.abs(Math.cos(angle))*b.hz;return Math.abs(x-bx)<hx+.3&&Math.abs(z-bz)<hz+.3;});}
 private animate=(now:number)=>{if(this.stopped)return;const dt=Math.min(.04,(now-this.last)/1000);this.last=now;
  this.production?.tick(document.hidden?0:dt,this.mode==='walk'?this.camera.position:undefined);
  if(this.production&&now-this.taskUiTime>150){this.taskUiTime=now;this.hooks.task(this.production.task.snapshot());}
  if(this.selected){const p=this.objects.get(this.selected)?.position;if(p)this.ring.position.set(p.x,.055,p.z);}
  if(this.mode==='ride'&&this.rideTarget){const p=this.objects.get(this.rideTarget)!;this.camera.position.copy(p.position).add(new T.Vector3(0,1.65,0));this.look();this.camera.rotation.y+=p.rotation.y;}
  if(this.mode==='follow'){const p=this.objects.get(this.followTarget)!.position;if(this.followedPosition){const delta=p.clone().sub(this.followedPosition);this.camera.position.add(delta);this.orbit.target.add(delta);if(this.goal){this.goal.eye.add(delta);this.goal.target.add(delta);}}this.followedPosition=p.clone();}
  if(this.mode==='walk'){
   const forward=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'));const right=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));const norm=Math.max(1,Math.hypot(forward,right));const speed=dt*2.5/norm;const dx=(right*Math.cos(this.yaw)-forward*Math.sin(this.yaw))*speed,dz=(-forward*Math.cos(this.yaw)-right*Math.sin(this.yaw))*speed;const p=this.camera.position;if(this.canStand(p.x+dx,p.z))p.x+=dx;if(this.canStand(p.x,p.z+dz))p.z+=dz;
  }else if(this.orbit.enabled){if(this.goal){const a=1-Math.exp(-dt*4);this.camera.position.lerp(this.goal.eye,a);this.orbit.target.lerp(this.goal.target,a);if(this.camera.position.distanceTo(this.goal.eye)<.02)this.goal=null;}this.orbit.update();}
  this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.animate);
 };
 private release(root:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
 dispose(){this.highlight.clear();this.production?.dispose();this.stopped=true;cancelAnimationFrame(this.frame);this.lifecycle.abort();this.resizeObserver.disconnect();if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.orbit.dispose();this.release(this.scene);this.env.dispose();this.pmrem.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
