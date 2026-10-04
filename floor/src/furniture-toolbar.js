import * as E from './editing.js';
import {updateOpening} from './openings.js';

export function installFurnitureToolbar({$,ui,floor,selectionRefs,setSelection,mutate,runEdit,ico}){
 const svg=$('#plan'),pane=svg.parentElement,bar=document.createElement('div');
 bar.id='furnitureToolbar';bar.className='furniture-toolbar';bar.hidden=true;
 bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','家具快捷操作');bar.setAttribute('aria-orientation','vertical');
 let toolbarKind='';
 function buttons(kind){
  const label=kind==='opening'?'门':kind==='stair'?'楼梯':'家具',actions=kind==='opening'?[['hinge','rotate','左右翻转','交换门扇的铰链边'],['swing','rotate','内外翻转','向墙的另一侧开启']]:[['rotate','rotate','旋转','顺时针旋转 90°']];
  actions.push(['copy','copy','复制','复制一件'+label],['delete','trash','删除','删除这件'+label+'，可撤销'],['clear','close','取消选择','取消选择这件'+label]);
  bar.setAttribute('aria-label',label+'快捷操作');bar.innerHTML=actions.map(([action,icon,text,title])=>`<button type="button" data-furniture-action="${action}" title="${title}" ${action==='delete'?'class="danger"':''}>${ico(icon)}<span>${text}</span></button>`).join('');toolbarKind=kind;
 }
 pane.append(bar);
 function current(){
  const refs=selectionRefs();
  if(ui.tool!=='select'||ui.mode==='3d'||refs.length!==1)return null;
  const ref=refs[0],o=E.entity(floor(),ref);if(!o||E.hidden(floor(),ref))return null;
  return ref.kind==='furniture'&&ui.furniture||ref.kind==='stair'||ref.kind==='opening'&&o.type==='door'?ref:null;
 }
 function sync(){
  const ref=current(),item=ref&&svg.querySelector(`[data-kind="${ref.kind}"][data-id="${CSS.escape(ref.id)}"]`);
  if(!item){bar.hidden=true;return;}
  const box=item.getBoundingClientRect(),area=pane.getBoundingClientRect();
  if(!area.width||!area.height||box.right<area.left||box.left>area.right||box.bottom<area.top||box.top>area.bottom){bar.hidden=true;return;}
  bar.hidden=false;
  if(toolbarKind!==ref.kind)buttons(ref.kind);
  const locked=E.locked(floor(),ref);
  bar.querySelectorAll('button').forEach(b=>b.disabled=locked&&b.dataset.furnitureAction!=='clear');
  const gap=16,width=bar.offsetWidth,height=bar.offsetHeight,maxLeft=Math.max(8,area.width-width-8),maxTop=Math.max(8,area.height-height-64),minTop=Math.min(48,maxTop);
  let left=box.right-area.left+gap;
  if(left>maxLeft)left=box.left-area.left-width-gap;
  bar.style.left=Math.round(Math.max(8,Math.min(left,maxLeft)))+'px';
  bar.style.top=Math.round(Math.max(minTop,Math.min(box.top-area.top,maxTop)))+'px';
 }
 bar.addEventListener('pointerdown',e=>e.stopPropagation());
 bar.addEventListener('click',e=>{
  const button=e.target.closest('button'),ref=current();
  if(!button||button.disabled||!ref)return;
  e.stopPropagation();
  if(['hinge','swing'].includes(button.dataset.furnitureAction)){const key=button.dataset.furnitureAction,o=E.entity(floor(),ref);mutate(()=>updateOpening(floor(),ref.id,{[key]:-(o[key]||1)}));}
  else if(button.dataset.furnitureAction==='rotate')mutate(()=>setSelection(E.transformSelection(floor(),[ref],{angle:90})));
  else runEdit(button.dataset.furnitureAction);
 });
 return {sync};
}
