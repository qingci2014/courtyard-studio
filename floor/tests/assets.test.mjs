import test from 'node:test';
import assert from 'node:assert/strict';
import {LIB} from '../src/catalog.js';
import {buildFurniture} from '../src/assets.js';
import {Box3,Vector3} from 'three';
test('every reused furniture catalog entry builds finite visible geometry',()=>{for(const c of LIB)for(const[type,name,w,d,color]of c.items){const model=buildFurniture({id:'test',type,name,w,d,color,cx:0,cy:0,rot:0});model.updateMatrixWorld(true);const b=new Box3().setFromObject(model),size=b.getSize(new Vector3());assert.ok(!b.isEmpty()&&size.toArray().every(n=>Number.isFinite(n)&&n>0),name);model.traverse(o=>o.geometry?.dispose());}});
