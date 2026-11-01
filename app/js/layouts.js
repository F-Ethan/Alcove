(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};
  var SCREEN = 16 / 9;
  // Bottom-right corner is reserved for the clock, in percent of the screen.
  var CLOCK = { left: 66, top: 78, width: 32, height: 20 };

  var TEMPLATES = {
    single: [
      { x: 14, y: 10, w: 72, h: 76, prefer: 'any' }
    ],
    two: [
      { x: 8, y: 12, w: 28, h: 74, prefer: 'portrait' },
      { x: 42, y: 20, w: 48, h: 52, prefer: 'landscape' }
    ],
    three: [
      { x: 8, y: 16, w: 48, h: 64, prefer: 'landscape' },
      { x: 60, y: 10, w: 22, h: 36, prefer: 'portrait' },
      { x: 60, y: 52, w: 30, h: 28, prefer: 'landscape' }
    ],
    four: [
      { x: 8, y: 8, w: 26, h: 48, prefer: 'portrait' },
      { x: 38, y: 8, w: 40, h: 30, prefer: 'landscape' },
      { x: 8, y: 60, w: 40, h: 28, prefer: 'landscape' },
      { x: 52, y: 42, w: 24, h: 40, prefer: 'portrait' }
    ]
  };

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function rect(left, top, width, height, prefer, role) {
    return {
      left: round1(left),
      top: round1(top),
      width: round1(Math.max(1, width)),
      height: round1(Math.max(1, height)),
      prefer: prefer || 'any',
      role: role || ''
    };
  }

  function widthFor(heightPct, pixelAspect) {
    return heightPct * pixelAspect / SCREEN;
  }

  function heightFor(widthPct, pixelAspect) {
    return widthPct * SCREEN / pixelAspect;
  }

  function slotFrom(raw) {
    return rect(raw.x, raw.y, raw.w, raw.h, raw.prefer, raw.role);
  }

  function swappedOrientation(orientation) {
    var text = String(orientation == null ? '' : orientation).trim().toLowerCase();
    if (text === '5' || text === '6' || text === '7' || text === '8') return true;
    if (text.indexOf('90') !== -1 || text.indexOf('270') !== -1) return true;
    return false;
  }

  function aspectOf(asset) {
    var width = asset && asset.width ? asset.width : 0;
    var height = asset && asset.height ? asset.height : 0;
    if (asset && swappedOrientation(asset.orientation)) {
      var swap = width;
      width = height;
      height = swap;
    }
    if (width <= 0 || height <= 0) return 0;
    return width / height;
  }

  function orientationOf(asset) {
    var aspect = aspectOf(asset);
    if (!aspect) return 'unknown';
    if (aspect < 0.95) return 'portrait';
    if (aspect > 1.05) return 'landscape';
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

  function intersects(a, b) {
    return a.left < b.left + b.width && a.left + a.width > b.left &&
      a.top < b.top + b.height && a.top + a.height > b.top;
  }

  function hitsClock(frame) {
    return intersects(frame, CLOCK);
  }

  function fitInBox(box, pixelAspect) {
    if (!box) return null;
    if (!pixelAspect || pixelAspect <= 0) return slotFrom({
      x: box.left != null ? box.left : box.x,
      y: box.top != null ? box.top : box.y,
      w: box.width != null ? box.width : box.w,
      h: box.height != null ? box.height : box.h,
      prefer: box.prefer,
      role: box.role
    });
    var left = box.left != null ? box.left : box.x;
    var top = box.top != null ? box.top : box.y;
    var boxW = box.width != null ? box.width : box.w;
    var boxH = box.height != null ? box.height : box.h;
    var boxAspect = (boxW / boxH) * SCREEN;
    var width;
    var height;
    if (pixelAspect >= boxAspect) {
      width = boxW;
      height = heightFor(width, pixelAspect);
    } else {
      height = boxH;
      width = widthFor(height, pixelAspect);
    }
    return rect(left + (boxW - width) / 2, top + (boxH - height) / 2, width, height, box.prefer, box.role);
  }

  function frameSized(left, top, height, pixelAspect, prefer, role) {
    return rect(left, top, widthFor(height, pixelAspect), height, prefer, role);
  }

  function collage(options) {
    var opts = options || {};
    var side = opts.heroSide === 'right' ? 'right' : 'left';
    var heroOrient = opts.heroOrient === 'landscape' ? 'landscape' : 'portrait';
    var heroAspect = opts.heroAspect > 0 ? opts.heroAspect : (heroOrient === 'portrait' ? 2 / 3 : 3 / 2);
    if (heroOrient === 'portrait' && heroAspect > 1) heroAspect = 1 / heroAspect;
    if (heroOrient === 'landscape' && heroAspect < 1) heroAspect = 1 / heroAspect;
    var mateAspect = opts.mateAspect > 0 ? opts.mateAspect : (heroOrient === 'portrait' ? 3 / 2 : 2 / 3);
    if (heroOrient === 'portrait' && mateAspect < 1) mateAspect = 1 / mateAspect;
    if (heroOrient === 'landscape' && mateAspect > 1) mateAspect = 1 / mateAspect;
    var smallDefaults = [3 / 2, 4 / 5, 6 / 5];
    var smallAspects = smallDefaults.slice();
    if (opts.smallAspects) {
      for (var s = 0; s < 3; s++) {
        if (opts.smallAspects[s] > 0) smallAspects[s] = opts.smallAspects[s];
      }
    }
    var margin = 7;
    var gap = 3.4;

    var heroH = heroOrient === 'portrait' ? (side === 'left' ? 84 : 70) : 40;
    var hero = frameSized(margin, margin, heroH, heroAspect, heroOrient, 'hero');
    if (side === 'right') {
      hero.left = round1(100 - margin - hero.width);
      if (hitsClock(hero)) {
        var aspect = (hero.width / hero.height) * SCREEN;
        hero.height = round1(CLOCK.top - gap - hero.top);
        hero.width = round1(widthFor(hero.height, aspect));
        hero.left = round1(100 - margin - hero.width);
      }
    }

    var mateArea = hero.width * hero.height * 0.5;
    var mateH = Math.sqrt(mateArea * SCREEN / mateAspect);
    var mate = frameSized(0, margin, mateH, mateAspect, heroOrient === 'portrait' ? 'landscape' : 'portrait', 'mate');
    mate.left = side === 'left'
      ? round1(hero.left + hero.width + gap)
      : round1(hero.left - gap - mate.width);
    if (mate.left < margin) {
      mate.left = margin;
      var maxW = hero.left - gap - margin;
      if (mate.width > maxW && maxW > 8) {
        mate.width = round1(maxW);
        mate.height = round1(heightFor(mate.width, mateAspect));
      }
    }

    function pocket(x, y, maxW, maxH, aspect, prefer) {
      var height = maxH;
      var width = widthFor(height, aspect);
      if (width > maxW) {
        width = maxW;
        height = heightFor(width, aspect);
      }
      var left = x;
      if (left + width > 100 - margin) left = 100 - margin - width;
      var top = y;
      var frame = rect(left, top, width, height, prefer, 'small');
      if (hitsClock(frame)) {
        frame.height = round1(Math.max(8, CLOCK.top - gap - frame.top));
        frame.width = round1(widthFor(frame.height, aspect));
        if (frame.left + frame.width > CLOCK.left && frame.top + frame.height > CLOCK.top) {
          frame.left = round1(Math.min(frame.left, CLOCK.left - gap - frame.width));
        }
      }
      return frame;
    }

    var smalls;
    if (side === 'left') {
      var column = Math.max(mate.left + mate.width + gap, 74);
      smalls = [
        pocket(column, margin, 100 - margin - column, 18, smallAspects[0], 'landscape'),
        pocket(column, 30, 100 - margin - column, 46, smallAspects[1], 'portrait'),
        pocket(mate.left, mate.top + mate.height + gap, Math.max(18, CLOCK.left - gap - mate.left), 30, smallAspects[2], 'any')
      ];
    } else {
      smalls = [
        pocket(margin, margin, 26, 24, smallAspects[0], 'landscape'),
        pocket(margin, 34, 28, 52, smallAspects[1], 'portrait'),
        pocket(mate.left, mate.top + mate.height + gap, Math.max(20, hero.left - gap - mate.left), 30, smallAspects[2], 'any')
      ];
    }
    var mateArea = mate.width * mate.height;
    for (var i = 0; i < smalls.length; i++) {
      var area = smalls[i].width * smalls[i].height;
      if (area < mateArea) continue;
      var aspect = (smalls[i].width / smalls[i].height) * SCREEN;
      var scale = Math.sqrt((mateArea * 0.85) / area);
      var height = smalls[i].height * scale;
      smalls[i] = rect(smalls[i].left, smalls[i].top, widthFor(height, aspect), height, smalls[i].prefer, 'small');
    }
    return [hero, mate, smalls[0], smalls[1], smalls[2]];
  }

  function mixedTemplate() {
    return 'mixed';
  }

  // Fixed arrangements. A slot keeps this box until the whole arrangement changes.
  // fitInBox may shrink the mat inside the box. It does not move the neighbors.
  var ARRANGEMENT_NAMES = ['left', 'right', 'center', 'stack'];
  var ARRANGEMENTS = {
    left: [
      { x: 7.5, y: 7, w: 31.5, h: 84, prefer: 'portrait', role: 'hero' },
      { x: 42, y: 7, w: 30.4, h: 36, prefer: 'landscape', role: 'mate' },
      { x: 76, y: 7, w: 16.9, h: 20, prefer: 'landscape', role: 'small' },
      { x: 76, y: 32, w: 15.8, h: 42, prefer: 'portrait', role: 'small' },
      { x: 42, y: 48, w: 21.9, h: 26, prefer: 'landscape', role: 'small' }
    ],
    right: [
      { x: 67.5, y: 7, w: 25.5, h: 68, prefer: 'portrait', role: 'hero' },
      { x: 34, y: 7, w: 30, h: 36, prefer: 'landscape', role: 'mate' },
      { x: 7, y: 7, w: 24, h: 24, prefer: 'landscape', role: 'small' },
      { x: 7, y: 36, w: 18, h: 50, prefer: 'portrait', role: 'small' },
      { x: 34, y: 48, w: 26, h: 24, prefer: 'landscape', role: 'small' }
    ],
    center: [
      { x: 37, y: 7, w: 26, h: 64, prefer: 'portrait', role: 'hero' },
      { x: 14, y: 75, w: 48, h: 18, prefer: 'landscape', role: 'mate' },
      { x: 7, y: 14, w: 18, h: 46, prefer: 'portrait', role: 'small' },
      { x: 70, y: 8, w: 22, h: 26, prefer: 'landscape', role: 'small' },
      { x: 70, y: 40, w: 18, h: 32, prefer: 'portrait', role: 'small' }
    ],
    stack: [
      { x: 7, y: 26, w: 30, h: 66, prefer: 'portrait', role: 'hero' },
      { x: 42, y: 7, w: 34, h: 34, prefer: 'landscape', role: 'mate' },
      { x: 7, y: 7, w: 30, h: 15, prefer: 'landscape', role: 'small' },
      { x: 80, y: 8, w: 13, h: 36, prefer: 'portrait', role: 'small' },
      { x: 42, y: 48, w: 30, h: 26, prefer: 'landscape', role: 'small' }
    ]
  };

  function arrangement(name) {
    var key = ARRANGEMENTS[name] ? name : 'left';
    var source = ARRANGEMENTS[key];
    var slots = [];
    for (var i = 0; i < source.length; i++) slots.push(slotFrom(source[i]));
    return slots;
  }

  function slotsFor(layout, options) {
    if (layout === 'mixed') return arrangement(options && options.arrangement);
    var template = TEMPLATES[layout] || TEMPLATES.single;
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
    CLOCK: CLOCK,
    SCREEN: SCREEN,
    aspectOf: aspectOf,
    swappedOrientation: swappedOrientation,
    orientationOf: orientationOf,
    countPortraits: countPortraits,
    mixedTemplate: mixedTemplate,
    ARRANGEMENT_NAMES: ARRANGEMENT_NAMES,
    arrangement: arrangement,
    slotsFor: slotsFor,
    collage: collage,
    fitInBox: fitInBox,
    hitsClock: hitsClock,
    intersects: intersects,
    coverage: coverage,
    minMargin: minMargin,
    initialDelay: initialDelay
  };
})(typeof window !== 'undefined' ? window : globalThis);
