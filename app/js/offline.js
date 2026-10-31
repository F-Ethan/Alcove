(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var POOL_KEY = 'alcove.pool.v1';

  function createMemoryBlobStore(max) {
    var limit = max || 36;
    var items = [];

    function find(id) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
      return null;
    }

    return {
      put: function (id, blob) {
        var existing = find(id);
        if (existing) {
          existing.blob = blob;
          existing.at = Date.now();
        } else {
          items.push({ id: id, blob: blob, at: Date.now() });
        }
        items.sort(function (a, b) { return a.at - b.at; });
        while (items.length > limit) items.shift();
        return Promise.resolve();
      },
      get: function (id) {
        var existing = find(id);
        if (!existing) return Promise.resolve(null);
        existing.at = Date.now();
        return Promise.resolve(existing.blob);
      },
      has: function (id) { return !!find(id); },
      size: function () { return items.length; }
    };
  }

  function choosePreview(networkBlob, cachedBlob) {
    if (networkBlob) return { blob: networkBlob, offline: false };
    if (cachedBlob) return { blob: cachedBlob, offline: true };
    return null;
  }

  function slimAsset(asset) {
    return {
      id: asset.id,
      type: asset.type,
      originalFileName: asset.originalFileName || '',
      originalPath: asset.originalPath || '',
      isFavorite: asset.isFavorite === true,
      isArchived: asset.isArchived === true,
      isTrashed: asset.isTrashed === true,
      visibility: asset.visibility || 'timeline',
      width: asset.width || 0,
      height: asset.height || 0,
      rating: asset.rating,
      city: asset.city || '',
      state: asset.state || '',
      description: asset.description || '',
      fileCreatedAt: asset.fileCreatedAt || '',
      people: asset.people,
      tags: asset.tags || []
    };
  }

  function savePool(storage, assets) {
    try {
      var slim = [];
      var list = assets || [];
      for (var i = 0; i < list.length && i < 80; i++) slim.push(slimAsset(list[i]));
      storage.setItem(POOL_KEY, JSON.stringify(slim));
    } catch (err) {
      // A full local store should not stop the frame.
    }
  }

  function loadPool(storage) {
    try {
      var raw = storage.getItem(POOL_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function createIdbBlobStore(max) {
    if (!root.indexedDB) return null;
    var limit = max || 36;
    var dbPromise = null;

    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve, reject) {
        var request = root.indexedDB.open('alcove', 1);
        request.onupgradeneeded = function () {
          var db = request.result;
          if (!db.objectStoreNames.contains('previews')) {
            db.createObjectStore('previews', { keyPath: 'id' });
          }
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      }).catch(function (error) {
        dbPromise = null;
        throw error;
      });
      return dbPromise;
    }

    function run(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var transaction = db.transaction('previews', mode);
          var store = transaction.objectStore('previews');
          var request = fn(store);
          request.onsuccess = function () { resolve(request.result); };
          request.onerror = function () { reject(request.error); };
        });
      });
    }

    function trim() {
      return run('readonly', function (store) { return store.getAll(); }).then(function (rows) {
        var list = rows || [];
        if (list.length <= limit) return;
        list.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
        var extra = list.length - limit;
        var jobs = [];
        for (var i = 0; i < extra; i++) {
          jobs.push((function (id) {
            return run('readwrite', function (store) { return store.delete(id); });
          })(list[i].id));
        }
        return Promise.all(jobs);
      }).catch(function () {});
    }

    return {
      put: function (id, blob) {
        return run('readwrite', function (store) {
          return store.put({ id: id, blob: blob, at: Date.now() });
        }).then(function () { return trim(); }).catch(function () {});
      },
      get: function (id) {
        return run('readonly', function (store) { return store.get(id); }).then(function (row) {
          return row ? row.blob : null;
        }).catch(function () { return null; });
      }
    };
  }

  function createOfflineStore(options) {
    var max = options && options.max ? options.max : 36;
    var memory = createMemoryBlobStore(max);
    var idb = options && options.persistent === false ? null : createIdbBlobStore(max);
    return {
      put: function (id, blob) {
        memory.put(id, blob);
        if (idb) return idb.put(id, blob);
        return Promise.resolve();
      },
      get: function (id) {
        if (memory.has(id)) return memory.get(id);
        if (idb) return idb.get(id);
        return Promise.resolve(null);
      },
      has: function (id) { return memory.has(id); },
      size: function () { return memory.size(); }
    };
  }

  Alcove.createMemoryBlobStore = createMemoryBlobStore;
  Alcove.choosePreview = choosePreview;
  Alcove.savePool = savePool;
  Alcove.loadPool = loadPool;
  Alcove.createOfflineStore = createOfflineStore;
})(typeof window !== 'undefined' ? window : globalThis);
