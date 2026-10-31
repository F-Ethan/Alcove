const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove, memoryStorage } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'settings.js', 'junk.js']);

test('junk refresh keeps the top ranked ids and reruns when the query list changes', function () {
  const settings = Alcove.mergeSettings(null);
  assert.equal(Alcove.junk.shouldRefresh(null, settings, Date.now()), true);
  const ids = Alcove.junk.topIds([
    { id: 'a' },
    { id: 'b' },
    { id: 'a' },
    { id: 'c' }
  ], 2);
  assert.equal(ids.join(','), 'a,b');
  const cache = {
    signature: Alcove.junk.signature(settings),
    refreshedAt: Date.now(),
    ids: ids
  };
  assert.equal(Alcove.junk.shouldRefresh(cache, settings, Date.now()), false);
  assert.equal(Alcove.junk.shouldRefresh(cache, settings, Date.now() + Alcove.junk.DAY_MS), true);
  settings.filters.junk.queries = ['receipt'];
  assert.equal(Alcove.junk.shouldRefresh(cache, settings, Date.now()), true);
  settings.filters.junk.enabled = false;
  assert.equal(Alcove.junk.shouldRefresh(cache, settings, Date.now()), false);

  const storage = memoryStorage();
  Alcove.junk.save(storage, cache);
  const loaded = Alcove.junk.load(storage);
  assert.equal(loaded.ids.join(','), 'a,b');
});

test('smart search refresh collects one ranked list per query', async function () {
  const settings = Alcove.mergeSettings(null);
  settings.filters.junk.queries = ['blurry photo', 'receipt'];
  settings.filters.junk.perQuery = 1;
  const client = {
    searchSmart: function (body) {
      if (body.query === 'blurry photo') return Promise.resolve([{ id: 'blur-1' }, { id: 'blur-2' }]);
      return Promise.resolve([{ id: 'receipt-1' }]);
    }
  };
  const result = await Alcove.junk.refresh(client, settings);
  assert.equal(result.ids.join(','), 'blur-1,receipt-1');
  assert.equal(result.failed, 0);
});
