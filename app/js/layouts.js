(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var GAP = 0.55;

  var TEMPLATES = {
    single: [
      { x: 0, y: 0, w: 100, h: 100, prefer: 'any' }
    ],
    two: [
      { x: 0, y: 0, w: 50, h: 100, prefer: 'any' },
      { x: 50, y: 0, w: 50, h: 100, prefer: 'any' }
    ],
    three: [
      { x: 0, y: 0, w: 62, h: 100, prefer: 'landscape' },
      { x: 62, y: 0, w: 38, h: 50, prefer: 'landscape' },
      { x: 62, y: 50, w: 38, h: 50, prefer: 'landscape' }
    ],
    four: [
      { x: 0, y: 0, w: 50, h: 50, prefer: 'any' },
      { x: 50, y: 0, w: 50, h: 50, prefer: 'any' },
      { x: 0, y: 50, w: 50, h: 50, prefer: 'any' },
      { x: 50, y: 50, w: 50, h: 50, prefer: 'any' }
    ],
    mixedPortrait: [
      { x: 0, y: 0, w: 64, h: 62, prefer: 'landscape' },
      { x: 0, y: 62, w: 64, h: 38, prefer: 'landscape' },
      { x: 64, y: 0, w: 36, h: 100, prefer: 'portrait' }
    ],
    mixedPair: [
      { x: 0, y: 6, w: 28, h: 88, prefer: 'portrait' },
      { x: 28, y: 16, w: 44, h: 68, prefer: 'landscape' },
      { x: 72, y: 6, w: 28, h: 88, prefer: 'portrait' }
    ],
    mixedLandscape: [
      { x: 0, y: 0, w: 66, h: 66, prefer: 'landscape' },
      { x: 66, y: 0, w: 34, h: 33, prefer: 'landscape' },
      { x: 66, y: 33, w: 34, h: 33, prefer: 'landscape' },
      { x: 0, y: 66, w: 100, h: 34, prefer: 'landscape' }
    ]
  };

  function inset(slot) {
    return {
      left: slot.x + GAP,
      top: slot.y + GAP,
      width: Math.max(1, slot.w - GAP * 2),
      height: Math.max(1, slot.h - GAP * 2),
      prefer: slot.prefer || 'any'
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

  function mixedTemplate(orientations) {
    var portraits = countPortraits(orientations);
    if (portraits >= 2) return 'mixedPair';
    if (portraits === 1) return 'mixedPortrait';
    return 'mixedLandscape';
  }

  function slotsFor(layout, orientations) {
    var name = layout === 'mixed' ? mixedTemplate(orientations) : layout;
    var template = TEMPLATES[name] || TEMPLATES.single;
    var slots = [];
    for (var i = 0; i < template.length; i++) slots.push(inset(template[i]));
    return slots;
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
    mixedTemplate: mixedTemplate,
    slotsFor: slotsFor,
    initialDelay: initialDelay
  };
})(typeof window !== 'undefined' ? window : globalThis);
