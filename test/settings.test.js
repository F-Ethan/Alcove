const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove, memoryStorage } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'settings.js', 'probe.js']);

test('settings merge clamps values and keeps secrets out of the redacted copy', function () {
  const saved = Alcove.mergeSettings({
    serverUrl: 'http://192.168.1.66:2283/',
    apiKey: 'super-secret',
    sources: { favorites: false, albums: ['a', 'a', ''] },
    layout: 'nope',
    intervalSec: 1,
    filters: { minRating: 9, junk: { queries: 'blurry photo\n\nblack photo', perQuery: 500 } }
  });
  assert.equal(saved.serverUrl, 'http://192.168.1.66:2283');
  assert.equal(saved.sources.favorites, false);
  assert.equal(saved.sources.albums.join(','), 'a');
  assert.equal(saved.layout, 'mixed');
  assert.equal(saved.intervalSec, 5);
  assert.equal(saved.filters.minRating, 5);
  assert.equal(saved.filters.junk.perQuery, 200);
  assert.equal(saved.filters.junk.queries.join('|'), 'blurry photo|black photo');
  const redacted = Alcove.redactSettings(saved);
  assert.equal(redacted.apiKey, '***');
  assert.equal(JSON.stringify(redacted).includes('super-secret'), false);
});

test('settings round-trip through local storage', function () {
  const storage = memoryStorage();
  const store = Alcove.createSettingsStore(storage);
  store.save({ serverUrl: 'http://192.168.1.66:2283', apiKey: 'abc', decoration: 'fall' });
  const loaded = store.load();
  assert.equal(loaded.apiKey, 'abc');
  assert.equal(loaded.decoration, 'fall');
  assert.equal(loaded.sources.favorites, true);
});

test('connection probe separates a bad key, CORS, and an offline server', function () {
  assert.equal(Alcove.classifyProbe({ ok: true }).code, 'ok');
  assert.equal(Alcove.classifyProbe({ ok: false, status: 401 }).code, 'auth');
  assert.equal(Alcove.classifyProbe({ ok: false, corsBlocked: true }).code, 'cors');
  assert.equal(Alcove.classifyProbe({ ok: false }).code, 'offline');
  assert.equal(Alcove.util.apiBase('http://192.168.1.66:2283/api'), 'http://192.168.1.66:2283/api');
});
