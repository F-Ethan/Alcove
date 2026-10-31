const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove, memoryStorage } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'offline.js', 'images.js']);

test('offline store keeps a small set of preview blobs', async function () {
  const store = Alcove.createMemoryBlobStore(2);
  await store.put('a', 'A');
  await store.put('b', 'B');
  await store.put('c', 'C');
  assert.equal(store.size(), 2);
  assert.equal(await store.get('a'), null);
  assert.equal(await store.get('c'), 'C');
});

test('a cached preview is used only when the network blob is missing', function () {
  assert.equal(Alcove.choosePreview('fresh', 'old').offline, false);
  assert.equal(Alcove.choosePreview(null, 'old').offline, true);
  assert.equal(Alcove.choosePreview(null, null), null);
});

test('saved pool metadata round-trips without growing past the cap', function () {
  const storage = memoryStorage();
  const assets = [];
  for (let i = 0; i < 90; i += 1) assets.push({ id: 'a' + i, type: 'IMAGE', city: 'Austin' });
  Alcove.savePool(storage, assets);
  const loaded = Alcove.loadPool(storage);
  assert.equal(loaded.length, 80);
  assert.equal(loaded[0].city, 'Austin');
});

test('url pool revokes unpinned previews and keeps a photo that is on screen', function () {
  const revoked = [];
  const pool = Alcove.createUrlPool({
    max: 2,
    createUrl: function (blob) { return 'blob:' + blob; },
    revokeUrl: function (url) { revoked.push(url); }
  });
  pool.hold('a', 'A');
  pool.hold('b', 'B');
  pool.hold('c', 'C');
  assert.equal(pool.size(), 3);
  pool.release('a');
  pool.release('b');
  assert.ok(pool.size() <= 2);
  assert.ok(revoked.length >= 1);
  pool.hold('d', 'D');
  pool.hold('d', 'D');
  assert.equal(pool.pins('d'), 2);
  pool.release('d');
  assert.equal(pool.pins('d'), 1);
});
