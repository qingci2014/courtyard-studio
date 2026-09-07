import * as T from 'three';
import {fieldRoutes,fieldSites,segmentDistance} from './moon-exploration';

function rawHeight(x:number,z:number){const r=Math.hypot(x,z);const flat=T.MathUtils.smoothstep(r,42,82);let h=(Math.sin(x*.073)*Math.cos(z*.089)*4+Math.sin(x*.21+z*.15)*1.4)*flat;for(const [cx,cz,rad] of [[-40,20,12],[35,-40,15],[-55,-55,20],[55,45,18]]){const d=Math.hypot(x-cx,z-cz)/rad;h+=(-2.7*Math.exp(-d*d*2)+1.4*Math.exp(-(((d-1)*5)**2)))*flat;}const pit=Math.hypot(x+39,z-25)/6;h+=-1.4*Math.exp(-pit*pit*2.4)+.55*Math.exp(-(((pit-1)*5)**2));const ridge=T.MathUtils.smoothstep(r,95,260);return h+ridge*(16+Math.abs(Math.sin(x*.021)+Math.cos(z*.027))*15+Math.sin(x*.11+z*.08)*2);}

const coreRadius=90,coreSteps=240,exploreRadius=360,exploreSteps=108,outerSteps=50,horizon=900;
const outer=[...Array.from({length:exploreSteps},(_,i)=>coreRadius+(exploreRadius-coreRadius)*(i+1)/exploreSteps),...Array.from({length:outerSteps},(_,i)=>exploreRadius+(horizon-exploreRadius)*((i+1)/outerSteps)**1.4)];
const coordinates=[...outer.map(v=>-v).reverse(),...Array.from({length:coreSteps+1},(_,i)=>-coreRadius+i*2*coreRadius/coreSteps),...outer];
let samples:Float64Array|undefined;
function shapedHeight(x:number,z:number){
 let h=rawHeight(x,z);const crater=Math.hypot(x-245,z+205)/29;
 h+=-10*Math.exp(-crater*crater*2.5)+3*Math.exp(-(((crater-1)*5)**2));
 if(Math.hypot(x,z)<38)return h;
 let closest=Infinity,roadHeight=h;
 for(const route of fieldRoutes)for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],d=segmentDistance(x,z,a,b);if(d.distance<closest){closest=d.distance;roadHeight=T.MathUtils.lerp(rawHeight(a[0],a[1]),rawHeight(b[0],b[1]),d.t);}}
 h=T.MathUtils.lerp(roadHeight,h,T.MathUtils.smoothstep(closest,6,18));
 for(const site of fieldSites){const d=Math.hypot(x-site.x,z-site.z);if(d<16)h=T.MathUtils.lerp(rawHeight(site.x,site.z),h,T.MathUtils.smoothstep(d,8,16));}
 return h;
}
function heightSamples(){if(!samples){const n=coordinates.length;samples=new Float64Array(n*n);for(let z=0;z<n;z++)for(let x=0;x<n;x++)samples[z*n+x]=shapedHeight(coordinates[x],coordinates[z]);}return samples;}
function interval(value:number){let lo=0,hi=coordinates.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(coordinates[mid]<=value)lo=mid;else hi=mid;}return lo;}
// Interpolate the same two triangles used by the render mesh, so distant wheels and feet remain grounded.
export function groundHeight(x:number,z:number){const n=coordinates.length,h=heightSamples(),i=interval(x),j=interval(z),u=T.MathUtils.clamp((x-coordinates[i])/(coordinates[i+1]-coordinates[i]),0,1),v=T.MathUtils.clamp((z-coordinates[j])/(coordinates[j+1]-coordinates[j]),0,1),a=j*n+i;return u+v<=1?h[a]*(1-u-v)+h[a+1]*u+h[a+n]*v:h[a+n+1]*(u+v-1)+h[a+n]*(1-u)+h[a+1]*(1-v);}
/** One connected surface, with extra detail across the newly drivable region. */
export function createLunarTerrain(){
 const heights=heightSamples();let sampleIndex=0;
 const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
 for(const z of coordinates)for(const x of coordinates){
  positions.push(x,heights[sampleIndex++]-.05,z);uvs.push(x/360+.5,.5-z/360);
  const distance=Math.hypot(x,z);const detail=1-T.MathUtils.smoothstep(distance,100,420);
  const broad=.8+.065*Math.sin(x*.035+Math.cos(z*.028));
  const close=.8+.1*Math.sin(x*.14+Math.sin(z*.11)*2)+.065*Math.cos(z*.31-x*.08)+.035*Math.sin(x*.73+z*.59);
  const shade=T.MathUtils.lerp(broad,close,detail);colors.push(shade,shade,shade);
 }
 const side=coordinates.length;
 for(let z=0;z<side-1;z++)for(let x=0;x<side-1;x++){const a=z*side+x;indices.push(a,a+side,a+1,a+1,a+side,a+side+1);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
