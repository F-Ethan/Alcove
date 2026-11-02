(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  // seasons lists which times of year a scene belongs in.
  // 01 and 05 are welcome in every season. 06 stands in for 02 at Christmas.
  var META = {
    '01_collage_full': {
      label: 'Linen collage',
      background: '',
      linen: true,
      clock: 'band',
      seasons: ['christmas', 'winter', 'fall', 'spring', 'summer', 'none']
    },
    '02_fireplace_mantel': {
      label: 'Fireplace',
      background: 'backgrounds/bg_fireplace.jpg',
      clock: 'bl',
      seasons: ['winter', 'spring', 'summer', 'none']
    },
    '03_fall_gallery': {
      label: 'Fall gallery',
      background: 'backgrounds/bg_fall.jpg',
      clock: 'tr',
      seasons: ['fall']
    },
    '04_christmas_garland': {
      label: 'Christmas garland',
      background: 'backgrounds/bg_xmas.jpg',
      clock: 'tl',
      seasons: ['christmas']
    },
    '05_plank_polaroids': {
      label: 'Plank polaroids',
      background: 'backgrounds/bg_plank.jpg',
      clock: 'tl',
      seasons: ['christmas', 'winter', 'fall', 'spring', 'summer', 'none']
    },
    '06_christmas_fireplace': {
      label: 'Christmas fireplace',
      background: 'backgrounds/bg_xmas_fireplace.jpg',
      clock: 'bl',
      seasons: ['christmas'],
      replaces: '02_fireplace_mantel'
    }
  };

  var ORDER = [
    '01_collage_full',
    '02_fireplace_mantel',
    '03_fall_gallery',
    '04_christmas_garland',
    '05_plank_polaroids',
    '06_christmas_fireplace'
  ];

  function preferFor(role) {
    if (role === 'main' || role === 'small_portrait') return 'portrait';
    if (role === 'secondary' || role === 'small_landscape') return 'landscape';
    if (role === 'small_square') return 'square';
    return 'any';
  }

  function parseSlot(raw) {
    var margins = raw.frame_margins_top_right_bottom_left || [0, 0, 0, 0];
    var outerW = raw.outer_w || raw.w || 1;
    var outerH = raw.outer_h || raw.h || 1;
    var pivot = raw.rotation_pivot;
    var originX = 50;
    var originY = 50;
    if (pivot && pivot.length >= 2 && outerW && outerH) {
      originX = ((pivot[0] - raw.outer_x) / outerW) * 100;
      originY = ((pivot[1] - raw.outer_y) / outerH) * 100;
    }
    var openingW = (raw.nw || 0) * 1920;
    var openingH = (raw.nh || 0) * 1080;
    return {
      role: raw.role || '',
      prefer: preferFor(raw.role),
      aspect: raw.aspect_ratio || 0,
      left: (raw.outer_nx || 0) * 100,
      top: (raw.outer_ny || 0) * 100,
      width: (raw.outer_nw || 0) * 100,
      height: (raw.outer_nh || 0) * 100,
      openingLeft: (raw.nx || 0) * 100,
      openingTop: (raw.ny || 0) * 100,
      openingWidth: (raw.nw || 0) * 100,
      openingHeight: (raw.nh || 0) * 100,
      padTop: (margins[0] / outerH) * 100,
      padRight: (margins[1] / outerW) * 100,
      padBottom: (margins[2] / outerH) * 100,
      padLeft: (margins[3] / outerW) * 100,
      rotation: raw.rotation_deg || 0,
      originX: originX,
      originY: originY,
      frameStyle: raw.frame_style || 'plain',
      slotEdge: Math.round(Math.min(openingW, openingH))
    };
  }

  function parseScene(raw) {
    var file = raw || {};
    var meta = META[file.name] || {};
    var slots = [];
    var list = file.slots || [];
    for (var i = 0; i < list.length; i++) slots.push(parseSlot(list[i]));
    var safe = file.safe_area || { nx: 0.05, ny: 0.05, nw: 0.9, nh: 0.9 };
    return {
      id: file.name || '',
      title: meta.label || file.title || file.name || '',
      background: meta.background || '',
      linen: !!meta.linen,
      clock: meta.clock || 'br',
      seasons: meta.seasons || [],
      replaces: meta.replaces || '',
      safe: {
        left: (safe.nx || 0) * 100,
        top: (safe.ny || 0) * 100,
        width: (safe.nw || 1) * 100,
        height: (safe.nh || 1) * 100
      },
      slots: slots
    };
  }

  function catalog() {
    var raw = Alcove.SCENE_RAW || [];
    var byId = {};
    for (var i = 0; i < raw.length; i++) {
      var scene = parseScene(raw[i]);
      if (scene.id) byId[scene.id] = scene;
    }
    var ordered = [];
    for (var n = 0; n < ORDER.length; n++) {
      if (byId[ORDER[n]]) ordered.push(byId[ORDER[n]]);
    }
    return ordered;
  }

  function get(id) {
    var list = catalog();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function known(id) {
    return !!META[id];
  }

  function allows(id, season) {
    var meta = META[id];
    if (!meta) return false;
    return meta.seasons.indexOf(season || 'none') !== -1;
  }

  function seasonalIds(season) {
    var out = [];
    for (var i = 0; i < ORDER.length; i++) {
      if (allows(ORDER[i], season)) out.push(ORDER[i]);
    }
    return out;
  }

  function activeIds(selected, season) {
    var chosen = [];
    var list = selected || [];
    for (var i = 0; i < list.length; i++) {
      if (known(list[i]) && chosen.indexOf(list[i]) === -1) chosen.push(list[i]);
    }
    if (!chosen.length) return seasonalIds(season);
    var inSeason = [];
    for (var j = 0; j < chosen.length; j++) {
      if (allows(chosen[j], season)) inSeason.push(chosen[j]);
    }
    return inSeason.length ? inSeason : chosen;
  }

  function choices() {
    var out = [];
    for (var i = 0; i < ORDER.length; i++) {
      var meta = META[ORDER[i]];
      out.push({ id: ORDER[i], label: meta.label });
    }
    return out;
  }

  function scaleSlot(slot, width, height) {
    return {
      x: slot.openingLeft / 100 * width,
      y: slot.openingTop / 100 * height,
      w: slot.openingWidth / 100 * width,
      h: slot.openingHeight / 100 * height
    };
  }

  function focusPosition(asset) {
    var faces = asset && asset.faces ? asset.faces : [];
    if (!faces.length) return { x: 50, y: 50 };
    var sx = 0;
    var sy = 0;
    var count = 0;
    for (var i = 0; i < faces.length; i++) {
      var face = faces[i];
      if (!face || !(face.w > 0) || !(face.h > 0)) continue;
      sx += face.x + face.w / 2;
      sy += face.y + face.h / 2;
      count += 1;
    }
    if (!count) return { x: 50, y: 50 };
    var x = Math.round((sx / count) * 1000) / 10;
    var y = Math.round((sy / count) * 1000) / 10;
    if (x < 0) x = 0;
    if (x > 100) x = 100;
    if (y < 0) y = 0;
    if (y > 100) y = 100;
    return { x: x, y: y };
  }

  function clockBox(corner) {
    if (corner === 'band') return { left: 30, top: 96.2, width: 40, height: 3.2 };
    if (corner === 'tl') return { left: 5, top: 4, width: 16, height: 10 };
    if (corner === 'tr') return { left: 79, top: 4, width: 16, height: 10 };
    if (corner === 'bl') return { left: 5, top: 86, width: 16, height: 10 };
    return { left: 79, top: 86, width: 16, height: 10 };
  }

  function intersects(a, b) {
    return a.left < b.left + b.width && a.left + a.width > b.left &&
      a.top < b.top + b.height && a.top + a.height > b.top;
  }

  function clockClears(scene) {
    var clock = clockBox(scene.clock);
    var slots = scene.slots || [];
    for (var i = 0; i < slots.length; i++) {
      if (intersects(clock, slots[i])) return false;
    }
    return true;
  }

  Alcove.scenes = {
    META: META,
    ORDER: ORDER,
    parseScene: parseScene,
    parseSlot: parseSlot,
    catalog: catalog,
    get: get,
    known: known,
    allows: allows,
    seasonalIds: seasonalIds,
    activeIds: activeIds,
    choices: choices,
    scaleSlot: scaleSlot,
    focusPosition: focusPosition,
    clockBox: clockBox,
    clockClears: clockClears
  };
})(typeof window !== 'undefined' ? window : globalThis);
