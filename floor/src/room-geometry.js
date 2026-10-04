const EPS=1e-4;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment=(p,a,b)=>Math.abs(cross(a,b,p))<EPS*Math.max(1,distance(a,b))&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
export const polygonArea=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
export function polygonContains(p,poly,strict=false){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[j],b=poly[i];if(onSegment(p,a,b))return !strict;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
export function roomLabelPoint(poly){
 let total=0,x=0,y=0;
 poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length],n=a[0]*b[1]-b[0]*a[1];total+=n;x+=(a[0]+b[0])*n;y+=(a[1]+b[1])*n;});
 const center=[x/(3*total),y/(3*total)];
 if(Number.isFinite(center[0])&&polygonContains(center,poly,true))return{x:center[0],y:center[1]};
 // A concave room's average can lie in a neighbouring room. Choose an interior scanline span.
 const ys=[...new Set(poly.map(p=>p[1]))].sort((a,b)=>a-b);let best=null;
 for(let k=1;k<ys.length;k++){
  const y=(ys[k]+ys[k-1])/2,xs=[];
  poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));});xs.sort((a,b)=>a-b);
  for(let i=0;i+1<xs.length;i+=2){const score=Math.min(xs[i+1]-xs[i],ys[k]-ys[k-1]);if(!best||score>best.score)best={x:(xs[i]+xs[i+1])/2,y,score};}
 }return best?{x:best.x,y:best.y}:{x:poly[0][0],y:poly[0][1]};
}
export function cleanRoomPolygon(points){
 const p=points.map(q=>[...q]);let changed=true;
 while(changed&&p.length>2){changed=false;for(let i=0;i<p.length;i++){
  const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];
  if(distance(a,b)<EPS||distance(a,c)<EPS||Math.abs(cross(a,b,c))<EPS*Math.max(1,distance(a,b),distance(b,c))){p.splice(i,1);changed=true;break;}
 }}return p;
}
function segmentsCross(a,b,c,d){
 const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),z=cross(c,d,b),ab=EPS*Math.max(1,distance(a,b)),cd=EPS*Math.max(1,distance(c,d));
 return (u>ab&&v<-ab||u<-ab&&v>ab)&&(w>cd&&z<-cd||w<-cd&&z>cd);
}
export function polygonsOverlap(a,b){
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(segmentsCross(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
 for(const [p,q] of [[a,b],[b,a]]){
  if(p.some(v=>polygonContains(v,q,true)))return true;
  for(let i=0;i<p.length;i++){const v=p[i],w=p[(i+1)%p.length];if(polygonContains([(v[0]+w[0])/2,(v[1]+w[1])/2],q,true))return true;}
  const c=roomLabelPoint(p);if(polygonContains([c.x,c.y],q,true))return true;
 }return false;
}
export function checkRoomPolygon(poly,rooms=[],ignoreId,{minArea=.45,minEdge=.01}={}){
 if(poly.length<3||poly.length>1000||poly.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||Math.abs(v)>500)))throw new Error('请沿分区边界至少点选三个角点');
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];if(distance(a,b)<minEdge)throw new Error('两个角点太近，请撤回后重新点选');
  for(let j=i+1;j<poly.length;j++){
   if(j===i+1||i===0&&j===poly.length-1)continue;const c=poly[j],d=poly[(j+1)%poly.length];
   if(segmentsCross(a,b,c,d)||onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b))throw new Error('边界交叉了，请沿顺时针或逆时针依次点选');
  }
 }
 if(polygonArea(poly)<minArea)throw new Error('轮廓面积太小，请检查圈出的边界');
 const overlap=rooms.find(r=>r.id!==ignoreId&&polygonsOverlap(poly,cleanRoomPolygon(r.poly)));
 if(overlap)throw new Error(`与“${overlap.name}”重叠了，请沿空白区域边缘描绘`);
 return poly;
}

// Heal small drafting gaps in the temporary room graph, without changing actual walls/openings.
export function roomBoundaryWalls(source){
 const walls=source.filter(w=>w.structuralKind!=='column'&&Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y)>.05);
 const len=w=>Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const project=(p,w)=>{const l=len(w),t=Math.max(0,Math.min(1,((p.x-w.a.x)*(w.b.x-w.a.x)+(p.y-w.a.y)*(w.b.y-w.a.y))/(l*l)));return {x:w.a.x+t*(w.b.x-w.a.x),y:w.a.y+t*(w.b.y-w.a.y)};};
 const free=walls.map((w,i)=>['a','b'].map(end=>!walls.some((q,j)=>j!==i&&dist(w[end],project(w[end],q))<.035)));
 const candidates=[];
 for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
  const a=walls[i],b=walls[j],la=len(a),lb=len(b),u={x:a.b.x-a.a.x,y:a.b.y-a.a.y},v={x:b.b.x-b.a.x,y:b.b.y-b.a.y},d={x:b.a.x-a.a.x,y:b.a.y-a.a.y},den=u.x*v.y-u.y*v.x;
  const inferred=(a.inferred||a.recognitionSource)&&(b.inferred||b.recognitionSource),limit=inferred?Math.min(.65,1.5*Math.max(a.thickness,b.thickness),.2*Math.min(la,lb)):Math.min(.2,Math.max(.035,(a.thickness+b.thickness)/2));
  if(Math.abs(den)/(la*lb)>.25){
   const t=(d.x*v.y-d.y*v.x)/den,s=(d.x*u.y-d.y*u.x)/den,da=Math.max(0,-t,t-1)*la,db=Math.max(0,-s,s-1)*lb;
   if(da+db<EPS||da>limit||db>limit)continue;
   const ea=t<0?0:t>1?1:-1,eb=s<0?0:s>1?1:-1;
   if(ea>=0&&!free[i][ea]||eb>=0&&!free[j][eb])continue;
   const p={x:a.a.x+t*u.x,y:a.a.y+t*u.y},parts=[],ends=[];
   if(ea>=0){parts.push({a:{...a[ea?'b':'a']},b:p});ends.push(`${i}:${ea}`);}
   if(eb>=0){parts.push({a:{...b[eb?'b':'a']},b:p});ends.push(`${j}:${eb}`);}
   candidates.push({distance:da+db,parts,ends});
  }else if(inferred&&Math.abs(d.x*u.y-d.y*u.x)/la<.035){
   for(let ea=0;ea<2;ea++)for(let eb=0;eb<2;eb++){
    const p=a[ea?'b':'a'],q=b[eb?'b':'a'],gap=dist(p,q);
    if(!free[i][ea]||!free[j][eb]||gap<=.035||gap>limit)continue;
    const outA=(q.x-p.x)*u.x+(q.y-p.y)*u.y,outB=(p.x-q.x)*v.x+(p.y-q.y)*v.y;
    if(outA*(ea?1:-1)<=0||outB*(eb?1:-1)<=0)continue;
    candidates.push({distance:gap,parts:[{a:{...p},b:{...q}}],ends:[`${i}:${ea}`,`${j}:${eb}`]});
   }
  }
 }
 const used=new Set(),bridges=[];
 for(const c of candidates.sort((a,b)=>a.distance-b.distance)){
  if(c.ends.some(e=>used.has(e)))continue;c.ends.forEach(e=>used.add(e));bridges.push(...c.parts.filter(w=>len(w)>.00001));
 }
 return [...walls,...bridges];
}
