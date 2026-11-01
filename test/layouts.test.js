const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'layouts.js', 'display.js']);

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
  assert.equal(Alcove.layouts.slotsFor('mixed').length, 5);
});

test('prints sit in from the edge, and the five-photo collage covers about 55 percent', function () {
  const names = ['single', 'two', 'three', 'four', 'mixed'];
  names.forEach(function (name) {
    const slots = Alcove.layouts.slotsFor(name);
    const margin = Alcove.layouts.minMargin(slots);
    assert.ok(margin >= 7, name + ' margin ' + margin);
    const area = Alcove.layouts.coverage(slots);
    assert.ok(area >= 45 && area <= 60, name + ' coverage ' + area);
  });
  const mixed = Alcove.layouts.slotsFor('mixed');
  const mixedArea = Alcove.layouts.coverage(mixed);
  assert.ok(mixedArea >= 52 && mixedArea <= 58, 'mixed coverage ' + mixedArea);
  assert.ok(mixed.some(function (slot) { return slot.prefer === 'portrait'; }));
  assert.ok(mixed.some(function (slot) { return slot.prefer === 'landscape'; }));
  const single = Alcove.layouts.slotsFor('single')[0];
  assert.ok(single.width <= 76);
  assert.equal(Alcove.layouts.orientationOf({ width: 800, height: 1400 }), 'portrait');
  assert.equal(Alcove.layouts.orientationOf({ width: 1600, height: 900 }), 'landscape');
  assert.equal(Alcove.layouts.orientationOf({}), 'unknown');
});

test('burn-in shift fits inside the print margin', function () {
  let max = 0;
  const period = 7 * 60 * 1000;
  for (let t = 0; t <= period; t += 1000) {
    const shift = Alcove.display.burnInShift(t, true);
    max = Math.max(max, Math.abs(shift.x), Math.abs(shift.y));
  }
  const marginPx = (Alcove.layouts.minMargin(Alcove.layouts.slotsFor('single')) / 100) * 1280;
  assert.ok(max > 0);
  assert.ok(marginPx > max * 2, 'margin ' + marginPx + ' shift ' + max);
});
