(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function shuffle(items, rng) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function createPlaylist(items, options) {
    var list = (items || []).slice();
    var rng = options && options.rng ? options.rng : Math.random;
    var windowSize = options && options.recentWindow != null ? options.recentWindow : 8;
    var recent = [];
    var bag = [];

    function recentLimit() {
      return Math.min(windowSize, Math.max(0, list.length - 1));
    }

    function remember(asset) {
      var limit = recentLimit();
      recent.push(asset.id);
      while (recent.length > limit) recent.shift();
    }

    function refill() {
      bag = shuffle(list, rng);
    }

    function pull(accept) {
      if (!list.length) return null;
      if (!bag.length) refill();
      var scans = 0;
      while (scans < bag.length) {
        if (accept(bag[0])) {
          var picked = bag.shift();
          remember(picked);
          return picked;
        }
        bag.push(bag.shift());
        scans += 1;
      }
      return null;
    }

    function isFresh(asset) {
      var limit = recentLimit();
      if (limit === 0) return true;
      return recent.indexOf(asset.id) === -1;
    }

    function shapeOk(asset, prefer) {
      if (!prefer || prefer === 'any') return true;
      var shape = Alcove.layouts.orientationOf(asset);
      return shape === 'unknown' || shape === 'square' || shape === prefer;
    }

    function next(prefer) {
      var picked = pull(function (asset) { return isFresh(asset) && shapeOk(asset, prefer); });
      if (picked) return picked;
      picked = pull(isFresh);
      if (picked) return picked;
      picked = pull(function (asset) { return shapeOk(asset, prefer); });
      if (picked) return picked;
      return pull(function () { return true; });
    }

    return {
      next: next,
      replace: function (nextItems) {
        list = (nextItems || []).slice();
        bag = [];
        recent = [];
      },
      size: function () { return list.length; },
      recentIds: function () { return recent.slice(); }
    };
  }

  Alcove.shuffle = shuffle;
  Alcove.createPlaylist = createPlaylist;
})(typeof window !== 'undefined' ? window : globalThis);
