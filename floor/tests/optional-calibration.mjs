import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

await fs.mkdir('.qa',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await context.newPage(),checks=[],errors=[];
page.setDefaultTimeout(15000);
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>window.__studio.getProject());
const pass=name=>{checks.push(name);console.log('PASS',name);};
const length=w=>Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y);
async function world(x,y){
 const p=await page.evaluate(({x,y})=>{const svg=document.querySelector('#plan'),p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(svg.getScreenCTM());return{x:q.x,y:q.y};},{x,y});
 await page.mouse.click(p.x,p.y);
}
async function saveWait(){await page.waitForFunction(()=>document.querySelector('#saveState').textContent.includes('已保存'));}
try{
 await page.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__studio?.getRenderer()?.calls>0);
 await page.locator('#fileMenu').click();await page.locator('[data-file="new"]').click();await page.locator('#confirmAction').click();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);ctx.fillStyle='black';[[60,60,680,12],[60,60,12,480],[728,60,12,480],[60,528,290,12],[430,528,310,12],[300,60,12,480]].forEach(r=>ctx.fillRect(...r));return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#importPlan').click();
 await page.locator('#planFile').setInputFiles({name:'no-dimensions.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.waitForFunction(()=>window.__studio.getProject().floors[0].image);
 assert.equal((await state()).floors[0].image.calibrated,false);
 assert.equal(await page.locator('#recognize').textContent(),'先识别建模');
 await page.locator('#recognize').click();
 await page.locator('#runDetect').waitFor({state:'visible'});
 assert.ok((await page.locator('#dialog .scale-note').textContent()).includes('估算值'));
 await page.screenshot({path:'.qa/optional-calibration-recognition.png'});
 await page.locator('#runDetect').click();await page.locator('#applyDetect').waitFor({state:'visible'});await page.locator('#applyDetect').click();
 const preview=await state();
 assert.ok(preview.floors[0].walls.length>=4);
 assert.equal(preview.floors[0].image.calibrated,false);
 assert.ok((await page.locator('#threeLabel').textContent()).includes('尺寸待校准'));
 await page.waitForFunction(()=>window.__studio.getRenderer().triangles>100);
 pass('an uncalibrated drawing produces a visible editable 3D model with an estimated-size label');

 await saveWait();await page.reload({waitUntil:'networkidle'});
 assert.deepEqual(await state(),preview);
 assert.ok((await page.locator('#threeLabel').textContent()).includes('尺寸待校准'));
 pass('autosave and reload preserve both the preview model and its uncalibrated status');
 await page.locator('#calibrate').click();
 assert.equal(await page.locator('#calibrationGuide').isVisible(),true);
 assert.ok((await page.locator('#calibrationGuide').textContent()).includes('①'));
 await page.screenshot({path:'.qa/calibration-guide.png'});
 await page.locator('#skipCalibration').click();
 await page.locator('#runDetect').waitFor({state:'visible'});
 await page.locator('#cancelDetect').click();
 assert.deepEqual(await state(),preview);
 pass('the visual calibration guide offers a skip path without changing the model');

 await page.locator('#calibrate').click();await world(2,7);
 assert.ok((await page.locator('#calibrationGuide').textContent()).includes('②'));
 await world(12,7);
 assert.equal(await page.locator('#knownUnit').inputValue(),'mm');
 assert.equal(await page.locator('#knownLength').inputValue(),'');
 assert.equal(await page.locator('#scaleExistingModel').isChecked(),true);
 await page.locator('#applyCalibrate').click();
 assert.equal(await page.locator('#dialog').isVisible(),true);
 assert.deepEqual(await state(),preview);
 await page.locator('#knownLength').fill('12000');
 await page.locator('#applyCalibrate').click();
 const calibrated=await state(),before=preview.floors[0],after=calibrated.floors[0],ratio=after.image.width/before.image.width;
 assert.ok(Math.abs(ratio-1.2)<.01);
 assert.equal(after.image.calibrated,true);
 assert.ok(Math.abs(length(after.walls[0])/length(before.walls[0])-ratio)<.0001);
 assert.equal(after.height,before.height);
 assert.equal((await page.locator('#threeLabel').textContent()).includes('尺寸待校准'),false);
 pass('guided endpoints accept millimetres and calibrate both the preview and its underlay');

 await page.locator('#undo').click();assert.deepEqual(await state(),preview);
 await page.locator('#redo').click();assert.deepEqual(await state(),calibrated);
 pass('calibration undo and redo restore complete geometry and dimension status');
 await page.locator('#calibrate').click();await world(2,7);await world(12,7);
 assert.equal(await page.locator('#scaleExistingModel').isChecked(),false);
 await page.locator('#knownUnit').selectOption('m');await page.locator('#knownLength').fill('8');
 await page.locator('#applyCalibrate').click();
 assert.deepEqual((await state()).floors[0].walls,after.walls);
 assert.ok(Math.abs((await state()).floors[0].image.width/after.image.width-.8)<.01);
 pass('metre units and image-only recalibration preserve existing model geometry');

 await page.setViewportSize({width:390,height:844});
 await page.locator('#toggleInspector').click();await page.locator('#calibrate').click();
 assert.equal(await page.locator('#calibrationGuide').isVisible(),true);
 assert.equal(await page.locator('#inspector').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'.qa/calibration-guide-mobile.png'});
 await page.locator('#skipCalibration').click();await page.locator('#runDetect').waitFor({state:'visible'});
 pass('mobile users can see the guidance and skip it without an obstructing inspector');
 assert.deepEqual(errors,[]);
 await fs.writeFile('.qa/optional-calibration-results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(e){
 console.error(e);await page.screenshot({path:'.qa/optional-calibration-failure.png'});
 await fs.writeFile('.qa/optional-calibration-failure.json',JSON.stringify({checks,errors,error:e.message},null,2));
 process.exitCode=1;
}finally{await browser.close();}
