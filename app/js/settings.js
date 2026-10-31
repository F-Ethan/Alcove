(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var util = Alcove.util;

  var LAYOUTS = ['single', 'two', 'three', 'four', 'mixed'];
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
      filters: {
        peopleOnly: false,
        minRating: 0,
        excludeTag: '',
        minShortEdge: 720,
        junk: junkDefaults()
      }
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

  function mergeSettings(saved) {
    var defaults = defaultSettings();
    var incoming = saved && typeof saved === 'object' ? saved : {};
    var sources = incoming.sources || {};
    var filters = incoming.filters || {};
    var junk = filters.junk || {};
    return {
      serverUrl: String(incoming.serverUrl || '').trim().replace(/\/+$/, ''),
      apiKey: String(incoming.apiKey || '').trim(),
      sources: {
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
      }
    };
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
  Alcove.DEFAULT_JUNK_QUERIES = DEFAULT_JUNK_QUERIES.slice();
  Alcove.defaultSettings = defaultSettings;
  Alcove.mergeSettings = mergeSettings;
  Alcove.redactSettings = redactSettings;
  Alcove.createSettingsStore = createSettingsStore;
})(typeof window !== 'undefined' ? window : globalThis);
