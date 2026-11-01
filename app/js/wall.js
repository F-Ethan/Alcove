(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function createWall(opts) {
    var rootEl = opts.rootEl;
    var tiles = [];
    var paused = false;
    var started = false;

    function settings() {
      return opts.getSettings();
    }

    function clearTimer(tile) {
      if (tile.timer) {
        clearTimeout(tile.timer);
        tile.timer = 0;
      }
    }

    function clearTimers() {
      for (var i = 0; i < tiles.length; i++) clearTimer(tiles[i]);
    }

    function applyMotion() {
      var current = settings();
      rootEl.classList.toggle('ken', !!current.kenBurns && !paused);
      rootEl.classList.toggle('paused', paused);
      rootEl.style.setProperty('--dwell', current.intervalSec + 's');
      rootEl.style.setProperty('--fade', (current.crossfadeMs || 0) + 'ms');
    }

    function releaseHeld(asset) {
      if (asset && opts.release) opts.release(asset);
    }

    function dropTile(tile) {
      clearTimer(tile);
      if (!tile.layerHeld) return;
      if (tile.layerHeld[0]) releaseHeld(tile.layerAssets[0]);
      if (tile.layerHeld[1]) releaseHeld(tile.layerAssets[1]);
      tile.layerHeld = [false, false];
      tile.layerAssets = [null, null];
    }

    function build(orientations) {
      for (var t = 0; t < tiles.length; t++) dropTile(tiles[t]);
      clearTimers();
      rootEl.innerHTML = '';
      tiles = [];
      var slots = Alcove.layouts.slotsFor(settings().layout, orientations || []);
      for (var i = 0; i < slots.length; i++) {
        var slot = slots[i];
        var el = document.createElement('div');
        el.className = 'tile' + (i % 2 ? ' kb-alt bow-right' : ' bow-left');
        el.style.left = slot.left + '%';
        el.style.top = slot.top + '%';
        el.style.width = slot.width + '%';
        el.style.height = slot.height + '%';
        var well = document.createElement('div');
        well.className = 'well';
        var front = document.createElement('img');
        var back = document.createElement('img');
        front.className = 'layer on';
        back.className = 'layer';
        front.alt = '';
        back.alt = '';
        var cap = document.createElement('p');
        cap.className = 'tile-cap';
        cap.hidden = true;
        well.appendChild(front);
        well.appendChild(back);
        well.appendChild(cap);
        var ribbonH = document.createElement('i');
        ribbonH.className = 'ribbon ribbon-h';
        var ribbonV = document.createElement('i');
        ribbonV.className = 'ribbon ribbon-v';
        var bow = document.createElement('i');
        bow.className = 'bow';
        var knot = document.createElement('i');
        knot.className = 'knot';
        bow.appendChild(knot);
        el.appendChild(well);
        el.appendChild(ribbonH);
        el.appendChild(ribbonV);
        el.appendChild(bow);
        rootEl.appendChild(el);
        tiles.push({
          el: el,
          layers: [front, back],
          front: 0,
          cap: cap,
          slot: slot,
          history: [],
          asset: null,
          seq: 0,
          timer: 0,
          primed: false,
          layerAssets: [null, null],
          layerHeld: [false, false]
        });
      }
      applyMotion();
    }

    function captionText(asset) {
      if (!settings().showCaptions || !asset) return '';
      if (asset.caption) return asset.caption;
      return '';
    }

    function reveal(tile, asset, url, pinned) {
      var incomingIndex = tile.front === 0 ? 1 : 0;
      var incoming = tile.layers[incomingIndex];
      var outgoing = tile.layers[tile.front];
      var fade = settings().crossfadeMs || 0;
      incoming.style.transitionDuration = fade + 'ms';
      outgoing.style.transitionDuration = fade + 'ms';
      var text = captionText(asset);
      function finish() {
        var previous = tile.layerAssets[incomingIndex];
        var previousHeld = tile.layerHeld[incomingIndex];
        tile.layerAssets[incomingIndex] = asset;
        tile.layerHeld[incomingIndex] = !!pinned;
        if (previousHeld) releaseHeld(previous);
        incoming.classList.add('on');
        outgoing.classList.remove('on');
        tile.front = incomingIndex;
        tile.cap.textContent = text;
        tile.cap.hidden = !text;
        if (opts.onShown) opts.onShown(asset);
      }
      if (!url) {
        finish();
        return;
      }
      var done = false;
      function once() {
        if (done) return;
        done = true;
        finish();
      }
      incoming.onload = once;
      incoming.onerror = function () {
        if (done) return;
        done = true;
        if (pinned) releaseHeld(asset);
        if (opts.onImageError) opts.onImageError(asset);
      };
      incoming.src = url;
      if (incoming.complete && incoming.naturalWidth) once();
    }

    function showAsset(tile, asset, pushHistory) {
      if (!asset) return;
      var seq = ++tile.seq;
      var request = opts.imageUrl ? opts.imageUrl(asset) : Promise.resolve('');
      Promise.resolve(request).then(function (result) {
        var url = result && typeof result === 'object' && result.url != null ? result.url : result;
        var pinned = !!(result && typeof result === 'object' && result.pinned);
        if (seq !== tile.seq) {
          if (pinned) releaseHeld(asset);
          return;
        }
        if (pushHistory && tile.asset) {
          tile.history.push(tile.asset);
          if (tile.history.length > 12) tile.history.shift();
        }
        tile.asset = asset;
        reveal(tile, asset, url, pinned);
      }).catch(function () {
        if (opts.onImageError) opts.onImageError(asset);
      });
    }

    function advance(tile, pushHistory) {
      if (!opts.requestNext) return;
      var asset = opts.requestNext(tile.slot.prefer);
      showAsset(tile, asset, pushHistory !== false);
    }

    function schedule(tile, index, first) {
      clearTimer(tile);
      if (paused) return;
      var count = tiles.length;
      var interval = settings().intervalSec * 1000;
      var wait = first && !tile.primed
        ? Alcove.layouts.initialDelay(index, count, interval)
        : interval;
      tile.timer = setTimeout(function () {
        tile.primed = true;
        advance(tile, true);
        schedule(tile, index, false);
      }, wait);
    }

    function arm(first) {
      for (var i = 0; i < tiles.length; i++) {
        if (!tiles[i].asset) advance(tiles[i], false);
        schedule(tiles[i], i, first);
      }
    }

    function start() {
      var orientations = opts.orientations ? opts.orientations() : [];
      build(orientations);
      started = true;
      paused = false;
      arm(true);
    }

    function restart() {
      if (!started) return;
      start();
    }

    function pause() {
      paused = true;
      clearTimers();
      applyMotion();
    }

    function resume() {
      if (!paused) return;
      paused = false;
      applyMotion();
      for (var i = 0; i < tiles.length; i++) schedule(tiles[i], i, false);
    }

    function togglePause() {
      if (paused) resume();
      else pause();
      return paused;
    }

    function skip(direction) {
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        clearTimer(tile);
        if (direction < 0 && tile.history.length) {
          var previous = tile.history.pop();
          showAsset(tile, previous, false);
        } else {
          advance(tile, true);
        }
        schedule(tile, i, false);
      }
    }

    return {
      start: start,
      restart: restart,
      pause: pause,
      resume: resume,
      togglePause: togglePause,
      skip: skip,
      isPaused: function () { return paused; },
      tileCount: function () { return tiles.length; }
    };
  }

  Alcove.createWall = createWall;
})(typeof window !== 'undefined' ? window : globalThis);
