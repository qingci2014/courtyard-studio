import {useEffect,useRef,useState} from 'react';

const preferenceKey='selene-cockpit-music-v1';
export default function CockpitMusic({ready,src,returnHref}:{ready:boolean;src:string;returnHref:string}){
 const audio=useRef<HTMLAudioElement>(null),panel=useRef<HTMLElement>(null);
 const enabled=useRef(true),alive=useRef(false);
 const [volume,setVolume]=useState(35),[playing,setPlaying]=useState(false),[failed,setFailed]=useState(false);
 const save=()=>{try{localStorage.setItem(preferenceKey,JSON.stringify({volume:audio.current?.volume??.35}));}catch{}};
 const play=()=>{
  const player=audio.current;if(!player||!ready||document.hidden)return;
  setFailed(false);
  void player.play().then(()=>{if(!alive.current||!enabled.current||document.hidden)player.pause();}).catch(error=>{
   if(alive.current&&error?.name!=='NotAllowedError'&&error?.name!=='AbortError')setFailed(true);
  });
 };
 useEffect(()=>{
  alive.current=true;enabled.current=true;const player=audio.current!;
  try{const pref=JSON.parse(localStorage.getItem(preferenceKey)??'null');if(pref){if(Number.isFinite(pref.volume)){player.volume=Math.min(1,Math.max(0,pref.volume));setVolume(Math.round(player.volume*100));}else player.volume=.35;}else player.volume=.35;}catch{player.volume=.35;}
  return()=>{alive.current=false;player.pause();};
 },[]);
 useEffect(()=>{
  if(!ready)return;
  if(enabled.current)play();
  const unlock=(event:Event)=>{if(panel.current?.contains(event.target as Node))return;if(enabled.current&&audio.current?.paused)play();};
  const visibility=()=>{if(document.hidden)audio.current?.pause();else if(enabled.current)play();};
  document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);document.addEventListener('visibilitychange',visibility);
  return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',visibility);audio.current?.pause();};
 },[ready,src]);
 const toggle=()=>{const player=audio.current;if(!player)return;if(!player.paused){enabled.current=false;player.pause();}else{enabled.current=true;play();}save();};
 const adjustVolume=(delta:number)=>{const player=audio.current;if(!player)return;const next=Math.min(100,Math.max(0,Math.round(player.volume*100)+delta));player.volume=next/100;setVolume(next);save();};
 const playLabel=failed?'重试播放背景音乐':playing?'暂停背景音乐':'播放背景音乐';
 return <nav ref={panel} className="cockpit-controls" aria-label="驾驶舱控制">
  <audio ref={audio} src={ready?src:undefined} loop preload="none" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>setFailed(true)}/>
  <div className="cockpit-transport" role="group" aria-label={`背景音乐 · 音量 ${volume}%`}>
   <button type="button" className="cockpit-volume-key" disabled={volume===0} aria-label="降低音乐音量" title={`降低音量 · 当前 ${volume}%`} onClick={()=>adjustVolume(-5)}><span className="cockpit-small-keycap"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8"/></svg></span></button>
  <button className="cockpit-play" type="button" disabled={!ready} aria-label={playLabel} title={playLabel} aria-pressed={playing} onClick={toggle}>
   <span className="cockpit-keycap">{playing?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z" fill="currentColor"/></svg>}</span>
  </button>
   <button type="button" className="cockpit-volume-key" disabled={volume===100} aria-label="提高音乐音量" title={`提高音量 · 当前 ${volume}%`} onClick={()=>adjustVolume(5)}><span className="cockpit-small-keycap"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8M8 4v8"/></svg></span></button>
  </div>
  <a className="cockpit-return" href={returnHref}>返回基地</a>
  <style>{`
   .cockpit-controls{position:absolute;inset:0;pointer-events:none}
   .cockpit-transport{position:absolute;pointer-events:auto;bottom:max(24px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:18px;padding:0;background:none;border:0;white-space:nowrap}
   .cockpit-play{position:relative;display:grid;place-items:center;flex:none;width:68px;height:68px;padding:7px;border:1px solid #73848c;border-radius:50%;background:repeating-conic-gradient(from 1deg,#172126 0deg 2deg,#8a979c 2deg 3deg,#334149 3deg 6deg);box-shadow:0 5px 0 #081115,0 6px 0 #617079,0 10px 12px #000b,inset 0 1px 2px #e0edf5b3,inset 0 -2px 3px #000;cursor:pointer;transition:transform .1s,box-shadow .1s}
   .cockpit-play:before{content:'';position:absolute;inset:4px;border:2px solid #101a20;border-top-color:#d6e1e9b3;border-left-color:#7f919ab3;border-radius:50%;box-shadow:0 0 0 1px #b8cbd340;pointer-events:none}
   .cockpit-keycap{position:relative;display:grid;place-items:center;width:100%;height:100%;box-sizing:border-box;border:1px solid #84959d;border-bottom-color:#10191e;border-radius:50%;background:radial-gradient(ellipse at 35% 5%,#b2c5ce80,transparent 65%),repeating-linear-gradient(0deg,#b4c3cb0c 0 1px,transparent 1px 3px),linear-gradient(150deg,#667982 0%,#35444d 43%,#1b2a33 72%,#0a141b 100%);box-shadow:inset 0 2px 2px #d4e6ec70,inset 0 -3px 4px #02090ed9,0 2px 3px #000c;color:#c7e9f2}
   .cockpit-keycap:after{content:'';position:absolute;bottom:5px;width:10px;height:2px;border-radius:1px;background:#121e24;box-shadow:0 1px 0 #7a959c55,inset 0 1px 1px #000}
   .cockpit-play svg{width:23px;height:23px;filter:drop-shadow(0 -1px 1px #000) drop-shadow(0 1px 0 #e4faff33)}
   .cockpit-play[aria-pressed=true] .cockpit-keycap:after{background:#acdfed;box-shadow:0 0 5px #94dbee99}.cockpit-play[aria-pressed=true] svg{color:#e0f7ff;filter:drop-shadow(0 0 3px #9bdcf455) drop-shadow(0 -1px 1px #000)}
   .cockpit-play:hover:not(:disabled) .cockpit-keycap{filter:brightness(1.15)}.cockpit-play:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0 #081115,0 2px 0 #617079,0 4px 7px #000b,inset 0 1px 2px #e0edf5b3}.cockpit-play:active:not(:disabled) .cockpit-keycap{box-shadow:inset 0 2px 5px #000a}
   .cockpit-volume-key{position:relative;display:grid;place-items:center;width:36px;height:36px;padding:4px;border:1px solid #8a999f;border-radius:50%;background:conic-gradient(from 20deg,#3a4950,#becacf 13%,#56686f 24%,#101b21 43%,#83979f 63%,#d5e1e6 72%,#394951 87%,#3a4950);box-shadow:0 3px 0 #0a141a,0 4px 0 #65737b,0 7px 8px #000a,inset 0 1px 1px #e9f4f955;cursor:pointer;transition:transform .1s,box-shadow .1s}
   .cockpit-small-keycap{display:grid;place-items:center;width:100%;height:100%;border:1px solid #132027;border-top-color:#8c9ea666;border-radius:50%;background:repeating-linear-gradient(0deg,#cedbe10c 0 1px,transparent 1px 3px),linear-gradient(145deg,#6c7e87,#344750 48%,#14212a);box-shadow:inset 0 1px 1px #b4c9d459,inset 0 -2px 3px #0009,0 1px 2px #0008;color:#d0e5ec}
   .cockpit-volume-key svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;filter:drop-shadow(0 -1px 1px #000)}.cockpit-volume-key:hover:not(:disabled) .cockpit-small-keycap{filter:brightness(1.18)}.cockpit-volume-key:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #0a141a,0 2px 4px #000a}
   .cockpit-controls button:disabled{opacity:.4;cursor:default}.cockpit-return{position:absolute;top:max(24px,env(safe-area-inset-top));right:max(28px,env(safe-area-inset-right));pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;background:#182c38;border:1px solid #486473;color:#c8e2ec;padding:9px 14px;border-radius:5px;cursor:pointer;text-decoration:none;font-size:13px;line-height:20px;font-family:inherit}.cockpit-return:hover{background:#294856}
   .cockpit-controls :focus-visible{outline:2px solid #a8d8e7;outline-offset:4px}
   @media(max-width:360px){.cockpit-transport{gap:12px}.cockpit-play{width:60px;height:60px}}
  `}</style>
 </nav>;
}
