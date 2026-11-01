(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var DIRS = ['left', 'right', 'up', 'down'];
  var OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

  function createWall(opts) {
    var rootEl = opts.rootEl;
    var slots = [];
    var paused = false;
    var started = false;
    var arrangement = 'left';
    var swapTimer = 0;
    var layoutTimer = 0;
    var generation = 0;
    var queue = Alcove.preload.createPreloadQueue({
      limit: 8,
      load: loadAsset,
      revoke: function (asset, result) {
        if (result && result.pinned) releaseHeld(asset);
      }
    });

    function settings() {
      return opts.getSettings();
    }

    function slideMs() {
      var ms = Number(settings().crossfadeMs);
      if (!isFinite(ms)) return 750;
      if (ms < 600) return 600;
      if (ms > 900) return 900;
      return ms;
    }

    function displaySec() {
      var seconds = Number(settings().intervalSec);
      return seconds > 0 ? seconds : 45;
    }

    function releaseHeld(asset) {
      if (asset && opts.release) opts.release(asset);
    }

    function unpack(result) {
      if (result && typeof result === 'object' && result.url != null) {
        return { url: result.url || '', pinned: !!result.pinned };
      }
      return { url: result || '', pinned: false };
    }

    function loadAsset(asset) {
      var request = opts.imageUrl ? opts.imageUrl(asset) : Promise.resolve('');
      return Promise.resolve(request).then(function (result) {
        var packed = unpack(result);
        if (!packed.url) {
          if (packed.pinned) releaseHeld(asset);
          return Promise.reject(new Error('empty'));
        }
        return Alcove.preload.decode(packed.url, opts.Image).then(function (info) {
          return {
            url: packed.url,
            pinned: packed.pinned,
            width: info.width || 0,
            height: info.height || 0
          };
        }, function (error) {
          if (packed.pinned) releaseHeld(asset);
          throw error;
        });
      });
    }

    function applyMotion() {
      var current = settings();
      rootEl.classList.toggle('ken', !!current.kenBurns && !paused);
      rootEl.classList.toggle('paused', paused);
      rootEl.style.setProperty('--dwell', displaySec() + 's');
      rootEl.style.setProperty('--slide', slideMs() + 'ms');
    }

    function clearSwap() {
      if (swapTimer) clearTimeout(swapTimer);
      swapTimer = 0;
    }

    function clearLayout() {
      if (layoutTimer) clearTimeout(layoutTimer);
      layoutTimer = 0;
    }

    function makePrint(index) {
      var el = document.createElement('div');
      el.className = 'print idle' + (index % 2 ? ' kb-alt bow-right' : ' bow-left');
      var well = document.createElement('div');
      well.className = 'well';
      var img = document.createElement('img');
      img.className = 'layer';
      img.alt = '';
      var cap = document.createElement('p');
      cap.className = 'tile-cap';
      cap.hidden = true;
      well.appendChild(img);
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
      return { el: el, img: img, cap: cap };
    }

    function placeSlot(el, frame) {
      el.style.left = frame.left + '%';
      el.style.top = frame.top + '%';
      el.style.width = frame.width + '%';
      el.style.height = frame.height + '%';
    }

    function layoutPrint(print, anchor, aspect) {
      var fitted = Alcove.layouts.fitInBox(anchor, aspect);
      print.el.style.left = ((fitted.left - anchor.left) / anchor.width) * 100 + '%';
      print.el.style.top = ((fitted.top - anchor.top) / anchor.height) * 100 + '%';
      print.el.style.width = (fitted.width / anchor.width) * 100 + '%';
      print.el.style.height = (fitted.height / anchor.height) * 100 + '%';
    }

    function dropSlot(slot) {
      if (!slot) return;
      if (slot.pending) {
        queue.forget(slot.pending.id);
        slot.pending = null;
      }
      for (var i = 0; i < slot.held.length; i++) {
        if (slot.held[i] && slot.held[i].pinned) releaseHeld(slot.held[i].asset);
        slot.held[i] = null;
      }
    }

    function framesFor(name) {
      if (settings().layout === 'mixed') return Alcove.layouts.arrangement(name || arrangement);
      return Alcove.layouts.slotsFor(settings().layout);
    }

    function build(name) {
      generation += 1;
      for (var s = 0; s < slots.length; s++) dropSlot(slots[s]);
      rootEl.innerHTML = '';
      slots = [];
      var frames = framesFor(name);
      for (var i = 0; i < frames.length; i++) {
        var frame = frames[i];
        var el = document.createElement('div');
        el.className = 'slot';
        placeSlot(el, frame);
        var front = makePrint(i);
        var back = makePrint(i);
        el.appendChild(front.el);
        el.appendChild(back.el);
        rootEl.appendChild(el);
        slots.push({
          index: i,
          el: el,
          prints: [front, back],
          front: 0,
          anchor: frame,
          prefer: frame.prefer || 'any',
          role: frame.role || '',
          asset: null,
          held: [null, null],
          shownAt: 0,
          history: [],
          aspect: 0,
          busy: false,
          pending: null
        });
      }
      applyMotion();
    }

    function captionText(asset) {
      if (!settings().showCaptions || !asset) return '';
      return asset.caption || '';
    }

    function aspectFor(asset, ready) {
      var aspect = Alcove.layouts.aspectOf(asset);
      if (ready && ready.width && ready.height) {
        var natural = ready.width / ready.height;
        if (!aspect || Math.abs(natural - aspect) / natural > 0.03) aspect = natural;
      }
      return aspect;
    }

    function clearMotion(print) {
      for (var i = 0; i < DIRS.length; i++) {
        print.el.classList.remove('from-' + DIRS[i], 'to-' + DIRS[i]);
      }
    }

    function paint(slot, asset, ready, slide) {
      var incomingIndex = slot.front === 0 ? 1 : 0;
      var incoming = slot.prints[incomingIndex];
      var outgoing = slot.prints[slot.front];
      var aspect = aspectFor(asset, ready);
      if (aspect) slot.aspect = aspect;
      var text = captionText(asset);
      incoming.cap.textContent = text;
      incoming.cap.hidden = !text;
      incoming.el.style.transition = 'none';
      layoutPrint(incoming, slot.anchor, slot.aspect);
      incoming.img.src = ready.url;
      var dir = Alcove.schedule.slideDirection(slot.anchor);
      var token = generation;
      function finish() {
        if (token !== generation) return;
        var previous = slot.held[incomingIndex];
        if (previous && previous.pinned) releaseHeld(previous.asset);
        slot.held[incomingIndex] = { asset: asset, pinned: !!ready.pinned };
        slot.front = incomingIndex;
        slot.asset = asset;
        if (opts.onShown) opts.onShown(asset);
      }
      if (!slide) {
        clearMotion(incoming);
        incoming.el.classList.add('show');
        incoming.el.classList.remove('idle');
        finish();
        return Promise.resolve();
      }
      clearMotion(incoming);
      incoming.el.classList.add('from-' + OPPOSITE[dir]);
      incoming.el.classList.remove('idle');
      var ms = slideMs();
      return new Promise(function (resolve) {
        var settled = false;
        function done() {
          if (settled) return;
          settled = true;
          if (token === generation) {
            outgoing.img.removeAttribute('src');
            clearMotion(outgoing);
            outgoing.el.classList.remove('show');
            outgoing.el.classList.add('idle');
            var gone = slot.held[slot.front];
            if (gone && gone.pinned) releaseHeld(gone.asset);
            slot.held[slot.front] = null;
            finish();
          }
          resolve();
        }
        frame(function () {
          frame(function () {
            if (token !== generation) {
              resolve();
              return;
            }
            incoming.el.style.transition = '';
            incoming.el.style.transitionDuration = ms + 'ms';
            outgoing.el.style.transitionDuration = ms + 'ms';
            incoming.el.classList.remove('from-' + OPPOSITE[dir]);
            incoming.el.classList.add('show');
            outgoing.el.classList.remove('show');
            outgoing.el.classList.add('to-' + dir);
            root.setTimeout(done, ms + 60);
          });
        });
      });
    }

    function pullAsset(prefer, tries) {
      if (tries > 8) return Promise.resolve(null);
      var asset = opts.requestNext ? opts.requestNext(prefer) : null;
      if (!asset) return Promise.resolve(null);
      return queue.request(asset).then(function (ready) {
        return { asset: asset, ready: queue.claim(asset.id) || ready };
      }).catch(function () {
        queue.forget(asset.id);
        if (opts.onImageError) opts.onImageError(asset);
        return pullAsset(prefer, tries + 1);
      });
    }

    function takeNext(slot, tries) {
      if (tries > 8) return Promise.resolve(null);
      if (slot.pending) {
        var asset = slot.pending;
        slot.pending = null;
        if (queue.ready(asset.id)) {
          return Promise.resolve({ asset: asset, ready: queue.claim(asset.id) });
        }
        return queue.request(asset).then(function (ready) {
          return { asset: asset, ready: queue.claim(asset.id) || ready };
        }).catch(function () {
          queue.forget(asset.id);
          if (opts.onImageError) opts.onImageError(asset);
          return takeNext(slot, tries + 1);
        });
      }
      return pullAsset(slot.prefer, tries);
    }

    function ensurePending(slot) {
      if (!slot || slot.pending || !opts.requestNext) return;
      var asset = opts.requestNext(slot.prefer);
      if (!asset) return;
      slot.pending = asset;
      queue.request(asset).catch(function () {
        queue.forget(asset.id);
        if (slot.pending && slot.pending.id === asset.id) slot.pending = null;
      });
    }

    function keepIds() {
      var ids = [];
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].pending) ids.push(slots[i].pending.id);
      }
      queue.retain(ids);
    }

    function stampTimes() {
      var seeded = Alcove.schedule.seedShownAt(slots.length, displaySec(), Date.now());
      for (var i = 0; i < slots.length; i++) slots[i].shownAt = seeded.times[i];
    }

    function fillAll() {
      var index = 0;
      function step() {
        if (index >= slots.length) return Promise.resolve();
        var slot = slots[index];
        index += 1;
        return pullAsset(slot.prefer, 0).then(function (picked) {
          if (picked) return paint(slot, picked.asset, picked.ready, false);
          return null;
        }).then(step);
      }
      return step();
    }

    function armSwap() {
      clearSwap();
      if (paused || !started || !slots.length) return;
      var wait = Alcove.schedule.swapEvery(displaySec(), slots.length);
      var token = generation;
      swapTimer = root.setTimeout(function () {
        if (token !== generation || paused) return;
        swapOldest().then(function () {
          if (token === generation) armSwap();
        });
      }, wait);
    }

    function swapOldest() {
      var slot = Alcove.schedule.oldest(slots);
      if (!slot) return Promise.resolve();
      slot.busy = true;
      return takeNext(slot, 0).then(function (picked) {
        if (!picked) return null;
        if (slot.asset) {
          slot.history.push(slot.asset);
          if (slot.history.length > 12) slot.history.shift();
        }
        return paint(slot, picked.asset, picked.ready, true).then(function () {
          slot.shownAt = Date.now();
        });
      }).then(function () {
        slot.busy = false;
        ensurePending(slot);
        keepIds();
      }, function () {
        slot.busy = false;
      });
    }

    function armLayout() {
      clearLayout();
      if (paused || !started || settings().layout !== 'mixed') return;
      var wait = (Number(settings().arrangementSec) > 0 ? Number(settings().arrangementSec) : 600) * 1000;
      var token = generation;
      layoutTimer = root.setTimeout(function () {
        if (token !== generation || paused) return;
        rotateArrangement();
      }, wait);
    }

    function rotateArrangement() {
      if (settings().layout !== 'mixed') {
        armLayout();
        return Promise.resolve();
      }
      for (var b = 0; b < slots.length; b++) {
        if (slots[b].busy) {
          layoutTimer = root.setTimeout(rotateArrangement, 2000);
          return Promise.resolve();
        }
      }
      clearSwap();
      var names = Alcove.layouts.ARRANGEMENT_NAMES;
      var nextName = Alcove.schedule.nextArrangement(arrangement, names);
      var frames = Alcove.layouts.arrangement(nextName);
      var picks = [];
      var index = 0;
      function pullOne() {
        if (index >= frames.length) return Promise.resolve();
        var prefer = frames[index].prefer;
        index += 1;
        return pullAsset(prefer, 0).then(function (picked) {
          picks.push(picked);
          return pullOne();
        });
      }
      var token = generation;
      return pullOne().then(function () {
        if (token !== generation) return null;
        rootEl.classList.add('swap-out');
        return wait(slideMs());
      }).then(function () {
        if (token !== generation) {
          rootEl.classList.remove('swap-out');
          return null;
        }
        arrangement = nextName;
        build(arrangement);
        var built = generation;
        var chain = Promise.resolve();
        for (var i = 0; i < slots.length; i++) {
          chain = chain.then(showPicked(i, built));
        }
        return chain.then(function () { return built; });
      }).then(function (built) {
        if (!built || generation !== built) return null;
        rootEl.classList.remove('swap-out');
        stampTimes();
        for (var i = 0; i < slots.length; i++) ensurePending(slots[i]);
        keepIds();
        armSwap();
        armLayout();
        return null;
      });

      function showPicked(i, built) {
        return function () {
          if (generation !== built || !picks[i] || !slots[i]) return null;
          return paint(slots[i], picks[i].asset, picks[i].ready, false);
        };
      }
    }

    function frame(fn) {
      if (root.requestAnimationFrame) return root.requestAnimationFrame(fn);
      return root.setTimeout(fn, 16);
    }

    function wait(ms) {
      return new Promise(function (resolve) {
        root.setTimeout(resolve, ms);
      });
    }

    function bootSlots() {
      build(arrangement);
      return fillAll().then(function () {
        stampTimes();
        for (var i = 0; i < slots.length; i++) ensurePending(slots[i]);
        keepIds();
        armSwap();
        armLayout();
      });
    }

    function start() {
      clearSwap();
      clearLayout();
      rootEl.classList.remove('swap-out');
      started = true;
      paused = false;
      arrangement = 'left';
      bootSlots();
    }

    function restart() {
      if (!started) return;
      start();
    }

    function pause() {
      paused = true;
      clearSwap();
      clearLayout();
      applyMotion();
    }

    function resume() {
      if (!paused) return;
      paused = false;
      applyMotion();
      armSwap();
      armLayout();
    }

    function togglePause() {
      if (paused) resume();
      else pause();
      return paused;
    }

    function skip(direction) {
      clearSwap();
      if (direction < 0) {
        var slot = Alcove.schedule.oldest(slots);
        var best = null;
        for (var i = 0; i < slots.length; i++) {
          if (!slots[i].history.length) continue;
          if (!best || slots[i].shownAt > best.shownAt) best = slots[i];
        }
        slot = best || slot;
        if (slot && slot.history.length && !slot.busy) {
          var previous = slot.history.pop();
          slot.busy = true;
          pullInto(slot, previous).then(function () {
            slot.busy = false;
            armSwap();
          });
          return;
        }
      }
      swapOldest().then(armSwap);
    }

    function pullInto(slot, asset) {
      return queue.request(asset).then(function (ready) {
        var claimed = queue.claim(asset.id) || ready;
        return paint(slot, asset, claimed, true).then(function () {
          slot.shownAt = Date.now();
        });
      }).catch(function () {
        queue.forget(asset.id);
        slot.history.push(asset);
      });
    }

    return {
      start: start,
      restart: restart,
      pause: pause,
      resume: resume,
      togglePause: togglePause,
      skip: skip,
      isPaused: function () { return paused; },
      tileCount: function () { return slots.length; }
    };
  }

  Alcove.createWall = createWall;
})(typeof window !== 'undefined' ? window : globalThis);
