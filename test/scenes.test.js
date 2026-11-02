const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'scene-data.js', 'scenes.js', 'immich.js']);

test('scene slots scale from normalized fractions', function () {
  const raw = Alcove.SCENE_RAW;
  assert.equal(raw.length, 6);
  const fireplace = Alcove.scenes.parseScene(raw.filter(function (item) { return item.name === '02_fireplace_mantel'; })[0]);
  assert.equal(fireplace.slots.length, 4);
  const main = fireplace.slots[1];
  assert.equal(main.role, 'main');
  assert.equal(main.prefer, 'portrait');
  const atHd = Alcove.scenes.scaleSlot(main, 1920, 1080);
  const source = raw.filter(function (item) { return item.name === '02_fireplace_mantel'; })[0].slots[1];
  assert.ok(Math.abs(atHd.x - source.x) < 1.5);
  assert.ok(Math.abs(atHd.y - source.y) < 1.5);
  assert.ok(Math.abs(atHd.w - source.w) < 1.5);
  assert.ok(Math.abs(atHd.h - source.h) < 1.5);
  const at4k = Alcove.scenes.scaleSlot(main, 3840, 2160);
  assert.ok(Math.abs(at4k.w - source.w * 2) < 3);
  assert.equal(fireplace.slots[2].prefer, 'landscape');
  const xmas = Alcove.scenes.get('06_christmas_fireplace');
  assert.equal(xmas.replaces, '02_fireplace_mantel');
  assert.equal(xmas.slots[1].left, fireplace.slots[1].left);
  assert.equal(xmas.slots[1].width, fireplace.slots[1].width);
});

test('season picks the designer scenes and an explicit Christmas-only list is honored', function () {
  assert.equal(Alcove.scenes.seasonalIds('summer').join(','), '01_collage_full,02_fireplace_mantel,05_plank_polaroids');
  assert.equal(Alcove.scenes.seasonalIds('fall').join(','), '01_collage_full,03_fall_gallery,05_plank_polaroids');
  assert.equal(Alcove.scenes.seasonalIds('christmas').join(','), '01_collage_full,04_christmas_garland,05_plank_polaroids,06_christmas_fireplace');
  assert.equal(Alcove.scenes.allows('02_fireplace_mantel', 'christmas'), false);
  assert.equal(Alcove.scenes.allows('06_christmas_fireplace', 'christmas'), true);
  assert.equal(Alcove.scenes.activeIds([], 'summer').join(','), Alcove.scenes.seasonalIds('summer').join(','));
  assert.equal(Alcove.scenes.activeIds(['04_christmas_garland', '01_collage_full'], 'summer').join(','), '01_collage_full');
  assert.equal(Alcove.scenes.activeIds(['04_christmas_garland', '06_christmas_fireplace'], 'summer').join(','), '04_christmas_garland,06_christmas_fireplace');
});

test('the clock sits clear of every frame', function () {
  Alcove.scenes.catalog().forEach(function (scene) {
    assert.equal(Alcove.scenes.clockClears(scene), true, scene.id + ' ' + scene.clock);
  });
});

test('a face box centers the crop and a missing face stays in the middle', function () {
  const asset = Alcove.normalizeAsset({
    id: 'face',
    type: 'IMAGE',
    people: [{
      id: 'p',
      name: 'Ada',
      faces: [{ boundingBoxX1: 0.2, boundingBoxY1: 0.1, boundingBoxX2: 0.4, boundingBoxY2: 0.3 }]
    }]
  });
  const focus = Alcove.scenes.focusPosition(asset);
  assert.equal(focus.x, 30);
  assert.equal(focus.y, 20);
  const middle = Alcove.scenes.focusPosition({ faces: [] });
  assert.equal(middle.x, 50);
  assert.equal(middle.y, 50);
  const pixels = Alcove.faceBox({
    boundingBoxX1: 100, boundingBoxY1: 50, boundingBoxX2: 300, boundingBoxY2: 250,
    imageWidth: 1000, imageHeight: 500
  });
  assert.ok(Math.abs(pixels.x - 0.1) < 0.001);
  assert.ok(Math.abs(pixels.w - 0.2) < 0.001);
});
