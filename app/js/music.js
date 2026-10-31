(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var SEASONS = ['christmas', 'winter', 'fall', 'spring', 'summer', 'none'];

  function playlistIdFor(playlists, season) {
    var map = playlists || {};
    if (map[season]) return String(map[season]);
    if (season !== 'none' && map.none) return String(map.none);
    return '';
  }

  function radioChoice(streams, season, rng) {
    var exact = [];
    var fallback = [];
    var list = streams || [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (!row || !row.url) continue;
      if (row.season === season) exact.push(row);
      else if (!row.season || row.season === 'any') fallback.push(row);
    }
    var pool = exact.length ? exact : fallback;
    if (!pool.length) return null;
    var roll = rng ? rng() : Math.random();
    var index = Math.floor(roll * pool.length);
    if (index >= pool.length) index = pool.length - 1;
    return pool[index];
  }

  function outputVolume(volumePercent, night, muted) {
    if (muted) return 0;
    var amount = Number(volumePercent);
    if (!isFinite(amount)) amount = 0;
    if (amount < 0) amount = 0;
    if (amount > 100) amount = 100;
    var level = amount / 100;
    if (night) level *= 0.35;
    return level;
  }

  function createPlayer(options) {
    var primary = options.audioA;
    var secondary = options.audioB;
    var current = primary;
    var idle = secondary;
    var volume = 40;
    var night = false;
    var muted = false;
    var crossfadeMs = 1500;
    var tracks = [];
    var index = 0;
    var mode = 'idle';
    var streamUrl = '';
    var failures = 0;
    var fadeTimer = 0;
    var generation = 0;

    function level() {
      return outputVolume(volume, night, muted);
    }

    function applyLevel() {
      if (current) current.volume = level();
    }

    function clear(el) {
      if (!el) return;
      el.pause();
      el.removeAttribute('src');
      try { el.load(); } catch (err) { /* Some TVs throw if load runs with no source. */ }
    }

    function stopFade() {
      if (fadeTimer) {
        clearInterval(fadeTimer);
        fadeTimer = 0;
      }
    }

    function arm(el, url) {
      el.src = url;
      var pending = el.play();
      if (pending && pending.catch) pending.catch(function () {});
    }

    function swapIn(url) {
      var token = ++generation;
      stopFade();
      var target = level();
      if (!current || !idle || crossfadeMs <= 0 || !current.src) {
        if (current && current !== idle) clear(idle);
        current = primary;
        idle = secondary;
        if (current) {
          current.volume = target;
          arm(current, url);
        }
        return;
      }
      idle.volume = 0;
      arm(idle, url);
      var started = Date.now();
      fadeTimer = setInterval(function () {
        if (token !== generation) return;
        var t = (Date.now() - started) / crossfadeMs;
        if (t > 1) t = 1;
        idle.volume = target * t;
        current.volume = target * (1 - t);
        if (t >= 1) {
          stopFade();
          clear(current);
          var previous = current;
          current = idle;
          idle = previous;
          current.volume = level();
        }
      }, 50);
    }

    function playIndex(nextIndex, hops) {
      if (!tracks.length) return;
      if ((hops || 0) >= tracks.length) return;
      index = ((nextIndex % tracks.length) + tracks.length) % tracks.length;
      var track = tracks[index];
      if (!track || !track.url) {
        playIndex(index + 1, (hops || 0) + 1);
        return;
      }
      swapIn(track.url);
    }

    function recover() {
      failures += 1;
      var wait = Alcove.retryDelay ? Alcove.retryDelay(failures - 1, 700, 8000, Math.random) : 700;
      setTimeout(function () {
        if (failures > 2) {
          failures = 0;
          if (mode === 'tracks') playIndex(index + 1);
          else if (mode === 'stream' && streamUrl) swapIn(streamUrl);
          return;
        }
        if (mode === 'stream' && streamUrl) swapIn(streamUrl);
        else playIndex(index);
      }, wait);
    }

    function onEnded(el) {
      if (el !== current) return;
      failures = 0;
      if (mode === 'tracks') playIndex(index + 1);
      else if (mode === 'stream' && streamUrl) swapIn(streamUrl);
    }

    function onError(el) {
      if (el !== current) return;
      recover();
    }

    if (primary) {
      primary.addEventListener('ended', function () { onEnded(primary); });
      primary.addEventListener('error', function () { onError(primary); });
    }
    if (secondary) {
      secondary.addEventListener('ended', function () { onEnded(secondary); });
      secondary.addEventListener('error', function () { onError(secondary); });
    }

    return {
      setVolume: function (value) {
        volume = value;
        applyLevel();
      },
      setNight: function (value) {
        night = !!value;
        applyLevel();
      },
      setCrossfade: function (value) {
        crossfadeMs = value > 0 ? value : 0;
      },
      toggleMute: function () {
        muted = !muted;
        applyLevel();
        return muted;
      },
      isMuted: function () { return muted; },
      playTracks: function (list) {
        mode = 'tracks';
        streamUrl = '';
        failures = 0;
        tracks = (list || []).slice();
        if (!tracks.length) {
          this.stop();
          return;
        }
        playIndex(0);
      },
      playStream: function (url) {
        mode = 'stream';
        tracks = [];
        failures = 0;
        streamUrl = url || '';
        if (!streamUrl) {
          this.stop();
          return;
        }
        swapIn(streamUrl);
      },
      stop: function () {
        mode = 'idle';
        tracks = [];
        streamUrl = '';
        generation += 1;
        stopFade();
        clear(primary);
        clear(secondary);
        current = primary;
        idle = secondary;
      },
      resume: function () {
        if (current && current.src) {
          var pending = current.play();
          if (pending && pending.catch) pending.catch(function () {});
        }
      }
    };
  }

  Alcove.MUSIC_SEASONS = SEASONS;
  Alcove.musicPlan = {
    playlistIdFor: playlistIdFor,
    radioChoice: radioChoice,
    outputVolume: outputVolume
  };
  Alcove.createPlayer = createPlayer;
})(typeof window !== 'undefined' ? window : globalThis);
