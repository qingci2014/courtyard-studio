import * as THREE from 'three';
export function solidGeometry(solid){
 const oriented=(poly,clockwise)=>{const points=poly.map(([x,y])=>new THREE.Vector2(x,-y));if(THREE.ShapeUtils.isClockWise(points)!==clockwise)points.reverse();return points;};
 const shape=new THREE.Shape(oriented(solid.poly,true));shape.closePath();
 for(const poly of solid.holes||[]){const hole=new THREE.Path(oriented(poly,false));hole.closePath();shape.holes.push(hole);}
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:solid.height,bevelEnabled:false});geometry.rotateX(-Math.PI/2);geometry.translate(0,solid.base,0);return geometry;
}
