(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function createUrlPool(options) {
    var max = options.max || 24;
    var createUrl = options.createUrl;
    var revokeUrl = options.revokeUrl;
    var items = [];

    function find(id) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
      return null;
    }

    function trim() {
      var guard = items.length;
      while (items.length > max && guard > 0) {
        guard -= 1;
        var index = -1;
        for (var i = 0; i < items.length; i++) {
          if (items[i].pins === 0) {
            index = i;
            break;
          }
        }
        if (index < 0) return;
        var old = items.splice(index, 1)[0];
        revokeUrl(old.url);
      }
    }

    function hold(id, blob) {
      var existing = find(id);
      if (existing) {
        existing.pins += 1;
        return existing.url;
      }
      var url = createUrl(blob);
      items.push({ id: id, url: url, pins: 1 });
      trim();
      return url;
    }

    function release(id) {
      var existing = find(id);
      if (!existing) return;
      if (existing.pins > 0) existing.pins -= 1;
      trim();
    }

    function releaseAll() {
      for (var i = 0; i < items.length; i++) revokeUrl(items[i].url);
      items = [];
    }

    return {
      hold: hold,
      release: release,
      releaseAll: releaseAll,
      size: function () { return items.length; },
      pins: function (id) {
        var existing = find(id);
        return existing ? existing.pins : 0;
      }
    };
  }

  function createImageLoader(options) {
    var pool = createUrlPool({
      max: options.max || 24,
      createUrl: options.createUrl || function (blob) { return root.URL.createObjectURL(blob); },
      revokeUrl: options.revokeUrl || function (url) { root.URL.revokeObjectURL(url); }
    });

    function urlFor(asset) {
      var base = Alcove.util.apiBase(options.serverUrl());
      var key = options.apiKey();
      if (!base || !key || !asset || !asset.id) {
        return Promise.resolve({ url: '', pinned: false });
      }
      var endpoint = base + '/assets/' + encodeURIComponent(asset.id) + '/thumbnail?size=preview';
      return options.fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'image/jpeg,image/webp,image/*',
          'x-api-key': key
        }
      }).then(function (response) {
        if (!response.ok) {
          var error = new Error('Preview request failed');
          error.status = response.status;
          throw error;
        }
        return response.blob();
      }).then(function (blob) {
        return { url: pool.hold(asset.id, blob), pinned: true };
      });
    }

    return {
      urlFor: urlFor,
      release: function (asset) {
        if (asset && asset.id) pool.release(asset.id);
      },
      releaseAll: pool.releaseAll,
      pool: pool
    };
  }

  Alcove.createUrlPool = createUrlPool;
  Alcove.createImageLoader = createImageLoader;
})(typeof window !== 'undefined' ? window : globalThis);
