const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'layouts.js']);

test('staggered tiles do not share a first delay', function () {
  const delays = [0, 1, 2, 3].map(function (index) {
    return Alcove.layouts.initialDelay(index, 4, 20000);
  });
  assert.deepEqual(delays, [5000, 10000, 15000, 20000]);
  assert.equal(Alcove.layouts.initialDelay(0, 1, 20000), 20000);
});

test('layout slot counts match the picker', function () {
  assert.equal(Alcove.layouts.slotsFor('single').length, 1);
  assert.equal(Alcove.layouts.slotsFor('two').length, 2);
  assert.equal(Alcove.layouts.slotsFor('three').length, 3);
  assert.equal(Alcove.layouts.slotsFor('four').length, 4);
});

test('mixed collage follows portrait and landscape counts', function () {
  assert.equal(Alcove.layouts.mixedTemplate(['landscape', 'landscape']), 'mixedLandscape');
  assert.equal(Alcove.layouts.mixedTemplate(['portrait', 'landscape']), 'mixedPortrait');
  assert.equal(Alcove.layouts.mixedTemplate(['portrait', 'portrait', 'landscape']), 'mixedPair');
  const pair = Alcove.layouts.slotsFor('mixed', ['portrait', 'portrait']);
  assert.equal(pair.length, 3);
  assert.ok(pair.some(function (slot) { return slot.prefer === 'portrait'; }));
  assert.equal(Alcove.layouts.orientationOf({ width: 800, height: 1400 }), 'portrait');
  assert.equal(Alcove.layouts.orientationOf({ width: 1600, height: 900 }), 'landscape');
  assert.equal(Alcove.layouts.orientationOf({}), 'unknown');
});
