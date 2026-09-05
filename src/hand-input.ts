import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GestureFilter } from './gesture-filter';
type Frame = {x:number;z:number;pinch:boolean};
type Hooks = {status:(s:string)=>void;frame:(f:Frame|null)=>void;lost:()=>void;ended:()=>void};
export class HandInput {
 private model:HandLandmarker|null=null; private stream:MediaStream|null=null; private raf=0; private lastVideo=-1; private lastInference=0; private lastSeen=0; private pinch=false; private missing=false; private active=false; private filter=new GestureFilter();
 constructor(private video:HTMLVideoElement,private canvas:HTMLCanvasElement,private hooks:Hooks){}
 async start(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('摄像头需要 HTTPS 或 localhost，请在独立浏览器窗口打开本站。');
  this.hooks.status('请允许摄像头权限；画面不会上传。');
  try {
   this.stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
   this.video.srcObject=this.stream;await this.video.play();
   this.stream.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>this.hooks.ended(),{once:true}));
   this.hooks.status('正在加载本机识别模型，首次启动请稍候…');
   if(!this.model){const fileset=await FilesetResolver.forVisionTasks('/vision/wasm');this.model=await HandLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:'/vision/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6});}
   this.active=true;this.lastSeen=performance.now();this.lastVideo=-1;this.lastInference=0;this.pinch=false;this.filter.reset();this.missing=false;
   this.hooks.status('请伸出一只手，让手掌完整出现在画面中。');this.raf=requestAnimationFrame(this.loop);
  }catch(e){this.stop();const name=e instanceof Error?e.name:'';if(name==='NotAllowedError')throw new Error('摄像头权限未获允许。请在浏览器地址栏允许摄像头后重试；内置窗口无法授权时，请在 Chrome / Edge 打开本站。');if(name==='NotFoundError')throw new Error('没有找到摄像头，请连接摄像头后重试。');if(name==='NotReadableError')throw new Error('摄像头被其他程序占用，请关闭视频会议等程序后重试。');throw new Error('识别启动失败，请检查摄像头和模型加载后重试。');}
 }
 stop(){this.active=false;cancelAnimationFrame(this.raf);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.canvas.getContext('2d')?.clearRect(0,0,this.canvas.width,this.canvas.height);}
 private loop=(now:number)=>{if(!this.active)return;this.raf=requestAnimationFrame(this.loop);if(document.hidden||now-this.lastInference<65||this.video.readyState<2||this.video.currentTime===this.lastVideo)return;this.lastInference=now;this.lastVideo=this.video.currentTime;
  try{const result=this.model!.detectForVideo(this.video,now);const points=result.landmarks[0];this.draw(points);
   if(!points){this.hooks.frame(null);if(now-this.lastSeen>700&&!this.missing){this.missing=true;this.filter.suspend();this.hooks.lost();}return;}
   this.lastSeen=now;if(this.missing){this.missing=false;this.hooks.status('重新看到手了。暂停的挑战需要点击继续。');}
   const thumb=points[4]!,finger=points[8]!,wrist=points[0]!,middle=points[9]!;
   const aspect=this.video.videoWidth/this.video.videoHeight;
   const distance=(a:NormalizedLandmark,b:NormalizedLandmark)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
   const ratio=distance(thumb,finger)/Math.max(.04,distance(wrist,middle));
   const cx=(wrist.x+middle.x+points[13]!.x+points[17]!.x)/4;
   const cy=(wrist.y+middle.y+points[13]!.y+points[17]!.y)/4;
   const frame=this.filter.update(((1-cx)-.5)*11,(cy-.5)*7,ratio,now);
   this.pinch=frame.pinch;
   this.hooks.frame(frame);
  }catch{this.stop();this.hooks.ended();this.hooks.status('识别运行中断，已关闭摄像头。可重新开启。');}
 };
 private draw(points?:NormalizedLandmark[]){const w=this.video.videoWidth||640,h=this.video.videoHeight||480;if(this.canvas.width!==w){this.canvas.width=w;this.canvas.height=h;}const c=this.canvas.getContext('2d')!;c.clearRect(0,0,w,h);if(!points)return;c.lineWidth=3;c.strokeStyle=this.pinch?'#ffc36a':'#69ffe0';c.shadowBlur=8;c.shadowColor=c.strokeStyle;for(const edge of HandLandmarker.HAND_CONNECTIONS){const a=points[edge.start]!,b=points[edge.end]!;c.beginPath();c.moveTo(a.x*w,a.y*h);c.lineTo(b.x*w,b.y*h);c.stroke();}for(const p of points){c.beginPath();c.arc(p.x*w,p.y*h,4,0,Math.PI*2);c.fillStyle='#ffffff';c.fill();}c.shadowBlur=0;}
}
