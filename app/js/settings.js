(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var util = Alcove.util;

  var LAYOUTS = ['single', 'two', 'three', 'four', 'mixed'];
  var MUSIC_SOURCES = ['navidrome', 'jellyfin', 'radio'];
  var STREAM_SEASONS = ['any', 'christmas', 'winter', 'fall', 'spring', 'summer', 'none'];
  var PLAYLIST_SEASONS = ['christmas', 'winter', 'fall', 'spring', 'summer', 'none'];
  var DECORATIONS = ['auto', 'none', 'christmas', 'winter', 'fall', 'spring', 'summer'];
  var STORAGE_KEY = 'alcove.settings.v1';

  var DEFAULT_JUNK_QUERIES = [
    'blurry photo',
    'black photo',
    'dark underexposed photo',
    'screenshot',
    'receipt',
    'document'
  ];

  function junkDefaults() {
    return {
      enabled: true,
      queries: DEFAULT_JUNK_QUERIES.slice(),
      perQuery: 40
    };
  }

  function defaultSettings() {
    return {
      serverUrl: '',
      apiKey: '',
      sources: {
        allPhotos: true,
        favorites: true,
        onThisDay: false,
        albums: [],
        people: [],
        folders: []
      },
      layout: 'mixed',
      intervalSec: 20,
      crossfadeMs: 900,
      kenBurns: true,
      decoration: 'auto',
      showClock: true,
      showCaptions: true,
      nightDimming: true,
      nightStart: '22:00',
      nightEnd: '06:30',
      burnInAvoidance: true,
      keepAwake: true,
      filters: {
        peopleOnly: false,
        minRating: 0,
        excludeTag: '',
        minShortEdge: 720,
        junk: junkDefaults()
      },
      music: musicDefaults()
    };
  }

  function musicDefaults() {
    return {
      enabled: false,
      source: 'navidrome',
      volume: 40,
      crossfadeMs: 1500,
      navidrome: emptyServer(),
      jellyfin: emptyServer(),
      radio: {
        streams: [
          { name: 'Example stream', url: '', season: 'any' },
          { name: 'Season stream', url: '', season: 'christmas' }
        ]
      }
    };
  }

  function emptyServer() {
    return {
      url: '',
      username: '',
      password: '',
      playlists: emptyPlaylists()
    };
  }

  function emptyPlaylists() {
    return {
      christmas: '',
      winter: '',
      fall: '',
      spring: '',
      summer: '',
      none: ''
    };
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asIdList(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    for (var i = 0; i < value.length; i++) {
      var id = String(value[i] || '').trim();
      if (id && out.indexOf(id) === -1) out.push(id);
    }
    return out.slice(0, 80);
  }

  function asQueries(value) {
    var source = value;
    if (typeof value === 'string') source = value.split('\n');
    if (!Array.isArray(source)) return DEFAULT_JUNK_QUERIES.slice();
    var out = [];
    for (var i = 0; i < source.length; i++) {
      var line = String(source[i] || '').trim();
      if (!line) continue;
      if (line.length > 80) line = line.slice(0, 80);
      if (out.indexOf(line) === -1) out.push(line);
      if (out.length >= 12) break;
    }
    return out.length ? out : DEFAULT_JUNK_QUERIES.slice();
  }

  function pickEnum(value, allowed, fallback) {
    return allowed.indexOf(value) === -1 ? fallback : value;
  }

  function inspectApiKey(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return { ok: true, empty: true, value: '', message: '' };
    if (text.length < 30 || /[^A-Za-z0-9_-]/.test(text)) {
      return {
        ok: false,
        empty: false,
        value: '',
        message: 'That looks like a password, not an API key. Create a key in Immich under Account Settings, API Keys.'
      };
    }
    return { ok: true, empty: false, value: text, message: '' };
  }

  function applyBuiltin(settings, builtin) {
    var next = mergeSettings(settings);
    var file = builtin || {};
    if (!next.serverUrl && file.serverUrl) {
      var url = String(file.serverUrl).trim().replace(/\/+$/, '');
      if (/^https?:\/\//i.test(url)) next.serverUrl = url;
    }
    if (!next.apiKey && file.apiKey) {
      var key = inspectApiKey(file.apiKey);
      if (key.ok && !key.empty) next.apiKey = key.value;
    }
    return next;
  }

  function mergeSettings(saved) {
    var defaults = defaultSettings();
    var incoming = saved && typeof saved === 'object' ? saved : {};
    var sources = incoming.sources || {};
    var filters = incoming.filters || {};
    var junk = filters.junk || {};
    return {
      serverUrl: String(incoming.serverUrl || '').trim().replace(/\/+$/, ''),
      apiKey: inspectApiKey(incoming.apiKey).value,
      sources: {
        allPhotos: sources.allPhotos !== false,
        favorites: sources.favorites !== false,
        onThisDay: sources.onThisDay === true,
        albums: asIdList(sources.albums),
        people: asIdList(sources.people),
        folders: asIdList(sources.folders)
      },
      layout: pickEnum(incoming.layout, LAYOUTS, defaults.layout),
      intervalSec: util.clamp(incoming.intervalSec, 5, 180, defaults.intervalSec),
      crossfadeMs: util.clamp(incoming.crossfadeMs, 0, 3000, defaults.crossfadeMs),
      kenBurns: incoming.kenBurns !== false,
      decoration: pickEnum(incoming.decoration, DECORATIONS, defaults.decoration),
      showClock: incoming.showClock !== false,
      showCaptions: incoming.showCaptions !== false,
      nightDimming: incoming.nightDimming !== false,
      nightStart: util.formatClock(incoming.nightStart, defaults.nightStart),
      nightEnd: util.formatClock(incoming.nightEnd, defaults.nightEnd),
      burnInAvoidance: incoming.burnInAvoidance !== false,
      keepAwake: incoming.keepAwake !== false,
      filters: {
        peopleOnly: filters.peopleOnly === true,
        minRating: util.clamp(filters.minRating, 0, 5, 0),
        excludeTag: String(filters.excludeTag || '').trim().slice(0, 40),
        minShortEdge: util.clamp(filters.minShortEdge, 0, 8000, defaults.filters.minShortEdge),
        junk: {
          enabled: junk.enabled !== false,
          queries: asQueries(junk.queries),
          perQuery: util.clamp(junk.perQuery, 1, 200, defaults.filters.junk.perQuery)
        }
      },
      music: mergeMusic(incoming.music, defaults.music)
    };
  }

  function mergeMusic(value, defaults) {
    var src = value || {};
    return {
      enabled: src.enabled === true,
      source: pickEnum(src.source, MUSIC_SOURCES, defaults.source),
      volume: util.clamp(src.volume, 0, 100, defaults.volume),
      crossfadeMs: util.clamp(src.crossfadeMs, 0, 5000, defaults.crossfadeMs),
      navidrome: mergeServer(src.navidrome),
      jellyfin: mergeServer(src.jellyfin),
      radio: { streams: asStreams(src.radio && src.radio.streams) }
    };
  }

  function mergeServer(value) {
    var src = value || {};
    return {
      url: String(src.url || '').trim().replace(/\/+$/, ''),
      username: String(src.username || '').trim().slice(0, 80),
      password: String(src.password || ''),
      playlists: mergePlaylists(src.playlists)
    };
  }

  function mergePlaylists(value) {
    var src = value || {};
    var out = emptyPlaylists();
    for (var i = 0; i < PLAYLIST_SEASONS.length; i++) {
      out[PLAYLIST_SEASONS[i]] = String(src[PLAYLIST_SEASONS[i]] || '').trim();
    }
    return out;
  }

  function asStreams(value) {
    var source = Array.isArray(value) ? value : [];
    var out = [];
    for (var i = 0; i < source.length && out.length < 8; i++) {
      var row = source[i] || {};
      var season = STREAM_SEASONS.indexOf(row.season) === -1 ? 'any' : row.season;
      out.push({
        name: String(row.name || '').trim().slice(0, 40) || ('Stream ' + (out.length + 1)),
        url: String(row.url || '').trim().slice(0, 400),
        season: season
      });
    }
    if (!out.length) return musicDefaults().radio.streams;
    return out;
  }

  function redactSettings(settings) {
    var safe = copy(mergeSettings(settings));
    if (safe.apiKey) safe.apiKey = '***';
    if (safe.music && safe.music.navidrome && safe.music.navidrome.password) {
      safe.music.navidrome.password = '***';
    }
    if (safe.music && safe.music.jellyfin && safe.music.jellyfin.password) {
      safe.music.jellyfin.password = '***';
    }
    return safe;
  }

  function createSettingsStore(storage) {
    return {
      load: function () {
        try {
          var raw = storage.getItem(STORAGE_KEY);
          if (!raw) return mergeSettings(null);
          return mergeSettings(JSON.parse(raw));
        } catch (err) {
          return mergeSettings(null);
        }
      },
      save: function (settings) {
        var clean = mergeSettings(settings);
        storage.setItem(STORAGE_KEY, JSON.stringify(clean));
        return clean;
      }
    };
  }

  Alcove.LAYOUTS = LAYOUTS;
  Alcove.DECORATIONS = DECORATIONS;
  Alcove.MUSIC_SOURCES = MUSIC_SOURCES;
  Alcove.STREAM_SEASONS = STREAM_SEASONS;
  Alcove.DEFAULT_JUNK_QUERIES = DEFAULT_JUNK_QUERIES.slice();
  Alcove.defaultSettings = defaultSettings;
  Alcove.mergeSettings = mergeSettings;
  Alcove.inspectApiKey = inspectApiKey;
  Alcove.applyBuiltin = applyBuiltin;
  Alcove.redactSettings = redactSettings;
  function readPackagedConfig(done) {
    if (typeof XMLHttpRequest === 'undefined') {
      done(Alcove.builtinConfig || null);
      return;
    }
    var xhr = new XMLHttpRequest();
    try {
      xhr.open('GET', 'config.local.json', true);
    } catch (err) {
      done(Alcove.builtinConfig || null);
      return;
    }
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
        try {
          done(JSON.parse(xhr.responseText));
          return;
        } catch (err) {
          done(Alcove.builtinConfig || null);
          return;
        }
      }
      done(Alcove.builtinConfig || null);
    };
    xhr.onerror = function () { done(Alcove.builtinConfig || null); };
    xhr.send();
  }

  Alcove.createSettingsStore = createSettingsStore;
  Alcove.readPackagedConfig = readPackagedConfig;
})(typeof window !== 'undefined' ? window : globalThis);
