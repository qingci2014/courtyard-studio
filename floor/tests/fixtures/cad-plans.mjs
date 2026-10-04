const pairs=values=>values.flat().join('\n')+'\n';
export const line=(a,b,layer='A-WALL',extra=[])=>pairs([0,'LINE',8,layer,10,a[0],20,a[1],11,b[0],21,b[1],...extra]);
export const poly=(points,{layer='A-WALL',width=0,closed=true}={})=>pairs([0,'LWPOLYLINE',8,layer,90,points.length,70,closed?1:0,43,width,...points.flatMap(([x,y,bulge=0])=>[10,x,20,y,42,bulge])]);
export const insert=(name,{x=0,y=0,angle=0,sx=1,sy=1,layer='A-WALL'}={})=>pairs([0,'INSERT',8,layer,2,name,10,x,20,y,41,sx,42,sy,50,angle]);
export const block=(name,entities,base=[0,0])=>pairs([0,'BLOCK',2,name,70,0,10,base[0],20,base[1],3,name])+entities+pairs([0,'ENDBLK']);
export function dxf(entities,{unit=4,blocks='',layers=['A-WALL','FURNITURE','A-DIM'],header=''}={}){
 return pairs([0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1024',9,'$INSUNITS',70,unit])+header+pairs([0,'ENDSEC',0,'SECTION',2,'TABLES',0,'TABLE',2,'LAYER',70,layers.length])+layers.map(name=>pairs([0,'LAYER',2,name,70,0,62,7,6,'CONTINUOUS'])).join('')+pairs([0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'BLOCKS'])+blocks+pairs([0,'ENDSEC',0,'SECTION',2,'ENTITIES'])+entities+pairs([0,'ENDSEC',0,'EOF']);
}
export function doublePlan({door=false,offset=[0,0]}={}){
 const move=p=>[p[0]+offset[0],p[1]+offset[1]],edge=(a,b)=>line(move(a),move(b));
 const walls=[[[0,0],[12000,0]],[[12000,0],[12000,8000]],[[12000,8000],[0,8000]],[[0,8000],[0,0]],[[200,200],[200,7800]],[[200,7800],[11800,7800]],[[11800,7800],[11800,200]],[[11800,200],[200,200]]];
 if(door){walls.splice(0,1,[[0,0],[3000,0]],[[4000,0],[12000,0]]);walls.splice(-1,1,[[11800,200],[4000,200]],[[3000,200],[200,200]]);}
 return walls.map(([a,b])=>edge(a,b)).join('')+poly([[1000,1000],[2500,1000],[2500,1800],[1000,1800]].map(move),{layer:'FURNITURE'})+pairs([0,'TEXT',8,'A-DIM',10,0,20,9000,40,200,1,'12000']);
}
