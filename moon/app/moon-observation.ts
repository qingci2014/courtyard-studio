import * as T from 'three';
export const observationTargets=[
 {id:'earth',name:'地球 · EARTH',position:new T.Vector3(-1750,1950,-6000),radius:175,detail:'海洋、陆地与云层',fov:12},
 {id:'mars',name:'火星 · MARS',position:new T.Vector3(800,2600,-5600),radius:90,detail:'赭红色地表与明暗地貌',fov:4},
 {id:'jupiter',name:'木星 · JUPITER',position:new T.Vector3(-3200,3000,-5000),radius:190,detail:'明暗云带与椭圆风暴',fov:8},
 {id:'saturn',name:'土星 · SATURN',position:new T.Vector3(2400,3400,-4900),radius:135,detail:'淡金色云层与环状结构',fov:10},
] as const;
// Authored surface textures and sky positions are illustrative, not ephemerides.
function surface(kind:string){const w=1024,h=512,data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const u=x/w,v=y/h;const noise=Math.sin(x*1.27+y*2.89)*Math.sin(x*.13-y*.31);let r:number,g:number,b:number;
 if(kind==='mars'){const terrain=Math.sin(u*21+Math.sin(v*23))*Math.cos(v*19+u*9)+.3*Math.sin(u*105)*Math.cos(v*87);const n=terrain*24+noise*5;r=156+n;g=82+n*.8;b=49+n*.65;if(v<.04||v>.965){r=205+noise*8;g=196+noise*8;b=182+noise*8;}}
 else{const bands=Math.sin(v*65+Math.sin(u*22)*.18)+.35*Math.sin(v*143+Math.cos(u*30)*.25);const n=bands*19+noise*2;r=(kind==='jupiter'?186:197)+n;g=(kind==='jupiter'?151:178)+n;b=(kind==='jupiter'?115:133)+n;const spot=((u-.62)/.048)**2+((v-.59)/.025)**2;if(kind==='jupiter'&&spot<1){r=171+noise*6;g=92+spot*25;b= 60+spot*20;}}
 const i=(y*w+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;
 }const texture=new T.DataTexture(data,w,h);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;}
export function buildObservationBodies(){const group=new T.Group();group.name='Observation planets';for(const target of observationTargets.slice(1)){
 const body=new T.Mesh(new T.SphereGeometry(target.radius,96,64),new T.MeshStandardMaterial({map:surface(target.id),roughness:1,emissive:0x171717,emissiveIntensity:.3}));body.name=target.id;body.position.copy(target.position);group.add(body);
 if(target.id==='saturn'){const rings=new T.Group();rings.position.copy(target.position);rings.rotation.set(.35,.2,.36);body.rotation.copy(rings.rotation);for(let i=0;i<28;i++){if(i===14||i===15)continue;const inner=target.radius*(1.3+i*.031);const ring=new T.Mesh(new T.RingGeometry(inner,inner+target.radius*.027,128),new T.MeshStandardMaterial({color:new T.Color().setHSL(.115,.2,.42+Math.sin(i*2.3)*.09),side:T.DoubleSide,roughness:1,transparent:true,opacity:.82}));ring.rotation.x=-Math.PI/2;rings.add(ring);}group.add(rings);}
 }return group;}

export function buildObservationStars(){
 const group=new T.Group();group.name='Deep sky starfield';let seed=8371;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const positions:number[]=[],colors:number[]=[],sizes:number[]=[];
 for(let i=0;i<4200;i++){
  const theta=random()*Math.PI*2;const elevation=i<2800?random()*.99:.36+(random()-.5)*.18;
  const y=elevation,radial=Math.sqrt(1-y*y),direction=new T.Vector3(Math.cos(theta)*radial,y,Math.sin(theta)*radial);
  positions.push(direction.x*8700,direction.y*8700,direction.z*8700);
  const brightness=.18+Math.pow(random(),3)*.8,warm=random();colors.push(brightness*(warm>.8?1:.82),brightness*.88,brightness*(warm>.8?.75:1));sizes.push(random()>.96?2.5:1+random()*.7);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('starSize',new T.Float32BufferAttribute(sizes,1));
 const material=new T.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,vertexShader:'attribute float starSize; varying vec3 starColor; void main(){starColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=starSize;}',fragmentShader:'varying vec3 starColor;void main(){float r=length(gl_PointCoord-vec2(.5));if(r>.5)discard;gl_FragColor=vec4(starColor,smoothstep(.5,.12,r));}'});
 group.add(new T.Points(geometry,material));return group;
}
