(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function normalizeAsset(raw) {
    if (!raw || !raw.id) return null;
    var exif = raw.exifInfo || {};
    var people = null;
    if (Array.isArray(raw.people)) {
      people = [];
      for (var i = 0; i < raw.people.length; i++) {
        var person = raw.people[i] || {};
        people.push({ id: person.id || '', name: person.name || '' });
      }
    }
    var tags = [];
    var rawTags = raw.tags || [];
    for (var t = 0; t < rawTags.length; t++) {
      var tag = rawTags[t] || {};
      tags.push({
        id: tag.id || '',
        name: tag.name || '',
        value: tag.value || ''
      });
    }
    var rating = null;
    if (typeof exif.rating === 'number' && isFinite(exif.rating)) rating = exif.rating;
    return {
      id: String(raw.id),
      type: raw.type || 'IMAGE',
      originalFileName: raw.originalFileName || '',
      originalPath: raw.originalPath || '',
      isFavorite: raw.isFavorite === true,
      isArchived: raw.isArchived === true,
      isTrashed: raw.isTrashed === true,
      visibility: raw.visibility || 'timeline',
      width: exif.exifImageWidth || 0,
      height: exif.exifImageHeight || 0,
      rating: rating,
      city: exif.city || '',
      state: exif.state || '',
      description: exif.description || '',
      fileCreatedAt: raw.fileCreatedAt || raw.localDateTime || '',
      people: people,
      tags: tags
    };
  }

  function captionFor(asset) {
    if (!asset) return '';
    var place = [];
    if (asset.city) place.push(asset.city);
    if (asset.state) place.push(asset.state);
    if (place.length) return place.join(', ');
    if (asset.description) return asset.description;
    if (asset.fileCreatedAt) return String(asset.fileCreatedAt).slice(0, 10);
    return asset.originalFileName || '';
  }

  function assetsFromSearch(payload) {
    var items = payload && payload.assets && payload.assets.items;
    if (!Array.isArray(items) && payload && Array.isArray(payload.items)) items = payload.items;
    if (!Array.isArray(items)) items = [];
    return normalizeMany(items);
  }

  function normalizeMany(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var asset = normalizeAsset(list[i]);
      if (asset) out.push(asset);
    }
    return out;
  }

  function createImmich(options) {
    var fetchImpl = options.fetch;
    var base = Alcove.util.apiBase(options.serverUrl);

    function request(path, body) {
      var headers = {
        'Accept': 'application/json',
        'x-api-key': options.apiKey
      };
      var init = { method: body ? 'POST' : 'GET', headers: headers };
      if (body) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      function once() {
        return fetchImpl(base + path, init).then(function (response) {
          if (!response.ok) {
            var error = new Error('Immich request failed');
            error.status = response.status;
            throw error;
          }
          return response.json();
        });
      }
      if (!Alcove.retry) return once();
      return Alcove.retry(once, {
        tries: 3,
        baseMs: 600,
        maxMs: 8000,
        retryOn: function (error) {
          return !(error && error.status >= 400 && error.status < 500);
        }
      });
    }

    function searchPages(path, body, read) {
      var page = 1;
      var all = [];
      function once() {
        var payload = {};
        var key;
        for (key in body) {
          if (Object.prototype.hasOwnProperty.call(body, key)) payload[key] = body[key];
        }
        payload.page = page;
        return request(path, payload).then(function (data) {
          var batch = read(data);
          all = all.concat(batch);
          var size = body.size || 1000;
          if (batch.length < size || page >= 3) return all;
          page += 1;
          return once();
        });
      }
      return once();
    }

    return {
      base: function () { return base; },
      searchMetadata: function (body) {
        return searchPages('/search/metadata', body, assetsFromSearch);
      },
      searchSmart: function (body) {
        return request('/search/smart', body).then(assetsFromSearch);
      },
      listAlbums: function () {
        return request('/albums').then(function (data) {
          var rows = Array.isArray(data) ? data : [];
          var albums = [];
          for (var i = 0; i < rows.length; i++) {
            if (!rows[i] || !rows[i].id) continue;
            albums.push({
              id: String(rows[i].id),
              label: rows[i].albumName || 'Untitled album'
            });
          }
          albums.sort(function (a, b) { return a.label.localeCompare(b.label); });
          return albums;
        });
      },
      listPeople: function () {
        return request('/people?withHidden=false&size=500').then(function (data) {
          var rows = Array.isArray(data) ? data : (data && data.people) || [];
          var people = [];
          for (var i = 0; i < rows.length; i++) {
            if (!rows[i] || !rows[i].id || rows[i].isHidden) continue;
            people.push({
              id: String(rows[i].id),
              label: rows[i].name || 'Unnamed'
            });
          }
          people.sort(function (a, b) { return a.label.localeCompare(b.label); });
          return people;
        });
      },
      listFolders: function () {
        return request('/view/folder/unique-paths').then(function (data) {
          var rows = Array.isArray(data) ? data : [];
          var folders = [];
          for (var i = 0; i < rows.length; i++) {
            var path = typeof rows[i] === 'string' ? rows[i] : (rows[i] && rows[i].path);
            if (!path) continue;
            folders.push({ id: path, label: path });
          }
          folders.sort(function (a, b) {
            if (a.label.length !== b.label.length) return a.label.length - b.label.length;
            return a.label.localeCompare(b.label);
          });
          return folders.slice(0, 300);
        });
      },
      folderAssets: function (path) {
        return request('/view/folder?path=' + encodeURIComponent(path)).then(function (data) {
          return normalizeMany(Array.isArray(data) ? data : []);
        });
      },
      memories: function (day) {
        var query = '/memories?type=on_this_day&for=' + encodeURIComponent(day);
        return request(query).then(function (data) {
          var rows = Array.isArray(data) ? data : [];
          var assets = [];
          for (var i = 0; i < rows.length; i++) {
            assets = assets.concat(normalizeMany(rows[i].assets || []));
          }
          return assets;
        });
      }
    };
  }

  Alcove.normalizeAsset = normalizeAsset;
  Alcove.captionFor = captionFor;
  Alcove.assetsFromSearch = assetsFromSearch;
  Alcove.createImmich = createImmich;
})(typeof window !== 'undefined' ? window : globalThis);
