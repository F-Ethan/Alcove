const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'layouts.js', 'playlist.js']);

function deck(count) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    items.push({
      id: 'p' + i,
      width: i % 2 ? 900 : 1600,
      height: i % 2 ? 1400 : 1000
    });
  }
  return items;
}

test('shuffle keeps every item once', function () {
  const items = deck(10);
  let n = 0;
  const shuffled = Alcove.shuffle(items, function () {
    n += 1;
    return ((n * 37) % 100) / 100;
  });
  assert.equal(shuffled.length, items.length);
  assert.equal(shuffled.map(function (item) { return item.id; }).sort().join(','), items.map(function (item) { return item.id; }).sort().join(','));
});

test('playlist avoids ids still inside the recent window', function () {
  let n = 0;
  const playlist = Alcove.createPlaylist(deck(20), {
    recentWindow: 8,
    rng: function () {
      n += 1;
      return ((n * 17) % 100) / 100;
    }
  });
  const seen = [];
  for (let i = 0; i < 24; i += 1) {
    const asset = playlist.next(i % 2 ? 'portrait' : 'landscape');
    const recent = seen.slice(-8);
    assert.equal(recent.indexOf(asset.id), -1);
    seen.push(asset.id);
  }
});

test('a two photo pool can still repeat after the other photo', function () {
  const playlist = Alcove.createPlaylist(deck(2), { recentWindow: 8, rng: function () { return 0.2; } });
  const first = playlist.next();
  const second = playlist.next();
  const third = playlist.next();
  assert.notEqual(first.id, second.id);
  assert.equal(third.id, first.id);
});
