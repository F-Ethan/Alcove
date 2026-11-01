const fs = require('fs');
const path = require('path');
const vm = require('vm');

function memoryStorage() {
  const data = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem: function (key, value) { data[key] = String(value); },
    removeItem: function (key) { delete data[key]; }
  };
}

function loadAlcove(files) {
  const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    Promise: Promise,
    Date: Date,
    Math: Math,
    JSON: JSON,
    URL: URL,
    encodeURIComponent: encodeURIComponent,
    localStorage: memoryStorage()
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  files.forEach(function (file) {
    const full = path.join(__dirname, '..', 'app', 'js', file);
    vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: file });
  });
  return sandbox.Alcove;
}

module.exports = { loadAlcove: loadAlcove, memoryStorage: memoryStorage };
