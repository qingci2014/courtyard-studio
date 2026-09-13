import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

/** Bloom is restricted to actual bedroom emitters, never white corridor surfaces. */
export class MoonBedroomRenderer{
 private composer:EffectComposer;private glowComposer:EffectComposer;private bloom:UnrealBloomPass;
 private output=new OutputPass();private combine:ShaderPass;
 private masks=new Map<T.Material,T.MeshBasicMaterial>();
 private size=new T.Vector2();private width=0;private height=0;private ratio=0;
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene,camera:T.Camera){
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
  this.composer=new EffectComposer(renderer,target);
  this.glowComposer=new EffectComposer(renderer,new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType}));this.glowComposer.renderToScreen=false;
  this.bloom=new UnrealBloomPass(new T.Vector2(1,1),.16,.4,1.35);
  this.glowComposer.addPass(new RenderPass(scene,camera));this.glowComposer.addPass(this.bloom);
  this.combine=new ShaderPass({
   uniforms:{tDiffuse:{value:null},glow:{value:this.bloom.renderTargetsHorizontal[0].texture},enabled:{value:1}},
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'uniform sampler2D tDiffuse;uniform sampler2D glow;uniform float enabled;varying vec2 vUv;void main(){vec4 base=texture2D(tDiffuse,vUv);gl_FragColor=vec4(base.rgb+texture2D(glow,vUv).rgb*enabled,base.a);}'
  });
  this.composer.addPass(new RenderPass(scene,camera));this.composer.addPass(this.combine);this.composer.addPass(this.output);
 }
 private mask(material:T.Material){
  if(material.userData.bedroomBloom)return material;
  let mask=this.masks.get(material);
  if(!mask){
   const standard=material as T.MeshStandardMaterial;
   mask=new T.MeshBasicMaterial({color:0x000000,side:material.side,transparent:material.transparent,opacity:material.opacity,depthWrite:material.depthWrite,alphaTest:material.alphaTest,map:material.alphaTest>0?standard.map:null});
   this.masks.set(material,mask);
  }
  return mask;
 }
 render(dt:number,powered:boolean){
  this.renderer.getSize(this.size);const ratio=this.renderer.getPixelRatio();
  if(this.size.x!==this.width||this.size.y!==this.height||ratio!==this.ratio){
   this.width=this.size.x;this.height=this.size.y;this.ratio=ratio;
   this.composer.setPixelRatio(ratio);this.composer.setSize(this.width,this.height);
   this.glowComposer.setPixelRatio(ratio*.5);this.glowComposer.setSize(this.width,this.height);
  }
  this.combine.uniforms.enabled.value=powered?1:0;
  if(powered){
   const restored:{mesh:T.Mesh;material:T.Material|T.Material[]}[]=[],hidden:T.Object3D[]=[];
   const background=this.scene.background,environment=this.scene.environment,autoShadow=this.renderer.shadowMap.autoUpdate,shadowUpdate=this.renderer.shadowMap.needsUpdate;
   try{
    this.scene.background=new T.Color(0);this.scene.environment=null;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=false;
    this.scene.traverse(o=>{
     if(o instanceof T.Mesh){restored.push({mesh:o,material:o.material});o.material=Array.isArray(o.material)?o.material.map(m=>this.mask(m)):this.mask(o.material);}
     else if((o instanceof T.Points||o instanceof T.Line||o instanceof T.Sprite)&&o.visible){hidden.push(o);o.visible=false;}
    });
    this.glowComposer.render(dt);
   }finally{
    for(const {mesh,material} of restored)mesh.material=material;for(const object of hidden)object.visible=true;
    this.scene.background=background;this.scene.environment=environment;this.renderer.shadowMap.autoUpdate=autoShadow;this.renderer.shadowMap.needsUpdate=shadowUpdate;
   }
  }
  this.composer.render(dt);
 }
 dispose(){for(const mask of this.masks.values())mask.dispose();this.masks.clear();this.bloom.dispose();this.combine.dispose();this.output.dispose();this.glowComposer.dispose();this.composer.dispose();}
}
