(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function swapEvery(displaySec, count) {
    var seconds = displaySec > 0 ? displaySec : 45;
    var slots = count > 0 ? count : 1;
    if (slots <= 1) return Math.round(seconds * 1000);
    return Math.round(seconds * 1000 / slots);
  }

  function seedShownAt(count, displaySec, now) {
    var step = swapEvery(displaySec, count);
    var slots = count > 0 ? count : 1;
    var times = [];
    for (var i = 0; i < slots; i++) times.push(now - (slots - 1 - i) * step);
    return { step: step, times: times };
  }

  function oldest(slots) {
    var best = null;
    var list = slots || [];
    for (var i = 0; i < list.length; i++) {
      var slot = list[i];
      if (!slot || slot.busy) continue;
      if (!best || slot.shownAt < best.shownAt || (slot.shownAt === best.shownAt && slot.index < best.index)) {
        best = slot;
      }
    }
    return best;
  }

  function slideDirection(slot) {
    var left = slot.left + slot.width / 2;
    var top = slot.top + slot.height / 2;
    var edges = [
      { name: 'left', distance: left },
      { name: 'right', distance: 100 - left },
      { name: 'up', distance: top },
      { name: 'down', distance: 100 - top }
    ];
    var nearest = edges[0];
    for (var i = 1; i < edges.length; i++) {
      if (edges[i].distance < nearest.distance) nearest = edges[i];
    }
    return nearest.name;
  }

  function nextArrangement(current, names) {
    var list = names && names.length ? names : ['left'];
    var index = list.indexOf(current);
    if (index < 0) return list[0];
    return list[(index + 1) % list.length];
  }

  Alcove.schedule = {
    swapEvery: swapEvery,
    seedShownAt: seedShownAt,
    oldest: oldest,
    slideDirection: slideDirection,
    nextArrangement: nextArrangement
  };
})(typeof window !== 'undefined' ? window : globalThis);
