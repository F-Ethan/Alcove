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

  function loadLibrary(settings, fetchImpl, now) {
    var client = Alcove.createImmich({
      serverUrl: settings.serverUrl,
      apiKey: settings.apiKey,
      fetch: fetchImpl
    });
    var jobs = [];
    var sources = settings.sources;
    if (sources.favorites) jobs.push(client.searchMetadata(searchBody({ isFavorite: true })));
    if (sources.albums.length) jobs.push(client.searchMetadata(searchBody({ albumIds: sources.albums })));
    if (sources.people.length) jobs.push(client.searchMetadata(searchBody({ personIds: sources.people })));
    for (var i = 0; i < sources.folders.length; i++) jobs.push(client.folderAssets(sources.folders[i]));
    if (sources.onThisDay) jobs.push(client.memories(isoDay(now || new Date())));

    var catalogJobs = settle([
      client.listAlbums(),
      client.listPeople(),
      client.listFolders()
    ]);

    return settle(jobs).then(function (results) {
      var assets = [];
      var failures = 0;
      for (var r = 0; r < results.length; r++) {
        if (results[r].ok) assets = assets.concat(results[r].value);
        else failures += 1;
      }
      return catalogJobs.then(function (catalogs) {
        return {
          assets: dedupe(assets),
          failures: failures,
          catalogs: {
            albums: catalogs[0].ok ? catalogs[0].value : [],
            people: catalogs[1].ok ? catalogs[1].value : [],
            folders: catalogs[2].ok ? catalogs[2].value : []
          }
        };
      });
    });
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
  Alcove.placeholderUrl = placeholderUrl;
  Alcove.basicKeep = basicKeep;
})(typeof window !== 'undefined' ? window : globalThis);
