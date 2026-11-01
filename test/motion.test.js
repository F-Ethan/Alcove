const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'layouts.js', 'schedule.js', 'preload.js', 'playlist.js']);

test('one slot changes at a time, and a single photo uses the full display time', function () {
  assert.equal(Alcove.schedule.swapEvery(45, 5), 9000);
  assert.equal(Alcove.schedule.swapEvery(30, 5), 6000);
  assert.equal(Alcove.schedule.swapEvery(60, 5), 12000);
  assert.equal(Alcove.schedule.swapEvery(45, 1), 45000);
  assert.equal(Alcove.schedule.swapEvery(45, 2), 22500);
  const seeded = Alcove.schedule.seedShownAt(5, 45, 100000);
  assert.equal(seeded.step, 9000);
  assert.equal(seeded.times[0], 100000 - 4 * 9000);
  assert.equal(seeded.times[4], 100000);
  assert.ok(seeded.times[0] < seeded.times[1]);
  const slots = seeded.times.map(function (shownAt, index) {
    return { index: index, shownAt: shownAt, busy: false };
  });
  assert.equal(Alcove.schedule.oldest(slots).index, 0);
  slots[0].shownAt = 100000;
  assert.equal(Alcove.schedule.oldest(slots).index, 1);
  slots[1].busy = true;
  assert.equal(Alcove.schedule.oldest(slots).index, 2);
});

test('slides head toward the nearest screen edge and arrangements cycle', function () {
  assert.equal(Alcove.schedule.slideDirection({ left: 7, top: 20, width: 30, height: 60 }), 'left');
  assert.equal(Alcove.schedule.slideDirection({ left: 68, top: 10, width: 25, height: 50 }), 'right');
  assert.equal(Alcove.schedule.slideDirection({ left: 40, top: 4, width: 20, height: 16 }), 'up');
  const names = Alcove.layouts.ARRANGEMENT_NAMES;
  assert.equal(names.join(','), 'left,right,center,stack');
  assert.equal(Alcove.schedule.nextArrangement('left', names), 'right');
  assert.equal(Alcove.schedule.nextArrangement('stack', names), 'left');
  assert.equal(Alcove.schedule.nextArrangement('missing', names), 'left');
});

test('arrangements stay fixed, cover about half the wall, and keep the clock clear', function () {
  Alcove.layouts.ARRANGEMENT_NAMES.forEach(function (name) {
    const slots = Alcove.layouts.arrangement(name);
    assert.equal(slots.length, 5);
    const copy = JSON.stringify(slots);
    const fitted = Alcove.layouts.fitInBox(slots[0], 0.62);
    assert.equal(JSON.stringify(slots), copy);
    const anchorX = slots[0].left + slots[0].width / 2;
    const fittedX = fitted.left + fitted.width / 2;
    assert.ok(Math.abs(anchorX - fittedX) < 0.2, name + ' anchor moved');
    assert.equal(Alcove.layouts.arrangement(name)[1].left, slots[1].left);
    const area = Alcove.layouts.coverage(slots);
    assert.ok(area >= 45 && area <= 60, name + ' coverage ' + area);
    assert.ok(Alcove.layouts.minMargin(slots) >= 7, name + ' margin');
    assert.equal(slots[0].role, 'hero');
    assert.equal(slots[0].prefer, 'portrait');
    assert.equal(slots[1].prefer, 'landscape');
    const heroArea = slots[0].width * slots[0].height;
    slots.forEach(function (slot, index) {
      assert.equal(Alcove.layouts.hitsClock(slot), false, name + ' clock ' + index);
      if (index > 0) assert.ok(slot.width * slot.height < heroArea, name + ' hero is largest');
      for (let other = index + 1; other < slots.length; other++) {
        assert.equal(Alcove.layouts.intersects(slot, slots[other]), false, name + ' overlap ' + index);
      }
    });
  });
  const left = Alcove.layouts.arrangement('left');
  const right = Alcove.layouts.arrangement('right');
  const center = Alcove.layouts.arrangement('center');
  const stack = Alcove.layouts.arrangement('stack');
  assert.ok(left[0].left < left[1].left);
  assert.ok(left[1].top < left[4].top);
  assert.ok(right[0].left > right[1].left);
  assert.ok(center[1].top > center[0].top + center[0].height - 1);
  assert.ok(stack[0].top > stack[1].top);
  const mate = left[1].width * left[1].height;
  left.slice(2).forEach(function (small) {
    assert.ok(small.width * small.height < mate);
  });
});

test('a failed preload is skipped and old urls are revoked', async function () {
  const revoked = [];
  let calls = 0;
  const queue = Alcove.preload.createPreloadQueue({
    limit: 3,
    load: function (asset) {
      calls += 1;
      if (asset.id === 'bad') return Promise.reject(new Error('nope'));
      return Promise.resolve({ url: 'blob:' + asset.id, pinned: true });
    },
    revoke: function (asset) { revoked.push(asset.id); }
  });
  const first = queue.request({ id: 'a' });
  const again = queue.request({ id: 'a' });
  assert.equal(first, again);
  const ready = await first;
  assert.equal(ready.url, 'blob:a');
  assert.equal(calls, 1);
  assert.equal(queue.ready('a'), true);
  await queue.request({ id: 'bad' }).then(function () {
    throw new Error('should have failed');
  }, function () { return null; });
  assert.equal(queue.ready('bad'), false);
  queue.forget('bad');
  await queue.request({ id: 'b' });
  await queue.request({ id: 'c' });
  await queue.request({ id: 'd' });
  queue.retain(['c', 'd']);
  assert.equal(queue.ready('a'), false);
  assert.equal(queue.ready('b'), false);
  assert.equal(queue.ready('c'), true);
  assert.equal(queue.ready('d'), true);
  assert.ok(revoked.indexOf('a') !== -1);
  assert.ok(revoked.indexOf('b') !== -1);
  const claimed = queue.claim('c');
  assert.equal(claimed.url, 'blob:c');
  assert.equal(queue.ready('c'), false);
  assert.equal(revoked.indexOf('c'), -1);
});

test('decode waits for onload and decode(), and rejects a broken image', async function () {
  function FakeImage() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.decoded = false;
  }
  FakeImage.prototype.decode = function () {
    this.decoded = true;
    return Promise.resolve();
  };
  Object.defineProperty(FakeImage.prototype, 'src', {
    set: function () {
      const img = this;
      this.naturalWidth = 300;
      this.naturalHeight = 200;
      Promise.resolve().then(function () { if (img.onload) img.onload(); });
    }
  });
  const decoded = await Alcove.preload.decode('blob:ok', FakeImage);
  assert.equal(decoded.width, 300);
  assert.equal(decoded.height, 200);
  function Broken() {}
  Object.defineProperty(Broken.prototype, 'src', {
    set: function () {
      const img = this;
      Promise.resolve().then(function () { if (img.onerror) img.onerror(); });
    }
  });
  await assert.rejects(Alcove.preload.decode('blob:bad', Broken));
});

test('a portrait slot falls back when the pool has no portraits', function () {
  const playlist = Alcove.createPlaylist([
    { id: 'land', width: 1600, height: 900 }
  ], { rng: function () { return 0; } });
  assert.equal(playlist.next('portrait').id, 'land');
});
