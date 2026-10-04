import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {validateProject} from '../src/model.js';

await fs.mkdir('.qa', {recursive: true});
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({viewport: {width: 1600, height: 1000}, acceptDownloads: true});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const state = () => page.evaluate(() => window.__studio.getProject());
const pass = name => { checks.push(name); console.log('PASS', name); };
async function world(x, y) {
  const point = await page.evaluate(({x, y}) => {
    const svg = document.querySelector('#plan'), p = svg.createSVGPoint();
    p.x = x; p.y = y;
    const q = p.matrixTransform(svg.getScreenCTM());
    return {x: q.x, y: q.y};
  }, {x, y});
  await page.mouse.click(point.x, point.y);
}
async function clearFloor() {
  await page.locator('#deleteFloor').click();
  await page.locator('#confirmAction').click();
}
try {
  await page.goto('http://127.0.0.1:4178/', {waitUntil: 'networkidle'});
  await page.locator('#fileMenu').click();
  await page.locator('[data-file="villa"]').click();
  await page.locator('#confirmAction').click();
  await page.waitForFunction(() => window.__studio?.getRenderer()?.calls > 0);
  const initial = await state();
  await page.locator('#floorTabs button').nth(1).click();
  await page.locator('#deleteFloor').click();
  await page.locator('#cancelAction').click();
  assert.deepEqual(await state(), initial);
  await clearFloor();
  assert.equal((await state()).floors.length, 1);
  assert.deepEqual((await state()).floors[0], initial.floors[0]);
  assert.equal(await page.locator('#deleteFloor').isEnabled(), true);
  assert.equal(await page.locator('#deleteFloor').textContent(), '清空本层内容');
  pass('deleting one floor preserves the other and leaves an enabled clear action');

  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 100;
    c.getContext('2d').fillRect(10, 10, 180, 80);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#importPlan').click();
  await page.locator('#planFile').setInputFiles({
    name: 'reset-underlay.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  await page.waitForFunction(() => window.__studio.getProject().floors[0].image);
  await page.getByLabel('楼层名称', {exact: true}).fill('待重建楼层');
  await page.getByLabel('楼层名称', {exact: true}).press('Tab');
  await page.getByLabel('层高 / m', {exact: true}).fill('3.2');
  await page.getByLabel('层高 / m', {exact: true}).press('Tab');
  await page.locator('#roof').selectOption('gable');
  const populated = await state();
  for (const key of ['walls', 'openings', 'rooms', 'furniture', 'stairs']) {
    assert.ok(populated.floors[0][key].length > 0);
  }
  await page.locator('#deleteFloor').click();
  await page.locator('#cancelAction').click();
  assert.deepEqual(await state(), populated);
  pass('canceling a final-floor clear preserves every component and the underlay');

  // Clearing while walking must also leave walkthrough mode before removing geometry.
  await page.locator('[data-view="3d"]').click();
  await page.locator('#walk').click();
  await page.waitForFunction(() => window.__studio.getRenderer().walk);
  await clearFloor();
  const cleared = await state(), f = cleared.floors[0];
  assert.equal(cleared.floors.length, 1);
  assert.equal(cleared.floors[0].name, '1 层');
  for (const key of ['walls', 'openings', 'rooms', 'furniture', 'stairs']) assert.deepEqual(f[key], []);
  assert.equal(f.image, null);
  assert.equal(f.name, populated.floors[0].name);
  assert.equal(f.height, populated.floors[0].height);
  assert.equal(f.id, populated.floors[0].id);
  assert.equal(cleared.roof, 'none');
  assert.equal((await page.evaluate(() => window.__studio.getRenderer())).walk, false);
  await page.waitForFunction(() => window.__studio.getRenderer().triangles <= 12);
  assert.equal(await page.locator('#emptyHint').isVisible(), true);
  await page.screenshot({path: '.qa/last-floor-cleared.png'});
  pass('clearing the final floor removes all geometry, roof and underlay without losing floor settings');

  await page.locator('#undo').click();
  assert.deepEqual(await state(), populated);
  await page.locator('#redo').click();
  assert.deepEqual(await state(), cleared);
  pass('undo restores the complete floor and redo clears it again');
  await page.waitForFunction(() => document.querySelector('#saveState').textContent.includes('已保存'));
  await page.reload({waitUntil: 'networkidle'});
  assert.deepEqual(await state(), cleared);
  await page.waitForFunction(() => window.__studio.getRenderer().triangles <= 12);
  pass('an empty floor remains empty after autosave and reload');

  const pending = page.waitForEvent('download');
  await page.locator('#fileMenu').click();
  await page.locator('[data-file="save"]').click();
  const download = await pending;
  await download.saveAs('.qa/cleared-floor.json');
  const exported = JSON.parse(await fs.readFile('.qa/cleared-floor.json', 'utf8'));
  assert.equal(validateProject(exported).floors[0].walls.length, 0);
  await page.locator('#projectFile').setInputFiles('.qa/cleared-floor.json');
  await page.waitForFunction(() => window.__studio.getProject().name);
  assert.equal((await state()).floors[0].walls.length, 0);
  pass('the cleared project can be exported and imported');

  await page.locator('[data-view="2d"]').click();
  await page.locator('[data-tool="room"]').click();
  await world(2, 2); await world(8, 6);
  assert.equal((await state()).floors[0].walls.length, 4);
  assert.equal((await state()).floors[0].rooms.length, 1);
  pass('the blank floor supports immediate rebuilding');
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('#toggleInspector').click();
  assert.equal(await page.locator('#deleteFloor').isEnabled(), true);
  await clearFloor();
  assert.equal((await state()).floors[0].walls.length, 0);
  pass('the final-floor clear also works in the mobile inspector');
  assert.deepEqual(errors, []);
  await fs.writeFile('.qa/floor-reset-results.json', JSON.stringify({passed: checks.length, checks, errors}, null, 2));
} catch (e) {
  console.error(e);
  await page.screenshot({path: '.qa/floor-reset-failure.png'});
  await fs.writeFile('.qa/floor-reset-failure.json', JSON.stringify({checks, errors, error: e.message}, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
