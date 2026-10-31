(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function tagText(tag) {
    return {
      name: String(tag && tag.name || '').toLowerCase(),
      value: String(tag && tag.value || '').toLowerCase()
    };
  }

  function hasTag(asset, wanted) {
    var needle = String(wanted || '').trim().toLowerCase();
    if (!needle || !asset) return false;
    var tags = asset.tags || [];
    for (var i = 0; i < tags.length; i++) {
      var text = tagText(tags[i]);
      if (text.name === needle || text.value === needle) return true;
      var mark = '/' + needle;
      if (text.value.length > mark.length && text.value.slice(-mark.length) === mark) return true;
    }
    return false;
  }

  function isScreenshot(asset) {
    var name = String(asset.originalFileName || '').toLowerCase();
    var path = String(asset.originalPath || '').toLowerCase();
    if (name.indexOf('screenshot') !== -1 || path.indexOf('screenshot') !== -1) return true;
    if (name.indexOf('screen shot') !== -1 || path.indexOf('screen shot') !== -1) return true;
    return hasTag(asset, 'screenshot');
  }

  function shortEdge(asset) {
    if (!asset.width || !asset.height) return 0;
    return asset.width < asset.height ? asset.width : asset.height;
  }

  function isExcluded(excludeIds, id) {
    if (!excludeIds) return false;
    if (typeof excludeIds.has === 'function') return excludeIds.has(id);
    return !!excludeIds[id];
  }

  function keep(asset, settings, excludeIds) {
    if (!Alcove.basicKeep(asset)) return false;
    if (isScreenshot(asset)) return false;
    var filters = settings && settings.filters ? settings.filters : {};
    if (filters.peopleOnly && Array.isArray(asset.people) && asset.people.length === 0) return false;
    var edge = shortEdge(asset);
    if (filters.minShortEdge && edge && edge < filters.minShortEdge) return false;
    if (filters.minRating && !(asset.rating >= filters.minRating)) return false;
    if (filters.excludeTag && hasTag(asset, filters.excludeTag)) return false;
    if (isExcluded(excludeIds, asset.id)) return false;
    return true;
  }

  function apply(assets, settings, excludeIds) {
    var out = [];
    var list = assets || [];
    for (var i = 0; i < list.length; i++) {
      if (keep(list[i], settings, excludeIds)) out.push(list[i]);
    }
    return out;
  }

  Alcove.filters = {
    hasTag: hasTag,
    isScreenshot: isScreenshot,
    shortEdge: shortEdge,
    keep: keep,
    apply: apply
  };
})(typeof window !== 'undefined' ? window : globalThis);
