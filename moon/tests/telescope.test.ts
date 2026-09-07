import {observationTargets,buildObservationBodies} from '../app/moon-observation';
import {afterEach,expect,it,vi} from 'vitest';
import * as T from 'three';
import {MoonTelescope,EARTH_POSITION} from '../app/moon-telescope';
class Element extends EventTarget {
 style={cssText:''};width=0;height=0;textContent='';innerHTML='';children:Element[]=[];onclick?:()=>void;
 output?:Element;buttons?:Element;
 appendChild(e:Element){this.children.push(e);return e;} remove(){} closest(){return null;}
 querySelector(s:string){if(s==='output')return this.output??=new Element();return this.buttons??=new Element();}
 getContext(){return {fillStyle:'',font:'',textAlign:'',fillRect(){},fillText(){}};}
}
afterEach(()=>vi.unstubAllGlobals());
it('aims at the scene Earth, clamps zoom, and restores the exact walking camera on exit',()=>{
 const doc=new Element() as Element&{createElement:()=>Element};doc.createElement=()=>new Element();vi.stubGlobal('document',doc);vi.stubGlobal('window',new Element());
 const scope=new MoonTelescope(),host=new Element(),camera=new T.PerspectiveCamera(83,1,.05,10000);camera.position.set(7,1.78,14);camera.rotation.set(.2,.3,0);const position=camera.position.clone(),rotation=camera.quaternion.clone();
 scope.enter(camera,host as unknown as HTMLElement,()=>scope.exit(camera));expect(scope.active).toBe(true);expect(camera.layers.mask).toBe(2);
 expect(camera.getWorldDirection(new T.Vector3()).dot(EARTH_POSITION.clone().sub(camera.position).normalize())).toBeCloseTo(1,9);
 const panel=host.children[0],buttons=panel.querySelector('.scope-buttons').children;
 for(let i=0;i<100;i++)buttons[2].onclick!();expect(camera.fov).toBe(2);
 for(let i=0;i<100;i++)buttons[1].onclick!();expect(camera.fov).toBe(64);
 buttons[3].onclick!();expect(camera.fov).toBe(12);
 for(let i=1;i<observationTargets.length;i++){buttons[5+i].onclick!();expect(camera.getWorldDirection(new T.Vector3()).dot(observationTargets[i].position.clone().sub(camera.position).normalize())).toBeCloseTo(1,9);expect(camera.fov).toBe(observationTargets[i].fov);}
 buttons[4].onclick!();expect(scope.active).toBe(false);expect(camera.layers.mask).toBe(1);expect(camera.position.equals(position)).toBe(true);expect(camera.quaternion.equals(rotation)).toBe(true);expect(camera.fov).toBe(83);
 scope.exit(camera);expect(camera.position.equals(position)).toBe(true);
});


it("adds three finite textured planets and rings inside camera range",()=>{const bodies=buildObservationBodies();for(const target of observationTargets.slice(1)){const mesh=bodies.getObjectByName(target.id) as T.Mesh;expect(mesh.position.equals(target.position)).toBe(true);expect(target.position.length()+target.radius*2.3).toBeLessThan(10000);expect((mesh.material as T.MeshStandardMaterial).map).toBeTruthy();}expect(bodies.children.length).toBe(4);bodies.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const m=o.material as T.MeshStandardMaterial;m.map?.dispose();m.dispose();}});});
