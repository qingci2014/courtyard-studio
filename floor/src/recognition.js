import {uid,wall,clamp} from './model.js';

// Local geometry analysis. Ambiguous disconnected outlines stay in review.
const overlap=(a,b)=>Math.max(0,Math.min(a.b,b.b)-Math.max(a.a,b.a));
const span=s=>s.b-s.a;
const quantile=(v,q)=>v.length?[...v].sort((a,b)=>a-b)[Math.floor((v.length-1)*q)]:0;
function binarize(pixels,w,h,threshold){
 const grey=new Uint8Array(w*h),hist=new Uint32Array(256);
 for(let i=0;i<grey.length;i++){const alpha=pixels[4*i+3]/255,v=Math.round((pixels[4*i]*.2126+pixels[4*i+1]*.7152+pixels[4*i+2]*.0722)*alpha+255*(1-alpha));grey[i]=v;hist[v]++;}
 if(!Number.isFinite(threshold)){
  let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
  let lower=0,weight=0,best=-1,cut=130;
  for(let i=0;i<255;i++){weight+=hist[i];lower+=i*hist[i];const upper=grey.length-weight;if(!weight||!upper)continue;const variance=weight*upper*(lower/weight-(sum-lower)/upper)**2;if(variance>best){best=variance;cut=i;}}
  threshold=clamp(cut+24,80,235);
 }
 const binary=new Uint8Array(grey.length);
 for(let i=0;i<grey.length;i++)binary[i]=grey[i]<=threshold?1:0;
 const pitch=w+1,integral=new Uint32Array(pitch*(h+1));
 for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=binary[y*w+x];integral[(y+1)*pitch+x+1]=integral[y*pitch+x+1]+row;}}
 const density=(x0,y0,x1,y1)=>{
  x0=clamp(Math.floor(x0),0,w);y0=clamp(Math.floor(y0),0,h);x1=clamp(Math.ceil(x1),0,w);y1=clamp(Math.ceil(y1),0,h);
  if(x1<=x0||y1<=y0)return 0;
  return(integral[y1*pitch+x1]-integral[y0*pitch+x1]-integral[y1*pitch+x0]+integral[y0*pitch+x0])/((x1-x0)*(y1-y0));
 };
 return{binary,density,threshold};
}
function traceBands(binary,w,h,minRun,vertical){
 const rows=vertical?w:h,cols=vertical?h:w,bands=[];let active=[];
 for(let y=0;y<rows;y++){
  const runs=[];let a=-1,last=-1;
  for(let x=0;x<=cols+1;x++){const dark=x<cols&&binary[vertical?x*w+y:y*w+x];if(dark){if(a<0)a=x;last=x;}else if(a>=0&&x-last>1){if(last-a+1>=minRun)runs.push({a,b:last+1});a=-1;}}
  const next=[];
  for(const r of runs){
   const match=active.find(s=>!s.used&&Math.abs(s.a-r.a)+Math.abs(s.b-r.b)<=Math.max(5,Math.min(span(s),span(r))*.06));
   if(match){match.used=true;next.push({a:(match.a*match.n+r.a)/(match.n+1),b:(match.b*match.n+r.b)/(match.n+1),top:match.top,bottom:y+1,n:match.n+1,vertical});}
   else next.push({...r,top:y,bottom:y+1,n:1,vertical});
  }
  active.filter(s=>!s.used).forEach(s=>bands.push(s));active=next;
 }
 bands.push(...active);
 return bands.map(s=>({vertical:s.vertical,a:s.a,b:s.b,c:(s.top+s.bottom)/2,t:s.bottom-s.top}));
}
function segmentBox(s){return s.vertical?{x0:s.c-s.t/2,y0:s.a,x1:s.c+s.t/2,y1:s.b}:{x0:s.a,y0:s.c-s.t/2,x1:s.b,y1:s.c+s.t/2};}
function rectangleOverlap(a,b){return Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));}
const boxArea=b=>(b.x1-b.x0)*(b.y1-b.y0);
const contains=(b,x,y,pad=0)=>x>=b.x0-pad&&x<=b.x1+pad&&y>=b.y0-pad&&y<=b.y1+pad;
function filledMasses(density,w,h,k,ppm){
 const step=Math.max(1,Math.round(k/7)),W=Math.max(1,Math.floor((w-k)/step)+1),H=Math.max(1,Math.floor((h-k)/step)+1);
 const mask=new Uint8Array(W*H),boxes=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(density(x*step,y*step,x*step+k,y*step+k)>.97)mask[y*W+x]=1;
 for(let i=0;i<mask.length;i++){
  if(mask[i]!==1)continue;const queue=[i];mask[i]=2;let x0=W,y0=H,x1=0,y1=0;
  for(let p=0;p<queue.length;p++){
   const n=queue[p],x=n%W,y=Math.floor(n/W);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(xx>=0&&xx<W&&yy>=0&&yy<H&&mask[yy*W+xx]===1){mask[yy*W+xx]=2;queue.push(yy*W+xx);}
  }
  const b={x0:x0*step,y0:y0*step,x1:x1*step+k,y1:y1*step+k};
  if(queue.length>=2&&b.x1-b.x0<ppm*1.6&&b.y1-b.y0<ppm*1.6&&density(b.x0,b.y0,b.x1,b.y1)>.84)boxes.push(b);
 }
 return boxes;
}
function deduplicateSegments(input,ppm){
 const out=[];
 for(const s of [...input].sort((a,b)=>(b.caps||0)-(a.caps||0)||span(b)-span(a))){
  const q=out.find(q=>q.vertical===s.vertical&&Math.abs(q.c-s.c)<=Math.max(1.5,Math.min(q.t,s.t)*.32)&&overlap(q,s)>=Math.min(span(q),span(s))*.6);
  if(q){
   if(s.source==='solid'&&q.source!=='solid'){q.t=s.t;q.c=s.c;q.source='solid';}
   q.a=Math.min(q.a,s.a);q.b=Math.max(q.b,s.b);q.caps=Math.max(q.caps||0,s.caps||0);q.windowRanges.push(...(s.windowRanges||[]));
  }else out.push({...s,windowRanges:[...(s.windowRanges||[])]});
 }
 let changed=true;
 while(changed){
  changed=false;
  outer:for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
   const a=out[i],b=out[j];
   if(a.vertical!==b.vertical||Math.abs(a.c-b.c)>Math.max(1.5,Math.min(a.t,b.t)*.25)||Math.abs(a.t-b.t)>Math.max(3,Math.max(a.t,b.t)*.4))continue;
   if(Math.max(a.a,b.a)-Math.min(a.b,b.b)>Math.max(2,ppm*.045))continue;
   const n=span(a)+span(b);a.c=(a.c*span(a)+b.c*span(b))/n;
   a.a=Math.min(a.a,b.a);a.b=Math.max(a.b,b.b);a.caps=Math.max(a.caps||0,b.caps||0);a.windowRanges.push(...b.windowRanges);
   out.splice(j,1);changed=true;break outer;
  }
 }
 return out;
}
function connected(a,b,ppm,allowDoorGaps){
 if(a.vertical===b.vertical){const gap=Math.max(a.a,b.a)-Math.min(a.b,b.b);return Math.abs(a.c-b.c)<Math.max(2,Math.min(a.t,b.t)*.32)&&gap<Math.max(a.t,b.t)+(allowDoorGaps?ppm*1.8:ppm*.08);}
 const h=a.vertical?b:a,v=a.vertical?a:b,tol=Math.max(2,(h.t+v.t)/2+ppm*.035);
 return v.c>=h.a-tol&&v.c<=h.b+tol&&h.c>=v.a-tol&&h.c<=v.b+tol;
}
// Window frames and mouldings produce several valid parallel pairs inside one
// wall strip. Keep its supported long axis instead of extruding every pair.
function consolidateWallStrips(input,ppm){
 const ordered=[...input].sort((a,b)=>span(b)-span(a)),kept=[];
 for(const s of ordered){
  const parent=kept.find(q=>q.vertical===s.vertical&&span(q)>span(s)*1.15&&overlap(q,s)>span(s)*.8&&Math.abs(q.c-s.c)<q.t*.85&&s.t<q.t*1.25);
  if(parent){parent.windowRanges.push(...s.windowRanges);continue;}
  const inside=kept.some(q=>q.vertical!==s.vertical&&span(q)>ppm*2&&span(s)<q.t*1.8&&Math.abs((s.a+s.b)/2-q.c)<q.t*.65&&s.c>q.a&&s.c<q.b);
  if(!inside)kept.push(s);
 }
 return kept;
}
function snapJunctions(segments,ppm){
 const original=segments.map(s=>({...s}));
 for(let i=0;i<segments.length;i++)for(const end of ['a','b']){
  const s=segments[i],old=original[i];let best=null,distance=Infinity;
  for(let j=0;j<original.length;j++){
   if(i===j)continue;const q=original[j];if(old.vertical===q.vertical)continue;
   const tol=Math.max(2,(old.t+q.t)/2+ppm*.06),d=Math.abs(old[end]-q.c);
   if(d>tol||old.c<q.a-tol||old.c>q.b+tol)continue;
   if(d<distance){best=q.c;distance=d;}
  }
  if(best!==null)s[end]=best;
 }
}
export function detectRaster(pixels,width,height,options={}){
 const {pixelsPerMeter=80,origin={x:0,y:0},inferOpenings=true,sensitivity='balanced'}=options;
 const ppm=Math.max(1,pixelsPerMeter),minPixels=options.minPixels??ppm*.55;
 const {binary,density,threshold}=binarize(pixels,width,height,options.threshold);
 const minRun=Math.max(7,Math.min(minPixels*.32,ppm*.24));
 const bands=[...traceBands(binary,width,height,minRun,false),...traceBands(binary,width,height,minRun,true)];
 const stroke=clamp(quantile(bands.filter(s=>span(s)>ppm*.6).map(s=>s.t),.35)||1,1,Math.max(2,ppm*.04));
 const thin=bands.filter(s=>s.t<=Math.max(2.5,stroke*2.5)&&span(s)>minRun);
 let solids=bands.filter(s=>s.t>=Math.max(3,ppm*.045)&&s.t<=ppm*.8&&span(s)>=Math.max(minRun,s.t*2.8)).map(s=>({...s,source:'solid',caps:2,windowRanges:[]}));
 const masses=filledMasses(density,width,height,Math.ceil(Math.max(7,ppm*.28,quantile(solids.map(s=>s.t),.5)*1.6)),ppm);
 solids=solids.filter(s=>{const b=segmentBox(s);return !masses.some(m=>rectangleOverlap(m,b)>.8*boxArea(b));});
 const interiorDensity=box=>{
  let area=boxArea(box),ink=density(box.x0,box.y0,box.x1,box.y1)*area;
  for(const m of masses){const cut={x0:Math.max(box.x0,m.x0),y0:Math.max(box.y0,m.y0),x1:Math.min(box.x1,m.x1),y1:Math.min(box.y1,m.y1)};
   if(cut.x1<=cut.x0||cut.y1<=cut.y0)continue;const a=boxArea(cut);area-=a;ink-=a*density(cut.x0,cut.y0,cut.x1,cut.y1);
  }
  return area>1?Math.max(0,ink)/area:1;
 };
 const cap=(s,end)=>{
  const p=s[end],r=Math.max(2,stroke*2),c0=s.c-s.t/2,c1=s.c+s.t/2;
  for(let d=-r;d<=r;d++){const v=s.vertical?density(c0,p+d,c1,p+d+1):density(p+d,c0,p+d+1,c1);if(v>.63)return 1;}
  return masses.some(m=>contains(m,s.vertical?s.c:p,s.vertical?p:s.c,r))?1:0;
 };
 const pairs=[];
 for(const vertical of [false,true]){
  const edges=thin.filter(s=>s.vertical===vertical).sort((a,b)=>a.c-b.c);
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
   const a=edges[i],b=edges[j],gap=b.c-a.c;
   if(gap>Math.min(ppm*.65,Math.min(width,height)*.085))break;
   if(gap<Math.max(stroke*2.5,ppm*.035)||overlap(a,b)<minRun*1.4)continue;
   const s={vertical,a:Math.max(a.a,b.a),b:Math.min(a.b,b.b),c:(a.c+b.c)/2,t:gap+(a.t+b.t)/2,source:'paired',windowRanges:[]};
   if(span(s)<s.t*2.2)continue;
   const inner=interiorDensity(s.vertical?{x0:a.c+a.t,y0:s.a+2,x1:b.c-b.t,y1:s.b-2}:{x0:s.a+2,y0:a.c+a.t,x1:s.b-2,y1:b.c-b.t});
   if(inner>.35)continue;
   s.caps=cap(s,'a')+cap(s,'b');
   const inside=edges.filter(e=>e.c>a.c+stroke*2&&e.c<b.c-stroke*2&&overlap(e,s)>span(s)*.8);
   if(inside.length>=2&&span(s)>ppm*.45)s.windowRanges.push({a:s.a,b:s.b});
   pairs.push(s);
  }
 }
 const candidates=deduplicateSegments([...solids,...pairs],ppm).sort((a,b)=>span(b)-span(a)).slice(0,900);
 const bin=Math.max(2,ppm*.025),hist=new Map();
 for(const s of candidates){const k=Math.round(s.t/bin);hist.set(k,(hist.get(k)||0)+span(s)*(s.source==='solid'?1.6:s.caps?1:.25));}
 const peaks=[...hist].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([b])=>b*bin),dominant=peaks[0]||ppm*.2;
 for(const s of candidates){
  s.commonWidth=peaks.some(t=>Math.abs(s.t-t)<Math.max(bin*1.5,t*.18));s.anchors=0;
  for(const m of masses){
   const cross=s.vertical?[m.x0,m.x1]:[m.y0,m.y1],along=s.vertical?[m.y0,m.y1]:[m.x0,m.x1];
   if(s.c<cross[0]-1||s.c>cross[1]+1)continue;
   if(s.a>=along[0]-2&&s.a<=along[1]+2){s.a=along[0];s.anchors++;}
   if(s.b>=along[0]-2&&s.b<=along[1]+2){s.b=along[1];s.anchors++;}
  }
 }
 const graph=candidates.map(()=>[]);
 // Decide structural support before bridging door-sized gaps. Otherwise a sofa
 // aligned with a partition can be attached to the building by an invented door.
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)if(connected(candidates[i],candidates[j],ppm,false)){graph[i].push(j);graph[j].push(i);}
 const seen=new Set(),accepted=new Set(),ambiguous=new Set();
 for(let start=0;start<candidates.length;start++){
  if(seen.has(start))continue;const group=[],queue=[start];seen.add(start);
  while(queue.length){const i=queue.pop();group.push(i);for(const j of graph[i])if(!seen.has(j)){seen.add(j);queue.push(j);}}
  const ss=group.map(i=>candidates[i]),boxes=ss.map(segmentBox);
  const x0=Math.min(...boxes.map(b=>b.x0)),y0=Math.min(...boxes.map(b=>b.y0)),x1=Math.max(...boxes.map(b=>b.x1)),y1=Math.max(...boxes.map(b=>b.y1));
  const total=ss.reduce((n,s)=>n+span(s),0)/ppm,extent=(x1-x0)*(y1-y0)/ppm**2,anchors=ss.reduce((n,s)=>n+s.anchors,0);
  const solid=ss.some(s=>s.source==='solid'&&span(s)>ppm*1.4),robust=ss.filter(s=>s.caps>=1&&s.t>=Math.max(stroke*3,ppm*.075,dominant*.5)).length;
  const structural=(total>5&&(solid||anchors>=2||extent>5&&robust>=2||extent>2.5&&robust>=4))||ss.some(s=>s.source==='solid'&&span(s)>ppm*2.5);
  for(const i of group){
   const s=candidates[i],weakThin=s.t<Math.max(dominant*.37,stroke*3)&&s.source!=='solid';
   const supported=s.source==='solid'||s.anchors>0||s.caps>0||s.commonWidth&&graph[i].length>=2;
   s.confidence=clamp((structural?.35:0)+(s.source==='solid'?.3:.1)+(s.caps>0?.17:0)+(s.commonWidth?.15:0)+(s.anchors>0?.15:0)+(graph[i].length>=2?.1:0)-(weakThin?.22:0),0,.99);
   const uncertainDetail=s.source==='paired'&&!s.anchors&&(!s.caps&&span(s)<ppm*.95||!s.commonWidth&&s.t>dominant*1.3&&span(s)<ppm*2.5);
   if(structural&&supported&&!uncertainDetail&&span(s)>=minRun*1.3&&(!weakThin||s.anchors||s.caps===2&&graph[i].length>=2)&&s.confidence>=(sensitivity==='more'?.42:.53))accepted.add(i);
   else if(span(s)>=minPixels*.65&&s.confidence>.14)ambiguous.add(i);
  }
 }
 let segments=consolidateWallStrips(deduplicateSegments([...accepted].map(i=>candidates[i]),ppm),ppm);
 snapJunctions(segments,ppm);
 const openingSpans=[];
 if(inferOpenings){
  let changed=true;
  while(changed){
   changed=false;
   outer:for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    let a=segments[i],b=segments[j];if(a.a>b.a)[a,b]=[b,a];const gap=b.a-a.b;
    if(a.vertical!==b.vertical||Math.abs(a.c-b.c)>Math.max(2,Math.min(a.t,b.t)*.2)||Math.abs(a.t-b.t)>Math.max(3,Math.min(a.t,b.t)*.4)||gap<Math.max(ppm*.5,Math.min(a.t,b.t))||gap>ppm*2.4)continue;
    openingSpans.push({vertical:a.vertical,c:a.c,a:a.b,b:b.a,type:'door'});
    const combined={...a,b:b.b,windowRanges:[...a.windowRanges,...b.windowRanges]};
    segments.splice(j,1);segments[i]=combined;changed=true;break outer;
   }
  }
 }
 segments=consolidateWallStrips(segments,ppm);snapJunctions(segments,ppm);segments=segments.filter(s=>span(s)>.1*ppm);
 const toWall=s=>{const p=v=>v/ppm;return{...wall(s.vertical?{x:origin.x+p(s.c),y:origin.y+p(s.a)}:{x:origin.x+p(s.a),y:origin.y+p(s.c)},s.vertical?{x:origin.x+p(s.c),y:origin.y+p(s.b)}:{x:origin.x+p(s.b),y:origin.y+p(s.c)},clamp(p(s.t),.04,1.2)),inferred:true,recognitionSource:s.source,confidence:s.confidence??.9};};
 const walls=segments.map(toWall),openings=[];
 for(let i=0;i<segments.length;i++){
  const s=segments[i],w=walls[i],ranges=inferOpenings?[...openingSpans.filter(o=>o.vertical===s.vertical&&Math.abs(o.c-s.c)<s.t/2),...s.windowRanges.map(r=>({...r,type:'window'}))].sort((a,b)=>a.a-b.a):[];
  for(const r of ranges){
   const a=Math.max(s.a+2,r.a),b=Math.min(s.b-2,r.b),width=(b-a)/ppm,offset=((a+b)/2-s.a)/ppm;
   if(width<.3||width>5||openings.some(o=>o.wallId===w.id&&Math.abs(o.offset-offset)<(o.width+width)/2+.05))continue;
   openings.push({id:uid(),wallId:w.id,type:r.type,width,offset,height:r.type==='door'?2.1:1.4,sill:r.type==='door'?0:.9,hinge:1,inferred:true});
  }
 }
 const columnWalls=[];
 for(const m of masses){
  if(!segments.some(s=>rectangleOverlap(m,segmentBox(s))>0))continue;
  const vertical=m.y1-m.y0>=m.x1-m.x0,s={vertical,a:vertical?m.y0:m.x0,b:vertical?m.y1:m.x1,c:vertical?(m.x0+m.x1)/2:(m.y0+m.y1)/2,t:vertical?m.x1-m.x0:m.y1-m.y0,source:'column',confidence:.9};
  const w=toWall(s);w.structuralKind='column';columnWalls.push(w);
 }
 const reviewWalls=deduplicateSegments([...ambiguous].map(i=>candidates[i]).filter(s=>!segments.some(q=>q.vertical===s.vertical&&Math.abs(q.c-s.c)<Math.max(q.t,s.t)*.6&&overlap(q,s)>span(s)*.6)),ppm).slice(0,150).map(toWall);
 return{walls:[...walls,...columnWalls],openings,reviewWalls,stats:{threshold,edgeRuns:thin.length,pairedWalls:segments.filter(s=>s.source==='paired').length,columns:columnWalls.length,reviewCount:reviewWalls.length,discarded:Math.max(0,candidates.length-walls.length-reviewWalls.length),width,height}};
}
export async function detectPlan(image,options={}){
 const bitmap=await createImageBitmap(await(await fetch(image.data)).blob());
 try{
  const crop=image.crop,srcScale=bitmap.width/image.width;let sx=0,sy=0,sw=bitmap.width,sh=bitmap.height;
  if(crop){sx=clamp(Math.round((crop.x-image.x)*srcScale),0,bitmap.width-1);sy=clamp(Math.round((crop.y-image.y)*srcScale),0,bitmap.height-1);sw=clamp(Math.round(crop.w*srcScale),1,bitmap.width-sx);sh=clamp(Math.round(crop.h*srcScale),1,bitmap.height-sy);}
  const scale=Math.min(1,2400/Math.max(sw,sh)),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(sw*scale));cv.height=Math.max(1,Math.round(sh*scale));
  const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(bitmap,sx,sy,sw,sh,0,0,cv.width,cv.height);
  const pixelsPerMeter=srcScale*scale,data=ctx.getImageData(0,0,cv.width,cv.height);await new Promise(r=>requestAnimationFrame(r));
  return detectRaster(data.data,cv.width,cv.height,{...options,pixelsPerMeter,minPixels:Math.max(10,(options.minLength??.55)*pixelsPerMeter),origin:{x:image.x+sx/srcScale,y:image.y+sy/srcScale}});
 }finally{bitmap.close();}
}
