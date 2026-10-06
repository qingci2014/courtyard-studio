export function restoreActiveFloor(project,state){
 return state?.projectId===project.id&&project.floors.some(f=>f.id===state.floorId)?state.floorId:project.floors[0].id;
}

export function quickModelSource(floor){
 const cad=!!floor.cad?.segments?.length,image=!!floor.image;
 return cad&&image?'choose':cad?'cad':image?'image':'import';
}

export function nextFloorName(floors){
 const names=new Set(floors.map(f=>f.name.replace(/\s/g,'')));
 let number=floors.length+1;
 while(names.has(`${number}层`))number++;
 return `${number} 层`;
}

export function floorContentLabel(floor){
 const parts=[['walls','段墙'],['rooms','个房间'],['openings','处门窗'],['furniture','件家具'],['stairs','部楼梯'],['solids','个自建构件']]
  .filter(([key])=>floor[key]?.length).map(([key,unit])=>`${floor[key].length} ${unit}`);
 return parts.length?parts.join(' · '):(floor.image||floor.cad)?'已导入图纸 · 尚未建模':'空楼层 · 尚未建模';
}
