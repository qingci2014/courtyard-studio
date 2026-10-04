// Generated floor plans with independent wall truth; never user drawing coordinates.
export function planFixture({style='outline',scale=1,grey=0,background=255,variant=0,furniture=true,mirror=false,windows=false,breaks=false}={}){
 const W=1000,H=760,w=Math.round(W*scale),h=Math.round(H*scale),ppm=80*scale;
 const pixels=new Uint8ClampedArray(w*h*4),truth=[],furnitureZones=[];
 for(let i=0;i<w*h;i++){pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=background;pixels[i*4+3]=255;}
 const rect=(x,y,width,height,color=grey)=>{
  const x0=Math.max(0,Math.round((mirror?W-x-width:x)*scale)),x1=Math.min(w,Math.max(x0+1,Math.round((mirror?W-x:x+width)*scale)));
  const y0=Math.max(0,Math.round(y*scale)),y1=Math.min(h,Math.max(y0+1,Math.round((y+height)*scale)));
  for(let Y=y0;Y<y1;Y++)for(let X=x0;X<x1;X++){const i=(Y*w+X)*4;pixels[i]=pixels[i+1]=pixels[i+2]=color;}
 };
 const outline=(x,y,width,height,ink=1)=>{rect(x,y,width,ink);rect(x,y+height-ink,width,ink);rect(x,y,ink,height);rect(x+width-ink,y,ink,height);};
 const segment=(x1,y1,x2,y2,t=16,openings=[])=>{
  truth.push({a:{x:(mirror?W-x1:x1)/80,y:y1/80},b:{x:(mirror?W-x2:x2)/80,y:y2/80},thickness:t/80});
  const vertical=x1===x2,start=vertical?y1:x1,end=vertical?y2:x2;
  let cursor=start;
  for(const [gap0,gap1] of [...openings,[end,end]]){
   if(gap0>cursor){
    const x=vertical?x1-t/2:cursor,y=vertical?cursor:y1-t/2,width=vertical?t:gap0-cursor,height=vertical?gap0-cursor:t;
    if(style==='solid')rect(x,y,width,height);else outline(x,y,width,height);
   }
   cursor=gap1;
  }
 };
 const right=900+variant*8,bottom=680-variant*9,partition=380+variant*22,divider=395+variant*7;
 segment(70,70,right,70,20);
 segment(70,70,70,bottom,20);
 segment(right,70,right,bottom,20);
 segment(70,bottom,right,bottom,20,[[580,660]]);
 segment(partition,70,partition,bottom,14,[[450,515]]);
 segment(70,divider,partition,divider,14);
 // A short return must survive the former 1 m cutoff.
 segment(partition,240,partition+48,240,14);
 // Filled corner / junction piers, with outlines continuing through them.
 for(const [x,y] of [[70,70],[partition,70],[70,bottom],[right,bottom]])rect(x-21,y-23,42,46);
 if(windows){
  for(const y of [54,61,67,73,79,85])rect(510,y,215,1);
  rect(510,54,3,32);rect(722,54,3,32);
 }
 if(breaks){
  for(const x of [170,285,810]){rect(x,58,2,24,background);rect(x,bottom-12,2,24,background);}
  for(const y of [170,315,555])rect(right-12,y,24,2,background);
 }
 if(furniture){
  outline(570,155,215,150);outline(575,160,205,140);
  outline(740,170,34,52);outline(740,240,34,52);
  outline(200,155,105,60);outline(205,160,95,50);
  outline(partition-48,290,6,90);
  furnitureZones.push({x0:(mirror?W-785:570)/80,x1:(mirror?W-570:785)/80,y0:155/80,y1:305/80});
  furnitureZones.push({x0:(mirror?W-305:200)/80,x1:(mirror?W-200:305)/80,y0:155/80,y1:215/80});
  // Text-like marks and dimension ticks, disconnected from building geometry.
  for(let i=0;i<24;i++){const x=80+i*30;rect(x,715,1,13);rect(x,715,7,1);rect(x+6,715,1,13);rect(x,721,6,1);}
  rect(70,738,right-70,1);rect(70,730,1,14);rect(right,730,1,14);
 }
 return{pixels,width:w,height:h,ppm,truth,furnitureZones,name:[style,scale,grey,variant,mirror?'mirror':'normal'].join('-')};
}

export function wallMetrics(result,fixture){
 const walls=result.walls.filter(w=>w.structuralKind!=='column');
 const distance=(p,w)=>{const dx=w.b.x-w.a.x,dy=w.b.y-w.a.y,l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p.x-w.a.x)*dx+(p.y-w.a.y)*dy)/l2)):0;return Math.hypot(p.x-w.a.x-t*dx,p.y-w.a.y-t*dy);};
 let matched=0,total=0;
 for(const w of fixture.truth){const len=Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y),n=Math.ceil(len/.05);for(let i=0;i<=n;i++){const p={x:w.a.x+(w.b.x-w.a.x)*i/n,y:w.a.y+(w.b.y-w.a.y)*i/n};total++;if(walls.some(q=>distance(p,q)<Math.max(.08,w.thickness*.42)))matched++;}}
 let falseLength=0;
 for(const w of walls){const p={x:(w.a.x+w.b.x)/2,y:(w.a.y+w.b.y)/2};if(!fixture.truth.some(q=>distance(p,q)<Math.max(.12,q.thickness)))falseLength+=Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y);}
 return{coverage:matched/total,falseLength,walls:walls.length};
}
