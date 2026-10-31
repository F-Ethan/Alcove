(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  var LAYOUT_LABELS = {
    single: 'Single',
    two: '2-up',
    three: '3-up mosaic',
    four: '4-grid',
    mixed: 'Mixed collage'
  };
  var DECOR_LABELS = {
    auto: 'Auto by date',
    none: 'None',
    christmas: 'Christmas',
    winter: 'Winter',
    fall: 'Fall',
    spring: 'Spring',
    summer: 'Summer'
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function readPath(object, path) {
    var current = object;
    for (var i = 0; i < path.length; i++) current = current[path[i]];
    return current;
  }

  function writePath(object, path, value) {
    var current = object;
    for (var i = 0; i < path.length - 1; i++) current = current[path[i]];
    current[path[path.length - 1]] = value;
  }

  function musicRows(current) {
    var music = current && current.music ? current.music : {};
    var source = music.source || 'navidrome';
    var rows = [
      { id: 'musicEnabled', kind: 'bool', label: 'Background music', path: ['music', 'enabled'], help: 'Off until you turn it on. Photos keep changing either way.' },
      {
        id: 'musicSource',
        kind: 'enum',
        label: 'Source',
        path: ['music', 'source'],
        options: Alcove.MUSIC_SOURCES,
        labels: { navidrome: 'Navidrome', jellyfin: 'Jellyfin', radio: 'Internet radio' }
      },
      { id: 'musicVolume', kind: 'number', label: 'Volume', path: ['music', 'volume'], min: 0, max: 100, step: 5, suffix: '%' },
      { id: 'musicFade', kind: 'number', label: 'Track crossfade', path: ['music', 'crossfadeMs'], min: 0, max: 5000, step: 250, format: 'fade' }
    ];
    if (source === 'navidrome' || source === 'jellyfin') {
      var key = source;
      var label = source === 'navidrome' ? 'Navidrome' : 'Jellyfin';
      rows.push(
        { id: key + 'Url', kind: 'text', label: label + ' URL', path: ['music', key, 'url'], placeholder: source === 'navidrome' ? 'http://192.168.1.66:4533' : 'http://192.168.1.66:8096' },
        { id: key + 'User', kind: 'text', label: 'Username', path: ['music', key, 'username'] },
        { id: key + 'Pass', kind: 'secret', label: 'Password', path: ['music', key, 'password'], help: 'Stored on this TV. Alcove does not write it to the log.' },
        { id: 'testMusic', kind: 'button', label: 'Test music', help: 'Loads playlists so you can assign one to each season.' }
      );
      var seasons = [
        ['christmas', 'Christmas playlist'],
        ['winter', 'Winter playlist'],
        ['fall', 'Fall playlist'],
        ['spring', 'Spring playlist'],
        ['summer', 'Summer playlist'],
        ['none', 'Playlist when decorations are off']
      ];
      for (var i = 0; i < seasons.length; i++) {
        rows.push({
          id: key + '-' + seasons[i][0],
          kind: 'one',
          label: seasons[i][1],
          path: ['music', key, 'playlists', seasons[i][0]],
          catalog: key + 'Playlists'
        });
      }
    }
    if (source === 'radio') {
      var streams = music.radio && music.radio.streams ? music.radio.streams : [];
      for (var s = 0; s < streams.length; s++) {
        rows.push(
          { id: 'streamName' + s, kind: 'text', label: 'Stream ' + (s + 1) + ' name', path: ['music', 'radio', 'streams', s, 'name'] },
          { id: 'streamUrl' + s, kind: 'text', label: 'Stream ' + (s + 1) + ' URL', path: ['music', 'radio', 'streams', s, 'url'], placeholder: 'https://example.com/stream.mp3', help: 'MP3 or AAC is the reliable choice. Leave the URL empty to skip the row.' },
          {
            id: 'streamSeason' + s,
            kind: 'enum',
            label: 'Stream ' + (s + 1) + ' season',
            path: ['music', 'radio', 'streams', s, 'season'],
            options: Alcove.STREAM_SEASONS,
            labels: { any: 'Any season', christmas: 'Christmas', winter: 'Winter', fall: 'Fall', spring: 'Spring', summer: 'Summer', none: 'Decorations off' }
          }
        );
      }
      rows.push({ id: 'addStream', kind: 'button', label: 'Add a stream', help: 'Up to 8 streams. Empty URLs are ignored.' });
    }
    return rows;
  }

  function sections(current) {
    return [
      {
        id: 'immich',
        label: 'Immich',
        rows: [
          {
            id: 'serverUrl',
            kind: 'text',
            label: 'Server URL',
            path: ['serverUrl'],
            placeholder: 'http://192.168.1.66:2283',
            help: 'Typed on the TV and saved on this set. Change it if the laptop gets a new address.'
          },
          {
            id: 'apiKey',
            kind: 'secret',
            label: 'API key',
            path: ['apiKey'],
            placeholder: 'Paste or type the key',
            help: 'Use a read-only key: asset.read, asset.view, album.read, person.read, folder.read, memory.read, tag.read. The key stays on the TV.'
          },
          {
            id: 'test',
            kind: 'button',
            label: 'Test connection',
            help: 'Checks the URL, the key, and whether this TV is blocking Immich (CORS).'
          }
        ]
      },
      {
        id: 'sources',
        label: 'Sources',
        rows: [
          {
            id: 'favorites',
            kind: 'bool',
            label: 'Favorites',
            path: ['sources', 'favorites'],
            help: 'Photos you have marked as favorites.'
          },
          {
            id: 'onThisDay',
            kind: 'bool',
            label: 'On this day',
            path: ['sources', 'onThisDay'],
            help: 'Immich memories for this month and day, when the server has them.'
          },
          {
            id: 'albums',
            kind: 'multi',
            label: 'Albums',
            path: ['sources', 'albums'],
            catalog: 'albums',
            help: 'Choose one or more albums.'
          },
          {
            id: 'people',
            kind: 'multi',
            label: 'People',
            path: ['sources', 'people'],
            catalog: 'people',
            help: 'Photos of the people you pick.'
          },
          {
            id: 'folders',
            kind: 'multi',
            label: 'Folders',
            path: ['sources', 'folders'],
            catalog: 'folders',
            help: 'Folders from the Immich folder view.'
          }
        ]
      },
      {
        id: 'layout',
        label: 'Layout',
        rows: [
          {
            id: 'layout',
            kind: 'enum',
            label: 'Layout',
            path: ['layout'],
            options: Alcove.LAYOUTS,
            labels: LAYOUT_LABELS,
            help: 'Mixed collage uses portrait and landscape slots.'
          },
          {
            id: 'intervalSec',
            kind: 'number',
            label: 'Time on screen',
            path: ['intervalSec'],
            min: 5,
            max: 180,
            step: 1,
            suffix: ' seconds',
            help: 'Each tile keeps its own clock, so the wall does not flip all at once.'
          },
          {
            id: 'crossfadeMs',
            kind: 'number',
            label: 'Crossfade',
            path: ['crossfadeMs'],
            min: 0,
            max: 3000,
            step: 100,
            format: 'fade',
            help: 'Set to 0 for a hard cut.'
          },
          {
            id: 'kenBurns',
            kind: 'bool',
            label: 'Ken Burns',
            path: ['kenBurns'],
            help: 'A slow zoom and pan on each photo.'
          }
        ]
      },
      {
        id: 'decor',
        label: 'Decorations',
        rows: [
          {
            id: 'decoration',
            kind: 'enum',
            label: 'Season',
            path: ['decoration'],
            options: Alcove.DECORATIONS,
            labels: DECOR_LABELS,
            help: 'Auto uses the date. Christmas runs December 1 through January 6.'
          }
        ]
      },
      {
        id: 'filters',
        label: 'Filters',
        rows: [
          {
            id: 'peopleOnly',
            kind: 'bool',
            label: 'People only',
            path: ['filters', 'peopleOnly'],
            help: 'Skip photos Immich did not tag with a person. Photos with no face data stay in.'
          },
          {
            id: 'minRating',
            kind: 'number',
            label: 'Minimum stars',
            path: ['filters', 'minRating'],
            min: 0,
            max: 5,
            step: 1,
            format: 'stars',
            help: 'Uses the EXIF star rating Immich stores. 0 means off.'
          },
          {
            id: 'excludeTag',
            kind: 'text',
            label: 'Exclude tag',
            path: ['filters', 'excludeTag'],
            placeholder: 'blurry',
            help: 'Skip photos whose Immich tag name matches this, such as blurry.'
          },
          {
            id: 'minShortEdge',
            kind: 'number',
            label: 'Minimum short edge',
            path: ['filters', 'minShortEdge'],
            min: 0,
            max: 4000,
            step: 80,
            format: 'edge',
            help: 'Skip small photos. 0 means off. Photos with no size data stay in.'
          },
          {
            id: 'junkEnabled',
            kind: 'bool',
            label: 'Smart search junk filter',
            path: ['filters', 'junk', 'enabled'],
            help: 'Runs Immich smart search and skips the top matches. Immich does not return a score, so rank is the cutoff.'
          },
          {
            id: 'junkQueries',
            kind: 'lines',
            label: 'Junk queries',
            path: ['filters', 'junk', 'queries'],
            help: 'One search phrase per line. Defaults look for blurry, black, dark, screenshot, receipt, and document photos.'
          },
          {
            id: 'perQuery',
            kind: 'number',
            label: 'Matches per query',
            path: ['filters', 'junk', 'perQuery'],
            min: 1,
            max: 200,
            step: 5,
            suffix: ' photos',
            help: 'How many top smart-search results to exclude for each phrase.'
          }
        ]
      },
      {
        id: 'display',
        label: 'Display',
        rows: [
          { id: 'showClock', kind: 'bool', label: 'Clock', path: ['showClock'] },
          { id: 'showCaptions', kind: 'bool', label: 'Captions', path: ['showCaptions'], help: 'Place, description, or the day the photo was taken.' },
          { id: 'nightDimming', kind: 'bool', label: 'Night dimming', path: ['nightDimming'], help: 'Dims the screen, and the music, overnight.' },
          {
            id: 'nightStart',
            kind: 'text',
            label: 'Night starts',
            path: ['nightStart'],
            placeholder: '22:00',
            help: '24-hour time. A window that passes midnight is fine.'
          },
          { id: 'nightEnd', kind: 'text', label: 'Night ends', path: ['nightEnd'], placeholder: '06:30' },
          {
            id: 'burnInAvoidance',
            kind: 'bool',
            label: 'Burn-in avoidance',
            path: ['burnInAvoidance'],
            help: 'Slowly shifts the clock and captions so they do not sit on the same pixels.'
          }
        ]
      },
      {
        id: 'music',
        label: 'Music',
        rows: musicRows(current)
      }
    ];
  }

  function formatValue(row, value, catalogs) {
    if (row.kind === 'bool') return value ? 'On' : 'Off';
    if (row.kind === 'enum') return (row.labels && row.labels[value]) || value;
    if (row.kind === 'number') {
      if (row.format === 'stars') return value ? value + ' stars' : 'Off';
      if (row.format === 'edge') return value ? value + ' px' : 'Off';
      if (row.format === 'fade') return value ? (value / 1000).toFixed(1) + ' s' : 'Off';
      return String(value) + (row.suffix || '');
    }
    if (row.kind === 'multi') {
      var count = Array.isArray(value) ? value.length : 0;
      if (!count) return 'None';
      return count === 1 ? '1 selected' : count + ' selected';
    }
    if (row.kind === 'lines') {
      var lines = Array.isArray(value) ? value : [];
      return lines.length ? lines.length + ' phrases' : 'None';
    }
    if (row.kind === 'one') {
      if (!value) return 'Off';
      var choices = catalogs && catalogs[row.catalog] ? catalogs[row.catalog] : [];
      for (var c = 0; c < choices.length; c++) {
        if (choices[c].id === value) return choices[c].label;
      }
      return 'Saved playlist';
    }
    if (row.kind === 'secret') return value ? 'Saved on this TV' : 'Not set';
    if (row.kind === 'button') return 'Run';
    return value ? String(value) : 'Not set';
  }

  function createSettingsScreen(opts) {
    var store = opts.store;
    var settings = store.load();
    var catalogs = { albums: [], people: [], folders: [] };
    var openFlag = false;
    var mode = 'sections';
    var sectionIndex = 0;
    var rowIndex = 0;
    var pickIndex = 0;
    var editing = false;
    var navEl = opts.navEl;
    var paneEl = opts.paneEl;
    var statusEl = opts.statusEl;
    var rootEl = opts.rootEl;

    function currentSection() {
      return sections(settings)[sectionIndex];
    }

    function persist() {
      settings = store.save(settings);
      if (opts.onChange) opts.onChange(settings);
    }

    function setStatus(message) {
      if (statusEl) statusEl.textContent = message || '';
    }

    function applyFocus() {
      var nodes = rootEl.querySelectorAll('.is-focus');
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-focus');
      var target = null;
      if (mode === 'picker') {
        target = paneEl.querySelector('[data-pick="' + pickIndex + '"]');
      } else if (mode === 'rows' || editing) {
        target = paneEl.querySelector('[data-row="' + rowIndex + '"]');
      } else {
        target = navEl.querySelector('[data-section="' + sectionIndex + '"]');
      }
      if (target) {
        target.classList.add('is-focus');
        if (target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
      }
    }

    function renderNav() {
      navEl.innerHTML = '';
      var list = sections(settings);
      for (var i = 0; i < list.length; i++) {
        var button = el('button', 'nav-item', list[i].label);
        button.type = 'button';
        button.setAttribute('data-section', String(i));
        if (i === sectionIndex) button.classList.add('is-current');
        button.addEventListener('click', sectionClick(i));
        navEl.appendChild(button);
      }
    }

    function sectionClick(index) {
      return function () {
        sectionIndex = index;
        rowIndex = 0;
        mode = 'rows';
        editing = false;
        render();
      };
    }

    function renderRows() {
      paneEl.innerHTML = '';
      var rows = currentSection().rows;
      var heading = el('h2', 'pane-title', currentSection().label);
      paneEl.appendChild(heading);
      for (var i = 0; i < rows.length; i++) {
        paneEl.appendChild(renderRow(rows[i], i));
      }
    }

    function renderRow(row, index) {
      var wrap = el('div', 'row');
      wrap.setAttribute('data-row', String(index));
      wrap.appendChild(el('div', 'row-label', row.label));
      if (row.kind === 'text' || row.kind === 'secret' || row.kind === 'lines') {
        var input = document.createElement(row.kind === 'lines' ? 'textarea' : 'input');
        input.className = 'row-input';
        if (row.kind === 'secret') input.type = 'password';
        else if (row.kind !== 'lines') input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = row.placeholder || '';
        var raw = readPath(settings, row.path);
        input.value = row.kind === 'lines' ? (Array.isArray(raw) ? raw.join('\n') : '') : (raw || '');
        input.setAttribute('data-input', row.id);
        input.addEventListener('focus', function () {
          editing = true;
          mode = 'rows';
          rowIndex = index;
          applyFocus();
        });
        input.addEventListener('change', function () {
          commitInput(row, input.value);
        });
        input.addEventListener('keydown', function (event) {
          if (row.kind !== 'lines' && (event.key === 'Enter' || event.keyCode === 13)) {
            event.preventDefault();
            commitInput(row, input.value);
            input.blur();
            editing = false;
          }
        });
        wrap.appendChild(input);
      } else {
        wrap.appendChild(el('div', 'row-value', formatValue(row, row.path ? readPath(settings, row.path) : '', catalogs)));
      }
      if (row.help) wrap.appendChild(el('p', 'row-help', row.help));
      wrap.addEventListener('click', function () {
        rowIndex = index;
        mode = 'rows';
        activateRow();
      });
      return wrap;
    }

    function commitInput(row, raw) {
      if (row.kind === 'lines') writePath(settings, row.path, raw);
      else writePath(settings, row.path, raw);
      persist();
    }

    function oneItems(row) {
      return [{ id: '', label: 'Off' }].concat(catalogs[row.catalog] || []);
    }

    function renderPicker() {
      var row = currentSection().rows[rowIndex];
      var single = row.kind === 'one';
      var items = single ? oneItems(row) : (catalogs[row.catalog] || []);
      var selected = single ? readPath(settings, row.path) : readPath(settings, row.path).slice();
      paneEl.innerHTML = '';
      paneEl.appendChild(el('h2', 'pane-title', row.label));
      paneEl.appendChild(el('p', 'row-help', single ? 'OK chooses one playlist. Back returns.' : 'OK toggles an item. Back returns to the list.'));
      if (!items.length) {
        paneEl.appendChild(el('p', 'empty-note', 'Nothing loaded yet. Test the connection, then open this list again.'));
        return;
      }
      for (var i = 0; i < items.length; i++) {
        var on = single ? selected === items[i].id : selected.indexOf(items[i].id) !== -1;
        var button = el('button', 'pick-item', (on ? 'On  ' : 'Off  ') + items[i].label);
        button.type = 'button';
        button.setAttribute('data-pick', String(i));
        button.addEventListener('click', togglePick(i));
        paneEl.appendChild(button);
      }
    }

    function togglePick(index) {
      return function () {
        pickIndex = index;
        flipPick();
      };
    }

    function flipPick() {
      var row = currentSection().rows[rowIndex];
      if (row.kind === 'one') {
        var choices = oneItems(row);
        var chosen = choices[pickIndex];
        if (!chosen) return;
        writePath(settings, row.path, chosen.id);
        persist();
        render();
        return;
      }
      var items = catalogs[row.catalog] || [];
      var item = items[pickIndex];
      if (!item) return;
      var selected = readPath(settings, row.path).slice();
      var at = selected.indexOf(item.id);
      if (at === -1) selected.push(item.id);
      else selected.splice(at, 1);
      writePath(settings, row.path, selected);
      persist();
      render();
    }

    function render() {
      if (!openFlag) return;
      var rows = currentSection().rows;
      if (rowIndex >= rows.length) rowIndex = Math.max(0, rows.length - 1);
      renderNav();
      if (mode === 'picker') renderPicker();
      else renderRows();
      applyFocus();
    }

    function cycle(row, direction) {
      var value = readPath(settings, row.path);
      if (row.kind === 'bool') {
        writePath(settings, row.path, !value);
      } else if (row.kind === 'enum') {
        var at = row.options.indexOf(value);
        if (at < 0) at = 0;
        var next = (at + direction + row.options.length) % row.options.length;
        writePath(settings, row.path, row.options[next]);
      } else if (row.kind === 'number') {
        var stepped = utilClamp(value + direction * row.step, row.min, row.max);
        writePath(settings, row.path, stepped);
      } else {
        return false;
      }
      persist();
      render();
      return true;
    }

    function utilClamp(value, min, max) {
      if (value < min) return min;
      if (value > max) return max;
      return value;
    }

    function activateRow() {
      var row = currentSection().rows[rowIndex];
      if (!row) return;
      if (row.kind === 'button' && row.id === 'test') {
        setStatus('Checking the server...');
        Alcove.probeImmich(settings, opts.fetch || root.fetch).then(function (result) {
          setStatus(result.message);
          if (result.ok && opts.onConnect) opts.onConnect(settings);
        }).catch(function () {
          setStatus('The connection check failed before it got an answer.');
        });
        return;
      }
      if (row.kind === 'button' && row.id === 'testMusic') {
        setStatus('Checking the music server...');
        var job = opts.onTestMusic ? opts.onTestMusic(settings) : Promise.resolve({ message: 'Music test is not wired.' });
        Promise.resolve(job).then(function (result) {
          if (result && result.catalogs) setCatalogs(result.catalogs);
          setStatus(result && result.message ? result.message : 'Music server answered.');
        }).catch(function () {
          setStatus('The music server did not answer. Check the URL and the password.');
        });
        return;
      }
      if (row.kind === 'button' && row.id === 'addStream') {
        var streams = settings.music.radio.streams.slice();
        if (streams.length >= 8) {
          setStatus('Eight streams is the limit.');
          return;
        }
        streams.push({ name: 'Stream ' + (streams.length + 1), url: '', season: 'any' });
        settings.music.radio.streams = streams;
        persist();
        render();
        return;
      }
      if (row.kind === 'multi' || row.kind === 'one') {
        mode = 'picker';
        pickIndex = 0;
        render();
        return;
      }
      if (row.kind === 'text' || row.kind === 'secret' || row.kind === 'lines') {
        var input = paneEl.querySelector('[data-input="' + row.id + '"]');
        if (input) {
          editing = true;
          input.focus();
        }
        return;
      }
      cycle(row, 1);
    }

    function blurEditor() {
      var active = document.activeElement;
      if (active && active.blur) active.blur();
      editing = false;
    }

    function handleKey(event) {
      if (!openFlag) return false;
      var back = event.keyCode === 461 || event.key === 'Escape' || event.key === 'Back' || event.key === 'BrowserBack' || event.key === 'XF86Back';
      var yellow = event.keyCode === 405 || event.key === 's' || event.key === 'S';
      if (editing) {
        if (back || event.keyCode === 405) {
          blurEditor();
          applyFocus();
          return true;
        }
        return false;
      }
      if (back || yellow) {
        if (editing) {
          blurEditor();
          applyFocus();
          return true;
        }
        if (mode === 'picker') {
          mode = 'rows';
          render();
          return true;
        }
        if (yellow || mode === 'rows' || mode === 'sections') {
          close();
          return true;
        }
      }
      if (event.key === 'ArrowUp' || event.keyCode === 38) {
        move(-1);
        return true;
      }
      if (event.key === 'ArrowDown' || event.keyCode === 40) {
        move(1);
        return true;
      }
      if (event.key === 'ArrowLeft' || event.keyCode === 37) {
        nudge(-1);
        return true;
      }
      if (event.key === 'ArrowRight' || event.keyCode === 39) {
        nudge(1);
        return true;
      }
      if (event.key === 'Enter' || event.keyCode === 13) {
        if (mode === 'picker') flipPick();
        else if (mode === 'sections') {
          mode = 'rows';
          render();
        } else activateRow();
        return true;
      }
      return false;
    }

    function move(direction) {
      if (mode === 'picker') {
        var row = currentSection().rows[rowIndex];
        var items = row.kind === 'one' ? oneItems(row) : (catalogs[row.catalog] || []);
        if (!items.length) return;
        pickIndex = (pickIndex + direction + items.length) % items.length;
        applyFocus();
        return;
      }
      if (mode === 'sections') {
        var count = sections(settings).length;
        sectionIndex = (sectionIndex + direction + count) % count;
        rowIndex = 0;
        render();
        return;
      }
      var rows = currentSection().rows;
      rowIndex = (rowIndex + direction + rows.length) % rows.length;
      applyFocus();
    }

    function nudge(direction) {
      if (mode === 'sections') {
        if (direction > 0) {
          mode = 'rows';
          render();
        }
        return;
      }
      if (mode === 'picker') {
        if (direction < 0) {
          mode = 'rows';
          render();
        } else flipPick();
        return;
      }
      var row = currentSection().rows[rowIndex];
      if (!cycle(row, direction)) {
        if (direction < 0) {
          mode = 'sections';
          render();
        } else if (row.kind === 'multi' || row.kind === 'one' || row.kind === 'text' || row.kind === 'secret' || row.kind === 'lines' || row.kind === 'button') {
          activateRow();
        }
      }
    }

    function open() {
      settings = store.load();
      openFlag = true;
      mode = 'sections';
      editing = false;
      rootEl.hidden = false;
      render();
      if (opts.onOpen) opts.onOpen();
    }

    function close() {
      blurEditor();
      openFlag = false;
      rootEl.hidden = true;
      if (opts.onClose) opts.onClose(settings);
    }

    function setCatalogs(next) {
      var keys = ['albums', 'people', 'folders', 'navidromePlaylists', 'jellyfinPlaylists'];
      for (var i = 0; i < keys.length; i++) {
        if (Object.prototype.hasOwnProperty.call(next, keys[i])) catalogs[keys[i]] = next[keys[i]] || [];
      }
      if (openFlag) render();
    }

    return {
      open: open,
      close: close,
      isOpen: function () { return openFlag; },
      setCatalogs: setCatalogs,
      getSettings: function () { return settings; },
      handleKey: handleKey,
      setStatus: setStatus
    };
  }

  Alcove.createSettingsScreen = createSettingsScreen;
})(typeof window !== 'undefined' ? window : globalThis);
