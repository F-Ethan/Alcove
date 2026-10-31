(function (root) {
  var Alcove = root.Alcove;
  var deck = [];
  var cursor = 0;
  var wall = null;
  var visualKey = '';

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

  function svgUrl(asset) {
    var width = asset.width || 1600;
    var height = asset.height || 1000;
    var label = String(asset.label || '').replace(/[<>&]/g, '');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">'
      + '<rect width="100%" height="100%" fill="' + (asset.color || '#3e4a55') + '"/>'
      + '<text x="50%" y="52%" fill="#f3efe6" font-size="72" text-anchor="middle" font-family="sans-serif">'
      + label + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function requestNext(prefer) {
    if (!deck.length) return null;
    for (var n = 0; n < deck.length; n++) {
      var asset = deck[(cursor + n) % deck.length];
      var shape = Alcove.layouts.orientationOf(asset);
      var fits = !prefer || prefer === 'any' || shape === 'unknown' || shape === 'square' || shape === prefer;
      if (fits) {
        cursor = (cursor + n + 1) % deck.length;
        return asset;
      }
    }
    var fallback = deck[cursor % deck.length];
    cursor = (cursor + 1) % deck.length;
    return fallback;
  }

  function orientations() {
    var list = [];
    for (var i = 0; i < deck.length; i++) list.push(Alcove.layouts.orientationOf(deck[i]));
    return list;
  }

  function appearance(settings) {
    return [
      settings.layout,
      settings.intervalSec,
      settings.crossfadeMs,
      settings.kenBurns ? 1 : 0,
      settings.showCaptions ? 1 : 0
    ].join('|');
  }

  function boot() {
    deck = sampleDeck();
    var store = Alcove.createSettingsStore(root.localStorage);
    var settings = store.load();
    var frame = document.getElementById('frame');
    var note = document.getElementById('frame-note');
    wall = Alcove.createWall({
      rootEl: document.getElementById('tiles'),
      getSettings: function () { return settings; },
      requestNext: requestNext,
      imageUrl: function (asset) {
        if (asset.previewUrl) return asset.previewUrl;
        return svgUrl(asset);
      },
      orientations: orientations,
      onShown: function () {
        if (note) note.hidden = true;
      }
    });

    var screen = Alcove.createSettingsScreen({
      rootEl: document.getElementById('settings'),
      navEl: document.getElementById('settings-nav'),
      paneEl: document.getElementById('settings-pane'),
      statusEl: document.getElementById('settings-status'),
      store: store,
      fetch: root.fetch.bind(root),
      onChange: function (next) {
        settings = next;
        var nextKey = appearance(settings);
        if (wall && nextKey !== visualKey) {
          visualKey = nextKey;
          wall.restart();
        }
      },
      onOpen: function () {
        if (wall) wall.pause();
      },
      onClose: function (next) {
        settings = next;
        frame.hidden = false;
        if (wall && wall.isPaused()) wall.resume();
      }
    });

    Alcove.remote.attachRemote({
      settingsScreen: screen,
      onFrameKey: function () { return false; }
    });

    visualKey = appearance(settings);
    frame.hidden = false;
    wall.start();
    if (!settings.serverUrl || !settings.apiKey) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Add the Immich server and API key in settings. Press Yellow, or S on a keyboard.';
      }
      screen.open();
    }

    root.AlcoveApp = { screen: screen, store: store, wall: wall };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
