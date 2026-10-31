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

    var store = options.store;

    function endpoint(asset) {
      var base = Alcove.util.apiBase(options.serverUrl());
      return base + '/assets/' + encodeURIComponent(asset.id) + '/thumbnail?size=preview';
    }

    function fetchBlob(asset) {
      var key = options.apiKey();
      function once() {
        return options.fetch(endpoint(asset), {
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
        });
      }
      if (!Alcove.retry) return once();
      return Alcove.retry(once, {
        tries: 3,
        baseMs: 400,
        maxMs: 8000,
        retryOn: function (error) {
          return !(error && error.status >= 400 && error.status < 500);
        }
      });
    }

    function deliver(asset, blob, offline) {
      if (offline && options.onOffline) options.onOffline(true);
      if (!offline && options.onOnline) options.onOnline();
      if (store && !offline) store.put(asset.id, blob);
      return { url: pool.hold(asset.id, blob), pinned: true };
    }

    function fromNetwork(asset) {
      return fetchBlob(asset).then(function (blob) {
        return deliver(asset, blob, false);
      }).catch(function () {
        if (!store) return Promise.reject(new Error('no preview'));
        return store.get(asset.id).then(function (cached) {
          var choice = Alcove.choosePreview(null, cached);
          if (!choice) return Promise.reject(new Error('no preview'));
          return deliver(asset, choice.blob, true);
        });
      });
    }

    function urlFor(asset) {
      if (!asset || !asset.id || !Alcove.util.apiBase(options.serverUrl()) || !options.apiKey()) {
        return Promise.resolve({ url: '', pinned: false });
      }
      if (store && store.has && store.has(asset.id)) {
        return store.get(asset.id).then(function (blob) {
          if (!blob) return fromNetwork(asset);
          return deliver(asset, blob, false);
        });
      }
      return fromNetwork(asset);
    }

    function preload(assets) {
      var list = (assets || []).slice(0, options.preload || 8);
      var chain = Promise.resolve();
      for (var i = 0; i < list.length; i++) {
        chain = chain.then(preloadOne(list[i]));
      }
      return chain;
    }

    function preloadOne(asset) {
      return function () {
        if (!asset || !asset.id) return null;
        if (store && store.has && store.has(asset.id)) return null;
        return fetchBlob(asset).then(function (blob) {
          if (store) return store.put(asset.id, blob);
          return null;
        }).catch(function () { return null; });
      };
    }

    return {
      urlFor: urlFor,
      preload: preload,
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
