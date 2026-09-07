import * as T from 'three';
import {batchMoonStatics} from './moon-batching';
export function prepareFlightShip(root:T.Group){
 // Retain the existing authored spacecraft as one movable assembly before static batching.
 root.updateMatrixWorld(true);const ship=new T.Group();ship.position.set(22,0,18);ship.userData.moonId='flight-assembly';root.add(ship);ship.updateMatrixWorld(true);const shipParts:T.Mesh[]=[];root.traverse(o=>{if(!(o instanceof T.Mesh)||/Landing_apron|Landing_perimeter|Pad_inset|Pad_beacon/i.test(o.name))return;const b=new T.Box3().setFromObject(o),center=b.getCenter(new T.Vector3());if(Math.abs(center.x-22)<6&&Math.abs(center.z-18)<6&&b.max.y>.01&&b.max.y<10&&b.getSize(new T.Vector3()).length()<18)shipParts.push(o);});for(const part of shipParts)ship.attach(part);batchMoonStatics(ship);return ship;

}
