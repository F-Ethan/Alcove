const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove([
  'util.js',
  'settings.js',
  'retry.js',
  'immich.js',
  'library.js',
  'filters.js'
]);

function asset(id, extra) {
  return Object.assign({
    id: id,
    type: 'IMAGE',
    visibility: 'timeline',
    originalFileName: id + '.jpg',
    originalPath: '/photos/' + id + '.jpg',
    isFavorite: false,
    isArchived: false,
    isTrashed: false,
    exifInfo: { exifImageWidth: 4000, exifImageHeight: 3000, rating: 5 }
  }, extra || {});
}

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: function () { return Promise.resolve(data); }
  };
}

function emptySearch() {
  return { assets: { items: [], count: 0, total: 0, facets: [] } };
}

function installFetch(handler) {
  return function (url, init) {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    let body = {};
    if (init && init.body) {
      try { body = JSON.parse(init.body); } catch (err) { body = {}; }
    }
    return Promise.resolve(handler(path, body));
  };
}

function baseRoutes(handler) {
  return installFetch(function (path, body) {
    if (path === '/api/albums') return jsonResponse(200, []);
    if (path.indexOf('/api/people') === 0) return jsonResponse(200, { people: [], total: 0, hidden: 0 });
    if (path === '/api/view/folder/unique-paths') return jsonResponse(200, []);
    return handler(path, body);
  });
}

test('album and folder names still arrive for the settings picker', async function () {
  const settings = Alcove.mergeSettings({
    serverUrl: 'http://immich.local',
    apiKey: 'key',
    sources: { allPhotos: true, favorites: false }
  });
  const result = await Alcove.loadLibrary(settings, installFetch(function (path) {
    if (path === '/api/albums') return jsonResponse(200, [{ id: 'a', albumName: 'Trips', assets: [] }]);
    if (path.indexOf('/api/people') === 0) return jsonResponse(200, { people: [{ id: 'p', name: 'Ada', isHidden: false }], total: 1, hidden: 0 });
    if (path === '/api/view/folder/unique-paths') return jsonResponse(200, ['/photos/trips']);
    if (path === '/api/search/random') return jsonResponse(200, [asset('one')]);
    return jsonResponse(404, {});
  }), new Date());
  assert.equal(result.catalogs.albums[0].label, 'Trips');
  assert.equal(result.catalogs.people[0].label, 'Ada');
  assert.equal(result.catalogs.folders[0].label, '/photos/trips');
});

test('all photos is on by default, including settings saved before the toggle existed', function () {
  assert.equal(Alcove.mergeSettings(null).sources.allPhotos, true);
  const saved = Alcove.mergeSettings({ sources: { favorites: true } });
  assert.equal(saved.sources.allPhotos, true);
});

test('an empty favorites list still fills the wall from a random sample', async function () {
  const settings = Alcove.mergeSettings({
    serverUrl: 'http://immich.local',
    apiKey: 'key',
    sources: { favorites: true, allPhotos: true }
  });
  const result = await Alcove.loadLibrary(settings, baseRoutes(function (path, body) {
    if (path === '/api/search/random') {
      assert.equal(body.type, 'IMAGE');
      assert.equal(body.size, Alcove.ALL_PHOTOS_SIZE);
      return jsonResponse(200, [asset('coast'), asset('porch')]);
    }
    if (path === '/api/search/metadata') return jsonResponse(200, emptySearch());
    return jsonResponse(404, {});
  }), new Date());
  assert.equal(result.assets.map(function (item) { return item.id; }).join(','), 'coast,porch');
  const names = result.report.sources.map(function (row) { return row.name + ':' + row.count; }).join('|');
  assert.equal(names.indexOf('All photos:2') !== -1, true);
  assert.equal(names.indexOf('Favorites:0') !== -1, true);
});

test('when every selected source is empty, all photos is used as a fallback', async function () {
  const settings = Alcove.mergeSettings({
    serverUrl: 'http://immich.local',
    apiKey: 'key',
    sources: { allPhotos: false, favorites: true, albums: [], people: [], folders: [] }
  });
  let randomCalls = 0;
  const result = await Alcove.loadLibrary(settings, baseRoutes(function (path) {
    if (path === '/api/search/random') {
      randomCalls += 1;
      return jsonResponse(200, [asset('library')]);
    }
    if (path === '/api/search/metadata') return jsonResponse(200, emptySearch());
    return jsonResponse(404, {});
  }), new Date());
  assert.equal(randomCalls, 1);
  assert.equal(result.assets[0].id, 'library');
  const fallback = result.report.sources.filter(function (row) { return row.fallback; })[0];
  assert.equal(fallback.name, 'All photos');
  assert.equal(fallback.count, 1);
});

test('a 403 is named with the missing permission instead of a blank wall', async function () {
  const settings = Alcove.mergeSettings({
    serverUrl: 'http://immich.local',
    apiKey: 'key',
    sources: { allPhotos: true, favorites: false }
  });
  const result = await Alcove.loadLibrary(settings, baseRoutes(function (path) {
    if (path === '/api/search/random') return jsonResponse(403, { message: 'forbidden' });
    return jsonResponse(404, {});
  }), new Date());
  assert.equal(result.assets.length, 0);
  assert.equal(result.failures, 1);
  const text = Alcove.explainEmpty(result.report, { started: 0, keptCount: 0, dropped: {} });
  assert.equal(text.indexOf('All photos: 0 photos') !== -1, true);
  assert.equal(text.indexOf('403 missing permission asset.read') !== -1, true);
});

test('metadata search retries once without visibility when the server returns 400', async function () {
  const client = Alcove.createImmich({
    serverUrl: 'http://immich.local',
    apiKey: 'key',
    fetch: installFetch(function (path, body) {
      if (path !== '/api/search/metadata') return jsonResponse(404, {});
      if (body.visibility) return jsonResponse(400, { message: 'bad' });
      return jsonResponse(200, { assets: { items: [asset('kept')], count: 1, total: 1, facets: [] } });
    })
  });
  const assets = await client.searchMetadata({ type: 'IMAGE', visibility: 'timeline', size: 10 });
  assert.equal(assets.length, 1);
  assert.equal(assets[0].id, 'kept');
});

test('the empty-wall text lists filter drops', function () {
  const text = Alcove.explainEmpty({
    sources: [
      { name: 'Favorites', count: 4, error: '', fallback: false },
      { name: 'All photos', count: 0, error: 'HTTP 500', fallback: true }
    ],
    errors: [{ name: 'Folder list', error: '403 missing permission folder.read' }]
  }, {
    started: 4,
    keptCount: 0,
    dropped: { notImage: 0, trashed: 0, archived: 1, hidden: 0, locked: 0, screenshot: 0, noPeople: 0, small: 0, rating: 0, tag: 0, junk: 3 }
  });
  assert.equal(text.indexOf('Favorites: 4 photos') !== -1, true);
  assert.equal(text.indexOf('All photos: 0 photos (fallback). HTTP 500') !== -1, true);
  assert.equal(text.indexOf('403 missing permission folder.read') !== -1, true);
  assert.equal(text.indexOf('smart-search junk list 3') !== -1, true);
  assert.equal(text.indexOf('archived 1') !== -1, true);
});
