(function (root) {
  var Alcove = root.Alcove;
  var playlist = null;
  var pool = [];
  var wall = null;
  var loader = null;
  var blobStore = null;
  var settings = null;
  var screen = null;
  var rawAssets = [];
  var usingLibrary = false;
  var visualKey = '';
  var reloadTimer = 0;
  var note = null;
  var userPaused = false;

  var SAMPLE_COLORS = ['#5c7a8a', '#ba9a70', '#6e7d5a', '#8a6256', '#3e4a55', '#7d6a86', '#4f6f64', '#a98467'];

  function sampleDeck() {
    var items = [];
    for (var i = 0; i < 8; i++) {
      var portrait = i % 3 === 0;
      items.push({
        id: 'sample-' + i,
        width: portrait ? 900 : 1600,
        height: portrait ? 1400 : 1000,
        color: SAMPLE_COLORS[i],
        label: portrait ? 'Portrait ' + (i + 1) : 'Landscape ' + (i + 1),
        caption: portrait ? 'Portrait ' + (i + 1) : 'Landscape ' + (i + 1)
      });
    }
    return items;
  }

  function sampleUrl(asset) {
    var width = asset.width || 1600;
    var height = asset.height || 1000;
    var label = String(asset.label || '').replace(/[<>&]/g, '');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">'
      + '<rect width="100%" height="100%" fill="' + (asset.color || '#3e4a55') + '"/>'
      + '<text x="50%" y="52%" fill="#f3efe6" font-size="72" text-anchor="middle" font-family="sans-serif">'
      + label + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function useSamples() {
    usingLibrary = false;
    rawAssets = [];
    pool = sampleDeck();
    playlist = Alcove.createPlaylist(pool);
    if (note) {
      note.hidden = false;
      note.textContent = 'Add the Immich server and API key in settings. Press Yellow, or S on a keyboard.';
    }
    if (wall) wall.restart();
  }

  function appearance(current) {
    return [
      current.layout,
      current.intervalSec,
      current.crossfadeMs,
      current.kenBurns ? 1 : 0,
      current.showCaptions ? 1 : 0
    ].join('|');
  }

  function libraryInputs(current) {
    return JSON.stringify({
      serverUrl: current.serverUrl,
      hasKey: current.apiKey ? 1 : 0,
      keyLength: current.apiKey ? current.apiKey.length : 0,
      sources: current.sources
    });
  }

  function withSelected(items, selected) {
    var seen = {};
    var out = items.slice();
    for (var i = 0; i < out.length; i++) seen[out[i].id] = true;
    for (var j = 0; j < selected.length; j++) {
      if (!seen[selected[j]]) out.push({ id: selected[j], label: selected[j] });
    }
    return out;
  }

  function excludeMap() {
    if (!settings.filters.junk.enabled) return null;
    var cache = Alcove.junk.load(root.localStorage);
    if (!cache || cache.signature !== Alcove.junk.signature(settings)) return null;
    return Alcove.junk.asMap(cache.ids);
  }

  function setOffline(on) {
    var badge = document.getElementById('offline');
    if (badge) badge.hidden = !on;
  }

  function publish(assets, failures, options) {
    rawAssets = assets || [];
    pool = Alcove.filters.apply(rawAssets, settings, excludeMap());
    for (var n = 0; n < pool.length; n++) pool[n].caption = Alcove.captionFor(pool[n]);
    playlist = Alcove.createPlaylist(pool);
    usingLibrary = true;
    if (!options || options.persist !== false) Alcove.savePool(root.localStorage, rawAssets);
    if (!pool.length && note) {
      note.hidden = false;
      if (!rawAssets.length) {
        note.textContent = failures
          ? 'Immich did not return photos. Open settings and test the connection.'
          : 'No photos matched these sources. Pick an album, a person, favorites, or a folder.';
      } else {
        note.textContent = 'Every photo was filtered out. Relax the filters in settings.';
      }
    }
    if (wall) wall.restart();
    if (loader && pool.length) loader.preload(pool);
  }

  function refreshJunk() {
    if (!settings.filters.junk.enabled || !settings.serverUrl || !settings.apiKey) return Promise.resolve(null);
    var cache = Alcove.junk.load(root.localStorage);
    if (!Alcove.junk.shouldRefresh(cache, settings, Date.now())) return Promise.resolve(cache);
    var client = Alcove.createImmich({
      serverUrl: settings.serverUrl,
      apiKey: settings.apiKey,
      fetch: root.fetch.bind(root)
    });
    return Alcove.junk.refresh(client, settings).then(function (result) {
      if (!settings.serverUrl || !settings.apiKey) return cache;
      if (result.queries && result.failed === result.queries && cache && cache.ids.length) {
        if (screen && screen.isOpen()) {
          screen.setStatus('Smart search did not answer. The saved junk list is still in use.');
        }
        return cache;
      }
      var next = {
        signature: Alcove.junk.signature(settings),
        refreshedAt: Date.now(),
        ids: result.ids,
        failed: result.failed
      };
      Alcove.junk.save(root.localStorage, next);
      if (result.failed && screen && screen.isOpen()) {
        screen.setStatus('Some junk searches failed. Alcove excluded the matches that came back.');
      }
      if (rawAssets.length) publish(rawAssets, 0);
      return next;
    }).catch(function () {
      return cache;
    });
  }

  function reloadLibrary() {
    if (!settings.serverUrl || !settings.apiKey) {
      if (loader) loader.releaseAll();
      loader = null;
      useSamples();
      return;
    }
    ensureLoader();
    if (!(pool.length && usingLibrary) && note) {
      note.hidden = false;
      note.textContent = 'Loading photos from Immich...';
    }
    var requested = settings;
    Alcove.loadLibrary(requested, root.fetch.bind(root), new Date()).then(function (result) {
      if (libraryInputs(settings) !== libraryInputs(requested)) return;
      if (screen) {
        screen.setCatalogs({
          albums: withSelected(result.catalogs.albums, settings.sources.albums),
          people: withSelected(result.catalogs.people, settings.sources.people),
          folders: withSelected(result.catalogs.folders, settings.sources.folders)
        });
      }
      publish(result.assets, result.failures);
      refreshJunk();
    }).catch(function () {
      setOffline(true);
      if (!rawAssets.length && note) {
        note.hidden = false;
        note.textContent = 'Immich did not return photos. Open settings and test the connection.';
      }
    });
  }

  function ensureLoader() {
    if (!settings.serverUrl || !settings.apiKey) return;
    if (loader) return;
    if (!blobStore) blobStore = Alcove.createOfflineStore({ max: 36 });
    loader = Alcove.createImageLoader({
      serverUrl: function () { return settings.serverUrl; },
      apiKey: function () { return settings.apiKey; },
      fetch: root.fetch.bind(root),
      store: blobStore,
      max: 24,
      onOffline: function () { setOffline(true); },
      onOnline: function () { setOffline(false); }
    });
  }

  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(reloadLibrary, 350);
  }

  function boot() {
    var store = Alcove.createSettingsStore(root.localStorage);
    settings = store.load();
    note = document.getElementById('frame-note');
    var frame = document.getElementById('frame');
    pool = sampleDeck();
    playlist = Alcove.createPlaylist(pool);
    wall = Alcove.createWall({
      rootEl: document.getElementById('tiles'),
      getSettings: function () { return settings; },
      requestNext: function (prefer) { return playlist ? playlist.next(prefer) : null; },
      imageUrl: function (asset) {
        asset.caption = asset.caption || Alcove.captionFor(asset);
        if (asset.color) return sampleUrl(asset);
        if (!loader) return { url: Alcove.placeholderUrl(asset), pinned: false };
        return loader.urlFor(asset).catch(function () {
          return { url: Alcove.placeholderUrl(asset), pinned: false };
        });
      },
      release: function (asset) {
        if (loader) loader.release(asset);
      },
      orientations: function () {
        var shapes = [];
        for (var i = 0; i < pool.length; i++) shapes.push(Alcove.layouts.orientationOf(pool[i]));
        return shapes;
      },
      onShown: function () {
        if (usingLibrary && playlist && playlist.size() && note) note.hidden = true;
      }
    });

    screen = Alcove.createSettingsScreen({
      rootEl: document.getElementById('settings'),
      navEl: document.getElementById('settings-nav'),
      paneEl: document.getElementById('settings-pane'),
      statusEl: document.getElementById('settings-status'),
      store: store,
      fetch: root.fetch.bind(root),
      onChange: function (next) {
        var previousLook = appearance(settings);
        var previousLibrary = libraryInputs(settings);
        var previousFilters = JSON.stringify(settings.filters);
        var previousJunk = Alcove.junk.signature(settings);
        settings = next;
        if (appearance(settings) !== previousLook && wall) {
          visualKey = appearance(settings);
          wall.restart();
        }
        if (libraryInputs(settings) !== previousLibrary) scheduleReload();
        else if (JSON.stringify(settings.filters) !== previousFilters && rawAssets.length && settings.serverUrl && settings.apiKey) {
          publish(rawAssets, 0);
          if (Alcove.junk.signature(settings) !== previousJunk) refreshJunk();
        }
        syncDecor();
        syncChrome();
      },
      onConnect: function () { reloadLibrary(); },
      onOpen: function () {
        if (wall) wall.pause();
      },
      onClose: function (next) {
        settings = next;
        frame.hidden = false;
        if (wall && !userPaused) wall.resume();
      }
    });

    function syncDecor() {
      Alcove.renderDecoration(document.getElementById('decor'), settings.decoration, new Date());
    }

    function syncChrome() {
      var now = new Date();
      var chrome = document.getElementById('chrome');
      var shift = Alcove.display.burnInShift(now.getTime(), settings.burnInAvoidance);
      if (chrome) chrome.style.transform = 'translate(' + shift.x + 'px, ' + shift.y + 'px)';
      var clock = document.getElementById('clock');
      if (clock) {
        if (settings.showClock) {
          var text = Alcove.display.clockText(now);
          clock.hidden = false;
          clock.textContent = '';
          clock.appendChild(document.createTextNode(text.time + ' ' + text.suffix));
          var day = document.createElement('span');
          day.textContent = text.date;
          clock.appendChild(day);
        } else {
          clock.hidden = true;
        }
      }
      var night = document.getElementById('night');
      var dim = Alcove.display.nightOpacity(now, settings) > 0;
      if (night) night.style.opacity = String(Alcove.display.nightOpacity(now, settings));
      if (chrome) chrome.classList.toggle('dimmed', dim);
    }

    function setPausedBadge(paused) {
      var badge = document.getElementById('paused');
      if (badge) badge.hidden = !paused;
    }

    Alcove.remote.attachRemote({
      settingsScreen: screen,
      onFrameKey: function (event) {
        var left = event.key === 'ArrowLeft' || event.keyCode === 37;
        var right = event.key === 'ArrowRight' || event.keyCode === 39;
        var ok = event.key === 'Enter' || event.keyCode === 13 || event.keyCode === 415 || event.keyCode === 19;
        if (right && wall) {
          wall.skip(1);
          return true;
        }
        if (left && wall) {
          wall.skip(-1);
          return true;
        }
        if (ok && wall) {
          userPaused = !userPaused;
          if (userPaused) wall.pause();
          else wall.resume();
          setPausedBadge(userPaused);
          return true;
        }
        return false;
      }
    });

    visualKey = appearance(settings);
    frame.hidden = false;
    syncDecor();
    syncChrome();
    setInterval(function () {
      syncDecor();
      syncChrome();
    }, 15000);
    var cachedPool = Alcove.loadPool(root.localStorage);
    if (settings.serverUrl && settings.apiKey && cachedPool.length) {
      ensureLoader();
      rawAssets = cachedPool;
      pool = Alcove.filters.apply(rawAssets, settings, excludeMap());
      playlist = Alcove.createPlaylist(pool);
      usingLibrary = true;
    }
    wall.start();
    if (!settings.serverUrl || !settings.apiKey) {
      useSamples();
      screen.open();
    } else {
      reloadLibrary();
    }

    root.AlcoveApp = {
      screen: screen,
      store: store,
      wall: wall,
      playlist: function () { return playlist; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
