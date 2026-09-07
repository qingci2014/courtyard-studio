import * as T from 'three';
/** In-world visual interface: flat projected keys and a floating status pane. */
export class MoonHoloDesk{
 readonly root=new T.Group();private surface:T.Mesh;private pane:T.Mesh;private beam:T.LineSegments;private time=0;private powered:boolean|null=null;
 constructor(){
  this.root.name='Integrated holographic workstation';
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const g=canvas.getContext('2d')!;
  g.strokeStyle='#52bbdb';g.fillStyle='#9bdef0';g.lineWidth=2;g.strokeRect(28,28,968,968);g.font='28px monospace';g.fillText('SELENE / TOUCH WORKSPACE',64,87);g.font='17px monospace';g.fillText('INPUT SURFACE 01                                   LOCAL LINK',64,128);
  g.strokeStyle='#31627b';for(let i=0;i<7;i++){g.beginPath();g.moveTo(65,190+i*40);g.lineTo(745,190+i*40);g.stroke();}
  g.strokeStyle='#78d8f3';g.lineWidth=3;g.beginPath();for(let i=0;i<=100;i++){const x=65+i*6.8,y=310+Math.sin(i*.12)*45+Math.sin(i*.31)*13;if(!i)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();
  g.font='18px monospace';g.fillText('SIGNAL WORKBENCH',65,470);for(let i=0;i<4;i++){g.strokeStyle='#408da7';g.strokeRect(790,195+i*65,170,46);g.fillStyle='#8fcfe3';g.fillText(['SYSTEM','ANALYSIS','ARCHIVE','COMMS'][i],810,225+i*65);}
  const rows=['1234567890-=','QWERTYUIOP[]','ASDFGHJKL;','ZXCVBNM,./'];g.textAlign='center';g.font='25px monospace';
  rows.forEach((row,r)=>[...row].forEach((key,c)=>{const x=67+c*73+r*9,y=550+r*76;g.fillStyle='#102b4040';g.fillRect(x,y,62,59);g.strokeStyle='#55b8d6';g.lineWidth=1.5;g.strokeRect(x,y,62,59);g.fillStyle='#adebfa';g.fillText(key,x+31,y+38);}));
  g.strokeRect(265,875,490,62);g.font='18px monospace';g.fillText('SPACE / CONFIRM',510,915);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  this.surface=new T.Mesh(new T.PlaneGeometry(1.16,1.06),new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));this.surface.name='Projected desktop keyboard';this.surface.position.set(3.1,1.009,-22.85);this.surface.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,1),new T.Vector3(1,0,0),new T.Vector3(0,1,0)));this.root.add(this.surface);
  const screen=document.createElement('canvas');screen.width=1024;screen.height=384;const p=screen.getContext('2d')!;p.fillStyle='#09243990';p.fillRect(0,0,1024,384);p.strokeStyle='#74d7f4';p.lineWidth=4;p.strokeRect(4,4,1016,376);p.fillStyle='#b0ecff';p.font='30px monospace';p.fillText('SELENE  /  HOLO LINK',40,65);p.font='20px monospace';p.fillText('LOCAL WORKSPACE',40,110);
  for(let i=0;i<18;i++){p.fillStyle=i%3?'#5cc9e1':'#bceeff';p.fillRect(45+i*34,310-(30+Math.sin(i*.41)**2*120),18,30+Math.sin(i*.41)**2*120);}p.font='23px monospace';p.fillStyle='#b0ecff';p.fillText('READY',770,205);p.font='18px monospace';p.fillText('TOUCH INPUT',742,252);
  const screenTex=new T.CanvasTexture(screen);screenTex.colorSpace=T.SRGBColorSpace;
  this.pane=new T.Mesh(new T.PlaneGeometry(.78,.2925),new T.MeshBasicMaterial({map:screenTex,transparent:true,opacity:.68,depthWrite:false,side:T.DoubleSide,toneMapped:false}));this.pane.name='Floating work interface';this.pane.position.set(3.28,1.32,-22.85);this.pane.rotation.y=-Math.PI/2;this.root.add(this.pane);
  const rays=new T.BufferGeometry().setFromPoints([new T.Vector3(3.53,1.011,-22.96),new T.Vector3(3.28,1.174,-23.24),new T.Vector3(3.53,1.011,-22.74),new T.Vector3(3.28,1.174,-22.46)]);this.beam=new T.LineSegments(rays,new T.LineBasicMaterial({color:0x69cdf2,transparent:true,opacity:.14,depthWrite:false}));this.root.add(this.beam);
 }
 update(dt:number,powered:boolean){this.time+=Math.min(.05,Math.max(0,dt));if(this.powered!==powered){this.powered=powered;this.pane.visible=this.beam.visible=powered;(this.surface.material as T.MeshBasicMaterial).opacity=powered?.9:.12;}if(powered)(this.pane.material as T.MeshBasicMaterial).opacity=.64+.025*Math.sin(this.time*1.3);}
}
