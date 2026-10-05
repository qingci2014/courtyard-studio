import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import * as R from '../src/renovation.js';
import * as D from '../src/delivery-model.js';
import * as Q from '../src/quantities.js';
import * as E from '../src/editing.js';
import {parseCAD,prepareCAD,applyCAD} from '../src/cad.js';
import {dxf,doublePlan} from './fixtures/cad-plans.mjs';
import {drawingSheets,itemsBounds,planScene,elevationScene,sheetSVG} from '../src/drawings.js';
function fixture(){const p=M.blankProject(),f=p.floors[0];p.name='交付测试住宅';f.walls=[[0,0,6,0],[6,0,6,4],[6,4,0,4],[0,4,0,0]].map(([x,y,X,Y])=>M.wall({x,y},{x:X,y:Y},.2));f.rooms=M.detectRooms(f);f.openings.push({id:M.uid(),wallId:f.walls[0].id,type:'door',offset:2,width:1,height:2,sill:0});R.ensureDelivery(p);R.assignCodes(p);return p;}
const near=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);

test('phase views preserve the baseline and model locks are independent of construction status',()=>{
 const p=fixture(),f=p.floors[0],w=f.walls[0];R.captureOriginal(p);const before=M.clone(p);w.a.y=1;R.reconcileRenovation(before,p);
 assert.equal(f.walls.length,5);assert.equal(R.constructionStatus(w),'new');assert.equal(f.walls.filter(w=>R.constructionStatus(w)==='demolish').length,1);
 assert.equal(R.phaseFloor(p,f.id,'original').walls[0].a.y,0);assert.equal(R.phaseFloor(p,f.id).walls.length,4);assert.equal(R.phaseFloor(p,f.id,'demolition').walls.length,4);
 assert.equal(R.phaseFloor(p,f.id).openings.length,1);assert.equal(R.phaseFloor(p,f.id,'demolition').openings.length,1);
 assert.doesNotThrow(()=>M.validateProject(p));w.locked=true;assert.throws(()=>R.setConstructionStatus(p,f.id,[{kind:'wall',id:w.id}],'demolish'),/解锁/);
});
test('deleting existing walls records demolition, and proposed rooms open up',()=>{
 const p=fixture(),f=p.floors[0];R.captureOriginal(p);const before=M.clone(p),w=f.walls.pop();R.reconcileRenovation(before,p);assert.equal(R.constructionStatus(f.walls.find(q=>q.id===w.id)),'demolish');assert.equal(M.detectRooms(f).length,0);assert.equal(R.phaseFloor(p,f.id,'original').walls.length,4);
});
test('dimensions track entity edits, expose stale anchors, and distinguish free reference points',()=>{
 const p=fixture(),f=p.floors[0],w=f.walls[0];const d=D.makeDimension(f,{kind:'wall',id:w.id,point:'a'},{kind:'wall',id:w.id,point:'b'});near(D.dimensionValue(f,d).value,6);w.b.x=7;near(D.dimensionValue(f,d).value,7);f.walls.shift();assert.match(D.dimensionValue(f,d).error,/变化/);
 const free=D.makeDimension(f,{kind:'free',x:0,y:0},{kind:'free',x:1,y:2},{axis:'vertical'});near(D.dimensionValue(f,free).value,2);assert.equal(D.dimensionValue(f,free).manual,true);
});
test('automatic dimensions are stable across repeated generation and JSON roundtrips',()=>{
 const p=fixture(),f=p.floors[0];assert.ok(D.autoDimensions(p,f.id)>5);assert.equal(D.autoDimensions(p,f.id),0);const q=M.validateProject(JSON.parse(JSON.stringify(p)));assert.equal(q.floors[0].delivery.dimensions.length,f.delivery.dimensions.length);
});
test('point locations follow walls, detect openings and lost parent, and store lighting control links',()=>{
 const p=fixture(),f=p.floors[0],w=f.walls[0];const a=D.addServicePoint(p,f.id,'socket',{x:2,y:.1},{height:1});near(D.resolvePoint(f,a).x,2);assert.match(D.serviceWarnings(f)[0].message,/洞口/);w.a.y=1;w.b.y=1;near(D.resolvePoint(f,a).y,1.118);f.walls.shift();assert.match(D.resolvePoint(f,a).error,/不存在/);
 const light=D.addServicePoint(p,f.id,'light',{x:3,y:2});near(D.resolvePoint(f,light).z,f.height);a.controls=[light.id];M.normalizeOpenings(f);assert.equal(M.validateProject(p).floors[0].delivery.points.length,2);
});
test('wall A and B elevations mirror openings and include mounting heights',()=>{
 const p=fixture(),f=p.floors[0],w=f.walls[0];D.addServicePoint(p,f.id,'switch',{x:4,y:.1},{height:1.3});const a=D.addElevation(p,f.id,w.id),b=D.addElevation(p,f.id,w.id,{side:-1});const A=D.elevationGeometry(f,a),B=D.elevationGeometry(f,b);near(A.items[0].x,1.5);near(B.items[0].x,3.5);near(A.points[0].y,1.3);assert.equal(B.points.length,0);assert.ok(elevationScene(p,f.id,a).items.length>8);
});
test('net floor and skirting use wall faces instead of centreline area',()=>{
 const p=fixture(),f=p.floors[0],g=Q.netRoomGeometry(p,f.id,f.rooms[0].id);near(g.gross,24);near(g.net,5.8*3.8);near(g.perimeter,2*(5.8+3.8));near(g.doorDeduction,1);near(g.skirting,18.2);
});
test('wall regions deduct the union of opening intersections and reject overlaps for same work',()=>{
 const p=fixture(),f=p.floors[0],w=f.walls[0];const a=Q.addFinish(p,f.id,{surface:'wall',targetId:w.id,side:1,name:'墙砖',start:0,end:3,bottom:0,top:2});const g=Q.wallFinishGeometry(f,a);near(g.gross,6);near(g.deduction,2);near(g.net,4);
 f.openings.push({...f.openings[0],id:M.uid(),offset:2.2});near(Q.wallFinishGeometry(f,a).deduction,2.4);
 assert.throws(()=>Q.addFinish(p,f.id,{...a,id:undefined,start:2,end:4}),/重叠/);assert.doesNotThrow(()=>Q.addFinish(p,f.id,{...a,side:-1}));
});
test('quote quantities, losses, labor and explicit overrides remain traceable',()=>{
 const p=fixture(),f=p.floors[0];const row=Q.quantityRows(p).rows.find(r=>r.category==='地面');Q.setQuote(p,row.key,{loss:10,unitPrice:80,labor:20});const quoted=Q.quantityRows(p).rows.find(r=>r.key===row.key);near(quoted.quantity,24.244);near(quoted.amount,2424.4);assert.equal(quoted.refs[0].id,f.rooms[0].id);
 assert.throws(()=>Q.setQuote(p,row.key,{override:25}),/原因/);Q.setQuote(p,row.key,{override:25,reason:'现场复尺'});near(Q.quantityRows(p).rows.find(r=>r.key===row.key).quantity,27.5);
 p.delivery.manualRows.push({id:M.uid(),name:'运输',quantity:2,unitPrice:10,labor:20});near(Q.quantityRows(p).rows.at(-1).amount,60);
 p.name='=1+1';assert.match(Q.quantitiesCSV(p),/"'=1\+1"/);
});
test('forks and confirmed snapshots retain the common baseline and never share mutable arrays',()=>{
 const p=fixture();R.captureOriginal(p);const issued=R.snapshotProject(p,{confirmed:true}),fork=R.forkProject(issued,'方案 B');p.floors[0].walls[0].b.x=8;fork.floors[0].walls[0].b.x=9;near(issued.floors[0].walls[0].b.x,6);assert.notEqual(fork.id,p.id);assert.equal(fork.delivery.status,'draft');assert.equal(issued.delivery.status,'confirmed');assert.equal(fork.delivery.basedOn,issued.delivery.issueId);
});
test('floor duplication remaps dimensions, points, elevations and finish targets together',()=>{
 const p=fixture(),f=p.floors[0];D.autoDimensions(p,f.id);const light=D.addServicePoint(p,f.id,'light',{x:3,y:2}),sw=D.addServicePoint(p,f.id,'switch',{x:4,y:.1});sw.controls=[light.id];D.addElevation(p,f.id,f.walls[0].id);Q.addFinish(p,f.id,{surface:'floor',targetId:f.rooms[0].id});const next=M.duplicateFloor(f,'2 层');
 assert.equal(D.drawingIssues({...p,floors:[next]},next.id).length,0);assert.notEqual(next.delivery.dimensions[0].a.id,f.delivery.dimensions[0].a.id);assert.ok(next.delivery.points.some(q=>q.id===next.delivery.points[1].controls[0]));assert.equal(next.delivery.finishes[0].targetId,next.rooms[0].id);
});
test('calibration scales planar annotations and offsets but preserves mounting height',()=>{
 const p=fixture(),f=p.floors[0];D.autoDimensions(p,f.id);const pt=D.addServicePoint(p,f.id,'socket',{x:4,y:.1},{height:.3});const old=D.dimensionValue(f,f.delivery.dimensions[0]).value;
 f.image={data:'data:image/png;base64,AA==',x:0,y:0,width:10,pixelWidth:100,pixelHeight:100,opacity:.5};M.calibrateFloor(f,{x:0,y:0},{x:2,y:0},4,{scaleModel:true});near(f.delivery.points[0].offset,pt.offset*2);near(f.delivery.points[0].height,.3);near(D.dimensionValue(f,f.delivery.dimensions[0]).value,old*2);
});
test('delivery validation rejects corrupt baseline, point coordinates, quote values and missing field evidence',()=>{
 const p=fixture();R.captureOriginal(p);p.delivery.baseline.floors[0].walls[0].a.x=Infinity;assert.throws(()=>M.validateProject(p),/墙体/);
 const q=fixture();q.delivery.source='measured';assert.throws(()=>M.validateProject(q),/依据/);q.delivery.source='estimated';q.delivery.quotes={x:{loss:-1}};assert.throws(()=>M.validateProject(q),/单价/);
});
test('drawing sheets retain exact paper scale, include the revision and reject silent fitting',()=>{
 const p=fixture(),f=p.floors[0];D.autoDimensions(p,f.id);D.addElevation(p,f.id,f.walls[0].id);D.addServicePoint(p,f.id,'socket',{x:4,y:.1});const sheets=drawingSheets(p,{paper:'A3',scale:50,phases:['original','demolition','proposed']});assert.equal(sheets.length,6);assert.equal(sheets[0].width,420);assert.equal(sheets[0].height,297);
 const wall=sheets[0].items.find(o=>o.type==='poly'&&o.fill==='#65727c');near(Math.abs(wall.points[1][0]-wall.points[0][0]),120);assert.match(sheetSVG(sheets[0]),/R001/);assert.match(sheetSVG(sheets[0]),/尺寸待校准/);assert.throws(()=>drawingSheets(p,{paper:'A4',scale:20}),/不会自动改变比例/);
});

test('deleted floors remain in original and demolition drawings and demolition quantities',()=>{
 const p=fixture(),first=p.floors[0],upper=M.duplicateFloor(first,'2 层');p.floors.push(upper);R.captureOriginal(p);p.floors.splice(1,1);
 assert.equal(R.phaseProject(p).floors.length,1);assert.equal(R.phaseProject(p,'original').floors.length,2);assert.equal(R.phaseFloor(p,upper.id,'demolition').walls.every(w=>R.constructionStatus(w)==='demolish'),true);
 const demolition=Q.quantityRows(p).rows.filter(r=>r.floorId===upper.id);assert.equal(demolition.length,4);near(demolition.reduce((s,r)=>s+r.net,0),20*upper.height-2);assert.match(Q.quantitiesCSV(p),/2 层/);assert.equal(R.constructionWarnings(p).length,4);
 assert.equal(drawingSheets(p,{phases:['original','demolition'],elevations:false,points:false}).length,5);
});

test('floors added after the original was captured appear only in the proposed and comparison views',()=>{
 const p=fixture();R.captureOriginal(p);const before=M.clone(p),extra=M.duplicateFloor(p.floors[0],'加建层');p.floors.push(extra);R.reconcileRenovation(before,p);
 assert.equal(R.phaseFloor(p,extra.id,'original'),null);assert.equal(R.phaseFloor(p,extra.id,'demolition'),null);assert.equal(R.phaseFloor(p,extra.id).walls.length,4);assert.equal(extra.walls.every(w=>R.constructionStatus(w)==='new'),true);
});

test('project calibration transforms the baseline together with the design without claiming image-only model accuracy',()=>{
 const p=fixture(),f=p.floors[0];f.image={data:'data:image/png;base64,AA==',x:0,y:0,width:10,pixelWidth:100,pixelHeight:100,opacity:.5};const point=D.addServicePoint(p,f.id,'switch',{x:4,y:.1},{height:1.3});point.renovation.status='existing';R.captureOriginal(p);D.autoDimensions(p,f.id,'original');
 M.calibrateProjectFloor(p,f.id,{x:0,y:0},{x:2,y:0},4,{scaleModel:true});near(R.phaseFloor(p,f.id,'original').walls[0].b.x,12);near(R.phaseFloor(p,f.id).walls[0].b.x,12);near(R.phaseFloor(p,f.id,'original').delivery.points[0].offset,8);near(R.phaseFloor(p,f.id,'original').delivery.points[0].height,1.3);assert.equal(p.delivery.source,'calibrated');
 const q=fixture();q.floors[0].image=M.clone(f.image);M.calibrateProjectFloor(q,q.floors[0].id,{x:0,y:0},{x:2,y:0},4,{scaleModel:false});near(q.floors[0].walls[0].b.x,6);assert.equal(q.delivery.source,'estimated');
});

test('stale anchors and out-of-storey points report errors instead of silently moving or counting',()=>{
 const p=fixture(),f=p.floors[0];assert.match(D.resolveAnchor(f,{kind:'wall',id:f.walls[0].id,offset:7}).error,/超出/);assert.match(D.resolveAnchor(null,{kind:'wall',id:'x'}).error,/楼层/);
 const light=D.addServicePoint(p,f.id,'light',{x:3,y:2});light.height=4;assert.match(D.resolvePoint(f,light).error,/高度/);const q=Q.quantityRows(p);assert.equal(q.rows.filter(r=>r.category==='设备点位').length,0);assert.match(q.warnings.join(''),/未计入/);
});

test('confirmed revision numbers cannot be reused after undo or opening an older project file',()=>{
 const p=fixture(),a=R.snapshotProject(p,{confirmed:true});p.delivery.revision=2;const b=R.snapshotProject(p,{confirmed:true});p.delivery.revision=1;assert.equal(R.nextRevision(p,[a,b]),3);const fork=R.forkProject(a,'方案 B');assert.equal(R.nextRevision(fork,[a,b]),1);
});

test('finish edits preserve quote references and reject overlapping replacements atomically',()=>{
 const p=fixture(),f=p.floors[0],wall=f.walls[0];const a=Q.addFinish(p,f.id,{surface:'wall',targetId:wall.id,start:0,end:2,name:'墙砖'});Q.addFinish(p,f.id,{surface:'wall',targetId:wall.id,start:2,end:6,name:'涂料'});Q.setQuote(p,`${f.id}:finish:${a.id}`,{unitPrice:120});
 Q.updateFinish(p,f.id,a.id,{name:'白色墙砖',end:1.8});assert.equal(Q.quantityRows(p).rows.find(r=>r.finishId===a.id).unitPrice,120);const before=M.clone(f.delivery.finishes);assert.throws(()=>Q.updateFinish(p,f.id,a.id,{end:3}),/重叠/);assert.deepEqual(f.delivery.finishes,before);
});

test('net flooring deducts structural columns and stair openings while retaining other furnishings',()=>{
 const p=fixture(),f=p.floors[0];f.solids.push({id:M.uid(),name:'柱',usage:'column',poly:[[1,1],[1.5,1],[1.5,1.5],[1,1.5]],holes:[],base:0,height:2.8,color:'#ddd'});near(Q.netRoomGeometry(p,f.id,f.rooms[0].id).net,22.04-.25);
 const upper=M.duplicateFloor(f,'2 层');upper.solids=[];p.floors.push(upper);f.stairs.push({id:M.uid(),type:'straight',x:3,y:2,w:1,d:2,rot:0});near(Q.netRoomGeometry(p,upper.id,upper.rooms[0].id).net,20.04);
});

test('archived points and malformed extension data are validated on import',()=>{
 const p=fixture(),f=p.floors[0],point=D.addServicePoint(p,f.id,'socket',{x:4,y:.1});point.renovation.status='existing';R.captureOriginal(p);p.delivery.baseline.floors[0].delivery.points[0].height=NaN;assert.throws(()=>M.validateProject(p),/点位/);
 const q=fixture();q.delivery.quotes.a=null;assert.throws(()=>M.validateProject(q),/报价/);const z=fixture();D.autoDimensions(z,z.floors[0].id);z.floors[0].delivery.dimensions[0].a.offset=Infinity;assert.throws(()=>M.validateProject(z),/标注/);
});

test('existing transform and CAD workflows accept projects with delivery annotations',()=>{
 const p=fixture(),f=p.floors[0];f.furniture.push({id:M.uid(),type:'bed',x:3,y:2,w:1.8,d:2,rot:0,renovation:{status:'existing'}});R.assignCodes(p);R.captureOriginal(p);const before=M.clone(p);
 const refs=E.transformSelection(f,[{kind:'furniture',id:f.furniture[0].id}],{copy:true,dx:2});R.reconcileRenovation(before,p);const copy=f.furniture.find(o=>o.id===refs[0].id);assert.equal(R.constructionStatus(copy),'new');assert.notEqual(copy.code,f.furniture[0].code);assert.doesNotThrow(()=>M.validateProject(p));
 const cad=prepareCAD(parseCAD(dxf(doublePlan())),{unit:'mm',layers:['A-WALL'],inferDoors:false});assert.doesNotThrow(()=>applyCAD(f,cad));assert.ok(f.delivery);
});

test('later wall edits leave demolition geometry fixed and copying a floor excludes demolished entities',()=>{
 const p=fixture(),f=p.floors[0];R.captureOriginal(p);let before=M.clone(p);M.changeWall(f,before.floors[0],f.walls[0].id,{x:0,y:0},{x:7,y:0});R.reconcileRenovation(before,p);const demolished=M.clone(f.walls.filter(w=>R.constructionStatus(w)==='demolish'));
 before=M.clone(p);M.changeWall(f,before.floors[0],f.walls[0].id,{x:0,y:0},{x:8,y:0});R.reconcileRenovation(before,p);assert.deepEqual(f.walls.filter(w=>R.constructionStatus(w)==='demolish'),demolished);
 const active=R.phaseFloor(p,f.id),copy=M.duplicateFloor(f,'2 层');assert.equal(copy.walls.length,active.walls.length);assert.equal(copy.openings.length,active.openings.length);assert.equal(copy.walls.some(w=>R.constructionStatus(w)==='demolish'),false);
 const group=M.uid();f.walls[0].groupId=group;f.walls.find(w=>R.constructionStatus(w)==='demolish').groupId=group;assert.equal(E.expandSelection(f,[{kind:'wall',id:f.walls[0].id}]).length,1);
});

test('wall-face dimensions bind midway along the wall and follow thickness changes',()=>{
 const p=fixture(),f=p.floors[0],w=f.walls[0],nearFace=D.nearestAnchor(f,{x:4.2,y:.11});assert.equal(nearFace.ref.kind,'wall');assert.equal(nearFace.ref.id,w.id);near(nearFace.point.y,.1);
 const dim=D.makeDimension(f,nearFace.ref,{kind:'free',x:4.2,y:1.1},{axis:'vertical'});near(D.dimensionValue(f,dim).value,1);w.thickness=.4;near(D.dimensionValue(f,dim).value,.9);assert.equal(D.nearestAnchor(f,{x:0,y:0}).ref.point,'a');
});
