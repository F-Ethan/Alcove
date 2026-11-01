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

  function dropReason(asset, settings, excludeIds) {
    if (!asset || asset.type !== 'IMAGE') return 'notImage';
    if (asset.isTrashed) return 'trashed';
    if (asset.isArchived || asset.visibility === 'archive') return 'archived';
    if (asset.visibility === 'hidden') return 'hidden';
    if (asset.visibility === 'locked') return 'locked';
    if (isScreenshot(asset)) return 'screenshot';
    var filters = settings && settings.filters ? settings.filters : {};
    if (filters.peopleOnly && Array.isArray(asset.people) && asset.people.length === 0) return 'noPeople';
    // A missing width or height is unknown, so the size floor does not apply.
    var edge = shortEdge(asset);
    if (filters.minShortEdge && edge > 0 && edge < filters.minShortEdge) return 'small';
    if (filters.minRating && !(asset.rating >= filters.minRating)) return 'rating';
    if (filters.excludeTag && hasTag(asset, filters.excludeTag)) return 'tag';
    if (isExcluded(excludeIds, asset.id)) return 'junk';
    return '';
  }

  function emptyDrops() {
    return {
      notImage: 0,
      trashed: 0,
      archived: 0,
      hidden: 0,
      locked: 0,
      screenshot: 0,
      noPeople: 0,
      small: 0,
      rating: 0,
      tag: 0,
      junk: 0
    };
  }

  function keep(asset, settings, excludeIds) {
    return !dropReason(asset, settings, excludeIds);
  }

  function summarize(assets, settings, excludeIds) {
    var dropped = emptyDrops();
    var kept = [];
    var list = assets || [];
    for (var i = 0; i < list.length; i++) {
      var reason = dropReason(list[i], settings, excludeIds);
      if (!reason) kept.push(list[i]);
      else if (dropped[reason] != null) dropped[reason] += 1;
    }
    return {
      kept: kept,
      keptCount: kept.length,
      dropped: dropped,
      started: list.length
    };
  }

  function apply(assets, settings, excludeIds) {
    return summarize(assets, settings, excludeIds).kept;
  }

  Alcove.filters = {
    hasTag: hasTag,
    isScreenshot: isScreenshot,
    shortEdge: shortEdge,
    keep: keep,
    dropReason: dropReason,
    summarize: summarize,
    apply: apply
  };
})(typeof window !== 'undefined' ? window : globalThis);
