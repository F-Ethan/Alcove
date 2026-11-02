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
      limit: 3,
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

    function makePhoto() {
      var img = document.createElement('img');
      img.className = 'photo idle';
      img.alt = '';
      return { el: img, img: img };
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

    function sceneNames() {
      if (!Alcove.scenes) return [arrangement];
      var decor = 'none';
      if (Alcove.util && Alcove.util.activeDecoration) {
        decor = Alcove.util.activeDecoration(settings().decoration, new Date());
      }
      var names = Alcove.scenes.activeIds(settings().scenes, decor);
      return names.length ? names : Alcove.scenes.seasonalIds(decor);
    }

    function framesFor(name) {
      if (Alcove.scenes && Alcove.scenes.get(name)) return Alcove.scenes.get(name).slots;
      if (settings().layout === 'mixed') return Alcove.layouts.arrangement(name || arrangement);
      return Alcove.layouts.slotsFor(settings().layout);
    }

    function placeWindow(win, frame) {
      win.style.top = (frame.padTop || 0) + '%';
      win.style.right = (frame.padRight || 0) + '%';
      win.style.bottom = (frame.padBottom || 0) + '%';
      win.style.left = (frame.padLeft || 0) + '%';
    }

    function build(name) {
      generation += 1;
      for (var s = 0; s < slots.length; s++) dropSlot(slots[s]);
      rootEl.innerHTML = '';
      slots = [];
      var scene = Alcove.scenes ? Alcove.scenes.get(name) : null;
      var frames = framesFor(name);
      for (var i = 0; i < frames.length; i++) {
        var frame = frames[i];
        var el = document.createElement('div');
        el.className = 'slot frame-' + (frame.frameStyle || 'plain');
        placeSlot(el, frame);
        if (frame.rotation) {
          el.style.transform = 'rotate(' + frame.rotation + 'deg)';
          el.style.transformOrigin = (frame.originX || 50) + '% ' + (frame.originY || 50) + '%';
        }
        var win = document.createElement('div');
        win.className = 'window';
        placeWindow(win, frame);
        var front = makePhoto();
        var back = makePhoto();
        var cap = document.createElement('p');
        cap.className = 'tile-cap';
        cap.hidden = true;
        win.appendChild(front.el);
        win.appendChild(back.el);
        win.appendChild(cap);
        el.appendChild(win);
        if (frame.frameStyle === 'polaroid') {
          var pin = document.createElement('i');
          pin.className = 'pin';
          el.appendChild(pin);
        }
        if (frame.frameStyle === 'tape') {
          var tape = document.createElement('i');
          tape.className = 'tape';
          el.appendChild(tape);
        }
        rootEl.appendChild(el);
        front.cap = cap;
        back.cap = cap;
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
          aspect: frame.aspect || 0,
          busy: false,
          pending: null
        });
      }
      applyMotion();
      if (scene && opts.onScene) opts.onScene(scene);
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
      var focus = Alcove.scenes ? Alcove.scenes.focusPosition(asset) : { x: 50, y: 50 };
      incoming.img.style.objectPosition = focus.x + '% ' + focus.y + '%';
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
      incoming.el.classList.add('sliding');
      incoming.el.classList.remove('idle');
      outgoing.el.classList.add('sliding');
      var ms = slideMs();
      return new Promise(function (resolve) {
        var settled = false;
        function done() {
          if (settled) return;
          settled = true;
          if (token === generation) {
            outgoing.img.removeAttribute('src');
            outgoing.img.src = '';
            clearMotion(outgoing);
            outgoing.el.classList.remove('show', 'sliding');
            outgoing.el.classList.add('idle');
            incoming.el.classList.remove('sliding');
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

    function tagEdge(asset, slot) {
      if (asset && slot && slot.anchor && slot.anchor.slotEdge) asset.slotEdge = slot.anchor.slotEdge;
      return asset;
    }

    function pullAsset(prefer, tries, slot) {
      if (tries > 8) return Promise.resolve(null);
      var asset = opts.requestNext ? opts.requestNext(prefer) : null;
      if (!asset) return Promise.resolve(null);
      tagEdge(asset, slot);
      return queue.request(asset).then(function (ready) {
        return { asset: asset, ready: queue.claim(asset.id) || ready };
      }).catch(function () {
        queue.forget(asset.id);
        if (opts.onImageError) opts.onImageError(asset);
        return pullAsset(prefer, tries + 1, slot);
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
      return pullAsset(slot.prefer, tries, slot);
    }

    function pendingCount() {
      var count = 0;
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].pending) count += 1;
      }
      return count;
    }

    function ensurePending(slot) {
      if (!slot || slot.pending || !opts.requestNext) return;
      if (pendingCount() >= 3) return;
      var asset = opts.requestNext(slot.prefer);
      if (!asset) return;
      tagEdge(asset, slot);
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
      if (paused || !started) return;
      var wait = (Number(settings().arrangementSec) > 0 ? Number(settings().arrangementSec) : 600) * 1000;
      var token = generation;
      layoutTimer = root.setTimeout(function () {
        if (token !== generation || paused) return;
        rotateArrangement();
      }, wait);
    }

    function rotateArrangement() {
      if (!sceneNames().length) {
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
      var names = sceneNames();
      var nextName = Alcove.schedule.nextArrangement(arrangement, names);
      var frames = framesFor(nextName);
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
      var names = sceneNames();
      arrangement = names[0] || '01_collage_full';
      var sceneQuery = root.location && String(root.location.search || '').match(/[?&]scene=([a-z0-9_]+)/);
      if (sceneQuery && Alcove.scenes && Alcove.scenes.get(sceneQuery[1])) arrangement = sceneQuery[1];
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
