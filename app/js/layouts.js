(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  // Slots are percentages of the screen. Gaps and outer margins are part of
  // the coordinates, so a print never sits on the bezel.
  var TEMPLATES = {
    single: [
      { x: 14, y: 10, w: 72, h: 76, prefer: 'any' }
    ],
    two: [
      { x: 8, y: 14, w: 38, h: 70, prefer: 'any' },
      { x: 54, y: 14, w: 38, h: 70, prefer: 'any' }
    ],
    three: [
      { x: 8, y: 12, w: 50, h: 74, prefer: 'landscape' },
      { x: 64, y: 12, w: 28, h: 34, prefer: 'landscape' },
      { x: 64, y: 52, w: 28, h: 34, prefer: 'landscape' }
    ],
    four: [
      { x: 10, y: 11, w: 36, h: 34, prefer: 'any' },
      { x: 54, y: 11, w: 36, h: 34, prefer: 'any' },
      { x: 10, y: 53, w: 36, h: 34, prefer: 'any' },
      { x: 54, y: 53, w: 36, h: 34, prefer: 'any' }
    ],
    // Five prints, about 55% of the screen, with a wide margin of wall.
    mixed: [
      { x: 18, y: 7, w: 64, h: 28, prefer: 'landscape' },
      { x: 7, y: 39, w: 22, h: 50, prefer: 'portrait' },
      { x: 33, y: 39, w: 34, h: 28, prefer: 'landscape' },
      { x: 71, y: 39, w: 22, h: 50, prefer: 'portrait' },
      { x: 33, y: 71, w: 34, h: 18, prefer: 'landscape' }
    ]
  };

  function slotFrom(raw) {
    return {
      left: raw.x,
      top: raw.y,
      width: raw.w,
      height: raw.h,
      prefer: raw.prefer || 'any'
    };
  }

  function orientationOf(asset) {
    var width = asset && asset.width ? asset.width : 0;
    var height = asset && asset.height ? asset.height : 0;
    if (!width || !height) return 'unknown';
    if (height > width * 1.05) return 'portrait';
    if (width > height * 1.05) return 'landscape';
    return 'square';
  }

  function countPortraits(orientations) {
    var count = 0;
    var list = orientations || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] === 'portrait') count += 1;
    }
    return count;
  }

  function mixedTemplate() {
    return 'mixed';
  }

  function slotsFor(layout) {
    var name = layout === 'mixed' ? 'mixed' : layout;
    var template = TEMPLATES[name] || TEMPLATES.single;
    var slots = [];
    for (var i = 0; i < template.length; i++) slots.push(slotFrom(template[i]));
    return slots;
  }

  function coverage(slots) {
    var area = 0;
    var list = slots || [];
    for (var i = 0; i < list.length; i++) area += list[i].width * list[i].height;
    return area / 100;
  }

  function minMargin(slots) {
    var edge = 100;
    var list = slots || [];
    for (var i = 0; i < list.length; i++) {
      var slot = list[i];
      var right = 100 - (slot.left + slot.width);
      var bottom = 100 - (slot.top + slot.height);
      edge = Math.min(edge, slot.left, slot.top, right, bottom);
    }
    return edge;
  }

  function initialDelay(index, count, intervalMs) {
    var interval = intervalMs > 0 ? intervalMs : 1000;
    if (count <= 1) return interval;
    var step = Math.round(interval / count);
    return step * (index + 1);
  }

  Alcove.layouts = {
    TEMPLATES: TEMPLATES,
    orientationOf: orientationOf,
    countPortraits: countPortraits,
    mixedTemplate: mixedTemplate,
    slotsFor: slotsFor,
    coverage: coverage,
    minMargin: minMargin,
    initialDelay: initialDelay
  };
})(typeof window !== 'undefined' ? window : globalThis);
