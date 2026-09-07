import * as T from 'three';
export class CompanionFace {
 private canvas=document.createElement('canvas');private g:CanvasRenderingContext2D;readonly texture:T.CanvasTexture;private last=-1;
 constructor(){this.canvas.width=this.canvas.height=512;this.g=this.canvas.getContext('2d')!;this.texture=new T.CanvasTexture(this.canvas);this.texture.flipY=false;this.texture.colorSpace=T.SRGBColorSpace;this.draw(0,'idle');}
 draw(t:number,mood:string){const frame=Math.floor(t*24);if(frame===this.last)return;this.last=frame;const g=this.g;g.fillStyle='#02070d';g.fillRect(0,0,512,512);g.strokeStyle='#091c2c';g.lineWidth=1;for(let y=12;y<512;y+=8){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}g.strokeStyle='#27b4ff';g.lineWidth=19;g.lineCap='round';g.shadowColor='#168eff';g.shadowBlur=13;const phase=t%5.5,blink=phase<.18?Math.max(.08,Math.abs(phase-.09)/.09):1;
 for(const [i,x] of [158,354].entries()){g.beginPath();g.ellipse(x,230,51,42*blink*(mood==='thinking'?.7+.2*Math.sin(t*4+i*2):1),0,Math.PI,Math.PI*2);g.stroke();}g.lineWidth=15;g.beginPath();g.ellipse(256,305,49,mood==='listening'?26+5*Math.sin(t*3):29,0,0,Math.PI);g.stroke();g.shadowBlur=0;this.texture.needsUpdate=true;}
}
