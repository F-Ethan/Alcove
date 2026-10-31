(function (root) {
  var Alcove = root.Alcove = root.Alcove || {};

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    if (number < min) return min;
    if (number > max) return max;
    return number;
  }

  function pad2(value) {
    var number = Math.floor(Math.abs(Number(value) || 0));
    return (number < 10 ? '0' : '') + number;
  }

  function apiBase(serverUrl) {
    var url = String(serverUrl || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(url)) return '';
    if (/\/api$/i.test(url)) return url;
    return url + '/api';
  }

  function clockMinutes(value) {
    var match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function formatClock(value, fallback) {
    var minutes = clockMinutes(value);
    if (minutes === null) return fallback;
    return pad2(Math.floor(minutes / 60)) + ':' + pad2(minutes % 60);
  }

  // True when local time sits inside start..end, including a window that crosses midnight.
  function isNight(date, start, end) {
    var startMin = clockMinutes(start);
    var endMin = clockMinutes(end);
    if (startMin === null || endMin === null) return false;
    var now = date.getHours() * 60 + date.getMinutes();
    if (startMin === endMin) return false;
    if (startMin < endMin) return now >= startMin && now < endMin;
    return now >= startMin || now < endMin;
  }

  function monthDay(date) {
    return (date.getMonth() + 1) * 100 + date.getDate();
  }

  // Northern hemisphere. Christmas runs Dec 1 through Jan 6 and wins over winter.
  function decorationForDate(date) {
    var key = monthDay(date);
    if (key >= 1201 || key <= 106) return 'christmas';
    var month = date.getMonth() + 1;
    if (month === 12 || month <= 2) return 'winter';
    if (month <= 5) return 'spring';
    if (month <= 8) return 'summer';
    return 'fall';
  }

  function activeDecoration(mode, date) {
    if (mode === 'none') return 'none';
    if (mode === 'auto' || !mode) return decorationForDate(date);
    return mode;
  }

  Alcove.util = {
    clamp: clamp,
    pad2: pad2,
    apiBase: apiBase,
    clockMinutes: clockMinutes,
    formatClock: formatClock,
    isNight: isNight,
    decorationForDate: decorationForDate,
    activeDecoration: activeDecoration
  };
})(typeof window !== 'undefined' ? window : globalThis);
