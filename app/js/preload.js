(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function decode(url, ImageCtor) {
    return new Promise(function (resolve, reject) {
      if (!url) {
        reject(new Error('empty'));
        return;
      }
      var Ctor = ImageCtor;
      if (!Ctor && typeof Image !== 'undefined') Ctor = Image;
      if (!Ctor) {
        resolve({ url: url, width: 0, height: 0 });
        return;
      }
      var img = new Ctor();
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        resolve({
          url: url,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0
        });
      }
      function fail() {
        if (settled) return;
        settled = true;
        reject(new Error('load'));
      }
      img.onload = function () {
        if (typeof img.decode === 'function') Promise.resolve(img.decode()).then(finish, finish);
        else finish();
      };
      img.onerror = fail;
      try {
        img.src = url;
      } catch (err) {
        fail();
        return;
      }
      if (img.complete && (img.naturalWidth || img.width)) img.onload();
    });
  }

  function createPreloadQueue(options) {
    var opts = options || {};
    var limit = opts.limit > 0 ? opts.limit : 4;
    var items = [];

    function find(id) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
      return null;
    }

    function drop(entry, doRevoke) {
      var index = items.indexOf(entry);
      if (index >= 0) items.splice(index, 1);
      if (doRevoke && entry.result && entry.result.pinned && opts.revoke) opts.revoke(entry.asset, entry.result);
    }

    function evict() {
      var spare = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].state === 'ready' && !items[i].keep) spare.push(items[i]);
      }
      while (items.length > limit && spare.length) drop(spare.shift(), true);
    }

    function request(asset) {
      if (!asset || !asset.id) return Promise.reject(new Error('asset'));
      var existing = find(asset.id);
      if (existing) {
        if (existing.state === 'failed') return Promise.reject(existing.error || new Error('failed'));
        return existing.promise;
      }
      var entry = {
        id: String(asset.id),
        asset: asset,
        state: 'loading',
        result: null,
        keep: false,
        error: null
      };
      entry.promise = Promise.resolve().then(function () {
        return opts.load(asset);
      }).then(function (result) {
        entry.state = 'ready';
        entry.result = result || {};
        evict();
        return entry.result;
      }, function (error) {
        entry.state = 'failed';
        entry.error = error || new Error('failed');
        throw entry.error;
      });
      items.push(entry);
      return entry.promise;
    }

    function ready(id) {
      var entry = find(id);
      return !!(entry && entry.state === 'ready');
    }

    function claim(id) {
      var entry = find(id);
      if (!entry || entry.state !== 'ready') return null;
      var result = entry.result;
      drop(entry, false);
      return result;
    }

    function retain(ids) {
      var keep = {};
      var list = ids || [];
      for (var i = 0; i < list.length; i++) keep[String(list[i])] = true;
      var doomed = [];
      for (var j = 0; j < items.length; j++) {
        items[j].keep = !!keep[items[j].id];
        if (!items[j].keep && items[j].state !== 'loading') doomed.push(items[j]);
      }
      for (var d = 0; d < doomed.length; d++) drop(doomed[d], true);
      evict();
    }

    function forget(id) {
      var entry = find(id);
      if (entry) drop(entry, entry.state === 'ready');
    }

    return {
      request: request,
      ready: ready,
      claim: claim,
      retain: retain,
      forget: forget,
      size: function () { return items.length; }
    };
  }

  Alcove.preload = {
    decode: decode,
    createPreloadQueue: createPreloadQueue
  };
})(typeof window !== 'undefined' ? window : globalThis);
