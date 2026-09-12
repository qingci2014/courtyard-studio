'use client';
import {useEffect,useRef,useState} from 'react';
import CockpitMusic from './cockpit-music';
export default function CockpitPage(){
 const [ready,setReady]=useState(false);
 const host=useRef<HTMLDivElement>(null);const [status,setStatus]=useState('正在载入驾驶舱…');const scene=useRef<{dispose:()=>void;view:(seat:boolean)=>void}|null>(null);
 useEffect(()=>{let live=true;import('./moon-cockpit-view').then(async({CockpitView})=>{if(!live||!host.current)return;const v=new CockpitView(host.current,text=>{if(live)setStatus(text);});scene.current=v;try{await v.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));if(live){setReady(true);setStatus('拖动环视 · 滚轮调整视野');}}catch{if(live)setStatus('驾驶舱加载失败，请刷新重试');}});return()=>{live=false;scene.current?.dispose();};},[]);
 return <main style={{position:'fixed',inset:0,background:'#030609',color:'#b6d5de',fontFamily:'sans-serif'}}><div ref={host} style={{position:'absolute',inset:0}}/><header style={{position:'absolute',top:24,left:28,pointerEvents:'none',letterSpacing:3,fontSize:12}}>SELENE / CREW TRANSFER<br/><span style={{display:'block',marginTop:8,fontSize:20,letterSpacing:1}}>驾驶舱</span></header><CockpitMusic ready={ready} src="/moon/content/audio/moon2.m4a?v=ee501b14de19" returnHref="/moon/?from=cockpit"/>{!ready&&<span role="status" style={{position:'absolute',bottom:114,left:'50%',transform:'translateX(-50%)',fontSize:12,padding:'8px 12px',background:'#08121ddb',borderRadius:5}}>{status}</span>}</main>;
}
