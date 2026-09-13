// Original synthesized effects: no downloaded assets, paid services or microphone.
import {AmbientScore,createCabinGraph} from './cockpit-soundscape';
export type SoundFrame={dt:number;distance:number;indoor:boolean;powered:boolean;driving:boolean;speed:number;active:boolean};
export class MoonAudio{
 private ctx:AudioContext|null=null;private master:GainNode|null=null;private ambience:GainNode|null=null;private breath:GainNode|null=null;private cabin:GainNode|null=null;
 private volume=.35;private muted=false;private suspended=true;private disposed=false;private stride=0;private phase=0;private vehicleStarted=false;
 private equipment:ReturnType<typeof createCabinGraph>|null=null;private score:AmbientScore|null=null;
 private sources:AudioScheduledSourceNode[]=[];private noise:AudioBuffer|null=null;
 configure(volume:number,muted:boolean){this.volume=volume;this.muted=muted;this.level();}
 private level(){if(this.ctx&&this.master){this.master.gain.setTargetAtTime(this.muted?0:this.volume,this.ctx.currentTime,.045);this.ambience?.gain.setTargetAtTime(this.suspended?0:1,this.ctx.currentTime,.045);}}
 async unlock(){if(this.disposed)return false;try{if(!this.ctx){
  const c=this.ctx=new AudioContext();const master=this.master=c.createGain();master.gain.value=0;master.connect(c.destination);const ambience=this.ambience=c.createGain();ambience.gain.value=0;ambience.connect(master);
  this.equipment=createCabinGraph(c,ambience,.4);this.equipment.master.gain.value=1;this.score=new AmbientScore(c,this.equipment,.22);this.score.start();if(this.suspended)this.score.pause();
  const noise=this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const source=c.createBufferSource();source.buffer=noise;source.loop=true;const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=320;filter.Q.value=.6;this.breath=c.createGain();this.breath.gain.value=0;source.connect(filter).connect(this.breath).connect(this.equipment.music);source.start();this.sources.push(source);
  const hum=c.createOscillator();hum.type='sine';hum.frequency.value=92;this.cabin=c.createGain();this.cabin.gain.value=0;hum.connect(this.cabin).connect(ambience);hum.start();this.sources.push(hum);
 }if(this.ctx.state==='suspended')await this.ctx.resume();this.level();return this.ctx.state==='running';}catch{/* Audio failure must not prevent play. */return false;}}
 pause(value:boolean){const changed=this.suspended!==value;this.suspended=value;this.level();if(value){this.stride=0;if(changed)this.score?.pause();}else if(changed)this.score?.start();}
 update(f:SoundFrame){if(!f.driving)this.vehicleStarted=false;const c=this.ctx;if(!c||this.disposed)return;this.pause(!f.active);if(!f.active)return;if(f.driving&&!this.vehicleStarted&&Math.abs(f.speed)>.08&&c.state==='running'){this.startVehicle();this.vehicleStarted=true;}this.phase+=f.dt;
  this.breath?.gain.setTargetAtTime((f.driving||f.indoor)?0:1.4*(.055+.085*Math.max(0,Math.sin(this.phase*.8))),c.currentTime,.12);
  this.cabin?.gain.setTargetAtTime(f.indoor&&f.powered?.008:0,c.currentTime,.3);
  if(c.state==='running')this.score?.tick();
  if(!f.driving&&f.distance<.4){this.stride+=f.distance;if(this.stride>.85){this.stride%=.85;this.step(f.indoor);}}
 }
 private startVehicle(){const c=this.ctx;if(!c||!this.ambience)return;const osc=c.createOscillator(),gain=c.createGain();osc.type='triangle';osc.frequency.setValueAtTime(90,c.currentTime);osc.frequency.exponentialRampToValueAtTime(220,c.currentTime+.8);gain.gain.setValueAtTime(.001,c.currentTime);gain.gain.exponentialRampToValueAtTime(.24,c.currentTime+.12);gain.gain.setValueAtTime(.24,c.currentTime+2.6);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+3);osc.connect(gain).connect(this.ambience);osc.start();osc.stop(c.currentTime+3);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
 private step(indoor:boolean){const c=this.ctx;if(!c||!this.noise||!this.master)return;const source=c.createBufferSource();source.buffer=this.noise;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=indoor?900:450;const gain=c.createGain();gain.gain.setValueAtTime(indoor?.21:.168,c.currentTime);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+.12);source.connect(filter).connect(gain).connect(this.ambience??this.master);source.start();source.stop(c.currentTime+.14);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
 cue(success=false,preview=false){const c=this.ctx;if(!c||!this.master||(!preview&&this.suspended)||this.disposed)return;const osc=c.createOscillator(),gain=c.createGain();osc.frequency.setValueAtTime(success?660:480,c.currentTime);osc.frequency.setValueAtTime(success?880:620,c.currentTime+.07);gain.gain.setValueAtTime(preview?.3:.14,c.currentTime);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+.2);osc.connect(gain).connect(this.master);osc.start();osc.stop(c.currentTime+.22);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
 async preview(){if(!await this.unlock())return '当前浏览器未能启用声音，请再点击试听。';if(this.muted||this.volume===0)return '当前已静音或音量为零，请先开启声音并调高音量。';this.cue(true,true);return '已发送双音提示。若仍听不到，请检查网页标签、系统音量和输出设备。';}
 dispose(){this.disposed=true;this.equipment?.dispose();this.equipment=null;this.score=null;for(const s of this.sources){try{s.stop();}catch{}s.disconnect();}this.sources=[];void this.ctx?.close().catch(()=>{});this.ctx=null;this.noise=null;}
}
