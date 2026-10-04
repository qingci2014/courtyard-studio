import {clone,length,clamp,canPlaceOpening} from './model.js';
import {assertEditable} from './editing.js';

export function doorPose(opening,angle=Math.PI/2){
 const hinge=opening.hinge===-1?-1:1,swing=opening.swing===-1?-1:1;
 return {hinge,swing,hingeX:-opening.width/2*hinge,rotation:angle*hinge*swing};
}

// Validate before assigning; do not rely on normalizeOpenings to silently clamp sizes.
export function updateOpening(floor,id,patch){
 const original=floor.openings.find(o=>o.id===id);if(!original)throw new Error('请先选择门窗');
 assertEditable(floor,[{kind:'opening',id}]);
 const wall=floor.walls.find(w=>w.id===original.wallId),next={...clone(original),...patch},maxWidth=length(wall),maxHeight=wall.height||floor.height;
 if('type' in patch&&patch.type!==original.type){next.sill=patch.type==='door'?0:Math.min(.9,Math.max(0,maxHeight-.2));next.height=Math.min(patch.type==='door'?2.1:1.4,maxHeight-next.sill);}
 if(!['door','window'].includes(next.type)||!['width','height','offset','sill'].every(key=>Number.isFinite(next[key])))throw new Error('门窗尺寸无效');
 if(next.width<.2||next.width>maxWidth+1e-8)throw new Error(`门窗宽度应为 0.20–${maxWidth.toFixed(2)} 米（所属墙段长度）`);
 next.sill=next.type==='door'?0:next.sill;
 if(next.sill<0||next.height<.2||next.sill+next.height>maxHeight+1e-8)throw new Error(`门窗顶部不能超过墙高 ${maxHeight.toFixed(2)} 米`);
 if('width' in patch&&!('offset' in patch))next.offset=clamp(next.offset,next.width/2,maxWidth-next.width/2);
 if(!canPlaceOpening(floor,next))throw new Error('门窗超出墙段或与其他洞口重叠，请调整宽度或位置');
 if('hinge' in next)next.hinge=next.hinge===-1?-1:1;if('swing' in next)next.swing=next.swing===-1?-1:1;
 Object.assign(original,next);return original;
}

export function resizeOpening(floor,id,original,end,offset){
 const wall=floor.walls.find(w=>w.id===original.wallId),left=original.offset-original.width/2,right=original.offset+original.width/2;
 const a=end==='start'?clamp(offset,0,right-.2):left,b=end==='end'?clamp(offset,left+.2,length(wall)):right;
 return updateOpening(floor,id,{width:Math.round((b-a)*1000)/1000,offset:(a+b)/2});
}

export function openingDragPatch(original,handle,delta,{center=false}={}){
 if(!Number.isFinite(delta))throw new Error('无效的缩放距离');
 if(handle==='move')return {offset:original.offset+delta};
 if(handle==='top')return {height:original.height+delta};
 const side=handle.endsWith('left')?-1:1,corner=handle.startsWith('corner'),width=corner?original.width*(1+delta):original.width+delta*(center?2:1);
 return {width,offset:original.offset+(center?0:side*(width-original.width)/2),...(corner?{height:original.height*(1+delta)}:{})};
}
