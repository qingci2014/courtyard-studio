import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeFurniture,clone} from '../src/model.js';

const point=(o,x,y)=>{const a=o.rot*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:o.x+x*c-y*s,y:o.y+x*s+y*c};};
const delta=(angle,x,y)=>{const a=angle*Math.PI/180;return{x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const rot of [0,90,37])test(`resize handles keep opposite anchors fixed at ${rot} degrees`,()=>{
 const original={x:4,y:5,w:1.8,d:2,rot},before=clone(original);
 for(const [handle,sx,sy] of [['nw',-1,-1],['ne',1,-1],['sw',-1,1],['se',1,1],['n',0,-1],['s',0,1],['e',1,0],['w',-1,0]]){
  const next={...original,...resizeFurniture(original,handle,delta(rot,sx*.6,sy*.7))};
  const fixed=point(original,-sx*original.w/2,-sy*original.d/2),after=point(next,-sx*next.w/2,-sy*next.d/2);
  near(fixed.x,after.x);near(fixed.y,after.y);
  if(sx&&sy){near(next.w/next.d,original.w/original.d);assert.ok(next.w>original.w&&next.d>original.d);}
  else if(sx){near(next.w,original.w+.6);near(next.d,original.d);}
  else{near(next.d,original.d+.7);near(next.w,original.w);}
 }
 assert.deepEqual(original,before,'drag calculations must not mutate the baseline snapshot');
});
test('rotated furniture can shrink without moving its opposite corner',()=>{
 const original={x:4,y:5,w:1.8,d:2,rot:90},next={...original,...resizeFurniture(original,'se',delta(90,-.45,-.5))};
 near(next.w,1.35);near(next.d,1.5);
 const a=point(original,-.9,-1),b=point(next,-next.w/2,-next.d/2);near(a.x,b.x);near(a.y,b.y);
});
test('crossing the opposite edge and extreme drags stay within positive size limits',()=>{
 const original={x:4,y:5,w:1.8,d:2,rot:37};
 for(const local of [[-100,-100],[1000,1000]]){
  const next=resizeFurniture(original,'se',delta(37,...local));
  assert.ok(next.w>=.1-1e-8&&next.d>=.1-1e-8&&next.w<=40&&next.d<=40);
  near(next.w/next.d,.9);
 }
 near(resizeFurniture(original,'e',delta(37,-100,0)).w,.1);
 assert.throws(()=>resizeFurniture(original,'bad',{x:0,y:0}));
 assert.throws(()=>resizeFurniture(original,'se',{x:NaN,y:0}));
});
