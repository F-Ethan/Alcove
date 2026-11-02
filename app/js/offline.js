(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var POOL_KEY = 'alcove.pool.v1';

  function byteSize(blob) {
    if (!blob) return 0;
    if (typeof blob.size === 'number' && isFinite(blob.size)) return blob.size;
    if (typeof blob.byteLength === 'number') return blob.byteLength;
    return 0;
  }

  function createMemoryBlobStore(max, maxBytes) {
    var limit = max || 8;
    var byteCap = maxBytes > 0 ? maxBytes : 24 * 1024 * 1024;
    var items = [];

    function find(id) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
      return null;
    }

    function totalBytes() {
      var sum = 0;
      for (var i = 0; i < items.length; i++) sum += items[i].bytes || 0;
      return sum;
    }

    function evict() {
      items.sort(function (a, b) { return a.at - b.at; });
      while (items.length > limit) items.shift();
      while (items.length && totalBytes() > byteCap) items.shift();
    }

    return {
      put: function (id, blob) {
        var existing = find(id);
        var bytes = byteSize(blob);
        if (existing) {
          existing.blob = blob;
          existing.bytes = bytes;
          existing.at = Date.now();
        } else {
          items.push({ id: id, blob: blob, bytes: bytes, at: Date.now() });
        }
        evict();
        return Promise.resolve();
      },
      get: function (id) {
        var existing = find(id);
        if (!existing) return Promise.resolve(null);
        existing.at = Date.now();
        return Promise.resolve(existing.blob);
      },
      has: function (id) { return !!find(id); },
      size: function () { return items.length; },
      bytes: function () { return totalBytes(); }
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
      for (var i = 0; i < list.length && i < 40; i++) slim.push(slimAsset(list[i]));
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

  function createIdbBlobStore(max, maxBytes) {
    if (!root.indexedDB) return null;
    var limit = max || 8;
    var byteCap = maxBytes > 0 ? maxBytes : 24 * 1024 * 1024;
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
        var list = (rows || []).slice();
        list.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
        var keepFrom = 0;
        while (list.length - keepFrom > limit) keepFrom += 1;
        var running = 0;
        for (var b = keepFrom; b < list.length; b++) running += list[b].bytes || 0;
        while (keepFrom < list.length && running > byteCap) {
          running -= list[keepFrom].bytes || 0;
          keepFrom += 1;
        }
        var jobs = [];
        for (var i = 0; i < keepFrom; i++) {
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
          return store.put({ id: id, blob: blob, bytes: byteSize(blob), at: Date.now() });
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
    var max = options && options.max ? options.max : 8;
    var maxBytes = options && options.maxBytes ? options.maxBytes : 24 * 1024 * 1024;
    var memory = createMemoryBlobStore(max, maxBytes);
    var idb = options && options.persistent === false ? null : createIdbBlobStore(max, maxBytes);
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
      size: function () { return memory.size(); },
      bytes: function () { return memory.bytes(); }
    };
  }

  Alcove.createMemoryBlobStore = createMemoryBlobStore;
  Alcove.choosePreview = choosePreview;
  Alcove.savePool = savePool;
  Alcove.loadPool = loadPool;
  Alcove.createOfflineStore = createOfflineStore;
})(typeof window !== 'undefined' ? window : globalThis);
