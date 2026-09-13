import {expect,it,vi} from 'vitest';
import * as T from 'three';
import {worldCameraFov,scrollCameraFov} from '../app/moon-camera';
import {MoonWorld} from '../app/moon-world';

function horizontalView(camera:T.PerspectiveCamera){
 camera.updateProjectionMatrix();
 const left=new T.Vector3(-1,0,.5).unproject(camera),right=new T.Vector3(1,0,.5).unproject(camera);
 return T.MathUtils.radToDeg(left.angleTo(right));
}

it('preserves ordinary framing and the close-up range',()=>{
 expect(worldCameraFov(64,16/9)).toBe(64);
 expect(worldCameraFov(30,16/9)).toBe(30);
 expect(worldCameraFov(83,1)).toBe(83);
});

it.each([16/9,1635/693,32/9,6])('bounds the projected horizontal view on aspect %s',aspect=>{
 const camera=new T.PerspectiveCamera(worldCameraFov(110,aspect),aspect);
 expect(horizontalView(camera)).toBeLessThanOrEqual(105.00001);
 expect(camera.fov).toBeLessThanOrEqual(85);
});

it('zooms back in immediately from the wide limit, including an old 110-degree target',()=>{
 const aspect=1635/693,max=worldCameraFov(110,aspect);
 expect(scrollCameraFov(110,-30,aspect)).toBeLessThan(max);
 let fov=64;for(let i=0;i<100;i++)fov=scrollCameraFov(fov,120,aspect);
 expect(fov).toBeCloseTo(max);
 expect(scrollCameraFov(fov,-30,aspect)).toBeLessThan(fov);
});

it('corrects live window resizing and leaves telescope magnification intact',()=>{
 const camera=new T.PerspectiveCamera(64,16/9);
 const world=Object.assign(Object.create(MoonWorld.prototype),{camera,targetFov:64,mode:'walk',host:{clientWidth:1280,clientHeight:720},renderer:{setSize:vi.fn()}});
 world.resize();expect(camera.fov).toBe(64);
 world.host.clientWidth=2547;world.resize();expect(horizontalView(camera)).toBeLessThanOrEqual(105.00001);
 world.host.clientWidth=1280;world.resize();expect(camera.fov).toBe(64);
 world.mode='telescope';camera.fov=4;world.host.clientWidth=2547;world.resize();expect(camera.fov).toBe(4);
});
