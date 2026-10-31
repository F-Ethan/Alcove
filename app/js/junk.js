(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var STORAGE_KEY = 'alcove.junk.v1';
  var DAY_MS = 24 * 60 * 60 * 1000;

  function signature(settings) {
    var junk = settings && settings.filters && settings.filters.junk ? settings.filters.junk : {};
    return JSON.stringify({
      serverUrl: settings ? settings.serverUrl : '',
      enabled: junk.enabled !== false,
      queries: junk.queries || [],
      perQuery: junk.perQuery || 0
    });
  }

  function load(storage) {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.ids)) return null;
      return {
        signature: String(parsed.signature || ''),
        refreshedAt: Number(parsed.refreshedAt) || 0,
        ids: parsed.ids.map(String),
        failed: Number(parsed.failed) || 0
      };
    } catch (err) {
      return null;
    }
  }

  function save(storage, cache) {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      signature: cache.signature,
      refreshedAt: cache.refreshedAt,
      ids: cache.ids,
      failed: cache.failed || 0
    }));
  }

  function shouldRefresh(cache, settings, now) {
    var junk = settings && settings.filters && settings.filters.junk;
    if (!junk || junk.enabled === false) return false;
    if (!cache) return true;
    if (cache.signature !== signature(settings)) return true;
    if (!cache.refreshedAt || (now - cache.refreshedAt) >= DAY_MS) return true;
    return false;
  }

  function asMap(ids) {
    var map = {};
    var list = ids || [];
    for (var i = 0; i < list.length; i++) map[list[i]] = true;
    return map;
  }

  function topIds(assets, limit) {
    var ids = [];
    var seen = {};
    var list = assets || [];
    var cap = limit > 0 ? limit : list.length;
    for (var i = 0; i < list.length && ids.length < cap; i++) {
      if (!list[i] || !list[i].id || seen[list[i].id]) continue;
      seen[list[i].id] = true;
      ids.push(list[i].id);
    }
    return ids;
  }

  function refresh(client, settings) {
    var junk = settings.filters.junk;
    var queries = junk.queries || [];
    var jobs = [];
    for (var i = 0; i < queries.length; i++) {
      jobs.push(client.searchSmart({
        query: queries[i],
        type: 'IMAGE',
        size: junk.perQuery
      }));
    }
    return Promise.all(jobs.map(function (job) {
      return Promise.resolve(job).then(
        function (value) { return { ok: true, value: value }; },
        function () { return { ok: false }; }
      );
    })).then(function (results) {
      var ids = [];
      var seen = {};
      var failed = 0;
      for (var r = 0; r < results.length; r++) {
        if (!results[r].ok) {
          failed += 1;
          continue;
        }
        var batch = topIds(results[r].value, junk.perQuery);
        for (var j = 0; j < batch.length; j++) {
          if (seen[batch[j]]) continue;
          seen[batch[j]] = true;
          ids.push(batch[j]);
        }
      }
      return { ids: ids, failed: failed, queries: queries.length };
    });
  }

  Alcove.junk = {
    STORAGE_KEY: STORAGE_KEY,
    DAY_MS: DAY_MS,
    signature: signature,
    load: load,
    save: save,
    shouldRefresh: shouldRefresh,
    asMap: asMap,
    topIds: topIds,
    refresh: refresh
  };
})(typeof window !== 'undefined' ? window : globalThis);
