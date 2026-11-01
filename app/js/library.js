(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function settle(promises) {
    return Promise.all(promises.map(function (promise) {
      return Promise.resolve(promise).then(
        function (value) { return { ok: true, value: value }; },
        function (error) { return { ok: false, error: error }; }
      );
    }));
  }

  function dedupe(assets) {
    var seen = {};
    var out = [];
    for (var i = 0; i < assets.length; i++) {
      var asset = assets[i];
      if (!asset || seen[asset.id]) continue;
      seen[asset.id] = true;
      out.push(asset);
    }
    return out;
  }

  function basicKeep(asset) {
    if (!asset || asset.type !== 'IMAGE') return false;
    if (asset.isTrashed) return false;
    if (asset.isArchived) return false;
    if (asset.visibility === 'archive' || asset.visibility === 'hidden' || asset.visibility === 'locked') return false;
    return true;
  }

  function isoDay(date) {
    return date.getFullYear() + '-' + Alcove.util.pad2(date.getMonth() + 1) + '-' + Alcove.util.pad2(date.getDate());
  }

  var ALL_PHOTOS_SIZE = 250;
  var SOURCE_PERMISSION = {
    'All photos': 'asset.read',
    'Favorites': 'asset.read',
    'Albums': 'asset.read',
    'People': 'asset.read',
    'On this day': 'memory.read'
  };

  function searchBody(extra) {
    var body = {
      type: 'IMAGE',
      visibility: 'timeline',
      withExif: true,
      withPeople: true,
      size: 1000
    };
    var key;
    for (key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) body[key] = extra[key];
    }
    return body;
  }

  function errorText(error, sourceName) {
    if (!error) return '';
    var permission = SOURCE_PERMISSION[sourceName] || 'asset.read';
    if (sourceName === 'Album list') permission = 'album.read';
    if (sourceName === 'People list') permission = 'person.read';
    if (sourceName === 'Folder list' || sourceName.indexOf('Folder ') === 0) permission = 'folder.read';
    if (error.status === 403) return '403 missing permission ' + permission;
    if (error.status === 401) return '401 API key was refused';
    if (error.status) return 'HTTP ' + error.status;
    return 'network error';
  }

  function track(name, promise, extra) {
    return Promise.resolve(promise).then(
      function (value) {
        var assets = value || [];
        var row = { name: name, count: assets.length, assets: assets, error: '', fallback: false };
        var key;
        if (extra) {
          for (key in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, key)) row[key] = extra[key];
          }
        }
        return row;
      },
      function (error) {
        var row = { name: name, count: 0, assets: [], error: errorText(error, name), fallback: false, status: error && error.status };
        var key;
        if (extra) {
          for (key in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, key)) row[key] = extra[key];
          }
        }
        return row;
      }
    );
  }

  function folderLabel(path) {
    var parts = String(path || '').split('/');
    var last = parts[parts.length - 1] || path;
    return 'Folder ' + last;
  }

  function allPhotosJob(client) {
    return client.searchRandom(searchBody({ size: ALL_PHOTOS_SIZE }));
  }

  function concatRows(rows) {
    var assets = [];
    var failures = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].error) failures += 1;
      else assets = assets.concat(rows[i].assets);
    }
    return { assets: dedupe(assets), failures: failures, sources: rows };
  }

  function loadLibrary(settings, fetchImpl, now) {
    var client = Alcove.createImmich({
      serverUrl: settings.serverUrl,
      apiKey: settings.apiKey,
      fetch: fetchImpl
    });
    var jobs = [];
    var sources = settings.sources || {};
    if (sources.allPhotos) jobs.push(track('All photos', allPhotosJob(client)));
    if (sources.favorites) jobs.push(track('Favorites', client.searchMetadata(searchBody({ isFavorite: true }))));
    if (sources.albums && sources.albums.length) {
      jobs.push(track('Albums', client.searchMetadata(searchBody({ albumIds: sources.albums }))));
    }
    if (sources.people && sources.people.length) {
      jobs.push(track('People', client.searchMetadata(searchBody({ personIds: sources.people }))));
    }
    var folders = sources.folders || [];
    for (var i = 0; i < folders.length; i++) {
      jobs.push(track(folderLabel(folders[i]), client.folderAssets(folders[i])));
    }
    if (sources.onThisDay) jobs.push(track('On this day', client.memories(isoDay(now || new Date()))));

    var catalogJobs = settle([
      track('Album list', client.listAlbums()),
      track('People list', client.listPeople()),
      track('Folder list', client.listFolders())
    ]);

    function withCatalogs(packed) {
      return catalogJobs.then(function (catalogs) {
        var errors = [];
        for (var c = 0; c < catalogs.length; c++) {
          if (catalogs[c].value && catalogs[c].value.error) {
            errors.push({ name: catalogs[c].value.name, error: catalogs[c].value.error });
          }
        }
        // Album and people list calls return {id, label} rows, not assets.
        // track() stored those rows on .assets because the promise resolved to an array.
        function catalogItems(index) {
          var row = catalogs[index] && catalogs[index].value;
          if (!row || row.error) return [];
          return row.assets || [];
        }
        return {
          assets: packed.assets,
          failures: packed.failures,
          report: { sources: packed.sources, errors: errors },
          catalogs: {
            albums: catalogItems(0),
            people: catalogItems(1),
            folders: catalogItems(2)
          }
        };
      });
    }

    return Promise.all(jobs).then(function (rows) {
      var packed = concatRows(rows);
      var yielded = false;
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].error && rows[i].count > 0) yielded = true;
      }
      if (yielded || sources.allPhotos) return withCatalogs(packed);
      return track('All photos', allPhotosJob(client), { fallback: true }).then(function (fallback) {
        rows.push(fallback);
        return withCatalogs(concatRows(rows));
      });
    });
  }

  var DROP_LABELS = {
    notImage: 'not a still',
    trashed: 'trashed',
    archived: 'archived',
    hidden: 'hidden',
    locked: 'locked',
    screenshot: 'screenshot',
    noPeople: 'no person',
    small: 'below the size floor',
    rating: 'below the star floor',
    tag: 'excluded tag',
    junk: 'smart-search junk list'
  };

  function explainEmpty(report, summary) {
    var lines = ['No photos on the wall.'];
    var sources = report && report.sources ? report.sources : [];
    if (!sources.length) lines.push('No source was requested.');
    for (var i = 0; i < sources.length; i++) {
      var row = sources[i];
      var line = row.name + ': ' + row.count + (row.count === 1 ? ' photo' : ' photos');
      if (row.fallback) line += ' (fallback)';
      if (row.error) line += '. ' + row.error;
      lines.push(line);
    }
    var errors = report && report.errors ? report.errors : [];
    for (var e = 0; e < errors.length; e++) {
      lines.push(errors[e].name + ': ' + errors[e].error);
    }
    if (summary && summary.started) {
      var kept = summary.keptCount != null ? summary.keptCount : (summary.kept && summary.kept.length) || 0;
      lines.push('Filters kept ' + kept + ' of ' + summary.started + '.');
      var bits = [];
      var dropped = summary.dropped || {};
      var key;
      for (key in DROP_LABELS) {
        if (Object.prototype.hasOwnProperty.call(DROP_LABELS, key) && dropped[key]) {
          bits.push(DROP_LABELS[key] + ' ' + dropped[key]);
        }
      }
      if (bits.length) lines.push('Dropped: ' + bits.join(', ') + '.');
      if (dropped.junk) {
        lines.push('Turn Smart search junk filter off in Filters if that count looks too high.');
      }
    }
    return lines.join('\n');
  }

  function placeholderUrl(asset) {
    var width = asset.width || 1600;
    var height = asset.height || 1000;
    if (asset.width && asset.height && asset.height > asset.width) {
      width = 900;
      height = 1400;
    } else if (!asset.width) {
      width = 1600;
      height = 1000;
    }
    var hue = 0;
    var id = String(asset.id || '');
    for (var i = 0; i < id.length; i++) hue = (hue + id.charCodeAt(i) * 17) % 360;
    var label = String(Alcove.captionFor(asset) || 'Photo').replace(/[<>&]/g, '');
    if (label.length > 42) label = label.slice(0, 42);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">'
      + '<rect width="100%" height="100%" fill="hsl(' + hue + ', 22%, 28%)"/>'
      + '<text x="50%" y="52%" fill="#f3efe6" font-size="56" text-anchor="middle" font-family="sans-serif">'
      + label + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  Alcove.loadLibrary = loadLibrary;
  Alcove.explainEmpty = explainEmpty;
  Alcove.ALL_PHOTOS_SIZE = ALL_PHOTOS_SIZE;
  Alcove.placeholderUrl = placeholderUrl;
  Alcove.basicKeep = basicKeep;
})(typeof window !== 'undefined' ? window : globalThis);
